CREATE TABLE "SupplierListing" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL DEFAULT '',
  "city" TEXT NOT NULL,
  "marketArea" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "categories" TEXT[],
  "description" TEXT NOT NULL,
  "website" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierListing_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupplierListing_active_city_idx" ON "SupplierListing"("active", "city");
