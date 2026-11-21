// Personal wiki prototype: a map of every work, and a reader that slides over it.
// Routes live in the hash so every pattern and work has its own link.
const D = window.DATA;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const enc = encodeURIComponent;

const KINDS = {
  post: ['Slack post', 'Slack posts'], doc: ['doc', 'docs'], tool: ['repo', 'repos'],
  site: ['site', 'sites'], said: ['call excerpt', 'call excerpts'], other: ['other link', 'other links'],
};
const SUB = {
  slack: 'Slack post', doc: 'Google Doc', sheet: 'Google Sheet', repo: 'Repository', gist: 'Gist', site: 'Live site', file: 'Link',
  coaching: 'Coaching call', advice: 'Advice call', peer: 'Peer call', scoping: 'Scoping call', intro: 'Intro call', collab: 'Working call',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = d => `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
const month = d => `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
const when = w => w.kind === 'said' ? month(w.date) : day(w.date);      // a call's exact day can point to the other person
const plural = (n, kind) => `${n} ${KINDS[kind][n === 1 ? 0 : 1]}`;

// ---- State
let publicOnly = false;
let works, W, P, A, patternWorks, lensCache;
let ctxKey = null;                  // the list the reader is stepping through
const ctxStore = new Map();
const trail = [];

function index() {
  works = D.works.filter(w => !publicOnly || w.share === 'ok');
  W = new Map(works.map(w => [w.id, w]));
  P = new Map(D.patterns.map(p => [p.id, p]));
  A = new Map(D.areas.map(a => [a.id, a]));
  patternWorks = new Map(D.patterns.map(p => [p.id, []]));
  for (const w of works) for (const [p, s] of w.patterns) patternWorks.get(p)?.push([w, s]);
  lensCache = {};
}
const pWorks = id => patternWorks.get(id) || [];

// ---- Other ways to slice the collection: each is a set of named lists of works.
const LENSES = [
  { id: 'kind', label: 'By kind', rows() {
    return Object.keys(KINDS).map(k => ({ key: k, label: KINDS[k][1].replace(/^./, c => c.toUpperCase()), items: works.filter(w => w.kind === k) })).filter(r => r.items.length);
  } },
  { id: 'time', label: 'By month', rows() {
    const months = new Map();
    for (const w of works) (months.get(w.date.slice(0, 7)) || months.set(w.date.slice(0, 7), []).get(w.date.slice(0, 7))).push(w);
    return [...months].sort((a, b) => b[0].localeCompare(a[0])).map(([m, items]) => ({ key: m, label: month(m + '-01'), items }));
  } },
  { id: 'source', label: 'By where it lives', rows() {
    const names = { doc: 'Google Docs', sheet: 'Google Sheets', repo: 'Repositories', gist: 'Gists', site: 'Live sites', file: 'Links' };
    const rowOf = w => w.kind === 'post' ? channel(w).replace(/^a p/, 'A p') : names[w.sub] || (SUB[w.sub] || w.sub) + 's';
    const rows = new Map();
    for (const w of works) (rows.get(rowOf(w)) || rows.set(rowOf(w), []).get(rowOf(w))).push(w);
    return [...rows].sort((a, b) => b[1].length - a[1].length).map(([label, items]) => ({ key: label, label, items }));
  } },
  ...D.facets.map(f => ({ id: f.id, label: f.question || f.label, rows() {
    return f.values.map(v => ({ key: v.id, label: v.label, note: v.definition, items: works.filter(w => w.facets[f.id] === v.id) })).filter(r => r.items.length);
  } })),
  ...(D.mentions.length ? [{ id: 'names', label: 'By the tools and organisations named', rows() {
    return D.mentions.map(m => ({ key: m, label: m, items: works.filter(w => w.mentions.includes(m)) })).filter(r => r.items.length >= 3);
  } }] : []),
];
const lens = id => LENSES.find(l => l.id === id);
const rowsOf = id => lensCache[id] || (lensCache[id] = lens(id)?.rows() || []);

// ---- Search. Every work is scored by how well the visitor's words match its title, the questions
//      it answers, its topics and its text; rarer words count for more. Nothing leaves the browser.
const STOP = new Set('a an and are as at be been by can do does did for from has have he him his how i if in is it its me my of on or our should so some that the their them there they this to was we were what when where which who why will with would you your about alejo acelas'.split(' '));
const stem = t => t.length > 3 ? t.replace(/(ies|ing|ers|ed|es|er|s)$/, '').replace(/e$/, '') : t;
const terms = text => (String(text).toLowerCase().match(/[a-z0-9]+/g) || []).filter(t => !STOP.has(t)).map(stem);
let engine = null;
function buildEngine() {
  const docs = [], seen = new Map();
  const add = (kind, item, fields) => {
    const tf = new Map();
    for (const [text, weight] of fields) for (const t of terms(text)) tf.set(t, Math.min(6, (tf.get(t) || 0) + weight));
    for (const t of tf.keys()) seen.set(t, (seen.get(t) || 0) + 1);
    docs.push({ kind, item, tf });
  };
  for (const w of works) add('work', w, [[w.title, 3], [(w.asks || []).join(' '), 2.5], [(w.words || []).join(' '), 2.5], [w.mentions.join(' '), 2], [w.patterns.map(p => P.get(p[0])?.label || '').join(' '), 1.5], [w.gloss, 1.5], [w.pull, 1], [w.search, .5]]);
  for (const p of D.patterns) if (pWorks(p.id).length) add('topic', p, [[p.label, 3], [p.summary, 1.2]]);
  const idf = new Map([...seen].map(([t, n]) => [t, Math.log(1 + docs.length / n)]));
  engine = { docs, idf, vocab: [...seen.keys()] };
}
function search(text) {
  if (!engine) buildEngine();
  const q = terms(text); if (!q.length) return { works: [], topics: [] };
  // While someone is still typing, the last word also matches words that start with it.
  const open = /[a-z0-9]$/i.test(text) ? q.at(-1) : null;
  const starts = open && open.length >= 2 ? engine.vocab.filter(t => t !== open && t.startsWith(open)).slice(0, 40) : [];
  const out = { works: [], topics: [] };
  for (const d of engine.docs) {
    let score = 0, hit = 0;
    for (const t of q) {
      let f = d.tf.get(t) || 0, weight = engine.idf.get(t) || 0;
      if (!f && t === open) for (const s of starts) if (d.tf.has(s)) { f = d.tf.get(s) * .7; weight = engine.idf.get(s); break; }
      if (f) { hit++; score += weight * f / (f + 1.2); }
    }
    if (!hit) continue;
    score *= (hit / q.length) ** 1.6;                        // matching most of the question beats matching one word well
    (d.kind === 'work' ? out.works : out.topics).push({ score, [d.kind === 'work' ? 'w' : 'p']: d.item });
  }
  out.works.sort((a, b) => b.score - a.score); out.topics.sort((a, b) => b.score - a.score);
  const best = out.works[0]?.score || 0;
  out.works = out.works.filter(x => x.score > best * .22);
  out.topics = out.topics.filter(x => x.score > (out.topics[0]?.score || 0) * .45).map(x => x.p);
  return out;
}

// ---- Small pieces
const channel = w => w.slack.channel === 'private-channel' ? 'a private channel' : '#' + w.slack.channel;
const glyph = (kind, cls = '') => `<span class="glyph k-${kind} ${cls}" aria-hidden="true"></span>`;
const pLink = id => P.has(id) ? `<a class="plink" href="#/p/${id}" data-p="${id}">${esc(P.get(id).label)}</a>` : '';
const srcLine = w => w.kind === 'post' ? esc(channel(w)) : esc(SUB[w.sub] || w.sub);
function setCtx(key, label, href, ids) { ctxStore.set(key, { label, href, ids }); return key; }

function row(w, relation) {
  return `<a class="row-card" href="#/w/${w.id}" data-w="${w.id}">${glyph(w.kind)}<span class="rc-main"><span class="rc-title">${esc(w.title)}</span>${relation ? `<span class="rc-rel">${esc(relation)}</span>` : ''}<span class="rc-gloss">${esc(w.gloss)}</span></span><span class="rc-date">${srcLine(w)} · ${when(w)}</span></a>`;
}
function card(w) {
  const quote = w.pull && w.kind !== 'tool' ? `<p class="c-pull">${esc(w.pull)}</p>` : `<p class="c-gloss">${esc(w.gloss)}</p>`;
  const foot = w.kind === 'post' && w.slack.replies ? `<span class="c-foot">${w.slack.replies} ${w.slack.replies === 1 ? 'reply' : 'replies'}</span>` : '';
  return `<a class="card c-${w.kind}" href="#/w/${w.id}" data-w="${w.id}"><span class="c-src">${glyph(w.kind)}${srcLine(w)} · ${when(w)}</span><span class="c-title">${esc(w.title)}</span>${quote}${foot}</a>`;
}
const workList = (items, key) => `<div class="rows" data-ctx="${esc(key)}">${items.map(w => row(w)).join('')}</div>`;
function spark(list) {
  const all = works.map(w => w.date.slice(0, 7)).sort();
  if (!all.length) return '';
  const months = [];
  for (let [y, m] = all[0].split('-').map(Number); `${y}-${String(m).padStart(2, '0')}` <= all.at(-1); m === 12 ? (y++, m = 1) : m++) months.push(`${y}-${String(m).padStart(2, '0')}`);
  const n = new Map();
  for (const w of list) n.set(w.date.slice(0, 7), (n.get(w.date.slice(0, 7)) || 0) + 1);
  const max = Math.max(1, ...n.values());
  return `<div class="spark" title="Works per month">${months.map(m => `<i style="height:${n.get(m) ? 4 + Math.round(22 * n.get(m) / max) : 1}px" title="${month(m + '-01')}: ${n.get(m) || 0}"></i>`).join('')}<span>${month(months[0] + '-01')}</span><span>${month(months.at(-1) + '-01')}</span></div>`;
}
const kindCounts = list => Object.keys(KINDS).map(k => [k, list.filter(w => w.kind === k).length]).filter(x => x[1]);
const kindSummary = list => `<p class="kinds">${kindCounts(list).map(([k, n]) => `<span>${glyph(k)}${plural(n, k)}</span>`).join('')}</p>`;

// ---- The title block on the map
const readerEl = $('#reader'), pop = $('#pop'), plate = $('#plate');
function renderPlate() {
  plate.innerHTML = `<h1><a href="#/">Alejo Acelas</a></h1>
    <div class="plate-body">
      <p class="lede">I help high-impact orgs use AI</p>
      <p class="how">Click, hover, and zoom to see some of the work I've done</p>
      <p class="doors"><a href="#/topics">List by topic</a><a href="#/sources">List by source</a><button class="ask-button" id="ask">Ask a question<kbd>/</kbd></button></p>
    </div>`;
}

// ---- Hover previews
let popTimer;
// A work's preview is its card arriving early: the same parts in the same order as the card on the map.
function popHtml(el) {
  const w = W.get(el.w); if (!w) return '';
  pop.style.setProperty('--tint', MapView.tintOf?.(w.id) || 'transparent');
  return `<span class="pop-src">${glyph(w.kind)}${srcLine(w)}<span class="pop-date">${when(w)}</span></span><b>${esc(w.title)}</b><span class="pop-gloss">${esc(w.kind === 'said' && w.pull ? '“' + w.pull + '”' : w.gloss)}</span>`;
}
function showPop(html, x, y, below) {
  if (!html) return hidePop();
  pop.innerHTML = html; pop.hidden = false;
  const pr = pop.getBoundingClientRect();
  const left = Math.min(Math.max(8, x - pr.width / 2), innerWidth - pr.width - 8);
  let top = below ? y + 12 : y - pr.height - 16; if (top < 8) top = y + 20; if (top + pr.height > innerHeight - 8) top = y - pr.height - 16;
  pop.style.transform = `translate(${Math.round(left)}px,${Math.round(top)}px)`;
}
function hidePop() { clearTimeout(popTimer); pop.hidden = true; }
document.addEventListener('mouseover', e => {
  const many = e.target.closest?.('[data-ps]');
  if (many) { MapView.focusPatterns(many.dataset.ps.split(' ')); return; }
  const el = e.target.closest?.('a[data-w],a[data-p]');
  if (!el || el.closest('#pop')) return;
  if (el.dataset.p) MapView.focusPatterns([el.dataset.p]);
  clearTimeout(popTimer);
  if (el.dataset.p || el.classList.contains('card') || el.classList.contains('row-card')) return;   // topics light up on the map instead; cards already show their gloss
  popTimer = setTimeout(() => { const r = el.getBoundingClientRect(); showPop(popHtml({ w: el.dataset.w, p: el.dataset.p }), r.left + r.width / 2, r.bottom, true); }, 280);
});
document.addEventListener('mouseout', e => {
  const el = e.target.closest?.('a[data-w],a[data-p],[data-ps]');
  if (!el || el.contains(e.relatedTarget)) return;
  hidePop(); MapView.focusPatterns(null);
});

// ---- Reader pages
function head(kicker, title, body = '') { return `<header class="page-head"><p class="kicker">${kicker}</p><h1>${title}</h1>${body}</header>`; }
const none = { works: [] };

function patternBlocks(ps) {
  return ps.map(p => {
    const list = pWorks(p.id).map(i => i[0]).sort((x, y) => y.date.localeCompare(x.date));
    const lead = ((p.lead || []).map(i => W.get(i)).filter(Boolean)).slice(0, 3);
    const key = setCtx(`pattern/${p.id}`, p.label, `#/p/${p.id}`, list.map(w => w.id));
    return `<section class="area-pattern"><h2>${pLink(p.id)} <span class="n">${list.length}</span></h2><p class="summary small">${esc(p.summary)}</p>${workList(lead.length ? lead : list.slice(0, 3), key)}</section>`;
  }).join('');
}

function patternPage(id) {
  const p = P.get(id); if (!p) return missing();
  const items = pWorks(id), list = items.map(i => i[0]).sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) return missing();
  const key = setCtx(`pattern/${id}`, p.label, `#/p/${id}`, list.map(w => w.id));
  const lead = (p.lead || []).map(i => W.get(i)).filter(Boolean);
  const leadSet = lead.length ? lead : items.filter(i => i[1] === 2).map(i => i[0]).slice(0, 4);
  const shared = o => pWorks(o).filter(i => i[0].patterns.some(x => x[0] === id)).length;
  const related = (p.related || []).filter(r => P.has(r.id) && pWorks(r.id).length);
  const dates = list.map(w => w.date).sort();
  return { title: p.label, select: { works: list.map(w => w.id), pattern: id, related: related.map(r => r.id) },
    html: head(`<a href="#/a/${p.area}">${esc(A.get(p.area)?.label || '')}</a> · Topic · ${list.length} works · ${month(dates[0])} to ${month(dates.at(-1))}`, esc(p.label), `<p class="summary">${esc(p.summary)}</p>${spark(list)}${kindSummary(list)}`) +
    `<section><h2>Start here</h2><div class="cards" data-ctx="${esc(key)}">${leadSet.map(card).join('')}</div></section>` +
    (related.length ? `<section><h2>Leads to</h2><ul class="related">${related.map(r => `<li>${pLink(r.id)}<span class="why">${esc(r.why)}</span><span class="n">${shared(r.id)} shared</span></li>`).join('')}</ul></section>` : '') +
    `<section><h2>All ${list.length}, newest first</h2>${workList(list, key)}</section>` };
}

