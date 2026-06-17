// Tiny HTTP server over Node built-ins. The page is re-rendered on every GET, so
// refreshing reflects the current diff and tour with no watch process. The repo
// is held in a mutable Session, so the same server can boot empty (app/picker
// mode) and switch repos at runtime via /api/repo/open.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { loadTour } from './tour.js';
import { isGitRepo, resolveBase, getDiff, describeBase, readWholeFile, listBranches, listRecentCommits, currentBranch } from './git.js';
import { parseUnifiedDiff } from './diff.js';
import { computeCoverage } from './coverage.js';
import { renderPage, renderFullFile } from './render.js';
import { renderPicker } from './picker.js';
import { renderChangePage } from './change-page.js';
import { summarizeChange } from './change-view.js';
import { basename } from 'node:path';
import { buildFullFileRows } from './view-model.js';
import { loadComments, addComment, deleteComment, setCommentStatus, } from './comments.js';
import { resolveStoryPath, APP_NAME, APP_BRAND } from './config.js';
import { availableAgents, streamAgent, addressPrompt, storyPrompt, agentPreflight } from './agent.js';
import { createSession, openSession, closeSession } from './session.js';
import { inspectRepo } from './repo-state.js';
import { recordRecent, loadRecents } from './recents.js';
import { listDirs } from './fs-browse.js';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
// Only one agent run at a time: concurrent runs editing the same working tree would collide.
let agentBusy = false;
export function serve(opts) {
    const session = createSession({
        repo: opts.repo,
        base: opts.baseOverride,
        head: opts.headOverride,
    });
    const server = createServer((req, res) => handle(req, res, session));
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
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : opts.port;
        const url = `http://localhost:${port}/`;
        if (session.repo == null) {
            console.log(`\n  ${APP_BRAND} app ready → ${url}`);
            console.log(`  pick a repo to review (or open one you've used before).\n`);
        }
        else {
            console.log(`\n  ${APP_BRAND} review ready → ${url}`);
            console.log(`  reviewing ${resolveStoryPath(session.repo)}`);
            console.log(`  comments save as you go; click "Ask agent" or "Address all open" to get replies live.\n`);
        }
        console.log(`  Ctrl-C to stop.\n`);
        if (opts.open)
            openBrowser(url);
    });
    return server;
}
function noRepo(res) {
    sendJson(res, 409, { error: 'No repo is open.' });
}
function handle(req, res, session) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const method = req.method ?? 'GET';
    try {
        if (method === 'GET' && url.pathname === '/') {
            if (session.repo == null)
                return sendHtml(res, pickerStub());
            applyScope(session, url.searchParams);
            if (existsSync(resolveStoryPath(session.repo)))
                return sendHtml(res, renderReview(session));
            return sendHtml(res, renderChange(session));
        }
        if (method === 'GET' && url.pathname === '/api/repos/recent') {
            return sendJson(res, 200, listRecentRepos());
        }
        if (method === 'GET' && url.pathname === '/api/fs') {
            const p = url.searchParams.get('path');
            return sendJson(res, 200, listDirs(p && p.trim() ? p : homedir()));
        }
        if (method === 'POST' && url.pathname === '/api/repo/open') {
            return readBody(req, (body) => {
                let path = '';
                try {
                    path = String(JSON.parse(body || '{}').path ?? '');
                }
                catch {
                    return sendJson(res, 400, { error: 'invalid JSON' });
                }
                if (!path || !isGitRepo(path)) {
                    return sendJson(res, 400, { error: 'Not a git repository.' });
                }
                openSession(session, path);
                recordRecent(homedir(), path, nowMs());
                sendJson(res, 200, inspectRepo(path));
            });
        }
        if (method === 'POST' && url.pathname === '/api/repo/close') {
            closeSession(session);
            return sendJson(res, 200, { ok: true });
        }
        if (method === 'GET' && url.pathname === '/api/refs') {
            if (!session.repo)
                return noRepo(res);
            return sendJson(res, 200, {
                current: currentBranch(session.repo),
                branches: listBranches(session.repo),
                commits: listRecentCommits(session.repo),
            });
        }
        if (method === 'GET' && url.pathname === '/api/fullfile') {
            return sendHtml(res, renderFullFileResponse(session, url.searchParams.get('file') ?? ''));
        }
        if (method === 'GET' && url.pathname === '/api/comments') {
            if (!session.repo)
                return noRepo(res);
            return sendJson(res, 200, loadComments(session.repo));
        }
        if (method === 'POST' && url.pathname === '/api/comments') {
            if (!session.repo)
                return noRepo(res);
            const repo = session.repo;
            return readBody(req, (body) => {
                try {
                    const input = JSON.parse(body);
                    sendJson(res, 201, addComment(repo, input));
                }
                catch (e) {
                    sendJson(res, 400, { error: e.message });
                }
            });
        }
        if (method === 'POST' && url.pathname === '/api/address') {
            return readBody(req, (body) => runAddress(res, session, body));
        }
        if (method === 'POST' && url.pathname === '/api/generate') {
            return readBody(req, (body) => runGenerate(res, session, body));
        }
        if (method === 'PATCH' && url.pathname.startsWith('/api/comments/')) {
            if (!session.repo)
                return noRepo(res);
            const repo = session.repo;
            const id = decodeURIComponent(url.pathname.slice('/api/comments/'.length));
            return readBody(req, (body) => {
                try {
                    const { status } = JSON.parse(body || '{}');
                    const updated = setCommentStatus(repo, id, status ?? '');
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
            if (!session.repo)
                return noRepo(res);
            const id = decodeURIComponent(url.pathname.slice('/api/comments/'.length));
            const ok = deleteComment(session.repo, id);
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
function pickerStub() {
    return renderPicker(listRecentRepos(), homedir(), Date.now());
}
/** Apply a scope choice from the Your-change switcher (?scope=auto | ?base= | ?head=). */
function applyScope(session, params) {
    if (params.get('scope') === 'auto') {
        session.base = undefined;
        session.head = undefined;
        return;
    }
    const base = params.get('base');
    const head = params.get('head');
    if (base)
        session.base = base;
    if (head)
        session.head = head;
}
/** The "Your change" screen for a repo that has no tour yet. */
function renderChange(session) {
    const repo = session.repo;
    return renderChangePage(summarizeChange(repo, session.base, session.head), {
        repoName: basename(repo),
        base: session.base,
        head: session.head,
    });
}
/** The recents list, each entry enriched with its current repo state for the picker. */
function listRecentRepos() {
    return loadRecents(homedir()).map((e) => ({ ...inspectRepo(e.path), lastOpened: e.lastOpened }));
}
function loadReview(session) {
    if (!session.repo)
        throw new Error('No repo is open.');
    const repo = session.repo;
    const tour = loadTour(resolveStoryPath(repo));
    const base = resolveBase(repo, session.base ?? tour.base);
    const files = parseUnifiedDiff(getDiff(repo, base, session.head));
    return { tour, base, files };
}
function renderReview(session) {
    const repo = session.repo;
    const { tour, base, files } = loadReview(session);
    return renderPage({
        repo,
        tour,
        files,
        baseLabel: describeBase(repo, base),
        comments: loadComments(repo),
    });
}
/** The lazily-loaded "Full file" side-by-side view for one file. */
function renderFullFileResponse(session, file) {
    if (!session.repo)
        return `<div class="ds-diffnote">No repo is open.</div>`;
    if (!file)
        return `<div class="ds-diffnote">No file requested.</div>`;
    const repo = session.repo;
    const { tour, files } = loadReview(session);
    const allowed = new Set([...files.map((f) => f.newPath), ...tour.steps.map((s) => s.file)]);
    if (!allowed.has(file))
        return `<div class="ds-diffnote">That file isn't part of this change.</div>`;
    const df = files.find((f) => f.newPath === file);
    const newLines = readWholeFile(repo, file) ?? [];
    const ranges = computeCoverage(tour, files)
        .uncovered.filter((u) => u.file === file)
        .map((u) => u.range);
    const rows = buildFullFileRows(df, newLines, ranges);
    return renderFullFile(rows, { file, newFile: df?.status === 'added' });
}
/** Raw `git diff` text for the current review scope — used to detect agent code edits. */
function currentDiff(session) {
    try {
        if (!session.repo)
            return '';
        const repo = session.repo;
        const tour = loadTour(resolveStoryPath(repo));
        const base = resolveBase(repo, session.base ?? tour.base);
        return getDiff(repo, base, session.head);
    }
    catch {
        return '';
    }
}
function tailLines(s, n) {
    return s.trimEnd().split('\n').slice(-n).join('\n');
}
function nowMs() {
    return Date.now();
}
/** Drive the user's agent to address review comments and stream NDJSON events. */
function runAddress(res, session, body) {
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
    const pre = agentPreflight({ repo: session.repo, busy: agentBusy, agents: availableAgents() });
    if (!pre.ok)
        return sendJson(res, pre.status, { error: pre.error });
    const agent = pre.agent;
    const repo = session.repo;
    agentBusy = true;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    // Kill the agent if the client disconnects (closed the page or hit Stop).
    const ac = new AbortController();
    res.on('close', () => ac.abort());
    const before = currentDiff(session);
    const send = (e) => {
        try {
            res.write(JSON.stringify(e) + '\n');
        }
        catch {
            /* client disconnected */
        }
    };
    streamAgent(agent, repo, addressPrompt(target), (e) => send(e), undefined, ac.signal)
        .then(({ ok, output }) => {
        const codeChanged = currentDiff(session) !== before;
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
/** Drive the agent to write a tour for the current repo, streaming NDJSON like address. */
function runGenerate(res, session, body) {
    let input = {};
    try {
        input = JSON.parse(body || '{}');
    }
    catch {
        return sendJson(res, 400, { error: 'invalid JSON' });
    }
    const pre = agentPreflight({ repo: session.repo, busy: agentBusy, agents: availableAgents() });
    if (!pre.ok)
        return sendJson(res, pre.status, { error: pre.error });
    const agent = pre.agent;
    const repo = session.repo;
    session.base = input.base;
    session.head = input.head;
    const base = resolveBase(repo, input.base);
    agentBusy = true;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    // Kill the agent if the client disconnects (closed the page or hit Stop).
    const ac = new AbortController();
    res.on('close', () => ac.abort());
    const send = (e) => {
        try {
            res.write(JSON.stringify(e) + '\n');
        }
        catch {
            /* client disconnected */
        }
    };
    streamAgent(agent, repo, storyPrompt(input.base ?? base, input.head), (e) => send(e), undefined, ac.signal)
        .then(({ ok, output }) => {
        const storyWritten = existsSync(resolveStoryPath(repo));
        if (!ok && !storyWritten)
            send({ type: 'error', data: tailLines(output, 30) });
        send({ type: 'done', ok: ok && storyWritten, storyWritten });
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
