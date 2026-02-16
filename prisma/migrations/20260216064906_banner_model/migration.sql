-- CreateTable
CREATE TABLE "BannerOne" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "badge_text" TEXT,
    "features" JSONB,
    "price" DECIMAL(65,30),
    "button_label" TEXT,
    "button_link" TEXT,
    "image_url" TEXT,
    "image_public_id" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BannerOne_pkey" PRIMARY KEY ("id")
);
