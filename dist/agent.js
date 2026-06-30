// Detect and drive the user's coding agent (Claude Code / Codex) headlessly to
// generate the story. The spawn itself is integration-only; the pure helpers
// (onPath, storyPrompt, agentCommand) are unit-tested.
import { spawn, spawnSync } from 'node:child_process';
import { DATA_DIR } from './config.js';
import { fileEvent, commandEvent, activityEvent, toolEvent, textEvent, planEvent, } from './progress.js';
export function normalizeStoryMode(mode) {
    return mode === 'detailed' ? 'detailed' : 'guided';
}
/** Whether `cmd` resolves on PATH (POSIX `command -v`). */
export function onPath(cmd) {
    return spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
}
/** Which agent CLIs are installed, in preference order. */
export function availableAgents() {
    return ['claude', 'codex'].filter(onPath);
}
/** Git pathspecs that hide generated/oversized files from the agent's own diff. */
function excludeArgs(excludePaths) {
    return excludePaths.map((p) => ` ':(exclude)${p}'`).join('');
}
/** The instruction handed to the agent — triggers the producer skill, pins the exact diff. */
export function storyPrompt(baseRef, headRef, mode = 'guided', excludePaths = []) {
    const storyMode = normalizeStoryMode(mode);
    const excl = excludeArgs(excludePaths);
    const diff = headRef ? `git diff ${baseRef}..${headRef} --${excl}` : `git diff ${baseRef} --${excl}`;
    const headField = headRef ? ` and its "head" field to "${headRef}"` : '';
    const scopeContract = excludePaths.length
        ? `Scope contract:\n` +
            `- These files are generated or oversized artifacts (regenerated ABIs, lockfiles, built bundles) and are intentionally excluded from this review: ${excludePaths.join(', ')}.\n` +
            `- Do not read, narrate, or write steps for them. "diffstory check" already excludes them, so the coverage gate will not ask you to cover them — adding them back only bloats the story.\n\n`
        : '';
    const whyLength = storyMode === 'detailed' ? '3-7 short sentences' : '1-3 short sentences';
    const modeContract = storyMode === 'detailed'
        ? `Story mode contract:\n` +
            `- Detailed correctness mode: write a longer audit story for a reviewer who wants to verify the code is exactly right.\n` +
            `- Prefer more, smaller stops when a function contains separate decisions; split separate branches, guards, state writes, external calls, and error paths instead of hiding them in one broad paragraph.\n` +
            `- Explain important ranges almost line-by-line: name the method, then describe what the first guard checks, what the next assignment or call prepares, what each branch accepts or rejects, and what state, return value, event, render, or side effect follows.\n` +
            `- Cover all meaningful code paths: happy path, validation guards, failure cases, fallback behavior, persistence, cleanup, tests, and generated artifacts when they matter.\n` +
            `- Use exact function, variable, parameter, event, and field names, but do not paste code blocks or duplicate the diff.\n` +
            `- Detailed does not mean noisy: skip trivial syntax, imports, and mechanical plumbing unless they change correctness.\n\n`
        : `Story mode contract:\n` +
            `- Guided review mode: write the current concise review story, optimized for a human who will read the code after you orient them.\n` +
            `- Keep steps grouped by review question and code flow; avoid line-by-line narration unless the line is a correctness hinge.\n\n`;
    return (`Use the diffStory review-tour skill to create a review story for exactly this change: ${diff}.\n\n` +
        `Write ${DATA_DIR}/story.json and set its "base" field to "${baseRef}"${headField} and set its "mode" field to "${storyMode}". The story is for a human ` +
        `reviewer, not a changelog.\n\n` +
        modeContract +
        scopeContract +
        `Reviewer map contract:\n` +
        `- Before writing JSON, build a private reviewer map. Do not include this map in the file.\n` +
        `- Assume the reviewer is auditing AI-authored code and needs a falsifiable mental model fast.\n` +
        `- Identify the behavior this change is really about, the first entry point to read, the control/data flow, ` +
        `the invariants or risks to verify, and which tests/docs/generated files support each behavior.\n\n` +
        `Narrative arc contract:\n` +
        `- Write it like an actual story: intent -> flow -> implementation, not a list of touched files.\n` +
        `- Start the summary from the goal the diff supports: "We wanted to enable <actor> to <capability>". If this is not user-facing, name the real actor from the code, like reviewer, operator, keeper, service, or system.\n` +
        `- Then explain the product or runtime shape: "To make that work, we designed the flow so X reaches Y, Y asks Z, and Z returns/stores/renders P".\n` +
        `- Then walk the implementation sequence: "To implement that flow, I first changed Y in Z, then wired U into P, then pinned it with tests/docs".\n` +
        `- Each step should continue that arc. Explain why this stop exists in the designed flow and what it unlocks next.\n` +
        `- Do not invent user intent. If the diff only proves a technical refactor, make the goal technical and keep it grounded.\n\n` +
        `Viewport contract:\n` +
        `- Every step must include "viewport": [startLine, endLine]. This is what the reviewer sees, chosen from the requirement and the code shape, not from the tiny diff hunk.\n` +
        `- Every step must include "highlights": [[startLine, endLine], ...]. These are the lines the story is currently talking about and the rows diffStory should glow while reading.\n` +
        `- Pick the viewport first: usually the whole method, storage struct, schema block, config stanza, test case, or small file section someone needs after reading the requirement.\n` +
        `- Pick highlights second: the exact fee field, parameter, branch, guard, call, state write, assertion, or return path being discussed inside that viewport.\n` +
        `- Keep "highlights" inside "viewport". It is fine for the viewport to be much wider than the changed lines when that helps the reviewer understand the flow.\n` +
        `- Keep "range" as the changed-line coverage anchor for diffstory check. "range" proves the changed hunk is covered; "viewport" controls what the diff viewer shows.\n\n` +
        `Reading order contract:\n` +
        `- Start where someone who just read the requirement should start: the new field, fee, struct, setting, endpoint, UI affordance, or public method that makes the requirement real.\n` +
        `- Follow the requirement's implementation flow across files, then return to callers when useful.\n` +
        `- Group related edits into one stop; do not emit one step per file or one step per hunk.\n` +
        `- Put tests, snapshots, docs, and generated files after the behavior they verify or explain.\n\n` +
        `Reviewer question contract:\n` +
        `- Each step must answer a reviewer question.\n` +
        `- Good questions: where does the behavior start; what invariant changed; what is passed, rejected, stored, ` +
        `or rendered; what risk should the reviewer inspect; what proves this path works.\n` +
        `- Titles should read like falsifiable review claims or risks, not file captions.\n\n` +
        `Writing contract:\n` +
        `- The top-level "summary" is the overview: 1-3 short informal sentences that say what we wanted to enable, ` +
        `what flow I designed for that, and how the steps walk the implementation.\n` +
        `- Step titles should name the exact behavior or risk being reviewed.\n` +
        `- Each "why" is the story paragraph for that stop: explain what changed here, why the old flow was not enough, ` +
        `how this code fits the designed flow, and what the next caller/helper/path can now do. Keep it to ${whyLength} in first person.\n` +
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
        `- Never use "deleted" as a step kind. For deleted files, use kind "changed" and anchor the range at the post-change deletion location that "diffstory check" reports.\n` +
        `- Use context steps only for unchanged code that makes the review easier.\n` +
        `- Run diffstory check and adjust the story until the coverage gate is clean.\n\n` +
        `Range contract:\n` +
        `- Read the post-change file with line numbers before choosing ranges.\n` +
        `- Ranges are review windows, not coverage hacks: use the smallest complete function/block/test/config region ` +
        `that makes the change understandable.\n` +
        `- Do not use whole-file or giant ranges unless the whole file is new and small, or the entire file is truly ` +
        `the review unit.\n` +
        `- For pure deletions, anchor the step at the post-change location where the deletion happened and include the ` +
        `smallest surrounding code that explains the removed behavior.\n\n` +
        `Focus pointer contract:\n` +
        `- Prefer "highlights" for new stories. "focus": {"ranges": [[startLine, endLine]], "label": "short cue"} is the legacy spelling and should only be used for compatibility.\n` +
        `- Highlight ranges must use post-change line numbers and stay inside that step's "viewport".\n` +
        `- In guided mode, highlight only the exact line or tiny block the reviewer should look at while listening.\n` +
        `- In detailed mode, use multiple highlight ranges for guards, branches, state writes, external calls, assertions, and other line-by-line correctness pivots.\n\n` +
        `Truth contract:\n` +
        `- Only describe behavior you verified in the diff or current source lines you read.\n` +
        `- Do not infer intent from branch names, filenames, or vibes.\n` +
        `- Do not claim tests pass unless you ran them.\n` +
        `- Do not claim a test covers behavior unless the assertion is visible in the story range or in code you read.\n` +
        `- If you are uncertain, narrow the claim to what the code shows.\n\n` +
        `Dry self-review before finishing:\n` +
        `- Re-read the story as a skeptical reviewer.\n` +
        `- Check that every title names behavior/risk, every why explains old flow -> local change -> next implication, ` +
        `and calls/returnsTo reflect real control/data flow.\n` +
        `- Remove vague filler and unsupported safety claims before saving.\n\n` +
        `Do not ask questions. Generate it directly.`);
}
export function addressPrompt(target, base, head, opts = {}) {
    const scope = target === 'all'
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
            `- Before you reply to any comment, inspect BOTH sides of its selected text location: ${curRead}, and read the target side with "git show ${base}:<file>". Run "${diffCmd}" to see exactly what changed around that selected snippet.\n` +
            `- Never say a symbol, field, or branch "doesn't exist", "isn't here yet", or "lives elsewhere" based on one side alone — that is the failure this contract exists to prevent. Check the other side and the diff first.\n` +
            `- Do not invent branch names, commit hashes, or history. If the two sides don't settle it, say what they show and stop — no guessing.\n\n`
        : '';
    const historical = opts.historicalCheckout && head
        ? `Historical checkout contract:\n` +
            `- You are running in a temporary checkout of "${head}" so code reads match the story's post-change side, even if the live repository has moved on.\n` +
            (opts.originalRepo ? `- The live repository is ${opts.originalRepo}; use it only as identity context, not as the code state under review.\n` : '') +
            `- Do not edit source files in this historical checkout. For change or nit requests, answer in "reply" with the exact file/function and change you recommend instead of modifying the live branch.\n` +
            `- For questions, answer from this checkout plus the explicit base/head diff above.\n\n`
        : '';
    const actionRules = opts.historicalCheckout
        ? `Act by type for each one:\n` +
            `- change → do not edit source files; answer concretely in "reply" with the exact change you would make on the live branch.\n` +
            `- question → read both sides of the selected text location, then answer concretely in "reply".\n` +
            `- nit → answer with the small adjustment in "reply"; do not edit source files in the temporary checkout.\n\n`
        : `Act by type for each one:\n` +
            `- change → make the requested edit; if you genuinely disagree, leave "status" as "open" and make your case in "reply".\n` +
            `- question → read both sides of the selected text location, then answer concretely in "reply".\n` +
            `- nit → apply it if quick and reasonable; otherwise explain the trade-off in "reply".\n\n`;
    return (`Use the diffStory address-review skill to address ${scope} in ${DATA_DIR}/comments.json.\n\n` +
        grounding +
        historical +
        actionRules +
        `For every comment you handle: set "status" to "addressed" and write a specific "reply" — name the ` +
        `function or file you changed, or give your answer. Preserve every other field and never delete a comment.\n\n` +
        `If your edits moved code, re-run the diffStory review-tour skill so ${DATA_DIR}/story.json line ranges ` +
        `stay correct, then run "diffstory check" until coverage is clean.\n\n` +
        `Do not ask questions. Make the changes directly.`);
}
/** Broadly-available default so a plan-gated default model (e.g. Fable) can't break `story`. */
export const DEFAULT_CLAUDE_MODEL = 'sonnet';
/** The headless command + args for an agent. Flags verified against each CLI's --help. */
export function agentCommand(agent, prompt, model) {
    if (agent === 'claude') {
        return ['claude', ['-p', prompt, '--permission-mode', 'acceptEdits', '--model', model ?? DEFAULT_CLAUDE_MODEL]];
    }
    const args = ['exec', '--full-auto'];
    if (model)
        args.push('--model', model);
    args.push(prompt);
    return ['codex', args];
}
/**
 * Run the agent in `repo`, capturing its (often noisy) output instead of dumping
 * it to the terminal. stdin is closed so an unexpected prompt can't hang us.
 * Returns the exit-ok flag and the captured output (shown only on failure).
 */
