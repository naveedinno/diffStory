// Deterministic prose and structure lints for authored stories.
//
// These catch the recurring failures from the 2026-09 corpus audit
// (docs/research/story-corpus-audit-2026-09.md) that no validator checks.
// Every rule is cheap and explainable; anything needing judgment stays with
// the eval judge. "error" means the reviewer would see something broken;
// "warning" is craft advice the author fixes or can justify.
import { orderedSteps } from "./tour.js";
import {
  isCodeStep,
  type CodeTourStep,
  type StoryBeat,
  type Tour,
  type TourStep,
} from "./types.js";

export type LintSeverity = "error" | "warning";

export interface LintFinding {
  /** Stable rule id; the skill and checker output refer to it. */
  rule: string;
  severity: LintSeverity;
  /** Where to look: "story", "steps[s4]", "steps[s4].beats[0]", "hotspots[1]". */
  where: string;
  message: string;
  /** One sentence the author can act on. */
  fix: string;
}

export interface LintContext {
  /** Post-change lines of a repo file (index 0 is line 1), or null when unreadable. */
  readLines?: (file: string) => string[] | null;
}

type Add = (rule: string, severity: LintSeverity, where: string, message: string, fix: string) => void;
type BeatRef = { step: CodeTourStep; beat: StoryBeat; index: number };

const SWEEP_TAGS = new Set(["skim", "sweep", "mechanical"]);

