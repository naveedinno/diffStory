// The recents stack: one card per remembered workspace, plus the "unavailable
// workspaces" disclosure and the no-repositories-yet empty state.
//
// Two details that look cosmetic and are not:
//
//   - Ordinals are continuous across the split. Available repos are 01..N and
//     the collapsed missing group picks up at N+1, so the numbering describes
//     one list even though it renders as two.
//   - Removal is per-row, not delegated. The vanilla code carries an explicit
//     regression note about this: a single delegated `click` handler reading
//     `e.target.closest('button[data-remove-repo]')` broke on WebKit, where the
//     event target can be the button's nested <svg>. React's synthetic events
//     are delegated at the root but resolve to the element that carries the
//     handler, so putting `onClick` on the button is the fixed behaviour, not
//     the broken one — provided the handler lives on the <button> and not on an
//     ancestor row.
//
// The only status pill that exists is `Missing`. Tour status was removed on
// purpose ("an internal concept that confused users"); do not put it back.

import { Fragment, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Folder, GitBranch, Trash2 } from "lucide-react";
import { AnimatedBadge } from "../../vendor/beui/motion/animated-badge";
import type { RecentRow } from "../../../src/payloads";
import { cn } from "../../shared/cn";
import { plural, prettyPath, relativeTime } from "./format";

interface RowProps {
  row: RecentRow;
  /** Zero-based position in the combined list; rendered as a 2-digit ordinal. */
  index: number;
  home: string;
  now: number;
  busy: boolean;
  onOpen: (path: string) => void;
  onRemove: (path: string) => void;
}

function RepoRow({ row, index, home, now, busy, onOpen, onRemove }: RowProps) {
  // Branch · N changed files · relative time, with the dot separators dropped
  // for whatever is absent. A repo whose folder is gone shows only the time.
  const meta: ReactNode[] = [];
  if (row.isGit && row.currentBranch) {
    meta.push(
      <span key="branch" className="inline-flex items-center gap-1">
        <GitBranch className="h-[13px] w-[13px] opacity-80" strokeWidth={1.8} />
        {row.currentBranch}
      </span>,
    );
  }
  if (row.isGit && row.changedFiles > 0) {
    meta.push(<span key="changed">{`${row.changedFiles} changed ${plural(row.changedFiles, "file", "files")}`}</span>);
  }
  meta.push(<span key="time">{relativeTime(row.lastOpened, now)}</span>);

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_44px] items-stretch gap-2",
        "max-[480px]:relative max-[480px]:block",
        !row.isGit && "opacity-[.68]",
      )}
    >
      {/* `data-repo-card` is the UI-atlas evidence selector for this surface —
          a capture only counts as coverage if it can find a real row. */}
      <button
        type="button"
        data-repo-card
        onClick={() => onOpen(row.path)}
        className={cn(
          "flex w-full items-center gap-[13px] rounded-[var(--radius-island)] border border-transparent bg-surface-2 px-4 py-3.5 text-left",
          "transition-[transform,background-color,border-color] duration-[var(--motion-duration-fast)] ease-out",
          // .98 rather than a deeper dip: this card is full-width, and 3% on a
          // wide element reads as buckling. Matches nav.tsx's large-surface value.
          "hover:border-line hover:bg-fill-1 active:scale-[.98]",
          // Reduced motion keeps the colour feedback and drops only the movement.
          "motion-reduce:transition-[background-color,border-color] motion-reduce:active:transform-none",
          "contrast-more:border-text",
          "max-[480px]:pr-[54px]",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "w-5 flex-none text-right font-mono text-xs font-semibold tracking-[-.01em] max-[480px]:hidden",
            row.isGit ? "text-[var(--numeral)]" : "text-[var(--numeral-dim)]",
          )}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          className={cn(
            "grid h-[38px] w-[38px] flex-none place-items-center rounded-[var(--radius-lg)]",
            row.isGit ? "bg-accent-soft text-accent" : "bg-fill-3 text-text-2",
          )}
        >
          <Folder className="h-5 w-5" strokeWidth={1.7} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold tracking-[-.012em]">{row.name}</span>
            {row.isGit ? null : (
              <AnimatedBadge
                status="danger"
                size="sm"
                showIcon={false}
                className="h-auto flex-none rounded-[var(--radius-sm)] border-0 bg-del-soft px-2 py-0.5 text-[11px] font-semibold text-del"
              >
                Missing
              </AnimatedBadge>
            )}
          </span>
          <span className="truncate font-mono text-xs text-text-2" title={row.path}>
            {prettyPath(row.path, home)}
          </span>
          <span className="mt-px flex flex-wrap items-center gap-[7px] font-mono text-[11px] text-text-2">
            {meta.map((node, i) => (
              <Fragment key={i}>
                {i > 0 ? (
                  <span className="text-text-3 opacity-60" aria-hidden="true">
                    ·
                  </span>
                ) : null}
                {node}
              </Fragment>
            ))}
          </span>
        </span>
        <span className="flex flex-none text-text-3 opacity-55" aria-hidden="true">
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </span>
      </button>

      <button
        type="button"
        disabled={busy}
        aria-busy={busy || undefined}
        title="Remove from recent repositories"
        aria-label={`Remove ${row.name} from recent repositories`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onRemove(row.path);
        }}
        className={cn(
          "flex w-11 items-center justify-center rounded-[var(--radius-island)] border border-transparent bg-surface-2 text-text-3",
          "transition-colors duration-[var(--motion-duration-fast)] hover:bg-del-soft hover:text-del disabled:opacity-55",
          "contrast-more:border-text",
          // Compact layout: the control overlays the card's reserved right
          // gutter, with a -5px inset hit-slop so it stays thumb-sized.
          "max-[480px]:absolute max-[480px]:top-3 max-[480px]:right-3 max-[480px]:z-[2] max-[480px]:h-[34px] max-[480px]:w-[34px]",
          "max-[480px]:after:absolute max-[480px]:after:-inset-[5px] max-[480px]:after:content-['']",
        )}
      >
        <Trash2 className="h-[15px] w-[15px]" strokeWidth={1.9} />
      </button>
    </div>
  );
}

