// E-ink widget, 800 × 480, 1-bit (design/pages/eink-widget*.html):
// date, sun line, weather, today's agenda (max 5 rows), 3 headlines.
import type { FC } from 'hono/jsx';
import type { Edition } from '../model';
import { dateParts, signed, t } from './i18n';
import { SunItems, Unavailable } from './parts';
import { rubrics } from './front';

export const Widget: FC<{ e: Edition }> = ({ e }) => {
  const { facts: f, brief: b } = e;
  const L = t(f.lang);
  const d = dateParts(f.date, f.lang);
  const events = f.events.slice(0, 5);
  const tasks = f.tasks.slice(0, 5 - events.length);
  const headlines = [
    ...rubrics(e, b.news).map((r) => ({ title: r.items[0]!.title, tag: `${r.name} · ${r.items[0]!.source}` })),
    ...b.telegram_digest.map((tg) => ({ title: `${tg.channel} — ${tg.summary}`, tag: `${L.telegram} · ${tg.channel}` })),
  ].slice(0, 3);

  return (
    <div class="widget" data-theme="eink" lang={f.lang}>
      <div class="widget__head">
        <div class="widget__date">
          <span class="widget__day">{d.day}</span>
          <span>
            <span class="widget__month">{d.month}</span>
            <span class="widget__weekday">
              {d.weekday} · {d.year}
            </span>
          </span>
        </div>
        <div class="widget__wordmark">
          Ranica<small>{f.editionTitle}</small>
        </div>
      </div>
      <p class="widget__sun">
        <SunItems f={f} />
      </p>
      <div class="widget__weather">
        {f.weather ? (
          <>
            <span class="widget__temp">{signed(f.weather.max)}°</span>
            <p>{f.weather.summary}</p>
            {b.weather_note && <p class="widget__advice">{b.weather_note}</p>}
          </>
        ) : (
          <Unavailable text={L.weatherUnavailable} reason={f.unavailable.weather ?? L.unavailable} />
        )}
      </div>
      <div class="widget__agenda">
        <span class="label">{L.today}</span>
        <div class="agenda">
          {events.length === 0 && <p class="agenda__empty">{L.noEvents}</p>}
          {events.map((ev) => (
            <>
              <span class="agenda__time">{ev.time}</span>
              <p>
                <span class="agenda__title">{ev.title}</span>
                {(ev.durationMin || ev.place) && (
                  <span class="agenda__meta">{ev.durationMin ? `${ev.durationMin} ${L.min}` : ev.place}</span>
                )}
              </p>
            </>
          ))}
          {tasks.map((task) => (
            <>
              <span class="agenda__time agenda__time--check">
                <span class="checkbox" />
              </span>
              <p>
                <span class="agenda__title">{task.title}</span>
              </p>
            </>
          ))}
        </div>
      </div>
      <div class="widget__headlines">
        {headlines.map((h) => (
          <p class="widget__headline">
            {h.title}
            <span class="tag">{h.tag}</span>
          </p>
        ))}
      </div>
    </div>
  );
};
