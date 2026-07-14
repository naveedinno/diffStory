import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = resolve(root, 'dist');

await mkdir(outdir, { recursive: true });
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
