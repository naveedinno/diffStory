// The one mutable thing the server holds: which repo is open and what to diff.
// One active repository still matches the existing "one agent run at a time"
// invariant, while a small lease registry lets several tabs review that repo.
import { randomBytes } from 'node:crypto';
import { REVIEW_PAGE_LEASE_LIMIT, REVIEW_PAGE_LEASE_TTL_MS } from './config.js';

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
  /** Selected story file watched for content drift, including storyless generation. */
  storyPath: string;
  /** Raw content identity at render time; "missing" is a valid initial state. */
  storyFingerprint: string;
  expiresAt: number;
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
  reviewPageLeases: Map<string, ReviewPageLease>;
}

export type SessionEntryScreen = 'stories' | 'review';

export function createSession(init: { repo: string | null; base?: string; head?: string }): Session {
  return {
    repo: init.repo,
    base: init.base,
    head: init.head,
    chooseStory: true,
    reviewPageLeases: new Map(),
  };
}

function pruneReviewPageLeases(session: Session, now: number): void {
  for (const [token, lease] of session.reviewPageLeases) {
    if (lease.expiresAt <= now) session.reviewPageLeases.delete(token);
  }
  while (session.reviewPageLeases.size >= REVIEW_PAGE_LEASE_LIMIT) {
    const oldest = session.reviewPageLeases.keys().next().value as string | undefined;
    if (!oldest) break;
    session.reviewPageLeases.delete(oldest);
  }
}

/** Issue an opaque, bounded lease without invalidating other tabs for this repo. */
export function issueReviewPageLease(
  session: Session,
  input: Omit<ReviewPageLease, 'token' | 'expiresAt'>,
  now = Date.now(),
): ReviewPageLease {
  pruneReviewPageLeases(session, now);
  const lease: ReviewPageLease = {
    token: randomBytes(18).toString('base64url'),
    ...input,
    expiresAt: now + REVIEW_PAGE_LEASE_TTL_MS,
  };
  session.reviewPageLeases.set(lease.token, lease);
  return lease;
}

/** Resolve and renew a caller's opaque token. Expired leases disappear eagerly. */
export function getReviewPageLease(
  session: Session,
  token: string | undefined,
  now = Date.now(),
): ReviewPageLease | undefined {
  if (!token) return undefined;
  const lease = session.reviewPageLeases.get(token);
  if (!lease) return undefined;
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

export function clearReviewPageLeases(session: Session): void {
  session.reviewPageLeases.clear();
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
  clearReviewPageLeases(s);
}

/** Close the current repo, returning to the picker. */
export function closeSession(s: Session): void {
  s.repo = null;
  s.base = undefined;
  s.head = undefined;
  s.selectedStory = undefined;
  s.chooseStory = true;
  clearReviewPageLeases(s);
}
