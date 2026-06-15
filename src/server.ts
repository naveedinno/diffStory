// Tiny HTTP server over Node built-ins. The page is re-rendered on every GET, so
// refreshing reflects the current diff and tour with no watch process — exactly
// what the manual round-trip loop needs.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';
import { loadTour } from './tour.js';
import { resolveBase, getDiff, describeBase, readWholeFile } from './git.js';
import { parseUnifiedDiff } from './diff.js';
import { computeCoverage } from './coverage.js';
import { renderPage, renderFullFile } from './render.js';
import { buildFullFileRows } from './view-model.js';
import {
  loadComments,
  addComment,
  deleteComment,
  setCommentStatus,
  type NewComment,
} from './comments.js';
import { resolveStoryPath, APP_NAME, APP_BRAND } from './config.js';
import type { DiffFile, Tour } from './types.js';

export interface ServeOptions {
  repo: string;
  port: number;
  baseOverride?: string;
  headOverride?: string;
  open: boolean;
}

export function serve(opts: ServeOptions): void {
  const server = createServer((req, res) => handle(req, res, opts));

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${opts.port} is in use. Try: ${APP_NAME} serve --port ${opts.port + 1}`);
    } else {
      console.error(`Server error: ${err.message}`);
    }
    process.exit(1);
  });

  server.listen(opts.port, () => {
    const url = `http://localhost:${opts.port}/`;
    console.log(`\n  ${APP_BRAND} review ready → ${url}`);
    console.log(`  reviewing ${resolveStoryPath(opts.repo)}`);
    console.log(`  comments are saved as you go; run /address-review to hand them back.\n`);
    console.log(`  Ctrl-C to stop.\n`);
    if (opts.open) openBrowser(url);
  });
}

function handle(req: IncomingMessage, res: ServerResponse, opts: ServeOptions): void {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const method = req.method ?? 'GET';

  try {
    if (method === 'GET' && url.pathname === '/') {
      return sendHtml(res, renderReview(opts));
    }
    if (method === 'GET' && url.pathname === '/api/fullfile') {
      return sendHtml(res, renderFullFileResponse(opts, url.searchParams.get('file') ?? ''));
    }
    if (method === 'GET' && url.pathname === '/api/comments') {
      return sendJson(res, 200, loadComments(opts.repo));
    }
    if (method === 'POST' && url.pathname === '/api/comments') {
      return readBody(req, (body) => {
        try {
          const input = JSON.parse(body) as NewComment;
          sendJson(res, 201, addComment(opts.repo, input));
        } catch (e) {
          sendJson(res, 400, { error: (e as Error).message });
        }
      });
    }
    if (method === 'PATCH' && url.pathname.startsWith('/api/comments/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/comments/'.length));
      return readBody(req, (body) => {
        try {
          const { status } = JSON.parse(body || '{}') as { status?: string };
          const updated = setCommentStatus(opts.repo, id, status ?? '');
          if (updated) sendJson(res, 200, updated);
          else sendJson(res, 404, { error: 'no such comment' });
        } catch (e) {
          sendJson(res, 400, { error: (e as Error).message });
        }
      });
    }
    if (method === 'DELETE' && url.pathname.startsWith('/api/comments/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/comments/'.length));
      const ok = deleteComment(opts.repo, id);
      res.statusCode = ok ? 204 : 404;
      res.end();
      return;
    }
    res.statusCode = 404;
    res.end('Not found');
  } catch (e) {
    sendHtml(res, errorPage((e as Error).message), 500);
  }
}

interface ReviewData {
  tour: Tour;
  base: string;
  files: DiffFile[];
}

function loadReview(opts: ServeOptions): ReviewData {
  const tour = loadTour(resolveStoryPath(opts.repo));
  const base = resolveBase(opts.repo, opts.baseOverride ?? tour.base);
  const files = parseUnifiedDiff(getDiff(opts.repo, base, opts.headOverride));
  return { tour, base, files };
}

function renderReview(opts: ServeOptions): string {
  const { tour, base, files } = loadReview(opts);
  return renderPage({
    repo: opts.repo,
    tour,
    files,
    baseLabel: describeBase(opts.repo, base),
    comments: loadComments(opts.repo),
  });
}

/** The lazily-loaded "Full file" side-by-side view for one file. */
function renderFullFileResponse(opts: ServeOptions, file: string): string {
  if (!file) return `<div class="ds-diffnote">No file requested.</div>`;
  const { tour, files } = loadReview(opts);

  // Allowlist: only files that appear in the diff or the tour can be read back —
  // keeps the endpoint from reading arbitrary paths off the working tree.
  const allowed = new Set<string>([...files.map((f) => f.newPath), ...tour.steps.map((s) => s.file)]);
  if (!allowed.has(file)) return `<div class="ds-diffnote">That file isn't part of this change.</div>`;

  const df = files.find((f) => f.newPath === file);
  const newLines = readWholeFile(opts.repo, file) ?? [];
  const ranges = computeCoverage(tour, files)
    .uncovered.filter((u) => u.file === file)
    .map((u) => u.range);
  const rows = buildFullFileRows(df, newLines, ranges);
  return renderFullFile(rows, { file, newFile: df?.status === 'added' });
}

function readBody(req: IncomingMessage, done: (body: string) => void): void {
  let data = '';
  req.on('data', (chunk) => {
    data += chunk;
    if (data.length > 1_000_000) req.destroy(); // 1MB guard
  });
  req.on('end', () => done(data));
}

function sendHtml(res: ServerResponse, html: string, status = 200): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function errorPage(message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${APP_BRAND} — error</title>
<style>body{background:#0e0f13;color:#e7e8ec;font:15px/1.6 system-ui;padding:60px;max-width:70ch;margin:auto}
code{background:#16181d;padding:2px 6px;border-radius:4px}h1{color:#f85149}</style></head>
<body><h1>Couldn't build the review</h1><pre><code>${escapeText(message)}</code></pre>
<p>Fix the issue above and refresh. Most often the tour is missing or malformed — re-run <code>/review-tour</code>.</p>
</body></html>`;
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* opening the browser is best-effort */
  }
}
