import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { AloudUnavailableError, createAloudReader } from '../dist/aloud-client.js';

const STATUS = {
  jobId: 'job-1',
  ok: true,
  paused: false,
  protocolVersion: 2,
  running: true,
  service: 'aloud-speech-daemon',
  state: { status: 'reading' },
};
const HEALTH = {
  capabilities: ['explicit-batches', 'prefetch-playback'],
  ok: true,
  protocolVersion: 2,
  service: 'aloud-speech-daemon',
};

async function fakeAloud(handler) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

test('Aloud client verifies the daemon before delegating speech and controls', async () => {
  const calls = [];
  const fixture = await fakeAloud((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      calls.push({ method: req.method, path: req.url, body: Buffer.concat(chunks).toString('utf8') });
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/health') return res.end(JSON.stringify(HEALTH));
      if (req.url === '/pause') return res.end(JSON.stringify({ ok: true, paused: true }));
      res.end(JSON.stringify(STATUS));
    });
  });
  try {
    const aloud = createAloudReader(fixture.url);
    assert.equal((await aloud.speak({
      batches: ['Review this beat.', 'Then this one.'],
      prefetch: 3,
      text: 'Review this beat. Then this one.',
    })).jobId, 'job-1');
    assert.equal((await aloud.control('pause')).service, 'aloud-speech-daemon');
    assert.deepEqual(calls.map(({ method, path }) => `${method} ${path}`), [
      'GET /health',
      'POST /speak',
      'GET /health',
      'POST /pause',
      'GET /status',
    ]);
    assert.deepEqual(JSON.parse(calls[1].body), {
      batches: ['Review this beat.', 'Then this one.'],
      prefetch: 3,
      text: 'Review this beat. Then this one.',
    });
  } finally {
    fixture.server.close();
    await once(fixture.server, 'close');
  }
});

test('Aloud client refuses an unrelated listener on the daemon port', async () => {
  const fixture = await fakeAloud((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, service: 'something-else', protocolVersion: 2 }));
  });
  try {
    await assert.rejects(
      createAloudReader(fixture.url).speak({ text: 'Do not send this.' }),
      (error) => error instanceof AloudUnavailableError && /compatible Aloud/.test(error.message),
    );
  } finally {
    fixture.server.close();
    await once(fixture.server, 'close');
  }
});

test('Aloud client explains when Services predate explicit narration batches', async () => {
  const fixture = await fakeAloud((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, protocolVersion: 2, service: 'aloud-speech-daemon' }));
  });
  try {
    await assert.rejects(
      createAloudReader(fixture.url).speak({ text: 'Queue this narration.' }),
      (error) => error instanceof AloudUnavailableError && /Reinstall Aloud Services/.test(error.message),
    );
  } finally {
    fixture.server.close();
    await once(fixture.server, 'close');
  }
});

test('Aloud client uses the authoritative control response without an extra status poll', async () => {
  const calls = [];
  const fixture = await fakeAloud((req, res) => {
    calls.push(`${req.method} ${req.url}`);
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/health') {
      return res.end(JSON.stringify(HEALTH));
    }
    res.end(JSON.stringify({ ...STATUS, paused: true, state: { message: 'Generating chunk 1 of 2', status: 'generating', current: 0, total: 2 } }));
  });
  try {
    const status = await createAloudReader(fixture.url).control('pause');
    assert.equal(status.paused, true);
    assert.equal(status.state.status, 'generating');
    assert.deepEqual(calls, ['GET /health', 'POST /pause']);
  } finally {
    fixture.server.close();
    await once(fixture.server, 'close');
  }
});
