import type { TopGap, ScoreSet } from "@/types/api";

interface Props {
  gap: TopGap;
  display_scores: { is: ScoreSet; should: ScoreSet; want: ScoreSet };
}

const ROLE_COLORS: Record<string, string> = {
  P: "#C8102E", A: "#1D3557", E: "#E87722", I: "#2A9D8F",
};

const GAP_TYPE_META: Record<TopGap["gap_type"], {
  label: string; formula: string;
  lensA: keyof Props["display_scores"]; lensALabel: string;
  lensB: keyof Props["display_scores"]; lensBLabel: string;
}> = {
  execution:    { label: "Execution Gap",    formula: "Role Expectations − Current State",        lensA: "should", lensALabel: "Role Expectations",   lensB: "is",   lensBLabel: "Current State"        },
  engagement:   { label: "Engagement Gap",   formula: "Role Expectations − Intrinsic Preference", lensA: "should", lensALabel: "Role Expectations",   lensB: "want", lensBLabel: "Intrinsic Preference" },
  authenticity: { label: "Authenticity Gap", formula: "Current State − Intrinsic Preference",      lensA: "is",     lensALabel: "Current State",        lensB: "want", lensBLabel: "Intrinsic Preference" },
};

function SeverityPill({ severity }: { severity: TopGap["severity"] }) {
  const isHigh = severity === "high";
  const isMed  = severity === "medium";
  if (!isHigh && !isMed) return null;
  const borderColor = isHigh ? "#C8102E" : "#E87722";
  const bg          = isHigh ? "#fff0f0" : "#fffbf0";
  const label       = isHigh ? "HIGH" : "MODERATE";
  const emoji       = isHigh ? "🔴" : "🟡";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold border"
      style={{ background: bg, borderColor, color: borderColor }}
    >
      {emoji} {label}
    </span>
  );
}

export function GapCard({ gap, display_scores }: Props) {
  const meta = GAP_TYPE_META[gap.gap_type];
  const roleColor = ROLE_COLORS[gap.role] ?? "#6b7280";
  const valA = display_scores[meta.lensA][gap.role as keyof ScoreSet];
  const valB = display_scores[meta.lensB][gap.role as keyof ScoreSet];
  const borderColor = gap.severity === "high" ? "#C8102E" : gap.severity === "medium" ? "#E87722" : "#d1d5db";

  return (
    <div
      className="rounded-lg p-4 mb-3"
      style={{ border: `1.5px solid ${borderColor}` }}
    >
      {/* Card header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ background: roleColor }}
          >
            {gap.role}
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">{meta.label}</div>
            <div className="text-xs text-gray-400">{meta.formula}</div>
          </div>
        </div>
        <SeverityPill severity={gap.severity} />
      </div>

      {/* Comparison bars */}
      <div className="space-y-1.5 mb-3">
        {[
          { label: meta.lensALabel, val: valA, opacity: 1 },
          { label: meta.lensBLabel, val: valB, opacity: 0.55 },
        ].map(({ label, val, opacity }) => (
          <div key={label} className="grid gap-2 items-center" style={{ gridTemplateColumns: "120px 1fr 36px" }}>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide truncate">{label}</div>
            <div className="bg-gray-100 rounded-sm h-3 overflow-hidden">
              <div
                className="h-full rounded-sm"
                style={{ width: `${val}%`, backgroundColor: roleColor, opacity }}
              />
            </div>
            <div className="text-[11px] text-gray-400 text-right">{val}%</div>
          </div>
        ))}
      </div>

      {/* Narrative */}
      {gap.narrative && (
        <p className="text-xs text-gray-600 leading-relaxed border-t border-gray-100 pt-2">
          {gap.narrative}
        </p>
      )}
    </div>
  );
}
