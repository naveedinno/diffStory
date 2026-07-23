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

import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { storyPrompt, streamCommand, parseClaudeStreamLine, onPath } from '../dist/agent.js';
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
const parallel = Math.max(1, Number(flag('parallel', '1')) || 1);
// Wall-clock cap per generation; 0 disables. Guards against a wedged agent.
// Generous by default: a large diff legitimately takes 15-25 minutes, and
// concurrency slows each run further, so a tight cap kills healthy agents
// mid-write rather than catching stuck ones.
const timeoutMs = Math.max(0, Number(flag('timeout', '40')) || 0) * 60000;

const { cases } = JSON.parse(readFileSync(join(root, 'eval', 'cases.json'), 'utf8'));
const selected = onlyCases.length ? cases.filter((c) => onlyCases.includes(c.id)) : cases;
if (!selected.length) {
  console.error(`No cases match ${onlyCases.join(', ')}. Known: ${cases.map((c) => c.id).join(', ')}`);
  process.exit(1);
}
const outDir = join(root, 'eval', 'results', label);

/**
 * The agent loads the *installed* skill, not this repo's copy. A stale install
 * silently measures the old skill and makes every label comparison a lie, so
 * refuse to spend agent runs until the two match.
 */
export function skillInstallState(repoSkill, installedSkill) {
  if (installedSkill === null) return { ok: false, reason: 'not installed' };
  return installedSkill.trim() === repoSkill.trim()
    ? { ok: true }
    : { ok: false, reason: 'out of date' };
}

function checkInstalledSkill() {
  const repoSkill = readFileSync(join(root, 'skills', 'diffstory-storyteller', 'SKILL.md'), 'utf8');
  const target = join(process.env.HOME ?? '', '.claude', 'skills', 'diffstory-storyteller', 'SKILL.md');
  const installed = existsSync(target) ? readFileSync(target, 'utf8') : null;
  const state = skillInstallState(repoSkill, installed);
  if (state.ok) return;
  console.error(
    `\n✖ The installed diffstory-storyteller skill is ${state.reason}:\n` +
    `    ${target}\n` +
    `  The agent reads that copy, so this run would score the wrong skill.\n` +
    `  Fix it first:  sh scripts/install-skills.sh --claude\n`,
  );
  process.exit(1);
}

