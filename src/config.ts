// Names and paths in one place — renaming the tool is a single-file change.
import { join } from 'node:path';

/** Lowercase identifier: the CLI command, package name, log prefix. */
export const APP_NAME = 'diffstory';
/** Display brand used in the UI wordmark and page title. */
export const APP_BRAND = 'diffStory';
export const DATA_DIR = '.diffstory';
export const TOUR_FILENAME = 'review-tour.json';
export const COMMENTS_FILENAME = 'comments.json';
export const DEFAULT_PORT = 7777;

/** How many lines of context to ask git for around each change. */
export const DIFF_CONTEXT_LINES = 3;

export function dataDir(repo: string): string {
  return join(repo, DATA_DIR);
}
export function tourPath(repo: string): string {
  return join(repo, DATA_DIR, TOUR_FILENAME);
}
export function commentsPath(repo: string): string {
  return join(repo, DATA_DIR, COMMENTS_FILENAME);
}
