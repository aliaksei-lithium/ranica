// Local render loop for template work (docs/02-plan.md §6, M0).
// Start the dev server first (`npm run dev`), then: `npm run render [-- --base http://127.0.0.1:8787]`.
// Writes A4 PDFs (front + back) + one PNG per sheet, browser/phone views, Kindle PDF/PNG and the e-ink PNG into out/.
// Browser Run (src/render/browser.ts, M1) will do the same steps in one session in production.
// Every page is the fake edition (?fake=1): this renders the templates, independent of D1 content
// (CI's local D1 is empty, so the real /today would be a 500).
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

// Playwright is not a project dependency: use a global install (`npm i -g playwright`,
// then `npx playwright install chromium`). require() also honours NODE_PATH.
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const BASE = arg('base', 'http://127.0.0.1:8787');
const OUT = arg('out', 'out');
mkdirSync(OUT, { recursive: true });

const A4 = { width: 794, height: 1123 }; // 210 × 297 mm at 96 dpi

const jobs = [
  { name: 'a4-en', path: '/today?view=print&lang=en&fake=1', kind: 'a4' },
  { name: 'a4-de', path: '/today?view=print&lang=de&fake=1', kind: 'a4' },
  { name: 'a4-thin', path: '/today?view=print&lang=en&day=thin&fake=1', kind: 'a4' },
  { name: 'a4-thin-de', path: '/today?view=print&lang=de&day=thin&fake=1', kind: 'a4' },
  { name: 'web-900', path: '/today?lang=en&fake=1', kind: 'screen', viewport: { width: 900, height: 1200 } },
  { name: 'phone', path: '/today?lang=en&fake=1', kind: 'phone' },
  { name: 'kindle', path: '/today?view=kindle&lang=en&fake=1', kind: 'kindle' },
  { name: 'kindle-de', path: '/today?view=kindle&lang=de&fake=1', kind: 'kindle' },
  { name: 'eink', path: '/today?view=eink&lang=en&fake=1', kind: 'eink' },
  { name: 'eink-de', path: '/today?view=eink&lang=de&fake=1', kind: 'eink' },
];

const browser = await chromium.launch();
try {
  for (const job of jobs) {
    const ctxOpts =
      job.kind === 'phone' ? devices['iPhone 13']
      : job.kind === 'kindle' ? { viewport: { width: 1236, height: 1648 }, deviceScaleFactor: 1 }
      : job.kind === 'eink' ? { viewport: { width: 800, height: 480 }, deviceScaleFactor: 1 }
      : job.kind === 'a4' ? { viewport: A4, deviceScaleFactor: 2 }
      : { viewport: job.viewport, deviceScaleFactor: 2 };
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    const res = await page.goto(BASE + job.path, { waitUntil: 'networkidle' });
    if (!res || !res.ok()) throw new Error(`${job.name}: ${job.path} returned HTTP ${res?.status()}`);
    await page.evaluate(() => document.fonts.ready);

    if (job.kind === 'a4') {
      await page.waitForFunction(() => document.body.dataset.fitDone);
      const { fitDone, trimmed } = await page.evaluate(() => ({ ...document.body.dataset }));
      await page.pdf({ path: `${OUT}/${job.name}.pdf`, preferCSSPageSize: true, printBackground: true });
      const sheets = page.locator('.sheet');
      const n = await sheets.count();
      for (let i = 0; i < n; i++) {
        await sheets.nth(i).screenshot({ path: `${OUT}/${job.name}${i ? `-p${i + 1}` : ''}.png` });
      }
      console.log(`${job.name}: ${n} sheet(s), fit=${fitDone}${trimmed ? ` trimmed=${trimmed}` : ''}`);
    } else if (job.kind === 'kindle') {
      await page.emulateMedia({ media: 'print' });
      await page.pdf({ path: `${OUT}/${job.name}.pdf`, preferCSSPageSize: true, printBackground: true });
      await page.emulateMedia({ media: 'screen' });
      await page.screenshot({ path: `${OUT}/${job.name}.png` });
      console.log(`${job.name}: pdf + png`);
    } else {
      const target = job.kind === 'eink' ? page.locator('.widget') : page;
      await target.screenshot({ path: `${OUT}/${job.name}.png`, ...(job.kind === 'eink' ? {} : { fullPage: true }) });
      console.log(`${job.name}: png`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
