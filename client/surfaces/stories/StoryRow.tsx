// One saved review.
//
// The whole row is a link to `<routeBase>/review?story=<id>` — a real anchor, a
// real URL, and a real document navigation. Opening a story has server-side
// consequences (`applyStoryChoice` writes `session.selectedStory` and persists
// it so a restart resumes there), which is exactly why this is not a click
// handler: the server has to see the request.
//
// The delete control is a sibling of that anchor, not a descendant, because a
// button inside an anchor is invalid HTML and behaves differently across
// browsers. It is absolutely positioned into the card's top-right corner and
// carries its own hit-slop.
//
// Two facts are gated on live evidence rather than always shown:
//   - `+A −D` only exists when the diff was actually rebuilt. The metadata
//     projection reports zeroes, and "+0 −0" would be a lie, not a placeholder.
//   - the badge itself — see the ordering note in `story-state.ts`.

import { ChevronRight, Trash2 } from "lucide-react";
import { AnimatedBadge, type AnimatedBadgeStatus } from "../../vendor/beui/motion/animated-badge";
import type { StoryRowView } from "../../../src/payloads";
import { cn } from "../../shared/cn";
import { plural, relativeTime } from "./format";
import { BADGE_CLASS, BLUE_INK, GREEN_INK, storyState, type StoryTone } from "./story-state";

/** beUI's semantic status, so the badge picks the icon-free variant it knows. */
const BADGE_STATUS: Record<StoryTone, AnimatedBadgeStatus> = {
  bad: "danger",
  saved: "neutral",
  feedback: "info",
  warn: "warning",
  ready: "success",
};

export interface StoryRowProps {
  story: StoryRowView;
  /** Zero-based position; rendered as a two-digit ordinal. */
  index: number;
  routeBase: string;
  now: number;
  liveEvidence: boolean;
  busy: boolean;
  onRemove: (story: StoryRowView) => void;
}

function Fact({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-l border-line-soft px-[11px] first:border-l-0 first:pl-0 max-[460px]:px-2">
      {children}
    </span>
  );
}