function areaPage(id) {
  const a = A.get(id); if (!a) return missing();
  const ps = D.patterns.filter(p => p.area === id && pWorks(p.id).length);
  const all = [...new Set(ps.flatMap(p => pWorks(p.id).map(i => i[0])))];
  return { title: a.label, select: { works: all.map(w => w.id), related: ps.map(p => p.id) },
    html: head(`Area · ${ps.length} topics · ${all.length} works`, esc(a.label), `<p class="summary">${esc(a.blurb)}</p>${spark(all)}${kindSummary(all)}`) + patternBlocks(ps) };
}

function questionsPage() {
  return { title: 'Start from a question', select: none, html: head('Questions people arrive with', 'Start from a question', '<p class="summary">Each one leads to the topics that answer it. Point at a question to see where its answers sit on the map.</p>') +
    `<ul class="ask">${D.questions.map(q => `<li><a href="#/ask/${q.id}" data-ps="${q.patterns.join(' ')}">${esc(q.question)}</a></li>`).join('')}</ul>` };
}
function questionPage(id) {
  const q = (D.questions || []).find(q => q.id === id); if (!q) return missing();
  const ps = q.patterns.map(p => P.get(p)).filter(p => p && pWorks(p.id).length);
  const all = [...new Set(ps.flatMap(p => pWorks(p.id).map(i => i[0].id)))];
  return { title: q.question, select: { works: all, related: ps.map(p => p.id) },
    html: head(`<a href="#/ask">Questions</a> · ${ps.length} topics answer this one`, esc(q.question), q.answer ? `<p class="summary">${esc(q.answer)}</p>` : '') + patternBlocks(ps) };
}

