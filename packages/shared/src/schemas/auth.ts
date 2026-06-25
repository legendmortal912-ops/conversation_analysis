/**
 * @module schemas/auth
 * Zod validation schemas for authentication and authorization payloads.
 */

import { z } from 'zod';

/** Zod schema for user roles. */
export const RoleSchema = z.enum(['OWNER', 'ADMIN', 'ANALYST', 'VIEWER']);

/**
 * Schema for login request body.
 */
export const LoginSchema = z.object({
  /** User email. */
  email: z.string().email('Invalid email address'),
  /** User password. */
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/** Inferred type from LoginSchema. */
export type LoginInput = z.infer<typeof LoginSchema>;

/**
 * Schema for user registration request body.
 */
export const RegisterSchema = z.object({
  /** User email. */
  email: z.string().email('Invalid email address'),
  /** User password (minimum 8 chars, at least one uppercase, one lowercase, one digit). */
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
  /** Display name. */
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  /** Organization name. */
  organizationName: z
    .string()
    .min(1, 'Organization name is required')
    .max(100, 'Organization name must be 100 characters or fewer'),
});

/** Inferred type from RegisterSchema. */
export type RegisterInput = z.infer<typeof RegisterSchema>;

/**
 * Schema for token refresh request body.
 */
export const RefreshTokenSchema = z.object({
  /** The refresh token. */
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

/** Inferred type from RefreshTokenSchema. */
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

/**
 * Schema for password reset request.
 */
export const PasswordResetRequestSchema = z.object({
  /** Email to send the reset link to. */
  email: z.string().email('Invalid email address'),
});

/** Inferred type from PasswordResetRequestSchema. */
export type PasswordResetRequestInput = z.infer<typeof PasswordResetRequestSchema>;

/**
 * Schema for completing a password reset.
 */
export const PasswordResetCompleteSchema = z.object({
  /** The reset token from the email link. */
  token: z.string().min(1, 'Reset token is required'),
  /** New password. */
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
});

/** Inferred type from PasswordResetCompleteSchema. */
export type PasswordResetCompleteInput = z.infer<typeof PasswordResetCompleteSchema>;

/**
 * Schema for inviting a user to an organization.
 */
export const InviteUserSchema = z.object({
  /** Email to invite. */
  email: z.string().email('Invalid email address'),
  /** Role to assign. */
  role: RoleSchema,
});

/** Inferred type from InviteUserSchema. */
export type InviteUserInput = z.infer<typeof InviteUserSchema>;

/**
 * Schema for creating an API key.
 */
export const CreateApiKeySchema = z.object({
  /** Friendly name for the key. */
  name: z.string().min(1, 'Name is required').max(100),
  /** Optional project scope. */
  projectId: z.string().nullish().transform((v) => v ?? null),
});

/** Inferred type from CreateApiKeySchema. */
export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
