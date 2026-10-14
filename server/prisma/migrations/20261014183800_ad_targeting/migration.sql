-- CreateEnum
CREATE TYPE "AdObjective" AS ENUM ('AWARENESS', 'TRAFFIC', 'CONVERSIONS');

-- CreateEnum
CREATE TYPE "GeoTargetMode" AS ENUM ('RADIUS', 'CITIES');

-- DropIndex (a product may now have many campaigns over time)
DROP INDEX "PromotedListing_productId_key";

-- AlterTable
ALTER TABLE "PromotedListing" ADD COLUMN     "geoMode" "GeoTargetMode" NOT NULL DEFAULT 'RADIUS',
ADD COLUMN     "objective" "AdObjective" NOT NULL DEFAULT 'TRAFFIC',
ADD COLUMN     "targetCities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "targetRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 5;

-- Backfill: existing campaigns were served within a fixed 50km box; keep that behaviour.
UPDATE "PromotedListing" SET "targetRadiusKm" = 50;

-- CreateIndex
CREATE INDEX "PromotedListing_productId_isActive_idx" ON "PromotedListing"("productId", "isActive");

-- CreateIndex
CREATE INDEX "PromotedListing_shopId_isActive_idx" ON "PromotedListing"("shopId", "isActive");
