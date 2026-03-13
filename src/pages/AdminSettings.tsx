import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Loader2, Save, Send, RotateCcw, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "motion/react";
import {
  getSmtpConfig, saveSmtpConfig, testSmtp,
  listTemplates, getTemplate, saveTemplate, resetTemplate,
} from "@/api/settings";
import type { SmtpConfig, EmailTemplate } from "@/api/settings";

// ─── SMTP Provider presets ────────────────────────────────────────────────────

const PROVIDERS = [
  { id: "ses",    label: "AWS SES",          host: "email-smtp.us-east-1.amazonaws.com", port: 587, use_ssl: false },
  { id: "gmail",  label: "Google Workspace", host: "smtp.gmail.com",                      port: 587, use_ssl: false },
  { id: "resend", label: "Resend",           host: "smtp.resend.com",                     port: 465, use_ssl: true  },
  { id: "custom", label: "Custom SMTP",      host: "",                                    port: 587, use_ssl: false },
];

const PROVIDER_HINTS: Record<string, string> = {
  ses:    "⚠️ Do NOT use your IAM Access Key / Secret Key here. Go to AWS Console → SES → SMTP Settings → Create SMTP Credentials to generate a dedicated SMTP username and password. The SMTP password is a separately derived key (~44 chars). Also verify your sending domain/email in SES before testing.",
  gmail:  "Use your Google Workspace email and an App Password (not your account password). Enable 2FA and create an App Password under Google Account → Security.",
  resend: "Use 'resend' as username and your Resend API key as password. Port 465 with SSL.",
  custom: "Enter your SMTP server details manually.",
};

// ─── SMTP Tab ─────────────────────────────────────────────────────────────────

