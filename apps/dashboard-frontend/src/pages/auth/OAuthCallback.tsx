import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import { Loader2 } from 'lucide-react';

/**
 * SECURITY FIX (Flaw 10): OAuthCallback no longer reads tokens from the URL.
 *
 * The auth service now sets httpOnly cookies BEFORE redirecting here, so the
 * browser already holds a valid access_token cookie by the time this page
 * mounts. We simply call /auth/me (which the browser sends the cookie with
 * automatically) to hydrate the user profile into the Zustand store, then
 * navigate to the dashboard.
 *
 * There are NO tokens in the URL, NO localStorage writes, and NO token
 * visible to JavaScript at any point.
 */
export default function OAuthCallback() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const addToast = useUIStore((s) => s.addToast);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function finishLogin() {
      try {
        // The access_token httpOnly cookie is sent automatically by the browser.
        const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: 'include',
        });

        if (!res.ok) throw new Error('Failed to fetch user profile');
        const data = await res.json();

        const user = {
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role,
        };

        // login() no longer accepts tokens — just user + org
        login(user, data.org);
        addToast({
          type: 'success',
          title: 'Successfully signed in',
          description: `Welcome, ${user.name}`,
        });
        navigate('/dashboard');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setTimeout(() => navigate('/login'), 3000);
      }
    }

    finishLogin();
  }, [navigate, login, addToast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-navy-900">
      <div className="text-center">
        {error ? (
          <div className="text-red-500 mb-4">{error}</div>
        ) : (
          <Loader2 className="w-8 h-8 text-accent-500 animate-spin mx-auto mb-4" />
        )}
        <p className="text-slate-600 dark:text-slate-400">
          {error ? 'Redirecting back to login...' : 'Completing authentication...'}
        </p>
      </div>
    </div>
  );
}
