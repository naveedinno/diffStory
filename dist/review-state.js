// Slim review-scope helpers for the one-shot Notes model (Signal 3b).
//
// The versioned rounds/verdicts/snapshots machinery that used to live here
// (review-state.json: checkpoints, approval gating, timelines, since-review
// diffs) was removed with the 3b port: feedback is a note — written, sent,
// addressed, resolved — the agent rewrites, the story regenerates, and the
// next review starts clean. What survives is the scope identity and the diff
// fingerprint that bind a page, its story, and its notes to the exact change.
import { createHash } from 'node:crypto';
import { loadCommentsWithHealth } from './comments.js';
export function reviewScopeKey(base, head) {
    return createHash('sha256').update(`${base}\0${head ?? 'working-tree'}`).digest('hex').slice(0, 20);
}
/** Stable identity for the exact rendered diff bytes. */
export function reviewDiffFingerprint(diff) {
    return createHash('sha256').update(diff).digest('hex');
}
export function reviewStateSummary(repo, base, head, diff, _files, changeFingerprint) {
    const feedback = loadCommentsWithHealth(repo);
    return {
        scopeKey: reviewScopeKey(base, head),
        currentDiffHash: changeFingerprint ?? reviewDiffFingerprint(diff),
        feedbackHealth: feedback.health,
    };
}
