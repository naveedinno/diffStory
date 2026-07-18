// Slim review-scope helpers for the one-shot Notes model (Signal 3b).
//
// The versioned rounds/verdicts/snapshots machinery that used to live here
// (review-state.json: checkpoints, approval gating, timelines, since-review
// diffs) was removed with the 3b port: feedback is a note — written, sent,
// addressed, resolved — the agent rewrites, the story regenerates, and the
// next review starts clean. What survives is the scope identity and the diff
// fingerprint that bind a page, its story, and its notes to the exact change.
import { createHash } from 'node:crypto';
import { loadCommentsWithHealth, type CommentStoreHealth } from './comments.js';
import type { DiffFile } from './types.js';

export interface ReviewStateSummary {
  scopeKey: string;
  /** Stable identity for the exact rendered diff bytes. */
  currentDiffHash: string;
  /** Invalid feedback must stay visible instead of reading as "no comments". */
  feedbackHealth: CommentStoreHealth;
}

export function reviewScopeKey(base: string, head?: string): string {
  return createHash('sha256').update(`${base}\0${head ?? 'working-tree'}`).digest('hex').slice(0, 20);
}

/** Stable identity for the exact rendered diff bytes. */
export function reviewDiffFingerprint(diff: string): string {
  return createHash('sha256').update(diff).digest('hex');
}

export function reviewStateSummary(
  repo: string,
  base: string,
  head: string | undefined,
  diff: string,
  _files: DiffFile[],
  changeFingerprint?: string,
): ReviewStateSummary {
  const feedback = loadCommentsWithHealth(repo);
  return {
    scopeKey: reviewScopeKey(base, head),
    currentDiffHash: changeFingerprint ?? reviewDiffFingerprint(diff),
    feedbackHealth: feedback.health,
  };
}
