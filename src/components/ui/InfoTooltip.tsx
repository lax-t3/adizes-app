import { Info } from "lucide-react";
import { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

interface InfoTooltipProps {
  text: string;
  className?: string;
}

const TOOLTIP_WIDTH = 272; // matches w-68 / max-w

/**
 * ⓘ icon that renders its tooltip via a React portal so it is never
 * clipped by parent overflow:hidden or z-index stacking.
 * Positions above the icon by default; flips below when near the top
 * of the viewport; clamped to stay within the horizontal viewport.
 */
export function InfoTooltip({ text, className = "" }: InfoTooltipProps) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = useCallback(() => {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    const GAP = 8;
    const APPROX_HEIGHT = 90;

    // Prefer above; flip below if not enough space
    let top =
      rect.top - APPROX_HEIGHT - GAP >= 0
        ? rect.top - APPROX_HEIGHT - GAP
        : rect.bottom + GAP;

    // Centre under icon, clamped to viewport
    let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - 8));

    setPos({ top, left });
  }, []);

  const hide = useCallback(() => setPos(null), []);

  // Hide on scroll so stale positions don't linger
  useEffect(() => {
    if (!pos) return;
    const onScroll = () => setPos(null);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, [pos]);

  return (
    <>
      <span
        ref={iconRef}
        className={`relative inline-flex items-center ${className}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        tabIndex={0}
        role="button"
        aria-label="More information"
      >
        <Info className="h-4 w-4 text-gray-400 cursor-help hover:text-gray-600 transition-colors" />
      </span>

      {pos &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: TOOLTIP_WIDTH,
              zIndex: 9999,
            }}
            className="rounded-lg bg-gray-900 px-3 py-2.5 text-xs text-gray-100 leading-relaxed shadow-xl pointer-events-none"
            onMouseEnter={hide}
          >
            {text}
            {/* Arrow (purely decorative; direction doesn't flip — simple chevron) */}
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 rotate-45 rounded-sm pointer-events-none" />
          </div>,
          document.body
        )}
    </>
  );
}
