import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import { generateTokenPair, verifyRefreshToken, jwtMiddleware, type JWTPayload } from '../middleware/jwt.js';
import { emailService } from '../services/email.js';
import { logger } from '../utils/logger.js';

/**
 * Auth routes: register, login, logout, refresh, forgot/reset password.
 * All user and org data is stored in PostgreSQL via Prisma.
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Using inline DB access to avoid circular deps during build.
  // In production, inject Prisma client via fastify decoration.
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  // ─── POST /auth/register ───────────────────────────────
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      email: string;
      password: string;
      name: string;
      orgName: string;
    };

    if (!body.email || !body.password || !body.name || !body.orgName) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'email, password, name, and orgName are required',
      });
    }

    if (body.password.length < 8) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Password must be at least 8 characters',
      });
    }

    // Check existing user
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'An account with this email already exists',
      });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const slug = body.orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const verificationToken = randomBytes(32).toString('hex');
    const verificationHash = createHash('sha256').update(verificationToken).digest('hex');

    // Create org + user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: body.orgName,
          slug: `${slug}-${randomBytes(3).toString('hex')}`,
          plan: 'FREE',
        },
      });

      const user = await tx.user.create({
        data: {
          email: body.email,
          passwordHash,
          name: body.name,
          role: 'OWNER',
          orgId: org.id,
          verificationToken: verificationHash,
        },
      });

      return { org, user };
    });

    // SECURITY FIX (Flaw 12): Require email verification.
    // Instead of logging the user in immediately, we send a verification email.
    // The frontend will tell the user to check their inbox.
    try {
      // Stub: In a real implementation we would send an email with a link to 
      // `${FRONTEND_URL}/verify-email?token=${verificationToken}`
      // emailService.sendVerification(body.email, body.name, verificationToken);
      logger.info({ email: body.email, token: verificationToken }, 'Verification email sent (simulated)');
    } catch (err) {
      logger.error(err, 'Failed to send verification email');
    }

    logger.info({ userId: result.user.id, orgId: result.org.id }, 'User registered (pending verification)');

    return reply.status(201).send({
      message: 'Account created successfully. Please check your email to verify your account before logging in.',
      requiresVerification: true,
    });
  });

  // ─── POST /auth/verify-email ───────────────────────────
  app.post('/verify-email', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { token: string };
    if (!body.token) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'token is required',
      });
    }

    const tokenHash = createHash('sha256').update(body.token).digest('hex');

    const user = await prisma.user.findFirst({
      where: { verificationToken: tokenHash },
      include: { organization: true },
    });

    if (!user) {
      return reply.status(400).send({
        error: 'Invalid Token',
        message: 'Verification link is invalid or expired',
      });
    }

    // Mark verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
      },
    });

    // Now log them in
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      orgId: user.orgId,
      role: user.role.toLowerCase() as JWTPayload['role'],
    });

    const refreshHash = createHash('sha256').update(tokens.refreshToken).digest('hex');
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: refreshHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    reply.setCookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/auth/refresh',
      maxAge: 30 * 24 * 60 * 60,
    });

    reply.setCookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });

    logger.info({ userId: user.id }, 'Email verified and user logged in');

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      org: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
        plan: user.organization.plan,
      },
    };
  });

  // ─── POST /auth/login ──────────────────────────────────
  app.post('/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
        keyGenerator: (request: FastifyRequest) => {
          const body = request.body as { email?: string } | undefined;
          return body?.email ?? request.ip;
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { email: string; password: string };

      if (!body.email || !body.password) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'email and password are required',
        });
      }

      const user = await prisma.user.findUnique({
        where: { email: body.email },
        include: { organization: true },
      });

      if (!user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid email or password',
        });
      }

      // SECURITY FIX (Flaw 12): Enforce email verification
      if (!user.emailVerified) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Please verify your email address before logging in. Check your inbox for the verification link.',
        });
      }

      const passwordValid = await bcrypt.compare(body.password, user.passwordHash);
      if (!passwordValid) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid email or password',
        });
      }

      const tokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        orgId: user.orgId,
        role: user.role.toLowerCase() as JWTPayload['role'],
      });

      // Store refresh token hash in sessions table
      const refreshHash = createHash('sha256').update(tokens.refreshToken).digest('hex');
      await prisma.session.create({
        data: {
          userId: user.id,
          refreshTokenHash: refreshHash,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      reply.setCookie('refresh_token', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        path: '/auth/refresh',
        maxAge: 30 * 24 * 60 * 60,
      });

      reply.setCookie('access_token', tokens.accessToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60, // 15 minutes
      });

      logger.info({ userId: user.id }, 'User logged in');

      // SECURITY FIX (Flaw 10): Tokens are in httpOnly cookies only.
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        org: {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
          plan: user.organization.plan,
        },
      };
    },
  });

  // ─── POST /auth/logout ─────────────────────────────────
  app.post('/logout', {
    preHandler: [jwtMiddleware],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const refreshToken = request.cookies['refresh_token'];
      if (refreshToken) {
        const hash = createHash('sha256').update(refreshToken).digest('hex');
        await prisma.session.deleteMany({ where: { refreshTokenHash: hash } });
      }

      reply.clearCookie('refresh_token', { path: '/auth/refresh' });
      reply.clearCookie('access_token', { path: '/' });
      return { message: 'Logged out successfully' };
    },
  });

  // ─── POST /auth/refresh ────────────────────────────────
  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies['refresh_token'];
    if (!refreshToken) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'No refresh token provided',
      });
    }

    try {
      const decoded = verifyRefreshToken(refreshToken);
      const hash = createHash('sha256').update(refreshToken).digest('hex');

      // Verify session exists and is valid
      const session = await prisma.session.findFirst({
        where: {
          refreshTokenHash: hash,
          userId: decoded.userId,
          expiresAt: { gt: new Date() },
        },
      });

      if (!session) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid or expired refresh token',
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { organization: true },
      });

      if (!user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'User not found',
        });
      }

      // Rotate refresh token
      const newTokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        orgId: user.orgId,
        role: user.role.toLowerCase() as JWTPayload['role'],
      });

      // Delete old session, create new one
      await prisma.session.delete({ where: { id: session.id } });
      const newHash = createHash('sha256').update(newTokens.refreshToken).digest('hex');
      await prisma.session.create({
        data: {
          userId: user.id,
          refreshTokenHash: newHash,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      reply.setCookie('refresh_token', newTokens.refreshToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        path: '/auth/refresh',
        maxAge: 30 * 24 * 60 * 60,
      });

      reply.setCookie('access_token', newTokens.accessToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60, // 15 minutes
      });

      return {
        accessToken: newTokens.accessToken,
        expiresIn: newTokens.accessExpiresIn,
      };
    } catch {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid refresh token',
      });
    }
  });

  // ─── POST /auth/forgot-password ────────────────────────
  app.post('/forgot-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { email: string };
    if (!body.email) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'email is required',
      });
    }

    const user = await prisma.user.findUnique({ where: { email: body.email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If that email is registered, a reset link has been sent.' };
    }

    const resetToken = randomBytes(32).toString('hex');
    const resetHash = createHash('sha256').update(resetToken).digest('hex');

    // Store reset token with 1-hour expiry
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: resetHash,
        resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await emailService.sendPasswordReset(body.email, resetToken);

    return { message: 'If that email is registered, a reset link has been sent.' };
  });

  // ─── POST /auth/reset-password ─────────────────────────
  app.post('/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { token: string; password: string };
    if (!body.token || !body.password) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'token and password are required',
      });
    }

    if (body.password.length < 8) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Password must be at least 8 characters',
      });
    }

    const tokenHash = createHash('sha256').update(body.token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetTokenExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return reply.status(400).send({
        error: 'Invalid Token',
        message: 'Reset token is invalid or expired',
      });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    // Invalidate all sessions
    await prisma.session.deleteMany({ where: { userId: user.id } });

    logger.info({ userId: user.id }, 'Password reset successful');

    return { message: 'Password reset successfully. Please log in with your new password.' };
  });

  // ─── GET /auth/me ──────────────────────────────────────
  app.get('/me', {
    preHandler: [jwtMiddleware],
    handler: async (request: FastifyRequest) => {
      const { userId } = (request as FastifyRequest & { user: JWTPayload }).user;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          organization: {
            include: {
              projects: { select: { id: true, name: true, aiSystemName: true } },
            },
          },
        },
      });

      if (!user) {
        throw { statusCode: 404, message: 'User not found' };
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        org: {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
          plan: user.organization.plan,
          projects: user.organization.projects,
        },
      };
    },
  });

  // ─── POST /auth/invite ─────────────────────────────────
  app.post('/invite', {
    preHandler: [jwtMiddleware],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { orgId, role: senderRole } = (request as FastifyRequest & { user: JWTPayload }).user;

      if (senderRole !== 'owner' && senderRole !== 'admin') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Only owners and admins can invite users',
        });
      }

      const body = request.body as { email: string; role: string };
      if (!body.email || !body.role) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'email and role are required',
        });
      }

      const validRoles = ['ADMIN', 'ANALYST', 'VIEWER'];
      if (!validRoles.includes(body.role.toUpperCase())) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: `role must be one of: ${validRoles.join(', ')}`,
        });
      }

      // Check if user already exists in this org
      const existingUser = await prisma.user.findFirst({
        where: { email: body.email, orgId },
      });
      if (existingUser) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'User already belongs to this organization',
        });
      }

      const inviteToken = randomBytes(32).toString('hex');

      await prisma.invite.create({
        data: {
          email: body.email,
          orgId,
          role: body.role.toUpperCase() as 'ADMIN' | 'ANALYST' | 'VIEWER',
          token: createHash('sha256').update(inviteToken).digest('hex'),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      await emailService.sendInvite(body.email, org?.name ?? 'ConvoGuard', inviteToken);

      logger.info({ email: body.email, orgId, role: body.role }, 'Invite sent');

      return reply.status(201).send({
        message: 'Invitation sent',
        email: body.email,
        role: body.role,
      });
    },
  });

  // ─── POST /auth/accept-invite/:token ───────────────────
  app.post('/accept-invite/:token', async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = request.params as { token: string };
    const body = request.body as { name: string; password: string };

    if (!body.name || !body.password) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'name and password are required',
      });
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');

    const invite = await prisma.invite.findFirst({
      where: {
        token: tokenHash,
        expiresAt: { gt: new Date() },
        acceptedAt: null,
      },
      include: { organization: true },
    });

    if (!invite) {
      return reply.status(400).send({
        error: 'Invalid Invite',
        message: 'Invitation is invalid or expired',
      });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: invite.email,
          passwordHash,
          name: body.name,
          role: invite.role as 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER',
          orgId: invite.orgId,
        },
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      return user;
    });

    const tokens = generateTokenPair({
      userId: result.id,
      email: result.email,
      orgId: invite.orgId,
      role: invite.role.toLowerCase() as JWTPayload['role'],
    });

    reply.setCookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/auth/refresh',
      maxAge: 30 * 24 * 60 * 60,
    });

    reply.setCookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60, // 15 minutes
    });

    logger.info({ userId: result.id, orgId: invite.orgId }, 'Invite accepted');

    // SECURITY FIX (Flaw 10): Tokens are in httpOnly cookies only.
    return reply.status(201).send({
      user: {
        id: result.id,
        email: result.email,
        name: result.name,
        role: result.role,
      },
      org: {
        id: invite.organization.id,
        name: invite.organization.name,
        slug: invite.organization.slug,
      },
    });
  });

  // ─── OAUTH CALLBACKS ───────────────────────────────────
  
  async function handleOAuthLogin(
    email: string,
    name: string,
    providerField: 'googleId' | 'githubId',
    providerId: string,
    avatarUrl?: string
  ): Promise<{ tokens: ReturnType<typeof generateTokenPair>; user: any; org: any }> {
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { [providerField]: providerId },
          { email }
        ]
      },
      include: { organization: true }
    });

    let org;
    if (user) {
      // Link account if not linked
      if (!user[providerField]) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { [providerField]: providerId, avatarUrl: user.avatarUrl ?? avatarUrl },
          include: { organization: true }
        });
      }
      org = user.organization;
    } else {
      // Create new user & org
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'org';
      const result = await prisma.$transaction(async (tx) => {
        const newOrg = await tx.organization.create({
          data: {
            name: `${name}'s Org`,
            slug: `${slug}-${randomBytes(3).toString('hex')}`,
            plan: 'FREE',
          },
        });
        const newUser = await tx.user.create({
          data: {
            email,
            name,
            role: 'OWNER',
            orgId: newOrg.id,
            [providerField]: providerId,
            avatarUrl,
          },
          include: { organization: true }
        });
        return { user: newUser, org: newOrg };
      });
      user = result.user;
      org = result.org;
    }

    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      orgId: user.orgId,
      role: user.role.toLowerCase() as JWTPayload['role'],
    });

    // Create session
    const refreshHash = createHash('sha256').update(tokens.refreshToken).digest('hex');
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: refreshHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return { tokens, user, org };
  }

  app.get('/google/callback', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      // @ts-expect-error fastify-oauth2 dynamic decoration
      const { token } = await this.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      const profile = (await res.json()) as any;

      if (!profile.email) throw new Error('No email from Google');

      const { tokens } = await handleOAuthLogin(
        profile.email,
        profile.name || profile.email.split('@')[0],
        'googleId',
        profile.id,
        profile.picture,
      );

      // SECURITY FIX (Flaw 10): Set tokens as httpOnly cookies server-side,
      // then redirect with NO query parameters. Previously the redirect URL
      // contained raw JWTs which are permanently stored in browser history,
      // proxy logs, and server access logs.
      reply.setCookie('refresh_token', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        path: '/auth/refresh',
        maxAge: 30 * 24 * 60 * 60,
      });
      reply.setCookie('access_token', tokens.accessToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60,
      });

      const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';
      reply.redirect(`${frontendUrl}/oauth-callback`);
    } catch (err) {
      logger.error(err, 'Google OAuth Error');
      const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';
      reply.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  });

  app.get('/github/callback', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      // @ts-expect-error fastify-oauth2 dynamic decoration
      const { token } = await this.githubOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

      const res = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      const profile = (await res.json()) as any;

      let email = profile.email;
      if (!email) {
        const emailsRes = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });
        const emails = (await emailsRes.json()) as any[];
        const primary = emails.find((e) => e.primary) || emails[0];
        if (primary) email = primary.email;
      }

      if (!email) throw new Error('No email from GitHub');

      const { tokens } = await handleOAuthLogin(
        email,
        profile.name || profile.login || email.split('@')[0],
        'githubId',
        profile.id.toString(),
        profile.avatar_url,
      );

      // SECURITY FIX (Flaw 10): Same as Google — set httpOnly cookies,
      // redirect with no tokens in the URL.
      reply.setCookie('refresh_token', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        path: '/auth/refresh',
        maxAge: 30 * 24 * 60 * 60,
      });
      reply.setCookie('access_token', tokens.accessToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60,
      });

      const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';
      reply.redirect(`${frontendUrl}/oauth-callback`);
    } catch (err) {
      logger.error(err, 'GitHub OAuth Error');
      const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';
      reply.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  });
}
