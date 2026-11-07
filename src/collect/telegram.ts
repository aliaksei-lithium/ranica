// Public Telegram channel via its web preview, https://t.me/s/<channel> (last ~20 posts).
// Parsed with regex on the string so the same code runs in the Workers runtime and in Node tests;
// HTMLRewriter (plan §5) is an option if the page ever gets large enough to matter.
import { BODY_MAX, type Item } from './item';
import { clip, hash, htmlToText, toIso } from './text';

/** Lines dropped from every post (after leading emoji): zerkalo_io's mirror-link and app boilerplate, bare URLs. */
const BOILERPLATE = [/^Не работает ссылка\?/, /^Скачайте наше приложение/, /^https?:\/\/\S+$/];
const stripLead = (l: string) => l.replace(/^[^\p{L}\p{N}«„"(]+/u, '');

export interface TelegramPost extends Item {
  /** The article the post announces (outbound link, `linkHost` preferred), if any. */
  link: string | null;
}

/**
 * @param linkHost prefer an outbound link on this host (e.g. `zerkalo.io`, whose posts also carry a
 *   mirror link for readers in Belarus); otherwise the first outbound link is used.
 */
export function parseTelegram(html: string, sourceId: string, channel: string, linkHost?: string): TelegramPost[] {
  const out: TelegramPost[] = [];
  // Each post starts at its data-post attribute; split there and parse the chunk up to the next one.
  const starts = [...html.matchAll(/<div class="tgme_widget_message [^"]*"[^>]*data-post="([^"]+)"/g)];
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i]!;
    const chunk = html.slice(s.index, starts[i + 1]?.index ?? html.length);
    const postId = s[1]!; // "zerkalo_io/178457"
    const textHtml = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(chunk)?.[1];
    if (!textHtml) continue; // photo/video without caption, service message
    const links = [...textHtml.matchAll(/<a href="(https?:\/\/(?!t\.me\/)[^"]+)"/g)].map((l) => l[1]!);
    const onHost = (l: string) => {
      const h = /^https?:\/\/([^/?#:]+)/.exec(l)?.[1] ?? '';
      return h === linkHost || h.endsWith(`.${linkHost}`);
    };
    const link = (linkHost && links.find(onHost)) || links[0] || null;
    const lines = htmlToText(textHtml)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !BOILERPLATE.some((re) => re.test(stripLead(l))));
    if (!lines.length) continue;
    const [title, ...rest] = lines;
    out.push({
      sourceId,
      externalId: postId,
      url: `https://t.me/${postId.startsWith(`${channel}/`) ? postId : `${channel}/${postId}`}`,
      title: clip(title!, 200),
      body: clip(rest.join('\n'), BODY_MAX),
      publishedAt: toIso(/<time datetime="([^"]+)"/.exec(chunk)?.[1]),
      hash: hash(postId),
      link: link ? link.replace(/&amp;/g, '&') : null,
    });
  }
  // The preview lists oldest first; editions want newest first.
  return out.reverse();
}
