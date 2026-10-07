-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "catalogVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "reviewedSnapshot" JSONB;

-- CreateTable
CREATE TABLE "ProductRevision" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "actorId" TEXT,
    "before" JSONB,
    "after" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "decision" "Moderation",
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProductRevisionToUpload" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProductRevisionToUpload_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductRevision_productId_version_key" ON "ProductRevision"("productId", "version");

-- CreateIndex
CREATE INDEX "_ProductRevisionToUpload_B_index" ON "_ProductRevisionToUpload"("B");

-- AddForeignKey
ALTER TABLE "ProductRevision" ADD CONSTRAINT "ProductRevision_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRevision" ADD CONSTRAINT "ProductRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRevision" ADD CONSTRAINT "ProductRevision_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductRevisionToUpload" ADD CONSTRAINT "_ProductRevisionToUpload_A_fkey" FOREIGN KEY ("A") REFERENCES "ProductRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductRevisionToUpload" ADD CONSTRAINT "_ProductRevisionToUpload_B_fkey" FOREIGN KEY ("B") REFERENCES "Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

