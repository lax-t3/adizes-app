import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '@/api/auth';

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
    <div className="flex min-h-screen bg-white items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10">
          <img src="/logo.png" alt="Adizes Institute" className="h-12 w-auto" referrerPolicy="no-referrer" />
        </div>

        <h1 className="text-3xl font-display mb-2 text-gray-900">Forgot password?</h1>
        <p className="text-base text-gray-500 mb-8">
          Enter your email address and we'll check your account status.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all"
              placeholder="name@company.com"
            />
          </div>

          {result === 'sent' && (
            <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              Reset link sent. Check your inbox — the link expires in 1 hour.
            </div>
          )}
          {result === 'not_activated' && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              Your account isn't activated yet. Please click the activation link in your
              welcome email first. Contact your administrator if you need it resent.
            </div>
          )}
          {result === 'error' && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              Something went wrong. Please try again.
            </div>
          )}

          <button
            type="submit"
            disabled={loading || result === 'sent'}
            className="w-full h-11 bg-[#C8102E] text-white rounded-md text-base font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/" className="text-sm font-medium text-[#C8102E] hover:text-red-700 transition-colors">
            ← Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
