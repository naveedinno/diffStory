import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import * as vscode from 'vscode';
import { changedFiles, excludedReviewFiles, isGitRepository, latestCommitComparison, resolveBase, resolveReviewRevision, reviewChangeFingerprint, reviewDiff, reviewRefs, showFile, stagedWorktreeDivergentFiles, type ChangedFile, type ReviewExclusion, type ReviewRef } from './git';
import { appendReviewerFollowUp, commentSeverity, createComment, deleteComment, loadComments, loadCommentsWithHealth, rangeFor, saveComments, setCommentStatus } from './comments';
import { isCodeStep, isLineRange, type CodeTourStep, type CommentSeverity, type CommentStatus, type ConceptTourStep, type ReviewComment, type Tour, type TourStep } from './model';
import { deleteStory, listStories, loadStory, stampStoryFingerprint, type StorySummary } from './stories';
import { availableAgents, addressPrompt, repairPrompt, startAgent, storyPrompt, type AgentName, type AgentRun } from './agent';
import { captureReview, markReviewFileSeen, recordReviewEvent, recordReviewVerdict, reviewChangesSinceFeedback, reviewCursor, reviewHistory, reviewSeenFiles, reviewSummary, saveReviewCursor, type ReviewCursor, type ReviewHistoryEntry, type ReviewSummary } from './review-state';
import { isReviewScope, scopeLabel, type ReviewScope } from './scope';
import { renderDiffStoryWebview, type DiffStoryMode, type DiffStoryScreen, type RepositoryListItem } from './webview';
import { classifyGuide, diffFingerprint, type GuideStatus } from './guide';
import { computeStoryClaimCoverage, type StoryClaimCoverage } from './coverage';

const GIT_CONTENT_SCHEME = 'diffstory-git';
const REVIEW_CONTENT_SCHEME = 'diffstory-review';

interface VirtualDocument {
  repo: string;
  ref: string;
  file: string;
}

interface SourceDocument {
  repo: vscode.Uri;
  file: string;
  side: 'left' | 'right';
}

