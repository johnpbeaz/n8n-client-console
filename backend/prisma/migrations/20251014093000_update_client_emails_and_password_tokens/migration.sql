-- Drop primary flag and link client emails to users
ALTER TABLE "ClientEmail" DROP COLUMN "isPrimary";

ALTER TABLE "ClientEmail" ADD COLUMN "userId" TEXT;

ALTER TABLE "ClientEmail"
ADD CONSTRAINT "ClientEmail_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "ClientEmail" AS ce
SET "userId" = u.id
FROM "User" AS u
WHERE LOWER(u.email) = LOWER(ce.email)
  AND u."clientId" = ce."clientId"
  AND u.role = 'client';

ALTER TABLE "ClientEmail"
ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "ClientEmail"
ADD CONSTRAINT "ClientEmail_userId_key" UNIQUE ("userId");

-- Password setup tokens
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE "PasswordTokenType" AS ENUM ('setup', 'reset');

CREATE TABLE "PasswordToken" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "type" "PasswordTokenType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PasswordToken_tokenHash_key" ON "PasswordToken"("tokenHash");
CREATE INDEX "PasswordToken_userId_idx" ON "PasswordToken"("userId");
