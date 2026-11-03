// The design (design/tokens.css, design/ranica.css) is the single source of the page styles.
// This copies it into public/css/ so the Worker serves it as static assets. Runs as the
// wrangler build step (wrangler.jsonc › build), so `wrangler dev` and `wrangler deploy` both use it.
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('public/css', { recursive: true });
for (const f of ['tokens.css', 'ranica.css']) copyFileSync(`design/${f}`, `public/css/${f}`);
console.log('design → public/css: tokens.css, ranica.css');
