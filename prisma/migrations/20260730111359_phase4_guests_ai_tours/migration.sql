-- CreateEnum
CREATE TYPE "GuestBookKind" AS ENUM ('TEXT', 'VOICE', 'VIDEO');

-- CreateEnum
CREATE TYPE "VendorMediaKind" AS ENUM ('PHOTO', 'PANORAMA', 'TOUR_URL', 'VIDEO_URL');

-- CreateEnum
CREATE TYPE "AiDraftKind" AS ENUM ('VOWS', 'SPEECH', 'THANK_YOU', 'INVITATION');

-- AlterTable
ALTER TABLE "guests" ADD COLUMN     "itineraryTokenHash" TEXT;

-- CreateTable
CREATE TABLE "gallery_photos" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "caption" TEXT,
    "uploaderName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gallery_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_book_entries" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "kind" "GuestBookKind" NOT NULL DEFAULT 'TEXT',
    "guestName" TEXT NOT NULL,
    "message" TEXT,
    "uploadId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_book_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_media" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "kind" "VendorMediaKind" NOT NULL DEFAULT 'PHOTO',
    "uploadId" TEXT,
    "url" TEXT,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_drafts" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "kind" "AiDraftKind" NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_profiles" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "themes" JSONB NOT NULL,
    "summary" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gallery_photos_uploadId_key" ON "gallery_photos"("uploadId");

-- CreateIndex
CREATE INDEX "gallery_photos_weddingId_createdAt_idx" ON "gallery_photos"("weddingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "guest_book_entries_uploadId_key" ON "guest_book_entries"("uploadId");

-- CreateIndex
CREATE INDEX "guest_book_entries_weddingId_createdAt_idx" ON "guest_book_entries"("weddingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_media_uploadId_key" ON "vendor_media"("uploadId");

-- CreateIndex
CREATE INDEX "vendor_media_vendorId_sortOrder_idx" ON "vendor_media"("vendorId", "sortOrder");

-- CreateIndex
CREATE INDEX "ai_drafts_weddingId_kind_idx" ON "ai_drafts"("weddingId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "style_profiles_weddingId_key" ON "style_profiles"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "guests_itineraryTokenHash_key" ON "guests"("itineraryTokenHash");

-- AddForeignKey
ALTER TABLE "gallery_photos" ADD CONSTRAINT "gallery_photos_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_photos" ADD CONSTRAINT "gallery_photos_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_book_entries" ADD CONSTRAINT "guest_book_entries_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_book_entries" ADD CONSTRAINT "guest_book_entries_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_media" ADD CONSTRAINT "vendor_media_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_media" ADD CONSTRAINT "vendor_media_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_media" ADD CONSTRAINT "vendor_media_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_profiles" ADD CONSTRAINT "style_profiles_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

