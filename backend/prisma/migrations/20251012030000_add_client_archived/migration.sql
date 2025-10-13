-- Add archivedAt column for client archiving
ALTER TABLE "Client"
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
