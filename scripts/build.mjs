import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { specimens } from './collection.mjs';

const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const [archive, related, template] = await Promise.all([
  readJson('content/archive.json'), readJson('content/related.json'), readFile('index.html', 'utf8'),
]);
const byId = new Map(archive.map(item => [item.id, item]));
const groups = new Map([
  ['Repository', 'Repositories'], ['Template', 'Templates'], ['Call note', 'Calls'],
  ['Call excerpt', 'Calls'], ['Slack', 'Slack'], ['Draft', 'Drafts'],
]);
const colors = ['celadon', 'apricot', 'blue', 'orchid', 'rose', 'wheat', 'aqua', 'parchment'];
const esc = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const shortDate = date => new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
}).format(new Date(date));
const number = n => String(n).padStart(2, '0');

if (byId.size !== archive.length || new Set(specimens.map(([id]) => id)).size !== archive.length
    || specimens.length !== archive.length) throw new Error('Each entry needs one place in the archive.');
const pieces = specimens.map(([id, object], index) => {
  const entry = byId.get(id);
  if (!entry || !groups.has(entry.kind)) throw new Error('Unknown archive entry or kind: ' + id);
  const slug = entry.title.toLowerCase().replace(/[’']/g, '').normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { ...entry, object, group: groups.get(entry.kind), slug, num: number(index + 1),
    color: colors[(index + Math.floor(index / colors.length) * 3) % colors.length] };
});
const orderedById = new Map(pieces.map(item => [item.id, item]));
if (new Set(pieces.map(item => item.slug)).size !== pieces.length) throw new Error('Duplicate URL.');

function page(title, description, base, main) {
  const values = { title: esc(title), description: esc(description), base, main };
  return template.replace(/{{(\w+)}}/g, (_, key) => values[key]);
}
function picture(item, base, lazy = true) {
  return `<div class="plate ${item.color}"><span class="fig" aria-hidden="true">Fig. ${item.num}</span>
    <img src="${base}objects/${item.object}.png" alt="" width="760" height="440"${lazy ? ' loading="lazy"' : ''}>
    <span class="plate-open" aria-hidden="true">↗</span></div>`;
}
function kind(item) {
  return `<span class="kind"><i class="symbol ${item.group.toLowerCase()}" aria-hidden="true"></i>${esc(item.kind)}</span>`;
}
function card(item, eager) {
  return `<li class="specimen" data-group="${item.group}" data-text="${esc(item.description + ' ' + item.body)}">
    <a class="piece" href="work/${item.slug}.html">
      ${picture(item, '', !eager)}
      <span class="row-number mono" aria-hidden="true">${item.num}</span>
      <div class="caption">${kind(item)}<h2>${esc(item.title)}</h2></div>
      <time datetime="${item.date}">${shortDate(item.date)}</time>
      <span class="row-arrow" aria-hidden="true">↗</span>
    </a></li>`;
}
const map = `<nav class="overview" aria-label="Jump to any archive entry">
  <div class="map-head mono"><span>Collection map</span><span>01 — ${number(pieces.length)}</span></div>
  <div class="map-grid">${pieces.map(item => `<a href="work/${item.slug}.html" class="mark ${item.color}" title="${esc(item.title)}" aria-label="${item.num}. ${esc(item.title)}" data-group="${item.group}"></a>`).join('')}</div>
  <div class="map-caption"><span class="map-pointer" aria-hidden="true">↳</span> <span id="map-label">Jump to any piece</span></div>
</nav>`;
const formats = ['All work', ...new Set(groups.values())];
const formatCount = group => group === 'All work' ? pieces.length : pieces.filter(p => p.group === group).length;
const buttons = formats.map((group, i) => {
  const count = formatCount(group);
  return `<button class="tab" type="button" data-filter="${group}" aria-pressed="${i === 0}">${group} <small>${count}</small></button>`;
}).join('');
const home = `<section class="intro" aria-labelledby="archive-title">
  <div><h1 id="archive-title">Working <em>archive</em></h1>
  <p>Tools, conversations and experiments in working with AI.</p></div>${map}</section>
  <div class="controls" hidden>
    <div class="filters" role="group" aria-label="Filter by format">${buttons}</div>
    <select id="mobile-filter" aria-label="Filter by format">${formats.map(group => `<option value="${group}">${group} (${formatCount(group)})</option>`).join('')}</select>
    <div class="utilities">
      <div class="search-wrap"><button class="icon-button search-toggle" type="button" aria-label="Search the archive" aria-expanded="false" aria-controls="search-panel"><i class="search-icon"></i></button>
      <div class="search-panel" id="search-panel" hidden><label for="search">Search the archive</label><div><input type="search" id="search" autocomplete="off" placeholder="Title or text…" aria-controls="collection"><button type="button" id="close-search" aria-label="Close search">×</button></div></div></div>
      <div class="views" role="group" aria-label="Archive layout"><button class="icon-button" data-view="gallery" aria-label="Gallery view" aria-pressed="true" title="Gallery view"><i class="grid-icon"></i></button><button class="icon-button" data-view="list" aria-label="List view" aria-pressed="false" title="List view"><i class="list-icon"></i></button></div>
    </div>
  </div>
  <p class="sr" role="status" id="results"></p>
  <ul class="collection" id="collection">${pieces.map((item, i) => card(item, i < 8)).join('')}</ul>
  <div class="empty" hidden><p>No matching pieces.</p><button class="underlink" type="button">Show all work</button></div>`;
function link(url, label) {
  if (new URL(url).protocol !== 'https:') throw new Error('Expected HTTPS link');
  return `<a href="${esc(url)}">${esc(label)}</a>`;
}
function detail(item) {
  const more = related[item.id].map(id => {
    const other = orderedById.get(id);
    if (!other || other === item) throw new Error('Invalid related entry for ' + item.id);
    return `<li><a href="${other.slug}.html"><span class="related-thumb ${other.color}"><img alt="" src="../objects/${other.object}.png"></span><span>${kind(other)}<strong>${esc(other.title)}</strong></span><span class="more-arrow" aria-hidden="true">↗</span></a></li>`;
  }).join('');
  const sourceLabel = item.kind === 'Repository' ? 'View repository' : 'Open document';
  const links = item.url ? [link(item.url, sourceLabel)] : [];
  let remaining = item.body;
  let bodyHtml = '';
  for (const source of item.links) {
    const position = remaining.indexOf(source.label);
    if (position < 0) throw new Error('Missing link label in ' + item.id);
    bodyHtml += esc(remaining.slice(0, position)) + link(source.url, source.label);
    remaining = remaining.slice(position + source.label.length);
  }
  const body = (bodyHtml + esc(remaining)).split(/\n\s*\n/).map(text => `<p>${text.replaceAll('\n', '<br>')}</p>`).join('');
  return `<nav class="backnav"><a class="return" href="../index.html"><span aria-hidden="true">←</span> All work</a></nav>
    <article class="reading"><div class="cover">${picture(item, '../', false)}</div>
    <div class="reading-text"><div class="record-meta">${kind(item)}<span>·</span><time datetime="${item.date}">${shortDate(item.date)}</time></div>
    <h1>${esc(item.title)}</h1>
    ${item.description !== item.body ? `<p class="standfirst">${esc(item.description)}</p>` : ''}
    <div class="body-copy">${body}</div>
    ${links.length ? `<div class="sources">${links.join('')}</div>` : ''}</div></article>
    <section class="connections"><h2>Related work</h2><ul>${more}</ul></section>`;
}
await mkdir('dist/work', {recursive: true});
await cp('public', 'dist', {recursive: true});
await writeFile('dist/index.html', page('Working archive — Alejo Acelas', 'Tools, conversations and experiments in working with AI, by Alejo Acelas.', '', home));
await Promise.all(pieces.map(item => writeFile(`dist/work/${item.slug}.html`, page(`${item.title} — Alejo Acelas`, item.description, '../', detail(item)))));
