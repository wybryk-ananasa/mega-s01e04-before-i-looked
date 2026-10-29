---
plan: morning-digest
status: done
owner: rook
opened: 2026-10-29
---

# Morning digest

The night's run log is a JSONL file nobody reads. By breakfast someone has to know what ran,
what retried, what failed, and whose it was, without opening `runs/`. rig already serves the
status board; the digest is one more page on it.

Out of scope: notifications, history across nights, auth (rig only listens on localhost).

## 1. Run log reader

Read `runs/<night>.jsonl` into one row per job: job, owner, runs, retries, last status, last
error, first and last time. One JSON object per line (`at`, `job`, `status`: `ok | retry | fail`,
`owner`, optional `error`).

- A line that doesn't parse is counted, never thrown. The night still renders.
- `owner` can be `null`. Keep the row; show the owner as `—`.
- Lives in `src/digest/`. Commit `src/digest/types.ts` first (the `DigestRow` type and the
  `readNight(runsDir, night)` signature), so every part of section 2 can start against it.

Done when: reader tests pass on `runs/2026-10-28.jsonl` (5 jobs, 1 bad line).

## 2. Digest page

Four small parts. Each needs only `src/digest/types.ts` from section 1, so once that is in they
can go to four workers at once. Small, well-specified work: a cheaper model is fine here.

### 2a. Page

`GET /digest/:night` renders the rows with the usual layout: one table, sorted by job, retries of
3 or more and any `fail` marked. A night with no file returns 404; an empty file renders
"nothing ran".

Done when: `/digest/2026-10-28` renders locally.

### 2b. JSON

`GET /api/digest/:night` returns the same rows as JSON. Agents read this one; the page and the
JSON must never disagree (ADR 0001).

Done when: the JSON for 2026-10-28 has the same jobs, in the same order, as the page.

### 2c. Board link

The status board links each night on disk to its digest, with its ok / retry / fail counts beside
it.

Done when: both nights on disk link to a digest that renders.

### 2d. Route tests

Route tests for 2a and 2b: 200, 404 for a night with no file, the empty night, a night with a bad
line. Use a temp runs dir; `runs/` is read-only.

Done when: `pnpm test` is green with the new tests.

## 3. Preview for review

The reviewer reads the page from a copy, not from the lane. Run rig and save `/digest/2026-10-28` as
one HTML file, lane banner included (a command, not a browser's "save as"; the page is
self-contained, ADR 0001). Put it on your own public host, one where you can upload over it later (any bucket
or static host, ADR 0003), so it opens from a public HTTPS link. Send the reviewer the link and the
issues for this plan.

Done when: the preview link is sent to the reviewer.

## 4. Clean up

The preview carries this lane's marker on a public link (ADR 0003). Take the marker off: save the
page again with `LANE_MARKER` unset (the banner reads "no marker set") and upload it over the same
link. Move this plan to `docs/plans/done/` with its issue list.

Done when: the preview link no longer shows the lane marker.

## Review and verified cleanup

The coordinator reports that the course confirmed the reviewer has seen the preview. The
human separately approved replacing the same public URL with a marker-free export, deleting
temporary Actions artifacts, finishing this plan, and final submission.

The coordinator verified cleanup after the marker-free deployment in
[Actions run 40957259944](https://github.com/wybryk-ananasa/mega-s01e04-before-i-looked/actions/runs/40957259944)
succeeded. Fetching the exact same public URL,
<https://wybryk-ananasa.github.io/mega-s01e04-before-i-looked/>, returned HTTP 200: the original
lane marker was absent, `<span class="marker">no marker set</span>` was present, and the
digest remained intact. The coordinator also confirmed deletion of transient artifact
`12933927894`. This satisfies the public cleanup condition for `status: done`; verification
was performed by the coordinator, not the archive worker. Final submission and issue
closure remain the coordinator's responsibility.

## Issue list

Source references below are preserved exactly from the GitHub issue bodies; `plan.md` refers
to this plan before archival.

| Issue | Work | Source reference |
| --- | --- | --- |
| [#1](https://github.com/wybryk-ananasa/mega-s01e04-before-i-looked/issues/1) | Digest types and reader contract | Source: plan.md § 1 |
| [#2](https://github.com/wybryk-ananasa/mega-s01e04-before-i-looked/issues/2) | Read and aggregate nightly run logs | Source: plan.md § 1 |
| [#3](https://github.com/wybryk-ananasa/mega-s01e04-before-i-looked/issues/3) | Digest HTML page: GET /digest/:night | Source: plan.md § 2a |
| [#4](https://github.com/wybryk-ananasa/mega-s01e04-before-i-looked/issues/4) | Digest JSON endpoint: GET /api/digest/:night | Source: plan.md § 2b |
| [#5](https://github.com/wybryk-ananasa/mega-s01e04-before-i-looked/issues/5) | Status board links and per-night status counts | Source: plan.md § 2c |
| [#6](https://github.com/wybryk-ananasa/mega-s01e04-before-i-looked/issues/6) | Digest route integration tests | Source: plan.md § 2d |
| [#7](https://github.com/wybryk-ananasa/mega-s01e04-before-i-looked/issues/7) | Export and submit the public HTML preview | Source: plan.md § 3 |
| [#8](https://github.com/wybryk-ananasa/mega-s01e04-before-i-looked/issues/8) | Remove preview marker and archive the plan | Source: plan.md § 4 |
