import { isAbsolute, relative, resolve, sep } from 'node:path';

export interface NavigationRequest {
  repo: string;
  path: string;
  line: number;
  column: number;
}

export interface NavigationWorkspaceHost {
  containsSource(path: string): boolean;
  persistPending(request: NavigationRequest): Promise<void>;
  openRepository(repo: string): Promise<void>;
}

export type NavigationPreparation = 'ready' | 'opening-repository';

export interface NavigationPoint {
  line: number;
  character: number;
}

export function parseNavigationQuery(query: string): NavigationRequest | null {
  const params = new URLSearchParams(query);
  const repo = params.get('repo') ?? '';
  const path = params.get('path') ?? '';
  const line = Number(params.get('line'));
  const column = Number(params.get('column'));
  if (
    !repo || repo.length > 4096 || !isAbsolute(repo) ||
    !path || path.length > 4096 || !isAbsolute(path) ||
    !Number.isInteger(line) || line < 1 || line > 10_000_000 ||
    !Number.isInteger(column) || column < 1 || column > 10_000_000
  ) {
    return null;
  }
  const root = resolve(repo);
  const target = resolve(path);
  const fromRoot = relative(root, target);
  if (!fromRoot || fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    return null;
  }
  return { repo: root, path: target, line, column };
}

/** Persist before opening the repository because VS Code may restart this
 * extension host as soon as the workspace changes. Activation resumes the
 * pending request in the reviewed workspace. */
export async function prepareNavigation(
  request: NavigationRequest,
  host: NavigationWorkspaceHost,
): Promise<NavigationPreparation> {
  if (host.containsSource(request.path)) return 'ready';
  await host.persistPending(request);
  await host.openRepository(request.repo);
  return 'opening-repository';
}

/** Convert DiffStory's 1-based source location to VS Code's 0-based caret,
 * clamping stale locations to the nearest position the opened file can show. */
export function clampNavigationPoint(
  request: NavigationRequest,
  lineCount: number,
  lineLengthAt: (line: number) => number,
): NavigationPoint {
  const line = Math.min(request.line - 1, Math.max(0, lineCount - 1));
  const character = Math.min(request.column - 1, Math.max(0, lineLengthAt(line)));
  return { line, character };
}
