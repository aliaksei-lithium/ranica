import type { FC } from 'hono/jsx';

// Simple line glyphs (inline SVG, black stroke) — the only pictures on the page.
const paths = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
    </>
  ),
  cloud: <path d="M7 18h10.5a4 4 0 0 0 .4-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 7 18z" />,
  rain: (
    <>
      <path d="M7 15h10.5a4 4 0 0 0 .4-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 7 15z" />
      <path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" />
    </>
  ),
  snow: (
    <>
      <path d="M7 15h10.5a4 4 0 0 0 .4-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 7 15z" />
      <path d="M8 19h.01M12 21h.01M16 19h.01" />
    </>
  ),
} as const;

export type GlyphName = keyof typeof paths;

export const Glyph: FC<{ name: GlyphName; class?: string }> = ({ name, class: cls }) => (
  <svg class={`glyph ${cls ?? ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {paths[name]}
  </svg>
);
