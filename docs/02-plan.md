# 02 — Implementation plan

## 1. Product definition

**One sentence.** Every morning Ranica composes a one-page personal newspaper from your
calendar, tasks, weather, chosen news sources and learning goals, written by an AI editor that
knows your context, and is ready as a page in your browser and on your phone, and to print.
Kindle and e-ink outputs exist in the design and come later (M4).

**Primary user (you).** Lives in a city with real winters, works in software (Java/Kotlin),
learns German (A2→B1), has hobbies and a sport routine, reads Telegram channels and a few
newspapers, owns a printer and a Kindle. Wants the page in English or German, and wants German
content pitched at B1 so the page itself is practice.

**Secondary users.** Anyone who wants the same with their own sources. They sign up, paste a
calendar link, pick sources from a catalogue, write 5 lines of context, choose a delivery
channel. No app install.

**Non-goals for v1.** Mobile app, comics/images, full-text articles, social features,
two-way editing of the calendar.

## 2. The page (template spec)

A4 portrait, 12 mm margins, monochrome, two columns (62 % / 38 %). All text in the chosen
language (`en` or `de`). Blocks have a **priority** used by the fit-to-page loop (1 = never
dropped).

```
┌──────────────────────────────────────────────────────────────────────┐
│ 03  November          RANICA · Issue №12                     [p1]    │
│     Monday, 2026      Print run: 1 copy · Berlin · for Aliaksei      │
│ ☼ 07:03 → 16:51 · day 9 h 49 min · −3 min vs yesterday ·            │
│   47 days to Christmas · 12 days to B1 exam                   [p1]   │
├───────────────────────────────────┬──────────────────────────────────┤
│ WEATHER                     [p1]  │ NEWS                       [p2]  │
│  +6°  Morning +2°, feels −3°.     │  Tech                            │
│       Cloudy, dry, wind 5 m/s.    │  · item (source, 2 lines)        │
│  ▌Colder than it looks. Hat.      │  · item                          │
│                                   │  Germany / World                 │
│ TODAY                       [p1]  │  · item                          │
│  09:30 Standup (30 min)           │  From Telegram                   │
│  13:00 Dentist · leave by 12:20,  │  · @channel: 1-line digest       │
│        U8 is 18 min               │                                  │
│  ☐ Sign the contract              │ ┌──────────────────────────────┐ │
│    DocuSign reminder #2 yesterday │ │ INSIGHT OF THE DAY     [p2]  │ │
│  ☐ Reply to Wizstar               │ │ 2–4 sentences from your      │ │
│                                   │ │ context + today's facts      │ │
│ SPORT                       [p3]  │ └──────────────────────────────┘ │
│  Gym day. Last visit Fri. Dry     │                                  │
│  until 18:00 → run possible.      │ HOBBY                      [p4]  │
│                                   │  One fact / one link             │
│ DEUTSCH HEUTE               [p2]  │                                  │
│  5 words due (FSRS) + 1 example   │ ON THIS DAY / QUOTE        [p5]  │
│  sentence each; 1 new word from   │                                  │
│  today's German news              │                                  │
├───────────────────────────────────┴──────────────────────────────────┤
│ Tomorrow: 2 events, rain likely · Generated 06:40 · sources: 14 [p1] │
└──────────────────────────────────────────────────────────────────────┘
```

Page 2 (optional, user setting): "Long reads" — 3–5 items with 6–8 line summaries, a
"Wort des Tages" with grammar note, weekly vocabulary stats.

Rendering rules:
- Every block renders **its own error line** ("Weather unavailable (Open-Meteo timeout)")
  instead of disappearing.
- Every news item has a source tag; the web version links it, the print version optionally
  adds a 12 mm QR code per rubric (not per item) to the web edition.
- `de` mode with `learner_level: B1`: the editor writes German at B1, glosses rare words in
  parentheses, and keeps sentences under ~15 words.

## 3. Architecture (Cloudflare, Workers Free plan)

Hosting decision: everything on one Cloudflare account, free tier, see research §6 for the
limits. The limits that shape the design: **10 ms CPU per Worker invocation and per Workflow
step**, **10 browser-minutes per day**, **no outbound email on Free** (Resend instead),
**1 000 KV writes/day** (so KV is not used for state).

