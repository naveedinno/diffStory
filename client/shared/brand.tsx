// The Thread Path brand marks, as React.
//
// Ports of `brandMarkSvg()` and `brandThreadBackdropSvg()` from `src/brand.ts`.
// The path data is duplicated rather than imported because `src/brand.ts` emits
// HTML strings and would drag the server's module graph into the bundle. The
// geometry has not changed since the Signal 3b direction landed; if it ever
// does, both copies move together.
//
// The backdrop's animation (draw → nodes in → an 11s travelling pulse) lives in
// `shared.css` under `.ds-atmosphere-thread`, matching `threadAtmosphereStyles()`
// exactly — including the reduced-motion branch that removes the pulse.

import { cn } from "./cn";

const THREAD_PATH_D =
  "M6.6 5.4h8.7c2 0 3.6 1.6 3.6 3.6s-1.6 3.6-3.6 3.6H8.8c-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8h8.6";

const THREAD_BACKDROP_D = "M-30 38H560c46 0 46 62 0 62H210c-46 0-46 62 0 62H930";

export interface BrandMarkProps {
  className?: string;
  size?: number;
  /** `mono` inherits `currentColor`; `color` uses the --ds-brand-* custom properties. */
  tone?: "mono" | "color";
}

/** The 24×24 Thread Path app mark. */
export function BrandMark({ className, size = 34, tone = "color" }: BrandMarkProps) {
  const stroke = tone === "mono" ? "currentColor" : "var(--ds-brand-path,currentColor)";
  const nodeA = tone === "mono" ? "currentColor" : "var(--ds-brand-node-a,currentColor)";
  const nodeB = tone === "mono" ? "currentColor" : "var(--ds-brand-node-b,currentColor)";
  const nodeC = tone === "mono" ? "currentColor" : "var(--ds-brand-node-c,currentColor)";
  return (
    <svg className={className} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d={THREAD_PATH_D}
        fill="none"
        stroke={stroke}
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6.6" cy="5.4" r="2.35" fill={nodeA} />
      <circle cx="15.3" cy="12.6" r="2.35" fill={nodeB} />
      <circle cx="17.4" cy="20.2" r="2.35" fill={nodeC} />
    </svg>
  );
}

/**
 * The masthead-scale Thread Path used as page atmosphere.
 *
 * Purely decorative: `aria-hidden`, `focusable="false"`, and never a
 * pointer-events target. Position it with the wrapper, not with props.
 */
export function ThreadBackdrop({ className }: { className?: string }) {
  return (
    <svg
      className={cn("ds-atmosphere-thread", className)}
      viewBox="0 0 900 190"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <path className="thread-base" d={THREAD_BACKDROP_D} pathLength={100} />
      <path className="thread-pulse" d={THREAD_BACKDROP_D} pathLength={100} />
      <g className="thread-nodes">
        <circle cx="60" cy="38" r="3.2" opacity=".45" />
        <circle className="node-mid" cx="385" cy="100" r="3.2" opacity=".85" />
        <circle cx="760" cy="162" r="3.2" opacity=".45" />
      </g>
    </svg>
  );
}
