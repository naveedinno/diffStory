// Read/write the reviewer's comments. This is the handoff file the agent consumes
// during /address-review, so the shape is deliberately stable and human-readable.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { commentsPath } from './config.js';
import type { Comment, CommentType } from './types.js';

const TYPES: CommentType[] = ['change', 'question', 'nit'];

export function loadComments(repo: string): Comment[] {
  const path = commentsPath(repo);
  if (!existsSync(path)) return [];
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(data) ? (data as Comment[]) : [];
  } catch {
    return [];
  }
}

function saveComments(repo: string, comments: Comment[]): void {
  const path = commentsPath(repo);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(comments, null, 2) + '\n', 'utf8');
}

export interface NewComment {
  step: string;
  file: string;
  line: number;
  type: string;
  body: string;
}

/** Validate + persist a new comment. Returns the stored comment or throws. */
export function addComment(repo: string, input: NewComment): Comment {
  if (!input || typeof input.body !== 'string' || !input.body.trim()) {
    throw new Error('comment body is required');
  }
  if (typeof input.file !== 'string' || !input.file) throw new Error('comment file is required');
  if (typeof input.step !== 'string' || !input.step) throw new Error('comment step is required');
  const type = TYPES.includes(input.type as CommentType) ? (input.type as CommentType) : 'change';

  const comment: Comment = {
    id: nextId(),
    step: input.step,
    file: input.file,
    line: Number.isFinite(input.line) ? Math.trunc(input.line) : 0,
    type,
    body: input.body.trim(),
    status: 'open',
    createdAt: new Date().toISOString(),
  };

  const comments = loadComments(repo);
  comments.push(comment);
  saveComments(repo, comments);
  return comment;
}

export function deleteComment(repo: string, id: string): boolean {
  const comments = loadComments(repo);
  const next = comments.filter((c) => c.id !== id);
  if (next.length === comments.length) return false;
  saveComments(repo, next);
  return true;
}

function nextId(): string {
  return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
