import type { Child, FC } from 'hono/jsx';
import type { BlockId } from '../../model';
import { PRIORITY } from '../priorities';

/** One page block: a label rule, then content, or the one-line "unavailable" note. */
export const Block: FC<{ id: BlockId; label?: string; unavailable?: string; class?: string; children?: Child }> = (p) => (
  <section class={`block block-${p.id}${p.class ? ` ${p.class}` : ''}`} data-block={p.id} data-priority={PRIORITY[p.id]}>
    {p.label && <h2 class="label">{p.label}</h2>}
    {p.unavailable ? <Unavailable text={p.unavailable} /> : p.children}
  </section>
);

export const Unavailable: FC<{ text: string }> = ({ text }) => (
  <p class="unavailable">
    <span class="unavailable-mark" aria-hidden="true">×</span> {text}
  </p>
);

/** Source tag after a news item: outlet or @channel. */
export const SourceTag: FC<{ name: string }> = ({ name }) => <span class="source">{name}</span>;
