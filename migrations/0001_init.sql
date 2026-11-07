-- Ranica D1 schema v1 (docs/02-plan.md §4). Times are ISO 8601 UTC strings unless named *_local.
-- JSON columns hold small objects; nothing here is queried inside JSON.

CREATE TABLE user (
  id            INTEGER PRIMARY KEY,
  email         TEXT UNIQUE,                       -- set from the Cloudflare Access JWT; null until then
  name          TEXT NOT NULL,
  edition_title TEXT,                              -- the reader's own title under the masthead
  locale        TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'de')),
  learner_level TEXT,                              -- e.g. 'B1' for German content
  timezone      TEXT NOT NULL DEFAULT 'Europe/Berlin',
  city          TEXT NOT NULL,
  lat           REAL NOT NULL,
  lon           REAL NOT NULL,
  wake_time     TEXT NOT NULL DEFAULT '07:00',     -- local HH:MM; the edition is built 30 min earlier
  plan          TEXT NOT NULL DEFAULT 'free',
  kindle_email  TEXT,                              -- kept for M4 delivery
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE profile (
  user_id          INTEGER PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  context_md       TEXT NOT NULL DEFAULT '',       -- "5 lines about you" for the editor
  hobbies_json     TEXT NOT NULL DEFAULT '[]',
  sport_rules_json TEXT NOT NULL DEFAULT '[]',
  countdowns_json  TEXT NOT NULL DEFAULT '[]'
);

-- Shared and private sources. Shared rows are synced from src/collect/sources.ts.
CREATE TABLE source (
  id             TEXT PRIMARY KEY,                 -- e.g. 'tagesschau-inland'
  kind           TEXT NOT NULL CHECK (kind IN ('rss', 'telegram', 'gnews_query', 'ics', 'todoist', 'md_tasks')),
  name           TEXT NOT NULL,                    -- source tag printed next to items
  config_json    TEXT NOT NULL,                    -- url / channel / rubric; AES-GCM ciphertext for private kinds
  shared         INTEGER NOT NULL DEFAULT 1 CHECK (shared IN (0, 1)),
  active         INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  etag           TEXT,
  last_modified  TEXT,
  last_fetch_at  TEXT,
  last_ok_at     TEXT,
  last_status    INTEGER,
  last_error     TEXT
);

CREATE TABLE subscription (
  user_id   INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  rubric    TEXT,                                  -- null: the editor assigns one per item
  weight    REAL NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, source_id)
);

CREATE TABLE item (
  id           INTEGER PRIMARY KEY,                -- shown to the editor as "n<id>"
  source_id    TEXT NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  external_id  TEXT NOT NULL,
  url          TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL DEFAULT '',           -- plain text, ≤ 2 kB
  link         TEXT,                               -- Telegram: the article the post announces
  published_at TEXT,
  fetched_at   TEXT NOT NULL,
  hash         TEXT NOT NULL,
  UNIQUE (source_id, hash)
);
CREATE INDEX item_source_published ON item (source_id, published_at DESC);
CREATE INDEX item_fetched ON item (fetched_at);

CREATE TABLE vocab_card (
  id                   INTEGER PRIMARY KEY,
  user_id              INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  de                   TEXT NOT NULL,
  en                   TEXT NOT NULL,
  example              TEXT,
  fsrs_json            TEXT NOT NULL DEFAULT '{}',
  due_at               TEXT NOT NULL,
  created_from_item_id INTEGER REFERENCES item(id) ON DELETE SET NULL,
  UNIQUE (user_id, de)
);
CREATE INDEX vocab_card_due ON vocab_card (user_id, due_at);

CREATE TABLE review (
  card_id     INTEGER NOT NULL REFERENCES vocab_card(id) ON DELETE CASCADE,
  reviewed_at TEXT NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
  mode        TEXT NOT NULL CHECK (mode IN ('paper', 'web')),
  PRIMARY KEY (card_id, reviewed_at)
);

CREATE TABLE edition (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,                      -- local date of the edition, YYYY-MM-DD
  issue        INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  facts_json   TEXT,
  brief_json   TEXT,
  r2_prefix    TEXT,
  tokens_in    INTEGER,
  tokens_out   INTEGER,
  cost_cents   REAL,
  browser_ms   INTEGER,
  error        TEXT,
  generated_at TEXT,
  UNIQUE (user_id, date)
);

CREATE TABLE delivery (
  edition_id INTEGER NOT NULL REFERENCES edition(id) ON DELETE CASCADE,
  channel    TEXT NOT NULL,                        -- 'email' | 'kindle' | 'webhook' (M4)
  target     TEXT NOT NULL,
  status     TEXT NOT NULL,
  error      TEXT,
  sent_at    TEXT,
  PRIMARY KEY (edition_id, channel, target)
);
