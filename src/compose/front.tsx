// Page 1 (design/pages/print-page-*.html): A–L of the design brief on one A4 sheet.
import type { FC } from 'hono/jsx';
import type { Edition } from '../model';
import type { NewsPick } from '../edit/brief';
import { fit } from './priorities';
import { signed, slug, t } from './i18n';
import { Footer, Masthead, SunItems, Unavailable, quote } from './parts';
import { qrSvg } from './qr';

type Rubric = { name: string; items: (NewsPick & { source: string; url: string })[] };

/** Group the editor's picks by rubric, dropping ids that are not in the input (editor contract). */
export function rubrics(e: Edition, picks: NewsPick[], max = 4, perRubric = 4): Rubric[] {
  const byId = new Map(e.facts.items.map((i) => [i.id, i]));
  const out: Rubric[] = [];
  for (const n of picks) {
    const item = byId.get(n.item_id);
    if (!item) continue;
    let r = out.find((x) => x.name === n.rubric);
    if (!r) {
      if (out.length >= max) continue;
      r = { name: n.rubric, items: [] };
      out.push(r);
    }
    if (r.items.length < perRubric) r.items.push({ ...n, source: item.source, url: item.url });
  }
  return out;
}

/**
 * One news rubric. Items after the second carry their own lower priority, so fit.js drops them one
 * by one before it has to drop a whole rubric, the Telegram block or the insight.
 */
const NewsRubric: FC<{ r: Rubric; more?: string }> = ({ r, more }) => (
  <section class="rubric" id={slug(r.name)} {...fit('news')}>
    <span class="label">
      {r.name}
      {more && <span class="label__sub">{more}</span>}
    </span>
    {r.items.map((n, i) => (
      <article class="item" {...(i >= 2 ? fit('newsextra') : {})}>
        <a class="item__title" href={n.url}>{n.title}</a>
        <p class="item__summary">
          {n.summary}
          <span class="tag">{n.source}</span>
        </p>
      </article>
    ))}
  </section>
);

