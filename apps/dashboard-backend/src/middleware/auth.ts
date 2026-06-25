import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

export interface AuthContext {
  userId: string;
  orgId: string;
  role: string;
}

/**
 * Extracts and verifies the JWT from the Authorization header.
 */
export function getAuthContext(req: Request): AuthContext | null {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // Fallback to reading from cookies
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/);
      if (match) {
        token = match[1];
      }
    }
  }

  if (!token) {
    return null;
  }
  const secret = process.env.JWT_SECRET ?? 'dev-jwt-secret';
  
  if (!secret) {
    logger.error('JWT_SECRET is not configured in environment');
    return null;
  }

  try {
    const payload = jwt.verify(token, secret) as any;
    logger.info({ orgId: payload.orgId }, 'Successfully decoded JWT in dashboard-backend');
    
    return {
      userId: payload.userId || payload.sub,
      orgId: payload.orgId,
      role: payload.role,
    };
  } catch (error) {
    logger.error({ error }, 'JWT verification failed in dashboard-backend');
    return null;
  }
}
