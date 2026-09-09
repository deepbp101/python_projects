-- AlterTable
ALTER TABLE "weddings" ADD COLUMN     "planUnlockedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "unlock_codes" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "label" TEXT,
    "weddingId" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unlock_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unlock_codes_codeHash_key" ON "unlock_codes"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "unlock_codes_weddingId_key" ON "unlock_codes"("weddingId");

-- AddForeignKey
ALTER TABLE "unlock_codes" ADD CONSTRAINT "unlock_codes_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

