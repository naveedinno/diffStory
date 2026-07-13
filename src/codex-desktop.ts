import { randomUUID } from 'node:crypto';
import { createConnection, type Socket } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const MAX_FRAME_BYTES = 256 * 1024 * 1024;
const INITIAL_CLIENT_ID = 'initializing-client';
const START_TURN_VERSION = 1;

interface IpcResponse {
  type: 'response';
  requestId: string;
  resultType: 'success' | 'error';
  method?: string;
  error?: string;
  result?: unknown;
  handledByClientId?: string;
}

interface PendingRequest {
  resolve: (response: IpcResponse) => void;
  reject: (error: Error) => void;
}

export interface CodexDesktopTurnResult {
  threadId: string;
  handledByClientId?: string;
}

export function codexDesktopSocketPath(): string {
  const configured = process.env.DIFFSTORY_CODEX_IPC_SOCKET?.trim();
  if (configured) return configured;
  if (process.platform === 'win32') {
    throw new Error('Live Codex Desktop task messaging is not available on Windows yet.');
  }
  const uid = process.getuid?.();
  return join(tmpdir(), 'codex-ipc', uid ? `ipc-${uid}.sock` : 'ipc.sock');
}

function frame(message: unknown): Buffer {
  const json = JSON.stringify(message);
  const bytes = Buffer.byteLength(json, 'utf8');
  if (bytes === 0 || bytes > MAX_FRAME_BYTES) throw new Error('Codex Desktop IPC message is too large.');
  const output = Buffer.allocUnsafe(4 + bytes);
  output.writeUInt32LE(bytes, 0);
  output.write(json, 4, 'utf8');
  return output;
}

function desktopError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/ENOENT|ECONNREFUSED|connection-closed/i.test(message)) {
    return new Error('Codex Desktop is not reachable. Open the ChatGPT app and keep the selected task available, then try again.');
  }
  if (/no-client-found|client-cannot-handle-request/i.test(message)) {
    return new Error('The selected task has no live owner in the ChatGPT app. Open that task in ChatGPT, then try again.');
  }
  return new Error(`Could not send the message to the live ChatGPT task: ${message}`);
}

class DesktopIpcClient {
  private socket: Socket | null = null;
  private clientId = INITIAL_CLIENT_ID;
  private pending = new Map<string, PendingRequest>();
  private buffered: Buffer<ArrayBufferLike> = Buffer.alloc(0);

  constructor(private readonly socketPath: string, private readonly timeoutMs: number) {}

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = createConnection(this.socketPath);
      this.socket = socket;
      socket.once('connect', resolve);
      socket.once('error', reject);
      socket.on('data', (chunk) => this.read(chunk));
      socket.on('close', () => this.failAll(new Error('connection-closed')));
    });
    const initialized = await this.request('initialize', { clientType: 'diffstory' }, 0);
    if (initialized.resultType !== 'success' || initialized.method !== 'initialize') {
      throw new Error(initialized.error || 'Codex Desktop IPC initialization failed.');
    }
    const result = initialized.result as { clientId?: unknown } | undefined;
    if (typeof result?.clientId !== 'string' || !result.clientId) {
      throw new Error('Codex Desktop IPC did not return a client id.');
    }
    this.clientId = result.clientId;
  }

  request(method: string, params: Record<string, unknown>, version: number): Promise<IpcResponse> {
    const socket = this.socket;
    if (!socket?.writable) return Promise.reject(new Error('not-connected'));
    const requestId = randomUUID();
    return new Promise<IpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Timed out waiting for ${method}.`));
      }, this.timeoutMs);
      this.pending.set(requestId, {
        resolve: (response) => {
          clearTimeout(timer);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      socket.write(frame({
        type: 'request',
        requestId,
        sourceClientId: this.clientId,
        version,
        method,
        params,
        timeoutMs: this.timeoutMs,
      }));
    });
  }

  close(): void {
    this.socket?.destroy();
    this.socket = null;
  }

  private read(chunk: Buffer): void {
    this.buffered = this.buffered.length ? Buffer.concat([this.buffered, chunk]) : chunk;
    while (this.buffered.length >= 4) {
      const length = this.buffered.readUInt32LE(0);
      if (length === 0 || length > MAX_FRAME_BYTES) {
        this.failAll(new Error(`Invalid Codex Desktop IPC frame length: ${length}.`));
        this.close();
        return;
      }
      if (this.buffered.length < 4 + length) return;
      const payload = this.buffered.subarray(4, 4 + length);
      this.buffered = this.buffered.subarray(4 + length);
      try {
        this.handle(JSON.parse(payload.toString('utf8')));
      } catch (error) {
        this.failAll(error instanceof Error ? error : new Error(String(error)));
        this.close();
        return;
      }
    }
  }

  private handle(message: any): void {
    if (message?.type === 'client-discovery-request') {
      this.socket?.write(frame({
        type: 'client-discovery-response',
        requestId: message.requestId,
        response: { canHandle: false },
      }));
      return;
    }
    if (message?.type !== 'response' || typeof message.requestId !== 'string') return;
    const pending = this.pending.get(message.requestId);
    if (!pending) return;
    this.pending.delete(message.requestId);
    pending.resolve(message as IpcResponse);
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}

/** Send a normal visible user turn to the task currently owned by Codex Desktop. */
export async function sendCodexDesktopTurn(
  threadId: string,
  prompt: string,
  options: { socketPath?: string; timeoutMs?: number } = {},
): Promise<CodexDesktopTurnResult> {
  const client = new DesktopIpcClient(options.socketPath ?? codexDesktopSocketPath(), options.timeoutMs ?? 15_000);
  try {
    await client.connect();
    const response = await client.request(
      'thread-follower-start-turn',
      {
        conversationId: threadId,
        turnStartParams: {
          input: [{ type: 'text', text: prompt }],
          clientUserMessageId: randomUUID(),
        },
      },
      START_TURN_VERSION,
    );
    if (response.resultType !== 'success') throw new Error(response.error || 'Codex Desktop rejected the message.');
    return {
      threadId,
      ...(typeof response.handledByClientId === 'string'
        ? { handledByClientId: response.handledByClientId }
        : {}),
    };
  } catch (error) {
    throw desktopError(error);
  } finally {
    client.close();
  }
}
