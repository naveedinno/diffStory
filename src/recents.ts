// A small global store of recently-opened repos, kept at ~/.diffstory/recents.json
// (distinct from each repo's local .diffstory/ data dir). The pure `addRecent`
// reducer is unit-tested; the FS wrappers take `home` so tests can use a temp dir.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { DATA_DIR } from './config.js';

export interface RecentEntry {
  path: string;
  lastOpened: number;
}

const DEFAULT_CAP = 12;

/** Path to the global recents file under a given home directory. */
export function recentsFile(home: string): string {
  return join(home, DATA_DIR, 'recents.json');
}

/** Pure: put `path` at the front with `now`, drop any prior copy, cap the length. */
export function addRecent(
  list: RecentEntry[],
  path: string,
  now: number,
  cap = DEFAULT_CAP,
): RecentEntry[] {
  const rest = list.filter((e) => e.path !== path);
  return [{ path, lastOpened: now }, ...rest].slice(0, cap);
}

/** Read the recents list; tolerate a missing or corrupt file by returning []. */
export function loadRecents(home: string): RecentEntry[] {
  const file = recentsFile(home);
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? (parsed as RecentEntry[]) : [];
  } catch {
    return [];
  }
}

/** Write the recents list, creating ~/.diffstory/ if needed. */
export function saveRecents(home: string, list: RecentEntry[]): void {
  const file = recentsFile(home);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(list, null, 2), 'utf8');
}

/** Load, push `path` to the front, persist, and return the new list. */
export function recordRecent(home: string, path: string, now: number): RecentEntry[] {
  const next = addRecent(loadRecents(home), path, now);
  saveRecents(home, next);
  return next;
}
