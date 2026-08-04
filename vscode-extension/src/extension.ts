import * as vscode from 'vscode';
import {
  clampNavigationPoint,
  parseNavigationQuery,
  prepareNavigation,
  type NavigationRequest,
} from './navigation.js';

const PENDING_NAVIGATION_KEY = 'diffstory.pendingNavigation';
const PENDING_NAVIGATION_TTL_MS = 5 * 60 * 1000;

interface PendingNavigation {
  request: NavigationRequest;
  requestedAt: number;
}

async function navigateRequest(request: NavigationRequest): Promise<void> {
  try {
    const source = vscode.Uri.file(request.path);
    const document = await vscode.workspace.openTextDocument(source);
    const point = clampNavigationPoint(request, document.lineCount, (line) => document.lineAt(line).text.length);
    const position = new vscode.Position(point.line, point.character);
    const sourceSelection = new vscode.Range(position, position);
    const editor = await vscode.window.showTextDocument(document, {
      preview: true,
      preserveFocus: false,
      selection: sourceSelection,
    });
    editor.revealRange(sourceSelection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`DiffStory could not open that source location: ${detail}`);
  }
}

async function validateRepository(repo: string): Promise<vscode.Uri> {
  const repository = vscode.Uri.file(repo);
  const stat = await vscode.workspace.fs.stat(repository);
  if (!(stat.type & vscode.FileType.Directory)) throw new Error('The reviewed repository folder is unavailable.');
  await vscode.workspace.fs.stat(vscode.Uri.joinPath(repository, '.git'));
  return repository;
}

async function resumePendingNavigation(context: vscode.ExtensionContext): Promise<void> {
  const pending = context.globalState.get<PendingNavigation>(PENDING_NAVIGATION_KEY);
  if (!pending) return;
  if (
    !pending.request ||
    !Number.isFinite(pending.requestedAt) ||
    Date.now() - pending.requestedAt > PENDING_NAVIGATION_TTL_MS
  ) {
    await context.globalState.update(PENDING_NAVIGATION_KEY, undefined);
    return;
  }
  const source = vscode.Uri.file(pending.request.path);
  if (!vscode.workspace.getWorkspaceFolder(source)) return;
  await context.globalState.update(PENDING_NAVIGATION_KEY, undefined);
  await navigateRequest(pending.request);
}

async function navigate(uri: vscode.Uri, context: vscode.ExtensionContext): Promise<void> {
  if (uri.path !== '/navigate') return;
  const request = parseNavigationQuery(uri.query);
  if (!request) {
    await vscode.window.showErrorMessage('DiffStory sent an invalid code-navigation request.');
    return;
  }

  try {
    const preparation = await prepareNavigation(request, {
      containsSource: (path) => Boolean(vscode.workspace.getWorkspaceFolder(vscode.Uri.file(path))),
      persistPending: async (pending) => {
        await context.globalState.update(PENDING_NAVIGATION_KEY, {
          request: pending,
          requestedAt: Date.now(),
        } satisfies PendingNavigation);
      },
      openRepository: async (repo) => {
        const repository = await validateRepository(repo);
        await vscode.commands.executeCommand('vscode.openFolder', repository, false);
      },
    });
    if (preparation === 'ready') await navigateRequest(request);
    else await resumePendingNavigation(context);
  } catch (error) {
    await context.globalState.update(PENDING_NAVIGATION_KEY, undefined);
    const detail = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`DiffStory could not open the reviewed repository: ${detail}`);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerUriHandler({ handleUri: (uri) => navigate(uri, context) }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => { void resumePendingNavigation(context); }),
  );
  void resumePendingNavigation(context);
}
