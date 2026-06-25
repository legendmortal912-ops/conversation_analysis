import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.update({
    where: { email: 'admin@unlimited.com' },
    data: { emailVerified: true },
  });
  console.log('✅ Account verified successfully!');
}

main().finally(() => prisma.$disconnect());
