import type { FC } from 'hono/jsx';
import type { Lang } from '../model';
import { dateParts, t } from '../compose/i18n';

export const ArchivePage: FC<{ lang: Lang; list: { date: string; issue: number }[] }> = ({ lang, list }) => {
  const L = t(lang);
  return (
    <html lang={lang}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Ranica · {L.archive}</title>
        <link rel="stylesheet" href="/fonts/fonts.css" />
        <link rel="stylesheet" href="/newspaper.css" />
      </head>
      <body class="view-web">
        <main class="sheet sheet-archive">
          <h1 class="archive-title">Ranica · {L.archive}</h1>
          <ul class="archive">
            {list.map(({ date, issue }) => {
              const d = dateParts(date, lang);
              return (
                <li>
                  <a href={`/editions/${date}?lang=${lang}`}>
                    <span class="archive-day">{d.day}</span> {d.month} {d.year}, {d.weekday}
                  </a>
                  <span class="source">
                    {L.issue}
                    {issue}
                  </span>
                </li>
              );
            })}
          </ul>
        </main>
      </body>
    </html>
  );
};
