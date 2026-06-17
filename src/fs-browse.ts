// Server-side directory browser for the app picker. A web page can't read an
// absolute path back from the OS file dialog (browsers hide it), but the local
// server can — so the picker navigates the filesystem through this. Lists only
// subdirectories (never file contents), flags which are git repos, hides dotdirs.
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

export interface FsEntry {
  name: string;
  path: string;
  isGit: boolean;
}

export interface FsListing {
  path: string;
  parent: string | null;
  isGit: boolean;
  entries: FsEntry[];
}

/** List the immediate subdirectories of `input` (absolute), git-repos flagged. */
export function listDirs(input: string): FsListing {
  const path = resolve(input);
  let entries: FsEntry[] = [];
  try {
    entries = readdirSync(path, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => {
        const full = join(path, d.name);
        return { name: d.name, path: full, isGit: existsSync(join(full, '.git')) };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    entries = [];
  }
  // dirname('/') === '/', so the filesystem root reports a null parent.
  const parent = path === dirname(path) ? null : dirname(path);
  return { path, parent, isGit: existsSync(join(path, '.git')), entries };
}
