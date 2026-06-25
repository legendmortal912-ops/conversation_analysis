import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('demo123', 12);
  const user = await prisma.user.update({
    where: { email: 'demo@acmefintech.com' },
    data: { passwordHash: hash },
  });
  console.log('✅ Password updated for:', user.email);
  console.log('   Login: demo@acmefintech.com / demo123');
}

main().finally(() => prisma.$disconnect());