export const FrontPage: FC<{ e: Edition; kindle?: boolean }> = ({ e, kindle }) => {
  const { facts: f, brief: b } = e;
  const L = t(f.lang);
  const notes = new Map(b.agenda.map((a) => [a.event_id, a.note]));
  const contexts = new Map(b.tasks.map((x) => [x.task_id, x.context]));
  const cardsById = new Map(f.cards.map((c) => [c.id, c]));
  const cards = b.german.cards.flatMap((c) => {
    const card = cardsById.get(c.card_id);
    return card ? [{ ...card, example: c.example }] : [];
  }).slice(0, 5);
  const nw = b.german.new_word;
  const news = rubrics(e, b.news, 3);
  // A day without calendar and tasks leaves the wide left column almost empty: the first rubric
  // moves there so the narrow right column does not overflow (fit.js would drop whole rubrics).
  const leftNews = f.events.length === 0 && f.tasks.length === 0 ? news.slice(0, 1) : [];
  const rightNews = news.slice(leftNews.length);
  const deepRubrics = new Set(b.deep.map((d) => d.rubric));
  const telegram = b.telegram_digest.slice(0, 2);
  const base = `https://${f.url}`;
  const qrTargets = [
    ...news.map((r) => r.name),
    ...(telegram.length ? [L.telegram] : []),
  ];

  return (
    <article class={kindle ? 'sheet sheet--kindle' : 'sheet'} lang={f.lang}>
      <Masthead f={f} />
      <p class="sunline" {...fit('sun')}>
        <SunItems f={f} />
      </p>
      <div class="columns">
        <div class="col col--left">
          <section class="section section--weather" {...fit('weather')}>
            <span class="label">{L.weather}</span>
            {f.weather ? (
              <div class="weather">
                <span class="weather__temp">{signed(f.weather.max)}°</span>
                <div class="weather__text">
                  <p>{f.weather.summary}</p>
                  {b.weather_note && <p class="weather__advice">{b.weather_note}</p>}
                </div>
              </div>
            ) : (
              <Unavailable text={L.weatherUnavailable} reason={f.unavailable.weather ?? L.unavailable} />
            )}
          </section>

          <section class="section section--today" {...fit('today')}>
            <span class="label">{L.today}</span>
            <div class="agenda">
              {f.events.length === 0 && <p class="agenda__empty">{L.noEvents}</p>}
              {f.events.slice(0, 6).map((ev) => {
                const note = notes.get(ev.id);
                return (
                  <>
                    <span class="agenda__time">{ev.time}</span>
                    <p>
                      <span class="agenda__title">{ev.title}</span>
                      {ev.durationMin && <span class="agenda__meta">{ev.durationMin} {L.min}</span>}
                      {ev.place && <span class="agenda__meta">{ev.place}</span>}
                    </p>
                    {note && <p class="agenda__note">{note}</p>}
                  </>
                );
              })}
              {f.tasks.length > 0 && (
                <div class="agenda__tasks-label">
                  <span class="label">{L.tasks}</span>
                </div>
              )}
              {f.tasks.slice(0, 6).map((task) => {
                const ctx = contexts.get(task.id);
                return (
                  <>
                    <span class="agenda__time agenda__time--check">
                      <span class={task.done ? 'checkbox checkbox--done' : 'checkbox'} role="checkbox" aria-checked={task.done ? 'true' : 'false'} />
                    </span>
                    <p>
                      <span class="agenda__title">{task.title}</span>
                    </p>
                    {ctx && <p class="agenda__note">{ctx}</p>}
                  </>
                );
              })}
            </div>
          </section>

          {leftNews.map((r) => (
            <NewsRubric r={r} more={deepRubrics.has(r.name) ? L.morePage2 : undefined} />
          ))}

          {b.sport && (
            <p class="runin" {...fit('sport')}>
              <span class="runin__label">{L.sport}</span>
              {b.sport}
            </p>
          )}

          {(cards.length > 0 || nw) && (
            <section class="lesson" lang="de" {...fit('german')}>
              <span class="label">
                {L.german}
                <span class="label__sub">{L.germanSub(cards.length, !!nw)}</span>
              </span>
              <div class="lesson__grid">
                {cards.map((c) => (
                  <div class="lesson__entry">
                    <p>
                      <span class="lesson__word">{c.de}</span>
                      <span class="lesson__gloss" lang={f.lang}>{c.en}</span>
                    </p>
                    <p class="lesson__example">{c.example}</p>
                  </div>
                ))}
                {nw && (
                  <div class="lesson__entry lesson__new">
                    <span class="lesson__new-label" lang={f.lang}>{L.newWord}</span>
                    <p>
                      <span class="lesson__word">{nw.de}</span>
                      <span class="lesson__gloss" lang={f.lang}>{nw.en}</span>
                    </p>
                    <p class="lesson__example">{nw.example}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {b.hobby_fact && (
            <p class="runin" {...fit('hobby')}>
              <span class="runin__label">{L.hobby}</span>
              {b.hobby_fact.text}
            </p>
          )}
          {b.on_this_day && (
            <p class="runin" {...fit('onthisday')}>
              <span class="runin__label">{L.onThisDay}</span>
              {quote(b.on_this_day.text, f.lang)}
              {b.on_this_day.author && ` — ${b.on_this_day.author}`}
            </p>
          )}
        </div>

        <div class="col col--right">
          {rightNews.map((r) => (
            <NewsRubric r={r} more={deepRubrics.has(r.name) ? L.morePage2 : undefined} />
          ))}
          {telegram.length > 0 && (
            <section class="rubric" id={slug(L.telegram)} {...fit('telegram')}>
              <span class="label">{L.telegram}</span>
              {telegram.map((tg) => (
                <article class="item">
                  <span class="item__title">
                    {tg.channel} — {tg.summary}
                  </span>
                </article>
              ))}
            </section>
          )}
          {qrTargets.length > 0 && (
            <div class="qr-strip" {...fit('qr')}>
              <span class="qr-strip__caption">{L.scan}</span>
              <div class="qr-strip__codes">
                {qrTargets.map((name) => {
                  const href = `${base}#${slug(name)}`;
                  return (
                    <a class="qr" href={href}>
                      {qrSvg(href)}
                      <span class="qr__label">{name}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {b.insight && (
        <aside class="insight" {...fit('insight')}>
          <span class="label">{L.insight}</span>
          <p>{b.insight}</p>
        </aside>
      )}
      {/* Block K (comic strip) is reserved for later: .comic-slot is not rendered in v1. */}
      <Footer f={f} tomorrow={b.tomorrow} />
    </article>
  );
};
