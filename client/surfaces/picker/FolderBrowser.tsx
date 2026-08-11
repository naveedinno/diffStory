// The server-backed folder browser.
//
// A browser cannot read an absolute path back out of the OS file dialog, so
// "Add repository" opens this sheet and walks the filesystem through
// `GET /api/fs` instead. It is an ARIA 1.2 combobox: the text field keeps focus
// and owns `aria-activedescendant`, while the list below is a listbox whose
// options are `tabIndex={-1}`.
//
// Four keyboard bindings on the field, all preserved from the vanilla picker:
//
//   ArrowDown / ArrowUp   move the active option, WRAPPING (the change page's
//                         ref picker clamps instead — they are different, on
//                         purpose, and both are inventoried that way)
//   Home / End            first / last option
//   Enter                 activate the active option
//   Escape                close the sheet (preventDefault + stopPropagation, so
//                         the document-level handler does not also fire)
//
// Tab / Shift+Tab are handled one level up by `useModalChoreography`, whose
// focusable filter excludes `tabindex="-1"` — which is exactly what keeps these
// options out of the tab ring.
//
// Activating a row branches on `isGit`: a repository opens (and navigates away),
// anything else descends into it.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ChevronRight, Folder, Search, X } from "lucide-react";
import { Button } from "../../vendor/beui/motion/button/base";
import { requestJson } from "../../shared/api";
import { cn } from "../../shared/cn";
import { useModalChoreography } from "../../shared/use-modal";
import { plural } from "./format";

interface FsEntry {
  name: string;
  path: string;
  isGit: boolean;
}

interface FsListing {
  path: string;
  parent: string | null;
  isGit: boolean;
  entries: FsEntry[];
}

type View = { kind: "loading" } | { kind: "error" } | { kind: "ready"; listing: FsListing };

const READ_ERROR = "Could not read that folder.";

export interface FolderBrowserHandle {
  /** `trigger` is the element focus returns to when the sheet closes. */
  open: (trigger?: HTMLElement | null) => void;
}

export interface FolderBrowserProps {
  /** The page content to inert while the sheet is up. */
  background: React.RefObject<HTMLElement | null>;
  /** Navigates away; the sheet does not close first. */
  onOpenRepo: (path: string) => void;
}

