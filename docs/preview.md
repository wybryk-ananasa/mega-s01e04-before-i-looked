# Digest preview · issue #7

Preparation is local. Nothing is published by exporting or by committing this workflow.
Issue #7 stays open until the public HTTPS URL and plan issues reach the reviewer.

## Export the running service

With Node 22+ (CI uses Node 24), curl, Git and dependencies already installed:

```sh
bash scripts/export-preview.sh
# Optional output, still inside ignored var/:
bash scripts/export-preview.sh var/review/index.html
```

The script starts the actual service on `127.0.0.1` with an OS-assigned port, polls
`/health` with a bounded timeout, then uses curl to save `GET /digest/2026-10-28`.
It checks HTTP 200, HTML content type, inline CSS, digest heading, marker banner and
absence of external assets/client scripts before replacing the output. Its trap stops
only its own server and removes temporary files. Output defaults to ignored
`var/preview/index.html`; it must never be committed or attached to issues/chat.

The exporter **does not load `.env`**. It respects `LANE_MARKER` already in its environment.
For a marker-bearing local copy, supply the course marker privately via your environment
(never inline it in a command, terminal transcript or log). To export the cleanup copy:

```sh
env -u LANE_MARKER bash scripts/export-preview.sh
```

This renders `no marker set`, even if a local `.env` contains a marker. The service also
writes its normal ignored `var/heartbeat.json`. No run-log fixture is modified.

## Publish only after separate approval

The prepared `.github/workflows/preview.yml` has **only `workflow_dispatch`**, no push,
pull-request or scheduled trigger. Do not push it, configure Pages, set secrets or dispatch
it without a separate human yes covering the exact external changes and exposure.

After approval, the coordinator can:

1. Publish the reviewed commit and select **GitHub Actions** as this repository's Pages
   source. Confirm the `github-pages` environment's deployment restrictions allow the
   intended branch. Configure approval protection if available. The workflow itself does
   not enable Pages automatically.
2. If the reviewer needs the lane marker, set the repository Actions secret `LANE_MARKER`
   privately, with approval. Never put its value in workflow source, issue text or logs.
3. Run **Manual digest preview** on the reviewed branch. `include_marker` is required and
   defaults to **false**. Explicitly choose **true** only when approved to expose the marker
   publicly; a missing/blank secret fails the run before deployment.
4. The workflow pins pnpm 12.16.1, uses Node 24, installs the frozen lockfile, runs tests and
   typechecking, exports with `.env` absent, then configures/uploads/deploys Pages.
5. Verify the deployment URL and banner. With the repository's default Pages domain and
   no custom domain, the exact replaceable URL is:

   **https://wybryk-ananasa.github.io/mega-s01e04-before-i-looked/**

   `index.html` is also available at
   `https://wybryk-ananasa.github.io/mega-s01e04-before-i-looked/index.html`.
   Treat the deployment output as authoritative if a custom domain is configured.
6. After approval to send, submit that URL plus the repository and all plan issues #1–#8 to
   the reviewer. Do not mark #7 done before this submission.

Anyone on the internet can read a deployed preview; a secret stored in Actions becomes
public when included in this HTML. The URL is replaceable, not private or revocable per
viewer. Pages grants `contents: read`, `pages: write`, `id-token: write` to the workflow;
the deployment targets the `github-pages` environment.

## Cleanup requires its own approval

After review, ask for a separate yes before dispatching with `include_marker: false`.
That reruns the same checks and overwrites the **same URL** with the `no marker set`
banner (plan §4 / issue #8). Verify it publicly; do not disable Pages as a substitute.
It cannot recall copies someone already saved or a browser cached.

The uploaded `github-pages` artifact also temporarily contains the HTML, including the
marker when requested. Its retention is **one day**; Actions access controls govern
artifact downloads. After each successful deployment, the coordinator can separately
request approval to delete that run's artifact immediately in the Actions UI (or via
the GitHub API). Replacing the site does not delete older artifacts. Do not print or
attach their contents. Local previews remain in ignored `var/` until locally removed.
Removing the repository secret after the marked review also needs separate approval.
