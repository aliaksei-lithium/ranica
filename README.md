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

Status: **M1 — My edition** in progress. Every hour a `SourceRefreshWorkflow` fetches the M1 sources
(tagesschau, Tagesspiegel, FAZ, Berliner Zeitung RSS and the Telegram channel @zerkalo_io) into D1. In the
hour before your wake time an `EditionWorkflow` adds Open-Meteo weather, has Claude (`claude-sonnet-5-5` by default, `EDITOR_MODEL` var)
pick and rewrite the items into the page, and stores the edition; `/today` shows it. Without an
`ANTHROPIC_API_KEY` (or when Claude fails) a no-LLM fallback editor fills the page with the newest items.
Not yet: calendar, tasks, vocabulary, Cloudflare Access (roadmap: `docs/02-plan.md` §6, sources: §6.1).

Focus for M1 is the page in the browser, on the phone and on paper. The Kindle view stays in the
code but Kindle/e-mail delivery is postponed to M4.

## Run it

```sh
npm install
npm run dev        # wrangler dev → http://127.0.0.1:8787/today
npm run db:migrate && npm run db:seed   # once: local D1 schema + your reader row
npm test           # vitest inside workerd (local D1, Workflows)
npm run render     # with dev running: PDFs/PNGs into out/ (needs a global Playwright + Chromium)
```

| Route | What |
|---|---|
| `/today?view=web\|print\|kindle\|eink&pages=1\|2` | the newest edition; `print` = A4 sheets (front + back) with fit-to-page, `kindle` = 1236 × 1648 px, `eink` = 800 × 480 widget |
| `/today?fake=1&lang=en\|de&day=full\|thin` | the fake edition from `src/fake/` (also shown while no edition exists) |
| `/today.eink` | the e-ink widget |
| `/editions`, `/editions/<date>` | archive of stored editions |
| `/api/edition` | the facts + Brief JSON behind the page |
| `/probe/sources?key=…` | Day-1 check: fetches and parses every source from the Worker; 404 unless the `PROBE_KEY` secret is set |
| `POST /admin/refresh?key=…` | start a `SourceRefreshWorkflow` run now (it also runs hourly); returns the instance id |
| `/admin/refresh/<id>?key=…` | status and output of that run (per source: HTTP status, parsed, inserted, error) |
| `/admin/sources?key=…` | per source: last fetch, last error, items stored, newest item |
| `POST /admin/edition?key=…[&date=YYYY-MM-DD]` | build today's (or that day's) edition now; returns the instance id |
| `/admin/edition/<id>?key=…` | status and output: editor used, items, dropped ids, error, cost |
| `/health` | status |

Code map: `design/` the page design (tokens, `ranica.css`, reference pages) — the single source of the styles,
copied to `public/css/` by the wrangler build step · `src/fake/` sample data from the reference pages ·
`src/edit/` the editor: `brief.ts` output type, `schema.ts` zod schema for structured output, `editor.ts`
(Claude call and system prompt), `validate.ts` (drop unknown ids, clip), `fallback.ts` (no-LLM editor) ·
`src/edition/facts.ts` facts and editor input · `src/collect/weather.ts` Open-Meteo ·
`src/workflows/edition.ts` · `src/app.ts` routes · `src/scheduled.ts` hourly cron · `src/collect/` sources list, RSS and Telegram parsers, capped fetch,
`refresh.ts` (one source → D1) · `src/db/queries.ts` typed D1 queries · `src/workflows/source-refresh.ts` ·
`migrations/` D1 schema · `seed/me.sql` the single M1 reader · `src/compose/` templates (Hono JSX): `front.tsx`, `back.tsx`, `widget.tsx` ·
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

Day-1 check after the first deploy (are Cloudflare's egress IPs blocked by any source?):

```sh
npx wrangler secret put PROBE_KEY      # any random string
curl "https://ranica.<your-subdomain>.workers.dev/probe/sources?key=<that string>"
```

`ok` should equal `total`; a source with `status` 403/429 or an `error` is blocked from Cloudflare.
Locally: put `PROBE_KEY=…` in `.dev.vars` and open `http://127.0.0.1:8787/probe/sources?key=…`.

### Database (once, before the first deploy with D1)

```sh
npx wrangler d1 create ranica          # copy the printed database_id into wrangler.jsonc
npm run db:migrate:remote
npm run db:seed:remote
npm run deploy                          # also registers the Workflows and the hourly cron
curl -X POST "https://ranica.<your-subdomain>.workers.dev/admin/refresh?key=<PROBE_KEY>"
```

Claude editor (optional; without it the fallback editor runs):

```sh
npx wrangler secret put ANTHROPIC_API_KEY
# optional, for logs and caching in Cloudflare AI Gateway: create a gateway in the dashboard, then set
# "AI_GATEWAY_URL": "https://gateway.ai.cloudflare.com/v1/<account id>/<gateway>/anthropic" in wrangler.jsonc vars
curl -X POST "https://ranica.<your-subdomain>.workers.dev/admin/edition?key=<PROBE_KEY>"
```

New migrations: add `migrations/000N_*.sql`, run `npm run db:migrate` locally and
`npm run db:migrate:remote` before deploying code that needs them.

Without the secrets the deploy jobs skip with a notice, CI still runs. The deployed page is public and
shows fake data; Cloudflare Access goes in front of it in M1 together with real data.

Docs:

- `docs/01-research.md` — prior art, data sources, delivery channels, rendering options, cost.
- `docs/02-plan.md` — product definition, page layout, architecture, data model, stack, roadmap.
- `docs/03-design-brief.md` — self-contained brief for the page design (print, web, Kindle, e-ink).
