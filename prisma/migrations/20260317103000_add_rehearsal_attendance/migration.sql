-- Persist the production timezone chosen at first publish.
ALTER TABLE "Production"
ADD COLUMN "timeZone" TEXT;

-- Create attendance-related enums.
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'REPORTED_ABSENT', 'NO_SHOW');
CREATE TYPE "AttendanceAuditActorType" AS ENUM ('USER', 'STAFF', 'SYSTEM');
CREATE TYPE "AttendanceAuditEvent" AS ENUM (
    'SELF_REPORTED_ABSENT',
    'UPDATED_ABSENCE_NOTE',
    'CLEARED_TO_PRESENT',
    'MARKED_NO_SHOW',
    'DELETED_ON_PARTICIPANT_REMOVAL',
    'DISCARDED_ON_REHEARSAL_REPLACEMENT'
);

-- Create explicit rehearsal attendance rows.
CREATE TABLE "RehearsalAttendance" (
    "id" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rehearsalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "RehearsalAttendance_pkey" PRIMARY KEY ("id")
);

-- Create immutable attendance audit entries.
CREATE TABLE "RehearsalAttendanceAudit" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productionId" TEXT NOT NULL,
    "rehearsalId" TEXT NOT NULL,
    "rehearsalTitle" TEXT NOT NULL,
    "rehearsalStart" TIMESTAMP(3) NOT NULL,
    "rehearsalEnd" TIMESTAMP(3) NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorType" "AttendanceAuditActorType" NOT NULL,
    "event" "AttendanceAuditEvent" NOT NULL,
    "previousStatus" "AttendanceStatus",
    "nextStatus" "AttendanceStatus",
    "note" TEXT,
    "metadata" JSONB,

    CONSTRAINT "RehearsalAttendanceAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RehearsalAttendance_rehearsalId_userId_key"
ON "RehearsalAttendance"("rehearsalId", "userId");

CREATE INDEX "RehearsalAttendance_userId_idx"
ON "RehearsalAttendance"("userId");

CREATE INDEX "RehearsalAttendance_rehearsalId_status_idx"
ON "RehearsalAttendance"("rehearsalId", "status");

CREATE INDEX "RehearsalAttendanceAudit_productionId_createdAt_idx"
ON "RehearsalAttendanceAudit"("productionId", "createdAt");

CREATE INDEX "RehearsalAttendanceAudit_rehearsalId_createdAt_idx"
ON "RehearsalAttendanceAudit"("rehearsalId", "createdAt");

CREATE INDEX "RehearsalAttendanceAudit_subjectUserId_createdAt_idx"
ON "RehearsalAttendanceAudit"("subjectUserId", "createdAt");

ALTER TABLE "RehearsalAttendance"
ADD CONSTRAINT "RehearsalAttendance_rehearsalId_fkey"
FOREIGN KEY ("rehearsalId") REFERENCES "ProductionRehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RehearsalAttendance"
ADD CONSTRAINT "RehearsalAttendance_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RehearsalAttendance"
ADD CONSTRAINT "RehearsalAttendance_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RehearsalAttendance"
ADD CONSTRAINT "RehearsalAttendance_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RehearsalAttendanceAudit"
ADD CONSTRAINT "RehearsalAttendanceAudit_productionId_fkey"
FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RehearsalAttendanceAudit"
ADD CONSTRAINT "RehearsalAttendanceAudit_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
