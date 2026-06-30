const { PrismaClient } = require('./packages/database/node_modules/@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const c = await prisma.conversation.findUnique({
    where: { id: 'demo_user_1' },
    include: { turns: true }
  });
  console.log(JSON.stringify(c, null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());
