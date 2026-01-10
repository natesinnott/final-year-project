-- AlterTable
ALTER TABLE "Production" ADD COLUMN     "directorRoles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ProductionInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "ProductionRole" NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productionId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "ProductionInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionInvite_token_key" ON "ProductionInvite"("token");

-- CreateIndex
CREATE INDEX "ProductionInvite_productionId_idx" ON "ProductionInvite"("productionId");

-- CreateIndex
CREATE INDEX "ProductionInvite_createdById_idx" ON "ProductionInvite"("createdById");

-- AddForeignKey
ALTER TABLE "ProductionInvite" ADD CONSTRAINT "ProductionInvite_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionInvite" ADD CONSTRAINT "ProductionInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
