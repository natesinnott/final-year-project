/*
  Warnings:

  - Added the required column `productionId` to the `Announcement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productionId` to the `FileAsset` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProductionRole" AS ENUM ('DIRECTOR', 'STAGE_MANAGER', 'CHOREOGRAPHER', 'MUSIC_DIRECTOR', 'CAST', 'CREW', 'VIEWER');

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "productionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "FileAsset" ADD COLUMN     "productionId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Production" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rehearsalStart" TIMESTAMP(3),
    "rehearsalEnd" TIMESTAMP(3),
    "venue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organisationId" TEXT NOT NULL,

    CONSTRAINT "Production_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionMember" (
    "id" TEXT NOT NULL,
    "role" "ProductionRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ProductionMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Production_organisationId_idx" ON "Production"("organisationId");

-- CreateIndex
CREATE INDEX "ProductionMember_userId_idx" ON "ProductionMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionMember_productionId_userId_key" ON "ProductionMember"("productionId", "userId");

-- CreateIndex
CREATE INDEX "Announcement_productionId_idx" ON "Announcement"("productionId");

-- CreateIndex
CREATE INDEX "FileAsset_productionId_idx" ON "FileAsset"("productionId");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMember" ADD CONSTRAINT "ProductionMember_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMember" ADD CONSTRAINT "ProductionMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
