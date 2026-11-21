// Personal wiki prototype. One page: a map of every work on the left, a reader on the right.
// Routes live in the hash so every pattern and work has its own link.
const D = window.DATA;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const enc = encodeURIComponent;

const KINDS = {
  post: ['Slack post', 'Slack posts'], doc: ['doc', 'docs'], tool: ['tool', 'tools'],
  site: ['site', 'sites'], said: ['thing I said on a call', 'things I said on calls'], other: ['other link', 'other links'],
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
let lensId = 'pattern';
let query = '';
const kindsOff = new Set();
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

// ---- Lenses: each returns groups of rows; a row is a named list of works.
const oldestFirst = list => [...list].sort((a, b) => a[0].date < b[0].date ? -1 : 1);
const LENSES = [
  { id: 'pattern', label: 'Pattern', groups() {
    const groups = D.areas.map(a => ({
      key: a.id, label: a.label, blurb: a.blurb, href: `#/a/${a.id}`,
      rows: D.patterns.filter(p => p.area === a.id && pWorks(p.id).length).map(p => ({ key: p.id, label: p.label, href: `#/p/${p.id}`, pattern: p.id, items: oldestFirst(pWorks(p.id)) })),
    })).filter(g => g.rows.length);
    const loose = works.filter(w => !w.patterns.length);
    if (loose.length) groups.push({ key: 'loose', label: 'Not sorted yet', blurb: 'Works no pattern claims.', rows: [{ key: 'loose', label: 'Unsorted', href: '#/c/pattern/loose', items: oldestFirst(loose.map(w => [w, 1])) }] });
    return groups;
  } },
  { id: 'time', label: 'Time', groups() {
    const years = new Map();
    for (const w of works) {
      const y = years.get(w.date.slice(0, 4)) || years.set(w.date.slice(0, 4), new Map()).get(w.date.slice(0, 4));
      (y.get(w.date.slice(0, 7)) || y.set(w.date.slice(0, 7), []).get(w.date.slice(0, 7))).push([w, 2]);
    }
    return [...years].sort((a, b) => b[0].localeCompare(a[0])).map(([y, months]) => ({
      key: y, label: y, blurb: '',
      rows: [...months].sort((a, b) => b[0].localeCompare(a[0])).map(([m, items]) => ({ key: m, label: month(m + '-01'), href: `#/c/time/${m}`, items: oldestFirst(items) })),
    }));
  } },
  { id: 'source', label: 'Source', groups() {
    const names = { doc: 'Google Docs', sheet: 'Google Sheets', repo: 'Repositories', gist: 'Gists', site: 'Live sites', file: 'Links' };
    const rowOf = w => w.kind === 'post' ? '#' + w.slack.channel : names[w.sub] || (SUB[w.sub] || w.sub) + 's';
    return Object.keys(KINDS).map(k => {
      const rows = new Map();
      for (const w of works) if (w.kind === k) (rows.get(rowOf(w)) || rows.set(rowOf(w), []).get(rowOf(w))).push([w, 2]);
      return { key: k, label: KINDS[k][1].replace(/^./, c => c.toUpperCase()), blurb: '',
        rows: [...rows].sort((a, b) => b[1].length - a[1].length).map(([label, items]) => ({ key: label, label, href: `#/c/source/${enc(label)}`, items: oldestFirst(items) })) };
    }).filter(g => g.rows.length);
  } },
  ...D.facets.map(f => ({ id: f.id, label: f.label, groups() {
    return [{ key: f.id, label: f.question || f.label, blurb: '',
      rows: f.values.map(v => ({ key: v.id, label: v.label, note: v.definition, href: `#/c/${f.id}/${v.id}`, items: oldestFirst(works.filter(w => w.facets[f.id] === v.id).map(w => [w, 2])) })).filter(r => r.items.length) }];
  } })),
  ...(D.arcs?.length ? [{ id: 'arc', label: 'Arcs', groups() {
    return [{ key: 'arc', label: 'How one thing led to the next', blurb: 'Chains of works in the order they happened.',
      rows: D.arcs.map(a => ({ key: a.id, label: a.label, note: a.blurb, href: `#/arc/${a.id}`, items: a.steps.map(s => [W.get(s.work), 2]).filter(i => i[0]) })).filter(r => r.items.length > 1) }];
  } }] : []),
  ...(D.mentions.length ? [{ id: 'names', label: 'Names', groups() {
    return [{ key: 'names', label: 'Tools and organisations the works name', blurb: '',
      rows: D.mentions.map(m => ({ key: m, label: m, href: `#/c/names/${enc(m)}`, items: oldestFirst(works.filter(w => w.mentions.includes(m)).map(w => [w, 2])) })).filter(r => r.items.length >= 3) }];
  } }] : []),
];
const lens = id => LENSES.find(l => l.id === id) || LENSES[0];
const groupsOf = id => lensCache[id] || (lensCache[id] = lens(id).groups());
const rowOf = (lensName, key) => groupsOf(lensName).flatMap(g => g.rows).find(r => r.key === key);

// ---- Small pieces
const glyph = (kind, cls = '') => `<span class="glyph k-${kind} ${cls}" aria-hidden="true"></span>`;
const matches = w => !query || query.split(/\s+/).every(t => w.search.includes(t));
const wLink = (w, text) => `<a href="#/w/${w.id}" data-w="${w.id}">${text ?? esc(w.title)}</a>`;
const pLink = id => P.has(id) ? `<a class="plink" href="#/p/${id}" data-p="${id}">${esc(P.get(id).label)}</a>` : '';
const srcLine = w => w.kind === 'post' ? `#${esc(w.slack.channel)}` : w.kind === 'said' ? esc(SUB[w.sub] || 'Call') : esc(SUB[w.sub] || w.sub);

function setCtx(key, label, href, ids) { ctxStore.set(key, { label, href, ids }); return key; }

function row(w, relation) {
  return `<a class="row-card" href="#/w/${w.id}" data-w="${w.id}">${glyph(w.kind)}<span class="rc-main"><span class="rc-title">${esc(w.title)}</span>${relation ? `<span class="rc-rel">${esc(relation)}</span>` : ''}<span class="rc-gloss">${esc(w.gloss)}</span></span><span class="rc-date">${srcLine(w)} · ${day(w.date)}</span></a>`;
}
function card(w) {
  const quote = w.pull && w.kind !== 'tool' ? `<p class="c-pull">${esc(w.pull)}</p>` : `<p class="c-gloss">${esc(w.gloss)}</p>`;
  const foot = w.kind === 'post' && w.slack.replies ? `<span class="c-foot">${w.slack.replies} ${w.slack.replies === 1 ? 'reply' : 'replies'}</span>` : '';
  return `<a class="card c-${w.kind}" href="#/w/${w.id}" data-w="${w.id}"><span class="c-src">${glyph(w.kind)}${srcLine(w)} · ${day(w.date)}</span><span class="c-title">${esc(w.title)}</span>${quote}${foot}</a>`;
}
function workList(items, key, { relation } = {}) {
  return `<div class="rows" data-ctx="${esc(key)}">${items.map(w => row(w, relation?.(w))).join('')}</div>`;
}
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
const kindSummary = list => kindCounts(list).map(([k, n]) => `${glyph(k)}${plural(n, k)}`).join('<span class="sep"> </span>');

// ---- Map
const mapEl = $('#map'), readerEl = $('#reader'), shell = $('#shell'), pop = $('#pop');
function renderMap() {
  const groups = groupsOf(lensId);
  const counts = kindCounts(works);
  const intro = `<section class="intro">
    <h1>Alejo Acelas</h1>
    <p class="lede">I help high-impact organisations use AI so their existing work goes better.</p>
    <p class="how">This is the work I've shared along the way, sorted from the bottom up into ${D.patterns.length} patterns that keep coming up. Each mark is one piece of work: hover to see it, click to open it.</p>
    ${D.questions?.length ? `<div class="ask"><h2>Or start from a question</h2><ul>${D.questions.map(q => `<li><a href="#/ask/${q.id}" data-ps="${q.patterns.join(' ')}">${esc(q.question)}</a></li>`).join('')}</ul></div>` : ''}
    <p class="legend">${counts.map(([k, n]) => `<button class="legend-item${kindsOff.has(k) ? ' off' : ''}" data-kind="${k}" aria-pressed="${!kindsOff.has(k)}" title="Show or hide ${KINDS[k][1]}">${glyph(k)}${plural(n, k)}</button>`).join('')}</p>
  </section>`;
  mapEl.innerHTML = intro + `<div class="groups lens-${lensId}">` + groups.map(g => `<section class="group">
      <h2>${g.href ? `<a href="${g.href}" data-a="${g.key}">${esc(g.label)}</a>` : esc(g.label)}</h2>
      ${g.blurb ? `<p class="blurb">${esc(g.blurb)}</p>` : ''}
      ${g.rows.map(r => `<div class="row" data-row="${esc(r.key)}" data-ctx="${esc(setCtx(`${lensId}/${r.key}`, r.label, r.href, r.items.map(i => i[0].id)))}"><a class="row-label" href="${r.href}" ${r.pattern ? `data-p="${r.pattern}"` : ''}>${esc(r.label)}</a> <span class="cells">${r.items.map(([w, s]) => `<a class="cell k-${w.kind} s${s}" href="#/w/${w.id}" data-w="${w.id}" aria-label="${esc(w.title)}"></a>`).join('')}</span></div>`).join('')}
    </section>`).join('') + `</div>
    <footer class="foot"><label><input type="checkbox" id="public" ${publicOnly ? 'checked' : ''}> Only works an agent marked safe to publish (${D.works.filter(w => w.share === 'ok').length} of ${D.works.length})</label><span>Prototype built ${day(D.built)} from a sample. Names, summaries and groupings were drafted by agents and wait for review.</span></footer>`;
  $('#lenses').innerHTML = LENSES.map(l => `<button data-lens="${l.id}" aria-pressed="${l.id === lensId}">${esc(l.label)}</button>`).join('');
  paint();
}

// Mark the map: the open page, the search, hidden kinds.
let current = { works: new Set(), pattern: null, related: new Set() };
function paint() {
  for (const c of $$('.cell', mapEl)) {
    const w = W.get(c.dataset.w);
    c.classList.toggle('off', !w || kindsOff.has(w.kind) || !matches(w));
    c.classList.toggle('cur', current.works.has(c.dataset.w));
  }
  for (const r of $$('.row', mapEl)) {
    r.classList.toggle('cur', lensId === 'pattern' && r.dataset.row === current.pattern);
    r.classList.toggle('rel', lensId === 'pattern' && current.related.has(r.dataset.row));
    r.classList.toggle('empty', !$('.cell:not(.off)', r));
  }
  mapEl.classList.toggle('has-current', current.works.size > 0 && current.works.size < 4);
  mapEl.classList.toggle('has-set', current.works.size >= 4);
}

// ---- Brushing: hovering a mark lights up the same work elsewhere and the works it links to.
function brush(id) {
  for (const c of $$('.cell.on,.cell.near', mapEl)) c.classList.remove('on', 'near');
  mapEl.classList.toggle('brush', !!id);
  if (!id) return;
  const w = W.get(id);
  const near = new Set(w.links.map(l => l.to));
  for (const c of $$('.cell', mapEl)) {
    if (c.dataset.w === id) c.classList.add('on'); else if (near.has(c.dataset.w)) c.classList.add('near');
  }
}
function brushPattern(id, many) {
  for (const r of $$('.row.hot,.row.warm', mapEl)) r.classList.remove('hot', 'warm');
  mapEl.classList.toggle('brush-rows', !!(id || many));
  if (!(id || many) || lensId !== 'pattern') return;
  const hot = new Set(many || [id]);
  const rel = new Set(many ? [] : (P.get(id)?.related || []).map(r => r.id));
  for (const r of $$('.row', mapEl)) { if (hot.has(r.dataset.row)) r.classList.add('hot'); else if (rel.has(r.dataset.row)) r.classList.add('warm'); }
}

// ---- Hover previews for any link to a work or a pattern
let popTimer;
function showPop(el) {
  let html = '';
  if (el.dataset.w) {
    const w = W.get(el.dataset.w); if (!w) return;
    html = `<span class="pop-src">${glyph(w.kind)}${srcLine(w)} · ${day(w.date)}</span><b>${esc(w.title)}</b><span>${esc(w.gloss)}</span>`;
  } else if (el.dataset.p) {
    const p = P.get(el.dataset.p); if (!p) return;
    const list = pWorks(p.id).map(i => i[0]);
    html = `<span class="pop-src">Pattern · ${list.length} works</span><b>${esc(p.label)}</b><span>${esc(p.summary.split(/(?<=\.)\s/)[0])}</span><span class="pop-kinds">${kindSummary(list)}</span>`;
  } else return;
  pop.innerHTML = html; pop.hidden = false;
  const r = el.getBoundingClientRect(), pr = pop.getBoundingClientRect();
  let x = Math.min(Math.max(8, r.left + r.width / 2 - pr.width / 2), innerWidth - pr.width - 8);
  let y = r.bottom + 8; if (y + pr.height > innerHeight - 8) y = r.top - pr.height - 8;
  pop.style.transform = `translate(${Math.round(x)}px,${Math.round(Math.max(8, y))}px)`;
}
function hidePop() { clearTimeout(popTimer); pop.hidden = true; }
document.addEventListener('mouseover', e => {
  const ask = e.target.closest?.('[data-ps]');
  if (ask) { brushPattern(null, ask.dataset.ps.split(' ')); return; }
  const el = e.target.closest?.('[data-w],[data-p]');
  if (!el || el.closest('#pop')) return;
  const inMap = !!el.closest('#map');
  if (el.dataset.w && inMap) brush(el.dataset.w);
  if (el.dataset.p) brushPattern(el.dataset.p);
  if (el.dataset.w && !inMap) brush(el.dataset.w);
  clearTimeout(popTimer);
  if (el.classList.contains('card') || el.classList.contains('row-card')) return;   // these already show their gloss
  popTimer = setTimeout(() => showPop(el), inMap && el.dataset.w ? 60 : 280);
});
document.addEventListener('mouseout', e => {
  const el = e.target.closest?.('[data-w],[data-p],[data-ps]');
  if (!el || el.contains(e.relatedTarget)) return;
  hidePop(); brush(null); brushPattern(null);
});

// ---- Reader pages
function head(kicker, title, body = '') { return `<header class="page-head"><p class="kicker">${kicker}</p><h1>${title}</h1>${body}</header>`; }

function patternPage(id) {
  const p = P.get(id); if (!p) return missing();
  const items = pWorks(id), list = items.map(i => i[0]).sort((a, b) => b.date.localeCompare(a.date));
  const key = setCtx(`pattern/${id}`, p.label, `#/p/${id}`, list.map(w => w.id));
  const lead = (p.lead || []).map(i => W.get(i)).filter(Boolean);
  const leadSet = lead.length ? lead : items.filter(i => i[1] === 2).map(i => i[0]).slice(0, 4);
  const shared = o => pWorks(o).filter(i => i[0].patterns.some(x => x[0] === id)).length;
  const related = (p.related || []).filter(r => P.has(r.id) && pWorks(r.id).length);
  const dates = list.map(w => w.date).sort();
  current = { works: new Set(list.map(w => w.id)), pattern: id, related: new Set(related.map(r => r.id)) };
  return { title: p.label, html: head(`<a href="#/a/${p.area}">${esc(A.get(p.area)?.label || '')}</a> · Pattern · ${list.length} works · ${month(dates[0])} to ${month(dates.at(-1))}`, esc(p.label),
    `<p class="summary">${esc(p.summary)}</p>${spark(list)}<p class="kinds">${kindSummary(list)}</p>`) +
    `<section><h2>Start here</h2><div class="cards" data-ctx="${esc(key)}">${leadSet.map(card).join('')}</div></section>` +
    (related.length ? `<section><h2>Leads to</h2><ul class="related">${related.map(r => `<li>${pLink(r.id)}<span class="why">${esc(r.why)}</span><span class="n">${shared(r.id)} shared</span></li>`).join('')}</ul></section>` : '') +
    `<section><h2>All ${list.length}, newest first</h2>${workList(list, key)}</section>` };
}

function areaPage(id) {
  const a = A.get(id); if (!a) return missing();
  const ps = D.patterns.filter(p => p.area === id && pWorks(p.id).length);
  const all = new Set(ps.flatMap(p => pWorks(p.id).map(i => i[0])));
  current = { works: new Set([...all].map(w => w.id)), pattern: null, related: new Set(ps.map(p => p.id)) };
  return { title: a.label, html: head(`Area · ${ps.length} patterns · ${all.size} works`, esc(a.label), `<p class="summary">${esc(a.blurb)}</p>${spark([...all])}<p class="kinds">${kindSummary([...all])}</p>`) +
    patternBlocks(ps) };
}

function patternBlocks(ps) {
  return ps.map(p => {
    const list = pWorks(p.id).map(i => i[0]).sort((x, y) => y.date.localeCompare(x.date));
    const lead = ((p.lead || []).map(i => W.get(i)).filter(Boolean)).slice(0, 3);
    const key = setCtx(`pattern/${p.id}`, p.label, `#/p/${p.id}`, list.map(w => w.id));
    return `<section class="area-pattern"><h2>${pLink(p.id)} <span class="n">${list.length}</span></h2><p class="summary small">${esc(p.summary)}</p>${workList(lead.length ? lead : list.slice(0, 3), key)}</section>`;
  }).join('');
}

function questionPage(id) {
  const q = (D.questions || []).find(q => q.id === id); if (!q) return missing();
  const ps = q.patterns.map(p => P.get(p)).filter(p => p && pWorks(p.id).length);
  const all = new Set(ps.flatMap(p => pWorks(p.id).map(i => i[0].id)));
  current = { works: all, pattern: null, related: new Set(ps.map(p => p.id)) };
  return { title: q.question, html: head(`Question · ${ps.length} patterns answer it`, esc(q.question), q.answer ? `<p class="summary">${esc(q.answer)}</p>` : '') + patternBlocks(ps) };
}

function arcPage(id) {
  const a = (D.arcs || []).find(a => a.id === id); if (!a) return missing();
  const steps = a.steps.map(s => [W.get(s.work), s.note]).filter(s => s[0]);
  if (!steps.length) return missing();
  const key = setCtx(`arc/${id}`, a.label, `#/arc/${id}`, steps.map(s => s[0].id));
  current = { works: new Set(steps.map(s => s[0].id)), pattern: null, related: new Set() };
  return { title: a.label, html: head(`Arc · ${steps.length} steps · ${month(steps[0][0].date)} to ${month(steps.at(-1)[0].date)}`, esc(a.label), `<p class="summary">${esc(a.blurb)}</p>`) +
    `<ol class="arc" data-ctx="${esc(key)}">${steps.map(([w, note]) => `<li><p class="arc-note"><time>${day(w.date)}</time>${esc(note)}</p>${row(w)}</li>`).join('')}</ol>` };
}

function collectionPage(lensName, key) {
  const r = rowOf(lensName, key); if (!r) return missing();
  const list = r.items.map(i => i[0]).sort((a, b) => b.date.localeCompare(a.date));
  const k = setCtx(`${lensName}/${key}`, r.label, r.href, list.map(w => w.id));
  const top = new Map();
  for (const w of list) for (const [p] of w.patterns) top.set(p, (top.get(p) || 0) + 1);
  const tops = [...top].sort((a, b) => b[1] - a[1]).slice(0, 6);
  current = { works: new Set(list.map(w => w.id)), pattern: null, related: new Set() };
  return { title: r.label, html: head(`${esc(lens(lensName).label)} · ${list.length} works`, esc(r.label), `${r.note ? `<p class="summary">${esc(r.note)}</p>` : ''}${spark(list)}<p class="kinds">${kindSummary(list)}</p>`) +
    (tops.length ? `<section><h2>Mostly about</h2><ul class="related">${tops.map(([p, n]) => `<li>${pLink(p)}<span class="n">${n} here</span></li>`).join('')}</ul></section>` : '') +
    `<section><h2>All ${list.length}, newest first</h2>${workList(list, k)}</section>` };
}

function searchPage(q) {
  const list = works.filter(matches);
  const k = setCtx('search', `“${q}”`, `#/q/${enc(q)}`, list.map(w => w.id));
  const ps = D.patterns.filter(p => q.split(/\s+/).every(t => (p.label + ' ' + p.summary).toLowerCase().includes(t)));
  current = { works: new Set(), pattern: null, related: new Set() };
  return { title: `Search: ${q}`, html: head(`Search · ${list.length} works`, `“${esc(q)}”`) +
    (ps.length ? `<section><h2>Patterns</h2><ul class="related">${ps.map(p => `<li>${pLink(p.id)}<span class="n">${pWorks(p.id).length} works</span></li>`).join('')}</ul></section>` : '') +
    `<section><h2>Works</h2>${list.length ? workList(list.slice(0, 150), k) : '<p class="summary small">Nothing matches. Try a tool name, or one word.</p>'}</section>` };
}

// The source, drawn to look like where it lives.
function viewer(w) {
  if (w.kind === 'post') {
    const s = w.slack;
    return `<figure class="v-slack">
      <figcaption><b># ${esc(s.channel)}</b><span>AI Uplift for EA Slack</span></figcaption>
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
    return `<figure class="v-said"><span class="wave" aria-hidden="true">${Array.from({ length: 34 }, (_, i) => `<i style="height:${4 + Math.round(13 * Math.abs(Math.sin(i * 1.7 + w.id.length)))}px"></i>`).join('')}</span><blockquote>${esc(w.said.text)}</blockquote><figcaption>${esc(w.said.setting)} · ${day(w.date)}</figcaption></figure>`;
  }
  return `<figure class="v-link"><p>${esc(w.gloss)}</p>${w.url ? `<a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(w.url.replace(/^https?:\/\//, '').slice(0, 70))} ↗</a>` : ''}</figure>`;
}

function workPage(id) {
  const w = W.get(id); if (!w) return missing();
  const ctx = ctxStore.get(ctxKey);
  const at = ctx ? ctx.ids.indexOf(id) : -1;
  const step = at >= 0 && ctx.ids.length > 1 ? `<nav class="step" aria-label="Step through ${esc(ctx.label)}"><a class="arrow" ${at > 0 ? `href="#/w/${ctx.ids[at - 1]}" data-w="${ctx.ids[at - 1]}"` : 'aria-disabled="true"'} data-step="-1" title="Previous (←)">←</a><span>${at + 1} of ${ctx.ids.length} in <a href="${ctx.href}">${esc(ctx.label)}</a></span><a class="arrow" ${at < ctx.ids.length - 1 ? `href="#/w/${ctx.ids[at + 1]}" data-w="${ctx.ids[at + 1]}"` : 'aria-disabled="true"'} data-step="1" title="Next (→)">→</a></nav>` : '';
  const links = w.links.map(l => [W.get(l.to), l]).filter(x => x[0]);
  const near = w.near.map(i => W.get(i)).filter(Boolean);
  const names = w.mentions.filter(m => D.mentions.includes(m));
  current = { works: new Set([id]), pattern: null, related: new Set(w.patterns.map(p => p[0])) };
  const k1 = setCtx(`links/${id}`, `linked from “${w.title}”`, `#/w/${id}`, links.map(x => x[0].id));
  const k2 = setCtx(`near/${id}`, `near “${w.title}”`, `#/w/${id}`, near.map(x => x.id));
  return { title: w.title, html: `<header class="page-head work-head"><p class="kicker">${glyph(w.kind)}${esc(SUB[w.sub] || w.sub)} · ${day(w.date)}${step}</p><h1>${esc(w.title)}</h1>${w.gloss ? `<p class="summary">${esc(w.gloss)}</p>` : ''}</header>` +
    viewer(w) +
    (w.patterns.length ? `<section><h2>Part of</h2><ul class="related partof">${w.patterns.map(([p, s]) => `<li class="s${s}">${pLink(p)}<span class="n">${pWorks(p).length} works</span></li>`).join('')}</ul></section>` : '') +
    (links.length ? `<section><h2>Linked</h2><div class="rows" data-ctx="${esc(k1)}">${links.map(([o, l]) => row(o, l.label)).join('')}</div></section>` : '') +
    (near.length ? `<section><h2>Nearby</h2>${workList(near, k2)}</section>` : '') +
    arcsOf(id) +
    (names.length ? `<section><h2>Names</h2><p class="tags">${names.map(m => `<a href="#/c/names/${enc(m)}">${esc(m)}</a>`).join('')}</p></section>` : '') +
    (w.share !== 'ok' ? `<p class="review">Review note, not part of the site: an agent marked this “check” before publishing${w.shareReason ? ` (${esc(w.shareReason)})` : ''}.</p>` : '') };
}
function arcsOf(id) {
  const on = (D.arcs || []).filter(a => a.steps.some(s => s.work === id));
  if (!on.length) return '';
  return `<section><h2>One step in</h2><ul class="related">${on.map(a => {
    const at = a.steps.findIndex(s => s.work === id);
    return `<li><a class="plink" href="#/arc/${a.id}">${esc(a.label)}</a><span class="why">Step ${at + 1} of ${a.steps.length}. ${esc(a.steps[at].note || '')}</span></li>`;
  }).join('')}</ul></section>`;
}
const missing = () => ({ title: 'Not found', html: head('', 'Nothing here', '<p class="summary">That link points at something this sample does not have.</p>') });

// ---- Routing
function route() {
  const [, kind, a, b] = decodeURI(location.hash.replace(/^#/, '')).split('/');
  hidePop(); brush(null); brushPattern(null);
  let page = null;
  if (kind === 'p') page = patternPage(a);
  else if (kind === 'a') page = areaPage(a);
  else if (kind === 'w') page = workPage(a);
  else if (kind === 'ask') page = questionPage(a);
  else if (kind === 'arc') page = arcPage(a);
  else if (kind === 'c') page = collectionPage(a, decodeURIComponent(b || ''));
  else if (kind === 'q') { query = decodeURIComponent(a || '').toLowerCase(); if ($('#q').value.toLowerCase() !== query) $('#q').value = query; page = searchPage(query); }
  if (kind !== 'q' && query && document.activeElement !== $('#q')) { /* keep the filter while browsing results */ }
  if (!page) { current = { works: new Set(), pattern: null, related: new Set() }; shell.classList.remove('open'); readerEl.hidden = true; document.title = 'Alejo Acelas'; trail.length = 0; paint(); return; }
  const here = location.hash;
  const seen = trail.findIndex(t => t.href === here);
  if (seen >= 0) trail.length = seen;
  trail.push({ href: here, label: page.title });
  const crumbs = trail.slice(-4, -1).map(t => `<a href="${esc(t.href)}">${esc(t.label)}</a>`).join('<span>›</span>');
  readerEl.innerHTML = `<div class="reader-bar"><nav class="trail" aria-label="Where you have been">${crumbs ? crumbs + '<span>›</span>' : ''}</nav><a class="close" href="#/" title="Close (Esc)">Close ✕</a></div><article class="page-body">${page.html}</article>`;
  readerEl.hidden = false; shell.classList.add('open'); readerEl.scrollTop = 0;
  document.title = `${page.title} · Alejo Acelas`;
  paint();
  const first = $('.cell.cur', mapEl);
  if (first && current.works.size === 1) first.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  else if (current.pattern) $(`.row[data-row="${CSS.escape(current.pattern)}"]`, mapEl)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
addEventListener('hashchange', route);

// ---- Events
document.addEventListener('click', e => {
  const t = e.target;
  const link = t.closest('a[data-w]');
  if (link) { const holder = link.closest('[data-ctx]'); if (holder) ctxKey = holder.dataset.ctx; else if (!link.dataset.step) ctxKey = null; }
  const lensBtn = t.closest('[data-lens]');
  if (lensBtn) { lensId = lensBtn.dataset.lens; renderMap(); mapEl.scrollTop = 0; return; }
  const legend = t.closest('[data-kind]');
  if (legend) { const k = legend.dataset.kind; kindsOff.has(k) ? kindsOff.delete(k) : kindsOff.add(k); legend.classList.toggle('off'); legend.setAttribute('aria-pressed', !kindsOff.has(k)); paint(); return; }
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
});
document.addEventListener('change', e => { if (e.target.id === 'public') { publicOnly = e.target.checked; index(); renderMap(); route(); } });
function wander() { const sorted = works.filter(w => w.patterns.length && matches(w)); const pool = sorted.length ? sorted : works; const w = pool[Math.floor(Math.random() * pool.length)]; if (w) { ctxKey = null; location.hash = `#/w/${w.id}`; } }

const q = $('#q');
let qTimer;
q.addEventListener('input', () => {
  query = q.value.trim().toLowerCase();
  paint();
  clearTimeout(qTimer);
  qTimer = setTimeout(() => {
    if (query.length >= 2) { const h = `#/q/${enc(query)}`; location.hash.startsWith('#/q/') ? (history.replaceState(null, '', h), route()) : (location.hash = h); }
    else if (location.hash.startsWith('#/q/')) location.hash = '#/';
  }, 180);
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
  if (e.key === '/') { e.preventDefault(); q.focus(); q.select(); }
  else if (e.key === 'r') wander();
  else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const a = $(`.step [data-step="${e.key === 'ArrowRight' ? 1 : -1}"][href]`); if (a) { e.preventDefault(); location.hash = a.getAttribute('href'); } }
});

index();
renderMap();
route();
