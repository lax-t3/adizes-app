import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Plus, X, Loader2, Mail, KeyRound, Trash2, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { listAdminUsers, inviteAdmin, resendInvite, changeAdminPassword, deleteAdminUser } from "@/api/admin";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  status: "active" | "invited";
  last_sign_in: string | null;
  created_at: string;
};

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await inviteAdmin(name.trim(), email.trim());
      setSuccess(true);
      onInvited();
      setTimeout(onClose, 2000);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to send invite.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Invite Administrator</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        {success ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-3">📧</div>
            <p className="text-sm font-medium text-green-700">Invite sent! The administrator will receive an email to set their password.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="text-sm text-gray-500">An invite email will be sent. They will click a link to set their own password.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="jane@company.com"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="mr-2 h-4 w-4" />Send Invite</>}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ChangePasswordModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError("");
    setLoading(true);
    try {
      await changeAdminPassword(user.id, password);
      setSuccess(true);
      setTimeout(onClose, 2000);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
            <p className="text-sm text-gray-500">{user.name || user.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        {success ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-sm font-medium text-green-700">Password updated successfully.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [changePwUser, setChangePwUser] = useState<AdminUser | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  const fetchUsers = () => {
    setLoading(true);
    listAdminUsers()
      .then(setUsers)
      .catch(() => setError("Failed to load administrators."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  };

  const handleResend = async (user: AdminUser) => {
    setResendingId(user.id);
    try {
      await resendInvite(user.id);
      showToast(`Invite resent to ${user.email}`);
    } catch (err: any) {
      showToast(err?.response?.data?.detail ?? "Failed to resend invite.");
    } finally {
      setResendingId(null);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (!window.confirm(`Remove ${user.name || user.email} as administrator? This cannot be undone.`)) return;
    setDeletingId(user.id);
    try {
      await deleteAdminUser(user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      showToast("Administrator removed.");
    } catch (err: any) {
      showToast(err?.response?.data?.detail ?? "Failed to remove administrator.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-8">
      {showInvite && (
        <InviteModal onClose={() => setShowInvite(false)} onInvited={fetchUsers} />
      )}
      {changePwUser && (
        <ChangePasswordModal user={changePwUser} onClose={() => setChangePwUser(null)} />
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-gray-900">Administrators</h1>
            <p className="text-gray-500 mt-1">Manage who has access to this admin panel.</p>
          </div>
          <Button onClick={() => setShowInvite(true)}>
            <Plus className="mr-2 h-4 w-4" /> Invite Administrator
          </Button>
        </div>

        {toastMsg && (
          <div className="mb-6 px-4 py-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
            {toastMsg}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
        ) : (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Administrator Accounts</CardTitle>
              <CardDescription>Users with admin access to cohorts and assessment data</CardDescription>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p>No administrators yet. Invite someone to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 font-medium">Name</th>
                        <th className="px-6 py-3 font-medium">Email</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium">Last Sign-in</th>
                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900">{u.name || "—"}</td>
                          <td className="px-6 py-4">{u.email}</td>
                          <td className="px-6 py-4">
                            {u.status === "active" ? (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800">Invited</Badge>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {u.last_sign_in ? new Date(u.last_sign_in).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {u.status === "invited" && (
                                <button
                                  onClick={() => handleResend(u)}
                                  disabled={resendingId === u.id}
                                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary transition-colors whitespace-nowrap"
                                  title="Resend invite email"
                                >
                                  {resendingId === u.id
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <RefreshCw className="h-3.5 w-3.5" />
                                  }
                                  Resend
                                </button>
                              )}
                              <button
                                onClick={() => setChangePwUser(u)}
                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary transition-colors whitespace-nowrap"
                                title="Change password"
                              >
                                <KeyRound className="h-3.5 w-3.5" /> Password
                              </button>
                              <button
                                onClick={() => handleDelete(u)}
                                disabled={deletingId === u.id}
                                className="text-gray-300 hover:text-red-500 transition-colors"
                                title="Remove administrator"
                              >
                                {deletingId === u.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <Trash2 className="h-4 w-4" />
                                }
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
