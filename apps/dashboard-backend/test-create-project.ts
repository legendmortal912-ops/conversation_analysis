import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const secret = 'dev-jwt-secret';

async function run() {
  const org = await prisma.organization.create({
    data: {
      name: 'Test Org',
      slug: `test-org-${randomBytes(3).toString('hex')}`,
      plan: 'FREE',
    },
  });

  const user = await prisma.user.create({
    data: {
      email: `test${Date.now()}@example.com`,
      passwordHash: 'fake-hash',
      name: 'Test User',
      role: 'OWNER',
      orgId: org.id,
    },
  });

  // Mimic generateTokenPair payload structure
  const token = jwt.sign({
    userId: user.id,
    email: user.email,
    orgId: user.orgId,
    role: 'owner',
  }, secret, { expiresIn: '15m' });

  console.log('Generated token:', token);

  const res = await fetch('http://127.0.0.1:3000/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      query: `
        mutation {
          createProject(input: { name: "Test API Project" }) {
            id
            name
          }
        }
      `
    })
  });

  const json = await res.json();
  console.dir(json, { depth: null });
}

run().catch(console.error).finally(() => prisma.$disconnect());
