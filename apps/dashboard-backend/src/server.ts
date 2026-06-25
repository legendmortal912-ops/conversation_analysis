import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';

import { logger } from './utils/logger.js';
import { typeDefs } from './schema/typeDefs.js';
import { resolvers } from './schema/resolvers/index.js';
import { getAuthContext } from './middleware/auth.js';
import { createDataLoaders } from './dataloaders/index.js';

const PORT = parseInt(process.env['PORT'] ?? '3005', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // Set up WebSocket server for GraphQL subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  const serverCleanup = useServer({ schema }, wsServer as any);

  const server = new ApolloServer({
    schema,
    plugins: [
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();

  app.use(
    '/graphql',
    cors<cors.CorsRequest>({ origin: process.env['FRONTEND_URL'] ?? 'http://localhost:5173' }),
    express.json({ limit: '50mb' }),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const auth = getAuthContext(req);
        return {
          ...auth,
          loaders: createDataLoaders(),
        };
      },
    })
  );

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'dashboard-backend',
      timestamp: new Date().toISOString(),
    });
  });

  httpServer.listen(PORT, HOST, () => {
    logger.info(`Dashboard GraphQL backend ready at http://${HOST}:${PORT}/graphql`);
    logger.info(`Subscriptions ready at ws://${HOST}:${PORT}/graphql`);
  });
}

startServer().catch((err) => {
  logger.error(err, 'Failed to start dashboard backend');
  process.exit(1);
});
