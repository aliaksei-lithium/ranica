// Worker bindings (wrangler.jsonc). The Workflows are declared under `exports` and reached
// through ctx.exports, so they have no binding here.
export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  /** Secret: enables /probe/sources and /admin/*. */
  PROBE_KEY?: string;
  /** Secret: Claude editor. Without it editions use the no-LLM fallback editor. */
  ANTHROPIC_API_KEY?: string;
  /** Var: Claude model for the editor; default claude-sonnet-5-5 (src/edit/editor.ts). */
  EDITOR_MODEL?: string;
  /** Var: https://gateway.ai.cloudflare.com/v1/<account>/<gateway>/anthropic; unset = direct to Anthropic. */
  AI_GATEWAY_URL?: string;
  /** Var: public address of the web edition without scheme, printed in the footer and the QR codes. */
  PUBLIC_URL?: string;
}

declare global {
  namespace Cloudflare {
    // Types `ctx.exports` (and `exports` in tests) from the main module's exports.
    interface GlobalProps {
      mainModule: typeof import('./index');
    }
  }
}
