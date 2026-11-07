// Page 2, the back page (design/pages/back-page-*.html): the week and today's weather as tables,
// longer summaries for the front-page rubrics, back-only rubrics, Telegram digest, dated tasks, words.
import type { FC } from 'hono/jsx';
import type { Edition } from '../model';
import { fit } from './priorities';
import { dateParts, shortDay, signed, t } from './i18n';
import { Footer } from './parts';
import { rubrics } from './front';

export const BackPage: FC<{ e: Edition }> = ({ e }) => {
  const { facts: f, brief: b } = e;
  const L = t(f.lang);
  const d = dateParts(f.date, f.lang);
  const itemsById = new Map(f.items.map((i) => [i.id, i]));
  const deep = new Map<string, { title: string; body: string; tag: string }[]>();
  for (const x of b.deep) {
    const item = itemsById.get(x.item_id);
    if (!item) continue;
    const tag = item.minutes ? `${item.source} · ${item.minutes} ${L.min}` : item.source;
    deep.set(x.rubric, [...(deep.get(x.rubric) ?? []), { title: x.title, body: x.body, tag }]);
  }
  const back = rubrics(e, b.back_news, 2);
  const posts = new Map(f.telegram.map((c) => [c.channel, c.posts]));
  const [rowWeather, rowCalendar, rowDue] = L.weekRows;
  const [colTime, rowTemp, rowFeels, rowRain, rowWind] = L.hourRows;

  return (
    <article class="sheet sheet--page2" lang={f.lang}>
      <header class="masthead masthead--page2" {...fit('masthead')}>
        <div class="masthead__date">
          <span class="masthead__month">{L.backPage}</span>
        </div>
        <div class="masthead__edition">
          <span class="masthead__wordmark">Ranica</span>
          <span class="masthead__imprint">
            {d.long} · {L.issue(f.issue)} · <span class="page-number">{L.page2}</span>
          </span>
        </div>
      </header>

      <div class="page2-top">
        {f.week.length > 0 && (
          <section class="section section--week" {...fit('week')}>
            <span class="label">{L.week}</span>
            <table class="table week">
              <thead>
                <tr>
                  <th />
                  {f.week.map((w) => {
                    const s = shortDay(w.date, f.lang);
                    return (
                      <th>
                        <span class="week__day">{s.weekday}</span> <span class="week__date">{s.day}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{rowWeather}</th>
                  {f.week.map((w) => (
                    <td>
                      <span class="num">{signed(w.hi)}° / {signed(w.lo)}°</span> <span class="muted">{w.sky}</span>
                    </td>
                  ))}
                </tr>
                {f.week.some((w) => w.events > 0 || w.calendar) && (
                  <tr>
                    <th scope="row">{rowCalendar}</th>
                    {f.week.map((w) => (
                      <td>
                        <span class="num">{w.events}</span> {w.calendar}
                      </td>
                    ))}
                  </tr>
                )}
                {f.week.some((w) => w.due) && (
                  <tr>
                    <th scope="row">{rowDue}</th>
                    {f.week.map((w) => (
                      <td>{w.due ?? '—'}</td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}
        {f.hourly.length > 0 && (
          <section class="section section--hours" {...fit('hours')}>
            <span class="label">{L.hours}</span>
            <table class="table hours">
              <thead>
                <tr>
                  <th>{colTime}</th>
                  {f.hourly.map((h) => (
                    <th>{h.hour}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{rowTemp}</th>
                  {f.hourly.map((h) => <td class="num">{signed(h.temp)}°</td>)}
                </tr>
                <tr>
                  <th scope="row">{rowFeels}</th>
                  {f.hourly.map((h) => <td class="num">{signed(h.feels)}°</td>)}
                </tr>
                <tr>
                  <th scope="row">{rowRain}</th>
                  {f.hourly.map((h) => <td class="num">{h.rainPct} %</td>)}
                </tr>
                <tr>
                  <th scope="row">{rowWind}</th>
                  {f.hourly.map((h) => <td class="num">{h.windMs}</td>)}
                </tr>
              </tbody>
            </table>
          </section>
        )}
      </div>

      <div class="columns">
        <div class="col col--left">
          {deep.size > 0 && (
            <section class="section section--depth" {...fit('depth')}>
              <span class="label">{L.depth}</span>
              {[...deep].map(([rubric, list]) => (
                <div class="rubric rubric--deep">
                  <span class="label">{rubric}</span>
                  {list.map((x) => (
                    <article class="longread">
                      <span class="longread__title">{x.title}</span>
                      <p class="longread__body">
                        {x.body}
                        <span class="tag">{x.tag}</span>
                      </p>
                    </article>
                  ))}
                </div>
              ))}
            </section>
          )}
        </div>
        <div class="col col--right">
          {back.map((r) => (
            <section class="rubric" {...fit('world')}>
              <span class="label">{r.name}</span>
              {r.items.map((n) => (
                <article class="item">
                  <a class="item__title" href={n.url}>{n.title}</a>
                  <p class="item__summary">
                    {n.summary}
                    <span class="tag">{n.source}</span>
                  </p>
                </article>
              ))}
            </section>
          ))}
          {b.telegram_digest.length > 0 && (
            <section class="rubric" {...fit('digest')}>
              <span class="label">{L.digest}</span>
              {b.telegram_digest.map((tg) => (
                <div class="digest">
                  <span class="digest__channel">
                    {tg.channel}
                    {posts.has(tg.channel) && <span class="tag">{posts.get(tg.channel)} {L.posts}</span>}
                  </span>
                  <ul class="digest__list">
                    {tg.points.map((p) => (
                      <li>{p}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
          {f.upcoming.length > 0 && (
            <section class="section" {...fit('upcoming')}>
              <span class="label">{L.upcoming}</span>
              <div class="agenda agenda--backlog">
                {f.upcoming.map((u) => {
                  const s = shortDay(u.date, f.lang);
                  return (
                    <>
                      <span class="agenda__time">
                        {s.weekday} {s.day}
                      </span>
                      <p>
                        <span class="agenda__title">{u.title}</span>
                      </p>
                      {u.note && <p class="agenda__note">{u.note}</p>}
                    </>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {f.weekWords.length > 0 && (
        <section class="lesson lesson--words" lang="de" {...fit('words')}>
          <span class="label" lang={f.lang}>
            {L.words}
            <span class="label__sub">{f.weekWords.length}</span>
          </span>
          <div class="words-strip">
            {b.word_of_day ? (
              <div class="wotd">
                <span class="lesson__new-label" lang={f.lang}>{L.wordOfDay}</span>
                <span class="wotd__word">{b.word_of_day.de}</span>
                <span class="wotd__gloss" lang={f.lang}>{b.word_of_day.en}</span>
                <p class="wotd__example">{b.word_of_day.example}</p>
                <p class="wotd__extra" lang={f.lang}>{b.word_of_day.extra}</p>
              </div>
            ) : (
              <div />
            )}
            <div class="words">
              {f.weekWords.map((w) => (
                <p>
                  <span class="lesson__word">{w.de}</span>
                  <span class="lesson__gloss" lang={f.lang}>{w.en}</span>
                </p>
              ))}
            </div>
          </div>
        </section>
      )}
      <Footer f={f} tomorrow={b.tomorrow} />
    </article>
  );
};
