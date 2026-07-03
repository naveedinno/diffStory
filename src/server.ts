// Tiny HTTP server over Node built-ins. The page is re-rendered on every GET, so
// refreshing reflects the current diff and story with no watch process. The repo
// is held in a mutable Session, so the same server can boot empty (app/picker
// mode) and switch repos at runtime via /api/repo/open.
import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { loadTour } from './tour.js';
import {
  isGitRepo,
  resolveBase,
  getDiff,
  describeBase,
  readWholeFile,
  listBranchRefs,
  listRecentCommits,
  currentBranch,
  isDirty,
  hasParentCommit,
  emptyTree,
  resolveCommit,
  noiseFiles,
  numstat,
} from './git.js';
import { parseUnifiedDiff } from './diff.js';
import { computeCoverage } from './coverage.js';
import { renderPage, renderFullFile } from './render.js';
import { renderPicker } from './picker.js';
import { renderChangePage } from './change-page.js';
import { renderDiffFullBody } from './diff-view.js';
import { renderStoryPicker } from './story-picker.js';
import { summarizeChange } from './change-view.js';
import { resolveScope, type Scope } from './scope.js';
import { basename, dirname, join } from 'node:path';
import { buildFullFileRows } from './view-model.js';
import {
  loadComments,
  addComment,
  deleteComment,
  setCommentStatus,
  appendUserMessage,
  type NewComment,
} from './comments.js';
import { commentsPath, resolveStoryPath, APP_NAME, APP_BRAND, DATA_DIR } from './config.js';
import type { DiffFile, Tour } from './types.js';
import {
  availableAgents,
  streamAgent,
  addressPrompt,
  storyPrompt,
  agentPreflight,
  normalizeStoryMode,
  normalizeCodexRunOptions,
  type Agent,
  type AgentRunOptions,
  type StreamResult,
} from './agent.js';
import {
  runStarted, contextEvent, phaseEvent, heartbeatEvent, warningEvent, errorEvent, doneEvent,
  observedPhase, phaseRank, noteEventsFromText, createFileEnricher,
  type ProgressEvent, type Phase, type Workflow, type RunContext, type RunStatus, type FileScope,
} from './progress.js';
import { skillStatus, updateSkills } from './repo-setup.js';
import { createSession, openSession, closeSession, type Session } from './session.js';
import { inspectRepo } from './repo-state.js';
import { forgetRecent, recordRecent, loadRecents } from './recents.js';
import { listDirs } from './fs-browse.js';
import { deleteStory, listStories, storyPathForId } from './stories.js';
import { homedir } from 'node:os';
import { cpSync, createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isLocalTtsId, localTtsCacheDir, synthesizeWithSay } from './local-tts.js';
import { isKokoroTtsId, kokoroTtsCacheDir, synthesizeWithKokoro } from './kokoro-tts.js';

// Only one agent run at a time: concurrent runs editing the same working tree would collide.
let agentBusy = false;

export interface ServeOptions {
  repo: string | null;
  port: number;
  baseOverride?: string;
  headOverride?: string;
  open: boolean;
}

