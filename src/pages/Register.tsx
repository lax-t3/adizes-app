import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { motion } from "motion/react";
import { register as apiRegister, setPassword, saveInviteProfile } from "@/api/auth";
import { decodeJwt } from "@/lib/jwt";
import { Footer } from "@/components/layout/Footer";

// Parse invite/recovery token from URL hash synchronously at module evaluation time
// so that mode detection is available on the very first render (no flash).
function parseInviteHash() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get("access_token");
  const type = params.get("type");
  if (token && (type === "invite" || type === "recovery")) {
    const decoded = decodeJwt(token);
    const meta = (decoded.user_metadata ?? {}) as Record<string, unknown>;
    return {
      token,
      name: typeof meta.name === "string" ? meta.name : "",
      email: typeof decoded.email === "string" ? decoded.email : "",
    };
  }
  return null;
}

export function Register() {
  // ── Activate mode — computed once from hash, never changes ───────────
  const [inviteHash] = useState(parseInviteHash);  // lazy initializer: runs once
  const activateMode = inviteHash !== null;
  const accessToken = inviteHash?.token ?? null;

  // ── Normal mode state ────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPasswordInput] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const loginStore = useAuthStore((state) => state.login);

  // ── Activate mode state ──────────────────────────────────────────────
  const [activateName, setActivateName] = useState(inviteHash?.name ?? "");
  const [activateEmail] = useState(inviteHash?.email ?? "");
  const [activatePassword, setActivatePassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");  // not `confirm` — shadows window.confirm
  const [termsActivate, setTermsActivate] = useState(false);
  const [activateError, setActivateError] = useState("");
  const [activateLoading, setActivateLoading] = useState(false);
  const [activateSuccess, setActivateSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiRegister(name, email, password);
      loginStore(
        { id: data.user_id, email: data.email, name: data.name },
        data.role,
        data.access_token,
      );
      navigate("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activatePassword.length < 8) {
      setActivateError("Password must be at least 8 characters.");
      return;
    }
    if (activatePassword !== confirmPassword) {
      setActivateError("Passwords do not match.");
      return;
    }

    setActivateError("");
    setActivateLoading(true);
    try {
      await setPassword(accessToken!, activatePassword);

      if (activateName.trim() && activateEmail) {
        try {
          await saveInviteProfile(accessToken!, activateName.trim(), activateEmail);
        } catch {
          // non-fatal — password already set
        }
      }

      setActivateSuccess(true);
      setTimeout(() => window.location.replace("/"), 2000);
    } catch (err: any) {
      setActivateError(
        err?.response?.data?.detail ?? "Failed to activate account. The link may have expired."
      );
    } finally {
      setActivateLoading(false);
    }
  };

  // Invalid invite link — token present in hash but wrong/missing type (checked synchronously, no flash)
  if (window.location.hash.includes("access_token") && !activateMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid Invite Link</h1>
          <p className="text-sm text-gray-500">
            This invite link is invalid or has expired. Please ask your administrator to resend the invite.
          </p>
        </div>
      </div>
    );
  }

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

        {activateMode ? (
          /* ── ACTIVATE MODE ─────────────────────────────────────── */
          <Card className="shadow-lg border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="text-2xl font-display">Activate Your Account</CardTitle>
              <CardDescription>Set your name and password to get started.</CardDescription>
            </CardHeader>
            <CardContent>
              {activateSuccess ? (
                <div className="text-center py-4">
                  <div className="text-5xl mb-4">✅</div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Account Activated!</h2>
                  <p className="text-sm text-gray-500">Your account is ready. Redirecting to login…</p>
                </div>
              ) : (
                <form onSubmit={handleActivate} className="space-y-5">
                  {/* Email — read-only, shown only if decoded from token */}
                  {activateEmail && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-900" htmlFor="activate-email">
                        Email address
                      </label>
                      <input
                        id="activate-email"
                        type="email"
                        readOnly
                        value={activateEmail}
                        className="flex h-11 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                      />
                    </div>
                  )}

                  {/* Full Name — editable, pre-filled from JWT user_metadata */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900" htmlFor="activate-name">
                      Full Name
                    </label>
                    <input
                      id="activate-name"
                      type="text"
                      required
                      value={activateName}
                      onChange={(e) => setActivateName(e.target.value)}
                      className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="Your full name"
                      autoFocus={!activateName}
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900" htmlFor="activate-password">
                      Password
                    </label>
                    <input
                      id="activate-password"
                      type="password"
                      required
                      minLength={8}
                      value={activatePassword}
                      onChange={(e) => setActivatePassword(e.target.value)}
                      className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="Min. 8 characters"
                      autoFocus={!!activateName}
                    />
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900" htmlFor="activate-confirm">
                      Confirm Password
                    </label>
                    <input
                      id="activate-confirm"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="Repeat password"
                    />
                  </div>

                  {/* Terms */}
                  <div className="flex items-start gap-3 pt-1">
                    <input
                      id="activate-terms"
                      type="checkbox"
                      required
                      checked={termsActivate}
                      onChange={(e) => setTermsActivate(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary flex-shrink-0"
                    />
                    <label htmlFor="activate-terms" className="text-sm text-gray-500 leading-relaxed">
                      I agree to the{" "}
                      <Link to="/terms" target="_blank" className="text-primary hover:underline font-medium">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link to="/privacy" target="_blank" className="text-primary hover:underline font-medium">
                        Privacy Policy
                      </Link>
                    </label>
                  </div>

                  {activateError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      {activateError}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={activateLoading || !termsActivate}
                    className="w-full h-11 text-base mt-2"
                  >
                    {activateLoading ? "Activating…" : "Activate Account"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ) : (
          /* ── NORMAL MODE (unchanged) ───────────────────────────── */
          <Card className="shadow-lg border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="text-2xl font-display">Create an account</CardTitle>
              <CardDescription>
                Enter your details to register for the assessment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900" htmlFor="name">
                    Full Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="John Doe"
                  />
                </div>
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
                    className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="name@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <div className="flex items-start gap-3 pt-1">
                  <input
                    id="terms"
                    type="checkbox"
                    required
                    checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary flex-shrink-0"
                  />
                  <label htmlFor="terms" className="text-sm text-gray-500 leading-relaxed">
                    I agree to the{" "}
                    <Link to="/terms" target="_blank" className="text-primary hover:underline font-medium">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link to="/privacy" target="_blank" className="text-primary hover:underline font-medium">
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {error}
                  </p>
                )}
                <Button type="submit" disabled={loading || !termsAccepted} className="w-full h-11 text-base mt-2">
                  {loading ? "Creating account…" : "Register"}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-gray-500">
                Already have an account?{" "}
                <Link to="/" className="font-medium text-primary hover:text-primary-dark">
                  Sign in
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Footer — only shown in Normal mode (not Activate mode) */}
      {!activateMode && (
        <div className="w-full mt-8">
          <Footer />
        </div>
      )}
    </div>
  );
}
