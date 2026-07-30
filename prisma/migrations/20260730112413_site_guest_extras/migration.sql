-- AlterTable
ALTER TABLE "wedding_sites" ADD COLUMN     "galleryEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "galleryNote" TEXT,
ADD COLUMN     "guestBookEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "guestBookNote" TEXT,
ADD COLUMN     "moderateGuestPosts" BOOLEAN NOT NULL DEFAULT true;

