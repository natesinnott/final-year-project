ALTER TABLE "ProductionMember"
ADD COLUMN "conflictsSubmittedAt" TIMESTAMP(3);

DELETE FROM "AvailabilityWindow";
