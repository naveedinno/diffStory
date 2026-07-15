// The one mutable thing the server holds: which repo is open and what to diff.
// Single-window app → one session is enough, and matches the existing
// "one agent run at a time" invariant.
import { randomBytes } from 'node:crypto';

export type ReviewPageMode = 'full' | 'since';

/**
 * Server-issued identity for one rendered review page. Lazy requests and
 * verdicts use this lease instead of trusting mutable browser fields or the
 * session's latest navigation state.
 */
export interface ReviewPageLease {
  token: string;
  repo: string;
  base: string;
  head?: string;
  fingerprint: string;
  scopeKey: string;
  mode: ReviewPageMode;
  from?: string;
  /** Exact content identity of the since-feedback snapshot named by `from`. */
  fromSnapshotDigest?: string;
  storyIdentity: string;
  /** Per-file evidence rendered by this page. This lets an unchanged file stay
   * reviewable when an unrelated file moves, without weakening whole-review
   * actions such as approval. */
  fileFingerprints: Record<string, string>;
}

export interface Session {
  repo: string | null;
  base?: string;
  head?: string;
  selectedStory?: string | null;
  chooseStory: boolean;
  reviewPageLease?: ReviewPageLease;
}

export type SessionEntryScreen = 'stories' | 'review';

export function createSession(init: { repo: string | null; base?: string; head?: string }): Session {
  return {
    repo: init.repo,
    base: init.base,
    head: init.head,
    chooseStory: true,
  };
}

/** Replace the prior single-window page lease and return the newly issued one. */
export function issueReviewPageLease(
  session: Session,
  input: Omit<ReviewPageLease, 'token'>,
): ReviewPageLease {
  const lease: ReviewPageLease = {
    token: randomBytes(18).toString('base64url'),
    ...input,
  };
  session.reviewPageLease = lease;
  return lease;
}

/** Resolve a caller's opaque token to the currently issued page lease. */
export function getReviewPageLease(session: Session, token: string | undefined): ReviewPageLease | undefined {
  if (!token || session.reviewPageLease?.token !== token) return undefined;
  return session.reviewPageLease;
}

export function clearReviewPageLease(session: Session): void {
  session.reviewPageLease = undefined;
}

/**
 * Pick the repo's primary entry surface.
 *
 * Review history is the repo's front door. A session only resumes the review
 * workspace when the user already selected a concrete story; otherwise it
 * starts from the saved-review overview.
 */
export function sessionEntryScreen(s: Session): SessionEntryScreen {
  return !s.chooseStory && typeof s.selectedStory === 'string' ? 'review' : 'stories';
}

/** Open a repo: set it and clear any prior base/head selection. */
export function openSession(s: Session, repo: string): void {
  s.repo = repo;
  s.base = undefined;
  s.head = undefined;
  s.selectedStory = undefined;
  s.chooseStory = true;
  clearReviewPageLease(s);
}

/** Close the current repo, returning to the picker. */
export function closeSession(s: Session): void {
  s.repo = null;
  s.base = undefined;
  s.head = undefined;
  s.selectedStory = undefined;
  s.chooseStory = true;
  clearReviewPageLease(s);
}
