/*
  Warnings:

  - You are about to drop the column `stock` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `order` on the `ProductImage` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[reference]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sku]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Category` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "icon_public_id" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "channel" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "reference" TEXT,
ALTER COLUMN "method" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "stock",
ADD COLUMN     "discount_amount" DECIMAL(65,30),
ADD COLUMN     "feature_on_homepage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "features" JSONB,
ADD COLUMN     "full_description" TEXT,
ADD COLUMN     "height_cm" DECIMAL(65,30),
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_best_selling" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_trending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_warranty_covered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "length_cm" DECIMAL(65,30),
ADD COLUMN     "low_stock_threshold" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "original_price" DECIMAL(65,30),
ADD COLUMN     "short_description" TEXT,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "specifications" JSONB,
ADD COLUMN     "stock_quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "warranty_months" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weight_kg" DECIMAL(65,30),
ADD COLUMN     "width_cm" DECIMAL(65,30),
ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ProductImage" DROP COLUMN "order",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "is_primary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "public_id" TEXT,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
