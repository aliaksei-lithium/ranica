import type { Child, FC } from 'hono/jsx';
import type { Edition } from '../model';
import { dateParts } from './i18n';
import { Footer, Masthead, SunLine } from './blocks/Masthead';
import { Weather } from './blocks/Weather';
import { Today } from './blocks/Today';
import { German } from './blocks/German';
import { News } from './blocks/News';
import { Hobby, Insight, OnThisDay, Sport } from './blocks/Small';

/**
 * web    — the sheet centred on grey, for the browser home page (phone: stacked).
 * print  — exact A4 sheet; public/fit.js trims low-priority blocks until it fits.
 * kindle — single column, 1236 × 1648 px pages for a 6.8" e-reader.
 */
export type View = 'web' | 'print' | 'kindle';

const Doc: FC<{ lang: string; title: string; bodyClass: string; fit?: boolean; children?: Child }> = (p) => (
  <html lang={p.lang}>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{p.title}</title>
      <link rel="stylesheet" href="/fonts/fonts.css" />
      <link rel="stylesheet" href="/newspaper.css" />
      {p.fit && <script src="/fit.js" defer />}
    </head>
    <body class={p.bodyClass} data-fit={p.fit ? 'page' : undefined}>
      {p.children}
    </body>
  </html>
);

export const Page: FC<{ e: Edition; view: View }> = ({ e, view }) => {
  const d = dateParts(e.facts.date, e.facts.lang);
  return (
    <Doc lang={e.facts.lang} title={`Ranica · ${d.day} ${d.month} ${d.year}`} bodyClass={`view-${view}`} fit={view === 'print'}>
      <main class="sheet">
        <Masthead f={e.facts} />
        <SunLine f={e.facts} />
        <div class="columns">
          <div class="col col-main">
            <Weather e={e} />
            <Today e={e} />
            <Sport e={e} />
            <German e={e} />
          </div>
          <div class="col col-side">
            <News e={e} />
            <Insight e={e} />
            <Hobby e={e} />
            <OnThisDay e={e} />
          </div>
        </div>
        {/* Block K (comic strip) is reserved for later and not rendered in v1. */}
        <Footer f={e.facts} tomorrow={e.brief.tomorrow} />
      </main>
    </Doc>
  );
};

export function renderPage(e: Edition, view: View): string {
  return `<!doctype html>${(<Page e={e} view={view} />).toString()}`;
}
