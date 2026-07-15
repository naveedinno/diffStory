import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, watch, type FSWatcher } from 'node:fs';
import { basename, join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  COMMENTS_FILENAME,
  DATA_DIR,
  LEGACY_STORY_FILENAME,
  LIVE_DEBOUNCE_MS,
  LIVE_HEARTBEAT_MS,
  LIVE_POLL_MS,
  REVIEW_STATE_FILENAME,
  STORY_FILENAME,
} from './config.js';
import { reviewChangeFingerprint } from './git.js';
import type { ReviewPageLease } from './session.js';

export type LiveEventType =
  | 'state'
  | 'comments-changed'
  | 'review-state-changed'
  | 'story-changed'
  | 'story-synced'
  | 'diff-changed'
  | 'diff-synced';

interface WatchHandle {
  close(): void;
  on(event: 'error', listener: (error: Error) => void): unknown;
}

export interface LiveHubDependencies {
  debounceMs: number;
  pollMs: number;
  heartbeatMs: number;
  fingerprint(repo: string, base: string, head?: string): string;
  storyFingerprint(path: string): string;
  pathExists(path: string): boolean;
  watchDirectory(path: string, listener: (event: string, filename: string | Buffer | null) => void): WatchHandle;
  setTimer(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
  clearTimer(timer: ReturnType<typeof setTimeout>): void;
  leaseActive(token: string): boolean;
}

interface LiveClient {
  lease: ReviewPageLease;
  request: IncomingMessage;
  response: ServerResponse;
  closed: boolean;
  diffStale: boolean;
  storyStale: boolean;
}

interface WatchGroup {
  repo: string;
  clients: Set<LiveClient>;
  dataWatcher?: WatchHandle;
  storiesWatcher?: WatchHandle;
  pollTimer?: ReturnType<typeof setTimeout>;
  heartbeatTimer?: ReturnType<typeof setTimeout>;
  debounceTimers: Map<string, ReturnType<typeof setTimeout>>;
  signatures: Map<string, string>;
  disposed: boolean;
}

const defaultDependencies: Omit<LiveHubDependencies, 'leaseActive'> = {
  debounceMs: LIVE_DEBOUNCE_MS,
  pollMs: LIVE_POLL_MS,
  heartbeatMs: LIVE_HEARTBEAT_MS,
  fingerprint: reviewChangeFingerprint,
  storyFingerprint: storyFileFingerprint,
  pathExists: existsSync,
  watchDirectory: (path, listener) => watch(path, listener) as FSWatcher,
  setTimer: (callback, delay) => setTimeout(callback, delay),
  clearTimer: (timer) => clearTimeout(timer),
};

export function storyFileFingerprint(path: string): string {
  if (!existsSync(path)) return 'missing';
  try {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
  } catch (error) {
    return `unreadable:${error instanceof Error ? error.message : String(error)}`;
  }
}

function fileSignature(path: string): string {
  try {
    const stat = statSync(path, { bigint: true });
    return `${stat.mtimeNs}:${stat.size}:${stat.ino}`;
  } catch {
    return 'missing';
  }
}

function eventPayload(type: LiveEventType, data: object): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

export class LiveEventHub {
  private readonly groups = new Map<string, WatchGroup>();
  private readonly deps: LiveHubDependencies;

  constructor(deps: Pick<LiveHubDependencies, 'leaseActive'> & Partial<LiveHubDependencies>) {
    this.deps = { ...defaultDependencies, ...deps };
  }

  get activeGroups(): number {
    return this.groups.size;
  }

  get activeClients(): number {
    let total = 0;
    for (const group of this.groups.values()) total += group.clients.size;
    return total;
  }

