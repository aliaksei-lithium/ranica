// Day-1 check (docs/02-plan.md §6, M1): fetch every source once from the deployed Worker to see
// whether Cloudflare egress IPs are blocked. Hidden unless the PROBE_KEY secret is set and passed
// as ?key=…, so nobody else can make the Worker hit the feeds.
import { collect } from '../collect/fetch';
import { SOURCES, sourceUrl } from '../collect/sources';

export interface ProbeResult {
  id: string;
  url: string;
  ok: boolean;
  status: number | null;
  ms: number;
  bytes: number;
  truncated: boolean;
  items: number;
  newest: string | null;
  sample?: string;
  error?: string;
}

export async function probeSources(): Promise<{ ok: number; total: number; colo?: string; results: ProbeResult[] }> {
  const results = await Promise.all(
    SOURCES.map(async (s): Promise<ProbeResult> => {
      const t0 = Date.now();
      const base = { id: s.id, url: sourceUrl(s) };
      try {
        const r = await collect(s);
        return {
          ...base,
          ok: r.status === 200 && r.items.length > 0,
          status: r.status,
          ms: Date.now() - t0,
          bytes: r.bytes,
          truncated: r.truncated,
          items: r.items.length,
          newest: r.items[0]?.publishedAt ?? null,
          sample: r.items[0]?.title,
        };
      } catch (e) {
        return { ...base, ok: false, status: null, ms: Date.now() - t0, bytes: 0, truncated: false, items: 0, newest: null, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
  return { ok: results.filter((r) => r.ok).length, total: results.length, results };
}
