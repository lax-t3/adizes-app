import { InfoTooltip } from "@/components/ui/InfoTooltip";
import type { ScoreSet } from "@/types/api";

interface Props {
  display_scores: { is: ScoreSet; should: ScoreSet; want: ScoreSet };
}

const ROLES = ["P", "A", "E", "I"] as const;

const ROLE_META: Record<typeof ROLES[number], { label: string; color: string }> = {
  P: { label: "Producer",      color: "#C8102E" },
  A: { label: "Administrator", color: "#1D3557" },
  E: { label: "Entrepreneur",  color: "#E87722" },
  I: { label: "Integrator",    color: "#2A9D8F" },
};

const LENSES: { key: keyof Props["display_scores"]; label: string; shortLabel: string; dimmed?: boolean }[] = [
  { key: "is",     label: "Current State",        shortLabel: "Current"   },
  { key: "should", label: "Role Expectations",    shortLabel: "Role"      },
  { key: "want",   label: "Intrinsic Preference", shortLabel: "Intrinsic", dimmed: true },
];

export function EnergyMatrix({ display_scores }: Props) {
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
        <InfoTooltip text="Each role section shows three bars: Current State (how you currently operate), Role Expectations (what your role demands), and Intrinsic Preference (your natural tendency, shown lighter). Bars show the percentage of total energy per role. Each set of three sums to 100%." />
      </div>

      {ROLES.map((role) => {
        const { label, color } = ROLE_META[role];
        const isVal     = display_scores.is[role];
        const shouldVal = display_scores.should[role];
        const wantVal   = display_scores.want[role];

        const exGap  = Math.abs(shouldVal - isVal);
        const authGap = Math.abs(isVal - wantVal);
        const maxGap = Math.max(exGap, authGap);
        const hasGap = maxGap >= 10;

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
              {hasGap && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ color, background: color + "18" }}
                >
                  {maxGap}pt gap
                </span>
              )}
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
