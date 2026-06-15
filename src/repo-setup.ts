// Per-repo setup: choose how .diffstory/ is tracked in git, and check the
// producer skill is installed for some agent. Pure FS; no CLI dependencies.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './config.js';

const SHARED_LINE = `${DATA_DIR}/comments.json`;
const LOCAL_LINE = `${DATA_DIR}/`;

/**
 * Edit the repo's .gitignore for the chosen tracking mode (idempotent):
 *  - 'shared': only comments.json is ignored (story.json stays tracked, travels with a PR).
 *  - 'local' : the whole .diffstory/ dir is ignored.
 * Removes the other mode's line so switching modes is clean.
 */
export function setGitignore(repo: string, mode: 'shared' | 'local'): void {
  const path = join(repo, '.gitignore');
  const lines = existsSync(path) ? readFileSync(path, 'utf8').split('\n') : [];
  const kept = lines.filter((l) => l.trim() !== SHARED_LINE && l.trim() !== LOCAL_LINE);
  while (kept.length && kept[kept.length - 1].trim() === '') kept.pop();
  kept.push(mode === 'shared' ? SHARED_LINE : LOCAL_LINE);
  writeFileSync(path, kept.join('\n') + '\n', 'utf8');
}

/** True if the diffStory producer skill is installed for any agent under `home`. */
export function skillsInstalled(home: string): boolean {
  return (
    existsSync(join(home, '.agents', 'skills', 'review-tour', 'SKILL.md')) ||
    existsSync(join(home, '.claude', 'skills', 'review-tour', 'SKILL.md'))
  );
}
