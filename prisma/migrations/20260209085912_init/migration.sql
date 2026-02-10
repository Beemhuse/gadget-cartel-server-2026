/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Ad` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Ad` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `Ad` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Ad" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "public_id" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "display_order" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "country" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "state" TEXT;
