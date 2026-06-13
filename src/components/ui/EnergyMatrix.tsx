import { InfoTooltip } from "@/components/ui/InfoTooltip";
import type { ScoreSet, GapDetail } from "@/types/api";

interface Props {
  display_scores: { is: ScoreSet; should: ScoreSet; want: ScoreSet };
  /** Backend-computed per-role gaps (132-scale + severity). When provided, the
   *  badge mirrors the PDF report's named gaps + severity bands. Omitted for the
   *  team-aggregate view, which falls back to a simple %-spread flag. */
  gaps?: GapDetail[];
}

const ROLES = ["P", "A", "E", "I"] as const;

type Severity = "low" | "medium" | "high";
type GapType = "execution" | "engagement" | "authenticity";

// Universal red/orange/yellow severity bands — identical to the PDF report
// (lambda/pdf-generator-v2/template/report.html severityBadge). NOT role colours.
const SEVERITY_BANDS: Record<Severity, { label: string; color: string; bg: string; border: string }> = {
  high:   { label: "High",     color: "#991b1b", bg: "#fee2e2", border: "#fca5a5" },
  medium: { label: "Moderate", color: "#9a3412", bg: "#ffedd5", border: "#fdba74" },
  low:    { label: "Low",      color: "#854d0e", bg: "#fef9c3", border: "#fde047" },
};

const GAP_LABELS: Record<GapType, string> = {
  execution:    "Execution",
  engagement:   "Engagement",
  authenticity: "Authenticity",
};

/** The role's single most significant gap (largest magnitude across the three types). */
function getRoleTopGap(g: GapDetail) {
  const candidates: { gap_type: GapType; magnitude: number; severity: Severity; narrative: string }[] = [
    { gap_type: "execution",    magnitude: g.execution_gap,    severity: g.execution_severity,    narrative: g.execution_narrative },
    { gap_type: "engagement",   magnitude: g.engagement_gap,   severity: g.engagement_severity,   narrative: g.engagement_narrative },
    { gap_type: "authenticity", magnitude: g.authenticity_gap, severity: g.authenticity_severity, narrative: g.authenticity_narrative },
  ];
  return candidates.reduce((a, b) => (b.magnitude > a.magnitude ? b : a));
}

const ROLE_META: Record<typeof ROLES[number], { label: string; color: string }> = {
  P: { label: "Producer",      color: "#C8102E" },
  A: { label: "Administrator", color: "#1D3557" },
  E: { label: "Entrepreneur",  color: "#E87722" },
  I: { label: "Integrator",    color: "#2A9D8F" },
};

const LENSES: { key: keyof Props["display_scores"]; label: string; shortLabel: string; dimmed?: boolean }[] = [
  { key: "is",     label: "Current State",        shortLabel: "Current"   },
  { key: "should", label: "Role Expectations",    shortLabel: "Role"      },
  { key: "want",   label: "My Natural Preference", shortLabel: "Natural", dimmed: true },
];

export function EnergyMatrix({ display_scores, gaps }: Props) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <div className="flex items-center gap-3 flex-wrap">
          {LENSES.map(({ label, dimmed }) => (
            <span key={label} className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <span
                className="inline-block w-3 h-3 rounded-sm bg-gray-300"
                style={{ opacity: dimmed ? 0.5 : 1 }}
              />
              {label}
            </span>
          ))}
        </div>
        <InfoTooltip text="Each role section shows three bars: Current State (how you currently operate), Role Expectations (what your role demands), and My Natural Preference (your natural tendency, shown lighter). Bars show the percentage of total energy per role; each set of three sums to 100%. The badge flags the role's most significant gap by name (Execution / Engagement / Authenticity) and severity (Moderate / High) — the same named gaps and severity bands as your PDF report. Roles in alignment show no badge." />
      </div>

      {ROLES.map((role) => {
        const { label, color } = ROLE_META[role];

        // Report-aligned badge: this role's most significant named gap, coloured
        // by the same severity bands as the PDF. "low" is treated as aligned and
        // not flagged (mirrors gap_analysis: "< 6 → low (not displayed)").
        const roleGap = gaps?.find((g) => g.role === role);
        const topGap  = roleGap ? getRoleTopGap(roleGap) : null;
        const band    = topGap && topGap.severity !== "low" ? SEVERITY_BANDS[topGap.severity] : null;

        // Fallback for the team-aggregate view (no per-role gaps): %-spread flag.
        const isVal     = display_scores.is[role];
        const shouldVal = display_scores.should[role];
        const wantVal   = display_scores.want[role];
        const spread    = Math.max(Math.abs(shouldVal - isVal), Math.abs(isVal - wantVal));
        const showSpread = !gaps && spread >= 10;

        return (
          <div
            key={role}
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: color + "33" }}
          >
            {/* Role header */}
            <div
              className="flex items-center justify-between px-3.5 py-2"
              style={{ background: `linear-gradient(90deg, ${color}18 0%, ${color}08 100%)` }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-black flex-shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {role}
                </span>
                <span className="text-sm font-semibold text-gray-700">{label}</span>
              </div>
              {band && topGap ? (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap"
                  style={{ color: band.color, background: band.bg, borderColor: band.border }}
                  title={`${GAP_LABELS[topGap.gap_type]} Gap — ${band.label}. ${topGap.narrative}`}
                >
                  {GAP_LABELS[topGap.gap_type]} · {band.label}
                </span>
              ) : showSpread ? (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ color, background: color + "18" }}
                >
                  {spread}pt gap
                </span>
              ) : null}
            </div>

            {/* Lens bars */}
            <div className="px-3.5 py-2.5 space-y-2">
              {LENSES.map(({ key, shortLabel, dimmed }) => {
                const val = display_scores[key][role];
                return (
                  <div
                    key={key}
                    className="flex items-center gap-2.5"
                    style={{ opacity: dimmed ? 0.55 : 1 }}
                  >
                    <span className="w-[68px] flex-shrink-0 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                      {shortLabel}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${val}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="w-8 flex-shrink-0 text-right text-[11px] font-bold text-gray-600">
                      {val}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
