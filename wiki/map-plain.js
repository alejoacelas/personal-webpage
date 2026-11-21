// The plain map: the atlas's layout with the geography taken away. Points on a pale ground,
// a soft wash of colour for each area, and names that appear as you get nearer.
// Pattern names are what you click: anywhere near a pattern's works counts as its name.
// Single works open once you are close enough to read their titles.
// It answers to the same MapView calls as map.js, so app.js drives either one.
window.MapView = (() => {
  const INK = '#1d1c1a', GROUND = '#fbfaf7', HALO = 'rgba(251,250,247,.92)';
  const HUES = [
    { wash: [238, 180, 84], deep: '#8a560b' }, { wash: [128, 196, 138], deep: '#27683a' },
    { wash: [236, 142, 136], deep: '#9c3530' }, { wash: [130, 170, 236], deep: '#27509c' },
    { wash: [184, 156, 232], deep: '#5f3c9e' }, { wash: [112, 204, 194], deep: '#16706a' },
    { wash: [214, 206, 92], deep: '#6d6614' }, { wash: [226, 160, 120], deep: '#8f4c22' },
  ];
  const GREY = { wash: [158, 156, 148], deep: '#5d5b55' };
  const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
  const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
  // Zoom levels: a few titles appear, every title appears, descriptions appear.
  const Z_TITLE = 1, Z_ALL = 1.9, Z_META = 2.6, Z_GLOSS = 3.1, Z_MAX = 5.5;
  const REACH = 80, PATTERN_REACH = 170;      // how far from a work or a name still counts as pointing at it, in map units
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let cv, ctx, M, D, cb, captionEl, W = 0, H = 0, dpr = 1, zFit = .3, zMin = .2;
  const cam = { x: 0, y: 0, z: .3 };
  let tween = null, zoomGoal = null, anchor = null, velocity = null, drag = null;
  let inset = 0, insetLeft = 0;
  let works = [], at = new Map(), byPattern = new Map(), patterns = [], pAt = new Map(), areas = [], hueAt = new Map();
  let wash = null;
  let hover = null, focusPatterns = null;
  let sel = { works: new Set(), pattern: null, related: new Set() };
  let filter = null;
  let dirty = true, last = 0, clock = 0, wasClose = false, captionKey = null;
  const fade = new Map();           // label key → shown amount, eased
  const plans = new Map();          // zoom bucket → which labels fit
  let hits = [];                    // what the last frame drew, for clicks

  // ---- Geometry and text helpers
  const cx = () => insetLeft + (W - inset - insetLeft) / 2, cy = () => H / 2;
  const sx = x => (x - cam.x) * cam.z + cx(), sy = y => (y - cam.y) * cam.z + cy();
  const wx = x => (x - cx()) / cam.z + cam.x, wy = y => (y - cy()) / cam.z + cam.y;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const hueOf = area => hueAt.get(area) || GREY;
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
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const shortDay = d => `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]} ’${d.slice(2, 4)}`;
  const source = w => w.kind === 'post' ? '#' + w.slack.channel : w.kind === 'said' ? 'said on a call' : ({ doc: 'Google Doc', sheet: 'Google Sheet', repo: 'repository', gist: 'gist', site: 'live site', file: 'link' })[w.sub] || w.sub;
  const firstSentence = s => String(s || '').split(/(?<=\.)\s/)[0];

  // ---- The wash: each work stains the ground with its area's colour, and stains add up.
  function buildWash() {
    const G = 14, nx = Math.ceil(M.width / G), ny = Math.ceil(M.height / G);
    const fields = new Map();
    const field = key => fields.get(key) || fields.set(key, new Float32Array(nx * ny)).get(key);
    const splat = (f, x, y, sigma, amount) => {
      const px = x / G, py = y / G, s = sigma / G, reach = Math.ceil(s * 3);
      for (let j = Math.max(0, Math.floor(py - reach)); j <= Math.min(ny - 1, py + reach); j++)
        for (let i = Math.max(0, Math.floor(px - reach)); i <= Math.min(nx - 1, px + reach); i++)
          f[j * nx + i] += amount * Math.exp(-((i - px) ** 2 + (j - py) ** 2) / (2 * s * s));
    };
    for (const w of works) {
      const total = w.patterns.reduce((t, p) => t + p[1], 0);
      if (!total) { splat(field(''), w.x, w.y, 70, .6); continue; }
      for (const [p, s] of w.patterns) if (pAt.has(p)) splat(field(pAt.get(p).area), w.x, w.y, 88, s / total);
    }
    for (const p of patterns) splat(field(p.area), p.x, p.y, 105, 1.1);
    const layers = [...fields].map(([area, f]) => [f, hueOf(area).wash]);
    const img = new ImageData(nx, ny);
    for (let k = 0; k < nx * ny; k++) {
      let sum = 0, r = 0, g = 0, b = 0;
      for (const [f, c] of layers) { const v = f[k]; sum += v; r += v * c[0]; g += v * c[1]; b += v * c[2]; }
      if (sum < .002) continue;
      img.data[k * 4] = r / sum; img.data[k * 4 + 1] = g / sum; img.data[k * 4 + 2] = b / sum;
      img.data[k * 4 + 3] = 255 * .62 * (1 - Math.exp(-sum * .36));
    }
    wash = document.createElement('canvas'); wash.width = nx; wash.height = ny;
    wash.getContext('2d').putImageData(img, 0, 0);
  }

  // ---- Which labels fit at a zoom level. Sizes are in screen pixels, so this only depends on zoom.
  const patternFont = z => `600 ${z < zFit * 1.5 ? 12.5 : z < 1 ? 13.5 : 15}px ${SANS}`;
  const patternWrap = z => z < 1 ? 150 : 180;
  const far = z => Math.max(0, Math.min(1, (zFit * 1.9 - z) / (zFit * .7)));      // 1 at the whole-map view, 0 once zoomed in
  const areaSize = z => 15 * Math.min(3.2, (z / zFit) ** .7);
  const blurbFont = `400 12px ${SANS}`;
  const titleFont = `400 11.5px ${SANS}`, titleHot = `600 11.5px ${SANS}`, glossFont = `400 11px ${SANS}`, metaFont = `400 9.5px ${MONO}`;
  function areaLines(a) {
    if (a.lines) return a.lines;
    const out = []; let line = '';
    for (const word of a.label.toUpperCase().split(/\s+/)) { if (line && (line + ' ' + word).length > 20) { out.push(line); line = word; } else line = line ? line + ' ' + word : word; }
    if (line) out.push(line);
    return a.lines = out;
  }
  const areaBlurb = a => a.blurb ? wrap(a.blurb, blurbFont, 230, 3) : [];
  function areaBox(a, z) {
    const size = areaSize(z), lines = areaLines(a), blurb = far(z) > .5 ? areaBlurb(a) : [];
    const wide = Math.max(Math.max(...lines.map(l => l.length)) * size * .76, ...blurb.map(l => width(l, blurbFont))) + 12;
    const top = lines.length * size * 1.25 / 2 + 4, bottom = top + (blurb.length ? 4 + blurb.length * 16 : 0);
    return [a.spot[0] * z - wide / 2, a.spot[1] * z - top, a.spot[0] * z + wide / 2, a.spot[1] * z + bottom];
  }
  const markRadius = z => Math.max(2, Math.min(4.2, 1.3 + 1.9 * z));
  function plan(z) {
    const key = Math.round(Math.log2(z) * 6);
    if (plans.has(key)) return plans.get(key);
    const zz = 2 ** (key / 6), placed = [], shown = new Set();
    const free = r => !placed.some(p => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1]);
    const font = patternFont(zz), size = parseFloat(font.match(/([\d.]+)px/)[1]);
    if (far(zz) > .5) for (const a of areas) placed.push(areaBox(a, zz));
    for (const p of patterns) {
      const lines = wrap(p.label, font, patternWrap(zz), 3), w = Math.max(...lines.map(l => width(l, font))), h = lines.length * size * 1.2;
      const r = [p.x * zz - w / 2 - 6, p.y * zz - h / 2 - 4, p.x * zz + w / 2 + 6, p.y * zz + h / 2 + 4];
      if (free(r)) { placed.push(r); shown.add('p:' + p.id); }
    }
    if (zz >= Z_TITLE && zz < Z_ALL) {
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

  // ---- What is singled out
  const passes = w => !filter || filter(w);
  function focus() {
    if (hover?.type === 'pattern') return byPattern.get(hover.id);
    if (focusPatterns) return focusPatterns;
    if (sel.works.size > 1) return sel.works;
    return null;
  }
  const lit = w => passes(w) && (!focus() || focus().has(w.id));
  function shownAmount(key, want, dt) {
    const now = fade.get(key) ?? 0, next = still ? want : now + (want - now) * Math.min(1, dt / 110);
    if (Math.abs(next - want) > .01) dirty = true;
    fade.set(key, Math.abs(next - want) < .01 ? want : next);
    return fade.get(key);
  }

  // ---- Drawing
  function halo(text, x, y, fill, strength = 3) {
    ctx.lineJoin = 'round'; ctx.lineWidth = strength; ctx.strokeStyle = HALO;
    ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }
  function symbol(kind, x, y, r, colour) {
    ctx.beginPath();
    if (kind === 'doc') ctx.rect(x - r * .72, y - r, r * 1.44, r * 2);
    else if (kind === 'tool') { ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 1.15, y); ctx.lineTo(x, y + r * 1.15); ctx.lineTo(x - r * 1.15, y); ctx.closePath(); }
    else if (kind === 'said') { ctx.moveTo(x - r, y + r); ctx.lineTo(x - r, y); ctx.arc(x, y, r, Math.PI, Math.PI * 2.5); ctx.closePath(); }
    else if (kind === 'other') ctx.rect(x - r * .8, y - r * .8, r * 1.6, r * 1.6);
    else ctx.arc(x, y, r, 0, 2 * Math.PI);
    if (kind === 'site' || kind === 'other') { ctx.fillStyle = GROUND; ctx.fill(); ctx.lineWidth = Math.max(1.2, r * .4); ctx.strokeStyle = colour; ctx.stroke(); }
    else { ctx.fillStyle = colour; ctx.fill(); }
  }
  function curve(a, b, bend = .16) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx - dy * bend, my + dx * bend, b.x, b.y);
  }

  // A work's name beside its point. One line while only some fit; the whole title, then where it
  // came from and what it says, as there is more room.
  function workLabel(w, x, y, r, z, alpha, hot, chosen) {
    const full = z >= Z_ALL, font = hot || chosen ? titleHot : titleFont;
    const room = full ? Math.max(92, Math.min(230, 60 * z - r - 16)) : 170;
    const title = wrap(w.title, font, room, full ? (z >= 2.4 ? 3 : 2) : 1);
    const meta = full && z >= Z_META ? `${source(w)} · ${shortDay(w.date)}` : '';
    const gloss = full && z >= Z_GLOSS && w.gloss ? wrap(w.gloss, glossFont, room, 3) : [];
    const tall = (meta ? 13 : 0) + title.length * 14 + (gloss.length ? 3 + gloss.length * 13.5 : 0);
    const left = x + r + 6; let yy = y - tall / 2, wide = 0;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.globalAlpha = alpha;
    if (meta) { ctx.font = metaFont; let m = meta; while (width(m, metaFont) > room && m.length > 8) m = m.slice(0, -2); halo(m, left, yy + 6, 'rgba(29,28,26,.6)', 2.6); wide = Math.max(wide, width(m, metaFont)); yy += 13; }
    ctx.font = font;
    for (const l of title) { halo(l, left, yy + 7, INK, 2.8); wide = Math.max(wide, width(l, font)); yy += 14; }
    if (gloss.length) { yy += 3; ctx.font = glossFont; for (const l of gloss) { halo(l, left, yy + 6.5, 'rgba(29,28,26,.66)', 2.6); wide = Math.max(wide, width(l, glossFont)); yy += 13.5; } }
    if (hot) { ctx.fillStyle = INK; ctx.fillRect(left, y + tall / 2 + 1, wide, 1); }
    ctx.globalAlpha = 1;
    hits.push({ type: 'work', id: w.id, box: [x - r - 5, Math.min(y - r - 5, y - tall / 2 - 3), left + wide + 4, Math.max(y + r + 5, y + tall / 2 + 3)] });
  }

  function draw(dt) {
    const z = cam.z;
    hits = [];
    const world = () => ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (cx() - cam.x * z), dpr * (cy() - cam.y * z));
    const screen = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const px = n => n / z;
    screen();
    ctx.fillStyle = GROUND; ctx.fillRect(0, 0, W, H);
    world();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(wash, 0, 0, M.width, M.height);

    // The pattern in hand: thin lines from its name to each of its works, and to the patterns it leads to.
    const hotPattern = hover?.type === 'pattern' ? hover.id : sel.pattern;
    const hp = hotPattern ? pAt.get(hotPattern) : null;
    const tint = hp ? hueOf(hp.area).deep : INK;
    if (hp) {
      ctx.beginPath();
      for (const id of byPattern.get(hp.id) || []) { const w = at.get(id); if (w && passes(w)) { ctx.moveTo(hp.x, hp.y); ctx.lineTo(w.x, w.y); } }
      ctx.strokeStyle = tint; ctx.globalAlpha = .3; ctx.lineWidth = px(.8); ctx.stroke();
      ctx.globalAlpha = .55; ctx.lineWidth = px(1.2); ctx.setLineDash([px(5), px(4)]);
      for (const r of hp.related || []) { const o = pAt.get(r.id); if (o) { curve(hp, o); ctx.stroke(); } }
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    const linked = new Set();
    const one = hover?.type === 'work' ? at.get(hover.id) : sel.works.size === 1 ? at.get([...sel.works][0]) : null;
    if (one) {
      ctx.strokeStyle = INK; ctx.globalAlpha = .5; ctx.lineWidth = px(1);
      for (const l of one.links) { const o = at.get(l.to); if (o) { linked.add(o.id); curve(one, o, .12); ctx.stroke(); } }
      ctx.globalAlpha = 1;
    }

    screen();
    // Area names, each with its one line of description while the whole map is in view;
    // large and faint behind everything once you zoom in.
    const size = areaSize(z), f = far(z);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const a of areas) {
      const lines = areaLines(a), x = sx(a.spot[0]), y = sy(a.spot[1]), hot = hover?.type === 'area' && hover.id === a.id;
      ctx.font = `700 ${size}px ${SANS}`;
      try { ctx.letterSpacing = `${size * .12}px`; } catch {}
      ctx.globalAlpha = hot ? 1 : .2 + .72 * f;
      lines.forEach((l, i) => {
        const yy = y + (i - (lines.length - 1) / 2) * size * 1.25;
        if (f > .05) { ctx.save(); ctx.globalAlpha *= f; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = HALO; ctx.strokeText(l, x, yy); ctx.restore(); }
        ctx.fillStyle = hueOf(a.id).deep; ctx.fillText(l, x, yy);
      });
      try { ctx.letterSpacing = '0px'; } catch {}
      if (f > .05) {
        ctx.font = blurbFont; ctx.globalAlpha = f * (hot ? 1 : .82);
        areaBlurb(a).forEach((l, i) => halo(l, x, y + lines.length * size * 1.25 / 2 + 12 + i * 16, 'rgba(29,28,26,.78)', 3));
      }
      if (f > .3) { const box = areaBox(a, z), ox = sx(0), oy = sy(0); hits.push({ type: 'area', id: a.id, box: [box[0] + ox, box[1] + oy, box[2] + ox, box[3] + oy] }); }
    }
    ctx.globalAlpha = 1;

    // Works.
    const r = markRadius(z), group = focus(), shown = plan(z), full = z >= Z_ALL;
    const view = [wx(-240), wy(-90), wx(W + 60), wy(H + 90)];
    const visible = works.filter(w => w.x > view[0] && w.x < view[2] && w.y > view[1] && w.y < view[3]);
    for (const w of visible) {
      const x = sx(w.x), y = sy(w.y), on = lit(w);
      const hot = hover?.type === 'work' && hover.id === w.id, chosen = sel.works.size === 1 && sel.works.has(w.id);
      const big = hot || chosen ? 1.5 : linked.has(w.id) || (group && on) ? 1.3 : 1;
      ctx.globalAlpha = on ? (group ? 1 : .82) : .17;
      symbol(w.kind, x, y, r * big, group && on ? tint : INK);
      if (hot || chosen || linked.has(w.id)) { ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, r * big + 3.5, 0, 2 * Math.PI); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke(); }
      const t = shownAmount('w:' + w.id, full || shown.has('w:' + w.id) || (chosen && z >= Z_TITLE) ? 1 : 0, dt);
      if (t > .02) workLabel(w, x, y, r * big, z, t * (on ? 1 : .3), hot, chosen);
    }
    ctx.globalAlpha = 1;
    if (one && sel.works.has(one.id) && !still) {   // a slow pulse on the open work
      const pulse = (clock / 1400) % 1; ctx.globalAlpha = (1 - pulse) * .6; ctx.beginPath(); ctx.arc(sx(one.x), sy(one.y), r * 1.5 + 4 + pulse * 16, 0, 2 * Math.PI); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke(); ctx.globalAlpha = 1; dirty = true;
    }

    // Pattern names.
    const font = patternFont(z), psize = parseFloat(font.match(/([\d.]+)px/)[1]), pw = patternWrap(z);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of patterns) {
      const hot = hotPattern === p.id, near = sel.related.has(p.id) || focusPatterns?.pattern?.has?.(p.id);
      const t = shownAmount('p:' + p.id, shown.has('p:' + p.id) || hot || near ? 1 : 0, dt);
      if (t < .02) continue;
      const lines = wrap(p.label, font, pw, 3), x = sx(p.x), y = sy(p.y);
      ctx.font = font; ctx.globalAlpha = t * (hot || near || !(hp || focusPatterns) ? 1 : .42);
      let wide = 0;
      lines.forEach((l, i) => { halo(l, x, y + (i - (lines.length - 1) / 2) * psize * 1.2, hot ? hueOf(p.area).deep : INK, 4); wide = Math.max(wide, width(l, font)); });
      hits.push({ type: 'pattern', id: p.id, box: [x - wide / 2 - 6, y - lines.length * psize * .6 - 4, x + wide / 2 + 6, y + lines.length * psize * .6 + 4] });
    }
    ctx.globalAlpha = 1;
    if (M.loose && z > zFit * 1.2) { ctx.font = `600 12px ${SANS}`; ctx.globalAlpha = .6; halo('Not yet sorted', sx(M.loose[0]), sy(M.loose[1]) - 46 * z - 8, INK); ctx.globalAlpha = 1; }
    caption();
  }

  // ---- The caption: what the pointer is on, or failing that what the middle of the view is on.
  function nearestPattern(X, Y, reach) {
    let best = null, bd = reach;
    for (const p of patterns) { const d = Math.hypot(p.x - X, p.y - Y); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  function caption() {
    if (!captionEl) return;
    let target = hover;
    if (!target && cam.z > zFit * 1.45) { const p = nearestPattern(cam.x, cam.y, 420); if (p) target = { type: 'pattern', id: p.id }; }
    const key = target ? target.type + ':' + target.id : 'home:' + works.length;
    if (key === captionKey) return;
    captionKey = key;
    let html;
    if (target?.type === 'pattern') {
      const p = pAt.get(target.id), a = areas.find(a => a.id === p.area), n = [...(byPattern.get(p.id) || [])].length;
      html = `<span class="cap-kicker" style="--hue:${hueOf(p.area).deep}">${esc(a?.label || 'Pattern')} · ${n} ${n === 1 ? 'work' : 'works'}</span><b>${esc(p.label)}</b>${esc(firstSentence(p.summary))}`;
    } else if (target?.type === 'area') {
      const a = areas.find(a => a.id === target.id), n = patterns.filter(p => p.area === a.id).length;
      html = `<span class="cap-kicker" style="--hue:${hueOf(a.id).deep}">Area · ${n} patterns</span><b>${esc(a.label)}</b>${esc(a.blurb)}`;
    } else if (target?.type === 'work') {
      const w = at.get(target.id);
      html = `<span class="cap-kicker">${esc(source(w))} · ${esc(shortDay(w.date))}</span><b>${esc(w.title)}</b>${esc(w.gloss)}`;
    } else html = 'Each point is one piece of work, and points that share an idea sit together. Click a name to open it, or zoom in to read the titles.';
    captionEl.innerHTML = html;
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
  // The ground near a pattern's works stands for the pattern, so there is no need to aim at its name.
  function ground(X, Y) {
    let best = null, bd = REACH;
    for (const w of works) { if (!passes(w)) continue; const d = Math.hypot(w.x - X, w.y - Y); if (d < bd) { bd = d; best = w; } }
    if (best && !best.patterns.length) return { type: 'work', id: best.id };
    if (best) {
      let p = null, pd = Infinity;
      for (const [id] of best.patterns) { const q = pAt.get(id); if (q) { const d = Math.hypot(q.x - X, q.y - Y); if (d < pd) { pd = d; p = q; } } }
      if (p) return { type: 'pattern', id: p.id };
    }
    const p = nearestPattern(X, Y, PATTERN_REACH);
    return p ? { type: 'pattern', id: p.id } : null;
  }
  const inBox = (h, x, y) => x >= h.box[0] && x <= h.box[2] && y >= h.box[1] && y <= h.box[3];
  function pick(x, y) {
    if (cam.z >= Z_TITLE) for (let i = hits.length - 1; i >= 0; i--) if (hits[i].type === 'work' && inBox(hits[i], x, y)) return hits[i];
    for (const kind of ['pattern', 'area']) for (const h of hits) if (h.type === kind && inBox(h, x, y)) return h;
    return cam.z < Z_ALL ? ground(wx(x), wy(y)) : null;
  }
  function setHover(h) {
    if (hover?.type === h?.type && hover?.id === h?.id) return;
    hover = h ? { type: h.type, id: h.id } : null; dirty = true; cv.style.cursor = h ? 'pointer' : drag ? 'grabbing' : 'grab';
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
        if (drag.moved > 4) { cv.style.cursor = 'grabbing'; setHover(null); }
        return;
      }
      if (e.pointerType !== 'touch') setHover(pick(x, y));
    });
    const up = e => {
      pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null;
      if (!drag) return;
      const d = drag; drag = null; cv.style.cursor = hover ? 'pointer' : 'grab';
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
    buildWash(); plans.clear(); captionKey = null; dirty = true;
  }
  return {
    init(canvas, data, callbacks) {
      cv = canvas; ctx = cv.getContext('2d'); D = data; M = data.map; cb = callbacks; captionEl = document.getElementById('caption');
      patterns = data.patterns.filter(p => M.patterns[p.id]).map(p => ({ ...p, x: M.patterns[p.id][0], y: M.patterns[p.id][1] }));
      pAt = new Map(patterns.map(p => [p.id, p]));
      hueAt = new Map(data.areas.map((a, i) => [a.id, HUES[i % HUES.length]]));
      areas = data.areas.filter(a => M.areas[a.id]).map(a => ({ ...a, spot: M.areas[a.id] }));
      setWorks(data.works); resize(); bind();
      cam.x = M.width / 2; cam.y = M.height / 2; cam.z = still ? zFit : zFit * 1.22; if (!still) fly({ x: M.width / 2, y: M.height / 2, z: zFit }, 1500);
      cv.style.cursor = 'grab';
      requestAnimationFrame(frame);
    },
    setWorks,
    setFilter(fn) { filter = fn; dirty = true; },
    setInset(right, left = 0) { if (right !== inset || left !== insetLeft) { const shift = ((right - inset) - (left - insetLeft)) / 2 / cam.z; inset = right; insetLeft = left; cam.x += shift; zFit = Math.min((W - inset - insetLeft) / (M.width - 500), H / (M.height - 500)); zMin = zFit * .72; dirty = true; } },
    select({ works: ids = [], pattern = null, related = [], fly: move = true }) {
      sel = { works: new Set(ids), pattern, related: new Set(related) }; dirty = true;
      if (!move || !ids.length) return;
      if (ids.length === 1) { const w = at.get(ids[0]); if (w) fly({ x: w.x, y: w.y, z: Math.max(cam.z, Z_META) }, 1000); }
      else fit(ids, { maxZoom: pattern ? 2 : 1.3 });
    },
    focusPatterns(ids) { if (!ids) focusPatterns = null; else { focusPatterns = new Set(ids.flatMap(p => [...(byPattern.get(p) || [])])); focusPatterns.pattern = new Set(ids); } dirty = true; },
    fit, home, zoomAt,
    pan(dx, dy) { fly({ x: cam.x + dx / cam.z, y: cam.y + dy / cam.z }, 260); },
    zoom: () => cam.z,
    cardsShown: () => cam.z >= Z_ALL,
  };
})();
