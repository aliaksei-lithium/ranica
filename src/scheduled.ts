// The hourly cron (docs/02-plan.md §3): source refresh, and each reader's edition in the hour
// before their wake time.
import type { Env } from './env';
import { listReaders } from './db/queries';
import { localNow } from './edition/facts';

/** Local hour in which a reader's edition is built: the hour that contains wake time − 30 min. */
export function editionHour(wakeTime: string): number {
  const [h, m] = wakeTime.split(':').map(Number) as [number, number];
  return Math.floor((((h * 60 + m - 30) % 1440) + 1440) % 1440 / 60);
}

/**
 * Cron Trigger (wrangler.jsonc `triggers.crons`), hourly. Sources are refreshed when any reader has
 * auto_refresh on; a reader's editions (all their languages, one instance) are built in their
 * edition hour when auto_edition is on. Instance ids are per reader and day, so a second run in the
 * same hour does not build twice. (Workflow `schedules` would need the paid plan.)
 */
export const scheduled: ExportedHandlerScheduledHandler<Env> = async (controller, env, ctx) => {
  if (controller.cron !== REFRESH_CRON) return;
  const readers = await listReaders(env.DB);
  if (readers.some((r) => r.autoRefresh)) {
    const refresh = await ctx.exports.SourceRefreshWorkflow.create({ params: {} });
    console.log(`source-refresh started: ${refresh.id}`);
  }
  const now = new Date(controller.scheduledTime);
  for (const reader of readers) {
    if (!reader.autoEdition) continue;
    const local = localNow(now, reader.timezone);
    if (local.hour !== editionHour(reader.wakeTime)) continue;
    try {
      const e = await ctx.exports.EditionWorkflow.create({ id: `edition-${reader.id}-${local.date}`, params: { userId: reader.id, date: local.date } });
      console.log(`edition started: ${e.id}`);
    } catch (err) {
      console.log(`edition for ${reader.id} ${local.date} not started: ${err instanceof Error ? err.message : err}`);
    }
  }
};

export const REFRESH_CRON = '0 * * * *';
