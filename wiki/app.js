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
const plural = (n, kind) => `${n} ${KINDS[kind][n === 1 ? 0 : 1]}`;

// ---- State
let publicOnly = false;
let works, W, P, A, patternWorks, lensCache;
let query = '';
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

// ---- Small pieces
const channel = w => w.slack.channel === 'private-channel' ? 'a private channel' : '#' + w.slack.channel;
const glyph = (kind, cls = '') => `<span class="glyph k-${kind} ${cls}" aria-hidden="true"></span>`;
const matches = w => !query || query.split(/\s+/).every(t => w.search.includes(t));
const pLink = id => P.has(id) ? `<a class="plink" href="#/p/${id}" data-p="${id}">${esc(P.get(id).label)}</a>` : '';
const srcLine = w => w.kind === 'post' ? esc(channel(w)) : esc(SUB[w.sub] || w.sub);
function setCtx(key, label, href, ids) { ctxStore.set(key, { label, href, ids }); return key; }

function row(w, relation) {
  return `<a class="row-card" href="#/w/${w.id}" data-w="${w.id}">${glyph(w.kind)}<span class="rc-main"><span class="rc-title">${esc(w.title)}</span>${relation ? `<span class="rc-rel">${esc(relation)}</span>` : ''}<span class="rc-gloss">${esc(w.gloss)}</span></span><span class="rc-date">${srcLine(w)} · ${day(w.date)}</span></a>`;
}
function card(w) {
  const quote = w.pull && w.kind !== 'tool' ? `<p class="c-pull">${esc(w.pull)}</p>` : `<p class="c-gloss">${esc(w.gloss)}</p>`;
  const foot = w.kind === 'post' && w.slack.replies ? `<span class="c-foot">${w.slack.replies} ${w.slack.replies === 1 ? 'reply' : 'replies'}</span>` : '';
  return `<a class="card c-${w.kind}" href="#/w/${w.id}" data-w="${w.id}"><span class="c-src">${glyph(w.kind)}${srcLine(w)} · ${day(w.date)}</span><span class="c-title">${esc(w.title)}</span>${quote}${foot}</a>`;
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
      <p class="lede">I help high-impact organisations use AI so their existing work goes better.</p>
      <p class="how">This is a map of what I've shared along the way. Works that share an idea sit close together, their colours run into each other, and the paint is deepest where there is most. Zoom in to read, and click anything to open it.</p>
      <p class="legend">${kindCounts(works).map(([k, n]) => `<a class="legend-item" href="#/c/kind/${k}" data-kind="${k}">${glyph(k)}${plural(n, k)}</a>`).join('')}</p>
      <p class="doors">${D.questions?.length ? '<a href="#/ask">Start from a question</a>' : ''}<a href="#/index">Read it as a list</a><button id="wander" title="Fly to a work at random (R)">Surprise me</button></p>
    </div>`;
}

// ---- Hover previews
let popTimer;
function popHtml(el) {
  if (el.w) { const w = W.get(el.w); return w && `<span class="pop-src">${glyph(w.kind)}${srcLine(w)} · ${day(w.date)}</span><b>${esc(w.title)}</b><span>${esc(w.gloss)}</span>`; }
  if (el.p) { const p = P.get(el.p), list = pWorks(el.p).map(i => i[0]); return p && `<span class="pop-src">Pattern · ${list.length} works</span><b>${esc(p.label)}</b><span>${esc(p.summary.split(/(?<=\.)\s/)[0])}</span>`; }
  if (el.a) { const a = A.get(el.a); return a && `<span class="pop-src">Area</span><b>${esc(a.label)}</b><span>${esc(a.blurb)}</span>`; }
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
  const kind = e.target.closest?.('[data-kind]');
  if (kind) { MapView.focusWorks?.(works.filter(w => w.kind === kind.dataset.kind).map(w => w.id)); return; }
  const el = e.target.closest?.('a[data-w],a[data-p]');
  if (!el || el.closest('#pop')) return;
  if (el.dataset.p) MapView.focusPatterns([el.dataset.p]);
  clearTimeout(popTimer);
  if (el.classList.contains('card') || el.classList.contains('row-card')) return;   // these already show their gloss
  popTimer = setTimeout(() => { const r = el.getBoundingClientRect(); showPop(popHtml({ w: el.dataset.w, p: el.dataset.p }), r.left + r.width / 2, r.bottom, true); }, 280);
});
document.addEventListener('mouseout', e => {
  const el = e.target.closest?.('a[data-w],a[data-p],[data-ps],[data-kind]');
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
    html: head(`<a href="#/a/${p.area}">${esc(A.get(p.area)?.label || '')}</a> · Pattern · ${list.length} works · ${month(dates[0])} to ${month(dates.at(-1))}`, esc(p.label), `<p class="summary">${esc(p.summary)}</p>${spark(list)}${kindSummary(list)}`) +
    `<section><h2>Start here</h2><div class="cards" data-ctx="${esc(key)}">${leadSet.map(card).join('')}</div></section>` +
    (related.length ? `<section><h2>Leads to</h2><ul class="related">${related.map(r => `<li>${pLink(r.id)}<span class="why">${esc(r.why)}</span><span class="n">${shared(r.id)} shared</span></li>`).join('')}</ul></section>` : '') +
    `<section><h2>All ${list.length}, newest first</h2>${workList(list, key)}</section>` };
}

function areaPage(id) {
  const a = A.get(id); if (!a) return missing();
  const ps = D.patterns.filter(p => p.area === id && pWorks(p.id).length);
  const all = [...new Set(ps.flatMap(p => pWorks(p.id).map(i => i[0])))];
  return { title: a.label, select: { works: all.map(w => w.id), related: ps.map(p => p.id) },
    html: head(`Area · ${ps.length} patterns · ${all.length} works`, esc(a.label), `<p class="summary">${esc(a.blurb)}</p>${spark(all)}${kindSummary(all)}`) + patternBlocks(ps) };
}

function questionsPage() {
  return { title: 'Start from a question', select: none, html: head('Questions people arrive with', 'Start from a question', '<p class="summary">Each one leads to the patterns that answer it. Point at a question to see where its answers sit on the map.</p>') +
    `<ul class="ask">${D.questions.map(q => `<li><a href="#/ask/${q.id}" data-ps="${q.patterns.join(' ')}">${esc(q.question)}</a></li>`).join('')}</ul>` };
}
function questionPage(id) {
  const q = (D.questions || []).find(q => q.id === id); if (!q) return missing();
  const ps = q.patterns.map(p => P.get(p)).filter(p => p && pWorks(p.id).length);
  const all = [...new Set(ps.flatMap(p => pWorks(p.id).map(i => i[0].id)))];
  return { title: q.question, select: { works: all, related: ps.map(p => p.id) },
    html: head(`<a href="#/ask">Questions</a> · ${ps.length} patterns answer this one`, esc(q.question), q.answer ? `<p class="summary">${esc(q.answer)}</p>` : '') + patternBlocks(ps) };
}

function arcPage(id) {
  const a = (D.arcs || []).find(a => a.id === id); if (!a) return missing();
  const steps = a.steps.map(s => [W.get(s.work), s.note]).filter(s => s[0]);
  if (!steps.length) return missing();
  const key = setCtx(`arc/${id}`, a.label, `#/arc/${id}`, steps.map(s => s[0].id));
  return { title: a.label, select: { works: steps.map(s => s[0].id) },
    html: head(`Arc · ${steps.length} steps · ${month(steps[0][0].date)} to ${month(steps.at(-1)[0].date)}`, esc(a.label), `<p class="summary">${esc(a.blurb)}</p>`) +
    `<ol class="arc" data-ctx="${esc(key)}">${steps.map(([w, note]) => `<li><p class="arc-note"><time>${day(w.date)}</time>${esc(note)}</p>${row(w)}</li>`).join('')}</ol>` };
}

