-- Create availability kind enum.
CREATE TYPE "AvailabilityKind" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- Create per-user availability windows scoped to production.
CREATE TABLE "AvailabilityWindow" (
    "id" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "kind" "AvailabilityKind" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AvailabilityWindow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AvailabilityWindow_productionId_idx" ON "AvailabilityWindow"("productionId");
CREATE INDEX "AvailabilityWindow_productionId_userId_idx" ON "AvailabilityWindow"("productionId", "userId");
CREATE INDEX "AvailabilityWindow_userId_idx" ON "AvailabilityWindow"("userId");

ALTER TABLE "AvailabilityWindow"
ADD CONSTRAINT "AvailabilityWindow_productionId_fkey"
FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AvailabilityWindow"
ADD CONSTRAINT "AvailabilityWindow_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
