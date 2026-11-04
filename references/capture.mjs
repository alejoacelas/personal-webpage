// Screenshots references into shots/<id>/<page>-<view>.jpg.
// `node capture.mjs [id ...]` recaptures the given references (all when none given).
// server.mjs imports captureMissing() to capture new references as they arrive.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const here = dirname(fileURLToPath(import.meta.url));
export const VIEWS = ['desktop', 'full', 'phone'];
const MAX_HEIGHT = 12000; // full-page shots stop here
const WORKERS = 3;
const VIEW_SETTINGS = {
  desktop: { viewport: { width: 1440, height: 900 }, scale: 2 },
  full: { viewport: { width: 1440, height: 900 }, scale: 1, full: true },
  phone: { viewport: { width: 390, height: 844 }, scale: 2, full: true, mobile: true },
};
const PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const HIDE_BANNERS = `#CybotCookiebotDialog, #CybotCookiebotDialogBodyUnderlay, #onetrust-banner-sdk, #onetrust-consent-sdk,
  .cc-window, .cookie-banner, [class*="cookie-banner" i], [id*="cookie-banner" i], [class*="CookieConsent" i] { display: none !important; }`;

export const readRefs = () => JSON.parse(readFileSync(join(here, 'refs.json'), 'utf8'));
export const statusPath = id => join(here, 'shots', id, 'status.json');
const readStatus = id => (existsSync(statusPath(id)) ? JSON.parse(readFileSync(statusPath(id), 'utf8')) : null);
// A reference is finished once it has shots, or after two failed attempts.
export const isCaptured = id => { const s = readStatus(id); return !!s && (s.state === 'done' || s.attempts >= 2); };

async function shoot(browser, url, view, file) {
  const s = VIEW_SETTINGS[view];
  const ctx = await browser.newContext({
    viewport: s.viewport, deviceScaleFactor: s.scale, isMobile: !!s.mobile, hasTouch: !!s.mobile,
    userAgent: s.mobile ? PHONE_UA : undefined,
  });
  try {
    const p = await ctx.newPage();
    await p.goto(url, { waitUntil: 'load', timeout: 45000 });
    await p.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await p.addStyleTag({ content: HIDE_BANNERS }).catch(() => {});
    if (s.full) { // scroll through so lazy-loaded images appear
      await p.evaluate(async max => {
        for (let y = 0; y < Math.min(document.body.scrollHeight, max); y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); }
        window.scrollTo(0, 0);
      }, MAX_HEIGHT);
    }
    await p.waitForTimeout(1000);
    const height = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.screenshot({
      path: file, type: 'jpeg', quality: 78, fullPage: !!s.full,
      clip: s.full && height > MAX_HEIGHT ? { x: 0, y: 0, width: s.viewport.width, height: MAX_HEIGHT } : undefined,
    });
  } finally { await ctx.close(); }
}

export async function captureRef(browser, ref) {
  const dir = join(here, 'shots', ref.id);
  mkdirSync(dir, { recursive: true });
  const errors = [];
  let made = 0;
  for (const [i, page] of ref.pages.entries()) {
    if (page.manual) { copyFileSync(join(here, 'manual', page.manual), join(dir, `${i}-desktop.jpg`)); made++; continue; }
    for (const view of VIEWS) {
      try { await shoot(browser, page.url, view, join(dir, `${i}-${view}.jpg`)); made++; }
      catch (e) { errors.push(`${page.url} ${view}: ${e.message.split('\n')[0]}`); }
    }
  }
  const attempts = (readStatus(ref.id)?.attempts || 0) + 1;
  writeFileSync(statusPath(ref.id), JSON.stringify({ state: made ? 'done' : 'failed', attempts, errors, at: new Date().toISOString() }, null, 2));
  console.log(`[capture] ${ref.id}: ${made} shots${errors.length ? `, ${errors.length} failed` : ''}`);
}

// Captures every reference in `refs` with WORKERS pages in parallel.
export async function captureAll(refs) {
  if (!refs.length) return;
  const browser = await chromium.launch();
  const queue = [...refs];
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    while (queue.length) await captureRef(browser, queue.shift());
  }));
  await browser.close();
}

export const captureMissing = () => captureAll(readRefs().filter(r => !isCaptured(r.id)));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const only = process.argv.slice(2);
  await captureAll(readRefs().filter(r => !only.length || only.includes(r.id)));
}
