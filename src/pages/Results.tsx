import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAssessmentStore } from "@/store/assessmentStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Download, Loader2 } from "lucide-react";
import { Users, CheckCircle2, Info } from "lucide-react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { motion } from "motion/react";
import { EnergyMatrix } from "@/components/ui/EnergyMatrix";
import { GapCard } from "@/components/ui/GapCard";
import { getResult, triggerGeneratePdf } from "@/api/results";
import type { ResultResponse, TopGap } from "@/types/api";

function getTopGaps(result: ResultResponse): TopGap[] {
  const all: TopGap[] = [];
  for (const g of result.gaps) {
    for (const gapType of ["execution", "engagement", "authenticity"] as const) {
      all.push({
        role:       g.role,
        role_name:  g.role_name,
        gap_type:   gapType,
        gap_abs:    g[`${gapType}_gap`],
        gap_signed: g[`${gapType}_gap_signed`],
        severity:   g[`${gapType}_severity`],
        narrative:  g[`${gapType}_narrative`],
        is_score:     g.is_score,
        should_score: g.should_score,
        want_score:   g.want_score,
      });
    }
  }
  return all.sort((a, b) => b.gap_abs - a.gap_abs).slice(0, 3);
}

export function Results() {
  const { resultId } = useAssessmentStore();
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [checkingPdf, setCheckingPdf] = useState(false);
  const [pdfCheckMessage, setPdfCheckMessage] = useState("");
  const [error, setError] = useState("");

  const id = searchParams.get("id") ?? resultId;

  useEffect(() => {
    if (!id) {
      setError("No result found. Please complete the assessment first.");
      setLoading(false);
      return;
    }
    getResult(id)
      .then((r) => { setResult(r); setPdfUrl(r.pdf_url); })
      .catch(() => setError("Failed to load results. Please try again."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleGeneratePdf = async () => {
    if (!id) return;
    setCheckingPdf(true);
    setPdfCheckMessage("");
    try {
      const res = await triggerGeneratePdf(id);
      if (res.pdf_url) {
        setPdfUrl(res.pdf_url);
        window.open(`${res.pdf_url}?v=${Date.now()}`, "_blank");
        return;
      }
      // Poll up to 12 times (60 s) waiting for Lambda to finish
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const r = await getResult(id);
        if (r.pdf_url) {
          setPdfUrl(r.pdf_url);
          window.open(`${r.pdf_url}?v=${Date.now()}`, "_blank");
          return;
        }
      }
      setPdfCheckMessage("Still generating — please check again in a moment.");
    } catch {
      setPdfCheckMessage("Could not generate report. Please try again.");
    } finally {
      setCheckingPdf(false);
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

  const { profile, scaled_scores, interpretation } = result;
  const topGaps = getTopGaps(result);

  const profileBadges = (profile.is ?? "paei").split("").map((char) => {
    const role = char.toUpperCase() as "P" | "A" | "E" | "I";
    const isDominant = char === char.toUpperCase();
    return { role, char, isDominant };
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header Band */}
      <div className="bg-gray-900 text-white py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-6"
          >
            <div>
              <h1 className="text-4xl font-display font-bold tracking-tight mb-2">
                {result.user_name ? `${result.user_name}'s Results` : "Your Results"}
              </h1>
              <p className="text-gray-400 text-lg">
                Completed on {new Date(result.completed_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-4 bg-gray-800/50 p-4 rounded-xl border border-gray-700 backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-gray-400 font-medium uppercase tracking-wider">Dominant Style</span>
                <InfoTooltip text="Your PAEI profile based on the 'Current State' (Is) dimension — how you behave today. A CAPITAL letter means that role's raw score exceeded 33 out of 132 (its proportional share). A lowercase letter means it scored 33 or below." />
              </div>
              <div className="flex gap-1.5">
                {profileBadges.map(({ role, char, isDominant }) =>
                  isDominant ? (
                    <Badge key={role} variant={role} className="text-xl px-3 py-1 shadow-sm">{char}</Badge>
                  ) : (
                    <Badge key={role} variant="outline" className="text-xl px-3 py-1 bg-gray-800 text-gray-300 border-gray-600">{char}</Badge>
                  )
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-4 sm:-mt-8">
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-2">

          {/* Style Comparison */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <Card className="shadow-md border-t-4 border-t-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Style Comparison
                  <InfoTooltip text="Each role shows three bars: Current State (how you currently operate), Role Expectations (what your role demands), and Intrinsic Preference (your natural tendency, shown lighter). Bars show the percentage of total energy. Gaps highlight where role demands or natural instincts diverge from current behaviour." />
                </CardTitle>
                <CardDescription>
                  How your PAEI energy distributes across Current State, Role Expectations, and Intrinsic Preference.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EnergyMatrix display_scores={scaled_scores} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Top Gap Cards */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Top Energy Misalignments
                  <InfoTooltip text="The 3 largest gaps across your 12 gap values (4 roles × 3 types). Execution Gap = Role Expectations − Current State. Engagement Gap = Role Expectations − Intrinsic Preference. Authenticity Gap = Current State − Intrinsic Preference. Thresholds on the 132-point scale: < 6 aligned, 6–15 moderate, > 15 high." />
                </CardTitle>
                <CardDescription>
                  Where your energy perceptions diverge most.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topGaps.filter(g => g.severity !== "low").length === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
                    Your energy profile is well-aligned — no significant misalignments detected.
                  </div>
                ) : (
                  topGaps
                    .filter(g => g.severity !== "low")
                    .map((g, i) => (
                      <GapCard key={`${g.role}-${g.gap_type}-${i}`} gap={g} display_scores={scaled_scores} />
                    ))
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Interpretation */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="lg:col-span-2">
            <Card className="shadow-md bg-white">
              <CardHeader>
                <div className="flex items-center gap-3 mb-1">
                  <span className="inline-block bg-primary text-white text-sm font-bold px-3 py-1 rounded-full">
                    {interpretation.style_label}
                  </span>
                  <span className="text-gray-500 italic text-sm">{interpretation.style_tagline}</span>
                </div>
                <CardTitle className="text-2xl font-display flex items-center gap-2">
                  Style Interpretation
                  <InfoTooltip text="Based on your dominant Current State roles. Describes how you currently lead and collaborate. Strengths are your assets; Watchouts are where growth lies; Working with Others shows how to bridge style differences." />
                </CardTitle>
                {interpretation.combined_description && (
                  <CardDescription className="text-base">{interpretation.combined_description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-700 font-medium">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      Strengths
                      <InfoTooltip text="Natural advantages of your dominant PAEI style — behaviours and qualities that come easily to you." />
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{interpretation.strengths}</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-amber-700 font-medium">
                      <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <Info className="h-5 w-5" />
                      </div>
                      Watchouts
                      <InfoTooltip text="Typical pitfalls of your style — patterns that can undermine effectiveness if left unchecked." />
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{interpretation.watchouts}</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-blue-700 font-medium">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="h-5 w-5" />
                      </div>
                      Working with Others
                      <InfoTooltip text="Practical tips for collaborating with the other three PAEI styles." />
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{interpretation.working_with_others}</p>
                  </div>
                </div>

                {interpretation.mismanagement_risks.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      Under Stress
                      <InfoTooltip text="The dysfunctional extreme your dominant style can slide into under prolonged stress." />
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
          </motion.div>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 pt-3 pb-4 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] z-50" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4 px-0 sm:px-2">
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900">Your PDF report</p>
            {pdfUrl
              ? <p className="text-xs text-gray-500">Ready to download.</p>
              : <p className="text-xs text-gray-500">Being generated in the background.</p>
            }
          </div>
          <div className="flex flex-col items-end gap-1">
            {pdfUrl ? (
              <Button size="lg" onClick={() => window.open(`${pdfUrl}?v=${Date.now()}`, "_blank")} className="w-full sm:w-auto shadow-md hover:shadow-lg transition-all">
                <Download className="mr-2 h-5 w-5" /> Download Full Report (PDF)
              </Button>
            ) : (
              <Button size="lg" disabled className="w-full sm:w-auto opacity-60 cursor-not-allowed">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating report…
              </Button>
            )}
            {!pdfUrl && (
              <button onClick={handleGeneratePdf} disabled={checkingPdf} className="text-xs text-primary hover:underline disabled:opacity-50">
                {checkingPdf ? "Generating…" : "Generate PDF"}
              </button>
            )}
            {pdfCheckMessage && <p className="text-xs text-gray-500">{pdfCheckMessage}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
