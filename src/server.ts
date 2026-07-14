// Tiny HTTP server over Node built-ins. The page is re-rendered on every GET, so
// refreshing reflects the current diff and story with no watch process. The repo
// is held in a mutable Session, so the same server can boot empty (app/picker
// mode) and switch repos at runtime via /api/repo/open.
import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { loadTour, validateGeneratedConceptSteps, validateGeneratedTour } from './tour.js';
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
  excludedReviewFiles,
  reviewChangeFingerprint,
  stagedWorktreeDivergentFiles,
  numstat,
} from './git.js';
import { parseUnifiedDiff } from './diff.js';
import { computeCoverage } from './coverage.js';
import {
  renderPage,
  renderFullFile,
  renderSplitHunks,
  renderContextRows,
  renderFilePanelContent,
  renderStoryStepPanel,
} from './render.js';
import { esc } from './diff-render.js';
import { renderPicker } from './picker.js';
import { renderChangePage } from './change-page.js';
import { renderStoryPicker } from './story-picker.js';
import { summarizeChange } from './change-view.js';
import { resolveScope, type Scope } from './scope.js';
import { basename, dirname, join } from 'node:path';
import { buildFullFileRows, hunksToSbsBlocks, hunkNewRange } from './view-model.js';
import { buildReviewModel } from './view-model.js';
import {
  loadComments,
  loadCommentsWithHealth,
  addComment,
  deleteComment,
  setCommentStatus,
  appendUserMessage,
  InvalidCommentStoreError,
  type CommentStoreHealth,
  type NewComment,
} from './comments.js';
import { commentsPath, resolveStoryPath, APP_NAME, APP_BRAND, DATA_DIR } from './config.js';
import { isCodeStep, type Comment, type DiffFile, type StoryScope, type Tour } from './types.js';
import {
  availableAgents,
  streamAgent,
  addressPrompt,
  storyPrompt,
  agentPreflight,
  selectAvailableAgent,
  normalizeStoryMode,
  normalizeCodexRunOptions,
  summarizeAgentFailure,
  resumedCodexTaskMatches,
  storyRepairPrompt,
  type StoryRepairAction,
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
import {
  createSession,
  openSession,
  closeSession,
  sessionEntryScreen,
  issueReviewPageLease,
  getReviewPageLease,
  type ReviewPageLease,
  type Session,
} from './session.js';
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
import {
  codexTaskBinary,
  listCodexStoryModels,
  listCodexTasks,
  nameCodexTask,
  validCodexThreadId,
} from './codex-tasks.js';
import { sendCodexDesktopTurn } from './codex-desktop.js';
import {
  captureReviewSnapshot,
  diffSinceReview,
  recordReviewEvent,
  reviewStateSummary,
  recordReviewVerdict,
  ReviewFeedbackChangedError,
  UnresolvedBlockingFeedbackError,
  type ReviewEventKind,
  type ReviewSnapshotReason,
} from './review-state.js';

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
  // Capture the home directory once. Besides making one server session stable,
  // this keeps parallel test servers from following later HOME mutations into
  // another test's recents, skills, or voice cache.
  const home = homedir();
  const session = createSession({
    repo: opts.repo,
    base: opts.baseOverride,
    head: opts.headOverride,
  });
  const server = createServer((req, res) => handle(req, res, session, home));

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${opts.port} is in use. Try: ${APP_NAME} --port ${opts.port + 1}`);
    } else {
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

function invalidFeedbackResponse(
  res: ServerResponse,
  health: Extract<CommentStoreHealth, { status: 'invalid' }>,
): void {
  sendJson(res, 409, {
    error: `${health.message} ${health.recovery}`,
    feedbackHealth: health,
    reloadRequired: true,
  });
}

function sendCommentMutationError(res: ServerResponse, error: unknown): void {
  if (error instanceof InvalidCommentStoreError) return invalidFeedbackResponse(res, error.health);
  if (error instanceof UnresolvedBlockingFeedbackError) {
    return sendJson(res, 409, {
      error: error.message,
      blockingCommentIds: error.blockingCommentIds,
    });
  }
  if (error instanceof ReviewFeedbackChangedError) {
    return sendJson(res, 409, {
      error: error.message,
      currentFeedbackVersion: error.currentFeedbackVersion,
      currentBlockingFeedbackDigest: error.currentBlockingFeedbackDigest,
    });
  }
  sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
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

function localHostname(value: string): boolean {
  const host = value.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '::1';
}

/**
 * Reject DNS-rebinding hosts and browser cross-site requests. Requests from
 * curl/Node are still accepted when they address a loopback Host directly.
 */
function isTrustedLocalRequest(req: IncomingMessage): boolean {
  const host = req.headers.host;
  if (!host) return false;

  let expected: URL;
  try {
    expected = new URL(`http://${host}`);
  } catch {
    return false;
  }
  if (!localHostname(expected.hostname)) return false;

  const fetchSite = req.headers['sec-fetch-site'];
  if (typeof fetchSite === 'string' && fetchSite !== 'same-origin' && fetchSite !== 'none') return false;

  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const actual = new URL(origin);
    return actual.protocol === 'http:' && localHostname(actual.hostname) && actual.host === expected.host;
  } catch {
    return false;
  }
}

