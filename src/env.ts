// Worker bindings (wrangler.jsonc). SourceRefreshWorkflow is declared under `exports` and
// reached through ctx.exports, so it has no binding here.
export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  /** Secret: enables /probe/sources and /admin/refresh. */
  PROBE_KEY?: string;
}

declare global {
  namespace Cloudflare {
    // Types `ctx.exports` (and `exports` in tests) from the main module's exports.
    interface GlobalProps {
      mainModule: typeof import('./index');
    }
  }
}
