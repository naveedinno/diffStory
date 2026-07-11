// Per-repo setup: choose how .diffstory/ is tracked in git, and check the
// producer skill is installed for some agent. Pure FS; no CLI dependencies.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_DIR } from './config.js';
const SHARED_LINE = `${DATA_DIR}/comments.json`;
const LOCAL_LINE = `${DATA_DIR}/`;
const STORYTELLER_SKILL = 'diffstory-storyteller';
const LEGACY_STORYTELLER_SKILL = 'review-tour';
const SKILLS = [STORYTELLER_SKILL, 'address-review'];
/**
 * Edit the repo's .gitignore for the chosen tracking mode (idempotent):
 *  - 'shared': only comments.json is ignored (story.json stays tracked, travels with a PR).
 *  - 'local' : the whole .diffstory/ dir is ignored.
 * Removes the other mode's line so switching modes is clean.
 */
export function setGitignore(repo, mode) {
    const path = join(repo, '.gitignore');
    const lines = existsSync(path) ? readFileSync(path, 'utf8').split('\n') : [];
    const kept = lines.filter((l) => l.trim() !== SHARED_LINE && l.trim() !== LOCAL_LINE);
    while (kept.length && kept[kept.length - 1].trim() === '')
        kept.pop();
    kept.push(mode === 'shared' ? SHARED_LINE : LOCAL_LINE);
    writeFileSync(path, kept.join('\n') + '\n', 'utf8');
}
/** True if the diffStory producer skill is installed for any agent under `home`. */
export function skillsInstalled(home) {
    return skillStatus(home).installed;
}
/**
 * Check whether the installed producer skill exists and matches this CLI bundle.
 * The aggregate `installed`/`current` spans every candidate location; `agents`
 * reports the one directory each agent CLI reads (claude → ~/.claude/skills,
 * codex → ~/.codex/skills), so callers can warn for the agent actually in use.
 */
export function skillStatus(home, expected = bundledStorytellerSkill()) {
    const expectedText = readNormalized(expected);
    const skillRoots = [
        join(home, '.agents', 'skills'),
        join(home, '.claude', 'skills'),
        join(home, '.codex', 'skills'),
    ];
    const candidates = skillRoots.map((root) => {
        const path = join(root, STORYTELLER_SKILL, 'SKILL.md');
        const installed = existsSync(path);
        const current = installed && expectedText != null && readNormalized(path) === expectedText;
        return { path, installed, current };
    });
    const legacyInstalled = skillRoots.some((root) => existsSync(join(root, LEGACY_STORYTELLER_SKILL, 'SKILL.md')));
    const matches = candidates.filter((c) => c.installed);
    // A matching new copy is not enough while the retired producer remains: an
    // agent may discover both commands and invoke the stale one. Keep Update
    // skills visible until migration removes every old directory.
    const current = matches.some((c) => c.current) && !legacyInstalled;
    const agents = {
        claude: { dir: '~/.claude/skills', ...candidates[1], current: candidates[1].current && !legacyInstalled },
        codex: { dir: '~/.codex/skills', ...candidates[2], current: candidates[2].current && !legacyInstalled },
    };
    return {
        name: STORYTELLER_SKILL,
        expected,
        installed: matches.length > 0,
        current,
        legacyInstalled,
        candidates,
        matches,
        agents,
        message: legacyInstalled
            ? 'review-tour was renamed to diffstory-storyteller. Update skills to finish the migration.'
            : matches.length === 0
                ? 'diffstory-storyteller skill is not installed.'
                : current
                    ? 'diffstory-storyteller skill is installed and up to date.'
                    : 'diffstory-storyteller skill is installed but out of date.',
    };
}
function bundledStorytellerSkill() {
    return join(bundledSkillsRoot(), STORYTELLER_SKILL, 'SKILL.md');
}
function bundledSkillsRoot() {
    return resolve(dirname(fileURLToPath(import.meta.url)), '..', 'skills');
}
/** Update the local agent skill installs from this app's bundled skills. */
export function updateSkills(home, sourceRoot = bundledSkillsRoot()) {
    const targets = [
        join(home, '.agents', 'skills'),
        join(home, '.claude', 'skills'),
        join(home, '.codex', 'skills'),
    ];
    const installed = [];
    for (const targetRoot of targets) {
        mkdirSync(targetRoot, { recursive: true });
        // The producer skill was renamed in place. Remove the old install so agents
        // do not expose two commands that write the same story artifact.
        rmSync(join(targetRoot, LEGACY_STORYTELLER_SKILL), { recursive: true, force: true });
        for (const skill of SKILLS) {
            const source = join(sourceRoot, skill);
            if (!existsSync(source))
                continue;
            const target = join(targetRoot, skill);
            rmSync(target, { recursive: true, force: true });
            cpSync(source, target, { recursive: true });
            installed.push(target);
        }
    }
    return {
        installed,
        status: skillStatus(home, join(sourceRoot, STORYTELLER_SKILL, 'SKILL.md')),
    };
}
function readNormalized(path) {
    try {
        return readFileSync(path, 'utf8').replace(/\r\n/g, '\n').trimEnd();
    }
    catch {
        return null;
    }
}
