import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corp',
      slug: 'acme-corp',
    },
  });
  console.log(`Created Organization: ${org.name}`);

  // Create User
  const user = await prisma.user.upsert({
    where: { email: 'admin@acmecorp.com' },
    update: {
      passwordHash: '$2a$12$YmJZMxUSdio6r/G7Bxnb3.PwyFoXkLqkieuDkfi2TeYvt2ALoIzOe', // password123
      emailVerified: true,
    },
    create: {
      email: 'admin@acmecorp.com',
      passwordHash: '$2a$12$YmJZMxUSdio6r/G7Bxnb3.PwyFoXkLqkieuDkfi2TeYvt2ALoIzOe', // password123
      emailVerified: true,
      name: 'Admin User',
      role: 'OWNER',
      orgId: org.id,
    },
  });
  console.log(`Created User: ${user.email}`);

  // Create Project
  const project = await prisma.project.create({
    data: {
      name: 'Customer Support Bot',
      aiSystemName: 'SupportGPT',
      orgId: org.id,
    },
  });
  console.log(`Created Project: ${project.name}`);

  // Create Alert Config
  await prisma.alertConfig.create({
    data: {
      projectId: project.id,
      channel: 'WEBHOOK',
      webhookUrl: 'https://example.com/webhook',
      enabled: true,
    },
  });

  // Create API Key
  await prisma.apiKey.create({
    data: {
      keyHash: crypto.createHash('sha256').update('test-key').digest('hex'),
      keyPrefix: 'cg_test',
      name: 'Test Key',
      orgId: org.id,
      projectId: project.id,
      createdById: user.id,
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
