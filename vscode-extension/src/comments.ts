import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { isReviewComment, type CommentStatus, type CommentType, type ReviewComment } from './model';

function commentsPath(repo: vscode.Uri): string {
  return path.join(repo.fsPath, '.diffstory', 'comments.json');
}

export async function loadComments(repo: vscode.Uri): Promise<ReviewComment[]> {
  try {
    const raw: unknown = JSON.parse(await readFile(commentsPath(repo), 'utf8'));
    return Array.isArray(raw) ? raw.filter(isReviewComment) : [];
  } catch {
    return [];
  }
}

export async function saveComments(repo: vscode.Uri, comments: ReviewComment[]): Promise<void> {
  await mkdir(path.dirname(commentsPath(repo)), { recursive: true });
  await writeFile(commentsPath(repo), `${JSON.stringify(comments, null, 2)}\n`, 'utf8');
}

export async function setCommentStatus(
  repo: vscode.Uri,
  id: string,
  status: CommentStatus,
): Promise<ReviewComment | undefined> {
  const comments = await loadComments(repo);
  const comment = comments.find((candidate) => candidate.id === id);
  if (!comment) return undefined;
  comment.status = status;
  await saveComments(repo, comments);
  return comment;
}

export async function appendReviewerFollowUp(
  repo: vscode.Uri,
  id: string,
  text: string,
): Promise<ReviewComment | undefined> {
  const body = text.trim();
  if (!body) return undefined;
  const comments = await loadComments(repo);
  const comment = comments.find((candidate) => candidate.id === id);
  if (!comment) return undefined;
  comment.turns = [...(comment.turns ?? []), { role: 'user', text: body, at: new Date().toISOString() }];
  comment.status = 'open';
  await saveComments(repo, comments);
  return comment;
}

export function createComment(input: {
  file: string;
  selection: vscode.Selection;
  selectedText: string;
  body: string;
  type: CommentType;
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
    body: input.body.trim(),
    status: 'open',
    createdAt: new Date().toISOString(),
    anchorHash: createHash('sha256')
      .update(`${input.file}\0${side}\0${startLine}\0${input.selectedText}`)
      .digest('hex')
      .slice(0, 20),
  };
}

export function rangeFor(comment: ReviewComment): vscode.Range {
  const startLine = Math.max(0, (comment.selection?.startLine ?? comment.line) - 1);
  const endLine = Math.max(startLine, (comment.selection?.endLine ?? comment.line) - 1);
  const startColumn = Math.max(0, (comment.selection?.startColumn ?? 1) - 1);
  const endColumn = Math.max(startColumn + 1, comment.selection?.endColumn ?? startColumn + 1);
  return new vscode.Range(startLine, startColumn, endLine, endColumn);
}
