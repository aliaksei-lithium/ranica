-- The single M1 reader (docs/02-plan.md §6, M1). Same values as the fake edition; no e-mail here
-- because the repository is public — it is set from the Cloudflare Access login later.
-- Apply: npm run db:seed (local) / npm run db:seed:remote. Safe to run twice.
INSERT INTO user (id, name, edition_title, locale, learner_level, timezone, city, lat, lon, wake_time)
VALUES (1, 'Aliaksei', 'Ранішні Аляксей', 'en', 'B1', 'Europe/Berlin', 'Berlin', 52.52, 13.405, '07:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profile (user_id) VALUES (1) ON CONFLICT (user_id) DO NOTHING;
