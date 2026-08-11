// The three ref comboboxes and the one anchored listbox they share.
//
// This is an ARIA 1.2 combobox, not a `<select>` and not a `<datalist>`: the
// field keeps focus and owns `aria-activedescendant`, while `#refPicker` is a
// single `role="listbox"` reused by whichever field is active. One listbox for
// three fields is the vanilla structure and it is load-bearing — the listbox is
// `position: fixed` and anchored by measurement, so having three of them would
// mean three sets of placement listeners.
//
// FOUR keys, and only four (`surface-inventory.md` §3.3 — the page has no
// page-level shortcuts at all):
//
//   ArrowDown / ArrowUp   move the active option, CLAMPED at both ends. The
//                         repo picker's folder list wraps; this one does not.
//                         The two are deliberately different and both are
//                         inventoried that way — do not "unify" them.
//   Home / End            first / last option
//   Enter                 choose the active option, which navigates
//   Escape                close the listbox (preventDefault + stopPropagation)
//
// An arrow press while the listbox is closed opens it and stops there, so the
// first ArrowDown never also moves the selection.
//
// Why not beUI's `motion/popover.tsx`, `motion/select.tsx` or
// `motion/select-morph.tsx`: all three own their own placement, and the
// placement here is a specified behaviour (see `placePicker` in `./refs.ts`)
// down to the 7px offset and the 12px viewport margins, with a flip-above rule.
// More decisively, the only key any of the three binds is Escape — none of them
// implements arrow movement, Home/End or `aria-activedescendant` at all, so
// adopting one would not change the clamp, it would delete it. beUI supplies
// the entrance instead — the clip-path reveal is a Motion animation rather than
// the vanilla `@keyframes change-picker-in`, with the same 200ms and the same
// Signal easing curve — and a `Loader` for the one row that is not an option.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Loader } from "../../vendor/beui/motion/loader";
import { cn } from "../../shared/cn";
import { useQuietSubtree } from "../../shared/quiet";
import {
  defaultIndex,
  filterOptions,
  normalizeRefs,
  optionsFor,
  placePicker,
  type FieldKind,
  type RefData,
  type RefOption,
  type RefsResponse,
} from "./refs";

/** The Signal `--motion-ease-out` curve, as Motion wants it. */
const EASE_SIGNAL_OUT = [0.23, 1, 0.32, 1] as const;

// `GET /api/refs` is fetched at most once per page. `inflight` collapses
// concurrent openings onto one request; a failure clears BOTH so the next
// interaction retries — which is the only retry this surface has, because a
// refs failure is deliberately silent (the list keeps saying "Loading refs…"
// rather than shouting at someone who was only browsing scopes).
let cachedRefs: RefData | null = null;
let inflightRefs: Promise<RefData | null> | null = null;

function loadRefs(): Promise<RefData | null> {
  if (cachedRefs) return Promise.resolve(cachedRefs);
  if (inflightRefs) return inflightRefs;
  inflightRefs = fetch("/api/refs")
    .then((response) => response.json())
    .then((body: RefsResponse) => {
      cachedRefs = normalizeRefs(body);
      inflightRefs = null;
      return cachedRefs;
    })
    .catch(() => {
      inflightRefs = null;
      return null;
    });
  return inflightRefs;
}

export interface FieldValue {
  value: string;
  /** Target field only: the value is the `Working tree` literal, not a ref. */
  worktree: boolean;
}

export interface RefPickerOptions {
  /** Current contents of each field, so the active row can match them. */
  values: Record<FieldKind, FieldValue>;
  /** A row was activated: adopt the value and navigate. */
  onChoose: (kind: FieldKind, value: string) => void;
}

export interface RefPicker {
  active: FieldKind | null;
  rows: RefOption[];
  index: number;
  /** Fetch the ref list if it is not already in flight or cached. */
  ensureRefs: () => void;
  open: (kind: FieldKind, query: string) => void;
  close: () => void;
  fieldProps: (kind: FieldKind, id: string) => FieldProps;
  listboxProps: ListboxProps;
}

export interface FieldProps {
  id: string;
  ref: (node: HTMLInputElement | null) => void;
  role: "combobox";
  "aria-autocomplete": "list";
  "aria-haspopup": "listbox";
  "aria-controls": "refPicker";
  "aria-expanded": boolean;
  "aria-activedescendant": string | undefined;
  autoComplete: "off";
  spellCheck: false;
  onFocus: () => void;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
}

export interface ListboxProps {
  ref: React.RefObject<HTMLDivElement | null>;
  rows: RefOption[];
  index: number;
  open: boolean;
  optionId: (index: number) => string;
  onHover: (index: number) => void;
  onChoose: (value: string) => void;
}

