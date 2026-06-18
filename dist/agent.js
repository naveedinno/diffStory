// Detect and drive the user's coding agent (Claude Code / Codex) headlessly to
// generate the story. The spawn itself is integration-only; the pure helpers
// (onPath, storyPrompt, agentCommand) are unit-tested.
import { spawn, spawnSync } from 'node:child_process';
import { DATA_DIR } from './config.js';
/** Whether `cmd` resolves on PATH (POSIX `command -v`). */
export function onPath(cmd) {
    return spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
}
/** Which agent CLIs are installed, in preference order. */
export function availableAgents() {
    return ['claude', 'codex'].filter(onPath);
}
/** The instruction handed to the agent — triggers the producer skill, pins the exact diff. */
export function storyPrompt(baseRef, headRef) {
    const diff = headRef ? `git diff ${baseRef}..${headRef} --` : `git diff ${baseRef} --`;
    return (`Use the diffStory review-tour skill to create a review story for exactly this change: ${diff}.\n\n` +
        `Write ${DATA_DIR}/story.json and set its "base" field to "${baseRef}". The story is for a human ` +
        `reviewer, not a changelog.\n\n` +
        `Reading order contract:\n` +
        `- Start at the entry point a reviewer should inspect first.\n` +
        `- Follow runtime/control/data flow across files, then return to callers when useful.\n` +
        `- Group related edits into one stop; do not emit one step per file or one step per hunk.\n` +
        `- Put tests, snapshots, docs, and generated files after the behavior they verify or explain.\n\n` +
        `Writing contract:\n` +
        `- Step titles should name the exact behavior or risk being reviewed.\n` +
        `- Each "why" must say what to verify, what is subtle, or why the change is safe.\n` +
        `- Avoid filler like "adds", "updates", "this file", or restating the diff.\n` +
        `- Prefer specific protocol/product language from the code over generic narrative.\n\n` +
        `Voice contract:\n` +
        `- Make the tour lively, specific, and a little fun, like a sharp teammate guiding review.\n` +
        `- Use active verbs, concrete nouns, and quick stakes: what could break, what now holds, what got simpler.\n` +
        `- No corporate changelog voice, no sleepy "This updates..." phrasing, and no bland summary captions.\n` +
        `- Keep the fun in the wording, not in fake confidence: correctness beats jokes every time.\n\n` +
        `Coverage contract:\n` +
        `- Cover every changed hunk with a changed/new-file step.\n` +
        `- Use context steps only for unchanged code that makes the review easier.\n` +
        `- Run diffstory check and adjust the story until the coverage gate is clean.\n\n` +
        `Do not ask questions. Generate it directly.`);
}
/** Instruct the agent to address review comments via the address-review skill. */
export function addressPrompt(target) {
    const scope = target === 'all'
        ? 'every comment whose status is "open"'
        : `the comments with these ids: ${target.join(', ')}`;
    return (`Use the diffStory address-review skill to address ${scope} in ${DATA_DIR}/comments.json.\n\n` +
        `Act by type for each one:\n` +
        `- change → make the requested edit; if you genuinely disagree, leave "status" as "open" and make your case in "reply".\n` +
        `- question → read the code at its file:line, then answer concretely in "reply".\n` +
        `- nit → apply it if quick and reasonable; otherwise explain the trade-off in "reply".\n\n` +
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
/** A readable one-line summary of a tool call for the live activity feed. */
export function toolSummary(name, input) {
    if (name === 'Bash') {
        const cmd = String(input?.command ?? '').replace(/\s+/g, ' ').trim();
        return cmd ? `$ ${cmd.length > 100 ? cmd.slice(0, 100) + '…' : cmd}` : '$ …';
    }
    const target = input?.file_path ?? input?.path ?? input?.pattern ?? '';
    return target ? `${name} ${target}` : name;
}
/** Parse one line of Claude's --output-format stream-json into events (non-JSON → none). */
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
        if (block?.type === 'text' && block.text) {
            out.push({ type: 'text', data: block.text });
        }
        else if (block?.type === 'tool_use') {
            out.push({ type: 'tool', data: toolSummary(block.name, block.input) });
        }
    }
    return out;
}
/** Codex exec streams human-readable text; forward non-empty lines as text. */
export function parseCodexStreamLine(line) {
    const s = line.replace(/\s+$/, '');
    return s.trim() ? [{ type: 'text', data: s }] : [];
}
function lineParser(agent) {
    return agent === 'claude' ? parseClaudeStreamLine : parseCodexStreamLine;
}
/**
 * Spawn the agent and stream normalized events as output arrives, calling `onEvent`
 * per parsed event. Resolves with the exit-ok flag and captured output (used for a
 * failure tail). The spawn itself is integration-only — the parsers are unit-tested.
 */
export function streamAgent(agent, repo, prompt, onEvent, model, signal) {
    const [cmd, args] = streamCommand(agent, prompt, model);
    const parse = lineParser(agent);
    return new Promise((resolve) => {
        // `signal` lets the server kill the agent when the client disconnects or hits Stop.
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
        child.on('error', (e) => resolve({ ok: false, output: `${output}\n${String(e)}` }));
        child.on('close', (code) => {
            if (buf)
                for (const e of parse(buf))
                    onEvent(e); // flush the last partial line
            resolve({ ok: code === 0, output });
        });
    });
}
/** Guard a would-be agent run: one-at-a-time, a repo open, an agent installed. */
export function agentPreflight(a) {
    if (a.busy)
        return { ok: false, status: 409, error: 'An agent run is already in progress.' };
    if (!a.repo)
        return { ok: false, status: 409, error: 'No repo is open.' };
    if (a.agents.length === 0) {
        return { ok: false, status: 400, error: 'No agent CLI found (looked for "claude" and "codex").' };
    }
    return { ok: true, agent: a.agents[0] };
}
