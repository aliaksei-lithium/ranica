-- Reader settings for the hourly cron, and one edition per language.
-- auto_refresh: the cron fetches sources hourly. auto_edition: the cron builds the day's editions.
-- edition_langs: comma-separated languages built each time ('en', 'de').
ALTER TABLE user ADD COLUMN auto_refresh INTEGER NOT NULL DEFAULT 1 CHECK (auto_refresh IN (0, 1));
ALTER TABLE user ADD COLUMN auto_edition INTEGER NOT NULL DEFAULT 1 CHECK (auto_edition IN (0, 1));
ALTER TABLE user ADD COLUMN edition_langs TEXT NOT NULL DEFAULT 'en';
UPDATE user SET edition_langs = 'en,de' WHERE id = 1;

-- edition: UNIQUE (user_id, date) becomes UNIQUE (user_id, date, lang); SQLite needs a table rebuild.
PRAGMA defer_foreign_keys = true;
CREATE TABLE edition_new (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  lang         TEXT NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'de')),
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
  model        TEXT,
  UNIQUE (user_id, date, lang)
);
INSERT INTO edition_new (id, user_id, date, lang, issue, status, facts_json, brief_json, r2_prefix, tokens_in, tokens_out,
                         cost_cents, browser_ms, error, generated_at, model)
SELECT id, user_id, date, COALESCE(json_extract(facts_json, '$.lang'), 'en'), issue, status, facts_json, brief_json, r2_prefix,
       tokens_in, tokens_out, cost_cents, browser_ms, error, generated_at, model
FROM edition;
DROP TABLE edition;
ALTER TABLE edition_new RENAME TO edition;
