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
  Query,
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

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  googleAuth() {
    // Passport handles redirect
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthRedirect(@Req() req, @Res() res: express.Response) {
    const { access_token, refresh_token } = await this.authService.login(
      req.user,
    );

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    /**
     * Redirect tokens to frontend.
     * Frontend should:
     * 1. Read query params
     * 2. Store tokens securely (cookies / memory)
     * 3. Redirect user internally
     */
    return res.redirect(
      `${frontendUrl}/oauth/callback?access_token=${access_token}&refresh_token=${refresh_token}`,
    );
  }

  /* ==========================
     CURRENT USER
  ========================== */

  @Get('user')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get currently authenticated user' })
  async getUser(@Req() req) {
    return req.user;
  }
}
