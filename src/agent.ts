// Detect and drive the user's coding agent (Claude Code / Codex) headlessly to
// generate the story. The spawn itself is integration-only; the pure helpers
// (onPath, storyPrompt, agentCommand) are unit-tested.
import { spawn, spawnSync } from 'node:child_process';
import { DATA_DIR } from './config.js';
import { codexTaskBinary } from './codex-tasks.js';
import type { StoryMode, StoryScope } from './types.js';
import {
  type ProgressEvent, type PlanItem, type PlanStatus,
  fileEvent, commandEvent, activityEvent, toolEvent, textEvent, planEvent,
} from './progress.js';

export type Agent = 'claude' | 'codex';
export type CodexSandbox = 'full-auto' | 'workspace-write' | 'read-only' | 'danger-full-access';
export type CodexProvider = 'default' | 'lmstudio' | 'ollama';

export interface CodexRunOptions {
  sandbox?: CodexSandbox;
  provider?: CodexProvider;
  profile?: string;
  config?: string[];
  /** Resume this persisted Codex task instead of starting a fresh one. */
  threadId?: string;
  /** Machine-readable output lets diffStory capture the id of a new task. */
  json?: boolean;
  /** Use the same runtime that listed the task (Desktop may be newer than PATH). */
  binary?: string;
}

export interface AgentRunOptions {
  codex?: CodexRunOptions;
}

export function normalizeStoryMode(mode: unknown): StoryMode {
  return mode === 'brief' || mode === 'detailed' ? mode : 'guided';
}

/** Whether `cmd` resolves on PATH (POSIX `command -v`). */
export function onPath(cmd: string): boolean {
  return spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
}

