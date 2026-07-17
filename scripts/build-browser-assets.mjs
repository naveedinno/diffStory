import { mkdir, cp } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = resolve(root, 'dist');

await mkdir(outdir, { recursive: true });

// Self-hosted woff2 fonts (Signal / Thread-Ledger type). Copy the vendored
// files next to the compiled server so it can serve them from /assets/fonts.
await mkdir(resolve(outdir, 'assets/fonts'), { recursive: true });
await cp(resolve(root, 'assets/fonts'), resolve(outdir, 'assets/fonts'), { recursive: true });
console.log('copied self-hosted fonts -> dist/assets/fonts');
await build({
  entryPoints: [resolve(root, 'node_modules/mermaid/dist/mermaid.esm.min.mjs')],
  outfile: resolve(outdir, 'mermaid.esm.min.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'eof',
  logLevel: 'info',
});
