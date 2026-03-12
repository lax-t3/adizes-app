/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useAssessmentStore } from "@/store/assessmentStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { GapBadge } from "@/components/ui/GapBadge";
import { Button } from "@/components/ui/Button";
import {
  Download, Info, Loader2, FileText, ArrowRight, CheckCircle2,
  Users, ClipboardList, LayoutDashboard, Clock, PlayCircle,
} from "lucide-react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { motion } from "motion/react";
import { getResult, downloadPdf, getMyAssessments } from "@/api/results";
import type { ResultResponse, MyAssessmentItem } from "@/types/api";

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = "dashboard" | "my-assessments";

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "my-assessments", label: "My Assessments", icon: <ClipboardList className="h-4 w-4" /> },
  ];
  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-8">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            active === t.id
              ? "bg-white shadow-sm text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Results dashboard (embedded) ─────────────────────────────────────────────

function ResultsDashboard({ resultId }: { resultId: string }) {
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getResult(resultId)
      .then(setResult)
      .catch(() => setError("Failed to load results."))
      .finally(() => setLoading(false));
  }, [resultId]);

  const handleDownloadPdf = async () => {
    if (!result) return;
    setPdfLoading(true);
    try {
      await downloadPdf(resultId, result.user_name);
    } catch {
      // silent
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-red-600">{error || "Results not available."}</p>
        </CardContent>
      </Card>
    );
  }

  const { profile, scaled_scores, gaps, interpretation } = result;

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

  return (
    <div className="space-y-8 pb-8">
      {/* Header band */}
      <div className="bg-gray-900 text-white rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-2xl font-display font-bold tracking-tight mb-1">
              {result.user_name}'s Results
            </h2>
            <p className="text-gray-400">
              Completed on {new Date(result.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-4 bg-gray-800/60 px-4 py-3 rounded-xl border border-gray-700">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Dominant Style</span>
            <div className="flex gap-1.5">
              {profileBadges.map(({ role, char, isDominant }) =>
                isDominant ? (
                  <Badge key={role} variant={role} className="text-lg px-3 py-1 shadow-sm">
                    {char}
                  </Badge>
                ) : (
                  <Badge key={role} variant="outline" className="text-lg px-3 py-1 bg-gray-800 text-gray-300 border-gray-600">
                    {char}
                  </Badge>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Radar */}
        <Card className="shadow-sm border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Style Comparison <Info className="h-4 w-4 text-gray-400" />
            </CardTitle>
            <CardDescription>Visual representation of your Is, Should, and Want profiles.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="99%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#4b5563", fontSize: 11, fontWeight: 500 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 50]} tick={{ fill: "#9ca3af" }} />
                  <Radar name="Is" dataKey="is" stroke="#C8102E" fill="#C8102E" fillOpacity={0.4} />
                  <Radar name="Should" dataKey="should" stroke="#1D3557" fill="#1D3557" fillOpacity={0.4} />
                  <Radar name="Want" dataKey="want" stroke="#E87722" fill="#E87722" fillOpacity={0.4} />
                  <Legend wrapperStyle={{ paddingTop: "16px" }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gap Analysis */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Gap Analysis</CardTitle>
            <CardDescription>Differences between your current behavior (Is) and job demands (Should).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full mb-4">
              <ResponsiveContainer width="99%" height="100%">
                <BarChart data={gapChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" domain={[0, 50]} tick={{ fill: "#9ca3af" }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "#4b5563", fontSize: 12, fontWeight: 500 }} width={100} />
                  <Tooltip cursor={{ fill: "#f9fafb" }} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                  <Legend />
                  <Bar dataKey="is" name="Is" fill="#C8102E" radius={[0, 4, 4, 0]} barSize={14} />
                  <Bar dataKey="should" name="Should" fill="#1D3557" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 text-xs uppercase tracking-wider mb-3">Gap Severity</h4>
              {gaps.map((g) => (
                <div key={g.role} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="font-medium text-gray-700 text-sm">{g.role_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Ext: <GapBadge gap={g.external_gap} /></span>
                    <span className="text-xs text-gray-500">Int: <GapBadge gap={g.internal_gap} /></span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interpretation */}
      <Card className="shadow-sm bg-white overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3 mb-1">
            <span className="inline-block bg-primary text-white text-sm font-bold px-3 py-1 rounded-full">
              {interpretation.style_label}
            </span>
            <span className="text-gray-500 italic text-sm">{interpretation.style_tagline}</span>
          </div>
          <CardTitle className="text-xl font-display">Style Interpretation</CardTitle>
          {interpretation.combined_description && (
            <CardDescription className="text-base">{interpretation.combined_description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                <div className="h-7 w-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                Strengths
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">{interpretation.strengths}</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
                <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Info className="h-4 w-4" />
                </div>
                Blind Spots
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">{interpretation.blind_spots}</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-blue-700 font-medium text-sm">
                <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Users className="h-4 w-4" />
                </div>
                Working with Others
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">{interpretation.working_with_others}</p>
            </div>
          </div>

          {interpretation.mismanagement_risks.length > 0 && (
            <div className="mt-6 pt-5 border-t border-gray-100">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Mismanagement Risk Under Stress
              </h4>
              <div className="space-y-2">
                {interpretation.mismanagement_risks.map((risk, i) => (
                  <div key={i} className="bg-red-50 border-l-4 border-red-400 px-4 py-2 rounded-r-md text-sm text-gray-700">
                    {risk}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Download PDF */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
          className="shadow-md hover:shadow-lg transition-all"
        >
          {pdfLoading
            ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating…</>
            : <><Download className="mr-2 h-5 w-5" /> Download Full Report (PDF)</>
          }
        </Button>
      </div>
    </div>
  );
}

// ─── No-assessment CTA ────────────────────────────────────────────────────────

function NoAssessmentCTA({ hasEnrollments }: { hasEnrollments: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mb-6">
        <FileText className="h-10 w-10 text-gray-400" />
      </div>
      {hasEnrollments ? (
        <>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to begin your assessment?</h3>
          <p className="text-gray-500 max-w-sm mb-6">
            You're enrolled in an assessment cohort. Complete your AMSI assessment to see your PAEI dashboard here.
          </p>
          <Button onClick={() => navigate("/assessment")}>
            Start Assessment <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No assessment yet</h3>
          <p className="text-gray-500 max-w-sm">
            You haven't been enrolled in any cohort yet. Contact your administrator to get enrolled.
          </p>
        </>
      )}
    </div>
  );
}

// ─── My Assessments tab ───────────────────────────────────────────────────────

function MyAssessmentsTab({
  items,
  loading,
}: {
  items: MyAssessmentItem[];
  loading: boolean;
}) {
  const navigate = useNavigate();
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);

  const handleDownload = async (item: MyAssessmentItem) => {
    if (!item.result_id) return;
    setPdfLoading(item.cohort_id);
    try {
      await downloadPdf(item.result_id, item.cohort_name);
    } catch {
      // silent
    } finally {
      setPdfLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-5">
          <ClipboardList className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No assessments enrolled</h3>
        <p className="text-gray-500 text-sm max-w-xs">
          Contact your administrator to be enrolled in a cohort.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <motion.div
          key={item.cohort_id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                    item.status === "completed"
                      ? "bg-green-100"
                      : "bg-amber-100"
                  }`}>
                    {item.status === "completed"
                      ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                      : <Clock className="h-5 w-5 text-amber-600" />
                    }
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{item.cohort_name}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <StatusBadge status={item.status} />
                      {item.completed_at && (
                        <span className="text-xs text-gray-400">
                          Completed {new Date(item.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                      {item.dominant_style && (
                        <span className="text-xs text-gray-500 font-medium">
                          Style: <span className="text-gray-700 font-bold">{item.dominant_style}</span>
                        </span>
                      )}
                      {item.enrolled_at && (
                        <span className="text-xs text-gray-400">
                          Enrolled {new Date(item.enrolled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:flex-shrink-0">
                  {item.status === "completed" && item.result_id ? (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/results?id=${item.result_id}`)}
                      >
                        View Dashboard
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleDownload(item)}
                        disabled={pdfLoading === item.cohort_id}
                      >
                        {pdfLoading === item.cohort_id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <><Download className="mr-1.5 h-3.5 w-3.5" /> PDF</>
                        }
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => navigate("/assessment")}>
                      <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                      Start
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: MyAssessmentItem["status"] }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="h-3 w-3" /> Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
      <Clock className="h-3 w-3" /> Yet to start
    </span>
  );
}

// ─── Dashboard page ────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user } = useAuthStore();
  const { resultId } = useAssessmentStore();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [myAssessments, setMyAssessments] = useState<MyAssessmentItem[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(true);

  useEffect(() => {
    getMyAssessments()
      .then(setMyAssessments)
      .catch(() => {})
      .finally(() => setLoadingAssessments(false));
  }, []);

  // The result to show: prefer the latest completed from my-assessments, fall back to local store
  const completedItem = myAssessments.find((a) => a.status === "completed");
  const activeResultId = completedItem?.result_id ?? resultId;
  const hasEnrollments = myAssessments.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-6">
            <h1 className="text-3xl font-display font-bold text-gray-900">
              Welcome, {user?.name}
            </h1>
            <p className="mt-1 text-gray-500">
              Your Adizes Management Style Indicator (AMSI) overview.
            </p>
          </div>

          <TabBar active={activeTab} onChange={setActiveTab} />

          {activeTab === "dashboard" && (
            <>
              {loadingAssessments ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : activeResultId ? (
                <ResultsDashboard resultId={activeResultId} />
              ) : (
                <NoAssessmentCTA hasEnrollments={hasEnrollments} />
              )}
            </>
          )}

          {activeTab === "my-assessments" && (
            <MyAssessmentsTab items={myAssessments} loading={loadingAssessments} />
          )}
        </motion.div>
      </div>
    </div>
  );
}
