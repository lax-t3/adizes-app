import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useAssessmentStore } from "@/store/assessmentStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { GapBadge } from "@/components/ui/GapBadge";
import { Button } from "@/components/ui/Button";
import { Download, Info, Loader2 } from "lucide-react";
import { Users, CheckCircle2 } from "lucide-react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { motion } from "motion/react";
import { getResult, downloadPdf } from "@/api/results";
import type { ResultResponse } from "@/types/api";

export function Results() {
  const { user } = useAuthStore();
  const { resultId } = useAssessmentStore();
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState("");

  // Result ID comes from URL param (set after submit) or store
  const id = searchParams.get("id") ?? resultId;

  useEffect(() => {
    if (!id) {
      setError("No result found. Please complete the assessment first.");
      setLoading(false);
      return;
    }
    getResult(id)
      .then(setResult)
      .catch(() => setError("Failed to load results. Please try again."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownloadPdf = async () => {
    if (!id || !result) return;
    setPdfLoading(true);
    try {
      await downloadPdf(id, result.user_name);
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
          <p className="text-gray-600 font-medium">Loading your results…</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <p className="text-red-600 font-medium">{error || "Results not available."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { profile, scaled_scores, gaps, interpretation } = result;

  // Build radar chart data
  const radarData = (["P", "A", "E", "I"] as const).map((role) => ({
    subject: { P: "Producer (P)", A: "Administrator (A)", E: "Entrepreneur (E)", I: "Integrator (I)" }[role],
    is: scaled_scores.is[role],
    should: scaled_scores.should[role],
    want: scaled_scores.want[role],
    fullMark: 50,
  }));

  // Build gap chart data
  const gapChartData = gaps.map((g) => ({
    name: g.role_name,
    is: g.is_score,
    should: g.should_score,
    gap: g.external_gap,
  }));

  // Build profile badge string (e.g. "paEI")
  const profileBadges = (profile.want ?? "paei").split("").map((char) => {
    const role = char.toUpperCase() as "P" | "A" | "E" | "I";
    const isDominant = char === char.toUpperCase();
    return { role, char, isDominant };
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header Band */}
      <div className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-6"
          >
            <div>
              <h1 className="text-4xl font-display font-bold tracking-tight mb-2">
                {result.user_name}'s Results
              </h1>
              <p className="text-gray-400 text-lg">
                Completed on {new Date(result.completed_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-4 bg-gray-800/50 p-4 rounded-xl border border-gray-700 backdrop-blur-sm">
              <div className="text-sm text-gray-400 font-medium uppercase tracking-wider">Dominant Style</div>
              <div className="flex gap-1.5">
                {profileBadges.map(({ role, char, isDominant }) =>
                  isDominant ? (
                    <Badge key={role} variant={role} className="text-xl px-3 py-1 shadow-sm">
                      {char}
                    </Badge>
                  ) : (
                    <Badge key={role} variant="outline" className="text-xl px-3 py-1 bg-gray-800 text-gray-300 border-gray-600">
                      {char}
                    </Badge>
                  )
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-8">
        <div className="grid gap-8 lg:grid-cols-2">

          {/* Radar Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <Card className="h-full shadow-md border-t-4 border-t-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Style Comparison <Info className="h-4 w-4 text-gray-400" />
                </CardTitle>
                <CardDescription>
                  Visual representation of your Is, Should, and Want profiles.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="99%" height="100%">
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
          </motion.div>

          {/* Gap Analysis */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <Card className="h-full shadow-md">
              <CardHeader>
                <CardTitle>Gap Analysis</CardTitle>
                <CardDescription>
                  Differences between your current behavior (Is) and job demands (Should).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full mb-6">
                  <ResponsiveContainer width="99%" height="100%">
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
          </motion.div>

          {/* Interpretation */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="lg:col-span-2">
            <Card className="shadow-md bg-white overflow-hidden">
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
                        <div key={i} className="bg-red-50 border-l-3 border-red-400 border-l-4 px-4 py-2 rounded-r-md text-sm text-gray-700">
                          {risk}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] z-50">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900">Ready to dive deeper?</p>
            <p className="text-xs text-gray-500">Download your comprehensive report.</p>
          </div>
          <Button
            size="lg"
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="w-full sm:w-auto shadow-md hover:shadow-lg transition-all"
          >
            {pdfLoading
              ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating…</>
              : <><Download className="mr-2 h-5 w-5" /> Download Full Report (PDF)</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
