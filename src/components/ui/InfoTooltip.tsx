import { Info } from "lucide-react";

interface InfoTooltipProps {
  text: string;
  className?: string;
}

/**
 * A small ⓘ icon that reveals a tooltip on hover/focus.
 * Pure CSS — no external library needed.
 */
export function InfoTooltip({ text, className = "" }: InfoTooltipProps) {
  return (
    <span className={`relative inline-flex items-center group ${className}`}>
      <Info className="h-4 w-4 text-gray-400 cursor-help hover:text-gray-600 transition-colors" />
      <span
        role="tooltip"
        className="
          pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2
          w-64 rounded-lg bg-gray-900 px-3 py-2 text-xs text-gray-100 leading-relaxed
          shadow-lg z-50
          opacity-0 group-hover:opacity-100 transition-opacity duration-150
        "
      >
        {text}
        {/* Arrow */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}