/** Which agent CLIs are installed, in preference order. */
export function availableAgents(): Agent[] {
  const agents: Agent[] = [];
  if (onPath('claude')) agents.push('claude');
  if (onPath(codexTaskBinary())) agents.push('codex');
  return agents;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Git pathspecs that include selected files and hide generated/oversized files from the agent's own diff. */
function pathspecArgs(includePaths: string[], excludePaths: string[]): string {
  return [
    ...includePaths.map((p) => shellQuote(p)),
    ...excludePaths.map((p) => shellQuote(`:(exclude)${p}`)),
  ].map((p) => ` ${p}`).join('');
}

function storyScopeJson(scope: StoryScope): string {
  return JSON.stringify({
    includedFiles: scope.includedFiles,
    ...(scope.excludedFiles?.length ? { excludedFiles: scope.excludedFiles } : {}),
    ...(scope.reviewerNote?.trim() ? { reviewerNote: scope.reviewerNote.trim() } : {}),
  });
}

/** The instruction handed to the agent — triggers the producer skill, pins the exact diff. */
export function storyPrompt(
  baseRef: string,
  headRef?: string,
  mode: unknown = 'guided',
  excludePaths: string[] = [],
  storyScope?: StoryScope,
): string {
  const storyMode = normalizeStoryMode(mode);
  const includePaths = storyScope?.includedFiles ?? [];
  const pathspecs = pathspecArgs(includePaths, excludePaths);
  const diff = headRef ? `git diff ${baseRef}..${headRef} --${pathspecs}` : `git diff ${baseRef} --${pathspecs}`;
  const headField = headRef ? ` and its "head" field to "${headRef}"` : '';
  const storyScopeContract = storyScope
    ? `Story scope contract:\n` +
      `- Only create changed or new-file story steps for these selected files: ${storyScope.includedFiles.join(', ')}.\n` +
      (storyScope.excludedFiles?.length
        ? `- These changed files are intentionally outside this story scope: ${storyScope.excludedFiles.join(', ')}.\n`
        : '') +
      `- Set top-level "storyScope" in ${DATA_DIR}/story.json to exactly this JSON object: ${storyScopeJson(storyScope)}.\n` +
      `- Do not create coverage steps for files outside "storyScope.includedFiles"; the app treats them as intentionally skipped for this story.\n` +
      (storyScope.reviewerNote?.trim()
        ? `- Reviewer guidance: ${storyScope.reviewerNote.trim()}\n` +
          `- Treat this user-supplied guidance as task evidence when it describes the original request; cite "reviewer guidance" in intent.sources, verify it against the code, and surface any mismatch. Also use it to decide where to slow down.\n`
        : '') +
      `\n`
    : '';
  const scopeContract = excludePaths.length
    ? `Scope contract:\n` +
      `- These files are generated or oversized artifacts (regenerated ABIs, lockfiles, built bundles) and are intentionally excluded from this review: ${excludePaths.join(', ')}.\n` +
      `- Do not read, narrate, or write steps for them. The coverage gate already excludes them, so it will not ask you to cover them — adding them back only bloats the story.\n\n`
    : '';
  const whyLength =
    storyMode === 'brief'
      ? 'one short sentence'
      : storyMode === 'detailed'
        ? '3-7 short sentences'
        : '1-3 short sentences';
  const modeContract =
    storyMode === 'brief'
      ? `Detail level contract:\n` +
        `- Brief mode: write the shortest useful story for a reviewer who wants the quick shape before reading the diff directly.\n` +
        `- Use one compact stop per meaningful change cluster. Do not create line-by-line stops unless a single line is the whole risk.\n` +
        `- Each "why" should be exactly one short sentence in first person: what changed, why it matters, and where to glance.\n` +
        `- Rebuild context inside the changed step's viewport when possible; spend a separate context step only when the entry point or contract lives elsewhere.\n` +
        `- Keep titles concrete and skim-friendly. Skip low-risk mechanical explanation while still covering every changed hunk.\n\n`
      : storyMode === 'detailed'
      ? `Detail level contract:\n` +
        `- Line-by-line mode: write a longer correctness story for a reviewer who wants to verify the code is exactly right.\n` +
        `- Prefer more, smaller stops when a function contains separate decisions; split separate branches, guards, state writes, external calls, and error paths instead of hiding them in one broad paragraph.\n` +
        `- Explain important ranges almost line-by-line: name the method, then describe what the first guard checks, what the next assignment or call prepares, what each branch accepts or rejects, and what state, return value, event, render, or side effect follows.\n` +
        `- Cover all meaningful code paths: happy path, validation guards, failure cases, fallback behavior, persistence, cleanup, tests, and generated artifacts when they matter.\n` +
        `- Trace the relevant inbound trigger and outbound consumer or side effect, including unchanged boundary code when it controls correctness.\n` +
        `- Use exact function, variable, parameter, event, and field names, but do not paste code blocks or duplicate the diff.\n` +
        `- Line-by-line does not mean noisy: skip trivial syntax, imports, and mechanical plumbing unless they change correctness.\n\n`
      : `Detail level contract:\n` +
        `- Balanced mode: write the current concise review story, optimized for a human who will read the code after you orient them.\n` +
        `- Use only the few context bridges needed to restore the task-local app flow; do not tour unrelated architecture.\n` +
        `- Keep steps grouped by review question and code flow; avoid line-by-line narration unless the line is a correctness hinge.\n\n`;
  return (
    `Use the diffstory-storyteller skill to create a diffStory for exactly this change: ${diff}.\n\n` +
    `Write ${DATA_DIR}/story.json and set its "base" field to "${baseRef}"${headField} and set its "mode" field to "${storyMode}". The story is for a human ` +
    `reviewer, not a changelog.\n\n` +
    modeContract +
    storyScopeContract +
    scopeContract +
    `Assume the reviewer remembers the requested outcome but not the app internals: module ownership, the existing call path, state flow, or why nearby unchanged code matters. Rebuild the smallest useful mental model before asking them to judge the changed lines.\n\n` +
    `Work in four phases, in order. Phases 1 through 3 produce short visible notes in your output before any JSON; only phase 4 writes the file.\n\n` +
    `Live progress notes (streamed to the reviewer while you work):\n` +
    `- Announce each phase as you enter it by printing its marker alone on its own line, exactly: ">> Recovering the why", then ">> Reconstructing the app path", then ">> Storyboarding the camera", then ">> Writing the steps".\n` +
    `- Print every phase note as its own line starting with ">> " — for example ">> Goal: enable keepers to cap the fee" or ">> Arc: the cap is stored, then enforced, then tested".\n` +
    `- Keep each note to one short, concrete sentence. These lines are shown live in the review UI, so no filler and no markdown.\n\n` +
    `Phase 1 — Recover the why (do this before reading the diff):\n` +
    `- Gather intent evidence: read the commit messages behind this diff (for example git log --oneline -15 over the diffed range or ref), the PR title and body when one exists (gh pr view --json title,body — skip quietly if there is no PR or no gh), and any plan, design, or changelog notes the change touches or references.\n` +
    `- Legitimate intent evidence: commit messages, PR bodies, docs, code comments, tests. Not evidence: branch names, filenames, vibes.\n` +
    `- State the goal as actor + capability: "We wanted to enable <actor> to <capability>". If the change is not user-facing, name the real actor from the code, like reviewer, operator, keeper, service, or system. Then state the designed flow that achieves it: "To make that work, the existing app path reaches X, this change attaches at Y, and Z now returns/stores/renders P".\n` +
    `- Write both into the story as "intent": {"goal": "...", "design": "...", "sources": ["commit abc1234", "PR #12 body", "docs/plan.md"]}. Every entry in "sources" names evidence you actually read.\n` +
    `- If no evidence exists, set "goal" to what the code demonstrably enables, use "sources": ["code-derived"], and keep the wording narrow. Never invent product intent.\n` +
    `- If the evidence contradicts what the code does, say so in the summary instead of silently picking one.\n\n` +
    `Phase 2 — Reconstruct the app path (do this before storyboarding):\n` +
    `- Read the exact diff, then read the complete post-change function, component, contract, schema, or test around every hunk. The diff says what moved; the surrounding source says where it lives.\n` +
    `- Trace the smallest useful path one hop in both directions: find the inbound trigger, caller, route, event, or UI action; then find the outbound consumer, state write, render, return, external boundary, or assertion. Use symbol search and actual call sites, not filenames or guesses.\n` +
    `- Inspect the base-side code when the reviewer needs to understand the previous behavior or a deletion. Read only relevant module docs, types, config, and tests; do not turn this into a repo tour.\n` +
    `- Build a private context map: entry -> existing owner -> changed decision -> downstream effect -> proof or risk. For each link, record the exact source span and whether it belongs in the same viewport or needs a dedicated "context" step.\n` +
    `- Make "intent.design" name the existing app path, the attachment point for this diff, and the new outcome. If reviewer guidance contains the original task, treat it as intent evidence, cite "reviewer guidance", and call out any mismatch with the code.\n\n` +
    `Phase 3 — Storyboard the camera (do this before writing any JSON):\n` +
    `- Write the narrative arc as a visible note: intent -> flow -> implementation, not a list of touched files. Shape: "To enable <goal> we designed <flow>. To implement that flow, I first changed Y in Z, then wired U into P, then pinned it with tests/docs".\n` +
    `- Turn the context map into a reviewer-visible path: app orientation -> behavioral entry -> changed decision -> downstream consequence -> proof. The first stop is the behavioral entry point, even when that requires a context step. Do not start with imports, icons, styling, generated output, or tests unless one of those is itself the feature.\n` +
    `- Use viewport and highlights as a guided camera. One step is one local shot that fits without manual scrolling. One beat is one exact pointing gesture whose highlighted lines visibly prove its sentence.\n` +
    `- For a changed step, prefer three quick camera beats when the code supports them: an orientation beat on the existing signature/caller/route/contract, a change beat on the exact new decision, and a consequence beat on the return/state write/call/assertion affected next. Context beats may and should highlight unchanged lines.\n` +
    `- Add a dedicated context step when the caller, owner contract, stored field, feature flag, or downstream consumer is outside the changed hunk and the reviewer cannot judge the change without it. Say explicitly that it is unchanged; never add context as scenery.\n` +
    `- Order the stops by runtime, control, and data flow — never by filename. Small changes may need one context-rich changed step; do not force a fixed number of stops.\n` +
    `- Order test: if sorting your planned steps by filename would not change how the story reads, it is not a story yet — reorder, or state in one line why file order genuinely is the clearest path.\n` +
    `- Thread rule: every step's first beat except the first must pick up what the previous step established ("Now that the cap is stored, here is who reads it"), so the steps read as one continuous story.\n` +
    `- Group related edits into one stop; do not emit one step per file or one step per hunk. Put tests, snapshots, and docs after the behavior they verify or explain. Only narrate generated files when they are not excluded and the behavior depends on reviewing them.\n` +
    `- Each step must answer a reviewer question: where does the behavior start; what invariant changed; what is passed, rejected, stored, or rendered; what risk should the reviewer inspect; what proves this path works. Titles should read like falsifiable review claims or risks, not file captions.\n\n` +
    `Phase 4 — Write the steps. Mechanics checklist:\n\n` +
    `Viewport contract:\n` +
    `- Every step must include "viewport": [startLine, endLine]. This is what the reviewer sees, chosen from the requirement and the code shape, not from the tiny diff hunk.\n` +
    `- Every step must include "highlights": [[startLine, endLine], ...]. These are the lines the story is currently talking about and the rows diffStory should glow while reading.\n` +
    `- Pick the viewport first: usually the whole local method, storage struct, schema block, config stanza, test case, or small file section someone needs after reading the requirement. It must answer "where am I?" before the glow asks for judgment.\n` +
    `- A normal viewport is one screen and at most 60 lines. Split a larger function into overlapping local shots instead of asking the reviewer to hunt inside it. The [0, 0] deletion sentinel is the exception.\n` +
    `- Pick highlights second: the existing signature/caller/route that orients the reviewer, the exact changed decision, and the nearby call/state write/assertion/return that shows its consequence. Unchanged lines are valid highlights when they restore context.\n` +
    `- Each beat highlight should point at one fact, normally 1-8 lines and never more than 12. A broad glowing region is not a pointer; split it.\n` +
    `- Keep "highlights" inside "viewport". It is fine for the viewport to be much wider than the changed lines when that helps the reviewer understand the flow.\n` +
    `- Keep "range" and every beat highlight inside "viewport". For new stories, top-level "highlights" must match the union of the beat highlights so there is one camera plan, not two conflicting ones.\n` +
    `- Do not make one step jump between far-apart highlight islands. If the story needs distant lines, split it into separate steps so each viewport/highlights pair stays local and scroll-stable.\n` +
    `- Keep "range" as the changed-line coverage anchor the coverage gate checks. "range" proves the changed hunk is covered; "viewport" controls what the diff viewer shows.\n\n` +
    `Beat contract:\n` +
    `- Every new step must include "beats": [{"text": "short narration", "highlights": [[startLine, endLine]]}, ...].\n` +
    `- Each beat is a separate speech unit for read-aloud, so the code highlight can move exactly when the voice moves.\n` +
    `- Use one beat per highlighted code part. If a step has three review points, write three beats instead of one long "why".\n` +
    `- The first beat must locate the reviewer in the existing flow unless the preceding context step already did; then point at the changed decision and its consequence in later beats.\n` +
    `- A beat may point at one small range or a few nearby related ranges, but it must stay inside the step "viewport".\n` +
    `- Do not put one big speech over several highlight groups; split it into beat-by-beat narration.\n` +
    `- Keep "why" as a compact fallback recap for older readers, but put the read-aloud story in "beats".\n\n` +
    `Context contract:\n` +
    `- Context belongs in the visible story, not only in your private notes. First try to frame the existing boundary and changed code together in one viewport.\n` +
    `- Use kind "context" for important unchanged code in another file or distant section: a caller, public route, component owner, schema/storage contract, feature flag, or downstream consumer. Context steps do not claim diff coverage.\n` +
    `- Brief mode normally avoids dedicated context steps; balanced mode uses only the few bridges needed to restore the flow; detailed mode may follow additional correctness boundaries.\n` +
    `- Never use context for imports, nearby trivia, or architecture that does not change how the reviewer evaluates this task.\n\n` +
    `Writing contract:\n` +
    `- The top-level "summary" is the reading map: 1-3 short informal sentences on how the steps walk the implementation and where the reviewer should slow down. The goal and designed flow live in "intent"; do not repeat them in the summary.\n` +
    `- Step titles should name the exact behavior or risk being reviewed.\n` +
    `- Each "why" is the compact fallback recap for that stop; keep it to ${whyLength} in first person.\n` +
    `- Each beat is the synchronized story note: explain the local code part, why it matters, and what the next caller/helper/path can now do while its highlights glow.\n` +
    `- Prefer causal chains like "I added this parameter to method X so method Y can pass Z, which lets H handle...".\n` +
    `- Include what to verify only inside that story, not as a detached checklist.\n` +
    `- Avoid filler like "adds", "updates", "this file", or restating the diff.\n` +
    `- Prefer specific protocol/product language from the code over generic narrative.\n\n` +
    `Voice contract:\n` +
    `- Make the story lively, specific, and a little fun, like a sharp teammate guiding review.\n` +
    `- Keep it informal and to the point. No long paragraphs, no essay mode, no drama.\n` +
    `- Use active verbs, concrete nouns, and quick stakes: what could break, what now holds, what got simpler.\n` +
    `- No corporate changelog voice, no sleepy "This updates..." phrasing, and no bland summary captions.\n` +
    `- Keep the fun in the wording, not in fake confidence: correctness beats jokes every time.\n\n` +
    `Coverage contract:\n` +
    `- Coverage is necessary, but not sufficient.\n` +
    `- Before writing ${DATA_DIR}/story.json, build a private coverage ledger: file, changed hunk range, semantic ` +
    `purpose, and planned step id.\n` +
    `- Cover every changed hunk with a changed/new-file step.\n` +
    `- Never use "deleted" as a step kind. For deleted files, use kind "changed" and anchor the range at the post-change deletion location the coverage gate reports.\n` +
    `- For a whole deleted file, use range, viewport, and highlights of [0, 0]. Do not invent line 1 for a file that no longer exists.\n` +
    `- Use context steps only for unchanged code that makes the review easier.\n` +
    `- Cover every changed hunk so the coverage gate is clean — the review flags any change no step explains.\n\n` +
    `Range contract:\n` +
    `- Read the post-change file with line numbers before choosing ranges.\n` +
    `- "range" is only the changed-line coverage anchor; "viewport" is the review window. Keep the range inside its viewport and split distant hunks into separate steps.\n` +
    `- Do not use whole-file or giant ranges unless the whole file is new and small, or the entire file is truly ` +
    `the review unit.\n` +
    `- For pure deletions with surviving surrounding code, anchor the step at the post-change location where the deletion happened and include the ` +
    `smallest surrounding code that explains the removed behavior.\n` +
    `- For whole-file deletions with no post-change lines, use the [0, 0] deletion sentinel for "range", "viewport", and "highlights".\n\n` +
    `Focus pointer contract:\n` +
    `- Prefer "highlights" for new stories. "focus": {"ranges": [[startLine, endLine]], "label": "short cue"} is the legacy spelling and should only be used for compatibility.\n` +
    `- Highlight ranges must use post-change line numbers and stay inside that step's "viewport".\n` +
    `- In brief mode, highlight only the one exact line or tiny block the reviewer should glance at.\n` +
    `- In balanced mode, highlight only the exact line or tiny block the reviewer should look at while listening.\n` +
    `- In line-by-line mode, use multiple highlight ranges for guards, branches, state writes, external calls, assertions, and other line-by-line correctness pivots.\n\n` +
    `Truth contract:\n` +
    `- Only describe behavior you verified in the diff or current source lines you read.\n` +
    `- The "intent" block must only claim a why its "sources" actually support.\n` +
    `- Do not infer intent from branch names, filenames, or vibes.\n` +
    `- Do not claim tests pass unless you ran them.\n` +
    `- Do not claim a test covers behavior unless the assertion is visible in the story range or in code you read.\n` +
    `- If you are uncertain, narrow the claim to what the code shows.\n\n` +
    `Falsifiable self-review before finishing:\n` +
    `- Memory test: read only intent, summary, titles, and beats. A reviewer who remembers the request but not the app must be able to answer where the behavior enters, who owns it, what changed, where the result goes, and what proves or threatens it.\n` +
    `- Camera test: follow only the files, viewports, and highlighted groups. Every beat's glow must visibly prove that sentence without scrolling or guessing; no viewport may exceed 60 lines and no beat highlight may exceed 12.\n` +
    `- Re-run the order test on the final steps: if filename order reads the same, reorder.\n` +
    `- Why test: strike any beat that only restates what the code does; every step must say why it exists in the designed flow and what it unlocks next.\n` +
    `- Thread test: read only the beats in order with no code — they must still form one continuous story with no jumps.\n` +
    `- Check every title names behavior/risk, every "why" stays compact, and calls/returnsTo reflect real control/data flow. Remove vague filler and unsupported safety claims.\n` +
    `- Coverage: every changed hunk is claimed by a changed/new-file step; every changed/new-file step has a beat overlapping its range; range and highlights stay inside viewport; context steps alone point at wholly unchanged code; ids, order, calls, and returnsTo resolve.\n\n` +
    `Do not ask questions. Generate it directly.`
  );
}

/**
 * Instruct the agent to address review comments via the address-review skill.
 *
 * `base` is the diff's target ref (the "other side" of the change). `head` is the
 * current side: when set, the review compares two committed refs (`base..head`) and
 * the agent must read both via git; when omitted, the current side is the live
 * working tree (`base..working tree`). Either way the prompt forces the agent to
 * ground every answer in BOTH sides instead of the single tree it has checked out —
 * without this it reads only the current code and can wrongly claim a changed symbol
 * "doesn't exist".
 */
export interface AddressPromptOptions {
  historicalCheckout?: boolean;
  originalRepo?: string;
  resumedCodexTask?: boolean;
}

export function addressPrompt(
  target: string[] | 'all',
  base?: string,
  head?: string,
  opts: AddressPromptOptions = {},
): string {
  const scope =
    target === 'all'
      ? 'every comment whose status is "open"'
      : `the comments with these ids: ${target.join(', ')}`;
  // The "current" side is a committed ref (head) or the live working tree.
  const curName = head ? `"${head}" (the current side)` : 'the current working tree (this side)';
  const curRead = head
    ? `read the current side with "git show ${head}:<file>"`
    : 'read the working-tree version directly';
  const diffCmd = head ? `git diff ${base}..${head} -- <file>` : `git diff ${base} -- <file>`;
  const grounding = base
    ? `Two-sided grounding contract — this review IS a diff; never answer from one side:\n` +
      `- The change under review is "${base}" (the target side) compared against ${curName}. A comment can be about something added, removed, or moved between the two.\n` +
      `- Each comment may include side: "left" for the target/old side or side: "right" for the current/new side. Use that side to locate the selected text first, then still inspect the opposite side before answering.\n` +
      `- Before you reply to any comment, inspect BOTH sides of its selected text location: ${curRead}, and read the target side with "git show ${base}:<file>". Run "${diffCmd}" to see exactly what changed around that selected snippet.\n` +
      `- Never say a symbol, field, or branch "doesn't exist", "isn't here yet", or "lives elsewhere" based on one side alone — that is the failure this contract exists to prevent. Check the other side and the diff first.\n` +
      `- Do not invent branch names, commit hashes, or history. If the two sides don't settle it, say what they show and stop — no guessing.\n\n`
    : '';
  const historical =
    opts.historicalCheckout && head && opts.resumedCodexTask
      ? `Pinned historical review contract:\n` +
        `- This resumed Codex task stays in the live repository, but the reviewed current side is the pinned commit "${head}", not today's working tree.\n` +
        `- Do not edit source files. Read the reviewed code with "git show ${head}:<file>" and the exact change with "git diff ${base}..${head} -- <file>".\n` +
        `- You may update ${DATA_DIR}/comments.json in the live repository so the review conversation receives your answer.\n` +
        `- For change or nit requests, append a new ai turn with the exact file/function and change you recommend instead of modifying the live branch.\n\n`
      : opts.historicalCheckout && head
      ? `Historical checkout contract:\n` +
        `- You are running in a temporary checkout of "${head}" so code reads match the story's post-change side, even if the live repository has moved on.\n` +
        (opts.originalRepo ? `- The live repository is ${opts.originalRepo}; use it only as identity context, not as the code state under review.\n` : '') +
        `- Do not edit source files in this historical checkout. For change or nit requests, answer by appending a new ai turn (per the Conversation contract below) with the exact file/function and change you recommend instead of modifying the live branch.\n` +
        `- For questions, answer from this checkout plus the explicit base/head diff above.\n\n`
      : '';
  const actionRules = opts.historicalCheckout
    ? `Act by type for each one:\n` +
      `- change → do not edit source files; answer concretely by appending a new ai turn with the exact change you would make on the live branch.\n` +
      `- question → read both sides of the selected text location, then answer concretely by appending a new ai turn.\n` +
      `- nit → answer with the small adjustment by appending a new ai turn; do not edit source files in the temporary checkout.\n\n`
    : `Act by type for each one:\n` +
      `- change → make the requested edit; if you genuinely disagree, leave "status" as "open" and make your case by appending an ai turn.\n` +
      `- question → read both sides of the selected text location, then answer concretely by appending a new ai turn.\n` +
      `- nit → apply it if quick and reasonable; otherwise explain the trade-off by appending a new ai turn.\n\n`;
  return (
    `Use the diffStory address-review skill to address ${scope} in ${DATA_DIR}/comments.json.\n\n` +
    grounding +
    historical +
    actionRules +
    `Conversation contract:\n` +
    `- Each comment is a conversation. Its "body" is the reviewer's first message, followed by "turns" — an ordered list of {"role":"user"|"ai","text","at"} messages (a legacy comment may instead have a single "reply" string; treat it as the first ai turn).\n` +
    `- Read the whole thread and answer the latest "user" message in that context.\n\n` +
    `For every comment you handle: append a new turn {"role":"ai","text":"<your specific answer — name the function or file you changed, or give your answer>","at":"<ISO 8601 timestamp>"} to its "turns" array (create the array if it is absent). Never overwrite "body" or an existing turn. Then set "status" to "addressed". Preserve every other field and never delete a comment.\n\n` +
    `If your edits moved code, re-run the diffstory-storyteller skill so ${DATA_DIR}/story.json line ranges ` +
    `stay correct and the coverage gate stays clean.\n\n` +
    `Do not ask questions. Make the changes directly.`
  );
}

export type StoryRepairAction = 'explain' | 'shorten' | 'split';

/** A narrow story edit: preserve the good walkthrough and repair only one weak stop. */
export function storyRepairPrompt(input: {
  action: StoryRepairAction;
  file?: string;
  line?: number;
  stepId?: string;
  base: string;
  head?: string;
}): string {
  const target = input.stepId
    ? `story step "${input.stepId}"${input.file ? ` in ${input.file}` : ''}`
    : input.file
      ? `${input.file}${input.line ? ` around line ${input.line}` : ''}`
      : 'the selected story area';
  const instruction =
    input.action === 'explain'
      ? `Add or repair the smallest story step needed to explain the uncovered change at ${target}.`
      : input.action === 'shorten'
        ? `Rewrite ${target} to be shorter and sharper without dropping its review risk or causal link.`
        : `Split ${target} into two or more locally focused steps so no step jumps between distant code islands.`;
  const diff = input.head ? `${input.base}..${input.head}` : `${input.base}..working tree`;
  return (
    `Use the diffstory-storyteller skill to make one targeted repair to ${DATA_DIR}/story.json for ${diff}.\n\n` +
    `${instruction}\n\n` +
    `Preservation contract:\n` +
    `- Read the existing story and the real diff before editing. Preserve every unaffected step, the recovered intent, story scope, tone, and useful beat/highlight detail.\n` +
    `- Do not regenerate the walkthrough from scratch and do not reorder unrelated steps.\n` +
    `- Keep the story short, informal, causal, and review-oriented.\n` +
    `- Renumber order fields and repair calls/returnsTo only where the targeted edit requires it.\n` +
    `- Validate every range, viewport, highlight, beat, id, and full-diff coverage before finishing.\n` +
    `- Write the repaired JSON back to ${DATA_DIR}/story.json. Do not ask questions.\n`
  );
}

/** Broadly-available default so a plan-gated default model (e.g. Fable) can't break `story`. */
export const DEFAULT_CLAUDE_MODEL = 'sonnet';

export function normalizeCodexRunOptions(input: {
  codexSandbox?: unknown;
  codexProvider?: unknown;
  codexProfile?: unknown;
  codexConfig?: unknown;
}): CodexRunOptions {
  const sandbox = (['full-auto', 'workspace-write', 'read-only', 'danger-full-access'] as const).includes(
    input.codexSandbox as CodexSandbox,
  )
    ? (input.codexSandbox as CodexSandbox)
    : 'full-auto';
  const provider = (['default', 'lmstudio', 'ollama'] as const).includes(input.codexProvider as CodexProvider)
    ? (input.codexProvider as CodexProvider)
    : 'default';
  const profile =
    typeof input.codexProfile === 'string' && input.codexProfile.trim() ? input.codexProfile.trim() : undefined;
  const rawConfig = Array.isArray(input.codexConfig)
    ? input.codexConfig
    : typeof input.codexConfig === 'string'
      ? input.codexConfig.split('\n')
      : [];
  const config = rawConfig
    .map((line) => String(line).trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .slice(0, 20);
  return { sandbox, provider, profile, config };
}

function codexArgs(prompt: string, model?: string, opts: CodexRunOptions = {}): string[] {
  const args = opts.threadId ? ['exec', 'resume'] : ['exec'];
  const sandbox = opts.sandbox ?? 'full-auto';
  // `exec resume` inherits the task's cwd and permission settings. Its CLI does
  // not accept the normal --sandbox/--profile/provider flags, so only apply
  // those when creating a new task.
  if (!opts.threadId) {
    if (sandbox === 'full-auto') args.push('--full-auto');
    else if (sandbox === 'danger-full-access') args.push('--dangerously-bypass-approvals-and-sandbox');
    else args.push('--sandbox', sandbox);
    if (opts.provider === 'lmstudio' || opts.provider === 'ollama') args.push('--oss', '--local-provider', opts.provider);
    if (opts.profile) args.push('--profile', opts.profile);
  } else if (sandbox === 'danger-full-access') {
    args.push('--dangerously-bypass-approvals-and-sandbox');
  }
  for (const cfg of opts.config ?? []) args.push('-c', cfg);
  if (model) args.push('--model', model);
  if (opts.json) args.push('--json');
  if (opts.threadId) args.push(opts.threadId);
  args.push(prompt);
  return args;
}

/** The headless command + args for an agent. Flags verified against each CLI's --help. */
export function agentCommand(agent: Agent, prompt: string, model?: string, options: AgentRunOptions = {}): [string, string[]] {
  if (agent === 'claude') {
    return ['claude', ['-p', prompt, '--permission-mode', 'acceptEdits', '--model', model ?? DEFAULT_CLAUDE_MODEL]];
  }
  // Discovery and execution must use the same runtime. On macOS the Desktop
  // app can bundle a newer Codex than the one on PATH; detecting the former
  // and launching the latter makes valid Desktop models fail at run time.
  return [options.codex?.binary ?? codexTaskBinary(), codexArgs(prompt, model, options.codex)];
}

/**
 * Run the agent in `repo`, capturing its (often noisy) output instead of dumping
 * it to the terminal. stdin is closed so an unexpected prompt can't hang us.
 * Returns the exit-ok flag and the captured output (shown only on failure).
 */
export function runAgent(
  agent: Agent,
  repo: string,
  prompt: string,
  model?: string,
  options: AgentRunOptions = {},
): Promise<{ ok: boolean; output: string }> {
  const [cmd, args] = agentCommand(agent, prompt, model, options);
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const cap = (b: Buffer) => {
      output += b.toString();
      if (output.length > 200_000) output = output.slice(-200_000); // cap memory
    };
    child.stdout?.on('data', cap);
    child.stderr?.on('data', cap);
    child.on('error', (e) => resolve({ ok: false, output: `${output}\n${String(e)}` }));
    child.on('close', (code) => resolve({ ok: code === 0, output }));
  });
}

