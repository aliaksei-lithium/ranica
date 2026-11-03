# 03 — Design brief for Ranica

This brief is self-contained. A designer (or design agent) should be able to work from it
without reading the other documents.

## 1. What Ranica is

Ranica ("раніца" = morning in Belarusian) is a **personal one-page morning newspaper**. Every
morning a server composes a page from the reader's own calendar, tasks, weather, chosen news
feeds and Telegram channels, a few German words to repeat, a hobby fact, a sport reminder and a
short AI-written insight. The same page is:

1. printed on A4 paper (most important target; black and white laser/inkjet),
2. opened in a browser as a home page,
3. sent to a Kindle as a PDF sized to the e-reader screen,
4. shown on a small e-ink display (1-bit, no greys).

It must look like a **real newspaper page**, not a dashboard, not a mobile app, not a web
"card" layout. Dense, typographic, calm. One reader, one copy ("Print run: 1 copy").

Reference feeling: a personal daily paper from Astana, with a huge date in the masthead, an
almanac line (sunrise, sunset, day length, countdowns), weather as a big number plus a
plain-language sentence, a checklist of today's things with a grey context line under each item,
news grouped by rubric with a source tag, a boxed "idea of the day", and a comic strip at the
bottom. We keep everything except the comic (reserve a slot for later).

## 2. Readers and languages

- Primary reader: a software engineer in a cold city, learning German (A2→B1), with a gym
  routine and hobbies, who reads a few newspapers and Telegram channels.
- The page is generated in **English or German** (one language per page). German pages use
  simple B1 sentences and sometimes show a gloss in parentheses after a rare word.
- Must handle long German words (e.g. "Krankenversicherungsbeitrag") without ugly breaks.
- Names, cities and channels can be Cyrillic or Latin; fonts must cover Latin Extended and Cyrillic.

## 3. Hard constraints

| Constraint | Detail |
|---|---|
| Page size | A4 portrait (210 × 297 mm), 12 mm margins all sides. Letter variant later. |
| Colour | **Monochrome only.** Black ink on white paper. Greys allowed for print and web but every element must still read when greys are flattened to pure black/white (e-ink). No colour anywhere. |
| Density | Everything in §4 fits on **one** page in both languages; German text runs ~15 % longer than English. Body text 9–10 pt; nothing smaller than 7 pt. |
| Overflow | Blocks have priorities (see §4). When content does not fit, the system removes the lowest-priority blocks from the bottom up. Design must look finished with any of the optional blocks missing. |
| Errors | Any block may be replaced by a one-line "unavailable" note (e.g. "Weather unavailable (Open-Meteo timeout)"). Design that line. |
| Images | No photos in v1. Allowed: small weather glyphs, checkboxes, rules, a QR code (≥ 12 mm) per rubric in the print version only. |
| Fonts | Must be free to embed (OFL or similar). Suggested direction: a high-contrast serif for headlines (e.g. Playfair Display or Old Standard TT), a sturdy text serif for body (PT Serif or Source Serif 4), a grotesque for numbers and labels (Inter or IBM Plex Sans). Designer may propose others if they are OFL and cover Cyrillic. |
| Implementation | The design becomes one HTML + CSS template rendered by headless Chromium (CSS grid, `@page`). Avoid effects that need JavaScript, blend modes or raster images. |
| Web | The same page is shown in a desktop browser at ~900 px wide. It should centre on a light grey background like a sheet of paper. Responsive stacking for narrow phone screens is a nice-to-have, not a must. |
| Kindle | Same page reflowed to a 6.8" e-reader PDF, 1236 × 1648 px, grey-scale, single column is acceptable. |
| E-ink widget | 800 × 480 px, 1-bit. Only: date, sun line, weather, today's agenda (max 5), 3 headlines. |

## 4. Page anatomy and content budget

Priorities: P1 never removed, P5 removed first.

