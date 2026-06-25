import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import { authApi } from '@/lib/api';
import { Shield, User, Lock, ArrowRight } from 'lucide-react';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const loginStore = useAuthStore((s) => s.login);
  const addToast = useUIStore((s) => s.addToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.acceptInvite({ token, name, password });
      loginStore(res.user, res.org);
      addToast({ type: 'success', title: 'Welcome to the team!', description: `You've joined ${res.org.name}` });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite acceptance failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-white to-accent-50 dark:from-navy-900 dark:via-navy-900 dark:to-accent-950">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-500 to-purple-600 shadow-lg shadow-accent-500/30 mb-4">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">Accept your invitation</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Set up your account to join the team</p>
        </div>

        <div className="glass-card p-8">
          {error && (
            <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl text-sm text-danger-700 dark:text-danger-400 animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Your name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              icon={<User className="h-4 w-4" />}
              required
            />
            <Input
              label="Create a password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              icon={<Lock className="h-4 w-4" />}
              hint="Must be at least 8 characters"
              required
            />
            <Button type="submit" loading={loading} className="w-full" size="lg" icon={<ArrowRight className="h-4 w-4" />}>
              Join the team
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
