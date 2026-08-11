// "What am I reviewing?" — the three scope modes, their editors, and the
// resolved-scope summary.
//
// The whole surface is URL-backed. Every scope change is a full navigation to a
// real URL (`?scope=uncommitted`, `?scope=commit&commit=…`, `?base=…&head=…`),
// which is why Back and Forward work here and why there is no `pushState`
// anywhere in this codebase. Two rules follow from that and both are easy to
// lose:
//
//   1. `scheduleNavTo` never navigates to the URL the page is already on.
//      Without that guard the page arrives, recomputes the same URL from the
//      refs it was rendered with, and navigates to itself forever.
//   2. Selection and disclosure are SEPARATE states. `selected` comes from the
//      payload — that is, from the URL — and `openPanel` is local. Opening the
//      compare editor while the page is showing an uncommitted diff must not
//      make the compare segment look selected, because nothing has been
//      selected yet.
//
// Typing into a ref field navigates on a 700 ms debounce; committing a field
// (choosing a row, or leaving it after an edit) navigates at once.

import { useEffect, useRef, useState } from "react";
import { Button } from "../../vendor/beui/motion/button/base";
import { cn } from "../../shared/cn";
import type { ChangePayload } from "../../../src/payloads";
import { RefListbox, useRefPicker, type FieldProps } from "./RefPicker";
import { WORKTREE, WORKTREE_LABEL, type FieldKind } from "./refs";

type Panel = "commit" | "compare";

const SEGMENT_BASE = cn(
  "flex min-h-16 cursor-pointer flex-col gap-1 rounded-[var(--radius-lg)] border border-transparent px-3 py-2.5 text-left no-underline",
  "transition-[background-color,border-color,transform,box-shadow] duration-[var(--motion-duration-fast)] ease-out",
  "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
  "motion-reduce:transition-none motion-reduce:active:transform-none",
  "max-[600px]:min-h-[44px] max-[600px]:justify-center max-[600px]:px-1.5 max-[600px]:py-2 max-[600px]:text-center",
);

function segmentClass(selected: boolean, open: boolean): string {
  return cn(
    SEGMENT_BASE,
    "text-text-2 hover:border-line hover:bg-fill-2 hover:text-text",
    selected
      ? "border-accent-line bg-accent-soft font-semibold text-text"
      : open
        ? "border-[color-mix(in_srgb,var(--accent)_30%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] text-text"
        : "bg-fill-1",
    "contrast-more:border-text",
  );
}

const FIELD_CLASS = cn(
  "h-[var(--control-h-lg)] w-full min-w-0 rounded-[var(--radius)] border border-line bg-surface px-[11px] text-[13px] text-text",
  "outline-none hover:border-text-3 focus:border-accent-line focus:shadow-[0_0_0_3px_var(--accent-soft)]",
  "contrast-more:border-text",
);

const SUMMARY_TILE = cn(
  "min-w-0 rounded-[var(--radius-lg)] border border-line-soft px-[13px] py-2.5",
  "bg-[color-mix(in_srgb,var(--accent)_5%,var(--fill-1))] contrast-more:border-text",
);

const KICKER = "font-mono text-[10.5px] font-medium tracking-[var(--tracking-kicker)] text-text-3 uppercase";

function Arrow({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-7 w-7 flex-none place-items-center self-center rounded-full border border-line-soft bg-fill-1 text-base text-text-3",
        "max-[600px]:h-6 max-[600px]:w-6 max-[600px]:text-sm contrast-more:border-text",
        className,
      )}
    >
      →
    </span>
  );
}

export interface ScopeCardProps {
  payload: ChangePayload;
}

