import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Users, FileText, Activity, Plus, X, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { getStats, inviteAdmin } from "@/api/admin";

type Stats = {
  total_cohorts: number;
  total_assessments: number;
  completed_assessments: number;
  completion_pct: number;
  recent_completions: { user_id: string; user_name: string; completed_at: string }[];
};

function InviteAdminModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await inviteAdmin(name, email, password);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to create admin user.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Add Administrator</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
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
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Admin"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchStats = () => {
    setLoading(true);
    getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStats(); }, []);

  const handleAdminCreated = () => {
    setSuccessMsg("Admin user created successfully.");
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="p-8">
      {showInvite && (
        <InviteAdminModal
          onClose={() => setShowInvite(false)}
          onSuccess={handleAdminCreated}
        />
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-display font-bold text-gray-900">Admin Dashboard</h1>
          <Button onClick={() => setShowInvite(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Administrator
          </Button>
        </div>

        {successMsg && (
          <div className="mb-6 px-4 py-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
            {successMsg}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-3 mb-8">
              <Card className="border-l-4 border-l-primary shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Total Cohorts</CardTitle>
                  <Users className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{stats?.total_cohorts ?? 0}</div>
                  <Link to="/admin/cohorts" className="text-xs text-primary hover:underline mt-1 block">
                    Manage cohorts →
                  </Link>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Total Assessments</CardTitle>
                  <FileText className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{stats?.total_assessments ?? 0}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats?.completed_assessments ?? 0} completed
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Completion Rate</CardTitle>
                  <Activity className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{stats?.completion_pct ?? 0}%</div>
                  <p className="text-xs text-gray-500 mt-1">across all assessments</p>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Recent Completions</CardTitle>
              </CardHeader>
              <CardContent>
                {!stats?.recent_completions?.length ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No completed assessments yet.</p>
                ) : (
                  <div className="space-y-4">
                    {stats.recent_completions.map((item, i) => (
                      <div key={i} className="flex items-center justify-between border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                            {(item.user_name || "U").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {item.user_name || "Anonymous user"}
                            </p>
                            <p className="text-xs text-gray-500">completed assessment</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">{formatTime(item.completed_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </motion.div>
    </div>
  );
}
