import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setPassword } from '@/api/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { motion } from 'motion/react';
import { Footer } from '@/components/layout/Footer';

function parseResetToken(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('access_token');
  const type = params.get('type');
  if (token && type === 'recovery') return token;
  return null;
}

export function ResetPassword() {
  const [token] = useState<string | null>(() => parseResetToken());
  const [password, setPasswordValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Expired / invalid token — show error state immediately
  if (!token) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50 items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="flex justify-center gap-4 mb-8">
            <img src="/logo.png" alt="Adizes Institute" className="h-12 w-auto" referrerPolicy="no-referrer" />
            <img src="/hil_blue.png" alt="HIL" className="h-12 w-auto" referrerPolicy="no-referrer" />
          </div>
          <Card className="shadow-lg border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="text-2xl font-display">Link expired</CardTitle>
              <CardDescription>This password reset link has expired or is invalid.</CardDescription>
            </CardHeader>
            <CardContent>
              <div role="alert" className="rounded-md bg-red-50 border border-red-200 px-4 py-4 text-sm text-red-600 mb-6">
                This password reset link has expired or is invalid.
              </div>
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-primary hover:text-primary-dark transition-colors"
              >
                Request a new reset link →
              </Link>
            </CardContent>
          </Card>
        </motion.div>
        <div className="w-full mt-6 pb-8">
          <Footer />
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await setPassword(token, password);
      navigate('/?message=password-updated', { replace: true });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '';
      setError(detail || 'Failed to set password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="flex justify-center gap-4 mb-8">
          <img src="/logo.png" alt="Adizes Institute" className="h-12 w-auto" referrerPolicy="no-referrer" />
          <img src="/hil_blue.png" alt="HIL" className="h-12 w-auto" referrerPolicy="no-referrer" />
        </div>

        <Card className="shadow-lg border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-2xl font-display">Set new password</CardTitle>
            <CardDescription>Choose a strong password for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900" htmlFor="password">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900" htmlFor="confirm">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div role="alert" className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                  {error}{' '}
                  {error.toLowerCase().includes('expired') && (
                    <Link to="/forgot-password" className="underline font-medium">
                      Request a new link →
                    </Link>
                  )}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Setting password…' : 'Set Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
      <div className="w-full mt-6 pb-8">
        <Footer />
      </div>
    </div>
  );
}
