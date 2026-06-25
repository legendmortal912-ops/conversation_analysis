import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import { authApi } from '@/lib/api';
import { Shield, Mail, Lock, User, Building2, ArrowRight } from 'lucide-react';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
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
      const res = await authApi.register({ name, email, password, orgName });
      
      // SECURITY FIX (Flaw 12): We no longer log the user in immediately.
      // We show a success message telling them to check their email.
      if (res.requiresVerification) {
        setSuccess(true);
        addToast({ type: 'success', title: 'Account created!', description: 'Please check your email to verify your account.' });
      } else {
        // Fallback for older API behavior if needed
        login(res.user, res.org);
        navigate('/onboarding');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
          <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">Create your account</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Start protecting your AI conversations today</p>
        </div>

        <div className="glass-card p-8">
          {success ? (
            <div className="text-center animate-fade-in py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                <Mail className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-2">Check your inbox</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                We've sent a verification link to <span className="font-medium text-slate-700 dark:text-slate-300">{email}</span>. 
                Please click the link to verify your account and sign in.
              </p>
              <Button onClick={() => navigate('/login')} variant="outline" className="w-full">
                Return to login
              </Button>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl text-sm text-danger-700 dark:text-danger-400 animate-fade-in">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="Full name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  icon={<User className="h-4 w-4" />}
                  required
                />
                <Input
                  label="Work email"
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
                  placeholder="Min 8 characters"
                  icon={<Lock className="h-4 w-4" />}
                  hint="Must be at least 8 characters"
                  required
                />
                <Input
                  label="Organization name"
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Inc."
                  icon={<Building2 className="h-4 w-4" />}
                  required
                />

                <Button type="submit" loading={loading} className="w-full" size="lg" icon={<ArrowRight className="h-4 w-4" />}>
                  Create account
                </Button>
              </form>

              <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
                By creating an account, you agree to our Terms of Service and Privacy Policy.
              </p>
            </>
          )}
        </div>

        {!success && (
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-600 dark:text-accent-400 hover:text-accent-700 font-semibold">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
