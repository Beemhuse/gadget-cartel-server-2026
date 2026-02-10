import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Resend } from 'resend';

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
    picture: null;
    googleId: string;
  }) {
    const { email, firstName, lastName, picture, googleId } = details;

    return this.prisma.user.upsert({
      where: { email },
      update: {
        name: `${firstName} ${lastName}`,
        picture,
        googleId,
        isVerified: true, // ✅ Google users auto-verified
      },
      create: {
        email,
        name: `${firstName} ${lastName}`,
        picture,
        googleId,
        isVerified: true,
      },
    });
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
    }/auth/reset-password?token=${token}`;

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
