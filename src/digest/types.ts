export type DigestStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  // Owner from the latest event; null owners never remove a job from the digest.
  owner: string | null;
  // Every valid event for this job, including retries and failures.
  runs: number;
  retries: number;
  lastStatus: DigestStatus;
  // Most recently supplied error, or null when no event supplied one.
  lastError: string | null;
  // Original timestamps (including offsets), earliest and latest by instant.
  firstAt: string;
  lastAt: string;
  // True if any event failed, even when the latest event succeeded.
  hasFailure: boolean;
};

// Counts of individual valid events, not grouped jobs or their final statuses.
export type DigestCounts = {
  ok: number;
  retry: number;
  fail: number;
};

export type DigestResult = {
  night: string;
  // False for a missing file; an existing empty file has found: true.
  found: boolean;
  // One row per job, sorted by job ascending. Latest-event ties use file order.
  rows: DigestRow[];
  // Nonblank lines rejected as invalid JSON or invalid event data.
  badLines: number;
  counts: DigestCounts;
};

// Contract for the synchronous reader, implemented separately as readNight.
// Missing files return empty rows and zero badLines/counts; blank lines are ignored.
export type ReadNight = (runsDir: string, night: string) => DigestResult;