export function serve(opts: ServeOptions): Server {
  const session = createSession({
    repo: opts.repo,
    base: opts.baseOverride,
    head: opts.headOverride,
  });
  const server = createServer((req, res) => handle(req, res, session));

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${opts.port} is in use. Try: ${APP_NAME} serve --port ${opts.port + 1}`);
    } else {
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
    } else {
      const storyCount = listStories(session.repo).length;
      const storyLabel = `${storyCount} ${storyCount === 1 ? 'story' : 'stories'}`;
      console.log(`\n  ${APP_BRAND} review ready → ${url}`);
      console.log(`  reviewing ${storyLabel} in ${join(session.repo, DATA_DIR)}`);
      console.log(`  comments send to the agent when submitted; Review actions can resend open comments.\n`);
    }
    console.log(`  Ctrl-C to stop.\n`);
    if (opts.open) openBrowser(url);
  });

  return server;
}

function noRepo(res: ServerResponse): void {
  sendJson(res, 409, { error: 'No repo is open.' });
}

function repoRouteBase(repo: string): string {
  return `/repo/${encodeURIComponent(basename(repo))}`;
}

function repoRoute(repo: string, screen: 'stories' | 'change' | 'review' | 'diff', search = ''): string {
  return `${repoRouteBase(repo)}/${screen}${search}`;
}

function parseRepoRoute(
  pathname: string,
  repo: string | null,
): 'stories' | 'change' | 'review' | 'diff' | null {
  if (!repo) return null;
  const base = repoRouteBase(repo);
  if (pathname === base || pathname === `${base}/`) return 'stories';
  if (!pathname.startsWith(`${base}/`)) return null;
  const screen = pathname.slice(base.length + 1);
  return screen === 'stories' || screen === 'change' || screen === 'review' || screen === 'diff'
    ? screen
    : null;
}

function redirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { location });
  res.end();
}

function handle(req: IncomingMessage, res: ServerResponse, session: Session): void {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const method = req.method ?? 'GET';

  try {
    if (method === 'GET' && url.pathname === '/') {
      if (session.repo == null) return sendHtml(res, pickerStub());
      // Back-compat for URLs emitted by older app builds.
      if (url.searchParams.has('story')) {
        return redirect(
          res,
          url.searchParams.get('story') === 'new'
            ? repoRoute(session.repo, 'change')
            : repoRoute(session.repo, 'review', url.search),
        );
      }
      if (hasChangeQuery(url.searchParams)) {
        return redirect(res, repoRoute(session.repo, 'change', url.search));
      }
      if (session.chooseStory && session.selectedStory === undefined) {
        return redirect(res, repoRoute(session.repo, 'stories'));
      }
      if (session.selectedStory === null) {
        return redirect(res, repoRoute(session.repo, 'change', url.search));
      }
      return redirect(res, repoRoute(session.repo, 'review', url.search));
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
      if (session.repo == null) return sendHtml(res, pickerStub());
      return redirect(res, repoRoute(session.repo, 'stories'));
    }
    if (method === 'GET' && url.pathname === '/repos') {
      closeSession(session);
      return sendHtml(res, pickerStub());
    }
    if (method === 'GET' && url.pathname === '/change') {
      if (session.repo == null) return sendHtml(res, pickerStub());
      return redirect(res, repoRoute(session.repo, 'change', url.search));
    }
    if (method === 'GET' && url.pathname === '/review') {
      if (session.repo == null) return sendHtml(res, pickerStub());
      return redirect(res, repoRoute(session.repo, 'review', url.search));
    }
    if (method === 'GET' && url.pathname === '/api/repos/recent') {
      return sendJson(res, 200, listRecentRepos());
    }
    if (method === 'DELETE' && url.pathname === '/api/repos/recent') {
      return readBody(req, (body) => {
        let path = '';
        try {
          path = String((JSON.parse(body || '{}') as { path?: string }).path ?? '');
        } catch {
          return sendJson(res, 400, { error: 'invalid JSON' });
        }
        if (!path) return sendJson(res, 400, { error: 'Missing repository path.' });
        const removed = loadRecents(homedir()).some((e) => e.path === path);
        forgetRecent(homedir(), path);
        return sendJson(res, 200, { ok: true, removed, recents: listRecentRepos() });
      });
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
          path = String((JSON.parse(body || '{}') as { path?: string }).path ?? '');
        } catch {
          return sendJson(res, 400, { error: 'invalid JSON' });
        }
        if (!path || !isGitRepo(path)) {
          return sendJson(res, 400, { error: 'Not a git repository.' });
        }
        openSession(session, path);
        recordRecent(homedir(), path, nowMs());
        sendJson(res, 200, { ...inspectRepo(path), route: repoRoute(path, 'stories') });
      });
    }
    if (method === 'POST' && url.pathname === '/api/repo/close') {
      closeSession(session);
      return sendJson(res, 200, { ok: true });
    }
    if (method === 'DELETE' && url.pathname === '/api/stories') {
      if (!session.repo) return noRepo(res);
      const repo = session.repo;
      return readBody(req, (body) => {
        let id = '';
        try {
          id = String((JSON.parse(body || '{}') as { id?: string }).id ?? '');
        } catch {
          return sendJson(res, 400, { error: 'invalid JSON' });
        }
        if (!id) return sendJson(res, 400, { error: 'Missing story id.' });
        const path = storyPathForId(repo, id);
        if (!path) return sendJson(res, 404, { error: 'No such story.' });
        deleteStory(repo, id);
        if (session.selectedStory === path) {
          session.selectedStory = undefined;
          session.chooseStory = true;
        }
        return sendJson(res, 200, { ok: true, removed: true, stories: listStories(repo) });
      });
    }
    if (method === 'GET' && url.pathname === '/api/refs') {
      if (!session.repo) return noRepo(res);
      const ref = url.searchParams.get('ref')?.trim() || '';
      return sendJson(res, 200, {
        ...(ref ? { ref } : {}),
        current: currentBranch(session.repo),
        branches: listBranchRefs(session.repo),
        commits: listRecentCommits(session.repo, 0, ref || '--all'),
      });
    }
    if (method === 'GET' && url.pathname === '/api/fullfile') {
      return sendHtml(res, renderFullFileResponse(session, url.searchParams.get('file') ?? ''));
    }
    if (method === 'GET' && url.pathname === '/api/diff/fullfile') {
      return sendHtml(res, renderDiffFullFileResponse(session, url.searchParams.get('file') ?? ''));
    }
    if (method === 'GET' && url.pathname === '/api/comments') {
      if (!session.repo) return noRepo(res);
      return sendJson(res, 200, loadComments(session.repo));
    }
    if (method === 'POST' && url.pathname === '/api/comments') {
      if (!session.repo) return noRepo(res);
      const repo = session.repo;
      return readBody(req, (body) => {
        try {
          const input = JSON.parse(body) as NewComment;
          sendJson(res, 201, addComment(repo, input));
        } catch (e) {
          sendJson(res, 400, { error: (e as Error).message });
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
    if (method === 'POST' && url.pathname.startsWith('/api/comments/') && url.pathname.endsWith('/message')) {
      if (!session.repo) return noRepo(res);
      const repo = session.repo;
      const id = decodeURIComponent(url.pathname.slice('/api/comments/'.length, -'/message'.length));
      return readBody(req, (body) => {
        try {
          const { text } = JSON.parse(body || '{}') as { text?: string };
          const updated = appendUserMessage(repo, id, text ?? '');
          if (updated) sendJson(res, 200, updated);
          else sendJson(res, 404, { error: 'no such comment' });
        } catch (e) {
          sendJson(res, 400, { error: (e as Error).message });
        }
      });
    }
    if (method === 'PATCH' && url.pathname.startsWith('/api/comments/')) {
      if (!session.repo) return noRepo(res);
      const repo = session.repo;
      const id = decodeURIComponent(url.pathname.slice('/api/comments/'.length));
      return readBody(req, (body) => {
        try {
          const { status } = JSON.parse(body || '{}') as { status?: string };
          const updated = setCommentStatus(repo, id, status ?? '');
          if (updated) sendJson(res, 200, updated);
          else sendJson(res, 404, { error: 'no such comment' });
        } catch (e) {
          sendJson(res, 400, { error: (e as Error).message });
        }
      });
    }
    if (method === 'DELETE' && url.pathname.startsWith('/api/comments/')) {
      if (!session.repo) return noRepo(res);
      const id = decodeURIComponent(url.pathname.slice('/api/comments/'.length));
      const ok = deleteComment(session.repo, id);
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

function pickerStub(): string {
  return renderPicker(listRecentRepos(), homedir(), Date.now());
}

function storyChooser(session: Session): string {
  const repo = session.repo as string;
  return renderStoryPicker({
    repoName: basename(repo),
    routeBase: repoRouteBase(repo),
    stories: listStories(repo),
    now: Date.now(),
  });
}

function hasChangeQuery(params: URLSearchParams): boolean {
  return params.has('scope') || params.has('base') || params.has('head') || params.has('commit');
}

function reviewScreen(session: Session, params: URLSearchParams): string {
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
    } catch (e) {
      return changeScreen(session, params, (e as Error).message);
    }
  }
  if (picked) {
    return changeScreen(session, params, 'That story could not be found.');
  }
  return changeScreen(session, params);
}

function applyStoryChoice(session: Session, params: URLSearchParams): boolean {
  if (!session.repo || !params.has('story')) return false;
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

function selectedStoryPath(session: Session): string {
  if (!session.repo) throw new Error('No repo is open.');
  return session.selectedStory ?? resolveStoryPath(session.repo);
}

/** Apply a scope choice from the Your-change switcher (?scope=... | ?base= | ?head=). */
function applyScope(session: Session, params: URLSearchParams): void {
  if (params.get('scope') === 'auto') {
    session.base = undefined;
    session.head = undefined;
    return;
  }
  if (hasChangeQuery(params)) {
    const scope = resolveScope(session.repo as string, params);
    session.base = scope.base;
    session.head = scope.head;
  }
}

/** Resolve scope from the request, stash it on the session, render the scope picker. */
function changeScreen(session: Session, params: URLSearchParams, notice?: string): string {
  const scope = resolveScope(session.repo as string, params);
  session.base = scope.base;
  session.head = scope.head;
  return renderChange(session, scope, params, notice);
}

/** The "Your change" scope picker: choose what to diff, then open it in the
 *  review viewer (the "Open diff viewer" CTA). */
function renderChange(session: Session, scope: Scope, params: URLSearchParams, notice?: string): string {
  const repo = session.repo as string;
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
 *  tab offering "Generate story". This is where "Open the diff" lands. */
function diffScreen(session: Session, params: URLSearchParams): string {
  const scope = resolveScope(session.repo as string, params);
  session.base = scope.base;
  session.head = scope.head;
  const repo = session.repo as string;
  const base = resolveBase(repo, session.base);
  const head = session.head;
  const files = parseUnifiedDiff(getDiff(repo, base, head));
  const tour: Tour = { version: 1, title: '', summary: '', steps: [], base };
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
  });
}

/** The recents list, each entry enriched with its current repo state for the picker. */
function listRecentRepos() {
  return loadRecents(homedir()).map((e) => ({ ...inspectRepo(e.path), lastOpened: e.lastOpened }));
}

interface ReviewData {
  tour: Tour;
  base: string;
  head?: string;
  files: DiffFile[];
}

function reviewDiff(repo: string, session: Session, tour: Tour): { base: string; head?: string; diff: string } {
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

function loadReview(session: Session): ReviewData {
  if (!session.repo) throw new Error('No repo is open.');
  const repo = session.repo;
  const tour = loadTour(selectedStoryPath(session));
  const { base, head, diff } = reviewDiff(repo, session, tour);
  const files = parseUnifiedDiff(diff);
  return { tour, base, head, files };
}

function renderReview(session: Session): string {
  const repo = session.repo as string;
  const { tour, base, head, files } = loadReview(session);
  return renderPage({
    repo,
    routeBase: repoRouteBase(repo),
    repoName: basename(repo),
    tour,
    files,
    baseLabel: describeBase(repo, base),
    headRef: head,
    comments: loadComments(repo),
  });
}

/** The lazily-loaded "Full file" side-by-side view for one file. Works with or
 *  without a story: story-less, there's no coverage to flag, so it's just the
 *  diff reconstructed against the working tree. */
function renderFullFileResponse(session: Session, file: string): string {
  if (!session.repo) return `<div class="ds-diffnote">No repo is open.</div>`;
  if (!file) return `<div class="ds-diffnote">No file requested.</div>`;
  const repo = session.repo;

  if (session.selectedStory === null) {
    const head = session.head;
    const df = parseUnifiedDiff(getDiff(repo, resolveBase(repo, session.base), head)).find(
      (f) => f.newPath === file,
    );
    if (!df) return `<div class="ds-diffnote">That file isn't part of this change.</div>`;
    const newLines = readWholeFile(repo, file, head) ?? [];
    return renderFullFile(buildFullFileRows(df, newLines, []), {
      file,
      oldFile: df.oldPath,
      newFile: df.status === 'added',
    });
  }

  const { tour, head, files } = loadReview(session);
  const allowed = new Set<string>([...files.map((f) => f.newPath), ...tour.steps.map((s) => s.file)]);
  if (!allowed.has(file)) return `<div class="ds-diffnote">That file isn't part of this change.</div>`;

  const df = files.find((f) => f.newPath === file);
  const newLines = readWholeFile(repo, file, head) ?? [];
  const ranges = computeCoverage(tour, files)
    .uncovered.filter((u) => u.file === file)
    .map((u) => u.range);
  const rows = buildFullFileRows(df, newLines, ranges);
  return renderFullFile(rows, { file, oldFile: df?.oldPath, newFile: df?.status === 'added' });
}

