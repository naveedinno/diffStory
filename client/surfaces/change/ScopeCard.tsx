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
//
// ── beUI adoption notes ──────────────────────────────────────────────────────
//
// The theme bridge defines none of the shadcn variable names beUI reaches for
// (`foreground`, `background`, `card`, `primary`, `destructive`, `muted`,
// `ring`) — `client/generated/theme.css` has not one of them — so every one of
// those utilities compiles to nothing and each colour, focus ring included, is
// supplied here.
//
//   - `Button` / `ButtonLink` carry the three scope segments. Before this they
//     had a `transition-[…,transform,…]` and nothing that ever changed a
//     transform, so the press feedback the transition was written for did not
//     exist; Motion's spring supplies it and gates itself on
//     `useReducedMotion()`. `whileHover={undefined}` keeps hover as the border
//     and fill change it already was — three tiles lifting 2% in a row reads as
//     a wobble. `SIZE_CLASS` pins `h-10` on every variant and `h` is a
//     different tailwind-merge group from `min-h`, so each segment also passes
//     `h-auto` or the 64px tile collapses to 40. The base class adds
//     `items-center justify-center`, which on a `flex-col` tile would centre
//     both labels; `items-stretch justify-start` puts them back.
//   - `Input` carries the three ref fields, as it already does for the repo
//     picker's folder filter. Every ARIA attribute rides through its `...rest`
//     spread, so the combobox contract is untouched, and `placePicker` still
//     measures the real `<input>` — the wrapper divs are around it, not
//     between it and the viewport. Its `onChange` hands over a string rather
//     than an event, which is why `wire()` commits `(next: string)`. Focus
//     indication comes from `data-state="focused"`, because the component's own
//     `ring-ring/40` is one of the utilities that compiles to nothing.
//   - `Tooltip` replaces the reload button's `title` and the truncated summary
//     values. On the summary that `title` said nothing the element did not
//     already say as its own text, so nothing needs restoring. On the reload
//     button it did: `title` was the accessible DESCRIPTION and `aria-label`
//     the name, and a tooltip's `aria-describedby` only points at a live node
//     while the bubble is open. `aria-description` restores the permanent one;
//     both were read back out of Chrome's accessibility tree with nothing
//     hovered.
//   - `Loader` marks the reload button busy. It bakes in `role="status"`, hence
//     `useQuietSubtree` over both the card (which owns the listbox, and that
//     has a `Loader` of its own) and the reload control.
//
// The segments are NOT `motion/tabs`, `morphing-tabs` or `expandable-tabs`.
// All three build a `role="tablist"` of `role="tab"` controls over a single
// active-key state, and these three controls are not that: the first is a real
// `<a href>` that performs a navigation and has no panel, while the other two
// are disclosures whose `aria-expanded` is independent of which scope the URL
// actually selected. Collapsing selection into disclosure is exactly the bug
// rule 2 above exists to prevent, and a tablist would additionally promise
// arrow-key traversal between a link and two buttons that do different things.

import { useEffect, useRef, useState } from "react";
import { GitBranch, GitCommitHorizontal } from "lucide-react";
import { Button, ButtonLink } from "../../vendor/beui/motion/button/base";
import { Input, type InputClassNames } from "../../vendor/beui/motion/input";
import { Loader } from "../../vendor/beui/motion/loader";
import { Tooltip } from "../../vendor/beui/motion/tooltip";
import { cn } from "../../shared/cn";
import { useQuietSubtree } from "../../shared/quiet";
import type { ChangePayload } from "../../../src/payloads";
import { RefListbox, useRefPicker, type FieldProps } from "./RefPicker";
import { WORKTREE, WORKTREE_LABEL, type FieldKind } from "./refs";

type Panel = "commit" | "compare";

/** Signal colours for the portalled bubble, which ships with none of its own. */
const TOOLTIP_SURFACE =
  "max-w-[min(90vw,52ch)] rounded-[var(--radius-sm)] border-line-soft bg-surface-3 px-2.5 py-1 text-[11.5px] font-medium break-all whitespace-normal text-text shadow-[var(--shadow)]";

const SEGMENT_BASE = cn(
  // `h-auto` and `items-stretch justify-start` undo the height and the centring
  // that beUI's base/size classes bake into every Button.
  "flex h-auto min-h-16 cursor-pointer flex-col items-stretch justify-start gap-1 rounded-[var(--radius-lg)] border border-transparent px-3 py-2.5 text-left no-underline",
  "transition-[background-color,border-color,transform,box-shadow] duration-[var(--motion-duration-fast)] ease-out",
  "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
  "motion-reduce:transition-none motion-reduce:active:transform-none",
  "max-[600px]:min-h-[44px] max-[600px]:justify-center max-[600px]:px-1.5 max-[600px]:py-2 max-[600px]:text-center",
);

/** The press scale the vanilla segments were written for and never got. */
const SEGMENT_PRESS = 0.985;

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

