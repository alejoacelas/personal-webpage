// The map as an overprinted sheet: five translucent inks on off-white paper.
// Every pattern is a field of one ink over the ground where its works are. Where patterns share ground
// their inks multiply into a third colour, so a boundary is an overlap you can see. At rest the fields are
// printed a little under full strength; the ground that is singled out is printed solid and the rest steps back.
// A WebGL layer prints the paper and the inks; a 2D canvas above it carries the marks, names and cards.
window.MapView = (() => {
  const INK = '#16130f', PAPER_RGB = [244, 239, 227], PAPER = `rgb(${PAPER_RGB})`, CARD = '#fdfbf5', HALO = `rgba(${PAPER_RGB},.92)`;
  const FONT = '"Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif';
  const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
  const Z_TITLE = 1.05, Z_CARD = 2.3, Z_GLOSS = 3.3, Z_MAX = 5.5;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The inks, in the order they go down. Each has its own screen angle and sits slightly out of register.
  // `hue` is where the ink sits on the colour wheel that pattern tints are measured on.
  const INKS = [
    { name: 'Yellow', rgb: [255, 226, 0], hue: 54, angle: 0, pitch: 8.5, off: [0, 0], wob: [5, -4] },
    { name: 'Orange', rgb: [255, 112, 40], hue: 20, angle: 60, pitch: 9.2, off: [3.4, -2.2], wob: [-5, 4] },
    { name: 'Fluorescent pink', rgb: [255, 72, 176], hue: 326, angle: 75, pitch: 8.5, off: [-2.8, 3.2], wob: [4, 5] },
    { name: 'Medium blue', rgb: [40, 100, 186], hue: 224, angle: 15, pitch: 8.5, off: [3.6, 2.6], wob: [-4, -5] },
    { name: 'Teal', rgb: [0, 160, 152], hue: 176, angle: 45, pitch: 8.5, off: [-3.6, -2.4], wob: [6, 2] },
  ];
  const DENSITY = .8;               // how opaque a solid ink is
  // How the sheet is printed when nothing is singled out: the tint of a field at rest (a little under solid, so the
  // paper shows through as pinholes) and how much of it is kept behind the cards; how much a second layer of the same
  // ink adds; how dense the resting ink is; the tint of what stands beside a singled-out field; and how far the halftone
  // screens get finer as you come closer (at 0 the dots would simply grow, as on a real sheet under a glass).
  const REST = .78, REST_CLOSE = .96, TWICE = .78, DENSE = .8, ASIDE = .24, FINER = .33;
  const S = 5;                      // world units per cell of an ink plate
  // A pattern's ink covers its main works and thins to a skirt that reaches the works that only touch on it.
  const SIGMA = 43, CORE = [.58, .76], SKIRT = [.38, .52], TINT = .26, TOUCH = .42;
  // A work is a dot from far off and, from about where titles appear, a character that says where it lives.
  const MARKS = { post: '#', doc: '¶', tool: '{}', site: '↗', said: '“', other: '·' }, MARK = '"Space Grotesk", "Helvetica Neue", Arial, sans-serif';

  let cv, ctx, M, cb, W = 0, H = 0, dpr = 1, zFit = .3, zMin = .2;
  const cam = { x: 0, y: 0, z: .3 };
  let tween = null, zoomGoal = null, anchor = null, velocity = null, drag = null, atHome = true;
  let inset = 0, insetLeft = 0, insetTop = 0, insetBottom = 0, sized = [0, 0], tallest = 0;
  let works = [], at = new Map(), byPattern = new Map(), patterns = [], patternAt = new Map(), most = 1;
  let hover = null, focusPatterns = null, focusList = null, peeked = null;
  let sel = { works: new Set(), pattern: null, related: new Set(), serial: 0 };
  let filter = null;
  let dirty = true, last = 0, clock = 0, wasClose = false;
  const fade = new Map();           // label key → shown amount, eased
  const plans = new Map();          // zoom bucket → which labels fit
  let hits = [];                    // what the last frame drew, for clicks
  let frameDt = 16, coarse = 1, slow = false, slowSince = 0, pace = 16, drew = false;

  // ---- Geometry helpers
  const cx = () => insetLeft + (W - inset - insetLeft) / 2, cy = () => insetTop + (H - insetTop - insetBottom) / 2;
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
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const source = w => w.kind === 'post' ? (w.slack.channel === 'private-channel' ? 'a private channel' : '#' + w.slack.channel) : w.kind === 'said' ? 'call excerpt' : ({ doc: 'Google Doc', sheet: 'Google Sheet', repo: 'repository', gist: 'gist', site: 'live site', file: 'link' })[w.sub] || w.sub;
  const shortDay = d => `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]} ’${d.slice(2, 4)}`;
  const ease = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

  // ---- Which ink a pattern is printed in. Its hue comes from where it sits on the map.
  function printed(cover) {       // the colour that inks make on paper, for the 2D layer
    let c = PAPER_RGB.map(v => v / 255);
    INKS.forEach((ink, k) => { const a = Math.min(1, cover[k] || 0) * DENSITY; c = c.map((v, i) => v * (1 - a + a * ink.rgb[i] / 255)); });
    return `rgb(${c.map(v => Math.round(v * 255))})`;
  }
  // Every pattern is printed in one ink. A hue that falls between two inks takes one or the other, whichever its
  // neighbours have not, so the in-between colour shows up where the two overprint.
  function assignInks() {
    const hue = p => (M.tint?.[p.id]?.[0] ?? 0);
    const wheel = INKS.map((ink, k) => [ink.hue, k]).sort((a, b) => a[0] - b[0]);
    const shared = (p, q) => { let n = 0; for (const id of byPattern.get(p.id)) if (byPattern.get(q.id).has(id)) n++; return n; };
    for (const p of patterns) p.ink = null;
    for (const p of patterns) {
      const cost = INKS.map(() => 2.5), h = hue(p);
      wheel.forEach(([a, ka], i) => { const [b, kb] = wheel[(i + 1) % wheel.length], span = (b - a + 360) % 360, t = ((h - a + 360) % 360) / span; if (t <= 1) { cost[ka] = t * t; cost[kb] = (1 - t) * (1 - t); } });
      for (const q of patterns) if (q.ink != null) {     // sharing ground with the same ink costs most; with an ink from across the wheel, a little, since those mix to mud
        const share = shared(p, q) / Math.max(1, byPattern.get(p.id).size), close = Math.hypot(q.x - p.x, q.y - p.y) < 300 ? .55 : 0, spot = wheel.findIndex(x => x[1] === q.ink);
        INKS.forEach((_, k) => { const gap = Math.abs(wheel.findIndex(x => x[1] === k) - spot), apart = Math.min(gap, wheel.length - gap); cost[k] += apart === 0 ? 2.2 * share + close : apart > 1 ? .7 * share : 0; });
      }
      p.ink = cost.indexOf(Math.min(...cost));
      p.color = printed(INKS.map((_, k) => +(k === p.ink)));
    }
  }

  // ---- The plates: one low-resolution field per ink, saying how much of it lands where.
  let gw = 0, gh = 0, scratch = null, inkedAt = null;
  function splat(pts, sigma) {      // adds a soft spot for each [x, y, weight] into scratch; returns the cells touched
    const R = Math.ceil(sigma * 2.9 / S), k = -1 / (2 * sigma * sigma), ex = new Float32Array(2 * R + 2), ey = new Float32Array(2 * R + 2);
    let bx0 = gw, by0 = gh, bx1 = 0, by1 = 0;
    for (const [x, y, w] of pts) {
      const u = x / S, v = y / S, i0 = Math.max(0, Math.floor(u) - R), i1 = Math.min(gw - 1, Math.floor(u) + R + 1), j0 = Math.max(0, Math.floor(v) - R), j1 = Math.min(gh - 1, Math.floor(v) + R + 1);
      if (i1 < i0 || j1 < j0) continue;
      for (let i = i0; i <= i1; i++) ex[i - i0] = Math.exp(k * ((i - u) * S) ** 2);
      for (let j = j0; j <= j1; j++) ey[j - j0] = w * Math.exp(k * ((j - v) * S) ** 2);
      for (let j = j0; j <= j1; j++) { const row = j * gw, e = ey[j - j0]; for (let i = i0; i <= i1; i++) scratch[row + i] += e * ex[i - i0]; }
      bx0 = Math.min(bx0, i0); by0 = Math.min(by0, j0); bx1 = Math.max(bx1, i1); by1 = Math.max(by1, j1);
    }
    return [bx0, by0, bx1, by1];
  }
  const step = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const strength = (w, p) => w.patterns.find(x => x[0] === p.id)[1];
  const members = p => works.filter(w => byPattern.get(p.id)?.has(w.id));
  const core = p => [[p.x, p.y, 1.1], ...members(p).filter(w => strength(w, p) === 2).map(w => [w.x, w.y, 1])];
  const reach = p => [[p.x, p.y, 1.1], ...members(p).map(w => [w.x, w.y, strength(w, p) === 2 ? 1 : TOUCH])];
  function buildPlates() {
    gw = Math.ceil(M.width / S) + 1; gh = Math.ceil(M.height / S) + 1;
    scratch = new Float32Array(gw * gh);
    const plates = INKS.map(() => new Float32Array(gw * gh)), solid = new Float32Array(gw * gh);
    for (const p of patterns) {
      if (!byPattern.get(p.id)?.size) continue;
      const plate = plates[p.ink], a = splat(core(p), SIGMA);
      for (let j = a[1]; j <= a[3]; j++) for (let i = a[0]; i <= a[2]; i++) { const c = j * gw + i; solid[c] = step(CORE[0], CORE[1], scratch[c]); scratch[c] = 0; }
      const b = splat(reach(p), SIGMA);
      for (let j = b[1]; j <= b[3]; j++) for (let i = b[0]; i <= b[2]; i++) { const c = j * gw + i; plate[c] += Math.max(solid[c], TINT * step(SKIRT[0], SKIRT[1], scratch[c])); scratch[c] = 0; solid[c] = 0; }
    }
    inkedAt = new Uint8Array(gw * gh);
    return plates.map(f => { const b = new Uint8Array(gw * gh); for (let i = 0; i < b.length; i++) { b[i] = Math.min(255, Math.round(f[i] * 127.5)); if (b[i] > inkedAt[i]) inkedAt[i] = b[i]; } return b; });
  }
  // Whether a point of the sheet has ink on it, to tell the map from the bare paper around it.
  function painted(x, y) {
    if (!inkedAt) return true;
    const i = Math.round(x / S), j = Math.round(y / S);
    return i >= 0 && j >= 0 && i < gw && j < gh && inkedAt[j * gw + i] > 24;
  }
  // The ground that is singled out: a hovered or open pattern, or the works of a list.
  function focusKey() {
    if (hover?.type === 'pattern') return 'p:' + hover.id;
    if (focusPatterns) return focusPatterns.key;
    if (focusList) return focusList.key;
    if (sel.works.size > 1) return sel.pattern ? 'p:' + sel.pattern : 's:' + sel.serial;
    return null;
  }
  function focusField(key) {
    const out = new Uint8Array(gw * gh);
    const add = (pts, sigma = SIGMA) => {
      const [x0, y0, x1, y1] = splat(pts, sigma);
      for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) { const c = j * gw + i, m = Math.round(255 * step(SKIRT[0], SKIRT[1], scratch[c])); scratch[c] = 0; if (m > out[c]) out[c] = m; }
    };
    if (key[0] !== 'p') add([...(key[0] === 's' ? sel.works : focusList)].map(id => at.get(id)).filter(Boolean).map(w => [w.x, w.y, 1]));
    else for (const id of key[1] === 's' ? focusPatterns.pattern : [key.slice(2)]) { const p = patternAt.get(id); if (p) { add(reach(p)); add(members(p).map(w => [w.x, w.y, 1]), 25); } }   // its ground, and a pool round each work that only touches on it
    return out;
  }

  // ---- The press: paper and inks, drawn by a shader so the halftone stays sharp at every zoom.
  const VERT = `#version 300 es
void main() { vec2 v = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(v * 2. - 1., 0., 1.); }`;
  const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes, uCtr, uCell;
uniform vec4 uCam;                 // world x and y at the centre, device pixels per world unit, device pixels per CSS pixel
uniform sampler2D uP0, uP1, uP2, uP3, uP4, uFa, uFb, uNoise;
uniform vec3 uInk[5];
uniform vec4 uScr[5];              // screen angle as cos and sin, lines per world unit, density
uniform vec4 uOff[5];              // mis-registration, edge wobble
uniform float uIn[5];
uniform float uFocus, uMix, uReg, uRest, uAside, uTwice, uDense, uFiner;
uniform vec3 uPaper, uKey;
out vec4 frag;
const float S = ${S}.;
float z, finer, both;              // device pixels per world unit; how many times finer than drawn the screens are; how far into the next step

float wave(float x) { float a = 4. * abs(fract(x) - .5) - 1.; return a * (1.5 - .5 * a * a); }
// One halftone screen: round dots that grow with the tone, join at half, and close up into a solid.
float dots(vec2 q, float lines, float tone, float jit) {
  float v = .5 * (wave(q.x * lines) + wave(q.y * lines));
  float th = mix(1.06, -1.5, tone) + jit * min(1., tone * 5.);
  float soft = 3.6 * lines / z + .06;
  return mix(clamp((v - th) / soft + .5, 0., 1.), tone, smoothstep(.9, 2.4, soft));
}
// The screens can get finer as you come closer, a doubling at a time, so the dots stay small: near enough to see that
// it is print without shouting. Each finer screen keeps the dots of the one before.
float screen(vec2 p, vec4 s, float tone, float jit) {
  vec2 q = vec2(p.x * s.x - p.y * s.y, p.x * s.y + p.y * s.x);
  float c = dots(q, s.z * finer, tone, jit);
  return both > 0. ? mix(c, dots(q, s.z * finer * 2., tone, jit), both) : c;
}
vec4 slow(vec2 uv) { vec2 t = uv * 256., i = floor(t), f = fract(t); f = f * f * (3. - 2. * f); return texture(uNoise, (i + f + .5) / 256.); }
#define PLATE(i, tex) texture(tex, uv + (uOff[i].xy * uReg + wob * uOff[i].zw) * uCell / S).r * 2. * uIn[i]
#define TONE(t) mix((min(t, 1.) + uTwice * clamp(t - 1., 0., 1.)) * tint, t, full) * most
#define PRINT(i, t) { float a = min(t, 1.); if (a > .003) { vec2 q = p + uOff[i].xy * uReg; float d = uScr[i].w * lay * mix(uDense, 1., full); \
  col *= mix(vec3(1.), uInk[i], screen(q, uScr[i], a, g.z * .22) * d); \
  if (t > 1.) col *= mix(vec3(1.), uInk[i], screen(q.yx + 7.3, uScr[i], min(t - 1., 1.), g.w * .22) * d * .9); } }

