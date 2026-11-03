# 02 — Implementation plan

## 1. Product definition

**One sentence.** Every morning Ranica composes a one-page personal newspaper from your
calendar, tasks, weather, chosen news sources and learning goals, written by an AI editor that
knows your context, and delivers it to your browser, printer, Kindle or e-ink screen.

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

## 3. Architecture

```
            ┌──────────── scheduler (per user, local time, e.g. 06:30) ───────────┐
            ▼                                                                      │
 ┌────────────────┐   ┌───────────────┐   ┌──────────────┐   ┌─────────────┐   ┌──▼────────┐
 │ Collectors     │──▶│ Normalizer +  │──▶│ Editor (LLM) │──▶│ Composer    │──▶│ Renderer  │
 │ ics, rss, tg,  │   │ dedupe, cache │   │ JSON in/out  │   │ fit-to-page │   │ Chromium  │
 │ weather, tasks │   └───────────────┘   └──────────────┘   └─────────────┘   └──┬────────┘
 └────────────────┘                                                               │
                                              html · pdf · png(1-bit) · epub ◀────┘
                                                        │
                       ┌──────────────┬─────────────────┼────────────────┬─────────────┐
                       ▼              ▼                 ▼                ▼             ▼
                   web /today    email (+Kindle)   printer (IPP/CUPS   e-ink URL   archive
                                                   or email-to-print)
```

Key design rules (taken from prior art, section 01 §2):
1. **Edition = typed JSON blocks** (`Brief`). Collectors produce items, the Editor produces a
   `Brief`, the Renderer turns a `Brief` into HTML. Nothing downstream talks to the LLM.
2. **Sources are shared, profiles are private.** A feed or Telegram channel is fetched once
   per interval for all subscribers; calendar/tasks/context are per user and never cached
   across users.
3. **LLM only rewrites and ranks.** Input items carry stable IDs; output references them.
   Any item in the output that is not in the input is dropped before rendering.
4. **Deterministic rendering.** Same `Brief` → same page. Makes tests and the archive cheap.
5. **Fit-to-page by priority**, max 3 render iterations, then hard cut.

### 3.1 Pipeline per edition
1. `EditionJob(userId, date)` fires at `wake_time − 30 min` in the user's timezone
   (db-scheduler / Quartz; one job table, survives restarts).
2. Collectors run in parallel with per-source timeouts (5 s) and return `List<Item>` or an
   `Error`.
3. Normalizer: strip HTML, trim to 400 chars, dedupe (URL hash + title similarity), keep
   items newer than `freshness_window` (default 30 h), cap at 60 items.
4. Editor: one `messages` call with structured output → `Brief`. Validate against input IDs.
   On failure: retry once, then build a **no-LLM fallback Brief** (facts only, no insight).
5. Composer: assign blocks to template slots, run fit loop.
6. Renderer: Chromium → `edition.html` (self-contained, fonts inlined), `edition.pdf` (A4),
   `edition-kindle.pdf` (device page size), `edition.png` (device resolution, 1-bit).
7. Delivery: fan out to enabled channels; each delivery recorded with status.
8. Store edition + artifacts; prune artifacts after 90 days.

