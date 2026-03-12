import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { GapBadge } from "@/components/ui/GapBadge";
import { ArrowLeft, Download, Info, Loader2 } from "lucide-react";
import { Users, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { motion } from "motion/react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { getRespondent } from "@/api/admin";
import { downloadPdf } from "@/api/results";
import type { GapDetail, Interpretation, ScoreSet } from "@/types/api";

interface RespondentData {
  user: { id: string; email: string; name: string };
  result: {
    id: string;
    user_name: string;
    completed_at: string;
    profile: { is: string; should: string; want: string };
    scaled_scores: { is: ScoreSet; should: ScoreSet; want: ScoreSet };
    gaps: GapDetail[];
    interpretation: Interpretation;
  };
}

export function AdminRespondent() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<RespondentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      setError("No respondent ID provided.");
      setLoading(false);
      return;
    }
    getRespondent(id)
      .then(setData)
      .catch(() => setError("Failed to load respondent data."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownloadPdf = async () => {
    if (!data) return;
    setPdfLoading(true);
    try {
      await downloadPdf(data.result.id, data.user.name || data.user.email);
    } catch {
      // silent — user can retry
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading respondent results…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <Link to="/admin/cohorts" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-4 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Cohorts
        </Link>
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-red-600 font-medium">{error || "Respondent not found."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { user, result } = data;
  const { scaled_scores, gaps, profile, interpretation } = result;

  const radarData = (["P", "A", "E", "I"] as const).map((role) => ({
    subject: { P: "Producer (P)", A: "Administrator (A)", E: "Entrepreneur (E)", I: "Integrator (I)" }[role],
    is: scaled_scores.is[role],
    should: scaled_scores.should[role],
    want: scaled_scores.want[role],
    fullMark: 50,
  }));

  const gapChartData = gaps.map((g) => ({
    name: g.role_name,
    is: g.is_score,
    should: g.should_score,
    gap: g.external_gap,
  }));

  const profileBadges = (profile.want ?? "paei").split("").map((char) => {
    const role = char.toUpperCase() as "P" | "A" | "E" | "I";
    const isDominant = char === char.toUpperCase();
    return { role, char, isDominant };
  });

  const displayName = user.name || result.user_name || user.email;

  return (
    <div className="p-8 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-6">
          <Link to="/admin/cohorts" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-4 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Cohorts
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-gray-900">
                {displayName}
              </h1>
              <p className="text-gray-500 mt-1">
                {user.email} · Completed {new Date(result.completed_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-1.5">
                {profileBadges.map(({ role, char, isDominant }) =>
                  isDominant ? (
                    <Badge key={role} variant={role} className="text-lg px-2 py-0.5">{char}</Badge>
                  ) : (
                    <Badge key={role} variant="outline" className="text-lg px-2 py-0.5 bg-gray-100">{char}</Badge>
                  )
                )}
              </div>
              <Button variant="outline" onClick={handleDownloadPdf} disabled={pdfLoading}>
                {pdfLoading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
                  : <><Download className="mr-2 h-4 w-4" /> PDF Report</>
                }
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Radar Chart */}
          <Card className="h-full shadow-sm border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Style Comparison <Info className="h-4 w-4 text-gray-400" />
              </CardTitle>
              <CardDescription>
                Visual representation of Is, Should, and Want profiles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "#4b5563", fontSize: 12, fontWeight: 500 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 50]} tick={{ fill: "#9ca3af" }} />
                    <Radar name="Is" dataKey="is" stroke="#C8102E" fill="#C8102E" fillOpacity={0.4} />
                    <Radar name="Should" dataKey="should" stroke="#1D3557" fill="#1D3557" fillOpacity={0.4} />
                    <Radar name="Want" dataKey="want" stroke="#E87722" fill="#E87722" fillOpacity={0.4} />
                    <Legend wrapperStyle={{ paddingTop: "20px" }} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Gap Analysis */}
          <Card className="h-full shadow-sm">
            <CardHeader>
              <CardTitle>Gap Analysis</CardTitle>
              <CardDescription>
                Differences between current behavior (Is) and job demands (Should).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gapChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" domain={[0, 50]} tick={{ fill: "#9ca3af" }} />
                    <YAxis dataKey="name" type="category" tick={{ fill: "#4b5563", fontSize: 12, fontWeight: 500 }} width={100} />
                    <Tooltip cursor={{ fill: "#f9fafb" }} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                    <Legend />
                    <Bar dataKey="is" name="Is" fill="#C8102E" radius={[0, 4, 4, 0]} barSize={16} />
                    <Bar dataKey="should" name="Should" fill="#1D3557" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 text-sm uppercase tracking-wider mb-4">Gap Severity</h4>
                {gaps.map((g) => (
                  <div key={g.role} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <span className="font-medium text-gray-700">{g.role_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Ext: <GapBadge gap={g.external_gap} /></span>
                      <span className="text-xs text-gray-500">Int: <GapBadge gap={g.internal_gap} /></span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Interpretation */}
          <div className="lg:col-span-2">
            <Card className="shadow-sm bg-white overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3 mb-1">
                  <span className="inline-block bg-primary text-white text-sm font-bold px-3 py-1 rounded-full">
                    {interpretation.style_label}
                  </span>
                  <span className="text-gray-500 italic text-sm">{interpretation.style_tagline}</span>
                </div>
                <CardTitle className="text-2xl font-display">Style Interpretation</CardTitle>
                {interpretation.combined_description && (
                  <CardDescription className="text-base">{interpretation.combined_description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid gap-8 md:grid-cols-3">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-700 font-medium">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      Strengths
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{interpretation.strengths}</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-amber-700 font-medium">
                      <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <Info className="h-5 w-5" />
                      </div>
                      Blind Spots
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{interpretation.blind_spots}</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-blue-700 font-medium">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="h-5 w-5" />
                      </div>
                      Working with Others
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{interpretation.working_with_others}</p>
                  </div>
                </div>

                {interpretation.mismanagement_risks.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Mismanagement Risk Under Stress
                    </h4>
                    <div className="space-y-2">
                      {interpretation.mismanagement_risks.map((risk, i) => (
                        <div key={i} className="bg-red-50 border-l-4 px-4 py-2 rounded-r-md text-sm text-gray-700">
                          {risk}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
