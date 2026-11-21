// Decides which works are published and applies the edits that make them publishable.
// The marks live with the private sample, in share/*.json (see share/README.md there):
// ok, edit, ask or no. Only ok works and edited "edit" works are published.
//   node wiki/share.mjs check <share file> [...]   test records against the raw works
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const MARKS = new Set(['ok', 'edit', 'ask', 'no']);
const EDIT_KEYS = new Set(['replace', 'drop_messages', 'drop_from', 'drop_link', 'keep_link', 'drop_excerpt', 'title', 'gloss', 'pull', 'replying_to']);
const ANN_TEXT = ['title', 'gloss', 'pull', 'replying_to'];

// Later files win, so corrections go in a file that sorts last.
export async function loadShare(src) {
  const records = new Map();
  const dir = path.join(src, 'share');
  if (!existsSync(dir)) return records;
  for (const f of (await readdir(dir)).filter(f => f.endsWith('.json')).sort()) {
    for (const r of JSON.parse(await readFile(path.join(dir, f), 'utf8'))) records.set(r.id, { ...r, file: f });
  }
  return records;
}

// The mark a work ends up with. A "check" from the first pass with no record here is unreviewed.
export function markOf(ann, rec) {
  if (rec) return rec.share;
  return ann?.share === 'ok' ? 'ok' : ann?.share === 'no' ? 'no' : 'unreviewed';
}

