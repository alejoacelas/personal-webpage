// The map as a night sky. Each pattern is a cloud of glowing gas in its own colour, densest where
// its works are; the works are stars; links between works are constellation lines.
// Two canvases: a WebGL one underneath paints the clouds, and the 2D one passed to init() draws the
// stars, lines, names and cards on top and receives every pointer event.
// It answers to the same MapView calls as map.js, so app.js drives either one.
window.MapView = (() => {
  const KIND = { post: '#dcc6ff', doc: '#8fc6ff', tool: '#7ff2b4', site: '#5fe3f2', said: '#ffd470', other: '#aab4cc' };
  const ICE = '#d6e8ff';                                  // starlight: rings, lit lines, hot text
  const UI = 'Jost, "Avenir Next", Futura, -apple-system, "Segoe UI", sans-serif';
  const QUOTE = 'Newsreader, "Iowan Old Style", Georgia, serif';
  const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
  const Z_TITLE = 1.05, Z_CARD = 2.3, Z_GLOSS = 3.3, Z_MAX = 5.5;
  const CELL = 6;                                         // map units per texel of the cloud field
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let cv, ctx, M, D, cb, W = 0, H = 0, dpr = 1, zFit = .3, zMin = .2;
  const cam = { x: 0, y: 0, z: .3 };
  let tween = null, zoomGoal = null, anchor = null, velocity = null, drag = null;
  let inset = 0, insetLeft = 0;
  let works = [], at = new Map(), byPattern = new Map(), patterns = [], pAt = new Map(), links = [];
  let hover = null, focusPatterns = null;
  let sel = { works: new Set(), pattern: null, related: new Set() };
  let filter = null, selCount = 0, focusCount = 0;
  let colouring = 'topic', turned = -1e9;      // what the clouds are coloured by ('topic' or 'source'), and when that last changed
  let dirty = true, last = 0, clock = 0, born = 0, wasClose = false, tick = 0;
  const fade = new Map();           // label key → shown amount, eased
  const plans = new Map();          // zoom bucket → which labels fit
  let hits = [];                    // what the last frame drew, for clicks
  let sprites = {}, dots = [], sky = [], meteor = null, nextMeteor = 0;

  // ---- Geometry and text helpers
  const cx = () => insetLeft + (W - inset - insetLeft) / 2, cy = () => H / 2;
  const sx = x => (x - cam.x) * cam.z + cx(), sy = y => (y - cam.y) * cam.z + cy();
  const wx = x => (x - cx()) / cam.z + cam.x, wy = y => (y - cy()) / cam.z + cam.y;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mod = (a, n) => ((a % n) + n) % n;
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
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
  const source = w => w.kind === 'post' ? (w.slack.channel === 'private-channel' ? 'a private channel' : '#' + w.slack.channel) : w.kind === 'said' ? 'call excerpt' : ({ doc: 'Google Doc', sheet: 'Google Sheet', repo: 'repository', gist: 'gist', site: 'live site', file: 'link' })[w.sub] || w.sub;
  const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;

  // ---- Colour. Every pattern's hue comes from its place on the map (data.map.tint), so neighbours
  // have neighbouring hues. `light` is the colour its gas emits; `name` is the pale version for text.
  function hsl(h, s, l) {
    const f = n => { const k = (n + h / 30) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return [f(0), f(8), f(4)];
  }
  const HUES = [[0, 350], [20, 372], [40, 388], [60, 401], [82, 412], [104, 498], [125, 516], [150, 532], [180, 547], [210, 568], [240, 591], [270, 622], [300, 656], [330, 688], [360, 710]];
  const toLinear = c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
  function tintOf(id) {
    const [raw, far] = M.tint?.[id] || [222, .5];
    // The hue wheel is bent a little towards the colours glowing gas really has: rose, amber, sea-green,
    // azure, violet. The acid yellow-greens are passed through quickly and toned down.
    let i = 1; while (HUES[i][0] < raw) i++;
    const h = (HUES[i - 1][1] + (HUES[i][1] - HUES[i - 1][1]) * (raw - HUES[i - 1][0]) / (HUES[i][0] - HUES[i - 1][0])) % 360;
    const acid = Math.max(0, 1 - Math.abs(h - 105) / 55);
    // Gas near the middle of the map burns a little paler, like the core of a galaxy.
    const rgb = hsl(h, (.68 + .26 * Math.min(1, far)) * (1 - .4 * acid), .56).map(toLinear);
    const y = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2], k = (.2 / y) ** .6;   // even out how bright the hues look
    const css = hsl(h, .92 - .3 * acid, .88).map(v => Math.round(v * 255));
    return { light: rgb.map(v => v * k), name: `rgb(${css})` };
  }

  // ---- The cloud field: how much light each pattern's gas gives off at every point of the map.
  // Built once on the CPU at one texel per CELL map units, then warped and lit by the shader.
  const fw = () => Math.ceil(M.width / CELL), fh = () => Math.ceil(M.height / CELL);
  let scratch = null;
  function splat(buf, n, m, x, y, sigma, amount, box) {
    const px = x / CELL, py = y / CELL, s = sigma / CELL, reach = Math.ceil(s * 2.8), k = -1 / (2 * s * s);
    const i0 = Math.max(0, Math.floor(px - reach)), i1 = Math.min(n - 1, Math.ceil(px + reach)), j0 = Math.max(0, Math.floor(py - reach)), j1 = Math.min(m - 1, Math.ceil(py + reach));
    for (let j = j0; j <= j1; j++) { const dy = (j + .5 - py) ** 2, row = j * n; for (let i = i0; i <= i1; i++) buf[row + i] += amount * Math.exp(((i + .5 - px) ** 2 + dy) * k); }
    if (box) { box[0] = Math.min(box[0], i0); box[1] = Math.min(box[1], j0); box[2] = Math.max(box[2], i1); box[3] = Math.max(box[3], j1); }
  }
  // One pattern's cloud: its works spread out, then sharpened so the heart glows and the fringe thins.
  function cloud(out, list, colour, gain, sharpen = 1.9) {
    const n = fw(), m = fh(), box = [n, m, 0, 0];
    scratch ||= new Float32Array(n * m);
    for (const [w, strength] of list) splat(scratch, n, m, w.x, w.y, 68, strength === 2 ? 1 : .55, box);
    for (let j = box[1]; j <= box[3]; j++) for (let i = box[0]; i <= box[2]; i++) {
      const at = j * n + i, v = scratch[at]; scratch[at] = 0;
      if (v < .004) continue;
      const e = (v / 3.3) ** sharpen * gain, o = at * 3;
      out[o] += colour[0] * e; out[o + 1] += colour[1] * e; out[o + 2] += colour[2] * e;
    }
  }
  // A star lights the gas right around it.
  function knot(out, w, colour, amount, sigma = 26) {
    const n = fw(), m = fh(), px = w.x / CELL, py = w.y / CELL, s = sigma / CELL, reach = Math.ceil(s * 2.8), k = -1 / (2 * s * s);
    for (let j = Math.max(0, Math.floor(py - reach)); j <= Math.min(m - 1, Math.ceil(py + reach)); j++) for (let i = Math.max(0, Math.floor(px - reach)); i <= Math.min(n - 1, Math.ceil(px + reach)); i++) {
      const e = amount * Math.exp(((i + .5 - px) ** 2 + (j + .5 - py) ** 2) * k), o = (j * n + i) * 3;
      out[o] += colour[0] * e; out[o + 1] += colour[1] * e; out[o + 2] += colour[2] * e;
    }
  }
  // A wide soft copy added back on, so every cloud has a faint outer haze.
  function haze(out, radius, amount) {
    const n = fw(), m = fh(), a = new Float32Array(out), b = new Float32Array(out.length);
    const pass = (src, dst, len, lines, step, stride) => {
      for (let c = 0; c < 3; c++) for (let l = 0; l < lines; l++) {
        const base = l * stride * 3 + c; let sum = 0;
        for (let i = -radius; i <= radius; i++) sum += src[base + clamp(i, 0, len - 1) * step * 3];
        for (let i = 0; i < len; i++) { dst[base + i * step * 3] = sum / (2 * radius + 1); sum += src[base + Math.min(len - 1, i + radius + 1) * step * 3] - src[base + Math.max(0, i - radius) * step * 3]; }
      }
    };
    for (let k = 0; k < 2; k++) { pass(a, b, n, m, 1, n); pass(b, a, m, n, n, 1); }
    for (let i = 0; i < out.length; i++) out[i] += a[i] * amount;
  }
  // The same idea for the other colouring, where a cloud's colour says what kind of work is there:
  // each kind's gas glows in a deeper version of its star's colour.
  const GAS = Object.fromEntries(Object.entries({ post: [262, .58], doc: [212, .85], tool: [150, .7], site: [187, .8], said: [40, .9], other: [222, .18] }).map(([kind, [h, s]]) => {
    const rgb = hsl(h, s, .56).map(toLinear), y = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2], k = (.2 / y) ** .6;
    return [kind, rgb.map(v => v * k)];
  }));
  const colourOfWork = w => {
    if (colouring === 'source') return GAS[w.kind] || GAS.other;
    const c = [0, 0, 0]; let total = 0;
    for (const [p, s] of w.patterns) { const t = pAt.get(p); if (t) { c[0] += t.light[0] * s; c[1] += t.light[1] * s; c[2] += t.light[2] * s; total += s; } }
    return total ? c.map(v => v / total) : [.16, .18, .26];
  };
  function buildField() {
    const out = new Float32Array(fw() * fh() * 3);
    if (colouring === 'source') for (const kind of Object.keys(GAS)) cloud(out, works.filter(w => w.kind === kind).map(w => [w, 2]), GAS[kind], kind === 'post' ? .5 : .85, 1.5);      // posts are everywhere, so their gas is thinner
    else for (const p of patterns) cloud(out, [...(byPattern.get(p.id) || [])].map(id => [at.get(id), at.get(id).patterns.find(x => x[0] === p.id)?.[1] || 1]), p.light, 1);
    for (const w of works) knot(out, w, w.light, .3);
    haze(out, 13, .34);
    return out;
  }
  // The light of whatever is singled out (a pattern, a few patterns, or a set of works), drawn over a dimmed sky.
  function buildFocus(spec) {
    const out = new Float32Array(fw() * fh() * 3);
    if (spec.patterns && colouring === 'source') spec = { works: spec.patterns.flatMap(id => [...(byPattern.get(id) || [])]) };      // coloured by source, a pattern's works glow each in its own kind's colour
    for (const id of spec.patterns || []) {
      const p = pAt.get(id); if (!p) continue;
      const list = [...(byPattern.get(id) || [])].map(w => [at.get(w), at.get(w).patterns.find(x => x[0] === id)?.[1] || 1]);
      cloud(out, list, p.light, 2.6, 1.25);
      for (const [w, strength] of list) knot(out, w, p.light, strength === 2 ? .62 : .4, 36);     // so a work far from the rest still shows
    }
    if (spec.works) for (const id of spec.works) { const w = at.get(id); if (w) { knot(out, w, w.light, .5, 74); knot(out, w, w.light, .7, 32); } }
    return out;
  }

  // ---- Noise the shader samples instead of computing: four seamless layers in one texture.
  // R and G push the clouds around, B is billowing density, A is ridged (filaments and dust lanes).
  function buildNoise(n) {
    const out = new Uint8Array(n * n * 4), layer = new Float32Array(n * n), rand = rng(20261121);
    for (let c = 0; c < 4; c++) {
      layer.fill(0);
      const ridged = c === 3; let amp = 1;
      for (let freq = c < 2 ? 3 : 4, o = 0; o < 6; o++, freq *= 2, amp *= ridged ? .55 : .5) {
        const gx = new Float32Array(freq * freq), gy = new Float32Array(freq * freq);
        for (let i = 0; i < freq * freq; i++) { const a = rand() * 6.2832; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
        for (let y = 0; y < n; y++) {
          const Y = y * freq / n, y0 = Math.floor(Y), fy = Y - y0, y1 = (y0 + 1) % freq, v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
          for (let x = 0; x < n; x++) {
            const X = x * freq / n, x0 = Math.floor(X), fx = X - x0, x1 = (x0 + 1) % freq, u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
            const a = gx[y0 * freq + x0] * fx + gy[y0 * freq + x0] * fy, b = gx[y0 * freq + x1] * (fx - 1) + gy[y0 * freq + x1] * fy;
            const d = gx[y1 * freq + x0] * fx + gy[y1 * freq + x0] * (fy - 1), e = gx[y1 * freq + x1] * (fx - 1) + gy[y1 * freq + x1] * (fy - 1);
            const val = (a + (b - a) * u) + ((d + (e - d) * u) - (a + (b - a) * u)) * v;
            layer[y * n + x] += amp * (ridged ? (1 - Math.min(1, Math.abs(val) * 2.6)) ** 2 : val);
          }
        }
      }
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < n * n; i++) { lo = Math.min(lo, layer[i]); hi = Math.max(hi, layer[i]); }
      for (let i = 0; i < n * n; i++) out[i * 4 + c] = Math.round((layer[i] - lo) / (hi - lo) * 255);
    }
    return out;
  }

  // ---- The cloud layer (WebGL2). Without WebGL2 the sky stays dark: stars, lines, names and cards still work.
  const VERT = `#version 300 es
    void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
  const FRAG = `#version 300 es
    precision highp float;
    uniform vec2 uView, uCentre, uWorld;      // view size and map centre on screen in CSS px; map size in map units
    uniform vec3 uCam;                        // x, y, zoom
    uniform float uScale, uPhase, uFocus, uFar, uGain, uNear;
    uniform sampler2D uField, uLit, uNoise;
    out vec4 colour;
    float grain(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main() {
      vec2 s = vec2(gl_FragCoord.x, uView.y * uScale - gl_FragCoord.y) / uScale;
      vec2 p = (s - uCentre) / uCam.z + uCam.xy, q = p / 1500.;

      // Push the gas around with two sizes of slow swirl, so edges curl instead of fading evenly.
      vec4 a = texture(uNoise, q + vec2(uPhase, uPhase * .6));
      vec4 b = texture(uNoise, q * 2.9 + (a.rg - .5) * .45 + vec2(-uPhase * 1.4, uPhase * .9));
      vec4 c = texture(uNoise, q * 7.7 + (b.rg - .5) * .3 + vec2(uPhase * 2.2, -uPhase * 1.3));
      vec2 uv = (p + (a.rg - .5) * 230. + (b.rg - .5) * 96. + (c.rg - .5) * 30.) / uWorld;
      vec3 gas = texture(uField, uv).rgb * mix(1., .13, uFocus) + texture(uLit, uv).rgb * uFocus;

      // Density: billows with dark gaps between them, bright filaments, and dust lanes that cut across the glow.
      vec4 d = texture(uNoise, q * 19. + (c.rg - .5) * .22 - vec2(uPhase * 3., uPhase * 2.));
      float billow = a.b * mix(.44, .3, uNear) + b.b * mix(.34, .31, uNear) + c.b * mix(.16, .25, uNear) + d.b * mix(.06, .14, uNear);
      float thick = smoothstep(.3, .74, billow);
      float threads = pow(b.a * mix(.5, .34, uNear) + c.a * mix(.36, .38, uNear) + d.a * mix(.14, .28, uNear), 3.) * (.35 + thick);
      float dust = smoothstep(.47, .7, a.a * .5 + b.b * .3 + c.a * .2) * (1. - uFocus * .5);
      gas *= (.07 + 1.35 * thick * thick + 2.3 * threads) * (1. - .86 * dust);
      // Closer in, thin gas falls away faster than thick, so there is dark between the wisps.
      float lum = max(gas.r, max(gas.g, gas.b));
      gas *= mix(1., smoothstep(0., 1.1, lum) * 1.55, uNear * .75);

      // Far behind everything: a dim haze that slides more slowly than the map.
      vec2 h = (s - uView * .5) / uView.y * uFar * .5 + uCam.xy / uWorld * .42;
      vec4 hz = texture(uNoise, h + vec2(.37, .11) + uPhase * .3);
      vec4 hy = texture(uNoise, h * 2.3 + (hz.rg - .5) * .3);
      vec3 deep = mix(vec3(.012, .03, .085), vec3(.07, .022, .1), hz.r) * smoothstep(.32, .78, hz.b * .6 + hy.b * .4) * (.5 + hy.a);

      vec3 col = vec3(.0045, .006, .017) + deep * .5 + gas * uGain;
      float peak = max(col.r, max(col.g, col.b));
      vec3 kept = col * ((1. - exp(-peak * 1.5)) / max(peak, 1e-4));      // keeps the hue
      vec3 hot = 1. - exp(-col * 1.5);                                   // lets the brightest cores go pale
      col = pow(mix(kept, hot, .22), vec3(1. / 2.2));
      vec2 e = (s / uView - .5) * vec2(1., .9);
      col *= 1. - .34 * smoothstep(.34, .86, length(e));
      col += (grain(gl_FragCoord.xy + fract(uPhase * 61.)) - .5) * (1.6 / 255.);
      colour = vec4(col, 1.);
    }`;
  let glc = null, gl = null, G = null, glScale = 1, phase = 0, cardsNow = 0, focusKey = '', focusNow = 0, fieldData = null, noiseData = null, litData = null;
  function startGL() {
    try { linkGL(); } catch (e) { G = null; console.warn('Nebula map: the cloud shader failed to start, so the clouds are not drawn.', e); }
  }
  function linkGL() {
    gl = glc.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl) { console.warn('Nebula map: WebGL2 is not available, so the clouds are not drawn.'); return; }
    const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    G = { u: {}, vao: gl.createVertexArray() };
    for (const name of ['uView', 'uCentre', 'uWorld', 'uCam', 'uScale', 'uPhase', 'uFocus', 'uFar', 'uGain', 'uNear', 'uField', 'uLit', 'uNoise']) G.u[name] = gl.getUniformLocation(prog, name);
    gl.bindVertexArray(G.vao);
    const texture = (unit, wrap) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); return t; };
    G.field = texture(0, gl.CLAMP_TO_EDGE); G.lit = texture(1, gl.CLAMP_TO_EDGE); G.noise = texture(2, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, noiseData);
    gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.uniform1i(G.u.uField, 0); gl.uniform1i(G.u.uLit, 1); gl.uniform1i(G.u.uNoise, 2);
    upload(G.field, 0, fieldData); upload(G.lit, 1, litData || new Float32Array(fw() * fh() * 3));
    sizeGL();
  }
  function upload(tex, unit, data) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB16F, fw(), fh(), 0, gl.RGB, gl.FLOAT, data); }
  function sizeGL() { if (!glc) return; glc.width = Math.max(2, Math.round(W * glScale)); glc.height = Math.max(2, Math.round(H * glScale)); }
  function refield() { for (const w of works) w.light = colourOfWork(w); fieldData = buildField(); if (G) upload(G.field, 0, fieldData); focusKey = ''; }
  // What the clouds should single out right now, as a key (to notice changes) and a recipe.
  function focusSpec() {
    if (hover?.type === 'pattern') return { key: 'p:' + hover.id, patterns: [hover.id] };
    if (focusPatterns) return focusPatterns.pattern.size ? { key: 'f:' + focusCount, patterns: [...focusPatterns.pattern] } : { key: 'f:' + focusCount, works: [...focusPatterns] };
    if (sel.pattern && sel.works.size > 1) return { key: 'p:' + sel.pattern, patterns: [sel.pattern] };
    if (sel.works.size > 1) return { key: 's:' + selCount, works: [...sel.works] };
    return null;
  }
  function paintClouds(dt, cards) {
    if (!G || gl.isContextLost()) return;
    const spec = focusSpec();
    if (spec && spec.key !== focusKey) { focusKey = spec.key; litData = buildFocus(spec); upload(G.lit, 1, litData); focusNow = Math.min(focusNow, .45); }
    const want = spec ? 1 : 0;
    focusNow = still ? want : focusNow + (want - focusNow) * Math.min(1, dt / 160);
    if (Math.abs(focusNow - want) < .004) focusNow = want; else dirty = true;
    const intro = still ? 1 : clamp((clock - born) / 1700, 0, 1) * (.25 + .75 * clamp((clock - turned) / 800, 0, 1));      // the clouds swell in at the start and after a change of colouring
    if (!still && clock - turned < 900) dirty = true;
    gl.viewport(0, 0, glc.width, glc.height);
    gl.uniform2f(G.u.uView, W, H); gl.uniform2f(G.u.uCentre, cx(), cy()); gl.uniform2f(G.u.uWorld, M.width, M.height);
    gl.uniform3f(G.u.uCam, cam.x, cam.y, cam.z); gl.uniform1f(G.u.uScale, glc.width / W);
    gl.uniform1f(G.u.uPhase, phase); gl.uniform1f(G.u.uFocus, focusNow); gl.uniform1f(G.u.uFar, (cam.z / zFit) ** -.72);
    // Closer in, the gas is thinner to look through, so what sits on it stays easy to read.
    const depth = clamp(Math.log(cam.z / zFit) / Math.log(Z_CARD / zFit), 0, 1);
    gl.uniform1f(G.u.uGain, intro * intro * (3 - 2 * intro) * (1 - .63 * depth ** .7) * (1 - .26 * cards)); gl.uniform1f(G.u.uNear, depth);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---- Stars. One small picture per kind of work, drawn once and stamped wherever a work sits.
  // post: a round star. doc: a star with long cross-shaped rays. said: a four-pointed spark.
  // tool: a cut diamond. site: a ringed world. other: a small dim point.
  const REACH = 5.6;                                       // how many core radii the glow reaches
  const SIZES = [4, 8, 16];                                // each star is kept at three sizes (pixels per core radius), so shrinking one never has to be done per frame
  function shape(g, kind, r) {
    g.beginPath();
    if (kind === 'said') { const t = r * 2, n = r * .36; g.moveTo(0, -t); g.quadraticCurveTo(n, -n, t, 0); g.quadraticCurveTo(n, n, 0, t); g.quadraticCurveTo(-n, n, -t, 0); g.quadraticCurveTo(-n, -n, 0, -t); }
    else if (kind === 'tool') { const t = r * 1.3; g.moveTo(0, -t); g.lineTo(t, 0); g.lineTo(0, t); g.lineTo(-t, 0); }
    else if (kind === 'site') g.arc(0, 0, r * 1.12, 0, 2 * Math.PI);
    else g.arc(0, 0, r * (kind === 'other' ? .75 : 1.12), 0, 2 * Math.PI);
    g.closePath();
  }
  function paintStar(kind, U) {
    const size = Math.ceil(U * REACH * 2), c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), col = KIND[kind]; g.translate(size / 2, size / 2);
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, U * REACH), bright = kind === 'other' ? .45 : 1;
    glow.addColorStop(0, rgba(col, .8 * bright)); glow.addColorStop(.17, rgba(col, .34 * bright)); glow.addColorStop(.36, rgba(col, .12 * bright)); glow.addColorStop(.62, rgba(col, .035 * bright)); glow.addColorStop(1, rgba(col, 0));
    g.fillStyle = glow; g.fillRect(-size / 2, -size / 2, size, size);
    if (kind === 'doc') for (const turn of [0, Math.PI / 2]) {         // rays, as a telescope draws on a bright star
      g.save(); g.rotate(turn);
      const far = U * 5.2, ray = g.createLinearGradient(-far, 0, far, 0);
      ray.addColorStop(0, rgba(col, 0)); ray.addColorStop(.36, rgba(col, .75)); ray.addColorStop(.5, 'rgba(255,255,255,.95)'); ray.addColorStop(.64, rgba(col, .75)); ray.addColorStop(1, rgba(col, 0));
      g.fillStyle = ray; g.beginPath(); g.moveTo(-far, 0); g.lineTo(0, -U * .27); g.lineTo(far, 0); g.lineTo(0, U * .27); g.closePath(); g.fill();
      g.restore();
    }
    shape(g, kind, U);
    if (kind === 'site') { g.lineWidth = U * .42; g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = U * .6; g.stroke(); g.shadowBlur = 0; g.beginPath(); g.arc(0, 0, U * .3, 0, 2 * Math.PI); g.fillStyle = '#fff'; g.fill(); }
    else {
      const round = kind === 'post' || kind === 'doc' || kind === 'other';     // round stars have a soft edge, cut shapes a crisp one
      const core = g.createRadialGradient(0, 0, 0, 0, 0, U * (kind === 'said' ? 2 : kind === 'tool' ? 1.3 : kind === 'other' ? .75 : 1.12));
      if (round) { core.addColorStop(0, '#fff'); core.addColorStop(kind === 'other' ? .2 : kind === 'doc' ? .5 : .58, kind === 'other' ? col : '#fff'); core.addColorStop(.82, rgba(col, .8)); core.addColorStop(1, rgba(col, 0)); }
      else { core.addColorStop(0, '#fff'); core.addColorStop(kind === 'tool' ? .3 : .5, '#fff'); core.addColorStop(1, col); }
      g.fillStyle = core; g.shadowColor = col; g.shadowBlur = round ? 0 : U * .8; g.fill(); g.shadowBlur = 0;
    }
    return c;
  }
  function buildSprites() {
    for (const kind of Object.keys(KIND)) sprites[kind] = SIZES.map(U => paintStar(kind, U));
    // The far stars: three tints of one soft dot.
    dots = ['#ffffff', '#bcd4ff', '#ffe2bd'].map(col => {
      const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
      const d = g.createRadialGradient(16, 16, 0, 16, 16, 16); d.addColorStop(0, rgba(col, 1)); d.addColorStop(.22, rgba(col, .85)); d.addColorStop(.5, rgba(col, .16)); d.addColorStop(1, rgba(col, 0));
      g.fillStyle = d; g.fillRect(0, 0, 32, 32); return c;
    });
  }
  function star(kind, x, y, r, alpha) {
    const half = r * REACH, want = r * dpr, level = want <= SIZES[0] * 1.15 ? 0 : want <= SIZES[1] * 1.15 ? 1 : 2;
    ctx.globalAlpha = alpha; ctx.drawImage(sprites[kind][level], x - half, y - half, half * 2, half * 2);
  }

  // ---- Depth: three sheets of far stars that slide and grow more slowly than the map, the farthest slowest.
  const SHEETS = [
    { slide: .028, grow: .1, n: 760, tile: 1500, size: [.9, 1.9], light: [.16, .6] },
    { slide: .055, grow: .2, n: 210, tile: 1500, size: [1.5, 2.9], light: [.3, .78] },
    { slide: .1, grow: .34, n: 44, tile: 1500, size: [2.8, 5.2], light: [.5, .95] },
  ];
  function buildSky() {
    const rand = rng(4242);
    sky = SHEETS.map(s => ({ ...s, stars: Array.from({ length: s.n }, () => { const big = rand() ** 3; return { x: rand() * s.tile, y: rand() * s.tile, d: s.size[0] + (s.size[1] - s.size[0]) * big, a: s.light[0] + (s.light[1] - s.light[0]) * (.35 * rand() + .65 * big), tint: rand() < .6 ? 0 : rand() < .62 ? 1 : 2, rate: rand() < .4 ? .0006 + rand() * .0016 : 0, at: rand() * 6.28 }; }) }));
  }
  function drawSky(amount) {
    for (const sheet of sky) {
      const s = (cam.z / zFit) ** sheet.grow, T = sheet.tile * s;
      const ox = mod(W / 2 - cam.x * sheet.slide * s, T), oy = mod(H / 2 - cam.y * sheet.slide * s, T);
      for (let ty = oy - T; ty < H; ty += T) for (let tx = ox - T; tx < W; tx += T) for (const st of sheet.stars) {
        const x = tx + st.x * s, y = ty + st.y * s;
        if (x < -4 || y < -4 || x > W + 4 || y > H + 4) continue;
        ctx.globalAlpha = amount * st.a * (st.rate && !still ? .72 + .28 * Math.sin(clock * st.rate + st.at) : 1);
        ctx.drawImage(dots[st.tint], x - st.d, y - st.d, st.d * 2, st.d * 2);
      }
    }
    // Now and then a meteor crosses the far sky.
    if (still) return;
    if (!meteor && clock > nextMeteor) { if (nextMeteor && cam.z < Z_CARD) { const a = Math.PI * (.12 + .2 * Math.random()), left = Math.random() < .5; meteor = { x: W * (.1 + .8 * Math.random()), y: H * (.05 + .5 * Math.random()), dx: Math.cos(a) * (left ? -1 : 1), dy: Math.sin(a), t0: clock, len: 150 + 160 * Math.random() }; } nextMeteor = clock + 12000 + Math.random() * 24000; }
    if (meteor) {
      const t = (clock - meteor.t0) / 760;
      if (t >= 1) meteor = null;
      else {
        const head = t * 2.1 * meteor.len, tail = Math.max(0, head - meteor.len * .55), hx = meteor.x + meteor.dx * head, hy = meteor.y + meteor.dy * head, tx = meteor.x + meteor.dx * tail, ty = meteor.y + meteor.dy * tail;
        const g = ctx.createLinearGradient(tx, ty, hx, hy); g.addColorStop(0, 'rgba(210,228,255,0)'); g.addColorStop(1, `rgba(235,244,255,${.75 * Math.sin(Math.PI * t)})`);
        ctx.globalAlpha = amount; ctx.strokeStyle = g; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      }
    }
  }

  // ---- Which labels fit at a zoom level. Sizes are in screen pixels, so this only depends on zoom.
  const patternFont = z => `500 ${z < zFit * 1.5 ? 13 : z < 1 ? 15 : 16.5}px ${UI}`;
  const titleFont = `500 12.5px ${UI}`;
  function plan(z) {
    const key = Math.round(Math.log2(z) * 6);
    if (plans.has(key)) return plans.get(key);
    const zz = 2 ** (key / 6), placed = [], shown = new Set();
    const free = r => !placed.some(p => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1]);
    const font = patternFont(zz), size = parseFloat(font.match(/([\d.]+)px/)[1]);
    for (const p of patterns) {
      const lines = wrap(p.label, font, 156, 3), w = Math.max(...lines.map(l => width(l, font))), h = lines.length * size * 1.2;
      const r = [p.x * zz - w / 2 - 6, p.y * zz - h / 2 - 3, p.x * zz + w / 2 + 6, p.y * zz + h / 2 + 3];
      if (free(r)) { placed.push(r); shown.add('p:' + p.id); }
    }
    if (zz >= Z_TITLE && zz < Z_CARD) {
      const radius = markRadius(zz) + 1.5;
      const marks = works.map(w => [w.x * zz - radius - 1, w.y * zz - radius - 1, w.x * zz + radius + 1, w.y * zz + radius + 1]);
      works.forEach((w, i) => {
        const tw = Math.min(176, width(w.title, titleFont)), x = w.x * zz + radius + 5, y = w.y * zz;
        const r = [x - 2, y - 8.5, x + tw + 4, y + 8.5];
        if (free(r) && !marks.some((m, j) => j !== i && r[0] < m[2] && r[2] > m[0] && r[1] < m[3] && r[3] > m[1])) { placed.push(r); shown.add('w:' + w.id); }
      });
    }
    plans.set(key, shown);
    return shown;
  }
  const markRadius = z => Math.min(clamp(1.25 + 2.5 * z, 2.1, 5.6), Math.max(1.1, 11 * z));      // on a small screen the whole map is tiny, and so are its stars

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
  // Text on the sky: a dark edge keeps it readable over the brightest gas.
  function halo(text, x, y, fill, strength = 3.4, dark = .5) {
    ctx.lineJoin = 'round'; ctx.lineWidth = strength; ctx.strokeStyle = `rgba(3,5,15,${dark})`;
    ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }
  function curve(a, b, bend = .16) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx - dy * bend, my + dx * bend, b.x, b.y);
  }
  // A constellation line stops short of the stars it joins.
  function segment(a, b, gap) {
    const ax = sx(a.x), ay = sy(a.y), bx = sx(b.x), by = sy(b.y), d = Math.hypot(bx - ax, by - ay);
    if (d < gap * 2 + 2) return;
    const ux = (bx - ax) / d, uy = (by - ay) / d;
    ctx.moveTo(ax + ux * gap, ay + uy * gap); ctx.lineTo(bx - ux * gap, by - uy * gap);
  }

  function card(w, z, alpha) {
    const cw = clamp(56 * z, 136, 236), pad = 10, inner = cw - pad * 2, col = KIND[w.kind];
    const isSaid = w.kind === 'said';
    const tf = isSaid ? `italic 400 15px ${QUOTE}` : w.kind === 'tool' ? `600 11.5px ${MONO}` : `500 13.5px ${UI}`, th = isSaid ? 18 : 16.5;
    const title = isSaid ? wrap('“' + w.pull + '”', tf, inner, z >= Z_GLOSS ? 7 : 4) : wrap(w.title, tf, inner, 3);
    const gf = `400 12.5px ${UI}`, gloss = z >= Z_GLOSS && !isSaid && w.gloss ? wrap(w.gloss, gf, inner, 4) : [];
    const h = pad + 13 + title.length * th + (gloss.length ? 6 + gloss.length * 15.5 : 0) + pad - 2;
    const x = Math.round(sx(w.x) - cw / 2), y = Math.round(sy(w.y) - h / 2);
    const hot = hover?.type === 'work' && hover.id === w.id, chosen = sel.works.size === 1 && sel.works.has(w.id);
    ctx.save(); ctx.globalAlpha = alpha * (lit(w) ? 1 : .3);
    if (hot) { ctx.translate(x + cw / 2, y + h / 2); ctx.scale(1.035, 1.035); ctx.translate(-x - cw / 2, -y - h / 2); }
    // Dark glass: the sky shows through faintly, a little of the star's colour catches the top edge.
    // Only the card under the pointer or open in the reader glows; the rest get a plain dark edge, which costs far less to draw.
    if (hot || chosen) { ctx.shadowColor = rgba(col, .5); ctx.shadowBlur = 22; }
    else { ctx.fillStyle = 'rgba(0,0,8,.3)'; ctx.beginPath(); ctx.roundRect(x - 1.5, y - .5, cw + 3, h + 4, 8.5); ctx.fill(); }
    ctx.fillStyle = hot || chosen ? 'rgba(17,22,46,.94)' : 'rgba(9,12,27,.84)';
    ctx.beginPath(); ctx.roundRect(x, y, cw, h, 7); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    const sheen = ctx.createLinearGradient(0, y, 0, y + Math.min(h, 54)); sheen.addColorStop(0, rgba(col, hot || chosen ? .26 : .15)); sheen.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = sheen; ctx.fill();
    ctx.lineWidth = hot || chosen ? 1.4 : 1; ctx.strokeStyle = hot || chosen ? rgba(col, .95) : 'rgba(196,212,255,.2)'; ctx.stroke();
    star(w.kind, x + pad + 4, y + pad + 4.5, 2.7, ctx.globalAlpha);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `400 9.5px ${MONO}`;
    const when = shortDay(w.date), room = inner - 14 - width(when, ctx.font) - 10;
    let src = source(w); if (width(src, ctx.font) > room) { while (src.length > 4 && width(src + '…', ctx.font) > room) src = src.slice(0, -1); src += '…'; }
    ctx.fillStyle = rgba(col, .92); ctx.fillText(src, x + pad + 14, y + pad + 8);
    ctx.fillStyle = 'rgba(190,202,230,.74)'; ctx.textAlign = 'right'; ctx.fillText(when, x + cw - pad, y + pad + 8); ctx.textAlign = 'left';
    ctx.font = tf; ctx.fillStyle = isSaid ? '#fff4dc' : '#f3f6ff';
    title.forEach((l, i) => ctx.fillText(l, x + pad, y + pad + 13 + (i + 1) * th - 4));
    if (gloss.length) { ctx.font = gf; ctx.fillStyle = 'rgba(206,216,240,.84)'; gloss.forEach((l, i) => ctx.fillText(l, x + pad, y + pad + 13 + title.length * th + 6 + (i + 1) * 15.5 - 4)); }
    ctx.restore();
    hits.push({ type: 'work', id: w.id, box: [x, y, x + cw, y + h] });
  }

  function draw(dt) {
    const z = cam.z;
    hits = [];
    // Stars turn into cards once you are close enough, over a moment rather than over a stretch of zoom,
    // so the view never rests half way between the two.
    const wantCards = z >= Z_CARD ? 1 : 0;
    cardsNow = still ? wantCards : cardsNow + (wantCards - cardsNow) * Math.min(1, dt / 90);
    if (Math.abs(cardsNow - wantCards) < .01) cardsNow = wantCards; else dirty = true;
    const r = markRadius(z), cards = cardsNow;
    paintClouds(dt, cards);
    const world = () => ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (cx() - cam.x * z), dpr * (cy() - cam.y * z));
    const screen = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const px = n => n / z;
    screen();
    ctx.clearRect(0, 0, W, H);
    const arrive = still ? 1 : clamp((clock - born) / 900, 0, 1);
    drawSky(arrive);
    ctx.globalAlpha = 1;

    const group = focus();
    const hotPattern = hover?.type === 'pattern' ? hover.id : sel.pattern;
    const one = hover?.type === 'work' ? at.get(hover.id) : sel.works.size === 1 ? at.get([...sel.works][0]) : null;
    const view = [wx(-150), wy(-100), wx(W + 150), wy(H + 100)];
    const inView = w => w.x > view[0] && w.x < view[2] && w.y > view[1] && w.y < view[3];

    // Constellation lines: every link between two works, faint until one end is singled out.
    const gap = cards > .5 ? 0 : r + 3.5, near = clamp((z - zFit) / (Z_TITLE - zFit), 0, 1);
    const strength = (.2 + .16 * near) * (1 - .35 * cards) * arrive;
    for (const dim of [false, true]) for (const [band, share] of [[0, 1], [1, .62], [2, .34]]) {
      ctx.beginPath();
      for (const l of links) {
        if (l.band !== band || (!lit(l.a) || !lit(l.b)) !== dim || !(inView(l.a) || inView(l.b)) || l.a === one || l.b === one) continue;
        segment(l.a, l.b, gap);
      }
      ctx.strokeStyle = `rgba(188,214,255,${strength * share * (dim ? .3 : group ? 1.5 : 1)})`; ctx.lineWidth = .8; ctx.stroke();
    }
    // The routes that leave a singled-out pattern.
    if (hotPattern) {
      world();
      const p = pAt.get(hotPattern);
      ctx.strokeStyle = 'rgba(214,232,255,.5)'; ctx.lineWidth = px(1.1); ctx.setLineDash([px(2), px(6)]); ctx.lineCap = 'round';
      for (const rel of p?.related || []) { const o = pAt.get(rel.id); if (o) { curve(p, o); ctx.stroke(); } }
      ctx.setLineDash([]); ctx.lineCap = 'butt';
      screen();
    }
    const linked = new Set();
    if (one) {
      ctx.beginPath();
      for (const l of one.links) { const o = at.get(l.to); if (o) { linked.add(o.id); segment(one, o, cards > .5 ? 0 : r * 1.6 + 4); } }
      ctx.strokeStyle = 'rgba(160,205,255,.2)'; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = 'rgba(226,240,255,.92)'; ctx.lineWidth = 1.3; ctx.stroke();
    }

    // Works.
    const shown = plan(z), crowd = clamp(z / .22, .6, 1);       // when stars sit almost on top of each other, each shines less
    const visible = works.filter(inView);
    for (const w of visible) {
      const x = sx(w.x), y = sy(w.y), hot = hover?.type === 'work' && hover.id === w.id, chosen = sel.works.size === 1 && sel.works.has(w.id), on = lit(w);
      if (cards < 1) {
        const breath = still ? 0 : Math.sin(clock * w.rate + w.beat);
        if ((hot || chosen) && cards < 1) { const b = r * 7; ctx.globalAlpha = .5 * (1 - cards); ctx.drawImage(dots[0], x - b, y - b, b * 2, b * 2); }      // bloom
        const grow = hot || chosen ? 1.6 : linked.has(w.id) ? 1.3 : group && on ? 1.2 + .25 * (1 - near) : 1;
        star(w.kind, x, y, r * grow * (1 + .07 * breath), (1 - cards) * arrive * crowd * (on ? .9 + .1 * breath : group ? .14 : .2));
        if (hot || chosen || linked.has(w.id)) { ctx.globalAlpha = (1 - cards) * (hot || chosen ? .95 : .7); ctx.beginPath(); ctx.arc(x, y, r * grow + 5, 0, 2 * Math.PI); ctx.strokeStyle = ICE; ctx.lineWidth = hot || chosen ? 1.3 : 1; ctx.stroke(); }
        hits.push({ type: 'work', id: w.id, at: [x, y], reach: Math.max(r + 5, 9) });
      }
      const t = shownAmount('w:' + w.id, shown.has('w:' + w.id) && cards < .5 ? 1 : 0, dt);
      if (t > .02) { ctx.globalAlpha = t * (on ? .96 : .3); ctx.font = titleFont; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; let label = w.title; while (width(label, titleFont) > 176 && label.length > 6) label = label.slice(0, -2); halo(label === w.title ? label : label.trimEnd() + '…', x + r + 7.5, y + .5, hot ? '#ffffff' : '#e4eaf8', 3); }
    }
    ctx.globalAlpha = 1;
    if (cards > 0) {
      const order = visible.slice().sort((a, b) => (hover?.id === a.id) - (hover?.id === b.id) || a.y - b.y);
      for (const w of order) card(w, z, cards);
    }
    if (one && sel.works.has(one.id) && cards < 1 && !still) {   // a slow pulse on the open work
      const pulse = (clock / 1500) % 1; ctx.globalAlpha = (1 - pulse) ** 1.5 * .8 * (1 - cards); ctx.beginPath(); ctx.arc(sx(one.x), sy(one.y), r * 1.6 + 5 + pulse * 24, 0, 2 * Math.PI); ctx.strokeStyle = ICE; ctx.lineWidth = 1.4; ctx.stroke(); ctx.globalAlpha = 1;
    }

    // Pattern names, each in a pale version of its cloud's colour.
    const font = patternFont(z), psize = parseFloat(font.match(/([\d.]+)px/)[1]);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font;
    const boxOf = p => { const lines = wrap(p.label, font, 156, 3), wide = Math.max(...lines.map(l => width(l, font))), x = sx(p.x), y = sy(p.y); return [x - wide / 2 - 5, y - lines.length * psize * .64, x + wide / 2 + 5, y + lines.length * psize * .64]; };
    const forced = p => hotPattern === p.id || sel.related.has(p.id) || focusPatterns?.pattern?.has?.(p.id);
    // Names shown because they are singled out keep their place, the open one first; where two of them
    // would overlap the later one steps aside, and every other name makes room.
    const pushed = [], nudge = new Map(), hits2 = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    for (const p of patterns.filter(forced).sort((a, b) => (hotPattern === b.id) - (hotPattern === a.id))) {
      const box = boxOf(p); let dy = 0;
      for (let n = 0; n < 4; n++) { const o = pushed.find(o => hits2([box[0], box[1] + dy, box[2], box[3] + dy], o)); if (!o) break; dy = (box[1] + box[3]) / 2 + dy >= (o[1] + o[3]) / 2 ? o[3] - box[1] + 2 : o[1] - box[3] - 2; }
      nudge.set(p.id, dy); pushed.push([box[0], box[1] + dy, box[2], box[3] + dy]);
    }
    for (const p of patterns) {
      const hot = hotPattern === p.id, close = forced(p), dy = nudge.get(p.id) || 0, box = boxOf(p); box[1] += dy; box[3] += dy;
      const crowded = !close && pushed.some(o => hits2(box, o));
      const want = (shown.has('p:' + p.id) && !crowded) || close ? (z >= Z_CARD ? .92 : 1) : 0;
      const t = shownAmount('p:' + p.id, want, dt);
      if (t < .02) continue;
      const lines = wrap(p.label, font, 156, 3), x = sx(p.x), y = sy(p.y) + dy;
      ctx.font = font; ctx.globalAlpha = t * arrive * (group && !close ? .5 : 1);
      if (hot) { ctx.shadowColor = colouring === 'source' ? ICE : p.name; ctx.shadowBlur = 14; }
      lines.forEach((l, i) => {
        const ly = y + (i - (lines.length - 1) / 2) * psize * 1.2;
        ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(3,5,15,.2)'; ctx.strokeText(l, x, ly);      // a wide faint edge under the tight one
        halo(l, x, ly, hot ? '#ffffff' : colouring === 'source' ? '#e3e9f8' : p.name, 4.2, .62);
      });
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      hits.push({ type: 'pattern', id: p.id, box });
    }
    ctx.globalAlpha = 1;
    if (M.loose && z > zFit * 1.2) { ctx.font = `italic 400 13px ${UI}`; ctx.globalAlpha = .75; ctx.textAlign = 'center'; halo('not yet sorted', sx(M.loose[0]), sy(M.loose[1]) - 46 * z - 8, '#c9d3ea'); ctx.globalAlpha = 1; }
  }

  // ---- Camera
  const clampCam = () => { cam.x = clamp(cam.x, 0, M.width); cam.y = clamp(cam.y, 0, M.height); cam.z = clamp(cam.z, zMin, Z_MAX); };
  const spans = [];
  function frame(now) {
    const gapMs = now - last, dt = Math.min(50, gapMs || 16); last = now; clock = now;
    if (!born) born = now;
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
    // The gas drifts all the time; it drifts less, in screen terms, the closer you are.
    if (!still) phase += dt / 1000 * .0019 / Math.max(.6, cam.z) ** .55;
    // While nothing else is moving, the drift and the twinkle are drawn on every second frame.
    const settling = now - born < 2000 || (sel.works.size === 1 && cam.z < Z_CARD);
    if (dirty || settling || (!still && tick++ % 2 === 0)) {
      dirty = false; clampCam(); draw(dt);
      const close = cam.z > zFit * 1.45; if (close !== wasClose) { wasClose = close; cb.onZoom?.(close); }
    }
    // If frames run slow, paint the clouds with fewer pixels; they are soft enough not to show it.
    if (G && glScale > .4 && now - born > 900 && gapMs < 250) {
      spans.push(gapMs);
      if (spans.length >= 8) { spans.sort((a, b) => a - b); const mid = spans[4]; if (mid > 21) { glScale = Math.max(.4, glScale * clamp(17 / mid, .45, .85)); sizeGL(); dirty = true; } spans.length = 0; }
    }
    requestAnimationFrame(frame);
  }
  function fly(to, ms = 900) {
    zoomGoal = null; velocity = null;
    to = { x: to.x ?? cam.x, y: to.y ?? cam.y, z: clamp(to.z ?? cam.z, zMin, Z_MAX) };
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
  const fitZoom = () => Math.min((W - inset - insetLeft) / (M.width - 500), H / (M.height - 500));
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); sizeGL();
    zFit = fitZoom(); zMin = zFit * .72; plans.clear(); dirty = true;
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
      cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, e); tween = null; zoomGoal = null; velocity = null;
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: cam.z }; drag = null; }
      else drag = { x: e.clientX, y: e.clientY, moved: 0, t: performance.now(), vx: 0, vy: 0 };
    });
    cv.addEventListener('pointermove', e => {
      const box = cv.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, e);
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), mx = (a.clientX + b.clientX) / 2 - box.left, my = (a.clientY + b.clientY) / 2 - box.top;
        const wx0 = wx(mx), wy0 = wy(my); cam.z = clamp(pinch.z * d / pinch.d, zMin, Z_MAX); cam.x = wx0 - (mx - cx()) / cam.z; cam.y = wy0 - (my - cy()) / cam.z; dirty = true; return;
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
      zoomGoal = clamp((zoomGoal || cam.z) * Math.exp(step), zMin, Z_MAX);
      cb.onHover?.(null);
    }, { passive: false });
    cv.addEventListener('dblclick', e => { const box = cv.getBoundingClientRect(); zoomAt(1.9, e.clientX - box.left, e.clientY - box.top); });
    new ResizeObserver(resize).observe(cv);
    glc.addEventListener('webglcontextlost', e => { e.preventDefault(); G = null; });
    glc.addEventListener('webglcontextrestored', () => { startGL(); focusKey = ''; dirty = true; });
  }
  function zoomAt(factor, x = cx(), y = cy()) { tween = null; anchor = { sx: x, sy: y, wx: wx(x), wy: wy(y) }; zoomGoal = clamp((zoomGoal || cam.z) * factor, zMin, Z_MAX); }

  // ---- What the page can ask of the map
  function setWorks(list) {
    const rand = rng(99);
    works = list.filter(w => M.works[w.id]).map(w => ({ ...w, x: M.works[w.id][0], y: M.works[w.id][1], rate: .0009 + rand() * .0016, beat: rand() * 6.28 }));
    at = new Map(works.map(w => [w.id, w]));
    for (const w of works) w.light = colourOfWork(w);
    byPattern = new Map(patterns.map(p => [p.id, new Set()]));
    for (const w of works) for (const [p] of w.patterns) byPattern.get(p)?.add(w.id);
    const size = id => byPattern.get(id)?.size || 0;
    patterns.sort((a, b) => size(b.id) - size(a.id));
    const seen = new Set(); links = [];
    for (const w of works) for (const l of w.links) { const o = at.get(l.to), key = w.id < l.to ? w.id + '|' + l.to : l.to + '|' + w.id; if (o && o !== w && !seen.has(key)) { seen.add(key); const len = Math.hypot(w.x - o.x, w.y - o.y); links.push({ a: w, b: o, band: len < 320 ? 0 : len < 760 ? 1 : 2 }); } }
    plans.clear(); dirty = true;
    if (fieldData) refield();
  }
  return {
    init(canvas, data, callbacks) {
      cv = canvas; ctx = cv.getContext('2d'); D = data; M = data.map; cb = callbacks;
      patterns = data.patterns.filter(p => M.patterns[p.id]).map(p => ({ ...p, x: M.patterns[p.id][0], y: M.patterns[p.id][1], ...tintOf(p.id) }));
      pAt = new Map(patterns.map(p => [p.id, p]));
      glc = document.createElement('canvas'); glc.setAttribute('aria-hidden', 'true');
      glc.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none;background:#03040b';
      cv.before(glc);
      setWorks(data.works); resize(); buildSprites(); buildSky();
      fieldData = buildField(); noiseData = buildNoise(512); startGL(); bind();
      cam.x = M.width / 2; cam.y = M.height / 2; cam.z = still ? zFit : zFit * 1.32; if (!still) fly({ x: M.width / 2, y: M.height / 2, z: zFit }, 1700);
      cv.style.cursor = 'grab';
      const fresh = () => { measured.clear(); wrapped.clear(); plans.clear(); dirty = true; };
      document.fonts?.ready.then(fresh);
      for (const f of [patternFont(1), titleFont, `italic 400 15px ${QUOTE}`]) document.fonts?.load(f).then(fresh);
      requestAnimationFrame(frame);
    },
    setWorks,
    setFilter(fn) { filter = fn; dirty = true; },
    setInset(right, left = 0) { if (right !== inset || left !== insetLeft) { const shift = ((right - inset) - (left - insetLeft)) / 2 / cam.z; inset = right; insetLeft = left; cam.x += shift; zFit = fitZoom(); zMin = zFit * .72; dirty = true; } },
    select({ works: ids = [], pattern = null, related = [], fly: move = true }) {
      sel = { works: new Set(ids), pattern, related: new Set(related) }; selCount++; dirty = true;
      if (!move || !ids.length) return;
      if (ids.length === 1) { const w = at.get(ids[0]); if (w) fly({ x: w.x, y: w.y, z: Math.max(cam.z, Z_CARD + .3) }, 1000); }
      else fit(ids, { maxZoom: pattern ? 1.9 : 1.3 });
    },
    focusPatterns(ids) { if (!ids) focusPatterns = null; else { focusPatterns = new Set(ids.flatMap(p => [...(byPattern.get(p) || [])])); focusPatterns.pattern = new Set(ids); } focusCount++; dirty = true; },
    focusWorks(ids) { if (!ids) focusPatterns = null; else { focusPatterns = new Set(ids); focusPatterns.pattern = new Set(); } focusCount++; dirty = true; },
    setColouring(mode) { if (mode === colouring) return; colouring = mode; turned = clock; refield(); dirty = true; },
    sourcePaint: () => ({ ...KIND }),
    fit, home, zoomAt,
    pan(dx, dy) { fly({ x: cam.x + dx / cam.z, y: cam.y + dy / cam.z }, 260); },
    zoom: () => cam.z,
    cardsShown: () => cam.z >= Z_CARD,
  };
})();
