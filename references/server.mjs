// Serves the viewer at http://localhost:4321, records favourites and seen references,
// screenshots new references as they appear, and runs the discovery loop.
// `node server.mjs --no-discover` skips the discovery loop.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { here, readRefs, isCaptured, captureMissing } from './capture.mjs';
import * as discover from './discover.mjs';

const PORT = 4321;
const readJson = (f, d) => (existsSync(join(here, f)) ? JSON.parse(readFileSync(join(here, f), 'utf8')) : d);
const writeJson = (f, v) => writeFileSync(join(here, f), JSON.stringify(v, null, 2) + '\n');

function state() {
  const refs = readRefs().map(r => {
    const dir = join(here, 'shots', r.id);
    const shots = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.jpg')).sort() : [];
    return { ...r, shots, capture: isCaptured(r) ? 'done' : 'pending' };
  });
  return {
    refs,
    favorites: readJson('favorites.json', []),
    seen: readJson('state.json', { seen: [] }).seen,
    capturing,
    discovery: discover.status,
  };
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.css': 'text/css' };
const body = req => new Promise(r => { let b = ''; req.on('data', d => (b += d)); req.on('end', () => r(b ? JSON.parse(b) : {})); });

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (code, data, type = 'application/json') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data)); };
  try {
    if (url.pathname === '/api/state') return send(200, state());
    if (url.pathname === '/api/fav' && req.method === 'POST') {
      const { id } = await body(req);
      const favs = readJson('favorites.json', []);
      writeJson('favorites.json', favs.includes(id) ? favs.filter(f => f !== id) : [...favs, id]);
      return send(200, { ok: true });
    }
    if (url.pathname === '/api/note' && req.method === 'POST') {
      const { id, note } = await body(req);
      const refs = readRefs();
      const r = refs.find(x => x.id === id);
      if (!r) return send(404, { error: 'unknown id' });
      r.note = note;
      writeFileSync(join(here, 'refs.json'), JSON.stringify(refs, null, 2) + '\n');
      return send(200, { ok: true });
    }
    if (url.pathname === '/api/seen' && req.method === 'POST') {
      const { id } = await body(req);
      const st = readJson('state.json', { seen: [] });
      if (!st.seen.includes(id)) { st.seen.push(id); writeJson('state.json', st); }
      return send(200, { ok: true });
    }
    const rel = normalize(decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)).replace(/^\/+/, '');
    const file = join(here, rel);
    const allowed = rel === 'index.html' || rel.startsWith('shots/') || rel.startsWith('directions/');
    if (!allowed || !existsSync(file) || !statSync(file).isFile()) return send(404, 'not found', 'text/plain');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': rel.startsWith('shots/') ? 'max-age=60' : 'no-store' });
    res.end(readFileSync(file));
  } catch (e) { send(500, { error: e.message }); }
}).listen(PORT, () => console.log(`References viewer: http://localhost:${PORT}`));

// Capture worker: screenshot any reference that has no shots yet.
let capturing = false;
setInterval(async () => {
  if (capturing) return;
  capturing = true;
  try { await captureMissing(); } catch (e) { console.error('[capture]', e.message); }
  capturing = false;
}, 5000);

if (!process.argv.includes('--no-discover')) discover.loop();
