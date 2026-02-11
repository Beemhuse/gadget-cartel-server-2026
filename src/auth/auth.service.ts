import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Resend } from 'resend';

const ADMIN_EMAIL_WHITELIST = new Set<string>([
  // Add admin emails here (lowercase recommended).
  'beemhuse@gmail.com',
  'mediacarteleleazar@gmail.com',
]);

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const isAdminEmail = (email: string) =>
  ADMIN_EMAIL_WHITELIST.has(normalizeEmail(email));

@Injectable()
export class AuthService {
  private resend: Resend;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  /* ==========================
     EMAIL HELPERS
  ========================== */
  private async sendVerificationCode(email: string, code: string) {
    if (!process.env.RESEND_API_KEY) {
      console.log('======================================');
      console.log(`[DEV OTP] Verification code for ${email}: ${code}`);
      console.log('======================================');
      return;
    }

    await this.resend.emails.send({
      from: 'Gadget Cartel <no-reply@karteq.com.ng>',
      to: email,
      subject: 'Your verification code',
      html: `
      <h2>Email Verification</h2>
      <p>Your verification code is:</p>
      <h1>${code}</h1>
      <p>This code expires in 15 minutes.</p>
    `,
    });
  }

  private generateOtp(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /* ==========================
     REGISTER + VERIFY EMAIL
  ========================== */

  async resendOtpCode(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isVerified) {
      return { message: 'Email already verified' };
    }

    const verificationCode = this.generateOtp();
    const verificationExp = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.user.update({
      where: { email },
      data: { verificationCode, verificationExp },
    });

    await this.sendVerificationCode(email, verificationCode);

    return { message: 'Verification code resent' };
  }

  async register(data: {
    email: string;
    password: string;
    full_name: string;
    phone_number?: string;
    country?: string;
    state?: string;
  }) {
    const { email, password, full_name, phone_number, country, state } = data;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('User already exists');
    }

    const isAdmin = isAdminEmail(email);
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = this.generateOtp();
    const verificationExp = new Date(Date.now() + 15 * 60 * 1000);

    // Send OTP FIRST
    await this.sendVerificationCode(email, verificationCode);

    // Create user with all fields
    await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: full_name,
        phone: phone_number,
        country,
        state,
        is_admin: isAdmin,
        isVerified: false,
        verificationCode,
        verificationExp,
      },
    });

    return {
      message: 'Verification code sent to email',
    };
  }

  async verifyEmailCode(email: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isVerified) {
      return { message: 'Email already verified' };
    }

    if (
      !user.verificationCode ||
      user.verificationCode !== code ||
      !user.verificationExp ||
      user.verificationExp < new Date()
    ) {
      throw new BadRequestException('Invalid or expired code');
    }

    await this.prisma.user.update({
      where: { email },
      data: {
        isVerified: true,
        verificationCode: null,
        verificationExp: null,
      },
    });

    return { message: 'Email verified successfully' };
  }

  /* ==========================
     LOGIN
  ========================== */

  async validateUser(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) return null;

    if (!user.isVerified) {
      throw new UnauthorizedException('Please verify your email');
    }

    const valid = await bcrypt.compare(pass, user.password);
    if (!valid) return null;

    if (!user.is_admin && isAdminEmail(email)) {
      try {
        const updated = await this.prisma.user.update({
          where: { id: user.id },
          data: { is_admin: true },
        });
        user.is_admin = updated.is_admin;
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Failed to promote admin:', error);
        }
      }
    }

    const { password, ...result } = user;
    return result;
  }

  async login(user: { email: string; id: string; is_admin: boolean }) {
    const payload = {
      email: user.email,
      sub: user.id, // Standard JWT subject
      userId: user.id, // Backward compatibility
      is_admin: user.is_admin,
    };

    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to update lastLogin:', error);
      }
    }

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: user.id,
        email: user.email,
        is_admin: user.is_admin,
      },
    };
  }

  /* ==========================
     GOOGLE LOGIN
  ========================== */

  async validateGoogleUser(details: {
    email: string;
    firstName: string;
    lastName: string;
    picture: string | null;
    googleId: string;
  }) {
    const { email, firstName, lastName, picture, googleId } = details;
    const isAdmin = isAdminEmail(email);
    const googleName = `${firstName} ${lastName}`;

    console.log('======================================');
    console.log('Validating Google user:', email);
    console.log('Is in admin whitelist:', isAdmin);
    console.log('Google profile picture:', picture);
    console.log('======================================');

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true },
    });

    return this.prisma.user.upsert({
      where: { email },
      update: {
        // Only update name if user doesn't have one
        name: existingUser?.name || googleName,
        googlePic: picture,
        googleId,
        isVerified: true, // ✅ Google users auto-verified
        is_admin: isAdmin, // ✅ Always update admin status based on whitelist
      },
      create: {
        email,
        name: googleName,
        googlePic: picture,
        googleId,
        isVerified: true,
        is_admin: isAdmin,
      },
    });
  }

  /* ==========================
     USER PROFILE
  ========================== */

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        country: true,
        state: true,
        googlePic: true,
        googleId: true,
        is_admin: true,
        isVerified: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return user;
  }

  /* ==========================
     PASSWORD RESET
  ========================== */

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('User not found');

    const token = this.jwtService.sign(
      { email, type: 'reset' },
      { expiresIn: '15m' },
    );

    const resetLink = `${
      process.env.FRONTEND_URL || 'http://localhost:3000'
    }/forgot-password/reset-password?token=${token}`;

    if (!process.env.RESEND_API_KEY) {
      console.log('[DEV RESET LINK]', resetLink);
      return { message: 'Reset link logged (dev mode)' };
    }

    await this.resend.emails.send({
      from: 'Gadget Cartel <onboarding@resend.dev>',
      to: email,
      subject: 'Password Reset',
      html: `<a href="${resetLink}">Reset Password</a>`,
    });

    return { message: 'Password reset email sent' };
  }

  async resetPassword(token: string, newPass: string) {
    try {
      const payload = this.jwtService.verify(token);
      if (payload.type !== 'reset') throw new Error();

      const hashed = await bcrypt.hash(newPass, 10);
      await this.prisma.user.update({
        where: { email: payload.email },
        data: { password: hashed },
      });

      return { message: 'Password updated successfully' };
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }
  }
}
