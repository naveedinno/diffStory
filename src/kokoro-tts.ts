import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const KOKORO_MAX_TEXT = 5000;
const DEFAULT_PYTHON = 'python3';
const KOKORO_HELPER = String.raw`import sys

out_path = sys.argv[1]
voice = sys.argv[2]
speed = float(sys.argv[3])
lang_code = sys.argv[4]
text = sys.stdin.read().strip()

try:
    from kokoro import KPipeline
    import numpy as np
    import soundfile as sf
except Exception as exc:
    raise RuntimeError(
        'Kokoro AI voice is optional. Run: npm run setup:kokoro, or install espeak-ng and Python packages into Python 3.10-3.12: python3 -m pip install "kokoro>=0.9.4" soundfile'
    ) from exc

pipeline = KPipeline(lang_code=lang_code)
chunks = []
for result in pipeline(text, voice=voice, speed=speed, split_pattern=r'\n+'):
    audio = result[2] if isinstance(result, tuple) else getattr(result, 'audio', None)
    if audio is None:
        continue
    if hasattr(audio, 'detach'):
        audio = audio.detach().cpu().numpy()
    else:
        audio = np.asarray(audio)
    chunks.append(audio)

if not chunks:
    raise RuntimeError('Kokoro produced no audio.')

audio = chunks[0] if len(chunks) == 1 else np.concatenate(chunks)
sf.write(out_path, audio, 24000)
`;

export interface KokoroTtsRequest {
  text: string;
  voice?: string;
  rate?: number;
}

export interface KokoroTtsCacheEntry {
  dir: string;
  id: string;
  path: string;
  voice: KokoroVoice;
  langCode: KokoroLangCode;
  rate: number;
}

export const KOKORO_VOICES = {
  af_heart: { label: 'Heart', description: 'Warm American female narrator.', langCode: 'a' },
  af_bella: { label: 'Bella', description: 'Clear American female voice.', langCode: 'a' },
  af_nicole: { label: 'Nicole', description: 'Calm American female voice.', langCode: 'a' },
  af_sarah: { label: 'Sarah', description: 'Steady American female voice.', langCode: 'a' },
  am_adam: { label: 'Adam', description: 'Natural American male voice.', langCode: 'a' },
  am_onyx: { label: 'Onyx', description: 'Deeper American male voice.', langCode: 'a' },
  bf_emma: { label: 'Emma', description: 'British female narrator.', langCode: 'b' },
  bm_daniel: { label: 'Daniel', description: 'British male narrator.', langCode: 'b' },
} as const;

export type KokoroVoice = keyof typeof KOKORO_VOICES;
export type KokoroLangCode = (typeof KOKORO_VOICES)[KokoroVoice]['langCode'];

const KOKORO_ALIASES: Record<string, KokoroVoice> = {
  heart: 'af_heart',
  bella: 'af_bella',
  nicole: 'af_nicole',
  sarah: 'af_sarah',
  adam: 'am_adam',
  onyx: 'am_onyx',
  emma: 'bf_emma',
  daniel: 'bm_daniel',
};

function isKokoroVoice(voice: string): voice is KokoroVoice {
  return Object.prototype.hasOwnProperty.call(KOKORO_VOICES, voice);
}

