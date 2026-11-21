// The map, stippled: no fills and no lines, only small dots on warm paper.
// Every work scatters dots around itself in the colours of its patterns, so a pattern with many
// works becomes a field of its colour and two patterns meet where their dots intermingle.
// The dots are WebGL points on a canvas placed under the one the page passes in; names, marks and
// cards are drawn on that one. Zooming in adds finer dots between the ones already there.
window.MapView = (() => {
  const PAPER = [246, 239, 222], INK = '#2c2520', HOT = '#c4432b';
  const PAPER_CSS = `rgb(${PAPER})`;
  const KIND = { post: '#4a154b', doc: '#1f4fb0', tool: '#1c5a40', site: '#0e7a78', said: '#a05c00', other: '#6b665c' };
  const NAME = '"Fraunces", "Iowan Old Style", Georgia, serif';
  const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
  const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
  const Z_TITLE = 1.05, Z_CARD = 2.3, Z_GLOSS = 3.3, Z_MAX = 5.5;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // How the dots are laid: at zoom z neighbouring dots sit SPACE·z^GROW screen pixels apart,
  // so zooming in both enlarges the dots and makes room for new ones. Past Z_FINEST no more are
  // added and the dots simply grow, like walking up to a painting.
  const SPACE = 6.8, GROW = .3, FILL = .45, Z0 = .09, STEP = 2 ** (1 / 3), LEVELS = 16, Z_FINEST = Z0 * STEP ** (LEVELS - 1);
  const REACH = 46, NEAR = 30, OWN = 30, THIN = .09, CELL = 8, TILE = 512, CAP = 200000, EDGE = 24, BYTES = 20;

  let cv, ctx, glcv, gl, prog, uni = {}, vbo, workTex, patTex, M, D, cb, W = 0, H = 0, dpr = 1, zFit = .3, zMin = .2;
  const cam = { x: 0, y: 0, z: .3 };
  let tween = null, zoomGoal = null, anchor = null, velocity = null, drag = null;
  let inset = 0, insetLeft = 0;
  let works = [], at = new Map(), byPattern = new Map(), patterns = [], pAt = new Map();
  let hover = null, focusPatterns = null;
  let sel = { works: new Set(), pattern: null, related: new Set() };
  let filter = null;
  let dirty = true, glDirty = true, last = 0, clock = 0, wasClose = false;
  const fade = new Map();           // label key → shown amount, eased
  const plans = new Map();          // zoom bucket → which labels fit
  const sprites = new Map();        // pattern names, drawn once with their paper clearing
  let hits = [];                    // what the last frame drew, for clicks
  // Dots
  let levels = [], maker = null, early = true, deadline = 0, heart = [0, 0], reach = 1, introStart = 0, intro = 1;
  let workState = null, workRows = 1, litNow = null, hotNow = null, patState = null, patNow = null, focusNow = 0, patFocusNow = 0;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, on: false, s: 0 };
  let lastInput = 0, drift = 0, awake = false, maxDot = 64;

  // ---- Geometry helpers
  const cx = () => insetLeft + (W - inset - insetLeft) / 2, cy = () => H / 2;
  const sx = x => (x - cam.x) * cam.z + cx(), sy = y => (y - cam.y) * cam.z + cy();
  const wx = x => (x - cx()) / cam.z + cam.x, wy = y => (y - cy()) / cam.z + cam.y;
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
  const source = w => w.kind === 'post' ? '#' + w.slack.channel : w.kind === 'said' ? 'said on a call' : ({ doc: 'Google Doc', sheet: 'Google Sheet', repo: 'repository', gist: 'gist', site: 'live site', file: 'link' })[w.sub] || w.sub;
  const shortDay = d => `${+d.slice(8, 10)} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+d.slice(5, 7) - 1]} ’${d.slice(2, 4)}`;

  // ---- Colour. Each pattern's hue comes from where it sits (map.tint, shared by every look);
  // lightness follows the hue the way pigments do (yellows light, violets deep) and patterns
  // further from the middle are more vivid. Every pattern gets a few tones to stipple with.
  const toSrgb = v => v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055;
  const toLin = v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
  function oklch(L, C, hue) {
    const h = hue * Math.PI / 180;
    for (let c = C; ; c *= .92) {
      const a = c * Math.cos(h), b = c * Math.sin(h);
      const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
      const rgb = [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
      if (c < .004 || rgb.every(v => v > -.002 && v < 1.002)) return rgb.map(v => Math.round(255 * toSrgb(Math.max(0, Math.min(1, v)))));
    }
  }
  function okHue(hue) {             // where an HSL hue sits on the OKLCH wheel
    const f = n => { const k = (n + hue / 30) % 12; return toLin(.5 - .5 * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    const r = f(0), g = f(8), b = f(4);
    const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
    return Math.atan2(.0259040371 * l + .7827717662 * m - .808675766 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s) * 180 / Math.PI;
  }
  const css = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  function paint(p) {
    const [hue, out] = M.tint?.[p.id] || [0, .5];
    const h = okHue(hue), rad = Math.PI / 180, warm = Math.cos((h - 100) * rad);
    const odd = [...p.id].reduce((n, c) => n + c.charCodeAt(0), 0) % 2 ? 1 : -1;
    const L = .625 + .095 * warm + .02 * odd, C = .112 + .068 * out, sun = Math.sin((100 - h) * rad) >= 0 ? 1 : -1;
    p.tones = [oklch(L, C, h), oklch(L + .11, C * .7, h + 12 * sun), oklch(L - .12, C * 1.1, h - 14 * sun), oklch(L - .03, C * 1.3, h + 30), oklch(L + .03, C * 1.2, h - 30)];
    p.ink = css(oklch(.3, .07, h)); p.lit = css(oklch(.47, .17, h)); p.chip = css(oklch(L - .05, C * 1.2, h));
  }

  // ---- Dots. A density field says how thickly to stipple each spot: full beside a work,
  // thinner between works, fading to bare paper past the outermost ones.
  let field = null, near = null, fw = 0, fh = 0, hashCols = 0, hashRows = 0, hashAt = null, hashList = null, mass = null;
  let dNear = 0, dEdge = 0, pickW = 0, pickP = 0, pickNear = 0;
  const HASH = 96;
  function buildField() {
    fw = Math.ceil(M.width / CELL) + 2; fh = Math.ceil(M.height / CELL) + 2;
    field = new Float32Array(fw * fh); near = new Float32Array(fw * fh);
    mass = new Float32Array(works.length);
    const R = REACH * 3, a = 1 / (2 * REACH * REACH), b = 1 / (2 * NEAR * NEAR);
    works.forEach((w, i) => {
      const m = mass[i] = .75 + .12 * w.patterns.reduce((n, p) => n + p[1], 0);
      const x0 = Math.max(0, Math.floor((w.x - R) / CELL)), x1 = Math.min(fw - 1, Math.ceil((w.x + R) / CELL)), y0 = Math.max(0, Math.floor((w.y - R) / CELL)), y1 = Math.min(fh - 1, Math.ceil((w.y + R) / CELL));
      for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
        const dx = gx * CELL - w.x, dy = gy * CELL - w.y, r2 = dx * dx + dy * dy; if (r2 > R * R) continue;
        const i = gy * fw + gx, n = Math.exp(-r2 * b);
        field[i] += m * Math.exp(-r2 * a); if (n > near[i]) near[i] = n;
      }
    });
    // Works by coarse cell, to find whose dot a spot is.
    hashCols = Math.ceil(M.width / HASH) + 1; hashRows = Math.ceil(M.height / HASH) + 1;
    const cell = w => Math.max(0, Math.min(hashRows - 1, w.y / HASH | 0)) * hashCols + Math.max(0, Math.min(hashCols - 1, w.x / HASH | 0));
    hashAt = new Int32Array(hashCols * hashRows + 1); hashList = new Int32Array(works.length);
    for (const w of works) hashAt[cell(w) + 1]++;
    for (let i = 0; i < hashCols * hashRows; i++) hashAt[i + 1] += hashAt[i];
    const fill = hashAt.slice(); works.forEach((w, i) => { hashList[fill[cell(w)]++] = i; });
  }
  function sample(grid, x, y) {
    const X = x / CELL, Y = y / CELL, xi = X | 0, yi = Y | 0;
    if (xi < 0 || yi < 0 || xi >= fw - 1 || yi >= fh - 1) return 0;
    const u = X - xi, v = Y - yi, i = yi * fw + xi;
    return grid[i] * (1 - u) * (1 - v) + grid[i + 1] * u * (1 - v) + grid[i + fw] * (1 - u) * v + grid[i + fw + 1] * u * v;
  }
  function density(x, y) {
    const f = sample(field, x, y); if (f < .12) return 0;
    const t = Math.min(1, (f - .12) / .9); dEdge = t * t * (3 - 2 * t); dNear = sample(near, x, y);
    return dEdge * (.7 + .3 * dNear ** .7);
  }
  const candW = new Int32Array(64), candV = new Float32Array(64);
  function owner(x, y, rnd) {       // which work this dot belongs to, and which of its patterns it shows
    const hx = Math.max(0, Math.min(hashCols - 1, x / HASH | 0)), hy = Math.max(0, Math.min(hashRows - 1, y / HASH | 0)), k = 1 / (2 * OWN * OWN);
    let n = 0, sum = 0;
    for (let yy = Math.max(0, hy - 1); yy <= Math.min(hashRows - 1, hy + 1); yy++) for (let xx = Math.max(0, hx - 1); xx <= Math.min(hashCols - 1, hx + 1); xx++) {
      for (let j = hashAt[yy * hashCols + xx], end = hashAt[yy * hashCols + xx + 1]; j < end && n < 64; j++) {
        const i = hashList[j], w = works[i], dx = w.x - x, dy = w.y - y, r2 = dx * dx + dy * dy; if (r2 > HASH * HASH) continue;
        const v = mass[i] * Math.exp(-r2 * k); candW[n] = i; candV[n] = v; sum += v; n++;
      }
    }
    if (!n || sum <= 0) return false;
    let u = rnd() * sum, c = 0; while (c < n - 1 && (u -= candV[c]) > 0) c++;
    pickW = candW[c]; const w = works[pickW];
    pickNear = Math.exp(-((w.x - x) ** 2 + (w.y - y) ** 2) / (2 * NEAR * NEAR));
    u = rnd() * w.pTotal; c = 0; while (c < w.pIdx.length - 1 && (u -= w.pWeight[c]) > 0) c++;
    pickP = w.pIdx[c];
    return true;
  }
  const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };

  // Lays the dots one zoom level at a time, coarsest first. Each level keeps a minimum distance
  // from every dot already down (so there is no grid and no clumping), and that distance widens
  // where the field is thin. Pauses whenever the frame's time is used up.
  function* makeDots() {
    let s = 20261121; const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    buildField();
    const xs = works.map(w => w.x), ys = works.map(w => w.y), pad = REACH * 3;
    const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, bw = Math.max(...xs) + pad - x0, bh = Math.max(...ys) + pad - y0;
    const X = new Float32Array(CAP), Y = new Float32Array(CAP), next = new Int32Array(CAP), out = new ArrayBuffer(CAP * BYTES), fo = new Float32Array(out), bo = new Uint8Array(out), tile = new Int32Array(CAP), tcols = Math.ceil(M.width / TILE), tiles = tcols * Math.ceil(M.height / TILE);
    let n = 0;
    for (let L = 0; L < LEVELS && n < CAP; L++) {
      const zL = Z0 * STEP ** L, zPrev = L ? Z0 * STEP ** (L - 1) : 0, R = SPACE * zL ** (GROW - 1), first = n;
      const cell = R * 1.2, cols = Math.ceil(bw / cell) + 1, rows = Math.ceil(bh / cell) + 1, head = new Int32Array(cols * rows).fill(-1);
      for (let i = 0; i < n; i++) { const c = ((Y[i] - y0) / cell | 0) * cols + ((X[i] - x0) / cell | 0); next[i] = head[c]; head[c] = i; }
      const step = R * .74, nx = Math.ceil(bw / step), ny = Math.ceil(bh / step), total = nx * ny;
      let stride = Math.max(1, Math.round(total * .6180339887)); while (gcd(stride, total) !== 1) stride++;
      for (let k = 0, i = rnd() * total | 0; k < total && n < CAP; k++, i = (i + stride) % total) {
        if ((k & 1023) === 0 && performance.now() > deadline) yield;
        const x = x0 + (i % nx + rnd()) * step, y = y0 + ((i / nx | 0) + rnd()) * step;
        const d = density(x, y); if (d < THIN || rnd() > d * 1.3) continue;
        const r = R / Math.sqrt(d), r2 = r * r, span = Math.ceil(r / cell), gx = (x - x0) / cell | 0, gy = (y - y0) / cell | 0;
        let free = true;
        scan: for (let yy = Math.max(0, gy - span), y1 = Math.min(rows - 1, gy + span); yy <= y1; yy++) for (let xx = Math.max(0, gx - span), x1 = Math.min(cols - 1, gx + span); xx <= x1; xx++) {
          for (let j = head[yy * cols + xx]; j >= 0; j = next[j]) { const dx = X[j] - x, dy = Y[j] - y; if (dx * dx + dy * dy < r2) { free = false; break scan; } }
        }
        if (!free) continue;
        const nearHere = dNear, edge = dEdge;
        if (!owner(x, y, rnd)) continue;
        X[n] = x; Y[n] = y; next[n] = head[gy * cols + gx]; head[gy * cols + gx] = n;
        // Tone: deeper beside the work, lighter out at the fringe, with a few neighbouring hues for shimmer.
        const tones = patterns[pickP].tones, u = rnd(), deep = .1 + .24 * pickNear, light = .3 - .18 * pickNear;
        const tone = tones[u < deep ? 2 : u < deep + light ? 1 : u < deep + light + .07 ? 3 : u < deep + light + .14 ? 4 : 0];
        const size = Math.max(.3, Math.min(1.45, (.6 + .52 * nearHere) * (.5 + .5 * edge) * (.84 + .32 * rnd())));
        const o = n - first, b = o * BYTES;
        fo[o * 5] = x; fo[o * 5 + 1] = y; fo[o * 5 + 2] = zPrev * STEP ** (.8 * rnd());
        for (let c = 0; c < 3; c++) bo[b + 12 + c] = Math.max(0, Math.min(255, tone[c] + (rnd() - .5) * 14));
        bo[b + 15] = size / 1.5 * 255; bo[b + 16] = pickW & 255; bo[b + 17] = pickW >> 8; bo[b + 18] = pickP; bo[b + 19] = rnd() * 256;
        tile[o] = Math.max(0, Math.min(tiles / tcols - 1, y / TILE | 0)) * tcols + Math.max(0, Math.min(tcols - 1, x / TILE | 0));
        n++;
      }
      // Order the level by map tile so a close view only has to draw the tiles in sight.
      const count = n - first, starts = new Int32Array(tiles + 1);
      for (let i = 0; i < count; i++) starts[tile[i] + 1]++;
      for (let t = 0; t < tiles; t++) starts[t + 1] += starts[t];
      const sorted = new Uint8Array(count * BYTES), fill = starts.slice();
      for (let i = 0; i < count; i++) sorted.set(bo.subarray(i * BYTES, i * BYTES + BYTES), fill[tile[i]]++ * BYTES);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferSubData(gl.ARRAY_BUFFER, first * BYTES, sorted);
      levels.push({ z: zPrev * .94, first, count, starts, tcols, born: early ? -1e9 : performance.now() });
      glDirty = true;
      yield zL;
    }
  }
  function startDots() {
    levels = []; works.forEach(w => { w.pIdx = w.patterns.map(p => pAt.get(p[0])).filter(i => i !== undefined); w.pWeight = w.patterns.filter(p => pAt.has(p[0])).map(p => p[1] >= 2 ? 3 : 1); w.pTotal = w.pWeight.reduce((a, b) => a + b, 0); });
    const xs = works.map(w => w.x), ys = works.map(w => w.y);
    heart = [xs.reduce((a, b) => a + b, 0) / (xs.length || 1), ys.reduce((a, b) => a + b, 0) / (ys.length || 1)];
    reach = Math.max(1, ...works.map(w => Math.hypot(w.x - heart[0], w.y - heart[1]))) + REACH * 2;
    workRows = Math.max(1, Math.ceil(works.length / 1024));
    workState = new Uint8Array(1024 * workRows * 4); litNow = new Float32Array(works.length).fill(1); hotNow = new Float32Array(works.length);
    patState = new Uint8Array(Math.max(1, patterns.length) * 4); patNow = new Float32Array(patterns.length);
    for (let i = 0; i < works.length; i++) workState[i * 4] = 255;
    gl.bindTexture(gl.TEXTURE_2D, workTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1024, workRows, 0, gl.RGBA, gl.UNSIGNED_BYTE, workState);
    gl.bindTexture(gl.TEXTURE_2D, patTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, Math.max(1, patterns.length), 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, patState);
    maker = works.length ? makeDots() : null;
    // Lay what the opening view needs before the first frame; the finer levels follow a little each frame.
    deadline = Infinity; early = true;
    while (maker) { const step = maker.next(); if (step.done) { maker = null; break; } if (step.value > Math.max(cam.z, zFit) * 1.3) break; }
    early = false; introStart = performance.now(); intro = still ? 1 : 0; glDirty = true;
  }

  const VERT = `#version 300 es
  precision highp float;
  layout(location=0) in vec2 aPos;
  layout(location=1) in float aZ;
  layout(location=2) in vec4 aCol;
  layout(location=3) in vec4 aIds;
  uniform vec2 uCam, uView, uCentre, uHeart;
  uniform float uZoom, uDpr, uBase, uTime, uIntro, uReach, uFocus, uPatFocus, uQuiet, uDrift, uBorn, uMaxR;
  uniform vec3 uMouse;
  uniform highp sampler2D uWork, uPat;
  out vec3 vCol; out float vR; out vec3 vShape;
  const vec3 PAPER = vec3(${PAPER.map(v => (v / 255).toFixed(4))});
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    float show = aZ <= 0. ? 1. : smoothstep(aZ * .94, aZ * 1.14, uZoom);
    int wi = int(aIds.x + aIds.y * 256. + .5);
    vec4 state = texelFetch(uWork, ivec2(wi & 1023, wi >> 10), 0);
    float pat = texelFetch(uPat, ivec2(int(aIds.z + .5), 0), 0).r;
    float h1 = hash(aPos), h2 = hash(aPos.yx + 17.3);
    vec2 p = (aPos - uCam) * uZoom + uCentre;
    float keep = state.r * mix(1., .4 + .6 * pat, uPatFocus), hot = state.g;
    float r = uBase * aCol.a * 1.5 * show * uBorn * (.58 + .42 * keep) * (1. + .4 * uFocus * keep * (1. - uQuiet * 2.) + hot * (.32 + .1 * uDrift * sin(uTime * 2.1)));   // the open or hovered work's dots swell and breathe
    // Settling in: the dots open outward from the middle of the map.
    vec2 away = aPos - uHeart; float span = length(away) / uReach;
    float t = clamp((uIntro * 1.75 - span - .15 * h1) / .6, 0., 1.), e = 1. - pow(1. - t, 3.);
    p -= (1. - e) * (normalize(away + .001) * (26. + 60. * h2) + (vec2(h1, h2) - .5) * 46.);
    r *= e;
    // A slow drift, each dot on its own small loop.
    float amp = uDrift * (.3 + .13 * r);
    p += amp * vec2(sin(uTime * (.45 + .5 * h1) + 6.283 * h2), cos(uTime * (.4 + .5 * h2) + 6.283 * h1));
    // Dots under the pointer swell and lean towards it.
    vec2 dm = uMouse.xy - p; float dist = length(dm), f = uMouse.z * exp(-dist * dist / 11000.);
    p += dm / max(dist, 1.) * min(dist, 5.) * f * .8; r *= 1. + .26 * f;
    vec3 c = aCol.rgb;
    c = mix(mix(c, vec3(.862, .83, .768), .74), c, keep);
    c = mix(c, PAPER, uQuiet * (1. - .7 * hot) + .1 * (1. - e));
    vCol = c; r = min(r * uDpr, uMaxR); vR = r;
    float turn = 6.283 * h1; vShape = vec3(cos(turn), sin(turn), 1. + .1 * h2);
    if (r < .22) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 1.; return; }
    gl_Position = vec4(p.x / uView.x * 2. - 1., 1. - p.y / uView.y * 2., 0., 1.);
    gl_PointSize = 2. * r * 1.1 + 2.;
  }`;
  const FRAG = `#version 300 es
  precision highp float;
  in vec3 vCol; in float vR; in vec3 vShape; out vec4 o;
  void main() {
    // Each dot is very slightly oval and turned its own way, as a hand would leave it.
    vec2 q = (gl_PointCoord - .5) * (2. * vR * 1.1 + 2.);
    q = vec2(q.x * vShape.x + q.y * vShape.y, q.y * vShape.x - q.x * vShape.y);
    float squash = mix(1., vShape.z, clamp((vR - 2.) / 4., 0., 1.));
    q.x *= squash; q.y /= squash;
    float d = length(q), a = clamp(vR - d + .5, 0., 1.);
    float rim = smoothstep(vR * .45, vR, d) * clamp((vR - 3.) / 7., 0., 1.);   // pigment pools at the edge of a big dot
    o = vec4(vCol * (1. - .13 * rim) * a, a);
  }`;
  function setupGl() {
    glcv = document.createElement('canvas'); glcv.setAttribute('aria-hidden', 'true');
    Object.assign(glcv.style, { position: 'fixed', left: -EDGE + 'px', top: -EDGE + 'px', pointerEvents: 'none', display: 'block' });
    cv.parentNode.insertBefore(glcv, cv);
    gl = glcv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) throw new Error('The stippled map needs WebGL 2, which this browser does not offer.');
    const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    prog = gl.createProgram(); gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    for (const name of ['uCam', 'uView', 'uCentre', 'uHeart', 'uZoom', 'uDpr', 'uBase', 'uTime', 'uIntro', 'uReach', 'uFocus', 'uPatFocus', 'uQuiet', 'uDrift', 'uBorn', 'uMaxR', 'uMouse', 'uWork', 'uPat']) uni[name] = gl.getUniformLocation(prog, name);
    vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, CAP * BYTES, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, BYTES, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, BYTES, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, BYTES, 12);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, false, BYTES, 16);
    const texture = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
    workTex = texture(); patTex = texture();
    maxDot = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  // What is singled out this frame.
  function scene() {
    const hotPattern = hover?.type === 'pattern' ? hover.id : sel.pattern;
    const one = hover?.type === 'work' ? at.get(hover.id) : sel.works.size === 1 ? at.get([...sel.works][0]) : null;
    const linked = new Set(); if (one) for (const l of one.links) if (at.has(l.to)) linked.add(l.to);
    return { hotPattern, one, linked };
  }
  // The dots' share of that: each work's dots brighten or fade, eased so nothing snaps.
  function easeDots(dt, sc) {
    const k = still ? 1 : Math.min(1, dt / 190), chosen = sel.works.size === 1 ? [...sel.works][0] : null, hotWork = hover?.type === 'work' ? hover.id : null;
    let moved = false;
    for (let i = 0; i < works.length; i++) {
      const w = works[i], tl = lit(w) ? 1 : 0, th = w.id === hotWork || w.id === chosen ? 1 : sc.linked.has(w.id) ? .4 : 0;
      if (litNow[i] !== tl) { litNow[i] = Math.abs(tl - litNow[i]) < .01 ? tl : litNow[i] + (tl - litNow[i]) * k; workState[i * 4] = litNow[i] * 255; moved = true; }
      if (hotNow[i] !== th) { hotNow[i] = Math.abs(th - hotNow[i]) < .01 ? th : hotNow[i] + (th - hotNow[i]) * k; workState[i * 4 + 1] = hotNow[i] * 255; moved = true; }
    }
    if (moved) { gl.bindTexture(gl.TEXTURE_2D, workTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1024, workRows, gl.RGBA, gl.UNSIGNED_BYTE, workState); }
    let pMoved = false, anyPattern = 0;
    for (let i = 0; i < patterns.length; i++) {
      const id = patterns[i].id, t = id === sc.hotPattern || focusPatterns?.pattern?.has(id) ? 1 : 0; anyPattern = Math.max(anyPattern, t);
      if (patNow[i] !== t) { patNow[i] = Math.abs(t - patNow[i]) < .01 ? t : patNow[i] + (t - patNow[i]) * k; patState[i * 4] = patNow[i] * 255; pMoved = true; }
    }
    if (pMoved) { gl.bindTexture(gl.TEXTURE_2D, patTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, Math.max(1, patterns.length), 1, gl.RGBA, gl.UNSIGNED_BYTE, patState); }
    const ease = (now, to) => Math.abs(to - now) < .01 ? to : now + (to - now) * k;
    const f = ease(focusNow, filter || focus() ? 1 : 0), pf = ease(patFocusNow, anyPattern);
    if (f !== focusNow || pf !== patFocusNow) { focusNow = f; patFocusNow = pf; moved = true; }
    const ms = ease(mouse.s, mouse.on && !drag && !still ? 1 : 0), mx = mouse.x + (mouse.tx - mouse.x) * (still ? 1 : Math.min(1, dt / 60)), my = mouse.y + (mouse.ty - mouse.y) * (still ? 1 : Math.min(1, dt / 60));
    if (ms !== mouse.s || Math.abs(mx - mouse.x) + Math.abs(my - mouse.y) > .05) { mouse.s = ms; mouse.x = mx; mouse.y = my; if (ms > 0) moved = true; }
    if (moved || pMoved) glDirty = true;
  }
  function drawDots() {
    const z = cam.z;
    gl.viewport(0, 0, glcv.width, glcv.height);
    gl.clearColor(PAPER[0] / 255, PAPER[1] / 255, PAPER[2] / 255, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    if (!levels.length) return;
    gl.useProgram(prog); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, workTex); gl.uniform1i(uni.uWork, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, patTex); gl.uniform1i(uni.uPat, 1); gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(uni.uCam, cam.x, cam.y); gl.uniform2f(uni.uView, W + EDGE * 2, H + EDGE * 2); gl.uniform2f(uni.uCentre, cx() + EDGE, cy() + EDGE); gl.uniform2f(uni.uHeart, heart[0], heart[1]);
    gl.uniform1f(uni.uZoom, z); gl.uniform1f(uni.uDpr, dpr); gl.uniform1f(uni.uBase, FILL * SPACE * Math.min(z, Z_FINEST) ** GROW * Math.max(1, z / Z_FINEST)); gl.uniform1f(uni.uTime, drift / 1000); gl.uniform1f(uni.uIntro, intro); gl.uniform1f(uni.uReach, reach);
    gl.uniform1f(uni.uMaxR, (maxDot - 2) / 2.2); gl.uniform1f(uni.uFocus, focusNow); gl.uniform1f(uni.uPatFocus, patFocusNow); gl.uniform1f(uni.uDrift, still ? 0 : 1);
    const step = (a, b) => { const t = Math.max(0, Math.min(1, (z - a) / (b - a))); return t * t * (3 - 2 * t); };
    gl.uniform1f(uni.uQuiet, .17 * step(.7, 1.15) + .14 * step(Z_CARD - .5, Z_CARD + .2));   // the dots pale a little once there is text to read
    gl.uniform3f(uni.uMouse, mouse.x + EDGE, mouse.y + EDGE, mouse.s);
    const m = 60 / z, whole = intro < 1, tx0 = Math.max(0, (wx(0) - m) / TILE | 0), ty0 = Math.max(0, (wy(0) - m) / TILE | 0), tx1 = (wx(W) + m) / TILE | 0, ty1 = (wy(H) + m) / TILE | 0;
    for (const l of levels) {
      if (l.z > z || !l.count) continue;
      const born = still ? 1 : Math.min(1, (clock - l.born) / 600); gl.uniform1f(uni.uBorn, born * born * (3 - 2 * born)); if (born < 1) glDirty = true;
      const rows = (l.starts.length - 1) / l.tcols, a = Math.min(l.tcols - 1, tx0), b = Math.min(l.tcols - 1, tx1);
      if (whole || (a === 0 && b === l.tcols - 1)) { const from = whole ? 0 : l.starts[Math.min(rows, ty0) * l.tcols], to = whole ? l.count : l.starts[Math.min(rows, ty1 + 1) * l.tcols]; if (to > from) gl.drawArrays(gl.POINTS, l.first + from, to - from); continue; }
      for (let ty = ty0; ty <= Math.min(rows - 1, ty1); ty++) { const from = l.starts[ty * l.tcols + a], to = l.starts[ty * l.tcols + b + 1]; if (to > from) gl.drawArrays(gl.POINTS, l.first + from, to - from); }
    }
  }

  // ---- Which labels fit at a zoom level. Sizes are in screen pixels, so this only depends on zoom.
  const patternFont = z => `italic 500 ${z < zFit * 1.5 ? 13.5 : z < 1 ? 15.5 : 17}px ${NAME}`;
  const titleFont = `500 12px ${SANS}`, NAME_W = 165, NAME_LINES = 4;
  function plan(z) {
    const key = Math.round(Math.log2(z) * 6);
    if (plans.has(key)) return plans.get(key);
    const zz = 2 ** (key / 6), placed = [], shown = new Set();
    const free = r => !placed.some(p => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1]);
    const font = patternFont(zz), size = parseFloat(font.match(/([\d.]+)px/)[1]);
    for (const p of patterns) {
      const lines = wrap(p.label, font, NAME_W, NAME_LINES), w = Math.max(...lines.map(l => width(l, font))), h = lines.length * size * 1.14;
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
  // During the opening, a work's mark arrives with the dots around it.
  const arrived = w => intro >= 1 ? 1 : Math.max(0, Math.min(1, (intro * 1.75 - Math.hypot(w.x - heart[0], w.y - heart[1]) / reach - .25) / .5));
  const markRadius = z => Math.max(1.2, Math.min(5.4, 1 + 2.9 * z));

  // ---- Drawing on the top canvas: names, marks, cards. Anything that would be a line is a row of dots.
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
    ctx.lineJoin = 'round'; ctx.lineWidth = strength + 6; ctx.strokeStyle = `rgba(${PAPER},.4)`; ctx.strokeText(text, x, y);
    ctx.lineWidth = strength + 3; ctx.strokeStyle = `rgba(${PAPER},.6)`; ctx.strokeText(text, x, y);
    ctx.lineWidth = strength; ctx.strokeStyle = `rgba(${PAPER},.95)`; ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }
  function beads(size, gap, colour, offset = 0) {      // stroke the current path as a row of dots
    ctx.save(); ctx.setLineDash([.01, gap]); ctx.lineCap = 'round'; ctx.lineDashOffset = -offset;
    ctx.lineWidth = size + 3; ctx.strokeStyle = `rgba(${PAPER},.9)`; ctx.stroke();
    ctx.lineWidth = size; ctx.strokeStyle = colour; ctx.stroke(); ctx.restore();
  }
  function ring(x, y, radius, colour, size = 2.2, turn = 0) {
    const n = Math.max(6, Math.round(2 * Math.PI * radius / (size * 2.7)));
    ctx.beginPath(); ctx.arc(x, y, radius, turn, turn + 2 * Math.PI); beads(size, 2 * Math.PI * radius / n, colour);
  }
  function shape(kind, x, y, r) {
    ctx.beginPath();
    if (kind === 'doc') ctx.rect(x - r * .72, y - r, r * 1.44, r * 2);
    else if (kind === 'tool') { ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 1.15, y); ctx.lineTo(x, y + r * 1.15); ctx.lineTo(x - r * 1.15, y); ctx.closePath(); }
    else if (kind === 'said') { ctx.moveTo(x - r, y + r); ctx.lineTo(x - r, y); ctx.arc(x, y, r, Math.PI, Math.PI * 2.5); ctx.closePath(); }
    else if (kind === 'other') ctx.rect(x - r * .8, y - r * .8, r * 1.6, r * 1.6);
    else ctx.arc(x, y, r, 0, 2 * Math.PI);
  }
  function symbol(kind, x, y, r, clear = 2.6) {        // a work: its kind's shape in deep ink, in a small clearing of paper
    const hollow = kind === 'site' || kind === 'other', line = Math.max(1.4, r * .42);
    shape(kind, x, y, r); ctx.lineJoin = 'round';
    if (clear) { ctx.strokeStyle = PAPER_CSS; ctx.lineWidth = clear + (hollow ? line : 0); ctx.stroke(); }
    if (hollow) { ctx.fillStyle = PAPER_CSS; ctx.fill(); ctx.lineWidth = line; ctx.strokeStyle = KIND[kind]; ctx.stroke(); }
    else { ctx.fillStyle = KIND[kind]; ctx.fill(); }
  }
  const along = new Float32Array(33);
  function trail(a, b, bend, colour, gap, offset) {    // a curved route from a to b as evenly spaced dots; only those in view are drawn
    const ax = sx(a.x), ay = sy(a.y), bx = sx(b.x), by = sy(b.y), mx = (ax + bx) / 2 - (by - ay) * bend, my = (ay + by) / 2 + (bx - ax) * bend;
    const px = t => (1 - t) * (1 - t) * ax + 2 * t * (1 - t) * mx + t * t * bx, py = t => (1 - t) * (1 - t) * ay + 2 * t * (1 - t) * my + t * t * by;
    for (let i = 1, x0 = ax, y0 = ay; i <= 32; i++) { const x = px(i / 32), y = py(i / 32); along[i] = along[i - 1] + Math.hypot(x - x0, y - y0); x0 = x; y0 = y; }
    const spots = [];
    for (let d = offset % gap, i = 1; d < along[32]; d += gap) {
      while (along[i] < d) i++;
      const t = (i - 1 + (d - along[i - 1]) / (along[i] - along[i - 1] || 1)) / 32, x = px(t), y = py(t);
      if (x > -6 && y > -6 && x < W + 6 && y < H + 6) spots.push(x, y);
    }
    for (const [r, fill] of [[2.9, `rgba(${PAPER},.9)`], [1.35, colour]]) {
      ctx.beginPath(); for (let i = 0; i < spots.length; i += 2) { ctx.moveTo(spots[i] + r, spots[i + 1]); ctx.arc(spots[i], spots[i + 1], r, 0, 2 * Math.PI); }
      ctx.fillStyle = fill; ctx.fill();
    }
  }
  function nameSprite(p, lines, font, size, fill) {
    const key = p.id + '|' + font + '|' + fill;
    if (sprites.has(key)) return sprites.get(key);
    const m = 14, w = Math.ceil(Math.max(...lines.map(l => width(l, font)))) + m * 2, h = Math.ceil(lines.length * size * 1.14) + m * 2;
    const c = document.createElement('canvas'); c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    const g = c.getContext('2d'); g.scale(dpr, dpr); g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const each = fn => lines.forEach((l, i) => fn(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.14));
    // A soft clearing of paper so the name reads on any dots, then the name in a deep shade of its own colour.
    g.shadowColor = PAPER_CSS; g.shadowBlur = 5 * dpr; g.fillStyle = PAPER_CSS; g.strokeStyle = PAPER_CSS; g.lineWidth = 3;
    for (let i = 0; i < 3; i++) each((l, x, y) => { g.strokeText(l, x, y); });
    g.shadowColor = 'transparent'; g.shadowBlur = 0; g.lineWidth = 3.4; g.strokeStyle = `rgba(${PAPER},.96)`;
    each((l, x, y) => g.strokeText(l, x, y)); g.fillStyle = fill; each((l, x, y) => g.fillText(l, x, y));
    const s = { c, w, h, wide: w - m * 2 }; sprites.set(key, s); return s;
  }

  function card(w, z, alpha) {
    const cw = Math.max(138, Math.min(240, 56 * z)), pad = 11, inner = cw - pad * 2;
    const isSaid = w.kind === 'said';
    const tf = isSaid ? `italic 500 14px ${NAME}` : w.kind === 'tool' ? `600 11px ${MONO}` : `600 12px ${SANS}`, th = isSaid ? 17.5 : 15;
    const title = isSaid ? wrap('“' + w.pull + '”', tf, inner, z >= Z_GLOSS ? 7 : 4) : wrap(w.title, tf, inner, 3);
    const gf = `400 11px ${SANS}`, gloss = z >= Z_GLOSS && !isSaid && w.gloss ? wrap(w.gloss, gf, inner, 4) : [];
    const h = pad + 13 + title.length * th + (gloss.length ? 5 + gloss.length * 14 : 0) + 17 + pad - 5;
    const x = Math.round(sx(w.x) - cw / 2), y = Math.round(sy(w.y) - h / 2);
    const hot = hover?.type === 'work' && hover.id === w.id, chosen = sel.works.size === 1 && sel.works.has(w.id);
    ctx.save(); ctx.globalAlpha = alpha * (lit(w) ? 1 : .3);
    if (hot) { ctx.translate(x + cw / 2, y + h / 2 - 1.5); ctx.scale(1.04, 1.04); ctx.translate(-x - cw / 2, -y - h / 2); }
    ctx.shadowColor = hot ? 'rgba(84,52,20,.34)' : 'rgba(84,52,20,.2)'; ctx.shadowBlur = hot ? 22 : 10; ctx.shadowOffsetY = hot ? 7 : 3;
    ctx.fillStyle = isSaid ? '#fdf5dd' : '#fffdf7';
    ctx.beginPath(); ctx.roundRect(x, y, cw, h, 10); ctx.fill();
    ctx.shadowColor = 'transparent';
    if (chosen || hot) { const len = 2 * (cw + h) - 80 + 20 * Math.PI, n = Math.round(len / 7.5); ctx.beginPath(); ctx.roundRect(x - 4, y - 4, cw + 8, h + 8, 14); beads(2.4, (len + 32 + 8 * Math.PI) / n, HOT); }
    symbol(w.kind, x + pad + 4, y + pad + 4, 4, 0);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `400 9.5px ${MONO}`; ctx.fillStyle = 'rgba(58,46,36,.74)';
    const when = shortDay(w.date), room = inner - 14 - width(when, ctx.font) - 10;
    let src = source(w); if (width(src, ctx.font) > room) { while (src.length > 4 && width(src + '…', ctx.font) > room) src = src.slice(0, -1); src += '…'; }
    ctx.fillText(src, x + pad + 14, y + pad + 7.5); ctx.textAlign = 'right'; ctx.fillText(when, x + cw - pad, y + pad + 7.5); ctx.textAlign = 'left';
    ctx.font = tf; ctx.fillStyle = hot ? HOT : '#261f1a';
    title.forEach((l, i) => ctx.fillText(l, x + pad, y + pad + 13 + (i + 1) * th - 3));
    if (gloss.length) { ctx.font = gf; ctx.fillStyle = 'rgba(58,46,36,.84)'; gloss.forEach((l, i) => ctx.fillText(l, x + pad, y + pad + 13 + title.length * th + 5 + (i + 1) * 14 - 3)); }
    // The patterns it belongs to, as dots in their colours: larger for the ones it is central to.
    let dx = x + pad + 4; const dy = y + h - pad - 1;
    for (const [id, s] of w.patterns) { const p = patterns[pAt.get(id)]; if (!p) continue; const r = s >= 2 ? 4.2 : 2.9; ctx.beginPath(); ctx.arc(dx + r - 4, dy, r, 0, 2 * Math.PI); ctx.fillStyle = p.chip; ctx.fill(); dx += r * 2 + 4; }
    ctx.restore();
    hits.push({ type: 'work', id: w.id, box: [x, y, x + cw, y + h] });
  }

  function draw(dt, sc) {
    const z = cam.z, { hotPattern, one, linked } = sc;
    hits = [];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const r = markRadius(z), cards = z >= Z_CARD - .25 ? Math.min(1, (z - (Z_CARD - .25)) / .25) : 0;
    const march = still ? 0 : drift / 90, picked = !!focus();

    // Routes: from an open pattern to the ones it leads to, and from a work to the works it links.
    if (hotPattern) {
      const p = patterns[pAt.get(hotPattern)];
      for (const rel of p?.related || []) { const o = patterns[pAt.get(rel.id)]; if (o) trail(p, o, .16, p.lit, 9, march); }
    }
    if (one) for (const id of linked) trail(one, at.get(id), .12, HOT, 8, march);
    if ((hotPattern || (one && linked.size)) && awake && cards < 1) dirty = true;   // the routes march while someone is here

    // Works.
    const shown = plan(z), view = [wx(-140), wy(-90), wx(W + 140), wy(H + 90)];
    const visible = works.filter(w => w.x > view[0] && w.x < view[2] && w.y > view[1] && w.y < view[3]);
    for (const w of visible) {
      const x = sx(w.x), y = sy(w.y), hot = hover?.type === 'work' && hover.id === w.id, chosen = sel.works.size === 1 && sel.works.has(w.id);
      if (cards < 1) {
        const big = hot || chosen ? 1.55 : linked.has(w.id) ? 1.25 : picked && lit(w) ? 1.35 : 1;
        ctx.globalAlpha = (1 - cards) * (lit(w) ? 1 : .2) * arrived(w);
        symbol(w.kind, x, y, r * big, r * big < 1.8 ? 0 : z < .6 ? 1.3 : 2.8);
        if (hot || chosen || linked.has(w.id)) ring(x, y, r * big + 5.5, HOT, hot || chosen ? 2.4 : 1.9);
        hits.push({ type: 'work', id: w.id, at: [x, y], reach: Math.max(r + 4, 8) });
      }
      const t = shownAmount('w:' + w.id, shown.has('w:' + w.id) && cards < .5 ? 1 : 0, dt);
      if (t > .02) { ctx.globalAlpha = t * (lit(w) ? 1 : .3); ctx.font = titleFont; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; let label = w.title; while (width(label, titleFont) > 170 && label.length > 6) label = label.slice(0, -2); halo(label === w.title ? label : label.trimEnd() + '…', x + r + 5, y + .5, hot ? HOT : '#211b16', 3.2); }
    }
    ctx.globalAlpha = 1;
    if (cards > 0) {
      const order = visible.slice().sort((a, b) => (hover?.id === a.id) - (hover?.id === b.id) || a.y - b.y);
      for (const w of order) card(w, z, cards);
    }
    if (one && sel.works.has(one.id) && cards < 1 && !still) {   // a slow pulse on the open work: a ring of dots opening outward
      const pulse = (clock / 1500) % 1; ctx.globalAlpha = (1 - pulse) ** 1.5 * (1 - cards);
      ring(sx(one.x), sy(one.y), r * 1.55 + 7 + pulse * 22, HOT, 2.6 - pulse, clock / 2600); ctx.globalAlpha = 1; dirty = true;
    }

    // Pattern names: the only place names on the map.
    const font = patternFont(z), psize = parseFloat(font.match(/([\d.]+)px/)[1]);
    const dimOthers = focus() && sel.pattern && hover?.type !== 'pattern';
    for (const p of patterns) {
      const hot = hotPattern === p.id, close = sel.related.has(p.id) || focusPatterns?.pattern?.has?.(p.id);
      const want = shown.has('p:' + p.id) || hot || close ? (z >= Z_CARD ? .92 : 1) : 0;
      const t = shownAmount('p:' + p.id, want, dt);
      if (t < .02) continue;
      const lines = wrap(p.label, font, NAME_W, NAME_LINES), x = sx(p.x), y = sy(p.y);
      const s = nameSprite(p, lines, font, psize, hot || close ? p.lit : p.ink);
      ctx.globalAlpha = t * (dimOthers && !hot && !close ? .5 : 1);
      ctx.drawImage(s.c, Math.round(x - s.w / 2), Math.round(y - s.h / 2), s.w, s.h);
      hits.push({ type: 'pattern', id: p.id, box: [x - s.wide / 2 - 4, y - lines.length * psize * .6, x + s.wide / 2 + 4, y + lines.length * psize * .6] });
    }
    ctx.globalAlpha = 1;
    if (M.loose && z > zFit * 1.2) { ctx.font = `italic 500 13px ${NAME}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = .75; halo('not yet sorted', sx(M.loose[0]), sy(M.loose[1]) - 46 * z - 8, INK); ctx.globalAlpha = 1; }
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
    if (maker) { deadline = performance.now() + (dirty ? 3 : 9); if (maker.next().done) maker = null; }
    if (intro < 1) { intro = Math.min(1, (now - introStart) / 2000); glDirty = dirty = true; }
    const sc = scene(); easeDots(dt, sc);
    // The drift runs while someone is here, and rests after half a minute without input.
    awake = !still && now - lastInput < 30000; if (awake) { drift += dt; glDirty = true; }
    if (dirty) { dirty = false; glDirty = true; clampCam(); draw(dt, sc); const close = cam.z > zFit * 1.45; if (close !== wasClose) { wasClose = close; cb.onZoom?.(close); } }
    if (glDirty) { glDirty = false; drawDots(); }
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
    glcv.width = Math.round((W + EDGE * 2) * dpr); glcv.height = Math.round((H + EDGE * 2) * dpr);
    glcv.style.width = W + EDGE * 2 + 'px'; glcv.style.height = H + EDGE * 2 + 'px';
    zFit = Math.min((W - inset - insetLeft) / (M.width - 500), H / (M.height - 500)); zMin = zFit * .72; plans.clear(); sprites.clear(); dirty = true;
  }

  // ---- Pointer
  function pick(x, y) {
    for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (h.box && h.type === 'work' && x >= h.box[0] && x <= h.box[2] && y >= h.box[1] && y <= h.box[3]) return h; }
    let best = null, bestD = Infinity;
    for (const h of hits) if (h.at) { const d = Math.hypot(x - h.at[0], y - h.at[1]); if (d < h.reach && d < bestD) { best = h; bestD = d; } }
    if (best) return best;
    for (const h of hits) if (h.type === 'pattern' && x >= h.box[0] && x <= h.box[2] && y >= h.box[1] && y <= h.box[3]) return h;
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
      cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, e); tween = null; zoomGoal = null; velocity = null; lastInput = performance.now();
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: cam.z }; drag = null; }
      else drag = { x: e.clientX, y: e.clientY, moved: 0, t: performance.now(), vx: 0, vy: 0 };
    });
    cv.addEventListener('pointermove', e => {
      const box = cv.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
      lastInput = performance.now();
      if (e.pointerType !== 'touch') { if (!mouse.on && mouse.s === 0) { mouse.x = x; mouse.y = y; } mouse.tx = x; mouse.ty = y; mouse.on = true; }
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
    cv.addEventListener('pointerleave', () => { mouse.on = false; if (!drag) setHover(null); });
    cv.addEventListener('wheel', e => {
      e.preventDefault(); tween = null; velocity = null; lastInput = performance.now();
      const box = cv.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
      if (!zoomGoal || !anchor || Math.hypot(anchor.sx - x, anchor.sy - y) > 2) anchor = { sx: x, sy: y, wx: wx(x), wy: wy(y) };
      const step = e.ctrlKey ? -e.deltaY * .012 : -e.deltaY * (e.deltaMode ? .08 : .0022);
      zoomGoal = Math.max(zMin, Math.min(Z_MAX, (zoomGoal || cam.z) * Math.exp(step)));
      cb.onHover?.(null);
    }, { passive: false });
    cv.addEventListener('dblclick', e => { const box = cv.getBoundingClientRect(); zoomAt(1.9, e.clientX - box.left, e.clientY - box.top); });
    addEventListener('keydown', () => { lastInput = performance.now(); });
    new ResizeObserver(resize).observe(cv);
  }
  function zoomAt(factor, x = cx(), y = cy()) { tween = null; lastInput = performance.now(); anchor = { sx: x, sy: y, wx: wx(x), wy: wy(y) }; zoomGoal = Math.max(zMin, Math.min(Z_MAX, (zoomGoal || cam.z) * factor)); }

  // ---- What the page can ask of the map
  function setWorks(list) {
    works = list.filter(w => M.works[w.id]).map(w => ({ ...w, x: M.works[w.id][0], y: M.works[w.id][1] }));
    at = new Map(works.map(w => [w.id, w]));
    byPattern = new Map(patterns.map(p => [p.id, new Set()]));
    for (const w of works) for (const [p] of w.patterns) byPattern.get(p)?.add(w.id);
    const size = id => byPattern.get(id)?.size || 0;
    patterns.sort((a, b) => size(b.id) - size(a.id));
    pAt = new Map(patterns.map((p, i) => [p.id, i]));
    plans.clear(); dirty = true;
    if (gl) startDots();
  }
  return {
    init(canvas, data, callbacks) {
      cv = canvas; ctx = cv.getContext('2d'); D = data; M = data.map; cb = callbacks;
      const style = getComputedStyle(document.body);
      for (const k of Object.keys(KIND)) KIND[k] = style.getPropertyValue('--' + k).trim() || KIND[k];
      patterns = data.patterns.filter(p => M.patterns[p.id]).map(p => ({ ...p, x: M.patterns[p.id][0], y: M.patterns[p.id][1] }));
      patterns.forEach(paint);
      setWorks(data.works); setupGl(); resize(); bind();
      cam.x = M.width / 2; cam.y = M.height / 2; cam.z = still ? zFit : zFit * 1.22; if (!still) fly({ x: M.width / 2, y: M.height / 2, z: zFit }, 1500);
      lastInput = performance.now(); startDots();
      cv.style.cursor = 'grab';
      const fresh = () => { measured.clear(); wrapped.clear(); plans.clear(); sprites.clear(); dirty = true; };
      document.fonts?.ready.then(fresh);
      for (const f of [`italic 500 16px ${NAME}`, `600 30px ${NAME}`]) document.fonts?.load(f).then(fresh);
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
    dots: () => levels.reduce((n, l) => n + l.count, 0),
  };
})();
