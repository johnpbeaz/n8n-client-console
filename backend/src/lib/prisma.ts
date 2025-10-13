import { PrismaClient } from '@prisma/client';

import { env, isProduction } from '../config/env';

export const prisma = new PrismaClient({
  log: isProduction ? ['error'] : ['query', 'error', 'warn'],
});

export const connectPrisma = async () => {
  await prisma.$connect();
};

export const disconnectPrisma = async () => prisma.$disconnect();

// Ensure DATABASE_URL is loaded at bootstrap time
void env.databaseUrl;

