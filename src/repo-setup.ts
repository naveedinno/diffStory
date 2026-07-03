// Per-repo setup: choose how .diffstory/ is tracked in git, and check the
// producer skill is installed for some agent. Pure FS; no CLI dependencies.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_DIR } from './config.js';

const SHARED_LINE = `${DATA_DIR}/comments.json`;
const LOCAL_LINE = `${DATA_DIR}/`;
const REVIEW_TOUR = join('skills', 'review-tour', 'SKILL.md');
const SKILLS = ['review-tour', 'address-review'] as const;

export interface SkillCandidate {
  path: string;
  installed: boolean;
  current: boolean;
}

export type SkillAgent = 'claude' | 'codex';

/** Freshness of the one skill directory a given agent CLI actually reads. */
export interface AgentSkillStatus extends SkillCandidate {
  dir: string;
}

export interface SkillStatus {
  name: 'review-tour';
  expected: string;
  installed: boolean;
  current: boolean;
  message: string;
  candidates: SkillCandidate[];
  matches: SkillCandidate[];
  agents: Record<SkillAgent, AgentSkillStatus>;
}

export interface UpdateSkillsResult {
  installed: string[];
  status: SkillStatus;
}

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
  return skillStatus(home).installed;
}

/**
 * Check whether the installed producer skill exists and matches this CLI bundle.
 * The aggregate `installed`/`current` spans every candidate location; `agents`
 * reports the one directory each agent CLI reads (claude → ~/.claude/skills,
 * codex → ~/.codex/skills), so callers can warn for the agent actually in use.
 */
export function skillStatus(home: string, expected = bundledReviewTourSkill()): SkillStatus {
  const expectedText = readNormalized(expected);
  const candidates = [
    join(home, '.agents', REVIEW_TOUR),
    join(home, '.claude', REVIEW_TOUR),
    join(home, '.codex', REVIEW_TOUR),
  ].map((path) => {
    const installed = existsSync(path);
    const current = installed && expectedText != null && readNormalized(path) === expectedText;
    return { path, installed, current };
  });
  const matches = candidates.filter((c) => c.installed);
  const current = matches.some((c) => c.current);
  const agents: Record<SkillAgent, AgentSkillStatus> = {
    claude: { dir: '~/.claude/skills', ...candidates[1] },
    codex: { dir: '~/.codex/skills', ...candidates[2] },
  };
  return {
    name: 'review-tour',
    expected,
    installed: matches.length > 0,
    current,
    candidates,
    matches,
    agents,
    message:
      matches.length === 0
        ? 'review-tour skill is not installed.'
        : current
          ? 'review-tour skill is installed and up to date.'
          : 'review-tour skill is installed but out of date.',
  };
}

function bundledReviewTourSkill(): string {
  return join(bundledSkillsRoot(), 'review-tour', 'SKILL.md');
}

function bundledSkillsRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', 'skills');
}

/** Update the local agent skill installs from this app's bundled skills. */
export function updateSkills(home: string, sourceRoot = bundledSkillsRoot()): UpdateSkillsResult {
  const targets = [
    join(home, '.agents', 'skills'),
    join(home, '.claude', 'skills'),
    join(home, '.codex', 'skills'),
  ];
  const installed: string[] = [];
  for (const targetRoot of targets) {
    mkdirSync(targetRoot, { recursive: true });
    for (const skill of SKILLS) {
      const source = join(sourceRoot, skill);
      if (!existsSync(source)) continue;
      const target = join(targetRoot, skill);
      rmSync(target, { recursive: true, force: true });
      cpSync(source, target, { recursive: true });
      installed.push(target);
    }
  }
  return {
    installed,
    status: skillStatus(home, join(sourceRoot, 'review-tour', 'SKILL.md')),
  };
}

function readNormalized(path: string): string | null {
  try {
    return readFileSync(path, 'utf8').replace(/\r\n/g, '\n').trimEnd();
  } catch {
    return null;
  }
}