function indexPage() {
  return { title: 'Everything as a list', select: none, html: head(`${works.length} works · ${D.patterns.length} patterns · ${D.areas.length} areas`, 'Everything as a list') +
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
  const list = works.filter(matches);
  const k = setCtx('search', `“${q}”`, `#/q/${enc(q)}`, list.map(w => w.id));
  const ps = D.patterns.filter(p => pWorks(p.id).length && q.split(/\s+/).every(t => (p.label + ' ' + p.summary).toLowerCase().includes(t)));
  return { title: `Search: ${q}`, select: { works: list.length > 1 && list.length < 200 ? list.map(w => w.id) : [] },
    html: head(`Search · ${list.length} works`, `“${esc(q)}”`) +
    (ps.length ? `<section><h2>Patterns</h2><ul class="related">${ps.map(p => `<li>${pLink(p.id)}<span class="n">${pWorks(p.id).length} works</span></li>`).join('')}</ul></section>` : '') +
    `<section><h2>Works</h2>${list.length ? workList(list.slice(0, 150), k) : '<p class="summary small">Nothing matches. Try a tool name, or one word.</p>'}</section>` };
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
        <a href="${esc(w.url)}" target="_blank" rel="noopener">Open in Google ${isSheet ? 'Sheets' : 'Docs'} ↗</a></figcaption>
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
    const mine = text => text.includes(w.said.text) ? esc(text).replace(esc(w.said.text), `<mark>${esc(w.said.text)}</mark>`) : text.includes(start) ? `<mark>${esc(text)}</mark>` : esc(text);
    const around = ex ? `<section class="around"><h2>Around it in the call</h2><div class="excerpt">${ex.turns.map(t => t.me ? `<p class="t-me"><b>Alejo</b>${mine(t.me)}</p>` : `<p class="t-other"><b>${esc(ex.other)}</b>${esc(t.other)}</p>`).join('')}</div><p class="excerpt-note">My words are as I said them, with cuts marked. What the other person said is summarised and never quoted.</p></section>` : '';
    return `<figure class="v-said"><span class="wave" aria-hidden="true">${Array.from({ length: 34 }, (_, i) => `<i style="height:${4 + Math.round(13 * Math.abs(Math.sin(i * 1.7 + w.id.length)))}px"></i>`).join('')}</span><blockquote>${esc(w.said.text)}</blockquote><figcaption>${esc(w.said.setting)} · ${day(w.date)}</figcaption></figure>${around}`;
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
    html: `<header class="page-head work-head"><p class="kicker">${glyph(w.kind)}${esc(SUB[w.sub] || w.sub)} · ${day(w.date)}${step}</p><h1>${esc(w.title)}</h1>${w.gloss ? `<p class="summary">${esc(w.gloss)}</p>` : ''}</header>` +
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
  else if (kind === 'c') page = collectionPage(a, decodeURIComponent(b || ''));
  else if (kind === 'q') { query = decodeURIComponent(a || '').toLowerCase(); if ($('#q').value.toLowerCase() !== query) $('#q').value = query; applyFilter(); page = searchPage(query); }
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
const applyFilter = () => MapView.setFilter(query ? matches : null);
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
  if (t.id === 'wander') wander();
  const zoom = t.closest('[data-zoom]');
  if (zoom) { const z = zoom.dataset.zoom; z === 'fit' ? MapView.home() : MapView.zoomAt(z === 'in' ? 1.7 : 1 / 1.7); }
});
document.addEventListener('change', e => { if (e.target.id === 'public') { publicOnly = e.target.checked; index(); MapView.setWorks(works); renderPlate(); route(); } });
function wander() { const sorted = works.filter(w => w.patterns.length && matches(w)); const pool = sorted.length ? sorted : works; const w = pool[Math.floor(Math.random() * pool.length)]; if (w) { ctxKey = null; location.hash = `#/w/${w.id}`; } }