const EMPTY_QUERIES: Record<FieldKind, string> = { commit: "", base: "", head: "" };

export function useRefPicker({ values, onChoose }: RefPickerOptions): RefPicker {
  const [data, setData] = useState<RefData | null>(cachedRefs);
  const [active, setActive] = useState<FieldKind | null>(null);
  const [queries, setQueries] = useState<Record<FieldKind, string>>(EMPTY_QUERIES);
  const inputs = useRef<Partial<Record<FieldKind, HTMLInputElement | null>>>({});
  const ids = useRef<Partial<Record<FieldKind, string>>>({});
  // One stable ref callback per field. A fresh closure on every render would
  // make React detach and reattach the ref on every keystroke.
  const setInput = useRef<Record<FieldKind, (node: HTMLInputElement | null) => void>>({
    commit: (node) => {
      inputs.current.commit = node;
    },
    base: (node) => {
      inputs.current.base = node;
    },
    head: (node) => {
      inputs.current.head = node;
    },
  });
  const listbox = useRef<HTMLDivElement>(null);
  // Set immediately before a key-driven move; hover moves must not scroll.
  const scrollNext = useRef(false);

  const ensureRefs = useCallback(() => {
    if (cachedRefs) return;
    loadRefs().then((loaded) => {
      if (loaded) setData(loaded);
    });
  }, []);

  const rows = useMemo(
    () => (active ? filterOptions(optionsFor(active, data), queries[active]) : []),
    [active, data, queries],
  );

  // The active row is recomputed whenever the list is rebuilt — on open, on
  // typing, and when the fetch finally lands — and only then. Arrow keys move
  // `override`; rebuilding the list clears it, exactly as the vanilla
  // `renderPicker()` reset `activeIndex` before every render pass.
  const [seenRows, setSeenRows] = useState(rows);
  const [override, setOverride] = useState<number | null>(null);
  if (seenRows !== rows) {
    setSeenRows(rows);
    setOverride(null);
  }
  const field = active ? values[active] : null;
  const index =
    seenRows === rows && override !== null ? override : defaultIndex(rows, field?.value ?? "", !!field?.worktree);

  const open = useCallback(
    (kind: FieldKind, query: string) => {
      setActive(kind);
      setQueries((current) => (current[kind] === query ? current : { ...current, [kind]: query }));
      setOverride(null);
      ensureRefs();
    },
    [ensureRefs],
  );

  const close = useCallback(() => {
    setActive(null);
    setOverride(null);
  }, []);

  const move = useCallback(
    (next: number) => {
      if (!rows.length) {
        setOverride(null);
        return;
      }
      scrollNext.current = true;
      setOverride(Math.max(0, Math.min(next, rows.length - 1)));
    },
    [rows.length],
  );

  const choose = useCallback(
    (value: string) => {
      if (!active || !value) return;
      setQueries((current) => ({ ...current, [active]: "" }));
      onChoose(active, value);
      close();
    },
    [active, close, onChoose],
  );

  // Anchor the listbox under the active field, and keep it anchored. `scroll`
  // is captured because the field can be inside a scrolling ancestor.
  useEffect(() => {
    if (!active) return;
    const input = inputs.current[active];
    const node = listbox.current;
    if (!input || !node) return;
    const reposition = () => placePicker(input, node);
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [active, rows]);

  useEffect(() => {
    if (!scrollNext.current) return;
    scrollNext.current = false;
    if (index < 0 || !active) return;
    listbox.current?.querySelector(`#ref-option-${ids.current[active]}-${index}`)?.scrollIntoView({ block: "nearest" });
  }, [index, active]);

  // A press anywhere that is not the listbox or the field that owns it closes.
  useEffect(() => {
    if (!active) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (listbox.current && target && (target === listbox.current || listbox.current.contains(target))) return;
      if (target === inputs.current[active]) return;
      close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [active, close]);

  const fieldProps = useCallback(
    (kind: FieldKind, id: string): FieldProps => {
      ids.current[kind] = id;
      const owns = active === kind;
      return {
        id,
        ref: setInput.current[kind],
        role: "combobox",
        "aria-autocomplete": "list",
        "aria-haspopup": "listbox",
        "aria-controls": "refPicker",
        "aria-expanded": owns,
        "aria-activedescendant": owns && index >= 0 ? `ref-option-${id}-${index}` : undefined,
        autoComplete: "off",
        spellCheck: false,
        onFocus: () => open(kind, ""),
        onClick: () => open(kind, queries[kind]),
        onKeyDown: (event) => {
          if (event.key === "Escape" && owns) {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
            event.preventDefault();
            // A key press against a closed listbox only opens it.
            if (!owns) {
              open(kind, queries[kind]);
              return;
            }
            if (event.key === "Home") move(0);
            else if (event.key === "End") move(rows.length - 1);
            else move(index + (event.key === "ArrowDown" ? 1 : -1));
            return;
          }
          if (event.key === "Enter" && owns && rows[index]?.value) {
            event.preventDefault();
            choose(rows[index].value);
          }
        },
        onBlur: (event) => {
          // Focus moving into the listbox is not a dismissal. Anything else is,
          // but only once the browser has settled on a new active element —
          // `relatedTarget` is null for several ways of leaving a field.
          const next = event.relatedTarget as Node | null;
          if (next && listbox.current?.contains(next)) return;
          window.setTimeout(() => {
            const focused = document.activeElement;
            if (inputs.current[kind] === focused) return;
            if (focused && listbox.current?.contains(focused)) return;
            close();
          }, 0);
        },
      };
    },
    [active, choose, close, index, move, open, queries, rows],
  );

  return {
    active,
    rows,
    index,
    ensureRefs,
    open,
    close,
    fieldProps,
    listboxProps: {
      ref: listbox,
      rows,
      index,
      open: active !== null,
      optionId: (position: number) => `ref-option-${active ? ids.current[active] : "input"}-${position}`,
      onHover: (position: number) => {
        scrollNext.current = false;
        setOverride(position);
      },
      onChoose: choose,
    },
  };
}

/**
 * The shared listbox.
 *
 * Always in the document (the comboboxes' `aria-controls` points at it even
 * while it is closed) and toggled with `hidden`, which is how the vanilla
 * element behaved. The entrance is a Motion animation rather than a CSS
 * keyframe so the whole surface can stay utility-styled; the closing direction
 * is instant, because there was never an exit animation to preserve.
 */
export function RefListbox({ ref, rows, index, open, optionId, onHover, onChoose }: ListboxProps) {
  const reduce = useReducedMotion();
  const shown = { opacity: 1, clipPath: "inset(0px round 10px)", y: 0, scale: 1 };
  // `Loader` bakes in `role="status"`, and a live region inside a `role="option"`
  // inside a `role="listbox"` is both noise and broken structure. The card also
  // quiets this subtree — the listbox is a DOM descendant of it despite being
  // `position: fixed` — but the hook belongs where the carrier is imported.
  useQuietSubtree(ref);

  return (
    <motion.div
      ref={ref}
      id="refPicker"
      role="listbox"
      aria-label="Available git references"
      hidden={!open}
      initial={false}
      animate={
        open || reduce ? shown : { opacity: 0, clipPath: "inset(0px 0px 100% round 10px)", y: -4, scale: 0.985 }
      }
      transition={open && !reduce ? { duration: 0.2, ease: EASE_SIGNAL_OUT } : { duration: 0 }}
      style={{ transformOrigin: "50% 0" }}
      className={cn(
        "fixed z-50 max-h-[260px] overflow-auto rounded-[var(--radius-lg)] border border-line bg-surface p-1.5",
        "shadow-[var(--shadow)] contrast-more:border-text",
      )}
    >
      {rows.length === 0 ? (
        <div className="refpick-empty px-2.5 py-[9px] text-xs text-text-3">No matching refs</div>
      ) : (
        rows.map((row, position) => (
          <button
            key={`${row.kind}-${row.value}-${position}`}
            id={optionId(position)}
            type="button"
            tabIndex={-1}
            role="option"
            aria-selected={position === index}
            data-value={row.value}
            // Keeps focus on the field, so `blur` never fires mid-click and the
            // listbox is still open when `click` lands. Load-bearing.
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onHover(position)}
            onClick={(event) => {
              event.preventDefault();
              onChoose(row.value);
            }}
            className={cn(
              "refpick-row grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-0.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left",
              position === index && "bg-fill-2",
              "hover:bg-fill-2",
            )}
          >
            <span className="min-w-0 truncate font-mono text-[12.5px] font-semibold text-text">{row.label}</span>
            <span className="col-start-1 min-w-0 truncate text-[11.5px] text-text-2">{row.meta}</span>
            {/* The placeholder row has no value and no kind, so the tag column
                is free for a spinner: the row then reads as work in progress
                rather than as a ref you could pick called "Loading refs…". */}
            <span className="col-start-2 row-start-1 row-span-2 self-center text-[10.5px] font-bold tracking-[.05em] text-text-3 uppercase">
              {row.value ? row.kind : <Loader variant="spinner" size={13} label="" className="text-text-3" />}
            </span>
          </button>
        ))
      )}
    </motion.div>
  );
}
