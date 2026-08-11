// The saved-review badge state machine.
//
// `server-shell-contract.md` calls this "the one piece of real logic on this
// surface", and it is pure presentation over a `StoryRowView`, so it ports as-is
// from `storyRow()` in the deleted `src/story-picker.ts`.
//
// ORDER IS THE BEHAVIOUR. First match wins, and two of the branches only make
// sense because of what precedes them:
//
//   - `Saved` sits second so that a payload built by `listStoryMetadata()` can
//     never fall through into a freshness verdict. That projection reports
//     `freshness: 'unverified'` and zeroes for additions/deletions/comments
//     because it never rebuilt the diff — presenting that as "Verify scope"
//     would be the page inventing a finding out of work it declined to do.
//   - `In review` outranks every freshness state: an open note is a person
//     waiting, and it matters more than whether the diff has moved.
//
// `Saved` is also the one label with no colour rule of its own; it falls through
// to the neutral badge. That is intentional, not an oversight.

import type { StoryRowView } from "../../../src/payloads";
import { plural } from "./format";

export type StoryTone = "bad" | "saved" | "feedback" | "warn" | "ready";

export interface StoryState {
  label: string;
  tone: StoryTone;
  /** The one-line explanation rendered in the row footer. */
  detail: string;
}

/**
 * @param liveEvidence `StoriesPayload.liveEvidence` — whether anything in this
 *   payload was measured against the current working tree at all.
 */
export function storyState(story: StoryRowView, liveEvidence: boolean): StoryState {
  if (!story.valid) {
    return { label: "Needs repair", tone: "bad", detail: "Story file cannot be read" };
  }
  if (!liveEvidence) {
    return { label: "Saved", tone: "saved", detail: "Open to inspect current review evidence" };
  }
  if (story.openComments) {
    return {
      label: "In review",
      tone: "feedback",
      detail: `${plural(story.openComments, "open note")} waiting`,
    };
  }
  if (story.freshness === "stale") {
    return {
      label: "Story changed",
      tone: "warn",
      detail: story.inStoryDrift
        ? `${plural(story.inStoryDrift, "story file")} changed${
            story.outsideStoryDrift ? ` · ${plural(story.outsideStoryDrift, "side file")} also changed` : ""
          }`
        : "Regenerate the story for the current diff",
    };
  }
  if (story.freshness === "unverified") {
    return {
      label: "Verify scope",
      tone: "warn",
      detail: "Regenerate to establish a scope-aware baseline",
    };
  }
  return {
    label: "Current",
    tone: "ready",
    detail: story.outsideStoryDrift
      ? `Story current · ${plural(story.outsideStoryDrift, "side file")} changed`
      : "Story matches its captured scope",
  };
}

/**
 * Badge colours per tone.
 *
 * The vanilla stylesheet reached these through three aliases —
 * `--story-blue-ink`, `--story-green-ink`, `--story-amber-ink` — that existed
 * only to swap in darker inks under `[data-theme="light"]`, where the dark
 * theme's accent/add/amber do not carry enough contrast on a pale badge. The
 * `light:` Tailwind variant is that same `[data-theme="light"]` selector, so the
 * aliases are inlined here rather than reintroduced as custom properties.
 */
/**
 * `--story-blue-ink`: the Resume pill and the "In review" badge share it.
 *
 * `#005cae` used to be spelled here as a literal, twice. It is now
 * `--accent-text` in `src/theme.ts` — the same shape as `--diff-add-text` —
 * because this surface was not the only place that needed it: the nav crumb,
 * the change page's stage rail and the picker's wordmark all paint Signal blue
 * as small text, and all four read 4.20:1 in light before the token existed.
 */
export const BLUE_INK = "text-accent-text";
/** `--story-green-ink`: the `+N` additions fact. */
export const GREEN_INK = "text-add light:text-diff-add-text";
/**
 * `--story-red-ink`: the `−N` deletions fact and the `bad` badge.
 *
 * The mirror of GREEN_INK, and it was missing. Every tone in BADGE_CLASS below
 * carries a `light:` override because the light theme's rail hues (`--add`,
 * `--del`) are tuned for bars and fills, not for 11 px numerals — `src/theme.ts`
 * ships `--diff-add-text` / `--diff-del-text` as the AA-safe ink for exactly
 * that. Additions had the override and deletions did not, so `−N` and the `bad`
 * badge sat at 4.28:1 in light while `+N` beside them sat at 5.47:1. In dark
 * both tokens alias the rail hue, so this is a no-op there.
 */
export const RED_INK = "text-del light:text-diff-del-text";

export const BADGE_CLASS: Record<StoryTone, string> = {
  bad: `${RED_INK} bg-del-soft`,
  saved: "text-text-2 bg-fill-2",
  feedback: `${BLUE_INK} bg-accent-soft`,
  warn: "text-amber light:text-[#875200] bg-amber-soft",
  ready: "text-add light:text-diff-add-text bg-add-soft",
};
