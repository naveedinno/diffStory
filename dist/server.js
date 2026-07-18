// Tiny HTTP server over Node built-ins. The page is re-rendered on every GET, so
// refreshing reflects the current diff and story with no watch process. The repo
// is held in a mutable Session, so the same server can boot empty (app/picker
// mode) and switch repos at runtime via /api/repo/open.
import { createServer } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { loadTour, validateGeneratedConceptSteps, validateGeneratedTour } from './tour.js';
import { isGitRepo, resolveBase, getDiff, describeBase, readWholeFile, listBranchRefs, listRecentCommits, currentBranch, isDirty, hasParentCommit, emptyTree, resolveCommit, noiseFiles, excludedReviewFiles, reviewChangeFingerprint, stagedWorktreeDivergentFiles, numstat, } from './git.js';
import { parseUnifiedDiff } from './diff.js';
import { computeCoverage } from './coverage.js';
import { renderPage, renderFullFile, renderSplitHunks, renderContextRows, renderFilePanelContent, renderStoryStepPanel, } from './render.js';
import { esc } from './diff-render.js';
import { renderPicker } from './picker.js';
import { renderChangePage } from './change-page.js';
import { renderStoryPicker } from './story-picker.js';
import { summarizeChange } from './change-view.js';
import { resolveScope } from './scope.js';
import { basename, dirname, join } from 'node:path';
import { buildFullFileRows, hunksToSbsBlocks, hunkNewRange } from './view-model.js';
import { buildReviewModel } from './view-model.js';
import { loadComments, loadCommentsWithHealth, addComment, deleteComment, setCommentStatus, appendUserMessage, InvalidCommentStoreError, } from './comments.js';
import { commentsPath, resolveStoryPath, APP_NAME, APP_BRAND, DATA_DIR } from './config.js';
import { isCodeStep } from './types.js';
import { availableAgents, streamAgent, addressPrompt, storyPrompt, agentPreflight, selectAvailableAgent, normalizeStoryMode, normalizeCodexRunOptions, summarizeAgentFailure, resumedCodexTaskMatches, storyRepairPrompt, } from './agent.js';
import { runStarted, contextEvent, phaseEvent, heartbeatEvent, warningEvent, errorEvent, doneEvent, observedPhase, phaseRank, noteEventsFromText, createFileEnricher, } from './progress.js';
import { skillStatus, updateSkills } from './repo-setup.js';
import { createSession, openSession, closeSession, sessionEntryScreen, issueReviewPageLease, getReviewPageLease, } from './session.js';
import { inspectRepo } from './repo-state.js';
import { forgetRecent, recordRecent, loadRecents } from './recents.js';
import { listDirs } from './fs-browse.js';
import { deleteStory, diffFingerprint, listStories, storyPathForId } from './stories.js';
import { homedir } from 'node:os';
import { cpSync, createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isLocalTtsId, localTtsCacheDir, synthesizeWithSay } from './local-tts.js';
import { isKokoroTtsId, kokoroTtsCacheDir, synthesizeWithKokoro } from './kokoro-tts.js';
import { codexTaskBinary, listCodexStoryModels, listCodexTasks, nameCodexTask, validCodexThreadId, } from './codex-tasks.js';
import { sendCodexDesktopTurn } from './codex-desktop.js';
import { LiveEventHub, storyFileFingerprint } from './live.js';
import { reviewStateSummary } from './review-state.js';
// Only one agent run at a time: concurrent runs editing the same working tree would collide.
let agentBusy = false;
export function serve(opts) {
    // Capture the home directory once. Besides making one server session stable,
    // this keeps parallel test servers from following later HOME mutations into
    // another test's recents, skills, or voice cache.
    const home = homedir();
    const session = createSession({
        repo: opts.repo,
        base: opts.baseOverride,
        head: opts.headOverride,
    });
    const liveHub = new LiveEventHub({
        leaseActive: (token) => !!getReviewPageLease(session, token),
    });
    const server = createServer((req, res) => handle(req, res, session, home, liveHub));
    // Dispose the hub when close is REQUESTED, not on the 'close' event: the
    // server cannot finish closing while the hub still holds SSE responses open.
    const requestClose = server.close.bind(server);
    server.close = ((callback) => {
        liveHub.dispose();
        return requestClose(callback);
    });
    server.on('close', () => liveHub.dispose());
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${opts.port} is in use. Try: ${APP_NAME} --port ${opts.port + 1}`);
        }
        else {
            console.error(`Server error: ${err.message}`);
        }
        process.exit(1);
    });
    // This app can read repositories and launch local agents. Keep that surface
    // on the loopback interface even when the host machine is on a shared network.
    server.listen(opts.port, '127.0.0.1', () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : opts.port;
        const url = `http://localhost:${port}/`;
        if (session.repo == null) {
            console.log(`\n  ${APP_BRAND} app ready → ${url}`);
            console.log(`  pick a repo to review (or open one you've used before).\n`);
        }
        else {
            const storyCount = listStories(session.repo).length;
            const storyLabel = `${storyCount} ${storyCount === 1 ? 'story' : 'stories'}`;
            console.log(`\n  ${APP_BRAND} review ready → ${url}`);
            console.log(`  reviewing ${storyLabel} in ${join(session.repo, DATA_DIR)}`);
            console.log(`  comments send to the agent when submitted; Review actions can resend open comments.\n`);
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
/** Undefined means an unscoped legacy caller; null means a supplied dead lease. */
function optionalRequestLease(session, url) {
    const token = url.searchParams.get('page') ?? undefined;
    if (!token)
        return undefined;
    const lease = getReviewPageLease(session, token);
    if (!lease || !session.repo || lease.repo !== session.repo)
        return null;
    return lease;
}
function invalidFeedbackResponse(res, health) {
    sendJson(res, 409, {
        error: `${health.message} ${health.recovery}`,
        feedbackHealth: health,
        reloadRequired: true,
    });
}
function sendCommentMutationError(res, error) {
    if (error instanceof InvalidCommentStoreError)
        return invalidFeedbackResponse(res, error.health);
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
}
function repoRouteBase(repo) {
    return `/repo/${encodeURIComponent(basename(repo))}`;
}
function repoRoute(repo, screen, search = '') {
    return `${repoRouteBase(repo)}/${screen}${search}`;
}
function parseRepoRoute(pathname, repo) {
    if (!repo)
        return null;
    const base = repoRouteBase(repo);
    if (pathname === base || pathname === `${base}/`)
        return 'stories';
    if (!pathname.startsWith(`${base}/`))
        return null;
    const screen = pathname.slice(base.length + 1);
    return screen === 'stories' || screen === 'change' || screen === 'review' || screen === 'diff'
        ? screen
        : null;
}
function redirect(res, location) {
    res.writeHead(302, { location });
    res.end();
}
function localHostname(value) {
    const host = value.toLowerCase().replace(/^\[|\]$/g, '');
    return host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '::1';
}
/**
 * Reject DNS-rebinding hosts and browser cross-site requests. Requests from
 * curl/Node are still accepted when they address a loopback Host directly.
 */
function isTrustedLocalRequest(req) {
    const host = req.headers.host;
    if (!host)
        return false;
    let expected;
    try {
        expected = new URL(`http://${host}`);
    }
    catch {
        return false;
    }
    if (!localHostname(expected.hostname))
        return false;
    const fetchSite = req.headers['sec-fetch-site'];
    if (typeof fetchSite === 'string' && fetchSite !== 'same-origin' && fetchSite !== 'none')
        return false;
    const origin = req.headers.origin;
    if (!origin)
        return true;
    try {
        const actual = new URL(origin);
        return actual.protocol === 'http:' && localHostname(actual.hostname) && actual.host === expected.host;
    }
    catch {
        return false;
    }
}
function setLocalResponseHeaders(res) {
    res.setHeader('Content-Security-Policy', [
        "default-src 'none'",
        "base-uri 'none'",
        "connect-src 'self'",
        "font-src 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "img-src 'self' data:",
        "media-src 'self' blob:",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'unsafe-inline'",
    ].join('; '));
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
}
function handle(req, res, session, home, liveHub) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const method = req.method ?? 'GET';
    setLocalResponseHeaders(res);
    if (!isTrustedLocalRequest(req)) {
        return sendJson(res, 403, { error: 'This local app only accepts same-origin localhost requests.' });
    }
    try {
        if (method === 'GET' && url.pathname === '/assets/mermaid.esm.min.mjs') {
            return sendMermaidBrowserAsset(res);
        }
        if (method === 'GET' && url.pathname.startsWith('/assets/fonts/')) {
            return sendFontAsset(res, basename(url.pathname));
        }
        if (method === 'GET' && url.pathname === '/api/events') {
            const lease = optionalRequestLease(session, url);
            if (!lease) {
                // 204 tells EventSource to stop reconnecting against a dead lease.
                res.statusCode = 204;
                res.end();
                return;
            }
            liveHub.connect(lease, req, res);
            return;
        }
        if (method === 'GET' && url.pathname === '/') {
            if (session.repo == null)
                return sendHtml(res, pickerStub(home));
            // Back-compat for URLs emitted by older app builds.
            if (url.searchParams.has('story')) {
                return redirect(res, url.searchParams.get('story') === 'new'
                    ? repoRoute(session.repo, 'change')
                    : repoRoute(session.repo, 'review', url.search));
            }
            if (hasChangeQuery(url.searchParams)) {
                return redirect(res, repoRoute(session.repo, 'change', url.search));
            }
            return redirect(res, repoRoute(session.repo, sessionEntryScreen(session), url.search));
        }
        const repoScreen = method === 'GET' ? parseRepoRoute(url.pathname, session.repo) : null;
        if (repoScreen === 'stories') {
            return sendHtml(res, storyChooser(session));
        }
        if (repoScreen === 'change') {
            session.chooseStory = false;
            session.selectedStory = null;
            return sendHtml(res, changeScreen(session, url.searchParams));
        }
        if (repoScreen === 'diff') {
            session.chooseStory = false;
            session.selectedStory = null;
            return sendHtml(res, diffScreen(session, url.searchParams));
        }
        if (repoScreen === 'review') {
            return sendHtml(res, reviewScreen(session, url.searchParams));
        }
        if (method === 'GET' && url.pathname === '/stories') {
            if (session.repo == null)
                return sendHtml(res, pickerStub(home));
            return redirect(res, repoRoute(session.repo, 'stories'));
        }
        if (method === 'GET' && url.pathname === '/repos') {
            if (session.repo)
                liveHub.closeRepo(session.repo);
            closeSession(session);
            return sendHtml(res, pickerStub(home));
        }
        if (method === 'GET' && url.pathname === '/change') {
            if (session.repo == null)
                return sendHtml(res, pickerStub(home));
            return redirect(res, repoRoute(session.repo, 'change', url.search));
        }
        if (method === 'GET' && url.pathname === '/review') {
            if (session.repo == null)
                return sendHtml(res, pickerStub(home));
            return redirect(res, repoRoute(session.repo, 'review', url.search));
        }
        if (method === 'GET' && url.pathname === '/api/repos/recent') {
            return sendJson(res, 200, listRecentRepos(home));
        }
        if (method === 'DELETE' && url.pathname === '/api/repos/recent') {
            return readBody(req, res, (body) => {
                let path = '';
                try {
                    path = String(JSON.parse(body || '{}').path ?? '');
                }
                catch {
                    return sendJson(res, 400, { error: 'invalid JSON' });
                }
                if (!path)
                    return sendJson(res, 400, { error: 'Missing repository path.' });
                const removed = loadRecents(home).some((e) => e.path === path);
                forgetRecent(home, path);
                return sendJson(res, 200, { ok: true, removed, recents: listRecentRepos(home) });
            });
        }
        if (method === 'GET' && url.pathname === '/api/agents') {
            return sendJson(res, 200, { agents: availableAgents(), skills: skillStatus(home) });
        }
        if (method === 'GET' && url.pathname === '/api/codex/tasks') {
            if (!session.repo)
                return noRepo(res);
            listCodexTasks(session.repo)
                .then((tasks) => sendJson(res, 200, { tasks }))
                .catch((error) => sendJson(res, 502, { error: error.message }));
            return;
        }
        if (method === 'GET' && url.pathname === '/api/codex/models') {
            listCodexStoryModels()
                .then((models) => sendJson(res, 200, { models }))
                .catch((error) => sendJson(res, 502, { error: error.message }));
            return;
        }
        if (method === 'POST' && url.pathname === '/api/skills/update') {
            const updated = updateSkills(home);
            return sendJson(res, 200, { ok: true, installed: updated.installed, skills: updated.status });
        }
        if (method === 'GET' && url.pathname === '/api/fs') {
            const p = url.searchParams.get('path');
            return sendJson(res, 200, listDirs(p && p.trim() ? p : home));
        }
        if (method === 'POST' && url.pathname === '/api/repo/open') {
            return readBody(req, res, (body) => {
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
                if (session.repo && session.repo !== path)
                    liveHub.closeRepo(session.repo);
                openSession(session, path);
                recordRecent(home, path, nowMs());
                sendJson(res, 200, { ...inspectRepo(path), route: repoRoute(path, sessionEntryScreen(session)) });
            });
        }
        if (method === 'POST' && url.pathname === '/api/repo/close') {
            if (session.repo)
                liveHub.closeRepo(session.repo);
            closeSession(session);
            return sendJson(res, 200, { ok: true });
        }
        if (method === 'DELETE' && url.pathname === '/api/stories') {
            if (!session.repo)
                return noRepo(res);
            const repo = session.repo;
            return readBody(req, res, (body) => {
                let id = '';
                try {
                    id = String(JSON.parse(body || '{}').id ?? '');
                }
                catch {
                    return sendJson(res, 400, { error: 'invalid JSON' });
                }
                if (!id)
                    return sendJson(res, 400, { error: 'Missing story id.' });
                const path = storyPathForId(repo, id);
                if (!path)
                    return sendJson(res, 404, { error: 'No such story.' });
                deleteStory(repo, id);
                if (session.selectedStory === path) {
                    session.selectedStory = undefined;
                    session.chooseStory = true;
                }
                return sendJson(res, 200, { ok: true, removed: true, stories: listStories(repo) });
            });
        }
        if (method === 'GET' && url.pathname === '/api/refs') {
            if (!session.repo)
                return noRepo(res);
            const ref = url.searchParams.get('ref')?.trim() || '';
            return sendJson(res, 200, {
                ...(ref ? { ref } : {}),
                current: currentBranch(session.repo),
                branches: listBranchRefs(session.repo),
                commits: listRecentCommits(session.repo, 0, ref || '--all'),
            });
        }
        if (method === 'GET' && url.pathname === '/api/fullfile') {
            const file = url.searchParams.get('file') ?? '';
            const page = validateReviewPageLease(session, url.searchParams.get('page'), file);
            if (!page.ok)
                return sendReviewPageConflict(res, page.error);
            return sendLeasedHtml(res, session, page, renderFullFileResponse(page, file), file);
        }
        if (method === 'GET' && url.pathname === '/api/diff/split') {
            const file = url.searchParams.get('file') ?? '';
            const page = validateReviewPageLease(session, url.searchParams.get('page'), file);
            if (!page.ok)
                return sendReviewPageConflict(res, page.error);
            return sendLeasedHtml(res, session, page, renderSplitResponse(page, file), file);
        }
        if (method === 'GET' && url.pathname === '/api/diff/context') {
            const file = url.searchParams.get('file') ?? '';
            const page = validateReviewPageLease(session, url.searchParams.get('page'), file);
            if (!page.ok)
                return sendReviewPageConflict(res, page.error);
            return sendLeasedHtml(res, session, page, renderContextResponse(page, url.searchParams), file);
        }
        if (method === 'GET' && url.pathname === '/api/diff/file-panel') {
            const file = url.searchParams.get('file') ?? '';
            const page = validateReviewPageLease(session, url.searchParams.get('page'), file);
            if (!page.ok)
                return sendReviewPageConflict(res, page.error);
            return sendLeasedHtml(res, session, page, renderFilePanelResponse(page, file), file);
        }
        if (method === 'GET' && url.pathname === '/api/review/step-panel') {
            const page = validateReviewPageLease(session, url.searchParams.get('page'));
            if (!page.ok)
                return sendReviewPageConflict(res, page.error);
            return sendLeasedHtml(res, session, page, renderStoryStepResponse(page, url.searchParams.get('index') ?? ''));
        }
        if (method === 'GET' && url.pathname === '/api/review/excluded-file') {
            const page = validateReviewPageLease(session, url.searchParams.get('page'));
            if (!page.ok)
                return sendReviewPageConflict(res, page.error);
            return sendLeasedHtml(res, session, page, renderExcludedFileResponse(page, url.searchParams.get('file') ?? ''));
        }
        if (method === 'GET' && url.pathname === '/api/review-state') {
            const lease = optionalRequestLease(session, url);
            if (lease === null)
                return sendReviewPageConflict(res, 'This review page is no longer active.');
            if (!session.repo)
                return noRepo(res);
            const data = lease ? reviewDataForLease(lease, false) : sessionReviewData(session);
            const summary = reviewStateSummary(lease?.repo ?? session.repo, data.base, data.head, data.diff, data.files, data.changeFingerprint);
            return sendJson(res, 200, summary);
        }
        if (method === 'GET' && url.pathname === '/api/comments') {
            const lease = optionalRequestLease(session, url);
            if (lease === null)
                return sendReviewPageConflict(res, 'This review page is no longer active.');
            const repo = lease?.repo ?? session.repo;
            if (!repo)
                return noRepo(res);
            const loaded = loadCommentsWithHealth(repo);
            if (loaded.health.status === 'invalid')
                return invalidFeedbackResponse(res, loaded.health);
            return sendJson(res, 200, loaded.comments);
        }
        if (method === 'POST' && url.pathname === '/api/comments') {
            const lease = optionalRequestLease(session, url);
            if (lease === null)
                return sendReviewPageConflict(res, 'This review page is no longer active.');
            const repo = lease?.repo ?? session.repo;
            if (!repo)
                return noRepo(res);
            return readBody(req, res, (body) => {
                try {
                    const loaded = loadCommentsWithHealth(repo);
                    if (loaded.health.status === 'invalid')
                        return invalidFeedbackResponse(res, loaded.health);
                    const input = JSON.parse(body);
                    const comment = addComment(repo, input);
                    sendJson(res, 201, comment);
                }
                catch (e) {
                    sendCommentMutationError(res, e);
                }
            });
        }
        if (method === 'POST' && url.pathname === '/api/address') {
            return readBody(req, res, (body) => runAddress(res, session, body));
        }
        if (method === 'POST' && url.pathname === '/api/generate') {
            return readBody(req, res, (body) => runGenerate(res, session, body));
        }
        if (method === 'POST' && url.pathname === '/api/story/repair') {
            return readBody(req, res, (body) => runStoryRepair(res, session, body));
        }
        if (method === 'POST' && url.pathname === '/api/tts/say') {
            return readBody(req, res, (body) => runLocalSay(res, body, home));
        }
        if (method === 'GET' && url.pathname.startsWith('/api/tts/say/')) {
            return sendLocalSayAudio(res, url.pathname.slice('/api/tts/say/'.length), home);
        }
        if (method === 'POST' && url.pathname === '/api/tts/kokoro') {
            return readBody(req, res, (body) => runLocalKokoro(res, body, home));
        }
        if (method === 'GET' && url.pathname.startsWith('/api/tts/kokoro/')) {
            return sendLocalKokoroAudio(res, url.pathname.slice('/api/tts/kokoro/'.length), home);
        }
        if (method === 'POST' && url.pathname.startsWith('/api/comments/') && url.pathname.endsWith('/message')) {
            const lease = optionalRequestLease(session, url);
            if (lease === null)
                return sendReviewPageConflict(res, 'This review page is no longer active.');
            const repo = lease?.repo ?? session.repo;
            if (!repo)
                return noRepo(res);
            const id = decodeURIComponent(url.pathname.slice('/api/comments/'.length, -'/message'.length));
            return readBody(req, res, (body) => {
                try {
                    const { text } = JSON.parse(body || '{}');
                    const updated = appendUserMessage(repo, id, text ?? '');
                    if (updated)
                        sendJson(res, 200, updated);
                    else
                        sendJson(res, 404, { error: 'no such comment' });
                }
                catch (e) {
                    sendCommentMutationError(res, e);
                }
            });
        }
        if (method === 'PATCH' && url.pathname.startsWith('/api/comments/')) {
            const lease = optionalRequestLease(session, url);
            if (lease === null)
                return sendReviewPageConflict(res, 'This review page is no longer active.');
            const repo = lease?.repo ?? session.repo;
            if (!repo)
                return noRepo(res);
            const id = decodeURIComponent(url.pathname.slice('/api/comments/'.length));
            return readBody(req, res, (body) => {
                try {
                    const { status } = JSON.parse(body || '{}');
                    const updated = setCommentStatus(repo, id, status ?? '');
                    if (updated) {
                        sendJson(res, 200, updated);
                    }
                    else
                        sendJson(res, 404, { error: 'no such comment' });
                }
                catch (e) {
                    sendCommentMutationError(res, e);
                }
            });
        }
        if (method === 'DELETE' && url.pathname.startsWith('/api/comments/')) {
            const lease = optionalRequestLease(session, url);
            if (lease === null)
                return sendReviewPageConflict(res, 'This review page is no longer active.');
            const repo = lease?.repo ?? session.repo;
            if (!repo)
                return noRepo(res);
            const id = decodeURIComponent(url.pathname.slice('/api/comments/'.length));
            try {
                const loaded = loadCommentsWithHealth(repo);
                if (loaded.health.status === 'invalid')
                    return invalidFeedbackResponse(res, loaded.health);
                const ok = deleteComment(repo, id);
                res.statusCode = ok ? 204 : 404;
                res.end();
            }
            catch (error) {
                sendCommentMutationError(res, error);
            }
            return;
        }
        res.statusCode = 404;
        res.end('Not found');
    }
    catch (e) {
        sendHtml(res, errorPage(e.message), 500);
    }
}
function pickerStub(home) {
    return renderPicker(listRecentRepos(home), home, Date.now());
}
function storyChooser(session) {
    const repo = session.repo;
    return renderStoryPicker({
        repoName: basename(repo),
        routeBase: repoRouteBase(repo),
        stories: listStories(repo),
        now: Date.now(),
    });
}
function hasChangeQuery(params) {
    return params.has('scope') || params.has('base') || params.has('head') || params.has('commit');
}
function reviewScreen(session, params) {
    const picked = applyStoryChoice(session, params);
    if (session.selectedStory === null) {
        return changeScreen(session, params);
    }
    // A built, VALID review uses the story's own base unless the URL explicitly
    // supplies a scope override. A missing or malformed story falls back to the
    // scope picker with a notice, never the raw error page.
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
/** Apply a scope choice from the Your-change switcher (?scope=... | ?base= | ?head=). */
function applyScope(session, params) {
    if (params.get('scope') === 'auto') {
        session.base = undefined;
        session.head = undefined;
        return;
    }
    if (hasChangeQuery(params)) {
        const scope = resolveScope(session.repo, params);
        session.base = scope.base;
        session.head = scope.head;
    }
}
/** Resolve scope from the request, stash it on the session, render the scope picker. */
function changeScreen(session, params, notice) {
    const scope = resolveScope(session.repo, params);
    session.base = scope.base;
    session.head = scope.head;
    return renderChange(session, scope, params, notice);
}
/** The "Your change" scope picker: choose what to diff, then open it in the
 *  review viewer (the "Open diff viewer" CTA). */
function renderChange(session, scope, params, notice) {
    const repo = session.repo;
    return renderChangePage(summarizeChange(repo, session.base, session.head), {
        repoName: basename(repo),
        routeBase: repoRouteBase(repo),
        base: session.base,
        head: session.head,
        scopeLabel: scope.label,
        active: scope.active,
        notice,
        compareBaseRef: params.get('baseRef') || undefined,
        compareBaseCommit: params.get('baseCommit') || undefined,
        compareHeadRef: params.get('headRef') || undefined,
        compareHeadCommit: params.get('headCommit') || undefined,
    });
}
/** Resolve scope, then render the story-less *review viewer* for it: the real
 *  review page with no story — All-files (the diff) by default, with the Story
 *  tab offering the guided-review generator. This is where "Open the diff" lands. */
function diffScreen(session, params) {
    const scope = resolveScope(session.repo, params);
    session.base = scope.base;
    session.head = scope.head;
    const repo = session.repo;
    const data = sessionReviewData(session);
    const { base, head, diff, files: fullFiles } = data;
    const reviewState = reviewStateSummary(repo, base, head, diff, fullFiles, data.changeFingerprint);
    const files = fullFiles;
    const tour = { version: 1, title: '', summary: '', steps: [], base };
    const storyPath = selectedStoryPath(session);
    const pageLease = issueReviewPageLease(session, {
        repo,
        base,
        ...(head ? { head } : {}),
        fingerprint: data.changeFingerprint,
        scopeKey: reviewState.scopeKey,
        mode: 'full',
        storyIdentity: reviewStoryIdentity(storyPath, tour, true),
        storyPath,
        storyFingerprint: storyFileFingerprint(storyPath),
        fileFingerprints: reviewFileFingerprints(repo, head, files, tour, true),
    });
    return renderPage({
        repo,
        tour,
        files,
        baseLabel: describeBase(repo, base),
        headRef: head,
        comments: loadComments(repo),
        routeBase: repoRouteBase(repo),
        repoName: basename(repo),
        storyless: true,
        reviewState,
        reviewPageToken: pageLease.token,
        stagedWorktreeDivergentFiles: stagedWorktreeDivergentFiles(repo, base, head),
        excludedFiles: excludedReviewFiles(repo, base, head),
    });
}
/** The recents list, each entry enriched with its current repo state for the picker. */
function listRecentRepos(home) {
    return loadRecents(home).map((e) => ({ ...inspectRepo(e.path), lastOpened: e.lastOpened }));
}
function reviewDiff(repo, session, tour) {
    const sessionHasScope = session.base !== undefined || session.head !== undefined;
    let base = resolveBase(repo, session.base ?? tour.base);
    let head = session.head ?? tour.head;
    let diff = getDiff(repo, base, head);
    if (!sessionHasScope && tour.base === 'HEAD' && head === undefined && diff.trim() === '' && !isDirty(repo)) {
        base = hasParentCommit(repo) ? 'HEAD~1' : emptyTree(repo);
        head = 'HEAD';
        diff = getDiff(repo, base, head);
    }
    return { base, head, diff };
}
function loadReview(session) {
    if (!session.repo)
        throw new Error('No repo is open.');
    const repo = session.repo;
    const tour = loadTour(selectedStoryPath(session));
    const { base, head, diff } = reviewDiff(repo, session, tour);
    const files = parseUnifiedDiff(diff);
    return { tour, base, head, diff, files };
}
function renderReview(session) {
    const repo = session.repo;
    const data = sessionReviewData(session, true);
    const { tour, base, head, files: fullFiles, diff } = data;
    const reviewState = reviewStateSummary(repo, base, head, diff, fullFiles, data.changeFingerprint);
    const files = fullFiles;
    const storyFreshness = !tour.diffFingerprint
        ? 'unverified'
        : diffFingerprint(diff) === tour.diffFingerprint
            ? 'current'
            : 'stale';
    const storyPath = selectedStoryPath(session);
    const pageLease = issueReviewPageLease(session, {
        repo,
        base,
        ...(head ? { head } : {}),
        fingerprint: data.changeFingerprint,
        scopeKey: reviewState.scopeKey,
        mode: 'full',
        storyIdentity: reviewStoryIdentity(storyPath, tour, false),
        storyPath,
        storyFingerprint: storyFileFingerprint(storyPath),
        fileFingerprints: reviewFileFingerprints(repo, head, files, tour, false),
    });
    return renderPage({
        repo,
        routeBase: repoRouteBase(repo),
        repoName: basename(repo),
        tour,
        files,
        baseLabel: describeBase(repo, base),
        headRef: head,
        comments: loadComments(repo),
        reviewState,
        reviewPageToken: pageLease.token,
        storyFreshness,
        stagedWorktreeDivergentFiles: stagedWorktreeDivergentFiles(repo, base, head),
        excludedFiles: excludedReviewFiles(repo, base, head),
    });
}
function readSessionReviewData(session, requireSelectedStory = false) {
    if (!session.repo)
        throw new Error('No repo is open.');
    if (session.selectedStory !== null) {
        try {
            return loadReview(session);
        }
        catch (error) {
            if (requireSelectedStory)
                throw error;
            // A broken or missing story must not prevent comments and review checkpoints
            // from using the real diff underneath it.
        }
    }
    const repo = session.repo;
    const base = resolveBase(repo, session.base);
    const head = session.head;
    const diff = getDiff(repo, base, head);
    return {
        tour: { version: 1, title: '', summary: '', steps: [], base },
        base,
        head,
        diff,
        files: parseUnifiedDiff(diff),
    };
}
/** Read diff evidence and its full-change fingerprint as one optimistic
 * snapshot. A changing working tree is retried; it is never paired with a
 * fingerprint from a different repository state. */
function sessionReviewData(session, requireSelectedStory = false) {
    if (!session.repo)
        throw new Error('No repo is open.');
    const repo = session.repo;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const data = readSessionReviewData(session, requireSelectedStory);
        const changeFingerprint = reviewChangeFingerprint(repo, data.base, data.head);
        const confirmedDiff = getDiff(repo, data.base, data.head);
        const confirmedFingerprint = reviewChangeFingerprint(repo, data.base, data.head);
        if (confirmedDiff === data.diff && confirmedFingerprint === changeFingerprint) {
            return { ...data, changeFingerprint };
        }
    }
    throw new Error('The change is moving too quickly to capture a stable review snapshot. Try again.');
}
function reviewStoryIdentity(storyPath, tour, storyless) {
    if (storyless)
        return 'storyless';
    return diffFingerprint(`${storyPath}\0${JSON.stringify(tour)}`);
}
/** Re-read exactly the immutable scope and story named by a page lease. */
function reviewDataForLease(lease, requireStory = true) {
    const storyless = lease.storyIdentity === 'storyless';
    let tour = { version: 1, title: '', summary: '', steps: [], base: lease.base };
    if (!storyless) {
        try {
            tour = loadTour(lease.storyPath);
        }
        catch (error) {
            // A broken or missing story must not prevent comments, review state, and
            // checkpoints from using the real diff underneath it.
            if (requireStory)
                throw error;
        }
    }
    // The fingerprint covers strictly more state than the diff, so an unchanged
    // fingerprint on both sides of the diff read proves the pair is consistent.
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const changeFingerprint = reviewChangeFingerprint(lease.repo, lease.base, lease.head);
        const diff = getDiff(lease.repo, lease.base, lease.head);
        const confirmedFingerprint = reviewChangeFingerprint(lease.repo, lease.base, lease.head);
        if (changeFingerprint === confirmedFingerprint) {
            return {
                tour,
                base: lease.base,
                ...(lease.head ? { head: lease.head } : {}),
                diff,
                files: parseUnifiedDiff(diff),
                changeFingerprint,
            };
        }
    }
    throw new Error('The change is moving too quickly to capture a stable review snapshot. Try again.');
}
/** Identity of exactly what one file panel can render. Changed files are fully
 * identified by their parsed base-to-current diff; context-only story files
 * fall back to their current contents. */