/** The lazily-loaded "Full file" view for the change-page scope-picker preview
 *  (its own dv-* diff renderer). No story — just the diff + working tree. */
function renderDiffFullFileResponse(session: Session, file: string): string {
  if (!session.repo) return `<div class="dv-note">No repo is open.</div>`;
  if (!file) return `<div class="dv-note">No file requested.</div>`;
  const repo = session.repo;
  const head = session.head;
  const df = parseUnifiedDiff(getDiff(repo, resolveBase(repo, session.base), head)).find(
    (f) => f.newPath === file,
  );
  if (!df) return `<div class="dv-note">That file isn't part of this change.</div>`;
  const newLines = readWholeFile(repo, file, head) ?? [];
  return renderDiffFullBody(buildFullFileRows(df, newLines, []));
}

/** Raw `git diff` text for the current review scope — used to detect agent code edits. */
function currentDiff(session: Session): string {
  try {
    if (!session.repo) return '';
    const repo = session.repo;
    if (session.selectedStory === null) {
      return getDiff(repo, resolveBase(repo, session.base), session.head);
    }
    const tour = loadTour(selectedStoryPath(session));
    return reviewDiff(repo, session, tour).diff;
  } catch {
    return '';
  }
}

function tailLines(s: string, n: number): string {
  return s.trimEnd().split('\n').slice(-n).join('\n');
}

