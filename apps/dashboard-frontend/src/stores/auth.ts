import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

interface AuthState {
  user: User | null;
  org: Org | null;
  // SECURITY FIX (Flaw 10): accessToken and refreshToken are NO LONGER stored
  // in JavaScript state. They live exclusively in httpOnly cookies managed by
  // the browser \u2014 inaccessible to any script (including XSS payloads).
  //
  // isAuthenticated is derived from a successful /auth/me round-trip, not
  // from the presence of a token in memory.
  isAuthenticated: boolean;
  login: (user: User, org: Org) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  updateOrg: (org: Partial<Org>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      org: null,
      isAuthenticated: false,

      login: (user, org) => {
        set({ user, org, isAuthenticated: true });
      },

      logout: () => {
        set({ user: null, org: null, isAuthenticated: false });
      },

      updateUser: (updates) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        }));
      },

      updateOrg: (updates) => {
        set((state) => ({
          org: state.org ? { ...state.org, ...updates } : null,
        }));
      },
    }),
    {
      name: 'convoguard-auth',
      // Only persist non-sensitive UI state. Tokens are NEVER persisted.
      partialize: (state) => ({
        user: state.user,
        org: state.org,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