export function StoryRow({ story, index, routeBase, now, liveEvidence, busy, onRemove }: StoryRowProps) {
  const state = storyState(story, liveEvidence);
  // Fallbacks live here, not in the payload: the route ships what the story
  // authored, and an empty field is a presentation question.
  const title = story.title || story.id;
  const summary = story.valid
    ? story.summary || "No summary yet."
    : story.error || "This story file could not be read.";
  const codeStops = Math.max(0, story.steps - story.primers);
  const href = `${routeBase}/review?story=${encodeURIComponent(story.id)}`;

  return (
    <article
      className={cn(
        // `story-row` is the UI-atlas evidence selector for this surface
        // (scripts/capture-ui-atlas.mjs) — a capture only counts as coverage if
        // it can find a real row.
        "story-row relative block overflow-hidden rounded-[var(--radius-island)] border border-transparent bg-surface-2",
        "transition-[border-color,box-shadow] duration-[var(--motion-duration-fast)] ease-out",
        "focus-within:border-accent-line contrast-more:border-text",
        // Same spatial tier as the page, and no per-row delay: every row lands
        // together, as the vanilla `history-row-in` did.
        "ds-reveal",
      )}
    >
      <a
        href={href}
        className={cn(
          // `group` is on the anchor, not the card: the Resume pill reacts to
          // hovering the link, and hovering the delete button must not make the
          // row look like it is about to open.
          "row-main group relative grid min-h-[132px] grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3.5 px-[19px] py-[15px]",
          "text-inherit no-underline transition-colors duration-[var(--motion-duration-fast)] ease-out",
          "hover:bg-fill-1 active:bg-fill-2",
          // Inset, because the card clips overflow and an outset ring would be
          // cut off on three sides.
          "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--accent-soft)]",
          "motion-reduce:transition-none",
          "max-[760px]:grid-cols-[24px_minmax(0,1fr)] max-[760px]:gap-3 max-[760px]:px-[19px] max-[760px]:pt-4 max-[760px]:pb-[15px]",
        )}
      >
        <span
          aria-hidden="true"
          className="self-start pt-0.5 font-mono text-[11px] font-semibold tracking-[-.01em] text-[var(--numeral)]"
        >
          {String(index + 1).padStart(2, "0")}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
          <span className="flex min-w-0 items-center gap-2 max-[760px]:pr-11 max-[460px]:flex-col max-[460px]:items-start">
            <span className="min-w-0 truncate text-[15.5px] font-semibold tracking-[-.01em] max-[460px]:line-clamp-2 max-[460px]:whitespace-normal max-[460px]:leading-[1.28]">
              {title}
            </span>
            <AnimatedBadge
              status={BADGE_STATUS[state.tone]}
              size="sm"
              showIcon={false}
              contentKey={state.label}
              className={cn(
                "h-auto flex-none rounded-[var(--radius-sm)] border-0 px-[7px] py-[3px]",
                "font-mono text-[9.5px] font-semibold tracking-[var(--tracking-kicker)] uppercase",
                BADGE_CLASS[state.tone],
              )}
            >
              {state.label}
            </AnimatedBadge>
          </span>

          <span
            className={cn(
              "line-clamp-2 text-[13.5px] leading-[1.42]",
              story.valid ? "text-text-2" : "text-del",
            )}
          >
            {summary}
          </span>

          <span className="mt-[5px] flex flex-wrap items-center font-mono text-[11px] text-text-2 max-[460px]:leading-[1.65]">
            <Fact>
              <b className="text-text tabular-nums">{story.liveFiles || story.files}</b> files
            </Fact>
            {liveEvidence ? (
              <Fact>
                <b className={cn("tabular-nums", GREEN_INK)}>+{story.additions}</b>{" "}
                <b className="ml-[3px] text-del tabular-nums">−{story.deletions}</b>
              </Fact>
            ) : null}
            <Fact>
              <b className="text-text tabular-nums">{codeStops}</b> code stops
              {story.primers ? ` + ${plural(story.primers, "primer")}` : ""}
            </Fact>
            {story.openComments ? (
              <Fact>
                <b className="text-text tabular-nums">{story.openComments}</b> queued{" "}
                {story.openComments === 1 ? "comment" : "comments"}
              </Fact>
            ) : null}
          </span>

          <span
            className={cn(
              "mt-[3px] flex flex-wrap items-center gap-2 font-mono text-[11px] text-text-3",
              "max-[460px]:grid max-[460px]:grid-cols-[auto_minmax(0,1fr)] max-[460px]:items-center max-[460px]:gap-x-2 max-[460px]:gap-y-[5px]",
            )}
          >
            <span
              className="rounded-[var(--radius-sm)] bg-fill-3 px-[7px] py-0.5 font-mono text-[11.5px] tracking-normal text-text"
              title={story.scope.command || undefined}
            >
              {story.scope.label}
            </span>
            <span className="opacity-55 max-[460px]:hidden" aria-hidden="true">
              ·
            </span>
            <span className="max-[460px]:col-span-2 max-[460px]:row-start-2 max-[460px]:leading-[1.35]">
              {state.detail}
            </span>
            <span className="opacity-55 max-[460px]:hidden" aria-hidden="true">
              ·
            </span>
            <span className="max-[460px]:col-start-2 max-[460px]:row-start-1 max-[460px]:justify-self-start">
              {relativeTime(story.updatedAt, now)}
            </span>
          </span>
        </span>

        <span
          className={cn(
            "inline-flex min-h-[34px] items-center justify-center gap-[5px] rounded-full border border-transparent bg-accent-soft px-[13px]",
            "text-[12.5px] font-semibold whitespace-nowrap",
            "transition-colors duration-[var(--motion-duration-fast)] ease-out",
            "group-hover:bg-[color-mix(in_srgb,var(--accent-soft)_72%,var(--surface))]",
            "max-[760px]:col-start-2 max-[760px]:mt-0.5 max-[760px]:justify-self-start",
            BLUE_INK,
          )}
        >
          Resume review
          <ChevronRight
            // The nudge is behind hover:hover — a touch device fires a false
            // hover on tap, so without the gate the chevron jumps on every tap.
            // That gate also makes a motion-reduce override redundant here.
            className="h-3.5 w-3.5 transition-transform duration-[var(--motion-duration-fast)] ease-out motion-reduce:transition-none [@media(hover:hover)and(pointer:fine)]:group-hover:translate-x-0.5"
            strokeWidth={2}
          />
        </span>
      </a>

      {/* Outside the anchor, and the handler lives on the button itself — never
          on an ancestor resolving the target with closest(), which is the WebKit
          nested-<svg> bug the recents list was fixed for. */}
      <button
        type="button"
        disabled={busy}
        aria-busy={busy || undefined}
        title="Remove story"
        aria-label={`Remove ${title}`}
        onClick={() => onRemove(story)}
        className={cn(
          "absolute top-[13px] right-[13px] z-[2] grid h-[34px] w-[34px] place-items-center",
          "rounded-full border border-transparent bg-transparent text-text-3",
          "after:absolute after:-inset-1 after:content-['']",
          "transition-[border-color,background-color,color,transform] duration-[var(--motion-duration-fast)] ease-out",
          "hover:border-[color-mix(in_srgb,var(--del)_24%,transparent)] hover:bg-del-soft hover:text-del",
          // .97, matching every other small control. A 6% dip made the one
          // destructive button in the app the springiest thing in it.
          "active:scale-[.97] disabled:opacity-55",
          "contrast-more:border-text",
          "motion-reduce:transition-none motion-reduce:active:transform-none",
        )}
      >
        <Trash2 className="h-[15px] w-[15px]" strokeWidth={1.9} />
      </button>
    </article>
  );
}
