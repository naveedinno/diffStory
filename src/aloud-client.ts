import { request as httpRequest } from 'node:http';

const DEFAULT_ALOUD_URL = 'http://127.0.0.1:17878';
const ALOUD_SERVICE = 'aloud-speech-daemon';
const ALOUD_PROTOCOL = 2;
const ALOUD_BATCH_CAPABILITY = 'explicit-batches';
const MAX_RESPONSE_BYTES = 256 * 1024;

export interface AloudStatus {
  jobId?: string;
  ok: true;
  paused: boolean;
  protocolVersion: number;
  rate?: number;
  running: boolean;
  service: string;
  state: {
    current?: number;
    message?: string;
    status?: 'starting' | 'generating' | 'reading' | 'done' | 'stopped' | 'error';
    total?: number;
  };
  [key: string]: unknown;
}

export interface AloudReader {
  control(action: 'pause' | 'resume' | 'stop'): Promise<AloudStatus>;
  speak(input: AloudSpeechRequest): Promise<AloudStatus>;
  status(): Promise<AloudStatus>;
}

export interface AloudSpeechRequest {
  batches?: string[];
  prefetch?: number;
  text: string;
}

export class AloudUnavailableError extends Error {
  readonly statusCode = 503;

  constructor(message = 'Aloud is not available. Open Aloud and install its Services to enable narration.') {
    super(message);
    this.name = 'AloudUnavailableError';
  }
}

export function createAloudReader(baseUrl = DEFAULT_ALOUD_URL): AloudReader {
  const status = async (): Promise<AloudStatus> => verifyStatus(await requestJson(baseUrl, 'GET', '/status'));
  return {
    status,
    async speak(input) {
      await verifyAloudDaemon(baseUrl);
      return verifyStatus(await requestJson(baseUrl, 'POST', '/speak', input));
    },
    async control(action) {
      await verifyAloudDaemon(baseUrl);
      const controlled = await requestJson(baseUrl, 'POST', `/${action}`, {});
      // Newer Aloud builds return the complete post-control state, avoiding a
      // second round trip. Keep the status fallback for installed v2 Services
      // that still return only a small acknowledgement.
      return isCompleteStatus(controlled) ? verifyStatus(controlled) : status();
    },
  };
}

async function verifyAloudDaemon(baseUrl: string): Promise<void> {
  const health = await requestJson(baseUrl, 'GET', '/health');
  if (!isAloudProtocol(health)) {
    throw new AloudUnavailableError('The local reader on port 17878 is not a compatible Aloud service.');
  }
  const capabilities = (health as { capabilities?: unknown }).capabilities;
  if (!Array.isArray(capabilities) || !capabilities.includes(ALOUD_BATCH_CAPABILITY)) {
    throw new AloudUnavailableError('Aloud needs an update before it can prefetch DiffStory narration. Reinstall Aloud Services, then try again.');
  }
}

function verifyStatus(value: unknown): AloudStatus {
  if (!isAloudProtocol(value) || typeof value !== 'object' || value === null) {
    throw new AloudUnavailableError('Aloud returned an incompatible reader status.');
  }
  const status = value as Partial<AloudStatus>;
  if (typeof status.running !== 'boolean' || typeof status.paused !== 'boolean' || typeof status.state !== 'object') {
    throw new AloudUnavailableError('Aloud returned an incomplete reader status.');
  }
  return status as AloudStatus;
}

function isCompleteStatus(value: unknown): boolean {
  const status = value as Partial<AloudStatus> | null;
  return isAloudProtocol(value)
    && typeof status?.running === 'boolean'
    && typeof status.paused === 'boolean'
    && typeof status.state === 'object'
    && status.state !== null;
}

function isAloudProtocol(value: unknown): boolean {
  const response = value as { ok?: unknown; protocolVersion?: unknown; service?: unknown } | null;
  return response?.ok === true
    && response.service === ALOUD_SERVICE
    && response.protocolVersion === ALOUD_PROTOCOL;
}

function requestJson(baseUrl: string, method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = httpRequest(new URL(path, baseUrl), {
      method,
      headers: payload === undefined ? undefined : {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 3_000,
    }, (res) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      res.on('data', (chunk) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        bytes += buffer.length;
        if (bytes > MAX_RESPONSE_BYTES) {
          req.destroy(new AloudUnavailableError('Aloud returned an unexpectedly large response.'));
          return;
        }
        chunks.push(buffer);
      });
      res.on('end', () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        } catch {
          reject(new AloudUnavailableError('Aloud returned an invalid response.'));
          return;
        }
        if ((res.statusCode ?? 500) >= 400) {
          const message = (parsed as { error?: unknown })?.error;
          reject(new AloudUnavailableError(typeof message === 'string' ? message : 'Aloud rejected the request.'));
          return;
        }
        resolve(parsed);
      });
    });
    req.on('timeout', () => req.destroy(new AloudUnavailableError('Aloud did not respond in time.')));
    req.on('error', (error) => {
      reject(error instanceof AloudUnavailableError ? error : new AloudUnavailableError());
    });
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}