export function normalizeKokoroVoice(voice?: string): KokoroVoice {
  const v = String(voice ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (isKokoroVoice(v)) return v;
  return KOKORO_ALIASES[v] ?? 'af_heart';
}

export function kokoroVoiceOptions(): Array<{ id: KokoroVoice; label: string; description: string; langCode: KokoroLangCode }> {
  return (Object.keys(KOKORO_VOICES) as KokoroVoice[]).map((id) => ({ id, ...KOKORO_VOICES[id] }));
}

export function kokoroVoiceLabel(voice?: string): string {
  return KOKORO_VOICES[normalizeKokoroVoice(voice)].label;
}

export function kokoroVoiceLangCode(voice?: string): KokoroLangCode {
  return KOKORO_VOICES[normalizeKokoroVoice(voice)].langCode;
}

export function kokoroRate(rate = 1): number {
  const scale = Number.isFinite(rate) && rate > 0 ? Math.max(0.6, Math.min(1.5, rate)) : 1;
  return Number(scale.toFixed(2));
}

export function normalizeKokoroText(text: string): string {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export function kokoroTtsCachePath(home: string, input: KokoroTtsRequest): KokoroTtsCacheEntry {
  const text = normalizeKokoroText(input.text);
  const voice = normalizeKokoroVoice(input.voice);
  const langCode = kokoroVoiceLangCode(voice);
  const rate = kokoroRate(input.rate);
  const id = createHash('sha256').update(JSON.stringify({ engine: 'kokoro', text, voice, langCode, rate })).digest('hex');
  const dir = kokoroTtsCacheDir(home);
  return { dir, id, path: join(dir, `${id}.wav`), voice, langCode, rate };
}

export function kokoroTtsCacheDir(home: string): string {
  return join(home, '.diffstory', 'tts-cache', 'kokoro');
}

export function kokoroTtsVenvDir(home: string): string {
  return join(home, '.diffstory', 'kokoro-venv');
}

export function kokoroPythonCommand(home: string, override?: string): string {
  const forced = String(override ?? process.env.DIFFSTORY_KOKORO_PYTHON ?? '').trim();
  if (forced) return forced;
  const managed = join(kokoroTtsVenvDir(home), 'bin', 'python');
  return existsSync(managed) ? managed : DEFAULT_PYTHON;
}

export function kokoroTtsUrl(id: string): string {
  return `/api/tts/kokoro/${id}.wav`;
}

export function isKokoroTtsId(id: string): boolean {
  return /^[a-f0-9]{64}$/.test(id);
}

export async function synthesizeWithKokoro(
  home: string,
  input: KokoroTtsRequest,
  opts: { command?: string; signal?: AbortSignal } = {},
): Promise<KokoroTtsCacheEntry & { cached: boolean; url: string }> {
  const text = normalizeKokoroText(input.text);
  if (!text) throw new Error('No text to speak.');
  if (text.length > KOKORO_MAX_TEXT) throw new Error(`Text is too long for Kokoro speech (${KOKORO_MAX_TEXT} chars max).`);
  if (opts.signal?.aborted) throw speechCancelled();

  const entry = kokoroTtsCachePath(home, { ...input, text });
  if (existsSync(entry.path)) return { ...entry, cached: true, url: kokoroTtsUrl(entry.id) };

  mkdirSync(entry.dir, { recursive: true });
  const helper = ensureKokoroHelper(entry.dir);
  await runKokoro(kokoroPythonCommand(home, opts.command), [helper, entry.path, entry.voice, String(entry.rate), entry.langCode], text, entry.path, opts.signal);
  return { ...entry, cached: false, url: kokoroTtsUrl(entry.id) };
}

function ensureKokoroHelper(dir: string): string {
  const path = join(dir, 'kokoro_synth.py');
  writeFileSync(path, KOKORO_HELPER, 'utf8');
  return path;
}

function kokoroUnavailable(detail: string): Error {
  const suffix = detail ? ` ${detail}` : '';
  return new Error(`Kokoro AI voice is optional. To enable it, run: npm run setup:kokoro. The setup uses Python 3.10-3.12 plus espeak-ng, kokoro, and soundfile.${suffix}`);
}

function speechCancelled(): Error {
  const err = new Error('Speech generation cancelled.');
  err.name = 'AbortError';
  return err;
}

function runKokoro(command: string, args: string[], text: string, outputPath: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      rmSync(outputPath, { force: true });
      reject(speechCancelled());
      return;
    }
    const child = spawn(command, args, {
      stdio: ['pipe', 'ignore', 'pipe'],
      env: { ...process.env, PYTORCH_ENABLE_MPS_FALLBACK: process.env.PYTORCH_ENABLE_MPS_FALLBACK ?? '1' },
    });
    let aborted = false;
    let stderr = '';
    const cleanupAbort = () => signal?.removeEventListener('abort', onAbort);
    const onAbort = () => {
      aborted = true;
      rmSync(outputPath, { force: true });
      child.kill('SIGTERM');
      reject(speechCancelled());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (err) => {
      cleanupAbort();
      if (aborted) return;
      rmSync(outputPath, { force: true });
      reject(kokoroUnavailable(err.message));
    });
    child.on('close', (code) => {
      cleanupAbort();
      if (aborted) return;
      if (code === 0) return resolve();
      rmSync(outputPath, { force: true });
      reject(kokoroUnavailable(stderr.trim() || `python exited with status ${code}`));
    });
    child.stdin.end(text);
  });
}
