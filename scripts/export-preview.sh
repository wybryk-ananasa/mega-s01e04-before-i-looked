#!/usr/bin/env bash
# Export the real service, not a second renderer. Never load .env implicitly.
set -euo pipefail
umask 077

cd "$(dirname "$0")/.."
if [[ $# -gt 1 ]]; then
  echo 'Usage: bash scripts/export-preview.sh [var/preview/index.html]' >&2
  exit 1
fi
for tool in node curl git; do
  command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 1; }
done
if [[ ! -x node_modules/.bin/tsx ]]; then
  echo 'Missing installed node_modules/.bin/tsx; install dependencies before exporting.' >&2
  exit 1
fi

# Keep every output and temporary file in ignored var/, including custom paths.
# Reject symlink escapes and tracked files before writing anything.
output=$(node --input-type=module - "${1:-var/preview/index.html}" <<'NODE'
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
const root = realpathSync(process.cwd());
const base = resolve(root, 'var');
const output = resolve(root, process.argv[2]);
function fail() { console.error('Preview output must be a non-symlink file inside ignored var/.'); process.exit(1); }
if (!output.startsWith(base + sep)) fail();
for (let path = output; path !== root; path = dirname(path)) {
  try { if (lstatSync(path).isSymbolicLink()) fail(); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
if (existsSync(output) && !lstatSync(output).isFile()) fail();
console.log(output);
NODE
)
git check-ignore --quiet -- "$output" || { echo 'Preview output is not ignored (or is tracked).' >&2; exit 1; }
mkdir -p "$(dirname "$output")"
temporary=$(mktemp -d "$(dirname "$output")/.export-XXXXXX")
server_pid=''
cleanup() {
  if [[ -n "$server_pid" ]]; then
    # tsx relays SIGTERM to its own child and waits for it. Never kill by port/name.
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -f "$temporary/server.log" "$temporary/index.html"
  rmdir "$temporary"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Port 0 lets the OS allocate an unused port. The startup callback logs the real port.
PORT=0 node_modules/.bin/tsx src/server.ts >"$temporary/server.log" 2>&1 &
server_pid=$!
url=''
ready=false
for ((attempt = 0; attempt < 100; attempt++)); do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo 'Preview server exited before readiness (log intentionally not printed).' >&2
    exit 1
  fi
  url=$(sed -nE 's/.* · (http:\/\/127\.0\.0\.1:[0-9]+)$/\1/p' "$temporary/server.log" | head -n 1)
  if [[ -n "$url" ]] && curl --noproxy '*' --fail --silent --max-time 1 "$url/health" >/dev/null; then
    ready=true
    break
  fi
  sleep 0.1
done
if [[ "$ready" != true ]]; then
  echo 'Preview server did not become ready within the bounded polling window.' >&2
  exit 1
fi

response=$(curl --noproxy '*' --fail --silent --show-error --max-time 10 \
  --output "$temporary/index.html" --write-out '%{http_code} %{content_type}' \
  "$url/digest/2026-10-28")
if [[ "$response" != '200 text/html'* ]]; then
  echo 'Digest did not return HTTP 200 HTML.' >&2
  exit 1
fi
node --input-type=module - "$temporary/index.html" <<'NODE'
import { readFileSync } from 'node:fs';
const html = readFileSync(process.argv[2], 'utf8');
const escape = (value) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const marker = process.env.LANE_MARKER?.trim() || 'no marker set';
const valid = /^<!doctype html>/i.test(html)
  && html.endsWith('</html>')
  && html.includes('<style>')
  && html.includes('<h1>digest · 2026-10-28</h1>')
  && html.includes(`<span class="marker">${escape(marker)}</span>`)
  && !/<(?:script|link|iframe|object|embed)\b|\bsrc\s*=|@import\b|url\s*\(/i.test(html);
if (!valid) {
  console.error('Digest validation failed: expected self-contained HTML and the requested banner.');
  process.exit(1);
}
NODE
mv -f "$temporary/index.html" "$output"
echo 'Preview exported to ignored var/ output; nothing published.'