// Edits change words people read, never identifiers, links between works or addresses.
const FIXED = new Set(['id', 'url', 'to', 'type', 'kind', 'date', 'time', 'path', 'channel', 'workspace', 'patterns', 'new_patterns', 'facets', 'name', 'via', 'call', 'call_kind', 'repo', 'homepage', 'language', 'pushed', 'announced_in', 'projects', 'context', 'attachments', 'share', 'share_reason']);
const mapStrings = (v, fn, key) => FIXED.has(key) ? v : typeof v === 'string' ? fn(v) : Array.isArray(v) ? v.map(x => mapStrings(x, fn, key)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x, fn, k)])) : v;
const allStrings = (v, out = []) => { if (typeof v === 'string') out.push(v); else if (v && typeof v === 'object') for (const x of Object.values(v)) allStrings(x, out); return out; };
const nameRe = n => new RegExp(`(?<![\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'u');

// Returns edited copies of the raw work, its annotation and its fetched repository. Throws when an edit can't be applied.
export function applyEdits({ item, ann, repo, excerpt }, rec) {
  const e = rec.edits || {};
  for (const k of Object.keys(e)) if (!EDIT_KEYS.has(k)) throw new Error(`${rec.id}: unknown edit "${k}"`);
  let work = structuredClone({ item, ann: ann || {}, repo: repo || null, excerpt: e.drop_excerpt ? null : excerpt || null });
  if (e.drop_messages?.length) {
    const n = work.item.messages?.length || 0;
    for (const i of e.drop_messages) if (!(i >= 0 && i < n)) throw new Error(`${rec.id}: no message ${i} to drop`);
    work.item.messages = work.item.messages.filter((_, i) => !e.drop_messages.includes(i));
  }
  for (const { find, with: to } of e.replace || []) {
    if (!find || typeof to !== 'string') throw new Error(`${rec.id}: a replace needs "find" and "with"`);
    let hits = 0;
    const swap = s => { const parts = s.split(find); hits += parts.length - 1; return parts.join(to); };
    work = { item: mapStrings(work.item, swap), ann: mapStrings(work.ann, swap), repo: mapStrings(work.repo, swap), excerpt: mapStrings(work.excerpt, swap) };
    if (!hits) throw new Error(`${rec.id}: text to replace not found: ${JSON.stringify(find.slice(0, 80))}`);
  }
  if (e.drop_from) {
    let cut = false;
    const chop = s => { const at = s.indexOf(e.drop_from); if (at < 0 || cut) return s; cut = true; return s.slice(0, at).trimEnd(); };
    if (work.item.body) work.item.body = chop(work.item.body);
    if (!cut && work.item.messages) work.item.messages.forEach(m => { m.text = chop(m.text); });
    if (!cut && typeof work.item.text === 'string') work.item.text = chop(work.item.text);
    if (!cut) throw new Error(`${rec.id}: text to cut from not found: ${JSON.stringify(e.drop_from.slice(0, 80))}`);
  }
  for (const k of ANN_TEXT) if (typeof e[k] === 'string') work.ann[k] = e[k];
  const names = rec.names || [];
  if (work.ann.mentions) {
    // A tag stays only while the edited text still says it; otherwise it would undo the edit.
    const said = allStrings([work.item.title, work.item.messages?.map(m => m.text), work.item.body, work.item.text, work.repo?.readme, work.repo?.description]).join(' ').toLowerCase();
    const edited = Object.keys(e).length > 0;
    work.ann.mentions = work.ann.mentions.filter(m => !names.some(n => nameRe(n).test(m)) && (!edited || said.includes(m.toLowerCase())));
  }
  // An edited document never links to its unedited original, unless the edits removed only Alejo's own details (keep_link).
  const bodyEdited = e.replace?.length || e.drop_from || e.drop_messages?.length;
  if (e.drop_link || (bodyEdited && !e.keep_link && ['doc', 'sheet', 'file'].includes(work.item.kind))) { work.item.url = ''; work.unlinked = true; }
  return work;
}

// ---- The check on what is about to be published.
const EMAIL = /[\w.+-]*[A-Za-z0-9]@[\w-]+(?:\.[\w-]+)+/g;
const EMAIL_OK = /^(git@|noreply@|no-reply@|.*@example\.(com|org)$|.*@anthropic\.com$|[\w.+-]+@\d)/;
const INVITE = /(join\.slack\.com|slack\.com\/shared_invite|zoom\.us\/j\/|meet\.google\.com\/[a-z]|calendly\.com\/|cal\.com\/|tidycal\.com\/|savvycal\.com\/|calendar\.app\.google|calendar\.google\.com\/calendar\/appointments|chat\.whatsapp\.com)/;
const PATH = /\/(?:Users|home)\/(?!alejo\b|you\b|me\b|username\b|user\b|\.\.\.|<)[A-Za-z][\w.-]*\//;

const APPS = /^(Google|Slack|GitHub|Zapier|Claude|Notion|Zoom|Linear|Asana)\b/;
// Full names of private people: Slack members and the people files in desk. Alejo and bots are left out.
export async function privatePeople(src) {
  const names = new Set();
  const add = n => { n = String(n || '').trim(); if (/^\p{Lu}[\p{L}'’.-]+(?: [\p{L}'’.-]+)+$/u.test(n) && !/^Alej(o|andro) Acelas/.test(n) && !APPS.test(n)) names.add(n); };
  const users = path.join(src, 'corpus/slack_users.json');
  if (existsSync(users)) Object.values(JSON.parse(await readFile(users, 'utf8'))).forEach(add);
  const people = process.env.WIKI_PEOPLE || path.join(os.homedir(), 'best/desk/people');
  if (existsSync(people)) for (const f of (await readdir(people)).filter(f => f.endsWith('.md'))) {
    add(((await readFile(path.join(people, f), 'utf8')).match(/^name:\s*["']?([^"'\n]+)/m) || [])[1]);
  }
  return [...names];
}

// `published` is whatever will be shown for one work; every string in it is searched.
export function problems(published, rec, people = []) {
  const found = [];
  const strings = allStrings(published);
  const has = re => strings.find(s => re.test(s));
  const keep = new Set([...(rec?.keep_names || []), ...(rec?.allow || [])]);
  for (const n of rec?.names || []) if (!keep.has(n) && has(nameRe(n))) found.push(`name "${n}"`);
  for (const n of people) if (!keep.has(n) && has(nameRe(n))) found.push(`full name "${n}"`);
  for (const s of strings) {
    for (const m of s.match(EMAIL) || []) if (!EMAIL_OK.test(m) && !keep.has(m)) found.push(`email address ${m}`);
    const inv = s.match(INVITE); if (inv && !keep.has(inv[0])) found.push(`invite or booking link (${inv[0]})`);
    const p = s.match(PATH); if (p && !keep.has(p[0])) found.push(`file path ${p[0]}`);
  }
  return [...new Set(found)];
}

// ---- Command line: test share records before the build uses them.
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === 'check') {
  const src = process.env.WIKI_DATA || path.join(os.homedir(), 'best/desk/requested/2026-11/2026-11-21-website-wiki');
  const read = async p => JSON.parse(await readFile(path.join(src, p), 'utf8'));
  const items = new Map((await readFile(path.join(src, 'corpus/items.jsonl'), 'utf8')).trim().split('\n').map(l => JSON.parse(l)).map(i => [i.id, i]));
  const anns = new Map();
  for (const dir of ['quotes', 'annotations']) for (const f of (await readdir(path.join(src, dir))).filter(f => f.endsWith('.json') && (dir !== 'quotes' || f.startsWith('quotes-'))).sort()) {
    for (const r of await read(`${dir}/${f}`)) if (dir === 'quotes') items.set(r.id, { ...r, kind: 'said' }); else anns.set(r.id, r);
  }
  const github = existsSync(path.join(src, 'corpus/github.json')) ? await read('corpus/github.json') : {};
  const excerpts = new Map();
  for (const f of (await readdir(path.join(src, 'quotes'))).filter(f => f.startsWith('excerpts-') && f.endsWith('.json'))) for (const x of await read(`quotes/${f}`)) if (x.turns?.length) excerpts.set(x.id, x);
  const people = await privatePeople(src);
  let bad = 0, n = 0;
  const tally = {};
  for (const file of process.argv.slice(3)) {
    const recs = JSON.parse(await readFile(file, 'utf8'));
    const todo = path.join(src, 'share/todo', path.basename(file).replace('.json', '.txt'));
    const want = existsSync(todo) ? (await readFile(todo, 'utf8')).split(/\s+/).filter(Boolean) : [];
    const got = new Set(recs.map(r => r.id));
    for (const id of want) if (!got.has(id)) { bad++; console.log(`MISSING ${id}: no record`); }
    for (const rec of recs) {
      n++; tally[rec.share] = (tally[rec.share] || 0) + 1;
      const fail = msg => { bad++; console.log(`FAIL ${rec.id}: ${msg}`); };
      const item = items.get(rec.id);
      if (!item) { fail('no such work'); continue; }
      if (!MARKS.has(rec.share)) { fail(`mark must be ok, edit, ask or no, not "${rec.share}"`); continue; }
      if (!rec.rule || !rec.reason) fail('needs "rule" and "reason"');
      if (rec.share === 'ask' && !(rec.ask?.who && rec.ask?.question)) fail('an ask needs "ask": {"who", "question"}');
      if (rec.share === 'edit' && !Object.keys(rec.edits || {}).length) fail('an edit needs "edits"');
      if (rec.share === 'ok' && Object.keys(rec.edits || {}).length) fail('a work with edits is "edit", not "ok"');
      if (rec.share === 'no') continue;
      try {
        const x = excerpts.get(rec.id);
        const out = applyEdits({ item, ann: anns.get(rec.id), repo: github[rec.id], excerpt: x && { other: x.other, turns: x.turns.map(t => t.who === 'alejo' ? { me: t.text } : { other: t.summary }) } }, rec);
        const shown = { item: { ...out.item, path: '', id: '', channel: '', workspace: '', context: '', attachments: '', messages: (out.item.messages || []).map(m => m.text) }, ann: { ...out.ann, id: '', share_reason: '', links: (out.ann.links || []).map(l => l.why) }, repo: out.repo, excerpt: out.excerpt };
        for (const p of problems(shown, { ...rec, names: [...(rec.names || []), ...(x?.names || []).filter(n => !/^(Ambitious Impact|80,000 Hours|80K|AIM|Impact Ops)$/i.test(n))] }, people)) fail(`still shows ${p}`);
      } catch (err) { fail(err.message.replace(`${rec.id}: `, '')); }
    }
  }
  console.log(`${n} records: ${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(', ')}. ${bad ? bad + ' problems.' : 'No problems.'}`);
  process.exit(bad ? 1 : 0);
}
