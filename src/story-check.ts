// The bundled story checker: the app's own contract validators, the coverage
// gate against the real git diff, logic-move verification, and the
// deterministic prose lints, runnable without the app. Agents run it from the
// skill folder (`node <skill-dir>/scripts/check-story.mjs`); it is bundled by
// scripts/build-skill-checker.mjs. It is not a diffStory CLI: nothing is
// installed, and it only reads.
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { changedRanges, parseUnifiedDiff } from "./diff.js";
import { enclosingScopeLabel } from "./enclosing-scope.js";
import { getDiff, readWholeFile, resolveBase } from "./git.js";
import { computeCoverage, filesForStoryCoverage, stalePointers } from "./coverage.js";
import { verifyLandings } from "./landing-verify.js";
import { verifyLogicMoves } from "./logic-moves.js";
import { lintStory, type LintFinding } from "./story-lint.js";
import { validateGeneratedTour, validateNewGeneratedStory, validateTour } from "./tour.js";
import { isCodeStep, type DiffFile, type Tour } from "./types.js";

export interface StoryCheckReport {
  /** Story path relative to the repository. */
  story: string;
  /** The diff the story was measured against, e.g. "main..working tree". */
  diffLabel: string;
  /** Contract failures: the app would reject the story or flag unexplained changes. */
  errors: string[];
  /** Prose and structure lint findings (errors and warnings). */
  findings: LintFinding[];
  /** Soft logic-move doubts from the move verifier. */
  moveWarnings: string[];
  /** Changed-range coverage, when the diff could be read. */
  coverage: { claimed: number; total: number } | null;
  /** The parsed story when it passed basic validation. */
  tour?: Tour;
}

export interface LedgerRange {
  range: [number, number];
  /** Nearest enclosing function/class/rule line, when one can be found. */
  scope?: string;
}

export interface LedgerFile {
  file: string;
  status: DiffFile["status"];
  test: boolean;
  ranges: LedgerRange[];
}

export interface StoryLedger {
  diffLabel: string;
  files: LedgerFile[];
}

const TEST_PATH =
  /(^|\/)(tests?|__tests__|specs?)\/|\.(test|spec)\.[cm]?[jt]sx?$|\.t\.sol$|_test\.(go|py|rs)$|(^|\/)test_[^/]+\.py$|Tests?\.(java|kt|swift|cs)$/i;

/** True when no contract error and no lint error remain (and, if strict, no warning). */
export function reportReady(report: StoryCheckReport, strict = false): boolean {
  if (report.errors.length) return false;
  if (report.findings.some((f) => f.severity === "error")) return false;
  if (strict && (report.findings.length || report.moveWarnings.length)) return false;
  return true;
}

function canonicalizeDeletedKind(parsed: unknown): void {
  const steps = (parsed as { steps?: unknown })?.steps;
  if (!Array.isArray(steps)) return;
  for (const step of steps) {
    if (step && typeof step === "object" && (step as { kind?: unknown }).kind === "deleted") {
      (step as { kind: string }).kind = "changed";
    }
  }
}

/** Check one story file against the repository it lives in. */
export function runStoryCheck(repo: string, storyPath: string): StoryCheckReport {
  const story = relative(repo, storyPath) || storyPath;
  const report: StoryCheckReport = {
    story,
    diffLabel: "",
    errors: [],
    findings: [],
    moveWarnings: [],
    coverage: null,
  };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(storyPath, "utf8"));
  } catch (error) {
    report.errors.push(`${story} is not readable JSON: ${(error as Error).message}`);
    return report;
  }
  canonicalizeDeletedKind(parsed);
  const basic = validateTour(parsed);
  if (basic.length) {
    // The app refuses to load this story; deeper checks would only add noise.
    report.errors.push(...basic);
    return report;
  }
  const tour = parsed as Tour;
  report.tour = tour;
  report.errors.push(
    ...(tour.version >= 3 ? validateNewGeneratedStory(tour) : validateGeneratedTour(tour)),
  );
  if (/(^|\/)\.diffstory\/stories\//.test(story) && !tour.storyScope?.includedFiles?.length) {
    report.errors.push("stories under .diffstory/stories/ need storyScope.includedFiles");
  }

  const base = resolveBase(repo, tour.base);
  report.diffLabel = `${tour.base ?? base}..${tour.head ?? "working tree"}`;
  let files: DiffFile[] = [];
  try {
    files = filesForStoryCoverage(tour, parseUnifiedDiff(getDiff(repo, base, tour.head)));
  } catch (error) {
    report.errors.push(`could not read the diff ${report.diffLabel}: ${(error as Error).message}`);
  }
  const coverage = computeCoverage(tour, files);
  report.coverage = { claimed: coverage.fullyClaimedChangedRanges, total: coverage.totalChangedRanges };
  for (const change of coverage.unclaimed) {
    report.errors.push(
      `unexplained change: ${change.file} ${change.range[0]}-${change.range[1]} is not claimed by any changed/new-file step`,
    );
  }
  for (const step of stalePointers(tour, files)) {
    const file = isCodeStep(step) ? step.file : "?";
    report.errors.push(
      `stale step ${step.id}: its range or ranges do not match changed code in ${file} (re-read the post-change file and fix the line numbers)`,
    );
  }
  const moves = verifyLogicMoves(repo, tour);
  report.errors.push(...moves.errors);
  report.moveWarnings.push(...moves.warnings);
  report.errors.push(...verifyLandings(repo, tour).errors);
  report.findings = lintStory(tour, {
    readLines: (file) => readWholeFile(repo, file, tour.head),
  });
  return report;
}

