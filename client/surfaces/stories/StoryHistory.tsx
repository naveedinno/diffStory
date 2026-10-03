// Earlier versions of one saved review.
//
// History loads on demand, not in the page payload: snapshots are story-sized
// JSON and a metadata-only page must stay cheap. Expanding the disclosure
// fetches GET /api/stories/history?id= once; restore POSTs and patches the
// row from the response's fresh stories array (title/steps/updatedAt only —
// adopting its live evidence would silently upgrade a metadata-only page).
//
// Restore is undoable by construction (the server snapshots the live bytes
// first), so there is no confirm dialog. Opening a snapshot is a real
// navigation to review?story=<history-id>, which renders read-only.

import { useState } from "react";
import { History } from "lucide-react";
import type { StoryHistoryDiff, StoryHistoryEntry } from "../../../src/types";
import type { StoryRowView } from "../../../src/payloads";
import { failureMessage, requestJson } from "../../shared/api";
import { cn } from "../../shared/cn";
import { plural, relativeTime } from "./format";

export interface StoryHistoryProps {
  storyId: string;
  routeBase: string;
  now: number;
  onRestored: (patch: Partial<StoryRowView>) => void;
}

function diffSummary(entry: StoryHistoryEntry): string | null {
  const diff: StoryHistoryDiff | undefined = entry.diff;
  if (!diff) return null;
  const parts: string[] = [];
  if (diff.titleChanged) parts.push("retitled since");
  if (diff.stepDelta > 0) parts.push(`${plural(diff.stepDelta, "step")} added since`);
  else if (diff.stepDelta < 0) parts.push(`${plural(-diff.stepDelta, "step")} removed since`);
  if (!parts.length) parts.push("same shape as the live story");
  return parts.join(" · ");
}

export function StoryHistory({ storyId, routeBase, now, onRestored }: StoryHistoryProps) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<StoryHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (!next || loaded || loading) return;
    setLoading(true);
    setError(null);
    requestJson<{ history: StoryHistoryEntry[] }>(
      `/api/stories/history?id=${encodeURIComponent(storyId)}`,
      { fallback: "Could not load story history." },
    )
      .then((data) => {
        setLoading(false);
        setLoaded(true);
        setEntries(data.history ?? []);
      })
      .catch((cause: unknown) => {
        setLoading(false);
        setError(failureMessage(cause, "Could not load story history."));
      });
  };

  const restore = (entry: StoryHistoryEntry) => {
    if (restoring) return;
    setRestoring(entry.name);
    setError(null);
    requestJson<{ stories: StoryRowView[]; history: StoryHistoryEntry[] }>(
      "/api/stories/history/restore",
      {
        method: "POST",
        body: { id: storyId, name: entry.name },
        fallback: "Could not restore this version.",
        networkFallback: "Could not reach the server.",
      },
    )
      .then((data) => {
        setRestoring(null);
        setEntries(data.history ?? []);
        const fresh = (data.stories ?? []).find((row) => row.id === storyId);
        if (fresh) {
          onRestored({
            title: fresh.title,
            summary: fresh.summary,
            valid: fresh.valid,
            error: fresh.error,
            steps: fresh.steps,
            primers: fresh.primers,
            files: fresh.files,
            updatedAt: fresh.updatedAt,
          });
        }
        setStatus(`Restored the version from ${entry.takenAt}.`);
      })
      .catch((cause: unknown) => {
        setRestoring(null);
        setError(failureMessage(cause, "Could not restore this version."));
      });
  };

  return (
    <div className="border-t border-line-soft px-[19px] py-2">
      <div className="flex flex-wrap items-center gap-x-5">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={cn(
            "inline-flex min-h-[36px] items-center gap-2 rounded-[var(--radius-sm)] font-mono text-[11px] text-text-3",
            "transition-colors duration-[var(--motion-duration-fast)] ease-out hover:text-text-2",
            "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-inset)]",
            "motion-reduce:transition-none",
          )}
        >
          <History className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
          {open ? "Hide earlier versions" : "Earlier versions"}
        </button>
        <a
          href={`/api/stories/bundle?id=${encodeURIComponent(storyId)}`}
          download
          className="inline-flex min-h-[36px] items-center rounded-[var(--radius-sm)] font-mono text-[11px] text-text-3 no-underline transition-colors duration-[var(--motion-duration-fast)] ease-out hover:text-text-2 focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-inset)] motion-reduce:transition-none"
        >
          Export bundle
        </a>
      </div>
      {open ? (
        <div className="pt-1 pb-2">
          {loading ? (
            <p className="m-0 py-2 font-mono text-[11px] text-text-3">Loading versions…</p>
          ) : error ? (
            <p className="m-0 py-2 text-sm text-danger-text" role="alert">
              {error}
            </p>
          ) : entries.length === 0 ? (
            <p className="m-0 py-2 font-mono text-[11px] text-text-3">
              No earlier versions yet. The app snapshots this story whenever it changes.
            </p>
          ) : (
            <ul className="m-0 grid list-none gap-1 p-0">
              {entries.map((entry) => {
                const summary = diffSummary(entry);
                return (
                  <li
                    key={entry.name}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-sm)] px-2 py-[7px] hover:bg-fill-1"
                  >
                    <span className="min-w-0 flex-1 basis-48">
                      <span className="block truncate text-sm font-medium text-text">
                        {entry.title}
                      </span>
                      <span className="block font-mono text-[11px] text-text-3">
                        {relativeTime(entry.updatedAt, now)} · {plural(entry.steps, "step")}
                        {summary ? ` · ${summary}` : ""}
                      </span>
                    </span>
                    {!entry.valid ? (
                      <span className="font-mono text-[11px] text-danger-text">unreadable</span>
                    ) : (
                      <>
                        <a
                          href={`${routeBase}/review?story=${encodeURIComponent(entry.id)}`}
                          className="rounded-[var(--radius-sm)] px-2 py-1 font-mono text-[11px] text-accent-text no-underline hover:bg-accent-soft focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-inset)]"
                        >
                          Open
                        </a>
                        <button
                          type="button"
                          disabled={restoring !== null}
                          aria-busy={restoring === entry.name || undefined}
                          onClick={() => restore(entry)}
                          className={cn(
                            "rounded-[var(--radius-sm)] px-2 py-1 font-mono text-[11px] text-text-2",
                            "transition-colors duration-[var(--motion-duration-fast)] ease-out hover:bg-fill-2 hover:text-text",
                            "disabled:opacity-55",
                            "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-inset)]",
                            "motion-reduce:transition-none",
                          )}
                        >
                          {restoring === entry.name ? "Restoring…" : "Restore"}
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="ds-sr-only" role="status">
            {status}
          </p>
        </div>
      ) : null}
    </div>
  );
}
