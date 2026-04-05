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
    const page =
      Number.isFinite(Number(query.page)) && Number(query.page) > 0
        ? Number(query.page)
        : 1;
    const pageSize =
      Number.isFinite(Number(query.page_size)) && Number(query.page_size) > 0
        ? Number(query.page_size)
        : 20;
    const skip = (page - 1) * pageSize;
    const where = this.buildProductListWhere(query);
    const orderBy = this.buildProductListOrderBy(query);

    const [results, count] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { images: true, category: true, brand: true },
        skip,
        take: pageSize,
        orderBy,
      }),
      this.prisma.product.count({
        where,
      }),
    ]);

    const resultsWithStats = await this.attachReviewStats(results);
    return { results: resultsWithStats, count };
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

    const resultsWithStats = await this.attachReviewStats(ordered);
    return { results: resultsWithStats, count: resultsWithStats.length };
  }

  async findOne(slugOrId: string) {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        category: true,
        brand: true,
        colors: true,
        storageOptions: { orderBy: { capacity: 'asc' } },
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

    const reviewCount = product.reviews?.length ?? 0;
    const averageRating =
      reviewCount > 0
        ? product.reviews.reduce(
            (sum, review) => sum + Number(review?.rating ?? 0),
            0,
          ) / reviewCount
        : 0;

    return {
      ...product,
      review_count: reviewCount,
      average_rating: averageRating,
    };
  }

  async create(data: CreateProductDto) {
    const {
      category,
      brand,
      tagIds,
      colorIds,
      storageOptions,
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

    if (storageOptions && storageOptions.length > 0) {
      productData.storageOptions = {
        create: this.normalizeStorageOptionsPayload(storageOptions).map(
          ({ capacity, price }) => ({
            capacity,
            price,
          }),
        ),
      };
    }

    return this.prisma.product.create({
      data: productData,
      include: {
        category: true,
        brand: true,
        images: true,
        colors: true,
        storageOptions: { orderBy: { capacity: 'asc' } },
        tags: true,
      },
    });
  }

  async update(slugOrId: string, data: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
      include: {
        storageOptions: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const {
      category,
      brand,
      tagIds,
      colorIds,
      storageOptions,
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

    return this.prisma.$transaction(async (tx) => {
      if (storageOptions !== undefined) {
        await this.syncProductStorageOptions(
          tx,
          product.id,
          this.normalizeStorageOptionsPayload(storageOptions),
        );
      }

      return tx.product.update({
        where: { id: product.id },
        data: productData,
        include: {
          category: true,
          brand: true,
          images: true,
          colors: true,
          storageOptions: { orderBy: { capacity: 'asc' } },
          tags: true,
        },
      });
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
  async findProductStorageOptions(productIdOrSlug: string) {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ id: productIdOrSlug }, { slug: productIdOrSlug }] },
      include: {
        storageOptions: {
          orderBy: { capacity: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product.storageOptions;
  }

  async createProductStorageOption(
    productIdOrSlug: string,
    data: CreateStorageOptionDto,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ id: productIdOrSlug }, { slug: productIdOrSlug }] },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const normalized = this.normalizeStorageOptionInput(data);

    await this.ensureStorageCapacityIsAvailable(
      product.id,
      normalized.capacity,
    );

    return this.prisma.storageOption.create({
      data: {
        capacity: normalized.capacity,
        price: normalized.price,
        products: {
          connect: { id: product.id },
        },
      },
    });
  }

  async updateProductStorageOption(
    productIdOrSlug: string,
    id: string,
    data: UpdateStorageOptionDto,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ id: productIdOrSlug }, { slug: productIdOrSlug }] },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const storageOption = await this.prisma.storageOption.findFirst({
      where: {
        id,
        products: {
          some: { id: product.id },
        },
      },
    });

    if (!storageOption) {
      throw new NotFoundException('Storage option not found for this product');
    }

    const capacity =
      data.capacity !== undefined
        ? String(data.capacity).trim()
        : storageOption.capacity;
    const price =
      data.price !== undefined
        ? Number(data.price)
        : Number(storageOption.price);

    if (!capacity) {
      throw new BadRequestException('Storage capacity is required');
    }

    if (!Number.isFinite(price)) {
      throw new BadRequestException('Storage price must be a valid number');
    }

    await this.ensureStorageCapacityIsAvailable(product.id, capacity, id);

    return this.prisma.storageOption.update({
      where: { id },
      data: {
        capacity,
        price,
      },
    });
  }

  async deleteProductStorageOption(productIdOrSlug: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ id: productIdOrSlug }, { slug: productIdOrSlug }] },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const storageOption = await this.prisma.storageOption.findFirst({
      where: {
        id,
        products: {
          some: { id: product.id },
        },
      },
      include: {
        products: {
          select: { id: true },
        },
      },
    });

    if (!storageOption) {
      throw new NotFoundException('Storage option not found for this product');
    }

    if (storageOption.products.length > 1) {
      return this.prisma.storageOption.update({
        where: { id },
        data: {
          products: {
            disconnect: { id: product.id },
          },
        },
      });
    }

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

  private normalizeStorageOptionsPayload(storageOptions: any[]) {
    if (!Array.isArray(storageOptions)) {
      throw new BadRequestException('Storage options must be an array');
    }

    const seenCapacities = new Set<string>();

    return storageOptions.map((option) => {
      const normalized = this.normalizeStorageOptionInput(option);
      const capacityKey = normalized.capacity.toLowerCase();

      if (seenCapacities.has(capacityKey)) {
        throw new BadRequestException(
          `Duplicate storage capacity "${normalized.capacity}" is not allowed`,
        );
      }

      seenCapacities.add(capacityKey);
      return normalized;
    });
  }

  private normalizeStorageOptionInput(option: Record<string, any>) {
    if (!option || typeof option !== 'object') {
      throw new BadRequestException('Each storage option must be an object');
    }

    const capacity = String(option.capacity ?? '').trim();
    const price = Number(option.price);

    if (!capacity) {
      throw new BadRequestException('Storage capacity is required');
    }

    if (!Number.isFinite(price)) {
      throw new BadRequestException('Storage price must be a valid number');
    }

    return {
      id: option.id ? String(option.id) : undefined,
      capacity,
      price,
    };
  }

  private async syncProductStorageOptions(
    tx: any,
    productId: string,
    storageOptions: Array<{ id?: string; capacity: string; price: number }>,
  ) {
    const currentProduct = await tx.product.findUnique({
      where: { id: productId },
      include: {
        storageOptions: {
          include: {
            products: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!currentProduct) {
      throw new NotFoundException('Product not found');
    }

    const existingById = new Map(
      currentProduct.storageOptions.map((option) => [option.id, option]),
    );
    const nextIds = new Set<string>();

    for (const option of storageOptions) {
      await this.ensureStorageCapacityIsAvailable(
        productId,
        option.capacity,
        option.id,
        tx,
      );

      if (option.id) {
        const existing = existingById.get(option.id);

        if (!existing) {
          throw new BadRequestException(
            'Storage option does not belong to this product',
          );
        }

        await tx.storageOption.update({
          where: { id: option.id },
          data: {
            capacity: option.capacity,
            price: option.price,
          },
        });

        nextIds.add(option.id);
        continue;
      }

      const created = await tx.storageOption.create({
        data: {
          capacity: option.capacity,
          price: option.price,
          products: {
            connect: { id: productId },
          },
        },
      });

      nextIds.add(created.id);
    }

    const removedOptions = currentProduct.storageOptions.filter(
      (option) => !nextIds.has(option.id),
    );

    for (const option of removedOptions) {
      if (option.products.length > 1) {
        await tx.storageOption.update({
          where: { id: option.id },
          data: {
            products: {
              disconnect: { id: productId },
            },
          },
        });
        continue;
      }

      await tx.storageOption.delete({
        where: { id: option.id },
      });
    }
  }

  private async ensureStorageCapacityIsAvailable(
    productId: string,
    capacity: string,
    excludeId?: string,
    tx: any = this.prisma,
  ) {
    const existing = await tx.storageOption.findFirst({
      where: {
        capacity: {
          equals: capacity,
          mode: 'insensitive',
        },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
        products: {
          some: { id: productId },
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException(
        `Storage option "${capacity}" already exists for this product`,
      );
    }
  }

  private async attachReviewStats(products: any[]) {
    if (!Array.isArray(products) || products.length === 0) {
      return products;
    }

    const productIds = products
      .map((product) => product?.id)
      .filter(Boolean) as string[];

    if (productIds.length === 0) {
      return products;
    }

    const stats = await this.prisma.review.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds } },
      _count: { _all: true },
      _avg: { rating: true },
    });

    const statsMap = new Map(stats.map((entry) => [entry.productId, entry]));

    return products.map((product) => {
      const stat = statsMap.get(product.id);
      return {
        ...product,
        review_count: stat?._count?._all ?? 0,
        average_rating: stat?._avg?.rating ?? 0,
      };
    });
  }

  private buildProductListWhere(query: QueryProductDto) {
    const filters: Record<string, any>[] = [];
    const normalizedSearch =
      typeof query.search === 'string' ? query.search.trim() : '';
    const categoryTokens = Array.isArray(query.category)
      ? query.category.map((entry) => String(entry).trim()).filter(Boolean)
      : [];
    const minPrice = Number.isFinite(Number(query.minPrice))
      ? Number(query.minPrice)
      : null;
    const maxPrice = Number.isFinite(Number(query.maxPrice))
      ? Number(query.maxPrice)
      : null;

    if (typeof query.isActive === 'boolean') {
      filters.push({ isActive: query.isActive });
    }

    if (normalizedSearch) {
      filters.push({
        OR: [
          { name: { contains: normalizedSearch, mode: 'insensitive' } },
          {
            shortDescription: {
              contains: normalizedSearch,
              mode: 'insensitive',
            },
          },
          {
            fullDescription: {
              contains: normalizedSearch,
              mode: 'insensitive',
            },
          },
          { sku: { contains: normalizedSearch, mode: 'insensitive' } },
          {
            category: {
              is: {
                OR: [
                  {
                    name: {
                      contains: normalizedSearch,
                      mode: 'insensitive',
                    },
                  },
                  {
                    slug: {
                      contains: normalizedSearch,
                      mode: 'insensitive',
                    },
                  },
                ],
              },
            },
          },
          {
            brand: {
              is: {
                OR: [
                  {
                    name: {
                      contains: normalizedSearch,
                      mode: 'insensitive',
                    },
                  },
                  {
                    slug: {
                      contains: normalizedSearch,
                      mode: 'insensitive',
                    },
                  },
                ],
              },
            },
          },
        ],
      });
    }

    if (categoryTokens.length > 0) {
      filters.push({
        OR: categoryTokens.map((token) => ({
          category: {
            is: {
              OR: [
                { id: token },
                { slug: { equals: token, mode: 'insensitive' } },
                { name: { equals: token, mode: 'insensitive' } },
              ],
            },
          },
        })),
      });
    }

    if (minPrice !== null || maxPrice !== null) {
      const lowerBound =
        minPrice !== null && maxPrice !== null
          ? Math.min(minPrice, maxPrice)
          : minPrice;
      const upperBound =
        minPrice !== null && maxPrice !== null
          ? Math.max(minPrice, maxPrice)
          : maxPrice;

      filters.push({
        price: {
          ...(lowerBound !== null ? { gte: lowerBound } : {}),
          ...(upperBound !== null ? { lte: upperBound } : {}),
        },
      });
    }

    if (filters.length === 0) {
      return undefined;
    }

    if (filters.length === 1) {
      return filters[0];
    }

    return { AND: filters };
  }

  private buildProductListOrderBy(query: QueryProductDto) {
    const direction = query.sortOrder === 'asc' ? ('asc' as const) : ('desc' as const);

    switch (query.sortBy) {
      case 'createdAt':
        return { createdAt: direction };
      case 'updatedAt':
        return { updatedAt: direction };
      case 'name':
        return { name: direction };
      case 'price':
        return { price: direction };
      case 'stockQuantity':
        return { stockQuantity: direction };
      default:
        return { createdAt: 'desc' as const };
    }
  }
}
