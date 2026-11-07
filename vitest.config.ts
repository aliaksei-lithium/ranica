import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// Tests run inside workerd with the bindings from wrangler.jsonc (local D1, the Workflow export).
// Migrations are passed in as a test-only binding and applied in test/setup.ts.
export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: { TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, 'migrations')), PROBE_KEY: 'test-key' },
        // Test-only binding so introspectWorkflow() can see instances created through ctx.exports.
        workflows: {
          SOURCE_REFRESH: { name: 'source-refresh', className: 'SourceRefreshWorkflow' },
          EDITION: { name: 'edition', className: 'EditionWorkflow' },
        },
      },
    })),
  ],
  test: { include: ['test/**/*.test.ts'], setupFiles: ['./test/setup.ts'] },
});
