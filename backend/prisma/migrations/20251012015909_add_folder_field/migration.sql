-- Add n8n folder column to workflows
ALTER TABLE "Workflow" ADD COLUMN IF NOT EXISTS "n8nFolderId" TEXT;