function reviewFileFingerprint(repo, head, files, file) {
    const diffFile = files.find((candidate) => candidate.newPath === file);
    if (diffFile)
        return diffFingerprint(JSON.stringify({ diffFile }));
    const currentLines = readWholeFile(repo, file, head);
    if (currentLines === null)
        return undefined;
    return diffFingerprint(JSON.stringify({ currentLines }));
}
function reviewFileFingerprints(repo, head, files, tour, storyless) {
    const paths = new Set(files.map((file) => file.newPath));
    if (!storyless) {
        for (const step of tour.steps)
            if (isCodeStep(step))
                paths.add(step.file);
    }
    const fingerprints = Object.create(null);
    for (const file of paths) {
        const fingerprint = reviewFileFingerprint(repo, head, files, file);
        if (fingerprint)
            fingerprints[file] = fingerprint;
    }
    return fingerprints;
}
/**
 * Resolve an opaque page token and re-check every piece of review identity
 * against one stable live read. The stored mode/from marker is authoritative;
 * lazy callers cannot promote a since-feedback page into the full diff.
 */
function validateReviewPageLease(session, token, file) {
    const lease = getReviewPageLease(session, token ?? undefined);
    if (!lease)
        return { ok: false, error: 'This review page is no longer active.' };
    if (!session.repo || session.repo !== lease.repo) {
        return { ok: false, error: 'The repository changed after this review page loaded.' };
    }
    const storyless = lease.storyIdentity === 'storyless';
    let data;
    try {
        data = reviewDataForLease(lease);
    }
    catch (error) {
        return {
            ok: false,
            error: storyless
                ? 'The review evidence moved while this page was open.'
                : `The selected story cannot be validated: ${error.message}`,
        };
    }
    const reviewState = reviewStateSummary(lease.repo, data.base, data.head, data.diff, data.files, data.changeFingerprint);
    if (data.base !== lease.base ||
        (data.head ?? '') !== (lease.head ?? '') ||
        reviewState.scopeKey !== lease.scopeKey) {
        return { ok: false, error: 'The review scope changed after this page loaded.' };
    }
    if (reviewStoryIdentity(lease.storyPath, data.tour, storyless) !== lease.storyIdentity) {
        return { ok: false, error: 'The guided review changed after this page loaded.' };
    }
    const files = data.files;
    if (data.changeFingerprint !== lease.fingerprint) {
        const leasedFileFingerprint = file ? lease.fileFingerprints[file] : undefined;
        const currentFileFingerprint = file
            ? reviewFileFingerprint(lease.repo, data.head, files, file)
            : undefined;
        if (!leasedFileFingerprint || currentFileFingerprint !== leasedFileFingerprint) {
            return { ok: false, error: 'The change moved after this review page loaded.' };
        }
    }
    return {
        ok: true,
        lease,
        repo: lease.repo,
        tour: data.tour,
        base: data.base,
        head: data.head,
        diff: data.diff,
        fullFiles: data.files,
        files,
        storyless,
    };
}
function sendReviewPageConflict(res, detail) {
    sendJson(res, 409, {
        error: `Reload required: ${detail}`,
        detail,
        reloadRequired: true,
    });
}
/** Re-check after synchronous rendering to close the external working-tree race. */
function sendLeasedHtml(res, session, page, html, file) {
    const confirmed = validateReviewPageLease(session, page.lease.token, file);
    if (!confirmed.ok)
        return sendReviewPageConflict(res, confirmed.error);
    sendHtml(res, html);
}
/** The lazily-loaded "Full file" side-by-side view for one file. Works with or
 *  without a story: story-less, there's no coverage to flag, so it's just the
 *  diff reconstructed against the working tree. */