function arcPage(id) {
  const a = (D.arcs || []).find(a => a.id === id); if (!a) return missing();
  const steps = a.steps.map(s => [W.get(s.work), s.note]).filter(s => s[0]);
  if (!steps.length) return missing();
  const key = setCtx(`arc/${id}`, a.label, `#/arc/${id}`, steps.map(s => s[0].id));
  return { title: a.label, select: { works: steps.map(s => s[0].id) },
    html: head(`Arc · ${steps.length} steps · ${month(steps[0][0].date)} to ${month(steps.at(-1)[0].date)}`, esc(a.label), `<p class="summary">${esc(a.blurb)}</p>`) +
    `<ol class="arc" data-ctx="${esc(key)}">${steps.map(([w, note]) => `<li><p class="arc-note"><time>${when(w)}</time>${esc(note)}</p>${row(w)}</li>`).join('')}</ol>` };
}

function topicsPage() {
  const shown = D.patterns.filter(p => pWorks(p.id).length);
  return { title: 'List by topic', select: none, html: head(`${shown.length} topics · ${works.length} works`, 'List by topic') +
    D.areas.map(a => {
      const ps = shown.filter(p => p.area === a.id);
      return ps.length ? `<section class="index-area"><h2><a href="#/a/${a.id}">${esc(a.label)}</a></h2><p class="summary small">${esc(a.blurb)}</p><ul class="related">${ps.map(p => `<li>${pLink(p.id)}<span class="n">${pWorks(p.id).length}</span></li>`).join('')}</ul></section>` : '';
    }).join('') + `<p class="more-lists"><a href="#/index">Other lists: by month, by who it was for, how one thing led to the next</a></p>` };
}
function sourcesPage() {
  return { title: 'List by source', select: none, html: head(`${works.length} works`, 'List by source') +
    kindCounts(works).map(([k, n]) => {
      const list = works.filter(w => w.kind === k).sort((a, b) => b.date.localeCompare(a.date));
      const key = setCtx(`kind/${k}`, KINDS[k][1], `#/c/kind/${k}`, list.map(w => w.id));
      return `<section class="index-area"><h2><a href="#/c/kind/${k}">${glyph(k)}${esc(KINDS[k][1].replace(/^./, c => c.toUpperCase()))}</a> <span class="n">${n}</span></h2>${workList(list.slice(0, 6), key)}${n > 6 ? `<p class="more-lists"><a href="#/c/kind/${k}">All ${n} ${esc(KINDS[k][1])}</a></p>` : ''}</section>`;
    }).join('') };
}