function SmtpTab() {
  const [cfg, setCfg] = useState<SmtpConfig>({
    provider: "custom", host: "", port: 587, username: "",
    password: "", from_email: "", from_name: "Adizes Platform", use_ssl: false,
  });
  const [passwordSet, setPasswordSet] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getSmtpConfig()
      .then(d => {
        setCfg({ ...d, password: "" });
        setPasswordSet(d.password_set);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const showMsg = (type: "success" | "error", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  };

  const applyPreset = (providerId: string) => {
    const preset = PROVIDERS.find(p => p.id === providerId);
    if (!preset) return;
    setCfg(prev => ({
      ...prev,
      provider: preset.id,
      host: preset.host || prev.host,
      port: preset.port,
      use_ssl: preset.use_ssl,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveSmtpConfig(cfg);
      if (cfg.password) setPasswordSet(true);
      showMsg("success", "SMTP settings saved successfully.");
    } catch (err: any) {
      showMsg("error", err?.response?.data?.detail ?? "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) return;
    setTesting(true);
    try {
      await testSmtp(testEmail);
      showMsg("success", `Test email sent to ${testEmail}. Check your inbox.`);
    } catch (err: any) {
      showMsg("error", err?.response?.data?.detail ?? "Test failed. Check your SMTP settings.");
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  const hint = PROVIDER_HINTS[cfg.provider];

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${
          msg.type === "success"
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-600"
        }`}>{msg.text}</div>
      )}

      {/* Provider selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Email Provider</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                cfg.provider === p.id
                  ? "border-primary bg-primary-light text-primary"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {hint && <p className="mt-2 text-xs text-gray-500">{hint}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
          <input
            type="text"
            value={cfg.host}
            onChange={e => setCfg(p => ({ ...p, host: e.target.value }))}
            className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="smtp.example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
          <input
            type="number"
            value={cfg.port}
            onChange={e => setCfg(p => ({ ...p, port: parseInt(e.target.value) || 587 }))}
            className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-3 pt-6">
          <input
            type="checkbox"
            id="use_ssl"
            checked={cfg.use_ssl}
            onChange={e => setCfg(p => ({ ...p, use_ssl: e.target.checked }))}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <label htmlFor="use_ssl" className="text-sm text-gray-700">Use SSL (not STARTTLS)</label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            type="text"
            value={cfg.username}
            onChange={e => setCfg(p => ({ ...p, username: e.target.value }))}
            className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="SMTP username"
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
            {passwordSet && !cfg.password && (
              <span className="ml-2 text-xs text-green-600 font-normal">● saved</span>
            )}
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={cfg.password}
              onChange={e => setCfg(p => ({ ...p, password: e.target.value }))}
              className="w-full h-10 rounded-md border border-gray-300 px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={passwordSet ? "Leave blank to keep saved" : "SMTP password / API key"}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
          <input
            type="text"
            value={cfg.from_name}
            onChange={e => setCfg(p => ({ ...p, from_name: e.target.value }))}
            className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Adizes Platform"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
          <input
            type="email"
            value={cfg.from_email}
            onChange={e => setCfg(p => ({ ...p, from_email: e.target.value }))}
            className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="noreply@yourcompany.com"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Settings
        </Button>
      </div>

      {/* Test email */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Send Test Email</h3>
        <div className="flex gap-2 items-center">
          <input
            type="email"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            className="flex-1 h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="your@email.com"
          />
          <Button type="button" variant="outline" onClick={handleTest} disabled={testing || !testEmail}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send Test
          </Button>
        </div>
      </div>
    </form>
  );
}

// ─── Template Editor ──────────────────────────────────────────────────────────

function TemplateEditor({ templateId, onBack }: { templateId: string; onBack: () => void }) {
  const [tmpl, setTmpl] = useState<EmailTemplate | null>(null);
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    getTemplate(templateId)
      .then(t => {
        setTmpl(t);
        setSubject(t.subject);
        setHtmlBody(t.html_body);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [templateId]);

  useEffect(() => {
    if (tab === "preview" && previewRef.current) {
      const doc = previewRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlBody);
        doc.close();
      }
    }
  }, [tab, htmlBody]);

  const showMsg = (type: "success" | "error", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveTemplate(templateId, subject, htmlBody);
      showMsg("success", "Template saved.");
    } catch (err: any) {
      showMsg("error", err?.response?.data?.detail ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Reset this template to the built-in default? Your changes will be lost.")) return;
    setResetting(true);
    try {
      await resetTemplate(templateId);
      const t = await getTemplate(templateId);
      setSubject(t.subject);
      setHtmlBody(t.html_body);
      showMsg("success", "Template reset to default.");
    } catch (err: any) {
      showMsg("error", "Failed to reset.");
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  if (!tmpl) return <p className="text-sm text-red-500">Template not found.</p>;

  return (
    <div className="space-y-4 max-w-4xl">
      <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
        ← Back to templates
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">{tmpl.name}</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={resetting}>
            {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
            Reset to Default
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </div>

      {msg && (
        <div className={`px-4 py-2 rounded text-sm ${
          msg.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"
        }`}>{msg.text}</div>
      )}

      {/* Available variables */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">Available variables</p>
        <div className="flex flex-wrap gap-1.5">
          {tmpl.variables.map(v => (
            <code
              key={v}
              className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded cursor-pointer hover:bg-primary-light hover:text-primary transition-colors"
              title="Click to copy"
              onClick={() => navigator.clipboard.writeText(`{{${v}}}`)}
            >
              {`{{${v}}}`}
            </code>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">Click any variable to copy it.</p>
      </div>

      {/* Logo tip */}
      {tmpl.variables.includes("platform_url") && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1">
          <p className="font-semibold">Logo images in email</p>
          <p>The default template uses logos hosted on your platform. Use these <code className="bg-blue-100 px-1 rounded">{"<img>"}</code> tags to reference them:</p>
          <div className="mt-1 space-y-0.5 font-mono text-[11px] text-blue-600 break-all">
            <p>{`<img src="{{platform_url}}/logo.png" alt="Adizes Institute" width="150" />`}</p>
            <p>{`<img src="{{platform_url}}/hil_blue.png" alt="HIL" width="110" />`}</p>
          </div>
          <p className="text-blue-500 mt-1">Email clients block images by default until the recipient allows them. Always include descriptive <code className="bg-blue-100 px-1 rounded">alt</code> text.</p>
        </div>
      )}

      {/* Subject */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line</label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Edit / Preview tabs */}
      <div>
        <div className="flex gap-1 mb-2 border-b border-gray-200">
          {(["edit", "preview"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
                tab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "edit" ? (
          <textarea
            value={htmlBody}
            onChange={e => setHtmlBody(e.target.value)}
            rows={12}
            spellCheck={false}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-y"
          />
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 text-xs text-gray-500">Preview (variables shown as placeholders)</div>
            <iframe
              ref={previewRef}
              title="Email preview"
              className="w-full h-[480px] bg-white"
              sandbox="allow-same-origin"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab() {
  const [templates, setTemplates] = useState<{ id: string; name: string; subject: string; variables: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    listTemplates()
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  if (editing) {
    return <TemplateEditor templateId={editing} onBack={() => setEditing(null)} />;
  }

  const TRIGGER_LABELS: Record<string, { label: string; when: string; color: string }> = {
    user_enrolled:       { label: "User Enrolled",        when: "Sent when a user is enrolled into a cohort",               color: "bg-blue-50 text-blue-700" },
    admin_invite:        { label: "Admin Invite",          when: "Sent when an administrator is invited to the platform",    color: "bg-purple-50 text-purple-700" },
    assessment_complete: { label: "Assessment Complete",   when: "Sent when a user completes their PAEI assessment (with PDF)", color: "bg-green-50 text-green-700" },
  };

  return (
    <div className="space-y-3 max-w-3xl">
      <p className="text-sm text-gray-500">Click a template to edit its subject and HTML body. Variables like <code className="bg-gray-100 px-1 rounded text-xs">{`{{user_name}}`}</code> are substituted automatically.</p>
      {templates.map(t => {
        const meta = TRIGGER_LABELS[t.id] ?? { label: t.name, when: "", color: "bg-gray-100 text-gray-700" };
        return (
          <button
            key={t.id}
            onClick={() => setEditing(t.id)}
            className="w-full text-left bg-white border border-gray-200 rounded-xl p-5 hover:border-primary hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">{t.subject}</p>
                <p className="text-xs text-gray-500 mt-0.5">{meta.when}</p>
              </div>
              <span className="text-xs text-primary font-medium flex-shrink-0 mt-1">Edit →</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AdminSettings() {
  const [tab, setTab] = useState<"smtp" | "templates">("smtp");

  return (
    <div className="p-4 sm:p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1">Configure email delivery and customise notification templates.</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-gray-200 mb-8">
          {(["smtp", "templates"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
                tab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {t === "smtp" ? "SMTP Configuration" : "Email Templates"}
            </button>
          ))}
        </div>

        {tab === "smtp" ? <SmtpTab /> : <TemplatesTab />}
      </motion.div>
    </div>
  );
}
