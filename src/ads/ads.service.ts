import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdDto, UpdateAdDto } from './dto/ads.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import type { Express } from 'express';

@Injectable()
export class AdsService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  private computeStatus(ad: any) {
    const now = new Date();
    if (!ad.isPublished) return 'draft';
    if (ad.startDate && new Date(ad.startDate) > now) return 'scheduled';
    if (ad.endDate && new Date(ad.endDate) < now) return 'expired';
    return 'active';
  }

  async findAllPublic() {
    const ads = await this.prisma.ad.findMany({
      where: { isPublished: true },
      orderBy: { displayOrder: 'asc' },
    });
    return ads.map((ad) => ({
      ...ad,
      computed_status: this.computeStatus(ad),
    }));
  }

  async findAllAdmin(query: any) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.page_size) || 10;
    const skip = (page - 1) * pageSize;

    const [results, count] = await Promise.all([
      this.prisma.ad.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ad.count(),
    ]);

    const mappedResults = results.map((ad) => ({
      ...ad,
      computed_status: this.computeStatus(ad),
    }));

    return {
      results: mappedResults,
      count,
      page,
      page_size: pageSize,
    };
  }

  async findOne(id: string) {
    const ad = await this.prisma.ad.findUnique({
      where: { id },
    });
    if (!ad) {
      throw new NotFoundException('Ad not found');
    }
    return ad;
  }

  async create(data: CreateAdDto, file?: Express.Multer.File) {
    let adMedia = data.adMedia;
    let publicId: string | null = null;

    if (file) {
      const upload = await this.cloudinary.uploadImage(file, 'ads');
      adMedia = upload.secure_url;
      publicId = upload.public_id;
    }

    return this.prisma.ad.create({
      data: {
        ...data,
        adMedia,
        publicId,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });
  }

  async update(id: string, data: UpdateAdDto, file?: Express.Multer.File) {
    const ad = await this.findOne(id);

    // Always start with existing values
    let adMedia = ad.adMedia;
    let publicId = ad.publicId;

    // Only change if a new file is uploaded
    if (file) {
      // delete old image
      if (ad.publicId) {
        await this.cloudinary.deleteImage(ad.publicId);
      }

      const upload = await this.cloudinary.uploadImage(file, 'ads');
      adMedia = upload.secure_url;
      publicId = upload.public_id;
    }

    const updateData: any = {
      ...data,
      adMedia,
      publicId,
    };

    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);

    return this.prisma.ad.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    const ad = await this.findOne(id);
    if (ad.publicId) {
      await this.cloudinary.deleteImage(ad.publicId);
    }
    return this.prisma.ad.delete({
      where: { id },
    });
  }
  async deleteImage(id: string) {
    const ad = await this.findOne(id);

    if (!ad.publicId && !ad.adMedia) {
      throw new NotFoundException('Ad does not have an image to delete');
    }

    // let deleteResult = null;

    // Delete from Cloudinary if publicId exists
    if (ad.publicId) {
      try {
        // deleteResult = await this.cloudinary.deleteImage(ad.publicId);
      } catch (error) {
        // Log error but continue - we'll still clear the database fields
        console.error('Failed to delete image from Cloudinary:', error);
      }
    }

    // Update database to remove image references
    const updatedAd = await this.prisma.ad.update({
      where: { id },
      data: {
        adMedia: null,
        publicId: null,
      },
    });

    return {
      success: true,
      message: 'Image deleted successfully',
      data: updatedAd,
      // cloudinaryResult: deleteResult,
    };
  }

  async reschedule(id: string, data: { startDate: string; endDate: string }) {
    await this.findOne(id);
    return this.prisma.ad.update({
      where: { id },
      data: {
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
    });
  }

  async duplicate(id: string) {
    const ad = await this.findOne(id);
    const {
      id: _,
      createdAt: __,
      updatedAt: ___,
      publicId: __publicId,
      ...rest
    } = ad;

    // We don't copy the publicId because it points to a specific Cloudinary resource.
    // If we delete one ad, we don't want to delete the image for the other.
    // However, if we don't copy it, we can't delete the image when the duplicate is deleted.
    // Standard practice for duplicates:
    // Option A: Copy the image content to a NEW Cloudinary resource (expensive/slow).
    // Option B: Share the image URL but DO NOT share the publicId (so duplicate deletion doesn't kill the image).
    // result: The duplicate has the image URL but no publicId. It won't be able to delete the image from Cloudinary, which is safe.

    return this.prisma.ad.create({
      data: {
        ...rest,
        publicId: null, // Safety: duplicate doesn't own the image
        adName: `${rest.adName} (Copy)`,
        isPublished: false,
      },
    });
  }
}
