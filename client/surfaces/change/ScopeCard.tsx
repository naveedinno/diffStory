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
// The theme bridge DOES define the shadcn variable names beUI reaches for —
// `client/generated/theme.css` maps `foreground`, `background`, `card`,
// `primary`, `destructive`, `muted` and `ring` onto Signal values — so the
// vendored utilities resolve and paint. That is the opposite of what an earlier
// version of this note claimed, and it matters in one direction only: a
// vendored colour left alone is not a no-op that quietly vanishes, it is a
// second opinion drawn underneath whatever this file draws on top. So each
// colour is either replaced or explicitly cancelled below, never just ignored.
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
//     than an event, which is why `wire()` commits `(next: string)`. The field
//     is now drawn BORDERLESS inside its slot (see SLOT below), so its own
//     resting border, its focused `border-foreground/40`, and its `ring-2
//     ring-ring/40` are all cancelled in `FIELD_CLASSNAMES` — `--color-ring`
//     does resolve in this bridge, so leaving the ring alone would draw a
//     second box inside the slot that already owns the focus indication.
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

// The three segments sit INSIDE a recessed track rather than floating on the
// card as three separate tiles. Three tiles with their own fill and their own
// hairline read as three cards you could each act on; one track with three
// compartments reads as "pick exactly one of these", which is what it is. So
// the segment itself is transparent — the track supplies the fill — and colour
// is spent only on the two states that mean something (see `segmentClass`).
const SEGMENT_TRACK = cn(
  "grid grid-cols-3 gap-1 rounded-[var(--radius-lg)] border border-line-soft bg-fill-1 p-1",
  "max-[600px]:gap-0.5 contrast-more:border-text",
);

const SEGMENT_BASE = cn(
  // `h-auto` and `items-stretch justify-start` undo the height and the centring
  // that beUI's base/size classes bake into every Button.
  "flex h-auto min-h-16 cursor-pointer flex-col items-stretch justify-start gap-1 rounded-[var(--radius)] border border-transparent bg-transparent px-3 py-2.5 text-left no-underline",
  "transition-[background-color,border-color,transform,box-shadow] duration-[var(--motion-duration-fast)] ease-out",
  "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
  "motion-reduce:transition-none motion-reduce:active:transform-none",
  "max-[600px]:min-h-[44px] max-[600px]:justify-center max-[600px]:px-1.5 max-[600px]:py-2 max-[600px]:text-center",
);

/** The press scale the vanilla segments were written for and never got. */
const SEGMENT_PRESS = 0.985;

/**
 * Selected and open are DIFFERENT things and now look it.
 *
 * `selected` is the scope the URL actually resolved — the diff you are looking
 * at. `open` is only "this editor is showing"; you can open the commit editor
 * while a compare is on screen, and until you pick a ref nothing has changed.
 * The old pairing spent `color-mix(accent 8%)` on `open`, which against
 * `--fill-1` is under a percent of luminance apart and was invisible in both
 * themes — so a lit blue segment and an unrelated open editor looked like a
 * bug. Filled-versus-outlined is the standard way to rank two live states and
 * survives both themes: `selected` takes the accent border AND the accent fill
 * AND the weight; `open` takes the same border and nothing else.
 */
function segmentClass(selected: boolean, open: boolean): string {
  return cn(
    SEGMENT_BASE,
    "text-text-2 hover:bg-fill-2 hover:text-text",
    selected
      ? "border-accent-line bg-accent-soft font-semibold text-text"
      : open
        ? "border-accent-line text-text"
        : "border-transparent",
    "contrast-more:border-text",
  );
}

