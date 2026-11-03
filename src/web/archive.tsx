import type { FC } from 'hono/jsx';
import type { Lang } from '../model';
import { Doc } from '../compose/compose';
import { dateParts, t } from '../compose/i18n';

export const ArchivePage: FC<{ lang: Lang; list: { date: string; issue: number }[] }> = ({ lang, list }) => {
  const L = t(lang);
  return (
    <Doc lang={lang} title={`Ranica · ${L.archive}`} bodyClass="view-web">
      <div class="desk">
        <article class="sheet sheet--archive" lang={lang}>
          <header class="masthead masthead--page2">
            <div class="masthead__date">
              <span class="masthead__month">{L.archive}</span>
            </div>
            <div class="masthead__edition">
              <span class="masthead__wordmark">Ranica</span>
            </div>
          </header>
          <div class="agenda agenda--archive">
            {list.map(({ date, issue }) => {
              const d = dateParts(date, lang);
              return (
                <>
                  <span class="agenda__time">{L.issue(issue)}</span>
                  <p>
                    <a class="agenda__title" href={`/editions/${date}?lang=${lang}`}>{d.long}</a>
                  </p>
                </>
              );
            })}
          </div>
        </article>
      </div>
    </Doc>
  );
};
