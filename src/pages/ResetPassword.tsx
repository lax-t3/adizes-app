import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setPassword } from '@/api/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { motion } from 'motion/react';
import { Footer } from '@/components/layout/Footer';

interface ParsedHash {
  token: string | null;
  scannerError: boolean;
}

function parseResetHash(): ParsedHash {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('access_token');
  const type  = params.get('type');
  const error = params.get('error') ?? '';

  if (token && type === 'recovery') return { token, scannerError: false };

  // Supabase sends error=access_denied when the OTP is already used —
  // the most common cause is an email security scanner pre-fetching the link.
  const scannerError = error === 'access_denied' || error.includes('otp');
  return { token: null, scannerError };
}

export function ResetPassword() {
  const [parsed, setParsed]   = useState<ParsedHash>(() => parseResetHash());
  const [ready, setReady]     = useState(false);
  const [password, setPasswordValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const navigate              = useNavigate();

  // Re-parse once after mount — guards against any async hash population.
  useEffect(() => {
    const result = parseResetHash();
    setParsed(result);
    setReady(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed.token) return;
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return; }
    setError('');
    setLoading(true);
    try {
      await setPassword(parsed.token, password);
      navigate('/?message=password-updated', { replace: true });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '';
      setError(detail || 'Failed to set password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  // Brief loading state while the useEffect re-parse runs.
  if (!ready) return null;

  if (!parsed.token) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50 items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="flex justify-center gap-4 mb-8">
            <img src="/HIL-Isotope.png" alt="Heartfulness Institute of Leadership" className="h-12 w-auto opacity-90" referrerPolicy="no-referrer" />
          </div>
          <Card className="shadow-lg border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="text-2xl font-display">Link expired</CardTitle>
              <CardDescription>
                {parsed.scannerError
                  ? 'Your organisation\'s email security software scanned this link before you clicked it, which used up the one-time token. Please request a new link — it only takes a few seconds.'
                  : 'This password reset link has expired or has already been used.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
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

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="flex justify-center gap-4 mb-8">
          <img src="/HIL-Isotope.png" alt="Heartfulness Institute of Leadership" className="h-12 w-auto opacity-90" referrerPolicy="no-referrer" />
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
