// Page 1 (docs/03-design-brief.md, A–L). Layout since 2026-11-08: a lead row (weather · today ·
// insight) and the news in two balanced CSS columns, like the back page: rubrics with full items,
// then a few one-liners. Calm on purpose (review 2026-11-08): no German word, Telegram or weather
// advice here; those live on the back page. public/fit.js trims from the end if the sheet overflows.
import type { FC } from 'hono/jsx';
import type { Edition } from '../model';
import type { NewsPick } from '../edit/brief';
import { fit } from './priorities';
import { signed, slug, t } from './i18n';
import { Footer, Masthead, SunItems, Unavailable, quote } from './parts';
import { qrSvg } from './qr';
import { type Holiday, holidaysAround } from './holidays';

/** "24.12." / "24 Dec" */
const dayMonth = (iso: string, lang: 'en' | 'de') => {
  const [, m, d] = iso.split('-').map(Number) as [number, number, number];
  return lang === 'de' ? `${d}.${m}.` : `${d} ${new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, m - 1, d)))}`;
};

/** Russian / Belarusian text keeps its own lang attribute (hyphenation, screen readers). */
export const cyrillic = (s: string) => /[\u0400-\u04FF]/.test(s);

/** One-liners on the front page: a few meaningful ones, not a feed. */
const MAX_BRIEFS = 6;

type Rubric = { name: string; items: (NewsPick & { source: string; url: string })[] };

/** Group the editor's picks by rubric, dropping ids that are not in the input (editor contract). */
export function rubrics(e: Edition, picks: NewsPick[], max = 5, perRubric = 4): Rubric[] {
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
export const NewsRubric: FC<{ r: Rubric; more?: string; block?: 'news' | 'world'; id?: boolean; long?: Map<string, string> }> = ({ r, more, block = 'news', id = true, long }) => (
  <section class="rubric" id={id ? slug(r.name) : undefined} {...fit(block)}>
    <span class="label">
      {r.name}
      {more && <span class="label__sub">{more}</span>}
    </span>
    {r.items.map((n, i) => {
      // The lead story of a rubric may come with the editor's longer article (Brief.deep): it is
      // printed here in place of the short summary, and not repeated on page 2.
      const body = long?.get(n.item_id);
      return (
        <article class={body ? 'item item--long' : 'item'} {...(i >= 2 ? fit('newsextra') : {})}>
          <a class="item__title" href={n.url}>{n.title}</a>
          <p class={body ? 'item__summary longread__body' : 'item__summary'}>
            {body ?? n.summary}
            <span class="tag">{n.source}</span>
          </p>
        </article>
      );
    })}
  </section>
);

export const FrontPage: FC<{ e: Edition; kindle?: boolean }> = ({ e, kindle }) => {
  const { facts: f, brief: b } = e;
  const L = t(f.lang);
  // "Today" shows the public holidays in Berlin and Belarus, not the reader's own plans.
  const hol = holidaysAround(f.date, f.lang);
  const where = (h: Holiday) => [...h.regions.map((r) => L.regions[r]), ...(h.off ? [L.dayOff] : [])].join(' · ');
  const news = rubrics(e, b.news, 5);
  const itemsById = new Map(f.items.map((i) => [i.id, i]));
  const briefs = (b.briefs ?? []).flatMap((x) => {
    const item = itemsById.get(x.item_id);
    return item ? [{ ...x, url: item.url, source: item.source }] : [];
  });
  const long = new Map(b.deep.map((d) => [d.item_id, d.body]));
  const base = `https://${f.url}`;
  const qrTargets = news.map((r) => r.name).slice(0, 5);

  return (
    <article class={kindle ? 'sheet sheet--kindle' : 'sheet'} lang={f.lang}>
      <Masthead f={f} />
      <p class="sunline" {...fit('sun')}>
        <SunItems f={f} />
      </p>

      <div class="lead">
        <section class="section section--weather" {...fit('weather')}>
          <span class="label">{L.weather}</span>
          {f.weather ? (
            <div class="weather">
              <span class="weather__temp">{signed(f.weather.max)}°</span>
              <div class="weather__text">
                <p>{f.weather.summary}</p>
              </div>
            </div>
          ) : (
            <Unavailable text={L.weatherUnavailable} reason={f.unavailable.weather ?? L.unavailable} />
          )}
        </section>

        <section class="section section--today" {...fit('today')}>
          <span class="label">{L.holidays}</span>
          <div class="agenda agenda--dates">
            {hol.today.length === 0 && <p class="agenda__empty">{L.noHoliday}</p>}
            {hol.today.map((h) => (
              <>
                <span class="agenda__time">{L.todayShort}</span>
                <p>
                  <span class="agenda__title">{h.name}</span>
                  <span class="agenda__meta">{where(h)}</span>
                </p>
              </>
            ))}
            {hol.next.map((h) => (
              <>
                <span class="agenda__time">{dayMonth(h.date, f.lang)}</span>
                <p>
                  <span class={h.off ? 'agenda__title' : 'agenda__title agenda__title--minor'}>{h.name}</span>
                  <span class="agenda__meta">{where(h)} · {L.inDays(h.inDays)}</span>
                </p>
              </>
            ))}
          </div>
          {b.sport && (
            <p class="runin" {...fit('sport')}>
              <span class="runin__label">{L.sport}</span>
              {b.sport}
            </p>
          )}
        </section>

        {b.insight && (
          <aside class="insight insight--lead" {...fit('insight')}>
            <span class="label">{L.insight}</span>
            <p>{b.insight}</p>
          </aside>
        )}
      </div>

      <div class="flow">
        {news.map((r) => (
          <NewsRubric r={r} long={long} />
        ))}
        {briefs.length > 0 && (
          <section class="rubric briefs" data-fit-empty="li">
            <span class="label">{L.briefs}</span>
            <ul class="briefs__list">
              {briefs.slice(0, MAX_BRIEFS).map((x) => (
                <li {...fit('brief')}>
                  <span class="briefs__rubric">{x.rubric}</span> <a href={x.url}>{x.text}</a>
                  <span class="tag">{x.source}</span>
                </li>
              ))}
            </ul>
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
      {/* Block K (comic strip) is reserved for later: .comic-slot is not rendered in v1. */}
      <Footer f={f} tomorrow={b.tomorrow} />
    </article>
  );
};
