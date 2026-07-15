import { readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { parseTour, type Tour } from './model';

export interface StorySummary {
  id: string;
  uri: vscode.Uri;
  title: string;
  summary: string;
  updatedAt: number;
  valid: boolean;
  error?: string;
  story?: Tour;
}

const PRIMARY = 'story.json';
const LEGACY = 'review-tour.json';

function dataDir(repo: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(repo, '.diffstory');
}

export async function listStories(repo: vscode.Uri): Promise<StorySummary[]> {
  const ids = [PRIMARY, LEGACY, ...await nestedStoryIds(repo)];
  const summaries = await Promise.all(ids.map((id) => loadStory(repo, id)));
  return summaries.filter((story): story is StorySummary => Boolean(story));
}

export async function loadStory(repo: vscode.Uri, id = PRIMARY): Promise<StorySummary | undefined> {
  if (!safeId(id)) return undefined;
  const uri = vscode.Uri.joinPath(dataDir(repo), ...id.split('/'));
  try {
    const [contents, info] = await Promise.all([readFile(uri.fsPath, 'utf8'), stat(uri.fsPath)]);
    const story = parseTour(JSON.parse(contents));
    if (!story) return { id, uri, title: path.basename(id, '.json'), summary: '', updatedAt: info.mtimeMs, valid: false, error: 'Unsupported story schema' };
    return { id, uri, title: story.title, summary: story.summary, updatedAt: info.mtimeMs, valid: true, story };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return undefined;
    return { id, uri, title: path.basename(id, '.json'), summary: '', updatedAt: 0, valid: false, error: (error as Error).message };
  }
}

export async function deleteStory(repo: vscode.Uri, id: string): Promise<boolean> {
  if (!safeId(id)) return false;
  try {
    await unlink(vscode.Uri.joinPath(dataDir(repo), ...id.split('/')).fsPath);
    return true;
  } catch {
    return false;
  }
}

/** Stamp agent-written stories with the same exact-diff identity used by the web app. */
export async function stampStoryFingerprint(repo: vscode.Uri, id: string, fingerprint: string, storyScope?: Tour['storyScope']): Promise<boolean> {
  if (!safeId(id) || !/^[0-9a-f]{64}$/i.test(fingerprint)) return false;
  const uri = vscode.Uri.joinPath(dataDir(repo), ...id.split('/'));
  try {
    const parsed: unknown = JSON.parse(await readFile(uri.fsPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    (parsed as Record<string, unknown>).diffFingerprint = fingerprint.toLowerCase();
    if (storyScope) (parsed as Record<string, unknown>).storyScope = storyScope;
    await writeFile(uri.fsPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    return true;
  } catch {
    return false;
  }
}

async function nestedStoryIds(repo: vscode.Uri): Promise<string[]> {
  const root = path.join(repo.fsPath, '.diffstory', 'stories');
  const ids: string[] = [];
  const visit = async (dir: string, prefix = ''): Promise<void> => {
    let entries: import('node:fs').Dirent[];
    try { entries = await readdir(dir, { withFileTypes: true, encoding: 'utf8' }); } catch { return; }
    await Promise.all(entries.map(async (entry) => {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return visit(full, relative);
      if (entry.isFile() && entry.name.endsWith('.json')) ids.push(`stories/${relative}`);
    }));
  };
  await visit(root);
  return ids.sort((a, b) => a.localeCompare(b));
}

function safeId(id: string): boolean {
  return Boolean(id) && !id.startsWith('/') && !id.includes('\\') && !id.split('/').includes('..') && id.endsWith('.json');
}