/**
 * Signal colours for the vendored field.
 *
 * `field` is the bordered box; the component's own `border-border` and
 * `ring-ring/40` name variables this app does not define, so both the resting
 * border and the focus ring have to be written here. The focus ring hangs off
 * `data-state="focused"` rather than `:focus` because that is the state the
 * component publishes, and it stays lit while a listbox row is being hovered.
 */
const FIELD_CLASSNAMES: InputClassNames = {
  root: "min-w-0 gap-0",
  field: cn(
    "h-[var(--control-h-lg)] min-w-0 rounded-[var(--radius)] border-line bg-surface",
    "hover:border-text-3",
    "data-[state=focused]:border-accent-line data-[state=focused]:shadow-[var(--shadow-focus)]",
    "contrast-more:border-text",
  ),
  input: "text-[13px] text-text placeholder:text-text-3",
  leftIcon: "left-[11px] text-text-3",
};

const SUMMARY_TILE = cn(
  "min-w-0 rounded-[var(--radius-lg)] border border-line-soft px-[13px] py-2.5",
  "bg-[color-mix(in_srgb,var(--accent)_5%,var(--fill-1))] contrast-more:border-text",
);

// All three kickers live inside SUMMARY_TILE, whose fill is accent-tinted. On
// that tint --text-3 lands at 4.26:1 (light) / 4.34:1 (dark) — the only AA miss
// left on this page, and it misses in both themes because the tile is the thing
// moving, not the ink. --accent-text is the tuned small-text blue (it is plain
// --accent in dark, #005cae in light), so the label reaches 5.09:1 / 5.92:1 and
// reads as belonging to the tile rather than sitting on it by accident.
const KICKER = "font-mono text-[10.5px] font-medium tracking-[var(--tracking-kicker)] text-accent-text uppercase";

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

/**
 * A resolved ref, truncated, with the whole of it a hover away.
 *
 * The `title` this replaces added nothing to the accessibility tree that was
 * not already there: the value IS this element's own text, and it is only
 * truncated visually. So unlike the reload button below — where `title` carried
 * a description that exists nowhere else — there is nothing here for
 * `aria-description` to restore. What the tooltip buys is a legible bubble with
 * no second-long wait, portalled past the tile's own `overflow-hidden`.
 */
