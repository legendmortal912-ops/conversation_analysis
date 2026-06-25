import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({
    where: { name: 'Chatgpt' }
  });

  if (!project) {
    console.log('Project Chatgpt not found');
    return;
  }

  const rule = await prisma.customRule.create({
    data: {
      projectId: project.id,
      name: 'Financial Advice',
      description: 'Flags messages that guarantee profit or give unauthorized investment advice.',
      patterns: ['guarantee profit', 'buy stocks', 'investment advice', 'make a profit'],
      severity: 'CRITICAL',
      isEnabled: true,
    }
  });

  console.log('Created custom rule:', rule);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
