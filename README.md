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

Status: **M0 — Look**. The page template, styles and a Hono Worker serving it with **fake data**.
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
| `/today?lang=en\|de&day=full\|thin&view=web\|print\|kindle` | the edition; `print` is an exact A4 sheet with fit-to-page, `kindle` is 1236 × 1648 px, one column |
| `/today.eink?lang=…` | 800 × 480, 1-bit e-ink widget |
| `/editions`, `/editions/<date>` | fake archive |
| `/api/edition?lang=…` | the facts + Brief JSON behind the page |
| `/health` | status |

Code map: `src/fake/` sample data from the design brief · `src/edit/brief.ts` editor output type ·
`src/compose/` page template (Hono JSX) and blocks · `public/newspaper.css` the design and style sheet ·
`public/fit.js` priority-based trimming · `scripts/render.mjs` local Playwright render ·
`scripts/copy-fonts.mjs` copies the OFL fonts (Playfair Display, PT Serif, IBM Plex Sans) into `public/fonts`.

Docs:

- `docs/01-research.md` — prior art, data sources, delivery channels, rendering options, cost.
- `docs/02-plan.md` — product definition, page layout, architecture, data model, stack, roadmap.
- `docs/03-design-brief.md` — self-contained brief for the page design (print, web, Kindle, e-ink).
