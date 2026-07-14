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
exports.captureReview = captureReview;
exports.recordReviewEvent = recordReviewEvent;
exports.reviewSummary = reviewSummary;
exports.reviewChangesSinceFeedback = reviewChangesSinceFeedback;
exports.saveReviewCursor = saveReviewCursor;
exports.markReviewFileSeen = markReviewFileSeen;
exports.reviewSeenFiles = reviewSeenFiles;
exports.reviewCursor = reviewCursor;
const node_child_process_1 = require("node:child_process");
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const path = __importStar(require("node:path"));
const node_util_1 = require("node:util");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
function statePath(repo) {
    return path.join(repo.fsPath, '.diffstory', 'review-state.json');
}
function keyFor(base, head) {
    return (0, node_crypto_1.createHash)('sha256').update(`${base}\0${head ?? 'working-tree'}`).digest('hex').slice(0, 20);
}
function hash(value) {
    return (0, node_crypto_1.createHash)('sha256').update(value == null ? '\0missing' : value).digest('hex');
}
async function load(repo) {
    try {
        const state = JSON.parse(await (0, promises_1.readFile)(statePath(repo), 'utf8'));
        if (!state || typeof state !== 'object' || Array.isArray(state))
            return emptyState();
        const candidate = state;
        if (candidate.version !== 1 || !candidate.scopes || typeof candidate.scopes !== 'object')
            return emptyState();
        for (const scope of Object.values(candidate.scopes))
            normalizeScope(scope);
        return candidate;
    }
    catch {
        return emptyState();
    }
}
function emptyState() {
    return { version: 1, scopes: {} };
}
function normalizeScope(scope) {
    scope.snapshots ??= [];
    scope.events ??= [];
    scope.seenFiles ??= [];
    for (const snapshot of scope.snapshots) {
        if (Array.isArray(snapshot.files)) {
            snapshot.files = Object.fromEntries(snapshot.files.map((file) => [file, { hash: hash(`legacy:${file}`), content: null }]));
        }
    }
}
async function save(repo, state) {
    await (0, promises_1.mkdir)(path.dirname(statePath(repo)), { recursive: true });
    await (0, promises_1.writeFile)(statePath(repo), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}
function scopeFor(state, base, head) {
    const key = keyFor(base, head);
    let scope = state.scopes[key];
    if (!scope) {
        scope = { key, base, ...(head ? { head } : {}), round: 1, snapshots: [], events: [] };
        state.scopes[key] = scope;
    }
    normalizeScope(scope);
    return scope;
}
function append(scope, kind, label, detail) {
    scope.events.push({ id: `event-${(0, node_crypto_1.randomUUID)().slice(0, 12)}`, at: new Date().toISOString(), round: scope.round, kind, label, ...(detail ? { detail } : {}) });
    scope.events = scope.events.slice(-100);
}
async function fileContent(repo, file, head) {
    try {
        if (!head)
            return await (0, promises_1.readFile)(path.join(repo.fsPath, ...file.split('/')), 'utf8');
        const { stdout } = await execFileAsync('git', ['show', `${head}:${file}`], { cwd: repo.fsPath, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
        return stdout;
    }
    catch {
        return null;
    }
}
async function currentFiles(repo, head, files, extra = []) {
    const paths = [...new Set([...files, ...extra])].sort();
    const entries = await Promise.all(paths.map(async (file) => {
        const content = await fileContent(repo, file, head);
        return [file, { hash: hash(content), content }];
    }));
    return Object.fromEntries(entries);
}
function changedPaths(before, after) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])]
        .filter((file) => before[file]?.hash !== after[file]?.hash)
        .sort();
}
async function captureReview(repo, input) {
    const state = await load(repo);
    const scope = scopeFor(state, input.base, input.head);
    const diffHash = hash(input.diff);
    const last = scope.snapshots.at(-1);
    const feedback = scope.snapshots.find((snapshot) => snapshot.id === scope.lastFeedbackSnapshotId);
    const files = await currentFiles(repo, input.head, input.files, feedback ? Object.keys(feedback.files) : []);
    if (input.reason === 'agent-complete' && feedback && feedback.diffHash !== diffHash)
        scope.round += 1;
    if (!last || last.diffHash !== diffHash || input.reason !== 'opened') {
        scope.snapshots.push({
            id: `snapshot-${(0, node_crypto_1.randomUUID)().slice(0, 12)}`,
            at: new Date().toISOString(),
            round: scope.round,
            reason: input.reason,
            diffHash,
            files,
        });
        scope.snapshots = scope.snapshots.slice(-20);
    }
    if (!scope.events.length)
        append(scope, 'review-started', 'Review started');
    if (input.reason === 'feedback-sent') {
        scope.lastFeedbackSnapshotId = scope.snapshots.at(-1)?.id;
        append(scope, 'feedback-sent', `Sent ${input.commentIds?.length ?? 0} review comments to the agent`);
    }
    if (input.reason === 'agent-complete')
        append(scope, 'agent-complete', 'Agent run completed');
    if (input.reason === 'story-generated')
        append(scope, 'story-generated', 'Generated a guided story');
    if (input.reason === 'story-repaired')
        append(scope, 'story-repaired', 'Repaired a story step');
    await save(repo, state);
    return summary(scope, files);
}
async function recordReviewEvent(repo, input) {
    const state = await load(repo);
    const scope = scopeFor(state, input.base, input.head);
    append(scope, input.kind, input.label, input.detail);
    await save(repo, state);
    return summary(scope, await currentFiles(repo, input.head, input.files ?? []));
}
async function reviewSummary(repo, base, head, files) {
    const state = await load(repo);
    return summary(scopeFor(state, base, head), await currentFiles(repo, head, files));
}
async function reviewChangesSinceFeedback(repo, input) {
    const state = await load(repo);
    const scope = scopeFor(state, input.base, input.head);
    const feedback = scope.snapshots.find((snapshot) => snapshot.id === scope.lastFeedbackSnapshotId);
    if (!feedback)
        return [];
    const current = await currentFiles(repo, input.head, input.files, Object.keys(feedback.files));
    return changedPaths(feedback.files, current).map((file) => ({
        file,
        before: feedback.files[file]?.content ?? null,
        after: current[file]?.content ?? null,
    }));
}
async function saveReviewCursor(repo, input) {
    const state = await load(repo);
    const scope = scopeFor(state, input.base, input.head);
    const cursor = { storyId: input.storyId, stepId: input.stepId, at: new Date().toISOString() };
    scope.cursors = { ...(scope.cursors ?? {}), [input.storyId]: cursor };
    await save(repo, state);
    return cursor;
}
async function markReviewFileSeen(repo, input) {
    const state = await load(repo);
    const scope = scopeFor(state, input.base, input.head);
    scope.seenFiles = [...new Set([...(scope.seenFiles ?? []), input.file])].slice(-500);
    await save(repo, state);
    return scope.seenFiles;
}
async function reviewSeenFiles(repo, base, head) {
    const state = await load(repo);
    return [...(scopeFor(state, base, head).seenFiles ?? [])];
}
async function reviewCursor(repo, base, head, storyId) {
    const state = await load(repo);
    return scopeFor(state, base, head).cursors?.[storyId];
}
function summary(scope, files) {
    const feedback = scope.snapshots.find((snapshot) => snapshot.id === scope.lastFeedbackSnapshotId);
    const changedFiles = feedback ? changedPaths(feedback.files, files) : [];
    return { round: scope.round, changedSinceReview: changedFiles.length, changedFiles, seenFiles: [...(scope.seenFiles ?? [])], events: [...scope.events].reverse() };
}
//# sourceMappingURL=review-state.js.map