function setLocalResponseHeaders(res: ServerResponse): void {
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

function handle(req: IncomingMessage, res: ServerResponse, session: Session, home: string): void {
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
    if (method === 'GET' && url.pathname === '/') {
      if (session.repo == null) return sendHtml(res, pickerStub(home));
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
      if (session.repo == null) return sendHtml(res, pickerStub(home));
      return redirect(res, repoRoute(session.repo, 'stories'));
    }
    if (method === 'GET' && url.pathname === '/repos') {
      closeSession(session);
      return sendHtml(res, pickerStub(home));
    }
    if (method === 'GET' && url.pathname === '/change') {
      if (session.repo == null) return sendHtml(res, pickerStub(home));
      return redirect(res, repoRoute(session.repo, 'change', url.search));
    }
    if (method === 'GET' && url.pathname === '/review') {
      if (session.repo == null) return sendHtml(res, pickerStub(home));
      return redirect(res, repoRoute(session.repo, 'review', url.search));
    }
    if (method === 'GET' && url.pathname === '/api/repos/recent') {
      return sendJson(res, 200, listRecentRepos(home));
    }
    if (method === 'DELETE' && url.pathname === '/api/repos/recent') {
      return readBody(req, res, (body) => {
        let path = '';
        try {
          path = String((JSON.parse(body || '{}') as { path?: string }).path ?? '');
        } catch {
          return sendJson(res, 400, { error: 'invalid JSON' });
        }
        if (!path) return sendJson(res, 400, { error: 'Missing repository path.' });
        const removed = loadRecents(home).some((e) => e.path === path);
        forgetRecent(home, path);
        return sendJson(res, 200, { ok: true, removed, recents: listRecentRepos(home) });
      });
    }
    if (method === 'GET' && url.pathname === '/api/agents') {
      return sendJson(res, 200, { agents: availableAgents(), skills: skillStatus(home) });
    }
    if (method === 'GET' && url.pathname === '/api/codex/tasks') {
      if (!session.repo) return noRepo(res);
      listCodexTasks(session.repo)
        .then((tasks) => sendJson(res, 200, { tasks }))
        .catch((error) => sendJson(res, 502, { error: (error as Error).message }));
      return;
    }
    if (method === 'GET' && url.pathname === '/api/codex/models') {
      listCodexStoryModels()
        .then((models) => sendJson(res, 200, { models }))
        .catch((error) => sendJson(res, 502, { error: (error as Error).message }));
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
          path = String((JSON.parse(body || '{}') as { path?: string }).path ?? '');
        } catch {
          return sendJson(res, 400, { error: 'invalid JSON' });
        }
        if (!path || !isGitRepo(path)) {
          return sendJson(res, 400, { error: 'Not a git repository.' });
        }
        openSession(session, path);
        recordRecent(home, path, nowMs());
        sendJson(res, 200, { ...inspectRepo(path), route: repoRoute(path, sessionEntryScreen(session)) });
      });
    }
    if (method === 'POST' && url.pathname === '/api/repo/close') {
      closeSession(session);
      return sendJson(res, 200, { ok: true });
    }
    if (method === 'DELETE' && url.pathname === '/api/stories') {
      if (!session.repo) return noRepo(res);
      const repo = session.repo;
      return readBody(req, res, (body) => {
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
      const page = validateReviewPageLease(session, url.searchParams.get('page'));
      if (!page.ok) return sendReviewPageConflict(res, page.error);
      return sendLeasedHtml(res, session, page, renderFullFileResponse(page, url.searchParams.get('file') ?? ''));
    }
    if (method === 'GET' && url.pathname === '/api/diff/split') {
      const page = validateReviewPageLease(session, url.searchParams.get('page'));
      if (!page.ok) return sendReviewPageConflict(res, page.error);
      return sendLeasedHtml(res, session, page, renderSplitResponse(page, url.searchParams.get('file') ?? ''));
    }
    if (method === 'GET' && url.pathname === '/api/diff/context') {
      const page = validateReviewPageLease(session, url.searchParams.get('page'));
      if (!page.ok) return sendReviewPageConflict(res, page.error);
      return sendLeasedHtml(res, session, page, renderContextResponse(page, url.searchParams));
    }
    if (method === 'GET' && url.pathname === '/api/diff/file-panel') {
      const page = validateReviewPageLease(session, url.searchParams.get('page'));
      if (!page.ok) return sendReviewPageConflict(res, page.error);
      return sendLeasedHtml(res, session, page, renderFilePanelResponse(page, url.searchParams.get('file') ?? ''));
    }
    if (method === 'GET' && url.pathname === '/api/review/step-panel') {
      const page = validateReviewPageLease(session, url.searchParams.get('page'));
      if (!page.ok) return sendReviewPageConflict(res, page.error);
      return sendLeasedHtml(res, session, page, renderStoryStepResponse(page, url.searchParams.get('index') ?? ''));
    }
    if (method === 'GET' && url.pathname === '/api/review/excluded-file') {
      const page = validateReviewPageLease(session, url.searchParams.get('page'));
      if (!page.ok) return sendReviewPageConflict(res, page.error);
      return sendLeasedHtml(res, session, page, renderExcludedFileResponse(page, url.searchParams.get('file') ?? ''));
    }
    if (method === 'GET' && url.pathname === '/api/review-state') {
      if (!session.repo) return noRepo(res);
      const data = sessionReviewData(session);
      return sendJson(
        res,
        200,
        reviewStateSummary(
          session.repo,
          data.base,
          data.head,
          data.diff,
          data.files,
          data.changeFingerprint,
        ),
      );
    }
    if (method === 'POST' && url.pathname === '/api/review/checkpoint') {
      if (!session.repo) return noRepo(res);
      const snapshot = captureSessionReview(session, 'opened');
      return sendJson(res, 200, {
        ok: true,
        snapshot: { id: snapshot.id, round: snapshot.round, createdAt: snapshot.createdAt },
      });
    }
    if (method === 'POST' && url.pathname === '/api/review/verdict') {
      if (!session.repo) return noRepo(res);
      return readBody(req, res, (body) => {
        try {
          const input = JSON.parse(body || '{}') as {
            decision?: string;
            note?: string;
            acknowledgedExclusions?: string[];
            expectedFingerprint?: string;
            expectedScopeKey?: string;
            expectedFeedbackVersion?: number;
            expectedBlockingFeedbackDigest?: string;
            pageToken?: string;
            mode?: string;
          };
          if (input.decision !== 'approved' && input.decision !== 'changes-requested') {
            return sendJson(res, 400, { error: 'Decision must be approved or changes-requested.' });
          }
          const page = validateReviewPageLease(
            session,
            typeof input.pageToken === 'string' ? input.pageToken : null,
          );
          if (!page.ok) return sendReviewPageConflict(res, page.error);
          const data: ReviewData = {
            tour: page.tour,
            base: page.base,
            head: page.head,
            diff: page.diff,
            files: page.fullFiles,
            changeFingerprint: page.lease.fingerprint,
          };
          const currentFingerprint = data.changeFingerprint;
          if (typeof input.expectedFingerprint !== 'string' || input.expectedFingerprint !== currentFingerprint) {
            return sendJson(res, 409, {
              error: 'The change moved since this page loaded. Reload before saving a review decision.',
              currentFingerprint,
            });
          }
          const currentReviewState = reviewStateSummary(
            session.repo as string,
            data.base,
            data.head,
            data.diff,
            data.files,
            currentFingerprint,
          );
          if (typeof input.expectedScopeKey !== 'string' || input.expectedScopeKey !== currentReviewState.scopeKey) {
            return sendJson(res, 409, {
              error: 'The review scope changed since this page loaded. Reload before saving a decision.',
              currentScopeKey: currentReviewState.scopeKey,
            });
          }
          if (input.decision === 'approved' && currentReviewState.feedbackHealth.status === 'invalid') {
            return invalidFeedbackResponse(res, currentReviewState.feedbackHealth);
          }
          if (
            input.decision === 'approved' &&
            (!Number.isInteger(input.expectedFeedbackVersion) || input.expectedFeedbackVersion !== currentReviewState.feedbackVersion)
          ) {
            return sendJson(res, 409, {
              error: 'Blocking feedback changed since this page loaded. Reload before approval.',
              currentFeedbackVersion: currentReviewState.feedbackVersion,
            });
          }
          if (
            input.decision === 'approved' &&
            input.expectedBlockingFeedbackDigest !== currentReviewState.blockingFeedbackDigest
          ) {
            return sendJson(res, 409, {
              error: 'Blocking feedback changed since this page loaded. Reload before approval.',
              currentBlockingFeedbackDigest: currentReviewState.blockingFeedbackDigest,
            });
          }
          if (input.decision === 'approved' && page.lease.mode !== 'full') {
            return sendJson(res, 409, {
              error: 'Approval is only available in the full-change view. Switch from “Since feedback” to “Full change”.',
            });
          }
          const stagedWorktreeDivergence = stagedWorktreeDivergentFiles(
            session.repo as string,
            data.base,
            data.head,
          );
          if (input.decision === 'approved' && stagedWorktreeDivergence.length) {
            return sendJson(res, 409, {
              error: 'Staged and working-tree versions differ. Reconcile them before approval so the reviewed code matches the pending commit.',
              stagedWorktreeDivergentFiles: stagedWorktreeDivergence,
            });
          }
          const comments = loadComments(session.repo as string);
          const blocking = comments.filter((comment) => comment.status !== 'resolved' && isBlockingComment(comment));
          if (input.decision === 'approved' && blocking.length) {
            return sendJson(res, 409, {
              error: `Resolve ${blocking.length} blocking ${blocking.length === 1 ? 'comment' : 'comments'} before approval.`,
              blockingCommentIds: blocking.map((comment) => comment.id),
            });
          }
          const hasStory = data.tour.steps.length > 0 || !!data.tour.title.trim();
          if (input.decision === 'approved' && hasStory) {
            const focusedStoryFiles = data.tour.storyScope?.excludedFiles ?? [];
            if (focusedStoryFiles.length) {
              return sendJson(res, 409, {
                error: 'This story covers a selected scope, not the full change. Open a full-change review before approval.',
                focusedStoryFiles,
              });
            }
            const storyIsCurrent = !!data.tour.diffFingerprint && diffFingerprint(data.diff) === data.tour.diffFingerprint;
            if (!storyIsCurrent) {
              return sendJson(res, 409, { error: 'Regenerate the story for the current full change before approval.' });
            }
            const coverage = computeCoverage(data.tour, data.files);
            if (coverage.unclaimed.length) {
              return sendJson(res, 409, {
                error: `The story does not explain ${coverage.unclaimed.length} changed ${coverage.unclaimed.length === 1 ? 'range' : 'ranges'} in the full change.`,
                unclaimed: coverage.unclaimed,
              });
            }
          }
          const excluded = excludedReviewFiles(session.repo as string, data.base, data.head);
          const acknowledged = new Set(
            Array.isArray(input.acknowledgedExclusions)
              ? input.acknowledgedExclusions.filter((path): path is string => typeof path === 'string')
              : [],
          );
          const missing = excluded.filter((file) => !acknowledged.has(file.path));
          if (input.decision === 'approved' && missing.length) {
            return sendJson(res, 409, {
              error: `Inspect and acknowledge ${missing.length} excluded ${missing.length === 1 ? 'file' : 'files'} before approval.`,
              missing: missing.map((file) => file.path),
            });
          }
          // Re-check the issued evidence and live feedback immediately before
          // persisting. External tools can edit both the worktree and the
          // handoff file while the local server is handling a request.
          const confirmedPage = validateReviewPageLease(session, page.lease.token);
          if (!confirmedPage.ok) return sendReviewPageConflict(res, confirmedPage.error);
          if (input.decision === 'approved') {
            const confirmedReviewState = reviewStateSummary(
              session.repo as string,
              confirmedPage.base,
              confirmedPage.head,
              confirmedPage.diff,
              confirmedPage.fullFiles,
              confirmedPage.lease.fingerprint,
            );
            if (confirmedReviewState.feedbackHealth.status === 'invalid') {
              return invalidFeedbackResponse(res, confirmedReviewState.feedbackHealth);
            }
            if (
              input.expectedFeedbackVersion !== confirmedReviewState.feedbackVersion ||
              input.expectedBlockingFeedbackDigest !== confirmedReviewState.blockingFeedbackDigest
            ) {
              return sendJson(res, 409, {
                error: 'Blocking feedback changed while the decision was being saved. Reload before approval.',
              });
            }
            const finalBlocking = loadComments(session.repo as string)
              .filter((comment) => comment.status !== 'resolved' && isBlockingComment(comment));
            if (finalBlocking.length) {
              return sendJson(res, 409, {
                error: `Resolve ${finalBlocking.length} blocking ${finalBlocking.length === 1 ? 'comment' : 'comments'} before approval.`,
                blockingCommentIds: finalBlocking.map((comment) => comment.id),
              });
            }
          }
          const verdict = recordReviewVerdict(session.repo as string, {
            base: data.base,
            head: data.head,
            diff: data.diff,
            changeFingerprint: currentFingerprint,
            acknowledgedExclusions: input.decision === 'approved'
              ? excluded.map(({ path, reason }) => ({ path, reason }))
              : undefined,
            decision: input.decision,
            note: typeof input.note === 'string' ? input.note : undefined,
            expectedFeedbackVersion: input.decision === 'approved' ? input.expectedFeedbackVersion : undefined,
            expectedBlockingFeedbackDigest: input.decision === 'approved'
              ? input.expectedBlockingFeedbackDigest
              : undefined,
          });
          return sendJson(res, 201, { ok: true, verdict });
        } catch (error) {
          return sendCommentMutationError(res, error);
        }
      });
    }
    if (method === 'GET' && url.pathname === '/api/comments') {
      if (!session.repo) return noRepo(res);
      const loaded = loadCommentsWithHealth(session.repo);
      if (loaded.health.status === 'invalid') return invalidFeedbackResponse(res, loaded.health);
      return sendJson(res, 200, loaded.comments);
    }
    if (method === 'POST' && url.pathname === '/api/comments') {
      if (!session.repo) return noRepo(res);
      const repo = session.repo;
      return readBody(req, res, (body) => {
        try {
          const loaded = loadCommentsWithHealth(repo);
          if (loaded.health.status === 'invalid') return invalidFeedbackResponse(res, loaded.health);
          const input = JSON.parse(body) as NewComment;
          const snapshot = captureSessionReview(session, 'opened');
          input.reviewRound = snapshot.round;
          input.reviewSnapshotId = snapshot.id;
          const comment = addComment(repo, input);
          recordSessionEvent(
            session,
            'comment-added',
            'Comment added',
            `${comment.file}:${comment.line}`,
            isBlockingComment(comment),
          );
          sendJson(res, 201, comment);
        } catch (e) {
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
      if (!session.repo) return noRepo(res);
      const repo = session.repo;
      const id = decodeURIComponent(url.pathname.slice('/api/comments/'.length, -'/message'.length));
      return readBody(req, res, (body) => {
        try {
          const { text } = JSON.parse(body || '{}') as { text?: string };
          const updated = appendUserMessage(repo, id, text ?? '');
          if (updated) {
            recordSessionEvent(
              session,
              'comment-reopened',
              'Follow-up added',
              `${updated.file}:${updated.line}`,
              isBlockingComment(updated),
            );
            sendJson(res, 200, updated);
          }
          else sendJson(res, 404, { error: 'no such comment' });
        } catch (e) {
          sendCommentMutationError(res, e);
        }
      });
    }
    if (method === 'PATCH' && url.pathname.startsWith('/api/comments/')) {
      if (!session.repo) return noRepo(res);
      const repo = session.repo;
      const id = decodeURIComponent(url.pathname.slice('/api/comments/'.length));
      return readBody(req, res, (body) => {
        try {
          const { status } = JSON.parse(body || '{}') as { status?: string };
          const updated = setCommentStatus(repo, id, status ?? '');
          if (updated) {
            recordSessionEvent(
              session,
              updated.status === 'resolved' ? 'comment-resolved' : 'comment-reopened',
              updated.status === 'resolved' ? 'Comment verified' : 'Comment reopened',
              `${updated.file}:${updated.line}`,
              isBlockingComment(updated),
            );
            sendJson(res, 200, updated);
          }
          else sendJson(res, 404, { error: 'no such comment' });
        } catch (e) {
          sendCommentMutationError(res, e);
        }
      });
    }
    if (method === 'DELETE' && url.pathname.startsWith('/api/comments/')) {
      if (!session.repo) return noRepo(res);
      const id = decodeURIComponent(url.pathname.slice('/api/comments/'.length));
      try {
        const loaded = loadCommentsWithHealth(session.repo);
        if (loaded.health.status === 'invalid') return invalidFeedbackResponse(res, loaded.health);
        const deleted = loaded.comments.find((comment) => comment.id === id);
        const ok = deleteComment(session.repo, id);
        if (ok && deleted) {
          recordSessionEvent(
            session,
            'comment-deleted',
            'Comment deleted',
            `${deleted.file}:${deleted.line}`,
            isBlockingComment(deleted),
          );
        }
        res.statusCode = ok ? 204 : 404;
        res.end();
      } catch (error) {
        sendCommentMutationError(res, error);
      }
      return;
    }
    res.statusCode = 404;
    res.end('Not found');
  } catch (e) {
    sendHtml(res, errorPage((e as Error).message), 500);
  }
}

function pickerStub(home: string): string {
  return renderPicker(listRecentRepos(home), home, Date.now());
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
      return renderReview(session, params);
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
 *  tab offering the guided-review generator. This is where "Open the diff" lands. */
function diffScreen(session: Session, params: URLSearchParams): string {
  const scope = resolveScope(session.repo as string, params);
  session.base = scope.base;
  session.head = scope.head;
  const repo = session.repo as string;
  const data = sessionReviewData(session);
  const { base, head, diff, files: fullFiles } = data;
  const reviewState = reviewStateSummary(
    repo,
    base,
    head,
    diff,
    fullFiles,
    data.changeFingerprint,
  );
  const reviewMode = params.get('review') === 'since' && reviewState.compareFrom ? 'since' : 'full';
  const reviewFrom = reviewMode === 'since'
    ? params.get('from') || reviewState.compareFrom?.id
    : undefined;
  const files = reviewMode === 'since'
    ? parseUnifiedDiff(diffSinceReview(repo, base, head, fullFiles, reviewFrom))
    : fullFiles;
  const fromSnapshotDigest = reviewMode === 'since'
    ? reviewState.snapshots.find((snapshot) => snapshot.id === reviewFrom)?.contentDigest
    : undefined;
  const tour: Tour = { version: 1, title: '', summary: '', steps: [], base };
  const pageLease = issueReviewPageLease(session, {
    repo,
    base,
    ...(head ? { head } : {}),
    fingerprint: data.changeFingerprint,
    scopeKey: reviewState.scopeKey,
    mode: reviewMode,
    ...(reviewFrom ? { from: reviewFrom } : {}),
    ...(fromSnapshotDigest ? { fromSnapshotDigest } : {}),
    storyIdentity: reviewStoryIdentity(session, tour, true),
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
    reviewMode,
    reviewFrom,
    reviewPageToken: pageLease.token,
    stagedWorktreeDivergentFiles: stagedWorktreeDivergentFiles(repo, base, head),
    excludedFiles: excludedReviewFiles(repo, base, head),
  });
}

/** The recents list, each entry enriched with its current repo state for the picker. */
function listRecentRepos(home: string) {
  return loadRecents(home).map((e) => ({ ...inspectRepo(e.path), lastOpened: e.lastOpened }));
}

interface ReviewData {
  tour: Tour;
  base: string;
  head?: string;
  diff: string;
  files: DiffFile[];
  changeFingerprint: string;
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

function loadReview(session: Session): Omit<ReviewData, 'changeFingerprint'> {
  if (!session.repo) throw new Error('No repo is open.');
  const repo = session.repo;
  const tour = loadTour(selectedStoryPath(session));
  const { base, head, diff } = reviewDiff(repo, session, tour);
  const files = parseUnifiedDiff(diff);
  return { tour, base, head, diff, files };
}

function renderReview(session: Session, params = new URLSearchParams()): string {
  const repo = session.repo as string;
  const data = sessionReviewData(session, true);
  const { tour, base, head, files: fullFiles, diff } = data;
  const reviewState = reviewStateSummary(
    repo,
    base,
    head,
    diff,
    fullFiles,
    data.changeFingerprint,
  );
  const reviewMode = params.get('review') === 'since' && reviewState.compareFrom ? 'since' : 'full';
  const reviewFrom = reviewMode === 'since'
    ? params.get('from') || reviewState.compareFrom?.id
    : undefined;
  const files = reviewMode === 'since'
    ? parseUnifiedDiff(diffSinceReview(repo, base, head, fullFiles, reviewFrom))
    : fullFiles;
  const fromSnapshotDigest = reviewMode === 'since'
    ? reviewState.snapshots.find((snapshot) => snapshot.id === reviewFrom)?.contentDigest
    : undefined;
  const storyFreshness = !tour.diffFingerprint
    ? 'unverified'
    : diffFingerprint(diff) === tour.diffFingerprint
      ? 'current'
      : 'stale';
  const pageLease = issueReviewPageLease(session, {
    repo,
    base,
    ...(head ? { head } : {}),
    fingerprint: data.changeFingerprint,
    scopeKey: reviewState.scopeKey,
    mode: reviewMode,
    ...(reviewFrom ? { from: reviewFrom } : {}),
    ...(fromSnapshotDigest ? { fromSnapshotDigest } : {}),
    storyIdentity: reviewStoryIdentity(session, tour, false),
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
    reviewMode,
    reviewFrom,
    reviewPageToken: pageLease.token,
    storyFreshness,
    stagedWorktreeDivergentFiles: stagedWorktreeDivergentFiles(repo, base, head),
    excludedFiles: excludedReviewFiles(repo, base, head),
  });
}

function readSessionReviewData(session: Session, requireSelectedStory = false): Omit<ReviewData, 'changeFingerprint'> {
  if (!session.repo) throw new Error('No repo is open.');
  if (session.selectedStory !== null) {
    try {
      return loadReview(session);
    } catch (error) {
      if (requireSelectedStory) throw error;
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
function sessionReviewData(session: Session, requireSelectedStory = false): ReviewData {
  if (!session.repo) throw new Error('No repo is open.');
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

interface LeasedReviewPage {
  ok: true;
  lease: ReviewPageLease;
  repo: string;
  tour: Tour;
  base: string;
  head?: string;
  diff: string;
  /** Complete scope files used for identity and exclusions. */
  fullFiles: DiffFile[];
  /** Exact file diff presented by this page (full or since-feedback). */
  files: DiffFile[];
  storyless: boolean;
}

type ReviewPageLeaseResult = LeasedReviewPage | { ok: false; error: string };

function reviewStoryIdentity(session: Session, tour: Tour, storyless: boolean): string {
  if (storyless) return 'storyless';
  return diffFingerprint(`${selectedStoryPath(session)}\0${JSON.stringify(tour)}`);
}

/**
 * Resolve an opaque page token and re-check every piece of review identity
 * against one stable live read. The stored mode/from marker is authoritative;
 * lazy callers cannot promote a since-feedback page into the full diff.
 */
function validateReviewPageLease(session: Session, token: string | null): ReviewPageLeaseResult {
  const lease = getReviewPageLease(session, token ?? undefined);
  if (!lease) return { ok: false, error: 'This review page is no longer active.' };
  if (!session.repo || session.repo !== lease.repo) {
    return { ok: false, error: 'The repository changed after this review page loaded.' };
  }

  const storyless = lease.storyIdentity === 'storyless';
  if (storyless !== (session.selectedStory === null)) {
    return { ok: false, error: 'The selected review story changed after this page loaded.' };
  }

  let data: ReviewData;
  try {
    data = sessionReviewData(session, !storyless);
  } catch (error) {
    return {
      ok: false,
      error: storyless
        ? 'The review evidence moved while this page was open.'
        : `The selected story cannot be validated: ${(error as Error).message}`,
    };
  }
  const reviewState = reviewStateSummary(
    lease.repo,
    data.base,
    data.head,
    data.diff,
    data.files,
    data.changeFingerprint,
  );
  if (
    data.base !== lease.base ||
    (data.head ?? '') !== (lease.head ?? '') ||
    reviewState.scopeKey !== lease.scopeKey
  ) {
    return { ok: false, error: 'The review scope changed after this page loaded.' };
  }
  if (data.changeFingerprint !== lease.fingerprint) {
    return { ok: false, error: 'The change moved after this review page loaded.' };
  }
  if (reviewStoryIdentity(session, data.tour, storyless) !== lease.storyIdentity) {
    return { ok: false, error: 'The guided review changed after this page loaded.' };
  }
  if (lease.mode === 'since') {
    const snapshot = lease.from
      ? reviewState.snapshots.find((candidate) => candidate.id === lease.from)
      : undefined;
    if (!snapshot || !lease.fromSnapshotDigest) {
      return { ok: false, error: 'The since-feedback comparison is no longer available.' };
    }
    if (snapshot.contentDigest !== lease.fromSnapshotDigest) {
      return { ok: false, error: 'The since-feedback checkpoint changed after this page loaded.' };
    }
  }

  const files = lease.mode === 'since'
    ? parseUnifiedDiff(diffSinceReview(lease.repo, data.base, data.head, data.files, lease.from))
    : data.files;
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

function sendReviewPageConflict(res: ServerResponse, detail: string): void {
  sendJson(res, 409, {
    error: `Reload required: ${detail}`,
    detail,
    reloadRequired: true,
  });
}

/** Re-check after synchronous rendering to close the external working-tree race. */
function sendLeasedHtml(
  res: ServerResponse,
  session: Session,
  page: LeasedReviewPage,
  html: string,
): void {
  const confirmed = validateReviewPageLease(session, page.lease.token);
  if (!confirmed.ok) return sendReviewPageConflict(res, confirmed.error);
  sendHtml(res, html);
}

function captureSessionReview(
  session: Session,
  reason: ReviewSnapshotReason,
  commentIds?: string[],
) {
  const repo = session.repo as string;
  const data = sessionReviewData(session);
  return captureReviewSnapshot(repo, {
    base: data.base,
    head: data.head,
    diff: data.diff,
    changeFingerprint: data.changeFingerprint,
    files: data.files,
    reason,
    commentIds,
  });
}

function recordSessionEvent(
  session: Session,
  kind: ReviewEventKind,
  label: string,
  detail?: string,
  affectsApproval = false,
): void {
  if (!session.repo) return;
  const data = sessionReviewData(session);
  recordReviewEvent(session.repo, data.base, data.head, {
    kind,
    label,
    ...(detail ? { detail } : {}),
    ...(affectsApproval ? { affectsApproval: true } : {}),
  });
}

function isBlockingComment(comment: Comment): boolean {
  return comment.severity === 'blocking' || (!comment.severity && comment.type === 'change');
}

/** The lazily-loaded "Full file" side-by-side view for one file. Works with or
 *  without a story: story-less, there's no coverage to flag, so it's just the
 *  diff reconstructed against the working tree. */
function renderFullFileResponse(page: LeasedReviewPage, file: string): string {
  if (!file) return `<div class="ds-diffnote">No file requested.</div>`;
  const { repo, tour, head, files, storyless } = page;
  const allowed = new Set<string>([
    ...files.map((f) => f.newPath),
    ...(storyless ? [] : tour.steps.filter(isCodeStep).map((s) => s.file)),
  ]);
  if (!allowed.has(file)) return `<div class="ds-diffnote">That file isn't part of this change.</div>`;

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
function renderSplitResponse(page: LeasedReviewPage, file: string): string {
  if (!file) return `<div class="ds-diffnote">No file requested.</div>`;
  const { tour, files, storyless } = page;
  const allowed = new Set<string>([
    ...files.map((f) => f.newPath),
    ...(storyless ? [] : tour.steps.filter(isCodeStep).map((s) => s.file)),
  ]);
  if (!allowed.has(file)) return `<div class="ds-diffnote">That file isn't part of this change.</div>`;

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
function renderFilePanelResponse(page: LeasedReviewPage, file: string): string {
  if (!file) return `<div class="ds-diffnote">No file requested.</div>`;
  const { repo, tour, files, head, storyless } = page;
  const model = buildReviewModel(repo, tour, files, head, { storyless });
  const view = model.files.find((candidate) => candidate.file === file);
  if (!view) return `<div class="ds-diffnote">That file isn't part of this change.</div>`;
  const stepIndexById = new Map(model.steps.map((step, index) => [step.id, index + 1]));
  return renderFilePanelContent(view, stepIndexById);
}

/** Render a single guided-review step on demand. The index is the 1-based
 * panel index used by the client (Overview is panel 0). */
function renderStoryStepResponse(page: LeasedReviewPage, rawIndex: string): string {
  if (page.storyless) return `<div class="ds-diffnote">No guided story is selected.</div>`;
  const index = Number.parseInt(rawIndex, 10);
  if (!Number.isInteger(index) || index < 1) {
    return `<div class="ds-diffnote">No valid story step requested.</div>`;
  }
  const { repo, tour, files, head } = page;
  const model = buildReviewModel(repo, tour, files, head, { storyless: false });
  return renderStoryStepPanel(repo, model, loadComments(repo), index - 1);
}

function renderExcludedFileResponse(page: LeasedReviewPage, file: string): string {
  if (!file) return `<div class="ds-diffnote">No file requested.</div>`;
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
  if (!lines) return `<div class="ds-diffnote">This binary or missing file cannot be previewed as text.</div>`;
  const limit = 500;
  const shown = lines.slice(0, limit);
  const rows = shown.map((line, index) => `<span><i>${index + 1}</i><code>${esc(line) || ' '}</code></span>`).join('');
  return `<div class="ds-excluded-file-head"><strong>${side}</strong><span>This is a text preview, not story coverage or a before/after diff.</span></div><pre class="ds-excluded-code">${rows}</pre>${lines.length > limit ? `<div class="ds-diffnote">Showing the first ${limit} of ${lines.length} lines.</div>` : ''}`;
}

/** Context rows for expand-a-hunk-gap: ctx rows of the reconstructed full
 *  file, clamped to [from, to] new-file line numbers. */
function renderContextResponse(page: LeasedReviewPage, params: URLSearchParams): string {
  const { repo, tour, files, head, storyless } = page;
  const file = params.get('file') ?? '';
  if (!file) return `<div class="ds-diffnote">No file requested.</div>`;
  const from = Math.max(1, parseInt(params.get('from') ?? '1', 10) || 1);
  const toRaw = params.get('to') ?? 'eof';
  const to = toRaw === 'eof' ? Number.MAX_SAFE_INTEGER : parseInt(toRaw, 10) || 0;
  const layout = params.get('layout') === 'split' ? ('split' as const) : ('unified' as const);
  if (to < from) return `<div data-ctx-rows data-from="0" data-to="0"></div>`;

  // Mirror renderFullFileResponse exactly: context-only story files are valid,
  // but a since-feedback page can only expand files from its issued model.
  const allowed = new Set<string>([
    ...files.map((f) => f.newPath),
    ...(storyless ? [] : tour.steps.filter(isCodeStep).map((s) => s.file)),
  ]);
  if (!allowed.has(file)) return `<div class="ds-diffnote">That file isn't part of this change.</div>`;
  const df = files.find((f) => f.newPath === file);
  const newLines = readWholeFile(repo, file, head) ?? [];
  if (!newLines.length) return `<div class="ds-diffnote">Couldn't read ${esc(file)} from the working tree.</div>`;
  // Clamp to the real file length: ranges past EOF must serve fewer rows,
  // never invented ones. Defense-in-depth — the parser now bounds hunks by
  // their header counts, so it no longer leaks a phantom row past EOF.
  const last = newLines.length;
  const rows = buildFullFileRows(df, newLines, []).filter(
    (r) => r.type === 'ctx' && r.newNo !== undefined && r.newNo >= from && r.newNo <= to && r.newNo <= last,
  );
  return renderContextRows(rows, layout, { file, oldFile: df?.oldPath, newFile: df?.status === 'added' });
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

function nowMs(): number {
  return Date.now();
}

function agentFailureEvent(r: StreamResult): ProgressEvent {
  const stage = r.failure === 'startup' ? 'startup' : 'execution';
  const summary = summarizeAgentFailure(r.output, stage);
  return errorEvent(stage, summary.label, summary.detail, summary.technicalDetail);
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
  previousStoryContents?: string | null,
  requireModernStory = true,
): { status: RunStatus; result: Record<string, unknown>; events: ProgressEvent[] } {
  const currentStoryContents = existsSync(storyPath) ? readFileSync(storyPath, 'utf8') : null;
  const storyWritten = currentStoryContents !== null && (
    previousStoryContents === undefined ||
    previousStoryContents === null ||
    currentStoryContents !== previousStoryContents
  );
  const events: ProgressEvent[] = [];
  let status: RunStatus = 'complete';
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
    } catch (e) {
      events.push(errorEvent(
        'validation',
        'The story did not pass its final check',
        'The agent wrote a story, but diffStory cannot safely open it yet. Try again or change the story settings.',
        (e as Error).message,
      ));
      status = 'failed';
      return { status, result: { storyWritten, storyValid: false }, events };
    }
  }
  if (r.failure === 'startup') {
    events.push(agentFailureEvent(r));
    status = 'failed';
  } else if (!r.ok) {
    events.push(agentFailureEvent(r));
    status = 'failed';
  } else {
    events.push(errorEvent(
      'output_missing',
      'The agent finished without a story',
      'No .diffstory/story.json was created. Try again, or open technical details to see what the agent returned.',
    ));
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

/**
 * Hand an existing task to its live Desktop owner. This deliberately has no
 * `codex exec resume` fallback: that creates a parallel stored turn which the
 * selected ChatGPT task does not render as its normal conversation.
 */
function sendAddressToCodexDesktop(
  res: ServerResponse,
  context: RunContext,
  title: string,
  threadId: string,
  prompt: string,
): void {
  agentBusy = true;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  let seq = 0;
  const send = (event: ProgressEvent) => {
    if (!res.destroyed) res.write(`${JSON.stringify({ seq: seq++, ...event })}\n`);
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
      send(errorEvent(
        'execution',
        'Could not reach the selected task in ChatGPT',
        error instanceof Error ? error.message : String(error),
      ));
      send(doneEvent('failed', { codexThreadId: threadId, messageSent: false }));
    })
    .finally(() => {
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
  let input: {
    commentIds?: string[];
    all?: boolean;
    agent?: string;
    codexThreadId?: unknown;
    codexTaskLabel?: unknown;
    newCodexTask?: unknown;
  };
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

  const agents = availableAgents();
  const pre = agentPreflight({ repo: session.repo, busy: agentBusy, agents });
  if (!pre.ok) return sendJson(res, pre.status, errorEvent(pre.stage, pre.label, pre.detail));
  const selected = selectAvailableAgent(input.agent, agents, pre.agent);
  if (!selected.ok) return sendJson(res, selected.status, errorEvent(selected.stage, selected.label, selected.detail));
  const agent = selected.agent;
  const codexThreadId = validCodexThreadId(input.codexThreadId) ? input.codexThreadId : undefined;
  const codexTaskLabel = typeof input.codexTaskLabel === 'string'
    ? input.codexTaskLabel.replace(/\s+/g, ' ').trim().slice(0, 100)
    : undefined;
  if (agent === 'codex' && input.codexThreadId !== undefined && !codexThreadId) {
    return sendJson(res, 400, errorEvent('preflight', 'Invalid Codex task', 'Choose a Codex task from the task picker.'));
  }
  const useNewCodexTask = agent === 'codex' && input.newCodexTask === true;
  const agentOptions: AgentRunOptions | undefined = useNewCodexTask
    ? { codex: { binary: codexTaskBinary(), json: true } }
    : undefined;
  const repo = session.repo as string;

  const feedback = loadCommentsWithHealth(repo);
  if (feedback.health.status === 'invalid') {
    return sendJson(res, 409, {
      ...errorEvent(
        'preflight',
        'Feedback file needs repair',
        `${feedback.health.message} ${feedback.health.recovery}`,
      ),
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
  const title =
    target === 'all'
      ? `Addressing ${targetCount} open ${targetCount === 1 ? 'comment' : 'comments'}`
      : `Addressing ${targetCount} ${targetCount === 1 ? 'comment' : 'comments'}`;

  const before = currentDiff(session);
  captureSessionReview(session, 'feedback-sent', targetIds);
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
  const runContext: RunContext = {
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
      const events: ProgressEvent[] = [];
      let status: RunStatus = 'complete';
      if (r.failure === 'startup') {
        events.push(agentFailureEvent(r));
        status = 'failed';
      } else if (!r.ok) {
        events.push(agentFailureEvent(r));
        status = 'failed';
      } else if (!resumedCodexTaskMatches(codexThreadId, r.threadId)) {
        events.push(errorEvent(
          'execution',
          'Codex did not resume the selected task',
          r.threadId
            ? 'Codex connected to a different task. Re-select the intended task and try again.'
            : 'Codex did not confirm the selected task id. Re-select the intended task and try again.',
          `Expected ${codexThreadId}; received ${r.threadId || 'no task id'}.`,
        ));
        status = 'failed';
      } else if (!codeChanged && !addressCtx.historical) {
        events.push(warningEvent('No files changed', 'The agent answered without editing code.'));
      }
      if (status === 'complete') captureSessionReview(session, 'agent-complete');
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
export function postRenamePath(path: string): string {
  if (!path.includes(' => ')) return path;
  if (path.includes('{')) {
    return path.replace(/\{[^{}]*? => ([^{}]*?)\}/g, '$1').replace(/\/{2,}/g, '/');
  }
  return path.slice(path.indexOf(' => ') + 4);
}

type ScopeResult =
  | { ok: true; scope?: StoryScope }
  | { ok: false; detail: string };
type NoteResult =
  | { ok: true; note?: string }
  | { ok: false; detail: string };
type IncludedFilesResult =
  | { ok: true; included: string[] }
  | { ok: false; detail: string };

function normalizeReviewerNote(value: unknown): NoteResult {
  if (value === undefined || value === null) return { ok: true };
  if (typeof value !== 'string') return { ok: false, detail: 'Story guidance must be text.' };
  const note = value.trim();
  return { ok: true, ...(note ? { note: note.slice(0, 4000) } : {}) };
}

function normalizeIncludedFiles(value: unknown, changedFiles: string[]): IncludedFilesResult {
  if (value === undefined || value === null) return { ok: true, included: changedFiles };
  if (!Array.isArray(value)) return { ok: false, detail: 'Selected story files must be an array.' };
  const requested = [...new Set(value.map((v) => (typeof v === 'string' ? v.trim() : '')))].filter(Boolean);
  if (!requested.length) return { ok: false, detail: 'Pick at least one file for the story.' };
  const changed = new Set(changedFiles);
  const unknown = requested.filter((p) => !changed.has(p));
  if (unknown.length) {
    return { ok: false, detail: `Selected file is not part of this change: ${unknown[0]}` };
  }
  const requestedSet = new Set(requested);
  return { ok: true, included: changedFiles.filter((p) => requestedSet.has(p)) };
}

function storyScopeFromInput(input: { includedFiles?: unknown; reviewerNote?: unknown }, changedFiles: string[]): ScopeResult {
  const note = normalizeReviewerNote(input.reviewerNote);
  if (!note.ok) return note;
  const files = normalizeIncludedFiles(input.includedFiles, changedFiles);
  if (!files.ok) return files;
  const included = files.included;
  const excluded = changedFiles.filter((p) => !included.includes(p));
  if (!excluded.length && !note.note) return { ok: true };
  return {
    ok: true,
    scope: {
      includedFiles: included,
      ...(excluded.length ? { excludedFiles: excluded } : {}),
      ...(note.note ? { reviewerNote: note.note } : {}),
    },
  };
}

function stampStoryMetadata(storyPath: string, fingerprint: string, scope?: StoryScope): void {
  if (!existsSync(storyPath)) return;
  try {
    const parsed = JSON.parse(readFileSync(storyPath, 'utf8')) as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return;
    parsed.diffFingerprint = fingerprint;
    if (scope) parsed.storyScope = scope;
    writeFileSync(storyPath, `${JSON.stringify(parsed, null, 2)}\n`);
  } catch {
    // Validation will report malformed or missing stories in the normal finish path.
  }
}

function runStoryRepair(res: ServerResponse, session: Session, body: string): void {
  let input: { action?: string; file?: string; line?: number; stepId?: string; agent?: string } = {};
  try {
    input = JSON.parse(body || '{}');
  } catch {
    return sendJson(res, 400, errorEvent('preflight', 'Invalid request', 'The request body was not valid JSON.'));
  }
  const action = input.action as StoryRepairAction;
  if (!(['explain', 'shorten', 'split'] as StoryRepairAction[]).includes(action)) {
    return sendJson(res, 400, errorEvent('preflight', 'Invalid story repair', 'Choose explain, shorten, or split.'));
  }
  const agents = availableAgents();
  const pre = agentPreflight({ repo: session.repo, busy: agentBusy, agents });
  if (!pre.ok) return sendJson(res, pre.status, errorEvent(pre.stage, pre.label, pre.detail));
  const selected = selectAvailableAgent(input.agent, agents, pre.agent);
  if (!selected.ok) return sendJson(res, selected.status, errorEvent(selected.stage, selected.label, selected.detail));
  const repo = session.repo as string;
  const storyPath = selectedStoryPath(session);
  if (!existsSync(storyPath)) {
    return sendJson(res, 404, errorEvent('preflight', 'No story to repair', 'Generate a story before tuning a step.'));
  }
  let storyWasModern = false;
  try {
    storyWasModern = validateGeneratedTour(loadTour(storyPath)).length === 0;
  } catch (e) {
    return sendJson(res, 400, errorEvent('validation', 'The current story is invalid', (e as Error).message));
  }
  const storyBefore = readFileSync(storyPath, 'utf8');
  const data = sessionReviewData(session);
  const title = action === 'explain' ? 'Explaining an uncovered change' : action === 'shorten' ? 'Shortening a story step' : 'Splitting a story step';
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
      if (finished.status === 'complete') captureSessionReview(session, 'story-repaired');
      return finished;
    },
    fileScope: { repoPath: repo, changedFiles: data.files.map((file) => file.newPath) },
  });
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
    includedFiles?: unknown;
    reviewerNote?: unknown;
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
      ? 'Generating compact story'
      : mode === 'detailed'
        ? 'Generating deep review'
        : 'Generating guided review';
  const repo = session.repo as string;

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
      const storyChanged = existsSync(storyPath) && (
        storyBefore === null || readFileSync(storyPath, 'utf8') !== storyBefore
      );
      if (r.ok && storyChanged) {
        stampStoryMetadata(
          storyPath,
          diffFingerprint(getDiff(repo, promptBase, promptHead)),
          storyScope.scope,
        );
      }
      return finishStoryGeneration(r, storyPath, session, storyBefore);
    },
    fileScope: { repoPath: repo, changedFiles },
  });
}

function readBody(req: IncomingMessage, res: ServerResponse, done: (body: string) => void): void {
  let data = '';
  let size = 0;
  let tooLarge = false;
  req.on('data', (chunk) => {
    if (tooLarge) return;
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
    if (!tooLarge) done(data);
  });
}

function runLocalSay(res: ServerResponse, body: string, home: string): void {
  let input: { text?: string; voice?: string; preset?: string; rate?: number };
  try {
    input = JSON.parse(body || '{}');
  } catch {
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
      if (abort.signal.aborted || res.destroyed) return;
      sendJson(res, 400, { error: (err as Error).message });
    });
}

function runLocalKokoro(res: ServerResponse, body: string, home: string): void {
  let input: { text?: string; voice?: string; rate?: number };
  try {
    input = JSON.parse(body || '{}');
  } catch {
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

function sendLocalSayAudio(res: ServerResponse, file: string, home: string): void {
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

function sendLocalKokoroAudio(res: ServerResponse, file: string, home: string): void {
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

function sendMermaidBrowserAsset(res: ServerResponse): void {
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