function git(...gitArgs) {
  const r = spawnSync('git', gitArgs, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${gitArgs.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

function caseDiff(c) {
  return git('diff', `${c.base}..${c.head}`, '--', ...(c.excludePaths ?? []).map((p) => `:(exclude)${p}`));
}

const startedAt = Date.now();
const elapsed = (since = startedAt) => {
  const s = Math.round((Date.now() - since) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function truncate(text, max = (process.stdout.columns || 100) - 12) {
  const oneLine = String(text).replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

/**
 * How many API retries the CLI burned before giving up, or 0 if it did not.
 * The stream carries `{type:"system",subtype:"api_retry",attempt,max_retries}`;
 * reaching max_retries means the run died of infrastructure, not of anything
 * the story or the prompt did. Returns the attempt count so the caller can say
 * so plainly instead of reporting a bare non-zero exit.
 */
export function retriesExhausted(streamOutput) {
  let exhausted = 0;
  for (const line of String(streamOutput).split('\n')) {
    if (!line.startsWith('{') || !line.includes('api_retry')) continue;
    try {
      const event = JSON.parse(line);
      if (event.subtype === 'api_retry' && event.attempt && event.attempt >= event.max_retries) {
        exhausted = event.attempt;
      }
    } catch { /* a partial line is not a retry record */ }
  }
  return exhausted;
}

/**
 * One console line per real agent event. Returns null for events not worth a
 * line so the run stays readable — the full stream is always in the log file.
 * Phase markers (">> ...", the live-progress protocol the story prompt asks
 * for) are the story-shaped signal, so they get the arrow and stay unabridged.
 */
export function progressLine(event) {
  switch (event.type) {
    case 'file':
      return `${event.action} ${event.target}`;
    case 'command':
      return `$ ${event.command}`;
    case 'activity':
      return event.label;
    case 'tool':
      return event.label ?? event.rawTool;
    case 'plan':
      return `plan: ${event.items.filter((i) => i.status === 'active').map((i) => i.text).join(', ') || `${event.items.length} steps`}`;
    case 'text': {
      const marker = String(event.data).split('\n').map((l) => l.trim()).filter((l) => l.startsWith('>> '));
      return marker.length ? marker.map((l) => `▸ ${l.slice(3)}`).join('\n  ') : null;
    }
    default:
      return null;
  }
}

/**
 * Run the claude CLI with live output. `stream` uses stream-json so the agent's
 * tool calls become progress lines as they happen; otherwise stdout is captured
 * and only a heartbeat is shown. Either way the raw stream lands in `logPath`.
 */
function runClaude({ cliArgs, logPath, cwd, stream = false, label: tag = '', activity = 'working', timeoutMs = 0 }) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', cliArgs, { cwd: cwd ?? root, stdio: ['ignore', 'pipe', 'pipe'] });
    const began = Date.now();
    let out = '';
    let err = '';
    let pending = '';
    let events = 0;
    let lastPrint = Date.now();

    const say = (line) => {
      console.log(`  ${elapsed(began).padStart(5)}  ${tag ? `[${tag}] ` : ''}${line}`);
      lastPrint = Date.now();
    };
    // Without a heartbeat, a long think reads as a hang. Concurrent runs share
    // one console, so they tick far less often to stay readable.
    const quietFor = stream ? 20000 : 90000;
    const heartbeat = setInterval(() => {
      if (Date.now() - lastPrint > quietFor) say(`… still ${activity}`);
    }, 5000);
    // A single wedged generation must not hold the whole run hostage. The agent
    // spends nearly all of this blocked on the API, so the cap is wall-clock.
    const deadline = timeoutMs > 0 && setTimeout(() => {
      say(
        `✖ exceeded the ${Math.round(timeoutMs / 60000)}m cap — killing this generation ` +
        `(it may have been mid-write; raise --timeout if this repeats)`,
      );
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      out += text;
      pending += text;
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) {
        // Always count events so the summary stays truthful in quiet mode; only
        // print them when this run owns the console.
        for (const event of parseClaudeStreamLine(line)) {
          events += 1;
          if (!stream) continue;
          const rendered = progressLine(event);
          if (rendered) say(truncate(rendered));
        }
      }
    });
    const done = () => {
      clearInterval(heartbeat);
      if (deadline) clearTimeout(deadline);
    };
    child.stderr.on('data', (chunk) => { err += chunk.toString(); });
    child.on('error', (e) => { done(); reject(e); });
    child.on('close', (code) => {
      done();
      writeFileSync(logPath, `exit ${code}\n--- stdout ---\n${out}\n--- stderr ---\n${err}`);
      if (code !== 0) {
        // An exhausted API retry chain is an infrastructure blip, not a story
        // failure. Saying so keeps a flaky run from being read as a quality
        // regression and re-run as if the prompt had broken something.
        const infra = retriesExhausted(out);
        reject(new Error(
          infra
            ? `claude gave up after ${infra} API retries (${elapsed(began)}) — infrastructure, not a story failure; re-run this case. See ${logPath}`
            : `claude exited ${code} after ${elapsed(began)}; see ${logPath}`,
        ));
        return;
      }
      resolve({ out, events, took: elapsed(began) });
    });
  });
}

/**
 * Recover a story stranded by an older harness version, which borrowed the live
 * `.diffstory/story.json` during generation. Generation is fully isolated now,
 * but an interrupted run from before that change can still leave the backup
 * behind, and silently leaving the reviewer without their story is unacceptable.
 */
function recoverStrandedStory() {
  if (!existsSync(backupPath)) return;
  if (!existsSync(storyPath)) {
    renameSync(backupPath, storyPath);
    console.log('Recovered .diffstory/story.json from an interrupted earlier run.');
    return;
  }
  rmSync(backupPath);
}

let interrupted = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (interrupted) process.exit(130);
    interrupted = true;
    console.log('\n\nInterrupted — cleaning up worktrees and stopping.');
    // Leave no worktrees behind; prune also clears any registration whose
    // directory removal loses the race with exit.
    try {
      rmSync(join(root, '.eval-worktrees'), { recursive: true, force: true });
      git('worktree', 'prune');
    } catch { /* best effort on the way out */ }
    process.exit(130);
  });
}

