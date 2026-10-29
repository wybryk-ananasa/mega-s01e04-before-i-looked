import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const temporaryDirectories: string[] = [];

async function makeRunsDir() {
  const runsDir = await mkdtemp(join(tmpdir(), 'rig-digest-routes-'));
  temporaryDirectories.push(runsDir);
  return runsDir;
}

function appFor(runsDir: string) {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('digest routes', () => {
  it('renders the digest and serves matching sorted JSON rows', async () => {
    const runsDir = await makeRunsDir();
    await mkdir(runsDir, { recursive: true });
    await writeFile(
      join(runsDir, '2026-10-28.jsonl'),
      [
        JSON.stringify({ at: '2026-10-28T09:02:00+02:00', job: 'zeta', status: 'retry', owner: 'Zoe' }),
        JSON.stringify({ at: '2026-10-28T09:03:00+02:00', job: 'zeta', status: 'fail', owner: 'Zoe', error: 'connection lost' }),
        JSON.stringify({ at: '2026-10-28T09:04:00+02:00', job: 'zeta', status: 'retry', owner: 'Zoe' }),
        JSON.stringify({ at: '2026-10-28T09:05:00+02:00', job: 'zeta', status: 'retry', owner: 'Zoe' }),
        JSON.stringify({ at: '2026-10-28T09:06:00+02:00', job: 'alpha', status: 'ok', owner: null }),
        '{ malformed json',
      ].join('\n'),
    );

    const app = appFor(runsDir);
    const [htmlResponse, jsonResponse] = await Promise.all([
      app.request('/digest/2026-10-28'),
      app.request('/api/digest/2026-10-28'),
    ]);
    const html = await htmlResponse.text();
    const result = await jsonResponse.json();

    expect(htmlResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    expect(result).toMatchObject({
      night: '2026-10-28',
      found: true,
      badLines: 1,
      counts: { ok: 1, retry: 3, fail: 1 },
      rows: [
        { job: 'alpha', owner: null, runs: 1, retries: 0, lastStatus: 'ok' },
        { job: 'zeta', owner: 'Zoe', runs: 4, retries: 3, lastStatus: 'retry', hasFailure: true },
      ],
    });
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('zeta'));
    expect(html).toContain('—');
    expect(html).toContain('Zoe');
    expect(html).toContain('connection lost');
    expect(html).toContain('2026-10-28T09:02:00+02:00');
    expect(html).toContain('2026-10-28T09:05:00+02:00');
    expect(html).not.toMatch(/<script\b/i);
  });

  it('returns 404 for a night with no file', async () => {
    const runsDir = await makeRunsDir();
    const app = appFor(runsDir);

    expect((await app.request('/digest/2026-10-27')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-27')).status).toBe(404);
  });

  it('renders an existing empty night as nothing ran', async () => {
    const runsDir = await makeRunsDir();
    await writeFile(join(runsDir, '2026-10-28.jsonl'), '');
    const app = appFor(runsDir);

    const htmlResponse = await app.request('/digest/2026-10-28');
    const jsonResponse = await app.request('/api/digest/2026-10-28');

    expect(htmlResponse.status).toBe(200);
    expect(await htmlResponse.text()).toContain('nothing ran');
    expect(jsonResponse.status).toBe(200);
    expect(await jsonResponse.json()).toMatchObject({ found: true, rows: [], badLines: 0 });
  });

  it('counts malformed lines without failing the night', async () => {
    const runsDir = await makeRunsDir();
    await writeFile(
      join(runsDir, '2026-10-28.jsonl'),
      `${JSON.stringify({ at: '2026-10-28T12:00:00-05:00', job: 'lunch', status: 'ok', owner: null })}\nnot-json\n`,
    );
    const app = appFor(runsDir);

    const response = await app.request('/api/digest/2026-10-28');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      found: true,
      badLines: 1,
      rows: [{ job: 'lunch', owner: null, firstAt: '2026-10-28T12:00:00-05:00' }],
    });
  });
});