export const FolderBrowser = forwardRef<FolderBrowserHandle, FolderBrowserProps>(function FolderBrowser(
  { background, onOpenRepo },
  ref,
) {
  const scrim = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<View>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(-1);
  // Set just before a selection change that should also scroll; hover must not.
  const scrollOnSelect = useRef(false);
  // Guards a stale listing from overwriting a newer one when a slow parent
  // directory resolves after a fast child.
  const browseId = useRef(0);

  const entries = view.kind === "ready" ? view.listing.entries : [];
  const trimmed = query.trim();

  const filtered = useMemo(() => {
    const needle = trimmed.toLocaleLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) => entry.name.toLocaleLowerCase().indexOf(needle) !== -1);
  }, [entries, trimmed]);

  const activeIndex = selected >= 0 && selected < filtered.length ? selected : -1;

  const browse = useCallback((path: string | null) => {
    const id = ++browseId.current;
    setQuery("");
    setSelected(-1);
    setView({ kind: "loading" });
    requestJson<FsListing>("/api/fs" + (path ? "?path=" + encodeURIComponent(path) : ""))
      .then((listing) => {
        if (browseId.current !== id) return;
        setView({ kind: "ready", listing });
        // Descending replaces every row, so focus has to come back to the field
        // or it lands on a button that no longer exists. Only while the sheet is
        // actually visible — the first `browse(null)` runs before the rAF.
        if (scrim.current?.classList.contains("is-shown")) search.current?.focus();
      })
      .catch(() => {
        if (browseId.current !== id) return;
        setView({ kind: "error" });
      });
  }, []);

  const modal = useModalChoreography({
    dialog: scrim,
    background,
    onOpen: () => {
      browse(null);
    },
    onClose: () => {
      setQuery("");
      setSelected(-1);
    },
  });

  const openModal = modal.open;
  useImperativeHandle(ref, () => ({ open: openModal }), [openModal]);

  // Focus once the sheet is actually shown, not from `onOpen`. During the
  // opening phase the scrim is still `visibility: hidden`, and focus() on a
  // hidden element is a silent no-op — which left focus on <body> whenever the
  // /api/fs call that used to re-focus was slow or failed.
  useEffect(() => {
    if (modal.shown) search.current?.focus();
  }, [modal.shown]);

  useEffect(() => {
    if (!scrollOnSelect.current) return;
    scrollOnSelect.current = false;
    if (activeIndex < 0) return;
    list.current?.querySelector(`#fs-entry-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const select = (index: number, scroll: boolean) => {
    scrollOnSelect.current = scroll;
    setSelected(index);
  };

  const move = (delta: number) => {
    if (!filtered.length) return;
    const next = activeIndex < 0 ? (delta > 0 ? 0 : filtered.length - 1) : (activeIndex + delta + filtered.length) % filtered.length;
    select(next, true);
  };

  const activate = (entry: FsEntry) => {
    if (entry.isGit) onOpenRepo(entry.path);
    else browse(entry.path);
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      select(event.key === "Home" ? 0 : filtered.length - 1, true);
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0 && filtered[activeIndex]) {
      event.preventDefault();
      activate(filtered[activeIndex]);
      return;
    }
    if (event.key === "Escape") {
      // stopPropagation keeps the document-level handler from double-closing.
      event.preventDefault();
      event.stopPropagation();
      modal.close();
    }
  };

  const onSearchChange = (value: string) => {
    setQuery(value);
    // Vanilla: the input handler parks the selection at 0 when there is a query,
    // and `renderEntries` then clamps it against the new result set.
    const needle = value.trim().toLocaleLowerCase();
    if (!needle) {
      setSelected(-1);
      return;
    }
    const next = entries.filter((entry) => entry.name.toLocaleLowerCase().indexOf(needle) !== -1);
    setSelected(next.length ? 0 : -1);
  };

  const current = view.kind === "ready" ? view.listing.path : "";
  const currentIsGit = view.kind === "ready" && view.listing.isGit;
  const hasFilter = query.length > 0;
  // The combobox reports collapsed the instant closing begins, 210ms before the
  // dialog is actually hidden — the vanilla control did the same.
  const expanded = modal.phase === "opening" || modal.phase === "open";

  const status =
    view.kind === "loading"
      ? "Loading folders…"
      : view.kind === "error"
        ? READ_ERROR
        : `${filtered.length} ${plural(filtered.length, "folder", "folders")} shown.`;

  const crumbs = useMemo(() => {
    if (view.kind !== "ready") return [];
    const parts = view.listing.path.split("/").filter(Boolean);
    const trail = [{ label: "/", path: "/", current: parts.length === 0 }];
    let acc = "";
    parts.forEach((part, i) => {
      acc += "/" + part;
      trail.push({ label: part, path: acc, current: i === parts.length - 1 });
    });
    return trail;
  }, [view]);

  return (
    <div
      ref={scrim}
      className={cn("ds-scrim", modal.shown && "is-shown")}
      role="dialog"
      aria-modal="true"
      aria-label="Choose a repository folder"
      tabIndex={-1}
      hidden={!modal.mounted}
      onClick={(event) => {
        // Only a click on the scrim itself dismisses; clicks inside the sheet
        // bubble here too.
        if (event.target === scrim.current) modal.close();
      }}
    >
      <div className="ds-sheet flex max-h-[76vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[var(--radius-island)] border border-line-soft bg-surface-3 shadow-[var(--shadow)] contrast-more:border-text">
        <div className="flex items-center gap-2.5 border-b border-line-soft px-4 py-3.5">
          <span className="flex-1 text-[15px] font-semibold">Choose a repository</span>
          <button
            type="button"
            aria-label="Close"
            onClick={() => modal.close()}
            className="relative grid h-[30px] w-[30px] place-items-center rounded-full bg-fill-3 text-text-2 transition-colors hover:bg-fill-2 hover:text-text after:absolute after:-inset-2 after:content-['']"
          >
            <X className="h-4 w-4" strokeWidth={1.9} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-0.5 border-b border-line-soft px-4 py-[9px] text-[12.5px] text-text-2">
          {crumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-0.5">
              {i > 0 ? (
                <span className="text-text-3 opacity-60" aria-hidden="true">
                  /
                </span>
              ) : null}
              {crumb.current ? (
                <span className="rounded-[var(--radius-sm)] px-[5px] py-0.5 font-semibold text-text" aria-current="location">
                  {crumb.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => browse(crumb.path)}
                  className="rounded-[var(--radius-sm)] px-[5px] py-0.5 text-accent hover:bg-fill-2"
                >
                  {crumb.label}
                </button>
              )}
            </span>
          ))}
        </div>

        <div className="border-b border-line-soft px-4 py-2.5">
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-[11px] flex text-text-3" aria-hidden="true">
              <Search className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <input
              ref={search}
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-expanded={expanded}
              aria-controls="fslist"
              aria-label="Filter folders in this location"
              aria-activedescendant={activeIndex >= 0 ? `fs-entry-${activeIndex}` : undefined}
              placeholder="Filter folders"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={onSearchKeyDown}
              className={cn(
                "h-[34px] w-full rounded-full border border-line bg-bg pr-[34px] pl-[35px] text-[13px] text-text outline-none",
                "transition-[box-shadow,border-color] duration-[var(--motion-duration-fast)]",
                "placeholder:text-text-3 focus:border-accent-line",
                "contrast-more:border-text",
                "[&::-webkit-search-cancel-button]:appearance-none",
              )}
            />
            {/* `hidden` as well as visually gone: an invisible-but-focusable
                clear button would sit in the modal's tab ring. */}
            <button
              type="button"
              aria-label="Clear folder filter"
              hidden={!hasFilter}
              onClick={() => {
                setQuery("");
                setSelected(-1);
                search.current?.focus();
              }}
              className={cn(
                "absolute right-1.5 h-[23px] w-[23px] place-items-center rounded-[var(--radius-sm)] bg-fill-3 text-text-2 hover:bg-fill-2 after:absolute after:-inset-2.5 after:content-['']",
                // `display` has to be driven by a class as well as the attribute:
                // a `grid` utility would out-cascade Preflight's [hidden] rule.
                hasFilter ? "grid" : "hidden",
              )}
            >
              <X className="h-3 w-3" strokeWidth={2} />
            </button>
          </div>
          <span className="ds-sr-only" role="status" aria-live="polite">
            {status}
          </span>
        </div>

        <div ref={list} id="fslist" role="listbox" aria-label="Folders in this location" className="min-h-[120px] flex-1 overflow-y-auto p-1.5">
          {view.kind === "loading" ? (
            <div className="p-[26px] text-center text-[13px] text-text-3">Loading…</div>
          ) : view.kind === "error" ? (
            <div className="p-[26px] text-center text-[13px] text-text-3">{READ_ERROR}</div>
          ) : filtered.length === 0 ? (
            <div className="p-[26px] text-center text-[13px] text-text-3">
              {trimmed ? `No folders match “${trimmed}”.` : "No subfolders here."}
            </div>
          ) : (
            filtered.map((entry, index) => (
              <button
                key={entry.path}
                id={`fs-entry-${index}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={index === activeIndex}
                onMouseEnter={() => select(index, false)}
                onClick={() => activate(entry)}
                className={cn(
                  "flex w-full items-center gap-[11px] rounded-[var(--radius)] px-2.5 py-[9px] text-left",
                  "hover:bg-fill-2",
                  index === activeIndex && "bg-fill-2 shadow-[inset_0_0_0_1px_var(--accent-line)]",
                )}
              >
                <span className="flex flex-none text-accent">
                  <Folder className="h-5 w-5" strokeWidth={1.7} />
                </span>
                <span className="min-w-0 flex-1 truncate text-left text-sm">{entry.name}</span>
                {entry.isGit ? (
                  <span className="rounded-[var(--radius-sm)] bg-add-soft px-[7px] py-px text-[11px] font-semibold text-add">repo</span>
                ) : (
                  <span className="flex flex-none text-text-3 opacity-50" aria-hidden="true">
                    <ChevronRight className="h-4 w-4" strokeWidth={2} />
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-2.5 border-t border-line-soft px-4 py-[13px]">
          <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-text-3">{current}</span>
          <Button
            type="button"
            pressScale={0.97}
            disabled={!currentIsGit}
            onClick={() => {
              if (currentIsGit) onOpenRepo(current);
            }}
            className="h-[var(--control-h-lg)] flex-none rounded-full bg-accent px-4 text-[13px] font-semibold text-on-accent hover:bg-accent-hi disabled:opacity-40"
          >
            {currentIsGit ? "Open this folder" : "Not a git repo"}
          </Button>
        </div>
      </div>
    </div>
  );
});
