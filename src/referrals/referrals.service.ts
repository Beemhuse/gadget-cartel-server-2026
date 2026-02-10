import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReferralsService {
  constructor(private prisma: PrismaService) {}

  async getStats(userId: string) {
    const referral = await this.prisma.referral.findFirst({
      where: { referrerId: userId },
    });
    if (!referral) return { code: null, referrals: 0, earnings: 0 };

    // Valid logic would count how many users used this code
    return {
      code: referral.code,
      referrals: 0, // Implement real counting logic
      earnings: 0,
    };
  }

  async validateCode(code: string) {
    const referral = await this.prisma.referral.findUnique({ where: { code } });
    return { valid: !!referral, referral };
  }
}
