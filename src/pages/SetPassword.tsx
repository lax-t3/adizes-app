import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function SetPassword() {
  const navigate = useNavigate();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenType, setTokenType] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Supabase puts the invite token in the URL hash: #access_token=...&type=invite
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");
    const type = params.get("type");
    setAccessToken(token);
    setTokenType(type);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!accessToken) { setError("Invalid or expired invite link."); return; }

    setError("");
    setLoading(true);
    try {
      await axios.post(
        `${API_URL}/auth/set-password`,
        { password },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setSuccess(true);
      setTimeout(() => navigate("/admin"), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to set password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!accessToken || tokenType !== "invite") {
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Adizes" className="h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Set Your Password</h1>
          <p className="text-sm text-gray-500 mt-1">Create a password to activate your administrator account.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {success ? (
            <div className="text-center">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Password Set!</h2>
              <p className="text-sm text-gray-500">Your account is ready. Redirecting you to login…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Min. 8 characters"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Repeat password"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : "Activate Account"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