function EmptyRecents() {
  return (
    <div
      data-recents-empty
      className="rounded-[var(--radius-island)] border border-dashed border-line px-5 py-10 text-center text-text-2"
    >
      <span className="mb-3.5 inline-flex h-[52px] w-[52px] items-center justify-center rounded-[var(--radius-island)] bg-fill-1 text-text-3">
        <Folder className="h-5 w-5" strokeWidth={1.7} />
      </span>
      <p className="m-0 mb-1.5 font-display text-xl font-bold tracking-[-.02em] text-text">No repositories yet</p>
      <p className="m-0 mx-auto max-w-[42ch] text-[12.5px] leading-[1.55]">
        Point diffStory at any local Git repository — it reads the working tree directly, nothing is uploaded.
      </p>
    </div>
  );
}

export interface RecentReposProps {
  recents: RecentRow[];
  home: string;
  now: number;
  removing: string | null;
  onOpen: (path: string) => void;
  onRemove: (path: string) => void;
}

export function RecentRepos({ recents, home, now, removing, onOpen, onRemove }: RecentReposProps) {
  if (!recents.length) return <EmptyRecents />;

  const available = recents.filter((row) => row.isGit);
  const missing = recents.filter((row) => !row.isGit);

  const rowFor = (row: RecentRow, index: number) => (
    <RepoRow
      key={row.path}
      row={row}
      index={index}
      home={home}
      now={now}
      busy={removing === row.path}
      onOpen={onOpen}
      onRemove={onRemove}
    />
  );

  return (
    <div className="space-y-2">
      {available.map((row, i) => rowFor(row, i))}
      {missing.length ? (
        <details className="group mt-3 border-t border-line-soft pt-2">
          <summary className="flex cursor-pointer list-none items-center justify-between px-[3px] py-2 text-xs font-semibold text-text-3 [&::-webkit-details-marker]:hidden">
            <span>
              {missing.length} unavailable {plural(missing.length, "workspace", "workspaces")}
            </span>
            <ChevronDown
              className="h-3.5 w-3.5 transition-transform duration-[var(--motion-duration-fast)] group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>
          <div className="grid gap-2 pt-0.5">
            {missing.map((row, i) => rowFor(row, available.length + i))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
