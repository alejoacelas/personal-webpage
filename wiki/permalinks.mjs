// Keeps links working once they have been published.
// A work's link is tied to where the work lives (its Slack thread, Google Doc, repository or call),
// kept in a private register beside the sample. If a later build gives that work a different id,
// the old link redirects; if the work is taken down, the old link says so instead of breaking.
// Patterns that were merged or renamed redirect to the pattern that took them over.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const sourceOf = item =>
  item.kind === 'slack' ? 'slack:' + (item.url.split('/archives/')[1] || item.id)
  : item.call ? 'said:' + item.call + ':' + item.text.toLowerCase().replace(/[^a-z]+/g, '').slice(0, 60)
  : /docs\.google\.com\/(document|spreadsheets)\/d\/([\w-]+)/.test(item.url || '') ? 'gdoc:' + item.url.match(/\/d\/([\w-]+)/)[1]
  : item.url ? 'url:' + item.url.replace(/[?#].*/, '').replace(/\/$/, '')
  : 'desk:' + item.id;

export async function permalinks({ serialized, internalIds, items, quotes, reassign = {}, src, record }) {
  const out = JSON.parse(serialized);
  const file = path.join(src, 'scheme/permalinks.json');
  const register = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : { works: {}, patterns: {} };
  const today = new Date().toISOString().slice(0, 10);
  const source = new Map([...items, ...quotes].map(i => [i.id, sourceOf(i)]));
  const now = new Map(out.works.map((w, n) => [source.get(internalIds[n]), w.id]));
  const redirects = {}, gone = {};

  // A topic that was merged or renamed redirects, but only if it was ever published under the old name.
  for (const [old, to] of Object.entries(reassign)) if (register.patterns[old] && to.length && to[0] !== old) redirects['p/' + old] = 'p/' + to[0];
  const livePatterns = new Set(out.patterns.map(p => p.id));
  for (const [id, entry] of Object.entries(register.patterns)) {
    if (livePatterns.has(id) || redirects['p/' + id]) continue;
    if (record) entry.gone ??= today;
    gone['p/' + id] = { since: entry.gone || today };
  }
  for (const [key, entry] of Object.entries(register.works)) {
    const id = now.get(key);
    if (id && id !== entry.id) { (entry.former ??= []).push(entry.id); if (record) entry.id = id; }
    for (const former of entry.former || []) if (id) redirects['w/' + former] = 'w/' + id;
    if (!id) { if (record) entry.gone ??= today; for (const dead of [entry.id, ...(entry.former || [])]) gone['w/' + dead] = { since: entry.gone || today }; }
    else if (record) delete entry.gone;
  }
  if (record) {            // only a release adds to the register: node wiki/build.mjs --release
    for (const [key, id] of now) if (key) register.works[key] ??= { id, since: today };
    for (const id of livePatterns) { register.patterns[id] ??= { since: today }; delete register.patterns[id].gone; }
    await writeFile(file, JSON.stringify(register, null, 1) + '\n');
  }
  out.redirects = redirects; out.gone = gone;
  return JSON.stringify(out);
}
