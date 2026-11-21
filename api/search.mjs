// Plain-text search for AI assistants and scripts: GET /api/search?q=words[&n=10]
// Ranks the published works with the same word matching as the page (wiki/search.js) and answers in
// text, with the address of each work's full text.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const Search = createRequire(import.meta.url)('../wiki/search.js');

let ready;
function load() {
  if (!ready) {
    const text = readFileSync(path.join(process.cwd(), 'wiki/data.publish.js'), 'utf8');
    const D = JSON.parse(text.replace(/^window\.DATA = /, '').replace(/;\s*$/, ''));
    const labels = new Map(D.patterns.map(p => [p.id, p.label]));
    ready = { D, labels, search: Search.build(D.works, D.patterns, id => labels.get(id)) };
  }
  return ready;
}
const KIND = { post: 'Slack post', doc: 'Document', tool: 'Repository', site: 'Site', said: 'Call excerpt', other: 'Link' };

export function answer(query, n, base, loaded = load()) {
  const q = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (q.length < 2) return `Add a query: ${base}/api/search?q=your+words\nOr read the index of every work: ${base}/works.txt\n`;
  const found = loaded.search(q), top = found.works.slice(0, Math.max(1, Math.min(40, +n || 10)));
  if (!top.length) return `Nothing on alejoacelas.com matches "${q}". Try fewer or different words, or read the index: ${base}/works.txt\n`;
  return `Search of alejoacelas.com for "${q}": ${found.works.length} works match; the best ${top.length} are below. Open a work's text address to read it in full.\n\n` +
    (found.topics.length ? `Topics that match: ${found.topics.slice(0, 3).map(p => `${p.label} (${base}/topics/${p.id}.txt)`).join('; ')}\n\n` : '') +
    top.map((x, i) => `${i + 1}. ${x.w.title}\n   ${KIND[x.w.kind]}, ${x.w.date.slice(0, x.w.kind === 'said' ? 7 : 10)}. ${x.w.gloss}\n   Text: ${base}/works/${x.w.id}.txt\n   On the map: ${base}/#/w/${x.w.id}`).join('\n\n') + '\n';
}

export default function handler(req, res) {
  const url = new URL(req.url, 'https://alejoacelas.com');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(answer(url.searchParams.get('q'), url.searchParams.get('n'), 'https://alejoacelas.com'));
}
