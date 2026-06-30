import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import { authApi } from '@/lib/api';
import { Shield, Mail, Lock, ArrowRight, Github, ArrowLeft } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const addToast = useUIStore((s) => s.addToast);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      // SECURITY FIX (Flaw 10): Tokens arrive via httpOnly cookies set by the
      // server. We only pull user + org data from the response body.
      login(res.user, res.org);
      addToast({ type: 'success', title: 'Welcome back!', description: `Signed in as ${res.user.name}` });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Gradient */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-accent-900 to-purple-900" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(99, 102, 241, 0.4) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(168, 85, 247, 0.3) 0%, transparent 50%)' }} />
        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">ConvoGuard</h1>
              <p className="text-xs text-accent-300 tracking-widest uppercase">AI Safety Platform</p>
            </div>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Detect AI manipulation<br />
            <span className="bg-gradient-to-r from-accent-400 to-purple-400 bg-clip-text text-transparent">in real time.</span>
          </h2>
          <p className="text-lg text-slate-300 max-w-md leading-relaxed">
            Monitor conversations, flag manipulation patterns, and protect your users with enterprise-grade AI safety tooling.
          </p>
          <div className="mt-12 flex gap-8">
            <div>
              <p className="text-3xl font-bold text-white">99.7%</p>
              <p className="text-sm text-slate-400">Detection accuracy</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">&lt;50ms</p>
              <p className="text-sm text-slate-400">Analysis latency</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">500M+</p>
              <p className="text-sm text-slate-400">Turns analyzed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-navy-900">
        <div className="w-full max-w-md animate-fade-in-up relative">
          <Link to="/" className="absolute -top-12 left-0 flex items-center gap-2 text-sm text-slate-500 hover:text-navy-900 dark:hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-purple-600 flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-navy-900 dark:text-white">ConvoGuard</h1>
          </div>

          <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">Welcome back</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">Sign in to your account to continue</p>

          {error && (
            <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl text-sm text-danger-700 dark:text-danger-400 animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-3 mb-6">
              <a 
                href={`${API_URL}/auth/google/login`} 
                className="flex items-center justify-center gap-3 w-full py-2.5 px-4 bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  <path d="M1 1h22v22H1z" fill="none"/>
                </svg>
                Continue with Google
              </a>
              <a 
                href={`${API_URL}/auth/github/login`} 
                className="flex items-center justify-center gap-3 w-full py-2.5 px-4 bg-slate-900 dark:bg-navy-800 border border-slate-900 dark:border-slate-700 rounded-lg text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-navy-700 transition-colors"
              >
                <Github className="w-5 h-5" />
                Continue with GitHub
              </a>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
              <span className="text-xs text-slate-500 font-medium tracking-wider">OR CONTINUE WITH EMAIL</span>
              <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
            </div>
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              icon={<Mail className="h-4 w-4" />}
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              icon={<Lock className="h-4 w-4" />}
              required
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-slate-300 text-accent-500 focus:ring-accent-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-sm text-accent-600 dark:text-accent-400 hover:text-accent-700 font-medium">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" loading={loading} className="w-full" size="lg" icon={<ArrowRight className="h-4 w-4" />}>
              Sign in
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-accent-600 dark:text-accent-400 hover:text-accent-700 font-semibold">
              Get started free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
