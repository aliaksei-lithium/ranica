# Ranica — page design

The design for the morning paper, built from `docs/03-design-brief.md`. The same
stylesheet renders the A4 print page, the browser view, the Kindle PDF and the
e-ink widget. No JavaScript, no raster images, no colour.

The full brand book (type scale, spacing, rules, surfaces, decisions on the
brief's open questions) lives in the Design System artifact; this folder holds
the source files the Worker's renderer will grow from.

| file | what |
|---|---|
| `tokens.json` | colours (paper / e-ink themes), type styles, spacing, rules, page geometry |
| `tokens.css` | the same tokens as CSS custom properties |
| `ranica.css` | the page template: `.sheet`, masthead, sun line, agenda, lesson, rubrics, insight, footer, plus `sheet--kindle`, `sheet--phone`, `sheet--page2`, `.desk` and `.widget` |
| `pages/` | reference renderings with the brief's sample content: `print-page-en`, `print-page-de`, `print-page-thin`, `web-view`, `phone-view`, `kindle-view(-de)`, `eink-widget(-de)`, `long-reads` |

Open `index.html` in a browser, or print any page from Chromium with
`--print-to-pdf` and A4, no margins. Fonts are loaded from Google Fonts
(Playfair Display, PT Serif, IBM Plex Sans; all OFL). Content in the pages is
static sample data; the generator that fills the template is the next milestone.
