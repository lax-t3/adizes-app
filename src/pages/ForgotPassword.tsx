import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '@/api/auth';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { motion } from 'motion/react';
import { Footer } from '@/components/layout/Footer';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<'idle' | 'sent' | 'not_activated' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await forgotPassword(email);
      setResult(res.status);
    } catch {
      setResult('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="/logo.png" alt="Adizes Institute" className="h-14 w-auto" referrerPolicy="no-referrer" />
          <img src="/hil_blue.png" alt="Heartfulness Institute of Leadership" className="h-9 w-auto opacity-85" referrerPolicy="no-referrer" />
        </div>

        <Card className="shadow-lg border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-2xl font-display">Forgot password?</CardTitle>
            <CardDescription>
              Enter your email address and we'll check your account status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900" htmlFor="email">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  placeholder="name@company.com"
                />
              </div>

              {result === 'sent' && (
                <div role="alert" className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                  Reset link sent. Check your inbox — the link expires in 1 hour.
                </div>
              )}
              {result === 'not_activated' && (
                <div role="alert" className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                  Your account isn't activated yet. Please click the activation link in your
                  welcome email first. Contact your administrator if you need it resent.
                </div>
              )}
              {result === 'error' && (
                <div role="alert" className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                  Something went wrong. Please try again.
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || result === 'sent'}
                className="w-full h-11 text-base mt-2"
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
              <Link to="/" className="font-medium text-primary hover:text-primary-dark transition-colors">
                ← Back to login
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="w-full mt-6 pb-8">
        <Footer />
      </div>
    </div>
  );
}