function indexPage() {
  return { title: 'Everything as a list', select: none, html: head(`${works.length} works · ${D.patterns.length} topics · ${D.areas.length} areas`, 'Everything as a list') +
    D.areas.map(a => {
      const ps = D.patterns.filter(p => p.area === a.id && pWorks(p.id).length);
      return ps.length ? `<section class="index-area"><h2><a href="#/a/${a.id}">${esc(a.label)}</a></h2><p class="summary small">${esc(a.blurb)}</p><ul class="related">${ps.map(p => `<li>${pLink(p.id)}<span class="n">${pWorks(p.id).length}</span></li>`).join('')}</ul></section>` : '';
    }).join('') +
    (D.arcs?.length ? `<section><h2>How one thing led to the next</h2><ul class="related">${D.arcs.map(a => `<li><a class="plink" href="#/arc/${a.id}">${esc(a.label)}</a><span class="why">${esc(a.blurb)}</span><span class="n">${a.steps.length} steps</span></li>`).join('')}</ul></section>` : '') +
    LENSES.map(l => `<section><h2>${esc(l.label)}</h2><p class="tags">${rowsOf(l.id).map(r => `<a href="#/c/${l.id}/${enc(r.key)}">${esc(r.label)} <span>${r.items.length}</span></a>`).join('')}</p></section>`).join('') +
    `<p class="review">${D.works.some(w => w.share !== 'ok') ? `<label><input type="checkbox" id="public" ${publicOnly ? 'checked' : ''}> Show only works marked safe to publish (${D.works.filter(w => w.share === 'ok').length} of ${D.works.length})</label><br>` : ''}Prototype built ${day(D.built)} from a sample. Names, summaries and groupings were drafted by agents and wait for review.</p>` };
}

function collectionPage(lensName, key) {
  const r = rowsOf(lensName).find(r => r.key === key); if (!r) return missing();
  const list = [...r.items].sort((a, b) => b.date.localeCompare(a.date));
  const k = setCtx(`${lensName}/${key}`, r.label, `#/c/${lensName}/${enc(key)}`, list.map(w => w.id));
  const top = new Map();
  for (const w of list) for (const [p] of w.patterns) top.set(p, (top.get(p) || 0) + 1);
  const tops = [...top].sort((a, b) => b[1] - a[1]).slice(0, 6);
  return { title: r.label, select: { works: list.map(w => w.id) },
    html: head(`<a href="#/index">${esc(lens(lensName).label)}</a> · ${list.length} works`, esc(r.label), `${r.note ? `<p class="summary">${esc(r.note)}</p>` : ''}${spark(list)}${kindSummary(list)}`) +
    (tops.length ? `<section><h2>Mostly about</h2><ul class="related">${tops.map(([p, n]) => `<li>${pLink(p)}<span class="n">${n} here</span></li>`).join('')}</ul></section>` : '') +
    `<section><h2>All ${list.length}, newest first</h2>${workList(list, k)}</section>` };
}

function searchPage(q) {
  const found = search(q), list = found.works.map(x => x.w);
  const k = setCtx('search', `“${q}”`, `#/q/${enc(q)}`, list.map(w => w.id));
  return { title: q, select: { works: list.length > 1 ? list.slice(0, 60).map(w => w.id) : [] },
    html: head(`You asked · ${list.length} ${list.length === 1 ? 'entry' : 'entries'}`, esc(q)) +
    (found.topics.length ? `<section><h2>Topics</h2><ul class="related">${found.topics.slice(0, 6).map(p => `<li>${pLink(p.id)}<span class="n">${pWorks(p.id).length} works</span></li>`).join('')}</ul></section>` : '') +
    `<section><h2>Entries, closest first</h2>${list.length ? workList(list.slice(0, 150), k) : '<p class="summary small">Nothing matches. Try other words, or one word.</p>'}</section>` };
}

