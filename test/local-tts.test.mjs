// Unit tests for local, no-card TTS helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  localTtsCachePath,
  localTtsUrl,
  normalizeSayPreset,
  normalizeSayVoice,
  sayRateForPreset,
  sayRateForVoice,
  sayVoiceName,
  sayVoiceForPreset,
} from '../dist/local-tts.js';

test('say voices are direct macOS choices', () => {
  assert.equal(normalizeSayVoice('samantha'), 'samantha');
  assert.equal(normalizeSayVoice('daniel'), 'daniel');
  assert.equal(normalizeSayVoice('danield'), 'daniel');
  assert.equal(sayVoiceName('samantha'), 'Samantha');
  assert.equal(sayVoiceName('daniel'), 'Daniel');
});

test('say presets map review voices to installed macOS voice names', () => {
  assert.equal(normalizeSayPreset('warm'), 'flirty');
  assert.equal(normalizeSayPreset('precise'), 'bass');
  assert.equal(sayVoiceForPreset('story'), 'Samantha');
  assert.equal(sayVoiceForPreset('flirty'), 'Samantha');
  assert.equal(sayVoiceForPreset('bass'), 'Daniel');
});

test('say rate keeps voices natural while honoring user speed', () => {
  assert.equal(sayRateForVoice('samantha', 1), 178);
  assert.equal(sayRateForVoice('daniel', 1), 165);
  assert.equal(sayRateForPreset('story', 1), 178);
  assert.equal(sayRateForPreset('flirty', 1.05), 187);
  assert.equal(sayRateForPreset('bass', 0.8), 132);
});

test('local say cache path and URL are deterministic and text-sensitive', () => {
  const home = mkdtempSync(join(tmpdir(), 'ds-tts-home-'));
  try {
    const a = localTtsCachePath(home, { text: 'hello', preset: 'story', rate: 1 });
    const b = localTtsCachePath(home, { text: 'hello', preset: 'story', rate: 1 });
    const c = localTtsCachePath(home, { text: 'hello again', preset: 'story', rate: 1 });
    const d = localTtsCachePath(home, { text: 'hello', voice: 'daniel', rate: 1 });
    assert.equal(a.path, b.path);
    assert.notEqual(a.path, c.path);
    assert.notEqual(a.path, d.path);
    assert.equal(d.voice, 'Daniel');
    assert.ok(a.path.startsWith(join(home, '.diffstory', 'tts-cache', 'say')));
    assert.match(a.path, /\.m4a$/);
    assert.equal(localTtsUrl(a.id), `/api/tts/say/${a.id}.m4a`);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
