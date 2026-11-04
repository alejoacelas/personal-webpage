// Screenshots each page of each reference into shots/<id>/<page>.jpg: the full page at
// desktop width, cut off at MAX_HEIGHT. The viewer steps through it a screen at a time.
// `node capture.mjs [id ...]` recaptures the given references (all when none given).
// server.mjs imports captureMissing() to capture new references and pages as they arrive.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const here = dirname(fileURLToPath(import.meta.url));
const MAX_HEIGHT = 9000;
const WORKERS = 3;
const VIEWPORT = { width: 1440, height: 900 };
const HIDE_BANNERS = `#CybotCookiebotDialog, #CybotCookiebotDialogBodyUnderlay, #onetrust-banner-sdk, #onetrust-consent-sdk,
  .cc-window, .cookie-banner, [class*="cookie-banner" i], [id*="cookie-banner" i], [class*="CookieConsent" i] { display: none !important; }`;

export const readRefs = () => JSON.parse(readFileSync(join(here, 'refs.json'), 'utf8'));
export const statusPath = id => join(here, 'shots', id, 'status.json');
const readStatus = id => (existsSync(statusPath(id)) ? JSON.parse(readFileSync(statusPath(id), 'utf8')) : null);
const shotPath = (id, i) => join(here, 'shots', id, `${i}.jpg`);
const missingPages = ref => ref.pages.map((_, i) => i).filter(i => !existsSync(shotPath(ref.id, i)));
// Finished once every page has a shot, or after two failed attempts at the current page list.
export const isCaptured = ref => {
  if (!missingPages(ref).length) return true;
  const s = readStatus(ref.id);
  return !!s && s.pages === ref.pages.length && s.attempts >= 2;
};

async function shoot(browser, url, file) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  try {
    const p = await ctx.newPage();
    await p.goto(url, { waitUntil: 'load', timeout: 45000 });
    await p.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await p.addStyleTag({ content: HIDE_BANNERS }).catch(() => {});
    await p.evaluate(async max => { // scroll through so lazy-loaded images appear
      for (let y = 0; y < Math.min(document.body.scrollHeight, max); y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); }
      window.scrollTo(0, 0);
    }, MAX_HEIGHT);
    await p.waitForTimeout(1000);
    const height = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.screenshot({
      path: file, type: 'jpeg', quality: 72, fullPage: true,
      clip: height > MAX_HEIGHT ? { x: 0, y: 0, width: VIEWPORT.width, height: MAX_HEIGHT } : undefined,
    });
  } finally { await ctx.close(); }
}

export async function captureRef(browser, ref) {
  const dir = join(here, 'shots', ref.id);
  mkdirSync(dir, { recursive: true });
  const errors = [];
  for (const i of missingPages(ref)) {
    const page = ref.pages[i];
    try {
      if (page.manual) copyFileSync(join(here, 'manual', page.manual), shotPath(ref.id, i));
      else await shoot(browser, page.url, shotPath(ref.id, i));
    } catch (e) { errors.push(`${page.url}: ${e.message.split('\n')[0]}`); }
  }
  // Remove shots from the earlier three-view format
  for (const f of readdirSync(dir)) if (/^\d+-(desktop|full|phone)\.jpg$/.test(f)) rmSync(join(dir, f));
  const prev = readStatus(ref.id);
  const attempts = prev?.pages === ref.pages.length ? (prev.attempts || 0) + 1 : 1;
  const left = missingPages(ref).length;
  writeFileSync(statusPath(ref.id), JSON.stringify({ state: left ? 'failed' : 'done', pages: ref.pages.length, attempts, errors, at: new Date().toISOString() }, null, 2));
  console.log(`[capture] ${ref.id}: ${ref.pages.length - left}/${ref.pages.length} pages${errors.length ? `, ${errors.length} failed` : ''}`);
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

// References with no shots at all go first, so new finds show up before recaptures.
export const captureMissing = () => {
  const todo = readRefs().filter(r => !isCaptured(r));
  const hasAny = r => existsSync(join(here, 'shots', r.id)) && readdirSync(join(here, 'shots', r.id)).some(f => f.endsWith('.jpg'));
  return captureAll([...todo.filter(r => !hasAny(r)), ...todo.filter(hasAny)]);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const only = process.argv.slice(2);
  const refs = readRefs().filter(r => !only.length || only.includes(r.id));
  for (const r of refs) for (const i of r.pages.keys()) rmSync(shotPath(r.id, i), { force: true });
  await captureAll(refs);
}
