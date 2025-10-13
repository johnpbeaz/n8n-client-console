CREATE TABLE "ClientEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientEmail_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ClientEmail_clientId_email_key" ON "ClientEmail"("clientId", "email");

CREATE INDEX "ClientEmail_clientId_idx" ON "ClientEmail"("clientId");

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

INSERT INTO "ClientEmail" ("id", "clientId", "email", "isPrimary")
SELECT uuid_generate_v4(), client_users."clientId", LOWER(client_users."email"), TRUE
FROM (
    SELECT DISTINCT ON ("clientId") "clientId", "email"
    FROM "User"
    WHERE "clientId" IS NOT NULL AND "role" = 'client'
    ORDER BY "clientId", "createdAt"
) AS client_users;