export function ScopeCard({ payload }: ScopeCardProps) {
  const { routeBase, base, head, scopeLabel, active } = payload;
  const inCompare = active === "compare";

  // The compare editor repopulates straight from the resolved scope, because in
  // compare mode base/head ARE the two chosen revs. Other scopes resolve base to
  // bookkeeping values (`HEAD`, a parent SHA) that would read as a chosen rev.
  const [openPanel, setOpenPanel] = useState<Panel | null>(
    active === "commit" ? "commit" : active === "compare" ? "compare" : null,
  );
  const [commitValue, setCommitValue] = useState(head ?? "HEAD");
  const [baseValue, setBaseValue] = useState(inCompare ? base : "");
  const targetIsWorktree = !inCompare || !head;
  const [headValue, setHeadValue] = useState(targetIsWorktree ? WORKTREE_LABEL : (head as string));
  const [headWorktree, setHeadWorktree] = useState(targetIsWorktree);

  const navTimer = useRef(0);
  const focusValue = useRef<Record<FieldKind, string>>({ commit: "", base: "", head: "" });

  const scheduleNavTo = (url: string, delay: number) => {
    if (!url) return;
    if (navTimer.current) window.clearTimeout(navTimer.current);
    const go = () => {
      if (url !== window.location.pathname + window.location.search) window.location.href = url;
    };
    if (delay > 0) navTimer.current = window.setTimeout(go, delay);
    else go();
  };

  const commitUrl = (value: string) =>
    `${routeBase}/change?scope=commit&commit=${encodeURIComponent(value.trim() || "HEAD")}`;

  const compareUrl = (nextBase: string, nextHead: string, worktree: boolean) => {
    const source = nextBase.trim();
    if (!source) return "";
    const target = worktree || nextHead.trim() === WORKTREE_LABEL ? "" : nextHead.trim();
    return `${routeBase}/change?base=${encodeURIComponent(source)}${target ? `&head=${encodeURIComponent(target)}` : ""}`;
  };

  const picker = useRefPicker({
    values: {
      commit: { value: commitValue, worktree: false },
      base: { value: baseValue, worktree: false },
      head: { value: headValue, worktree: headWorktree },
    },
    onChoose: (kind, value) => {
      if (kind === "commit") {
        setCommitValue(value);
        scheduleNavTo(commitUrl(value), 0);
        return;
      }
      if (kind === "base") {
        setBaseValue(value);
        scheduleNavTo(compareUrl(value, headValue, headWorktree), 0);
        return;
      }
      const worktree = value === WORKTREE;
      setHeadValue(worktree ? WORKTREE_LABEL : value);
      setHeadWorktree(worktree);
      scheduleNavTo(compareUrl(baseValue, worktree ? "" : value, worktree), 0);
    },
  });

  // A panel rendered open on arrival needs its refs too, or the first keystroke
  // in it sees "Loading refs…".
  const ensureRefs = picker.ensureRefs;
  useEffect(() => {
    if (openPanel) ensureRefs();
    // Arrival only: later openings load refs from the click handler.
  }, [ensureRefs]);

  const showPanel = (panel: Panel) => {
    setOpenPanel(panel);
    ensureRefs();
  };

  /**
   * Compose the picker's field wiring with this card's own.
   *
   * `onFocus`/`onBlur` are shared: the picker opens and dismisses the listbox,
   * and the card uses the same two edges to reproduce a native `change` event —
   * leaving a field whose value you edited navigates immediately, which is what
   * the vanilla `change` listener did. React aliases `onChange` to the `input`
   * event, so without this the only immediate commit would be Enter.
   */
  const wire = (kind: FieldKind, id: string, value: string, commit: (value: string, delay: number) => void) => {
    const props: FieldProps = picker.fieldProps(kind, id);
    return {
      ...props,
      value,
      onFocus: () => {
        focusValue.current[kind] = value;
        props.onFocus();
      },
      onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
        props.onBlur(event);
        if (value !== focusValue.current[kind]) {
          focusValue.current[kind] = value;
          commit(value, 0);
        }
      },
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        const next = event.target.value;
        picker.open(kind, next);
        commit(next, 700);
      },
    };
  };

  const commitField = wire("commit", "commitRef", commitValue, (value, delay) => {
    setCommitValue(value);
    scheduleNavTo(commitUrl(value), delay);
  });

  const baseField = wire("base", "cmpBase", baseValue, (value, delay) => {
    setBaseValue(value);
    scheduleNavTo(compareUrl(value, headValue, headWorktree), delay);
  });

  const headField = wire("head", "cmpHead", headValue, (value, delay) => {
    setHeadValue(value);
    setHeadWorktree(false);
    scheduleNavTo(compareUrl(baseValue, value, false), delay);
  });

  const summaryKicker =
    active === "compare" ? "Selected comparison" : active === "commit" ? "Selected commit" : "Selected scope";

  // The split summary and the compare editor show the same two refs, so only one
  // of them is on screen at a time. The single-line summary has no such twin and
  // stays visible under whichever panel is open.
  const showSplitSummary = inCompare && openPanel !== "compare";

  return (
    <section
      aria-label="Review scope"
      className="overflow-visible rounded-[var(--radius-island)] border border-transparent bg-surface-2 p-4 max-[600px]:p-3.5 contrast-more:border-text"
    >
      <div role="group" aria-label="Review scope" className="grid grid-cols-3 gap-[9px] max-[1080px]:grid-cols-2 max-[600px]:grid-cols-3 max-[600px]:gap-1.5">
        <a
          href={`${routeBase}/change?scope=uncommitted`}
          aria-current={active === "uncommitted" ? "true" : undefined}
          className={segmentClass(active === "uncommitted", false)}
        >
          <span className="text-[13px] leading-[1.2] font-bold text-text max-[600px]:text-xs">Uncommitted</span>
          <span className="text-[11.5px] leading-[1.3] text-text-2 max-[600px]:hidden">Working tree vs HEAD</span>
        </a>
        <button
          type="button"
          data-open-panel="commit"
          aria-controls="commitPanel"
          aria-expanded={openPanel === "commit"}
          onClick={() => showPanel("commit")}
          className={segmentClass(active === "commit", openPanel === "commit")}
        >
          <span className="text-[13px] leading-[1.2] font-bold text-text max-[600px]:text-xs">Single commit</span>
          <span className="text-[11.5px] leading-[1.3] text-text-2 max-[600px]:hidden">Parent → selected commit</span>
        </button>
        <button
          type="button"
          data-open-panel="compare"
          aria-controls="comparePanel"
          aria-expanded={openPanel === "compare"}
          onClick={() => showPanel("compare")}
          className={segmentClass(active === "compare", openPanel === "compare")}
        >
          <span className="text-[13px] leading-[1.2] font-bold text-text max-[600px]:text-xs">Compare any refs</span>
          <span className="text-[11.5px] leading-[1.3] text-text-2 max-[600px]:hidden">
            Source → target, any branch or commit
          </span>
        </button>
      </div>

      <div
        id="commitPanel"
        data-panel="commit"
        hidden={openPanel !== "commit"}
        className={cn(
          "mt-3 grid grid-cols-[minmax(220px,1fr)] items-end gap-2.5 rounded-[var(--radius-lg)] border border-line-soft bg-fill-1 p-[13px]",
          openPanel !== "commit" && "hidden",
          "max-[700px]:grid-cols-[minmax(0,1fr)] contrast-more:border-text",
        )}
      >
        <label className="flex min-w-0 flex-col gap-1.5 text-[12.5px] text-text-2">
          <span className="font-semibold text-text-2">Commit</span>
          <input {...commitField} placeholder="HEAD or a commit SHA" className={FIELD_CLASS} />
        </label>
        <p className="col-span-full m-0 text-xs leading-[1.4] text-text-3">
          Shows that commit against its first parent; root commits are shown against the empty tree.
        </p>
      </div>

      <div
        id="comparePanel"
        data-panel="compare"
        hidden={openPanel !== "compare"}
        className={cn(
          "mt-3 grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-end gap-2.5",
          openPanel !== "compare" && "hidden",
          "max-[700px]:grid-cols-[minmax(0,1fr)]",
        )}
      >
        <label
          className={cn(
            "relative flex min-h-[72px] min-w-0 flex-col justify-center gap-1.5 rounded-[var(--radius-lg)] border border-line-soft bg-fill-1 px-2.5 py-2 text-[12.5px] text-text-2",
            "focus-within:border-accent-line focus-within:shadow-[0_0_0_3px_var(--accent-soft)] contrast-more:border-text",
          )}
        >
          <span className="font-semibold text-text-2">
            Source <i className="ml-[5px] text-[11.5px] font-normal text-text-3 not-italic">older</i>
          </span>
          <input {...baseField} placeholder="branch, tag, or commit" className={FIELD_CLASS} />
        </label>
        <Arrow className="max-[700px]:hidden" />
        <label
          className={cn(
            "relative flex min-h-[72px] min-w-0 flex-col justify-center gap-1.5 rounded-[var(--radius-lg)] border border-line-soft bg-fill-1 px-2.5 py-2 text-[12.5px] text-text-2",
            "focus-within:border-accent-line focus-within:shadow-[0_0_0_3px_var(--accent-soft)] contrast-more:border-text",
          )}
        >
          <span className="font-semibold text-text-2">
            Target <i className="ml-[5px] text-[11.5px] font-normal text-text-3 not-italic">newer</i>
          </span>
          <input
            {...headField}
            {...(headWorktree ? { "data-worktree": "1" } : {})}
            placeholder="branch, tag, or commit"
            className={FIELD_CLASS}
          />
        </label>
      </div>

      {showSplitSummary ? (
        <div
          role="group"
          aria-label="Selected comparison"
          className="mt-3 grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-stretch gap-2.5 max-[600px]:grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] max-[600px]:gap-[7px]"
        >
          <span
            aria-label={`Source: ${baseValue}`}
            className={cn(SUMMARY_TILE, "flex min-h-16 flex-col justify-center gap-[5px] overflow-hidden max-[600px]:min-h-[60px] max-[600px]:px-2.5 max-[600px]:py-[9px]")}
          >
            <span className={KICKER}>
              Source <i className="ml-[5px] font-normal tracking-normal normal-case not-italic">older</i>
            </span>
            <b className="block min-w-0 truncate text-[15px] leading-[1.2] font-bold tracking-[-.01em] text-text max-[600px]:text-[13px]" title={baseValue}>
              {baseValue}
            </b>
          </span>
          <Arrow />
          <span
            aria-label={`Target: ${headValue}`}
            className={cn(SUMMARY_TILE, "flex min-h-16 flex-col justify-center gap-[5px] overflow-hidden max-[600px]:min-h-[60px] max-[600px]:px-2.5 max-[600px]:py-[9px]")}
          >
            <span className={KICKER}>
              Target <i className="ml-[5px] font-normal tracking-normal normal-case not-italic">newer</i>
            </span>
            <b className="block min-w-0 truncate text-[15px] leading-[1.2] font-bold tracking-[-.01em] text-text max-[600px]:text-[13px]" title={headValue}>
              {headValue}
            </b>
          </span>
        </div>
      ) : inCompare ? null : (
        <div
          aria-label="Selected review scope"
          className={cn(SUMMARY_TILE, "mt-3 grid min-h-[58px] items-center max-[600px]:min-h-[54px] max-[600px]:px-[11px] max-[600px]:py-[9px]")}
        >
          <span className="flex min-w-0 flex-col gap-1">
            <span className={KICKER}>{summaryKicker}</span>
            <b className="block min-w-0 truncate text-base leading-[1.2] font-bold tracking-[-.012em] text-text" title={scopeLabel}>
              {scopeLabel}
            </b>
          </span>
        </div>
      )}

      <RefListbox {...picker.listboxProps} />
    </section>
  );
}

/** Kept next to the card it belongs to: the nav's reload action. */
export function ReloadButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      id="reloadBtn"
      disabled={busy}
      pressScale={0.97}
      whileHover={undefined}
      title="Re-read the working tree and rebuild the diff"
      aria-label="Reload current scope"
      onClick={() => {
        setBusy(true);
        window.location.reload();
      }}
      className="h-[var(--control-h)] flex-none gap-1.5 rounded-full bg-fill-2 px-3.5 text-[12.5px] font-semibold text-text hover:bg-fill-3 max-[560px]:px-2.5 contrast-more:border contrast-more:border-text"
    >
      <svg
        viewBox="0 0 24 24"
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 2v6h-6" />
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        <path d="M3 22v-6h6" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      </svg>
      <span className="max-[480px]:hidden">Reload</span>
    </Button>
  );
}
