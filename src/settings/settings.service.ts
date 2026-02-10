import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const settings = await this.prisma.storeSettings.findMany();
    // Convert array to object for easier consumption
    return settings.reduce(
      (acc, curr) => ({ ...acc, [curr.key]: curr.value }),
      {},
    );
  }

  async update(key: string, value: string) {
    return this.prisma.storeSettings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
