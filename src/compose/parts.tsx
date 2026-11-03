// Small pieces shared by the front page, back page and e-ink widget (design/ranica.css classes).
import type { FC } from 'hono/jsx';
import type { Facts, Lang } from '../model';
import { fit } from './priorities';
import { dateParts, signed, t } from './i18n';

export function sunItems(f: Facts): { text: string; count?: boolean }[] {
  const L = t(f.lang);
  const out: { text: string; count?: boolean }[] = [];
  if (f.sun) {
    const h = Math.floor(f.sun.dayMinutes / 60);
    const m = f.sun.dayMinutes % 60;
    out.push(
      { text: `☼ ${f.sun.sunrise} → ${f.sun.sunset}` },
      { text: `${L.day} ${h} ${L.h} ${m} ${L.min}` },
      { text: `${signed(f.sun.deltaMinutes)} ${L.min} ${L.vsYesterday}` },
    );
  }
  for (const c of f.countdowns.slice(0, 3)) out.push({ text: `${L.daysTo(c.days)} ${c.label}`, count: true });
  return out;
}

export const SunItems: FC<{ f: Facts }> = ({ f }) => (
  <>
    {sunItems(f).map((i) => (
      <span class={i.count ? 'sunline__item sunline__item--count' : 'sunline__item'}>{i.text}</span>
    ))}
  </>
);

export const Masthead: FC<{ f: Facts }> = ({ f }) => {
  const L = t(f.lang);
  const d = dateParts(f.date, f.lang);
  return (
    <header class="masthead" {...fit('masthead')}>
      <div class="masthead__date">
        <span class="masthead__day">{d.day}</span>
        <span>
          <span class="masthead__month">{d.month}</span>
          <span class="masthead__weekday">
            {d.weekday} · {d.year}
          </span>
        </span>
      </div>
      <div class="masthead__edition">
        <span class="masthead__wordmark">Ranica</span>
        <span class="masthead__title">{f.editionTitle}</span>
        <span class="masthead__motto">{L.motto}</span>
        <span class="masthead__imprint">
          {L.issue(f.issue)} · {L.printRun} · {f.city} · {L.forReader} {f.readerName}
        </span>
      </div>
    </header>
  );
};

export const Footer: FC<{ f: Facts; tomorrow: string }> = ({ f, tomorrow }) => {
  const L = t(f.lang);
  return (
    <footer class="footer" {...fit('footer')}>
      <span>
        {L.tomorrow}: {tomorrow}
      </span>
      <span class="footer__meta">
        {L.generated} {f.generatedAt} · {f.sourcesCount} {L.sources} · <span class="footer__url">{f.url}</span>
      </span>
    </footer>
  );
};

/** The one-line note that replaces a block whose data failed. */
export const Unavailable: FC<{ text: string; reason: string }> = ({ text, reason }) => (
  <p class="unavailable">
    {text} <span class="unavailable__reason">{reason}</span>
  </p>
);

/** A quote in the reader's language: “…” or „…“. */
export const quote = (text: string, lang: Lang) => (lang === 'de' ? `„${text}“` : `“${text}”`);