const PROSE_FILE = /\.(md|mdx|markdown|txt|rst|adoc)$/i;
const CONFIG_FILE = /\.(json|ya?ml|toml|ini|env|lock)$/i;
const BARE_OPENER = /^(now(?! that)|here|this adds|it|then|also|next|and)\b/i;
const LINE_REF = /\blines?\s+\d+/gi;
const LOOK_AT_LINES = /\blook at lines?\s+\d+/i;
const OPERAND = String.raw`(?:<code[^>]*>[^<]{1,40}<\/code>|\d[\d_.,]*%?)`;
const PROSE_TRANSITION = new RegExp(String.raw`\bfrom\s+${OPERAND}\s+to\s+${OPERAND}`, "i");
const COUNTER_SUFFIX =
  /(?:\s+|\s*[·•:#(\-–—]\s*)(?:\d+\s*(?:\/|of)\s*\d+\)?|(?:part|decision|step|instance)\s+\d+|#?\d+\)?)\s*$/i;
const OFFSCREEN = /\b(claimed spans?|other spans?|second span|remaining spans|claimed ranges?)\b/i;
const SEAM_CUE =
  /(^with\b[^.;]{1,80}[,;]|^(skim|final proof|finally|last)\b|\b(that|this) (closes|settles|finishes|covers|completes|wraps)\b|\b(is|are) (now )?(complete|done|settled|covered|in place|finished)\b|\bthis (chapter|part|section|half)\b|\bnow that\b|\bso far\b|\b(second|third|final|last|next|other|another) (concern|change|fix|part|half|thread|piece|path)\b|\bseparate(ly)?\b|\bindependent(ly)?\b|\bswitch(es|ing)?\b|\bturn(s|ing)? to\b|\bback (in|to)\b|\breturning to\b|\bmoving on\b|\bmeanwhile\b)/i;
const TEST_FILE =
  /(^|\/)(tests?|__tests__|specs?)\/|\.(test|spec)\.[cm]?[jt]sx?$|\.t\.sol$|_test\.(go|py|rs)$|(^|\/)test_[^/]+\.py$|Tests?\.(java|kt|swift|cs)$/i;
const IMPORT_LINE =
  /^\s*(import\b|from\s+\S+\s+import\b|export\s+(\*|\{[^}]*\})\s+from\b|#include\b|(const|let|var)\s+[\w{}\s,]+=\s*require\(|require\(|use\s+[\w:]+(::\{[^}]*\})?\s*;)/;
/** A hotspot with none of these is a statement or a chore, not a doubt. */
const DOUBT_MARKER =
  /\b(i|i'm|i've|i'd|my|we|not|never|no|nothing|only|without|rather than|unverified|untested|unexercised|unproven|assum\w*|guess\w*|unclear|unsure|may|might|could|relies|rely|doesn't|isn't|wasn't|didn't|cannot|can't)\b/i;
const ENVIRONMENT_GAP =
  /\b(voiceover|screen ?readers?|physical (device|iphone|android)|real device|on[- ]device|simulator|emulator|mainnet|testnet|staging|production (deploy|rollout)|in ci|ci run|not (been )?(re)?run)\b/i;

/** Markdown that renders literally in HTML narrative fields (shared with scripts/eval-stories.mjs). */
export const MARKDOWN_RESIDUE: Array<[RegExp, string]> = [
  [/\*\*[^*\n]+\*\*|__[^_\n]+__/, "bold"],
  [/(^|[^`])`[^`\n]+`/, "code span"],
  [/^#{1,4}\s+\S/m, "heading"],
  [/^\s*[-*]\s+\S/m, "bullet"],
  [/^\s*\d+[.)]\s+\S/m, "ordered item"],
  [/`{3}/, "fence"],
  [/^>\s+\S/m, "blockquote"],
];

/** Visible text of a narrative field: tags dropped, common entities decoded. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Lowercased, digits folded, punctuation dropped: beats differing only in numbers are copies. */
function copyKey(html: string): string {
  return plainText(html)
    .toLowerCase()
    .replace(/\d+/g, "#")
    .replace(/[^a-z#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** First three words with identifiers folded to "x", so "This is <code>a()</code>" and "This is <code>b()</code>" share a frame. */
function openerKey(html: string): string {
  return copyKey(html.replace(/<code[^>]*>[\s\S]*?<\/code>/gi, " x "))
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

function isSweep(step: TourStep): boolean {
  return (step.tags ?? []).some((tag) => SWEEP_TAGS.has(tag));
}

function stepList(ids: string[]): string {
  return `steps[${ids.slice(0, 5).join(", ")}${ids.length > 5 ? ", …" : ""}]`;
}

/** Run every rule. The story must already pass validateTour. */
export function lintStory(tour: Tour, ctx: LintContext = {}): LintFinding[] {
  const findings: LintFinding[] = [];
  const add: Add = (rule, severity, where, message, fix) =>
    findings.push({ rule, severity, where, message, fix });
  const steps = orderedSteps(tour);
  const code = steps.filter(isCodeStep);
  const beats: BeatRef[] = code.flatMap((step) =>
    (step.beats ?? []).map((beat, index) => ({ step, beat, index })),
  );
  lintCopies(code, add);
  lintOpeners(beats, add);
  lintLandings(code, add);
  lintLinePointers(code, add);
  lintWhyCopiesBeats(code, add);
  lintBeatLength(beats, add);
  lintBeatPhrases(beats, add);
  lintNumberedSeries(steps, add);
  lintLandingField(code, add);
  lintChapters(steps, add);
  lintTestsAtTail(code, add);
  lintHighlights(code, ctx, add);
  lintHotspots(tour, add);
  lintDiagrams(steps, add);
  lintMarkdown(tour, add);
  lintDepth(tour, steps, code, add);
  return findings;
}

function lintCopies(code: CodeTourStep[], add: Add): void {
  const byKey = new Map<string, Set<string>>();
  const note = (html: string | undefined, id: string) => {
    if (!html) return;
    const key = copyKey(html);
    if (wordsOf(key).length < 6) return;
    const ids = byKey.get(key) ?? new Set<string>();
    ids.add(id);
    byKey.set(key, ids);
  };
  for (const step of code) {
    note(step.why, step.id);
    for (const beat of step.beats ?? []) note(beat.text, step.id);
  }
  for (const [key, ids] of byKey) {
    if (ids.size < 3) continue;
    add(
      "copied-beat",
      "error",
      stepList([...ids]),
      `${ids.size} steps share the same narration: "${key.slice(0, 90)}${key.length > 90 ? "…" : ""}"`,
      "Each stop must say what its own lines prove. Merge repeated instances into one sweep step with top-level `ranges`, or rewrite each beat around its own decision.",
    );
  }
}

function lintOpeners(beats: BeatRef[], add: Add): void {
  if (beats.length < 12) return;
  const counts = new Map<string, number>();
  for (const { beat } of beats) {
    const key = openerKey(beat.text);
    if (wordsOf(key).length < 3) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const limit = Math.max(5, Math.ceil(beats.length * 0.25));
  for (const [key, count] of counts) {
    if (count < limit) continue;
    add(
      "formulaic-opener",
      "warning",
      "story",
      `${count} of ${beats.length} beats open with "${key} …"`,
      "Vary how beats begin: lead with what this spot is for, what just happened, or what would break, not the same frame every time.",
    );
  }
}

function lintLandings(code: CodeTourStep[], add: Add): void {
  for (const step of code) {
    if (isSweep(step) || PROSE_FILE.test(step.file)) continue;
    const first = step.beats?.[0];
    if (!first) continue;
    const where = `steps[${step.id}].beats[0]`;
    if (!/<code[^>]*>[^<]+<\/code>/i.test(first.text)) {
      add(
        "landing-missing-symbol",
        "warning",
        where,
        "The first beat names no symbol in <code>.",
        "Land the listener first: name the function, rule, or test on screen in <code>, who reaches it and when, then the change.",
      );
    }
    const text = plainText(first.text);
    if (BARE_OPENER.test(text)) {
      add(
        "landing-bare-opener",
        "warning",
        where,
        `The first beat opens with "${wordsOf(text).slice(0, 3).join(" ")} …".`,
        'Open on where the listener is ("This is <code>placeOrder()</code>, what the POST handler calls first …"), not on "Now", "Here", or "It".',
      );
    }
  }
}

function lintLinePointers(code: CodeTourStep[], add: Add): void {
  for (const step of code) {
    let refs = 0;
    (step.beats ?? []).forEach((beat, index) => {
      const text = plainText(beat.text);
      if (LOOK_AT_LINES.test(text)) {
        add(
          "line-pointer",
          "error",
          `steps[${step.id}].beats[${index}]`,
          'The beat says "Look at lines …".',
          "Name the code instead (\"the <code>require</code> guarding the cap\"); the glow already points at the lines.",
        );
      }
      refs += (text.match(LINE_REF) ?? []).length;
    });
    if (refs > 1) {
      add(
        "line-pointer",
        "warning",
        `steps[${step.id}]`,
        `The step mentions line numbers ${refs} times.`,
        "Say a line number at most once per step, after the landing, and only when the glow alone is ambiguous.",
      );
    }
  }
}

function lintWhyCopiesBeats(code: CodeTourStep[], add: Add): void {
  for (const step of code) {
    const beats = step.beats ?? [];
    if (!beats.length) continue;
    const whyWords = wordsOf(copyKey(step.why)).filter((w) => w.length >= 3);
    if (whyWords.length < 12) continue;
    const beatWords = new Set(wordsOf(copyKey(beats.map((b) => b.text).join(" "))));
    const shared = whyWords.filter((w) => beatWords.has(w)).length;
    if (shared / whyWords.length >= 0.8) {
      add(
        "why-copies-beats",
        "warning",
        `steps[${step.id}].why`,
        "`why` repeats the beats.",
        "Make `why` one sentence: the failure this stop rules out. The beats carry the walk-through.",
      );
    }
  }
}

function lintBeatLength(beats: BeatRef[], add: Add): void {
  // Landing beats (index 0) carry the symbol, file, caller, and moment, so they
  // run longer by design; only the other beats feed the average.
  let total = 0;
  let counted = 0;
  for (const { step, beat, index } of beats) {
    const count = wordsOf(plainText(beat.text)).length;
    if (index > 0) {
      total += count;
      counted += 1;
    }
    if (count > 45) {
      add(
        "beat-too-long",
        "warning",
        `steps[${step.id}].beats[${index}]`,
        `The beat is ${count} words.`,
        "One idea per beat. Split it, or cut what the highlighted lines already show.",
      );
    }
  }
  if (counted >= 6 && total / counted > 32) {
    add(
      "beats-long-on-average",
      "warning",
      "story",
      `Beats after the landing average ${Math.round(total / counted)} words.`,
      "Aim for 12–30 spoken words per beat after the landing; the listener cannot glance back.",
    );
  }
}

function lintBeatPhrases(beats: BeatRef[], add: Add): void {
  for (const { step, beat, index } of beats) {
    const where = `steps[${step.id}].beats[${index}]`;
    if (PROSE_TRANSITION.test(beat.text)) {
      add(
        "prose-value-transition",
        "warning",
        where,
        "The beat narrates a value change the diff already shows.",
        "Say what depended on the old value instead (\"nothing reads the old weight, so no consumer breaks\").",
      );
    }
    if (OFFSCREEN.test(plainText(beat.text))) {
      add(
        "offscreen-claim",
        "warning",
        where,
        "The beat talks about claimed spans the reviewer cannot see.",
        "Talk only about what is on screen. Other `ranges` entries are coverage claims, not narration.",
      );
    }
  }
}

function lintNumberedSeries(steps: TourStep[], add: Add): void {
  const groups = new Map<string, string[]>();
  for (const step of steps) {
    const title = step.title.trim();
    const base = title.replace(COUNTER_SUFFIX, "").trim().toLowerCase();
    if (!base || base === title.toLowerCase()) continue;
    groups.set(base, [...(groups.get(base) ?? []), step.id]);
  }
  for (const [base, ids] of groups) {
    if (ids.length < 3) continue;
    add(
      "numbered-series",
      "warning",
      stepList(ids),
      `${ids.length} steps are numbered copies of "${base}".`,
      "A repeated edit is one sweep step: narrate one instance and claim the rest with top-level `ranges`. A real sequence gets purpose titles, not counters.",
    );
  }
}

function lintLandingField(code: CodeTourStep[], add: Add): void {
  const missing = code
    .filter(
      (step) =>
        !step.landing &&
        !isSweep(step) &&
        !PROSE_FILE.test(step.file) &&
        !CONFIG_FILE.test(step.file) &&
        step.range[0] !== 0,
    )
    .map((step) => step.id);
  if (!missing.length) return;
  add(
    "landing-field-missing",
    "warning",
    stepList(missing),
    `${missing.length} code step${missing.length === 1 ? " has" : "s have"} no landing field.`,
    "Add `landing` to each: the symbol on screen, who calls it by name (`calledBy`) or the role and gate of an external entry point, and when. The checker verifies callers against the repository.",
  );
}

function lintChapters(steps: TourStep[], add: Add): void {
  if (steps.length > 10) {
    const missing = steps.filter((s) => !s.chapter?.trim()).length;
    if (missing) {
      add(
        "chapter-missing",
        "warning",
        "story",
        `${missing} of ${steps.length} steps have no chapter.`,
        "Stories over 10 steps give every step a chapter named for the concept its beats keep using.",
      );
    }
  }
  const seen = new Set<string>();
  let previous: string | undefined;
  let run = 0;
  steps.forEach((step) => {
    const chapter = step.chapter?.trim();
    if (!chapter) {
      previous = undefined;
      run = 0;
      return;
    }
    if (chapter === previous) {
      run += 1;
      if (run === 10) {
        add(
          "chapter-too-long",
          "warning",
          `steps[${step.id}]`,
          `Chapter "${chapter}" runs past 9 steps.`,
          "Split it where the beats switch to a new concept.",
        );
      }
      return;
    }
    if (seen.has(chapter)) {
      add(
        "chapter-pingpong",
        "warning",
        `steps[${step.id}]`,
        `Chapter "${chapter}" resumes after a different chapter.`,
        "Keep each chapter contiguous. A test belongs in the chapter of the behavior it pins, not in an alternating proof chapter.",
      );
    }
    if (previous !== undefined && !isSweep(step)) {
      const opener =
        step.kind === "concept"
          ? plainText(step.body).slice(0, 220)
          : plainText(step.beats?.[0]?.text ?? "");
      const firstSentence = opener.split(/(?<=[.!?])\s/)[0] ?? opener;
      if (!SEAM_CUE.test(firstSentence)) {
        add(
          "chapter-seam",
          "warning",
          `steps[${step.id}]`,
          `Chapter "${chapter}" starts without saying what the previous chapter settled.`,
          'Open the chapter\'s first beat with the seam, in the same sentence as the landing: "That settles the cap; the second concern is <code>refund()</code>, which the keeper calls …".',
        );
      }
    }
    seen.add(chapter);
    previous = chapter;
    run = 1;
  });
}

function lintTestsAtTail(code: CodeTourStep[], add: Add): void {
  const claims = code.filter((s) => s.kind !== "context");
  if (claims.length < 10) return;
  const tests = claims.filter((s) => TEST_FILE.test(s.file));
  const others = claims.filter((s) => !TEST_FILE.test(s.file));
  if (tests.length < 3 || !others.length) return;
  const firstTest = Math.min(...tests.map((s) => s.order));
  const lastOther = Math.max(...others.map((s) => s.order));
  if (firstTest > lastOther) {
    add(
      "tests-at-tail",
      "warning",
      "story",
      `All ${tests.length} test steps come after every code step.`,
      "Place each test right after the behavior it pins, in the same chapter.",
    );
  }
}

function lintHighlights(code: CodeTourStep[], ctx: LintContext, add: Add): void {
  if (!ctx.readLines) return;
  for (const step of code) {
    const lines = ctx.readLines(step.file);
    if (!lines) continue;
    (step.beats ?? []).forEach((beat, index) => {
      if (/\b(imports?|require|using)\b/i.test(plainText(beat.text))) return;
      const shown = (beat.highlights ?? [])
        .flatMap(([a, b]) => (a === 0 && b === 0 ? [] : lines.slice(a - 1, b)))
        .filter((line) => line.trim());
      if (shown.length && shown.every((line) => IMPORT_LINE.test(line))) {
        add(
          "import-only-highlight",
          "warning",
          `steps[${step.id}].beats[${index}]`,
          "The beat glows only import lines.",
          "Point the glow at the code the sentence is about; an import rarely proves a claim.",
        );
      }
    });
  }
}

function lintHotspots(tour: Tour, add: Add): void {
  (tour.hotspots ?? []).forEach((spot, index) => {
    const text = plainText(spot.reason ?? "");
    if (ENVIRONMENT_GAP.test(text)) {
      add(
        "hotspot-is-verification",
        "warning",
        `hotspots[${index}]`,
        "This hotspot is about what was not run, not about the code.",
        'Record it in top-level `verification` with result "not-run"; keep hotspots for doubts about the code itself.',
      );
    } else if (!DOUBT_MARKER.test(text)) {
      add(
        "hotspot-not-a-doubt",
        "warning",
        `hotspots[${index}]`,
        "The hotspot states a fact or a chore, not a doubt.",
        'Name what you did not verify and why it could be wrong: "I matched the boundary to the docs but never exercised rate == cap."',
      );
    }
  });
}

/** Label syntax Mermaid cannot parse. Quoted labels ("…") are always safe. */
export function mermaidLabelProblems(source: string): string[] {
  const problems: string[] = [];
  const lines = source.split(/\r?\n/);
  const kind = lines.find((l) => l.trim() && !l.trim().startsWith("%%"))?.trim() ?? "";
  for (const raw of lines) {
    const line = raw.replace(/"[^"]*"/g, '""');
    if (kind.startsWith("flowchart")) {
      for (const m of line.matchAll(/[A-Za-z0-9_]\[(?![[(/\\])([^\]]*)\]/g)) {
        if (/[()[\]{}<>;#|]/.test(m[1])) problems.push(`unquoted label "${m[1].trim()}"`);
      }
      for (const m of line.matchAll(/[A-Za-z0-9_]\((?![([])([^()]*\([^()]*\)[^()]*)\)/g)) {
        problems.push(`nested parentheses in label "${m[1].trim()}"`);
      }
      for (const m of line.matchAll(/[A-Za-z0-9_]\{(?!\{)([^}]*)\}/g)) {
        if (/[()[\]{<>;#|]/.test(m[1])) problems.push(`unquoted decision label "${m[1].trim()}"`);
      }
      for (const m of line.matchAll(/\|([^|]*)\|/g)) {
        if (/[()[\]{}<>;#]/.test(m[1])) problems.push(`unquoted edge label "${m[1].trim()}"`);
      }
      if (/(-->|---|==>|-\.->)\s*end\b/i.test(line)) problems.push('node id "end" is reserved');
    } else if (kind.startsWith("sequenceDiagram")) {
      const message = line.match(/^\s*[^:]+?(?:-{1,2}>>?|-{1,2}x|-{1,2}\))[^:]*:(.*)$/);
      if (message && /[;#]/.test(message[1])) problems.push(`";" or "#" in message "${message[1].trim()}"`);
    }
  }
  return problems;
}

function lintDiagrams(steps: TourStep[], add: Add): void {
  for (const step of steps) {
    if (step.kind !== "concept" || !step.diagram) continue;
    for (const problem of mermaidLabelProblems(step.diagram.source)) {
      add(
        "mermaid-label",
        "error",
        `steps[${step.id}].diagram`,
        `Mermaid cannot parse this: ${problem}.`,
        'Wrap labels containing ( ) [ ] { } < > ; # | in double quotes: A["O(1) lookup"]. In sequence messages, avoid ";" and "#".',
      );
    }
  }
}

/** Every authored narrative field, with a path the author can find. */
export function narrativeFields(tour: Tour): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const push = (path: string, value: unknown) => {
    if (typeof value === "string" && value.trim()) out.push([path, value]);
  };
  push("summary", tour.summary);
  push("intent.goal", tour.intent?.goal);
  push("intent.design", tour.intent?.design);
  (tour.intent?.nonGoals ?? []).forEach((v, i) => push(`intent.nonGoals[${i}]`, v));
  (tour.hotspots ?? []).forEach((h, i) => push(`hotspots[${i}].reason`, h.reason));
  (tour.verification ?? []).forEach((v, i) => push(`verification[${i}].detail`, v.detail));
  for (const step of tour.steps ?? []) {
    if (step.kind === "concept") {
      push(`steps[${step.id}].body`, step.body);
      push(`steps[${step.id}].diagram.caption`, step.diagram?.caption);
      continue;
    }
    push(`steps[${step.id}].why`, step.why);
    (step.beats ?? []).forEach((b, i) => push(`steps[${step.id}].beats[${i}].text`, b.text));
  }
  return out;
}

function lintMarkdown(tour: Tour, add: Add): void {
  for (const [path, text] of narrativeFields(tour)) {
    const hit = MARKDOWN_RESIDUE.find(([pattern]) => pattern.test(text));
    if (!hit) continue;
    add(
      "markdown-residue",
      "error",
      path,
      `Markdown ${hit[1]} renders literally here.`,
      "Narrative fields are HTML: use <code>, <strong>, <em>; block fields use <ul>/<li>, <p>.",
    );
  }
}

function lintDepth(tour: Tour, steps: TourStep[], code: CodeTourStep[], add: Add): void {
  const concepts = steps.length - code.length;
  const claims = code.filter((s) => s.kind !== "context").length;
  if (tour.mode === "detailed" && claims >= 15 && concepts === 0) {
    add(
      "detailed-without-primer",
      "warning",
      "story",
      `A detailed story with ${claims} code stops has no concept primer.`,
      'List the three terms a newcomer would ask about ("what is a single close?") and teach each where it is first needed: a primer, a context step, or one clause in the landing.',
    );
  }
  if (claims >= 12 && !tour.hotspots?.length) {
    add(
      "no-hotspots",
      "warning",
      "story",
      `${claims} code stops and no hotspots.`,
      "Name up to three places you are least sure of, in first person.",
    );
  }
}
