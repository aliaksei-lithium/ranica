import type { FC } from 'hono/jsx';
import type { Facts } from '../../model';
import { PRIORITY } from '../priorities';
import { dateParts, signed, t } from '../i18n';
import { Glyph } from './Glyph';

export const Masthead: FC<{ f: Facts }> = ({ f }) => {
  const L = t(f.lang);
  const d = dateParts(f.date, f.lang);
  return (
    <header class="masthead" data-block="masthead" data-priority={PRIORITY.masthead}>
      <div class="mast-date">
        <span class="mast-day">{d.day}</span>
        <span class="mast-month-wrap">
          <span class="mast-month">{d.month}</span>
          <span class="mast-weekday">{d.weekday}, {d.year}</span>
        </span>
      </div>
      <div class="mast-title">
        <div class="mast-name">
          Ranica <span class="mast-issue">· {L.issue}{f.issue}</span>
        </div>
        <div class="mast-reader">{f.editionTitle}</div>
        <div class="mast-meta">
          {L.printRun} · {f.city} · {L.forReader} {f.readerName}
        </div>
      </div>
    </header>
  );
};

export const SunLine: FC<{ f: Facts }> = ({ f }) => {
  const L = t(f.lang);
  const parts: string[] = [];
  if (f.sun) {
    const h = Math.floor(f.sun.dayMinutes / 60);
    const m = f.sun.dayMinutes % 60;
    parts.push(`${L.day} ${h} ${L.h} ${m} ${L.min}`, `${signed(f.sun.deltaMinutes)} ${L.min} ${L.vsYesterday}`);
  }
  for (const c of f.countdowns.slice(0, 3)) parts.push(`${L.daysTo(c.days)} ${c.label}`);
  return (
    <div class="sunline" data-block="sun" data-priority={PRIORITY.sun}>
      {f.sun && (
        <span class="sun-times">
          <Glyph name="sun" class="glyph-inline" /> {f.sun.sunrise} → {f.sun.sunset}
        </span>
      )}
      {parts.map((p) => (
        <>
          <span class="sep"> · </span>
          <span>{p}</span>
        </>
      ))}
      <span class="motto">{L.motto}</span>
    </div>
  );
};

export const Footer: FC<{ f: Facts; tomorrow: string }> = ({ f, tomorrow }) => {
  const L = t(f.lang);
  return (
    <footer class="footer" data-block="footer" data-priority={PRIORITY.footer}>
      <span>
        <b>{L.tomorrow}:</b> {tomorrow}
      </span>
      <span>
        {L.generated} {f.generatedAt} · {f.sourcesCount} {L.sources} · {f.url}
      </span>
    </footer>
  );
};
