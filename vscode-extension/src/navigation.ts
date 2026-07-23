import { isAbsolute } from 'node:path';

export interface NavigationRequest {
  path: string;
  line: number;
  column: number;
}

export function parseNavigationQuery(query: string): NavigationRequest | null {
  const params = new URLSearchParams(query);
  const path = params.get('path') ?? '';
  const line = Number(params.get('line'));
  const column = Number(params.get('column'));
  if (
    !path || path.length > 4096 || !isAbsolute(path) ||
    !Number.isInteger(line) || line < 1 || line > 10_000_000 ||
    !Number.isInteger(column) || column < 1 || column > 10_000_000
  ) {
    return null;
  }
  return { path, line, column };
}
