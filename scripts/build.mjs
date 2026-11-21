import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';

const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const documents = await readJson('content/documents.json');
const feed = await readJson('public/feed.json');

function escape(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function link(url, label) {
  if (new URL(url).protocol !== 'https:') throw new Error('Expected HTTPS link');
  return `<a href="${escape(url)}">${escape(label)}</a>`;
}

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Europe/London'
});
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London'
});

const rows = documents.map(doc => `
  <li><span class="doc-icon" aria-hidden="true"></span>
    <div><span class="meta">${escape(doc.kind)} <span>·</span> ${dateFormat.format(new Date(doc.date))}</span>
    <h3>${link(doc.url, doc.title)}</h3>
    <p>${escape(doc.description)}</p></div></li>`).join('');

function messageBody(post) {
  let remaining = post.text;
  let html = '';
  const extra = [];
  for (const item of post.links) {
    const index = remaining.indexOf(item.label);
    const anchor = link(item.url, item.label);
    if (index < 0) {
      extra.push(anchor);
      continue;
    }
    html += escape(remaining.slice(0, index)) + anchor;
    remaining = remaining.slice(index + item.label.length);
  }
  return [html + escape(remaining), ...extra].join('<br>');
}

let lastDay;
const messages = feed.posts.map(post => {
  const instant = new Date(Number(post.ts) * 1000);
  const day = dateFormat.format(instant);
  const divider = day === lastDay ? '' : `<div class="divider"><span>${day}</span></div>`;
  lastDay = day;
  return `${divider}<article class="message">
    <span class="avatar" aria-hidden="true">A</span><div><header><strong>Alejo Acelas</strong>
    <time datetime="${instant.toISOString()}">${timeFormat.format(instant)}</time></header>
    <p>${messageBody(post)}</p></div></article>`;
});
const older = messages.length > 1
  ? `<details><summary>Earlier posts (${messages.length - 1})</summary>${messages.slice(1).join('')}</details>`
  : '';

const template = await readFile('index.html', 'utf8');
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await writeFile('dist/index.html', template.replace('{{documents}}', () => rows)
  .replace('{{channel}}', () => escape(feed.channel.replace(/^#/, '')))
  .replace('{{messages}}', () => (messages[0] || '<p class="empty">No recent posts to show.</p>') + older));