```
 Cron (every 15 min)            Cron (hourly)
      │                              │
      ▼                              ▼
 EditionScheduler Worker        SourceRefresh Workflow
  D1: users due now              one step per shared source:
  → Workflow.createBatch()       fetch → parse → dedupe → D1.items
      │
      ▼
 EditionWorkflow (one instance per user per day)
  step 1  load profile, calendar (ICS fetch+parse), tasks            ─┐ each step:
  step 2  weather (Open-Meteo)                                         │ ≤10 ms CPU,
  step 3  items for this user's subscriptions (D1 read, ≤60 items)     │ retries,
  step 4  vocab due (D1, FSRS)                                         │ state saved
  step 5  editor: Anthropic via AI Gateway → Brief JSON (validate ids)│
  step 6  compose: Brief → HTML string, store to R2                    │
  step 7  render: Browser Run session: load HTML → measure/trim →     │
          pdf (A4) → pdf (Kindle size) → png (e-ink) → R2             │
  step 8  deliveries (M4): Resend email (+Kindle), webhook; record in D1 ─┘
      │
      ▼
 Web Worker (Hono + static assets)
  /today, /editions/:date, /u/:token/today(.png|.pdf), /review (vocab), /settings
  Auth: Cloudflare Access (OTP e-mail / Google), JWT header → user row in D1
```

Storage map:

| Data | Where | Why |
|---|---|---|
| users, profiles, sources, subscriptions, items, vocab, editions (Brief JSON), deliveries | **D1** | relational, 5 M reads/day is plenty, 100 k writes/day is enough with dedupe |
| edition.html / .pdf / kindle.pdf / .png | **R2** | 10 GB, free egress, served through the Worker |
| CSS, fonts, settings UI | **Static assets** | free and unlimited |
| secrets (Anthropic key, Resend key, ICS secret URLs) | Worker secrets (`wrangler secret`) + AES-GCM in D1 for per-user ICS URLs using a server key secret | never in code or logs |
| schedules | **Cron Triggers** (2 of 5 used) | no per-user cron needed: the scheduler reads D1 for users whose local `wake_time − 30 min` falls in this 15-min window |

Design rules kept from the previous version: typed `Brief` JSON, shared sources, LLM only
ranks/rewrites supplied items (ids validated), deterministic rendering, priority-based fit-to-page.
New rules forced by the platform:

6. **One step = one source.** Each step parses at most one feed or channel so it stays under
   10 ms CPU; the Workflow engine retries a failed step without redoing the others.
7. **One browser session per edition.** Browser Run allows one new browser per 20 s and 10 min/day;
   the fit loop, both PDFs and the PNG happen inside the same session (~5–8 s).
8. **Nothing heavy in the Worker.** 1-bit dithering runs in the page (canvas), XML parsing uses a
   streaming/regex-light parser (`fast-xml-parser`), HTML templating is string concatenation
   (`hono/jsx`), JSON schema validation uses a precompiled validator (`typebox` + `ajv` compiled
   at build time or `valibot`).
9. **Reads over writes.** Items are written once per source refresh, read many times per user.

### 3.1 Editor contract (LLM)
Unchanged: a stable, cached system prompt (role, language rules, B1 rules, JSON schema, "never
invent") and a volatile user message (profile context, date, weather facts, events, tasks,
items[], vocab_due[], hobby topics, sport rule result). Output uses Anthropic structured outputs
with the schema below; any `item_id`/`event_id`/`card_id` not present in the input is dropped.
Model: `claude-opus-5-5` through AI Gateway (`https://gateway.ai.cloudflare.com/v1/<acct>/<gw>/anthropic`),
`output_config.effort: "medium"`, `fallbacks: "default"`. Fallback chain: retry once → Workers AI
(`@cf/meta/llama-3.3-70b-instruct-fp8-fast`, JSON mode) → no-LLM Brief (facts only).

