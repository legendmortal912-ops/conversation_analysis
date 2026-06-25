import jwt from 'jsonwebtoken';
import type { FastifyRequest, FastifyReply } from 'fastify';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-jwt-secret';
const JWT_REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'] ?? 'dev-jwt-refresh-secret';
const ACCESS_EXPIRY = process.env['JWT_ACCESS_EXPIRY'] ?? '15m';
const REFRESH_EXPIRY = process.env['JWT_REFRESH_EXPIRY'] ?? '30d';

/** JWT payload structure for access tokens */
export interface JWTPayload {
  userId: string;
  email: string;
  orgId: string;
  role: 'owner' | 'admin' | 'analyst' | 'viewer';
  iat?: number;
  exp?: number;
}

/** Generate an access + refresh token pair */
export function generateTokenPair(payload: Omit<JWTPayload, 'iat' | 'exp'>): {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: string;
} {
  const accessToken = jwt.sign({ ...payload }, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRY,
  } as any);

  const refreshToken = jwt.sign({ userId: payload.userId, orgId: payload.orgId }, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRY,
  } as any);

  return { accessToken, refreshToken, accessExpiresIn: ACCESS_EXPIRY };
}

/** Verify and decode an access token */
export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

/** Verify and decode a refresh token */
export function verifyRefreshToken(token: string): { userId: string; orgId: string } {
  return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string; orgId: string };
}

/**
 * Fastify preHandler middleware that verifies JWT from Authorization header.
 * Attaches decoded payload to request.user.
 */
export async function jwtMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers['authorization'];
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    token = request.cookies['access_token'];
  }

  if (!token) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid authentication token',
    });
  }

  try {
    const payload = verifyAccessToken(token);
    (request as FastifyRequest & { user: JWTPayload }).user = payload;
  } catch (err) {
    const message = err instanceof jwt.TokenExpiredError
      ? 'Token expired'
      : 'Invalid token';
    return reply.status(401).send({ error: 'Unauthorized', message });
  }
}

/**
 * RBAC middleware factory. Returns a preHandler that checks user role.
 * Roles are hierarchical: owner > admin > analyst > viewer
 */
export function requireRole(...allowedRoles: JWTPayload['role'][]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = (request as FastifyRequest & { user?: JWTPayload }).user;
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const roleHierarchy: Record<JWTPayload['role'], number> = {
      owner: 4,
      admin: 3,
      analyst: 2,
      viewer: 1,
    };

    const userLevel = roleHierarchy[user.role];
    const requiredLevel = Math.min(...allowedRoles.map((r) => roleHierarchy[r]));

    if (userLevel < requiredLevel) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}`,
      });
    }
  };
}
