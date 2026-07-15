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
exports.ReviewFeedbackChangedError = exports.UnresolvedBlockingFeedbackError = void 0;
exports.captureReview = captureReview;
exports.recordReviewEvent = recordReviewEvent;
exports.reviewSummary = reviewSummary;
exports.reviewHistory = reviewHistory;
exports.recordReviewVerdict = recordReviewVerdict;
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
const comments_1 = require("./comments");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
class UnresolvedBlockingFeedbackError extends Error {
    blockingCommentIds;
    constructor(blockingCommentIds) {
        super(`Resolve ${blockingCommentIds.length} blocking ${blockingCommentIds.length === 1 ? 'comment' : 'comments'} before approval.`);
        this.blockingCommentIds = blockingCommentIds;
        this.name = 'UnresolvedBlockingFeedbackError';
    }
}
exports.UnresolvedBlockingFeedbackError = UnresolvedBlockingFeedbackError;
class ReviewFeedbackChangedError extends Error {
    currentFeedbackVersion;
    currentBlockingFeedbackDigest;
    constructor(currentFeedbackVersion, currentBlockingFeedbackDigest) {
        super('Blocking feedback changed while the decision was being saved. Refresh before approval.');
        this.currentFeedbackVersion = currentFeedbackVersion;
        this.currentBlockingFeedbackDigest = currentBlockingFeedbackDigest;
        this.name = 'ReviewFeedbackChangedError';
    }
}
exports.ReviewFeedbackChangedError = ReviewFeedbackChangedError;
function statePath(repo) {
    return path.join(repo.fsPath, '.diffstory', 'review-state.json');
}
function keyFor(base, head) {
    return (0, node_crypto_1.createHash)('sha256').update(`${base}\0${head ?? 'working-tree'}`).digest('hex').slice(0, 20);
}
function digest(value) {
    return (0, node_crypto_1.createHash)('sha256').update(value == null ? '\0missing' : value).digest('hex');
}
async function load(repo) {
    try {
        const value = JSON.parse(await (0, promises_1.readFile)(statePath(repo), 'utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value))
            return emptyState();
        const candidate = value;
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
    scope.verdicts ??= [];
    for (const snapshot of scope.snapshots) {
        const legacy = snapshot;
        snapshot.createdAt ??= legacy.at ?? new Date(0).toISOString();
        snapshot.base ??= scope.base;
        if (legacy.reason === 'story-generated')
            snapshot.reason = 'opened';
        if (Array.isArray(snapshot.files)) {
            snapshot.files = Object.fromEntries(snapshot.files.map((file) => [file, { hash: digest(`legacy:${file}`), content: null }]));
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
        scope = { key, base, ...(head ? { head } : {}), round: 1, snapshots: [], events: [], verdicts: [], seenFiles: [] };
        state.scopes[key] = scope;
    }
    normalizeScope(scope);
    return scope;
}
function append(scope, event) {
    const stored = { id: `e_${(0, node_crypto_1.randomUUID)().slice(0, 12)}`, at: new Date().toISOString(), round: scope.round, ...event };
    scope.events.push(stored);
    scope.events = scope.events.slice(-100);
    if (event.affectsApproval)
        scope.feedbackVersion = (scope.feedbackVersion ?? 0) + 1;
    return stored;
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
        return [file, { hash: digest(content), content }];
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
    const reason = input.reason === 'story-generated' ? 'opened' : input.reason;
    const diffHash = input.changeFingerprint ?? digest(input.diff);
    const last = scope.snapshots.at(-1);
    const feedback = scope.snapshots.find((snapshot) => snapshot.id === scope.lastFeedbackSnapshotId);
    const files = await currentFiles(repo, input.head, input.files, feedback ? Object.keys(feedback.files) : []);
    if (reason === 'agent-complete' && feedback && feedback.diffHash !== diffHash)
        scope.round += 1;
    if (!last || last.diffHash !== diffHash || reason !== 'opened') {
        scope.snapshots.push({
            id: `r_${Date.now().toString(36)}_${diffHash.slice(0, 8)}`,
            createdAt: new Date().toISOString(),
            round: scope.round,
            reason,
            base: input.base,
            ...(input.head ? { head: input.head } : {}),
            diffHash,
            files,
            ...(input.commentIds?.length ? { commentIds: [...new Set(input.commentIds)] } : {}),
        });
        scope.snapshots = scope.snapshots.slice(-20);
    }
    if (!scope.events.length)
        append(scope, { kind: 'review-started', label: 'Review started' });
    if (reason === 'feedback-sent') {
        scope.lastFeedbackSnapshotId = scope.snapshots.at(-1)?.id;
        append(scope, { kind: 'feedback-sent', label: `Sent ${input.commentIds?.length ?? 0} review comments to the agent` });
    }
    if (reason === 'agent-complete') {
        const changed = feedback ? changedPaths(feedback.files, files) : [];
        append(scope, { kind: 'agent-complete', label: changed.length ? `Agent updated ${changed.length} ${changed.length === 1 ? 'file' : 'files'}` : 'Agent replied', ...(changed.length ? { detail: changed.join(', ') } : {}) });
    }
    if (input.reason === 'story-generated')
        append(scope, { kind: 'story-repaired', label: 'Generated a guided story' });
    if (reason === 'story-repaired')
        append(scope, { kind: 'story-repaired', label: 'Story repaired' });
    await save(repo, state);
    return summarize(repo, scope, input.diff, files, input.changeFingerprint);
}
async function recordReviewEvent(repo, input) {
    const state = await load(repo);
    const scope = scopeFor(state, input.base, input.head);
    const observation = await feedbackObservation(repo);
    setFeedbackObservation(scope, observation);
    append(scope, { kind: input.kind, label: input.label, ...(input.detail ? { detail: input.detail } : {}), ...(input.affectsApproval ? { affectsApproval: true } : {}) });
    await save(repo, state);
    return summarize(repo, scope, '', await currentFiles(repo, input.head, input.files ?? []));
}
async function reviewSummary(repo, input) {
    const state = await load(repo);
    const scope = scopeFor(state, input.base, input.head);
    const observation = await feedbackObservation(repo);
    if (synchronizeFeedbackObservation(scope, observation))
        await save(repo, state);
    const feedback = scope.snapshots.find((snapshot) => snapshot.id === scope.lastFeedbackSnapshotId);
    const files = await currentFiles(repo, input.head, input.files, feedback ? Object.keys(feedback.files) : []);
    return summarize(repo, scope, input.diff, files, input.changeFingerprint, observation);
}
/** Read every persisted comparison without creating or mutating review state. */
async function reviewHistory(repo) {
    const state = await load(repo);
    return Object.values(state.scopes)
        .map((scope) => {
        normalizeScope(scope);
        const snapshots = [...scope.snapshots];
        const events = [...scope.events];
        const verdicts = [...(scope.verdicts ?? [])];
        const cursors = Object.values(scope.cursors ?? {});
        const timestamps = [
            ...snapshots.map((snapshot) => snapshot.createdAt),
            ...events.map((event) => event.at),
            ...verdicts.map((verdict) => verdict.createdAt),
            ...cursors.map((cursor) => cursor.at),
        ].filter(Boolean).sort();
        const startedAt = timestamps[0] ?? new Date(0).toISOString();
        const lastActivityAt = timestamps.at(-1) ?? startedAt;
        return {
            scopeKey: scope.key,
            base: scope.base,
            ...(scope.head ? { head: scope.head } : {}),
            round: scope.round,
            snapshotCount: snapshots.length,
            latestSnapshotFiles: Object.keys(snapshots.at(-1)?.files ?? {}).length,
            seenFiles: scope.seenFiles?.length ?? 0,
            startedAt,
            lastActivityAt,
            ...(verdicts.at(-1) ? { latestVerdict: verdicts.at(-1) } : {}),
            events: events.slice(-12).reverse(),
        };
    })
        .sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt));
}
async function recordReviewVerdict(repo, input) {
    const state = await load(repo);
    const scope = scopeFor(state, input.base, input.head);
    const loaded = await (0, comments_1.loadCommentsWithHealth)(repo);
    const observation = await feedbackObservation(repo, loaded);
    if (synchronizeFeedbackObservation(scope, observation))
        await save(repo, state);
    if (input.decision === 'approved' && loaded.health.status === 'invalid')
        throw new comments_1.InvalidCommentStoreError(loaded.health);
    if (input.decision === 'approved') {
        const blockers = loaded.comments.filter((comment) => comment.status !== 'resolved' && (0, comments_1.commentSeverity)(comment) === 'blocking').map((comment) => comment.id);
        if (blockers.length)
            throw new UnresolvedBlockingFeedbackError(blockers);
        if (input.expectedFeedbackVersion !== undefined && input.expectedFeedbackVersion !== (scope.feedbackVersion ?? 0)) {
            throw new ReviewFeedbackChangedError(scope.feedbackVersion ?? 0, observation.blockingDigest);
        }
        if (input.expectedBlockingFeedbackDigest !== undefined && input.expectedBlockingFeedbackDigest !== observation.blockingDigest) {
            throw new ReviewFeedbackChangedError(scope.feedbackVersion ?? 0, observation.blockingDigest);
        }
    }
    const fingerprint = input.changeFingerprint ?? digest(input.diff);
    const verdict = {
        id: `v_${Date.now().toString(36)}_${fingerprint.slice(0, 8)}_${(0, node_crypto_1.randomUUID)().slice(0, 4)}`,
        decision: input.decision,
        createdAt: new Date().toISOString(),
        scopeKey: scope.key,
        base: input.base,
        ...(input.head ? { head: input.head } : {}),
        diffFingerprint: fingerprint,
        feedbackVersion: scope.feedbackVersion ?? 0,
        blockingFeedbackDigest: observation.blockingDigest,
        ...(input.acknowledgedExclusions?.length ? { acknowledgedExclusions: input.acknowledgedExclusions } : {}),
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    };
    scope.verdicts = [...(scope.verdicts ?? []), verdict].slice(-50);
    append(scope, { kind: 'verdict-recorded', label: input.decision === 'approved' ? 'Review approved' : 'Changes requested', ...(verdict.note ? { detail: verdict.note } : {}) });
    await save(repo, state);
    return verdict;
}
async function reviewChangesSinceFeedback(repo, input) {
    const state = await load(repo);
    const scope = scopeFor(state, input.base, input.head);
    const feedback = scope.snapshots.find((snapshot) => snapshot.id === scope.lastFeedbackSnapshotId);
    if (!feedback)
        return [];
    const current = await currentFiles(repo, input.head, input.files, Object.keys(feedback.files));
    return changedPaths(feedback.files, current).map((file) => ({ file, before: feedback.files[file]?.content ?? null, after: current[file]?.content ?? null }));
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
function evaluateVerdict(scope, base, head, fingerprint, blockingDigest) {
    const latest = scope.verdicts?.at(-1);
    if (!latest)
        return { state: 'none', scopeKey: scope.key, currentDiffFingerprint: fingerprint };
    const stale = (reason) => ({ state: 'stale', scopeKey: scope.key, currentDiffFingerprint: fingerprint, latest, invalidationReason: reason });
    if (latest.scopeKey !== keyFor(base, head))
        return stale('scope-changed');
    if (latest.diffFingerprint !== fingerprint)
        return stale('diff-changed');
    if ((latest.feedbackVersion ?? 0) !== (scope.feedbackVersion ?? 0) || latest.blockingFeedbackDigest !== blockingDigest)
        return stale('feedback-changed');
    return { state: 'current', scopeKey: scope.key, currentDiffFingerprint: fingerprint, latest, current: latest };
}
async function feedbackObservation(repo, supplied) {
    const loaded = supplied ?? await (0, comments_1.loadCommentsWithHealth)(repo);
    let sourceStamp;
    try {
        const info = await (0, promises_1.stat)(path.join(repo.fsPath, '.diffstory', 'comments.json'), { bigint: true });
        sourceStamp = digest(JSON.stringify({ source: loaded.sourceDigest, ino: info.ino.toString(), size: info.size.toString(), mtime: info.mtimeNs.toString(), ctime: info.ctimeNs.toString() }));
    }
    catch {
        sourceStamp = digest(JSON.stringify({ source: loaded.sourceDigest, health: loaded.health.status }));
    }
    const blocking = loaded.health.status === 'invalid'
        ? [{ invalid: loaded.sourceDigest, reason: loaded.health.reason }]
        : loaded.comments.filter((comment) => comment.status !== 'resolved' && (0, comments_1.commentSeverity)(comment) === 'blocking').sort((a, b) => a.id.localeCompare(b.id));
    return { sourceDigest: loaded.sourceDigest, sourceStamp, blockingDigest: digest(stableJson(blocking)) };
}
function setFeedbackObservation(scope, observation) {
    const changed = scope.observedFeedbackSourceDigest !== observation.sourceDigest || scope.observedFeedbackSourceStamp !== observation.sourceStamp || scope.observedBlockingFeedbackDigest !== observation.blockingDigest;
    scope.observedFeedbackSourceDigest = observation.sourceDigest;
    scope.observedFeedbackSourceStamp = observation.sourceStamp;
    scope.observedBlockingFeedbackDigest = observation.blockingDigest;
    return changed;
}
function synchronizeFeedbackObservation(scope, observation) {
    const initialized = scope.observedFeedbackSourceDigest !== undefined && scope.observedFeedbackSourceStamp !== undefined && scope.observedBlockingFeedbackDigest !== undefined;
    const sourceChanged = initialized && scope.observedFeedbackSourceDigest !== observation.sourceDigest;
    const stampChanged = initialized && scope.observedFeedbackSourceStamp !== observation.sourceStamp;
    const blockingChanged = initialized && scope.observedBlockingFeedbackDigest !== observation.blockingDigest;
    const advances = blockingChanged || (!sourceChanged && stampChanged);
    if (advances)
        scope.feedbackVersion = (scope.feedbackVersion ?? 0) + 1;
    return setFeedbackObservation(scope, observation) || advances;
}
async function summarize(repo, scope, diff, files, changeFingerprint, suppliedObservation) {
    const observation = suppliedObservation ?? await feedbackObservation(repo);
    const feedback = scope.snapshots.find((snapshot) => snapshot.id === scope.lastFeedbackSnapshotId);
    const changedFiles = feedback ? changedPaths(feedback.files, files) : [];
    const fingerprint = changeFingerprint ?? digest(diff);
    const loaded = await (0, comments_1.loadCommentsWithHealth)(repo);
    return {
        scopeKey: scope.key,
        round: scope.round,
        currentDiffHash: fingerprint,
        ...(scope.snapshots.at(-1) ? { currentSnapshotId: scope.snapshots.at(-1)?.id } : {}),
        changedSinceReview: changedFiles.length,
        changedFiles,
        seenFiles: [...(scope.seenFiles ?? [])],
        events: [...scope.events].reverse(),
        verdict: evaluateVerdict(scope, scope.base, scope.head, fingerprint, observation.blockingDigest),
        feedbackVersion: scope.feedbackVersion ?? 0,
        blockingFeedbackDigest: observation.blockingDigest,
        feedbackHealth: loaded.health,
    };
}
function stableJson(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(stableJson).join(',')}]`;
    const record = value;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}
//# sourceMappingURL=review-state.js.map