import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import express from 'express';
import {
  RegisterDto,
  LoginDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { GoogleAuthGuard } from './google-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /* ==========================
     EMAIL + PASSWORD
  ========================== */

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.email, body.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.authService.login(user);
  }

  @Post('register')
  @ApiOperation({
    summary: 'Register a new user (email verification required)',
  })
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  /* ==========================
     PASSWORD RESET
  ========================== */

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset email' })
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using token' })
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.token, body.password);
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email using 4-digit code' })
  async verifyEmail(@Body() body: VerifyEmailDto) {
    return this.authService.verifyEmailCode(body.email, body.otp);
  }

  /* ==========================
     GOOGLE OAUTH
  ========================== */

  @Get('google/init')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  googleAuth() {
    // Passport handles redirect
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login (alias)' })
  googleAuthAlias() {
    // Passport handles redirect
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthRedirect(@Req() req, @Res() res: express.Response) {
    // 1. Get user data from Google (Passport puts it in req.user)
    const user = req.user;
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    console.log('======================================');
    console.log('Google OAuth callback received');
    console.log('User from database:', {
      id: user.id,
      email: user.email,
      is_admin: user.is_admin,
      name: user.name,
      googlePic: user.googlePic,
    });
    console.log('======================================');

    // 2. Pass the user to your service to generate a JWT
    const {
      access_token,
      refresh_token,
      user: loginUser,
    } = await this.authService.login(user);

    console.log('JWT generated with payload:', {
      email: loginUser.email,
      is_admin: loginUser.is_admin,
    });

    // 3. Send the token back (as a cookie or JSON)
    const emailParam = encodeURIComponent(
      loginUser?.email || (user as any)?.email || '',
    );

    return res.redirect(
      `${frontendUrl}/sign-in?access_token=${access_token}&refresh_token=${refresh_token}&email=${emailParam}`,
    );
  }

  /* ==========================
     CURRENT USER
  ========================== */

  @Get('user')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get currently authenticated user profile' })
  @ApiResponse({
    status: 200,
    description:
      'Returns the complete user profile including Google picture, admin status, and account details',
  })
  async getUser(@Req() req) {
    const userId = req.user.userId || req.user.sub;

    const user = await this.authService.getUserProfile(userId);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      country: user.country,
      state: user.state,
      googlePic: user.googlePic,
      googleId: user.googleId,
      is_admin: user.is_admin,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    };
  }
}
