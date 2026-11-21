// Builds wiki/data.js from the private annotated sample kept in desk.
// The sample and data.js stay out of this public repository.
//   node wiki/build.mjs            what would be published: "ok" works and edited "edit" works
//   node wiki/build.mjs --review   every work except those marked "no", for reviewing the marks
//   node wiki/build.mjs --excerpts publish build that also shows the conversation around each call quote
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { createHash } from 'node:crypto';
import { layout } from './layout.mjs';
import { permalinks } from './permalinks.mjs';
import { loadShare, markOf, applyEdits, problems, privatePeople, addressOf } from './share.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = process.env.WIKI_DATA || path.join(os.homedir(), 'best/desk/requested/2026-11/2026-11-21-website-wiki');
const json = async p => JSON.parse(await readFile(path.join(src, p), 'utf8'));
const maybe = async (p, fallback) => existsSync(path.join(src, p)) ? json(p) : fallback;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = u => /^https?:\/\//.test(u) ? u : '#';

// ---- Markdown (docs, READMEs). Raw HTML in the source is shown as text.
marked.use({
  gfm: true,
  renderer: {
    html({ text }) { return esc(text); },
    link({ href, text, tokens }) { return `<a href="${esc(safeUrl(href))}" target="_blank" rel="noopener">${this.parser.parseInline(tokens)}</a>`; },
    image({ text }) { return `<span class="img-note">[image${text ? ': ' + esc(text) : ''}]</span>`; },
  },
});
const md = text => marked.parse(String(text || '').replace(/\\([.\-!#()+_*[\]])/g, '$1'));

// ---- Slack's own markup.
const EMOJI = { '+1': '👍', eyes: '👀', raised_hands: '🙌', pray: '🙏', heart: '❤️', heavy_plus_sign: '➕', rocket: '🚀', fire: '🔥', white_check_mark: '✅', joy: '😂', thinking_face: '🤔', 100: '💯', raising_hand: '🙋', sweat_smile: '😅', open_mouth: '😮', grin: '😁', grinning: '😀', ok_hand: '👌', green_heart: '💚', bulb: '💡', thought_balloon: '💭', fireworks: '🎆', thread: '🧵', saluting_face: '🫡', one: '1️⃣', two: '2️⃣', three: '3️⃣', four: '4️⃣', top: '🔝', cool: '🆒', tada: '🎉', sparkles: '✨', smile: '😄', slightly_smiling_face: '🙂', wave: '👋', point_up: '☝️', warning: '⚠️', star: '⭐', clap: '👏', muscle: '💪', laughing: '😆', sob: '😭', exploding_head: '🤯', robot_face: '🤖', brain: '🧠' };
const emoji = name => EMOJI[name.replace(/::skin-tone-\d/, '')];
function slackInline(s) {
  let out = esc(s);
  const codes = [];
  out = out.replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label, url) => `<a href="${url}" target="_blank" rel="noopener">${label}</a>`);
  out = out.replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, (_, pre, url) => `${pre}<a href="${url}" target="_blank" rel="noopener">${url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)}</a>`);
  out = out.replace(/(^|[\s(>])\*([^*\n]+)\*(?=[\s.,;:!?)]|$)/g, '$1<b>$2</b>');
  out = out.replace(/(^|[\s(>])_([^_\n]+)_(?=[\s.,;:!?)]|$)/g, '$1<i>$2</i>');
  out = out.replace(/(^|[\s(>])~([^~\n]+)~(?=[\s.,;:!?)]|$)/g, '$1<s>$2</s>');
  out = out.replace(/(^|\s)@([A-Z][\w'’-]+(?: [A-Z][\w'’-]+)?|channel|here)/g, '$1<span class="mention">@$2</span>');
  out = out.replace(/:([a-z0-9_+-]+):/g, (m, n) => emoji(n) || m);
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}
function slackHtml(text) {
  const blocks = [];
  let list = null;
  const flush = () => { if (list) { blocks.push(list.html + '</li>'.repeat(list.open ? 1 : 0) + `</${list.tag}>`.repeat(list.depth)); list = null; } };
  const parts = String(text).split(/```/);
  parts.forEach((part, n) => {
    if (n % 2) { flush(); blocks.push(`<pre>${esc(part.trim())}</pre>`); return; }
    for (const line of part.split('\n')) {
      const m = line.match(/^(\s*)(?:([•◦▪▫\-])|(\d+)[.)]|([a-z])\.)\s+(.*)$/);
      if (m && (m[2] !== '-' || /^\s*-\s/.test(line))) {
        const depth = 1 + Math.min(2, Math.floor(m[1].replace(/\t/g, '    ').length / 4));
        const tag = m[3] || m[4] ? 'ol' : 'ul';
        if (!list) list = { html: '', depth: 0, open: false, tag };
        if (depth > list.depth) { list.html += `<${tag}>`.repeat(depth - list.depth); }
        else { list.html += '</li>'; if (depth < list.depth) list.html += `</${list.tag}></li>`.repeat(list.depth - depth); }
        list.depth = depth; list.open = true; list.html += `<li>${slackInline(m[5])}`;
      } else if (line.startsWith('>') || line.startsWith('&gt;')) { flush(); blocks.push(`<blockquote>${slackInline(line.replace(/^(>|&gt;)\s?/, ''))}</blockquote>`); }
      else if (line.trim()) { flush(); blocks.push(`<p>${slackInline(line)}</p>`); }
      else flush();
    }
  });
  flush();
  return blocks.join('');
}

// ---- Load.
const items = (await readFile(path.join(src, 'corpus/items.jsonl'), 'utf8')).trim().split('\n').map(l => JSON.parse(l));
const github = await maybe('corpus/github.json', {});
const scheme = await maybe('scheme/scheme.json', { patterns: [], facets: [], link_types: [] });
const final = await maybe('scheme/patterns.json', null);
const quotes = [];
const excerpts = new Map();
const excerptNames = new Map();   // names seen in the raw passage around a quote; the publish check looks for them
const annotations = new Map();
for (const dir of ['quotes', 'annotations']) {
  if (!existsSync(path.join(src, dir))) continue;
  for (const f of (await readdir(path.join(src, dir))).filter(f => f.endsWith('.json')).sort()) {
    const rows = await json(`${dir}/${f}`);
    if (dir === 'annotations') for (const a of rows) annotations.set(a.id, a);
    else if (f.startsWith('quotes-')) quotes.push(...rows);
    else if (f.startsWith('excerpts-')) for (const e of rows) if (e.turns?.length) excerptNames.set(e.id, e.names || []), excerpts.set(e.id, { other: e.other, turns: e.turns.map(t => t.who === 'alejo' ? { me: t.text } : { other: t.summary }) });
  }
}

// ---- Patterns and areas. Before consolidation, fall back to the scheme's patterns in one area.
const patterns = (final?.patterns || scheme.patterns.map(p => ({ ...p, area: p.kind, summary: p.definition, lead: p.examples.slice(0, 4), related: [] })));
const areas = final?.areas || [{ id: 'idea', label: 'Ideas he returns to', blurb: 'Provisional grouping until the agents finish.' }, { id: 'practice', label: 'Things he does and makes', blurb: 'Provisional grouping until the agents finish.' }, { id: 'project', label: 'Bodies of work', blurb: 'Provisional grouping until the agents finish.' }];
const exampleOf = new Map();
for (const p of scheme.patterns) for (const id of p.examples || []) (exampleOf.get(id) || exampleOf.set(id, []).get(id)).push({ id: p.id, strength: 2 });
const patternIds = new Set(patterns.map(p => p.id));
const labelToId = new Map([...scheme.patterns, ...patterns].map(p => [p.label.toLowerCase(), p.id]));
const reassign = final?.reassign || {};
const adds = new Map();
for (const a of final?.add || []) (adds.get(a.work) || adds.set(a.work, []).get(a.work)).push([a.pattern, a.strength || 1]);
function resolvePatterns(a) {
  const got = new Map();
  const put = (id, strength) => { if (patternIds.has(id)) got.set(id, Math.max(got.get(id) || 0, strength)); };
  for (const p of a.patterns || (annotations.has(a.id) ? [] : exampleOf.get(a.id)) || []) {
    if (patternIds.has(p.id)) put(p.id, p.strength || 1);
    else for (const to of reassign[p.id] || []) put(to, p.strength || 1);
  }
  for (const np of a.new_patterns || []) for (const to of reassign[np.label] || reassign[labelToId.get(np.label?.toLowerCase())] || []) put(to, 1);
  for (const [id, strength] of adds.get(a.id) || []) put(id, strength);
  return [...got].sort((x, y) => y[1] - x[1]);
}

// ---- Works.
const KIND = { slack: 'post', doc: 'doc', sheet: 'doc', repo: 'tool', gist: 'tool', site: 'site', file: 'other' };
const gdocId = u => (u.match(/docs\.google\.com\/document\/d\/([\w-]+)/) || [])[1];
const firstWords = (t, n) => { const s = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n).replace(/\s\S*$/, '') + '…' : s; };
const works = [];
let dropped = 0;
// ---- Which works are shown, and with which edits (share.mjs). --review keeps the rest for checking the marks.
const review = process.argv.includes('--review');
const share = await loadShare(src);
// Channel names can carry a client's or a project's name; only the listed ones are shown.
const openChannels = new Set(existsSync(path.join(src, 'share/channels.txt')) ? (await readFile(path.join(src, 'share/channels.txt'), 'utf8')).split(/\s+/) : []);
const linked = new Set();    // addresses of works published with their link; a second entry for the same address doesn't block it
const blocked = new Set();   // addresses no published text may link: works left out, or shown without their link
function shown(raw) {
  const rec = share.get(raw.id), ann = annotations.get(raw.id) || {}, mark = markOf(annotations.get(raw.id), rec);
  if (mark !== 'ok' && mark !== 'edit' && addressOf(raw)) blocked.add(addressOf(raw));
  if (mark === 'no' || (!review && mark !== 'ok' && mark !== 'edit')) { dropped++; return null; }
  const out = rec?.edits ? applyEdits({ item: raw, ann, repo: github[raw.id], excerpt: excerpts.get(raw.id) }, rec) : { item: raw, ann, repo: github[raw.id], excerpt: excerpts.get(raw.id) };
  if (out.unlinked && addressOf(raw)) blocked.add(addressOf(raw));
  else if (addressOf(raw)) linked.add(addressOf(raw));
  const note = mark === 'edit' ? `edited: ${rec.reason}` : mark === 'ask' ? `ask ${rec.ask.who}: ${rec.ask.question}` : mark === 'unreviewed' ? `not re-marked: ${ann.share_reason || ''}` : '';
  return { ...out, marks: { share: mark === 'ok' || !review ? 'ok' : 'check', shareReason: review ? note : '', ...(mark === 'edit' ? { edited: true } : {}) } };
}
for (const raw of items) {
  const out = shown(raw);
  if (!out) continue;
  const { item: i, ann: a, marks } = out;
  const w = {
    id: i.id, kind: KIND[i.kind], sub: i.kind, date: i.date, url: i.url || '',
    title: a.title || i.title || firstWords(i.messages?.[0]?.text || '', 70),
    gloss: a.gloss || '', pull: a.pull || '', patterns: resolvePatterns({ ...a, id: i.id }),
    facets: a.facets || {}, links: (a.links || []).map(l => ({ ...l })), mentions: a.mentions || [],
    ...marks,
  };
  if (i.kind === 'slack') {
    w.slack = {
      channel: review || openChannels.has(i.channel) ? i.channel : 'private-channel', replies: i.replies, others: i.others, startsThread: i.starts_thread, replyingTo: a.replying_to || '',
      messages: i.messages.map(m => ({
        time: m.time, html: slackHtml(m.text),
        reactions: (m.reactions || []).map(r => [emoji(r.name), r.count]).filter(r => r[0]),
        files: (m.files || []).map(f => f.type),
      })),
    };
    w.text = i.messages.map(m => m.text).join(' ');
  } else if (i.kind === 'repo' || i.kind === 'gist') {
    const g = out.repo || {};
    w.tool = g.missing || g.private ? { repo: g.repo, unavailable: true, private: !!g.private }
      : g.gist ? { gist: true, description: g.description, files: g.files.map(f => ({ name: f.name, html: /\.md$/i.test(f.name) ? md(f.content) : `<pre>${esc(f.content.slice(0, 8000))}</pre>` })) }
      : { repo: g.repo, description: g.description, language: g.language, stars: g.stars, pushed: g.pushed, homepage: g.homepage, readme: g.readme ? md(g.readme) : '' };
    if (out.unlinked) w.tool = { repo: '', unavailable: true, private: true };   // shown by its description only
    w.text = g.private || g.missing ? '' : (g.description || '') + ' ' + (g.readme || '').slice(0, 3000);
  } else if (i.kind === 'doc') {
    const body = i.body.replace(/^\s*\[from\]\([^)]*\)\s*/, '').replace(/^# .+\n+(# .+\n)/, '$1');
    w.doc = { gdoc: gdocId(i.url), html: i.chars > 400 ? md(body) : '', cut: i.chars > i.body.length, chars: i.chars };
    w.text = i.body.slice(0, 6000);
  } else {
    w.text = i.body || '';
  }
  if (i.announced_in && !w.links.some(l => l.to === i.announced_in)) w.links.push({ to: i.announced_in, type: 'shared-in', why: '' });
  works.push(w);
}
// ---- Call quotes. The other person never agreed to appear, so a published quote says as little about them as it can:
// the month only, a setting that names the kind of call and nothing about who it was with, and no excerpt of the
// conversation unless the build is run with --excerpts (two rounds of checking each still found excerpts that
// retold the other person's situation).
const withExcerpts = review || process.argv.includes('--excerpts');
const SETTING = { coaching: ['A coaching call', 'a coaching client'], scoping: ['A scoping call with an organisation', 'someone at the organisation'], intro: ['An intro call', 'the other person'], peer: ['A call with a peer', 'a peer'], advice: ['A conversation', 'the other person'] };
function general(q) {
  if (/as the one being coached/.test(q.setting)) return ['A coaching session, as the one being coached', 'a coach'];
  if (/with a mentor$/.test(q.setting)) return ['A call with a mentor', 'a mentor'];
  if (/group call/.test(q.setting)) return ['A group call with peers', 'peers on the call'];
  return SETTING[q.call_kind] || ['A call', 'the other person'];
}
for (const raw of quotes) {
  const out = shown(raw);
  if (!out) continue;
  const { item: q, ann: a, marks } = out;
  const [setting, label] = review ? [q.setting, out.excerpt?.other] : general(q);
  const excerpt = withExcerpts && out.excerpt ? { ...out.excerpt, other: label } : null;
  works.push({
    id: q.id, kind: 'said', sub: q.call_kind, date: review ? q.date : q.date.slice(0, 8) + '01', url: '',
    title: a.title || firstWords(q.text, 60), gloss: a.gloss || '',
    pull: q.text, patterns: resolvePatterns({ ...a, id: q.id }), facets: a.facets || {}, links: a.links || [], mentions: a.mentions || [],
    ...marks, said: { setting, about: q.about, text: q.text, ...(excerpt ? { excerpt } : {}) }, text: q.text,
  });
}
works.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
const byId = new Map(works.map(w => [w.id, w]));

// ---- Links run both ways; drop any that point at a missing work.
const types = new Map([...scheme.link_types, { id: 'shared-in', label: 'shared in', reverse_label: 'shares' }].map(t => [t.id, t]));
for (const w of works) w.links = w.links.filter(l => byId.has(l.to) && l.to !== w.id).map(l => ({ to: l.to, label: types.get(l.type)?.label || l.type, why: l.why || '' }));
for (const w of works) for (const l of w.links.filter(l => !l.back)) {
  const other = byId.get(l.to);
  if (!other.links.some(x => x.to === w.id)) other.links.push({ to: w.id, label: [...types.values()].find(t => t.label === l.label)?.reverse_label || l.label, why: l.why, back: true });
}

// ---- Nearby works: share patterns (rarer patterns count more) and named tools or organisations.
const count = new Map();
for (const w of works) for (const [p] of w.patterns) count.set(p, (count.get(p) || 0) + 1);
const mentionCount = new Map();
for (const w of works) for (const m of new Set(w.mentions)) mentionCount.set(m, (mentionCount.get(m) || 0) + 1);
const byPattern = new Map(), byMention = new Map();
for (const w of works) {
  for (const [p] of w.patterns) (byPattern.get(p) || byPattern.set(p, []).get(p)).push(w);
  for (const m of new Set(w.mentions)) (byMention.get(m) || byMention.set(m, []).get(m)).push(w);
}
for (const w of works) {
  const score = new Map();
  for (const [p, s] of w.patterns) for (const o of byPattern.get(p)) if (o !== w) score.set(o.id, (score.get(o.id) || 0) + s * o.patterns.find(x => x[0] === p)[1] / Math.log(2 + count.get(p)));
  for (const m of new Set(w.mentions)) if (mentionCount.get(m) < 40) for (const o of byMention.get(m)) if (o !== w) score.set(o.id, (score.get(o.id) || 0) + 0.6 / Math.log(2 + mentionCount.get(m)));
  const linked = new Set(w.links.map(l => l.to));
  w.near = [...score].filter(([id]) => !linked.has(id)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id);
}

const entries = await maybe('scheme/entries.json', { questions: [], arcs: [] });
const questions = (entries.questions || []).map(q => ({ ...q, patterns: q.patterns.filter(p => count.get(p)) })).filter(q => q.patterns.length);
const arcs = (entries.arcs || []).map(a => ({ ...a, steps: a.steps.filter(s => byId.has(s.work)) })).filter(a => a.steps.length > 1);
const mentions = [...mentionCount].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).slice(0, 60).map(([name]) => name);
// Questions and plain words a visitor might type to find each work (written ahead of time by agents).
if (existsSync(path.join(src, 'annotations-search'))) {
  const publicId = id => 'w' + createHash('sha256').update(id).digest('hex').slice(0, 10);      // as in the publishing step below
  const byPublicId = new Map(works.map(w => [publicId(w.id), w]));
  for (const f of (await readdir(path.join(src, 'annotations-search'))).filter(f => /^(phrases|published)-.*\.json$/.test(f)).sort()) {
    const fromEdited = f.startsWith('published-');
    for (const row of await json(`annotations-search/${f}`)) {
      const w = fromEdited ? byPublicId.get(row.id) : byId.get(row.id);
      // Phrases written before an edit could repeat what the edit removed, so an edited work only takes phrases written from its edited text.
      if (w && (fromEdited ? !review && w.edited : review || !w.edited)) { w.asks = row.asks || []; w.words = row.words || []; }
    }
  }
}
const map = layout({ works, patterns: patterns.filter(p => count.get(p.id)), areas: areas.filter(a => patterns.some(p => p.area === a.id && count.get(p.id))) });
const data = {
  map,
  built: new Date().toISOString().slice(0, 10), dropped,
  areas: areas.filter(a => patterns.some(p => p.area === a.id && count.get(p.id))),
  patterns: patterns.filter(p => count.get(p.id)).map(p => ({ ...p, related: (p.related || []).filter(r => count.get(r.id)), lead: (p.lead || []).filter(id => byId.has(id)) })),
  facets: scheme.facets, mentions, questions, arcs,
  works: works.map(({ text, ...w }) => ({ ...w, search: (w.title + ' ' + w.gloss + ' ' + w.mentions.join(' ') + ' ' + text).toLowerCase().replace(/\s+/g, ' ').slice(0, 4000) })),
};
let serialized = JSON.stringify(data);
if (!review) {
  // Ids are made from titles and call names, so the published ones are replaced by a hash.
  const ids = [...items, ...quotes].map(x => x.id).sort((x, y) => y.length - x.length);
  const hashed = id => 'w' + createHash('sha256').update(id).digest('hex').slice(0, 10);
  for (const id of ids) serialized = serialized.split(JSON.stringify(id)).join(JSON.stringify(hashed(id)));
  // Nothing is written if a private name, email address, invite link or file path is left.
  const people = await privatePeople(src);
  const found = [];
  const published = JSON.parse(serialized).works;   // as written, with hashed ids
  for (const [n, w] of data.works.entries()) for (const p of problems(published[n], { ...share.get(w.id), names: [...(share.get(w.id)?.names || []), ...(excerptNames.get(w.id) || [])] }, people, [...blocked].filter(b => !linked.has(b)))) found.push(`${w.id} (${w.title}): ${p}`);
  const { works: _, map: __, ...rest } = data;
  for (const p of problems(rest, null, people)) found.push(`patterns, questions or arcs: ${p}`);
  const leftover = ids.filter(id => /[a-z]{3}/.test(id) && serialized.includes(id));
  for (const id of leftover) found.push(`id still readable: ${id}`);
  if (found.length) { console.error(found.join('\n') + `\n${found.length} problems. data.js not written.`); process.exit(1); }
}
serialized = await permalinks({ serialized, internalIds: data.works.map(w => w.id), items, quotes, reassign: final?.reassign, src, record: !review && process.argv.includes('--release') });
await writeFile(path.join(here, 'data.js'), 'window.DATA = ' + serialized + ';\n');
const kinds = {};
for (const w of works) kinds[w.kind] = (kinds[w.kind] || 0) + 1;
console.log(`${works.length} works`, kinds, `· ${data.patterns.length} patterns · ${areas.length} areas · ${dropped} left out · ${[...annotations.keys()].length} annotated`);