// ---- live address loop: stream the agent's output to the review page ----

/** The streaming command + args for an agent. Flags verified against each CLI's --help. */
export function streamCommand(agent: Agent, prompt: string, model?: string, options: AgentRunOptions = {}): [string, string[]] {
  if (agent === 'claude') {
    return [
      'claude',
      ['-p', prompt, '--output-format', 'stream-json', '--verbose',
       '--permission-mode', 'acceptEdits', '--model', model ?? DEFAULT_CLAUDE_MODEL],
    ];
  }
  return [options.codex?.binary ?? codexTaskBinary(), codexArgs(prompt, model, options.codex)];
}

/** A readable one-line summary of a tool call for the activity feed. */
export function toolSummary(name: string, input: any): string {
  if (name === 'Bash') {
    const cmd = String(input?.command ?? '').replace(/\s+/g, ' ').trim();
    return cmd ? `$ ${cmd.length > 100 ? cmd.slice(0, 100) + '…' : cmd}` : '$ …';
  }
  const target = input?.file_path ?? input?.path ?? input?.pattern ?? '';
  return target ? `${name} ${target}` : name;
}

/** Normalize a TodoWrite `todos` array into the agent's plan checklist. */
export function planItems(todos: any): PlanItem[] {
  if (!Array.isArray(todos)) return [];
  return todos
    .map((t): PlanItem => {
      const status: PlanStatus =
        t?.status === 'in_progress' ? 'active' : t?.status === 'completed' ? 'done' : 'pending';
      const raw = status === 'active' ? (t?.activeForm ?? t?.content) : t?.content;
      return { text: String(raw ?? '').trim(), status };
    })
    .filter((i) => i.text);
}

