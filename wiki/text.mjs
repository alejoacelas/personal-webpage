// The site as plain text, for people's AI assistants and anything else that cannot run the map.
// The page itself is a canvas that needs JavaScript, so a tool that fetches the address sees nothing.
// From the published data this writes: llms.txt (where to start), works.txt (one line per work),
// one file per topic and per work, and llms-full.txt (everything in one download). It also returns
// a block of ordinary HTML for index.html, so that fetching the home page says where the text is.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KIND = { post: 'Slack post', doc: 'Document', tool: 'Repository', site: 'Site', said: 'Call excerpt', other: 'Link' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const when = w => w.kind === 'said' ? `${MONTHS[+w.date.slice(5, 7) - 1]} ${w.date.slice(0, 4)}` : `${+w.date.slice(8, 10)} ${MONTHS[+w.date.slice(5, 7) - 1]} ${w.date.slice(0, 4)}`;

// HTML written by the build (Slack messages, documents, READMEs) back to readable text.
function toText(html, shift = 2) {
  const plain = s => s.replace(/<[^>]+>/g, '');
  return String(html || '')
    .replace(/<pre>(?:<code[^>]*>)?([\s\S]*?)(?:<\/code>)?<\/pre>/g, (_, c) => `\n\n\`\`\`\n${c.trim()}\n\`\`\`\n\n`)
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (_, href, t) => { const x = plain(t).trim(); return !x || x === href || href.replace(/^https?:\/\/(www\.)?/, '').startsWith(x.replace(/…$/, '')) ? href : `${x} (${href})`; })
    .replace(/<h([1-6])[^>]*>/g, (_, n) => `\n\n${'#'.repeat(Math.min(6, +n + shift))} `)
    .replace(/<li>/g, '\n- ').replace(/<br\s*\/?>/g, '\n').replace(/<\/t[dh]>/g, ' | ').replace(/<blockquote>/g, '\n\n> ')
    .replace(/<\/(p|div|h[1-6]|tr|blockquote|ul|ol|table)>/g, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// The whole published text of one work, as plain text.
export function bodyText(w) {
  if (w.kind === 'post') return [w.slack.replyingTo ? `(Replying in a thread. ${w.slack.replyingTo})` : '', ...w.slack.messages.map(m => toText(m.html)), w.slack.startsThread && w.slack.replies ? `(${w.slack.replies} ${w.slack.replies === 1 ? 'reply' : 'replies'} in the thread, not shown.)` : ''].filter(Boolean).join('\n\n');
  if (w.kind === 'doc') return w.doc?.html ? toText(w.doc.html) + (w.doc.cut ? '\n\n(The copy stops here; the rest is in the linked document.)' : '') : '';
  if (w.kind === 'tool') { const t = w.tool || {}; return t.unavailable ? '' : t.gist ? (t.files || []).map(f => `### ${f.name}\n\n${toText(f.html)}`).join('\n\n') : [t.description, t.readme ? `### README\n\n${toText(t.readme, 3)}` : ''].filter(Boolean).join('\n\n'); }
  if (w.kind === 'said') { const ex = w.said.excerpt; return ex ? ex.turns.map(t => t.me ? `Alejo: ${t.me}` : `[${ex.other}: ${t.other}]`).join('\n\n') + `\n\nThe quote: "${w.said.text}"\n(${w.said.setting}. Alejo's words are as spoken, with cuts marked; what the other person said is summarised.)` : `"${w.said.text}"\n(${w.said.setting}.)`; }
  return '';
}

export function textFiles(D, base = 'https://alejoacelas.com') {
  const P = new Map(D.patterns.map(p => [p.id, p]));
  const works = [...D.works].sort((a, b) => b.date.localeCompare(a.date));
  const inTopic = id => works.filter(w => w.patterns.some(p => p[0] === id));
  const where = w => w.kind === 'post' ? `Slack post in ${w.slack.channel === 'private-channel' ? 'a private channel' : '#' + w.slack.channel}` : w.kind === 'said' ? 'Said on a call' : ({ doc: 'Google Doc', sheet: 'Google Sheet', repo: 'GitHub repository', gist: 'GitHub gist', site: 'Live site', file: 'Link' })[w.sub] || KIND[w.kind];
  const line = w => `- ${w.date.slice(0, w.kind === 'said' ? 7 : 10)} | ${KIND[w.kind]} | ${w.title} | ${w.gloss} | ${base}/works/${w.id}.txt`;

  const work = (w, level = '#') => [
    `${level} ${w.title}`,
    [`${where(w)} · ${when(w)}`, w.patterns.length ? `Topics: ${w.patterns.map(p => P.get(p[0])?.label).filter(Boolean).join('; ')}` : '', w.url ? `Source: ${w.url}` : '', `On the map: ${base}/#/w/${w.id}`, `As text: ${base}/works/${w.id}.txt`].filter(Boolean).join('\n'),
    w.gloss ? `Summary: ${w.gloss}` : '',
    bodyText(w),
  ].filter(Boolean).join('\n\n');

  const count = k => works.filter(w => w.kind === k).length;
  const intro = `Alejo Acelas helps high-impact organisations use AI. This site is a map of work he has shared: ${count('post')} Slack posts, ${count('doc')} documents, ${count('tool')} repositories, ${count('site')} sites, ${count('said')} call excerpts and ${count('other')} other links (${works.length} works), grouped into ${D.patterns.length} topics.`;
  const files = new Map();

  files.set('llms.txt', `# Alejo Acelas

> ${intro}

The page at ${base}/ is an interactive map that needs JavaScript. Everything on it is also available as plain text, listed here. The text files are regenerated whenever the site is.

## How to read the site

- [Everything in one file](${base}/llms-full.txt): every work with its full text, newest first. Large; download it if you can run code, then search it locally.
- [Index of every work](${base}/works.txt): one line per work (date, kind, title, one-line summary, address of its text file). Read this to find what is relevant, then open the works you need.
- Topic files (below): a topic's summary followed by every work in it, in full.
- Search: \`GET ${base}/api/search?q=your+words\` returns the best-matching works as plain text. Add \`&n=20\` for more results.
- One work: \`${base}/works/<id>.txt\`, with ids as given in the index.

## Topics

${D.areas.map(a => `### ${a.label}\n\n${a.blurb}\n\n${D.patterns.filter(p => p.area === a.id).map(p => `- [${p.label}](${base}/topics/${p.id}.txt): ${p.summary.split(/(?<=\.)\s/)[0]} (${inTopic(p.id).length} works)`).join('\n')}`).join('\n\n')}

## Questions people ask

${(D.questions || []).map(q => `- ${q.question} See: ${q.patterns.map(id => `[${P.get(id)?.label}](${base}/topics/${id}.txt)`).join(', ')}.`).join('\n')}

## Contact

alejoacelas@gmail.com · https://calendly.com/alejoacelas/30m
`);

  files.set('works.txt', `# Every work on alejoacelas.com, newest first\n\nFormat: date | kind | title | summary | address of the full text. See ${base}/llms.txt for how the site is organised.\n\n${works.map(line).join('\n')}\n`);

  for (const p of D.patterns) {
    const list = inTopic(p.id), related = (p.related || []).filter(r => P.has(r.id));
    files.set(`topics/${p.id}.txt`, `# ${p.label}\n\nA topic on alejoacelas.com (${D.areas.find(a => a.id === p.area)?.label}). ${list.length} works. On the map: ${base}/#/p/${p.id}\n\n${p.summary}\n${related.length ? `\nRelated topics:\n${related.map(r => `- [${P.get(r.id).label}](${base}/topics/${r.id}.txt): ${r.why}`).join('\n')}\n` : ''}\nThe works in this topic, newest first (date | kind | title | summary | address of the full text). Each is given in full further down; if this file is cut short, open the ones you need by address.\n\n${list.map(line).join('\n')}\n\n---\n\n${list.map(w => work(w, '##')).join('\n\n---\n\n')}\n`);
  }
  for (const w of works) files.set(`works/${w.id}.txt`, work(w) + '\n');
  files.set('llms-full.txt', `# Alejo Acelas: everything on alejoacelas.com as text\n\n${intro}\n\nIndex and topic files: ${base}/llms.txt\n\n---\n\n${works.map(w => work(w, '##')).join('\n\n---\n\n')}\n`);

  // Ordinary HTML for the home page, out of sight of someone using the map but there for anything that reads the markup.
  const html = `<div class="sr" id="as-text">
<h1>Alejo Acelas</h1>
<p>${esc(intro)}</p>
<p>This page is an interactive map that needs JavaScript. If you are an AI assistant or are reading without it, everything is available as plain text: start at <a href="${base}/llms.txt">${base}/llms.txt</a>, read the index of every work at <a href="${base}/works.txt">${base}/works.txt</a>, download everything in one file from <a href="${base}/llms-full.txt">${base}/llms-full.txt</a>, or search with <code>GET ${base}/api/search?q=your+words</code>.</p>
<h2>Topics</h2>
<ul>${D.patterns.map(p => `<li><a href="${base}/topics/${p.id}.txt">${esc(p.label)}</a>: ${esc(p.summary.split(/(?<=\.)\s/)[0])}</li>`).join('')}</ul>
<h2>Every work</h2>
<p>Each link is the work's full text. Summaries are in the index at ${base}/works.txt.</p>
<ul>${works.map(w => `<li><a href="${base}/works/${w.id}.txt">${esc(w.title)}</a> (${KIND[w.kind]}, ${when(w)})</li>`).join('')}</ul>
<p>Contact: <a href="mailto:alejoacelas@gmail.com">alejoacelas@gmail.com</a>, <a href="https://calendly.com/alejoacelas/30m">calendly.com/alejoacelas/30m</a></p>
</div>`;
  return { files, html };
}
