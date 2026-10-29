import type { DigestRow, DigestResult } from '../digest/types.js';

function value(text: string | null | undefined) {
  return text ?? '—';
}

function DigestTable({ rows }: { rows: DigestRow[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>job</th><th>owner</th><th>runs</th><th>retries</th><th>last status</th>
          <th>last error</th><th>first time</th><th>last time</th><th>attention</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const warning = row.retries >= 3 || row.hasFailure;
          return (
            <tr>
              <td>{row.job}</td>
              <td>{value(row.owner)}</td>
              <td>{row.runs}</td>
              <td class={row.retries >= 3 ? 'warn' : undefined}>{row.retries}</td>
              <td class={row.hasFailure ? 'warn' : undefined}>{row.lastStatus}</td>
              <td class={row.hasFailure ? 'warn' : undefined}>{value(row.lastError)}</td>
              <td>{row.firstAt}</td>
              <td>{row.lastAt}</td>
              <td class={warning ? 'warn' : undefined}>{warning ? 'attention' : '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function DigestPage({ digest }: { digest: DigestResult }) {
  return (
    <>
      <h1>digest · {digest.night}</h1>
      <p class="mute">bad lines: {digest.badLines}</p>
      {digest.rows.length === 0 ? <p>nothing ran</p> : <DigestTable rows={digest.rows} />}
    </>
  );
}
