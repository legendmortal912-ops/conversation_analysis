import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/lib/api';
import { Shield, Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
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
          <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">Forgot password?</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {sent ? "We've sent you a reset link" : "No worries, we'll send you reset instructions"}
          </p>
        </div>

        <div className="glass-card p-8">
          {sent ? (
            <div className="text-center space-y-4 animate-fade-in">
              <div className="inline-flex p-4 rounded-full bg-success-50 dark:bg-success-900/20">
                <CheckCircle className="h-8 w-8 text-success-500" />
              </div>
              <div>
                <p className="text-sm text-navy-700 dark:text-slate-300">
                  We sent a password reset link to
                </p>
                <p className="text-sm font-semibold text-navy-900 dark:text-white mt-1">{email}</p>
              </div>
              <p className="text-xs text-slate-400">
                Didn&apos;t receive the email? Check your spam folder or{' '}
                <button onClick={() => setSent(false)} className="text-accent-600 dark:text-accent-400 font-medium">
                  try again
                </button>
              </p>
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
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  icon={<Mail className="h-4 w-4" />}
                  required
                />
                <Button type="submit" loading={loading} className="w-full" size="lg">
                  Send reset link
                </Button>
              </form>
            </>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-navy-700 dark:hover:text-white font-medium transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
