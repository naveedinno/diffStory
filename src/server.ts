// Tiny HTTP server over Node built-ins. The page is re-rendered on every GET, so
// refreshing reflects the current diff and tour with no watch process — exactly
// what the manual round-trip loop needs.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';
import { loadTour } from './tour.js';
import { resolveBase, getDiff, describeBase } from './git.js';
import { parseUnifiedDiff } from './diff.js';
import { renderPage } from './render.js';
import { loadComments, addComment, deleteComment, type NewComment } from './comments.js';
import { tourPath } from './config.js';

export interface ServeOptions {
  repo: string;
  port: number;
  baseOverride?: string;
  open: boolean;
}

export function serve(opts: ServeOptions): void {
  const server = createServer((req, res) => handle(req, res, opts));

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${opts.port} is in use. Try: cairn serve --port ${opts.port + 1}`);
    } else {
      console.error(`Server error: ${err.message}`);
    }
    process.exit(1);
  });

  server.listen(opts.port, () => {
    const url = `http://localhost:${opts.port}/`;
    console.log(`\n  cairn review ready → ${url}`);
    console.log(`  reviewing ${tourPath(opts.repo)}`);
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
    if (method === 'GET' && url.pathname === '/api/comments') {
      return sendJson(res, 200, loadComments(opts.repo));
    }
    if (method === 'POST' && url.pathname === '/api/comments') {
      return readBody(req, (body) => {
        try {
          const input = JSON.parse(body) as NewComment;
          const comment = addComment(opts.repo, input);
          sendJson(res, 201, comment);
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

function renderReview(opts: ServeOptions): string {
  const tour = loadTour(tourPath(opts.repo));
  const base = resolveBase(opts.repo, opts.baseOverride ?? tour.base);
  const diff = getDiff(opts.repo, base);
  const files = parseUnifiedDiff(diff);
  return renderPage({ repo: opts.repo, tour, files, baseLabel: describeBase(opts.repo, base) });
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
  return `<!doctype html><html><head><meta charset="utf-8"><title>cairn — error</title>
<style>body{background:#0d1117;color:#c9d1d9;font:15px/1.6 system-ui;padding:60px;max-width:70ch;margin:auto}
code{background:#161b22;padding:2px 6px;border-radius:4px}h1{color:#f85149}</style></head>
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