/** Changed files a set of scoped stories leaves to nobody (same base/head only). */
export function unownedFiles(repo: string, tours: Tour[]): string[] {
  if (tours.length < 2) return [];
  const key = (t: Tour) => `${t.base ?? ""}..${t.head ?? ""}`;
  if (new Set(tours.map(key)).size !== 1) return [];
  const owned = new Set(tours.flatMap((t) => t.storyScope?.includedFiles ?? []));
  const excluded = new Set(tours.flatMap((t) => t.storyScope?.excludedFiles ?? []));
  const base = resolveBase(repo, tours[0].base);
  return parseUnifiedDiff(getDiff(repo, base, tours[0].head))
    .map((f) => f.newPath)
    .filter((path) => !owned.has(path) && !excluded.has(path));
}

/** Minimal glob: `**` spans directories, `*` and `?` stay inside one segment. */
export function globToRegExp(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*" && glob[i + 1] === "*") {
      const slash = glob[i + 2] === "/";
      out += slash ? "(?:.*/)?" : ".*";
      i += slash ? 2 : 1;
    } else if (ch === "*") out += "[^/]*";
    else if (ch === "?") out += "[^/]";
    else out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

/** Every changed range a story must claim, with the enclosing scope for orientation. */
export function storyLedger(
  repo: string,
  opts: { base?: string; head?: string; include?: string[]; exclude?: string[] } = {},
): StoryLedger {
  const base = resolveBase(repo, opts.base);
  const include = (opts.include ?? []).map(globToRegExp);
  const exclude = (opts.exclude ?? []).map(globToRegExp);
  const files = parseUnifiedDiff(getDiff(repo, base, opts.head)).filter(
    (f) =>
      (!include.length || include.some((re) => re.test(f.newPath))) &&
      !exclude.some((re) => re.test(f.newPath)),
  );
  return {
    diffLabel: `${opts.base ?? base}..${opts.head ?? "working tree"}`,
    files: files.map((f) => {
      const lines = f.status === "deleted" ? null : readWholeFile(repo, f.newPath, opts.head);
      return {
        file: f.newPath,
        status: f.status,
        test: TEST_PATH.test(f.newPath),
        ranges: changedRanges(f).map((range) => {
          const scope = lines && range[0] > 0 ? enclosingScopeLabel(lines, range[0]) : undefined;
          return scope ? { range, scope } : { range };
        }),
      };
    }),
  };
}

export function formatLedger(ledger: StoryLedger): string {
  const total = ledger.files.reduce((n, f) => n + f.ranges.length, 0);
  const out = [
    `Changed ranges for ${ledger.diffLabel}: ${ledger.files.length} files, ${total} ranges.`,
    "Every range must be claimed by a changed/new-file step (range, or top-level ranges on a tagged sweep).",
    "",
  ];
  for (const f of ledger.files) {
    const tags = [f.status !== "modified" ? f.status : "", f.test ? "test" : ""].filter(Boolean).join(", ");
    out.push(`${f.file}${tags ? `  (${tags})` : ""}`);
    if (f.status === "deleted") {
      out.push("  whole file deleted: use range, viewport, and highlights of [0, 0]");
      continue;
    }
    for (const r of f.ranges) {
      const span = `${r.range[0]}-${r.range[1]}`.padEnd(11);
      out.push(`  ${span}${r.scope ? `in ${r.scope}` : ""}`);
    }
  }
  return out.join("\n");
}

function groupFindings(findings: LintFinding[]): Array<{ rule: string; items: LintFinding[] }> {
  const groups = new Map<string, LintFinding[]>();
  for (const f of findings) groups.set(f.rule, [...(groups.get(f.rule) ?? []), f]);
  return [...groups].map(([rule, items]) => ({ rule, items }));
}

function formatGroup(rule: string, items: LintFinding[]): string[] {
  const places = items.map((f) => f.where);
  const shown = places.slice(0, 6).join(", ") + (places.length > 6 ? `, … (${places.length} places)` : "");
  const lines = [`  - [${rule}] ${items.length > 1 ? `x${items.length} at ` : "at "}${shown}`];
  lines.push(`      ${items[0].message}`);
  lines.push(`      fix: ${items[0].fix}`);
  return lines;
}

export function formatReport(report: StoryCheckReport, strict = false): string {
  const lintErrors = report.findings.filter((f) => f.severity === "error");
  const warnings = report.findings.filter((f) => f.severity === "warning");
  const errorCount = report.errors.length + lintErrors.length;
  const out = [`diffStory story check: ${report.story}`];
  if (report.diffLabel) {
    const cov = report.coverage ? ` · coverage ${report.coverage.claimed}/${report.coverage.total} changed ranges claimed` : "";
    out.push(`Diff: ${report.diffLabel}${cov}`);
  }
  if (errorCount) {
    out.push("", `ERRORS (${errorCount}) — the story is not ready until these are fixed`);
    for (const e of report.errors) out.push(`  - ${e}`);
    for (const g of groupFindings(lintErrors)) out.push(...formatGroup(g.rule, g.items));
  }
  if (warnings.length || report.moveWarnings.length) {
    const groups = groupFindings(warnings);
    out.push(
      "",
      `WARNINGS (${groups.length + (report.moveWarnings.length ? 1 : 0)} rules, ${warnings.length + report.moveWarnings.length} places) — fix, or be able to say why the rule does not apply here`,
    );
    for (const g of groups) out.push(...formatGroup(g.rule, g.items));
    for (const w of report.moveWarnings) out.push(`  - [move] ${w}`);
  }
  const ready = reportReady(report, strict);
  out.push(
    "",
    ready
      ? `RESULT: READY — 0 errors, ${warnings.length + report.moveWarnings.length} warnings`
      : `RESULT: NOT READY${strict && !errorCount ? " (strict: warnings count)" : ""} — ${errorCount} errors, ${warnings.length + report.moveWarnings.length} warnings`,
  );
  return out.join("\n");
}
