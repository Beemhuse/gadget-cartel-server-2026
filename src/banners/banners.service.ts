import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateBannerOneDto, UpdateBannerOneDto } from './dto/banner-one.dto';
import { Prisma } from '@prisma/client';
import type { Express } from 'express';

@Injectable()
export class BannersService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  private normalizeFeatures(input: any): string[] {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        // fallback to newline split
      }
      return trimmed
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    }
    return [];
  }

  async findBannerOnePublic() {
    return this.prisma.bannerOne.findFirst({
      where: { isPublished: true },
      orderBy: [{ displayOrder: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async findAllBannerOneAdmin(query: any) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.page_size) || 10;
    const skip = (page - 1) * pageSize;

    const [results, count] = await Promise.all([
      this.prisma.bannerOne.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.bannerOne.count(),
    ]);

    return {
      results,
      count,
      page,
      page_size: pageSize,
    };
  }

  async findBannerOneAdmin(id: string) {
    const banner = await this.prisma.bannerOne.findUnique({
      where: { id },
    });
    if (!banner) {
      throw new NotFoundException('Banner not found');
    }
    return banner;
  }

  async createBannerOne(
    data: CreateBannerOneDto & { features?: any },
    file?: Express.Multer.File,
  ) {
    let imageUrl = data.imageUrl;
    let imagePublicId: string | null = null;

    if (file) {
      const upload = await this.cloudinary.uploadImage(file, 'banners');
      imageUrl = upload.secure_url;
      imagePublicId = upload.public_id;
    }

    const features = this.normalizeFeatures(data.features);
    const price =
      data.price !== undefined && data.price !== null && data.price !== 0
        ? new Prisma.Decimal(data.price as any)
        : undefined;

    return this.prisma.bannerOne.create({
      data: {
        title: data.title,
        badgeText: data.badgeText || null,
        features: features.length ? features : [],
        price,
        buttonLabel: data.buttonLabel || null,
        buttonLink: data.buttonLink || null,
        imageUrl: imageUrl || null,
        imagePublicId,
        isPublished: Boolean(data.isPublished),
        displayOrder:
          data.displayOrder !== undefined && data.displayOrder !== null
            ? Number(data.displayOrder)
            : 0,
      },
    });
  }

  async updateBannerOne(
    id: string,
    data: UpdateBannerOneDto & { features?: any },
    file?: Express.Multer.File,
  ) {
    const banner = await this.findBannerOneAdmin(id);

    let imageUrl = banner.imageUrl;
    let imagePublicId = banner.imagePublicId;

    if (file) {
      if (banner.imagePublicId) {
        await this.cloudinary.deleteImage(banner.imagePublicId);
      }
      const upload = await this.cloudinary.uploadImage(file, 'banners');
      imageUrl = upload.secure_url;
      imagePublicId = upload.public_id;
    } else if (data.imageUrl !== undefined && data.imageUrl !== null) {
      if (banner.imagePublicId) {
        await this.cloudinary.deleteImage(banner.imagePublicId);
      }
      imageUrl = data.imageUrl;
      imagePublicId = null;
    }

    const updateData: any = {
      title: data.title ?? banner.title,
      badgeText: data.badgeText ?? banner.badgeText,
      buttonLabel: data.buttonLabel ?? banner.buttonLabel,
      buttonLink: data.buttonLink ?? banner.buttonLink,
      isPublished:
        data.isPublished !== undefined ? data.isPublished : banner.isPublished,
      displayOrder:
        data.displayOrder !== undefined
          ? Number(data.displayOrder)
          : banner.displayOrder,
      imageUrl,
      imagePublicId,
    };

    if (data.features !== undefined) {
      const features = this.normalizeFeatures(data.features);
      updateData.features = features.length ? features : [];
    }

    if (data.price !== undefined && data.price !== null && data.price !== 0) {
      updateData.price = new Prisma.Decimal(data.price as any);
    } else if (data.price === null) {
      updateData.price = null;
    }

    return this.prisma.bannerOne.update({
      where: { id },
      data: updateData,
    });
  }

  async removeBannerOne(id: string) {
    const banner = await this.findBannerOneAdmin(id);
    if (banner.imagePublicId) {
      await this.cloudinary.deleteImage(banner.imagePublicId);
    }
    return this.prisma.bannerOne.delete({
      where: { id },
    });
  }
}
