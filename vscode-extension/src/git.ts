import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

export interface ChangedFile {
  path: string;
  status: string;
  oldPath?: string;
}

export interface ReviewRef {
  ref: string;
  label: string;
  description: string;
}

async function git(repo: vscode.Uri, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: repo.fsPath,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

async function tryGit(repo: vscode.Uri, args: string[]): Promise<string | undefined> {
  try {
    return await git(repo, args);
  } catch {
    return undefined;
  }
}

export async function isGitRepository(repo: vscode.Uri): Promise<boolean> {
  return (await tryGit(repo, ['rev-parse', '--is-inside-work-tree']))?.trim() === 'true';
}

/** Branches and recent commits suitable for an explicit review-scope picker. */
export async function reviewRefs(repo: vscode.Uri): Promise<ReviewRef[]> {
  const [branchOutput, commitOutput] = await Promise.all([
    tryGit(repo, ['for-each-ref', '--format=%(refname:short)%09%(subject)', '--sort=-committerdate', 'refs/heads', 'refs/remotes']),
    tryGit(repo, ['log', '-20', '--no-merges', '--pretty=format:%H%x09%s']),
  ]);
  const refs: ReviewRef[] = [{ ref: 'HEAD', label: 'HEAD', description: 'Current checked-out commit' }];
  const known = new Set(refs.map((candidate) => candidate.ref));
  for (const line of branchOutput?.split('\n') ?? []) {
    const [ref, subject = 'Branch'] = line.split('\t');
    if (!ref || ref.endsWith('/HEAD') || known.has(ref)) continue;
    known.add(ref);
    refs.push({ ref, label: ref, description: subject || 'Branch' });
  }
  for (const line of commitOutput?.split('\n') ?? []) {
    const [sha, subject = 'Commit'] = line.split('\t');
    if (!sha || known.has(sha)) continue;
    known.add(sha);
    refs.push({ ref: sha, label: `${sha.slice(0, 8)} · ${subject}`, description: sha });
  }
  return refs;
}

/** Mirrors diffStory's default enough for a workspace-native review. */
export async function resolveBase(repo: vscode.Uri, preferred?: string): Promise<string> {
  if (preferred && await tryGit(repo, ['rev-parse', '--verify', `${preferred}^{commit}`])) return preferred;

  const configured = vscode.workspace.getConfiguration('diffstory', repo).get<string>('defaultBase')?.trim();
  if (configured && await tryGit(repo, ['rev-parse', '--verify', `${configured}^{commit}`])) return configured;

  const hasHead = await tryGit(repo, ['rev-parse', '--verify', 'HEAD']);
  if (!hasHead) return '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

  const remoteHead = (await tryGit(repo, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']))
    ?.trim()
    .replace('refs/remotes/', '');
  const candidates = [remoteHead, 'origin/main', 'main', 'origin/master', 'master', 'origin/develop', 'develop']
    .filter((candidate): candidate is string => Boolean(candidate));
  const head = hasHead.trim();
  for (const candidate of candidates) {
    const mergeBase = (await tryGit(repo, ['merge-base', 'HEAD', candidate]))?.trim();
    if (mergeBase && mergeBase !== head) return mergeBase;
  }
  return 'HEAD';
}

export async function changedFiles(repo: vscode.Uri, base: string, head?: string): Promise<ChangedFile[]> {
  const args = ['diff', '--name-status', '-z', base];
  if (head) args.push(head);
  args.push('--', ':(exclude).diffstory/**');
  const output = await git(repo, args);
  const tokens = output.split('\0').filter(Boolean);
  const files: ChangedFile[] = [];
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++];
    if (!status) continue;
    // Renames/copies have source and target paths. Keep both so the native diff can read the correct base-side file.
    const oldPath = status.startsWith('R') || status.startsWith('C') ? tokens[index++] : undefined;
    const path = tokens[index++];
    if (path) files.push({ status, path, ...(oldPath ? { oldPath } : {}) });
  }
  if (head) return files;
  const untracked = (await git(repo, ['ls-files', '--others', '--exclude-standard', '-z']))
    .split('\0')
    .filter((file) => file && !file.startsWith('.diffstory/'));
  const known = new Set(files.map((file) => file.path));
  for (const file of untracked) {
    if (!known.has(file)) files.push({ status: '?', path: file });
  }
  return files;
}

export async function reviewDiff(repo: vscode.Uri, base: string, head?: string): Promise<string> {
  const args = ['diff', '--no-color', '--no-ext-diff', base];
  if (head) args.push(head);
  args.push('--', ':(exclude).diffstory/**');
  const tracked = await git(repo, args);
  if (head) return tracked;
  const untracked = (await git(repo, ['ls-files', '--others', '--exclude-standard', '-z']))
    .split('\0')
    .filter((file) => file && !file.startsWith('.diffstory/'));
  if (!untracked.length) return tracked;
  const additions = await Promise.all(untracked.map(async (file) => {
    try {
      const content = await readFile(path.join(repo.fsPath, file), 'utf8');
      if (content.includes('\0')) return '';
      const lines = content.endsWith('\n') ? content.slice(0, -1).split('\n') : content.split('\n');
      return `diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n${lines.map((line) => `+${line}`).join('\n')}\n`;
    } catch {
      // A generated, binary, or unreadable untracked file should not prevent the whole review from opening.
      return '';
    }
  }));
  return `${tracked}${additions.join('')}`;
}

export async function showFile(repo: vscode.Uri, ref: string, path: string): Promise<string | undefined> {
  return tryGit(repo, ['show', `${ref}:${path}`]);
}