void main() {
  z = uCam.z;
  vec2 p = (vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) - uCtr) / z + uCam.xy;
  // Grain that keeps to the paper as you move, and stays a pixel or two wide at every zoom.
  float lz = log2(z), k = floor(lz), fz = lz - k, sc = exp2(k);
  vec4 g = (mix(texture(uNoise, p * sc / 400.), texture(uNoise, p * sc / 200. + .37), fz) - .5) * inversesqrt(fz * fz + (1. - fz) * (1. - fz));
  float ls = log2(z / uCam.w / .33) * uFiner, ks = floor(ls);
  finer = exp2(ks); both = smoothstep(.7, 1., ls - ks);
  vec4 lo = slow(p / 11800.), md = slow(p / 2300. + .21);
  vec2 wob = md.zw - .5;
  vec2 uv = ((p + (lo.xy - .5) * 34. + (md.xy - .5) * 8.) / S + .5) * uCell;

  float t0 = PLATE(0, uP0), t1 = PLATE(1, uP1), t2 = PLATE(2, uP2), t3 = PLATE(3, uP3), t4 = PLATE(4, uP4);
  // At rest every field is a light tint. What is singled out is printed in full, and the rest steps back a little further.
  float tint = uRest, full = 0., line = 0.;
  if (uFocus > .004) {
    float a = texture(uFa, uv).r, f = mix(texture(uFb, uv).r, a, uMix);
    full = uFocus * smoothstep(.25, .6, f); tint = mix(uRest, uAside, uFocus);
    vec2 d = uCell * 1.5;
    vec2 gr = vec2(texture(uFa, uv + vec2(d.x, 0.)).r - texture(uFa, uv - vec2(d.x, 0.)).r, texture(uFa, uv + vec2(0., d.y)).r - texture(uFa, uv - vec2(0., d.y)).r) / (3. * S);
    float dist = (a - .3) / max(length(gr), .0001) * z + 3. * uCam.w, wide = 1.15 * uCam.w;
    line = (1. - smoothstep(wide - .7, wide + .7, abs(dist))) * uMix * uFocus;
  }
  float most = min(1., 2.45 / max(t0 + t1 + t2 + t3 + t4, .001));
  t0 = TONE(t0); t1 = TONE(t1); t2 = TONE(t2); t3 = TONE(t3); t4 = TONE(t4);

  vec3 col = uPaper * (1. - g.x * .065 - (lo.z - .5) * .012 - smoothstep(.37, .45, g.y) * .08);
  float lay = (.93 + (md.x - .5) * .16 + g.z * .1) * (1. - smoothstep(.32, .5, g.x + g.w * .5) * .28);
  if (t0 + t1 + t2 + t3 + t4 > .003) { PRINT(0, t0) PRINT(1, t1) PRINT(2, t2) PRINT(3, t3) PRINT(4, t4) }      // most of the sheet is bare paper
  col = mix(col, uKey, line * (.86 + g.y * .5));
  frag = vec4(col, 1.);
}`;
  let glcv = null, gl = null, U = {}, plateTex = [], focusTex = [], focusKeyNow = null, focusAmt = 0, focusMix = 1, introStart = -1, introPace = 1, printedState = '', inked = 0;
  function tex(unit, w, h, data, repeat) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if (repeat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    for (const side of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, side, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    return t;
  }
  function press() {
    gl = glcv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl) { glcv.style.background = PAPER; console.error('The inks need WebGL 2, which this browser does not offer. Showing the marks on bare paper.'); return; }
    const prog = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]]) {
      const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('Ink shader: ' + gl.getShaderInfoLog(sh));
      gl.attachShader(prog, sh);
    }
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('Ink shader: ' + gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    U = {};
    for (const name of ['uRes', 'uCtr', 'uCell', 'uCam', 'uInk', 'uScr', 'uOff', 'uIn', 'uFocus', 'uMix', 'uReg', 'uRest', 'uAside', 'uTwice', 'uDense', 'uFiner', 'uPaper', 'uKey']) U[name] = gl.getUniformLocation(prog, name);
    ['uP0', 'uP1', 'uP2', 'uP3', 'uP4', 'uFa', 'uFb', 'uNoise'].forEach((name, i) => gl.uniform1i(gl.getUniformLocation(prog, name), i));
    gl.uniform3fv(U.uInk, INKS.flatMap(k => k.rgb.map(v => v / 255)));
    gl.uniform4fv(U.uScr, INKS.flatMap(k => [Math.cos(k.angle * Math.PI / 180), Math.sin(k.angle * Math.PI / 180), 1 / k.pitch, DENSITY]));
    gl.uniform4fv(U.uOff, INKS.flatMap(k => [...k.off, ...k.wob]));
    gl.uniform3fv(U.uPaper, PAPER_RGB.map(v => v / 255)); gl.uniform3f(U.uKey, .086, .075, .06);
    gl.uniform1f(U.uAside, ASIDE); gl.uniform1f(U.uTwice, TWICE); gl.uniform1f(U.uDense, DENSE); gl.uniform1f(U.uFiner, FINER);
    const noise = new Uint8Array(256 * 256 * 4); let seed = 20261121;
    for (let i = 0; i < noise.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; noise[i] = seed >>> 24; }
    tex(7, 256, 256, noise, true);
    inkUp();
    gl.bindVertexArray(gl.createVertexArray());
  }
  function inkUp() {
    if (!gl) return;
    for (const t of [...plateTex, ...focusTex]) gl.deleteTexture(t);
    plateTex = buildPlates().map((b, i) => tex(i, gw, gh, b));
    focusTex = [tex(5, gw, gh, new Uint8Array(gw * gh)), tex(6, gw, gh, new Uint8Array(gw * gh))];
    gl.uniform2f(U.uCell, 1 / gw, 1 / gh);
    focusKeyNow = null; focusAmt = 0; inked++; dirty = true;
  }
  function refocus(key) {           // the new ground goes on unit 5, and the one before it moves to unit 6 so the two can blend
    focusKeyNow = key;
    if (!gl || !key) return;
    const fresh = focusAmt < .03;
    focusTex.reverse();
    gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, focusTex[1]);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, focusTex[0]);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gw, gh, gl.RED, gl.UNSIGNED_BYTE, focusField(key));
    focusMix = fresh || still ? 1 : 0;
  }
  function print(dt, now) {
    const key = focusKey();
    if (key !== focusKeyNow) refocus(key);
    const want = key ? 1 : 0, go = (v, to, ms) => still ? to : Math.abs(to - v) < .004 ? to : v + (to - v) * Math.min(1, dt / ms);
    focusAmt = go(focusAmt, want, 120); focusMix = go(focusMix, 1, 130);
    if (focusAmt !== want || focusMix !== 1) dirty = true;
    if (!gl) return;
    const e = introStart < 0 || still ? 9 : (now - introStart) / 1000 / introPace;
    if (e < 2.2) dirty = true;
    const k = dpr * coarse, w = Math.round(W * k), h = Math.round(H * k);
    // Names fading and marks pulsing only touch the layer above, so the sheet is printed again only when it would differ.
    const state = [w, h, cx(), cy(), cam.x, cam.y, cam.z, focusKeyNow, focusAmt, focusMix, Math.min(e, 2.2), plateTex.length && inked].join();
    if (state === printedState) return;
    printedState = state;
    if (glcv.width !== w || glcv.height !== h) { glcv.width = w; glcv.height = h; }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.uRes, w, h); gl.uniform2f(U.uCtr, cx() * k, cy() * k);
    gl.uniform4f(U.uCam, cam.x, cam.y, cam.z * k, k);
    gl.uniform1fv(U.uIn, INKS.map((_, i) => ease((e - .1 - i * .22) / .75)));     // the inks go down one after another
    gl.uniform1f(U.uReg, 1 + 7 * (1 - ease(e / 2)));                                // and settle into register
    gl.uniform1f(U.uRest, REST * (1 + (REST_CLOSE - 1) * ease((cam.z - 1.2) / (Z_CARD - 1.2))));   // a touch paler once the cards are out
    gl.uniform1f(U.uFocus, focusAmt); gl.uniform1f(U.uMix, focusMix);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---- Which labels fit at a zoom level. Sizes are in screen pixels, so this only depends on zoom.
  const titleFont = `600 11.5px ${FONT}`, titleGap = w => w.kind === 'tool' ? 12 : 10;
  const nameSize = (p, z) => (z < zFit * 1.5 ? 12 : z < 1 ? 14.5 : 16.5) * (.92 + .3 * Math.sqrt((byPattern.get(p.id)?.size || 1) / most));
  const nameFont = (p, z) => `700 semi-condensed ${nameSize(p, z).toFixed(1)}px ${FONT}`;
  const nameLines = (p, font, size) => wrap(p.label, font, size * 10.5, 3);
  function plan(z) {
    const key = Math.round(Math.log2(z) * 6);
    if (plans.has(key)) return plans.get(key);
    const zz = 2 ** (key / 6), placed = [], shown = new Set();
    const free = r => !placed.some(p => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1]);
    for (const p of patterns) {
      const font = nameFont(p, zz), size = nameSize(p, zz), lines = nameLines(p, font, size), w = Math.max(...lines.map(l => width(l, font))), h = lines.length * size * 1.04;
      const r = [p.x * zz - w / 2 - 5, p.y * zz - h / 2 - 3, p.x * zz + w / 2 + 5, p.y * zz + h / 2 + 3];
      if (free(r)) { placed.push(r); shown.add('p:' + p.id); }
    }
    if (zz >= Z_TITLE && zz < Z_CARD) {
      const radius = 7;
      const marks = works.map(w => [w.x * zz - radius - 1, w.y * zz - radius - 1, w.x * zz + radius + 1, w.y * zz + radius + 1]);
      works.forEach((w, i) => {
        const tw = Math.min(170, width(w.title, titleFont)), x = w.x * zz + titleGap(w), y = w.y * zz;
        const r = [x - 2, y - 8, x + tw + 4, y + 8];
        if (free(r) && !marks.some((m, j) => j !== i && r[0] < m[2] && r[2] > m[0] && r[1] < m[3] && r[3] > m[1])) { placed.push(r); shown.add('w:' + w.id); }
      });
    }
    plans.set(key, shown);
    return shown;
  }
  const markRadius = z => Math.max(1.5, Math.min(3.1, 1.15 + 2.4 * z));

  // ---- Drawing the layer above the inks
  const lit = w => (!filter || filter(w)) && (!focus() || focus().has(w.id));
  // Far out, works outside what is singled out (or outside a search) are drawn faint. From where titles appear and closer,
  // every work is drawn at full strength so all of it can be read; the change eases in just before the titles do.
  const plain = z => ease((z - (Z_TITLE - .3)) / .3), strengthOf = (w, z, faint) => lit(w) ? 1 : faint + (1 - faint) * plain(z);
  function focus() {
    if (hover?.type === 'pattern') return byPattern.get(hover.id);
    if (focusPatterns) return focusPatterns;
    if (focusList) return focusList;
    if (sel.works.size > 1) return sel.works;
    return null;
  }
  function shownAmount(key, want, dt) {
    const now = fade.get(key) ?? 0, next = still ? want : now + (want - now) * Math.min(1, dt / 110);
    if (Math.abs(next - want) > .01) dirty = true;
    fade.set(key, Math.abs(next - want) < .01 ? want : next);
    return fade.get(key);
  }
  // Type is printed in black with the paper left showing round it, so it reads on any ink.
  function knock(text, x, y, fill = INK, strength = 3) {
    ctx.lineJoin = 'round'; ctx.lineWidth = strength; ctx.strokeStyle = HALO;
    ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }
  // A work's mark: a dot from far off; closer, a character for where it lives, in ink with a little paper behind it.
  const markSize = z => 11 + 2 * ease((z - Z_TITLE) / (Z_CARD - Z_TITLE)), lettered = z => ease((z - .86) / .2);
  function mark(kind, x, y, z, big = 1) {
    const t = lettered(z), alpha = ctx.globalAlpha;
    if (t < 1) { ctx.globalAlpha = alpha * (1 - t); ctx.beginPath(); ctx.arc(x, y, markRadius(z) * big, 0, 2 * Math.PI); ctx.fillStyle = INK; ctx.fill(); }
    if (t > 0) { ctx.globalAlpha = alpha * t; letter(kind, x, y, markSize(z) * big); }
    ctx.globalAlpha = alpha;
  }
  function letter(kind, x, y, size, align = 'center') {
    const ch = MARKS[kind] || MARKS.other, lone = ch === '·';
    ctx.font = `700 ${(lone ? size * 1.7 : size).toFixed(1)}px ${MARK}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    knock(ch, x, y + size * (ch === '“' ? .3 : ch === '{}' ? -.03 : .05), INK, 2.4);
  }
  function curve(a, b, bend = .16) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y;
    ctx.beginPath(); ctx.moveTo(sx(a.x), sy(a.y)); ctx.quadraticCurveTo(sx(mx - dy * bend), sy(my + dx * bend), sx(b.x), sy(b.y));
  }
  function route(a, b, bend, dash) {         // a thin black rule with paper either side of it
    curve(a, b, bend); ctx.setLineDash([]); ctx.lineCap = 'round'; ctx.strokeStyle = PAPER; ctx.lineWidth = 4; ctx.globalAlpha = .75; ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.setLineDash(dash || []); ctx.lineCap = 'butt'; ctx.stroke(); ctx.setLineDash([]);
  }
  // The ink a work is mainly printed in: its first main pattern's.
  const mainInk = w => patternAt.get((w.patterns.find(p => p[1] === 2) || w.patterns[0] || [])[0])?.color;

  // A card is a plain slip of paper: where the work lives, what it is called and, closer in, what it says.
  function card(w, z, alpha, hot) {
    const cw = Math.max(134, Math.min(236, 56 * z)), pad = 10, inner = cw - pad * 2;
    const isSaid = w.kind === 'said';
    const tf = isSaid ? `500 13.5px ${FONT}` : w.kind === 'tool' ? `600 11px ${MONO}` : `600 12.5px ${FONT}`, th = isSaid ? 16.5 : 15;
    const title = isSaid ? wrap('“' + w.pull + '”', tf, inner, z >= Z_GLOSS ? 7 : 4) : wrap(w.title, tf, inner, 3);
    const gf = `400 11.5px ${FONT}`, gloss = z >= Z_GLOSS && !isSaid && w.gloss ? wrap(w.gloss, gf, inner, 4) : [];
    const h = pad + 13 + title.length * th + (gloss.length ? 5 + gloss.length * 14 : 0) + pad - 3;
    const x = Math.round(sx(w.x) - cw / 2), y = Math.round(sy(w.y) - h / 2);
    const chosen = sel.works.size === 1 && sel.works.has(w.id);
    const lift = shownAmount('c:' + w.id, hot ? 1 : 0, frameDt * 1.6), grow = 1 + .03 * lift;
    ctx.save(); ctx.globalAlpha = alpha * (hot ? 1 : strengthOf(w, z, .3));
    if (lift > 0) { ctx.translate(x + cw / 2, y + h / 2); ctx.scale(grow, grow); ctx.translate(-x - cw / 2, -y - h / 2); }
    ctx.shadowColor = `rgba(22,19,15,${.16 + .14 * lift})`; ctx.shadowBlur = 7 + 10 * lift; ctx.shadowOffsetY = 2 + 4 * lift;
    ctx.fillStyle = CARD; ctx.beginPath(); ctx.roundRect(x, y, cw, h, 2.5); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = chosen ? 1.6 : hot ? 1.1 : .8; ctx.strokeStyle = chosen || hot ? INK : 'rgba(22,19,15,.26)'; ctx.stroke();
    const ink = mainInk(w);
    if (ink) { ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, cw, h, 2.5); ctx.clip(); ctx.fillStyle = ink; ctx.fillRect(x, y, cw, 3.5); ctx.restore(); }   // one stripe of its main ink
    letter(w.kind, x + pad, y + pad + 5.5, 11, 'left');
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const sf = `400 10px ${FONT}`, lead = w.kind === 'tool' ? 15 : w.kind === 'other' ? 9 : 12; ctx.font = sf; ctx.fillStyle = 'rgba(22,19,15,.66)';
    const when = isSaid ? shortDay(w.date).replace(/^\d+ /, '') : shortDay(w.date), room = inner - lead - width(when, sf) - 10;
    let src = source(w); if (width(src, sf) > room) { while (src.length > 4 && width(src + '…', sf) > room) src = src.slice(0, -1); src += '…'; }
    ctx.fillText(src, x + pad + lead, y + pad + 9); ctx.textAlign = 'right'; ctx.fillText(when, x + cw - pad, y + pad + 9); ctx.textAlign = 'left';
    ctx.font = tf; ctx.fillStyle = INK;
    title.forEach((l, i) => ctx.fillText(l, x + pad, y + pad + 14 + (i + 1) * th - 3.5));
    if (gloss.length) { ctx.font = gf; ctx.fillStyle = 'rgba(22,19,15,.78)'; gloss.forEach((l, i) => ctx.fillText(l, x + pad, y + pad + 14 + title.length * th + 5 + (i + 1) * 14 - 3.5)); }
    ctx.restore();
    hits.push({ type: 'work', id: w.id, box: [x, y, x + cw, y + h] });
  }

  function draw(dt) {
    const z = cam.z;
    hits = []; frameDt = dt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Register marks at the corners of the sheet, for anyone who zooms all the way out.
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.globalAlpha = .6;
    for (const [x, y] of [[70, 70], [M.width - 70, 70], [70, M.height - 70], [M.width - 70, M.height - 70]]) {
      const a = sx(x), b = sy(y), r = 15 * z; if (a < -60 || a > W + 60 || b < -60 || b > H + 60) continue;
      ctx.beginPath(); ctx.arc(a, b, r, 0, 2 * Math.PI); ctx.moveTo(a - r * 1.8, b); ctx.lineTo(a + r * 1.8, b); ctx.moveTo(a, b - r * 1.8); ctx.lineTo(a, b + r * 1.8); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Routes: from an open pattern to the ones it leads to, and from a work to the works it links.
    const hotPattern = hover?.type === 'pattern' ? hover.id : sel.pattern;
    if (hotPattern) {
      const p = patternAt.get(hotPattern);
      for (const r of p?.related || []) { const o = patternAt.get(r.id); if (o) route(p, o, .16, [6, 5]); }
    }
    const linked = new Set();
    const hotWork = hover?.type === 'work' ? hover.id : peeked;                 // under the pointer, or pointed at from a list
    const one = hotWork ? at.get(hotWork) : sel.works.size === 1 ? at.get([...sel.works][0]) : null;
    if (one) for (const l of one.links) { const o = at.get(l.to); if (o) { linked.add(o.id); route(one, o, .12); } }

    // Works.
    const r = lettered(z) > .5 ? markSize(z) * .56 : markRadius(z), cards = z >= Z_CARD - .25 ? Math.min(1, (z - (Z_CARD - .25)) / .25) : 0;
    const shown = plan(z), view = [wx(-140), wy(-90), wx(W + 140), wy(H + 90)];
    const visible = works.filter(w => w.x > view[0] && w.x < view[2] && w.y > view[1] && w.y < view[3]);
    for (const w of visible) {
      const x = sx(w.x), y = sy(w.y), hot = hotWork === w.id, chosen = sel.works.size === 1 && sel.works.has(w.id);
      if (cards < 1) {
        const big = hot || chosen ? 1.35 : linked.has(w.id) ? 1.15 : 1;
        ctx.globalAlpha = (1 - cards) * (hot ? 1 : strengthOf(w, z, .2));
        if (big > 1) { ctx.beginPath(); ctx.arc(x, y, r * big + 4.5, 0, 2 * Math.PI); ctx.fillStyle = PAPER; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = hot || chosen ? 1.6 : 1.2; ctx.stroke(); }
        mark(w.kind, x, y, z, big);
        hits.push({ type: 'work', id: w.id, at: [x, y], reach: Math.max(r + 4, 8) });
      }
      const t = shownAmount('w:' + w.id, shown.has('w:' + w.id) && cards < .5 ? 1 : 0, dt);
      if (t > .02) { ctx.globalAlpha = t * strengthOf(w, z, .28); ctx.font = titleFont; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; let label = w.title; while (width(label, titleFont) > 170 && label.length > 6) label = label.slice(0, -2); knock(label === w.title ? label : label.trimEnd() + '…', x + titleGap(w), y + .5, INK, 3); }
    }
    ctx.globalAlpha = 1;
    if (cards > 0) {
      const order = visible.slice().sort((a, b) => (hotWork === a.id) - (hotWork === b.id) || a.y - b.y);
      for (const w of order) card(w, z, cards, hotWork === w.id);
    }
    if (one && sel.works.has(one.id) && cards < 1 && !still) {   // a slow pulse on the open work
      const pulse = (clock / 1400) % 1, x = sx(one.x), y = sy(one.y), rr = r * 1.35 + 5 + pulse * 18;
      ctx.globalAlpha = (1 - pulse) * (1 - cards); ctx.beginPath(); ctx.arc(x, y, rr, 0, 2 * Math.PI);
      ctx.strokeStyle = PAPER; ctx.lineWidth = 3.6; ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke(); ctx.globalAlpha = 1; dirty = true;
    }

    // Pattern names, the only place names. Set larger for the patterns with most in them.
    // The name under the pointer or open in the reader comes first, then the names that fit at this zoom;
    // names called up by a question or a selection are added where there is still room.
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const taken = [], clear = b => !taken.some(t => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]);
    const dimmed = focus() && hover?.type !== 'pattern' && sel.pattern, rank = p => p.id === hotPattern ? 0 : shown.has('p:' + p.id) ? 1 : 2;
    for (const p of patterns.slice().sort((a, b) => rank(a) - rank(b))) {
      const hot = hotPattern === p.id, near = sel.related.has(p.id) || !!focusPatterns?.pattern?.has?.(p.id), planned = shown.has('p:' + p.id);
      if (!hot && !planned && !near) { if (fade.get('p:' + p.id)) shownAmount('p:' + p.id, 0, dt); continue; }
      const font = nameFont(p, z), size = nameSize(p, z), lines = nameLines(p, font, size), x = sx(p.x), y = sy(p.y), lead = size * 1.04, wide = Math.max(...lines.map(l => width(l, font)));
      const box = [x - wide / 2 - 5, y - lines.length * lead / 2 - 2, x + wide / 2 + 5, y + lines.length * lead / 2 + 2];
      const room = hot || clear(box);
      if (room) taken.push(box);
      const t = shownAmount('p:' + p.id, room ? (z >= Z_CARD ? .9 : 1) : 0, room ? dt : dt * 3);
      if (t < .02) continue;
      const flip = shownAmount('f:' + p.id, hot ? 1 : 0, dt * 1.4), alpha = t * (dimmed && !hot && !near ? .5 + .5 * plain(z) : 1);
      ctx.font = font;
      lines.forEach((l, i) => {
        const yy = y + (i - (lines.length - 1) / 2) * lead, lw = width(l, font);
        if (flip > .02) { ctx.globalAlpha = alpha * flip; ctx.fillStyle = INK; ctx.fillRect(x - lw / 2 - 5, yy - lead / 2 - .5, lw + 10, lead + 1); }      // the name singled out is struck in black, its letters left as paper
        if (flip < .98) { ctx.globalAlpha = alpha * (1 - flip); knock(l, x, yy + .5, INK, 3); }
        if (flip > .02) { ctx.globalAlpha = alpha * flip; ctx.fillStyle = PAPER; ctx.fillText(l, x, yy + .5); }
      });
      if (room) hits.push({ type: 'pattern', id: p.id, box });
    }
    ctx.globalAlpha = 1;
  }

  // ---- Camera
  const clampCam = () => { cam.x = Math.max(0, Math.min(M.width, cam.x)); cam.y = Math.max(0, Math.min(M.height, cam.y)); cam.z = Math.max(zMin, Math.min(Z_MAX, cam.z)); };
  function frame(now) {
    const gap = now - last || 16, dt = Math.min(50, gap); last = now; clock = now;
    if (tween) {
      const t = Math.min(1, (now - tween.start) / tween.ms), e = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      Object.assign(cam, t === 1 ? tween.to : tween.path.at(e));
      if (t === 1) tween = null; dirty = true;
    }
    if (zoomGoal) {
      const next = Math.exp(Math.log(cam.z) + (Math.log(zoomGoal) - Math.log(cam.z)) * Math.min(1, dt / 70));
      cam.z = Math.abs(next - zoomGoal) / zoomGoal < .002 ? zoomGoal : next;
      cam.x = anchor.wx - (anchor.sx - cx()) / cam.z; cam.y = anchor.wy - (anchor.sy - cy()) / cam.z;
      if (cam.z === zoomGoal) { zoomGoal = null; if (cam.z > Z_CARD - .25 && cam.z < Z_CARD) zoomGoal = cam.z < Z_CARD - .125 ? Z_CARD - .25 : Z_CARD; }
      dirty = true;
    }
    if (velocity && !drag) {
      cam.x -= velocity.x * dt / cam.z; cam.y -= velocity.y * dt / cam.z;
      velocity.x *= .92 ** (dt / 16); velocity.y *= .92 ** (dt / 16);
      if (Math.hypot(velocity.x, velocity.y) < .01) velocity = null; dirty = true;
    }
    // Where the inks cannot be printed fast enough (no graphics card, say), they are printed at half resolution
    // while the map is moving and at full resolution again as soon as it rests.
    const moving = !!(tween || zoomGoal || velocity || drag);
    if (moving && dirty && drew) { pace += (gap - pace) * .3; if (pace > 48 && !slow && now - introStart > 2500) { slow = true; slowSince = now; } }
    else if (!moving) { pace = 16; if (slow && now - slowSince > 6000) slow = false; }       // try full resolution again now and then
    const want = moving && slow ? .5 : 1;
    if (want !== coarse) { coarse = want; dirty = true; }
    drew = dirty || focusKey() !== focusKeyNow;
    if (drew) { dirty = false; clampCam(); print(dt, now); draw(dt); const close = cam.z > zFit * 1.45; if (close !== wasClose) { wasClose = close; cb.onZoom?.(close); } }
    requestAnimationFrame(frame);
  }
  // A flight zooms out, crosses and zooms in along the path that looks smoothest (van Wijk and Nuij's).
  function flight(a, b) {
    const rho = 1.3, rho2 = rho * rho, wide = Math.max(200, W - inset - insetLeft), w0 = wide / a.z, w1 = wide / b.z, dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d < 1) { const L = Math.log(w1 / w0) / rho; return { length: Math.abs(L), at: t => ({ x: a.x + dx * t, y: a.y + dy * t, z: wide / (w0 * Math.exp(rho * t * L)) }) }; }
    const b0 = (w1 * w1 - w0 * w0 + rho2 * rho2 * d * d) / (2 * w0 * rho2 * d), b1 = (w1 * w1 - w0 * w0 - rho2 * rho2 * d * d) / (2 * w1 * rho2 * d);
    const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1), L = (r1 - r0) / rho;
    return { length: L, at: t => { const s = t * L, u = w0 / (rho2 * d) * (Math.cosh(r0) * Math.tanh(rho * s + r0) - Math.sinh(r0)); return { x: a.x + u * dx, y: a.y + u * dy, z: wide / (w0 * Math.cosh(r0) / Math.cosh(rho * s + r0)) }; } };
  }
  function fly(to, ms) {
    zoomGoal = null; velocity = null;
    to = { x: to.x ?? cam.x, y: to.y ?? cam.y, z: Math.max(zMin, Math.min(Z_MAX, to.z ?? cam.z)) };
    if (still || ms === 0) { Object.assign(cam, to); tween = null; dirty = true; return; }
    const path = flight({ ...cam }, to);
    tween = { path, to, start: performance.now(), ms: ms ?? Math.max(420, Math.min(1700, path.length * 640)) };
  }
  function fit(ids, { maxZoom = 1.5, ms } = {}) {
    const list = ids.map(i => at.get(i)).filter(Boolean); if (!list.length) return;
    const x0 = Math.min(...list.map(w => w.x)), x1 = Math.max(...list.map(w => w.x)), y0 = Math.min(...list.map(w => w.y)), y1 = Math.max(...list.map(w => w.y));
    const z = Math.min(maxZoom, Math.max(60, room() - 150) / Math.max(1, x1 - x0 + 160), Math.max(60, H - insetTop - insetBottom - 190) / Math.max(1, y1 - y0 + 160));
    fly({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, z }, ms);
  }
  // The whole-map view is fitted to the works themselves, in whatever room the title block and reader leave.
  // The room never counts as less than a sliver, so a reader as wide as the window cannot send the zoom to nothing.
  const room = () => Math.max(120, W - inset - insetLeft);
  function homeView() {
    const xs = works.map(w => w.x), ys = works.map(w => w.y), x0 = Math.min(...xs) - 190, x1 = Math.max(...xs) + 190, y0 = Math.min(...ys) - 170, y1 = Math.max(...ys) + 170;
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: Math.min(room() / (x1 - x0), Math.max(120, H - insetTop - insetBottom) / (y1 - y0)) };
  }
  function home(ms) { fly(homeView(), ms); atHome = true; }
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight;
    const w = Math.round(W * dpr), h = Math.round(H * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    // On a narrow screen the title block spans the top and the zoom buttons sit at the bottom, so the map is framed between them.
    // The block folds away once you zoom in, so its tallest state at this window size is the one that counts.
    const plate = W <= 860 && document.getElementById('plate');
    if (W !== sized[0] || H !== sized[1]) { sized = [W, H]; tallest = 0; }
    tallest = Math.max(tallest, plate ? Math.min(H * .5, plate.getBoundingClientRect().bottom + 6) : 0);
    insetTop = plate ? tallest : 0; insetBottom = plate ? 64 : 0;
    if (!works.length) return;
    zFit = homeView().z; zMin = zFit * .72; plans.clear(); dirty = true;
    if (atHome) home(tween ? 900 : 0);
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
      cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, e); atHome = false; tween = null; zoomGoal = null; velocity = null;
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
      if (d.moved <= 4) { const box = cv.getBoundingClientRect(), h = pick(e.clientX - box.left, e.clientY - box.top); if (h) cb.onOpen?.(h); else cb.onMiss?.({ outside: !painted(wx(e.clientX - box.left), wy(e.clientY - box.top)) }); return; }
      if (performance.now() - d.t < 60 && Math.hypot(d.vx, d.vy) > .15) velocity = { x: d.vx, y: d.vy };
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { if (!drag) setHover(null); });
    cv.addEventListener('wheel', e => {
      e.preventDefault(); atHome = false; tween = null; velocity = null;
      const box = cv.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
      if (!zoomGoal || !anchor || Math.hypot(anchor.sx - x, anchor.sy - y) > 2) anchor = { sx: x, sy: y, wx: wx(x), wy: wy(y) };
      const step = e.ctrlKey ? -e.deltaY * .012 : -e.deltaY * (e.deltaMode ? .08 : .0022);
      zoomGoal = Math.max(zMin, Math.min(Z_MAX, (zoomGoal || cam.z) * Math.exp(step)));
      if (step < 0 && zoomGoal <= zFit * 1.03) home(520);          // pulling all the way back lands on the whole map
      cb.onHover?.(null);
    }, { passive: false });
    cv.addEventListener('dblclick', e => { const box = cv.getBoundingClientRect(); zoomAt(1.9, e.clientX - box.left, e.clientY - box.top); });
    new ResizeObserver(resize).observe(cv);
    const plate = document.getElementById('plate');       // on a narrow screen the title block, filled in after the map starts, decides the room
    if (plate) new ResizeObserver(() => { if (W <= 860) resize(); }).observe(plate);
    glcv.addEventListener('webglcontextlost', e => e.preventDefault());
    glcv.addEventListener('webglcontextrestored', () => { plateTex = []; focusTex = []; press(); dirty = true; });
  }
  function zoomAt(factor, x = cx(), y = cy()) { atHome = false; tween = null; anchor = { sx: x, sy: y, wx: wx(x), wy: wy(y) }; zoomGoal = Math.max(zMin, Math.min(Z_MAX, (zoomGoal || cam.z) * factor)); if (factor < 1 && zoomGoal <= zFit * 1.03) home(520); }

  // ---- What the page can ask of the map
  function setWorks(list) {
    works = list.filter(w => M.works[w.id]).map(w => ({ ...w, x: M.works[w.id][0], y: M.works[w.id][1] }));
    at = new Map(works.map(w => [w.id, w]));
    byPattern = new Map(patterns.map(p => [p.id, new Set()]));
    for (const w of works) for (const [p] of w.patterns) byPattern.get(p)?.add(w.id);
    const size = id => byPattern.get(id)?.size || 0;
    patterns.sort((a, b) => size(b.id) - size(a.id));
    most = Math.max(1, ...patterns.map(p => size(p.id)));
    plans.clear(); dirty = true;
    if (gl) inkUp();
  }
  return {
    init(canvas, data, callbacks) {
      cv = canvas; ctx = cv.getContext('2d'); M = data.map; cb = callbacks;
      glcv = document.createElement('canvas'); glcv.setAttribute('aria-hidden', 'true');
      glcv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none';
      cv.parentNode.insertBefore(glcv, cv);
      patterns = data.patterns.filter(p => M.patterns[p.id]).map(p => ({ ...p, x: M.patterns[p.id][0], y: M.patterns[p.id][1] }));
      patternAt = new Map(patterns.map(p => [p.id, p]));
      setWorks(data.works); assignInks(); resize(); press(); bind();
      Object.assign(cam, homeView()); if (!still) { cam.z *= 1.18; home(1700); }
      cv.style.cursor = 'grab';
      const fresh = () => { measured.clear(); wrapped.clear(); plans.clear(); dirty = true; };
      document.fonts?.ready.then(fresh);
      for (const f of [`700 semi-condensed 16px ${FONT}`, `600 12px ${FONT}`, `500 12px ${FONT}`, `400 12px ${FONT}`]) document.fonts?.load(f).then(fresh);
      document.fonts?.load(`700 12px ${MARK}`, Object.values(MARKS).join('')).then(fresh);
      introStart = performance.now();
      requestAnimationFrame(frame);
    },
    setWorks,
    setFilter(fn) { filter = fn; dirty = true; },
    setInset(right, left = 0) { if (right !== inset || left !== insetLeft) { const shift = ((left - insetLeft) - (right - inset)) / 2 / cam.z; inset = right; insetLeft = left; cam.x += shift; zFit = homeView().z; zMin = zFit * .72; dirty = true; if (atHome && !right) home(tween ? 1200 : 500); } },
    select({ works: ids = [], pattern = null, related = [], fly: move = true }) {
      sel = { works: new Set(ids), pattern, related: new Set(related), serial: sel.serial + 1 }; dirty = true; if (ids.length) atHome = false;
      if (!move || !ids.length) return;
      if (ids.length === 1) { const w = at.get(ids[0]); if (w) fly({ x: w.x, y: w.y, z: Math.max(cam.z, Z_CARD + .3) }); }
      else fit(ids, { maxZoom: pattern ? 1.9 : 1.3 });
    },
    focusPatterns(ids) { if (!ids) focusPatterns = null; else { focusPatterns = new Set(ids.flatMap(p => [...(byPattern.get(p) || [])])); focusPatterns.pattern = new Set(ids); focusPatterns.key = 'ps:' + ids.join(' '); } dirty = true; },
    focusWorks(ids) { if (!ids) focusList = null; else { focusList = new Set(ids); focusList.key = 'w:' + ids.join(' '); } dirty = true; },      // light up any set of works
    peek(id) { const next = id && at.has(id) ? id : null; if (next !== peeked) { peeked = next; dirty = true; } },      // mark one work, as hovering it would
    around() {                                             // the patterns nearest the middle of the view, nearest first
      const reach = Math.min(W - inset - insetLeft, H) / 2 / cam.z;
      return patterns.map(p => [Math.hypot(p.x - cam.x, p.y - cam.y), p.id]).filter(d => d[0] < reach).sort((a, b) => a[0] - b[0]).map(d => d[1]);
    },
    tintOf: id => at.has(id) ? mainInk(at.get(id)) : undefined,          // the colour of a work's main ink, for its preview
    fit, home, zoomAt,
    pan(dx, dy) { atHome = false; fly({ x: cam.x + dx / cam.z, y: cam.y + dy / cam.z }, 260); },
    zoom: () => cam.z,
    cardsShown: () => cam.z >= Z_CARD,
    intro(pace = 1) { introPace = pace; introStart = performance.now(); dirty = true; },   // print the sheet again, ink by ink
  };
})();
