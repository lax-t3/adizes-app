import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ArrowLeft, Download, Loader2, Info } from "lucide-react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Users, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { motion } from "motion/react";
import { EnergyMatrix } from "@/components/ui/EnergyMatrix";
import { GapCard } from "@/components/ui/GapCard";
import { getRespondent } from "@/api/admin";
import { triggerGeneratePdf } from "@/api/results";
import type { GapDetail, Interpretation, ScoreSet, TopGap } from "@/types/api";

interface RespondentData {
  user: { id: string; email: string; name: string };
  result: {
    id: string;
    user_name: string;
    completed_at: string;
    status: "pending" | "in_progress" | "completed" | "expired";
    profile: { is: string; should: string; want: string };
    scaled_scores: { is: ScoreSet; should: ScoreSet; want: ScoreSet };
    gaps: GapDetail[];
    interpretation: Interpretation;
    pdf_url: string | null;
  } | null;
  cohort_id: string;
}

function getTopGaps(gaps: GapDetail[]): TopGap[] {
  const all: TopGap[] = [];
  for (const g of gaps) {
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

export function AdminRespondent() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const cohortId = searchParams.get("cohort_id");
  const [data, setData] = useState<RespondentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [checkingPdf, setCheckingPdf] = useState(false);
  const [pdfCheckMessage, setPdfCheckMessage] = useState("");

  useEffect(() => {
    if (!id || !cohortId) {
      setError("No respondent ID or cohort ID provided.");
      setLoading(false);
      return;
    }
    getRespondent(id, cohortId)
      .then((d) => {
        setData(d);
        setPdfUrl(d.result?.pdf_url ?? null);
      })
      .catch(() => setError("Failed to load respondent data."))
      .finally(() => setLoading(false));
  }, [id, cohortId]);

  const handleGeneratePdf = async () => {
    if (!id || !cohortId || !data?.result?.id) return;
    setCheckingPdf(true);
    setPdfCheckMessage("");
    try {
      const res = await triggerGeneratePdf(data.result.id);
      if (res.pdf_url) {
        setPdfUrl(res.pdf_url);
        window.open(`${res.pdf_url}?v=${Date.now()}`, "_blank");
        return;
      }
      // Poll up to 12 times (60 s)
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const fresh = await getRespondent(id, cohortId);
        if (fresh.result?.pdf_url) {
          setPdfUrl(fresh.result.pdf_url);
          window.open(`${fresh.result.pdf_url}?v=${Date.now()}`, "_blank");
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
          <p className="text-gray-600 font-medium">Loading respondent results…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 sm:p-8">
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

  if (!data.result) {
    return (
      <div className="p-6 sm:p-10 max-w-3xl mx-auto">
        <Link to="/admin/cohorts" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Cohorts
        </Link>
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{data.user.name || data.user.email}</h2>
            <p className="text-gray-500 mb-4">No assessment submitted yet for this cohort.</p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Awaiting assessment
            </span>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { user } = data;
  const result = data.result;
  const { scaled_scores, gaps, profile, interpretation } = result;

  const profileBadges = (profile.is ?? "paei").split("").map((char) => {
    const role = char.toUpperCase() as "P" | "A" | "E" | "I";
    const isDominant = char === char.toUpperCase();
    return { role, char, isDominant };
  });

  const displayName = user.name || result.user_name || user.email;

  return (
    <div className="p-4 sm:p-8 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-6">
          <Link to="/admin/cohorts" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-4 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Cohorts
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-gray-900">
                {displayName}
              </h1>
              <p className="text-gray-500 mt-1">
                {user.email} · Completed {new Date(result.completed_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {profileBadges.map(({ role, char, isDominant }) =>
                    isDominant ? (
                      <Badge key={role} variant={role} className="text-lg px-2 py-0.5">{char}</Badge>
                    ) : (
                      <Badge key={role} variant="outline" className="text-lg px-2 py-0.5 bg-gray-100">{char}</Badge>
                    )
                  )}
                </div>
                <InfoTooltip text="PAEI profile from the 'Current State' dimension — how the respondent behaves today. CAPITAL = dominant role (above 33 out of 132 — its proportional share — is considered dominant). Lowercase = non-dominant. Role colours: P = red, A = navy, E = amber, I = teal." />
              </div>
              <div className="flex flex-col items-end gap-1">
                {pdfUrl ? (
                  <Button variant="outline" onClick={() => window.open(`${pdfUrl}?v=${Date.now()}`, "_blank")}>
                    <Download className="mr-2 h-4 w-4" /> PDF Report
                  </Button>
                ) : (
                  <Button variant="outline" disabled className="opacity-60">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…
                  </Button>
                )}
                {!pdfUrl && (
                  <button
                    onClick={handleGeneratePdf}
                    disabled={checkingPdf}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {checkingPdf ? "Generating…" : "Generate PDF"}
                  </button>
                )}
                {pdfCheckMessage && (
                  <p className="text-xs text-gray-500">{pdfCheckMessage}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {result.status === "expired" ? (
          <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-sm font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            Expired — awaiting retake under the new ranking format
          </div>
        ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Style Comparison */}
          <Card className="shadow-sm border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Style Comparison
                <InfoTooltip text="Three rows for three dimensions: 'Current State' = how the respondent currently behaves. 'Role Expectations' = what their role demands. 'My Natural Preference' = their natural preference. Gaps between rows reveal where role demands and instincts diverge." />
              </CardTitle>
              <CardDescription>
                Visual representation of Current State, Role Expectations, and My Natural Preference.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnergyMatrix display_scores={scaled_scores} />
            </CardContent>
          </Card>

          {/* Gap Analysis */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Gap Analysis
                <InfoTooltip text="Top misalignments across the three dimensions. Execution Gap = Role Expectations VS Current State. Engagement Gap = Role Expectations VS My Natural Preference. Authenticity Gap = Current State VS My Natural Preference." />
              </CardTitle>
              <CardDescription>
                Most significant energy misalignments detected.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(() => {
                  const topGaps = getTopGaps(gaps);
                  return topGaps.filter(g => g.severity !== "low").length === 0 ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
                      Energy profile is well-aligned — no significant misalignments detected.
                    </div>
                  ) : (
                    <>
                      {topGaps.filter(g => g.severity !== "low").map((g, i) => (
                        <GapCard key={`${g.role}-${g.gap_type}-${i}`} gap={g} display_scores={scaled_scores} />
                      ))}
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Interpretation */}
          <div className="lg:col-span-2">
            <Card className="shadow-sm bg-white">
              <CardHeader>
                <div className="flex items-center gap-3 mb-1">
                  <span className="inline-block bg-primary text-white text-sm font-bold px-3 py-1 rounded-full">
                    {interpretation.style_label}
                  </span>
                  <span className="text-gray-500 italic text-sm">{interpretation.style_tagline}</span>
                </div>
                <CardTitle className="text-2xl font-display flex items-center gap-2">
                  Style Interpretation
                  <InfoTooltip text="Derived from the dominant 'Current State' role. Describes current leadership and collaboration tendencies. Strengths = core assets. Watchouts = areas for development. Working with Others = how to adapt to colleagues with different styles." />
                </CardTitle>
                {interpretation.combined_description && (
                  <CardDescription className="text-base">{interpretation.combined_description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-700 font-medium">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      Strengths
                      <InfoTooltip text="The natural advantages of this person's dominant PAEI style — behaviours and qualities that come easily and add value to their team." />
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{interpretation.strengths}</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-amber-700 font-medium">
                      <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <Info className="h-5 w-5" />
                      </div>
                      Watchouts
                      <InfoTooltip text="Typical pitfalls of this style — patterns that can undermine effectiveness if left unchecked. Use as coaching input, not criticism." />
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{interpretation.watchouts}</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-blue-700 font-medium">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="h-5 w-5" />
                      </div>
                      Working with Others
                      <InfoTooltip text="How this person tends to collaborate with the other three PAEI styles. Useful for team composition and conflict-prevention coaching." />
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{interpretation.working_with_others}</p>
                  </div>
                </div>

                {interpretation.mismanagement_risks.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      Mismanagement Risk Under Stress
                      <InfoTooltip text="The dysfunctional extreme each dominant style can slide into under prolonged stress. Awareness helps managers and coaches intervene early." />
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
        )}
      </motion.div>
    </div>
  );
}