/** Normalize one agent tool call into the most specific progress event. */
export function classifyTool(name: string, input: any): ProgressEvent {
  const file = input?.file_path ?? input?.path;
  switch (name) {
    case 'Read':
      return file ? fileEvent('read', name, String(file)) : toolEvent(name, name);
    case 'Write':
      return file ? fileEvent('write', name, String(file)) : toolEvent(name, name);
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return file ? fileEvent('edit', name, String(file)) : toolEvent(name, name);
    case 'Bash':
      return commandEvent(String(input?.command ?? ''));
    case 'Grep':
    case 'Glob':
      return activityEvent('search', toolSummary(name, input));
    case 'TodoWrite':
      return planEvent(planItems(input?.todos));
    case 'WebFetch':
    case 'WebSearch':
      return activityEvent('web', toolSummary(name, input));
    case 'Task':
      return activityEvent('task', 'Running a subtask');
    default:
      return toolEvent(toolSummary(name, input), name, file ? String(file) : undefined);
  }
}

/** Parse one line of Claude's stream-json into normalized events (non-JSON → none). */
export function parseClaudeStreamLine(line: string): ProgressEvent[] {
  const s = line.trim();
  if (!s) return [];
  let obj: any;
  try {
    obj = JSON.parse(s);
  } catch {
    return [];
  }
  if (obj?.type !== 'assistant' || !Array.isArray(obj.message?.content)) return [];
  const out: ProgressEvent[] = [];
  for (const block of obj.message.content) {
    if (block?.type === 'text' && block.text) out.push(textEvent(block.text));
    else if (block?.type === 'tool_use') out.push(classifyTool(block.name, block.input));
  }
  return out;
}

