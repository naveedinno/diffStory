// Tiny HTTP server over Node built-ins. The page is re-rendered on every GET, so
// refreshing reflects the current diff and tour with no watch process — exactly
// what the manual round-trip loop needs.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { loadTour } from './tour.js';
import { resolveBase, getDiff, describeBase, readWholeFile } from './git.js';
import { parseUnifiedDiff } from './diff.js';
import { computeCoverage } from './coverage.js';
import { renderPage, renderFullFile } from './render.js';
import { buildFullFileRows } from './view-model.js';
import { loadComments, addComment, deleteComment, setCommentStatus, } from './comments.js';
import { resolveStoryPath, APP_NAME, APP_BRAND } from './config.js';
import { availableAgents, streamAgent, addressPrompt } from './agent.js';
// Only one agent run at a time: concurrent runs editing the same working tree would collide.
let agentBusy = false;
export function serve(opts) {
    const server = createServer((req, res) => handle(req, res, opts));
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${opts.port} is in use. Try: ${APP_NAME} serve --port ${opts.port + 1}`);
        }
        else {
            console.error(`Server error: ${err.message}`);
        }
        process.exit(1);
    });
    server.listen(opts.port, () => {
        const url = `http://localhost:${opts.port}/`;
        console.log(`\n  ${APP_BRAND} review ready → ${url}`);
        console.log(`  reviewing ${resolveStoryPath(opts.repo)}`);
        console.log(`  comments save as you go; click "Ask agent" or "Address all open" in the page to get replies live.\n`);
        console.log(`  Ctrl-C to stop.\n`);
        if (opts.open)
            openBrowser(url);
    });
}
function handle(req, res, opts) {
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
                    const input = JSON.parse(body);
                    sendJson(res, 201, addComment(opts.repo, input));
                }
                catch (e) {
                    sendJson(res, 400, { error: e.message });
                }
            });
        }
        if (method === 'POST' && url.pathname === '/api/address') {
            if (agentBusy)
                return sendJson(res, 409, { error: 'An agent run is already in progress.' });
            return readBody(req, (body) => runAddress(res, opts, body));
        }
        if (method === 'PATCH' && url.pathname.startsWith('/api/comments/')) {
            const id = decodeURIComponent(url.pathname.slice('/api/comments/'.length));
            return readBody(req, (body) => {
                try {
                    const { status } = JSON.parse(body || '{}');
                    const updated = setCommentStatus(opts.repo, id, status ?? '');
                    if (updated)
                        sendJson(res, 200, updated);
                    else
                        sendJson(res, 404, { error: 'no such comment' });
                }
                catch (e) {
                    sendJson(res, 400, { error: e.message });
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
    }
    catch (e) {
        sendHtml(res, errorPage(e.message), 500);
    }
}
function loadReview(opts) {
    const tour = loadTour(resolveStoryPath(opts.repo));
    const base = resolveBase(opts.repo, opts.baseOverride ?? tour.base);
    const files = parseUnifiedDiff(getDiff(opts.repo, base, opts.headOverride));
    return { tour, base, files };
}
function renderReview(opts) {
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
function renderFullFileResponse(opts, file) {
    if (!file)
        return `<div class="ds-diffnote">No file requested.</div>`;
    const { tour, files } = loadReview(opts);
    // Allowlist: only files that appear in the diff or the tour can be read back —
    // keeps the endpoint from reading arbitrary paths off the working tree.
    const allowed = new Set([...files.map((f) => f.newPath), ...tour.steps.map((s) => s.file)]);
    if (!allowed.has(file))
        return `<div class="ds-diffnote">That file isn't part of this change.</div>`;
    const df = files.find((f) => f.newPath === file);
    const newLines = readWholeFile(opts.repo, file) ?? [];
    const ranges = computeCoverage(tour, files)
        .uncovered.filter((u) => u.file === file)
        .map((u) => u.range);
    const rows = buildFullFileRows(df, newLines, ranges);
    return renderFullFile(rows, { file, newFile: df?.status === 'added' });
}
/** Raw `git diff` text for the current review scope — used to detect agent code edits. */
function currentDiff(opts) {
    try {
        const tour = loadTour(resolveStoryPath(opts.repo));
        const base = resolveBase(opts.repo, opts.baseOverride ?? tour.base);
        return getDiff(opts.repo, base, opts.headOverride);
    }
    catch {
        return '';
    }
}
function tailLines(s, n) {
    return s.trimEnd().split('\n').slice(-n).join('\n');
}
/**
 * Drive the user's agent to address review comments and stream its output as NDJSON
 * (one JSON event per line: {type:'text'|'tool'|'error'|'done', ...}). Reuses the
 * address-review skill — the agent writes replies + edits code itself.
 */
function runAddress(res, opts, body) {
    let input;
    try {
        input = JSON.parse(body || '{}');
    }
    catch {
        return sendJson(res, 400, { error: 'invalid JSON' });
    }
    const target = input.all
        ? 'all'
        : Array.isArray(input.commentIds)
            ? input.commentIds
            : [];
    if (target !== 'all' && target.length === 0) {
        return sendJson(res, 400, { error: 'no comments specified' });
    }
    const agents = availableAgents();
    if (agents.length === 0) {
        return sendJson(res, 400, { error: 'No agent CLI found (looked for "claude" and "codex").' });
    }
    const agent = agents[0];
    agentBusy = true;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    const before = currentDiff(opts);
    const send = (e) => {
        try {
            res.write(JSON.stringify(e) + '\n');
        }
        catch {
            /* client disconnected */
        }
    };
    streamAgent(agent, opts.repo, addressPrompt(target), (e) => send(e))
        .then(({ ok, output }) => {
        const codeChanged = currentDiff(opts) !== before;
        if (!ok)
            send({ type: 'error', data: tailLines(output, 30) });
        send({ type: 'done', ok, codeChanged });
    })
        .catch((err) => send({ type: 'error', data: String(err) }))
        .finally(() => {
        res.end();
        agentBusy = false;
    });
}
function readBody(req, done) {
    let data = '';
    req.on('data', (chunk) => {
        data += chunk;
        if (data.length > 1_000_000)
            req.destroy(); // 1MB guard
    });
    req.on('end', () => done(data));
}
function sendHtml(res, html, status = 200) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
}
function sendJson(res, status, payload) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
}
function errorPage(message) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${APP_BRAND} — error</title>
<style>body{background:#0e0f13;color:#e7e8ec;font:15px/1.6 system-ui;padding:60px;max-width:70ch;margin:auto}
code{background:#16181d;padding:2px 6px;border-radius:4px}h1{color:#f85149}</style></head>
<body><h1>Couldn't build the review</h1><pre><code>${escapeText(message)}</code></pre>
<p>Fix the issue above and refresh. Most often the tour is missing or malformed — re-run <code>/review-tour</code>.</p>
</body></html>`;
}
function escapeText(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function openBrowser(url) {
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    try {
        spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
    }
    catch {
        /* opening the browser is best-effort */
    }
}
