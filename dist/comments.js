// Read/write the reviewer's comments. This is the handoff file the agent consumes
// during /address-review, so the shape is deliberately stable and human-readable.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { commentsPath } from './config.js';
const TYPES = ['change', 'question', 'nit'];
const STATUSES = ['open', 'addressed', 'resolved'];
export function loadComments(repo) {
    const path = commentsPath(repo);
    if (!existsSync(path))
        return [];
    try {
        const data = JSON.parse(readFileSync(path, 'utf8'));
        return Array.isArray(data) ? data : [];
    }
    catch {
        return [];
    }
}
function saveComments(repo, comments) {
    const path = commentsPath(repo);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(comments, null, 2) + '\n', 'utf8');
}
/** Validate + persist a new comment. Returns the stored comment or throws. */
export function addComment(repo, input) {
    if (!input || typeof input.body !== 'string' || !input.body.trim()) {
        throw new Error('comment body is required');
    }
    if (typeof input.file !== 'string' || !input.file)
        throw new Error('comment file is required');
    const type = TYPES.includes(input.type) ? input.type : 'change';
    const comment = {
        id: nextId(),
        file: input.file,
        line: Number.isFinite(input.line) ? Math.trunc(input.line) : 0,
        type,
        body: input.body.trim(),
        status: 'open',
        createdAt: new Date().toISOString(),
    };
    if (typeof input.step === 'string' && input.step)
        comment.step = input.step;
    const comments = loadComments(repo);
    comments.push(comment);
    saveComments(repo, comments);
    return comment;
}
export function deleteComment(repo, id) {
    const comments = loadComments(repo);
    const next = comments.filter((c) => c.id !== id);
    if (next.length === comments.length)
        return false;
    saveComments(repo, next);
    return true;
}
/**
 * Update a comment's status (the reviewer resolving / reopening a thread).
 * Returns the updated comment, or null if no comment has that id. The agent's
 * `reply` and everything else is preserved.
 */
export function setCommentStatus(repo, id, status) {
    if (!STATUSES.includes(status)) {
        throw new Error(`status must be one of ${STATUSES.join(', ')}`);
    }
    const comments = loadComments(repo);
    const target = comments.find((c) => c.id === id);
    if (!target)
        return null;
    target.status = status;
    saveComments(repo, comments);
    return target;
}
function nextId() {
    return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
