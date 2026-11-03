import type { FC } from 'hono/jsx';
import type { Edition } from '../../model';
import { t } from '../i18n';
import { Block, SourceTag } from './Block';

/** News grouped by rubric; items whose id is not in the input are dropped. */
export const News: FC<{ e: Edition }> = ({ e: { facts: f, brief: b } }) => {
  const L = t(f.lang);
  const byId = new Map(f.items.map((i) => [i.id, i]));
  const rubrics = new Map<string, { title: string; summary: string; source: string; url: string }[]>();
  for (const n of b.news) {
    const item = byId.get(n.item_id);
    if (!item) continue;
    const list = rubrics.get(n.rubric) ?? [];
    if (list.length < 4) list.push({ title: n.title, summary: n.summary, source: item.source, url: item.url });
    rubrics.set(n.rubric, list);
  }
  return (
    <Block id="news" label={L.news} unavailable={f.unavailable.news}>
      {[...rubrics].slice(0, 4).map(([rubric, list]) => (
        <div class="rubric">
          <h3 class="rubric-name">{rubric}</h3>
          {list.map((n) => (
            <article class="item">
              <h4 class="item-title">
                <a href={n.url}>{n.title}</a>
              </h4>
              <p class="item-summary">
                {n.summary} <SourceTag name={n.source} />
              </p>
            </article>
          ))}
        </div>
      ))}
      {b.telegram_digest.length > 0 && (
        <div class="rubric">
          <h3 class="rubric-name">{L.telegram}</h3>
          {b.telegram_digest.map((tg) => (
            <p class="item-summary tg">
              <SourceTag name={tg.channel} /> {tg.summary}
            </p>
          ))}
        </div>
      )}
    </Block>
  );
};
