// Reads the computed typography and colours of each favourite page from the live site.
// Writes analysis/tokens.json and a readable analysis/tokens.md.
// Usage (from references/): node analysis/extract.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const refs = JSON.parse(readFileSync(join(root, 'refs.json'), 'utf8'));
const favs = JSON.parse(readFileSync(join(root, 'favorites.json'), 'utf8'));

function measure() {
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const bg = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; } return 'rgb(255, 255, 255)'; };
  const font = el => { if (!el) return null; const s = getComputedStyle(el); return {
    family: s.fontFamily.split(',')[0].replace(/["']/g, '').trim(), stack: s.fontFamily, size: s.fontSize, weight: s.fontWeight,
    lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, transform: s.textTransform, style: s.fontStyle, color: s.color, background: bg(el) }; };
  const first = sel => [...document.querySelectorAll(sel)].find(visible);
  // Body text: the paragraph with the most text among the visible ones
  const ps = [...document.querySelectorAll('p, li, article div')].filter(e => visible(e) && e.children.length < 4 && e.innerText.trim().length > 80);
  const p = ps.sort((a, b) => b.innerText.length - a.innerText.length)[0];
  let measureChars = null, width = null;
  if (p) {
    const s = getComputedStyle(p); const c = document.createElement('canvas').getContext('2d');
    c.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    const avg = c.measureText('the quick brown fox jumps over a lazy dog, then rests.').width / 54;
    width = Math.round(p.getBoundingClientRect().width); measureChars = Math.round(width / avg);
  }
  const a = [...document.querySelectorAll('main a, article a, p a')].find(visible) || first('a');
  const aStyle = a && getComputedStyle(a);
  const loaded = [...new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, '')))];
  return {
    page: { background: bg(document.body), color: getComputedStyle(document.body).color, width: document.documentElement.scrollWidth },
    h1: font(first('h1')), h2: font(first('h2, h3')), body: font(p), bodyWidthPx: width, charsPerLine: measureChars,
    link: aStyle && { color: aStyle.color, decoration: aStyle.textDecorationLine, decorationStyle: aStyle.textDecorationStyle, thickness: aStyle.textDecorationThickness, offset: aStyle.textUnderlineOffset },
    fontsLoaded: loaded,
  };
}

const browser = await chromium.launch();
const out = {};
const jobs = favs.flatMap(id => { const r = refs.find(x => x.id === id); return r.pages.filter(p => !p.manual).map((p, i) => ({ id, name: r.name, i, label: p.label, url: p.url })); });
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let job; (job = jobs.shift());) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const page = await ctx.newPage();
      await page.goto(job.url, { waitUntil: 'load', timeout: 45000 });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      (out[job.id] ??= { name: job.name, pages: [] }).pages.push({ label: job.label, url: job.url, ...(await page.evaluate(measure)) });
      console.log('ok', job.id, job.label);
    } catch (e) { console.log('fail', job.id, job.label, e.message.split('\n')[0]); }
    await ctx.close();
  }
}));
await browser.close();
writeFileSync(join(root, 'analysis/tokens.json'), JSON.stringify(out, null, 2) + '\n');

// Readable table: one row per page
const hex = c => { const m = c?.match(/\d+(\.\d+)?/g); return m ? '#' + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('') : ''; };
const f = x => (x ? `${x.family} ${x.size}/${x.lineHeight} w${x.weight}${x.style === 'italic' ? ' italic' : ''}${x.transform !== 'none' ? ' ' + x.transform : ''}` : '—');
const rows = favs.filter(id => out[id]).flatMap(id => out[id].pages.map(p =>
  `| ${out[id].name} · ${p.label} | ${f(p.h1)} | ${f(p.h2)} | ${f(p.body)} | ${p.charsPerLine ?? '—'} | ${hex(p.page.background)} / ${hex(p.body?.color || p.page.color)} | ${p.link ? `${hex(p.link.color)} ${p.link.decoration}` : '—'} |`));
const families = {};
for (const id of Object.keys(out)) for (const p of out[id].pages) for (const x of [p.h1, p.h2, p.body]) if (x) (families[x.family] ??= new Set()).add(out[id].name);
const famRows = Object.entries(families).sort((a, b) => b[1].size - a[1].size).map(([k, v]) => `| ${k} | ${v.size} | ${[...v].join(', ')} |`);
writeFileSync(join(root, 'analysis/tokens.md'), `# Type and colour in the favourites

Measured from the live pages at 1440 px wide by \`analysis/extract.mjs\`. Sizes are size/line-height; "chars" is the approximate number of characters per line of the longest paragraph.

## Typefaces by number of favourites using them

| Typeface | Sites | Where |
|---|---|---|
${famRows.join('\n')}

## Per page

| Page | Headline | Subhead | Body | Chars | Background / text | Links |
|---|---|---|---|---|---|---|
${rows.join('\n')}
`);
console.log('done', Object.keys(out).length, 'sites');
