-- AlterTable
ALTER TABLE "User" ADD COLUMN     "verificationExp" TIMESTAMP(3),
ADD COLUMN     "verificationToken" TEXT;
