/**
 * @module auth
 * Authentication and authorization types for ConvoGuard.
 */

/** User roles with hierarchical permission levels. */
export enum Role {
  /** Full control over organization, billing, and all settings. */
  OWNER = 'OWNER',
  /** Manage projects, users, API keys; cannot change billing. */
  ADMIN = 'ADMIN',
  /** View and analyze conversations, flags, and metrics. */
  ANALYST = 'ANALYST',
  /** Read-only access to dashboards and reports. */
  VIEWER = 'VIEWER',
}

/** JWT access-token payload embedded in every authenticated request. */
export interface JWTPayload {
  /** User's unique identifier. */
  sub: string;
  /** User's email address. */
  email: string;
  /** Organization the user belongs to. */
  orgId: string;
  /** The user's role within the organization. */
  role: Role;
  /** Issued-at timestamp (epoch seconds). */
  iat: number;
  /** Expiration timestamp (epoch seconds). */
  exp: number;
  /** Token type discriminator. */
  type: 'access';
}

/** Refresh-token payload used for silent token renewal. */
export interface RefreshTokenPayload {
  /** User's unique identifier. */
  sub: string;
  /** Session identifier bound to this refresh token. */
  sessionId: string;
  /** Expiration timestamp (epoch seconds). */
  exp: number;
  /** Token type discriminator. */
  type: 'refresh';
}

/** A paired set of access + refresh tokens returned on login/refresh. */
export interface TokenPair {
  /** Short-lived JWT access token. */
  accessToken: string;
  /** Long-lived refresh token. */
  refreshToken: string;
  /** Access token TTL in seconds. */
  expiresIn: number;
}

/** Login request credentials. */
export interface LoginCredentials {
  /** User email. */
  email: string;
  /** User password (plaintext, will be hashed server-side). */
  password: string;
}

/** Registration request payload. */
export interface RegisterPayload {
  /** User email. */
  email: string;
  /** User password (plaintext, will be hashed server-side). */
  password: string;
  /** Display name. */
  name: string;
  /** Organization name to create. */
  organizationName: string;
}

/** Password reset request. */
export interface PasswordResetRequest {
  /** The reset token sent via email. */
  token: string;
  /** The new password. */
  newPassword: string;
}
