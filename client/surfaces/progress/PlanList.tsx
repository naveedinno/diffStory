// The agent's OWN plan, from its TodoWrite calls — the centrepiece of the panel.
//
// beUI ships `agents/todo-list.tsx`, which is visually exactly this component
// and was the obvious thing to reach for. It is NOT used here, for one concrete
// reason: it renders `<ol aria-live="polite">`. A plan re-render happens on
// every TodoWrite the agent makes, and each one would read the entire list
// aloud. The vanilla panel's whole accessibility design is that only lifecycle
// milestones speak. So the list is rebuilt here, keeping beUI's spacing and
// status vocabulary but none of its live region.
//
// The "what's happening now" line is nested INSIDE the active step rather than
// living in its own row. That is deliberate: it binds the churn of file and
// command events to the one plan item they belong to, instead of leaving a
// free-floating line that looks like it describes the whole run.

import { cn } from "../../shared/cn";
import type { ProgressState } from "./state";

const MARK = "flex-none w-3.5 text-left text-[11px] leading-[inherit]";

export function PlanList({ state }: { state: ProgressState }) {
  if (!state.hasPlan) return null;

  return (
    <ol
      data-pp-plan=""
      className="m-0 min-h-10 flex-1 list-none overflow-auto px-3.5 pt-1.5 pb-1"
    >
      {state.plan.map((item, index) => {
        const status = item?.status || "pending";
        const active = status === "active";
        return (
          <li
            key={`${index}-${item?.text ?? ""}`}
            data-status={status}
            className="flex items-baseline gap-2.5 py-1 font-mono text-[11px] leading-[1.55]"
          >
            {status === "done" ? (
              <span aria-hidden="true" className={cn(MARK, "text-[var(--pp-ok)]")}>
                ✓
              </span>
            ) : (
              <span
                aria-hidden="true"
                className={cn(
                  MARK,
                  active
                    ? "animate-pulse text-[var(--pp-blue)] [animation-duration:1.2s] motion-reduce:animate-none"
                    : "text-[var(--pp-faint)]",
                )}
              >
                {active ? "●" : "○"}
              </span>
            )}
            <span
              className={cn(
                "min-w-0 text-[11px]",
                status === "done" && "text-[var(--pp-faint)]",
                active && "text-[var(--pp-text)]",
                status === "pending" && "text-[var(--pp-muted)]",
              )}
            >
              <span className="sr-only">
                {status === "done" ? "Done: " : active ? "In progress: " : "To do: "}
              </span>
              {item?.text || ""}
              {active && state.current ? (
                <span
                  data-pp-step-now=""
                  className="mt-0.5 block font-mono text-[11.5px] break-words text-[var(--pp-faint)]"
                >
                  {state.current}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
