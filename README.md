# Ranica (Раніца)

**Your day on one printed page, every morning.**

Ranica generates a one-or-two page personal "newspaper" each morning: today's calendar,
weather, tasks, news from RSS feeds and Telegram channels, a few German words to repeat,
a hobby fact, a sport reminder and a short AI-written insight based on your own context.
The same page can be opened in a browser as a home page, printed on paper, sent to a
Kindle or pushed to an e-ink display.

Languages: English and German (German text can be written at a learner level, B1).

Runs entirely on Cloudflare (Workers, Workflows, D1, R2, Browser Run) within the free tier;
written in TypeScript.

Status: **M0 — Look**. The page design from `design/` rendered by a Hono Worker with **fake data**:
front page, back page, browser, phone, Kindle and e-ink views in English and German.
No collectors, database, LLM or deliveries yet (see the roadmap in `docs/02-plan.md` §6).

## Run it

```sh
npm install
npm run dev        # wrangler dev → http://127.0.0.1:8787/today
npm test           # route tests (vitest)
npm run render     # with dev running: PDFs/PNGs into out/ (needs a global Playwright + Chromium)
```

| Route | What |
|---|---|
| `/today?lang=en\|de&day=full\|thin&view=web\|print\|kindle\|eink&pages=1\|2` | the edition; `print` = A4 sheets (front + back) with fit-to-page, `kindle` = 1236 × 1648 px, `eink` = 800 × 480 widget |
| `/today.eink?lang=…` | the e-ink widget |
| `/editions`, `/editions/<date>` | fake archive |
| `/api/edition?lang=…` | the facts + Brief JSON behind the page |
| `/health` | status |

Code map: `design/` the page design (tokens, `ranica.css`, reference pages) — the single source of the styles,
copied to `public/css/` by the wrangler build step · `src/fake/` sample data from the reference pages ·
`src/edit/brief.ts` editor output type · `src/compose/` templates (Hono JSX): `front.tsx`, `back.tsx`, `widget.tsx` ·
`public/fit.js` priority-based trimming · `public/app.css` view glue · `scripts/render.mjs` local Playwright render ·
`scripts/copy-fonts.mjs` self-hosts the OFL fonts (Playfair Display, PT Serif, IBM Plex Sans) in `public/fonts`.

## Deploy

GitHub Actions (`.github/workflows/`):

- **CI** (every push and PR): typecheck, tests, `wrangler deploy --dry-run`, then renders all pages and
  uploads them as the `ranica-pages` artifact (A4 PDFs, PNGs, Kindle, e-ink) — download it from the run page.
- **Deploy**: push to `main` → tests → `wrangler deploy` to `https://ranica.<your-subdomain>.workers.dev`;
  pull request → `wrangler versions upload --preview-alias pr-<n>` (a preview URL, production untouched);
  "Run workflow" deploys any branch by hand.

One-time setup:

1. Cloudflare dashboard → Workers & Pages: pick a `workers.dev` subdomain if you have none yet.
2. My Profile → API Tokens → Create Token → template **Edit Cloudflare Workers** (your account, all zones
   or none). Copy the token. Copy the **Account ID** from the Workers & Pages overview.
3. GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
4. Create a `main` branch from this one (and make it the default branch). The first push to `main`
   deploys; PR previews work after that first deploy, because they need the Worker to exist.

From your machine (deploys the working tree as it is, no Git needed):

```sh
npm ci
npx wrangler login          # once: opens the browser, stores an OAuth token
npx wrangler whoami         # check the account
npm run typecheck && npm test
npm run deploy              # wrangler deploy: copies design/*.css to public/css, uploads
```

Without a browser (CI, SSH) use an API token instead of `login`:
`CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npm run deploy`.
`npx wrangler deploy --dry-run --outdir dist` builds without uploading.

Cloudflare Workers Builds (Git integration in the dashboard) works too: production branch `main`,
build command `npm run typecheck && npm test`, deploy command `npx wrangler deploy`, Worker name
`ranica`. Use either it or the Deploy workflow, not both.

Without the secrets the deploy jobs skip with a notice, CI still runs. The deployed page is public and
shows fake data; Cloudflare Access goes in front of it in M1 together with real data.

Docs:

- `docs/01-research.md` — prior art, data sources, delivery channels, rendering options, cost.
- `docs/02-plan.md` — product definition, page layout, architecture, data model, stack, roadmap.
- `docs/03-design-brief.md` — self-contained brief for the page design (print, web, Kindle, e-ink).
