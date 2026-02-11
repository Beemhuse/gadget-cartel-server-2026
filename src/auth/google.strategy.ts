import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
      passReqToCallback: false, // ✅ REQUIRED
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile) {
    // Extract user details from Google profile
    const email = profile.emails?.[0]?.value;
    const firstName = profile.name?.givenName || '';
    const lastName = profile.name?.familyName || '';
    const picture = profile.photos?.[0]?.value || null;
    const googleId = profile.id;

    if (!email) {
      throw new Error('No email found in Google profile');
    }

    // Create or update user in database with proper admin status
    const user = await this.authService.validateGoogleUser({
      email,
      firstName,
      lastName,
      picture,
      googleId,
    });

    // Return the user from database (with is_admin properly set)
    return user;
  }
}
