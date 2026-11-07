// SourceRefreshWorkflow (docs/02-plan.md §3): hourly via `schedules` in wrangler.jsonc.
// One step per source so each stays under the 10 ms CPU budget and retries on its own;
// a source that still fails after its retries is reported and the others continue.
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import type { Env } from '../env';
import { SOURCES } from '../collect/sources';
import { refreshSource, type RefreshResult } from '../collect/refresh';
import { pruneItems, retentionCutoff, subscribeAllUsers, syncSources } from '../db/queries';

export type RefreshParams = Record<string, never>;

export interface RefreshOutput {
  synced: number;
  subscribed: number;
  results: RefreshResult[];
  pruned: number;
}

export class SourceRefreshWorkflow extends WorkflowEntrypoint<Env, RefreshParams> {
  async run(_event: WorkflowEvent<RefreshParams>, step: WorkflowStep): Promise<RefreshOutput> {
    const db = this.env.DB;
    const { synced, subscribed } = await step.do('sync sources', async () => ({
      synced: await syncSources(db, SOURCES),
      subscribed: await subscribeAllUsers(db),
    }));

    const results: RefreshResult[] = [];
    for (const source of SOURCES) {
      try {
        results.push(
          await step.do(
            `refresh ${source.id}`,
            { retries: { limit: 2, delay: '1 minute', backoff: 'exponential' }, timeout: '1 minute' },
            () => refreshSource(db, source),
          ),
        );
      } catch (e) {
        results.push({ id: source.id, status: null, parsed: 0, inserted: 0, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const pruned = await step.do('prune items', () => pruneItems(db, retentionCutoff(new Date())));
    return { synced, subscribed, results, pruned };
  }
}
