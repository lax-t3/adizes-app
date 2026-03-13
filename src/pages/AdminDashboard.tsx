import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Users, FileText, Activity, Plus, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { getStats } from "@/api/admin";

type Stats = {
  total_cohorts: number;
  total_assessments: number;
  completed_assessments: number;
  completion_pct: number;
  recent_completions: { user_id: string; user_name: string; completed_at: string }[];
};

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="p-4 sm:p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <h1 className="text-3xl font-display font-bold text-gray-900">Admin Dashboard</h1>
          <Link to="/admin/users">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Manage Administrators
            </Button>
          </Link>
        </div>

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
                      <div key={i} className="flex items-start gap-3 border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                        <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                          {(item.user_name || "U").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.user_name || "Anonymous user"}
                          </p>
                          <p className="text-xs text-gray-500">completed assessment</p>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(item.completed_at)}</span>
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
