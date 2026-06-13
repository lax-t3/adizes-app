import type { ScoreSet } from "@/types/api";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

interface Props {
  scaled_scores: { is: ScoreSet; should: ScoreSet; want: ScoreSet };
}

const ROLES = ["P", "A", "E", "I"] as const;

const ROLE_COLORS: Record<typeof ROLES[number], string> = {
  P: "text-[#C8102E]",
  A: "text-[#1D3557]",
  E: "text-[#E87722]",
  I: "text-[#2A9D8F]",
};

const ROWS: { label: string; key: keyof Props["scaled_scores"] }[] = [
  { label: "Should", key: "should" },
  { label: "Want",   key: "want"   },
  { label: "Is",     key: "is"     },
];

export function ScoresTable({ scaled_scores }: Props) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="flex items-center gap-1.5 mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Energy Scores (0–100%)
        </p>
        <InfoTooltip text="Each role score shows the percentage of your total energy directed at that role, per lens. Scores sum to 100% per row. A raw score above 33 (out of 132) is considered dominant — shown as a capital letter in your profile. Current State = how you behave now. Role Expectations = what your role demands. My Natural Preference = your natural preference." />
      </div>
      <table className="w-full text-sm text-center border-collapse">
        <thead>
          <tr>
            <th className="py-1.5 pr-3 text-left text-xs font-medium text-gray-400 w-16" />
            {ROLES.map((r) => (
              <th key={r} className={cn("py-1.5 font-bold text-sm", ROLE_COLORS[r])}>
                {r}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ label, key }, i) => (
            <tr key={key} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
              <td className="py-1.5 pr-3 text-left text-xs font-semibold text-gray-600">
                {label}
              </td>
              {ROLES.map((r) => (
                <td key={r} className="py-1.5 font-medium text-gray-800">
                  {scaled_scores[key][r]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
