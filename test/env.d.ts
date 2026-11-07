// Bindings visible to tests via `import { env } from 'cloudflare:workers'`.
import type { D1Migration } from 'cloudflare:test';
import type { Env as AppEnv } from '../src/env';
import type { RefreshParams } from '../src/workflows/source-refresh';

declare global {
  namespace Cloudflare {
    interface Env extends AppEnv {
      TEST_MIGRATIONS: D1Migration[];
      SOURCE_REFRESH: Workflow<RefreshParams>;
    }
  }
}
