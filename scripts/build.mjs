// Builds the site Vercel serves from `main`: the wiki page, the files it loads, and the published data.
// It needs no installed packages. `wiki/data.publish.js` is written only by `node wiki/build.mjs --release`,
// after every sharing check has passed, so nothing unchecked can reach `dist/`.
import { cp, mkdir, readFile, rm, access } from 'node:fs/promises';

const page = await readFile('wiki/index.html', 'utf8');
// Every local file the page names: scripts and stylesheets beside it. `data.js` is the published data.
const local = [...page.matchAll(/(?:src|href)="([^"#?:]+\.(?:js|css))"/g)].map(m => m[1]).filter(f => !f.includes('/'));
const data = 'wiki/data.publish.js';
try { await access(data); } catch { throw new Error(`${data} is missing: run \`node wiki/build.mjs --release\` first`); }
if (!(await readFile(data, 'utf8')).startsWith('window.DATA = ')) throw new Error(`${data} is not a data file`);

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });          // favicon, robots.txt, sitemap.xml
await cp('wiki/index.html', 'dist/index.html');
for (const f of local) await cp(f === 'data.js' ? data : `wiki/${f}`, `dist/${f}`);
console.log(`dist/: index.html, ${local.join(', ')} and public/`);