function nowMs(): number {
  return Date.now();
}

/** Everything runWorkflow needs to drive one agent run end to end. */
interface WorkflowSpec {
  workflow: Workflow;
  title: string;
  context: RunContext;
  agent: Agent;
  prompt: string;
  model?: string;
  agentOptions?: AgentRunOptions;
  /** True when this event is a write to the run's own output (drives writing_output). */
  isTargetWrite: (ev: ProgressEvent) => boolean;
  /** After the agent exits, compute terminal status + result + any error/warning events. */
  finish: (r: StreamResult) => { status: RunStatus; result: Record<string, unknown>; events: ProgressEvent[] };
  /** Optional cleanup for temp checkouts created only for this workflow. */
  cleanup?: () => void;
  /** Optional file scope: relativize file-event paths and count distinct changed-file reads. */
  fileScope?: FileScope;
}

export function finishStoryGeneration(
  r: StreamResult,
  storyPath: string,
  session: Pick<Session, 'selectedStory' | 'chooseStory'>,
): { status: RunStatus; result: Record<string, unknown>; events: ProgressEvent[] } {
  const storyWritten = existsSync(storyPath);
  const events: ProgressEvent[] = [];
  let status: RunStatus = 'complete';
  if (storyWritten) {
    try {
      loadTour(storyPath);
      session.selectedStory = storyPath;
      session.chooseStory = false;
      return { status, result: { storyWritten, storyValid: true }, events };
    } catch (e) {
      events.push(errorEvent('validation', 'The generated story is invalid', (e as Error).message));
      status = 'failed';
      return { status, result: { storyWritten, storyValid: false }, events };
    }
  }
  if (r.failure === 'startup') {
    events.push(errorEvent('startup', 'The agent failed to start', tailLines(r.output, 30)));
    status = 'failed';
  } else if (!r.ok) {
    events.push(errorEvent('execution', 'The agent run failed', tailLines(r.output, 30)));
    status = 'failed';
  } else {
    events.push(errorEvent('output_missing', 'No story was written',
      'The agent finished but .diffstory/story.json is missing. Check the raw output below.'));
    status = 'failed';
  }
  return { status, result: { storyWritten, storyValid: false }, events };
}

