import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, watch } from 'node:fs';
import { basename, join } from 'node:path';
import { COMMENTS_FILENAME, DATA_DIR, LEGACY_STORY_FILENAME, LIVE_DEBOUNCE_MS, LIVE_HEARTBEAT_MS, LIVE_POLL_MS, REVIEW_STATE_FILENAME, STORY_FILENAME, } from './config.js';
import { reviewChangeFingerprint } from './git.js';
const defaultDependencies = {
    debounceMs: LIVE_DEBOUNCE_MS,
    pollMs: LIVE_POLL_MS,
    heartbeatMs: LIVE_HEARTBEAT_MS,
    fingerprint: reviewChangeFingerprint,
    storyFingerprint: storyFileFingerprint,
    pathExists: existsSync,
    watchDirectory: (path, listener) => watch(path, listener),
    setTimer: (callback, delay) => setTimeout(callback, delay),
    clearTimer: (timer) => clearTimeout(timer),
};
export function storyFileFingerprint(path) {
    if (!existsSync(path))
        return 'missing';
    try {
        return createHash('sha256').update(readFileSync(path)).digest('hex');
    }
    catch (error) {
        return `unreadable:${error instanceof Error ? error.message : String(error)}`;
    }
}
function fileSignature(path) {
    try {
        const stat = statSync(path, { bigint: true });
        return `${stat.mtimeNs}:${stat.size}:${stat.ino}`;
    }
    catch {
        return 'missing';
    }
}
function eventPayload(type, data) {
    return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}
