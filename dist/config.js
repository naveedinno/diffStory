// Names and paths in one place — renaming the tool is a single-file change.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
/** Lowercase identifier: the CLI command, package name, log prefix. */
export const APP_NAME = 'diffstory';
/** Display brand used in the UI wordmark and page title. */
export const APP_BRAND = 'diffStory';
export const DATA_DIR = '.diffstory';
export const STORY_FILENAME = 'story.json';
export const LEGACY_STORY_FILENAME = 'review-tour.json';
export const COMMENTS_FILENAME = 'comments.json';
export const DEFAULT_PORT = 7777;
/** How many lines of context to ask git for around each change. */
export const DIFF_CONTEXT_LINES = 3;
export function dataDir(repo) {
    return join(repo, DATA_DIR);
}
export function storyPath(repo) {
    return join(repo, DATA_DIR, STORY_FILENAME);
}
export function legacyStoryPath(repo) {
    return join(repo, DATA_DIR, LEGACY_STORY_FILENAME);
}
/** Path to load: story.json if present, else the legacy review-tour.json, else story.json. */
export function resolveStoryPath(repo) {
    const p = storyPath(repo);
    if (existsSync(p))
        return p;
    const legacy = legacyStoryPath(repo);
    return existsSync(legacy) ? legacy : p;
}
export function commentsPath(repo) {
    return join(repo, DATA_DIR, COMMENTS_FILENAME);
}
