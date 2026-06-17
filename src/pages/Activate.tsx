import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { motion } from 'motion/react';
import { Footer } from '@/components/layout/Footer';

// base64url → plain string, tolerant of missing padding
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
  const encoded = searchParams.get('link') ?? '';
  const label   = searchParams.get('label') ?? 'activate';
  const decoded = decodeLink(encoded);
  const config  = LABEL_CONFIG[label] ?? LABEL_CONFIG['activate'];

  const handleContinue = () => {
    if (decoded) window.location.href = decoded;
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
          {decoded ? (
            <>
              <CardHeader>
                <CardTitle className="text-2xl font-display">{config.title}</CardTitle>
                <CardDescription>{config.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Button size="lg" className="w-full" onClick={handleContinue}>
                  {config.button} →
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
