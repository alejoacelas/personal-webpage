// Discovery loop: asks headless Claude for more references and appends them to refs.json.
// It runs a round whenever Alejo has fewer than UNSEEN_TARGET references left to look at,
// or as soon as he marks a new favourite. server.mjs starts it; `node discover.mjs` runs one round.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { here, readRefs } from './capture.mjs';

const UNSEEN_TARGET = 80; // keep about this many unseen references ready
const PER_ROUND = 12;
const MAX_REFS = 500;
const LOG = join(here, 'discover.log');

export const status = { running: false, rounds: 0, lastRunAt: null, lastAdded: 0, lastError: null };
const readJson = (f, d) => (existsSync(join(here, f)) ? JSON.parse(readFileSync(join(here, f), 'utf8')) : d);
const log = m => { const line = `${new Date().toISOString()} ${m}\n`; appendFileSync(LOG, line); process.stdout.write(`[discover] ${m}\n`); };

const SCHEMA = {
  type: 'object',
  required: ['refs'],
  properties: {
    refs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'cluster', 'why', 'pages'],
        properties: {
          id: { type: 'string', description: 'lowercase-dashed slug, unique' },
          name: { type: 'string' },
          cluster: { type: 'string', description: 'an existing cluster name, or a new one if none fits' },
          why: { type: 'string', description: 'one short sentence: what is distinctive about its design' },
          seed: { type: ['string', 'null'], description: 'id of the favourite this is "more like", or null for exploration' },
          pages: {
            type: 'array', minItems: 1, maxItems: 3,
            items: { type: 'object', required: ['label', 'url'], properties: { label: { type: 'string' }, url: { type: 'string' } } },
          },
        },
      },
    },
  },
};

function buildPrompt(refs, favs) {
  const byId = Object.fromEntries(refs.map(r => [r.id, r]));
  const describe = r => `- ${r.id}: ${r.name} (${r.pages[0].url}) [${r.cluster}]${r.note ? ` — Alejo's note: "${r.note}"` : ''}${r.why ? ` — ${r.why}` : ''}`;
  const picks = refs.filter(r => r.source === 'alejo');
  const favRefs = favs.map(id => byId[id]).filter(Boolean);
  const clusters = [...new Set(refs.map(r => r.cluster))];
  const seedShare = favRefs.length ? Math.ceil(PER_ROUND * 0.7) : 0;
  return `You are helping Alejo Acelas collect design references for redesigning his personal website, alejoacelas.com.

About the site: Alejo works independently helping high-impact organisations (EA and AI safety groups) use AI well: adoption audits, coaching and short build sprints. The site is where people he wants to work with get to know him. It should be minimal and candid, every word chosen on purpose, with room for small, cute details.

Sites Alejo picked himself:
${picks.map(describe).join('\n')}

Favourites Alejo marked while browsing (most recent last):
${favRefs.length ? favRefs.map(describe).join('\n') : '(none yet)'}

Clusters in use: ${clusters.join('; ')}

Already collected (do not repeat these sites, including other pages of the same site):
${refs.map(r => r.pages[0].url).join('\n')}

Find ${PER_ROUND} NEW websites worth looking at as design references. Use web search and your own knowledge.
${seedShare ? `- At least ${seedShare} must be "more like" a favourite: set seed to that favourite's id, spread across the favourites with more weight on the most recent ones, and pick sites that share what makes the favourite distinctive (its type, layout, tone or structure), not just its topic.` : ''}
- The rest explore: varied kinds of sites (personal sites of researchers, writers, consultants and designers; independent magazines; research labs; small studios; tools with lovely documents; data stories; digital gardens). Set seed to null.
- Favour real craft: considered typography, restraint, clear structure, honest voice, small delightful details. Skip generic templates and big corporate marketing sites.
- Give 1–3 pages per site. Add an inner page (an article, an essay, a note, a project page) when the craft shows there more than on the home page.
- Fetch every URL you give to confirm it loads without a login. Drop any that fail.
- Use an existing cluster when one fits; create a new cluster name only for a genuinely different kind of site.
- "why" is one short sentence about what is distinctive in the design.

Return only the structured output.`;
}

function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const args = ['-p', prompt, '--model', 'opus', '--output-format', 'json', '--json-schema', JSON.stringify(SCHEMA), '--dangerously-skip-permissions'];
    const child = spawn('claude', args, { cwd: here, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', d => (out += d));
    child.stderr.on('data', d => (err += d));
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`claude exited ${code}: ${err.slice(-500)}`));
      try {
        const res = JSON.parse(out);
        const data = res.structured_output ?? JSON.parse(res.result.slice(res.result.indexOf('{'), res.result.lastIndexOf('}') + 1));
        resolve(data.refs);
      } catch (e) { reject(new Error(`could not parse output: ${e.message}: ${out.slice(0, 500)}`)); }
    });
  });
}

// Same host and first path segment counts as the same site (so metr.org/notes and metr.org/blog differ).
const siteKey = url => { try { const u = new URL(url); return u.hostname.replace(/^www\./, '') + '/' + u.pathname.split('/')[1]; } catch { return url; } };

export async function round() {
  status.running = true;
  status.lastRunAt = new Date().toISOString();
  const refs = readRefs();
  const favs = readJson('favorites.json', []);
  log(`round ${status.rounds + 1}: ${refs.length} refs, ${favs.length} favourites`);
  try {
    const found = await runClaude(buildPrompt(refs, favs));
    const current = readRefs(); // re-read: favourites/notes may have changed meanwhile
    const ids = new Set(current.map(r => r.id));
    const sites = new Set(current.map(r => siteKey(r.pages[0].url)));
    const added = [];
    for (const r of found) {
      if (!r.pages?.length) continue;
      const key = siteKey(r.pages[0].url);
      let id = r.id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (sites.has(key)) continue;
      while (ids.has(id)) id += '-2';
      ids.add(id); sites.add(key);
      added.push({ id, name: r.name, cluster: r.cluster, note: '', why: r.why, seed: favs.includes(r.seed) ? r.seed : null,
        source: 'agent', added: new Date().toISOString(), pages: r.pages });
    }
    writeFileSync(join(here, 'refs.json'), JSON.stringify([...current, ...added], null, 2) + '\n');
    status.lastAdded = added.length; status.lastError = null;
    log(`added ${added.length}: ${added.map(a => a.id).join(', ')}`);
  } catch (e) {
    status.lastError = e.message;
    log(`error: ${e.message}`);
  } finally {
    status.rounds++; status.running = false;
  }
}

// Runs rounds forever, paced by how many references Alejo has not yet seen.
export async function loop() {
  let lastFavs = JSON.stringify(readJson('favorites.json', []));
  for (;;) {
    const refs = readRefs();
    const seen = new Set(readJson('state.json', { seen: [] }).seen);
    const unseen = refs.filter(r => !seen.has(r.id)).length;
    const favs = JSON.stringify(readJson('favorites.json', []));
    const newFav = favs !== lastFavs && JSON.parse(favs).length >= JSON.parse(lastFavs).length;
    if (refs.length < MAX_REFS && (unseen < UNSEEN_TARGET || newFav)) {
      lastFavs = favs;
      await round();
      if (status.lastError) await new Promise(r => setTimeout(r, 120000)); // back off after a failure
    } else {
      await new Promise(r => setTimeout(r, 15000));
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await round();
