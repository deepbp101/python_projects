-- CreateEnum
CREATE TYPE "VendorCategory" AS ENUM ('VENUE', 'CATERING', 'PHOTOGRAPHY', 'VIDEOGRAPHY', 'FLORIST', 'MUSIC', 'CAKE', 'ATTIRE', 'BEAUTY', 'STATIONERY', 'RENTALS', 'TRANSPORT', 'OFFICIANT', 'PLANNING', 'OTHER');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('CONSIDERING', 'CONTACTED', 'QUOTED', 'BOOKED', 'DECLINED');

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "VendorCategory" NOT NULL DEFAULT 'OTHER',
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "priceTier" INTEGER,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wedding_vendors" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" "VendorStatus" NOT NULL DEFAULT 'CONSIDERING',
    "contactName" TEXT,
    "contactEmail" TEXT,
    "notes" TEXT,
    "budgetItemId" TEXT,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wedding_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_reviews" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "authorId" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_threads" (
    "id" TEXT NOT NULL,
    "weddingVendorId" TEXT NOT NULL,
    "subject" TEXT,
    "accessTokenHash" TEXT,
    "accessGrantedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "coupleReadAt" TIMESTAMP(3),
    "vendorReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thread_shares" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "moodBoardId" TEXT,
    "budgetItemId" TEXT,
    "messageId" TEXT,
    "sharedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thread_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendors_slug_key" ON "vendors"("slug");

-- CreateIndex
CREATE INDEX "vendors_category_idx" ON "vendors"("category");

-- CreateIndex
CREATE INDEX "vendors_city_idx" ON "vendors"("city");

-- CreateIndex
CREATE INDEX "wedding_vendors_weddingId_idx" ON "wedding_vendors"("weddingId");

-- CreateIndex
CREATE INDEX "wedding_vendors_vendorId_idx" ON "wedding_vendors"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "wedding_vendors_weddingId_vendorId_key" ON "wedding_vendors"("weddingId", "vendorId");

-- CreateIndex
CREATE INDEX "vendor_reviews_vendorId_idx" ON "vendor_reviews"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_reviews_vendorId_weddingId_key" ON "vendor_reviews"("vendorId", "weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_threads_weddingVendorId_key" ON "vendor_threads"("weddingVendorId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_threads_accessTokenHash_key" ON "vendor_threads"("accessTokenHash");

-- CreateIndex
CREATE INDEX "messages_threadId_createdAt_idx" ON "messages"("threadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "message_attachments_uploadId_key" ON "message_attachments"("uploadId");

-- CreateIndex
CREATE INDEX "message_attachments_messageId_idx" ON "message_attachments"("messageId");

-- CreateIndex
CREATE INDEX "thread_shares_threadId_idx" ON "thread_shares"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "thread_shares_threadId_moodBoardId_key" ON "thread_shares"("threadId", "moodBoardId");

-- CreateIndex
CREATE UNIQUE INDEX "thread_shares_threadId_budgetItemId_key" ON "thread_shares"("threadId", "budgetItemId");

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_vendors" ADD CONSTRAINT "wedding_vendors_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_vendors" ADD CONSTRAINT "wedding_vendors_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_vendors" ADD CONSTRAINT "wedding_vendors_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "budget_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_vendors" ADD CONSTRAINT "wedding_vendors_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_threads" ADD CONSTRAINT "vendor_threads_weddingVendorId_fkey" FOREIGN KEY ("weddingVendorId") REFERENCES "wedding_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "vendor_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_shares" ADD CONSTRAINT "thread_shares_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "vendor_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_shares" ADD CONSTRAINT "thread_shares_moodBoardId_fkey" FOREIGN KEY ("moodBoardId") REFERENCES "mood_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_shares" ADD CONSTRAINT "thread_shares_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "budget_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_shares" ADD CONSTRAINT "thread_shares_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_shares" ADD CONSTRAINT "thread_shares_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
