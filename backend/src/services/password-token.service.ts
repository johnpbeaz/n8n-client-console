import crypto from 'crypto';

import { PasswordTokenType } from '@prisma/client';

import { prisma } from '../lib/prisma';

const TOKEN_BYTES = 32;
const TOKEN_TTL_HOURS = 72;

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const createPasswordToken = async (userId: string, type: PasswordTokenType) => {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await prisma.passwordToken.deleteMany({
    where: {
      userId,
      type,
      usedAt: null,
    },
  });

  const record = await prisma.passwordToken.create({
    data: {
      userId,
      type,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt: record.expiresAt };
};

export const consumePasswordToken = async (token: string, type: PasswordTokenType) => {
  const tokenHash = hashToken(token);

  const record = await prisma.passwordToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.type !== type) {
    return null;
  }

  if (record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return null;
  }

  await prisma.passwordToken.update({
    where: { tokenHash },
    data: { usedAt: new Date() },
  });

  return record.user;
};