/**
 * Signal colours for the vendored field, drawn borderless inside its slot.
 *
 * The field used to carry its own 40px bordered box, which then sat inside the
 * bordered slot that labels it — a border inside a border, twice over in the
 * compare editor. The slot is the box now, so everything the component draws
 * around the text is cancelled here: `rounded-none border-transparent
 * bg-transparent` for the resting state, and `ring-0` because
 * `--color-ring` DOES resolve in this bridge (it is `--accent-line`), so the
 * component's focused `ring-2 ring-ring/40` would otherwise paint a second box
 * inside the slot that already shows focus via `focus-within`.
 *
 * The value is mono: these fields hold refs, and `DESIGN_MEMORY.md` gives IBM
 * Plex Mono to "code, refs, hashes, data". The PLACEHOLDER stays sans, because
 * "branch, tag, or commit" is prose about refs, not a ref.
 */
const FIELD_CLASSNAMES: InputClassNames = {
  root: "min-w-0 gap-0",
  field: "h-7 min-w-0 rounded-none border-transparent bg-transparent ring-0",
  input: cn(
    "h-7 pr-0 pl-[22px] font-mono text-[13.5px] font-semibold text-text",
    "placeholder:font-sans placeholder:text-[13px] placeholder:font-normal placeholder:text-text-3",
  ),
  leftIcon: "left-0 text-text-3 [&_svg]:h-[15px] [&_svg]:w-[15px]",
};

// One endpoint of the diff, in one geometry. The compare editor and the
// resolved summary describe the same two refs, so they are the same tile with
// the same height, radius, padding and kicker — only the tone and the contents
// differ. Before this they were two different components that happened to sit
// in the same place, and switching between them looked like a layout change
// rather than one object resolving.
const SLOT = cn(
  "flex min-h-[72px] min-w-0 flex-col justify-center gap-1 rounded-[var(--radius-lg)] border border-line-soft px-3 py-2.5",
  "max-[600px]:min-h-[62px] max-[600px]:px-2.5 max-[600px]:py-2 contrast-more:border-text",
);

/** Being edited: neutral fill, and the whole tile shows the focus ring. */
const SLOT_EDIT = cn(SLOT, "cursor-text bg-fill-1 focus-within:border-accent-line focus-within:shadow-[var(--shadow-focus)]");

/** Resolved: the accent tint that marks "this is the answer, not the question". */
const SLOT_DONE = cn(SLOT, "overflow-hidden bg-[color-mix(in_srgb,var(--accent)_5%,var(--fill-1))]");

const KICKER_BASE = "font-mono text-[10.5px] font-medium tracking-[var(--tracking-kicker)] uppercase";

// The resolved kickers live inside SLOT_DONE, whose fill is accent-tinted. On
// that tint --text-3 lands at 4.26:1 (light) / 4.34:1 (dark) — the only AA miss
// left on this page, and it misses in both themes because the tile is the thing
// moving, not the ink. --accent-text is the tuned small-text blue (it is plain
// --accent in dark, #005cae in light), so the label reaches 5.09:1 / 5.92:1 and
// reads as belonging to the tile rather than sitting on it by accident.
const KICKER = cn(KICKER_BASE, "text-accent-text");

// The editing kickers sit on the neutral --fill-1 slot, where --accent-text
// would be the loudest thing in a tile whose point is the value you are typing.
// --text-2 clears AA on that fill in both themes and leaves the accent to mean
// "resolved".
const KICKER_EDIT = cn(KICKER_BASE, "text-text-2");

// The "older" / "newer" gloss that rides after a kicker. Written out at each
// call site rather than wrapped in a `<Gloss>` component on purpose: the guard
// in test/change-page.test.mjs that keeps these sides labelled by meaning reads
// for the literal `Source <i` / `Target <i`, and a component would hide the
// labelling from it.
const GLOSS = "ml-[5px] font-normal tracking-normal normal-case not-italic opacity-80";