/** Extract a useful message from one Codex CLI error line, including `ERROR: {json}`. */
export function codexErrorMessage(line: string): string | undefined {
  const raw = line.trim();
  if (!raw) return undefined;
  const prefixed = /^ERROR:\s*/i.test(raw);
  const candidate = prefixed ? raw.replace(/^ERROR:\s*/i, '') : raw;
  try {
    const parsed = JSON.parse(candidate);
    if (!parsed || typeof parsed !== 'object') return undefined;
    const nested = parsed.error;
    const message =
      (nested && typeof nested === 'object' && typeof nested.message === 'string' && nested.message) ||
      (typeof nested === 'string' && nested) ||
      (typeof parsed.message === 'string' && parsed.message);
    return message ? String(message).trim() : undefined;
  } catch {
    return prefixed && candidate.trim() ? candidate.trim() : undefined;
  }
}

export interface AgentFailureSummary {
  label: string;
  detail: string;
  technicalDetail: string;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const clean = value.trim();
    if (!clean || seen.has(clean)) return false;
    seen.add(clean);
    return true;
  });
}

function compactFailureText(value: string, max = 420): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Turn noisy stdout/stderr into one actionable failure plus deduplicated diagnostics. */
export function summarizeAgentFailure(
  output: string,
  failure: 'startup' | 'execution' = 'execution',
): AgentFailureSummary {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const messages = unique(lines.map(codexErrorMessage).filter((message): message is string => !!message));
  const upgradeMessage = messages.find((message) => /\bmodel requires a newer version of Codex\b/i.test(message));
  if (upgradeMessage) {
    const model = /The ['"]([^'"]+)['"] model requires a newer version of Codex/i.exec(upgradeMessage)?.[1];
    return {
      label: model ? `Codex needs an update for ${model}` : 'Codex needs an update for this model',
      detail: 'The Codex runtime diffStory started cannot use this model. Update Codex, or choose another model and try again.',
      technicalDetail: upgradeMessage,
    };
  }

  const diagnosticLines = messages.length ? messages : unique(lines).slice(-12);
  const lastMessage = diagnosticLines.at(-1);
  return {
    label: failure === 'startup' ? 'The agent could not start' : 'The agent stopped before finishing',
    detail: lastMessage
      ? compactFailureText(lastMessage)
      : failure === 'startup'
        ? 'Check that the selected agent is installed, then try again.'
        : 'Try again. If it fails again, open the technical details below.',
    technicalDetail: diagnosticLines.join('\n'),
  };
}

