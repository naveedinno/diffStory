// Tiny HTTP server over Node built-ins. The page is re-rendered on every GET, so
// refreshing reflects the current diff and story with no watch process. The repo
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
import { renderStoryPicker } from './story-picker.js';
import { summarizeChange } from './change-view.js';
import { resolveScope } from './scope.js';
import { basename, join } from 'node:path';
import { buildFullFileRows } from './view-model.js';
import { loadComments, addComment, deleteComment, setCommentStatus, } from './comments.js';
import { resolveStoryPath, APP_NAME, APP_BRAND } from './config.js';
import { availableAgents, streamAgent, addressPrompt, storyPrompt, agentPreflight, normalizeStoryMode } from './agent.js';
import { runStarted, contextEvent, phaseEvent, heartbeatEvent, warningEvent, errorEvent, doneEvent, observedPhase, phaseRank, } from './progress.js';
import { skillStatus, updateSkills } from './repo-setup.js';
import { createSession, openSession, closeSession } from './session.js';
import { inspectRepo } from './repo-state.js';
import { recordRecent, loadRecents } from './recents.js';
import { listDirs } from './fs-browse.js';
import { listStories, storyPathForId } from './stories.js';
import { homedir } from 'node:os';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { isLocalTtsId, localTtsCacheDir, synthesizeWithSay } from './local-tts.js';
import { isKokoroTtsId, kokoroTtsCacheDir, synthesizeWithKokoro } from './kokoro-tts.js';
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
            // Back-compat for URLs emitted by older app builds.
            if (url.searchParams.has('story')) {
                return sendHtml(res, reviewScreen(session, url.searchParams));
            }
            if (hasChangeQuery(url.searchParams)) {
                session.chooseStory = false;
                session.selectedStory = null;
                return sendHtml(res, changeScreen(session, url.searchParams));
            }
            if (session.chooseStory && session.selectedStory === undefined) {
                return sendHtml(res, storyChooser(session));
            }
            if (session.selectedStory === null) {
                return sendHtml(res, changeScreen(session, url.searchParams));
            }
            return sendHtml(res, reviewScreen(session, url.searchParams));
        }
        if (method === 'GET' && url.pathname === '/stories') {
            if (session.repo == null)
                return sendHtml(res, pickerStub());
            return sendHtml(res, storyChooser(session));
        }
        if (method === 'GET' && url.pathname === '/change') {
            if (session.repo == null)
                return sendHtml(res, pickerStub());
            session.chooseStory = false;
            session.selectedStory = null;
            return sendHtml(res, changeScreen(session, url.searchParams));
        }
        if (method === 'GET' && url.pathname === '/review') {
            if (session.repo == null)
                return sendHtml(res, pickerStub());
            return sendHtml(res, reviewScreen(session, url.searchParams));
        }
        if (method === 'GET' && url.pathname === '/api/repos/recent') {
            return sendJson(res, 200, listRecentRepos());
        }
        if (method === 'GET' && url.pathname === '/api/agents') {
            return sendJson(res, 200, { agents: availableAgents(), skills: skillStatus(homedir()) });
        }
        if (method === 'POST' && url.pathname === '/api/skills/update') {
            const updated = updateSkills(homedir());
            return sendJson(res, 200, { ok: true, installed: updated.installed, skills: updated.status });
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
        if (method === 'POST' && url.pathname === '/api/tts/say') {
            return readBody(req, (body) => runLocalSay(res, body));
        }
        if (method === 'GET' && url.pathname.startsWith('/api/tts/say/')) {
            return sendLocalSayAudio(res, url.pathname.slice('/api/tts/say/'.length));
        }
        if (method === 'POST' && url.pathname === '/api/tts/kokoro') {
            return readBody(req, (body) => runLocalKokoro(res, body));
        }
        if (method === 'GET' && url.pathname.startsWith('/api/tts/kokoro/')) {
            return sendLocalKokoroAudio(res, url.pathname.slice('/api/tts/kokoro/'.length));
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
function storyChooser(session) {
    const repo = session.repo;
    return renderStoryPicker({ repoName: basename(repo), stories: listStories(repo), now: Date.now() });
}
function hasChangeQuery(params) {
    return params.has('scope') || params.has('base') || params.has('head');
}
function reviewScreen(session, params) {
    const picked = applyStoryChoice(session, params);
    if (session.selectedStory === null) {
        return changeScreen(session, params);
    }
    // A built, VALID review uses the story's own base unless the URL explicitly
    // supplies a scope override. A missing or malformed story falls back to the
    // change screen with a notice, never the raw error page.
    const storyFile = selectedStoryPath(session);
    if (existsSync(storyFile)) {
        try {
            loadTour(storyFile);
            applyScope(session, params);
            return renderReview(session);
        }
        catch (e) {
            return changeScreen(session, params, e.message);
        }
    }
    if (picked) {
        return changeScreen(session, params, 'That story could not be found.');
    }
    return changeScreen(session, params);
}
function applyStoryChoice(session, params) {
    if (!session.repo || !params.has('story'))
        return false;
    const id = params.get('story') ?? '';
    session.chooseStory = false;
    session.base = undefined;
    session.head = undefined;
    if (id === 'new') {
        session.selectedStory = null;
        return true;
    }
    session.selectedStory = storyPathForId(session.repo, id);
    return true;
}
function selectedStoryPath(session) {
    if (!session.repo)
        throw new Error('No repo is open.');
    return session.selectedStory ?? resolveStoryPath(session.repo);
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
/** Resolve scope from the request, stash it on the session, and render the change screen. */
function changeScreen(session, params, notice) {
    const scope = resolveScope(session.repo, params);
    session.base = scope.base;
    session.head = scope.head;
    return renderChange(session, scope, notice);
}
/** The "Your change" screen for a repo that has no selected valid story yet. */
function renderChange(session, scope, notice) {
    const repo = session.repo;
    return renderChangePage(summarizeChange(repo, session.base, session.head), {
        repoName: basename(repo),
        base: session.base,
        head: session.head,
        scopeLabel: scope.label,
        active: scope.active,
        notice,
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
    const tour = loadTour(selectedStoryPath(session));
    const base = resolveBase(repo, session.base ?? tour.base);
    const files = parseUnifiedDiff(getDiff(repo, base, session.head ?? tour.head));
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
        const tour = loadTour(selectedStoryPath(session));
        const base = resolveBase(repo, session.base ?? tour.base);
        return getDiff(repo, base, session.head ?? tour.head);
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
/**
 * The shared spine for every agent workflow: emit run_started → context → app
 * phases, stream normalized agent events (advancing phases monotonically on real
 * observation), heartbeat liveness while the child runs, then validate → run_done.
 */
function runWorkflow(res, repo, spec) {
    agentBusy = true;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    const ac = new AbortController();
    res.on('close', () => ac.abort());
    let seq = 0;
    const send = (e) => {
        try {
            res.write(JSON.stringify({ seq: seq++, ...e }) + '\n');
        }
        catch {
            /* client disconnected */
        }
    };
    // Phases only ever advance (monotonic by rank).
    let curRank = -1;
    const advance = (phase, label, detail) => {
        if (phaseRank(phase) <= curRank)
            return;
        curRank = phaseRank(phase);
        send(phaseEvent(phase, label, detail));
    };
    send(runStarted(spec.workflow, spec.title));
    send(contextEvent(spec.context));
    advance('resolving_context');
    advance('preparing_prompt');
    advance('starting_agent');
    advance('agent_running');
    let lastActivity = nowMs();
    const heart = setInterval(() => {
        if (!ac.signal.aborted)
            send(heartbeatEvent(nowMs() - lastActivity));
    }, 5000);
    streamAgent(spec.agent, repo, spec.prompt, (ev) => {
        lastActivity = nowMs();
        send(ev);
        const ph = observedPhase(ev, spec.isTargetWrite(ev));
        if (ph)
            advance(ph);
    }, spec.model, ac.signal)
        .then((r) => {
        clearInterval(heart);
        if (ac.signal.aborted) {
            send(doneEvent('stopped'));
            return;
        }
        advance('validating_output');
        const { status, result, events } = spec.finish(r);
        for (const e of events)
            send(e);
        send(doneEvent(status, result));
    })
        .catch((err) => {
        clearInterval(heart);
        if (ac.signal.aborted) {
            send(doneEvent('stopped'));
            return;
        }
        send(errorEvent('execution', 'The agent run crashed', String(err)));
        send(doneEvent('failed'));
    })
        .finally(() => {
        clearInterval(heart);
        res.end();
        agentBusy = false;
    });
}
/** Drive the user's agent to address review comments, streaming progress NDJSON. */
function runAddress(res, session, body) {
    let input;
    try {
        input = JSON.parse(body || '{}');
    }
    catch {
        return sendJson(res, 400, errorEvent('preflight', 'Invalid request', 'The request body was not valid JSON.'));
    }
    const target = input.all
        ? 'all'
        : Array.isArray(input.commentIds)
            ? input.commentIds
            : [];
    if (target !== 'all' && target.length === 0) {
        return sendJson(res, 400, errorEvent('preflight', 'No comments specified', 'Pick at least one comment to address.'));
    }
    const pre = agentPreflight({ repo: session.repo, busy: agentBusy, agents: availableAgents() });
    if (!pre.ok)
        return sendJson(res, pre.status, errorEvent(pre.stage, pre.label, pre.detail));
    const agent = pre.agent;
    const repo = session.repo;
    const openCount = loadComments(repo).filter((c) => c.status === 'open').length;
    const targetCount = target === 'all' ? openCount : target.length;
    const title = target === 'all'
        ? `Addressing ${targetCount} open ${targetCount === 1 ? 'comment' : 'comments'}`
        : `Addressing ${targetCount} ${targetCount === 1 ? 'comment' : 'comments'}`;
    const before = currentDiff(session);
    runWorkflow(res, repo, {
        workflow: 'address',
        title,
        agent,
        prompt: addressPrompt(target),
        context: {
            repoName: basename(repo), repoPath: repo, workflow: 'address',
            agent, targetCount,
        },
        // For address, the output is code: any non-read write to a non-JSON file.
        isTargetWrite: (ev) => ev.type === 'file' && ev.action !== 'read' && !ev.target.endsWith('.json'),
        finish: (r) => {
            const codeChanged = currentDiff(session) !== before;
            const events = [];
            let status = 'complete';
            if (r.failure === 'startup') {
                events.push(errorEvent('startup', 'The agent failed to start', tailLines(r.output, 30)));
                status = 'failed';
            }
            else if (!r.ok) {
                events.push(errorEvent('execution', 'The agent run failed', tailLines(r.output, 30)));
                status = 'failed';
            }
            else if (!codeChanged) {
                events.push(warningEvent('No files changed', 'The agent answered without editing code.'));
            }
            return { status, result: { codeChanged }, events };
        },
    });
}
/** Drive the agent to write a story for the current repo, streaming progress NDJSON. */
function runGenerate(res, session, body) {
    let input = {};
    try {
        input = JSON.parse(body || '{}');
    }
    catch {
        return sendJson(res, 400, errorEvent('preflight', 'Invalid request', 'The request body was not valid JSON.'));
    }
    const agents = availableAgents();
    const pre = agentPreflight({ repo: session.repo, busy: agentBusy, agents });
    if (!pre.ok)
        return sendJson(res, pre.status, errorEvent(pre.stage, pre.label, pre.detail));
    const agent = (input.agent === 'claude' || input.agent === 'codex') && agents.includes(input.agent)
        ? input.agent
        : pre.agent;
    const model = input.model && input.model.trim() ? input.model.trim() : undefined;
    const mode = normalizeStoryMode(input.mode);
    const workflow = mode === 'detailed' ? 'detailed_audit' : 'guided_review';
    const repo = session.repo;
    session.base = input.base;
    session.head = input.head;
    const base = resolveBase(repo, input.base);
    const storyPath = resolveStoryPath(repo);
    runWorkflow(res, repo, {
        workflow,
        title: workflow === 'detailed_audit' ? 'Generating detailed audit' : 'Generating guided review',
        agent,
        model,
        prompt: storyPrompt(input.base ?? base, input.head, mode),
        context: {
            repoName: basename(repo), repoPath: repo, workflow, agent, model,
            base: describeBase(repo, base),
            head: input.head ?? 'working tree',
            scopeLabel: input.scopeLabel,
        },
        // For generate, the output is the story file.
        isTargetWrite: (ev) => ev.type === 'file' && ev.action !== 'read' && ev.target.endsWith('story.json'),
        finish: (r) => {
            // Branch order matters: success (story written) short-circuits before we
            // stage a failure, so startup/execution/output_missing only run when no story landed.
            const storyWritten = existsSync(storyPath);
            const events = [];
            let status = 'complete';
            if (storyWritten) {
                session.selectedStory = storyPath;
                session.chooseStory = false;
            }
            else if (r.failure === 'startup') {
                events.push(errorEvent('startup', 'The agent failed to start', tailLines(r.output, 30)));
                status = 'failed';
            }
            else if (!r.ok) {
                events.push(errorEvent('execution', 'The agent run failed', tailLines(r.output, 30)));
                status = 'failed';
            }
            else {
                events.push(errorEvent('output_missing', 'No story was written', 'The agent finished but .diffstory/story.json is missing. Check the raw output below.'));
                status = 'failed';
            }
            return { status, result: { storyWritten }, events };
        },
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
function runLocalSay(res, body) {
    let input;
    try {
        input = JSON.parse(body || '{}');
    }
    catch {
        return sendJson(res, 400, { error: 'invalid JSON' });
    }
    const abort = speechAbortForResponse(res);
    synthesizeWithSay(homedir(), {
        text: input.text ?? '',
        voice: input.voice,
        preset: input.preset,
        rate: input.rate,
    }, { signal: abort.signal })
        .then((audio) => sendJson(res, 200, {
        cached: audio.cached,
        rate: audio.rate,
        url: audio.url,
        voice: audio.voice,
    }))
        .catch((err) => {
        if (abort.signal.aborted || res.destroyed)
            return;
        sendJson(res, 400, { error: err.message });
    });
}
function runLocalKokoro(res, body) {
    let input;
    try {
        input = JSON.parse(body || '{}');
    }
    catch {
        return sendJson(res, 400, { error: 'invalid JSON' });
    }
    const abort = speechAbortForResponse(res);
    synthesizeWithKokoro(homedir(), {
        text: input.text ?? '',
        voice: input.voice,
        rate: input.rate,
    }, { signal: abort.signal })
        .then((audio) => sendJson(res, 200, {
        cached: audio.cached,
        engine: 'kokoro',
        rate: audio.rate,
        url: audio.url,
        voice: audio.voice,
    }))
        .catch((err) => {
        if (abort.signal.aborted || res.destroyed)
            return;
        sendJson(res, 400, { error: err.message });
    });
}
function speechAbortForResponse(res) {
    const ctrl = new AbortController();
    res.on('close', () => {
        if (!res.writableEnded)
            ctrl.abort();
    });
    return ctrl;
}
function sendLocalSayAudio(res, file) {
    const id = file.endsWith('.m4a') ? file.slice(0, -4) : file;
    if (!isLocalTtsId(id)) {
        res.statusCode = 404;
        res.end('Not found');
        return;
    }
    const path = join(localTtsCacheDir(homedir()), `${id}.m4a`);
    if (!existsSync(path)) {
        res.statusCode = 404;
        res.end('Not found');
        return;
    }
    const stat = statSync(path);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mp4');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    createReadStream(path).pipe(res);
}
function sendLocalKokoroAudio(res, file) {
    const id = file.endsWith('.wav') ? file.slice(0, -4) : file;
    if (!isKokoroTtsId(id)) {
        res.statusCode = 404;
        res.end('Not found');
        return;
    }
    const path = join(kokoroTtsCacheDir(homedir()), `${id}.wav`);
    if (!existsSync(path)) {
        res.statusCode = 404;
        res.end('Not found');
        return;
    }
    const stat = statSync(path);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    createReadStream(path).pipe(res);
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
<p>Fix the issue above and refresh. Most often the story is missing or malformed — re-run <code>diffstory story</code>.</p>
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
