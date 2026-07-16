// The one mutable thing the server holds: which repo is open and what to diff.
// One active repository still matches the existing "one agent run at a time"
// invariant, while a small lease registry lets several tabs review that repo.
import { randomBytes } from 'node:crypto';
import { REVIEW_PAGE_LEASE_LIMIT, REVIEW_PAGE_LEASE_TTL_MS } from './config.js';
export function createSession(init) {
    return {
        repo: init.repo,
        base: init.base,
        head: init.head,
        chooseStory: true,
        reviewPageLeases: new Map(),
    };
}
function pruneReviewPageLeases(session, now) {
    for (const [token, lease] of session.reviewPageLeases) {
        if (lease.expiresAt <= now)
            session.reviewPageLeases.delete(token);
    }
    while (session.reviewPageLeases.size >= REVIEW_PAGE_LEASE_LIMIT) {
        const oldest = session.reviewPageLeases.keys().next().value;
        if (!oldest)
            break;
        session.reviewPageLeases.delete(oldest);
    }
}
/** Issue an opaque, bounded lease without invalidating other tabs for this repo. */
export function issueReviewPageLease(session, input, now = Date.now()) {
    pruneReviewPageLeases(session, now);
    const lease = {
        token: randomBytes(18).toString('base64url'),
        ...input,
        expiresAt: now + REVIEW_PAGE_LEASE_TTL_MS,
    };
    session.reviewPageLeases.set(lease.token, lease);
    return lease;
}
/** Resolve and renew a caller's opaque token. Expired leases disappear eagerly. */
export function getReviewPageLease(session, token, now = Date.now()) {
    if (!token)
        return undefined;
    const lease = session.reviewPageLeases.get(token);
    if (!lease)
        return undefined;
    if (lease.expiresAt <= now) {
        session.reviewPageLeases.delete(token);
        return undefined;
    }
    lease.expiresAt = now + REVIEW_PAGE_LEASE_TTL_MS;
    // Map order doubles as our LRU queue. A live tab that renews its lease should
    // not be the next one evicted merely because it was opened first.
    session.reviewPageLeases.delete(token);
    session.reviewPageLeases.set(token, lease);
    return lease;
}
export function clearReviewPageLeases(session) {
    session.reviewPageLeases.clear();
}
/**
 * Pick the repo's primary entry surface.
 *
 * Review history is the repo's front door. A session only resumes the review
 * workspace when the user already selected a concrete story; otherwise it
 * starts from the saved-review overview.
 */
export function sessionEntryScreen(s) {
    return !s.chooseStory && typeof s.selectedStory === 'string' ? 'review' : 'stories';
}
/** Open a repo: set it and clear any prior base/head selection. */
export function openSession(s, repo) {
    // Only a genuine repository switch invalidates the lease registry;
    // re-opening the already-open repo must not strand its live tabs.
    if (s.repo !== repo)
        clearReviewPageLeases(s);
    s.repo = repo;
    s.base = undefined;
    s.head = undefined;
    s.selectedStory = undefined;
    s.chooseStory = true;
}
/** Close the current repo, returning to the picker. */
export function closeSession(s) {
    s.repo = null;
    s.base = undefined;
    s.head = undefined;
    s.selectedStory = undefined;
    s.chooseStory = true;
    clearReviewPageLeases(s);
}
