import * as vscode from 'vscode';
import { parseNavigationQuery } from './navigation.js';

interface NavigationTarget {
  uri: vscode.Uri;
  selection: vscode.Range;
}

function toTarget(location: vscode.Location | vscode.LocationLink): NavigationTarget {
  if ('targetUri' in location) {
    return { uri: location.targetUri, selection: location.targetSelectionRange ?? location.targetRange };
  }
  return { uri: location.uri, selection: location.range };
}

function uniqueTargets(locations: readonly (vscode.Location | vscode.LocationLink)[] | undefined): NavigationTarget[] {
  const targets: NavigationTarget[] = [];
  const seen = new Set<string>();
  for (const location of locations ?? []) {
    const target = toTarget(location);
    const key = `${target.uri.toString()}#${target.selection.start.line}:${target.selection.start.character}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push(target);
  }
  return targets;
}

async function providerTargets(
  command: 'vscode.executeImplementationProvider' | 'vscode.executeDefinitionProvider',
  source: vscode.Uri,
  position: vscode.Position,
): Promise<NavigationTarget[]> {
  try {
    const locations = await vscode.commands.executeCommand<readonly (vscode.Location | vscode.LocationLink)[] | undefined>(
      command,
      source,
      position,
    );
    return uniqueTargets(locations);
  } catch {
    return [];
  }
}

async function chooseTarget(targets: NavigationTarget[], kind: 'implementation' | 'definition'): Promise<NavigationTarget | undefined> {
  if (targets.length < 2) return targets[0];
  const selected = await vscode.window.showQuickPick(
    targets.map((target) => ({
      label: vscode.workspace.asRelativePath(target.uri, false),
      description: `line ${target.selection.start.line + 1}`,
      detail: target.uri.fsPath,
      target,
    })),
    { placeHolder: `Choose ${kind}` },
  );
  return selected?.target;
}

async function openTarget(target: NavigationTarget): Promise<void> {
  await vscode.window.showTextDocument(target.uri, {
    preview: true,
    preserveFocus: false,
    selection: target.selection,
  });
}

async function navigate(uri: vscode.Uri): Promise<void> {
  if (uri.path !== '/navigate') return;
  const request = parseNavigationQuery(uri.query);
  if (!request) {
    await vscode.window.showErrorMessage('DiffStory sent an invalid code-navigation request.');
    return;
  }

  try {
    const source = vscode.Uri.file(request.path);
    if (!vscode.workspace.getWorkspaceFolder(source)) {
      await vscode.window.showErrorMessage('Open the reviewed repository in VS Code before navigating from DiffStory.');
      return;
    }
    const document = await vscode.workspace.openTextDocument(source);
    const line = Math.min(request.line - 1, Math.max(0, document.lineCount - 1));
    const character = Math.min(request.column - 1, document.lineAt(line).text.length);
    const position = new vscode.Position(line, character);
    const sourceSelection = new vscode.Range(position, position);
    // Activating the source editor gives installed language extensions the same
    // context they receive before a normal F12/Cmd-click navigation request.
    await vscode.window.showTextDocument(document, {
      preview: true,
      preserveFocus: false,
      selection: sourceSelection,
    });

    const implementations = await providerTargets('vscode.executeImplementationProvider', source, position);
    const implementation = await chooseTarget(implementations, 'implementation');
    if (implementation) {
      await openTarget(implementation);
      return;
    }

    const definitions = await providerTargets('vscode.executeDefinitionProvider', source, position);
    const definition = await chooseTarget(definitions, 'definition');
    if (definition) {
      await openTarget(definition);
      return;
    }

    await vscode.window.showInformationMessage('No implementation or definition was reported; opened the clicked symbol instead.');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`DiffStory could not open that symbol: ${detail}`);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(vscode.window.registerUriHandler({ handleUri: navigate }));
}
