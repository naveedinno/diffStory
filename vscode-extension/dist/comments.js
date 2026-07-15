"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidCommentStoreError = void 0;
exports.loadCommentsWithHealth = loadCommentsWithHealth;
exports.loadComments = loadComments;
exports.saveComments = saveComments;
exports.setCommentStatus = setCommentStatus;
exports.deleteComment = deleteComment;
exports.appendReviewerFollowUp = appendReviewerFollowUp;
exports.createComment = createComment;
exports.commentSeverity = commentSeverity;
exports.rangeFor = rangeFor;
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const path = __importStar(require("node:path"));
const model_1 = require("./model");
const INVALID_RECOVERY = 'Repair or restore .diffstory/comments.json, then refresh. DiffStory will not overwrite the invalid file.';
class InvalidCommentStoreError extends Error {
    health;
    constructor(health) {
        super(`${health.message} ${health.recovery}`);
        this.health = health;
        this.name = 'InvalidCommentStoreError';
    }
}
exports.InvalidCommentStoreError = InvalidCommentStoreError;
function commentsPath(repo) {
    return path.join(repo.fsPath, '.diffstory', 'comments.json');
}
async function loadCommentsWithHealth(repo) {
    let raw;
    try {
        raw = await (0, promises_1.readFile)(commentsPath(repo), 'utf8');
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return { comments: [], health: { status: 'healthy', source: 'missing' }, sourceDigest: hashSource(null) };
        }
        return invalidLoad('unreadable', `Could not read .diffstory/comments.json: ${error.message}`, null);
    }
    let value;
    try {
        value = JSON.parse(raw);
    }
    catch {
        return invalidLoad('invalid-json', '.diffstory/comments.json is not valid JSON.', raw);
    }
    if (!Array.isArray(value))
        return invalidLoad('not-array', '.diffstory/comments.json must contain a JSON array.', raw);
    const seen = new Set();
    for (let index = 0; index < value.length; index += 1) {
        const candidate = value[index];
        if (!(0, model_1.isReviewComment)(candidate) || seen.has(candidate.id)) {
            return invalidLoad('invalid-entry', `.diffstory/comments.json has an invalid or duplicate comment at array index ${index}.`, raw, index);
        }
        seen.add(candidate.id);
    }
    return {
        comments: value.map(normalizeComment),
        health: { status: 'healthy', source: 'file' },
        sourceDigest: hashSource(raw),
    };
}
async function loadComments(repo) {
    return (await loadCommentsWithHealth(repo)).comments;
}
async function saveComments(repo, comments, expectedSourceDigest) {
    const current = await loadCommentsWithHealth(repo);
    if (current.health.status === 'invalid')
        throw new InvalidCommentStoreError(current.health);
    if (expectedSourceDigest !== undefined && current.sourceDigest !== expectedSourceDigest) {
        throw new Error('Review feedback changed while this action was being saved. Refresh and try again.');
    }
    await (0, promises_1.mkdir)(path.dirname(commentsPath(repo)), { recursive: true });
    await (0, promises_1.writeFile)(commentsPath(repo), `${JSON.stringify(comments, null, 2)}\n`, 'utf8');
}
async function setCommentStatus(repo, id, status) {
    const loaded = await writableComments(repo);
    const comment = loaded.comments.find((candidate) => candidate.id === id);
    if (!comment)
        return undefined;
    comment.status = status;
    await saveComments(repo, loaded.comments, loaded.sourceDigest);
    return comment;
}
async function deleteComment(repo, id) {
    const loaded = await writableComments(repo);
    const comments = loaded.comments.filter((candidate) => candidate.id !== id);
    if (comments.length === loaded.comments.length)
        return false;
    await saveComments(repo, comments, loaded.sourceDigest);
    return true;
}
async function appendReviewerFollowUp(repo, id, text) {
    const body = text.trim();
    if (!body)
        return undefined;
    const loaded = await writableComments(repo);
    const comment = loaded.comments.find((candidate) => candidate.id === id);
    if (!comment)
        return undefined;
    comment.turns = [...(comment.turns ?? []), { role: 'user', text: body, at: new Date().toISOString() }];
    comment.status = 'open';
    await saveComments(repo, loaded.comments, loaded.sourceDigest);
    return comment;
}
function createComment(input) {
    const startLine = input.selection.start.line + 1;
    const endLine = input.selection.end.line + 1;
    const side = input.side ?? 'right';
    return {
        id: `comment-${(0, node_crypto_1.randomUUID)().slice(0, 12)}`,
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
        anchorHash: (0, node_crypto_1.createHash)('sha256')
            .update(`${input.file}\0${side}\0${startLine}\0${input.selectedText}`)
            .digest('hex')
            .slice(0, 20),
    };
}
function commentSeverity(comment) {
    return comment.severity ?? (comment.type === 'change' ? 'blocking' : comment.type === 'nit' ? 'nit' : 'concern');
}
function rangeFor(comment) {
    const startLine = Math.max(0, (comment.selection?.startLine ?? comment.line) - 1);
    const endLine = Math.max(startLine, (comment.selection?.endLine ?? comment.line) - 1);
    const startColumn = Math.max(0, (comment.selection?.startColumn ?? 1) - 1);
    const endColumn = Math.max(startColumn + 1, comment.selection?.endColumn ?? startColumn + 1);
    const api = require('vscode');
    return new api.Range(startLine, startColumn, endLine, endColumn);
}
function normalizeComment(comment) {
    if (comment.turns?.length || !comment.reply?.trim())
        return comment;
    return { ...comment, turns: [{ role: 'ai', text: comment.reply, at: comment.createdAt }] };
}
async function writableComments(repo) {
    const loaded = await loadCommentsWithHealth(repo);
    if (loaded.health.status === 'invalid')
        throw new InvalidCommentStoreError(loaded.health);
    return loaded;
}
function invalidLoad(reason, message, raw, entryIndex) {
    return {
        comments: [],
        health: { status: 'invalid', reason, message, recovery: INVALID_RECOVERY, ...(entryIndex === undefined ? {} : { entryIndex }) },
        sourceDigest: hashSource(raw),
    };
}
function hashSource(raw) {
    return (0, node_crypto_1.createHash)('sha256').update(raw === null ? '\0missing-or-unreadable' : raw).digest('hex');
}
//# sourceMappingURL=comments.js.map