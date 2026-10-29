import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, ReadNight } from './types.js';

type RunEvent = {
  at: string;
  instant: number;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

function isNight(value: string): boolean {
  if (value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function parseEvent(line: string): RunEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const { at, job, status, owner, error } = record;
  if (
    typeof at !== 'string' ||
    typeof job !== 'string' || job.trim().length === 0 ||
    (status !== 'ok' && status !== 'retry' && status !== 'fail') ||
    (owner !== null && typeof owner !== 'string') ||
    (error !== undefined && typeof error !== 'string')
  ) return null;

  // Require a real calendar date and an explicit offset, not Date.parse's loose inputs.
  const timestamp = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(at);
  const instant = Date.parse(at);
  if (timestamp?.[0] !== at || !isNight(at.slice(0, 10)) || !Number.isFinite(instant)) return null;
  return { at, instant, job, status, owner, error };
}

export const readNight: ReadNight = (runsDir, night) => {
  const result = {
    night,
    found: false,
    rows: [] as DigestRow[],
    badLines: 0,
    counts: { ok: 0, retry: 0, fail: 0 },
  };
  // Reject invalid names before constructing a path or reading anything on disk.
  if (!isNight(night)) return result;

  let contents: string;
  try {
    contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return result;
    throw error;
  }
  result.found = true;

  const events: RunEvent[] = [];
  for (const line of contents.split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    const event = parseEvent(line);
    if (event === null) {
      result.badLines += 1;
    } else {
      events.push(event);
      result.counts[event.status] += 1;
    }
  }

  // Stable sorting keeps file order for equal instants, including differing offsets.
  events.sort((a, b) => a.instant - b.instant);
  const jobs = new Map<string, DigestRow>();
  for (const event of events) {
    const row = jobs.get(event.job);
    if (row === undefined) {
      jobs.set(event.job, {
        job: event.job,
        owner: event.owner,
        runs: 1,
        retries: event.status === 'retry' ? 1 : 0,
        lastStatus: event.status,
        lastError: event.error ?? null,
        firstAt: event.at,
        lastAt: event.at,
        hasFailure: event.status === 'fail',
      });
    } else {
      row.owner = event.owner;
      row.runs += 1;
      row.retries += event.status === 'retry' ? 1 : 0;
      row.lastStatus = event.status;
      if (event.error !== undefined) row.lastError = event.error;
      row.lastAt = event.at;
      row.hasFailure ||= event.status === 'fail';
    }
  }
  result.rows = [...jobs.values()].sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0);
  return result;
};
