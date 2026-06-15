// Detect and drive the user's coding agent (Claude Code / Codex) headlessly to
// generate the story. The spawn itself is integration-only; the pure helpers
// (onPath, storyPrompt, agentCommand) are unit-tested.
import { spawnSync } from 'node:child_process';
import { DATA_DIR } from './config.js';
/** Whether `cmd` resolves on PATH (POSIX `command -v`). */
export function onPath(cmd) {
    return spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
}
/** Which agent CLIs are installed, in preference order. */
export function availableAgents() {
    return ['claude', 'codex'].filter(onPath);
}
/** The instruction handed to the agent — triggers the producer skill and pins the base. */
export function storyPrompt(baseLabel) {
    return (`Use the diffStory review-tour skill to create a review story for the current change in this repo. ` +
        `Diff against: ${baseLabel}. Write the reading plan to ${DATA_DIR}/story.json, set its "base" field ` +
        `to "${baseLabel}", and cover every changed hunk. Do not ask questions — generate it directly.`);
}
/** The headless command + args for an agent. Flags verified against each CLI's --help. */
export function agentCommand(agent, prompt) {
    return agent === 'claude'
        ? ['claude', ['-p', prompt, '--permission-mode', 'acceptEdits']]
        : ['codex', ['exec', '--full-auto', prompt]];
}
/** Run the agent in `repo`, streaming its output. Returns whether it exited 0. */
export function runAgent(agent, repo, prompt) {
    const [cmd, args] = agentCommand(agent, prompt);
    return spawnSync(cmd, args, { cwd: repo, stdio: 'inherit' }).status === 0;
}