/**
 * Isolate one case in its own git worktree. Each worktree gets its own
 * `.diffstory/story.json`, so generations never contend for the shared file and
 * the live repo is never mutated. Detached at HEAD: cases address their diffs by
 * explicit ref, so the checked out commit does not matter.
 */
function makeWorktree(c) {
  const path = join(root, '.eval-worktrees', c.id);
  rmSync(path, { recursive: true, force: true });
  // A worktree killed mid-run stays registered in .git/worktrees even after its
  // directory is gone, and `worktree add` then refuses the path. Prune first so
  // an interrupted run never blocks the next one.
  git('worktree', 'prune');
  git('worktree', 'add', '--detach', '--quiet', path, 'HEAD');
  return {
    path,
    storyFile: join(path, '.diffstory', 'story.json'),
    cleanup: () => {
      try {
        git('worktree', 'remove', '--force', path);
      } catch {
        rmSync(path, { recursive: true, force: true });
      }
    },
  };
}

/**
 * Build every worktree before any agent starts. `git worktree` mutates shared
 * `.git` state, so creating them from concurrent workers would race on its lock.
 */
function makeWorktrees(caseList) {
  // SIGKILL, a crashed parent, or a closed terminal skips the signal handlers,
  // so worktrees from an earlier run can still be on disk — including ones for
  // cases this run does not touch. Sweep the whole directory before starting.
  rmSync(join(root, '.eval-worktrees'), { recursive: true, force: true });
  git('worktree', 'prune');
  const trees = new Map();
  for (const c of caseList) trees.set(c.id, makeWorktree(c));
  return trees;
}

/**
 * Generate one story. Always runs in an isolated worktree — never in the live
 * repo. Borrowing the repo's own `.diffstory/story.json` used to be the
 * single-case path, and it silently broke anything else touching the repo
 * mid-run (the app-server tests read that file and fail while it is moved away).
 * Isolation costs one cheap worktree and makes a run safe to leave unattended.
 */
async function generate(c, { worktree, quiet = false } = {}) {
  const caseDir = join(outDir, c.id);
  mkdirSync(caseDir, { recursive: true });
  const prompt = storyPrompt(c.base, c.head, c.mode, c.excludePaths ?? []);
  writeFileSync(join(caseDir, 'prompt.txt'), prompt);
  const tree = worktree;
  console.log(
    `\n▶ generate ${c.id} (${c.mode}, model ${genModel})` +
    (quiet ? ' — running in parallel, output on completion' : ' — live agent progress below'),
  );
  // Reuse the app's own stream-json invocation so eval runs see exactly what
  // the review UI would show while a story is being written.
  const [, cliArgs] = streamCommand('claude', prompt, genModel);
  const { events, took } = await runClaude({
    cliArgs,
    cwd: tree.path,
    logPath: join(caseDir, 'generate.log'),
    stream: !quiet,
    label: quiet ? c.id : '',
    activity: 'writing the story',
    // A case may declare its own cap when it is known to be thinking-bound.
    timeoutMs: c.timeoutMinutes ? c.timeoutMinutes * 60000 : timeoutMs,
  });
  if (!existsSync(tree.storyFile)) throw new Error(`agent finished but wrote no ${tree.storyFile}`);
  copyFileSync(tree.storyFile, join(caseDir, 'story.json'));
  console.log(`  ✓ ${c.id} captured in ${took} (${events} agent events) -> eval/results/${label}/${c.id}/story.json`);
}

