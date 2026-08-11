// The elapsed clock.
//
// Two things about this component are load-bearing and both are about noise.
//
//  1. `aria-live="off"` on the timer. A `role="timer"` element that ticks once a
//     second inside a polite live region would read the whole run aloud, second
//     by second, for a minute. The visually-hidden "Elapsed " prefix is what
//     makes the number mean something when a user navigates onto it deliberately.
//
//  2. It owns its own interval. Everything else in the panel re-renders when an
//     event arrives; this re-renders once a second regardless. Keeping the timer
//     in its own component keeps that tick from re-rendering the plan list, the
//     milestone thread and the raw log 60 times a run.
//
// beUI's `agents/loading-states/agent-progress` is the vendored component that
// pairs a label with an elapsed clock, and it is not used: it ticks every 100 ms
// (ten renders a second, against this one), prints tenths of a second, and hides
// the number from assistive technology behind a static `role="status"` label.
// `elapsedLabel()` is also on this surface's exported contract, so its format is
// not ours alone to change.

import { useEffect, useState } from "react";
import { elapsedLabel } from "./state";

export function Elapsed({ startedAt, running }: { startedAt: number; running: boolean }) {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  // Rendered from the clock rather than an accumulator, so the frame that stops
  // the run also prints the run's final duration — no extra "settle" render.
  const label = startedAt ? elapsedLabel(Date.now() - startedAt) : "0s";

  return (
    <span
      role="timer"
      aria-live="off"
      className="tabular-nums before:mr-2 before:text-[var(--pp-faint)] before:content-['·']"
    >
      <span className="sr-only">Elapsed </span>
      <span data-pp-elapsed="">{label}</span>
    </span>
  );
}