```json
{
  "headline": "string ≤ 60 chars",
  "weather_note": "string ≤ 120",
  "agenda": [{"event_id": "e1", "note": "leave by 12:20, U8 takes 18 min"}],
  "tasks": [{"task_id": "t3", "context": "DocuSign reminder #2 yesterday"}],
  "news": [{"rubric": "Tech", "item_id": "n17", "title": "...", "summary": "≤ 2 lines"}],
  "telegram_digest": [{"channel": "@x", "summary": "..."}],
  "insight": "2–4 sentences",
  "sport": "1 line or null",
  "german": {"cards": [{"card_id": "c5", "example": "..."}], "new_word": {"de": "...", "en": "...", "from_item_id": "n4"}},
  "hobby_fact": {"text": "...", "item_id": "n22"},
  "tomorrow": "1 line",
  "on_this_day": {"text": "...", "author": "..."},
  "deep": [{"rubric": "Tech", "item_id": "n1", "title": "...", "summary 6–8 lines": "..."}],
  "back_news": [{"rubric": "World", "item_id": "n7", "title": "...", "summary": "..."}],
  "word_of_day": {"de": "...", "en": "...", "example": "...", "extra": "plural, related words"}
}
```
The last four fields fill the back page (design/pages/back-page-*.html); the TypeScript type is
`src/edit/brief.ts`.

## 4. Data model (D1 / SQLite)

| Table | Key fields |
|---|---|
| `user` | id, email, locale (`en`/`de`), learner_level, timezone, city, lat, lon, wake_time, plan, kindle_email, created_at |
| `profile` | user_id, context_md, hobbies_json, sport_rules_json, countdowns_json |
| `source` | id, kind (`rss`/`telegram`/`gnews_query`/`ics`/`todoist`/`md_tasks`), name, config_json (encrypted for private kinds), shared (0/1), active, etag, last_modified, last_fetch_at, last_ok_at, last_status, last_error |
| `subscription` | user_id, source_id, rubric, weight |
| `item` | id, source_id, external_id, url, title, body (≤ 2 kB), link (Telegram: announced article), published_at, fetched_at, hash — unique (source_id, hash) |
| `vocab_card` | id, user_id, de, en, example, fsrs_json, due_at, created_from_item_id |
| `review` | card_id, reviewed_at, rating, mode (`paper`/`web`) |
| `edition` | id, user_id, date, issue, status, facts_json, brief_json, error, r2_prefix, tokens_in, tokens_out, cost_cents, browser_ms, generated_at — unique (user_id, date) |
| `delivery` | edition_id, channel, target, status, error, sent_at |
| `session` | only if Cloudflare Access is not used; otherwise none |

Schema: `migrations/0001_init.sql`. Shared sources are synced from `src/collect/sources.ts` by the
refresh Workflow (unchanged rows are not rewritten); the M1 reader comes from `seed/me.sql`.

Retention: items 7 days (by publication date, else fetch date; older items are not inserted), editions 90 days (R2 objects deleted by a lifecycle rule), reviews forever.
Write budget check for 100 users: 50 shared sources × 24 refreshes × ~5 new items = 6 k item
rows + 100 editions + ~300 deliveries + reviews ≈ 7 k writes/day of the 100 k allowed.

## 5. Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | **Cloudflare Workers**, TypeScript, `wrangler` | No JVM on Workers; TS is the first-class language with the best tooling |
| HTTP framework | **Hono** | Tiny, typed, runs on Workers, has server-side JSX for templates |
| Orchestration | **Workflows** (`EditionWorkflow`, `SourceRefreshWorkflow`) + 2 **Cron Triggers** | Durable steps with retries, each step gets its own 10 ms CPU budget |
| Database | **D1** + `wrangler d1 migrations` | SQLite, enough quota, zero ops |
| Objects | **R2** | Artifacts with free egress |
| Rendering | **Browser Run** via `@cloudflare/puppeteer` binding | PDF and PNG in one session; locally use Playwright for template work |
| Feeds | `fast-xml-parser` | Fast, small, no DOM |
| ICS | `ical.js` or `node-ical` (nodejs_compat) | Recurrence expansion; cap at 60 days window to keep CPU low |
| Telegram | `fetch` + `HTMLRewriter` (built into Workers, streaming, ~0 CPU) | Parse `t.me/s/<channel>` without loading a DOM |
| Weather | Open-Meteo JSON | No key |
| LLM | **Anthropic TypeScript SDK** (`@anthropic-ai/sdk`) with `baseURL` set to **AI Gateway**; model `claude-opus-5-5`; structured outputs | Quality for selection and B1 German; gateway gives logs, caching, rate limits for free |
| Free LLM fallback | **Workers AI** Llama 3.3 70B (JSON mode) | ~7 editions/day inside the 10 k neurons |
| Spaced repetition | `ts-fsrs` (FSRS-6, TypeScript, used by many Anki-like apps) | Same algorithm as the earlier Kotlin choice |
| Email (+Kindle) | **Resend** HTTP API, sending domain on Cloudflare DNS; PDF as attachment | Free tier ≈ 100/day; Cloudflare's own sending needs Workers Paid |
| Auth | **Cloudflare Access** (one-time PIN / Google), Worker verifies the Access JWT | No auth code, no magic-link mail; up to 50 users free (*verify*), later a Lucia-style session table in D1 |
| Frontend | Server-rendered HTML (Hono JSX) + htmx for settings | The product is a page, not an app |
| Validation | `valibot` (or `typebox`) for Brief and settings | Small bundle, little CPU |
| Tests | `vitest` + `@cloudflare/vitest-pool-workers`; golden render with local Playwright | Same runtime as production |
| CI/CD | GitHub Actions: lint, test, `wrangler deploy` on `main`; `wrangler versions upload` for previews | |
| Local dev | `wrangler dev` (local D1/R2), `wrangler dev --remote` for Browser Run and Workers AI | |

