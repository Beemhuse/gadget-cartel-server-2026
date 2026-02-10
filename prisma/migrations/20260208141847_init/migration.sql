/*
  Warnings:

  - You are about to drop the column `active` on the `Ad` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `Ad` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `Ad` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Ad` table. All the data in the column will be lost.
  - You are about to drop the column `link` on the `Ad` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Ad` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Ad` table. All the data in the column will be lost.
  - You are about to drop the column `discount` on the `Coupon` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `Coupon` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `Coupon` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Coupon` table. All the data in the column will be lost.
  - Added the required column `ad_name` to the `Ad` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Ad` table without a default value. This is not possible if the table is not empty.
  - Added the required column `discount_value` to the `Coupon` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Coupon` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Ad" DROP COLUMN "active",
DROP COLUMN "content",
DROP COLUMN "endDate",
DROP COLUMN "imageUrl",
DROP COLUMN "link",
DROP COLUMN "startDate",
DROP COLUMN "title",
ADD COLUMN     "ad_media" TEXT,
ADD COLUMN     "ad_name" TEXT NOT NULL,
ADD COLUMN     "button_alignment" TEXT,
ADD COLUMN     "button_color" TEXT,
ADD COLUMN     "button_label" TEXT,
ADD COLUMN     "button_link" TEXT,
ADD COLUMN     "button_text_color" TEXT,
ADD COLUMN     "custom_text" TEXT,
ADD COLUMN     "custom_text_color" TEXT,
ADD COLUMN     "custom_text_position" TEXT,
ADD COLUMN     "display_location" TEXT,
ADD COLUMN     "display_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "display_position" TEXT,
ADD COLUMN     "end_date" TIMESTAMP(3),
ADD COLUMN     "is_published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "show_button" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "start_date" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Coupon" DROP COLUMN "discount",
DROP COLUMN "expiresAt",
DROP COLUMN "isActive",
DROP COLUMN "type",
ADD COLUMN     "applicable_to_all" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "discount_type" TEXT NOT NULL DEFAULT 'percentage',
ADD COLUMN     "discount_value" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maximum_discount" DECIMAL(65,30),
ADD COLUMN     "minimum_order_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "usage_limit" INTEGER,
ADD COLUMN     "usage_limit_per_user" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "valid_from" TIMESTAMP(3),
ADD COLUMN     "valid_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryDate" TIMESTAMP(3),
ADD COLUMN     "deliveryFee" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN     "deliveryStatus" TEXT DEFAULT 'PENDING',
ADD COLUMN     "deliveryType" TEXT,
ADD COLUMN     "shippingDate" TIMESTAMP(3),
ADD COLUMN     "subtotal" DECIMAL(65,30),
ADD COLUMN     "taxAmount" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN     "trackingCode" TEXT;

-- CreateTable
CREATE TABLE "_CategoryToCoupon" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToCoupon_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CouponToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CouponToProduct_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CouponToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CouponToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CategoryToCoupon_B_index" ON "_CategoryToCoupon"("B");

-- CreateIndex
CREATE INDEX "_CouponToProduct_B_index" ON "_CouponToProduct"("B");

-- CreateIndex
CREATE INDEX "_CouponToUser_B_index" ON "_CouponToUser"("B");

-- AddForeignKey
ALTER TABLE "_CategoryToCoupon" ADD CONSTRAINT "_CategoryToCoupon_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToCoupon" ADD CONSTRAINT "_CategoryToCoupon_B_fkey" FOREIGN KEY ("B") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CouponToProduct" ADD CONSTRAINT "_CouponToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CouponToProduct" ADD CONSTRAINT "_CouponToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CouponToUser" ADD CONSTRAINT "_CouponToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CouponToUser" ADD CONSTRAINT "_CouponToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
