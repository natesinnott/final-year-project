-- Create rehearsal status enum.
CREATE TYPE "RehearsalStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- Create persisted production rehearsals.
CREATE TABLE "ProductionRehearsal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "status" "RehearsalStatus" NOT NULL DEFAULT 'DRAFT',
    "solveRunId" TEXT,
    "sourceMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productionId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "ProductionRehearsal_pkey" PRIMARY KEY ("id")
);

-- Create rehearsal participants join table.
CREATE TABLE "RehearsalParticipant" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rehearsalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "RehearsalParticipant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductionRehearsal_productionId_start_idx" ON "ProductionRehearsal"("productionId", "start");
CREATE INDEX "ProductionRehearsal_productionId_status_start_idx" ON "ProductionRehearsal"("productionId", "status", "start");
CREATE INDEX "ProductionRehearsal_createdById_idx" ON "ProductionRehearsal"("createdById");
CREATE INDEX "RehearsalParticipant_userId_idx" ON "RehearsalParticipant"("userId");
CREATE INDEX "RehearsalParticipant_rehearsalId_idx" ON "RehearsalParticipant"("rehearsalId");

CREATE UNIQUE INDEX "RehearsalParticipant_rehearsalId_userId_key" ON "RehearsalParticipant"("rehearsalId", "userId");

ALTER TABLE "ProductionRehearsal"
ADD CONSTRAINT "ProductionRehearsal_productionId_fkey"
FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductionRehearsal"
ADD CONSTRAINT "ProductionRehearsal_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RehearsalParticipant"
ADD CONSTRAINT "RehearsalParticipant_rehearsalId_fkey"
FOREIGN KEY ("rehearsalId") REFERENCES "ProductionRehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RehearsalParticipant"
ADD CONSTRAINT "RehearsalParticipant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
