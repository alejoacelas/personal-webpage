// Headless screenshots and timings of the prototype, for checking a change without opening a browser window.
//   node wiki/shoot.mjs <page.html> <out-dir> '<json list of shots>'
// Each shot is [name, hash, width, height, script]; the script runs in the page and may return a value to print.
//   node wiki/shoot.mjs index.html /tmp/shots '[["home","#/"],["near","#/",1440,900,"MapView.zoomAt(9)"]]'
// Pass --frames to also print the median and worst frame time while zooming.
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [file, out, shotsJson, flag] = process.argv.slice(2);
const url = 'file://' + path.join(path.dirname(fileURLToPath(import.meta.url)), file);
const browser = await chromium.launch();
const errors = [];
for (const [name, hash = '#/', w = 1440, h = 900, js] of JSON.parse(shotsJson)) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ' console: ' + m.text().slice(0, 200)); });
  await page.goto(url + hash);
  await page.waitForTimeout(2400);            // the opening camera move
  if (js) { const r = await page.evaluate(js); if (r !== undefined) console.log(name, '→', JSON.stringify(r)); await page.waitForTimeout(1600); }
  await page.screenshot({ path: `${out}/${name}.png` });
  if (flag === '--frames') console.log(name, 'ms per frame while zooming', await page.evaluate(async () => {
    const times = []; let last = performance.now();
    MapView.zoomAt(2.5);
    await new Promise(done => { let n = 0; const tick = now => { times.push(now - last); last = now; if (++n < 60) requestAnimationFrame(tick); else done(); }; requestAnimationFrame(tick); });
    times.sort((a, b) => a - b); return { median: +times[30].toFixed(1), worst: +times[58].toFixed(1) };
  }));
  await page.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no page errors');
