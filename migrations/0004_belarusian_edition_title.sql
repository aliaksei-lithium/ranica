-- The reader's title under the nameplate is now Belarusian: "Ранішні Аляксей".
-- seed/me.sql never overwrites an existing row, so rename it here (only if it is still the old default).
UPDATE user SET edition_title = 'Ранішні Аляксей' WHERE id = 1 AND edition_title = 'Утренний Алексей';