/** Codex exec streams human-readable text or JSONL when a reusable task is requested. */
export function parseCodexStreamLine(line: string): ProgressEvent[] {
  const s = line.replace(/\s+$/, '');
  if (!s.trim()) return [];
  // Terminal JSON errors are summarized once after the process exits. Sending
  // them as live text too produces the duplicated raw wall the user saw.
  if (codexErrorMessage(s)) return [];
  try {
    const event = JSON.parse(s);
    const item = event?.item;
    if (event?.type !== 'item.completed' || !item) return [];
    if (item.type === 'agent_message' && item.text) return [textEvent(String(item.text))];
    if (item.type === 'command_execution' && item.command) return [commandEvent(String(item.command))];
    if (item.type === 'web_search') return [activityEvent('web', String(item.query ?? 'Searching the web'))];
    if (item.type === 'mcp_tool_call') return [toolEvent(String(item.tool ?? item.name ?? 'MCP tool'), 'MCP')];
    if (item.type === 'file_change') return [activityEvent('other', 'Updating files')];
    return [];
  } catch {
    // Human-readable Codex output follows the legacy path below.
  }
  const m = s.match(/^\s*\$\s+(.+)$/);
  if (m) return [commandEvent(m[1])];
  return [textEvent(s)];
}

export function codexThreadIdFromOutput(output: string): string | undefined {
  for (const line of output.split('\n')) {
    if (!line.trim().startsWith('{')) continue;
    try {
      const event = JSON.parse(line);
      const id = event?.thread_id ?? event?.threadId;
      if (event?.type === 'thread.started' && typeof id === 'string') return id;
    } catch {
      // Ignore non-JSON output mixed into the stream.
    }
  }
  return undefined;
}

