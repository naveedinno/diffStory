#!/usr/bin/env node
// diffStory CLI: serve a guided review, check coverage, or scaffold a tour.
import { resolve } from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { isGitRepo, resolveBase, getDiff, describeBase } from './git.js';
import { parseUnifiedDiff } from './diff.js';
import { loadTour, TourError } from './tour.js';
import { computeCoverage, stalePointers } from './coverage.js';
import { serve } from './server.js';
import { APP_NAME, DATA_DIR, DEFAULT_PORT, dataDir, tourPath } from './config.js';

const VERSION = '0.1.0';

interface Args {
  cmd: string;
  dir: string;
  base?: string;
  port: number;
  open: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { cmd: 'serve', dir: process.cwd(), port: DEFAULT_PORT, open: true };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--base') a.base = argv[++i];
    else if (t === '--port') a.port = Number(argv[++i]) || DEFAULT_PORT;
    else if (t === '--dir') a.dir = resolve(argv[++i] ?? '.');
    else if (t === '--no-open') a.open = false;
    else if (t === '--help' || t === '-h') a.cmd = 'help';
    else if (t === '--version' || t === '-v') a.cmd = 'version';
    else if (!t.startsWith('-')) positional.push(t);
  }
  if (positional.length) a.cmd = positional[0];
  return a;
}

function ensureRepo(dir: string): void {
  if (!isGitRepo(dir)) {
    throw new Error(`${dir} is not a git repository — ${APP_NAME} reviews a git diff.`);
  }
}

function cmdServe(a: Args): void {
  ensureRepo(a.dir);
  loadTour(tourPath(a.dir)); // fail fast with a friendly message if missing/invalid
  serve({ repo: a.dir, port: a.port, baseOverride: a.base, open: a.open });
}

function cmdCheck(a: Args): void {
  ensureRepo(a.dir);
  const tour = loadTour(tourPath(a.dir));
  const base = resolveBase(a.dir, a.base ?? tour.base);
  const files = parseUnifiedDiff(getDiff(a.dir, base));
  const cov = computeCoverage(tour, files);
  const stale = stalePointers(tour, files);

  console.log(`\n${APP_NAME} check — ${tour.title}`);
  console.log(`base: ${describeBase(a.dir, base)}`);
  console.log(
    `steps: ${tour.steps.length} · changed files: ${cov.totalChangedFiles} · covered: ${cov.coveredChangedFiles}`,
  );
  if (cov.uncovered.length) {
    console.log(`\n⚠ ${cov.uncovered.length} change(s) not in the tour:`);
    for (const u of cov.uncovered) console.log(`   ${u.file}:${u.range[0]}-${u.range[1]} (${u.status})`);
  } else {
    console.log(`✓ every change is covered by a step`);
  }
  if (stale.length) {
    console.log(`\n⚠ ${stale.length} step(s) point at unchanged code:`);
    for (const s of stale) console.log(`   #${s.order} ${s.title} → ${s.file}:${s.range[0]}-${s.range[1]}`);
  }
  console.log('');
  process.exit(cov.uncovered.length ? 1 : 0);
}

function cmdInit(a: Args): void {
  mkdirSync(dataDir(a.dir), { recursive: true });
  const tp = tourPath(a.dir);
  if (!existsSync(tp)) {
    writeFileSync(tp, TEMPLATE_TOUR, 'utf8');
    console.log(`Created ${tp}`);
  } else {
    console.log(`${tp} already exists — leaving it untouched.`);
  }
  console.log(`\nNext:`);
  console.log(`  1. Have your agent run /review-tour to fill in the tour`);
  console.log(`  2. ${APP_NAME} serve`);
  console.log(`  3. Leave comments in the browser, then run /address-review to hand them back.\n`);
}

function printHelp(): void {
  console.log(`
${APP_NAME} — guided, in-order review of AI-authored diffs.

Usage:
  ${APP_NAME} [serve]        Build the review page and open it (default command)
  ${APP_NAME} check          Print coverage to the terminal; exit 1 if changes are uncovered
  ${APP_NAME} init           Scaffold ${DATA_DIR}/ with a starter tour
  ${APP_NAME} help           Show this help

Options:
  --dir <path>     Repo to review (default: current directory)
  --base <ref>     Diff against this git ref (default: auto — merge-base with the default branch)
  --port <n>       Server port (default: ${DEFAULT_PORT})
  --no-open        Don't open the browser automatically
  -v, --version    Print version

The tour lives at ${DATA_DIR}/review-tour.json (written by the /review-tour skill).
Comments are saved to ${DATA_DIR}/comments.json (read back by /address-review).
`);
}

const TEMPLATE_TOUR = `{
  "version": 1,
  "title": "<short title for this change>",
  "summary": "<one paragraph: what changed and the order to read it in>",
  "steps": [
    {
      "id": "s1",
      "order": 1,
      "title": "<what this step shows>",
      "file": "<path/to/file>",
      "range": [1, 1],
      "kind": "changed",
      "why": "<why start here; what to verify; what's subtle>",
      "calls": [],
      "tags": ["entrypoint"]
    }
  ]
}
`;

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  try {
    switch (args.cmd) {
      case 'help':
        printHelp();
        break;
      case 'version':
        console.log(`${APP_NAME} ${VERSION}`);
        break;
      case 'serve':
        cmdServe(args);
        break;
      case 'check':
        cmdCheck(args);
        break;
      case 'init':
        cmdInit(args);
        break;
      default:
        console.error(`Unknown command: ${args.cmd}`);
        printHelp();
        process.exit(1);
    }
  } catch (e) {
    if (e instanceof TourError) console.error(`\n${e.message}\n`);
    else console.error(`\nError: ${(e as Error).message}\n`);
    process.exit(1);
  }
}

main();
