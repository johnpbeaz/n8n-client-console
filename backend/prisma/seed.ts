import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const hashPassword = async (password: string) => bcrypt.hash(password, 12);

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminName = process.env.SEED_ADMIN_NAME ?? 'Administrator';

  if (!adminEmail || !adminPassword) {
    // eslint-disable-next-line no-console
    console.log('No SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD provided; skipping seed.');
    return;
  }

  const passwordHash = await hashPassword(adminPassword);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      name: adminName,
      role: UserRole.admin,
    },
    create: {
      email: adminEmail,
      passwordHash,
      name: adminName,
      role: UserRole.admin,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded admin user ${adminEmail}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error('Seed error', error);
    await prisma.$disconnect();
    process.exit(1);
  });