const q = $('#q');
let qTimer;
q.addEventListener('input', () => {
  query = q.value.trim().toLowerCase();
  applyFilter();
  clearTimeout(qTimer);
  qTimer = setTimeout(() => {
    if (query.length >= 2) { const h = `#/q/${enc(query)}`; location.hash.startsWith('#/q/') ? (history.replaceState(null, '', h), route()) : (location.hash = h); }
    else if (location.hash.startsWith('#/q/')) location.hash = '#/';
  }, 260);
});
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (e.key === 'Escape') {
    if (typing && q.value) { q.value = ''; q.dispatchEvent(new Event('input')); }
    else if (typing) q.blur();
    else if (location.hash.length > 2) location.hash = '#/';
    return;
  }
  if (typing) return;
  const reading = document.body.classList.contains('reading');
  if (e.key === '/') { e.preventDefault(); q.focus(); q.select(); }
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

// Prototype only: switch between the looks being compared, keeping the place you are at.
const LOOKS = [['index.html', 'Watercolour'], ['nebula.html', 'Nebula'], ['inks.html', 'Overprinted inks'], ['stipple.html', 'Stippling']];
const looks = document.createElement('nav');
looks.className = 'looks'; looks.setAttribute('aria-label', 'Compare looks');
looks.innerHTML = '<span>Look</span>' + LOOKS.map(([file, name]) => `<a href="${file}" ${location.pathname.endsWith(file) || (file === 'index.html' && location.pathname.endsWith('/')) ? 'aria-current="page"' : ''}>${name}</a>`).join('');
looks.addEventListener('click', e => { const a = e.target.closest('a'); if (a) { e.preventDefault(); location.href = a.getAttribute('href') + location.hash; } });
document.body.append(looks);

index();
renderPlate();
MapView.init($('#map'), D, {
  onHover(h, x, y, cards) {
    clearTimeout(popTimer);
    if (!h || (h.type === 'work' && cards)) return hidePop();
    popTimer = setTimeout(() => showPop(popHtml({ [h.type[0]]: h.id }), x, y, false), h.type === 'work' ? 40 : 220);
  },
  onZoom(close) { document.body.classList.toggle('close-up', close); },
  onOpen(h) { hidePop(); if (h.type === 'work') ctxKey = null; location.hash = `#/${h.type[0]}/${h.id}`; },
});
route();
