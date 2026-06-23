import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
export const SAY_MAX_TEXT = 5000;
const SAY_CMD = '/usr/bin/say';
export function normalizeSayVoice(voice) {
    const v = String(voice ?? '').toLowerCase().trim();
    if (v === 'daniel' || v === 'danield')
        return 'daniel';
    return 'samantha';
}
export function sayVoiceName(voice) {
    return normalizeSayVoice(voice) === 'daniel' ? 'Daniel' : 'Samantha';
}
export function normalizeSayPreset(preset) {
    const p = String(preset ?? '').toLowerCase();
    if (p === 'warm' || p === 'flirty')
        return 'flirty';
    if (p === 'precise' || p === 'reviewer' || p === 'deep' || p === 'bass')
        return 'bass';
    if (p === 'system')
        return 'system';
    return 'story';
}
export function sayVoiceForPreset(preset) {
    const p = normalizeSayPreset(preset);
    if (p === 'bass')
        return 'Daniel';
    return 'Samantha';
}
export function sayVoiceForRequest(input) {
    if (input.voice)
        return normalizeSayVoice(input.voice);
    return normalizeSayPreset(input.preset) === 'bass' ? 'daniel' : 'samantha';
}
export function sayRateForVoice(voice, rate = 1) {
    const base = normalizeSayVoice(voice) === 'daniel' ? 165 : 178;
    const scale = Number.isFinite(rate) && rate > 0 ? Math.max(0.6, Math.min(1.5, rate)) : 1;
    return Math.round(base * scale);
}
export function sayRateForPreset(preset, rate = 1) {
    const p = normalizeSayPreset(preset);
    return sayRateForVoice(p === 'bass' ? 'daniel' : 'samantha', rate);
}
export function normalizeSayText(text) {
    return String(text ?? '').replace(/\s+/g, ' ').trim();
}
export function localTtsCachePath(home, input) {
    const text = normalizeSayText(input.text);
    const voiceKey = sayVoiceForRequest(input);
    const voice = sayVoiceName(voiceKey);
    const rate = sayRateForVoice(voiceKey, input.rate);
    const id = createHash('sha256').update(JSON.stringify({ engine: 'say', text, voice, rate })).digest('hex');
    const dir = localTtsCacheDir(home);
    return { dir, id, path: join(dir, `${id}.m4a`), voice, rate };
}
export function localTtsCacheDir(home) {
    return join(home, '.diffstory', 'tts-cache', 'say');
}
export function localTtsUrl(id) {
    return `/api/tts/say/${id}.m4a`;
}
export function isLocalTtsId(id) {
    return /^[a-f0-9]{64}$/.test(id);
}
export async function synthesizeWithSay(home, input, opts = {}) {
    const text = normalizeSayText(input.text);
    if (!text)
        throw new Error('No text to speak.');
    if (text.length > SAY_MAX_TEXT)
        throw new Error(`Text is too long for local speech (${SAY_MAX_TEXT} chars max).`);
    if (opts.signal?.aborted)
        throw speechCancelled();
    const entry = localTtsCachePath(home, { ...input, text });
    if (existsSync(entry.path))
        return { ...entry, cached: true, url: localTtsUrl(entry.id) };
    mkdirSync(entry.dir, { recursive: true });
    await runSay(opts.command ?? SAY_CMD, ['-v', entry.voice, '-r', String(entry.rate), '-o', entry.path], text, entry.path, opts.signal);
    return { ...entry, cached: false, url: localTtsUrl(entry.id) };
}
function speechCancelled() {
    const err = new Error('Speech generation cancelled.');
    err.name = 'AbortError';
    return err;
}
function runSay(command, args, text, outputPath, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            rmSync(outputPath, { force: true });
            reject(speechCancelled());
            return;
        }
        const child = spawn(command, args, { stdio: ['pipe', 'ignore', 'pipe'] });
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
            if (aborted)
                return;
            rmSync(outputPath, { force: true });
            reject(err);
        });
        child.on('close', (code) => {
            cleanupAbort();
            if (aborted)
                return;
            if (code === 0)
                return resolve();
            rmSync(outputPath, { force: true });
            reject(new Error(stderr.trim() || `say exited with status ${code}`));
        });
        child.stdin.end(text);
    });
}
