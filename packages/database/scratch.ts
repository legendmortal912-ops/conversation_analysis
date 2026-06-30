import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const context = { orgId: 'cmqxqeec80000uld4gqtpokn4' };
  
  const [totalConversations, totalTurns, totalFlags] = await Promise.all([
    prisma.conversation.count({ where: { orgId: context.orgId } }),
    prisma.turn.count({ where: { conversation: { orgId: context.orgId } } }),
    prisma.flag.count({ where: { conversation: { orgId: context.orgId } } }),
  ]);
  console.log({ totalConversations, totalTurns, totalFlags });
}
run().catch(console.error).finally(() => prisma.$disconnect());
