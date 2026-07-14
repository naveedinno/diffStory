// The one mutable thing the server holds: which repo is open and what to diff.
// Single-window app → one session is enough, and matches the existing
// "one agent run at a time" invariant.
import { randomBytes } from 'node:crypto';
export function createSession(init) {
    return {
        repo: init.repo,
        base: init.base,
        head: init.head,
        chooseStory: true,
    };
}
/** Replace the prior single-window page lease and return the newly issued one. */
export function issueReviewPageLease(session, input) {
    const lease = {
        token: randomBytes(18).toString('base64url'),
        ...input,
    };
    session.reviewPageLease = lease;
    return lease;
}
/** Resolve a caller's opaque token to the currently issued page lease. */
export function getReviewPageLease(session, token) {
    if (!token || session.reviewPageLease?.token !== token)
        return undefined;
    return session.reviewPageLease;
}
export function clearReviewPageLease(session) {
    session.reviewPageLease = undefined;
}
/**
 * Pick the repo's primary entry surface.
 *
 * Saved review history is an explicit destination, not an interstitial. A
 * session only resumes the review workspace when the user already selected a
 * concrete story; otherwise it enters through scope selection.
 */
export function sessionEntryScreen(s) {
    return !s.chooseStory && typeof s.selectedStory === 'string' ? 'review' : 'change';
}
/** Open a repo: set it and clear any prior base/head selection. */
export function openSession(s, repo) {
    s.repo = repo;
    s.base = undefined;
    s.head = undefined;
    s.selectedStory = undefined;
    s.chooseStory = true;
    clearReviewPageLease(s);
}
/** Close the current repo, returning to the picker. */
export function closeSession(s) {
    s.repo = null;
    s.base = undefined;
    s.head = undefined;
    s.selectedStory = undefined;
    s.chooseStory = true;
    clearReviewPageLease(s);
}
