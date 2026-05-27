import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useAssessmentStore } from "@/store/assessmentStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { EnergyMatrix } from "@/components/ui/EnergyMatrix";
import { GapCard } from "@/components/ui/GapCard";
import {
  Download, Info, Loader2, FileText, ArrowRight, CheckCircle2,
  Users, ClipboardList, LayoutDashboard, Clock, PlayCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { getResult, getMyAssessments } from "@/api/results";
import type { ResultResponse, CohortAssessmentHistory, TopGap } from "@/types/api";

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

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = "dashboard" | "my-assessments";

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Alignment Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "my-assessments", label: "My LEAP Profiles", icon: <ClipboardList className="h-4 w-4" /> },
  ];
  return (
    <div className="flex flex-nowrap gap-1 bg-gray-100 p-1 rounded-xl w-full overflow-x-auto mb-8">
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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [checkingPdf, setCheckingPdf] = useState(false);
  const [pdfCheckMessage, setPdfCheckMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getResult(resultId)
      .then((r) => {
        setResult(r);
        setPdfUrl(r.pdf_url);
      })
      .catch(() => setError("Failed to load results."))
      .finally(() => setLoading(false));
  }, [resultId]);

  const handleCheckAgain = async () => {
    setCheckingPdf(true);
    setPdfCheckMessage("");
    try {
      const r = await getResult(resultId);
      if (r.pdf_url) {
        setPdfUrl(r.pdf_url);
        setPdfCheckMessage("");
      } else {
        setPdfCheckMessage("Still generating, try again shortly.");
      }
    } catch {
      setPdfCheckMessage("Could not check status. Please try again.");
    } finally {
      setCheckingPdf(false);
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

  const { profile, scaled_scores, interpretation } = result;
  const topGaps = getTopGaps(result);

  const profileBadges = (profile.want ?? "paei").split("").map((char) => {
    const role = char.toUpperCase() as "P" | "A" | "E" | "I";
    const isDominant = char === char.toUpperCase();
    return { role, char, isDominant };
  });

  return (
    <div className="space-y-8 pb-8">
      {/* Header band */}
      <div className="bg-gray-900 text-white rounded-2xl p-4 sm:p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-2xl font-display font-bold tracking-tight mb-1">
              {result.user_name ? `${result.user_name}'s Results` : "Your Results"}
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
      <div className="grid gap-6 md:grid-cols-2">
        {/* Style Comparison */}
        <Card className="shadow-sm border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              Style Comparison
              <InfoTooltip text="Each role shows three lenses side-by-side: Is (Current State), Should (Role Expectations), and Want (Intrinsic Preference, shown lighter). Bars show the percentage of total energy. Gaps between lenses highlight where role demands or natural instincts diverge from current behaviour." />
            </CardTitle>
            <CardDescription>How your PAEI energy distributes across Current State, Role Expectations, and Intrinsic Preference.</CardDescription>
          </CardHeader>
          <CardContent>
            <EnergyMatrix display_scores={scaled_scores} />
          </CardContent>
        </Card>

        {/* Top Energy Misalignments */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              Top Energy Misalignments
              <InfoTooltip text="The 3 largest gaps across your 12 gap values (4 roles × 3 types). Execution Gap = Role Expectations − Current State. Engagement Gap = Role Expectations − Intrinsic Preference. Authenticity Gap = Current State − Intrinsic Preference. Thresholds on the 132-point scale: < 6 aligned, 6–15 moderate, > 15 high." />
            </CardTitle>
            <CardDescription>Where your energy perceptions diverge most.</CardDescription>
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                Watchouts
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">{interpretation.watchouts}</p>
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
                Under Stress
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
      <div className="flex flex-col items-end gap-1">
        {pdfUrl ? (
          <Button
            size="lg"
            onClick={() => window.open(pdfUrl, "_blank")}
            className="shadow-md hover:shadow-lg transition-all"
          >
            <Download className="mr-2 h-5 w-5" /> Download Full Report (PDF)
          </Button>
        ) : (
          <Button size="lg" disabled className="opacity-60 cursor-not-allowed">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating report…
          </Button>
        )}
        {!pdfUrl && (
          <button
            onClick={handleCheckAgain}
            disabled={checkingPdf}
            className="text-xs text-primary hover:underline disabled:opacity-50"
          >
            {checkingPdf ? "Checking…" : "Check again"}
          </button>
        )}
        {pdfCheckMessage && (
          <p className="text-xs text-gray-500">{pdfCheckMessage}</p>
        )}
      </div>
    </div>
  );
}

// ─── No-assessment CTA ────────────────────────────────────────────────────────

function NoAssessmentCTA({ hasEnrollments, cohortId }: { hasEnrollments: boolean; cohortId: string | null }) {
  const navigate = useNavigate();

  if (!hasEnrollments) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mb-6">
          <FileText className="h-10 w-10 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No assessment yet</h3>
        <p className="text-gray-500 max-w-sm">
          You haven't been enrolled in any cohort yet. Contact your administrator to get enrolled.
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#F8F9FC] border border-gray-200">
      {/* Subtle dot-grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #1D355714 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative grid grid-cols-1 lg:grid-cols-2">
        {/* LEFT: messaging + CTA */}
        <div className="flex flex-col justify-center px-8 sm:px-12 py-12">
          <p className="text-xs font-semibold text-[#1D3557] uppercase tracking-widest mb-4">
            LEAP™ — Leadership Energy Alignment Profile
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 mb-5 leading-tight">
            Discover where your leadership energy is aligned.
          </h2>
          <p className="text-gray-600 text-sm mb-3">
            LEAP™ helps you understand the relationship between:
          </p>
          <ul className="space-y-2 mb-5">
            {["how you currently operate", "what your role demands", "and what naturally energizes you"].map((item) => (
              <li key={item} className="flex items-center gap-2 text-gray-700 text-sm">
                <span className="h-5 w-5 rounded-full bg-[#1D3557] text-white flex items-center justify-center flex-shrink-0 text-[10px] font-bold">→</span>
                {item}
              </li>
            ))}
          </ul>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            Your personalized profile will reveal execution pressures, engagement tensions,
            authenticity gaps, and sustainable leadership strengths.
          </p>
          <div className="flex items-center gap-5 flex-wrap mb-8">
            {["~15 minutes", "36 questions", "Immediate insights"].map((item) => (
              <span key={item} className="text-xs text-gray-500 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1D3557]" />
                {item}
              </span>
            ))}
          </div>
          <Button
            variant="leap"
            size="lg"
            onClick={() => navigate(cohortId ? `/assessment?cohort_id=${cohortId}` : "/dashboard")}
            className="w-full sm:w-auto self-start"
          >
            Begin LEAP Assessment <ArrowRight className="ml-2 h-5 w-5" />
          </Button>

          {/* 3 value cards */}
          <div className="grid grid-cols-3 gap-3 mt-8">
            {[
              { title: "Alignment Matrix", desc: "Visualize role, behavior & preference alignment" },
              { title: "Gap Map", desc: "Identify execution, engagement & authenticity tensions" },
              { title: "Action Path", desc: "Practical developmental guidance" },
            ].map((card) => (
              <div key={card.title} className="rounded-xl border border-gray-200 bg-white/80 p-3">
                <p className="text-xs font-semibold text-gray-800 mb-1">{card.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: decorative preview (desktop only) */}
        <div className="hidden lg:flex flex-col justify-center items-center px-8 py-12 border-l border-gray-200/70">
          <div className="w-full max-w-xs">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 text-center">
              Sample Alignment Matrix
            </p>

            {/* Mini matrix */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4 shadow-sm">
              {/* Column headers: P A E I */}
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                <div />
                {(["P", "A", "E", "I"] as const).map((r, i) => {
                  const cols = ["#C8102E", "#1D3557", "#E87722", "#2A9D8F"];
                  return (
                    <div key={r} className="text-center text-xs font-extrabold" style={{ color: cols[i] }}>
                      {r}
                    </div>
                  );
                })}
              </div>
              {/* Rows: IS, SHD, WNT */}
              {[
                { label: "IS",  vals: [38, 32, 18, 12] },
                { label: "SHD", vals: [33, 28, 24, 15] },
                { label: "WNT", vals: [28, 38, 12, 22] },
              ].map((row) => {
                const cols = ["#C8102E", "#1D3557", "#E87722", "#2A9D8F"];
                return (
                  <div
                    key={row.label}
                    className="grid grid-cols-5 gap-1.5 mb-2 items-center"
                    style={{ opacity: row.label === "WNT" ? 0.55 : 1 }}
                  >
                    <span className="text-[10px] text-gray-400 font-medium">{row.label}</span>
                    {row.vals.map((v, i) => (
                      <div key={i} className="relative h-3 rounded bg-gray-100 overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded"
                          style={{ width: `${v}%`, background: cols[i] }}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Sample insight card */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1">
                Sample Insight
              </p>
              <p className="text-sm font-bold text-gray-900 mb-1.5">
                Entrepreneur — Execution Gap
              </p>
              <p className="text-xs text-gray-700 leading-relaxed">
                Your role currently demands more entrepreneurial energy than you are naturally expressing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Expired assessment CTA ───────────────────────────────────────────────────

function ExpiredAssessmentCTA({ cohortId }: { cohortId: string | null }) {
  const navigate = useNavigate();
  return (
    <div className="text-center py-12 px-6">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-orange-500 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">Your previous assessment has expired</h3>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">
        The assessment has been updated to a new ranking format. Please retake to see your results.
      </p>
      <Button onClick={() => navigate(cohortId ? `/assessment?cohort_id=${cohortId}` : "/dashboard")}>
        Begin Assessment
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── My Assessments tab ───────────────────────────────────────────────────────

function MyAssessmentsTab({
  items,
  loading,
}: {
  items: CohortAssessmentHistory[];
  loading: boolean;
}) {
  const navigate = useNavigate();

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

                <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
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
                        variant="outline"
                        onClick={() => navigate(`/results?id=${item.result_id}`)}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" /> PDF Report
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => navigate(`/assessment?cohort_id=${item.cohort_id}`)}>
                      <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                      {item.status === "expired" ? "Retake" : "Start"}
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

function StatusBadge({ status }: { status: CohortAssessmentHistory["status"] }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="h-3 w-3" /> Completed
      </span>
    );
  }
  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
        Expired
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
  const [myAssessments, setMyAssessments] = useState<CohortAssessmentHistory[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(true);

  useEffect(() => {
    getMyAssessments()
      .then(setMyAssessments)
      .catch(() => {})
      .finally(() => setLoadingAssessments(false));
  }, []);

  // The result to show: prefer the latest completed from my-assessments, fall back to local store
  const completedItem = myAssessments.find((a) => a.status === "completed");
  const expiredItem = myAssessments.find((a) => a.status === "expired");
  const activeResultId = completedItem?.result_id ?? resultId;
  const hasEnrollments = myAssessments.length > 0;
  const pendingItem = myAssessments.find((a) => a.status === "pending");
  const pendingCohortId = pendingItem?.cohort_id ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-gray-900">
              Discover Your Leadership Alignment
            </h1>
            <p className="mt-1 text-gray-500">
              Leadership Energy Alignment Profile — Powered by the Adizes PAEI Framework
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
              ) : expiredItem ? (
                <ExpiredAssessmentCTA cohortId={expiredItem.cohort_id} />
              ) : (
                <NoAssessmentCTA hasEnrollments={hasEnrollments} cohortId={pendingCohortId} />
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
