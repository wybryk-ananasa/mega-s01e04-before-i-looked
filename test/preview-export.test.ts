import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryDirectories: string[] = [];

function temporaryDirectory() {
  mkdirSync('var', { recursive: true });
  const directory = mkdtempSync(resolve('var/preview-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

function exportPreview(output: string, marker: string) {
  return spawnSync('bash', ['scripts/export-preview.sh', output], {
    encoding: 'utf8',
    env: { ...process.env, LANE_MARKER: marker },
    timeout: 30_000,
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('preview export from the running service', () => {
  it.each([
    ['', 'no marker set'],
    ['fixture <& "marker\'>', 'fixture &lt;&amp; &quot;marker&#39;&gt;'],
  ])('exports self-contained HTML and stops its server (marker: %j)', (marker, banner) => {
    const output = join(temporaryDirectory(), 'index.html');
    const result = exportPreview(output, marker);

    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    const html = readFileSync(output, 'utf8');
    expect(html).toContain('<h1>digest · 2026-10-28</h1>');
    expect(html).toContain(`<span class="marker">${banner}</span>`);
    expect(html).toContain('<style>');
    expect(html).not.toMatch(/<script\b|<link\b|\bsrc=/i);
    expect(statSync(output).mode & 0o777).toBe(0o600);
    if (marker) {
      expect(result.stdout + result.stderr).not.toContain(marker);
      expect(result.stdout + result.stderr).not.toContain(banner);
    }
    // The heartbeat identifies the actual service child, not merely the tsx wrapper.
    const heartbeat = JSON.parse(readFileSync('var/heartbeat.json', 'utf8')) as { pid: number };
    expect(() => process.kill(heartbeat.pid, 0)).toThrow();
  }, 35_000);

  it('refuses output outside ignored var/ and through symlinks', () => {
    const outside = exportPreview('preview.html', '');
    expect(outside.status).not.toBe(0);
    expect(outside.stderr).toContain('inside ignored var/');

    const directory = temporaryDirectory();
    symlinkSync(resolve('docs'), join(directory, 'linked-docs'));
    const symlink = exportPreview(join(directory, 'linked-docs', 'preview.html'), '');
    expect(symlink.status).not.toBe(0);
    expect(symlink.stderr).toContain('inside ignored var/');
  });
});