Python is reserved for one-off scripts (feed probing, vocabulary import conversion). Kotlin is
not used in this project.

Project layout (single Worker, split only if the bundle or routes grow):
```
ranica/
  wrangler.jsonc            bindings: D1, R2, BROWSER, AI, WORKFLOWS, crons, assets
  package.json  tsconfig.json  vitest.config.ts
  migrations/               D1 SQL migrations
  src/
    index.ts                Hono app + scheduled() handler
    workflows/              EditionWorkflow.ts, SourceRefreshWorkflow.ts
    collect/                ics.ts, rss.ts, telegram.ts, weather.ts, tasks.ts, gnews.ts
    edit/                   editor.ts (Anthropic), brief.schema.ts, fallbackEditor.ts, workersAi.ts
    compose/                compose.ts (Brief → HTML), blocks/*.tsx, priorities.ts
    render/                 browser.ts (measure/trim/pdf/png in one session), kindle.ts
    deliver/                email.ts (Resend), kindle.ts, webhook.ts
    learn/                  fsrs.ts, review.ts
    web/                    routes/today.tsx, editions.tsx, review.tsx, settings.tsx, auth.ts
    db/                     queries.ts (typed), crypto.ts (AES-GCM for ICS URLs)
  public/                   newspaper.css, fonts/*.woff2, htmx.min.js
  tools/                    Python one-off scripts (probe_feed.py, anki_to_csv.py)
  docs/
```

## 6. Roadmap

Each milestone ends with something you can read in the morning.

### M0 — Look (2–3 days)
- `wrangler init` project with Hono; static `edition.html` + `newspaper.css` with **fake data**,
  EN and DE; `/today` serves it.
- Browser Run binding renders it to A4 PDF and PNG (`wrangler dev --remote`); local Playwright
  script does the same for fast iteration.
- Print it. Adjust type sizes until a two-column page is readable at 9–10 pt.
- Done when: the printed page looks like the reference photo and you want to read it.

### M1 — My edition, single user (1–2 weeks)
Focus: **the page itself** — opened in the browser (home page), on the phone, and printed from the
print view. Kindle and e-mail delivery stay in the code and design but are not worked on in M1
(moved to M4).
- D1 schema + migrations; your user row created by a seed script. *(Done: `migrations/0001_init.sql`,
  `seed/me.sql`, `SourceRefreshWorkflow` started by an hourly Cron Trigger (Workflow `schedules` need the paid plan), `/admin/refresh`.)*
- Collectors: ICS (Google secret URL), the RSS feeds and the Telegram channel from §6.1,
  Open-Meteo, `tasks.md` kept in R2 and edited via a tiny `/tasks` page.
- **Day-1 check**: fetch `t.me/s/zerkalo_io` and the feeds from a deployed Worker (Cloudflare egress
  IPs) with `/probe/sources` to confirm nothing blocks them; otherwise fall back to Browser Run
  `/markdown` for Telegram.
