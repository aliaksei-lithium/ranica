import type { FC } from 'hono/jsx';
import type { Edition } from '../model';
import { dateParts, signed, t } from './i18n';
import { Glyph } from './blocks/Glyph';

/** E-ink widget, 800 × 480, 1-bit: date, sun line, weather, agenda (max 5), 3 headlines. */
export const EinkPage: FC<{ e: Edition }> = ({ e: { facts: f, brief: b } }) => {
  const L = t(f.lang);
  const d = dateParts(f.date, f.lang);
  return (
    <html lang={f.lang}>
      <head>
        <meta charset="utf-8" />
        <title>Ranica · e-ink</title>
        <link rel="stylesheet" href="/fonts/fonts.css" />
        <link rel="stylesheet" href="/newspaper.css" />
      </head>
      <body class="view-eink">
        <main class="eink">
          <section class="eink-left">
            <div class="eink-day">{d.day}</div>
            <div class="eink-month">{d.month}</div>
            <div class="eink-weekday">{d.weekday}</div>
            {f.sun && (
              <div class="eink-sun">
                <Glyph name="sun" class="glyph-inline" /> {f.sun.sunrise} → {f.sun.sunset}
              </div>
            )}
            <div class="eink-weather">
              {f.weather ? (
                <>
                  <span class="eink-temp">{signed(f.weather.max)}°</span>
                  <span class="eink-note">{b.weather_note}</span>
                </>
              ) : (
                <span class="eink-note">× {f.unavailable.weather}</span>
              )}
            </div>
          </section>
          <section class="eink-right">
            <h2 class="eink-label">{L.today}</h2>
            {f.events.length === 0 ? (
              <p class="eink-row">{L.noEvents}</p>
            ) : (
              f.events.slice(0, 5).map((ev) => (
                <p class="eink-row">
                  <b class="time">{ev.time}</b> {ev.title}
                </p>
              ))
            )}
            <h2 class="eink-label">{L.news}</h2>
            {b.news.slice(0, 3).map((n) => (
              <p class="eink-row eink-headline">{n.title}</p>
            ))}
          </section>
        </main>
      </body>
    </html>
  );
};

export function renderEink(e: Edition): string {
  return `<!doctype html>${(<EinkPage e={e} />).toString()}`;
}
