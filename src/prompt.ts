// Tiny zero-dependency interactive prompts (numbered select + free text) built on
// node:readline/promises. Lets `diffstory serve` *ask* what to review instead of
// requiring --base / --head flags. Falls back silently when not a TTY.
import * as rlp from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export type RL = rlp.Interface;

/** True only when we can actually run an interactive prompt (real terminal). */
export function isInteractive(): boolean {
  return Boolean(input.isTTY && output.isTTY);
}

export function createPrompt(): RL {
  const rl = rlp.createInterface({ input, output });
  // Ctrl-C during a prompt should exit cleanly, not throw.
  rl.on('SIGINT', () => {
    output.write('\n');
    rl.close();
    process.exit(130);
  });
  return rl;
}

export interface Choice<T> {
  label: string;
  hint?: string;
  value: T;
}

/** Numbered single-select. Empty input picks `defaultIndex`. Re-asks on bad input. */
export async function select<T>(
  rl: RL,
  title: string,
  choices: Choice<T>[],
  defaultIndex = 0,
): Promise<T> {
  output.write(`\n${title}\n`);
  choices.forEach((c, i) => {
    const num = String(i + 1).padStart(2, ' ');
    const def = i === defaultIndex ? '  [default]' : '';
    output.write(`  ${num}) ${c.label}${c.hint ? `  — ${c.hint}` : ''}${def}\n`);
  });
  for (;;) {
    const raw = (await rl.question(`\nPick 1-${choices.length} [${defaultIndex + 1}]: `)).trim();
    if (!raw) return choices[defaultIndex].value;
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1 && n <= choices.length) return choices[n - 1].value;
    output.write(`  ↳ enter a number between 1 and ${choices.length}.\n`);
  }
}

/** Free-text prompt; returns the trimmed answer or `fallback` if empty. */
export async function askText(rl: RL, question: string, fallback = ''): Promise<string> {
  const ans = (await rl.question(question)).trim();
  return ans || fallback;
}
