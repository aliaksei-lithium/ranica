-- Build only the German edition (2026-11-16): each language is a separate editor run, and two runs a
-- day cost too much. English can be switched back on at /admin.
UPDATE user SET edition_langs = 'de' WHERE id = 1;