function Arrow({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-6 w-6 flex-none place-items-center self-center rounded-full border border-line bg-surface-2 text-text-2",
        "max-[600px]:h-5 max-[600px]:w-5 contrast-more:border-text",
        className,
      )}
    >
      {/* A drawn arrow rather than the "→" glyph: at 24px the glyph rendered at
          whatever weight IBM Plex Sans has at that size, which next to 1.8-stroke
          Lucide icons in the same row read as a different icon set. */}
      <svg
        viewBox="0 0 24 24"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h12" />
        <path d="m12 5 7 7-7 7" />
      </svg>
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
function SummaryValue({ value, mono, className }: { value: string; mono?: boolean; className?: string }) {
  return (
    <Tooltip content={value} side="bottom" className={TOOLTIP_SURFACE} wrapperClassName="block min-w-0 max-w-full">
      <b
        className={cn(
          "block min-w-0 truncate leading-[1.25] tracking-[-.01em] text-text max-[600px]:text-[13px]",
          // A ref is data and takes the mono voice, matching the field it was
          // typed into and the mono the rest of the app gives refs. `scopeLabel`
          // is the one value here that is prose ("Uncommitted changes"), so it
          // keeps the sans display face — setting a sentence in mono would say
          // it is a ref when it is not.
          mono ? "font-mono text-[13.5px] font-semibold" : "text-[15px] font-bold",
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
      {/* Three columns at every width above 600px. The old
          `max-[1080px]:grid-cols-2` dropped to two columns while the card was
          still the full 960px the `<main>` allows, which left "Compare any
          refs" alone on a second row beside 470px of dead space — and it did
          that on any window narrower than about 1080px, which is most of them. */}
      <div role="group" aria-label="Review scope" className={SEGMENT_TRACK}>
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
        className={cn("mt-3 grid grid-cols-[minmax(0,1fr)] gap-1.5", openPanel !== "commit" && "hidden")}
      >
        <label className={SLOT_EDIT}>
          <span className={KICKER_EDIT}>Commit</span>
          <Input
            {...commitField}
            leftIcon={<GitCommitHorizontal strokeWidth={1.8} aria-hidden="true" />}
            placeholder="HEAD or a commit SHA"
            classNames={FIELD_CLASSNAMES}
          />
        </label>
        <p className="m-0 px-0.5 text-xs leading-[1.4] text-text-3">
          Shows that commit against its first parent; root commits are shown against the empty tree.
        </p>
      </div>

      {/* The editor and the resolved summary below share this grid verbatim, so
          the two refs never move sideways when one replaces the other. */}
      <div
        id="comparePanel"
        data-panel="compare"
        hidden={openPanel !== "compare"}
        className={cn(
          "mt-3 grid grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] items-stretch gap-2",
          openPanel !== "compare" && "hidden",
          "max-[700px]:grid-cols-[minmax(0,1fr)] max-[700px]:gap-2.5",
        )}
      >
        <label className={SLOT_EDIT}>
          <span className={KICKER_EDIT}>
            Source <i className={GLOSS}>older</i>
          </span>
          <Input
            {...baseField}
            leftIcon={<GitBranch strokeWidth={1.8} aria-hidden="true" />}
            placeholder="branch, tag, or commit"
            classNames={FIELD_CLASSNAMES}
          />
        </label>
        <Arrow className="max-[700px]:hidden" />
        <label className={SLOT_EDIT}>
          <span className={KICKER_EDIT}>
            Target <i className={GLOSS}>newer</i>
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
          className="mt-3 grid grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] items-stretch gap-2 max-[600px]:grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] max-[600px]:gap-1.5"
        >
          <span aria-label={`Source: ${baseValue}`} className={SLOT_DONE}>
            <span className={KICKER}>
              Source <i className={GLOSS}>older</i>
            </span>
            <SummaryValue value={baseValue} mono />
          </span>
          <Arrow />
          <span aria-label={`Target: ${headValue}`} className={SLOT_DONE}>
            <span className={KICKER}>
              Target <i className={GLOSS}>newer</i>
            </span>
            <SummaryValue value={headValue} mono />
          </span>
        </div>
      ) : inCompare ? null : (
        <div
          aria-label="Selected review scope"
          className={cn(SLOT_DONE, "mt-3 min-h-[58px] max-[600px]:min-h-[54px]")}
        >
          <span className={KICKER}>{summaryKicker}</span>
          <SummaryValue value={scopeLabel} className="text-base tracking-[-.012em]" />
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