function renderFullFileResponse(page, file) {
    if (!file)
        return `<div class="ds-diffnote">No file requested.</div>`;
    const { repo, tour, head, files, storyless } = page;
    const allowed = new Set([
        ...files.map((f) => f.newPath),
        ...(storyless ? [] : tour.steps.filter(isCodeStep).map((s) => s.file)),
    ]);
    if (!allowed.has(file))
        return `<div class="ds-diffnote">That file isn't part of this change.</div>`;
    const df = files.find((f) => f.newPath === file);
    const newLines = readWholeFile(repo, file, head) ?? [];
    const ranges = storyless
        ? []
        : computeCoverage(tour, files)
            .uncovered.filter((u) => u.file === file)
            .map((u) => u.range);
    const rows = buildFullFileRows(df, newLines, ranges);
    return renderFullFile(rows, { file, oldFile: df?.oldPath, newFile: df?.status === 'added' });
}
/** The lazily-loaded Split (hunks-only, side-by-side) view for one file. Mirrors
 *  renderFullFileResponse's scope rules exactly, including allowing context-only
 *  files (referenced by a context step but absent from the diff itself). */
function renderSplitResponse(page, file) {
    if (!file)
        return `<div class="ds-diffnote">No file requested.</div>`;
    const { tour, files, storyless } = page;
    const allowed = new Set([
        ...files.map((f) => f.newPath),
        ...(storyless ? [] : tour.steps.filter(isCodeStep).map((s) => s.file)),
    ]);
    if (!allowed.has(file))
        return `<div class="ds-diffnote">That file isn't part of this change.</div>`;
    const df = files.find((f) => f.newPath === file);
    const ranges = storyless
        ? []
        : computeCoverage(tour, files)
            .uncovered.filter((u) => u.file === file)
            .map((u) => u.range);
    return renderSplitHunks(hunksToSbsBlocks(df, ranges), {
        file,
        oldFile: df?.oldPath,
        newFile: df?.status === 'added',
        hunkRanges: df ? df.hunks.map(hunkNewRange) : [],
        canExpand: df ? df.status !== 'deleted' : false,
    });
}
/** Render one All-files detail on demand so large reviews do not ship every
 * syntax-highlighted file into the initial document. */
