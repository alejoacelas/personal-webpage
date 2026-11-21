// Serves the site on this machine together with the endpoint that re-sorts search results.
//   node wiki/serve.mjs        reads OPENROUTER_API_KEY from the environment or the repository's .env
// The endpoint only works on a publishing build of data.js (node wiki/build.mjs); with a review
// build it refuses, and the page keeps its own ordering.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rank, publishedWorks } from './rank.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.bin': 'application/octet-stream' };
const envFile = path.join(here, '..', '.env');
const key = process.env.OPENROUTER_API_KEY || (existsSync(envFile) ? (readFileSync(envFile, 'utf8').match(/^OPENROUTER_API_KEY=(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '') : '');

let cached = { at: 0, works: null };
async function works() {                             // reread data.js whenever a build has replaced it
  const file = path.join(here, 'data.js'), at = (await stat(file)).mtimeMs;
  if (at !== cached.at) cached = { at, works: publishedWorks(JSON.parse((await readFile(file, 'utf8')).replace(/^window\.DATA = /, '').replace(/;\s*$/, ''))) };
  return cached.works;
}
const asked = new Map();                             // a visitor may ask thirty times a minute
function allowed(who) {
  const now = Date.now(), recent = (asked.get(who) || []).filter(t => now - t < 60000);
  if (recent.length >= 30) return false;
  asked.set(who, [...recent, now]); return true;
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/rank') {
      if (req.method !== 'POST') return res.writeHead(405).end();
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 6000) return res.writeHead(413).end(); }
      const { question, ids } = JSON.parse(body);
      const published = await works();
      if (!key || !published) return res.writeHead(409).end();        // no key, or data.js is a review build
      if (!Array.isArray(ids) || !allowed(req.socket.remoteAddress)) return res.writeHead(429).end();
      const out = await rank({ question, ids, works: published, key });
      console.log(`ranked ${Object.keys(out.scores).length} entries in ${out.ms} ms, cost $${out.cost}`);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ scores: out.scores }));
    }
    // Files come from this folder; the favicon lives in ../public.
    const name = path.normalize(url.pathname === '/' ? 'index.html' : url.pathname).replace(/^[/\\]+/, '').replace(/^(\.\.[/\\])+/, '');
    const file = name === 'public/favicon.svg' ? path.join(here, '..', name) : path.join(here, name);
    const body = await readFile(file);                 // read before answering, so a missing file is a clean 404
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch (e) { if (!res.headersSent) res.writeHead(e.code === 'ENOENT' || e.code === 'EISDIR' ? 404 : 500); res.end(); }
}).listen(port, '127.0.0.1', () => console.log(`http://localhost:${port}${key ? '' : '  (no OpenRouter key found: search keeps its own ordering)'}`));
