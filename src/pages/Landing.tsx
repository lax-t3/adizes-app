import React, { useState, useEffect } from "react";
import { useNavigate, Link, useLocation, useSearchParams } from "react-router-dom";
import { Footer } from "@/components/layout/Footer";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { CheckCircle2, Clock, FileText } from "lucide-react";
import { motion } from "motion/react";
import { login as apiLogin } from "@/api/auth";

export function Landing() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const loginStore = useAuthStore((state) => state.login);

  const isAdminRoute = location.pathname === "/admin";
  const [searchParams] = useSearchParams();
  // Capture once into state so we can clear the URL without losing the banner
  const [showPasswordUpdated] = useState(
    () => searchParams.get('message') === 'password-updated'
  );
  // Clear the ?message query param from the URL after reading it
  useEffect(() => {
    if (showPasswordUpdated) {
      // Clear ?message=password-updated from URL so it doesn't reappear on refresh
      navigate('/', { replace: true });
    }
  }, [navigate, showPasswordUpdated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiLogin(email, password);
      loginStore(
        { id: data.user_id, email: data.email, name: data.name },
        data.role,
        data.access_token,
      );
      navigate(data.role === "admin" ? "/admin/dashboard" : "/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left side - Hero */}
      <div className="hidden lg:flex lg:w-[55%] flex-col justify-between bg-gray-950 p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-40">
          <img 
            src="https://picsum.photos/seed/corporate/1920/1080?blur=2" 
            alt="Corporate background" 
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950/90 to-gray-950/40" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <img
              src="/logo.png"
              alt="Adizes Institute"
              className="h-14 w-auto brightness-0 invert"
              referrerPolicy="no-referrer"
            />
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-xl"
          >
            <h1 className="font-display text-5xl font-medium leading-[1.1] tracking-tight mb-6">
              {isAdminRoute ? "Manage assessments and cohorts." : "Discover your management style."}
            </h1>
            <p className="text-xl text-gray-300 font-light leading-relaxed mb-12">
              {isAdminRoute 
                ? "Access the admin dashboard to view cohort results, manage users, and export data."
                : "The Adizes Management Style Indicator (AMSI) helps you understand your natural tendencies, job demands, and inner preferences."}
            </p>

            {!isAdminRoute && (
              <div className="space-y-6">
                {[
                  { icon: FileText, text: "36 comprehensive questions" },
                  { icon: Clock, text: "Takes only 15 minutes" },
                  { icon: CheckCircle2, text: "Instant personalized results" }
                ].map((feature, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                    className="flex items-center gap-4 text-gray-200"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
                      <feature.icon className="h-5 w-5 text-primary-light" />
                    </div>
                    <span className="text-lg font-medium">{feature.text}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
        
        <div className="relative z-10 space-y-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <Link to="/terms" className="hover:text-gray-300 transition-colors">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-gray-300 transition-colors">Privacy Policy</Link>
            <Link to="/refund" className="hover:text-gray-300 transition-colors">Refund Policy</Link>
          </div>
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Adizes Institute &middot; Powered by <span className="text-gray-400 font-medium">Turiyaskills</span>
          </p>
        </div>
      </div>

      {/* Right side - Auth */}
      <div className="flex w-full lg:w-[45%] flex-col items-center justify-center min-h-screen p-6 sm:p-8 lg:p-16 pb-safe">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex flex-col items-center gap-4 mb-12">
            <img src="/logo.png" alt="Adizes Institute" className="h-16 w-auto" referrerPolicy="no-referrer" />
            <img src="/hil_blue.png" alt="Heartfulness Institute of Leadership" className="h-10 w-auto opacity-90" referrerPolicy="no-referrer" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="border-0 shadow-none bg-transparent">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-3xl font-display mb-2">
                  {isAdminRoute ? "Admin Login" : "Welcome back"}
                </CardTitle>
                <CardDescription className="text-base">
                  {isAdminRoute ? "Sign in to access the admin dashboard." : "Sign in to access your assessment and results."}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {showPasswordUpdated && (
                  <div role="alert" className="mb-5 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                    Your password has been updated. Please log in.
                  </div>
                )}
                <form onSubmit={handleLogin} className="space-y-5">
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
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-900" htmlFor="password">
                        Password
                      </label>
                      <Link to="/forgot-password" className="text-sm font-medium text-primary hover:text-primary-dark">
                        Forgot password?
                      </Link>
                    </div>
                    <input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      {error}
                    </p>
                  )}
                  <Button type="submit" disabled={loading} className="w-full h-11 text-base mt-2">
                    {loading ? "Signing in…" : "Sign In"}
                  </Button>
                </form>

                {!isAdminRoute && (
                  <div className="mt-8 text-center text-sm text-gray-500">
                    Don't have an account?{" "}
                    <Link to="/register" className="font-medium text-primary hover:text-primary-dark">
                      Register here
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <div className="mt-10 text-center">
            {isAdminRoute ? (
              <Link to="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                &larr; Back to User Login
              </Link>
            ) : (
              <Link to="/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Administrator? Sign in here &rarr;
              </Link>
            )}
          </div>
        </div>

        {/* Footer on right panel */}
        <div className="w-full max-w-md mt-10">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-400 mb-2">
            <Link to="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
            <span className="text-gray-200">·</span>
            <Link to="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
            <span className="text-gray-200">·</span>
            <Link to="/refund" className="hover:text-gray-600 transition-colors">Refund Policy</Link>
          </div>
          <p className="text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Adizes Institute &middot; Powered by <span className="font-medium text-gray-500">Turiyaskills</span>
          </p>
          <div className="mt-5 flex justify-center">
            <img src="/hil_blue.png" alt="Heartfulness Institute of Leadership" className="h-12 w-auto opacity-90" referrerPolicy="no-referrer" />
          </div>
        </div>
      </div>
    </div>
  );
}