function renderFilePanelResponse(page, file) {
    if (!file)
        return `<div class="ds-diffnote">No file requested.</div>`;
    const { repo, tour, files, head, storyless } = page;
    const model = buildReviewModel(repo, tour, files, head, { storyless });
    const view = model.files.find((candidate) => candidate.file === file);
    if (!view)
        return `<div class="ds-diffnote">That file isn't part of this change.</div>`;
    const stepIndexById = new Map(model.steps.map((step, index) => [step.id, index + 1]));
    return renderFilePanelContent(view, stepIndexById);
}
/** Render a single guided-review step on demand. The index is the 1-based
 * panel index used by the client (Overview is panel 0). */
function renderStoryStepResponse(page, rawIndex) {
    if (page.storyless)
        return `<div class="ds-diffnote">No guided story is selected.</div>`;
    const index = Number.parseInt(rawIndex, 10);
    if (!Number.isInteger(index) || index < 1) {
        return `<div class="ds-diffnote">No valid story step requested.</div>`;
    }
    const { repo, tour, files, head } = page;
    const model = buildReviewModel(repo, tour, files, head, { storyless: false });
    return renderStoryStepPanel(repo, model, loadComments(repo), index - 1);
}
function renderExcludedFileResponse(page, file) {
    if (!file)
        return `<div class="ds-diffnote">No file requested.</div>`;
    const { repo, base, head } = page;
    const excluded = excludedReviewFiles(repo, base, head).find((candidate) => candidate.path === file);
    if (!excluded) {
        return `<div class="ds-diffnote">That file is not an excluded part of this review.</div>`;
    }
    if (excluded.reason === 'binary') {
        return `<div class="ds-diffnote">Binary contents are not decoded in the review. The file is still part of the exact change fingerprint and must be acknowledged before approval.</div>`;
    }
    let lines = readWholeFile(repo, file, head);
    let side = 'Current file';
    if (!lines) {
        lines = readWholeFile(repo, file, base);
        side = 'File before deletion';
    }
    if (!lines)
        return `<div class="ds-diffnote">This binary or missing file cannot be previewed as text.</div>`;
    const limit = 500;
    const shown = lines.slice(0, limit);
    const rows = shown.map((line, index) => `<span><i>${index + 1}</i><code>${esc(line) || ' '}</code></span>`).join('');
    return `<div class="ds-excluded-file-head"><strong>${side}</strong><span>This is a text preview, not story coverage or a before/after diff.</span></div><pre class="ds-excluded-code">${rows}</pre>${lines.length > limit ? `<div class="ds-diffnote">Showing the first ${limit} of ${lines.length} lines.</div>` : ''}`;
}
/** Context rows for expand-a-hunk-gap: ctx rows of the reconstructed full
 *  file, clamped to [from, to] new-file line numbers. */
