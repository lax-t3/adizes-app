import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Download, ArrowLeft, Users, FileText, UserPlus, X, Loader2, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { getCohort, enrollUser, removeMember, exportCohortCsv } from "@/api/admin";
import type { CohortDetailResponse } from "@/types/api";

const ROLE_COLORS: Record<string, string> = {
  P: "#C8102E",
  A: "#1D3557",
  E: "#E87722",
  I: "#2A9D8F",
};

function EnrollUserModal({
  cohortId,
  onClose,
  onEnrolled,
}: {
  cohortId: string;
  onClose: () => void;
  onEnrolled: () => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await enrollUser(cohortId, email.trim());
      onEnrolled();
      if (result?.invited) {
        setSuccessMsg(result.message);
        setTimeout(onClose, 3500);
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to enroll user.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Enroll User</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        {successMsg ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-3">📧</div>
            <p className="text-sm text-green-700 font-medium">{successMsg}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="text-sm text-gray-500">
              Enter any email address. Existing users are added immediately; new users receive an invite email to set up their account.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="user@company.com"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enroll User"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function AdminCohortDetail() {
  const { id } = useParams<{ id: string }>();
  const [cohort, setCohort] = useState<CohortDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEnroll, setShowEnroll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const fetchCohort = () => {
    if (!id) return;
    if (!UUID_RE.test(id)) {
      setError("Invalid cohort ID. Please select a cohort from the list.");
      setLoading(false);
      return;
    }
    setLoading(true);
    getCohort(id)
      .then(setCohort)
      .catch((err) => {
        const msg = err?.response?.data?.detail ?? "Failed to load cohort.";
        setError(msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCohort(); }, [id]);

  const handleRemoveMember = async (userId: string) => {
    if (!id) return;
    setRemovingId(userId);
    try {
      await removeMember(id, userId);
      setCohort(prev => prev ? { ...prev, respondents: prev.respondents.filter(r => r.user_id !== userId) } : prev);
    } catch {
      // silently fail — user stays in list
    } finally {
      setRemovingId(null);
    }
  };

  const handleExport = async () => {
    if (!id || !cohort) return;
    setExporting(true);
    try {
      await exportCohortCsv(id, cohort.name);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !cohort) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Cohort not found</h2>
          <p className="text-sm text-gray-500 mb-6">{error || "This cohort does not exist or you don't have access."}</p>
          <Link to="/admin/cohorts">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Cohorts
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Build radar data from team_scores
  const radarData = cohort.team_scores
    ? [
        { subject: "Producer (P)", is: cohort.team_scores.average_scaled.is?.P ?? 0, should: cohort.team_scores.average_scaled.should?.P ?? 0, want: cohort.team_scores.average_scaled.want?.P ?? 0, fullMark: 50 },
        { subject: "Administrator (A)", is: cohort.team_scores.average_scaled.is?.A ?? 0, should: cohort.team_scores.average_scaled.should?.A ?? 0, want: cohort.team_scores.average_scaled.want?.A ?? 0, fullMark: 50 },
        { subject: "Entrepreneur (E)", is: cohort.team_scores.average_scaled.is?.E ?? 0, should: cohort.team_scores.average_scaled.should?.E ?? 0, want: cohort.team_scores.average_scaled.want?.E ?? 0, fullMark: 50 },
        { subject: "Integrator (I)", is: cohort.team_scores.average_scaled.is?.I ?? 0, should: cohort.team_scores.average_scaled.should?.I ?? 0, want: cohort.team_scores.average_scaled.want?.I ?? 0, fullMark: 50 },
      ]
    : [];

  const distData = cohort.team_scores
    ? [
        { name: "Producer", count: cohort.team_scores.style_distribution.P ?? 0, fill: ROLE_COLORS.P },
        { name: "Administrator", count: cohort.team_scores.style_distribution.A ?? 0, fill: ROLE_COLORS.A },
        { name: "Entrepreneur", count: cohort.team_scores.style_distribution.E ?? 0, fill: ROLE_COLORS.E },
        { name: "Integrator", count: cohort.team_scores.style_distribution.I ?? 0, fill: ROLE_COLORS.I },
      ]
    : [];

  const completedCount = cohort.respondents.filter(r => r.status === "completed").length;

  return (
    <div className="p-8">
      {showEnroll && id && (
        <EnrollUserModal
          cohortId={id}
          onClose={() => setShowEnroll(false)}
          onEnrolled={fetchCohort}
        />
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mb-6">
          <Link to="/admin/cohorts" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-4 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Cohorts
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-gray-900">{cohort.name}</h1>
              {cohort.description && <p className="text-gray-500 mt-1">{cohort.description}</p>}
              <p className="text-sm text-gray-400 mt-1">
                {cohort.respondents.length} members · {completedCount} completed
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowEnroll(true)}>
                <UserPlus className="mr-2 h-4 w-4" /> Enroll User
              </Button>
              <Button variant="outline" onClick={handleExport} disabled={exporting}>
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        {cohort.team_scores && radarData.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-gray-400" /> Team Aggregate Profile
                </CardTitle>
                <CardDescription>Average scores across all completed assessments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: "#4b5563", fontSize: 12 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 50]} tick={{ fill: "#9ca3af" }} />
                      <Radar name="Is" dataKey="is" stroke="#C8102E" fill="#C8102E" fillOpacity={0.4} />
                      <Radar name="Should" dataKey="should" stroke="#1D3557" fill="#1D3557" fillOpacity={0.3} />
                      <Radar name="Want" dataKey="want" stroke="#2A9D8F" fill="#2A9D8F" fillOpacity={0.3} />
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-400" /> Style Distribution
                </CardTitle>
                <CardDescription>Dominant styles across the team</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="name" tick={{ fill: "#4b5563", fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fill: "#9ca3af" }} />
                      <Tooltip cursor={{ fill: "#f9fafb" }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                        {distData.map((entry, i) => (
                          <rect key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!cohort.team_scores && cohort.respondents.length > 0 && (
          <div className="mb-8 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
            Team charts will appear once at least one member completes the assessment.
          </div>
        )}

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Respondents</CardTitle>
              <CardDescription>Individual assessment status and results</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowEnroll(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Add
            </Button>
          </CardHeader>
          <CardContent>
            {cohort.respondents.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No members yet. Click "Enroll User" to add someone.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 font-medium">Name</th>
                      <th className="px-6 py-3 font-medium">Email</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Dominant Style</th>
                      <th className="px-6 py-3 font-medium">Completed</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohort.respondents.map((r) => (
                      <tr key={r.user_id} className="bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{r.name || "—"}</td>
                        <td className="px-6 py-4">{r.email}</td>
                        <td className="px-6 py-4">
                          {r.status === "completed" ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800">Pending</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono font-medium">{r.dominant_style || "—"}</td>
                        <td className="px-6 py-4">
                          {r.completed_at ? new Date(r.completed_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-6 py-4 text-right flex items-center justify-end gap-3">
                          {r.status === "completed" && (
                            <Link to={`/admin/respondents/${r.user_id}`} className="font-medium text-primary hover:text-primary-dark text-sm">
                              View Results
                            </Link>
                          )}
                          <button
                            onClick={() => handleRemoveMember(r.user_id)}
                            disabled={removingId === r.user_id}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                            title="Remove from cohort"
                          >
                            {removingId === r.user_id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Trash2 className="h-4 w-4" />
                            }
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