function lineParser(agent: Agent): (line: string) => ProgressEvent[] {
  return agent === 'claude' ? parseClaudeStreamLine : parseCodexStreamLine;
}

/** Result of a streaming agent run; `failure` stages spawn vs non-zero-exit. */
export interface StreamResult {
  ok: boolean;
  output: string;
  failure?: 'startup' | 'execution';
  threadId?: string;
}

/**
 * Spawn the agent and stream normalized events as output arrives, calling `onEvent`
 * per parsed event. Resolves with ok/output and a `failure` discriminator the server
 * uses to stage errors. The spawn itself is integration-only — parsers are unit-tested.
 */
export function streamAgent(
  agent: Agent,
  repo: string,
  prompt: string,
  onEvent: (e: ProgressEvent) => void,
  model?: string,
  signal?: AbortSignal,
  options: AgentRunOptions = {},
): Promise<StreamResult> {
  const [cmd, args] = streamCommand(agent, prompt, model, options);
  const parse = lineParser(agent);
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], signal });
    let output = '';
    let buf = '';
    const feed = (b: Buffer) => {
      const text = b.toString();
      output += text;
      if (output.length > 200_000) output = output.slice(-200_000); // cap memory
      buf += text;
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const ln of lines) for (const e of parse(ln)) onEvent(e);
    };
    child.stdout?.on('data', feed);
    child.stderr?.on('data', feed);
    child.on('error', (e) => resolve({ ok: false, output: `${output}\n${String(e)}`, failure: 'startup' }));
    child.on('close', (code) => {
      if (buf) for (const e of parse(buf)) onEvent(e); // flush the last partial line
      const threadId = agent === 'codex' ? codexThreadIdFromOutput(output) : undefined;
      resolve(code === 0 ? { ok: true, output, threadId } : { ok: false, output, failure: 'execution', threadId });
    });
  });
}