function renderContextResponse(page, params) {
    const { repo, tour, files, head, storyless } = page;
    const file = params.get('file') ?? '';
    if (!file)
        return `<div class="ds-diffnote">No file requested.</div>`;
    const from = Math.max(1, parseInt(params.get('from') ?? '1', 10) || 1);
    const toRaw = params.get('to') ?? 'eof';
    const to = toRaw === 'eof' ? Number.MAX_SAFE_INTEGER : parseInt(toRaw, 10) || 0;
    const layout = params.get('layout') === 'split' ? 'split' : 'unified';
    if (to < from)
        return `<div data-ctx-rows data-from="0" data-to="0"></div>`;
    // Mirror renderFullFileResponse exactly: context-only story files are valid,
    // but a since-feedback page can only expand files from its issued model.
    const allowed = new Set([
        ...files.map((f) => f.newPath),
        ...(storyless ? [] : tour.steps.filter(isCodeStep).map((s) => s.file)),
    ]);
    if (!allowed.has(file))
        return `<div class="ds-diffnote">That file isn't part of this change.</div>`;
    const df = files.find((f) => f.newPath === file);
    const newLines = readWholeFile(repo, file, head) ?? [];
    if (!newLines.length)
        return `<div class="ds-diffnote">Couldn't read ${esc(file)} from the working tree.</div>`;
    // Clamp to the real file length: ranges past EOF must serve fewer rows,
    // never invented ones. Defense-in-depth — the parser now bounds hunks by
    // their header counts, so it no longer leaks a phantom row past EOF.
    const last = newLines.length;
    const rows = buildFullFileRows(df, newLines, []).filter((r) => r.type === 'ctx' && r.newNo !== undefined && r.newNo >= from && r.newNo <= to && r.newNo <= last);
    return renderContextRows(rows, layout, { file, oldFile: df?.oldPath, newFile: df?.status === 'added' });
}
/** Raw `git diff` text for the current review scope — used to detect agent code edits. */
function currentDiff(session) {
    try {
        if (!session.repo)
            return '';
        const repo = session.repo;
        if (session.selectedStory === null) {
            return getDiff(repo, resolveBase(repo, session.base), session.head);
        }
        const tour = loadTour(selectedStoryPath(session));
        return reviewDiff(repo, session, tour).diff;
    }
    catch {
        return '';
    }
}
function nowMs() {
    return Date.now();
}
function agentFailureEvent(r) {
    const stage = r.failure === 'startup' ? 'startup' : 'execution';
    const summary = summarizeAgentFailure(r.output, stage);
    return errorEvent(stage, summary.label, summary.detail, summary.technicalDetail);
}
export function finishStoryGeneration(r, storyPath, session, previousStoryContents, requireModernStory = true) {
    const currentStoryContents = existsSync(storyPath) ? readFileSync(storyPath, 'utf8') : null;
    const storyWritten = currentStoryContents !== null && (previousStoryContents === undefined ||
        previousStoryContents === null ||
        currentStoryContents !== previousStoryContents);
    const events = [];
    let status = 'complete';
    if (storyWritten) {
        try {
            const tour = loadTour(storyPath);
            const qualityErrors = requireModernStory
                ? validateGeneratedTour(tour)
                : validateGeneratedConceptSteps(tour);
            if (qualityErrors.length) {
                throw new Error(`Generated story did not meet the storyteller contract:\n  - ${qualityErrors.join('\n  - ')}`);
            }
            session.selectedStory = storyPath;
            session.chooseStory = false;
            return { status, result: { storyWritten, storyValid: true }, events };
        }
        catch (e) {
            events.push(errorEvent('validation', 'The story did not pass its final check', 'The agent wrote a story, but diffStory cannot safely open it yet. Try again or change the story settings.', e.message));
            status = 'failed';
            return { status, result: { storyWritten, storyValid: false }, events };
        }
    }
    if (r.failure === 'startup') {
        events.push(agentFailureEvent(r));
        status = 'failed';
    }
    else if (!r.ok) {
        events.push(agentFailureEvent(r));
        status = 'failed';
    }
    else {
        events.push(errorEvent('output_missing', 'The agent finished without a story', 'No .diffstory/story.json was created. Try again, or open technical details to see what the agent returned.'));
        status = 'failed';
    }
    return { status, result: { storyWritten, storyValid: false }, events };
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
    const enrich = spec.fileScope ? createFileEnricher(spec.fileScope) : (e) => e;
    streamAgent(spec.agent, repo, spec.prompt, (ev) => {
        lastActivity = nowMs();
        const out = enrich(ev);
        send(out);
        const ph = observedPhase(out, spec.isTargetWrite(out));
        if (ph)
            advance(ph);
        if (out.type === 'text') {
            for (const note of noteEventsFromText(out.data)) {
                if (note.type === 'phase')
                    advance(note.phase, note.label);
                else
                    send(note);
            }
        }
    }, spec.model, ac.signal, spec.agentOptions)
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
        spec.cleanup?.();
        res.end();
        agentBusy = false;
    });
}
/**
 * Hand an existing task to its live Desktop owner. This deliberately has no
 * `codex exec resume` fallback: that creates a parallel stored turn which the
 * selected ChatGPT task does not render as its normal conversation.
 */
