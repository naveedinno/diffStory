#!/usr/bin/env node
// diffStory launcher. There is no terminal review flow - everything (picking a
// repo, reading the diff, generating a story with your agent, replying to review
// comments) happens in the browser. This command only opens the local web app.
import { resolve } from 'node:path';
import { isGitRepo } from './git.js';
import { serve } from './server.js';
import { APP_NAME, APP_BRAND, DATA_DIR, DEFAULT_PORT } from './config.js';

const VERSION = '0.1.0';

interface Args {
  cmd: 'open' | 'help' | 'version';
  dir: string | null;
  port: number;
  open: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { cmd: 'open', dir: null, port: DEFAULT_PORT, open: true };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--dir') a.dir = resolve(argv[++i] ?? '.');
    else if (t === '--port') a.port = Number(argv[++i]) || DEFAULT_PORT;
    else if (t === '--no-open') a.open = false;
    else if (t === '--help' || t === '-h' || t === 'help') a.cmd = 'help';
    else if (t === '--version' || t === '-v') a.cmd = 'version';
  }
  return a;
}

function printHelp(): void {
  console.log(`
${APP_BRAND} opens in your browser.

Run \`${APP_NAME}\` to open the local browser app.

Pick a project from the list, choose what to diff, generate a story if you want
one, then read and comment in the page. The command only starts the app; the
review workflow lives in the browser.

Review files live in ${DATA_DIR}/ inside the repo you open.
Docs & issues: https://github.com/naveedinno/diffStory
`);
}

function main(): void {
  const a = parseArgs(process.argv.slice(2));
  if (a.cmd === 'help') return printHelp();
  if (a.cmd === 'version') {
    console.log(`${APP_NAME} ${VERSION}`);
    return;
  }
  const repo = a.dir && isGitRepo(a.dir) ? a.dir : null;
  serve({ repo, port: a.port, open: a.open });
}

main();