/**
 * The shared spine for every agent workflow: emit run_started → context → app
 * phases, stream normalized agent events (advancing phases monotonically on real
 * observation), heartbeat liveness while the child runs, then validate → run_done.
 */
function runWorkflow(res: ServerResponse, repo: string, spec: WorkflowSpec): void {
  agentBusy = true;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  const ac = new AbortController();
  res.on('close', () => ac.abort());

  let seq = 0;
  const send = (e: ProgressEvent) => {
    try {
      res.write(JSON.stringify({ seq: seq++, ...e }) + '\n');
    } catch {
      /* client disconnected */
    }
  };

  // Phases only ever advance (monotonic by rank).
  let curRank = -1;
  const advance = (phase: Phase, label?: string, detail?: string) => {
    if (phaseRank(phase) <= curRank) return;
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
    if (!ac.signal.aborted) send(heartbeatEvent(nowMs() - lastActivity));
  }, 5000);

  const enrich = spec.fileScope ? createFileEnricher(spec.fileScope) : (e: ProgressEvent) => e;

  streamAgent(
    spec.agent,
    repo,
    spec.prompt,
    (ev) => {
      lastActivity = nowMs();
      const out = enrich(ev);
      send(out);
      const ph = observedPhase(out, spec.isTargetWrite(out));
      if (ph) advance(ph);
      if (out.type === 'text') {
        for (const note of noteEventsFromText(out.data)) {
          if (note.type === 'phase') advance(note.phase, note.label);
          else send(note);
        }
      }
    },
    spec.model,
    ac.signal,
    spec.agentOptions,
  )
    .then((r) => {
      clearInterval(heart);
      if (ac.signal.aborted) {
        send(doneEvent('stopped'));
        return;
      }
      advance('validating_output');
      const { status, result, events } = spec.finish(r);
      for (const e of events) send(e);
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

interface AddressRepoContext {
  runRepo: string;
  historical: boolean;
  cleanup?: () => void;
}

function addressRepoContext(repo: string, head?: string): AddressRepoContext {
  if (!head) return { runRepo: repo, historical: false };
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
      } catch {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}

function copyDiffstoryData(fromRepo: string, toRepo: string): void {
  const from = join(fromRepo, DATA_DIR);
  if (!existsSync(from)) return;
  cpSync(from, join(toRepo, DATA_DIR), { recursive: true, force: true });
}

function copyCommentsBack(fromRepo: string, toRepo: string): void {
  const from = commentsPath(fromRepo);
  if (!existsSync(from)) return;
  const to = commentsPath(toRepo);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { force: true });
}

function stableDiffRef(repo: string, ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  return resolveCommit(repo, ref) ?? ref;
}

/** Drive the user's agent to address review comments, streaming progress NDJSON. */
function runAddress(res: ServerResponse, session: Session, body: string): void {
  let input: { commentIds?: string[]; all?: boolean };
  try {
    input = JSON.parse(body || '{}');
  } catch {
    return sendJson(res, 400, errorEvent('preflight', 'Invalid request', 'The request body was not valid JSON.'));
  }
  const target: string[] | 'all' = input.all
    ? 'all'
    : Array.isArray(input.commentIds)
      ? input.commentIds
      : [];
  if (target !== 'all' && target.length === 0) {
    return sendJson(res, 400, errorEvent('preflight', 'No comments specified', 'Pick at least one comment to address.'));
  }

  const pre = agentPreflight({ repo: session.repo, busy: agentBusy, agents: availableAgents() });
  if (!pre.ok) return sendJson(res, pre.status, errorEvent(pre.stage, pre.label, pre.detail));
  const agent = pre.agent;
  const repo = session.repo as string;

  const openCount = loadComments(repo).filter((c) => c.status === 'open').length;
  const targetCount = target === 'all' ? openCount : target.length;
  const title =
    target === 'all'
      ? `Addressing ${targetCount} open ${targetCount === 1 ? 'comment' : 'comments'}`
      : `Addressing ${targetCount} ${targetCount === 1 ? 'comment' : 'comments'}`;

  const before = currentDiff(session);
  // The diff's two sides, resolved exactly as the review page rendered them, so the
  // agent grounds its answers in both — not just the tree it has checked out. `head`
  // is set only for two-ref comparisons; otherwise the current side is the working
  // tree. Falls back to single-sided if no story.
  let base: string | undefined;
  let head: string | undefined;
  try {
    const tour = loadTour(selectedStoryPath(session));
    ({ base, head } = reviewDiff(repo, session, tour));
  } catch {
    /* no story/tour yet — addressPrompt degrades to its prior single-sided form */
  }
  let addressCtx: AddressRepoContext;
  try {
    addressCtx = addressRepoContext(repo, head);
  } catch (e) {
    return sendJson(res, 500, errorEvent('preflight', 'Could not prepare historical checkout', (e as Error).message));
  }
  runWorkflow(res, addressCtx.runRepo, {
    workflow: 'address',
    title,
    agent,
    prompt: addressPrompt(target, base, head, {
      historicalCheckout: addressCtx.historical,
      originalRepo: addressCtx.historical ? repo : undefined,
    }),
    context: {
      repoName: basename(repo), repoPath: repo, workflow: 'address',
      agent, targetCount,
    },
    // For address, the output is code: any non-read write to a non-JSON file.
    isTargetWrite: (ev) => ev.type === 'file' && ev.action !== 'read' && !ev.target.endsWith('.json'),
    finish: (r) => {
      const codeChanged = currentDiff(session) !== before;
      const events: ProgressEvent[] = [];
      let status: RunStatus = 'complete';
      if (r.failure === 'startup') {
        events.push(errorEvent('startup', 'The agent failed to start', tailLines(r.output, 30)));
        status = 'failed';
      } else if (!r.ok) {
        events.push(errorEvent('execution', 'The agent run failed', tailLines(r.output, 30)));
        status = 'failed';
      } else if (!codeChanged && !addressCtx.historical) {
        events.push(warningEvent('No files changed', 'The agent answered without editing code.'));
      }
      return { status, result: { codeChanged }, events };
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
export function postRenamePath(path: string): string {
  if (!path.includes(' => ')) return path;
  if (path.includes('{')) {
    return path.replace(/\{[^{}]*? => ([^{}]*?)\}/g, '$1').replace(/\/{2,}/g, '/');
  }
  return path.slice(path.indexOf(' => ') + 4);
}

/** Drive the agent to write a story for the current repo, streaming progress NDJSON. */
function runGenerate(res: ServerResponse, session: Session, body: string): void {
  let input: {
    base?: string;
    head?: string;
    agent?: string;
    model?: string;
    mode?: string;
    codexSandbox?: string;
    codexProvider?: string;
    codexProfile?: string;
    codexConfig?: string[] | string;
  } = {};
  try {
    input = JSON.parse(body || '{}');
  } catch {
    return sendJson(res, 400, errorEvent('preflight', 'Invalid request', 'The request body was not valid JSON.'));
  }

  const agents = availableAgents();
  const pre = agentPreflight({ repo: session.repo, busy: agentBusy, agents });
  if (!pre.ok) return sendJson(res, pre.status, errorEvent(pre.stage, pre.label, pre.detail));
  const agent =
    (input.agent === 'claude' || input.agent === 'codex') && agents.includes(input.agent)
      ? input.agent
      : pre.agent;
  const model = input.model && input.model.trim() ? input.model.trim() : undefined;
  const mode = normalizeStoryMode(input.mode);
  const agentOptions = agent === 'codex' ? { codex: normalizeCodexRunOptions(input) } : undefined;
  const workflow: Workflow = mode === 'detailed' ? 'detailed_audit' : 'guided_review';
  const title =
    mode === 'brief'
      ? 'Generating brief story'
      : mode === 'detailed'
        ? 'Generating line-by-line story'
        : 'Generating balanced story';
  const repo = session.repo as string;

  const base = resolveBase(repo, input.base);
  const promptBase = stableDiffRef(repo, base) ?? base;
  const promptHead = stableDiffRef(repo, input.head);
  session.base = promptBase;
  session.head = promptHead;
  const storyPath = resolveStoryPath(repo);
  // Generated/oversized files (regenerated ABIs, lockfiles) are subtracted from
  // the agent's diff just as they are from the rendered review and coverage gate,
  // so all three agree and the agent doesn't waste a run narrating a 20k-line ABI.
  const excludePaths = noiseFiles(repo, promptBase, promptHead);
  // The exact changed files the review shows (noise subtracted), so file-read
  // progress can honestly say "3 of 8 changed files".
  const changedFiles = numstat(repo, promptBase, promptHead)
    .map((f) => postRenamePath(f.path))
    .filter((p) => !excludePaths.includes(p));

  runWorkflow(res, repo, {
    workflow,
    title,
    agent,
    model,
    agentOptions,
    prompt: storyPrompt(promptBase, promptHead, mode, excludePaths),
    context: {
      repoName: basename(repo), repoPath: repo, workflow, agent, model,
      base: describeBase(repo, promptBase),
      head: promptHead ?? 'working tree',
    },
    // For generate, the output is the story file.
    isTargetWrite: (ev) => ev.type === 'file' && ev.action !== 'read' && ev.target.endsWith('story.json'),
    finish: (r) => finishStoryGeneration(r, storyPath, session),
    fileScope: { repoPath: repo, changedFiles },
  });
}

function readBody(req: IncomingMessage, done: (body: string) => void): void {
  let data = '';
  req.on('data', (chunk) => {
    data += chunk;
    if (data.length > 1_000_000) req.destroy(); // 1MB guard
  });
  req.on('end', () => done(data));
}

function runLocalSay(res: ServerResponse, body: string): void {
  let input: { text?: string; voice?: string; preset?: string; rate?: number };
  try {
    input = JSON.parse(body || '{}');
  } catch {
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
      if (abort.signal.aborted || res.destroyed) return;
      sendJson(res, 400, { error: (err as Error).message });
    });
}

function runLocalKokoro(res: ServerResponse, body: string): void {
  let input: { text?: string; voice?: string; rate?: number };
  try {
    input = JSON.parse(body || '{}');
  } catch {
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
      if (abort.signal.aborted || res.destroyed) return;
      sendJson(res, 400, { error: (err as Error).message });
    });
}

function speechAbortForResponse(res: ServerResponse): AbortController {
  const ctrl = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) ctrl.abort();
  });
  return ctrl;
}

function sendLocalSayAudio(res: ServerResponse, file: string): void {
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

function sendLocalKokoroAudio(res: ServerResponse, file: string): void {
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
<p>Fix the issue above and refresh. Most often the story is missing or malformed — open the diff and generate a fresh one.</p>
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
