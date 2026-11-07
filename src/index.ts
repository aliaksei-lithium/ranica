// Worker entry. Only handlers and Workflow classes may be exported from the main module;
// routes live in app.ts, the cron in scheduled.ts.
import type { Env } from './env';
import { app } from './app';
import { scheduled } from './scheduled';

export { SourceRefreshWorkflow } from './workflows/source-refresh';
export { EditionWorkflow } from './workflows/edition';

export default { fetch: app.fetch, scheduled } satisfies ExportedHandler<Env>;
