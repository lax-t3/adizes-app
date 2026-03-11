import * as React from "react"
import { cn } from "@/lib/utils"

export interface GapBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  gap: number;
}

function GapBadge({ className, gap, ...props }: GapBadgeProps) {
  const absGap = Math.abs(gap);
  let variant = "green";
  if (absGap >= 5 && absGap <= 6) variant = "amber";
  if (absGap >= 7) variant = "red";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
        {
          "border-green-200 bg-green-100 text-green-800": variant === "green",
          "border-amber-200 bg-amber-100 text-amber-800": variant === "amber",
          "border-red-200 bg-red-100 text-red-800": variant === "red",
        },
        className
      )}
      {...props}
    >
      {gap > 0 ? "+" : ""}{gap}
    </div>
  )
}

export { GapBadge }
