import { defineConfig } from 'vitest/config';

// M0 tests run in Node: the app has no Cloudflare bindings yet.
// Switch to @cloudflare/vitest-pool-workers when D1/R2 arrive (M1).
export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'hono/jsx' },
  test: { include: ['test/**/*.test.ts'] },
});
