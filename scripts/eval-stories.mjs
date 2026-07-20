#!/usr/bin/env node
// Story-quality eval harness: generate diffStories for frozen commit ranges,
// score them mechanically (the app's own validators + coverage gate), then with
// an LLM judge rubric derived from the storyteller skill's audits. This makes
// prompt/skill changes measurable instead of vibes.
//
//   node scripts/eval-stories.mjs all --label baseline
//   node scripts/eval-stories.mjs generate --label exp1 --case bugfix-review-ui
//   node scripts/eval-stories.mjs judge --label exp1
//
// Requires: `npm run build` first (uses dist/), the `claude` CLI on PATH, and
// the diffstory-storyteller skill installed (scripts/install-skills.sh).
// Results land in eval/results/<label>/ (gitignored).

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { storyPrompt, onPath } from '../dist/agent.js';
import { validateTour, validateGeneratedTour } from '../dist/tour.js';
import { parseUnifiedDiff } from '../dist/diff.js';
import { computeCoverage } from '../dist/coverage.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const storyPath = join(root, '.diffstory', 'story.json');
const backupPath = `${storyPath}.eval-backup`;

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith('--') ? args[0] : 'all';
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const label = flag('label', 'baseline');
const genModel = flag('model', 'sonnet');
const judgeModel = flag('judge-model', 'sonnet');
const onlyCases = args.flatMap((a, i) => (a === '--case' && args[i + 1] ? [args[i + 1]] : []));

const { cases } = JSON.parse(readFileSync(join(root, 'eval', 'cases.json'), 'utf8'));
const selected = onlyCases.length ? cases.filter((c) => onlyCases.includes(c.id)) : cases;
if (!selected.length) {
  console.error(`No cases match ${onlyCases.join(', ')}. Known: ${cases.map((c) => c.id).join(', ')}`);
  process.exit(1);
}
const outDir = join(root, 'eval', 'results', label);

