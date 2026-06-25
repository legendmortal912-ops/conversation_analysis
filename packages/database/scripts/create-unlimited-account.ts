import { PrismaClient, PlanId, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@unlimited.com';
  const password = 'password123';
  const hash = await bcrypt.hash(password, 12);

  // Create Organization
  const org = await prisma.organization.create({
    data: {
      name: 'Unlimited Corp',
      slug: 'unlimited-corp',
      plan: PlanId.ENTERPRISE,
    },
  });

  // Create User
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Unlimited Admin',
      passwordHash: hash,
      role: UserRole.OWNER,
      orgId: org.id,
    },
  });

  console.log('✅ Account created successfully!');
  console.log('   Email:', email);
  console.log('   Password:', password);
  console.log('   Plan:', org.plan);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
