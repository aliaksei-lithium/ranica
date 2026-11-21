<p align="center">
  <img src="docs/images/icon.png" width="132" alt="">
</p>

<h1 align="center">Ranica</h1>

<p align="center">
  Your day on one printed page, every morning.<br>
  A personal newspaper for Berlin, written fresh before you wake up.
</p>

<p align="center">
  <a href="https://github.com/aliaksei-lithium/ranica/actions/workflows/ci.yml"><img src="https://github.com/aliaksei-lithium/ranica/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/aliaksei-lithium/ranica/actions/workflows/deploy.yml"><img src="https://github.com/aliaksei-lithium/ranica/actions/workflows/deploy.yml/badge.svg" alt="Deploy"></a>
  <a href="https://zeitung.aliaksei.xyz/today"><img src="https://img.shields.io/badge/read-zeitung.aliaksei.xyz-111111" alt="zeitung.aliaksei.xyz"></a>
  <img src="https://img.shields.io/badge/runs%20on-Cloudflare%20Workers-111111" alt="Cloudflare Workers">
  <img src="https://img.shields.io/badge/app-macOS%20·%20iPhone%20·%20web-111111" alt="macOS, iPhone, web">
</p>

![Ranica on macOS](docs/images/mac.png)

## Get it

Open **[zeitung.aliaksei.xyz/today](https://zeitung.aliaksei.xyz/today)** and install it as an app
(the old address, `ranica.aliaksei-zhynhiarouski.workers.dev`, still works):

- **macOS** — in Safari choose **File ▸ Add to Dock**; in Chrome or Edge click the install icon in the address bar.
- **iPhone** — in Safari tap **Share ▸ Add to Home Screen**.
- **Paper** — print the page; it is laid out as two A4 sheets, front and back.

Editions you have opened stay readable offline.

| Phone | Print |
|---|---|
| <img src="docs/images/phone.png" width="360" alt="Ranica on a phone"> | <img src="docs/images/print.png" width="420" alt="Ranica printed on A4"> |

## What is on the page

- **The news that matters**: Berlin, transport, Germany, the world and business, picked from tagesschau,
  Tagesspiegel, rbb24, Berliner Morgenpost and Handelsblatt. Each story appears once, and nothing from
  the last two days comes back unless something new happened.
- **Stadtgespräch**: the one thing Berlin and Germany are talking about today, from a football
  result to a scandal, based on what people search for right now, plus a few other topics.
- **Einblick des Tages**: a short note that connects today's facts into something useful.
- **Weather, sunrise and holidays** for Berlin and Belarus.
- **Telegram digest** in the channel's own language.
- **German practice**: the edition is written in natural German at B1, with a word of the day and the
  harder words of today's text explained. English is available too.

## How it works

Every hour Ranica collects the sources. Shortly before your wake time Claude reads everything that is
new, picks and rewrites the stories into the page, and stores the edition. Without Claude a simple
editor fills the page with the newest items. Everything runs on Cloudflare's free tier.

---

[Building and deploying](docs/building.md) · [Plan](docs/02-plan.md) · [Design brief](docs/03-design-brief.md)
