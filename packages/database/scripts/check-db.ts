import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      organization: true,
    },
  });
  console.log("Users and their Organizations:");
  console.dir(users, { depth: null });
  
  const conversations = await prisma.conversation.count();
  console.log("Total conversations in DB:", conversations);
  
  const unlimitedOrgId = users.find(u => u.email === 'admin@unlimited.com')?.orgId;
  if (unlimitedOrgId) {
    const unlimConvos = await prisma.conversation.count({ where: { orgId: unlimitedOrgId } });
    console.log("Conversations for unlimited account:", unlimConvos);
    const projects = await prisma.project.findMany({ where: { orgId: unlimitedOrgId }, include: { customRules: true } });
    console.log("Projects for unlimited account:", JSON.stringify(projects, null, 2));
    const convos = await prisma.conversation.findMany({ where: { orgId: unlimitedOrgId } });
    console.log("Convos project ids:", convos.map(c => c.projectId));
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
