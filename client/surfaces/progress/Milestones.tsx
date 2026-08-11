// The milestone thread — the run's narrative spine, made structural.
//
// A 2px line through small nodes: accent up to the live position, dim beyond.
// It is the one part of the panel that answers "how far through is this?"
// honestly, because the phases behind it are emitted by the app, not guessed
// from agent chatter.
//
// The labels stay in the accessibility tree — a screen-reader user who walks
// into the panel should be able to read where the run is, exactly as a sighted
// one can. What they must not do is ANNOUNCE: each advance is spoken once,
// through the panel's single live region, by `advanceMilestones` in state.ts.
// The strip itself carries no live-region semantics; only the dots, which are
// pure decoration, are hidden.
//
// ── beUI adoption notes ──────────────────────────────────────────────────────
//
// `agents/agent-activity/` is the vendored component nearest this one by name,
// and it answers a different question. It is a vertical, scrolling, collapsible
// log of what the agent *did* — one row per tool call, search or thought,
// growing without bound. This is a fixed six-node horizontal rail answering
// "how far through is this", built from phases the app emits rather than from
// agent chatter, and the whole run always fits. Swapping one for the other
// would delete the panel's only honest progress indicator, not restyle it.
// Its `role="status"` was never the blocker.

import { cn } from "../../shared/cn";
import { milestoneTone, type ProgressState } from "./state";

const CONNECTOR =
  "before:absolute before:top-[3px] before:left-[calc(-50%+8px)] before:right-[calc(50%+8px)] before:h-0.5 before:content-['']";

export function Milestones({ state, compact }: { state: ProgressState; compact: boolean }) {
  const { milestones } = state;
  if (!milestones) return null;

  return (
    <ol
      data-pp-miles=""
      className={cn(
        "m-0 flex list-none items-start px-3.5 pt-3 pb-0.5",
        compact && "px-4 pt-3.5 pb-1",
      )}
    >
      {milestones.map((milestone, index) => {
        const tone = milestoneTone(state, index);
        return (
          <li
            key={milestone.label}
            data-tone={tone}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center",
              "font-mono text-[8.5px] tracking-[0.05em] uppercase",
              compact && "text-[9.5px]",
              index > 0 && CONNECTOR,
              // The connector belongs to the segment BEHIND a node, so it lights
              // up as soon as that node does.
              tone === "done" || tone === "active"
                ? "before:bg-[var(--pp-blue)]"
                : "before:bg-[var(--pp-line)]",
              tone === "done" && "text-[var(--pp-muted)]",
              tone === "active" && "text-[var(--pp-text)]",
              tone === "error" && "text-[var(--pp-err)]",
              tone === "pending" && "text-[var(--pp-faint)]",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "z-[1] box-border h-[7px] w-[7px] flex-none rounded-full border-[1.5px]",
                tone === "pending" && "border-[var(--pp-line)] bg-[var(--pp-bg)]",
                (tone === "done" || tone === "active") &&
                  "border-[var(--pp-blue)] bg-[var(--pp-blue)]",
                tone === "error" && "border-[var(--pp-err)] bg-[var(--pp-err)]",
                // Only the live node breathes, and only while the run is live.
                tone === "active" &&
                  !state.finished &&
                  "animate-pulse [animation-duration:1.1s] motion-reduce:animate-none",
              )}
            />
            <span>{milestone.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
