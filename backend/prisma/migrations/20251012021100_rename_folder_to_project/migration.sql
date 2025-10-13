-- Rename n8nFolderId columns to n8nProjectId
ALTER TABLE "Client" RENAME COLUMN "n8nFolderId" TO "n8nProjectId";
ALTER TABLE "Workflow" RENAME COLUMN "n8nFolderId" TO "n8nProjectId";
