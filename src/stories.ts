import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, join, relative, sep } from 'node:path';
import { DATA_DIR, LEGACY_STORY_FILENAME, STORY_FILENAME, dataDir } from './config.js';
import { loadTour } from './tour.js';
import { getDiff, resolveBase } from './git.js';
import { parseUnifiedDiff } from './diff.js';
import { loadComments } from './comments.js';
import { isCodeStep, type StoryMode } from './types.js';

export interface StorySummary {
  id: string;
  path: string;
  title: string;
  summary: string;
  mode: StoryMode;
  base?: string;
  head?: string;
  scope: StoryScope;
  updatedAt: number;
  valid: boolean;
  error?: string;
  /** Number of steps in the reading order (0 when the story is invalid). */
  steps: number;
  /** Number of document-style concept primers in the reading order. */
  primers: number;
  /** Distinct files the steps touch (0 when invalid). */
  files: number;
  /** True only when the story fingerprint exactly matches its current git diff. */
  current: boolean;
  freshness: 'current' | 'stale' | 'unverified';
  /** Live review-session facts derived from the current diff and feedback state. */
  liveFiles: number;
  additions: number;
  deletions: number;
  openComments: number;
  addressedComments: number;
}

export interface StoryScope {
  label: string;
  description: string;
  command: string;
}

const NAMED_STORIES_DIR = 'stories';

/** Stories saved for a repo, in the order the app should present them. */
export function listStories(repo: string): StorySummary[] {
  const ids = [
    STORY_FILENAME,
    LEGACY_STORY_FILENAME,
    ...namedStoryIds(repo).sort((a, b) => a.localeCompare(b)),
  ];
  return ids
    .map((id) => storySummary(repo, id))
    .filter((s): s is StorySummary => s !== null);
}

/** Resolve a story id from listStories() back to a real path, or null if it is not known. */
export function storyPathForId(repo: string, id: string): string | null {
  return listStories(repo).find((s) => s.id === id)?.path ?? null;
}

/** Delete a known story file by id. Unknown ids are ignored so callers cannot escape `.diffstory`. */
export function deleteStory(repo: string, id: string): boolean {
  const path = storyPathForId(repo, id);
  if (!path) return false;
  unlinkSync(path);
  return true;
}

/** True when the repo has at least one primary, legacy, or named story file. */
export function hasStories(repo: string): boolean {
  return listStories(repo).length > 0;
}

function namedStoryIds(repo: string): string[] {
  const dir = join(dataDir(repo), NAMED_STORIES_DIR);
  if (!existsSync(dir)) return [];
  const ids: string[] = [];
  const walk = (current: string) => {
    for (const e of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, e.name);
      if (e.isDirectory()) {
        walk(path);
      } else if (e.isFile() && e.name.endsWith('.json')) {
        ids.push(join(NAMED_STORIES_DIR, relative(dir, path)).split(sep).join('/'));
      }
    }
  };
  walk(dir);
  return ids;
}

function storySummary(repo: string, id: string): StorySummary | null {
  const path = join(repo, DATA_DIR, id);
  if (!existsSync(path)) return null;
  const updatedAt = statSync(path).mtimeMs;
  try {
    const story = loadTour(path);
    const session = storySession(repo, story.base, story.head, story.diffFingerprint);
    return {
      id,
      path,
      title: story.title,
      summary: story.summary,
      mode: story.mode ?? 'guided',
      base: story.base,
      head: story.head,
      scope: storyScope(story.base, story.head),
      updatedAt,
      valid: true,
      steps: story.steps.length,
      primers: story.steps.filter((step) => step.kind === 'concept').length,
      files: new Set(story.steps.filter(isCodeStep).map((step) => step.file)).size,
      current: session.freshness === 'current',
      ...session,
    };
  } catch (e) {
    return {
      id,
      path,
      title: basename(id, '.json'),
      summary: '',
      mode: 'guided',
      scope: {
        label: 'Unknown diff scope',
        description: 'Fix the story JSON before diffStory can read what this story covers.',
        command: '',
      },
      updatedAt,
      valid: false,
      error: (e as Error).message,
      steps: 0,
      primers: 0,
      files: 0,
      current: false,
      freshness: 'unverified',
      liveFiles: 0,
      additions: 0,
      deletions: 0,
      openComments: 0,
      addressedComments: 0,
    };
  }
}

/** Stable identity for the exact diff a story was written against. */
export function diffFingerprint(diff: string): string {
  return createHash('sha256').update(diff).digest('hex');
}

function storySession(
  repo: string,
  base?: string,
  head?: string,
  expected?: string,
): Pick<
  StorySummary,
  | 'freshness'
  | 'liveFiles'
  | 'additions'
  | 'deletions'
  | 'openComments'
  | 'addressedComments'
> {
  const empty = {
    freshness: 'unverified' as const,
    liveFiles: 0,
    additions: 0,
    deletions: 0,
    openComments: 0,
    addressedComments: 0,
  };
  try {
    const resolvedBase = resolveBase(repo, base);
    const diff = getDiff(repo, resolvedBase, head);
    const files = parseUnifiedDiff(diff);
    const comments = loadComments(repo);
    let additions = 0;
    let deletions = 0;
    for (const file of files) {
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (line.type === 'add') additions++;
          if (line.type === 'del') deletions++;
        }
      }
    }
    return {
      freshness: expected ? (diffFingerprint(diff) === expected ? 'current' : 'stale') : 'unverified',
      liveFiles: files.length,
      additions,
      deletions,
      openComments: comments.filter((comment) => comment.status === 'open').length,
      addressedComments: comments.filter((comment) => comment.status === 'addressed').length,
    };
  } catch {
    return empty;
  }
}

function storyScope(base?: string, head?: string): StoryScope {
  if (base && head) {
    return {
      label: `${shortRef(base)}..${shortRef(head)}`,
      description: `Commits reachable from ${head} after ${base}; this does not include uncommitted working-tree edits.`,
      command: `git diff ${base}..${head} --`,
    };
  }
  if (base) {
    return {
      label: base === 'HEAD' ? 'Working tree vs HEAD' : `Working tree vs ${shortRef(base)}`,
      description:
        base === 'HEAD'
          ? 'Tracked changes in the current working tree compared with the latest commit.'
          : `Tracked changes in the current working tree compared with ${base}.`,
      command: `git diff ${base} --`,
    };
  }
  return {
    label: 'Default app scope',
    description: 'Uses the app default base when opened, usually branch vs default branch or working tree vs HEAD.',
    command: 'git diff <resolved-base> --',
  };
}

function shortRef(ref: string): string {
  return /^[0-9a-f]{40}$/i.test(ref) ? ref.slice(0, 7) : ref;
}