function sendAddressToCodexDesktop(res, context, title, threadId, prompt) {
    agentBusy = true;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    let seq = 0;
    const send = (event) => {
        if (!res.destroyed)
            res.write(`${JSON.stringify({ seq: seq++, ...event })}\n`);
    };
    send(runStarted('address', title));
    send(contextEvent(context));
    send(phaseEvent('resolving_context'));
    send(phaseEvent('preparing_prompt'));
    send(phaseEvent('starting_agent', 'Sending to the selected ChatGPT task'));
    sendCodexDesktopTurn(threadId, prompt)
        .then(() => {
        send({ type: 'activity', kind: 'task', label: `Sent to live ChatGPT task · …${threadId.slice(-8)}` });
        send(doneEvent('complete', {
            codexThreadId: threadId,
            messageSent: true,
            delivery: 'desktop',
        }));
    })
        .catch((error) => {
        send(errorEvent('execution', 'Could not reach the selected task in ChatGPT', error instanceof Error ? error.message : String(error)));
        send(doneEvent('failed', { codexThreadId: threadId, messageSent: false }));
    })
        .finally(() => {
        res.end();
        agentBusy = false;
    });
}
function addressRepoContext(repo, head) {
    if (!head)
        return { runRepo: repo, historical: false };
    const resolvedHead = resolveCommit(repo, head);
    const currentHead = resolveCommit(repo, 'HEAD');
    if (resolvedHead && currentHead && resolvedHead === currentHead && !isDirty(repo)) {
        return { runRepo: repo, historical: false };
    }
    const dir = mkdtempSync(join(tmpdir(), 'diffstory-address-'));
    execFileSync('git', ['worktree', 'add', '--detach', '--quiet', dir, head], {
        cwd: repo,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    copyDiffstoryData(repo, dir);
    return {
        runRepo: dir,
        historical: true,
        cleanup: () => {
            copyCommentsBack(dir, repo);
            try {
                execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: repo, stdio: 'ignore' });
            }
            catch {
                rmSync(dir, { recursive: true, force: true });
            }
        },
    };
}
function copyDiffstoryData(fromRepo, toRepo) {
    const from = join(fromRepo, DATA_DIR);
    if (!existsSync(from))
        return;
    cpSync(from, join(toRepo, DATA_DIR), { recursive: true, force: true });
}
function copyCommentsBack(fromRepo, toRepo) {
    const from = commentsPath(fromRepo);
    if (!existsSync(from))
        return;
    const to = commentsPath(toRepo);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { force: true });
}
function stableDiffRef(repo, ref) {
    if (!ref)
        return undefined;
    return resolveCommit(repo, ref) ?? ref;
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
    const agents = availableAgents();
    const pre = agentPreflight({ repo: session.repo, busy: agentBusy, agents });
    if (!pre.ok)
        return sendJson(res, pre.status, errorEvent(pre.stage, pre.label, pre.detail));
    const selected = selectAvailableAgent(input.agent, agents, pre.agent);
    if (!selected.ok)
        return sendJson(res, selected.status, errorEvent(selected.stage, selected.label, selected.detail));
    const agent = selected.agent;
    const codexThreadId = validCodexThreadId(input.codexThreadId) ? input.codexThreadId : undefined;
    const codexTaskLabel = typeof input.codexTaskLabel === 'string'
        ? input.codexTaskLabel.replace(/\s+/g, ' ').trim().slice(0, 100)
        : undefined;
    if (agent === 'codex' && input.codexThreadId !== undefined && !codexThreadId) {
        return sendJson(res, 400, errorEvent('preflight', 'Invalid Codex task', 'Choose a Codex task from the task picker.'));
    }
    const useNewCodexTask = agent === 'codex' && input.newCodexTask === true;
    const agentOptions = useNewCodexTask
        ? { codex: { binary: codexTaskBinary(), json: true } }
        : undefined;
    const repo = session.repo;
    const feedback = loadCommentsWithHealth(repo);
    if (feedback.health.status === 'invalid') {
        return sendJson(res, 409, {
            ...errorEvent('preflight', 'Feedback file needs repair', `${feedback.health.message} ${feedback.health.recovery}`),
            feedbackHealth: feedback.health,
        });
    }
    const comments = feedback.comments;
    const openComments = comments.filter((comment) => comment.status === 'open');
    const openCount = openComments.length;
    const targetCount = target === 'all' ? openCount : target.length;
    const targetIds = target === 'all'
        ? openComments.map((comment) => comment.id)
        : target;
    const targetSet = new Set(targetIds);
    const reviewMessages = comments
        .filter((comment) => targetSet.has(comment.id))
        .map((comment) => {
        const latestUserTurn = [...(comment.turns ?? [])].reverse().find((turn) => turn.role === 'user');
        return { id: comment.id, text: latestUserTurn?.text || comment.body };
    });
    const title = target === 'all'
        ? `Addressing ${targetCount} open ${targetCount === 1 ? 'comment' : 'comments'}`
        : `Addressing ${targetCount} ${targetCount === 1 ? 'comment' : 'comments'}`;
    const before = currentDiff(session);
    // The diff's two sides, resolved exactly as the review page rendered them, so the
    // agent grounds its answers in both — not just the tree it has checked out. `head`
    // is set only for two-ref comparisons; otherwise the current side is the working
    // tree. Falls back to single-sided if no story.
    let base;
    let head;
    try {
        const tour = loadTour(selectedStoryPath(session));
        ({ base, head } = reviewDiff(repo, session, tour));
    }
    catch {
        /* no story/tour yet — addressPrompt degrades to its prior single-sided form */
    }
    let addressCtx;
    try {
        addressCtx = addressRepoContext(repo, head);
    }
    catch (e) {
        return sendJson(res, 500, errorEvent('preflight', 'Could not prepare historical checkout', e.message));
    }
    // A resumed Codex task keeps its original cwd. For a pinned historical diff,
    // keep it in the live repo and enforce read-only source behavior in the prompt
    // instead of pretending the resumed task moved into our temporary worktree.
    const resumedHistoricalTask = !!codexThreadId && addressCtx.historical;
    if (resumedHistoricalTask) {
        addressCtx.cleanup?.();
        addressCtx = { runRepo: repo, historical: true };
    }
    const prompt = addressPrompt(target, base, head, {
        historicalCheckout: addressCtx.historical,
        originalRepo: addressCtx.historical ? repo : undefined,
        resumedCodexTask: resumedHistoricalTask,
        reviewMessages,
    });
    const runContext = {
        repoName: basename(repo), repoPath: repo, workflow: 'address',
        agent, targetCount,
        ...(codexThreadId ? { taskMode: 'resume', taskLabel: codexTaskLabel || 'Selected Codex task', taskId: codexThreadId } : {}),
        ...(agent === 'codex' && input.newCodexTask === true ? { taskMode: 'new' } : {}),
    };
    if (agent === 'codex' && codexThreadId) {
        sendAddressToCodexDesktop(res, runContext, title, codexThreadId, prompt);
        return;
    }
    runWorkflow(res, addressCtx.runRepo, {
        workflow: 'address',
        title,
        agent,
        prompt,
        agentOptions,
        context: runContext,
        // For address, the output is code: any non-read write to a non-JSON file.
        isTargetWrite: (ev) => ev.type === 'file' && ev.action !== 'read' && !ev.target.endsWith('.json'),
        finish: (r) => {
            const codeChanged = currentDiff(session) !== before;
            const events = [];
            let status = 'complete';
            if (r.failure === 'startup') {
                events.push(agentFailureEvent(r));
                status = 'failed';
            }
            else if (!r.ok) {
                events.push(agentFailureEvent(r));
                status = 'failed';
            }
            else if (!resumedCodexTaskMatches(codexThreadId, r.threadId)) {
                events.push(errorEvent('execution', 'Codex did not resume the selected task', r.threadId
                    ? 'Codex connected to a different task. Re-select the intended task and try again.'
                    : 'Codex did not confirm the selected task id. Re-select the intended task and try again.', `Expected ${codexThreadId}; received ${r.threadId || 'no task id'}.`));
                status = 'failed';
            }
            else if (!codeChanged && !addressCtx.historical) {
                events.push(warningEvent('No files changed', 'The agent answered without editing code.'));
            }
            if (status === 'complete' && agent === 'codex' && input.newCodexTask === true && r.threadId) {
                void nameCodexTask(r.threadId, `diffStory review · ${basename(repo)}`).catch(() => {
                    // Naming is presentation-only; the persisted id still keeps continuity.
                });
            }
            return {
                status,
                result: {
                    codeChanged,
                    ...(agent === 'codex' && r.threadId ? { codexThreadId: r.threadId } : {}),
                },
                events,
            };
        },
        cleanup: addressCtx.cleanup,
        fileScope: { repoPath: addressCtx.runRepo, changedFiles: [] },
    });
}
/**
 * `git diff --numstat` renders renames as `dir/{old => new}/file` (or bare
 * `old => new`). Changed-file matching needs the post-rename path — the file
 * the agent will actually read — else "n of N" carries an unreachable N.
 */