| # | Block | Priority | Content budget (per language) |
|---|---|---|---|
| A | **Masthead**: day number very large, month name, weekday + year; edition name ("Ranica" + reader's own title, e.g. "Утренний Алексей"), issue number, "Print run: 1 copy · <city> · for <name>" | P1 | Date number ≥ 60 pt. Two short lines of small caps/labels. |
| B | **Sun line**: sunrise, sunset, day length, change vs yesterday, 1–3 countdowns ("47 days to Christmas", "12 days to B1 exam") | P1 | One line, 70–110 characters. |
| C | **Weather**: big temperature (today's max), 2–3 lines of plain text (morning / feels-like / afternoon / wind), one highlighted advice line ("Colder than it looks. Hat.") | P1 | Number ≥ 36 pt; ≤ 220 characters text. |
| D | **Today**: time-ordered events (time, title, duration/place, optional grey note like "leave by 12:20, U8 takes 18 min") then tasks with checkboxes and a grey context line each | P1 | Up to 6 events + 6 tasks; each ≤ 2 lines. Empty state: "No meetings today." |
| E | **Sport**: one line | P3 | ≤ 120 characters. |
| F | **Deutsch heute / German today**: 5 vocabulary cards (German word, translation, one example sentence) + 1 "new word from today's news" | P2 | ≤ 5 × 2 lines + 1 × 2 lines. Should feel like a small lesson box, visually distinct from news. |
| G | **News**: 2–4 rubrics (e.g. Tech, Germany, World, From Telegram), 2–4 items each: title (≤ 70 chars), summary ≤ 2 lines, source tag (outlet or @channel), optional QR per rubric in print | P2 | ~1 100 characters total. |
| H | **Insight of the day**: boxed, 2–4 sentences written from the reader's context | P2 | ≤ 400 characters. Visually the strongest box after the masthead. |
| I | **Hobby**: one fact or one link, 2 lines | P4 | ≤ 200 characters. |
| J | **On this day / Quote** | P5 | ≤ 160 characters. |
| K | **Comic slot** (future): reserve a 3-panel strip area at the bottom; in v1 the space is simply not rendered | P5 | 3 panels, ~55 × 55 mm each. |
| L | **Footer**: tomorrow in one line, "Generated 06:40 · 14 sources", page URL | P1 | One line. |

Suggested arrangement (not mandatory): two columns, ~62 % left / 38 % right. Left: C, D, E, F.
Right: G, H, I, J. A, B full width top; L full width bottom. The designer may propose a better
grid as long as the hierarchy is: date → weather → today → news → insight.

## 5. Sample content (use this, not lorem ipsum)

**English**
- Date: Monday, 3 November 2026 · Issue №12 · Print run: 1 copy · Berlin · for Aliaksei
- Sun: ☼ 07:06 → 16:33 · day 9 h 27 min · −3 min vs yesterday · 47 days to Christmas · 12 days to B1 exam
- Weather: +6° · "Morning +2°, feels like −3°. Cloudy, dry, wind 5 m/s. Up to +6° by 14:00." Advice: "Colder than it looks. Take a hat."
- Today: 09:30 Standup (30 min) · 13:00 Dentist, Friedrichstr. 12 — note "leave by 12:20, U8 takes 18 min" · 18:30 Deutschkurs B1 (online). Tasks: ☐ Sign the contract — "DocuSign sent reminder #2 yesterday"; ☐ Reply to Wizstar — "waiting since Thursday"; ☐ Book flights for December.
- Sport: "Gym day (last visit Fri). Dry until 18:00, so a run is possible too."
- German today: der Termin — appointment — "Ich habe um 13 Uhr einen Termin beim Zahnarzt." · die Erinnerung — reminder — "Die Erinnerung kam gestern per E-Mail." · verschieben — to postpone — "Können wir das Treffen verschieben?" · der Vertrag — contract — "Der Vertrag ist noch nicht unterschrieben." · wahrscheinlich — probably — "Morgen regnet es wahrscheinlich." New word from the news: die Zwischenwahl — midterm election.
- News / Tech: "Google releases Gemini 4; Alphabet shares fall 10 % after investors question AI spend" (The Verge) · "Kotlin 2.4 ships with faster incremental compilation" (JetBrains blog). Germany: "DAX expected to retreat ahead of US midterms" (tagesschau) · "Bundestag debates heating-law amendments" (DLF). From Telegram: "@tagesschau — 20 posts, mostly markets and the midterms."
- Insight: "Two deadlines collide this week: the contract and the flight prices. Sign today, and the December trip gets cheaper by Friday. Your German exam is in 12 days; the next three evenings are free."
- Hobby: "On this day in 1957, Sputnik 2 carried Laika into orbit."
- Footer: "Tomorrow: 2 events, rain likely · Generated 06:40 · 14 sources · ranica.app/today"

**German** (same data, B1 style)
- Datum: Montag, 3. November 2026 · Ausgabe Nr. 12 · Auflage: 1 Exemplar · Berlin · für Aliaksei
- Sonne: ☼ 07:06 → 16:33 · Tag 9 Std 27 Min · −3 Min zu gestern · 47 Tage bis Weihnachten · 12 Tage bis zur B1-Prüfung
- Wetter: +6° · "Morgens +2°, gefühlt −3°. Bewölkt, trocken, Wind 5 m/s. Bis 14 Uhr +6°." Hinweis: "Kälter, als es aussieht. Mütze mitnehmen."
- Heute: 09:30 Standup (30 Min) · 13:00 Zahnarzt, Friedrichstr. 12 — "um 12:20 losgehen, U8 braucht 18 Min" · 18:30 Deutschkurs B1 (online). Aufgaben: ☐ Vertrag unterschreiben — "DocuSign hat gestern die 2. Erinnerung geschickt"; ☐ Wizstar antworten — "wartet seit Donnerstag"; ☐ Flüge für Dezember buchen.
- Sport: "Heute Gym (zuletzt Freitag). Bis 18 Uhr trocken, Laufen geht auch."
- Einblick des Tages: "Diese Woche treffen zwei Fristen zusammen: der Vertrag und die Flugpreise. Wenn du heute unterschreibst, wird die Dezember-Reise bis Freitag günstiger. Deine Prüfung ist in 12 Tagen, die nächsten drei Abende sind frei."

## 6. Deliverables

1. **A4 print page, English**, full content (all blocks present).
2. **A4 print page, German**, same layout, showing how the longer text fits.
3. **A4 "thin day"**: no meetings, 2 tasks, weather unavailable line, news only 2 rubrics, blocks E/I/J removed. Must still look finished.
4. **Browser view** at 900 px wide (same page centred on grey), plus an optional phone stacking.
5. **Kindle view** 1236 × 1648 px grey-scale.
6. **E-ink widget** 800 × 480 px, 1-bit (date, sun line, weather, agenda, 3 headlines).
7. **Style sheet**: fonts with sizes/leading for each level (masthead date, section label, item title, body, grey note, footer), rule weights, spacing scale in mm, checkbox and QR specs, the "unavailable" line style, the insight box style.
8. **Page-2 "Long reads" sketch** (optional): 3–5 items with 6–8 line summaries + a "word of the day" box.

Format: Figma (preferred) or PDF + exported PNGs at 300 dpi; fonts named with licence links.

## 7. Do and don't

- Do make the date the largest element; the reader should know the day from across the room.
- Do use rules, small caps, hanging labels, tabular numbers, and whitespace instead of boxes and
  backgrounds.
- Do design the grey "context line" under tasks and the source tag after each news item; these are
  the two most repeated small elements.
- Do make the German lesson block and the insight box visually distinct from news but in the same
  typographic family.
- Don't use colour, gradients, icons sets, rounded cards, drop shadows or UI chrome.
- Don't use more than three type families.
- Don't rely on hairlines thinner than 0.3 pt (they vanish on laser printers and e-ink).
- Don't centre body text; justified or left-aligned newspaper columns only.

## 8. Open questions for the designer

1. Two columns at 62/38, or three narrower columns for a more newspaper-like rhythm?
2. Weather glyphs: simple line symbols or none (text only)?
3. Should the masthead carry a small motto line (e.g. "Alles, was heute zählt") and is it per language?
4. Where should the per-rubric QR codes live so they do not break the column rhythm?