- `EditionWorkflow` with one step per source; editor with Claude via AI Gateway; fallback editor.
  *(Done 2026-11-07: `EditionWorkflow` load → weather → editor → store; Claude Opus 5.5 with structured
  output (zod schema), effort `medium`, server-side refusal fallbacks (`fallbacks: "default"`), id
  validation; no-LLM fallback editor when there is no key or Claude fails; AI Gateway via the
  optional `AI_GATEWAY_URL` var. The Workers AI middle step is not built. No prompt caching: one
  call per day, so a cache entry would always have expired.)*
- Compose + fit-to-page; edition HTML (and the A4 PDF from the browser session) to R2.
- Web: `/today` (set as browser home page, readable on the phone), `/today?view=print` with a
  print button, `/editions/<date>`, archive list, behind Cloudflare Access.
- Cron scheduler at your wake time builds the edition so it is ready when you open the page.
  *(Done: the hourly cron starts the edition in the hour that contains wake time − 30 min, one
  instance id per reader and day; Free plan, so no 15-minute cron.)*
- Done when: you read Ranica for 5 mornings in a row (browser, phone or paper) without touching
  the laptop to make it.

### 6.1 Sources for M1

All German-language; the editor writes the page in `en` or `de` and keeps source tags. URLs were
fetched successfully on 2026-11-07 from a home connection (sizes are one snapshot).
**Day-1 check passed** on 2026-11-07 from the deployed Worker (`/probe/sources`, colo TXL): 7/7
sources returned 200 and parsed, 22–284 ms each, none truncated — Cloudflare egress is not blocked,
so the Browser Run `/markdown` fallback for Telegram is not needed.

| Id | Source | Feed | Rubric | Snapshot |
|---|---|---|---|---|
| `tagesschau-inland` | tagesschau | `https://www.tagesschau.de/inland/index~rss2.xml` | Germany | 49 items, 67 kB |
| `tagesschau-ausland` | tagesschau | `https://www.tagesschau.de/ausland/index~rss2.xml` | World | 70 items, 95 kB |
| `tagesspiegel-berlin` | Tagesspiegel | `https://www.tagesspiegel.de/contentexport/feed/berlin` | Berlin | 100 items, 88 kB |
| `faz-inland` | FAZ | `https://www.faz.net/rss/aktuell/politik/inland/` | Germany | 39 items, 63 kB |
| `faz-ausland` | FAZ | `https://www.faz.net/rss/aktuell/politik/ausland/` | World | 44 items, 71 kB |
| `berliner-zeitung` | Berliner Zeitung | `https://www.berliner-zeitung.de/feed.xml` | — (all sections; editor assigns Berlin/Germany/World) | 100 items, 90 kB |
| `tg-zerkalo` | Telegram @zerkalo_io (Зеркало, Russian) | `https://t.me/s/zerkalo_io` (public web preview, last 20 posts) | Telegram digest | 20 posts, 141 kB HTML |

FAZ's all-news feed (`/rss/aktuell/`, 262 kB, 159 items) is skipped to keep each parse well under
the 10 ms CPU budget; the two politics sections cover Germany and World. Berliner Zeitung has no
working section feeds (`/feed`, `/rss`, `/news.rss` are 404 or HTML), so its single feed is used.
Tech, hobby and other rubrics come later (M2/M3 catalogue).

### M2 — Learning and personal blocks (1 week)
- Vocabulary: CSV/Anki import (Python script → CSV → `/import`), `ts-fsrs` scheduling, 5 due cards
  per day, paper-mode auto-"Good" at midnight, `/review` grading page, "new word from today's news".
- Sport rules, countdowns, hobby rubric via Google News RSS queries, "on this day".
- `de` mode with B1 writing rules and glosses.
- Page-2 "long reads" option.
- Done when: the German block feels like a real lesson, not decoration.

### M3 — Public (2–3 weeks)
- Onboarding wizard behind Access (city → calendar link → pick sources → 5 lines of context →
  delivery channel), source catalogue with search, per-user timezone and wake time.
- Shared source refresh, per-user LLM budget and cost tracking (tokens, browser ms per edition).
- Settings pages, data export/delete, privacy page.
- Collector hardening: allow-listed hosts, response size caps, per-domain rate limits.
- Quota dashboard: editions/day vs browser minutes, Resend mails/day, D1 writes/day; alert at 80 %.
- Done when: a friend signs up and gets a page the next morning without your help.

