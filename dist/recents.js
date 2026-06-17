// A small global store of recently-opened repos, kept at ~/.diffstory/recents.json
// (distinct from each repo's local .diffstory/ data dir). The pure `addRecent`
// reducer is unit-tested; the FS wrappers take `home` so tests can use a temp dir.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { DATA_DIR } from './config.js';
const DEFAULT_CAP = 12;
/** Path to the global recents file under a given home directory. */
export function recentsFile(home) {
    return join(home, DATA_DIR, 'recents.json');
}
/** Pure: put `path` at the front with `now`, drop any prior copy, cap the length. */
export function addRecent(list, path, now, cap = DEFAULT_CAP) {
    const rest = list.filter((e) => e.path !== path);
    return [{ path, lastOpened: now }, ...rest].slice(0, cap);
}
/** Read the recents list; tolerate a missing or corrupt file by returning []. */
export function loadRecents(home) {
    const file = recentsFile(home);
    if (!existsSync(file))
        return [];
    try {
        const parsed = JSON.parse(readFileSync(file, 'utf8'));
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
/** Write the recents list, creating ~/.diffstory/ if needed. */
export function saveRecents(home, list) {
    const file = recentsFile(home);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(list, null, 2), 'utf8');
}
/** Load, push `path` to the front, persist, and return the new list. */
export function recordRecent(home, path, now) {
    const next = addRecent(loadRecents(home), path, now);
    saveRecents(home, next);
    return next;
}
