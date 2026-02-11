import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import type { Express } from 'express';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { QueryProductDto } from './dto/query-product.dto';
import {
  CreateBrandDto,
  UpdateBrandDto,
  CreateTagDto,
  UpdateTagDto,
  CreateColorDto,
  UpdateColorDto,
  CreateStorageOptionDto,
  UpdateStorageOptionDto,
} from './dto/product-relations.dto';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async findAll(query: QueryProductDto) {
    const { page = 1, page_size = 20 } = query;
    const skip = (Number(page) - 1) * Number(page_size);

    const [results, count] = await Promise.all([
      this.prisma.product.findMany({
        include: { images: true, category: true, brand: true },
        skip,
        take: Number(page_size),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count(),
    ]);

    return { results, count };
  }

  async findTrending(query: { limit?: string | number }) {
    const rawLimit =
      typeof query?.limit === 'string' || typeof query?.limit === 'number'
        ? Number(query.limit)
        : 10;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 10;

    const aggregates = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    const productIds = aggregates.map((entry) => entry.productId);
    if (productIds.length === 0) {
      return { results: [], count: 0 };
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { images: true, category: true, brand: true },
    });

    const productById = new Map(
      products.map((product) => [product.id, product]),
    );
    const ordered = aggregates
      .map((entry) => productById.get(entry.productId))
      .filter(Boolean);

    return { results: ordered, count: ordered.length };
  }

  async findOne(slugOrId: string) {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        category: true,
        brand: true,
        colors: true,
        storageOptions: true,
        tags: true,
        reviews: {
          include: { user: { select: { name: true, googlePic: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async create(data: CreateProductDto) {
    const {
      category,
      brand,
      tagIds,
      colorIds,
      storageOptionIds,
      features,
      specifications,
      ...rest
    } = data;
    const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-');
    const sku =
      data.sku ||
      `SKU-${data.name
        .substring(0, 3)
        .toUpperCase()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    // Handle relations
    const productData: any = {
      ...rest,
      slug,
      sku,
      features: features ? JSON.parse(JSON.stringify(features)) : undefined,
      specifications: specifications
        ? JSON.parse(JSON.stringify(specifications))
        : undefined,
    };

    if (category) {
      productData.category = {
        connect: { id: category },
      };
    }

    if (brand) {
      productData.brand = {
        connect: { id: brand },
      };
    }

    if (tagIds && tagIds.length > 0) {
      productData.tags = {
        connect: tagIds.map((id) => ({ id })),
      };
    }

    if (colorIds && colorIds.length > 0) {
      productData.colors = {
        connect: colorIds.map((id) => ({ id })),
      };
    }

    if (storageOptionIds && storageOptionIds.length > 0) {
      productData.storageOptions = {
        connect: storageOptionIds.map((id) => ({ id })),
      };
    }

    return this.prisma.product.create({
      data: productData,
      include: {
        category: true,
        brand: true,
        images: true,
        colors: true,
        storageOptions: true,
        tags: true,
      },
    });
  }

  async update(slugOrId: string, data: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const {
      category,
      brand,
      tagIds,
      colorIds,
      storageOptionIds,
      features,
      specifications,
      ...rest
    } = data;

    // Handle relations
    const productData: any = {
      ...rest,
      features: features ? JSON.parse(JSON.stringify(features)) : undefined,
      specifications: specifications
        ? JSON.parse(JSON.stringify(specifications))
        : undefined,
    };

    if (category) {
      productData.category = {
        connect: { id: category },
      };
    }

    if (brand) {
      productData.brand = {
        connect: { id: brand },
      };
    }

    if (tagIds) {
      productData.tags = {
        set: tagIds.map((id) => ({ id })),
      };
    }

    if (colorIds) {
      productData.colors = {
        set: colorIds.map((id) => ({ id })),
      };
    }

    if (storageOptionIds) {
      productData.storageOptions = {
        set: storageOptionIds.map((id) => ({ id })),
      };
    }

    return this.prisma.product.update({
      where: { id: product.id },
      data: productData,
      include: {
        category: true,
        brand: true,
        images: true,
        colors: true,
        storageOptions: true,
        tags: true,
      },
    });
  }

  async remove(slugOrId: string) {
    const product = await this.findOne(slugOrId);

    // Delete images from Cloudinary first
    const images = await this.prisma.productImage.findMany({
      where: { productId: product.id },
    });

    for (const image of images) {
      if (image.publicId) {
        await this.cloudinary.deleteImage(image.publicId);
      }
    }

    return this.prisma.product.delete({
      where: { id: product.id },
    });
  }

  // Categories
  async findAllCategories(query: any) {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(
    payload: CreateCategoryDto,
    iconFile?: Express.Multer.File,
  ) {
    let iconUrl: string | null = null;
    let iconPublicId: string | null = null;

    if (iconFile) {
      const upload = await this.cloudinary.uploadImage(iconFile, 'categories');
      iconUrl = upload.secure_url;
      iconPublicId = upload.public_id;
    }

    return this.prisma.category.create({
      data: {
        ...payload,
        slug: payload.slug || payload.name.toLowerCase().replace(/\s+/g, '-'),
        icon: iconUrl,
        iconPublicId: iconPublicId,
      },
    });
  }

  async updateCategory(
    slugOrId: string,
    payload: UpdateCategoryDto,
    iconFile?: Express.Multer.File,
  ) {
    const category = await this.prisma.category.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    let iconUrl = category.icon;
    let iconPublicId = category.iconPublicId;

    if (iconFile) {
      // Delete old icon if any
      if (category.iconPublicId) {
        await this.cloudinary.deleteImage(category.iconPublicId);
      }
      const upload = await this.cloudinary.uploadImage(
        iconFile,
        'gadget-cartel-categories',
      );
      iconUrl = upload.secure_url;
      iconPublicId = upload.public_id;
    }

    return this.prisma.category.update({
      where: { id: category.id },
      data: {
        ...payload,
        icon: iconUrl,
        iconPublicId: iconPublicId,
      },
    });
  }

  async deleteCategory(slugOrId: string) {
    const category = await this.prisma.category.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.iconPublicId) {
      await this.cloudinary.deleteImage(category.iconPublicId);
    }

    return this.prisma.category.delete({
      where: { id: category.id },
    });
  }

  // Brands
  async findAllBrands() {
    return this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createBrand(data: CreateBrandDto) {
    const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-');
    return this.prisma.brand.create({
      data: { ...data, slug },
    });
  }

  async updateBrand(id: string, data: UpdateBrandDto) {
    return this.prisma.brand.update({
      where: { id },
      data,
    });
  }

  async deleteBrand(id: string) {
    return this.prisma.brand.delete({
      where: { id },
    });
  }

  // Tags
  async findAllTags() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createTag(data: CreateTagDto) {
    return this.prisma.tag.create({
      data,
    });
  }

  async updateTag(id: string, data: UpdateTagDto) {
    return this.prisma.tag.update({
      where: { id },
      data,
    });
  }

  async deleteTag(id: string) {
    return this.prisma.tag.delete({
      where: { id },
    });
  }

  // Colors
  async findAllColors() {
    return this.prisma.color.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createColor(data: CreateColorDto) {
    return this.prisma.color.create({
      data,
    });
  }

  async updateColor(id: string, data: UpdateColorDto) {
    return this.prisma.color.update({
      where: { id },
      data,
    });
  }

  async deleteColor(id: string) {
    return this.prisma.color.delete({
      where: { id },
    });
  }

  // Storage Options
  async findAllStorageOptions() {
    return this.prisma.storageOption.findMany({
      orderBy: { capacity: 'asc' },
    });
  }

  async createStorageOption(data: CreateStorageOptionDto) {
    return this.prisma.storageOption.create({
      data,
    });
  }

  async updateStorageOption(id: string, data: UpdateStorageOptionDto) {
    return this.prisma.storageOption.update({
      where: { id },
      data,
    });
  }

  async deleteStorageOption(id: string) {
    return this.prisma.storageOption.delete({
      where: { id },
    });
  }

  // Image Management
  async uploadProductImage(
    identifier: string,
    file: Express.Multer.File | undefined,
    payload: Record<string, any>,
  ) {
    if (!file || !('buffer' in file)) {
      throw new BadRequestException('Image file required');
    }

    const product = await this.prisma.product.findFirst({
      where: { OR: [{ id: identifier }, { slug: identifier }] },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const upload = await this.cloudinary.uploadImage(
      file,
      `gadget-cartel-products/${product.id}`,
    );

    const imagePayload = this.normalizeImagePayload(payload);

    return this.prisma.productImage.create({
      data: {
        productId: product.id,
        url: upload.secure_url,
        publicId: upload.public_id,
        isPrimary: imagePayload.isPrimary ?? false,
        sortOrder: imagePayload.sortOrder ?? 0,
      },
    });
  }

  async uploadProductImages(identifier: string, files: Express.Multer.File[]) {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ id: identifier }, { slug: identifier }] },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const uploadPromises = files.map((file) =>
      this.cloudinary.uploadImage(file, `products/${product.id}`),
    );

    const uploads = await Promise.all(uploadPromises);

    const imageData = uploads.map((upload) => ({
      productId: product.id,
      url: upload.secure_url,
      publicId: upload.public_id,
    }));

    return this.prisma.productImage.createMany({
      data: imageData,
    });
  }

  async updateProductImage(slugOrId: string, imageId: string, payload: any) {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const image = await this.prisma.productImage.findUnique({
      where: { id: imageId },
    });

    if (!image || image.productId !== product.id) {
      throw new NotFoundException('Image not found');
    }

    const imagePayload = this.normalizeImagePayload(payload);

    return this.prisma.productImage.update({
      where: { id: imageId },
      data: imagePayload,
    });
  }

  async deleteProductImage(slugOrId: string, imageId: string) {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const image = await this.prisma.productImage.findUnique({
      where: { id: imageId },
    });

    if (!image || image.productId !== product.id) {
      throw new NotFoundException('Image not found');
    }

    if (image.publicId) {
      await this.cloudinary.deleteImage(image.publicId);
    }

    return this.prisma.productImage.delete({
      where: { id: imageId },
    });
  }

  private normalizeImagePayload(payload: Record<string, any>) {
    if (!payload || typeof payload !== 'object') {
      return {};
    }

    const data: Record<string, any> = { ...payload };

    if (data.is_primary !== undefined && data.isPrimary === undefined) {
      data.isPrimary = data.is_primary;
    }

    if (data.sort_order !== undefined && data.sortOrder === undefined) {
      data.sortOrder = data.sort_order;
    }

    delete data.is_primary;
    delete data.sort_order;

    if (data.isPrimary !== undefined) {
      data.isPrimary = data.isPrimary === 'true' || data.isPrimary === true;
    }

    if (data.sortOrder !== undefined) {
      const parsed = parseInt(data.sortOrder, 10);
      data.sortOrder = Number.isNaN(parsed) ? 0 : parsed;
    }

    return data;
  }
}
