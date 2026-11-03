import type { FC } from 'hono/jsx';
import type { Edition } from '../../model';
import { t } from '../i18n';
import { Block } from './Block';

/** "Deutsch heute": the small lesson box. Unknown card ids are dropped, like the editor contract says. */
export const German: FC<{ e: Edition }> = ({ e: { facts: f, brief: b } }) => {
  const L = t(f.lang);
  const byId = new Map(f.cards.map((c) => [c.id, c]));
  const cards = b.german.cards.flatMap((c) => {
    const card = byId.get(c.card_id);
    return card ? [{ ...card, example: c.example }] : [];
  });
  const nw = b.german.new_word;
  if (cards.length === 0 && !nw) return null;
  return (
    <Block id="german" label={L.german} class="lesson" unavailable={f.unavailable.german}>
      <ol class="cards" lang="de">
        {cards.slice(0, 5).map((c) => (
          <li>
            <span class="word">{c.de}</span> <span class="gloss" lang={f.lang}>— {c.en}</span>
            <span class="example">{c.example}</span>
          </li>
        ))}
      </ol>
      {nw && (
        <p class="new-word">
          <span class="new-word-label">{L.newWord}:</span> <span class="word" lang="de">{nw.de}</span>{' '}
          <span class="gloss">— {nw.en}</span>
        </p>
      )}
    </Block>
  );
};
