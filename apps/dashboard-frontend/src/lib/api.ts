const API_BASE = '/api/v1';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include', // Automatically send httpOnly cookies (access_token)
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(res.status, error.message || 'Request failed');
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  orgName: string;
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl?: string;
  };
  org: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
  accessToken: string;
  refreshToken: string;
  requiresVerification?: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface AcceptInviteRequest {
  token: string;
  name: string;
  password: string;
}

export const authApi = {
  login: (data: LoginRequest) => request<AuthResponse>('/auth/login', { method: 'POST', body: data }),

  register: (data: RegisterRequest) => request<AuthResponse>('/auth/register', { method: 'POST', body: data }),

  forgotPassword: (data: ForgotPasswordRequest) => request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: data }),

  resetPassword: (data: ResetPasswordRequest) => request<{ message: string }>('/auth/reset-password', { method: 'POST', body: data }),

  acceptInvite: (data: AcceptInviteRequest) => request<AuthResponse>('/auth/accept-invite', { method: 'POST', body: data }),

  refreshToken: (refreshToken: string) => request<AuthResponse>('/auth/refresh', { method: 'POST', body: { refreshToken } }),

  me: () => request<AuthResponse['user']>('/auth/me'),
};

export const projectApi = {
  list: () => request<{ projects: Array<{ id: string; name: string; aiSystemName: string; createdAt: string }> }>('/projects'),

  create: (data: { name: string; aiSystemName: string }) => request<{ id: string; name: string }>('/projects', { method: 'POST', body: data }),

  update: (id: string, data: { name?: string; aiSystemName?: string; alertThreshold?: number }) => request<void>(`/projects/${id}`, { method: 'PATCH', body: data }),
};

export const apiKeyApi = {
  list: () => request<{ keys: Array<{ id: string; name: string; prefix: string; createdAt: string; lastUsedAt?: string; expiresAt?: string }> }>('/api-keys'),

  create: (data: { name: string; expiresInDays?: number }) => request<{ id: string; key: string; name: string; expiresAt?: string }>('/api-keys', { method: 'POST', body: data }),

  revoke: (id: string) => request<void>(`/api-keys/${id}`, { method: 'DELETE' }),
};

export const teamApi = {
  members: () => request<{ members: Array<{ id: string; name: string; email: string; role: string; joinedAt: string }> }>('/team/members'),

  invite: (data: { email: string; role: string }) => request<{ message: string }>('/team/invite', { method: 'POST', body: data }),

  updateRole: (userId: string, role: string) => request<void>(`/team/members/${userId}/role`, { method: 'PATCH', body: { role } }),

  remove: (userId: string) => request<void>(`/team/members/${userId}`, { method: 'DELETE' }),
};

export const reportApi = {
  list: () => request<{
    reports: Array<{
      id: string;
      type: string;
      status: string;
      createdAt: string;
      downloadUrl?: string;
    }>;
  }>('/reports'),

  generate: (data: { type: string; startDate: string; endDate: string; projectId?: string; filters?: Record<string, unknown> }) => request<{ id: string; status: string }>('/reports', { method: 'POST', body: data }),
};

export const billingApi = {
  current: () => request<{
    plan: string;
    conversationsUsed: number;
    conversationsLimit: number;
    nextBillingDate: string;
  }>('/billing/current'),

  invoices: () => request<{
    invoices: Array<{
      id: string;
      amount: number;
      status: string;
      date: string;
      downloadUrl: string;
    }>;
  }>('/billing/invoices'),
};