### M4 — More outputs and sources (ongoing)
- Delivery: Resend e-mail with the PDF → your Kindle address (the `view=kindle` page already exists), delivery records in D1.
- E-ink endpoint (`/u/<token>/today.png` at device size), TRMNL plugin recipe, Kindle-dashboard mode.
- Email-to-print, thermal ESC/POS raster, EPUB output.
- Google Calendar OAuth, Todoist, Gmail "what needs an answer" (after Google verification).
- Private Telegram channels via a user-run MTProto bridge posting into Ranica by webhook.
- Comic/image slot via an image model, weekly "Sunday edition" with stats.
- Move to Workers Paid ($5/mo) when daily editions approach ~80 or mails approach 100/day.

## 7. Testing strategy
- Unit (vitest, Workers pool): collectors against recorded fixtures, dedupe, FSRS scheduling,
  priority trimming, Brief validation against input ids.
- CPU budget test: each collector parses its largest fixture under 5 ms in the Workers runtime
  (half of the limit as safety margin).
- Golden render: compose the golden Brief → HTML → local Playwright PNG; diff against a stored
  image with a small tolerance.
- Contract: Editor output validated against schema; one recorded real response as fixture.
- Daily smoke in prod: if an edition fails, the fallback editor runs and an alert mail is sent;
  Workflow instance ids logged for `wrangler workflows instances describe`.

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| 10 ms CPU per step exceeded (big feed, slow parser) | One source per step, size cap 512 kB, `HTMLRewriter`/streaming parsers, CPU budget tests; Workers Paid raises it to 30 s if ever needed |
| Browser minutes exhausted | One session per edition, measure first then one PDF+PNG; hard stop at 80 % of 10 min; HTML-only fallback delivery |
| Cloudflare egress IPs blocked by t.me or a feed | Day-1 test; Browser Run `/markdown` fallback; RSSHub as last resort |
| No outbound mail on Free | Resend (100/day); own addresses can also use Cloudflare's free "verified destination" sending |
| LLM invents or distorts news | Structured output, id validation, 2-line cap, source tag on every item |
| LLM cost for a public app | Per-user budget, Haiku 5.5 pre-filter, prompt caching, Workers AI fallback, AI Gateway rate limits |
| Page overflow / ugly breaks | Priority-based trimming in the browser, golden render test, `break-inside: avoid` |
| KV write cap | KV not used for state |
| D1 write cap | Dedupe by hash, hourly refresh with ETag/If-Modified-Since, 7-day item retention |
| Google OAuth verification pain | ICS secret URL first; OAuth only in M4 |
| Vendor lock-in | Collectors/editor/compose are plain TypeScript; only `src/workflows`, `render/browser.ts` and `db/` touch Cloudflare APIs |

## 9. Decisions still open (defaults chosen, change if you disagree)
1. **Auth** — Cloudflare Access by default (zero code); own magic links via Resend if Access's
   free user cap or UX gets in the way.
2. **LLM** — Claude Opus 5.5 via AI Gateway by default (≈ $4/month for one user); Workers AI
   Llama for a fully free mode with lower German quality.
3. **Kindle format** — device-sized PDF by default; EPUB later.
4. **Edition name on the masthead** — "Ranica" plus the user's own title.
5. **Second page** — off by default.
6. **Single Worker vs several** — single Worker until M3.

## 10. First concrete steps
1. `npm create cloudflare@latest ranica` (Hono template, TypeScript), add D1, R2, Browser Run and
   Workflows bindings to `wrangler.jsonc`; deploy once to get the `workers.dev` URL.
2. Write `newspaper.css` and the edition template as Hono JSX with fake data in EN and DE.
3. Add `render/browser.ts` (one session: load → measure → trim → pdf → png) and a local Playwright
   script for fast layout iteration.
4. Print it and iterate on typography before any collector is written.
5. From a deployed Worker, open `/probe/sources?key=…` to fetch `t.me/s/zerkalo_io` and the §6.1
   feeds once and confirm Cloudflare egress is not blocked. **Done 2026-11-07: 7/7 OK.** *(Steps 1–2 and the local Playwright
   script are done; `src/collect/rss.ts`, `telegram.ts` and the probe route exist.)*
