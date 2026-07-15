import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import type * as vscode from 'vscode';
import {
  isReviewComment,
  type CommentSeverity,
  type CommentStatus,
  type CommentType,
  type ReviewComment,
} from './model';

export type CommentStoreHealth =
  | { status: 'healthy'; source: 'missing' | 'file' }
  | {
      status: 'invalid';
      reason: 'unreadable' | 'invalid-json' | 'not-array' | 'invalid-entry';
      message: string;
      recovery: string;
      entryIndex?: number;
    };

export interface CommentLoadResult {
  comments: ReviewComment[];
  health: CommentStoreHealth;
  sourceDigest: string;
}

const INVALID_RECOVERY = 'Repair or restore .diffstory/comments.json, then refresh. DiffStory will not overwrite the invalid file.';

export class InvalidCommentStoreError extends Error {
  constructor(readonly health: Extract<CommentStoreHealth, { status: 'invalid' }>) {
    super(`${health.message} ${health.recovery}`);
    this.name = 'InvalidCommentStoreError';
  }
}

function commentsPath(repo: vscode.Uri): string {
  return path.join(repo.fsPath, '.diffstory', 'comments.json');
}

export async function loadCommentsWithHealth(repo: vscode.Uri): Promise<CommentLoadResult> {
  let raw: string;
  try {
    raw = await readFile(commentsPath(repo), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { comments: [], health: { status: 'healthy', source: 'missing' }, sourceDigest: hashSource(null) };
    }
    return invalidLoad('unreadable', `Could not read .diffstory/comments.json: ${(error as Error).message}`, null);
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return invalidLoad('invalid-json', '.diffstory/comments.json is not valid JSON.', raw);
  }
  if (!Array.isArray(value)) return invalidLoad('not-array', '.diffstory/comments.json must contain a JSON array.', raw);
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const candidate = value[index];
    if (!isReviewComment(candidate) || seen.has(candidate.id)) {
      return invalidLoad('invalid-entry', `.diffstory/comments.json has an invalid or duplicate comment at array index ${index}.`, raw, index);
    }
    seen.add(candidate.id);
  }
  return {
    comments: (value as ReviewComment[]).map(normalizeComment),
    health: { status: 'healthy', source: 'file' },
    sourceDigest: hashSource(raw),
  };
}

export async function loadComments(repo: vscode.Uri): Promise<ReviewComment[]> {
  return (await loadCommentsWithHealth(repo)).comments;
}

export async function saveComments(repo: vscode.Uri, comments: ReviewComment[], expectedSourceDigest?: string): Promise<void> {
  const current = await loadCommentsWithHealth(repo);
  if (current.health.status === 'invalid') throw new InvalidCommentStoreError(current.health);
  if (expectedSourceDigest !== undefined && current.sourceDigest !== expectedSourceDigest) {
    throw new Error('Review feedback changed while this action was being saved. Refresh and try again.');
  }
  await mkdir(path.dirname(commentsPath(repo)), { recursive: true });
  await writeFile(commentsPath(repo), `${JSON.stringify(comments, null, 2)}\n`, 'utf8');
}

export async function setCommentStatus(repo: vscode.Uri, id: string, status: CommentStatus): Promise<ReviewComment | undefined> {
  const loaded = await writableComments(repo);
  const comment = loaded.comments.find((candidate) => candidate.id === id);
  if (!comment) return undefined;
  comment.status = status;
  await saveComments(repo, loaded.comments, loaded.sourceDigest);
  return comment;
}

export async function deleteComment(repo: vscode.Uri, id: string): Promise<boolean> {
  const loaded = await writableComments(repo);
  const comments = loaded.comments.filter((candidate) => candidate.id !== id);
  if (comments.length === loaded.comments.length) return false;
  await saveComments(repo, comments, loaded.sourceDigest);
  return true;
}

export async function appendReviewerFollowUp(repo: vscode.Uri, id: string, text: string): Promise<ReviewComment | undefined> {
  const body = text.trim();
  if (!body) return undefined;
  const loaded = await writableComments(repo);
  const comment = loaded.comments.find((candidate) => candidate.id === id);
  if (!comment) return undefined;
  comment.turns = [...(comment.turns ?? []), { role: 'user', text: body, at: new Date().toISOString() }];
  comment.status = 'open';
  await saveComments(repo, loaded.comments, loaded.sourceDigest);
  return comment;
}

export function createComment(input: {
  file: string;
  selection: vscode.Selection;
  selectedText: string;
  body: string;
  type: CommentType;
  severity: CommentSeverity;
  reviewRound?: number;
  reviewSnapshotId?: string;
  step?: string;
  side?: 'left' | 'right';
}): ReviewComment {
  const startLine = input.selection.start.line + 1;
  const endLine = input.selection.end.line + 1;
  const side = input.side ?? 'right';
  return {
    id: `comment-${randomUUID().slice(0, 12)}`,
    ...(input.step ? { step: input.step } : {}),
    side,
    file: input.file,
    line: startLine,
    selectedText: input.selectedText,
    selection: {
      startLine,
      endLine,
      startColumn: input.selection.start.character + 1,
      endColumn: input.selection.end.character + 1,
    },
    type: input.type,
    severity: input.severity,
    body: input.body.trim(),
    status: 'open',
    ...(input.reviewRound ? { reviewRound: input.reviewRound } : {}),
    ...(input.reviewSnapshotId ? { reviewSnapshotId: input.reviewSnapshotId } : {}),
    createdAt: new Date().toISOString(),
    anchorHash: createHash('sha256')
      .update(`${input.file}\0${side}\0${startLine}\0${input.selectedText}`)
      .digest('hex')
      .slice(0, 20),
  };
}

export function commentSeverity(comment: ReviewComment): CommentSeverity {
  return comment.severity ?? (comment.type === 'change' ? 'blocking' : comment.type === 'nit' ? 'nit' : 'concern');
}

export function rangeFor(comment: ReviewComment): vscode.Range {
  const startLine = Math.max(0, (comment.selection?.startLine ?? comment.line) - 1);
  const endLine = Math.max(startLine, (comment.selection?.endLine ?? comment.line) - 1);
  const startColumn = Math.max(0, (comment.selection?.startColumn ?? 1) - 1);
  const endColumn = Math.max(startColumn + 1, comment.selection?.endColumn ?? startColumn + 1);
  const api = require('vscode') as typeof vscode;
  return new api.Range(startLine, startColumn, endLine, endColumn);
}

function normalizeComment(comment: ReviewComment): ReviewComment {
  if (comment.turns?.length || !comment.reply?.trim()) return comment;
  return { ...comment, turns: [{ role: 'ai', text: comment.reply, at: comment.createdAt }] };
}

async function writableComments(repo: vscode.Uri): Promise<CommentLoadResult> {
  const loaded = await loadCommentsWithHealth(repo);
  if (loaded.health.status === 'invalid') throw new InvalidCommentStoreError(loaded.health);
  return loaded;
}

function invalidLoad(
  reason: Extract<CommentStoreHealth, { status: 'invalid' }>['reason'],
  message: string,
  raw: string | null,
  entryIndex?: number,
): CommentLoadResult {
  return {
    comments: [],
    health: { status: 'invalid', reason, message, recovery: INVALID_RECOVERY, ...(entryIndex === undefined ? {} : { entryIndex }) },
    sourceDigest: hashSource(raw),
  };
}

function hashSource(raw: string | null): string {
  return createHash('sha256').update(raw === null ? '\0missing-or-unreadable' : raw).digest('hex');
}
