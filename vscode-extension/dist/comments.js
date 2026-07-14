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
exports.loadComments = loadComments;
exports.saveComments = saveComments;
exports.setCommentStatus = setCommentStatus;
exports.appendReviewerFollowUp = appendReviewerFollowUp;
exports.createComment = createComment;
exports.rangeFor = rangeFor;
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const path = __importStar(require("node:path"));
const vscode = __importStar(require("vscode"));
const model_1 = require("./model");
function commentsPath(repo) {
    return path.join(repo.fsPath, '.diffstory', 'comments.json');
}
async function loadComments(repo) {
    try {
        const raw = JSON.parse(await (0, promises_1.readFile)(commentsPath(repo), 'utf8'));
        return Array.isArray(raw) ? raw.filter(model_1.isReviewComment) : [];
    }
    catch {
        return [];
    }
}
async function saveComments(repo, comments) {
    await (0, promises_1.mkdir)(path.dirname(commentsPath(repo)), { recursive: true });
    await (0, promises_1.writeFile)(commentsPath(repo), `${JSON.stringify(comments, null, 2)}\n`, 'utf8');
}
async function setCommentStatus(repo, id, status) {
    const comments = await loadComments(repo);
    const comment = comments.find((candidate) => candidate.id === id);
    if (!comment)
        return undefined;
    comment.status = status;
    await saveComments(repo, comments);
    return comment;
}
async function appendReviewerFollowUp(repo, id, text) {
    const body = text.trim();
    if (!body)
        return undefined;
    const comments = await loadComments(repo);
    const comment = comments.find((candidate) => candidate.id === id);
    if (!comment)
        return undefined;
    comment.turns = [...(comment.turns ?? []), { role: 'user', text: body, at: new Date().toISOString() }];
    comment.status = 'open';
    await saveComments(repo, comments);
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
        body: input.body.trim(),
        status: 'open',
        createdAt: new Date().toISOString(),
        anchorHash: (0, node_crypto_1.createHash)('sha256')
            .update(`${input.file}\0${side}\0${startLine}\0${input.selectedText}`)
            .digest('hex')
            .slice(0, 20),
    };
}
function rangeFor(comment) {
    const startLine = Math.max(0, (comment.selection?.startLine ?? comment.line) - 1);
    const endLine = Math.max(startLine, (comment.selection?.endLine ?? comment.line) - 1);
    const startColumn = Math.max(0, (comment.selection?.startColumn ?? 1) - 1);
    const endColumn = Math.max(startColumn + 1, comment.selection?.endColumn ?? startColumn + 1);
    return new vscode.Range(startLine, startColumn, endLine, endColumn);
}
//# sourceMappingURL=comments.js.map