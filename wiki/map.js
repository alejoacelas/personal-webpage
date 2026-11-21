// The map: an inked atlas drawn on one canvas. Zooming changes what is shown:
// area names, then pattern names, then work titles, then a card for every work.
window.MapView = (() => {
  const INK = '#40342a', PAPER = '#f8f2e2', SEA = '#dde5df', RUST = '#a4461f';
  const KIND = { post: '#611f69', doc: '#3f74c9', tool: '#2a6b52', site: '#1f8a84', said: '#c28a17', other: '#8f8d82' };
  const WASH = ['#e3b565', '#9fbf8e', '#dc9484', '#8eafcc', '#b9a3cf', '#84c2b3', '#d8c964', '#cda07c'];
  const SERIF = '"Cormorant Garamond", "Iowan Old Style", Georgia, serif';
  const TEXT = '"EB Garamond", "Iowan Old Style", Georgia, serif';
  const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
  const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
  const Z_TITLE = 1.05, Z_CARD = 2.3, Z_GLOSS = 3.3, Z_MAX = 5.5;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let cv, ctx, M, D, cb, W = 0, H = 0, dpr = 1, zFit = .3, zMin = .2;
  const cam = { x: 0, y: 0, z: .3 };
  let tween = null, zoomGoal = null, anchor = null, velocity = null, drag = null;
  let inset = 0, insetLeft = 0;
  let works = [], at = new Map(), byPattern = new Map(), patterns = [], areas = [];
  let shapes = {}, wash = null, mottle = null;
  let hover = null, focusPatterns = null;
  let sel = { works: new Set(), pattern: null, related: new Set() };
  let filter = null;
  let dirty = true, last = 0, clock = 0, wasClose = false;
  const fade = new Map();           // label key → shown amount, eased
  const plans = new Map();          // zoom bucket → which labels fit
  let hits = [];                    // what the last frame drew, for clicks

  // ---- Geometry helpers
  const cx = () => insetLeft + (W - inset - insetLeft) / 2, cy = () => H / 2;
  const sx = x => (x - cam.x) * cam.z + cx(), sy = y => (y - cam.y) * cam.z + cy();
  const wx = x => (x - cx()) / cam.z + cam.x, wy = y => (y - cy()) / cam.z + cam.y;
  function smooth(polys) {
    const p = new Path2D();
    for (const poly of polys) for (const ring of poly) {
      const n = ring.length; if (n < 3) continue;
      const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const start = mid(ring[n - 1], ring[0]);
      p.moveTo(start[0], start[1]);
      for (let i = 0; i < n; i++) { const m = mid(ring[i], ring[(i + 1) % n]); p.quadraticCurveTo(ring[i][0], ring[i][1], m[0], m[1]); }
      p.closePath();
    }
    return p;
  }
  const measured = new Map();
  function width(text, font) {
    const key = font + '|' + text;
    if (!measured.has(key)) { ctx.font = font; measured.set(key, ctx.measureText(text).width); }
    return measured.get(key);
  }
  const wrapped = new Map();
  function wrap(text, font, max, lines) {
    const key = font + '|' + Math.round(max) + '|' + lines + '|' + text;
    if (wrapped.has(key)) return wrapped.get(key);
    const out = []; let line = '';
    for (let word of String(text).split(/\s+/)) {
      if (width(word, font) > max) { while (word.length > 3 && width(word + '…', font) > max) word = word.slice(0, -1); word += '…'; }
      const next = line ? line + ' ' + word : word;
      if (width(next, font) <= max || !line) line = next; else { out.push(line); line = word; }
      if (out.length === lines) break;
    }
    if (out.length < lines && line) out.push(line);
    else if (out.length === lines && line) { let l = out[lines - 1]; while (l && width(l + '…', font) > max) l = l.slice(0, -1); out[lines - 1] = l.replace(/[\s,.;:]+$/, '') + '…'; }
    wrapped.set(key, out);
    return out;
  }
  const dayOf = d => `${+d.slice(8, 10)} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
  const source = w => w.kind === 'post' ? '#' + w.slack.channel : w.kind === 'said' ? 'said on a call' : ({ doc: 'Google Doc', sheet: 'Google Sheet', repo: 'repository', gist: 'gist', site: 'live site', file: 'link' })[w.sub] || w.sub;
  const shortDay = d => `${+d.slice(8, 10)} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+d.slice(5, 7) - 1]} ’${d.slice(2, 4)}`;

  // ---- One-off artwork
  function buildArt() {
    shapes = {
      land: smooth(M.land), rings: M.rings.map(smooth), hills: M.hills.map(smooth),
      territory: Object.fromEntries(Object.entries(M.territories).map(([id, polys]) => [id, smooth(polys)])),
    };
    // Watercolour: paint each territory small, then blur by shrinking and stretching.
    const k = 1 / 14, small = document.createElement('canvas');
    small.width = Math.ceil(M.width * k); small.height = Math.ceil(M.height * k);
    const s = small.getContext('2d');
    s.fillStyle = PAPER; s.fillRect(0, 0, small.width, small.height);
    s.scale(k, k);
    areas.forEach((a, i) => { if (shapes.territory[a.id]) { s.fillStyle = WASH[i % WASH.length]; s.fill(shapes.territory[a.id]); } });
    const tiny = document.createElement('canvas'); tiny.width = Math.ceil(small.width / 5); tiny.height = Math.ceil(small.height / 5);
    const t = tiny.getContext('2d'); t.imageSmoothingQuality = 'high'; t.drawImage(small, 0, 0, tiny.width, tiny.height);
    wash = document.createElement('canvas'); wash.width = small.width; wash.height = small.height;
    const w = wash.getContext('2d'); w.imageSmoothingQuality = 'high';
    w.drawImage(tiny, 0, 0, wash.width, wash.height);
    w.globalAlpha = .35; w.drawImage(small, 0, 0);          // keep a little of the crisp edge, like pigment pooling
    // Mottling, so the washes are uneven the way paint is.
    const n = 256, tile = document.createElement('canvas'); tile.width = tile.height = n;
    const g = tile.getContext('2d'), img = g.createImageData(n, n);
    const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 144665) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
    const noise = (x, y, f, s) => { const X = x / f, Y = y / f, xi = Math.floor(X), yi = Math.floor(Y), fx = X - xi, fy = Y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), m = n / f, q = (i, j) => hash(((i % m) + m) % m, ((j % m) + m) % m, s); return q(xi, yi) * (1 - u) * (1 - v) + q(xi + 1, yi) * u * (1 - v) + q(xi, yi + 1) * (1 - u) * v + q(xi + 1, yi + 1) * u * v; };
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = .55 * noise(x, y, 64, 1) + .3 * noise(x, y, 16, 2) + .15 * noise(x, y, 4, 3);
      const i = (y * n + x) * 4; img.data[i] = 96; img.data[i + 1] = 70; img.data[i + 2] = 40; img.data[i + 3] = Math.max(0, v - .38) * 150;
    }
    g.putImageData(img, 0, 0);
    mottle = ctx.createPattern(tile, 'repeat');
  }

  // ---- Which labels fit at a zoom level. Sizes are in screen pixels, so this only depends on zoom.
  const patternFont = z => `italic 500 ${z < zFit * 1.5 ? 13 : z < 1 ? 15.5 : 17}px ${TEXT}`;
  const far = z => Math.max(0, Math.min(1, (zFit * 1.9 - z) / (zFit * .7)));      // 1 at the whole-map view, 0 once zoomed in
  const areaSize = z => 22 * Math.min(3.4, (z / zFit) ** .7);
  function areaLines(a) {
    if (a.lines) return a.lines;
    const out = []; let line = '';
    for (const word of a.label.toUpperCase().split(/\s+/)) { if (line && (line + ' ' + word).length > 17) { out.push(line); line = word; } else line = line ? line + ' ' + word : word; }
    if (line) out.push(line);
    return a.lines = out;
  }
  function areaBox(a, z) {
    const size = areaSize(z), lines = areaLines(a), wide = Math.max(...lines.map(l => l.length)) * size * .86, tall = lines.length * size * 1.16;
    return [a.spot[0] * z - wide / 2, a.spot[1] * z - tall / 2, a.spot[0] * z + wide / 2, a.spot[1] * z + tall / 2];
  }
  const titleFont = `500 11.5px ${SANS}`;
  function plan(z) {
    const key = Math.round(Math.log2(z) * 6);
    if (plans.has(key)) return plans.get(key);
    const zz = 2 ** (key / 6), placed = [], shown = new Set();
    const free = r => !placed.some(p => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1]);
    const font = patternFont(zz), size = parseFloat(font.match(/([\d.]+)px/)[1]);
    if (far(zz) > .5) for (const a of areas) if (a.spot) placed.push(areaBox(a, zz));
    for (const p of patterns) {
      const lines = wrap(p.label, font, 150, 3), w = Math.max(...lines.map(l => width(l, font))), h = lines.length * size * 1.12;
      const r = [p.x * zz - w / 2 - 5, p.y * zz - h / 2 - 3, p.x * zz + w / 2 + 5, p.y * zz + h / 2 + 3];
      if (free(r)) { placed.push(r); shown.add('p:' + p.id); }
    }
    if (zz >= Z_TITLE && zz < Z_CARD) {
      const radius = markRadius(zz);
      const marks = works.map(w => [w.x * zz - radius - 1, w.y * zz - radius - 1, w.x * zz + radius + 1, w.y * zz + radius + 1]);
      works.forEach((w, i) => {
        const tw = Math.min(170, width(w.title, titleFont)), x = w.x * zz + radius + 5, y = w.y * zz;
        const r = [x - 2, y - 8, x + tw + 4, y + 8];
        if (free(r) && !marks.some((m, j) => j !== i && r[0] < m[2] && r[2] > m[0] && r[1] < m[3] && r[3] > m[1])) { placed.push(r); shown.add('w:' + w.id); }
      });
    }
    plans.set(key, shown);
    return shown;
  }
  const markRadius = z => Math.max(2.4, Math.min(6.5, 1.5 + 3 * z));

  // ---- Drawing
  const lit = w => (!filter || filter(w)) && (!focus() || focus().has(w.id));
  function focus() {
    if (hover?.type === 'pattern') return byPattern.get(hover.id);
    if (focusPatterns) return focusPatterns;
    if (sel.works.size > 1) return sel.works;
    return null;
  }
  function shownAmount(key, want, dt) {
    const now = fade.get(key) ?? 0, next = still ? want : now + (want - now) * Math.min(1, dt / 110);
    if (Math.abs(next - want) > .01) dirty = true;
    fade.set(key, Math.abs(next - want) < .01 ? want : next);
    return fade.get(key);
  }
  function halo(text, x, y, fill, strength = 3.2) {
    ctx.lineJoin = 'round'; ctx.lineWidth = strength; ctx.strokeStyle = 'rgba(250,245,232,.92)';
    ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }
  function symbol(kind, x, y, r) {
    ctx.beginPath();
    if (kind === 'doc') ctx.rect(x - r * .72, y - r, r * 1.44, r * 2);
    else if (kind === 'tool') { ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 1.15, y); ctx.lineTo(x, y + r * 1.15); ctx.lineTo(x - r * 1.15, y); ctx.closePath(); }
    else if (kind === 'said') { ctx.moveTo(x - r, y + r); ctx.lineTo(x - r, y); ctx.arc(x, y, r, Math.PI, Math.PI * 2.5); ctx.closePath(); }
    else if (kind === 'other') ctx.rect(x - r * .8, y - r * .8, r * 1.6, r * 1.6);
    else ctx.arc(x, y, r, 0, 2 * Math.PI);
    if (kind === 'site' || kind === 'other') { ctx.fillStyle = PAPER; ctx.fill(); ctx.lineWidth = Math.max(1.4, r * .42); ctx.strokeStyle = KIND[kind]; ctx.stroke(); }
    else { ctx.fillStyle = KIND[kind]; ctx.fill(); if (r > 3.4) { ctx.lineWidth = .8; ctx.strokeStyle = 'rgba(40,30,20,.55)'; ctx.stroke(); } }
  }
  function curve(a, b, bend = .16) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx - dy * bend, my + dx * bend, b.x, b.y);
  }
  function compass(x, y, r) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.globalAlpha = .5; ctx.lineWidth = 1.2 / cam.z;
    for (const [radius, a] of [[r, .5], [r * .78, .28]]) { ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(0, 0, radius, 0, 2 * Math.PI); ctx.stroke(); }
    for (let i = 0; i < 16; i++) {
      const long = i % 4 === 0, mid = i % 2 === 0, len = long ? r * 1.18 : mid ? r * .74 : r * .42, a = i * Math.PI / 8, w = long ? .11 : .08;
      ctx.globalAlpha = long ? .7 : .45;
      ctx.beginPath(); ctx.moveTo(Math.sin(a) * len, -Math.cos(a) * len); ctx.lineTo(Math.sin(a + w * 2.2) * r * .17, -Math.cos(a + w * 2.2) * r * .17); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = long ? .6 : .35;
      ctx.beginPath(); ctx.moveTo(Math.sin(a) * len, -Math.cos(a) * len); ctx.lineTo(Math.sin(a - w * 2.2) * r * .17, -Math.cos(a - w * 2.2) * r * .17); ctx.lineTo(0, 0); ctx.closePath(); ctx.stroke();
    }
    ctx.globalAlpha = .7; ctx.font = `600 ${r * .36}px ${SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('N', 0, -r * 1.3);
    ctx.restore();
  }

  function card(w, z, alpha) {
    const cw = Math.max(132, Math.min(236, 56 * z)), pad = 9, inner = cw - pad * 2;
    const isSaid = w.kind === 'said';
    const tf = isSaid ? `italic 500 14.5px ${TEXT}` : w.kind === 'tool' ? `600 11px ${MONO}` : `600 12px ${SANS}`, th = isSaid ? 17 : 15;
    const title = isSaid ? wrap('“' + w.pull + '”', tf, inner, z >= Z_GLOSS ? 7 : 4) : wrap(w.title, tf, inner, 3);
    const gf = `400 11px ${SANS}`, gloss = z >= Z_GLOSS && !isSaid && w.gloss ? wrap(w.gloss, gf, inner, 4) : [];
    const h = pad + 12 + title.length * th + (gloss.length ? 5 + gloss.length * 14 : 0) + pad - 2;
    const x = Math.round(sx(w.x) - cw / 2), y = Math.round(sy(w.y) - h / 2);
    const hot = hover?.type === 'work' && hover.id === w.id, chosen = sel.works.size === 1 && sel.works.has(w.id);
    ctx.save(); ctx.globalAlpha = alpha * (lit(w) ? 1 : .32);
    if (hot) { ctx.translate(x + cw / 2, y + h / 2); ctx.scale(1.035, 1.035); ctx.translate(-x - cw / 2, -y - h / 2); }
    ctx.shadowColor = hot ? 'rgba(60,40,20,.34)' : 'rgba(60,40,20,.18)'; ctx.shadowBlur = hot ? 16 : 7; ctx.shadowOffsetY = hot ? 5 : 2;
    ctx.fillStyle = isSaid ? '#fdf6e1' : '#fffdf8';
    ctx.beginPath(); ctx.roundRect(x, y, cw, h, 3.5); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = chosen || hot ? 1.6 : 1; ctx.strokeStyle = chosen || hot ? RUST : 'rgba(64,52,42,.38)'; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, cw, h, 3.5); ctx.clip(); ctx.fillStyle = KIND[w.kind]; ctx.fillRect(x, y, 3.5, h); ctx.restore();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `400 9.5px ${MONO}`; ctx.fillStyle = 'rgba(64,52,42,.72)';
    const when = shortDay(w.date), room = inner - width(when, ctx.font) - 10;
    let src = source(w); if (width(src, ctx.font) > room) { while (src.length > 4 && width(src + '…', ctx.font) > room) src = src.slice(0, -1); src += '…'; }
    ctx.fillText(src, x + pad + 2, y + pad + 7); ctx.textAlign = 'right'; ctx.fillText(when, x + cw - pad, y + pad + 7); ctx.textAlign = 'left';
    ctx.font = tf; ctx.fillStyle = hot ? RUST : '#2b2620';
    title.forEach((l, i) => ctx.fillText(l, x + pad + 2, y + pad + 12 + (i + 1) * th - 3));
    if (gloss.length) { ctx.font = gf; ctx.fillStyle = 'rgba(64,52,42,.82)'; gloss.forEach((l, i) => ctx.fillText(l, x + pad + 2, y + pad + 12 + title.length * th + 5 + (i + 1) * 14 - 3)); }
    ctx.restore();
    hits.push({ type: 'work', id: w.id, box: [x, y, x + cw, y + h] });
  }

  function draw(dt) {
    const z = cam.z;
    hits = [];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = SEA; ctx.fillRect(0, 0, W, H);
    const world = () => ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (cx() - cam.x * z), dpr * (cy() - cam.y * z));
    const screen = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const px = n => n / z;

    world();
    // Sea: waterlines hugging the coast, fainter further out.
    shapes.rings.forEach((ring, i) => { ctx.strokeStyle = `rgba(86,122,134,${[.5, .3, .16][i]})`; ctx.lineWidth = px([1, .9, .8][i]); ctx.stroke(ring); });
    // Land, washes, relief.
    ctx.fillStyle = PAPER; ctx.fill(shapes.land);
    ctx.save(); ctx.clip(shapes.land);
    ctx.globalAlpha = .62; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(wash, 0, 0, M.width, M.height);
    ctx.globalAlpha = .5; ctx.globalCompositeOperation = 'multiply'; mottle.setTransform(new DOMMatrix().scale(2.6)); ctx.fillStyle = mottle; ctx.fillRect(0, 0, M.width, M.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(88,62,34,.10)'; ctx.globalAlpha = 1;
    for (const wide of [26, 13, 6]) { ctx.lineWidth = px(wide) * Math.min(1.6, Math.max(.7, z * 1.5)); ctx.stroke(shapes.land); }
    ctx.setLineDash([px(5), px(4)]); ctx.strokeStyle = 'rgba(64,52,42,.36)'; ctx.lineWidth = px(1);
    for (const a of areas) if (shapes.territory[a.id]) ctx.stroke(shapes.territory[a.id]);
    ctx.setLineDash([]);
    shapes.hills.forEach((hill, i) => { ctx.strokeStyle = `rgba(88,62,34,${.13 + i * .03})`; ctx.lineWidth = px(.8); ctx.stroke(hill); });
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = px(1.5); ctx.lineJoin = 'round'; ctx.stroke(shapes.land);
    compass(230, 230, 105);

    // What is singled out: a pattern's ground, and the routes that leave it.
    const hotPattern = hover?.type === 'pattern' ? hover.id : sel.pattern;
    const glow = hover?.type === 'pattern' ? byPattern.get(hover.id) : focusPatterns || (sel.works.size > 1 ? sel.works : null);
    if (glow) {
      ctx.beginPath();
      for (const id of glow) { const w = at.get(id); if (w) { ctx.moveTo(w.x + 34, w.y); ctx.arc(w.x, w.y, 34, 0, 2 * Math.PI); } }
      ctx.fillStyle = 'rgba(164,70,31,.13)'; ctx.fill();
    }
    if (hotPattern) {
      const p = patterns.find(p => p.id === hotPattern);
      ctx.strokeStyle = 'rgba(164,70,31,.75)'; ctx.lineWidth = px(1.6); ctx.setLineDash([px(7), px(5)]);
      for (const r of p?.related || []) { const o = patterns.find(q => q.id === r.id); if (o) { curve(p, o); ctx.stroke(); } }
      ctx.setLineDash([]);
    }
    const linked = new Set();
    const one = hover?.type === 'work' ? at.get(hover.id) : sel.works.size === 1 ? at.get([...sel.works][0]) : null;
    if (one) {
      ctx.strokeStyle = 'rgba(164,70,31,.8)'; ctx.lineWidth = px(1.5);
      for (const l of one.links) { const o = at.get(l.to); if (o) { linked.add(o.id); curve(one, o, .12); ctx.stroke(); } }
    }

    screen();
    // Area names: bold when the whole map is in view, ghosted like country names once you zoom in.
    const size = areaSize(z), f = far(z);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `600 ${size}px ${SERIF}`;
    try { ctx.letterSpacing = `${size * .22}px`; } catch {}
    for (const a of areas) {
      if (!a.spot) continue;
      const lines = areaLines(a), x = sx(a.spot[0]), y = sy(a.spot[1]), hot = hover?.type === 'area' && hover.id === a.id;
      ctx.globalAlpha = hot ? .95 : .24 + .68 * f;
      lines.forEach((l, i) => { const yy = y + (i - (lines.length - 1) / 2) * size * 1.16; if (f > .05) { ctx.globalAlpha = (hot ? .95 : .24 + .68 * f) * f; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(250,245,232,.85)'; ctx.lineJoin = 'round'; ctx.strokeText(l, x, yy); ctx.globalAlpha = hot ? .95 : .24 + .68 * f; } ctx.fillStyle = hot ? RUST : INK; ctx.fillText(l, x, yy); });
      const box = areaBox(a, z), ox = sx(0), oy = sy(0);
      hits.push({ type: 'area', id: a.id, box: [box[0] + ox, box[1] + oy, box[2] + ox, box[3] + oy] });
    }
    try { ctx.letterSpacing = '0px'; } catch {}
    ctx.globalAlpha = 1;

    // Works.
    const r = markRadius(z), cards = z >= Z_CARD - .25 ? Math.min(1, (z - (Z_CARD - .25)) / .25) : 0;
    const shown = plan(z), view = [wx(-140), wy(-90), wx(W + 140), wy(H + 90)];
    const visible = works.filter(w => w.x > view[0] && w.x < view[2] && w.y > view[1] && w.y < view[3]);
    for (const w of visible) {
      const x = sx(w.x), y = sy(w.y), hot = hover?.type === 'work' && hover.id === w.id, chosen = sel.works.size === 1 && sel.works.has(w.id);
      if (cards < 1) {
        ctx.globalAlpha = (1 - cards) * (lit(w) ? 1 : .22);
        symbol(w.kind, x, y, hot || chosen ? r * 1.55 : linked.has(w.id) ? r * 1.25 : r);
        if (hot || chosen || linked.has(w.id)) { ctx.beginPath(); ctx.arc(x, y, r * (hot || chosen ? 1.55 : 1.25) + 3.5, 0, 2 * Math.PI); ctx.strokeStyle = RUST; ctx.lineWidth = 1.6; ctx.stroke(); }
        hits.push({ type: 'work', id: w.id, at: [x, y], reach: Math.max(r + 4, 8) });
      }
      const t = shownAmount('w:' + w.id, shown.has('w:' + w.id) && cards < .5 ? 1 : 0, dt);
      if (t > .02) { ctx.globalAlpha = t * (lit(w) ? .95 : .3); ctx.font = titleFont; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; let label = w.title; while (width(label, titleFont) > 170 && label.length > 6) label = label.slice(0, -2); halo(label === w.title ? label : label.trimEnd() + '…', x + r + 5, y + .5, hot ? RUST : '#2f2921', 2.8); }
    }
    ctx.globalAlpha = 1;
    if (cards > 0) {
      const order = visible.slice().sort((a, b) => (hover?.id === a.id) - (hover?.id === b.id) || a.y - b.y);
      for (const w of order) card(w, z, cards);
    }
    if (one && sel.works.has(one.id) && cards < 1 && !still) {   // a slow pulse on the open work
      const pulse = (clock / 1400) % 1; ctx.globalAlpha = (1 - pulse) * .7; ctx.beginPath(); ctx.arc(sx(one.x), sy(one.y), r * 1.55 + 4 + pulse * 16, 0, 2 * Math.PI); ctx.strokeStyle = RUST; ctx.lineWidth = 1.4; ctx.stroke(); ctx.globalAlpha = 1; dirty = true;
    }

    // Pattern names.
    const font = patternFont(z), psize = parseFloat(font.match(/([\d.]+)px/)[1]);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font;
    for (const p of patterns) {
      const hot = hotPattern === p.id, near = sel.related.has(p.id) || focusPatterns?.pattern?.has?.(p.id);
      const want = shown.has('p:' + p.id) || hot || near ? (z >= Z_CARD ? .9 : 1) : 0;
      const t = shownAmount('p:' + p.id, want, dt);
      if (t < .02) continue;
      const lines = wrap(p.label, font, 150, 3), x = sx(p.x), y = sy(p.y);
      ctx.font = font; ctx.globalAlpha = t * (focus() && !hot && !near && !(hover?.type === 'pattern') && sel.pattern ? .55 : 1);
      let wide = 0;
      lines.forEach((l, i) => { halo(l, x, y + (i - (lines.length - 1) / 2) * psize * 1.12, hot ? RUST : near ? '#7a3a1c' : '#2b2118', 3.6); wide = Math.max(wide, width(l, font)); });
      hits.push({ type: 'pattern', id: p.id, box: [x - wide / 2 - 4, y - lines.length * psize * .6, x + wide / 2 + 4, y + lines.length * psize * .6] });
    }
    ctx.globalAlpha = 1;
    if (M.loose && z > zFit * 1.2) { ctx.font = `italic 500 13px ${TEXT}`; ctx.globalAlpha = .7; halo('not yet sorted', sx(M.loose[0]), sy(M.loose[1]) - 46 * z - 8, INK); ctx.globalAlpha = 1; }
  }

  // ---- Camera
  const clampCam = () => { cam.x = Math.max(0, Math.min(M.width, cam.x)); cam.y = Math.max(0, Math.min(M.height, cam.y)); cam.z = Math.max(zMin, Math.min(Z_MAX, cam.z)); };
  function frame(now) {
    const dt = Math.min(50, now - last || 16); last = now; clock = now;
    if (tween) {
      const t = Math.min(1, (now - tween.start) / tween.ms), e = t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      cam.x = tween.from.x + (tween.to.x - tween.from.x) * e; cam.y = tween.from.y + (tween.to.y - tween.from.y) * e;
      cam.z = Math.exp(Math.log(tween.from.z) + (Math.log(tween.to.z) - Math.log(tween.from.z)) * e);
      if (t === 1) tween = null; dirty = true;
    }
    if (zoomGoal) {
      const next = Math.exp(Math.log(cam.z) + (Math.log(zoomGoal) - Math.log(cam.z)) * Math.min(1, dt / 70));
      cam.z = Math.abs(next - zoomGoal) / zoomGoal < .002 ? zoomGoal : next;
      cam.x = anchor.wx - (anchor.sx - cx()) / cam.z; cam.y = anchor.wy - (anchor.sy - cy()) / cam.z;
      if (cam.z === zoomGoal) zoomGoal = null; dirty = true;
    }
    if (velocity && !drag) {
      cam.x -= velocity.x * dt / cam.z; cam.y -= velocity.y * dt / cam.z;
      velocity.x *= .92 ** (dt / 16); velocity.y *= .92 ** (dt / 16);
      if (Math.hypot(velocity.x, velocity.y) < .01) velocity = null; dirty = true;
    }
    if (dirty) { dirty = false; clampCam(); draw(dt); const close = cam.z > zFit * 1.45; if (close !== wasClose) { wasClose = close; cb.onZoom?.(close); } }
    requestAnimationFrame(frame);
  }
  function fly(to, ms = 900) {
    zoomGoal = null; velocity = null;
    to = { x: to.x ?? cam.x, y: to.y ?? cam.y, z: Math.max(zMin, Math.min(Z_MAX, to.z ?? cam.z)) };
    if (still || ms === 0) { Object.assign(cam, to); tween = null; dirty = true; return; }
    tween = { from: { ...cam }, to, start: performance.now(), ms };
  }
  function fit(ids, { maxZoom = 1.5, ms } = {}) {
    const list = ids.map(i => at.get(i)).filter(Boolean); if (!list.length) return;
    const x0 = Math.min(...list.map(w => w.x)), x1 = Math.max(...list.map(w => w.x)), y0 = Math.min(...list.map(w => w.y)), y1 = Math.max(...list.map(w => w.y));
    const z = Math.min(maxZoom, (W - inset - insetLeft - 150) / Math.max(1, x1 - x0 + 160), (H - 190) / Math.max(1, y1 - y0 + 160));
    fly({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, z }, ms);
  }
  function home(ms) { fly({ x: M.width / 2, y: M.height / 2, z: zFit }, ms); }
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    zFit = Math.min((W - inset - insetLeft) / (M.width - 500), H / (M.height - 500)); zMin = zFit * .72; plans.clear(); dirty = true;
  }

  // ---- Pointer
  function pick(x, y) {
    for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (h.box && h.type === 'work' && x >= h.box[0] && x <= h.box[2] && y >= h.box[1] && y <= h.box[3]) return h; }
    let best = null, bestD = Infinity;
    for (const h of hits) if (h.at) { const d = Math.hypot(x - h.at[0], y - h.at[1]); if (d < h.reach && d < bestD) { best = h; bestD = d; } }
    if (best) return best;
    for (const kind of ['pattern', 'area']) for (const h of hits) if (h.type === kind && x >= h.box[0] && x <= h.box[2] && y >= h.box[1] && y <= h.box[3]) return h;
    return null;
  }
  function setHover(h, x, y) {
    const same = (hover?.type === h?.type && hover?.id === h?.id);
    if (!same) { hover = h ? { type: h.type, id: h.id } : null; dirty = true; cv.style.cursor = h ? 'pointer' : drag ? 'grabbing' : 'grab'; }
    cb.onHover?.(hover, x, y, cam.z >= Z_CARD);
  }
  function bind() {
    const pointers = new Map(); let pinch = null;
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, e); tween = null; zoomGoal = null; velocity = null;
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: cam.z }; drag = null; }
      else drag = { x: e.clientX, y: e.clientY, moved: 0, t: performance.now(), vx: 0, vy: 0 };
    });
    cv.addEventListener('pointermove', e => {
      const box = cv.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, e);
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), mx = (a.clientX + b.clientX) / 2 - box.left, my = (a.clientY + b.clientY) / 2 - box.top;
        const wx0 = wx(mx), wy0 = wy(my); cam.z = Math.max(zMin, Math.min(Z_MAX, pinch.z * d / pinch.d)); cam.x = wx0 - (mx - cx()) / cam.z; cam.y = wy0 - (my - cy()) / cam.z; dirty = true; return;
      }
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y, now = performance.now(), dt = Math.max(1, now - drag.t);
        drag.moved += Math.abs(dx) + Math.abs(dy); cam.x -= dx / cam.z; cam.y -= dy / cam.z;
        drag.vx = dx / dt; drag.vy = dy / dt; drag.x = e.clientX; drag.y = e.clientY; drag.t = now; dirty = true;
        if (drag.moved > 4) { cv.style.cursor = 'grabbing'; cb.onHover?.(null); }
        return;
      }
      setHover(pick(x, y), e.clientX, e.clientY);
    });
    const up = e => {
      pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null;
      if (!drag) return;
      const d = drag; drag = null; cv.style.cursor = 'grab';
      if (d.moved <= 4) { const box = cv.getBoundingClientRect(), h = pick(e.clientX - box.left, e.clientY - box.top); if (h) cb.onOpen?.(h); else cb.onMiss?.(); return; }
      if (performance.now() - d.t < 60 && Math.hypot(d.vx, d.vy) > .15) velocity = { x: d.vx, y: d.vy };
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { if (!drag) setHover(null); });
    cv.addEventListener('wheel', e => {
      e.preventDefault(); tween = null; velocity = null;
      const box = cv.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
      if (!zoomGoal || !anchor || Math.hypot(anchor.sx - x, anchor.sy - y) > 2) anchor = { sx: x, sy: y, wx: wx(x), wy: wy(y) };
      const step = e.ctrlKey ? -e.deltaY * .012 : -e.deltaY * (e.deltaMode ? .08 : .0022);
      zoomGoal = Math.max(zMin, Math.min(Z_MAX, (zoomGoal || cam.z) * Math.exp(step)));
      cb.onHover?.(null);
    }, { passive: false });
    cv.addEventListener('dblclick', e => { const box = cv.getBoundingClientRect(); zoomAt(1.9, e.clientX - box.left, e.clientY - box.top); });
    new ResizeObserver(resize).observe(cv);
  }
  function zoomAt(factor, x = cx(), y = cy()) { tween = null; anchor = { sx: x, sy: y, wx: wx(x), wy: wy(y) }; zoomGoal = Math.max(zMin, Math.min(Z_MAX, (zoomGoal || cam.z) * factor)); }

  // ---- What the page can ask of the map
  function setWorks(list) {
    works = list.filter(w => M.works[w.id]).map(w => ({ ...w, x: M.works[w.id][0], y: M.works[w.id][1] }));
    at = new Map(works.map(w => [w.id, w]));
    byPattern = new Map(patterns.map(p => [p.id, new Set()]));
    for (const w of works) for (const [p] of w.patterns) byPattern.get(p)?.add(w.id);
    const size = id => byPattern.get(id)?.size || 0;
    patterns.sort((a, b) => size(b.id) - size(a.id));
    plans.clear(); dirty = true;
  }
  return {
    init(canvas, data, callbacks) {
      cv = canvas; ctx = cv.getContext('2d'); D = data; M = data.map; cb = callbacks;
      patterns = data.patterns.filter(p => M.patterns[p.id]).map(p => ({ ...p, x: M.patterns[p.id][0], y: M.patterns[p.id][1] }));
      areas = data.areas.filter(a => M.territories[a.id]).map(a => ({ ...a, spot: M.areas[a.id] }));
      setWorks(data.works); resize(); buildArt(); bind();
      cam.x = M.width / 2; cam.y = M.height / 2; cam.z = still ? zFit : zFit * 1.22; if (!still) fly({ x: M.width / 2, y: M.height / 2, z: zFit }, 1500);
      cv.style.cursor = 'grab';
      document.fonts?.ready.then(() => { measured.clear(); wrapped.clear(); plans.clear(); dirty = true; });
      for (const f of [`600 30px ${SERIF}`, `italic 500 16px ${TEXT}`]) document.fonts?.load(f).then(() => { measured.clear(); wrapped.clear(); plans.clear(); dirty = true; });
      requestAnimationFrame(frame);
    },
    setWorks,
    setFilter(fn) { filter = fn; dirty = true; },
    setInset(right, left = 0) { if (right !== inset || left !== insetLeft) { const shift = ((right - inset) - (left - insetLeft)) / 2 / cam.z; inset = right; insetLeft = left; cam.x += shift; zFit = Math.min((W - inset - insetLeft) / (M.width - 500), H / (M.height - 500)); zMin = zFit * .72; dirty = true; } },
    select({ works: ids = [], pattern = null, related = [], fly: move = true }) {
      sel = { works: new Set(ids), pattern, related: new Set(related) }; dirty = true;
      if (!move || !ids.length) return;
      if (ids.length === 1) { const w = at.get(ids[0]); if (w) fly({ x: w.x, y: w.y, z: Math.max(cam.z, Z_CARD + .3) }, 1000); }
      else fit(ids, { maxZoom: pattern ? 1.9 : 1.3 });
    },
    focusPatterns(ids) { if (!ids) focusPatterns = null; else { focusPatterns = new Set(ids.flatMap(p => [...(byPattern.get(p) || [])])); focusPatterns.pattern = new Set(ids); } dirty = true; },
    fit, home, zoomAt,
    pan(dx, dy) { fly({ x: cam.x + dx / cam.z, y: cam.y + dy / cam.z }, 260); },
    zoom: () => cam.z,
    cardsShown: () => cam.z >= Z_CARD,
  };
})();
