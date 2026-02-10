import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  async createContact(data: any) {
    return this.prisma.contactRequest.create({ data });
  }

  async getFaqs() {
    return this.prisma.faq.findMany({
      orderBy: { order: 'asc' },
    });
  }

  // Admin methods
  async findAllContacts() {
    return this.prisma.contactRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