function git(...gitArgs) {
  const r = spawnSync('git', gitArgs, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${gitArgs.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

function caseDiff(c) {
  return git('diff', `${c.base}..${c.head}`, '--', ...(c.excludePaths ?? []).map((p) => `:(exclude)${p}`));
}

function runClaude(cliArgs, logPath) {
  const r = spawnSync('claude', cliArgs, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(logPath, `exit ${r.status}\n--- stdout ---\n${r.stdout ?? ''}\n--- stderr ---\n${r.stderr ?? ''}`);
  if (r.status !== 0) throw new Error(`claude exited ${r.status}; see ${logPath}`);
  return r.stdout ?? '';
}

function generate(c) {
  const caseDir = join(outDir, c.id);
  mkdirSync(caseDir, { recursive: true });
  const prompt = storyPrompt(c.base, c.head, c.mode, c.excludePaths ?? []);
  writeFileSync(join(caseDir, 'prompt.txt'), prompt);
  console.log(`\n▶ generate ${c.id} (${c.mode}, model ${genModel})`);
  if (existsSync(storyPath)) renameSync(storyPath, backupPath);
  try {
    runClaude(['-p', prompt, '--permission-mode', 'acceptEdits', '--model', genModel], join(caseDir, 'generate.log'));
    if (!existsSync(storyPath)) throw new Error(`agent finished but wrote no ${storyPath}`);
    copyFileSync(storyPath, join(caseDir, 'story.json'));
    console.log(`  ✓ story captured -> eval/results/${label}/${c.id}/story.json`);
  } finally {
    if (existsSync(storyPath)) spawnSync('rm', [storyPath]);
    if (existsSync(backupPath)) renameSync(backupPath, storyPath);
  }
}

// Mechanical scores are free and objective: the app's own gates.
function mechanicalScores(c, tour) {
  const files = parseUnifiedDiff(caseDiff(c));
  const uncovered = computeCoverage(tour, files).uncovered;
  const codeSteps = tour.steps.filter((s) => s.kind !== 'concept');
  return {
    validationErrors: validateTour(tour),
    generatedProfileErrors: validateGeneratedTour(tour),
    uncoveredHunks: uncovered.length,
    steps: tour.steps.length,
    conceptSteps: tour.steps.length - codeSteps.length,
    hotspots: tour.hotspots?.length ?? 0,
    nonGoals: tour.intent?.nonGoals?.length ?? 0,
    avgViewportLines: codeSteps.length
      ? Math.round(
          codeSteps.reduce((a, s) => a + (s.viewport ? s.viewport[1] - s.viewport[0] + 1 : 0), 0) / codeSteps.length,
        )
      : 0,
  };
}

const RUBRIC = [
  ['narrative_order', 'Would reordering the steps by filename read the same? 5 = the order teaches the runtime/causal path and file order would wreck it; 1 = it is a file list.'],
  ['thread_continuity', 'Read only titles, concept bodies, and beats, in order, with no code. 5 = one continuous story with no unexplained jump or term; 1 = disconnected captions.'],
  ['question_falsifiability', 'Could a careful reviewer answer any step question wrong? 5 = every question names a failure the highlighted evidence must rule out; 1 = rhetorical yes-questions.'],
  ['beat_pointing', '5 = each beat says why its lines matter and what they unlock next; 1 = beats restate what the diff already shows ("adds a helper").'],
  ['intent_grounding', '5 = goal/design/nonGoals are specific, cited to real sources, and match the diff; 1 = invented or generic intent.'],
  ['hotspot_honesty', '5 = hotspots name specific unverified doubts a reviewer should chase; 3 = plausible but vague; 1 = missing on a risky change, or decorative ("this is complex").'],
];

function judgePrompt(c, storyJson, diff) {
  const truncated = diff.length > 60000 ? `${diff.slice(0, 60000)}\n[diff truncated at 60000 chars]` : diff;
  return [
    'You are grading a "diffStory": a guided review story an AI wrote for its own code change. Grade like a demanding staff reviewer: 3 is adequate, 5 is rare.',
    '',
    `Rubric (score each 1-5):`,
    ...RUBRIC.map(([k, d]) => `- ${k}: ${d}`),
    '',
    'Reply with STRICT JSON only, no markdown fences, exactly this shape:',
    '{"scores":{' + RUBRIC.map(([k]) => `"${k}":0`).join(',') + '},"rationale":{' + RUBRIC.map(([k]) => `"${k}":"one sentence"`).join(',') + '},"worstStep":"<step id and why>","verdict":"<one sentence: would this story actually help a reviewer?>"}',
    '',
    `Change note: ${c.note}`,
    '',
    '--- STORY JSON ---',
    storyJson,
    '',
    '--- THE ACTUAL DIFF ---',
    truncated,
  ].join('\n');
}

function parseJudgeOutput(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('judge returned no JSON object');
  return JSON.parse(raw.slice(start, end + 1));
}

function judge(c) {
  const caseDir = join(outDir, c.id);
  const storyFile = join(caseDir, 'story.json');
  if (!existsSync(storyFile)) {
    console.log(`  ⚠ ${c.id}: no story.json (generate first) — skipping`);
    return null;
  }
  console.log(`\n▶ judge ${c.id} (model ${judgeModel})`);
  const storyJson = readFileSync(storyFile, 'utf8');
  const tour = JSON.parse(storyJson);
  const mechanical = mechanicalScores(c, tour);
  const raw = runClaude(['-p', judgePrompt(c, storyJson, caseDiff(c)), '--model', judgeModel], join(caseDir, 'judge.log'));
  const llm = parseJudgeOutput(raw);
  const mean = Object.values(llm.scores).reduce((a, b) => a + b, 0) / RUBRIC.length;
  const result = { case: c.id, mode: c.mode, mechanical, llm, mean: Number(mean.toFixed(2)) };
  writeFileSync(join(caseDir, 'judge.json'), JSON.stringify(result, null, 2));
  console.log(`  ✓ mean ${result.mean} — ${llm.verdict}`);
  return result;
}

function report(results) {
  const done = results.filter(Boolean);
  if (!done.length) return;
  const header = ['case', 'mode', 'mean', ...RUBRIC.map(([k]) => k), 'val errors', 'uncovered', 'steps', 'hotspots'];
  const rows = done.map((r) => [
    r.case, r.mode, r.mean,
    ...RUBRIC.map(([k]) => r.llm.scores[k]),
    r.mechanical.validationErrors.length + r.mechanical.generatedProfileErrors.length,
    r.mechanical.uncoveredHunks, r.mechanical.steps, r.mechanical.hotspots,
  ]);
  const md = [
    `# Story eval — ${label}`,
    '',
    `Generated ${new Date().toISOString()} · generator: ${genModel} · judge: ${judgeModel}`,
    '',
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
    ...done.map((r) => `## ${r.case}\n\n- verdict: ${r.llm.verdict}\n- worst step: ${r.llm.worstStep}\n${RUBRIC.map(([k]) => `- ${k} (${r.llm.scores[k]}): ${r.llm.rationale[k]}`).join('\n')}\n`),
  ].join('\n');
  writeFileSync(join(outDir, 'report.md'), md);
  console.log(`\nOverall mean: ${(done.reduce((a, r) => a + r.mean, 0) / done.length).toFixed(2)} across ${done.length} cases`);
  console.log(`Report: eval/results/${label}/report.md`);
}

if (!onPath('claude')) {
  console.error('The claude CLI is required on PATH for generation and judging.');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

if (command === 'generate' || command === 'all') {
  for (const c of selected) generate(c);
}
if (command === 'judge' || command === 'all') {
  report(selected.map((c) => judge(c)));
}
if (!['generate', 'judge', 'all'].includes(command)) {
  console.error(`Unknown command "${command}". Use: generate | judge | all`);
  process.exit(1);
}
