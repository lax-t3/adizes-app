import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2, Save, KeyRound, User, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { useAuthStore } from "@/store/authStore";
import { getProfile, updateProfile, changePassword } from "@/api/profile";

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({
  id, label, type = "text", value, onChange, placeholder, required, hint,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
      />
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onDismiss }: { msg: string; type: "success" | "error"; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm border ${
        type === "success"
          ? "bg-green-50 border-green-200 text-green-800"
          : "bg-red-50 border-red-200 text-red-700"
      }`}
    >
      {type === "success" && <CheckCircle2 className="h-4 w-4 flex-shrink-0" />}
      <span className="flex-1">{msg}</span>
      <button onClick={onDismiss} className="ml-2 opacity-50 hover:opacity-100 text-lg leading-none">×</button>
    </motion.div>
  );
}

// ─── Personal Info section ────────────────────────────────────────────────────

function PersonalInfoSection() {
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getProfile()
      .then(p => {
        setName(p.name);
        setEmail(p.email);
        setPhone(p.phone ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateProfile({ name: name.trim(), email: email.trim(), phone: phone.trim() || null });
      updateUser({ name: updated.name, email: updated.email, phone: updated.phone ?? undefined });
      setMsg({ type: "success", text: "Profile updated successfully." });
    } catch (err: any) {
      setMsg({ type: "error", text: err?.response?.data?.detail ?? "Failed to update profile." });
    } finally {
      setSaving(false);
    }
  };

  const initials = name
    .split(" ")
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Avatar */}
      <div className="flex flex-wrap items-center gap-4 pb-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white text-xl font-bold select-none flex-shrink-0">
          {initials}
        </div>
        <div>
          <p className="font-semibold text-gray-900">{name || "Your Name"}</p>
          <p className="text-sm text-gray-500">{email}</p>
        </div>
      </div>

      {msg && (
        <Toast msg={msg.text} type={msg.type} onDismiss={() => setMsg(null)} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field
            id="name"
            label="Full Name"
            value={name}
            onChange={setName}
            placeholder="Your full name"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Field
            id="email"
            label="Email Address"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            required
            hint="Changing your email may require re-verification."
          />
        </div>
        <div className="sm:col-span-2">
          <Field
            id="phone"
            label="Mobile Number"
            type="tel"
            value={phone}
            onChange={setPhone}
            placeholder="+91 98765 43210"
            hint="Optional. Used for notifications only."
          />
        </div>
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}

// ─── Change Password section ──────────────────────────────────────────────────

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const strength = next.length === 0 ? null
    : next.length < 8 ? "weak"
    : /[A-Z]/.test(next) && /[0-9]/.test(next) ? "strong"
    : "medium";

  const strengthColor = { weak: "bg-red-400", medium: "bg-amber-400", strong: "bg-green-500" }[strength ?? "weak"];
  const strengthWidth = { weak: "w-1/3", medium: "w-2/3", strong: "w-full" }[strength ?? "weak"];
  const strengthLabel = { weak: "Weak", medium: "Medium", strong: "Strong" }[strength ?? "weak"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setMsg({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (next.length < 8) {
      setMsg({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }
    setSaving(true);
    try {
      await changePassword(current, next);
      setMsg({ type: "success", text: "Password changed successfully." });
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err: any) {
      setMsg({ type: "error", text: err?.response?.data?.detail ?? "Failed to change password." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {msg && <Toast msg={msg.text} type={msg.type} onDismiss={() => setMsg(null)} />}

      {/* Current password */}
      <div>
        <label htmlFor="current-pw" className="block text-sm font-medium text-gray-700 mb-1">
          Current Password <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <input
            id="current-pw"
            type={showCurrent ? "text" : "password"}
            required
            value={current}
            onChange={e => setCurrent(e.target.value)}
            placeholder="Your current password"
            className="w-full h-10 rounded-md border border-gray-300 px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowCurrent(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* New password */}
      <div>
        <label htmlFor="new-pw" className="block text-sm font-medium text-gray-700 mb-1">
          New Password <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <input
            id="new-pw"
            type={showNext ? "text" : "password"}
            required
            minLength={8}
            value={next}
            onChange={e => setNext(e.target.value)}
            placeholder="Min. 8 characters"
            className="w-full h-10 rounded-md border border-gray-300 px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowNext(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {/* Strength meter */}
        {strength && (
          <div className="mt-2 space-y-1">
            <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${strengthColor} ${strengthWidth}`} />
            </div>
            <p className={`text-xs font-medium ${
              strength === "weak" ? "text-red-500" : strength === "medium" ? "text-amber-500" : "text-green-600"
            }`}>{strengthLabel}</p>
          </div>
        )}
      </div>

      {/* Confirm new password */}
      <div>
        <label htmlFor="confirm-pw" className="block text-sm font-medium text-gray-700 mb-1">
          Confirm New Password <span className="text-red-400">*</span>
        </label>
        <input
          id="confirm-pw"
          type="password"
          required
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Repeat new password"
          className={`w-full h-10 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-colors ${
            confirm && confirm !== next ? "border-red-300 focus:ring-red-400" : "border-gray-300"
          }`}
          autoComplete="new-password"
        />
        {confirm && confirm !== next && (
          <p className="mt-1 text-xs text-red-500">Passwords do not match.</p>
        )}
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
          Change Password
        </Button>
      </div>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Profile() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-3xl font-display font-bold text-gray-900">My Profile</h1>
            <p className="text-gray-500 mt-1">Manage your account details and security settings.</p>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-gray-400" /> Personal Information
              </CardTitle>
              <CardDescription>Update your name, email and mobile number.</CardDescription>
            </CardHeader>
            <CardContent>
              <PersonalInfoSection />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-gray-400" /> Change Password
              </CardTitle>
              <CardDescription>Choose a strong password you don't use elsewhere.</CardDescription>
            </CardHeader>
            <CardContent>
              <PasswordSection />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
