import { Prisma, PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';

type CsvRecord = Record<string, string>;

type StorageOptionSeed = {
  capacity: string;
  price: Prisma.Decimal;
};

const prisma = new PrismaClient();

const CSV_PATH = path.join(__dirname, '..', 'products-prisma-schema-clean.csv');

const CATEGORY_SEEDS: Record<
  string,
  { name: string; slug: string; description?: string }
> = {
  'e26973b8-b931-4be7-b4dc-1b1f2ab5e42c': {
    name: 'Phones',
    slug: 'phones',
    description: 'Imported mobile phone catalog',
  },
  '161d593e-88f9-41e1-9a3d-954c4d30a9a9': {
    name: 'Accessories',
    slug: 'accessories',
    description: 'Imported accessories and wearables catalog',
  },
  'c06a17cd-6dc1-44d9-8970-62cf18b584cb': {
    name: 'Computers & Tablets',
    slug: 'computers-tablets',
    description: 'Imported tablets and computers catalog',
  },
};

const BRAND_SEEDS: Record<string, { name: string; slug: string }> = {
  '454d9b89-9ae9-4694-8f78-8ed73ff8659f': {
    name: 'Apple',
    slug: 'apple',
  },
  'd620a64f-c559-4fe9-9831-c756da80d13a': {
    name: 'Samsung',
    slug: 'samsung',
  },
};

const COLOR_HEX_MAP: Record<string, string> = {
  black: '#000000',
  blue: '#2563eb',
  gold: '#d4af37',
  gray: '#6b7280',
  green: '#16a34a',
  pink: '#ec4899',
  purple: '#7c3aed',
  red: '#dc2626',
  silver: '#c0c0c0',
  white: '#ffffff',
  yellow: '#eab308',
};

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (character === '"') {
      if (inQuotes && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && input[index + 1] === '\n') {
        index += 1;
      }

      row.push(value);

      if (row.length > 1 || row[0] !== '') {
        rows.push(row);
      }

      row = [];
      value = '';
      continue;
    }

    value += character;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function readCsvRecords(filePath: string): CsvRecord[] {
  const file = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(file);

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const record: CsvRecord = {};

    headers.forEach((header, index) => {
      record[header] = row[index] ?? '';
    });

    return record;
  });
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function compactString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseBoolean(value: string | null | undefined): boolean {
  return String(value).trim().toLowerCase() === 'true';
}

