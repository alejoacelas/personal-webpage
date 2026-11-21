const regions = [
  { topic: 'Using AI at work', id: 'work', color: '#c9e699', x: 24, y: 34, tilt: -13 },
  { topic: 'Working with agents', id: 'agents', color: '#9edad8', x: 70, y: 25, tilt: 18 },
  { topic: 'Tools for research', id: 'research', color: '#e2b49b', x: 41, y: 75, tilt: -25 },
  { topic: 'Thinking about AI', id: 'thinking', color: '#c6badf', x: 80, y: 70, tilt: 8 }
];

function contours(region, index, count) {
  // Each contour is a scaled outline of the same island, like a bathymetric chart.
  const pixels = [];
  const rings = 12;
  for (let ring = 1; ring <= rings; ring++) {
    const points = [];
    for (let step = 0; step < 96; step++) {
      const a = step * Math.PI / 48;
      const shape = 1 + .11 * Math.sin(3 * a + index) + .06 * Math.cos(5 * a - index * 2);
      const size = .11 + .89 * ring / rings;
      const x = 50 + size * (42 * shape * Math.cos(a) + 2 * Math.sin(a * 2));
      const y = 50 + size * 40 * shape * Math.sin(a);
      points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    pixels.push(`<polygon points="${points.join(' ')}" vector-effect="non-scaling-stroke"/>`);
  }
  const scale = Math.min(1.25, .78 + Math.sqrt(count) / 8);
  return `<svg class="atlas-land" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none"
    style="--x:${region.x}%;--y:${region.y}%;--tilt:${region.tilt}deg;--scale:${scale};--color:${region.color}">
    ${pixels.join('')}</svg>`;
}

export default function atlas(items, ui) {
  const active = regions.map(r => ({...r, entries:items.filter(item => item.topic === r.topic)}))
    .filter(r => r.entries.length);
  return `<div class="atlas"><div class="atlas-wrap">
    <header class="atlas-head"><strong>Alejo Acelas</strong><span>AI uplift consultant</span></header>
    <div class="atlas-title"><h1>Topic atlas<span>.</span></h1><p>Explore my work on AI by subject.</p></div>
    <nav class="atlas-map" aria-label="Map of topics">
      <div class="atlas-grid" aria-hidden="true"></div>
      ${active.map((r, i) => `${contours(r,i,r.entries.length)}
        <a class="atlas-pin" href="#atlas-${r.id}" style="--x:${r.x}%;--y:${r.y}%;--color:${r.color}">
          <i aria-hidden="true"></i><span>${r.topic}<small>${r.entries.length} ${r.entries.length === 1 ? 'item' : 'items'} ↓</small></span>
        </a>`).join('')}
    </nav>
    <div class="atlas-directory">${active.map(r => `<section class="atlas-region" id="atlas-${r.id}" style="--color:${r.color}">
      <h2><i aria-hidden="true"></i>${r.topic}</h2>
      <div>${r.entries.map(item => `<article><span>${ui.esc(item.kind)} · ${ui.date(item)}</span><h3>${ui.entry(item)}</h3></article>`).join('')}</div>
    </section>`).join('')}</div>
    </div></div>`;
}

export const css = `
.atlas { background:#102c29; color:#ecf0df; min-height:100vh; font-family:system-ui,sans-serif; }
.atlas * { box-sizing:border-box; }
.atlas-wrap { max-width:1400px; margin:auto; padding:0 clamp(20px,5vw,80px) 75px; }
.atlas-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:19px 0; border-bottom:1px solid #49625a; font:13px/1.4 ui-monospace,monospace; }
.atlas-head strong { font:600 19px/1.2 system-ui,sans-serif; letter-spacing:-.055em; }
.atlas-head span { color:#c5d5c8; }
.atlas-title { display:flex; align-items:flex-end; justify-content:space-between; gap:20px; padding:clamp(20px,3vw,48px) 0 22px; }
.atlas-title h1 { margin:0; font:500 clamp(57px,7.6vw,104px)/.91 system-ui,sans-serif; letter-spacing:-.09em; }
.atlas-title h1 span { color:#bbdca2; }
.atlas-title p { margin:0 0 3px; font:15px/1.5 ui-monospace,monospace; color:#c5d5c8; }
.atlas-map { position:relative; isolation:isolate; overflow:hidden; height:clamp(300px,32vw,440px); background:#12332f; border:1px solid #486459; }
.atlas-grid { position:absolute; inset:0; background-image:linear-gradient(to right,#64796824 1px,transparent 1px),linear-gradient(to bottom,#64796824 1px,transparent 1px); background-size:42px 42px; }
.atlas-map::after { content:""; position:absolute; pointer-events:none; inset:6px; border:1px dashed #77938045; }
.atlas-land { position:absolute; left:var(--x); top:var(--y); transform:translate(-50%,-50%) rotate(var(--tilt)) scale(var(--scale)); width:42%; height:77%; color:var(--color); opacity:.57; }
.atlas-land polygon { fill:none; stroke:currentColor; stroke-width:.7px; }
.atlas-pin { position:absolute; z-index:1; left:var(--x); top:var(--y); transform:translate(-50%,-50%); display:flex; align-items:center; gap:7px; text-decoration:none; color:#102c29; border-radius:3px; border:1px solid #102c29; box-shadow:2px 3px 0 #102c29; background:var(--color); padding:7px 11px; white-space:nowrap; font:600 clamp(14px,1.45vw,21px)/1.1 system-ui,sans-serif; letter-spacing:-.045em; }
.atlas-pin i,.atlas-region h2 i { background:currentColor; width:7px; height:7px; transform:rotate(45deg); flex:none; }
.atlas-pin small { display:block; margin-top:3px; font:10px/1 ui-monospace,monospace; letter-spacing:0; }
.atlas-pin:hover,.atlas-pin:focus-visible { outline:2px solid var(--color); outline-offset:4px; color:#102c29; }
.atlas-directory { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:36px 5%; padding-top:32px; }
.atlas-region { scroll-margin:70px; }
.atlas-region h2 { display:flex; align-items:center; gap:12px; margin:0; padding-bottom:11px; border-bottom:2px solid var(--color); color:var(--color); font:500 clamp(21px,2.5vw,36px)/1.15 system-ui,sans-serif; letter-spacing:-.065em; }
.atlas-region article { padding:11px 0 13px; border-bottom:1px solid #45615b; }
.atlas-region article span { color:#b9cdc0; font:11px/1.2 ui-monospace,monospace; }
.atlas-region article h3 { margin:4px 0 0; font:500 18px/1.3 system-ui,sans-serif; letter-spacing:-.035em; }
.atlas-region h3 :is(a,button) { appearance:none; background:none; border:none; padding:0; color:inherit; font:inherit; letter-spacing:inherit; text-align:left; cursor:pointer; text-decoration:none; }
.atlas-region h3 :is(a,button):hover,.atlas-region h3 :is(a,button):focus-visible { color:var(--color); text-decoration:underline; text-underline-offset:3px; }
@media(max-width:650px) {
 .atlas-title { display:block; }
 .atlas-title p { margin:10px 0 0; font-size:12px; }
 .atlas-map { height:300px; }
 .atlas-pin { width:40%; white-space:normal; font-size:15px; }
 .atlas-pin:nth-of-type(2) { left:73%; }
 .atlas-pin:nth-of-type(3) { left:27%; }
 .atlas-pin:nth-of-type(4) { left:76%; }
 .atlas-land { width:53%; height:50%; }
 .atlas-land:nth-of-type(3) { left:27%; }
 .atlas-directory { grid-template-columns:1fr; gap:27px; padding-top:24px; }
}
`;
