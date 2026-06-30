import type { FastifyInstance } from 'fastify';
import { Redis as IORedis } from 'ioredis';
import { logger } from '../utils/logger.js';

/**
 * WebSocket routes for real-time streaming of analysis events.
 * Clients subscribe to a project's event stream and receive
 * turn analysis results, conversation scores, and alerts in real-time.
 */
export async function websocketRoutes(app: FastifyInstance): Promise<void> {
  const redisSub = new IORedis(process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379');

  // Track active WebSocket connections per project
  const projectConnections = new Map<string, Set<WebSocket>>();

  // ─── GET /v1/ws/live/:projectId — Live event stream ───
  app.get('/live/:projectId', { websocket: true }, (socket, request) => {
    const { projectId } = request.params as { projectId: string };

    // TODO: Validate JWT from query params for WebSocket auth
    // const token = (request.query as { token?: string }).token;

    logger.info({ projectId }, 'WebSocket client connected');

    // Register connection
    if (!projectConnections.has(projectId)) {
      projectConnections.set(projectId, new Set());

      // Subscribe to Redis channel for this project
      const channel = `project:${projectId}:events`;
      redisSub.subscribe(channel, (err) => {
        if (err) {
          logger.error(err, `Failed to subscribe to ${channel}`);
        }
      });
    }
    projectConnections.get(projectId)!.add(socket as unknown as WebSocket);

    // Forward Redis pub/sub messages to WebSocket clients
    const messageHandler = (channel: string, message: string) => {
      if (channel === `project:${projectId}:events`) {
        try {
          (socket as unknown as WebSocket).send(message);
        } catch {
          // Client disconnected
        }
      }
    };
    redisSub.on('message', messageHandler);

    // Send connection confirmation
    (socket as unknown as WebSocket).send(
      JSON.stringify({
        type: 'connected',
        project_id: projectId,
        timestamp: new Date().toISOString(),
      }),
    );

    // Handle client disconnect
    socket.on('close', () => {
      logger.info({ projectId }, 'WebSocket client disconnected');
      const connections = projectConnections.get(projectId);
      if (connections) {
        connections.delete(socket as unknown as WebSocket);
        if (connections.size === 0) {
          projectConnections.delete(projectId);
          redisSub.unsubscribe(`project:${projectId}:events`);
          redisSub.removeListener('message', messageHandler);
        }
      }
    });

    socket.on('error', (err) => {
      logger.error(err, 'WebSocket error');
    });
  });
}


