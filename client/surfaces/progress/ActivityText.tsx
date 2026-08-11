// The "what is happening right now" text, shimmering while the run is live.
//
// One component for two call sites that render the same field, `state.current`:
// the standalone activity line in `ProgressPanel` (no plan yet) and the nested
// line inside the active plan step in `PlanList`. Keeping the shimmer in one
// place keeps the two from drifting.
//
// ── beUI adoption notes ──────────────────────────────────────────────────────
//
// `motion/text-shimmer` is the vendored piece. Two things it needs from the
// call site, both of which would fail silently if forgotten:
//
//   - Its gradient is `linear-gradient(110deg, var(--muted-foreground) 30%,
//     var(--foreground) 50%, var(--muted-foreground) 70%)` applied with
//     `bg-clip-text` over `text-transparent`. Those are raw `var()` reads, not
//     Tailwind utilities, and the Signal theme bridge defines neither name — an
//     undefined colour stop makes the whole gradient invalid, which leaves
//     `background-image: none` behind transparent text. The text would simply
//     disappear. So both variables are supplied here, per tone.
//   - A colour utility must NOT be passed through `className`: twMerge would
//     resolve it against the component's own `text-transparent` and win,
//     painting the text solid over the gradient. That is why the resting colour
//     and the shimmering one are separate branches below rather than one
//     className.
//
// It also renders its `@keyframes` as an inline `<style>` next to the text, so
// the hook element's `textContent` picks the CSS up. That is cosmetic, and was
// checked rather than assumed: `<style>` is `display: none`, so it is absent
// from both the rendered text and the accessibility tree. Only one shimmer is
// ever mounted — the standalone line and the in-step line are mutually
// exclusive on `hasPlan` — so the `<style>` is never duplicated either.
//
// `TextShimmer` has no reduced-motion handling of its own — it always animates,
// via an inline `style.animation` that a `motion-reduce:animate-none` utility
// cannot override (inline styles win). This panel freezes every other pulse
// under reduced motion, so the shimmer is not rendered at all there; the plain
// span below is what a reduced-motion user gets, and it is also what the UI
// atlas captures, since the atlas runs with `reducedMotion: 'reduce'`.

import { useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { TextShimmer } from "../../vendor/beui/motion/text-shimmer";
import { cn } from "../../shared/cn";

/** Resting colour, and the two variables the shimmer gradient reads. */
const TONE = {
  muted: {
    rest: "text-[var(--pp-muted)]",
    vars: "[--muted-foreground:var(--pp-muted)] [--foreground:var(--pp-text)]",
  },
  faint: {
    rest: "text-[var(--pp-faint)]",
    vars: "[--muted-foreground:var(--pp-faint)] [--foreground:var(--pp-text)]",
  },
} as const;

export interface ActivityTextProps {
  /** Shimmer only while the run is actually producing this line. */
  live: boolean;
  tone: keyof typeof TONE;
  /** Layout and type classes only — never a text colour. See the header. */
  className?: string;
  children: ReactNode;
}

export function ActivityText({ live, tone, className, children }: ActivityTextProps) {
  const reduce = useReducedMotion();
  const { rest, vars } = TONE[tone];

  if (!live || reduce) {
    return <span className={cn(className, rest)}>{children}</span>;
  }

  return (
    <TextShimmer duration={2.4} className={cn("block", vars, className)}>
      {children}
    </TextShimmer>
  );
}