export function runAgent(agent, repo, prompt, model) {
    const [cmd, args] = agentCommand(agent, prompt, model);
    return new Promise((resolve) => {
        const child = spawn(cmd, args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] });
        let output = '';
        const cap = (b) => {
            output += b.toString();
            if (output.length > 200_000)
                output = output.slice(-200_000); // cap memory
        };
        child.stdout?.on('data', cap);
        child.stderr?.on('data', cap);
        child.on('error', (e) => resolve({ ok: false, output: `${output}\n${String(e)}` }));
        child.on('close', (code) => resolve({ ok: code === 0, output }));
    });
}
// ---- live address loop: stream the agent's output to the review page ----
/** The streaming command + args for an agent. Flags verified against each CLI's --help. */
export function streamCommand(agent, prompt, model) {
    if (agent === 'claude') {
        return [
            'claude',
            ['-p', prompt, '--output-format', 'stream-json', '--verbose',
                '--permission-mode', 'acceptEdits', '--model', model ?? DEFAULT_CLAUDE_MODEL],
        ];
    }
    const args = ['exec', '--full-auto'];
    if (model)
        args.push('--model', model);
    args.push(prompt);
    return ['codex', args];
}
/** A readable one-line summary of a tool call for the activity feed. */
export function toolSummary(name, input) {
    if (name === 'Bash') {
        const cmd = String(input?.command ?? '').replace(/\s+/g, ' ').trim();
        return cmd ? `$ ${cmd.length > 100 ? cmd.slice(0, 100) + '…' : cmd}` : '$ …';
    }
    const target = input?.file_path ?? input?.path ?? input?.pattern ?? '';
    return target ? `${name} ${target}` : name;
}
/** Normalize a TodoWrite `todos` array into the agent's plan checklist. */
export function planItems(todos) {
    if (!Array.isArray(todos))
        return [];
    return todos
        .map((t) => {
        const status = t?.status === 'in_progress' ? 'active' : t?.status === 'completed' ? 'done' : 'pending';
        const raw = status === 'active' ? (t?.activeForm ?? t?.content) : t?.content;
        return { text: String(raw ?? '').trim(), status };
    })
        .filter((i) => i.text);
}
/** Normalize one agent tool call into the most specific progress event. */
export function classifyTool(name, input) {
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
export function parseClaudeStreamLine(line) {
    const s = line.trim();
    if (!s)
        return [];
    let obj;
    try {
        obj = JSON.parse(s);
    }
    catch {
        return [];
    }
    if (obj?.type !== 'assistant' || !Array.isArray(obj.message?.content))
        return [];
    const out = [];
    for (const block of obj.message.content) {
        if (block?.type === 'text' && block.text)
            out.push(textEvent(block.text));
        else if (block?.type === 'tool_use')
            out.push(classifyTool(block.name, block.input));
    }
    return out;
}
/** Codex exec streams human-readable text; forward prose, promote `$ cmd` lines. */
export function parseCodexStreamLine(line) {
    const s = line.replace(/\s+$/, '');
    if (!s.trim())
        return [];
    const m = s.match(/^\s*\$\s+(.+)$/);
    if (m)
        return [commandEvent(m[1])];
    return [textEvent(s)];
}
function lineParser(agent) {
    return agent === 'claude' ? parseClaudeStreamLine : parseCodexStreamLine;
}
/**
 * Spawn the agent and stream normalized events as output arrives, calling `onEvent`
 * per parsed event. Resolves with ok/output and a `failure` discriminator the server
 * uses to stage errors. The spawn itself is integration-only — parsers are unit-tested.
 */
export function streamAgent(agent, repo, prompt, onEvent, model, signal) {
    const [cmd, args] = streamCommand(agent, prompt, model);
    const parse = lineParser(agent);
    return new Promise((resolve) => {
        const child = spawn(cmd, args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], signal });
        let output = '';
        let buf = '';
        const feed = (b) => {
            const text = b.toString();
            output += text;
            if (output.length > 200_000)
                output = output.slice(-200_000); // cap memory
            buf += text;
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';
            for (const ln of lines)
                for (const e of parse(ln))
                    onEvent(e);
        };
        child.stdout?.on('data', feed);
        child.stderr?.on('data', feed);
        child.on('error', (e) => resolve({ ok: false, output: `${output}\n${String(e)}`, failure: 'startup' }));
        child.on('close', (code) => {
            if (buf)
                for (const e of parse(buf))
                    onEvent(e); // flush the last partial line
            resolve(code === 0 ? { ok: true, output } : { ok: false, output, failure: 'execution' });
        });
    });
}
/** Guard a would-be agent run: one-at-a-time, a repo open, an agent installed. */
export function agentPreflight(a) {
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
