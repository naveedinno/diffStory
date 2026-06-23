import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { DATA_DIR, LEGACY_STORY_FILENAME, STORY_FILENAME, dataDir } from './config.js';
import { loadTour } from './tour.js';
const NAMED_STORIES_DIR = 'stories';
/** Stories saved for a repo, in the order the app should present them. */
export function listStories(repo) {
    const ids = [
        STORY_FILENAME,
        LEGACY_STORY_FILENAME,
        ...namedStoryIds(repo).sort((a, b) => a.localeCompare(b)),
    ];
    return ids
        .map((id) => storySummary(repo, id))
        .filter((s) => s !== null);
}
/** Resolve a story id from listStories() back to a real path, or null if it is not known. */
export function storyPathForId(repo, id) {
    return listStories(repo).find((s) => s.id === id)?.path ?? null;
}
function namedStoryIds(repo) {
    const dir = join(dataDir(repo), NAMED_STORIES_DIR);
    if (!existsSync(dir))
        return [];
    return readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.json'))
        .map((e) => join(NAMED_STORIES_DIR, e.name));
}
function storySummary(repo, id) {
    const path = join(repo, DATA_DIR, id);
    if (!existsSync(path))
        return null;
    const updatedAt = statSync(path).mtimeMs;
    try {
        const story = loadTour(path);
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
        };
    }
    catch (e) {
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
            error: e.message,
        };
    }
}
function storyScope(base, head) {
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
            description: base === 'HEAD'
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
function shortRef(ref) {
    return /^[0-9a-f]{40}$/i.test(ref) ? ref.slice(0, 7) : ref;
}