// Mechanical scores are free and objective: the app's own gates.
function mechanicalScores(c, tour) {
  const files = parseUnifiedDiff(caseDiff(c));
  const uncovered = computeCoverage(tour, files).uncovered;
  const codeSteps = tour.steps.filter((s) => s.kind !== 'concept');
  // Mirror the app: loadTour() runs validateTour() and refuses a malformed story
  // before the stricter generated profile ever sees it. Running the strict pass
  // on a story that already failed the basic shape yields noise, not signal.
  const validationErrors = validateTour(tour);
  return {
    validationErrors,
    generatedProfileErrors: validationErrors.length
      ? ['(skipped: story failed basic validation)']
      : validateGeneratedTour(tour),
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

async function judge(c) {
  const caseDir = join(outDir, c.id);
  const storyFile = join(caseDir, 'story.json');
  if (!existsSync(storyFile)) {
    console.log(`\n▶ judge ${c.id} — no story.json (generate first), skipping`);
    return null;
  }
  console.log(`\n▶ judge ${c.id} (model ${judgeModel})`);
  const storyJson = readFileSync(storyFile, 'utf8');
  const tour = JSON.parse(storyJson);
  const mechanical = mechanicalScores(c, tour);
  const gateErrors = mechanical.validationErrors.length + mechanical.generatedProfileErrors.length;
  // Mechanical scores are instant, so show them before the slow judge call.
  console.log(
    `  ${mechanical.steps} steps · ${mechanical.hotspots} hotspots · ` +
    `${mechanical.uncoveredHunks} uncovered ${mechanical.uncoveredHunks === 1 ? 'hunk' : 'hunks'} · ` +
    `${gateErrors} validation ${gateErrors === 1 ? 'error' : 'errors'}`,
  );
  const { out, took } = await runClaude({
    cliArgs: ['-p', judgePrompt(c, storyJson, caseDiff(c)), '--model', judgeModel],
    logPath: join(caseDir, 'judge.log'),
    activity: 'grading',
  });
  const llm = parseJudgeOutput(out);
  const mean = Object.values(llm.scores).reduce((a, b) => a + b, 0) / RUBRIC.length;
  const result = { case: c.id, mode: c.mode, mechanical, llm, mean: Number(mean.toFixed(2)) };
  writeFileSync(join(caseDir, 'judge.json'), JSON.stringify(result, null, 2));
  console.log(`  ✓ mean ${result.mean} in ${took} — ${truncate(llm.verdict)}`);
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

// Only run when invoked as a script — importing this file (e.g. from a test of
// progressLine) must not spawn billed agent runs.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!['generate', 'judge', 'all'].includes(command)) {
    console.error(`Unknown command "${command}". Use: generate | judge | all`);
    process.exit(1);
  }
  if (!onPath('claude')) {
    console.error('The claude CLI is required on PATH for generation and judging.');
    process.exit(1);
  }
  if (command !== 'judge') checkInstalledSkill();
  recoverStrandedStory();
  mkdirSync(outDir, { recursive: true });

  const plan = [command === 'all' ? 'generate + judge' : command, `${selected.length} case${selected.length === 1 ? '' : 's'}`];
  console.log(`\ndiffStory eval · ${plan.join(' · ')} · label "${label}"`);
  console.log(`Cases: ${selected.map((c) => c.id).join(', ')}`);
  if (command !== 'judge') {
    const runs = selected.length * (command === 'all' ? 2 : 1);
    console.log(`Spawning ${runs} billed claude runs; each generation takes minutes. Ctrl-C to stop safely.`);
  }

  if (command === 'generate' || command === 'all') {
    // One case failing must never abort the run: the surviving stories are still
    // worth judging, and an escaping rejection would also strand the worktrees.
    const failures = [];
    const attempt = async (c, opts) => {
      try {
        await generate(c, opts);
      } catch (e) {
        failures.push({ id: c.id, message: e.message });
        console.log(`  ✖ ${c.id} failed: ${e.message}`);
      }
    };

    // Every generation runs in its own worktree, so a run never touches the live
    // repo and you can keep working (or run the tests) while it goes.
    const lanes = Math.min(parallel, selected.length);
    console.log(
      `Running ${lanes > 1 ? `${lanes} generations at a time` : 'one generation at a time'} ` +
      `in isolated git worktrees; your working tree is untouched.`,
    );
    const trees = makeWorktrees(selected);
    try {
      const queue = [...selected];
      const worker = async () => {
        for (let c = queue.shift(); c; c = queue.shift()) {
          // Quiet only when lanes would interleave and shred each other's lines.
          await attempt(c, { worktree: trees.get(c.id), quiet: lanes > 1 });
        }
      };
      await Promise.all(Array.from({ length: lanes }, worker));
    } finally {
      for (const tree of trees.values()) tree.cleanup();
    }

    if (failures.length) {
      console.log(`\n${failures.length} of ${selected.length} generations failed:`);
      for (const f of failures) console.log(`  ✖ ${f.id}: ${f.message}`);
      console.log('Judging continues on the stories that did succeed.');
    }
  }
  if (command === 'judge' || command === 'all') {
    const results = [];
    for (const c of selected) results.push(await judge(c));
    report(results);
  }
  console.log(`\nDone in ${elapsed()}.`);
}
