import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { motion } from 'motion/react';
import { Footer } from '@/components/layout/Footer';
import { relayLink } from '@/api/auth';

// base64url → plain string — kept for backwards compat with old-format ?link= emails
// (those expire within 24 h; new emails use opaque ?key= instead)
function decodeLink(encoded: string): string | null {
  try {
    const padded = encoded + '='.repeat((4 - (encoded.length % 4)) % 4);
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    return atob(base64);
  } catch {
    return null;
  }
}

interface LabelConfig {
  title: string;
  description: string;
  button: string;
  fallback: { text: string; href: string } | null;
}

const LABEL_CONFIG: Record<string, LabelConfig> = {
  'reset-password': {
    title: 'Reset your password',
    description: 'Your reset link is ready. Click below to open the password reset form.',
    button: 'Set my password',
    fallback: { text: 'Request a new reset link', href: '/forgot-password' },
  },
  'activate': {
    title: 'Activate your LEAP™ account',
    description: 'Click below to set your password and access the platform.',
    button: 'Activate my account',
    fallback: null,
  },
  'admin-invite': {
    title: 'Set up your admin account',
    description: 'Click below to set your password and access the admin panel.',
    button: 'Activate admin account',
    fallback: null,
  },
  'org-welcome': {
    title: 'Welcome to LEAP™',
    description: 'Click below to activate your account and set your password.',
    button: 'Activate my account',
    fallback: null,
  },
};

export function Activate() {
  const [searchParams] = useSearchParams();
  const relayKey     = searchParams.get('key');         // new: opaque UUID
  const encoded      = searchParams.get('link') ?? '';  // old: base64url (backwards compat)
  const label        = searchParams.get('label') ?? 'activate';
  const config       = LABEL_CONFIG[label] ?? LABEL_CONFIG['activate'];

  // Legacy decoded URL — only used when no ?key= is present
  const legacyDecoded = relayKey ? null : decodeLink(encoded);

  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  const isValid = !!relayKey || !!legacyDecoded;

  const handleContinue = async () => {
    if (loading) return;

    if (relayKey) {
      // New flow: POST to backend to exchange opaque key for Supabase URL.
      // Scanners issue only GET/HEAD — they will never reach this code path.
      setLoading(true);
      try {
        const { url } = await relayLink(relayKey);
        window.location.href = url;
      } catch {
        setLoading(false);
        setExpired(true);
      }
      return;
    }

    // Legacy flow: navigate directly (old-format emails, expires within 24 h)
    if (legacyDecoded) {
      window.location.href = legacyDecoded;
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
        <div className="flex justify-center mb-8">
          <img
            src="/HIL-Isotope.png"
            alt="Heartfulness Institute of Leadership"
            className="h-12 w-auto opacity-90"
            referrerPolicy="no-referrer"
          />
        </div>

        <Card className="shadow-lg border-t-4 border-t-primary">
          {expired ? (
            <>
              <CardHeader>
                <CardTitle className="text-2xl font-display">Link expired</CardTitle>
                <CardDescription>
                  Your organisation's email security software scanned this link before
                  you clicked it, which used up the one-time token.
                  Please request a new link — it only takes a few seconds.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {config.fallback ? (
                  <Link
                    to={config.fallback.href}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {config.fallback.text} →
                  </Link>
                ) : (
                  <p className="text-sm text-gray-500">
                    Contact your administrator to resend the invite.
                  </p>
                )}
              </CardContent>
            </>
          ) : isValid ? (
            <>
              <CardHeader>
                <CardTitle className="text-2xl font-display">{config.title}</CardTitle>
                <CardDescription>{config.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleContinue}
                  disabled={loading}
                >
                  {loading ? 'Opening…' : `${config.button} →`}
                </Button>

                <div className="border-t border-gray-100 pt-4 text-center space-y-2">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    If you see "Link expired" after clicking, your organisation's email
                    security software may have scanned this link first, using up the
                    one-time token.
                  </p>
                  {config.fallback ? (
                    <Link
                      to={config.fallback.href}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {config.fallback.text} →
                    </Link>
                  ) : (
                    <p className="text-xs text-gray-400">
                      Contact your administrator to resend the invite.
                    </p>
                  )}
                </div>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-2xl font-display">Link invalid</CardTitle>
                <CardDescription>
                  This link appears to be incomplete or corrupted. Please use the
                  original button from your email, or request a new link below.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Request a new link →
                </Link>
              </CardContent>
            </>
          )}
        </Card>
      </motion.div>

      <div className="w-full mt-6 pb-8">
        <Footer />
      </div>
    </div>
  );
}
