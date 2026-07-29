-- CreateEnum
CREATE TYPE "SiteTemplate" AS ENUM ('CLASSIC', 'GARDEN', 'MODERN');

-- CreateEnum
CREATE TYPE "TableShape" AS ENUM ('ROUND', 'RECTANGLE', 'HEAD');

-- CreateEnum
CREATE TYPE "MoodCategory" AS ENUM ('ATTIRE', 'FLORALS', 'DECOR', 'VENUE', 'CAKE', 'STATIONERY', 'BEAUTY', 'OTHER');

-- CreateTable
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wedding_sites" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "template" "SiteTemplate" NOT NULL DEFAULT 'CLASSIC',
    "headline" TEXT,
    "intro" TEXT,
    "storyTitle" TEXT NOT NULL DEFAULT 'Our story',
    "story" TEXT,
    "travelTitle" TEXT NOT NULL DEFAULT 'Travel & stays',
    "travel" TEXT,
    "registryNote" TEXT,
    "rsvpDeadline" TIMESTAMP(3),
    "rsvpNote" TEXT,
    "publishedAt" TIMESTAMP(3),
    "coverUploadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wedding_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_events" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "venueName" TEXT,
    "address" TEXT,
    "description" TEXT,
    "dressCode" TEXT,
    "mapUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "site_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_links" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "registry_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seating_tables" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shape" "TableShape" NOT NULL DEFAULT 'ROUND',
    "capacity" INTEGER NOT NULL DEFAULT 8,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seating_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_assignments" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "seatIndex" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seat_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mood_boards" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Our vision',
    "shareTokenHash" TEXT,
    "sharedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mood_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mood_board_items" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "uploadId" TEXT,
    "category" "MoodCategory" NOT NULL DEFAULT 'OTHER',
    "title" TEXT,
    "note" TEXT,
    "sourceUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mood_board_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uploads_storageKey_key" ON "uploads"("storageKey");

-- CreateIndex
CREATE INDEX "uploads_weddingId_idx" ON "uploads"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "wedding_sites_weddingId_key" ON "wedding_sites"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "wedding_sites_slug_key" ON "wedding_sites"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "wedding_sites_coverUploadId_key" ON "wedding_sites"("coverUploadId");

-- CreateIndex
CREATE INDEX "site_events_siteId_idx" ON "site_events"("siteId");

-- CreateIndex
CREATE INDEX "registry_links_siteId_idx" ON "registry_links"("siteId");

-- CreateIndex
CREATE INDEX "seating_tables_weddingId_idx" ON "seating_tables"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "seating_tables_weddingId_name_key" ON "seating_tables"("weddingId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "seat_assignments_guestId_key" ON "seat_assignments"("guestId");

-- CreateIndex
CREATE INDEX "seat_assignments_tableId_idx" ON "seat_assignments"("tableId");

-- CreateIndex
CREATE UNIQUE INDEX "mood_boards_weddingId_key" ON "mood_boards"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "mood_boards_shareTokenHash_key" ON "mood_boards"("shareTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "mood_board_items_uploadId_key" ON "mood_board_items"("uploadId");

-- CreateIndex
CREATE INDEX "mood_board_items_boardId_category_idx" ON "mood_board_items"("boardId", "category");

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_sites" ADD CONSTRAINT "wedding_sites_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_sites" ADD CONSTRAINT "wedding_sites_coverUploadId_fkey" FOREIGN KEY ("coverUploadId") REFERENCES "uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_events" ADD CONSTRAINT "site_events_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "wedding_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_links" ADD CONSTRAINT "registry_links_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "wedding_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seating_tables" ADD CONSTRAINT "seating_tables_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "seating_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mood_boards" ADD CONSTRAINT "mood_boards_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mood_board_items" ADD CONSTRAINT "mood_board_items_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "mood_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mood_board_items" ADD CONSTRAINT "mood_board_items_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mood_board_items" ADD CONSTRAINT "mood_board_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
