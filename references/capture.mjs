// Screenshots every page in refs.js into shots/<id>/.
// Usage: node references/capture.mjs [id ...]   (no ids = all references)
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const window = {};
new Function('window', readFileSync(join(here, 'refs.js'), 'utf8'))(window);
const only = process.argv.slice(2);
const refs = window.REFS.filter(r => !only.length || only.includes(r.id));

const MAX_HEIGHT = 16000; // cap very long pages
const views = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, full: false },
  { name: 'full', viewport: { width: 1440, height: 900 }, full: true },
  { name: 'phone', viewport: { width: 390, height: 844 }, full: true, mobile: true },
];
// Cookie and consent banners hidden before each capture.
const hideBanners = `#CybotCookiebotDialog, #CybotCookiebotDialogBodyUnderlay, [id*="cookie" i][class*="banner" i], [class*="cookie-banner" i] { display: none !important; }`;

const browser = await chromium.launch();
for (const ref of refs) {
  mkdirSync(join(here, 'shots', ref.id), { recursive: true });
  for (const [i, page] of ref.pages.entries()) {
    for (const v of views) {
      const ctx = await browser.newContext({
        viewport: v.viewport, deviceScaleFactor: 2, isMobile: !!v.mobile, hasTouch: !!v.mobile,
        userAgent: v.mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' : undefined,
      });
      const p = await ctx.newPage();
      await p.goto(page.url, { waitUntil: 'load', timeout: 60000 });
      await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await p.addStyleTag({ content: hideBanners });
      if (v.full) { // scroll through so lazy images load
        await p.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
          window.scrollTo(0, 0);
        });
      }
      await p.waitForTimeout(1200);
      const height = await p.evaluate(() => document.documentElement.scrollHeight);
      const file = join(here, 'shots', ref.id, `${i}-${v.name}.jpg`);
      await p.screenshot({
        path: file, type: 'jpeg', quality: 82,
        fullPage: v.full,
        clip: v.full && height > MAX_HEIGHT ? { x: 0, y: 0, width: v.viewport.width, height: MAX_HEIGHT } : undefined,
      });
      console.log(file.replace(here + '/', ''));
      await ctx.close();
    }
  }
}
await browser.close();
