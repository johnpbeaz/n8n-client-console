-- Add n8nFolderId column to workflows (legacy name, renamed to n8nProjectId in later migration)
ALTER TABLE "Workflow" ADD COLUMN IF NOT EXISTS "n8nFolderId" TEXT;
