import type { Child, FC } from 'hono/jsx';
import type { Edition } from '../model';
import { dateParts } from './i18n';
import { FrontPage } from './front';
import { BackPage } from './back';
import { Widget } from './widget';

/**
 * web    — the sheets on the grey desk (design/pages/web-view.html); phones stack to one column.
 * print  — A4 sheets for duplex printing; public/fit.js trims low-priority blocks per sheet.
 * kindle — the front page as a 1236 × 1648 px e-reader page (design/pages/kindle-view.html).
 * eink   — the 800 × 480, 1-bit widget (design/pages/eink-widget.html).
 */
export type View = 'web' | 'print' | 'kindle' | 'eink';

export const Doc: FC<{ lang: string; title: string; bodyClass: string; fit?: boolean; children?: Child }> = (p) => (
  <html lang={p.lang}>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{p.title}</title>
      <link rel="stylesheet" href="/fonts/fonts.css" />
      <link rel="stylesheet" href="/css/tokens.css" />
      <link rel="stylesheet" href="/css/ranica.css" />
      <link rel="stylesheet" href="/app.css" />
      {p.fit && <script src="/fit.js" defer />}
    </head>
    <body class={p.bodyClass} data-fit={p.fit ? 'sheet' : undefined}>
      {p.children}
    </body>
  </html>
);

export function renderEdition(e: Edition, view: View, opts: { backPage?: boolean } = {}): string {
  const d = dateParts(e.facts.date, e.facts.lang);
  const title = `Ranica · ${d.day} ${d.month} ${d.year} · ${e.brief.headline}`;
  const back = opts.backPage ?? true;
  const body =
    view === 'eink' ? (
      <Widget e={e} />
    ) : view === 'kindle' ? (
      <FrontPage e={e} kindle />
    ) : view === 'print' ? (
      <>
        <FrontPage e={e} />
        {back && <BackPage e={e} />}
      </>
    ) : (
      <div class="desk desk--stack">
        <FrontPage e={e} />
        {back && <BackPage e={e} />}
      </div>
    );
  const page = (
    <Doc lang={e.facts.lang} title={title} bodyClass={`view-${view}`} fit={view === 'print'}>
      {body}
    </Doc>
  );
  return `<!doctype html>${page.toString()}`;
}