function SummaryValue({ value, className }: { value: string; className?: string }) {
  return (
    <Tooltip content={value} side="bottom" className={TOOLTIP_SURFACE} wrapperClassName="block min-w-0 max-w-full">
      <b
        className={cn(
          "block min-w-0 truncate text-[15px] leading-[1.2] font-bold tracking-[-.01em] text-text max-[600px]:text-[13px]",
          className,
        )}
      >
        {value}
      </b>
    </Tooltip>
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
   *
   * `onChange` takes the next string, not the event: that is beUI's `Input`
   * signature, and the event was never read for anything but `target.value`.
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
      onChange: (next: string) => {
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

  // `Input` bakes in a `role="alert"` error message and the listbox below owns a
  // `Loader` with `role="status"`; neither belongs inside a scope picker.
  const card = useRef<HTMLElement>(null);
  useQuietSubtree(card);

  return (
    <section
      ref={card}
      aria-label="Review scope"
      className="overflow-visible rounded-[var(--radius-island)] border border-transparent bg-surface-2 p-4 max-[600px]:p-3.5 contrast-more:border-text"
    >
      <div role="group" aria-label="Review scope" className="grid grid-cols-3 gap-[9px] max-[1080px]:grid-cols-2 max-[600px]:grid-cols-3 max-[600px]:gap-1.5">
        <ButtonLink
          href={`${routeBase}/change?scope=uncommitted`}
          aria-current={active === "uncommitted" ? "true" : undefined}
          pressScale={SEGMENT_PRESS}
          whileHover={undefined}
          className={segmentClass(active === "uncommitted", false)}
        >
          <span className="text-[13px] leading-[1.2] font-bold text-text max-[600px]:text-xs">Uncommitted</span>
          <span className="text-[11.5px] leading-[1.3] text-text-2 max-[600px]:hidden">Working tree vs HEAD</span>
        </ButtonLink>
        <Button
          type="button"
          data-open-panel="commit"
          aria-controls="commitPanel"
          aria-expanded={openPanel === "commit"}
          pressScale={SEGMENT_PRESS}
          whileHover={undefined}
          onClick={() => showPanel("commit")}
          className={segmentClass(active === "commit", openPanel === "commit")}
        >
          <span className="text-[13px] leading-[1.2] font-bold text-text max-[600px]:text-xs">Single commit</span>
          <span className="text-[11.5px] leading-[1.3] text-text-2 max-[600px]:hidden">Parent → selected commit</span>
        </Button>
        <Button
          type="button"
          data-open-panel="compare"
          aria-controls="comparePanel"
          aria-expanded={openPanel === "compare"}
          pressScale={SEGMENT_PRESS}
          whileHover={undefined}
          onClick={() => showPanel("compare")}
          className={segmentClass(active === "compare", openPanel === "compare")}
        >
          <span className="text-[13px] leading-[1.2] font-bold text-text max-[600px]:text-xs">Compare any refs</span>
          <span className="text-[11.5px] leading-[1.3] text-text-2 max-[600px]:hidden">
            Source → target, any branch or commit
          </span>
        </Button>
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
          <Input
            {...commitField}
            leftIcon={<GitCommitHorizontal strokeWidth={1.8} aria-hidden="true" />}
            placeholder="HEAD or a commit SHA"
            classNames={FIELD_CLASSNAMES}
          />
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
            "focus-within:border-accent-line focus-within:shadow-[var(--shadow-focus)] contrast-more:border-text",
          )}
        >
          <span className="font-semibold text-text-2">
            Source <i className="ml-[5px] text-[11.5px] font-normal text-text-3 not-italic">older</i>
          </span>
          <Input
            {...baseField}
            leftIcon={<GitBranch strokeWidth={1.8} aria-hidden="true" />}
            placeholder="branch, tag, or commit"
            classNames={FIELD_CLASSNAMES}
          />
        </label>
        <Arrow className="max-[700px]:hidden" />
        <label
          className={cn(
            "relative flex min-h-[72px] min-w-0 flex-col justify-center gap-1.5 rounded-[var(--radius-lg)] border border-line-soft bg-fill-1 px-2.5 py-2 text-[12.5px] text-text-2",
            "focus-within:border-accent-line focus-within:shadow-[var(--shadow-focus)] contrast-more:border-text",
          )}
        >
          <span className="font-semibold text-text-2">
            Target <i className="ml-[5px] text-[11.5px] font-normal text-text-3 not-italic">newer</i>
          </span>
          <Input
            {...headField}
            {...(headWorktree ? { "data-worktree": "1" } : {})}
            leftIcon={<GitBranch strokeWidth={1.8} aria-hidden="true" />}
            placeholder="branch, tag, or commit"
            classNames={FIELD_CLASSNAMES}
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
            <SummaryValue value={baseValue} />
          </span>
          <Arrow />
          <span
            aria-label={`Target: ${headValue}`}
            className={cn(SUMMARY_TILE, "flex min-h-16 flex-col justify-center gap-[5px] overflow-hidden max-[600px]:min-h-[60px] max-[600px]:px-2.5 max-[600px]:py-[9px]")}
          >
            <span className={KICKER}>
              Target <i className="ml-[5px] font-normal tracking-normal normal-case not-italic">newer</i>
            </span>
            <SummaryValue value={headValue} />
          </span>
        </div>
      ) : inCompare ? null : (
        <div
          aria-label="Selected review scope"
          className={cn(SUMMARY_TILE, "mt-3 grid min-h-[58px] items-center max-[600px]:min-h-[54px] max-[600px]:px-[11px] max-[600px]:py-[9px]")}
        >
          <span className="flex min-w-0 flex-col gap-1">
            <span className={KICKER}>{summaryKicker}</span>
            <SummaryValue value={scopeLabel} className="text-base tracking-[-.012em]" />
          </span>
        </div>
      )}

      <RefListbox {...picker.listboxProps} />
    </section>
  );
}

/** What the reload control does, said once and used three ways. */
const RELOAD_HINT = "Re-read the working tree and rebuild the diff";

/** Kept next to the card it belongs to: the nav's reload action. */
export function ReloadButton() {
  const [busy, setBusy] = useState(false);
  // `Loader` bakes in `role="status"`. A `display: contents` box keeps the
  // quieting pass off the nav's flex layout — the tooltip's own anchor span
  // stays the flex child it replaced.
  const root = useRef<HTMLSpanElement>(null);
  useQuietSubtree(root);

  return (
    <span ref={root} className="contents">
      <Tooltip content={RELOAD_HINT} side="bottom" className={TOOLTIP_SURFACE} wrapperClassName="flex-none">
        <Button
          type="button"
          id="reloadBtn"
          disabled={busy}
          pressScale={0.97}
          whileHover={undefined}
          // The `title` this replaces was the button's accessible DESCRIPTION,
          // and `aria-label` its name. A tooltip supplies `aria-describedby`
          // only while the bubble is open, so without this the description
          // disappears for anyone not hovering. Verified in Chrome's AX tree.
          aria-description={RELOAD_HINT}
          aria-label="Reload current scope"
          aria-busy={busy || undefined}
          onClick={() => {
            setBusy(true);
            window.location.reload();
          }}
          className="h-[var(--control-h)] flex-none gap-1.5 rounded-full bg-fill-2 px-3.5 text-[12.5px] font-semibold text-text hover:bg-fill-3 max-[560px]:px-2.5 contrast-more:border contrast-more:border-text"
        >
          {busy ? (
            <Loader variant="spinner" size={15} label="" />
          ) : (
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
          )}
          <span className="max-[480px]:hidden">Reload</span>
        </Button>
      </Tooltip>
    </span>
  );
}
