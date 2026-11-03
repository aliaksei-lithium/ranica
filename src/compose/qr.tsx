import { encode } from 'uqr';
import { raw } from 'hono/html';

/** QR code as inline SVG, one <rect> per horizontal run (same shape as design/pages). */
export function qrSvg(text: string) {
  const { data, size } = encode(text, { ecc: 'M', border: 0 });
  let rects = '';
  data.forEach((row, y) => {
    for (let x = 0; x < size; ) {
      if (!row[x]) { x++; continue; }
      let w = 1;
      while (x + w < size && row[x + w]) w++;
      rects += `<rect x="${x}" y="${y}" width="${w}" height="1"/>`;
      x += w;
    }
  });
  return raw(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code"><g fill="currentColor">${rects}</g></svg>`,
  );
}
