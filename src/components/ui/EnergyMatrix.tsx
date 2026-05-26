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

const ROWS: { label: string; key: keyof Props["display_scores"]; dimmed?: boolean }[] = [
  { label: "Current State",        key: "is"     },
  { label: "Role Expectations",    key: "should" },
  { label: "Intrinsic Preference", key: "want",  dimmed: true },
];

export function EnergyMatrix({ display_scores }: Props) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-1.5 mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Energy Alignment Matrix
        </p>
        <InfoTooltip text="Each bar shows what percentage of your total energy goes to each PAEI role, per lens. Current State = how you operate now. Role Expectations = what your role demands. Intrinsic Preference = your natural inclination (shown lighter as an anchor lens). Scores sum to 100% per row." />
      </div>

      {/* Column headers */}
      <div className="grid gap-1" style={{ gridTemplateColumns: "130px repeat(4, 1fr)" }}>
        <div />
        {ROLES.map((r) => (
          <div
            key={r}
            className="text-center text-xs font-bold pb-1"
            style={{ color: ROLE_META[r].color }}
          >
            <span className="text-sm">{r}</span>
            <span className="hidden sm:block text-[10px] font-normal text-gray-400">
              {ROLE_META[r].label}
            </span>
          </div>
        ))}
      </div>

      {/* Data rows */}
      <div className="space-y-2">
        {ROWS.map(({ label, key, dimmed }) => (
          <div
            key={key}
            className="grid gap-1 items-center"
            style={{
              gridTemplateColumns: "130px repeat(4, 1fr)",
              opacity: dimmed ? 0.7 : 1,
            }}
          >
            <div className="text-xs font-medium text-gray-500 truncate pr-2">{label}</div>
            {ROLES.map((r) => {
              const val = display_scores[key][r];
              return (
                <div key={r} className="px-1">
                  <div className="bg-gray-100 rounded-sm h-3 overflow-hidden">
                    <div
                      className="h-full rounded-sm transition-all duration-300"
                      style={{ width: `${val}%`, backgroundColor: ROLE_META[r].color }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-400 text-center mt-0.5">{val}%</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
