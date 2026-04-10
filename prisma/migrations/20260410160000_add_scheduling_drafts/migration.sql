-- CreateTable
CREATE TABLE "SchedulingDraft" (
    "id" TEXT NOT NULL,
    "selectedTimeZone" TEXT NOT NULL,
    "horizonStart" TEXT NOT NULL,
    "horizonEnd" TEXT NOT NULL,
    "blocks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SchedulingDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchedulingDraft_productionId_userId_key" ON "SchedulingDraft"("productionId", "userId");

-- CreateIndex
CREATE INDEX "SchedulingDraft_productionId_updatedAt_idx" ON "SchedulingDraft"("productionId", "updatedAt");

-- CreateIndex
CREATE INDEX "SchedulingDraft_userId_idx" ON "SchedulingDraft"("userId");

-- AddForeignKey
ALTER TABLE "SchedulingDraft" ADD CONSTRAINT "SchedulingDraft_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingDraft" ADD CONSTRAINT "SchedulingDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
