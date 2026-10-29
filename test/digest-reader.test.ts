import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readNight } from '../src/digest/reader.js';

const night = '2026-10-28';
const baseEvent = { at: '2026-10-28T23:00:00+01:00', job: 'lane/sync', status: 'ok', owner: 'rook' };

describe('nightly run reader', () => {
  let runsDir: string;

  beforeEach(() => {
    runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-reader-'));
  });

  afterEach(() => {
    rmSync(runsDir, { recursive: true, force: true });
  });

  function writeLines(lines: string[]) {
    writeFileSync(join(runsDir, `${night}.jsonl`), lines.join('\n'));
  }

  it('reads the real night without changing its fixtures', () => {
    const fixtures = fileURLToPath(new URL('../runs/', import.meta.url));
    const result = readNight(fixtures, night);
    expect(result.found).toBe(true);
    expect(result.badLines).toBe(1);
    expect(result.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(result.rows.map((row) => row.job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
    expect(result.rows[0]).toEqual({
      job: 'digest/render', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null,
      firstAt: '2026-10-29T05:41:09+01:00', lastAt: '2026-10-29T05:41:09+01:00', hasFailure: false,
    });
    expect(result.rows[1]).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
    expect(result.rows[2]).toMatchObject({ runs: 8, retries: 1, lastError: 'lock held' });
    expect(result.rows[3]).toMatchObject({ lastStatus: 'fail', hasFailure: true, lastError: 'quota exceeded' });
  });

  it('distinguishes missing, empty and blank-only files', () => {
    const empty = { night, found: false, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } };
    expect(readNight(runsDir, night)).toEqual(empty);
    expect(readNight(join(runsDir, 'missing'), night)).toEqual(empty);
    writeLines([]);
    expect(readNight(runsDir, night)).toEqual({ ...empty, found: true });
    writeLines(['', ' \t', '\r', '']);
    expect(readNight(runsDir, night)).toEqual({ ...empty, found: true });
  });

  it('counts invalid JSON and schema records, ignoring blanks and retaining good events', () => {
    const invalid: unknown[] = [
      null, [], 42, 'event', {},
      { ...baseEvent, at: undefined },
      { ...baseEvent, at: 123 },
      { ...baseEvent, at: 'yesterday' },
      { ...baseEvent, at: '2026-10-28T23:00:00' },
      { ...baseEvent, at: '2026-02-30T23:00:00Z' },
      { ...baseEvent, at: '2026-10-28T24:00:00Z' },
      { ...baseEvent, at: '2026-10-28T23:00:00+24:00' },
      { ...baseEvent, at: '2026-10-28T23:00:00Z\n' },
      { ...baseEvent, job: undefined },
      { ...baseEvent, job: null },
      { ...baseEvent, job: '' },
      { ...baseEvent, job: ' \t' },
      { ...baseEvent, status: undefined },
      { ...baseEvent, status: 'pending' },
      { ...baseEvent, owner: undefined },
      { ...baseEvent, owner: 7 },
      { ...baseEvent, error: null },
      { ...baseEvent, error: {} },
    ];
    writeLines(['', ...invalid.map((value) => JSON.stringify(value)), '{broken', ' \t', JSON.stringify(baseEvent)]);
    const result = readNight(runsDir, night);
    expect(result.badLines).toBe(invalid.length + 1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ runs: 1, owner: 'rook' });
    expect(result.counts).toEqual({ ok: 1, retry: 0, fail: 0 });
  });

  it('orders by instant while preserving offsets, latest owner/error and every event count', () => {
    const events = [
      { ...baseEvent, at: '2026-10-29T00:15:00Z', owner: null },
      { ...baseEvent, at: '2026-10-29T01:00:00+02:00', status: 'retry', error: 'earliest' },
      { ...baseEvent, at: '2026-10-28T23:30:00-00:30', status: 'fail', owner: 'other', error: 'latest error' },
      { ...baseEvent, at: '2026-10-28T23:45:00Z', status: 'retry', error: 'older error' },
      { ...baseEvent, job: 'z-job' },
      { ...baseEvent, job: 'a-job' },
    ];
    writeLines(events.map((event) => JSON.stringify(event)));
    const result = readNight(runsDir, night);
    expect(result.rows.map((row) => row.job)).toEqual(['a-job', 'lane/sync', 'z-job']);
    expect(result.rows[1]).toEqual({
      job: 'lane/sync', owner: null, runs: 4, retries: 2, lastStatus: 'ok',
      lastError: 'latest error', firstAt: '2026-10-29T01:00:00+02:00',
      lastAt: '2026-10-29T00:15:00Z', hasFailure: true,
    });
    expect(result.counts).toEqual({ ok: 3, retry: 2, fail: 1 });
  });

  it('uses file order for equal instants and keeps an explicitly supplied empty error', () => {
    writeLines([
      JSON.stringify({ ...baseEvent, at: '2026-10-28T23:00:00.000+01:00', status: 'fail', error: 'old' }),
      JSON.stringify({ ...baseEvent, at: '2026-10-28T22:00:00Z', status: 'retry', error: '' }),
      JSON.stringify({ ...baseEvent, at: '2026-10-28T22:00:00.000Z', owner: null }),
    ]);
    expect(readNight(runsDir, night).rows[0]).toEqual({
      job: 'lane/sync', owner: null, runs: 3, retries: 1, lastStatus: 'ok', lastError: '',
      firstAt: '2026-10-28T23:00:00.000+01:00', lastAt: '2026-10-28T22:00:00.000Z', hasFailure: true,
    });
  });

  it('handles CRLF, a final line without newline, and prototype-like job names', () => {
    writeLines([
      JSON.stringify({ ...baseEvent, job: '__proto__', owner: null }) + '\r',
      JSON.stringify({ ...baseEvent, job: 'constructor', at: '2024-02-29T22:00:00Z' }),
    ]);
    const result = readNight(runsDir, night);
    expect(result.badLines).toBe(0);
    expect(result.rows.map((row) => row.job)).toEqual(['__proto__', 'constructor']);
    expect(result.counts).toEqual({ ok: 2, retry: 0, fail: 0 });
  });

  it.each([
    '../2026-10-28', '../../2026-10-28', '/2026-10-28', '2026-10-28/../2026-10-28',
    '2026-10-28\\..\\other', '2026-10-28.jsonl', '2026-10-28\n', '2026-10-28\0',
    '2026-1-28', '2026-02-29', '1900-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-10-00', '',
  ])('rejects invalid night %j before filesystem access', (invalidNight) => {
    // A file as runsDir would cause ENOTDIR if the reader attempted access.
    const notDirectory = join(runsDir, 'file');
    writeFileSync(notDirectory, '');
    expect(readNight(notDirectory, invalidNight)).toEqual({
      night: invalidNight, found: false, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('accepts real leap-day night names', () => {
    writeFileSync(join(runsDir, '2000-02-29.jsonl'), '');
    expect(readNight(runsDir, '2000-02-29').found).toBe(true);
  });

  it('propagates non-ENOENT filesystem errors', () => {
    mkdirSync(join(runsDir, `${night}.jsonl`));
    expect(() => readNight(runsDir, night)).toThrow();
    const notDirectory = join(runsDir, 'file');
    writeFileSync(notDirectory, '');
    expect(() => readNight(notDirectory, night)).toThrow();
  });
});