  connect(lease: ReviewPageLease, request: IncomingMessage, response: ServerResponse): void {
    const group = this.groupFor(lease.repo);
    const currentFingerprint = this.safeFingerprint(lease);
    const currentStoryFingerprint = this.deps.storyFingerprint(lease.storyPath);
    const client: LiveClient = {
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

  closeRepo(repo: string): void {
    const group = this.groups.get(repo);
    if (group) this.disposeGroup(group, true);
  }

  dispose(): void {
    for (const group of [...this.groups.values()]) this.disposeGroup(group, true);
  }

  private groupFor(repo: string): WatchGroup {
    const existing = this.groups.get(repo);
    if (existing) return existing;
    const group: WatchGroup = {
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

  private attachWatchers(group: WatchGroup): void {
    const dataPath = join(group.repo, DATA_DIR);
    if (group.dataWatcher && !this.deps.pathExists(dataPath)) {
      try { group.dataWatcher.close(); } catch { /* already closed */ }
      group.dataWatcher = undefined;
    }
    if (!group.dataWatcher && this.deps.pathExists(dataPath)) {
      group.dataWatcher = this.openWatcher(group, dataPath, (_event, filename) => {
        const name = filename ? String(filename) : '';
        if (!name) {
          this.queueInvalidation(group, 'comments');
          this.queueInvalidation(group, 'review-state');
          this.queueInvalidation(group, 'story');
        } else if (name === COMMENTS_FILENAME) {
          this.queueInvalidation(group, 'comments');
        } else if (name === REVIEW_STATE_FILENAME) {
          this.queueInvalidation(group, 'review-state');
        } else if (name === STORY_FILENAME || name === LEGACY_STORY_FILENAME) {
          this.queueInvalidation(group, 'story');
        } else if (name === 'stories') {
          this.queueInvalidation(group, 'story');
          this.attachWatchers(group);
        }
      });
    }

    const storiesPath = join(dataPath, 'stories');
    if (group.storiesWatcher && !this.deps.pathExists(storiesPath)) {
      try { group.storiesWatcher.close(); } catch { /* already closed */ }
      group.storiesWatcher = undefined;
    }
    if (!group.storiesWatcher && this.deps.pathExists(storiesPath)) {
      group.storiesWatcher = this.openWatcher(group, storiesPath, () => {
        this.queueInvalidation(group, 'story');
      });
    }
  }

  private openWatcher(
    group: WatchGroup,
    path: string,
    listener: (event: string, filename: string | Buffer | null) => void,
  ): WatchHandle | undefined {
    try {
      const watcher = this.deps.watchDirectory(path, listener);
      watcher.on('error', () => {
        try { watcher.close(); } catch { /* already closed */ }
        if (basename(path) === 'stories') group.storiesWatcher = undefined;
        else group.dataWatcher = undefined;
      });
      return watcher;
    } catch {
      return undefined;
    }
  }

  private queueInvalidation(group: WatchGroup, kind: 'comments' | 'review-state' | 'story'): void {
    const existing = group.debounceTimers.get(kind);
    if (existing) this.deps.clearTimer(existing);
    const timer = this.deps.setTimer(() => {
      group.debounceTimers.delete(kind);
      if (group.disposed) return;
      if (kind === 'comments') {
        group.signatures.set(COMMENTS_FILENAME, fileSignature(join(group.repo, DATA_DIR, COMMENTS_FILENAME)));
        this.broadcast(group, 'comments-changed', {});
      } else if (kind === 'review-state') {
        group.signatures.set(REVIEW_STATE_FILENAME, fileSignature(join(group.repo, DATA_DIR, REVIEW_STATE_FILENAME)));
        this.broadcast(group, 'review-state-changed', {});
      } else {
        this.evaluateStories(group);
      }
    }, this.deps.debounceMs);
    group.debounceTimers.set(kind, timer);
  }

  private captureSignatures(group: WatchGroup): void {
    for (const name of [COMMENTS_FILENAME, REVIEW_STATE_FILENAME]) {
      group.signatures.set(name, fileSignature(join(group.repo, DATA_DIR, name)));
    }
  }

  private schedulePoll(group: WatchGroup): void {
    if (group.disposed) return;
    group.pollTimer = this.deps.setTimer(() => {
      group.pollTimer = undefined;
      this.poll(group);
      this.schedulePoll(group);
    }, this.deps.pollMs);
  }

  private poll(group: WatchGroup): void {
    if (group.disposed) return;
    this.attachWatchers(group);
    for (const name of [COMMENTS_FILENAME, REVIEW_STATE_FILENAME]) {
      const signature = fileSignature(join(group.repo, DATA_DIR, name));
      if (signature !== group.signatures.get(name)) {
        group.signatures.set(name, signature);
        this.broadcast(group, name === COMMENTS_FILENAME ? 'comments-changed' : 'review-state-changed', {});
      }
    }

    const fingerprints = new Map<string, string | null>();
    for (const client of [...group.clients]) {
      if (!this.deps.leaseActive(client.lease.token)) {
        this.closeClient(group, client);
        continue;
      }
      const key = `${client.lease.base}\0${client.lease.head ?? ''}`;
      if (!fingerprints.has(key)) fingerprints.set(key, this.safeFingerprint(client.lease));
      const current = fingerprints.get(key);
      if (current !== null && current !== undefined) this.transitionDiff(client, current);
    }
    this.evaluateStories(group);
  }

  private evaluateStories(group: WatchGroup): void {
    for (const client of [...group.clients]) {
      const current = this.deps.storyFingerprint(client.lease.storyPath);
      const stale = current !== client.lease.storyFingerprint;
      if (stale === client.storyStale) continue;
      client.storyStale = stale;
      this.send(client, stale ? 'story-changed' : 'story-synced', {});
    }
  }

  private transitionDiff(client: LiveClient, fingerprint: string): void {
    const stale = fingerprint !== client.lease.fingerprint;
    if (stale === client.diffStale) return;
    client.diffStale = stale;
    this.send(client, stale ? 'diff-changed' : 'diff-synced', { fingerprint });
  }

  private safeFingerprint(lease: ReviewPageLease): string | null {
    try {
      return this.deps.fingerprint(lease.repo, lease.base, lease.head);
    } catch {
      return null;
    }
  }

  private scheduleHeartbeat(group: WatchGroup): void {
    if (group.disposed) return;
    group.heartbeatTimer = this.deps.setTimer(() => {
      group.heartbeatTimer = undefined;
      for (const client of [...group.clients]) {
        if (!client.closed) client.response.write(': ping\n\n');
      }
      this.scheduleHeartbeat(group);
    }, this.deps.heartbeatMs);
  }

  private broadcast(group: WatchGroup, type: LiveEventType, data: object): void {
    for (const client of [...group.clients]) this.send(client, type, data);
  }

  private send(client: LiveClient, type: LiveEventType, data: object): void {
    if (client.closed) return;
    try {
      client.response.write(eventPayload(type, data));
    } catch {
      client.closed = true;
    }
  }

  private closeClient(group: WatchGroup, client: LiveClient): void {
    if (!client.closed) {
      client.closed = true;
      client.response.end();
    }
    this.removeClient(group, client);
  }

  private removeClient(group: WatchGroup, client: LiveClient): void {
    if (!group.clients.delete(client)) return;
    client.closed = true;
    if (group.clients.size === 0) this.disposeGroup(group, false);
  }

  private disposeGroup(group: WatchGroup, closeClients: boolean): void {
    if (group.disposed) return;
    group.disposed = true;
    if (group.pollTimer) this.deps.clearTimer(group.pollTimer);
    if (group.heartbeatTimer) this.deps.clearTimer(group.heartbeatTimer);
    for (const timer of group.debounceTimers.values()) this.deps.clearTimer(timer);
    try { group.dataWatcher?.close(); } catch { /* already closed */ }
    try { group.storiesWatcher?.close(); } catch { /* already closed */ }
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
