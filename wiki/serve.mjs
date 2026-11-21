// Serves the prototype on this machine, with the answering endpoint the page calls.
//   node wiki/serve.mjs                    answers through the Claude command-line tool
//   ANTHROPIC_API_KEY=… node wiki/serve.mjs    answers through the API, as the live site will
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { answer } from './ask.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

let cached = { at: 0, data: null };
async function data() {                              // reread data.js whenever a build has replaced it
  const file = path.join(here, 'data.js'), at = (await stat(file)).mtimeMs;
  if (at !== cached.at) cached = { at, data: JSON.parse((await readFile(file, 'utf8')).replace(/^window\.DATA = /, '').replace(/;\s*$/, '')) };
  return cached.data;
}
const asked = new Map();                             // a visitor may ask ten questions every five minutes
function allowed(who) {
  const now = Date.now(), recent = (asked.get(who) || []).filter(t => now - t < 300000);
  if (recent.length >= 10) return false;
  asked.set(who, [...recent, now]); return true;
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/ask') {
      if (req.method !== 'POST') return res.writeHead(405).end();
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 4000) return res.writeHead(413).end(); }
      const question = String(JSON.parse(body).question || '').trim().slice(0, 300);
      if (question.length < 3) return res.writeHead(400).end();
      if (!allowed(req.socket.remoteAddress)) return res.writeHead(429).end();
      const stop = new AbortController(); res.on('close', () => { if (!res.writableEnded) stop.abort(); });     // the visitor left before the answer finished
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
      const started = Date.now(); let first = 0;
      try { for await (const text of answer({ question, data: await data(), key: process.env.ANTHROPIC_API_KEY, signal: stop.signal, trial: true })) { first ||= Date.now() - started; res.write(text); } }
      catch (e) { if (e.name !== 'AbortError') { console.error(e.message); if (!first) res.write(''); } }
      console.log(`asked (${question.length} characters): first words after ${first} ms, done after ${Date.now() - started} ms`);
      return res.end();
    }
    // Files come from this folder; the favicon lives in ../public.
    const name = path.normalize(url.pathname === '/' ? 'index.html' : url.pathname).replace(/^[/\\]+/, '').replace(/^(\.\.[/\\])+/, '');
    const file = name === 'public/favicon.svg' ? path.join(here, '..', name) : path.join(here, name);
    if (!file.startsWith(path.join(here, '..'))) return res.writeHead(403).end();
    const body = await readFile(file);                 // read before answering, so a missing file is a clean 404
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch (e) { if (!res.headersSent) res.writeHead(e.code === 'ENOENT' || e.code === 'EISDIR' ? 404 : 500); res.end(); }
}).listen(port, '127.0.0.1', () => console.log(`http://localhost:${port}`));
