// Names and paths in one place — renaming the tool is a single-file change.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Lowercase identifier used for package metadata and log prefixes. */
export const APP_NAME = 'diffstory';
/** Display brand used in the UI wordmark and page title. */
export const APP_BRAND = 'diffStory';
export const DATA_DIR = '.diffstory';
export const STORY_FILENAME = 'story.json';
export const LEGACY_STORY_FILENAME = 'review-tour.json';
export const COMMENTS_FILENAME = 'comments.json';
export const REVIEW_STATE_FILENAME = 'review-state.json';
export const DEFAULT_PORT = 7777;
export const LIVE_DEBOUNCE_MS = 200;
export const LIVE_POLL_MS = 4_000;
export const LIVE_HEARTBEAT_MS = 15_000;
export const REVIEW_PAGE_LEASE_TTL_MS = 12 * 60 * 60 * 1_000;
export const REVIEW_PAGE_LEASE_LIMIT = 24;

/** How many lines of context to ask git for around each change. */
export const DIFF_CONTEXT_LINES = 3;

export function dataDir(repo: string): string {
  return join(repo, DATA_DIR);
}
export function storyPath(repo: string): string {
  return join(repo, DATA_DIR, STORY_FILENAME);
}
export function legacyStoryPath(repo: string): string {
  return join(repo, DATA_DIR, LEGACY_STORY_FILENAME);
}
/** Path to load: story.json if present, else the legacy review-tour.json, else story.json. */
export function resolveStoryPath(repo: string): string {
  const p = storyPath(repo);
  if (existsSync(p)) return p;
  const legacy = legacyStoryPath(repo);
  return existsSync(legacy) ? legacy : p;
}
export function commentsPath(repo: string): string {
  return join(repo, DATA_DIR, COMMENTS_FILENAME);
}
export function reviewStatePath(repo: string): string {
  return join(repo, DATA_DIR, REVIEW_STATE_FILENAME);
}
