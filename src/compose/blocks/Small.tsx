import type { FC } from 'hono/jsx';
import type { Edition } from '../../model';
import { PRIORITY } from '../priorities';
import { t } from '../i18n';
import { Block, SourceTag } from './Block';

export const Insight: FC<{ e: Edition }> = ({ e: { facts: f, brief: b } }) =>
  b.insight ? (
    <aside class="block block-insight" data-block="insight" data-priority={PRIORITY.insight}>
      <h2 class="label">{t(f.lang).insight}</h2>
      {b.headline && <p class="insight-head">{b.headline}</p>}
      <p class="insight-text">{b.insight}</p>
    </aside>
  ) : null;

export const Sport: FC<{ e: Edition }> = ({ e: { facts: f, brief: b } }) =>
  b.sport ? (
    <Block id="sport" label={t(f.lang).sport}>
      <p>{b.sport}</p>
    </Block>
  ) : null;

export const Hobby: FC<{ e: Edition }> = ({ e: { facts: f, brief: b } }) => {
  if (!b.hobby_fact) return null;
  const item = f.items.find((i) => i.id === b.hobby_fact?.item_id);
  return (
    <Block id="hobby" label={t(f.lang).hobby}>
      <p>
        {b.hobby_fact.text} {item && <SourceTag name={item.source} />}
      </p>
    </Block>
  );
};

export const OnThisDay: FC<{ e: Edition }> = ({ e: { facts: f, brief: b } }) =>
  b.on_this_day ? (
    <Block id="onthisday" label={t(f.lang).onThisDay}>
      <blockquote class="quote">
        <q>{b.on_this_day.text}</q>{b.on_this_day.author && <span class="quote-author"> — {b.on_this_day.author}</span>}
      </blockquote>
    </Block>
  ) : null;