/** Result of the shared pre-run guard for any agent run (address or generate). */
export type Preflight =
  | { ok: true; agent: Agent }
  | { ok: false; status: number; stage: 'preflight'; label: string; detail: string };

export type AgentSelection =
  | { ok: true; agent: Agent }
  | { ok: false; status: number; stage: 'preflight'; label: string; detail: string };

function agentLabel(agent: Agent): string {
  return agent.charAt(0).toUpperCase() + agent.slice(1);
}

/** Resolve an optional user-selected agent without silently falling back. */
export function selectAvailableAgent(requested: unknown, agents: Agent[], fallback: Agent): AgentSelection {
  if (requested === undefined || requested === null || requested === '') return { ok: true, agent: fallback };
  if (requested !== 'claude' && requested !== 'codex') {
    return {
      ok: false, status: 400, stage: 'preflight',
      label: 'Selected agent is not available',
      detail: 'Choose an installed agent: Claude, Codex.',
    };
  }
  if (!agents.includes(requested)) {
    const installed = agents.length ? agents.map(agentLabel).join(', ') : 'none';
    return {
      ok: false, status: 400, stage: 'preflight',
      label: 'Selected agent is not available',
      detail: `Pick an installed agent before addressing comments. Installed agents: ${installed}.`,
    };
  }
  return { ok: true, agent: requested };
}

/** Guard a would-be agent run: one-at-a-time, a repo open, an agent installed. */
export function agentPreflight(a: { repo: string | null; busy: boolean; agents: Agent[] }): Preflight {
  if (a.busy) {
    return {
      ok: false, status: 409, stage: 'preflight',
      label: 'An agent run is already in progress',
      detail: 'Wait for the current run to finish, or stop it, before starting another.',
    };
  }
  if (!a.repo) {
    return {
      ok: false, status: 409, stage: 'preflight',
      label: 'No repository is open',
      detail: 'Pick a repository before starting an agent run.',
    };
  }
  if (a.agents.length === 0) {
    return {
      ok: false, status: 400, stage: 'preflight',
      label: 'No agent CLI found',
      detail: 'Install "claude" or "codex" on your PATH to run the agent.',
    };
  }
  return { ok: true, agent: a.agents[0] };
}