// The source, drawn to look like where it lives.
function viewer(w) {
  if (w.kind === 'post') {
    const s = w.slack;
    return `<figure class="v-slack">
      <figcaption><b>${s.channel === 'private-channel' ? 'A private channel' : '# ' + esc(s.channel)}</b><span>AI Uplift for EA Slack</span></figcaption>
      ${s.replyingTo ? `<p class="v-context">Replying in a thread. ${esc(s.replyingTo)}</p>` : ''}
      ${s.messages.map((m, n) => `<div class="msg${n && s.startsThread ? ' follow' : ''}"><span class="avatar" aria-hidden="true">AA</span><div><p class="who"><b>Alejandro Acelas</b> <time>${day(m.time.slice(0, 10))}, ${m.time.slice(11)}</time></p><div class="text">${m.html}</div>${m.files.length ? `<p class="files">${m.files.map(f => `<span>${esc(f)} attached</span>`).join('')}</p>` : ''}${m.reactions.length ? `<p class="reactions">${m.reactions.map(([e, n]) => `<span>${e} ${n}</span>`).join('')}</p>` : ''}</div></div>`).join('')}
      <p class="v-foot">${s.replies && s.startsThread ? `<span class="replies">${s.replies} ${s.replies === 1 ? 'reply' : 'replies'}${s.others ? ` from ${s.others} ${s.others === 1 ? 'person' : 'people'}` : ''}</span>` : '<span></span>'}<a href="${esc(w.url)}" target="_blank" rel="noopener">Open in Slack ↗</a></p>
    </figure>`;
  }
  if (w.kind === 'doc') {
    const d = w.doc || {};
    const isSheet = w.sub === 'sheet';
    return `<figure class="v-doc${isSheet ? ' sheet' : ''}">
      <figcaption><span class="doc-icon" aria-hidden="true"></span><b>${esc(w.title)}</b>
        ${d.gdoc && d.html ? `<span class="seg"><button data-docview="copy" aria-pressed="true">Copy</button><button data-docview="live" aria-pressed="false" data-gdoc="${esc(d.gdoc)}">Live</button></span>` : ''}
        ${w.url ? `<a href="${esc(w.url)}" target="_blank" rel="noopener">${/docs\.google\.com/.test(w.url) ? `Open in Google ${isSheet ? 'Sheets' : 'Docs'}` : `Open at ${esc(new URL(w.url).hostname.replace(/^www\./, ''))}`} ↗</a>` : ''}</figcaption>
      ${d.html ? `<div class="page-wrap clamp"><div class="page">${d.html}${d.cut ? '<p class="cut">The copy stops here. The rest is in the live doc.</p>' : ''}</div><button class="more" data-more>Show the whole document</button></div>` : `<div class="page-wrap"><div class="page stub"><p>${esc(w.gloss || 'No copy of this one is kept here.')}</p></div></div>`}
    </figure>`;
  }
  if (w.kind === 'tool') {
    const t = w.tool || {};
    if (t.unavailable) return `<figure class="v-tool"><figcaption><b>${esc(t.repo || w.title)}</b><span class="pill">${t.private ? 'Private' : 'Moved or removed'}</span></figcaption><div class="readme stub"><p>${esc(w.gloss)}</p></div></figure>`;
    if (t.gist) return `<figure class="v-tool"><figcaption><b>${esc(t.description || w.title)}</b><span class="pill">Gist</span><a href="${esc(w.url)}" target="_blank" rel="noopener">Open on GitHub ↗</a></figcaption>${t.files.map(f => `<div class="readme-wrap clamp"><p class="file">${esc(f.name)}</p><div class="readme">${f.html}</div><button class="more" data-more>Show the whole file</button></div>`).join('')}</figure>`;
    const [owner, name] = (t.repo || '/').split('/');
    return `<figure class="v-tool"><figcaption><span class="repo">${esc(owner)} / <b>${esc(name)}</b></span><span class="pill">Public</span><a href="https://github.com/${esc(t.repo)}" target="_blank" rel="noopener">Open on GitHub ↗</a></figcaption>
      <p class="about">${esc(t.description || w.gloss)}</p><p class="repo-meta">${t.language ? `<span><i class="lang"></i>${esc(t.language)}</span>` : ''}${t.stars ? `<span>★ ${t.stars}</span>` : ''}${t.pushed ? `<span>Updated ${day(t.pushed)}</span>` : ''}${t.homepage ? `<a href="${esc(t.homepage)}" target="_blank" rel="noopener">${esc(t.homepage.replace(/^https?:\/\//, ''))}</a>` : ''}</p>
      ${t.readme ? `<div class="readme-wrap clamp"><p class="file">README.md</p><div class="readme">${t.readme}</div><button class="more" data-more>Show the whole README</button></div>` : ''}</figure>`;
  }
  if (w.kind === 'site') {
    return `<figure class="v-site"><figcaption><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="url">${esc(w.url.replace(/^https?:\/\//, ''))}</span><a href="${esc(w.url)}" target="_blank" rel="noopener">Open ↗</a></figcaption><iframe src="${esc(w.url)}" loading="lazy" title="${esc(w.title)}" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms"></iframe></figure>`;
  }
  if (w.kind === 'said') {
    const ex = w.said.excerpt, start = w.said.text.slice(0, 48);
    const parts = w.said.text.split('…').map(t => t.trim()).filter(t => t.length > 12);      // a quote with cuts is found piece by piece
    const mine = text => { let html = esc(text), hit = false; for (const part of parts) if (html.includes(esc(part))) { html = html.replace(esc(part), `<mark>${esc(part)}</mark>`); hit = true; } return hit ? html : text.includes(start) ? `<mark>${esc(text)}</mark>` : esc(text); };
    const wave = `<span class="wave" aria-hidden="true">${Array.from({ length: 34 }, (_, i) => `<i style="height:${4 + Math.round(13 * Math.abs(Math.sin(i * 1.7 + w.id.length)))}px"></i>`).join('')}</span>`;
    // With the conversation around it, the quote is shown in place, highlighted. Alone, it stands as a quote.
    if (ex) return `<figure class="v-said in-call">${wave}<div class="excerpt">${ex.turns.map(t => t.me ? `<p class="t-me"><b>Alejo</b>${mine(t.me)}</p>` : `<p class="t-other"><b>${esc(ex.other)}</b>${esc(t.other)}</p>`).join('')}</div><figcaption>${esc(w.said.setting)} · ${when(w)}<span>My words are as I said them, with cuts marked. What the other person said is summarised and never quoted.</span></figcaption></figure>`;
    return `<figure class="v-said">${wave}<blockquote>${esc(w.said.text)}</blockquote><figcaption>${esc(w.said.setting)} · ${when(w)}</figcaption></figure>`;
  }
  return `<figure class="v-link"><p>${esc(w.gloss)}</p>${w.url ? `<a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(w.url.replace(/^https?:\/\//, '').slice(0, 70))} ↗</a>` : ''}</figure>`;
}

function arcsOf(id) {
  const on = (D.arcs || []).filter(a => a.steps.some(s => s.work === id));
  if (!on.length) return '';
  return `<section><h2>One step in</h2><ul class="related">${on.map(a => {
    const at = a.steps.findIndex(s => s.work === id);
    return `<li><a class="plink" href="#/arc/${a.id}">${esc(a.label)}</a><span class="why">Step ${at + 1} of ${a.steps.length}. ${esc(a.steps[at].note || '')}</span></li>`;
  }).join('')}</ul></section>`;
}

function workPage(id) {
  const w = W.get(id); if (!w) return missing();
  const ctx = ctxStore.get(ctxKey);
  const at = ctx ? ctx.ids.indexOf(id) : -1;
  const step = at >= 0 && ctx.ids.length > 1 ? `<nav class="step" aria-label="Step through ${esc(ctx.label)}"><a class="arrow" ${at > 0 ? `href="#/w/${ctx.ids[at - 1]}"` : 'aria-disabled="true"'} data-step="-1" title="Previous (←)">←</a><span>${at + 1} of ${ctx.ids.length} in <a href="${ctx.href}">${esc(ctx.label)}</a></span><a class="arrow" ${at < ctx.ids.length - 1 ? `href="#/w/${ctx.ids[at + 1]}"` : 'aria-disabled="true"'} data-step="1" title="Next (→)">→</a></nav>` : '';
  const links = w.links.map(l => [W.get(l.to), l]).filter(x => x[0]);
  const near = w.near.map(i => W.get(i)).filter(Boolean);
  const names = w.mentions.filter(m => D.mentions.includes(m));
  const k1 = setCtx(`links/${id}`, `linked from “${w.title}”`, `#/w/${id}`, links.map(x => x[0].id));
  const k2 = setCtx(`near/${id}`, `near “${w.title}”`, `#/w/${id}`, near.map(x => x.id));
  return { title: w.title, select: { works: [id], related: w.patterns.map(p => p[0]) },
    html: `<header class="page-head work-head"><p class="kicker">${glyph(w.kind)}${esc(SUB[w.sub] || w.sub)} · ${when(w)}${step}</p><h1>${esc(w.title)}</h1>${w.gloss ? `<p class="summary">${esc(w.gloss)}</p>` : ''}</header>` +
    viewer(w) +
    (w.edited ? '<p class="edited">Edited to remove other people’s details.</p>' : '') +
    (w.patterns.length ? `<section><h2>Part of</h2><ul class="related partof">${w.patterns.map(([p, s]) => `<li class="s${s}">${pLink(p)}<span class="n">${pWorks(p).length} works</span></li>`).join('')}</ul></section>` : '') +
    (links.length ? `<section><h2>Linked</h2><div class="rows" data-ctx="${esc(k1)}">${links.map(([o, l]) => row(o, l.label)).join('')}</div></section>` : '') +
    (near.length ? `<section><h2>Nearby</h2>${workList(near, k2)}</section>` : '') +
    arcsOf(id) +
    (names.length ? `<section><h2>Names</h2><p class="tags">${names.map(m => `<a href="#/c/names/${enc(m)}">${esc(m)}</a>`).join('')}</p></section>` : '') +
    (w.share !== 'ok' ? `<p class="review">Review note, not part of the site: an agent marked this “check” before publishing${w.shareReason ? ` (${esc(w.shareReason)})` : ''}.</p>` : '') };
}
const missing = () => ({ title: 'Not found', select: none, html: head('', 'Nothing here', '<p class="summary">That link points at something this sample does not have.</p>') });

// ---- Routing
function route() {
  const [, kind, a, b] = decodeURI(location.hash.replace(/^#/, '')).split('/');
  hidePop(); MapView.focusPatterns(null);
  const moved = D.redirects?.[`${kind}/${a}`];
  if (moved) { history.replaceState(null, '', '#/' + moved); return route(); }
  let page = null;
  if (D.gone?.[`${kind}/${a}`]) page = { title: 'Taken down', select: none, html: head('', 'This was here and has been taken down', '<p class="summary">The link is right, but the work it pointed to is no longer on the site. <a href="#/index">Everything that is here, as a list.</a></p>') };
  else
  if (kind === 'p') page = patternPage(a);
  else if (kind === 'a') page = areaPage(a);
  else if (kind === 'w') page = workPage(a);
  else if (kind === 'ask') page = a ? questionPage(a) : questionsPage();
  else if (kind === 'arc') page = arcPage(a);
  else if (kind === 'index') page = indexPage();
  else if (kind === 'topics') page = topicsPage();
  else if (kind === 'sources') page = sourcesPage();
  else if (kind === 'c') page = collectionPage(a, decodeURIComponent(b || ''));
  else if (kind === 'q') page = searchPage(decodeURIComponent(a || ''));
  if (!page) {
    document.body.classList.remove('reading'); readerEl.hidden = true; document.title = 'Alejo Acelas'; trail.length = 0;
    MapView.setInset(0, plateRoom()); MapView.select({ works: [] });
    return;
  }
  const here = location.hash;
  const seen = trail.findIndex(t => t.href === here);
  if (seen >= 0) trail.length = seen;
  trail.push({ href: here, label: page.title });
  const crumbs = trail.slice(-4, -1).map(t => `<a href="${esc(t.href)}">${esc(t.label)}</a>`).join('<span>›</span>');
  readerEl.innerHTML = `<div class="reader-bar"><nav class="trail" aria-label="Where you have been">${crumbs ? crumbs + '<span>›</span>' : ''}</nav><a class="close" href="#/" title="Back to the map (Esc)">Back to the map ✕</a></div><article class="page-body">${page.html}</article>`;
  readerEl.hidden = false; document.body.classList.add('reading'); readerEl.scrollTop = 0;
  document.title = `${page.title} · Alejo Acelas`;
  MapView.setInset(innerWidth > 860 ? readerEl.offsetWidth : 0);
  MapView.select(page.select);
}
const plateRoom = () => innerWidth > 1100 ? plate.offsetWidth + 30 : 0;
addEventListener('hashchange', route);
addEventListener('resize', () => document.body.classList.contains('reading') ? MapView.setInset(innerWidth > 860 ? readerEl.offsetWidth : 0) : MapView.setInset(0, plateRoom()));

// ---- Events
document.addEventListener('click', e => {
  const t = e.target;
  const link = t.closest('a[data-w]');
  if (link) { const holder = link.closest('[data-ctx]'); ctxKey = holder ? holder.dataset.ctx : null; }
  if (t.closest('[data-more]')) { t.closest('.clamp').classList.remove('clamp'); return; }
  const view = t.closest('[data-docview]');
  if (view) {
    const fig = view.closest('figure'), live = view.dataset.docview === 'live';
    for (const b of $$('[data-docview]', fig)) b.setAttribute('aria-pressed', b === view);
    let frame = $('iframe', fig);
    if (live && !frame) { frame = document.createElement('iframe'); frame.title = 'Live Google Doc'; frame.src = `https://docs.google.com/document/d/${$('[data-docview=live]', fig).dataset.gdoc}/preview`; fig.append(frame); }
    if (frame) frame.hidden = !live;
    $('.page-wrap', fig).hidden = live;
    return;
  }
  if (t.closest('#ask')) { openBar(); return; }
  if (t.closest('.plate h1 a')) { e.preventDefault(); goHome(); return; }
  const zoom = t.closest('[data-zoom]');
  if (zoom) { const z = zoom.dataset.zoom; z === 'fit' ? MapView.home() : MapView.zoomAt(z === 'in' ? 1.7 : 1 / 1.7); }
});
document.addEventListener('change', e => { if (e.target.id === 'public') { publicOnly = e.target.checked; index(); MapView.setWorks(works); renderPlate(); route(); } });
function goHome() { if (location.hash.length > 2) location.hash = '#/'; MapView.home(); }
function wander() { const sorted = works.filter(w => w.patterns.length); const pool = sorted.length ? sorted : works; const w = pool[Math.floor(Math.random() * pool.length)]; if (w) { ctxKey = null; location.hash = `#/w/${w.id}`; } }

document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); bar.open ? closeBar() : openBar(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey || bar.open) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
  const reading = document.body.classList.contains('reading');
  if (e.key === 'Escape') { if (location.hash.length > 2) location.hash = '#/'; else MapView.home(); }      // once closes the reader, again returns to the whole map
  else if (e.key === '/') { e.preventDefault(); openBar(); }
  else if (e.key === 'r') wander();
  else if (e.key === '+' || e.key === '=') MapView.zoomAt(1.6);
  else if (e.key === '-' || e.key === '_') MapView.zoomAt(1 / 1.6);
  else if (e.key === '0') MapView.home();
  else if (e.key.startsWith('Arrow')) {
    const step = $(`.step [data-step="${e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0}"][href]`);
    if (reading && step) { e.preventDefault(); location.hash = step.getAttribute('href'); }
    else if (!reading) { e.preventDefault(); const d = { ArrowLeft: [-160, 0], ArrowRight: [160, 0], ArrowUp: [0, -160], ArrowDown: [0, 160] }[e.key]; MapView.pan(d[0], d[1]); }
  }
});

// ---- The bar: a floating sheet for asking. Empty, it offers questions that fit what the visitor is
//      looking at, and ways to browse; with words in it, it lists the closest entries. The entries it
//      lists light up on the map behind it, and the highlighted one is marked.
const bar = { open: false, rows: [], sel: 0, stack: [] };
const barEl = document.createElement('div');
barEl.className = 'bar-backdrop'; barEl.hidden = true;
barEl.innerHTML = `<div class="bar" role="dialog" aria-label="Ask a question">
  <div class="bar-input"><button class="bar-back" hidden title="Back (Backspace)">←</button><input id="bar-q" type="text" placeholder="Ask a question, or type a few words" autocomplete="off" spellcheck="false" aria-controls="bar-list"><kbd>esc</kbd></div>
  <div class="bar-list" id="bar-list" role="listbox"></div>
  <div class="bar-foot"><span><kbd>↑</kbd><kbd>↓</kbd>move</span><span><kbd>↵</kbd>open</span><span class="bar-all" hidden><kbd>⌘</kbd><kbd>↵</kbd>see all <b></b> in the reader</span></div>
</div>`;
document.body.append(barEl);
const barInput = $('#bar-q', barEl), barList = $('.bar-list', barEl);

const workRow = w => ({ type: 'work', id: w.id, glyph: w.kind, title: w.title, gloss: w.gloss, meta: `${w.kind === 'post' ? channel(w) : SUB[w.sub] || w.sub} · ${when(w)}`, href: `#/w/${w.id}` });
const topicRow = p => ({ type: 'topic', id: p.id, mark: '◌', title: p.label, gloss: p.summary, meta: `${pWorks(p.id).length} works`, href: `#/p/${p.id}` });
const questionRow = q => ({ type: 'question', mark: '?', title: q.question, meta: 'question', q });
const section = (label, rows) => rows.length ? [{ type: 'section', label }, ...rows] : [];
function questionResults(q) {
  const ps = q.patterns.map(id => P.get(id)).filter(p => p && pWorks(p.id).length), seen = new Set(), lead = [];
  for (let n = 0; n < 4; n++) for (const p of ps) { const w = W.get((p.lead || [])[n]); if (w && !seen.has(w.id)) { seen.add(w.id); lead.push(w); } }
  return [...section('Start with', lead.slice(0, 9).map(workRow)), ...section('Topics that answer it', ps.map(topicRow))];
}
// What to offer before anything is typed: it depends on what is open and where the map is.
function suggestions() {
  const [, kind, id] = decodeURI(location.hash.replace(/^#/, '')).split('/'), questions = D.questions || [], out = [];
  if (kind === 'p' && P.has(id)) {
    const p = P.get(id);
    out.push(...section(`About “${p.label}”`, questions.filter(q => q.patterns.includes(id)).slice(0, 3).map(questionRow)));
    out.push(...section('Next to it', (p.related || []).map(r => P.get(r.id)).filter(x => x && pWorks(x.id).length).slice(0, 4).map(topicRow)));
  } else if (kind === 'w' && W.has(id)) {
    const w = W.get(id);
    out.push(...section('Around what you are reading', [...w.patterns.slice(0, 3).map(x => topicRow(P.get(x[0]))), ...w.near.slice(0, 3).map(i => W.get(i)).filter(Boolean).map(workRow)]));
  } else {
    // Zoomed in, the nearest topics are what the visitor is looking at; from the whole map they are not.
    const near = document.body.classList.contains('close-up') ? (MapView.around?.() || []).map(i => P.get(i)).filter(x => x && pWorks(x.id).length).slice(0, 4) : [];
    out.push(...section('Where the map is now', near.map(topicRow)));
  }
  const asked = new Set(out.filter(r => r.q).map(r => r.q.id));
  out.push(...section('People often ask', questions.filter(q => !asked.has(q.id)).slice(0, out.length ? 4 : 6).map(questionRow)));
  out.push(...section('Browse', [
    { type: 'browse', mark: '◌', title: 'All topics', meta: `${D.patterns.filter(p => pWorks(p.id).length).length}`, label: 'Topics', rows: () => D.areas.flatMap(a => section(a.label, D.patterns.filter(p => p.area === a.id && pWorks(p.id).length).map(topicRow))) },
    ...kindCounts(works).map(([k, n]) => ({ type: 'browse', glyph: k, title: KINDS[k][1].replace(/^./, c => c.toUpperCase()), meta: `${n}`, label: KINDS[k][1].replace(/^./, c => c.toUpperCase()), rows: () => works.filter(w => w.kind === k).map(workRow) })),
  ]));
  return out;
}
function renderBar() {
  const text = barInput.value.trim(), level = bar.stack.at(-1);
  let rows, total = 0;
  if (level?.q && (!text || text === level.q.question)) rows = questionResults(level.q);
  else if (level && !level.q) {
    rows = level.rows();
    if (text) { const want = terms(text); rows = rows.filter(r => r.type !== 'section' && want.every(t => terms(r.title + ' ' + (r.gloss || '')).some(x => x.startsWith(t)))); }
  } else if (text.length >= 2) {
    if (level?.q) bar.stack.pop();
    const found = search(text); total = found.works.length;
    rows = [...section('Topics', found.topics.slice(0, 3).map(topicRow)), ...section('Entries', found.works.slice(0, 14).map(x => workRow(x.w)))];
    if (!rows.length) rows = [{ type: 'note', label: 'Nothing matches those words. Try fewer, or a tool’s name.' }];
  } else rows = suggestions();
  bar.rows = rows;
  bar.sel = Math.max(0, rows.findIndex(r => r.type !== 'section' && r.type !== 'note'));
  $('.bar-back', barEl).hidden = !bar.stack.length;
  barInput.placeholder = level && !level.q ? `Filter ${level.label.toLowerCase()}` : 'Ask a question, or type a few words';
  const all = $('.bar-all', barEl); all.hidden = !(total > 14); $('b', all).textContent = total;
  barList.innerHTML = rows.map((r, n) => r.type === 'section' ? `<p class="bar-section">${esc(r.label)}</p>` : r.type === 'note' ? `<p class="bar-note">${esc(r.label)}</p>`
    : `<a class="bar-row" role="option" data-n="${n}" ${r.href ? `href="${r.href}"` : 'href="#"'}>${r.glyph ? glyph(r.glyph) : `<span class="bar-mark" aria-hidden="true">${r.mark || ''}</span>`}<span class="bar-text"><span class="bar-title">${esc(r.title)}</span>${r.gloss ? `<span class="bar-gloss">${esc(r.gloss)}</span>` : ''}</span><span class="bar-meta">${esc(r.meta || '')}</span></a>`).join('');
  barList.scrollTop = 0;
  const ids = rows.filter(r => r.type === 'work').map(r => r.id);
  MapView.focusWorks?.(ids.length ? ids : null);
  mark();
}
function mark() {
  for (const el of $$('.bar-row', barList)) { const on = +el.dataset.n === bar.sel; el.classList.toggle('sel', on); el.setAttribute('aria-selected', on); if (on) el.scrollIntoView({ block: 'nearest' }); }
  const r = bar.rows[bar.sel];
  MapView.peek?.(r?.type === 'work' ? r.id : null);
  if (r?.type === 'topic') MapView.focusPatterns([r.id]); else if (bar.open && !bar.rows.some(x => x.type === 'work')) MapView.focusPatterns(null);
}
function move(step) {
  let n = bar.sel;
  do { n += step; } while (bar.rows[n] && (bar.rows[n].type === 'section' || bar.rows[n].type === 'note'));
  if (bar.rows[n]) { bar.sel = n; mark(); }
}
function choose(r) {
  if (!r) return;
  if (r.type === 'question') { bar.stack.push({ q: r.q }); barInput.value = r.q.question; renderBar(); barInput.select(); }
  else if (r.type === 'browse') { bar.stack.push({ label: r.label, rows: r.rows }); barInput.value = ''; renderBar(); }
  else { ctxKey = setCtx('bar', 'what the bar listed', location.hash, bar.rows.filter(x => x.type === 'work').map(x => x.id)); closeBar(); location.hash = r.href; }
}
function back() { bar.stack.pop(); barInput.value = ''; renderBar(); }
function openBar() { if (bar.open) return; bar.open = true; bar.stack = []; barEl.hidden = false; barInput.value = ''; renderBar(); barInput.focus(); document.body.classList.add('asking'); }
function closeBar() { bar.open = false; barInput.blur(); barEl.hidden = true; document.body.classList.remove('asking'); MapView.focusWorks?.(null); MapView.peek?.(null); MapView.focusPatterns(null); }
barInput.addEventListener('input', renderBar);
barInput.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); move(1); }
  else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); move(-1); }
  else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { const text = barInput.value.trim(); if (text.length >= 2) { closeBar(); location.hash = `#/q/${enc(text)}`; } }
  else if (e.key === 'Enter') { e.preventDefault(); choose(bar.rows[bar.sel]); }
  else if (e.key === 'Escape') { e.preventDefault(); if (bar.stack.length) back(); else if (barInput.value) { barInput.value = ''; renderBar(); } else closeBar(); }
  else if (e.key === 'Backspace' && !barInput.value && bar.stack.length) { e.preventDefault(); back(); }
});
barEl.addEventListener('mousemove', e => { const el = e.target.closest('.bar-row'); if (el && +el.dataset.n !== bar.sel) { bar.sel = +el.dataset.n; mark(); } });
barEl.addEventListener('click', e => {
  if (e.target === barEl) return closeBar();
  if (e.target.closest('.bar-back')) { back(); barInput.focus(); return; }
  const el = e.target.closest('.bar-row'); if (el) { e.preventDefault(); choose(bar.rows[+el.dataset.n]); barInput.focus(); }
});

index();
MapView.init($('#map'), D, {
  onHover(h, x, y, cards) {
    clearTimeout(popTimer);
    if (!h || h.type !== 'work' || cards) return hidePop();        // only works get a preview; a topic's name already says what it is
    popTimer = setTimeout(() => showPop(popHtml({ w: h.id }), x, y, false), 40);
  },
  onMiss(where) { if (where?.outside) goHome(); },                 // a click on bare paper, beyond the map, returns to the landing view
  onZoom(close) { document.body.classList.toggle('close-up', close); },
  onOpen(h) { hidePop(); if (h.type === 'work') ctxKey = null; location.hash = `#/${h.type[0]}/${h.id}`; },
});
renderPlate();
route();