export function postRenamePath(path) {
    if (!path.includes(' => '))
        return path;
    if (path.includes('{')) {
        return path.replace(/\{[^{}]*? => ([^{}]*?)\}/g, '$1').replace(/\/{2,}/g, '/');
    }
    return path.slice(path.indexOf(' => ') + 4);
}
function normalizeReviewerNote(value) {
    if (value === undefined || value === null)
        return { ok: true };
    if (typeof value !== 'string')
        return { ok: false, detail: 'Story guidance must be text.' };
    const note = value.trim();
    return { ok: true, ...(note ? { note: note.slice(0, 4000) } : {}) };
}
function normalizeIncludedFiles(value, changedFiles) {
    if (value === undefined || value === null)
        return { ok: true, included: changedFiles };
    if (!Array.isArray(value))
        return { ok: false, detail: 'Selected story files must be an array.' };
    const requested = [...new Set(value.map((v) => (typeof v === 'string' ? v.trim() : '')))].filter(Boolean);
    if (!requested.length)
        return { ok: false, detail: 'Pick at least one file for the story.' };
    const changed = new Set(changedFiles);
    const unknown = requested.filter((p) => !changed.has(p));
    if (unknown.length) {
        return { ok: false, detail: `Selected file is not part of this change: ${unknown[0]}` };
    }
    const requestedSet = new Set(requested);
    return { ok: true, included: changedFiles.filter((p) => requestedSet.has(p)) };
}
function storyScopeFromInput(input, changedFiles) {
    const note = normalizeReviewerNote(input.reviewerNote);
    if (!note.ok)
        return note;
    const files = normalizeIncludedFiles(input.includedFiles, changedFiles);
    if (!files.ok)
        return files;
    const included = files.included;
    const excluded = changedFiles.filter((p) => !included.includes(p));
    if (!excluded.length && !note.note)
        return { ok: true };
    return {
        ok: true,
        scope: {
            includedFiles: included,
            ...(excluded.length ? { excludedFiles: excluded } : {}),
            ...(note.note ? { reviewerNote: note.note } : {}),
        },
    };
}
function stampStoryMetadata(storyPath, fingerprint, scope) {
    if (!existsSync(storyPath))
        return;
    try {
        const parsed = JSON.parse(readFileSync(storyPath, 'utf8'));
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
            return;
        parsed.diffFingerprint = fingerprint;
        if (scope)
            parsed.storyScope = scope;
        writeFileSync(storyPath, `${JSON.stringify(parsed, null, 2)}\n`);
    }
    catch {
        // Validation will report malformed or missing stories in the normal finish path.
    }
}
function runStoryRepair(res, session, body) {
    let input = {};
    try {
        input = JSON.parse(body || '{}');
    }
    catch {
        return sendJson(res, 400, errorEvent('preflight', 'Invalid request', 'The request body was not valid JSON.'));
    }
    const action = input.action;
    if (!['explain', 'rewrite', 'shorten', 'split'].includes(action)) {
        return sendJson(res, 400, errorEvent('preflight', 'Invalid story repair', 'Choose explain, rewrite, shorten, or split.'));
    }
    const agents = availableAgents();
    const pre = agentPreflight({ repo: session.repo, busy: agentBusy, agents });
    if (!pre.ok)
        return sendJson(res, pre.status, errorEvent(pre.stage, pre.label, pre.detail));
    const selected = selectAvailableAgent(input.agent, agents, pre.agent);
    if (!selected.ok)
        return sendJson(res, selected.status, errorEvent(selected.stage, selected.label, selected.detail));
    const repo = session.repo;
    const storyPath = selectedStoryPath(session);
    if (!existsSync(storyPath)) {
        return sendJson(res, 404, errorEvent('preflight', 'No story to repair', 'Generate a story before tuning a step.'));
    }
    let storyWasModern = false;
    try {
        storyWasModern = validateGeneratedTour(loadTour(storyPath)).length === 0;
    }
    catch (e) {
        return sendJson(res, 400, errorEvent('validation', 'The current story is invalid', e.message));
    }
    const storyBefore = readFileSync(storyPath, 'utf8');
    const data = sessionReviewData(session);
    const title = action === 'explain'
        ? 'Explaining an uncovered change'
        : action === 'rewrite'
            ? 'Rewriting a story step'
            : action === 'shorten'
                ? 'Shortening a story step'
                : 'Splitting a story step';
    runWorkflow(res, repo, {
        workflow: 'guided_review',
        title,
        agent: selected.agent,
        prompt: storyRepairPrompt({
            action,
            file: input.file?.trim() || undefined,
            line: Number.isFinite(input.line) ? Math.trunc(Number(input.line)) : undefined,
            stepId: input.stepId?.trim() || undefined,
            base: stableDiffRef(repo, data.base) ?? data.base,
            head: stableDiffRef(repo, data.head),
        }),
        context: {
            repoName: basename(repo),
            repoPath: repo,
            workflow: 'guided_review',
            agent: selected.agent,
            base: describeBase(repo, data.base),
            head: data.head ?? 'working tree',
        },
        isTargetWrite: (event) => event.type === 'file' && event.action !== 'read' && event.target.endsWith('story.json'),
        finish: (result) => {
            if (result.ok && existsSync(storyPath)) {
                stampStoryMetadata(storyPath, diffFingerprint(data.diff));
            }
            const finished = finishStoryGeneration(result, storyPath, session, storyBefore, storyWasModern);
            return finished;
        },
        fileScope: { repoPath: repo, changedFiles: data.files.map((file) => file.newPath) },
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
    const agentOptions = agent === 'codex' ? { codex: normalizeCodexRunOptions(input) } : undefined;
    const workflow = mode === 'detailed' ? 'detailed_audit' : 'guided_review';
    const title = mode === 'brief'
        ? 'Generating compact story'
        : mode === 'detailed'
            ? 'Generating deep review'
            : 'Generating guided review';
    const repo = session.repo;
    const base = resolveBase(repo, input.base);
    const promptBase = stableDiffRef(repo, base) ?? base;
    const promptHead = stableDiffRef(repo, input.head);
    session.base = promptBase;
    session.head = promptHead;
    const storyPath = resolveStoryPath(repo);
    const storyBefore = existsSync(storyPath) ? readFileSync(storyPath, 'utf8') : null;
    // Generated/oversized files (regenerated ABIs, lockfiles) are subtracted from
    // the agent's diff just as they are from the rendered review and coverage gate,
    // so all three agree and the agent doesn't waste a run narrating a 20k-line ABI.
    const excludePaths = noiseFiles(repo, promptBase, promptHead);
    // The exact changed files the review shows (noise subtracted), so file-read
    // progress can honestly say "3 of 8 changed files".
    const changedFiles = numstat(repo, promptBase, promptHead)
        .map((f) => postRenamePath(f.path))
        .filter((p) => !excludePaths.includes(p));
    const storyScope = storyScopeFromInput(input, changedFiles);
    if (!storyScope.ok) {
        return sendJson(res, 400, errorEvent('preflight', 'Invalid story scope', storyScope.detail));
    }
    runWorkflow(res, repo, {
        workflow,
        title,
        agent,
        model,
        agentOptions,
        prompt: storyPrompt(promptBase, promptHead, mode, excludePaths, storyScope.scope),
        context: {
            repoName: basename(repo), repoPath: repo, workflow, agent, model,
            base: describeBase(repo, promptBase),
            head: promptHead ?? 'working tree',
        },
        // For generate, the output is the story file.
        isTargetWrite: (ev) => ev.type === 'file' && ev.action !== 'read' && ev.target.endsWith('story.json'),
        finish: (r) => {
            const storyChanged = existsSync(storyPath) && (storyBefore === null || readFileSync(storyPath, 'utf8') !== storyBefore);
            if (r.ok && storyChanged) {
                stampStoryMetadata(storyPath, diffFingerprint(getDiff(repo, promptBase, promptHead)), storyScope.scope);
            }
            return finishStoryGeneration(r, storyPath, session, storyBefore);
        },
        fileScope: { repoPath: repo, changedFiles },
    });
}
function readBody(req, res, done) {
    let data = '';
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk) => {
        if (tooLarge)
            return;
        size += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
        if (size > 1_000_000) {
            tooLarge = true;
            data = '';
            sendJson(res, 413, { error: 'Request body is too large.' });
            return;
        }
        data += chunk;
    });
    req.on('end', () => {
        if (!tooLarge)
            done(data);
    });
}
function runLocalSay(res, body, home) {
    let input;
    try {
        input = JSON.parse(body || '{}');
    }
    catch {
        return sendJson(res, 400, { error: 'invalid JSON' });
    }
    const abort = speechAbortForResponse(res);
    synthesizeWithSay(home, {
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
function runLocalKokoro(res, body, home) {
    let input;
    try {
        input = JSON.parse(body || '{}');
    }
    catch {
        return sendJson(res, 400, { error: 'invalid JSON' });
    }
    const abort = speechAbortForResponse(res);
    synthesizeWithKokoro(home, {
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
function sendLocalSayAudio(res, file, home) {
    const id = file.endsWith('.m4a') ? file.slice(0, -4) : file;
    if (!isLocalTtsId(id)) {
        res.statusCode = 404;
        res.end('Not found');
        return;
    }
    const path = join(localTtsCacheDir(home), `${id}.m4a`);
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
function sendLocalKokoroAudio(res, file, home) {
    const id = file.endsWith('.wav') ? file.slice(0, -4) : file;
    if (!isKokoroTtsId(id)) {
        res.statusCode = 404;
        res.end('Not found');
        return;
    }
    const path = join(kokoroTtsCacheDir(home), `${id}.wav`);
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
const MERMAID_BROWSER_ASSET = new URL('./mermaid.esm.min.mjs', import.meta.url);
function sendMermaidBrowserAsset(res) {
    if (!existsSync(MERMAID_BROWSER_ASSET)) {
        res.statusCode = 404;
        res.end('Not found');
        return;
    }
    const stat = statSync(MERMAID_BROWSER_ASSET);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    createReadStream(MERMAID_BROWSER_ASSET).pipe(res);
}
// Self-hosted woff2 for the Signal / Thread-Ledger type system. Served
// same-origin so the font-src 'self' CSP needs no change. The allowlist is the
// path-traversal guard: only these exact filenames resolve, everything else 404s.
const FONT_ASSET_DIR = new URL('./assets/fonts/', import.meta.url);
const FONT_ASSET_FILES = new Set([
    'ibm-plex-sans-latin-400-normal.woff2',
    'ibm-plex-sans-latin-500-normal.woff2',
    'ibm-plex-sans-latin-600-normal.woff2',
    'ibm-plex-sans-latin-700-normal.woff2',
    'ibm-plex-mono-latin-400-normal.woff2',
    'ibm-plex-mono-latin-500-normal.woff2',
    'ibm-plex-mono-latin-600-normal.woff2',
    'ibm-plex-mono-latin-700-normal.woff2',
    'space-grotesk-latin-500-normal.woff2',
    'space-grotesk-latin-600-normal.woff2',
    'space-grotesk-latin-700-normal.woff2',
]);
function sendFontAsset(res, name) {
    if (!FONT_ASSET_FILES.has(name)) {
        res.statusCode = 404;
        res.end('Not found');
        return;
    }
    const asset = new URL(name, FONT_ASSET_DIR);
    if (!existsSync(asset)) {
        res.statusCode = 404;
        res.end('Not found');
        return;
    }
    const stat = statSync(asset);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'font/woff2');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    createReadStream(asset).pipe(res);
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
<p>Fix the issue above and refresh. Most often the story is missing or malformed — open the diff and generate a fresh one.</p>
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