function parseInteger(
  value: string | null | undefined,
  fallback?: number,
): number | null {
  const normalized = compactString(value);

  if (!normalized) {
    return fallback ?? null;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : fallback ?? null;
}

function parseDecimal(
  value: string | null | undefined,
  fallback?: string | number,
): Prisma.Decimal | null {
  const normalized = compactString(value);

  if (!normalized) {
    return fallback !== undefined ? new Prisma.Decimal(fallback) : null;
  }

  return new Prisma.Decimal(normalized.replace(/,/g, ''));
}

function parseDate(value: string | null | undefined): Date | null {
  const normalized = compactString(value);
  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseJsonArray<T>(value: string | null | undefined): T[] {
  const normalized = compactString(value);
  if (!normalized) {
    return [];
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (error) {
    console.warn(`Failed to parse JSON array: ${normalized.slice(0, 80)}...`);
    return [];
  }
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    const key = normalized.toLowerCase();

    if (!normalized || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(normalized);
  }

  return unique;
}

function extractStorageOptions(record: CsvRecord): StorageOptionSeed[] {
  const capacities = new Set<string>();
  const priceByCapacity = new Map<string, Prisma.Decimal>();

  const rawStorageOptions = parseJsonArray<string>(record.storageOptions);
  for (const option of rawStorageOptions) {
    const normalized = option.trim().toUpperCase();
    if (/^\d+(GB|TB)$/.test(normalized)) {
      capacities.add(normalized);
    }
  }

  const features = parseJsonArray<string>(record.features);
  for (const feature of features) {
    const matches = [...feature.toUpperCase().matchAll(/\b\d+(GB|TB)\b/g)].map(
      (match) => match[0],
    );
    const capacity = matches.at(-1);

    if (!capacity) {
      continue;
    }

    capacities.add(capacity);

    const priceMatch = feature.match(/([0-9][0-9,]{2,})(?!.*[0-9])/);
    if (!priceMatch) {
      continue;
    }

    priceByCapacity.set(
      capacity,
      new Prisma.Decimal(priceMatch[1].replace(/,/g, '')),
    );
  }

  const defaultPrice = parseDecimal(record.price, 0) ?? new Prisma.Decimal(0);

  return [...capacities].map((capacity) => ({
    capacity,
    price: priceByCapacity.get(capacity) ?? defaultPrice,
  }));
}

function resolveSeedSlug(record: CsvRecord, usedSlugs: Set<string>): string {
  const candidates = uniqueValues([
    compactString(record.slug) ?? '',
    slugify(record.name),
    slugify(`${record.name}-${record.id.slice(0, 8)}`),
  ]).filter(Boolean);

  for (const candidate of candidates) {
    if (!usedSlugs.has(candidate)) {
      usedSlugs.add(candidate);
      return candidate;
    }
  }

  let suffix = 2;
  const base = candidates[0] || `product-${record.id.slice(0, 8)}`;
  let candidate = `${base}-${suffix}`;

  while (usedSlugs.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  usedSlugs.add(candidate);
  return candidate;
}

async function ensureCategory(
  tx: Prisma.TransactionClient,
  importedId: string,
): Promise<string | null> {
  const normalizedId = compactString(importedId);
  if (!normalizedId) {
    return null;
  }

  const seed = CATEGORY_SEEDS[normalizedId] ?? {
    name: `Imported Category ${normalizedId.slice(0, 8)}`,
    slug: `imported-category-${normalizedId.slice(0, 8)}`,
    description: 'Imported product category',
  };

  const existing = await tx.category.findFirst({
    where: {
      OR: [{ id: normalizedId }, { slug: seed.slug }, { name: seed.name }],
    },
    select: { id: true },
  });

  if (existing) {
    await tx.category.update({
      where: { id: existing.id },
      data: {
        name: seed.name,
        slug: seed.slug,
        description: seed.description,
        isActive: true,
      },
    });

    return existing.id;
  }

  const created = await tx.category.create({
    data: {
      id: normalizedId,
      name: seed.name,
      slug: seed.slug,
      description: seed.description,
      isActive: true,
    },
    select: { id: true },
  });

  return created.id;
}

async function ensureBrand(
  tx: Prisma.TransactionClient,
  importedId: string,
  record: CsvRecord,
): Promise<string | null> {
  const normalizedId = compactString(importedId);
  if (!normalizedId) {
    return null;
  }

  const inferredName =
    BRAND_SEEDS[normalizedId]?.name ??
    (record.sku?.startsWith('SAM-') ? 'Samsung' : 'Apple');
  const seed = BRAND_SEEDS[normalizedId] ?? {
    name: inferredName,
    slug: slugify(inferredName),
  };

  const existing = await tx.brand.findFirst({
    where: {
      OR: [{ id: normalizedId }, { slug: seed.slug }, { name: seed.name }],
    },
    select: { id: true },
  });

  if (existing) {
    await tx.brand.update({
      where: { id: existing.id },
      data: {
        name: seed.name,
        slug: seed.slug,
      },
    });

    return existing.id;
  }

  const created = await tx.brand.create({
    data: {
      id: normalizedId,
      name: seed.name,
      slug: seed.slug,
    },
    select: { id: true },
  });

  return created.id;
}

async function ensureTags(
  tx: Prisma.TransactionClient,
  tags: string[],
): Promise<Array<{ id: string }>> {
  const tagIds: Array<{ id: string }> = [];

  for (const tagName of uniqueValues(tags)) {
    const tag = await tx.tag.upsert({
      where: { name: tagName },
      update: {},
      create: { name: tagName },
      select: { id: true },
    });

    tagIds.push({ id: tag.id });
  }

  return tagIds;
}

async function ensureColors(
  tx: Prisma.TransactionClient,
  colors: string[],
): Promise<Array<{ id: string }>> {
  const colorIds: Array<{ id: string }> = [];

  for (const colorName of uniqueValues(colors)) {
    const existing = await tx.color.findFirst({
      where: {
        name: {
          equals: colorName,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });

    if (existing) {
      colorIds.push({ id: existing.id });
      continue;
    }

    const created = await tx.color.create({
      data: {
        name: colorName,
        value: COLOR_HEX_MAP[colorName.toLowerCase()] ?? '#9ca3af',
      },
      select: { id: true },
    });

    colorIds.push({ id: created.id });
  }

  return colorIds;
}

async function replaceStorageOptions(
  tx: Prisma.TransactionClient,
  productId: string,
  storageOptions: StorageOptionSeed[],
): Promise<void> {
  const existing = await tx.storageOption.findMany({
    where: {
      products: {
        some: {
          id: productId,
        },
      },
    },
    include: {
      products: {
        select: { id: true },
      },
    },
  });

  for (const option of existing) {
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

  for (const option of storageOptions) {
    await tx.storageOption.create({
      data: {
        capacity: option.capacity,
        price: option.price,
        products: {
          connect: { id: productId },
        },
      },
    });
  }
}

async function replaceImages(
  tx: Prisma.TransactionClient,
  productId: string,
  imageUrls: string[],
): Promise<void> {
  await tx.productImage.deleteMany({
    where: { productId },
  });

  if (imageUrls.length === 0) {
    return;
  }

  await tx.productImage.createMany({
    data: imageUrls.map((url, index) => ({
      productId,
      url,
      isPrimary: index === 0,
      sortOrder: index,
    })),
  });
}

async function seedRecord(
  tx: Prisma.TransactionClient,
  record: CsvRecord,
  resolvedSlug: string,
): Promise<void> {
  const categoryId = await ensureCategory(tx, record.categoryId);
  const brandId = await ensureBrand(tx, record.brandId, record);
  const tagIds = await ensureTags(tx, parseJsonArray<string>(record.tags));
  const colorIds = await ensureColors(tx, parseJsonArray<string>(record.colors));
  const storageOptions = extractStorageOptions(record);
  const imageUrls = parseJsonArray<string>(record.images);
  const createdAt = parseDate(record.createdAt);
  const updatedAt = parseDate(record.updatedAt);

  const data: Prisma.ProductUncheckedCreateInput = {
    id: record.id,
    slug: resolvedSlug,
    name: compactString(record.name) ?? 'Unnamed Product',
    description: compactString(record.description),
    shortDescription: compactString(record.shortDescription),
    fullDescription: compactString(record.fullDescription),
    sku: compactString(record.sku),
    price: parseDecimal(record.price, 0) ?? new Prisma.Decimal(0),
    originalPrice: parseDecimal(record.originalPrice),
    discountAmount: parseDecimal(record.discountAmount),
    stockQuantity: parseInteger(record.stockQuantity, 0) ?? 0,
    lowStockThreshold: parseInteger(record.lowStockThreshold, 0) ?? 0,
    weightKg: parseDecimal(record.weightKg),
    lengthCm: parseDecimal(record.lengthCm),
    widthCm: parseDecimal(record.widthCm),
    heightCm: parseDecimal(record.heightCm),
    warrantyMonths: parseInteger(record.warrantyMonths, 0) ?? 0,
    isWarrantyCovered: parseBoolean(record.isWarrantyCovered),
    isActive: parseBoolean(record.isActive),
    featureOnHomepage: parseBoolean(record.featureOnHomepage),
    isTrending: parseBoolean(record.isTrending),
    isBestSelling: parseBoolean(record.isBestSelling),
    features: parseJsonArray<string>(record.features),
    specifications: parseJsonArray<Record<string, string>>(
      record.specifications,
    ),
    categoryId,
    brandId,
    createdAt: createdAt ?? undefined,
    updatedAt: updatedAt ?? undefined,
  };

  const existing = await tx.product.findFirst({
    where: {
      OR: [
        { id: record.id },
        ...(data.sku ? [{ sku: data.sku }] : []),
        { slug: resolvedSlug },
      ],
    },
    select: { id: true },
  });

  const product = existing
    ? await tx.product.update({
        where: { id: existing.id },
        data: {
          ...data,
          createdAt: undefined,
        },
        select: { id: true },
      })
    : await tx.product.create({
        data,
        select: { id: true },
      });

  await tx.product.update({
    where: { id: product.id },
    data: {
      tags: {
        set: tagIds,
      },
      colors: {
        set: colorIds,
      },
    },
  });

  await replaceImages(tx, product.id, imageUrls);
  await replaceStorageOptions(tx, product.id, storageOptions);
}

async function main(): Promise<void> {
  const records = readCsvRecords(CSV_PATH);
  const usedSlugs = new Set<string>();

  console.log(`Seeding ${records.length} products from ${path.basename(CSV_PATH)}`);

  for (const record of records) {
    const resolvedSlug = resolveSeedSlug(record, usedSlugs);

    await prisma.$transaction(async (tx) => {
      await seedRecord(tx, record, resolvedSlug);
    });
  }

  const [products, categories, brands] = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
    prisma.brand.count(),
  ]);

  console.log(
    `Seed complete. products=${products} categories=${categories} brands=${brands}`,
  );
}

main()
  .catch((error) => {
    console.error('Seed failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