class DiffStoryController implements vscode.WebviewViewProvider, vscode.TextDocumentContentProvider, vscode.Disposable {
  readonly viewType = 'diffstory.review';
  private readonly disposables: vscode.Disposable[] = [];
  private readonly sources = new Map<string, SourceDocument>();
  private readonly reviewDocuments = new Map<string, string>();
  private reviewDocumentId = 0;
  private readonly commentController = vscode.comments.createCommentController('diffstory', 'DiffStory');
  private readonly highlight = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
    border: '1px solid',
    borderColor: new vscode.ThemeColor('editor.findMatchBorder'),
    overviewRulerColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
    overviewRulerLane: vscode.OverviewRulerLane.Center,
  });
  private view: vscode.WebviewView | undefined;
  private story: Tour | undefined;
  private storyId = 'story.json';
  private stories: StorySummary[] = [];
  private review: ReviewSummary = emptyReviewSummary();
  private cursor: ReviewCursor | undefined;
  private manualScope: ReviewScope | undefined;
  private scopeWorkspace: string | undefined;
  private activeScopeLabel = 'Automatic scope';
  private activeScopeBase = 'HEAD';
  private activeScopeHead: string | undefined;
  private changed: ChangedFile[] = [];
  private exclusions: ReviewExclusion[] = [];
  private indexDivergence: string[] = [];
  private storyFiles: string[] | undefined;
  private seenFiles = new Set<string>();
  private progress: string[] = [];
  private agentRun: AgentRun | undefined;
  private commentThreads: vscode.CommentThread[] = [];
  private comments: ReviewComment[] = [];
  private repo: vscode.Uri | undefined;
  private loading = false;
  private refreshError: string | undefined;
  private refreshRun: Promise<void> | undefined;
  private initialMode: DiffStoryMode = 'changes';
  private screen: DiffStoryScreen = 'review';
  private showWelcome = true;
  private agents: AgentName[] = [];
  private repositories: RepositoryListItem[] = [];
  private history: ReviewHistoryEntry[] = [];
  private comparisonRefs: ReviewRef[] = [];
  private guideStatus: GuideStatus | undefined;
  private storyCoverage: StoryClaimCoverage | undefined;

  constructor(private readonly workspaceState: vscode.Memento, private readonly globalState: vscode.Memento) {
    this.disposables.push(
      vscode.workspace.registerTextDocumentContentProvider(GIT_CONTENT_SCHEME, this),
      vscode.workspace.registerTextDocumentContentProvider(REVIEW_CONTENT_SCHEME, this),
      vscode.window.registerWebviewViewProvider(this.viewType, this, { webviewOptions: { retainContextWhenHidden: true } }),
      vscode.commands.registerCommand('diffstory.openReview', () => this.openReview()),
      vscode.commands.registerCommand('diffstory.refresh', () => this.refresh()),
      vscode.commands.registerCommand('diffstory.openStep', (step?: TourStep) => this.openStep(step)),
      vscode.commands.registerCommand('diffstory.openChangedFile', () => this.openChangedFile()),
      vscode.commands.registerCommand('diffstory.addComment', () => this.addComment()),
      vscode.commands.registerCommand('diffstory.resolveComment', () => this.resolveComment()),
      vscode.commands.registerCommand('diffstory.reopenComment', () => this.reopenComment()),
      vscode.commands.registerCommand('diffstory.deleteComment', () => this.deleteCommentInteractive()),
      vscode.commands.registerCommand('diffstory.approveReview', () => this.recordVerdict('approved')),
      vscode.commands.registerCommand('diffstory.requestChanges', () => this.recordVerdict('changes-requested')),
      vscode.commands.registerCommand('diffstory.openRepositories', () => this.openScreen('repositories')),
      vscode.commands.registerCommand('diffstory.openHistory', () => this.openScreen('history')),
      vscode.commands.registerCommand('diffstory.changeScope', () => this.changeScope()),
      vscode.commands.registerCommand('diffstory.resumeReview', () => this.resumeReview()),
      vscode.commands.registerCommand('diffstory.openSinceFeedback', () => this.openSinceFeedback()),
      vscode.commands.registerCommand('diffstory.chooseStoryFiles', () => this.chooseStoryFiles()),
      vscode.commands.registerCommand('diffstory.openNextUnseenFile', () => this.openNextUnseenFile()),
      vscode.commands.registerCommand('diffstory.generateStory', () => this.runGenerateInteractive()),
      vscode.commands.registerCommand('diffstory.addressFeedback', () => this.runAddressInteractive()),
      vscode.commands.registerCommand('diffstory.repairStoryStep', () => this.runRepairInteractive()),
      vscode.commands.registerCommand('diffstory.storyActions', () => this.showStoryActions()),
      vscode.commands.registerCommand('diffstory.stopAgent', () => this.agentRun?.stop()),
      vscode.commands.registerCommand('diffstory.openGettingStarted', () => vscode.commands.executeCommand('workbench.action.openWalkthrough', 'naveedinno.diffstory-vscode#diffstory.gettingStarted', false)),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh()),
    );
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.onDidReceiveMessage((message: unknown) => this.handleViewMessage(message));
    void this.refresh();
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    if (uri.scheme === REVIEW_CONTENT_SCHEME) return this.reviewDocuments.get(uri.toString()) ?? '';
    const source = decodeVirtualDocument(uri);
    if (!source) return 'Unable to read DiffStory virtual document.';
    const content = await showFile(vscode.Uri.file(source.repo), source.ref, source.file);
    return content ?? '';
  }

  async openReview(): Promise<void> {
    this.initialMode = 'changes';
    this.screen = 'review';
    await vscode.commands.executeCommand(`${this.viewType}.focus`);
    await this.refresh();
  }

  async refresh(): Promise<void> {
    if (this.refreshRun) return this.refreshRun;
    const run = this.performRefresh();
    this.refreshRun = run;
    try {
      await run;
    } finally {
      if (this.refreshRun === run) this.refreshRun = undefined;
    }
  }

  private async performRefresh(): Promise<void> {
    this.loading = true;
    this.refreshError = undefined;
    this.guideStatus = undefined;
    this.updateView(this.repo);
    try {
      const repo = await this.workspaceRoot(false);
      this.repo = repo;
      this.agents = availableAgents();
      if (repo) await this.restoreScope(repo);
      this.showWelcome = repo ? !this.workspaceState.get<boolean>(`diffstory.welcome.v070:${repo.fsPath}`) : true;
      this.stories = repo ? await listStories(repo) : [];
      const selected = this.stories.find((story) => story.id === this.storyId) ?? this.stories[0];
      this.storyId = selected?.id ?? 'story.json';
      this.story = selected?.story;
      if (repo) {
        const scope = await this.currentScope(repo);
        this.activeScopeLabel = scope.label;
        this.activeScopeBase = scope.base;
        this.activeScopeHead = scope.head;
        const files = await changedFiles(repo, scope.base, scope.head);
        this.changed = files;
        this.exclusions = await excludedReviewFiles(repo, scope.base, scope.head);
        this.indexDivergence = await stagedWorktreeDivergentFiles(repo, scope.base, scope.head);
        const diff = await reviewDiff(repo, scope.base, scope.head);
        const changeFingerprint = await reviewChangeFingerprint(repo, scope.base, scope.head);
        this.guideStatus = this.story ? await this.inspectGuide(repo, scope, diff) : undefined;
        this.storyCoverage = this.story ? computeStoryClaimCoverage(this.story, diff) : undefined;
        await captureReview(repo, { base: scope.base, head: scope.head, diff, changeFingerprint, files: files.map((file) => file.path), reason: 'opened' });
        this.review = await reviewSummary(repo, { base: scope.base, head: scope.head, diff, changeFingerprint, files: files.map((file) => file.path) });
        [this.history, this.comparisonRefs] = await Promise.all([reviewHistory(repo), reviewRefs(repo)]);
        this.seenFiles = new Set(await reviewSeenFiles(repo, scope.base, scope.head));
        this.cursor = this.story ? await reviewCursor(repo, scope.base, scope.head, this.storyId) : undefined;
      } else {
        this.review = emptyReviewSummary();
        this.cursor = undefined;
        this.activeScopeLabel = 'Automatic scope';
        this.activeScopeBase = 'HEAD';
        this.activeScopeHead = undefined;
        this.changed = [];
        this.exclusions = [];
        this.indexDivergence = [];
        this.seenFiles.clear();
        this.guideStatus = undefined;
        this.storyCoverage = undefined;
        this.history = [];
        this.comparisonRefs = [];
      }
      this.repositories = await this.repositoryList();
      this.comments = repo ? (await loadCommentsWithHealth(repo)).comments : [];
      await this.refreshCommentThreads(repo, this.comments);
    } catch (error) {
      this.refreshError = error instanceof Error ? error.message : String(error);
    } finally {
      this.loading = false;
      this.updateView(this.repo);
    }
  }

  private async restoreScope(repo: vscode.Uri): Promise<void> {
    if (this.scopeWorkspace === repo.fsPath) return;
    this.scopeWorkspace = repo.fsPath;
    const stored = this.workspaceState.get<unknown>(`diffstory.scope:${repo.fsPath}`);
    this.manualScope = isReviewScope(stored) ? stored : undefined;
  }

  private async currentScope(repo: vscode.Uri): Promise<{ base: string; head?: string; label: string }> {
    const requested = this.manualScope?.base;
    const base = await resolveBase(repo, requested);
    const head = this.manualScope?.head;
    return { base, ...(head ? { head } : {}), label: this.manualScope?.label ?? scopeLabel(base, head) };
  }

  private async inspectGuide(
    repo: vscode.Uri,
    activeScope: { base: string; head?: string; label: string },
    activeDiff: string,
  ): Promise<GuideStatus> {
    const story = this.story;
    if (!story) return { state: 'unverified', activeScopeLabel: activeScope.label, canSwitchScope: false };
    let storyDiff: string | undefined;
    let storyScopeLabel: string | undefined;
    let canSwitchScope = false;
    if (story.base !== undefined || story.head !== undefined) {
      try {
        const base = await resolveBase(repo, story.base);
        if (story.base !== undefined && base !== story.base) throw new Error('The guide base no longer exists.');
        storyDiff = await reviewDiff(repo, base, story.head);
        storyScopeLabel = scopeLabel(base, story.head);
        canSwitchScope = true;
      } catch {
        // An unavailable ref makes the guide stale; regeneration is the only safe recovery.
      }
    }
    return classifyGuide({
      story,
      activeDiff,
      activeScopeLabel: activeScope.label,
      ...(storyDiff !== undefined ? { storyDiff } : {}),
      ...(storyScopeLabel ? { storyScopeLabel } : {}),
      canSwitchScope,
    });
  }

  private async ensureGuideCurrent(knownRepo?: vscode.Uri): Promise<boolean> {
    if (!this.story) return false;
    const repo = knownRepo ?? await this.workspaceRoot();
    if (!repo) return false;
    try {
      const scope = await this.currentScope(repo);
      this.guideStatus = await this.inspectGuide(repo, scope, await reviewDiff(repo, scope.base, scope.head));
      this.updateView(repo);
    } catch {
      this.guideStatus = { state: 'stale', activeScopeLabel: this.activeScopeLabel, canSwitchScope: false };
      this.updateView(repo);
    }
    if (this.guideStatus?.state === 'current') return true;
    const status = this.guideStatus?.state ?? 'unverified';
    const message = status === 'scope-mismatch'
      ? `This guide belongs to ${this.guideStatus?.storyScopeLabel ?? 'another comparison'}, not ${this.guideStatus?.activeScopeLabel ?? 'the active comparison'}.`
      : status === 'stale'
        ? 'The code changed after this guide was written, so its line targets may be wrong.'
        : 'This older guide has no exact diff fingerprint, so its line targets cannot be verified.';
    const actions = [
      ...(status === 'scope-mismatch' && this.guideStatus?.canSwitchScope ? ['Switch comparison'] : []),
      ...(this.agents.length ? ['Regenerate guide'] : []),
    ];
    const choice = await vscode.window.showWarningMessage(message, ...actions);
    if (choice === 'Switch comparison') await this.switchToGuideScope();
    if (choice === 'Regenerate guide') await this.runGenerateInteractive();
    return false;
  }

  private async switchToGuideScope(): Promise<void> {
    const repo = await this.workspaceRoot();
    if (!repo || !this.story || !this.guideStatus?.canSwitchScope) return;
    const base = await resolveBase(repo, this.story.base);
    if (this.story.base !== undefined && base !== this.story.base) {
      void vscode.window.showWarningMessage('The Git ref used by this guide no longer exists. Regenerate it for the current comparison.');
      return;
    }
    const scope: ReviewScope = { base, ...(this.story.head ? { head: this.story.head } : {}), label: scopeLabel(base, this.story.head) };
    this.manualScope = scope;
    this.storyFiles = undefined;
    await this.workspaceState.update(`diffstory.scope:${repo.fsPath}`, scope);
    await this.refresh();
  }

  private async handleViewMessage(message: unknown): Promise<void> {
    if (!message || typeof message !== 'object' || Array.isArray(message)) return;
    const event = message as {
      type?: unknown;
      stepId?: unknown;
      storyId?: unknown;
      file?: unknown;
      commentId?: unknown;
      decision?: unknown;
      screen?: unknown;
      path?: unknown;
      scopeKey?: unknown;
      preset?: unknown;
      base?: unknown;
      head?: unknown;
    };
    if (event.type === 'refresh') await this.refresh();
    if (event.type === 'openGettingStarted') await vscode.commands.executeCommand('workbench.action.openWalkthrough', 'naveedinno.diffstory-vscode#diffstory.gettingStarted', false);
    if (event.type === 'navigate' && isDiffStoryScreen(event.screen)) await this.navigate(event.screen);
    if (event.type === 'browseRepository') await this.browseRepository();
    if (event.type === 'selectRepository' && typeof event.path === 'string') await this.selectRepository(event.path);
    if (event.type === 'forgetRepository' && typeof event.path === 'string') await this.forgetRepository(event.path);
    if (event.type === 'resumeHistory' && typeof event.scopeKey === 'string') await this.resumeHistory(event.scopeKey);
    if (event.type === 'applyComparisonPreset' && isComparisonPreset(event.preset)) await this.applyComparisonPreset(event.preset);
    if (event.type === 'applyComparison' && typeof event.base === 'string' && (event.head === undefined || typeof event.head === 'string')) await this.applyComparison(event.base, event.head);
    if (event.type === 'switchToGuideScope') await this.switchToGuideScope();
    if (event.type === 'openChangedFile') await this.openChangedFile();
    if (event.type === 'openFile' && typeof event.file === 'string') await this.openFile(event.file);
    if (event.type === 'addComment') await this.addComment();
    if (event.type === 'openStep' && typeof event.stepId === 'string') {
      const step = this.story?.steps.find((candidate) => candidate.id === event.stepId);
      await this.openStep(step);
    }
    if (event.type === 'selectStory' && typeof event.storyId === 'string') {
      if (this.agentRun) return;
      this.storyId = event.storyId;
      await this.refresh();
    }
    if (event.type === 'changeScope') await this.changeScope();
    if (event.type === 'resumeReview') await this.resumeReview();
    if (event.type === 'nextStep') await this.moveStep(1);
    if (event.type === 'previousStep') await this.moveStep(-1);
    if (event.type === 'openNextUnseenFile') await this.openNextUnseenFile();
    if (event.type === 'browseGuide') await this.openStep();
    if (event.type === 'storyActions') await this.showStoryActions();
    if (event.type === 'generateInteractive') await this.runGenerateInteractive();
    if (event.type === 'addressInteractive') await this.runAddressInteractive();
    if (event.type === 'stopAgent') this.agentRun?.stop();
    if (event.type === 'openSinceFeedback') await this.openSinceFeedback();
    if (event.type === 'showComment' && typeof event.commentId === 'string') await this.showComment(event.commentId);
    if (event.type === 'resolveCommentId' && typeof event.commentId === 'string') await this.setCommentStatus(event.commentId, 'resolved');
    if (event.type === 'reopenCommentId' && typeof event.commentId === 'string') await this.setCommentStatus(event.commentId, 'open');
    if (event.type === 'followUpCommentId' && typeof event.commentId === 'string') await this.followUpComment(event.commentId);
    if (event.type === 'deleteCommentId' && typeof event.commentId === 'string') await this.deleteComment(event.commentId);
    if (event.type === 'recordVerdict' && (event.decision === 'approved' || event.decision === 'changes-requested')) await this.recordVerdict(event.decision);
  }

  private async openStep(step?: TourStep): Promise<void> {
    const repo = await this.workspaceRoot();
    if (!repo) return;
    if (!await this.ensureGuideCurrent(repo)) return;
    const selected = step ?? await this.pickStep();
    if (!selected) return;
    const scope = await this.currentScope(repo);
    if (isCodeStep(selected)) {
      await this.openNativeDiff(repo, selected.file, scope.base, scope.head, selected);
      await this.markFileSeen(repo, scope, selected.file);
    } else {
      await this.openConceptStep(selected);
    }
    await this.dismissWelcome(repo);
    await this.showFirstCommentHint(repo);
    if (this.story) {
      this.cursor = await saveReviewCursor(repo, { base: scope.base, head: scope.head, storyId: this.storyId, stepId: selected.id });
      this.updateView(repo);
    }
  }

  private async openChangedFile(): Promise<void> {
    const repo = await this.workspaceRoot();
    if (!repo) return;
    const scope = await this.currentScope(repo);
    const files = await changedFiles(repo, scope.base, scope.head);
    this.changed = files;
    if (!files.length) {
      void vscode.window.showInformationMessage('DiffStory found no changed files for this review scope.');
      return;
    }
    const choice = await vscode.window.showQuickPick(
      files.map((file) => ({ label: file.path, description: describeStatus(file.status), file })),
      { placeHolder: 'Open a changed file in VS Code’s diff editor' },
    );
    if (choice) {
      await this.openNativeDiff(repo, choice.file.path, scope.base, scope.head);
      await this.markFileSeen(repo, scope, choice.file.path);
      await this.dismissWelcome(repo);
      await this.showFirstCommentHint(repo);
    }
  }

  private async openFile(file: string): Promise<void> {
    const repo = await this.workspaceRoot();
    if (!repo) return;
    const scope = await this.currentScope(repo);
    const files = await changedFiles(repo, scope.base, scope.head);
    this.changed = files;
    const selected = files.find((candidate) => candidate.path === file);
    if (!selected) {
      void vscode.window.showWarningMessage('That file is no longer part of this review. Refreshing DiffStory.');
      await this.refresh();
      return;
    }
    await this.openNativeDiff(repo, selected.path, scope.base, scope.head);
    await this.markFileSeen(repo, scope, selected.path);
    await this.dismissWelcome(repo);
    await this.showFirstCommentHint(repo);
  }

  private async openNextUnseenFile(): Promise<void> {
    const repo = await this.workspaceRoot();
    if (!repo) return;
    const scope = await this.currentScope(repo);
    const files = await changedFiles(repo, scope.base, scope.head);
    this.changed = files;
    const next = files.find((file) => !this.seenFiles.has(file.path));
    if (!next) {
      void vscode.window.showInformationMessage('You have opened every changed file in this review scope.');
      return;
    }
    await this.openNativeDiff(repo, next.path, scope.base, scope.head);
    await this.markFileSeen(repo, scope, next.path);
    await this.dismissWelcome(repo);
    await this.showFirstCommentHint(repo);
  }

  private async dismissWelcome(repo: vscode.Uri): Promise<void> {
    if (!this.showWelcome) return;
    this.showWelcome = false;
    await this.workspaceState.update(`diffstory.welcome.v070:${repo.fsPath}`, true);
    this.updateView(repo);
  }

  private async showFirstCommentHint(repo: vscode.Uri): Promise<void> {
    const key = `diffstory.commentHint:${repo.fsPath}`;
    if (this.workspaceState.get<boolean>(key)) return;
    await this.workspaceState.update(key, true);
    void vscode.window.showInformationMessage('Select code in the diff, right-click, then choose “DiffStory: Add comment to selected code.”');
  }

  private async markFileSeen(repo: vscode.Uri, scope: { base: string; head?: string }, file: string): Promise<void> {
    this.seenFiles = new Set(await markReviewFileSeen(repo, { base: scope.base, head: scope.head, file }));
    this.updateView(repo);
  }

  private async moveStep(direction: -1 | 1): Promise<void> {
    if (!this.story) return;
    const steps = this.story.steps;
    const current = this.cursor ? steps.findIndex((step) => step.id === this.cursor?.stepId) : -1;
    const index = Math.max(0, Math.min(steps.length - 1, current < 0 ? (direction > 0 ? 0 : steps.length - 1) : current + direction));
    await this.openStep(steps[index]);
  }

  private async resumeReview(): Promise<void> {
    if (!this.story) return;
    const step = this.story.steps.find((candidate) => candidate.id === this.cursor?.stepId) ?? this.story.steps[0];
    await this.openStep(step);
  }

  private async changeScope(): Promise<void> {
    await this.openScreen('comparison');
  }

  private async openScreen(screen: DiffStoryScreen): Promise<void> {
    await vscode.commands.executeCommand(`${this.viewType}.focus`);
    await this.navigate(screen);
  }

  private async navigate(screen: DiffStoryScreen): Promise<void> {
    if ((screen === 'history' || screen === 'comparison') && !this.repo) {
      this.screen = 'repositories';
    } else {
      this.screen = screen;
    }
    this.updateView(this.repo);
  }

  private async applyComparisonPreset(preset: 'automatic' | 'working' | 'latest'): Promise<void> {
    const repo = await this.workspaceRoot();
    if (!repo) return;
    if (preset === 'automatic') {
      this.manualScope = undefined;
      await this.workspaceState.update(`diffstory.scope:${repo.fsPath}`, undefined);
    } else if (preset === 'working') {
      await this.saveScope(repo, { base: 'HEAD', label: scopeLabel('HEAD') });
    } else {
      try {
        const latest = await latestCommitComparison(repo);
        await this.saveScope(repo, { ...latest, label: scopeLabel(latest.base, latest.head) });
      } catch (error) {
        void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
        return;
      }
    }
    this.storyFiles = undefined;
    this.screen = 'review';
    await this.refresh();
  }

  private async applyComparison(baseValue: string, headValue?: string): Promise<void> {
    const repo = await this.workspaceRoot();
    if (!repo) return;
    const base = baseValue.trim();
    const head = headValue?.trim() || undefined;
    if (!base) {
      void vscode.window.showErrorMessage('Choose a base branch, tag, commit, or revision.');
      return;
    }
    if (head && head === base) {
      void vscode.window.showErrorMessage('Base and head must be different Git revisions.');
      return;
    }
    const [validBase, validHead] = await Promise.all([
      resolveReviewRevision(repo, base),
      head ? resolveReviewRevision(repo, head) : Promise.resolve(undefined),
    ]);
    if (!validBase) {
      void vscode.window.showErrorMessage(`Git could not resolve the base revision “${base}”.`);
      return;
    }
    if (head && !validHead) {
      void vscode.window.showErrorMessage(`Git could not resolve the head revision “${head}”.`);
      return;
    }
    await this.saveScope(repo, { base, ...(head ? { head } : {}), label: scopeLabel(base, head) });
    this.storyFiles = undefined;
    this.screen = 'review';
    await this.refresh();
  }

  private async saveScope(repo: vscode.Uri, scope: ReviewScope): Promise<void> {
    this.manualScope = scope;
    await this.workspaceState.update(`diffstory.scope:${repo.fsPath}`, scope);
  }

  private async resumeHistory(scopeKey: string): Promise<void> {
    const repo = await this.workspaceRoot();
    if (!repo) return;
    const entry = this.history.find((candidate) => candidate.scopeKey === scopeKey);
    if (!entry) {
      void vscode.window.showWarningMessage('That saved review is no longer available. Refreshing history.');
      await this.refresh();
      return;
    }
    const [base, head] = await Promise.all([
      resolveReviewRevision(repo, entry.base),
      entry.head ? resolveReviewRevision(repo, entry.head) : Promise.resolve(undefined),
    ]);
    if (!base || (entry.head && !head)) {
      void vscode.window.showWarningMessage('One of this review’s Git revisions no longer exists, so DiffStory cannot safely reopen it.');
      return;
    }
    await this.saveScope(repo, { base: entry.base, ...(entry.head ? { head: entry.head } : {}), label: scopeLabel(entry.base, entry.head) });
    this.storyFiles = undefined;
    this.screen = 'review';
    await this.refresh();
  }

  private async chooseStoryFiles(): Promise<boolean> {
    const repo = await this.workspaceRoot();
    if (!repo) return false;
    const scope = await this.currentScope(repo);
    const files = await changedFiles(repo, scope.base, scope.head);
    this.changed = files;
    const reviewable = files.filter((file) => !file.exclusion);
    if (!reviewable.length) {
      void vscode.window.showInformationMessage('There are no changed files in this review scope to select.');
      return false;
    }
    const selected = await vscode.window.showQuickPick(reviewable.map((file) => ({
      label: file.path,
      description: describeStatus(file.status),
      picked: this.storyFiles?.includes(file.path) ?? false,
    })), {
      canPickMany: true,
      placeHolder: 'Choose exactly which changed files the generated story must explain',
    });
    if (!selected) return false;
    if (!selected.length) {
      void vscode.window.showWarningMessage('Choose at least one changed file for a scoped story.');
      return false;
    }
    this.storyFiles = selected.length === reviewable.length ? undefined : selected.map((file) => file.label).sort();
    this.updateView(repo);
    return true;
  }

  private async runGenerateInteractive(): Promise<void> {
    if (this.agentRun) {
      void vscode.window.showInformationMessage('A DiffStory agent workflow is already running. Open the Feedback tab to follow its progress.');
      return;
    }
    const agent = await this.chooseAgent('Choose the agent that should write this story');
    if (!agent) return;
    const depth = await vscode.window.showQuickPick([
      { label: 'Guided', description: 'Balanced reading path for a normal review', mode: 'guided' as const },
      { label: 'Brief', description: 'A compact skim of the change', mode: 'brief' as const },
      { label: 'Detailed', description: 'A slower, line-by-line review path', mode: 'detailed' as const },
    ], { placeHolder: 'Choose the story depth' });
    if (!depth) return;
    const coverage = await vscode.window.showQuickPick([
      { label: 'All changed files', description: 'The story must cover the entire selected review scope', select: false },
      { label: 'Choose files…', description: 'Limit the story to the changed files you select', select: true },
    ], { placeHolder: 'Choose the story coverage' });
    if (!coverage) return;
    if (coverage.select) {
      if (!await this.chooseStoryFiles()) return;
    } else {
      this.storyFiles = undefined;
    }
    const note = await vscode.window.showInputBox({
      prompt: 'Optional review focus',
      placeHolder: 'Acceptance criteria, risk, or question to emphasize',
      ignoreFocusOut: true,
    });
    if (note === undefined) return;
    await this.runGenerate({ agent, mode: depth.mode, note });
  }

  private async runAddressInteractive(): Promise<void> {
    if (this.agentRun) {
      void vscode.window.showInformationMessage('A DiffStory agent workflow is already running.');
      return;
    }
    const agent = await this.chooseAgent('Choose the agent that should address the open feedback');
    if (agent) await this.runAddress({ agent });
  }

  private async runRepairInteractive(): Promise<void> {
    if (!this.story || this.agentRun) return;
    if (!await this.ensureGuideCurrent()) return;
    const step = await this.pickStep();
    if (!step) return;
    const action = await vscode.window.showQuickPick([
      { label: 'Explain', description: 'Add missing rationale or context', action: 'explain' as const },
      { label: 'Shorten', description: 'Make this stop easier to scan', action: 'shorten' as const },
      { label: 'Split', description: 'Separate a crowded review stop', action: 'split' as const },
    ], { placeHolder: `Refine “${step.title}”` });
    if (!action) return;
    const agent = await this.chooseAgent('Choose the agent that should refine this step');
    if (agent) await this.runRepair(step.id, action.action, agent);
  }

  private async showStoryActions(): Promise<void> {
    if (this.agentRun) {
      void vscode.window.showInformationMessage('Wait for the active DiffStory agent workflow to finish, or stop it before switching guides.');
      return;
    }
    const action = await vscode.window.showQuickPick([
      { label: this.story ? 'Regenerate guided review' : 'Create guided review', description: 'Choose agent, depth, files, and review focus', action: 'generate' as const },
      { label: 'Switch guided review', description: 'Choose another saved guide', action: 'switch' as const, enabled: this.stories.length > 1 },
      { label: 'Refine a guide stop', description: 'Explain, shorten, or split one stop', action: 'repair' as const, enabled: Boolean(this.story) && this.guideStatus?.state === 'current' },
      { label: 'Choose guide files', description: 'Set the files the next guide must explain', action: 'files' as const },
      { label: 'Delete selected saved guide', description: 'Remove a named guide; the current guide is protected', action: 'delete' as const, enabled: this.storyId !== 'story.json' },
    ].filter((choice) => choice.enabled !== false), { placeHolder: 'Guided review options' });
    if (action?.action === 'generate') await this.runGenerateInteractive();
    if (action?.action === 'switch') await this.chooseStory();
    if (action?.action === 'repair') await this.runRepairInteractive();
    if (action?.action === 'files') await this.chooseStoryFiles();
    if (action?.action === 'delete') await this.deleteStory(this.storyId);
  }

  private async chooseStory(): Promise<void> {
    if (this.agentRun) return;
    const choice = await vscode.window.showQuickPick(this.stories.map((story) => ({
      label: story.valid ? story.title : story.id,
      description: story.id === this.storyId ? 'Current guide' : story.valid ? story.id : 'Invalid guide',
      story,
    })), { placeHolder: 'Choose a saved guided review' });
    if (!choice || choice.story.id === this.storyId) return;
    this.storyId = choice.story.id;
    await this.refresh();
  }

  private async openSinceFeedback(): Promise<void> {
    const repo = await this.workspaceRoot();
    if (!repo) return;
    const scope = await this.currentScope(repo);
    const files = await changedFiles(repo, scope.base, scope.head);
    const changes = await reviewChangesSinceFeedback(repo, { base: scope.base, head: scope.head, files: files.map((file) => file.path) });
    if (!changes.length) {
      void vscode.window.showInformationMessage('No persisted feedback snapshot has code changes to inspect yet.');
      return;
    }
    const selected = await vscode.window.showQuickPick(changes.map((change) => ({ label: change.file, description: 'Changed since feedback', change })), {
      placeHolder: 'Open the code delta since feedback was sent',
    });
    if (!selected) return;
    const left = this.reviewUri(selected.change.file, 'before feedback', selected.change.before ?? '');
    const right = this.reviewUri(selected.change.file, 'current', selected.change.after ?? '');
    await vscode.commands.executeCommand('vscode.diff', left, right, `DiffStory: since feedback · ${selected.change.file}`, { preview: false });
  }

  private async openNativeDiff(
    repo: vscode.Uri,
    file: string,
    base: string,
    head: string | undefined,
    step?: CodeTourStep,
  ): Promise<void> {
    const changedFile = this.changed.find((candidate) => candidate.path === file);
    const left = this.virtualUri(repo, base, changedFile?.oldPath ?? file);
    const deletedFromWorkingTree = !head && changedFile?.status.startsWith('D');
    const right = head
      ? this.virtualUri(repo, head, file)
      : deletedFromWorkingTree
        ? this.reviewUri(file, 'deleted', '')
        : vscode.Uri.joinPath(repo, ...file.split('/'));
    this.rememberSource(left, repo, file, 'left');
    this.rememberSource(right, repo, file, 'right');
    const title = step ? `DiffStory: ${step.title}` : `DiffStory: ${file}`;
    await vscode.commands.executeCommand('vscode.diff', left, right, title, { preview: false });
    if (step) await this.revealStep(right, step);
  }

  private async revealStep(uri: vscode.Uri, step: CodeTourStep): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 120));
    const editor = vscode.window.visibleTextEditors.find((candidate) => candidate.document.uri.toString() === uri.toString());

    if (!editor) return;
    const reveal = step.viewport ?? step.range;
    if (isLineRange(reveal) && reveal[0] > 0) {
      editor.revealRange(toRange(reveal), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
    const highlights = (step.highlights ?? step.beats?.flatMap((beat) => beat.highlights) ?? [step.range])
      .filter((range) => range[0] > 0)
      .map(toRange);
    editor.setDecorations(this.highlight, highlights);
  }

  private async openConceptStep(step: ConceptTourStep): Promise<void> {
    const lines = [
      `# ${step.title}`,
      '',
      step.body,
      '',
      ...(step.diagram ? [`## Diagram`, '', '```mermaid', step.diagram.source, '```', '', `_${step.diagram.caption}_`, ''] : []),
      ...(step.preparesFor.length ? [`---`, '', `Prepares for: ${step.preparesFor.map((id) => `\`${id}\``).join(', ')}`, ''] : []),
    ];
    const uri = this.reviewUri(`concept/${step.id}.md`, 'concept', lines.join('\n'));
    const document = await vscode.languages.setTextDocumentLanguage(await vscode.workspace.openTextDocument(uri), 'markdown');
    await vscode.window.showTextDocument(document, { preview: false });
    try {
      await vscode.commands.executeCommand('markdown.showPreview', document.uri);
    } catch {
      // The readable Markdown source stays open if the built-in preview is unavailable.
    }
  }

  private async addComment(): Promise<void> {
    const repo = await this.workspaceRoot();
    const editor = vscode.window.activeTextEditor;
    if (!repo || !editor || editor.selection.isEmpty) {
      void vscode.window.showInformationMessage('Select the exact code you want to review first.');
      return;
    }
    const source = this.sourceFor(editor.document.uri, repo);
    if (!source) {
      void vscode.window.showWarningMessage('The selected document is outside this DiffStory workspace.');
      return;
    }
    if (!this.changed.some((file) => file.path === source.file)) {
      void vscode.window.showWarningMessage('Open this file from DiffStory Changes before adding review feedback.');
      return;
    }
    const selectedText = editor.document.getText(editor.selection);
    const typeChoice = await vscode.window.showQuickPick([
      { label: 'Question', type: 'question' as const },
      { label: 'Change request', type: 'change' as const },
      { label: 'Nit', type: 'nit' as const },
    ], {
      placeHolder: 'What kind of feedback is this?',
    });
    if (!typeChoice) return;
    const defaultSeverity: CommentSeverity = typeChoice.type === 'change' ? 'blocking' : typeChoice.type === 'nit' ? 'nit' : 'concern';
    const severityChoices = [
      { label: 'Blocking', description: 'Must be resolved before approval', severity: 'blocking' as const },
      { label: 'Concern', description: 'Important feedback that does not block approval', severity: 'concern' as const },
      { label: 'Nit', description: 'Small, optional improvement', severity: 'nit' as const },
    ];
    const severityChoice = await vscode.window.showQuickPick([
      ...severityChoices.filter((choice) => choice.severity === defaultSeverity),
      ...severityChoices.filter((choice) => choice.severity !== defaultSeverity),
    ], { placeHolder: 'How much does this affect approval?' });
    if (!severityChoice) return;
    const body = await vscode.window.showInputBox({
      prompt: 'Review feedback',
      placeHolder: 'Explain what should change or what you want clarified',
      validateInput: (value) => value.trim() ? undefined : 'A comment cannot be empty.',
    });
    if (!body?.trim()) return;

    const comment = createComment({
      file: source.file,
      selection: editor.selection,
      selectedText,
      body,
      type: typeChoice.type,
      severity: severityChoice.severity ?? defaultSeverity,
      reviewRound: this.review.round,
      reviewSnapshotId: this.review.currentSnapshotId,
      step: this.story?.steps.find((step) => isCodeStep(step) && step.file === source.file && rangeContains(step.range, editor.selection.start.line + 1))?.id,
      side: source.side,
    });
    const loaded = await loadCommentsWithHealth(repo);
    if (loaded.health.status === 'invalid') {
      void vscode.window.showErrorMessage(`${loaded.health.message} ${loaded.health.recovery}`);
      return;
    }
    loaded.comments.push(comment);
    await saveComments(repo, loaded.comments, loaded.sourceDigest);
    const scope = await this.currentScope(repo);
    await recordReviewEvent(repo, {
      base: scope.base,
      head: scope.head,
      kind: 'comment-added',
      label: 'Added review comment',
      detail: `${comment.file}:${comment.line}`,
      affectsApproval: commentSeverity(comment) === 'blocking',
    });
    await this.refresh();
    void vscode.window.showInformationMessage('DiffStory review comment saved.');
  }

  private async resolveComment(): Promise<void> {
    const repo = await this.workspaceRoot();
    if (!repo) return;
    const comments = await loadComments(repo);
    const choices = comments
      .filter((comment) => comment.status !== 'resolved')
      .map((comment) => ({
        label: comment.body.split('\n')[0] || 'Untitled comment',
        description: `${comment.file}:${comment.line} · ${comment.type}`,
        comment,
      }));
    const selected = await vscode.window.showQuickPick(choices, { placeHolder: 'Mark a review comment as resolved' });
    if (!selected) return;
    await this.setCommentStatus(selected.comment.id, 'resolved');
  }

  private async reopenComment(): Promise<void> {
    const choices = this.comments
      .filter((comment) => comment.status !== 'open')
      .map((comment) => ({
        label: comment.body.split('\n')[0] || 'Untitled comment',
        description: `${comment.file}:${comment.line} · ${comment.status}`,
        comment,
      }));
    const selected = await vscode.window.showQuickPick(choices, { placeHolder: 'Reopen a review comment' });
    if (selected) await this.setCommentStatus(selected.comment.id, 'open');
  }

  private async setCommentStatus(id: string, status: CommentStatus): Promise<void> {
    const repo = await this.workspaceRoot();
    if (!repo) return;
    const updated = await setCommentStatus(repo, id, status);
    if (!updated) return;
    const scope = await this.currentScope(repo);
    await recordReviewEvent(repo, {
      base: scope.base,
      head: scope.head,
      kind: status === 'resolved' ? 'comment-resolved' : 'comment-reopened',
      label: status === 'resolved' ? 'Comment verified and resolved' : 'Comment reopened',
      detail: `${updated.file}:${updated.line}`,
      affectsApproval: commentSeverity(updated) === 'blocking',
    });
    await this.refresh();
  }

  private async followUpComment(id: string): Promise<void> {
    const comment = this.comments.find((candidate) => candidate.id === id);
    if (!comment) return;
    const text = await vscode.window.showInputBox({
      prompt: `Follow up on ${comment.file}:${comment.line}`,
      placeHolder: 'Explain what remains unresolved for the agent',
      validateInput: (value) => value.trim() ? undefined : 'A follow-up cannot be empty.',
    });
    if (!text) return;
    const repo = await this.workspaceRoot();
    if (!repo) return;
    const updated = await appendReviewerFollowUp(repo, id, text);
    if (!updated) return;
    const scope = await this.currentScope(repo);
    await recordReviewEvent(repo, {
      base: scope.base,
      head: scope.head,
      kind: 'comment-reopened',
      label: 'Added follow-up and reopened comment',
      detail: `${updated.file}:${updated.line}`,
      affectsApproval: commentSeverity(updated) === 'blocking',
    });
    await this.refresh();
  }

  private async deleteComment(id: string): Promise<void> {
    const repo = await this.workspaceRoot();
    const comment = this.comments.find((candidate) => candidate.id === id);
    if (!repo || !comment) return;
    const choice = await vscode.window.showWarningMessage('Delete this review conversation?', { modal: true }, 'Delete');
    if (choice !== 'Delete') return;
    if (!await deleteComment(repo, id)) return;
    const scope = await this.currentScope(repo);
    await recordReviewEvent(repo, {
      base: scope.base,
      head: scope.head,
      kind: 'comment-deleted',
      label: 'Deleted review comment',
      detail: `${comment.file}:${comment.line}`,
      affectsApproval: commentSeverity(comment) === 'blocking',
    });
    await this.refresh();
  }

  private async deleteCommentInteractive(): Promise<void> {
    const selected = await vscode.window.showQuickPick(this.comments.map((comment) => ({
      label: comment.body.split('\n')[0] || 'Untitled comment',
      description: `${comment.file}:${comment.line} · ${commentSeverity(comment)}`,
      comment,
    })), { placeHolder: 'Delete a review conversation' });
    if (selected) await this.deleteComment(selected.comment.id);
  }

  private async recordVerdict(decision: 'approved' | 'changes-requested'): Promise<void> {
    const repo = await this.workspaceRoot();
    if (!repo) return;
    const scope = await this.currentScope(repo);
    const diff = await reviewDiff(repo, scope.base, scope.head);
    const changeFingerprint = await reviewChangeFingerprint(repo, scope.base, scope.head);
    if (!this.review.currentDiffHash || changeFingerprint !== this.review.currentDiffHash) {
      void vscode.window.showErrorMessage('The code changed after this review page loaded. DiffStory refreshed the comparison; review the new state before deciding.');
      await this.refresh();
      return;
    }
    const exclusions = await excludedReviewFiles(repo, scope.base, scope.head);
    const divergence = await stagedWorktreeDivergentFiles(repo, scope.base, scope.head);
    if (decision === 'approved' && divergence.length) {
      void vscode.window.showErrorMessage(`Reconcile the staged and working-tree versions of ${divergence.join(', ')} before approval.`);
      return;
    }
    if (decision === 'approved' && this.story && this.guideStatus?.state !== 'current') {
      void vscode.window.showErrorMessage('Regenerate or switch the guide before approving this guided review.');
      return;
    }
    if (decision === 'approved' && this.story?.storyScope?.excludedFiles?.length) {
      void vscode.window.showErrorMessage('This guide covers only selected files. Review the full Changes list before approving the whole comparison.');
      return;
    }
    const coverage = this.story ? computeStoryClaimCoverage(this.story, diff) : undefined;
    if (decision === 'approved' && coverage?.unclaimed.length) {
      void vscode.window.showErrorMessage(`This guide leaves ${coverage.unclaimed.length} changed ${coverage.unclaimed.length === 1 ? 'range' : 'ranges'} unexplained. Regenerate it before approving the guided review.`);
      return;
    }
    let acknowledgedExclusions: Array<{ path: string; reason: string }> | undefined;
    if (decision === 'approved' && exclusions.length) {
      const choice = await vscode.window.showWarningMessage(
        `${exclusions.length} generated, oversized, binary, or metadata-only ${exclusions.length === 1 ? 'file is' : 'files are'} outside the bounded guide diff. Approve only after inspecting them in Changes.`,
        { modal: true, detail: exclusions.map((file) => `${file.path} — ${exclusionLabel(file.reason)}`).join('\n') },
        'I inspected them — approve',
      );
      if (choice !== 'I inspected them — approve') return;
      acknowledgedExclusions = exclusions.map(({ path, reason }) => ({ path, reason }));
    }
    const note = await vscode.window.showInputBox({
      prompt: decision === 'approved' ? 'Optional approval note' : 'Why are changes needed?',
      placeHolder: decision === 'approved' ? 'What you verified' : 'Summarize the remaining work',
      validateInput: decision === 'changes-requested' ? (value) => value.trim() ? undefined : 'Explain what still needs to change.' : undefined,
    });
    if (note === undefined || (decision === 'changes-requested' && !note.trim())) return;
    const confirmedDiff = await reviewDiff(repo, scope.base, scope.head);
    const confirmedFingerprint = await reviewChangeFingerprint(repo, scope.base, scope.head);
    if (confirmedFingerprint !== changeFingerprint) {
      void vscode.window.showErrorMessage('The code changed while you were deciding. DiffStory did not save the decision; review the refreshed comparison first.');
      await this.refresh();
      return;
    }
    try {
      await recordReviewVerdict(repo, {
        base: scope.base,
        head: scope.head,
        diff: confirmedDiff,
        changeFingerprint: confirmedFingerprint,
        decision,
        note,
        expectedFeedbackVersion: this.review.feedbackVersion,
        expectedBlockingFeedbackDigest: this.review.blockingFeedbackDigest,
        acknowledgedExclusions,
      });
      await this.refresh();
      void vscode.window.showInformationMessage(decision === 'approved' ? 'DiffStory review approved.' : 'DiffStory recorded that changes are needed.');
    } catch (error) {
      void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      await this.refresh();
    }
  }

  private async showComment(id: string): Promise<void> {
    const repo = await this.workspaceRoot();
    const comment = this.comments.find((candidate) => candidate.id === id);
    if (!repo || !comment) return;
    const scope = await this.currentScope(repo);
    const focus: CodeTourStep = {
      id: `comment-${comment.id}`,
      order: 0,
      title: 'Review feedback',
      file: comment.file,
      range: [comment.line, comment.selection?.endLine ?? comment.line],
      kind: 'context',
      why: comment.body,
    };
    await this.openNativeDiff(repo, comment.file, scope.base, scope.head, comment.side === 'left' ? undefined : focus);
    if (comment.side === 'left') {
      const baseFile = this.changed.find((file) => file.path === comment.file)?.oldPath ?? comment.file;
      await this.revealStep(this.virtualUri(repo, scope.base, baseFile), focus);
    }
  }

  private async deleteStory(id: string): Promise<void> {
    const repo = await this.workspaceRoot();
    if (!repo || id === 'story.json') {
      if (id === 'story.json') void vscode.window.showWarningMessage('Keep the current story; delete a saved named story instead.');
      return;
    }
    const story = this.stories.find((candidate) => candidate.id === id);
    const approved = await vscode.window.showWarningMessage(`Delete saved story “${story?.title ?? id}”?`, { modal: true }, 'Delete');
    if (approved !== 'Delete') return;
    if (await deleteStory(repo, id)) {
      this.storyId = 'story.json';
      await this.refresh();
    }
  }

  private async runGenerate(event: { mode?: unknown; note?: unknown; agent?: unknown }): Promise<void> {
    const repo = await this.workspaceRoot();
    if (!repo || this.agentRun) return;
    const agent = this.pickAgent(event.agent);
    if (!agent) return;
    const mode = event.mode === 'brief' || event.mode === 'detailed' ? event.mode : 'guided';
    const scope = await this.currentScope(repo);
    const currentFiles = await changedFiles(repo, scope.base, scope.head);
    const exclusions = await excludedReviewFiles(repo, scope.base, scope.head);
    const excludedPaths = new Set(exclusions.map((file) => file.path));
    const reviewableFiles = currentFiles.filter((file) => !excludedPaths.has(file.path)).map((file) => file.path);
    const availableFiles = new Set(reviewableFiles);
    const selectedFiles = this.storyFiles?.filter((file) => availableFiles.has(file));
    if (this.storyFiles?.length && !selectedFiles?.length) {
      void vscode.window.showWarningMessage('The selected story files are no longer in this review scope. Choose them again.');
      return;
    }
    const reviewerNote = typeof event.note === 'string' ? event.note.trim() : '';
    const storyScope: Tour['storyScope'] | undefined = selectedFiles?.length || reviewerNote
      ? {
          includedFiles: selectedFiles ?? reviewableFiles,
          ...(selectedFiles?.length && selectedFiles.length < reviewableFiles.length
            ? { excludedFiles: reviewableFiles.filter((file) => !selectedFiles.includes(file)) }
            : {}),
          ...(reviewerNote ? { reviewerNote } : {}),
        }
      : undefined;
    const storyPath = path.join(repo.fsPath, '.diffstory', 'story.json');
    const storyBefore = await optionalText(storyPath);
    this.progress = ['Preparing guided story generation…'];
    this.agentRun = startAgent(agent, 'generate', repo.fsPath, storyPrompt({
      base: scope.base,
      head: scope.head,
      mode,
      note: reviewerNote || undefined,
      files: selectedFiles,
      excludedFiles: exclusions.map((file) => file.path),
      allReviewableFiles: reviewableFiles,
    }), (line) => this.pushProgress(line));
    this.updateView(repo);
    const result = await this.agentRun.done;
    this.agentRun = undefined;
    const storyAfter = await optionalText(storyPath);
    const storyChanged = storyAfter !== undefined && storyAfter !== storyBefore;
    if (result.ok && storyChanged) {
      const generatedDiff = await reviewDiff(repo, scope.base, scope.head);
      if (!await stampStoryFingerprint(repo, 'story.json', diffFingerprint(generatedDiff), storyScope)) {
        this.progress.push('Guide was created, but DiffStory could not record its exact diff fingerprint.');
      }
    }
    const generated = await loadStory(repo, 'story.json');
    if (result.ok && storyChanged && generated?.valid && generated.story) {
      this.storyId = 'story.json';
      const files = await changedFiles(repo, scope.base, scope.head);
      const diff = await reviewDiff(repo, scope.base, scope.head);
      const changeFingerprint = await reviewChangeFingerprint(repo, scope.base, scope.head);
      await captureReview(repo, { base: scope.base, head: scope.head, diff, changeFingerprint, files: files.map((file) => file.path), reason: 'story-generated' });
      this.progress.push('Guided story ready.');
    } else {
      this.progress.push(`Generation failed: ${!storyChanged ? 'the agent did not write a new story.' : lastLine(result.output) || 'the agent did not write a valid story.'}`);
    }
    await this.refresh();
  }

  private async runAddress(event: { agent?: unknown }): Promise<void> {
    const repo = await this.workspaceRoot();
    if (!repo || this.agentRun) return;
    const comments = (await loadComments(repo)).filter((comment) => comment.status === 'open');
    if (!comments.length) {
      void vscode.window.showInformationMessage('There are no open DiffStory comments to send.');
      return;
    }
    const agent = this.pickAgent(event.agent);
    if (!agent) return;
    const scope = await this.currentScope(repo);
    const diff = await reviewDiff(repo, scope.base, scope.head);
    const changeFingerprint = await reviewChangeFingerprint(repo, scope.base, scope.head);
    const files = await changedFiles(repo, scope.base, scope.head);
    await captureReview(repo, { base: scope.base, head: scope.head, diff, changeFingerprint, files: files.map((file) => file.path), reason: 'feedback-sent', commentIds: comments.map((comment) => comment.id) });
    this.progress = [`Sending ${comments.length} comments to ${agent}…`];
    this.agentRun = startAgent(agent, 'address', repo.fsPath, addressPrompt({ base: scope.base, head: scope.head, commentIds: comments.map((comment) => comment.id) }), (line) => this.pushProgress(line));
    this.updateView(repo);
    const result = await this.agentRun.done;
    this.agentRun = undefined;
    if (result.ok) {
      const after = await changedFiles(repo, scope.base, scope.head);
      await captureReview(repo, { base: scope.base, head: scope.head, diff: await reviewDiff(repo, scope.base, scope.head), changeFingerprint: await reviewChangeFingerprint(repo, scope.base, scope.head), files: after.map((file) => file.path), reason: 'agent-complete' });
      this.progress.push('Agent finished. Verify addressed comments before resolving them.');
    } else this.progress.push(`Agent run failed: ${lastLine(result.output) || 'see the terminal output.'}`);
    await this.refresh();
  }

  private async runRepair(stepId: string, action: 'explain' | 'shorten' | 'split', requestedAgent?: AgentName): Promise<void> {
    const repo = await this.workspaceRoot();
    if (!repo || this.agentRun || !this.story) return;
    if (!await this.ensureGuideCurrent(repo)) return;
    const story = this.story;
    const storyId = this.storyId;
    const agent = this.pickAgent(requestedAgent);
    if (!agent) return;
    const base = await resolveBase(repo, story.base);
    const head = story.head;
    const fingerprintBeforeRepair = diffFingerprint(await reviewDiff(repo, base, head));
    this.progress = [`Asking ${agent} to ${action} this story step…`];
    this.agentRun = startAgent(agent, 'repair', repo.fsPath, repairPrompt({ base, head, action, stepId, storyId }), (line) => this.pushProgress(line));
    this.updateView(repo);
    const result = await this.agentRun.done;
    this.agentRun = undefined;
    if (result.ok) {
      const fingerprintAfterRepair = diffFingerprint(await reviewDiff(repo, base, head));
      if (fingerprintAfterRepair !== fingerprintBeforeRepair) {
        this.progress.push('Code changed while the guide stop was being refined. Regenerate the full guide before following its line targets.');
      } else {
        await stampStoryFingerprint(repo, storyId, fingerprintAfterRepair);
        await recordReviewEvent(repo, { base, head, kind: 'story-repaired', label: `Story step ${action}ed` });
      }
    } else this.progress.push(`Story repair failed: ${lastLine(result.output) || 'agent exited without a repair.'}`);
    await this.refresh();
  }

  private pickAgent(requested: unknown): AgentName | undefined {
    const agents = availableAgents();
    if (!agents.length) {
      void vscode.window.showErrorMessage('Install Codex or Claude on your PATH before running an agent workflow.');
      return undefined;
    }
    if (requested === 'codex' || requested === 'claude') {
      if (agents.includes(requested)) return requested;
      void vscode.window.showErrorMessage(`${requested === 'codex' ? 'Codex' : 'Claude'} is not available on your PATH.`);
      return undefined;
    }
    return agents[0];
  }

  private async chooseAgent(placeHolder: string): Promise<AgentName | undefined> {
    const agents = availableAgents();
    if (!agents.length) {
      void vscode.window.showErrorMessage('Install Codex or Claude on your PATH before running an agent workflow.');
      return undefined;
    }
    const choice = await vscode.window.showQuickPick(agents.map((agent) => ({
      label: agent === 'codex' ? 'Codex' : 'Claude',
      description: agent === 'codex' ? 'Run the local Codex CLI' : 'Run the local Claude CLI',
      agent,
    })), { placeHolder });
    return choice?.agent;
  }

  private pushProgress(line: string): void {
    this.progress.push(line);
    this.progress = this.progress.slice(-30);
    void this.view?.webview.postMessage({ type: 'agentProgress', lines: this.progress });
  }

  private updateView(repo: vscode.Uri | undefined): void {
    if (this.view) this.view.webview.html = this.panelHtml(repo, this.story);
  }

  private async pickStep(): Promise<TourStep | undefined> {
    if (!this.story) return undefined;
    const choice = await vscode.window.showQuickPick(
      this.story.steps.map((step) => ({
        label: `${step.order}. ${step.title}`,
        description: isCodeStep(step) ? step.file : 'Concept primer',
        detail: isCodeStep(step) ? step.why : step.body,
        step,
      })),
      { placeHolder: 'Open a DiffStory step' },
    );
    return choice?.step;
  }

  private async workspaceRoot(showError = true): Promise<vscode.Uri | undefined> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (!folders.length) {
      if (showError) void vscode.window.showErrorMessage('Open a Git workspace before starting a DiffStory review.');
      return undefined;
    }
    const candidates = await Promise.all(folders.map(async (folder) => ({ folder, git: await isGitRepository(folder.uri) })));
    const gitFolders = candidates.filter((candidate) => candidate.git).map((candidate) => candidate.folder);
    if (gitFolders.length === 1) {
      this.repo = gitFolders[0].uri;
      await this.workspaceState.update('diffstory.repository', this.repo.fsPath);
      await this.rememberRepository(this.repo);
      return this.repo;
    }
    if (gitFolders.length > 1) {
      const current = this.repo && gitFolders.find((folder) => folder.uri.fsPath === this.repo?.fsPath);
      if (current) return current.uri;
      const stored = this.workspaceState.get<string>('diffstory.repository');
      const restored = stored && gitFolders.find((folder) => folder.uri.fsPath === stored);
      const selected = restored ?? gitFolders[0];
      if (selected) {
        this.repo = selected.uri;
        await this.workspaceState.update('diffstory.repository', this.repo.fsPath);
        await this.rememberRepository(this.repo);
        return this.repo;
      }
    }
    if (showError) void vscode.window.showErrorMessage('DiffStory needs an opened Git workspace.');
    return undefined;
  }

  private async repositoryList(): Promise<RepositoryListItem[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    const workspace = (await Promise.all(workspaceFolders.map(async (folder) => ({ folder, available: await isGitRepository(folder.uri) }))))
      .filter((candidate) => candidate.available)
      .map(({ folder }) => ({
        name: folder.name,
        path: folder.uri.fsPath,
        kind: 'workspace' as const,
        active: folder.uri.fsPath === this.repo?.fsPath,
        available: true,
      }));
    const workspacePaths = new Set(workspace.map((item) => item.path));
    const recentPaths = this.globalState.get<string[]>('diffstory.recentRepositories') ?? [];
    const recent = await Promise.all(recentPaths.filter((recentPath) => !workspacePaths.has(recentPath)).map(async (recentPath) => ({
      name: path.basename(recentPath) || recentPath,
      path: recentPath,
      kind: 'recent' as const,
      active: recentPath === this.repo?.fsPath,
      available: await isGitRepository(vscode.Uri.file(recentPath)),
    })));
    return [...workspace, ...recent];
  }

  private async rememberRepository(repo: vscode.Uri): Promise<void> {
    const recent = this.globalState.get<string[]>('diffstory.recentRepositories') ?? [];
    await this.globalState.update('diffstory.recentRepositories', [repo.fsPath, ...recent.filter((item) => item !== repo.fsPath)].slice(0, 12));
  }

  private async browseRepository(): Promise<void> {
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Open Git repository',
      title: 'Choose a repository for DiffStory',
    });
    const repo = selected?.[0];
    if (!repo) return;
    if (!await isGitRepository(repo)) {
      void vscode.window.showErrorMessage('That folder is not inside a Git repository. Choose a Git project folder.');
      return;
    }
    await this.rememberRepository(repo);
    const open = (vscode.workspace.workspaceFolders ?? []).find((folder) => folder.uri.fsPath === repo.fsPath);
    if (open) {
      await this.selectRepository(repo.fsPath);
      return;
    }
    await vscode.commands.executeCommand('vscode.openFolder', repo, false);
  }

  private async selectRepository(repoPath: string): Promise<void> {
    const candidate = this.repositories.find((item) => item.path === repoPath);
    if (!candidate?.available) {
      void vscode.window.showWarningMessage('That repository is no longer available. Refresh or choose another folder.');
      return;
    }
    const open = (vscode.workspace.workspaceFolders ?? []).find((folder) => folder.uri.fsPath === repoPath);
    if (!open) {
      await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(repoPath), false);
      return;
    }
    this.repo = open.uri;
    this.scopeWorkspace = undefined;
    this.storyId = 'story.json';
    this.storyFiles = undefined;
    this.screen = 'review';
    await this.workspaceState.update('diffstory.repository', this.repo.fsPath);
    await this.rememberRepository(this.repo);
    await this.refresh();
  }

  private async forgetRepository(repoPath: string): Promise<void> {
    const recent = this.globalState.get<string[]>('diffstory.recentRepositories') ?? [];
    await this.globalState.update('diffstory.recentRepositories', recent.filter((item) => item !== repoPath));
    this.repositories = await this.repositoryList();
    this.updateView(this.repo);
  }

  private async refreshCommentThreads(repo: vscode.Uri | undefined, comments: ReviewComment[]): Promise<void> {
    for (const thread of this.commentThreads) thread.dispose();
    this.commentThreads = [];
    if (!repo) return;
    const scope = await this.currentScope(repo);
    for (const comment of comments) {
      const baseFile = this.changed.find((file) => file.path === comment.file)?.oldPath ?? comment.file;
      const uri = comment.side === 'left'
        ? this.virtualUri(repo, scope.base, baseFile)
        : scope.head
          ? this.virtualUri(repo, scope.head, comment.file)
          : vscode.Uri.joinPath(repo, ...comment.file.split('/'));
      this.rememberSource(uri, repo, comment.file, comment.side ?? 'right');
      const thread = this.commentController.createCommentThread(uri, rangeFor(comment), commentsFor(comment));
      thread.contextValue = `diffstory:${comment.id}`;
      thread.label = `DiffStory ${commentSeverity(comment)} ${comment.type} · ${comment.status === 'addressed' ? 'needs verification' : comment.status}`;
      thread.state = comment.status === 'resolved'
        ? vscode.CommentThreadState.Resolved
        : vscode.CommentThreadState.Unresolved;
      thread.canReply = false;
      this.commentThreads.push(thread);
    }
  }

  private virtualUri(repo: vscode.Uri, ref: string, file: string): vscode.Uri {
    const query = encodeURIComponent(JSON.stringify({ repo: repo.fsPath, ref, file } satisfies VirtualDocument));
    return vscode.Uri.from({ scheme: GIT_CONTENT_SCHEME, path: `/${file}`, query });
  }

  private reviewUri(file: string, side: string, content: string): vscode.Uri {
    const uri = vscode.Uri.from({ scheme: REVIEW_CONTENT_SCHEME, path: `/${file}`, query: `${++this.reviewDocumentId}-${encodeURIComponent(side)}` });
    this.reviewDocuments.set(uri.toString(), content);
    if (this.reviewDocuments.size > 100) this.reviewDocuments.delete(this.reviewDocuments.keys().next().value as string);
    return uri;
  }

  private rememberSource(uri: vscode.Uri, repo: vscode.Uri, file: string, side: 'left' | 'right'): void {
    this.sources.set(uri.toString(), { repo, file, side });
  }

  private sourceFor(uri: vscode.Uri, repo: vscode.Uri): SourceDocument | undefined {
    const remembered = this.sources.get(uri.toString());
    if (remembered) return remembered;
    if (uri.scheme !== 'file') return undefined;
    const relative = path.relative(repo.fsPath, uri.fsPath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return undefined;
    return { repo, file: relative.split(path.sep).join('/'), side: 'right' };
  }

  private panelHtml(repo: vscode.Uri | undefined, story: Tour | undefined): string {
    return renderDiffStoryWebview({
      nonce: nonceValue(),
      screen: this.screen,
      ...(repo ? { repo: { name: path.basename(repo.fsPath), path: repo.fsPath } } : {}),
      scopeLabel: this.activeScopeLabel,
      ...(repo ? { scopeBase: this.activeScopeBase } : {}),
      ...(this.activeScopeHead ? { scopeHead: this.activeScopeHead } : {}),
      repositories: this.repositories,
      history: this.history,
      comparisonRefs: this.comparisonRefs,
      files: this.changed,
      exclusions: this.exclusions,
      indexDivergence: this.indexDivergence,
      seenFiles: [...this.seenFiles],
      comments: this.comments,
      review: this.review,
      story,
      guideStatus: this.guideStatus,
      storyCoverage: this.storyCoverage,
      storyId: this.storyId,
      stories: this.stories,
      cursor: this.cursor,
      progress: this.progress,
      agentRunning: Boolean(this.agentRun),
      agents: this.agents,
      showWelcome: this.showWelcome,
      loading: this.loading,
      error: this.refreshError,
      initialMode: this.initialMode,
    });
  }

  dispose(): void {
    for (const thread of this.commentThreads) thread.dispose();
    this.highlight.dispose();
    this.commentController.dispose();
    for (const disposable of this.disposables) disposable.dispose();
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(new DiffStoryController(context.workspaceState, context.globalState));
}

export function deactivate(): void {}

function decodeVirtualDocument(uri: vscode.Uri): VirtualDocument | undefined {
  try {
    const value: unknown = JSON.parse(decodeURIComponent(uri.query));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const source = value as Record<string, unknown>;
    return typeof source.repo === 'string' && typeof source.ref === 'string' && typeof source.file === 'string'
      ? { repo: source.repo, ref: source.ref, file: source.file }
      : undefined;
  } catch {
    return undefined;
  }
}

function isDiffStoryScreen(value: unknown): value is DiffStoryScreen {
  return value === 'review' || value === 'repositories' || value === 'history' || value === 'comparison';
}

function isComparisonPreset(value: unknown): value is 'automatic' | 'working' | 'latest' {
  return value === 'automatic' || value === 'working' || value === 'latest';
}

function commentsFor(comment: ReviewComment): vscode.Comment[] {
  const author = { name: 'Reviewer' };
  const items: vscode.Comment[] = [{ body: comment.body, mode: vscode.CommentMode.Preview, author, contextValue: 'diffstory-comment' }];
  for (const turn of comment.turns ?? []) {
    items.push({
      body: turn.text,
      mode: vscode.CommentMode.Preview,
      author: { name: turn.role === 'ai' ? 'Agent' : 'Reviewer' },
      timestamp: new Date(turn.at),
    });
  }
  if (comment.reply && !comment.turns?.length) {
    items.push({ body: comment.reply, mode: vscode.CommentMode.Preview, author: { name: 'Agent' } });
  }
  return items;
}

function toRange(range: [number, number]): vscode.Range {
  return new vscode.Range(range[0] - 1, 0, range[1] - 1, Number.MAX_SAFE_INTEGER);
}

function rangeContains(range: [number, number], line: number): boolean {
  return range[0] === 0 || (line >= range[0] && line <= range[1]);
}

function describeStatus(status: string): string {
  if (status.startsWith('A')) return 'added';
  if (status.startsWith('D')) return 'deleted';
  if (status.startsWith('R')) return 'renamed';
  if (status === '?') return 'untracked';
  return 'modified';
}

function nonceValue(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function lastLine(output: string): string | undefined {
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1);
}

async function optionalText(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return undefined;
  }
}

function exclusionLabel(reason: ReviewExclusion['reason']): string {
  return ({
    'generated-path': 'generated artifact',
    'large-diff': 'oversized diff',
    binary: 'binary file',
    'metadata-only': 'metadata-only change',
  })[reason];
}

function emptyReviewSummary(): ReviewSummary {
  return {
    scopeKey: '',
    round: 1,
    currentDiffHash: '',
    changedSinceReview: 0,
    changedFiles: [],
    seenFiles: [],
    events: [],
    verdict: { state: 'none', scopeKey: '', currentDiffFingerprint: '' },
    feedbackVersion: 0,
    blockingFeedbackDigest: '',
    feedbackHealth: { status: 'healthy', source: 'missing' },
  };
}