### 3.2 Editor contract (LLM)
System prompt (stable, cached): role, language rules, B1 rules, JSON schema, "never invent".
User message (volatile): `profile.context_md`, date/time, weather facts, events, tasks,
items[], vocab_due[], hobby_topics[], sport_rules result.
Output schema (excerpt):
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
  "tomorrow": "1 line"
}
```

## 4. Data model (Postgres)

| Table | Key fields |
|---|---|
| `user` | id, email, locale (`en`/`de`), learner_level, timezone, city, lat/lon, wake_time, plan |
| `profile` | user_id, context_md, hobbies[], sport_rules (json), countdowns (json: label+date) |
| `source` | id, kind (`rss`/`telegram`/`gnews_query`/`ics`/`todoist`/`md_tasks`), config (json), shared (bool), last_fetch_at, last_error |
| `subscription` | user_id, source_id, rubric, weight |
| `item` | id, source_id, external_id, url, title, body, published_at, fetched_at, hash |
| `vocab_card` | id, user_id, de, en, example, fsrs_state (json), due_at, created_from_item_id |
| `review` | card_id, reviewed_at, rating, mode (`paper`/`web`) |
| `edition` | id, user_id, date, status, brief (jsonb), html_path, pdf_path, png_path, tokens_in/out, cost_cents, generated_at |
| `delivery` | edition_id, channel, target, status, error, sent_at |
| `job` | db-scheduler table |

Secrets (ICS secret URLs, SMTP, Todoist tokens) are encrypted at rest with a server key
(AES-GCM via Tink); never logged.

## 5. Stack

| Layer | Choice | Why |
|---|---|---|
| Language | **Kotlin on JVM 21** | Your primary language; a long-running public app with scheduling, auth, HTTP and HTML rendering is where the JVM is strong |
| Framework | **Spring Boot 3.x** (WebMVC + Security + Thymeleaf) | OAuth2 client, scheduling, mail, actuator, config encryption come for free; Ktor is leaner but you would rebuild those |
| DB | PostgreSQL 16, Flyway, Spring Data JDBC (or jOOQ) | jsonb for `brief`, simple mapping |
| Scheduler | db-scheduler | Persistent, cluster-safe, one table |
| HTTP clients | Spring `RestClient` | Timeouts, retries via Resilience4j |
| RSS | Rome | Mature |
| ICS | ical4j | Recurrence handling |
| Telegram | jsoup on `t.me/s` | No credentials |
| Weather | Open-Meteo JSON | No key |
| LLM | Anthropic Java SDK (`com.anthropic:anthropic-java`), `claude-opus-5-5`, structured outputs, `fallbacks: "default"` | One call per edition |
| Spaced repetition | FsrsKt | FSRS-6 on JVM |
| Templates | Thymeleaf + plain CSS (grid, `@page`) | Server-rendered; the same HTML is the web page and the print source |
| Rendering | Playwright for Java (Chromium) | PDF + PNG from the same HTML |
| Image | `com.sksamuel.scrimage` or AWT for 1-bit dithering | e-ink PNG |
| Email | Spring Mail + any SMTP (Resend/Postmark/Gmail app password) | Kindle delivery |
| Auth | Magic-link email (v1), Google sign-in later | No passwords to protect |
| Frontend | Server-rendered HTML + htmx for the settings pages | No SPA; the product is a page, not an app |
| Packaging | Docker (base `mcr.microsoft.com/playwright/java`), Compose with Postgres | One VM |
| CI | GitHub Actions: build, tests, golden-render test, Docker push | |

Python stays for throwaway scripts (feed probing, one-off imports), per your preference.

Project layout (Gradle, single module to start, split later):
```
ranica/
  build.gradle.kts
  src/main/kotlin/ranica/
    collect/   IcsCollector, RssCollector, TelegramCollector, WeatherCollector, TasksCollector
    edit/      EditorService (LLM), BriefSchema, FallbackEditor
    compose/   Composer, FitToPage
    render/    ChromiumRenderer, Outputs (html/pdf/png/epub)
    deliver/   WebDelivery, EmailDelivery, KindleDelivery, PrinterDelivery
    learn/     VocabService (FSRS), ReviewController
    web/       TodayController, EditionController, SettingsController
    user/      User, Profile, Auth
    jobs/      EditionJob, SourceRefreshJob
  src/main/resources/templates/edition.html, settings/*.html
  src/main/resources/static/css/newspaper.css, fonts/
  docs/
```

## 6. Roadmap

Each milestone ends with something you can read in the morning.

### M0 — Look (2–3 days)
- Static `edition.html` + `newspaper.css` with **fake data** for the full layout above, EN and DE.
- Gradle project, Playwright renders it to A4 PDF and a 1-bit PNG.
- Print it. Adjust type sizes until a two-column page is readable at 9–10 pt.
- Done when: the printed page looks like the reference photo and you want to read it.

### M1 — My edition, single user (1–2 weeks)
- Collectors: ICS (your Google secret URL), 3–5 RSS feeds, 2–3 Telegram channels, Open-Meteo,
  `tasks.md`.
- Editor with Claude, structured output, fallback editor.
- Composer with fit-to-page.
- Web: `/today`, `/editions/<date>`, archive list. Set `/today` as your browser home page.
- Delivery: email with PDF → your Kindle address; daily job at 06:30 local.
- Config from `application.yml` + env (no accounts yet).
- Done when: you read Ranica for 5 mornings in a row without touching the laptop.

### M2 — Learning and personal blocks (1 week)
- Vocabulary: CSV/Anki import, FSRS scheduling, 5 due cards per day, paper-mode auto-"Good",
  web grading page, "new word from today's news".
- Sport rules, countdowns, hobby rubric via Google News RSS queries, "on this day".
- `de` mode with B1 writing rules; glossary in parentheses.
- Page-2 "long reads" option.
- Done when: the German block feels like a real lesson, not decoration.

### M3 — Public (2–3 weeks)
- Accounts (magic link), onboarding wizard (city → calendar link → pick sources → 5 lines of
  context → delivery channel), source catalogue with search.
- Per-user schedule and timezone, shared source cache, per-user LLM budget and cost tracking.
- Settings pages, data export/delete, privacy page.
- Rate limiting, abuse protection on collectors (allow-listed hosts, size caps).
- Deploy on one VM with Compose; backups; uptime check.
- Done when: a friend signs up and gets a page the next morning without your help.

### M4 — More outputs and sources (ongoing)
- E-ink endpoint (`today.png` at device size), TRMNL plugin recipe, Kindle-dashboard mode.
- IPP/CUPS printing for self-hosters, email-to-print, thermal ESC/POS.
- Google Calendar OAuth, Todoist, Gmail "what needs an answer" (after Google verification).
- MTProto sidecar for private Telegram channels (bring-your-own session).
- Comic/image slot via an image model, weekly "Sunday edition" with stats.

## 7. Testing strategy
- Unit: collectors against recorded fixtures (WireMock), dedupe, FSRS scheduling, fit loop.
- Contract: Editor output validated against schema and input IDs; a "golden Brief" fixture.
- Golden render: render the golden Brief to PNG in CI and diff against a stored image
  (small tolerance); catches layout regressions.
- Daily smoke in prod: if an edition fails, the fallback editor runs and an alert email is sent.

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Telegram changes `t.me/s` markup | Isolate parser, fixture tests, alert on zero items; RSSHub or MTProto as fallback |
| LLM invents or distorts news | Structured output, ID validation, 2-line cap, source tag on every item |
| Page overflow / ugly breaks | Priority-based fit loop, golden render test, `break-inside: avoid` on blocks |
| Google OAuth verification pain | ICS secret URL first; OAuth only in M4 |
| LLM cost for a public app | Haiku pre-filter, prompt caching, per-user budget, paid tier if needed |
| Chromium memory on a small VM | One browser instance, page pool, render queue with concurrency 2 |
| Open-Meteo non-commercial terms | Switch to a paid plan or Bright Sky/OpenWeather if Ranica charges |

## 9. Decisions still open (defaults chosen, change if you disagree)
1. **Spring Boot vs Ktor** — default Spring Boot for batteries; Ktor if you want a smaller runtime.
2. **Monorepo single module vs modules from day one** — single module until M3.
3. **Kindle format** — device-sized PDF (keeps the newspaper look) by default; EPUB as an option.
4. **Edition name on the masthead** — "Ranica" plus the user's own title (like "Утренний Мардан").
5. **Second page** — off by default.

## 10. First concrete steps
1. Create the Gradle Kotlin project with Spring Boot, Playwright, Thymeleaf (M0 scaffolding).
2. Write `edition.html` + `newspaper.css` from the layout in §2 with fake data in EN and DE.
3. Add a `RenderSmokeTest` that renders the fake edition to PDF and PNG.
4. Print it and iterate on typography before any collector is written.
