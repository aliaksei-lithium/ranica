// /admin: settings (hourly sync and daily build on/off, languages, wake time), a "Rebuild now" button,
// the recent editions with editor and cost, and the sources. Behind PROBE_KEY until Cloudflare Access.
import type { FC } from 'hono/jsx';
import { Doc } from '../compose/compose';
import { ITEM_RETENTION_DAYS, USED_DAYS, type EditionLog, type SourceStatus } from '../db/queries';
import type { Reader } from '../edition/facts';
import { editionHour } from '../scheduled';

const time = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : '—');

/** /admin without a valid key: asks for PROBE_KEY once, then the cookie remembers it. */
export const LoginPage: FC<{ wrong: boolean }> = ({ wrong }) => (
  <Doc lang="en" title="Ranica · Admin" bodyClass="view-admin">
    <main class="admin">
      <nav class="toolbar">
        <a href="/today">Today</a> <a href="/editions">Archive</a>
      </nav>
      <h1>Admin</h1>
      <form method="post" action="/admin/login" class="admin__card">
        <p>Settings, sources and <strong>Rebuild now</strong> need the admin key (the PROBE_KEY secret).</p>
        {wrong && <p class="admin__run"><strong>Wrong key.</strong></p>}
        <label>Key <input type="password" name="key" autocomplete="current-password" required autofocus /></label>
        <button type="submit">Open admin</button>
      </form>
    </main>
  </Doc>
);

export const SettingsPage: FC<{
  reader: Reader;
  keyParam: string;
  log: EditionLog[];
  sources: SourceStatus[];
  run?: { id: string; status: string; error?: string | null };
}> = ({ reader: r, keyParam, log, sources, run }) => {
  // ?key= is carried along only when the page was opened with it; after the login form the cookie does the job.
  const k = keyParam ? `key=${encodeURIComponent(keyParam)}` : '';
  const url = (path: string, extra = '') => {
    const q = [k, extra].filter(Boolean).join('&');
    return q ? `${path}?${q}` : path;
  };
  const hour = String(editionHour(r.wakeTime)).padStart(2, '0');
  return (
    <Doc lang="en" title="Ranica · Settings" bodyClass="view-admin">
      <main class="admin">
        <nav class="toolbar">
          <a href="/today">Today</a> <a href="/editions">Archive</a>
          {!k && (
            <form method="post" action="/admin/logout" class="admin__logout">
              <button type="submit">Log out</button>
            </form>
          )}
        </nav>
        <h1>Settings</h1>

        <form method="post" action={url('/admin/rebuild')} class="admin__card">
          <h2>Rebuild now</h2>
          <p>Fetches all sources, then builds today's edition in {r.editionLangs.join(' and ')}. Takes about a minute.</p>
          {run && (
            <p class="admin__run">
              Last run <code>{run.id.slice(0, 18)}…</code>: <strong>{run.status}</strong>
              {run.error && ` (${run.error})`} — <a href={url('/admin', `run=${encodeURIComponent(run.id)}`)}>refresh</a>
            </p>
          )}
          <button type="submit">Rebuild today's edition</button>
        </form>

        <form method="post" action={url('/admin/settings')} class="admin__card">
          <h2>Schedule</h2>
          <label><input type="checkbox" name="autoRefresh" checked={r.autoRefresh} /> Fetch sources every hour</label>
          <label><input type="checkbox" name="autoEdition" checked={r.autoEdition} /> Build the edition every morning (at {hour}:00, the hour before wake time)</label>
          <label>Wake time <input type="time" name="wakeTime" value={r.wakeTime} required /></label>
          <h2>Languages</h2>
          <label><input type="checkbox" name="lang" value="en" checked={r.editionLangs.includes('en')} /> English</label>
          <label><input type="checkbox" name="lang" value="de" checked={r.editionLangs.includes('de')} /> Deutsch</label>
          <p class="admin__hint">Each language is a separate editor run and costs as much again; see Cost under Recent editions.</p>
          <button type="submit">Save</button>
        </form>

        <section class="admin__card">
          <h2>Recent editions</h2>
          <table class="table">
            <thead><tr><th>Date</th><th>Lang</th><th>Issue</th><th>Editor</th><th>Cost</th><th>Built (UTC)</th><th>Note</th></tr></thead>
            <tbody>
              {log.map((e) => (
                <tr>
                  <td><a href={`/editions/${e.date}?lang=${e.lang}`}>{e.date}</a></td>
                  <td>{e.lang}</td>
                  <td>{e.issue}</td>
                  <td>{e.model ?? '—'}</td>
                  <td>{e.costCents === null ? '—' : `${e.costCents.toFixed(1)} ¢`}</td>
                  <td>{time(e.generatedAt)}</td>
                  <td>{e.error ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section class="admin__card">
          <h2>Sources</h2>
          <p class="admin__hint">
            Items: stored now (kept {ITEM_RETENTION_DAYS} days). Used: of those, printed in an edition of the last {USED_DAYS} days
            (Telegram goes into the digest by channel, so it shows 0). Sources are switched off in src/collect/sources.ts.
          </p>
          <table class="table">
            <thead><tr><th>Source</th><th>Items</th><th>Used</th><th>Newest</th><th>Last fetch (UTC)</th><th>Status</th></tr></thead>
            <tbody>
              {sources.map((s) => (
                <tr class={s.active ? undefined : 'admin__off'}>
                  <td>{s.id}{!s.active && ' (off)'}</td>
                  <td>{s.items}</td>
                  <td>{s.kind === 'telegram' ? '—' : s.used}</td>
                  <td>{time(s.newest)}</td>
                  <td>{time(s.lastFetchAt)}</td>
                  <td>{s.lastError ?? s.lastStatus ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </Doc>
  );
};