export class LiveEventHub {
    groups = new Map();
    deps;
    constructor(deps) {
        this.deps = { ...defaultDependencies, ...deps };
    }
    get activeGroups() {
        return this.groups.size;
    }
    get activeClients() {
        let total = 0;
        for (const group of this.groups.values())
            total += group.clients.size;
        return total;
    }
    connect(lease, request, response) {
        const group = this.groupFor(lease.repo);
        const currentFingerprint = this.safeFingerprint(lease);
        const currentStoryFingerprint = this.deps.storyFingerprint(lease.storyPath);
        const client = {
            lease,
            request,
            response,
            closed: false,
            diffStale: currentFingerprint !== null && currentFingerprint !== lease.fingerprint,
            storyStale: currentStoryFingerprint !== lease.storyFingerprint,
        };
        group.clients.add(client);
        response.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-store',
            Connection: 'keep-alive',
        });
        response.flushHeaders();
        response.write('retry: 1500\n\n');
        this.send(client, 'state', {
            fingerprint: currentFingerprint ?? lease.fingerprint,
            diffChanged: client.diffStale,
            storyChanged: client.storyStale,
        });
        const close = () => this.removeClient(group, client);
        request.once('aborted', close);
        response.once('close', close);
    }
    closeRepo(repo) {
        const group = this.groups.get(repo);
        if (group)
            this.disposeGroup(group, true);
    }
    dispose() {
        for (const group of [...this.groups.values()])
            this.disposeGroup(group, true);
    }
    groupFor(repo) {
        const existing = this.groups.get(repo);
        if (existing)
            return existing;
        const group = {
            repo,
            clients: new Set(),
            debounceTimers: new Map(),
            signatures: new Map(),
            disposed: false,
        };
        this.groups.set(repo, group);
        this.captureSignatures(group);
        this.attachWatchers(group);
        this.schedulePoll(group);
        this.scheduleHeartbeat(group);
        return group;
    }
    attachWatchers(group) {
        const dataPath = join(group.repo, DATA_DIR);
        if (group.dataWatcher && !this.deps.pathExists(dataPath)) {
            try {
                group.dataWatcher.close();
            }
            catch { /* already closed */ }
            group.dataWatcher = undefined;
        }
        if (!group.dataWatcher && this.deps.pathExists(dataPath)) {
            group.dataWatcher = this.openWatcher(group, dataPath, (_event, filename) => {
                const name = filename ? String(filename) : '';
                if (!name) {
                    this.queueInvalidation(group, 'comments');
                    this.queueInvalidation(group, 'review-state');
                    this.queueInvalidation(group, 'story');
                }
                else if (name === COMMENTS_FILENAME) {
                    this.queueInvalidation(group, 'comments');
                }
                else if (name === REVIEW_STATE_FILENAME) {
                    this.queueInvalidation(group, 'review-state');
                }
                else if (name === STORY_FILENAME || name === LEGACY_STORY_FILENAME) {
                    this.queueInvalidation(group, 'story');
                }
                else if (name === 'stories') {
                    this.queueInvalidation(group, 'story');
                    this.attachWatchers(group);
                }
            });
        }
        const storiesPath = join(dataPath, 'stories');
        if (group.storiesWatcher && !this.deps.pathExists(storiesPath)) {
            try {
                group.storiesWatcher.close();
            }
            catch { /* already closed */ }
            group.storiesWatcher = undefined;
        }
        if (!group.storiesWatcher && this.deps.pathExists(storiesPath)) {
            group.storiesWatcher = this.openWatcher(group, storiesPath, () => {
                this.queueInvalidation(group, 'story');
            });
        }
    }
    openWatcher(group, path, listener) {
        try {
            const watcher = this.deps.watchDirectory(path, listener);
            watcher.on('error', () => {
                try {
                    watcher.close();
                }
                catch { /* already closed */ }
                if (basename(path) === 'stories')
                    group.storiesWatcher = undefined;
                else
                    group.dataWatcher = undefined;
            });
            return watcher;
        }
        catch {
            return undefined;
        }
    }
    queueInvalidation(group, kind) {
        const existing = group.debounceTimers.get(kind);
        if (existing)
            this.deps.clearTimer(existing);
        const timer = this.deps.setTimer(() => {
            group.debounceTimers.delete(kind);
            if (group.disposed)
                return;
            if (kind === 'comments') {
                group.signatures.set(COMMENTS_FILENAME, fileSignature(join(group.repo, DATA_DIR, COMMENTS_FILENAME)));
                this.broadcast(group, 'comments-changed', {});
            }
            else if (kind === 'review-state') {
                group.signatures.set(REVIEW_STATE_FILENAME, fileSignature(join(group.repo, DATA_DIR, REVIEW_STATE_FILENAME)));
                this.broadcast(group, 'review-state-changed', {});
            }
            else {
                this.evaluateStories(group);
            }
        }, this.deps.debounceMs);
        group.debounceTimers.set(kind, timer);
    }
    captureSignatures(group) {
        for (const name of [COMMENTS_FILENAME, REVIEW_STATE_FILENAME]) {
            group.signatures.set(name, fileSignature(join(group.repo, DATA_DIR, name)));
        }
    }
    schedulePoll(group) {
        if (group.disposed)
            return;
        group.pollTimer = this.deps.setTimer(() => {
            group.pollTimer = undefined;
            this.poll(group);
            this.schedulePoll(group);
        }, this.deps.pollMs);
    }
    poll(group) {
        if (group.disposed)
            return;
        this.attachWatchers(group);
        for (const name of [COMMENTS_FILENAME, REVIEW_STATE_FILENAME]) {
            const signature = fileSignature(join(group.repo, DATA_DIR, name));
            if (signature !== group.signatures.get(name)) {
                group.signatures.set(name, signature);
                this.broadcast(group, name === COMMENTS_FILENAME ? 'comments-changed' : 'review-state-changed', {});
            }
        }
        const fingerprints = new Map();
        for (const client of [...group.clients]) {
            if (!this.deps.leaseActive(client.lease.token)) {
                this.closeClient(group, client);
                continue;
            }
            const key = `${client.lease.base}\0${client.lease.head ?? ''}`;
            if (!fingerprints.has(key))
                fingerprints.set(key, this.safeFingerprint(client.lease));
            const current = fingerprints.get(key);
            if (current !== null && current !== undefined)
                this.transitionDiff(client, current);
        }
        this.evaluateStories(group);
    }
    evaluateStories(group) {
        for (const client of [...group.clients]) {
            const current = this.deps.storyFingerprint(client.lease.storyPath);
            const stale = current !== client.lease.storyFingerprint;
            if (stale === client.storyStale)
                continue;
            client.storyStale = stale;
            this.send(client, stale ? 'story-changed' : 'story-synced', {});
        }
    }
    transitionDiff(client, fingerprint) {
        const stale = fingerprint !== client.lease.fingerprint;
        if (stale === client.diffStale)
            return;
        client.diffStale = stale;
        this.send(client, stale ? 'diff-changed' : 'diff-synced', { fingerprint });
    }
    safeFingerprint(lease) {
        try {
            return this.deps.fingerprint(lease.repo, lease.base, lease.head);
        }
        catch {
            return null;
        }
    }
    scheduleHeartbeat(group) {
        if (group.disposed)
            return;
        group.heartbeatTimer = this.deps.setTimer(() => {
            group.heartbeatTimer = undefined;
            for (const client of [...group.clients]) {
                if (!client.closed)
                    client.response.write(': ping\n\n');
            }
            this.scheduleHeartbeat(group);
        }, this.deps.heartbeatMs);
    }
    broadcast(group, type, data) {
        for (const client of [...group.clients])
            this.send(client, type, data);
    }
    send(client, type, data) {
        if (client.closed)
            return;
        try {
            client.response.write(eventPayload(type, data));
        }
        catch {
            client.closed = true;
        }
    }
    closeClient(group, client) {
        if (!client.closed) {
            client.closed = true;
            client.response.end();
        }
        this.removeClient(group, client);
    }
    removeClient(group, client) {
        if (!group.clients.delete(client))
            return;
        client.closed = true;
        if (group.clients.size === 0)
            this.disposeGroup(group, false);
    }
    disposeGroup(group, closeClients) {
        if (group.disposed)
            return;
        group.disposed = true;
        if (group.pollTimer)
            this.deps.clearTimer(group.pollTimer);
        if (group.heartbeatTimer)
            this.deps.clearTimer(group.heartbeatTimer);
        for (const timer of group.debounceTimers.values())
            this.deps.clearTimer(timer);
        try {
            group.dataWatcher?.close();
        }
        catch { /* already closed */ }
        try {
            group.storiesWatcher?.close();
        }
        catch { /* already closed */ }
        if (closeClients) {
            for (const client of [...group.clients]) {
                client.closed = true;
                client.response.end();
            }
        }
        group.clients.clear();
        this.groups.delete(group.repo);
    }
}
