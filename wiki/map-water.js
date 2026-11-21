// The map as a wet watercolour. Every pattern is a pigment laid where its works are;
// neighbouring pigments run into each other, so a work in two patterns sits where they mix.
// The paint is mixed in a shader; names, marks and cards are drawn on a canvas above it.
// Zooming changes what is shown: pattern names, then work titles, then a card for every work.
window.MapView = (() => {
  const INK = '#2b2622', PAPER = '#f6f0e3', RUST = '#b23a1e';
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
  let gl = null, glCanvas = null, program = null, uniforms = {}, fieldTexture = null, glScale = 1, grow = 1, growStart = 0, spot = null, veil = null;
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
  const source = w => w.kind === 'post' ? (w.slack.channel === 'private-channel' ? 'a private channel' : '#' + w.slack.channel) : w.kind === 'said' ? 'call excerpt' : ({ doc: 'Google Doc', sheet: 'Google Sheet', repo: 'repository', gist: 'gist', site: 'live site', file: 'link' })[w.sub] || w.sub;
  const shortDay = d => `${+d.slice(8, 10)} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+d.slice(5, 7) - 1]} ’${d.slice(2, 4)}`;

  // ---- Pigments. Hue follows a pattern's position; patterns near the middle get earthier paint,
  //      so colours that meet across the centre mix to something better than mud.
  const RAMP = [[0, .84, .42, .45], [40, .84, .53, .36], [75, .89, .73, .42], [115, .62, .71, .43], [160, .36, .63, .55], [200, .33, .60, .71], [235, .37, .48, .75], [270, .49, .42, .69], [310, .69, .44, .62], [360, .84, .42, .45]];
  function pigment([hue, distance]) {
    const i = RAMP.findIndex(s => s[0] > hue), a = RAMP[i - 1], b = RAMP[i], t = (hue - a[0]) / (b[0] - a[0]);
    const vivid = [1, 2, 3].map(k => a[k] + (b[k] - a[k]) * t), earth = [.74, .62, .47];
    const keep = Math.min(1, Math.max(0, (distance - .08) / .5)), m = .5 * (1 - keep * keep * (3 - 2 * keep));
    return vivid.map((v, k) => v + (earth[k] - v) * m);
  }
  const SOURCE = { post: [.57, .38, .64], doc: [.36, .52, .80], tool: [.35, .62, .46], site: [.27, .62, .68], said: [.90, .70, .35], other: [.62, .60, .56] };
  let colouring = 'topic';
  const absorb = rgb => rgb.map(v => -Math.log(Math.max(.02, v)));
  const css = rgb => `rgb(${rgb.map(v => Math.round(v * 255)).join(',')})`;

  // How much of which paint lies where: red, green and blue absorbance, and the total amount, on a coarse grid.
  function buildField() {
    if (!gl) return;
    const step = 8, nx = Math.ceil(M.width / step), ny = Math.ceil(M.height / step), field = new Float32Array(nx * ny * 4);
    const splat = (x, y, sigma, amount, ab) => {
      const cx = x / step, cy = y / step, s = sigma / step, reach = Math.ceil(s * 3);
      for (let j = Math.max(0, Math.floor(cy - reach)); j <= Math.min(ny - 1, cy + reach); j++) for (let i = Math.max(0, Math.floor(cx - reach)); i <= Math.min(nx - 1, cx + reach); i++) {
        const g = amount * Math.exp(-((i - cx) ** 2 + (j - cy) ** 2) / (2 * s * s)), k = (j * nx + i) * 4;
        field[k] += ab[0] * g; field[k + 1] += ab[1] * g; field[k + 2] += ab[2] * g; field[k + 3] += g;
      }
    };
    const paint = new Map(patterns.map(p => [p.id, absorb(p.rgb)]));
    for (const w of works) {
      if (colouring === 'source') { splat(w.x, w.y, 62, 1, absorb(SOURCE[w.kind])); continue; }
      const mix = [0, 0, 0]; let total = 0;
      for (const [p, s] of w.patterns) { const ab = paint.get(p); if (!ab) continue; const share = s === 2 ? 1 : .4; total += share; for (let k = 0; k < 3; k++) mix[k] += ab[k] * share; }
      if (total) splat(w.x, w.y, 62, 1, mix.map(v => v / total)); else splat(w.x, w.y, 52, .8, [.2, .2, .19]);
    }
    if (colouring === 'topic') for (const p of patterns) if (byPattern.get(p.id)?.size) splat(p.x, p.y, 84, 1.1, paint.get(p.id));
    gl.bindTexture(gl.TEXTURE_2D, fieldTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, nx, ny, 0, gl.RGBA, gl.FLOAT, field);
  }

  const FRAGMENT = `#version 300 es
  precision highp float;
  uniform sampler2D uField;
  uniform vec2 uRes, uCentre, uWorld;
  uniform vec3 uCam;
  uniform float uScale, uGrow;
  out vec4 outColor;
  float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
  float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.02 + vec2(13.7, 7.3); a *= .5; } return s / .9375; }
  void main() {
    vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale;
    vec2 w = (px - uCentre) / uCam.z + uCam.xy;
    // Paper: fine tooth that stays sharp at any zoom, and a slow unevenness that belongs to the sheet.
    float tooth = noise(px * 2.3) * .6 + noise(px * .9 + 40.) * .4;
    vec3 paper = vec3(.968, .945, .895) * (1. - .05 * (tooth - .5)) * (.982 + .036 * fbm(w * .0016 + 9.));
    // Wet paint wanders: look the paint up a little away from where we are.
    vec2 q = w + 46. * (vec2(fbm(w * .0045 + 3.1), fbm(w * .0045 + 11.7)) - .5) + 11. * (vec2(fbm(w * .028 + 1.3), fbm(w * .028 + 5.9)) - .5);
    vec4 f = texture(uField, q / uWorld);
    float amount = f.a;
    vec3 colour = f.rgb / max(amount, .001);
    // The first wash, with an uneven edge where it met dry paper. Pigment pools at that edge.
    float ragged = amount * (.55 + .9 * (fbm(w * .011 + 2.) * .62 + fbm(w * .07 + 8.) * .28 + noise(w * .45) * .1));
    float edge = mix(9., .62, uGrow);
    float wet = smoothstep(edge, edge + .07, ragged);
    float pool = wet * exp(-(ragged - edge) / .3);
    // Two more glazes where there is more work, each with its own edge.
    float second = amount * (.55 + .9 * fbm(w * .017 + 21.)), third = amount * (.6 + .8 * fbm(w * .02 + 37.));
    float e2 = mix(12., 3.3, uGrow), e3 = mix(16., 6.4, uGrow);
    float glaze2 = smoothstep(e2, e2 + .14, second), glaze3 = smoothstep(e3, e3 + .2, third);
    float pool2 = glaze2 * exp(-(second - e2) / .7), pool3 = glaze3 * exp(-(third - e3) / .9);
    // Pigment settles into the paper's grain and dries unevenly.
    float grain = 1. + .5 * (tooth - .5) + .5 * (fbm(w * .05 + 50.) - .5);
    float paint = wet * (.3 + .27 * glaze2 + .25 * glaze3) * grain + pool * .34 + pool2 * .16 + pool3 * .12;
    float stain = (1. - wet) * smoothstep(edge * .25, edge, ragged) * .07;
    outColor = vec4(paper * exp(-colour * (paint + stain)), 1.);
  }`;
  function buildArt() {
    glCanvas = document.createElement('canvas');
    glCanvas.setAttribute('aria-hidden', 'true');
    glCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none';
    cv.before(glCanvas);
    gl = glCanvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) { cv.style.background = PAPER; return; }          // no paint without WebGL; the marks and names still work
    const shader = (type, text) => { const s = gl.createShader(type); gl.shaderSource(s, text); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; };
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, '#version 300 es\nin vec2 p; void main() { gl_Position = vec4(p, 0., 1.); }'));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program); gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.bindAttribLocation(program, 0, 'p'); gl.vertexAttribPointer(gl.getAttribLocation(program, 'p'), 2, gl.FLOAT, false, 0, 0);
    for (const name of ['uField', 'uRes', 'uCentre', 'uWorld', 'uCam', 'uScale', 'uGrow']) uniforms[name] = gl.getUniformLocation(program, name);
    fieldTexture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, fieldTexture);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    buildField(); sizeGl();
    // A soft round hole, punched in the veil that quietens everything outside a pattern.
    spot = document.createElement('canvas'); spot.width = spot.height = 128;
    const s = spot.getContext('2d'), g = s.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.55, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    s.fillStyle = g; s.fillRect(0, 0, 128, 128);
    veil = document.createElement('canvas');
  }
  function sizeGl() {
    if (!gl) return;
    glScale = Math.min(dpr, 1.5);
    glCanvas.width = Math.round(W * glScale); glCanvas.height = Math.round(H * glScale);
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
  }
  function paintPaper() {
    if (!gl) return;
    gl.uniform1i(uniforms.uField, 0); gl.uniform2f(uniforms.uRes, glCanvas.width, glCanvas.height); gl.uniform2f(uniforms.uCentre, cx(), cy());
    gl.uniform2f(uniforms.uWorld, M.width, M.height); gl.uniform3f(uniforms.uCam, cam.x, cam.y, cam.z); gl.uniform1f(uniforms.uScale, glScale); gl.uniform1f(uniforms.uGrow, grow);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---- Which labels fit at a zoom level. Sizes are in screen pixels, so this only depends on zoom.
  const patternSize = (p, z) => (z < zFit * 1.5 ? 12.5 : z < 1 ? 15 : 16.5) * (.86 + .5 * Math.sqrt(p.weight));
  const patternFont = (p, z) => `italic 500 ${patternSize(p, z).toFixed(1)}px ${TEXT}`;
  const titleFont = `500 11.5px ${SANS}`;
  function plan(z) {
    const key = Math.round(Math.log2(z) * 6);
    if (plans.has(key)) return plans.get(key);
    const zz = 2 ** (key / 6), placed = [], shown = new Set();
    const free = r => !placed.some(p => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1]);
    for (const p of patterns) {
      const font = patternFont(p, zz), size = patternSize(p, zz), lines = wrap(p.label, font, size * 9.5, 3), w = Math.max(...lines.map(l => width(l, font))), h = lines.length * size * 1.12;
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
  function shownAmount(key, want, dt, ms = 110) {
    const now = fade.get(key) ?? 0, next = still ? want : now + (want - now) * Math.min(1, dt / ms);
    if (Math.abs(next - want) > .01) dirty = true;
    fade.set(key, Math.abs(next - want) < .01 ? want : next);
    return fade.get(key);
  }
  function halo(text, x, y, fill, strength = 3.2) {
    ctx.lineJoin = 'round'; ctx.lineWidth = strength; ctx.strokeStyle = 'rgba(250,246,236,.5)';
    ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }
  // Marks are pen and ink over the paint: the shape says where a work lives.
  function symbol(kind, x, y, r, colour = INK) {
    ctx.beginPath();
    if (kind === 'doc') ctx.rect(x - r * .74, y - r, r * 1.48, r * 2);
    else if (kind === 'tool') { ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 1.2, y); ctx.lineTo(x, y + r * 1.2); ctx.lineTo(x - r * 1.2, y); ctx.closePath(); }
    else if (kind === 'said') { ctx.moveTo(x - r, y + r); ctx.lineTo(x - r, y); ctx.arc(x, y, r, Math.PI, Math.PI * 2.5); ctx.closePath(); }
    else if (kind === 'other') ctx.rect(x - r * .8, y - r * .8, r * 1.6, r * 1.6);
    else ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, r * .7); ctx.strokeStyle = 'rgba(250,246,236,.45)'; ctx.stroke();
    if (kind === 'post' || kind === 'tool') { ctx.fillStyle = colour; ctx.fill(); }
    else { ctx.fillStyle = '#fbf7ec'; ctx.fill(); ctx.lineWidth = Math.max(1.1, r * .36); ctx.strokeStyle = colour; ctx.stroke(); }
  }
  function curve(a, b, bend = .16) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx - dy * bend, my + dx * bend, b.x, b.y);
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
    ctx.save(); ctx.globalAlpha = alpha * (lit(w) ? 1 : .3);
    if (hot) { ctx.translate(x + cw / 2, y + h / 2); ctx.scale(1.035, 1.035); ctx.translate(-x - cw / 2, -y - h / 2); }
    ctx.shadowColor = hot ? 'rgba(50,34,20,.36)' : 'rgba(50,34,20,.2)'; ctx.shadowBlur = hot ? 18 : 8; ctx.shadowOffsetY = hot ? 6 : 2;
    ctx.fillStyle = '#fdfaf2';
    ctx.beginPath(); ctx.roundRect(x, y, cw, h, 2.5); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = chosen || hot ? 1.6 : .8; ctx.strokeStyle = chosen || hot ? RUST : 'rgba(43,38,34,.3)'; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, cw, h, 2.5); ctx.clip(); ctx.fillStyle = w.paint; ctx.globalAlpha *= .85; ctx.fillRect(x, y, cw, 4); ctx.restore();   // a brush of its main pattern's paint
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `400 9.5px ${MONO}`; ctx.fillStyle = 'rgba(43,38,34,.7)';
    const when = w.kind === 'said' ? shortDay(w.date).replace(/^\d+ /, '') : shortDay(w.date), room = inner - width(when, ctx.font) - 22;
    let src = source(w); if (width(src, ctx.font) > room) { while (src.length > 4 && width(src + '…', ctx.font) > room) src = src.slice(0, -1); src += '…'; }
    symbol(w.kind, x + pad + 5, y + pad + 5, 3.4);
    ctx.font = `400 9.5px ${MONO}`; ctx.fillStyle = 'rgba(43,38,34,.7)'; ctx.textAlign = 'left';
    ctx.fillText(src, x + pad + 14, y + pad + 8); ctx.textAlign = 'right'; ctx.fillText(when, x + cw - pad, y + pad + 8); ctx.textAlign = 'left';
    ctx.font = tf; ctx.fillStyle = hot ? RUST : '#26211c';
    title.forEach((l, i) => ctx.fillText(l, x + pad + 2, y + pad + 13 + (i + 1) * th - 3));
    if (gloss.length) { ctx.font = gf; ctx.fillStyle = 'rgba(43,38,34,.82)'; gloss.forEach((l, i) => ctx.fillText(l, x + pad + 2, y + pad + 13 + title.length * th + 5 + (i + 1) * 14 - 3)); }
    ctx.restore();
    hits.push({ type: 'work', id: w.id, box: [x, y, x + cw, y + h] });
  }

  let lastGlow = null;
  function draw(dt) {
    const z = cam.z;
    hits = [];
    if (grow < 1) { const t = still ? 1 : Math.max(0, Math.min(1, (clock - growStart) / 2600)); grow = 1 - (1 - t) ** 3; if (grow > .999) grow = 1; dirty = true; }
    paintPaper();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const world = () => ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (cx() - cam.x * z), dpr * (cy() - cam.y * z));
    const screen = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const px = n => n / z;

    // Singling a pattern out: everything else goes quiet under a thin veil of paper.
    const hotPattern = hover?.type === 'pattern' ? hover.id : sel.pattern;
    const glow = hover?.type === 'pattern' ? byPattern.get(hover.id) : focusPatterns || (sel.works.size > 1 ? sel.works : null);
    if (glow) lastGlow = glow;
    const quiet = shownAmount('veil', glow ? 1 : 0, dt, 170);
    if (quiet > .01 && lastGlow) {
      const k = .5, vw = Math.ceil(W * k), vh = Math.ceil(H * k);
      if (veil.width !== vw || veil.height !== vh) { veil.width = vw; veil.height = vh; }
      const v = veil.getContext('2d');
      v.setTransform(1, 0, 0, 1, 0, 0); v.globalCompositeOperation = 'source-over'; v.clearRect(0, 0, vw, vh);
      v.fillStyle = 'rgba(246,240,227,.7)'; v.fillRect(0, 0, vw, vh);
      v.globalCompositeOperation = 'destination-out';
      const r = Math.max(26, 92 * z) * k;
      for (const id of lastGlow) { const w = at.get(id); if (w) v.drawImage(spot, sx(w.x) * k - r, sy(w.y) * k - r, r * 2, r * 2); }
      ctx.globalAlpha = quiet; ctx.drawImage(veil, 0, 0, W, H); ctx.globalAlpha = 1;
    }

    world();
    if (hotPattern) {
      const p = patterns.find(p => p.id === hotPattern);
      ctx.strokeStyle = 'rgba(43,38,34,.6)'; ctx.lineWidth = px(1.4); ctx.setLineDash([px(2), px(5)]); ctx.lineCap = 'round';
      for (const r of p?.related || []) { const o = patterns.find(q => q.id === r.id); if (o) { curve(p, o); ctx.stroke(); } }
      ctx.setLineDash([]);
    }
    const linked = new Set();
    const one = hover?.type === 'work' ? at.get(hover.id) : sel.works.size === 1 ? at.get([...sel.works][0]) : null;
    if (one) {
      ctx.strokeStyle = 'rgba(178,58,30,.85)'; ctx.lineWidth = px(1.5);
      for (const l of one.links) { const o = at.get(l.to); if (o) { linked.add(o.id); curve(one, o, .12); ctx.stroke(); } }
    }

    screen();
    // Works. They arrive with the paint.
    const r = markRadius(z), cards = z >= Z_CARD - .25 ? Math.min(1, (z - (Z_CARD - .25)) / .25) : 0;
    const shown = plan(z), view = [wx(-140), wy(-90), wx(W + 140), wy(H + 90)], arrived = Math.max(0, (grow - .35) / .65);
    const visible = works.filter(w => w.x > view[0] && w.x < view[2] && w.y > view[1] && w.y < view[3]);
    for (const w of visible) {
      const x = sx(w.x), y = sy(w.y), hot = hover?.type === 'work' && hover.id === w.id, chosen = sel.works.size === 1 && sel.works.has(w.id);
      if (cards < 1) {
        ctx.globalAlpha = (1 - cards) * (lit(w) ? 1 : .25) * arrived;
        symbol(w.kind, x, y, hot || chosen ? r * 1.5 : linked.has(w.id) ? r * 1.25 : r, hot || chosen ? RUST : INK);
        if (hot || chosen || linked.has(w.id)) { ctx.beginPath(); ctx.arc(x, y, r * (hot || chosen ? 1.5 : 1.25) + 4, 0, 2 * Math.PI); ctx.strokeStyle = RUST; ctx.lineWidth = 1.5; ctx.stroke(); }
        hits.push({ type: 'work', id: w.id, at: [x, y], reach: Math.max(r + 4, 8) });
      }
      const t = shownAmount('w:' + w.id, shown.has('w:' + w.id) && cards < .5 ? 1 : 0, dt);
      if (t > .02) { ctx.globalAlpha = t * (lit(w) ? .95 : .3); ctx.font = titleFont; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; let label = w.title; while (width(label, titleFont) > 170 && label.length > 6) label = label.slice(0, -2); halo(label === w.title ? label : label.trimEnd() + '…', x + r + 5, y + .5, hot ? RUST : '#26211c', 2.8); }
    }
    ctx.globalAlpha = 1;
    if (cards > 0) {
      const order = visible.slice().sort((a, b) => (hover?.id === a.id) - (hover?.id === b.id) || a.y - b.y);
      for (const w of order) card(w, z, cards);
    }
    if (one && sel.works.has(one.id) && cards < 1 && !still) {   // a slow pulse on the open work
      const pulse = (clock / 1400) % 1; ctx.globalAlpha = (1 - pulse) * .7; ctx.beginPath(); ctx.arc(sx(one.x), sy(one.y), r * 1.5 + 4 + pulse * 16, 0, 2 * Math.PI); ctx.strokeStyle = RUST; ctx.lineWidth = 1.4; ctx.stroke(); ctx.globalAlpha = 1; dirty = true;
    }

    // Pattern names, written over the paint.
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // Names that fit come first; names called up by a question or a selection are added where there is still room.
    const taken = [], clear = b => !taken.some(t => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]);
    for (const p of [...patterns.filter(p => shown.has('p:' + p.id)), ...patterns.filter(p => !shown.has('p:' + p.id))]) {
      const hot = hotPattern === p.id, near = sel.related.has(p.id) || focusPatterns?.pattern?.has?.(p.id), planned = shown.has('p:' + p.id);
      if (!planned && !hot && near) { const f = patternFont(p, z), sz = patternSize(p, z), ls = wrap(p.label, f, sz * 9.5, 3), wd = Math.max(...ls.map(l => width(l, f))), b = [sx(p.x) - wd / 2 - 4, sy(p.y) - ls.length * sz * .6, sx(p.x) + wd / 2 + 4, sy(p.y) + ls.length * sz * .6]; if (!clear(b)) { fade.set('p:' + p.id, 0); continue; } }
      const want = planned || hot || near ? (z >= Z_CARD ? .9 : 1) : 0;
      const t = shownAmount('p:' + p.id, want, dt) * arrived;
      if (t < .02) continue;
      const font = patternFont(p, z), size = patternSize(p, z), lines = wrap(p.label, font, size * 9.5, 3), x = sx(p.x), y = sy(p.y);
      ctx.font = font; ctx.globalAlpha = t * (quiet > .5 && !hot && !near ? .5 : 1);
      let wide = 0;
      lines.forEach((l, i) => { halo(l, x, y + (i - (lines.length - 1) / 2) * size * 1.12, hot ? RUST : '#221d19', 3.8); wide = Math.max(wide, width(l, font)); });
      const box = [x - wide / 2 - 4, y - lines.length * size * .6, x + wide / 2 + 4, y + lines.length * size * .6];
      taken.push(box); hits.push({ type: 'pattern', id: p.id, box });
    }
    ctx.globalAlpha = 1;
    if (M.loose && z > zFit * 1.2 && works.some(w => !w.patterns.length)) { ctx.font = `italic 500 13px ${TEXT}`; ctx.globalAlpha = .7 * arrived; halo('not yet sorted', sx(M.loose[0]), sy(M.loose[1]) - 46 * z - 8, INK); ctx.globalAlpha = 1; }
  }

  // ---- Camera
  const clampCam = () => { cam.x = Math.max(0, Math.min(M.width, cam.x)); cam.y = Math.max(0, Math.min(M.height, cam.y)); cam.z = Math.max(zMin, Math.min(Z_MAX, cam.z)); };
  function frame(now) {
    const dt = Math.min(50, now - last || 16); last = now; clock = now;
    if (tween) {
      const t = Math.min(1, (now - tween.start) / tween.ms), e = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      Object.assign(cam, t === 1 ? tween.to : tween.path.at(e));
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
  function flight(a, b) {
    const rho = 1.3, rho2 = rho * rho, wide = Math.max(200, W - inset - insetLeft), w0 = wide / a.z, w1 = wide / b.z, dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d < 1) { const S = Math.log(w1 / w0) / rho; return { length: Math.abs(S), at: t => ({ x: a.x + dx * t, y: a.y + dy * t, z: wide / (w0 * Math.exp(rho * t * S)) }) }; }
    const b0 = (w1 * w1 - w0 * w0 + rho2 * rho2 * d * d) / (2 * w0 * rho2 * d), b1 = (w1 * w1 - w0 * w0 - rho2 * rho2 * d * d) / (2 * w1 * rho2 * d);
    const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1), S = (r1 - r0) / rho;
    return { length: S, at: t => { const s = t * S, u = w0 / (rho2 * d) * (Math.cosh(r0) * Math.tanh(rho * s + r0) - Math.sinh(r0)); return { x: a.x + u * dx, y: a.y + u * dy, z: wide / (w0 * Math.cosh(r0) / Math.cosh(rho * s + r0)) }; } };
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
    const z = Math.min(maxZoom, (W - inset - insetLeft - 150) / Math.max(1, x1 - x0 + 160), (H - 190) / Math.max(1, y1 - y0 + 160));
    fly({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, z }, ms);
  }
  let atHome = true;
  function homeView() {
    const xs = works.map(w => w.x), ys = works.map(w => w.y), x0 = Math.min(...xs) - 190, x1 = Math.max(...xs) + 190, y0 = Math.min(...ys) - 170, y1 = Math.max(...ys) + 170;
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: Math.min((W - inset - insetLeft) / (x1 - x0), H / (y1 - y0)) };
  }
  function home(ms) { fly(homeView(), ms); atHome = true; }
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    zFit = homeView().z; zMin = zFit * .72; plans.clear(); dirty = true; sizeGl(); if (atHome && works.length) home(tween ? 900 : 0);
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
      if (d.moved <= 4) { const box = cv.getBoundingClientRect(), h = pick(e.clientX - box.left, e.clientY - box.top); if (h) cb.onOpen?.(h); else cb.onMiss?.(); return; }
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
      cb.onHover?.(null);
    }, { passive: false });
    cv.addEventListener('dblclick', e => { const box = cv.getBoundingClientRect(); zoomAt(1.9, e.clientX - box.left, e.clientY - box.top); });
    new ResizeObserver(resize).observe(cv);
  }
  function zoomAt(factor, x = cx(), y = cy()) { atHome = false; tween = null; anchor = { sx: x, sy: y, wx: wx(x), wy: wy(y) }; zoomGoal = Math.max(zMin, Math.min(Z_MAX, (zoomGoal || cam.z) * factor)); }

  // ---- What the page can ask of the map
  function setWorks(list) {
    works = list.filter(w => M.works[w.id]).map(w => ({ ...w, x: M.works[w.id][0], y: M.works[w.id][1] }));
    at = new Map(works.map(w => [w.id, w]));
    byPattern = new Map(patterns.map(p => [p.id, new Set()]));
    for (const w of works) for (const [p] of w.patterns) byPattern.get(p)?.add(w.id);
    const size = id => byPattern.get(id)?.size || 0, most = Math.max(1, ...patterns.map(p => size(p.id)));
    patterns.sort((a, b) => size(b.id) - size(a.id));
    for (const p of patterns) p.weight = size(p.id) / most;
    const paints = new Map(patterns.map(p => [p.id, css(p.rgb)]));
    for (const w of works) w.paint = colouring === 'source' ? css(SOURCE[w.kind]) : paints.get(w.patterns[0]?.[0]) || '#b9b4a8';
    plans.clear(); wrapped.clear(); buildField(); dirty = true;
  }
  return {
    init(canvas, data, callbacks) {
      cv = canvas; ctx = cv.getContext('2d'); D = data; M = data.map; cb = callbacks;
      patterns = data.patterns.filter(p => M.patterns[p.id]).map(p => ({ ...p, x: M.patterns[p.id][0], y: M.patterns[p.id][1], rgb: pigment(M.tint[p.id] || [40, 0]) }));
      areas = data.areas.filter(a => M.territories[a.id]).map(a => ({ ...a, spot: M.areas[a.id] }));
      dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight;
      setWorks(data.works); buildArt(); buildField(); resize(); bind();
      grow = still ? 1 : 0; growStart = performance.now() + 250;
      Object.assign(cam, homeView()); if (!still) { cam.z *= 1.18; home(1700); }
      cv.style.cursor = 'grab';
      document.fonts?.ready.then(() => { measured.clear(); wrapped.clear(); plans.clear(); dirty = true; });
      for (const f of [`600 30px ${SERIF}`, `italic 500 16px ${TEXT}`]) document.fonts?.load(f).then(() => { measured.clear(); wrapped.clear(); plans.clear(); dirty = true; });
      requestAnimationFrame(frame);
    },
    setWorks,
    setFilter(fn) { filter = fn; dirty = true; },
    setInset(right, left = 0) { if (right !== inset || left !== insetLeft) { const shift = ((left - insetLeft) - (right - inset)) / 2 / cam.z; inset = right; insetLeft = left; cam.x += shift; zFit = homeView().z; zMin = zFit * .72; dirty = true; if (atHome && !right) home(tween ? 1200 : 500); } },
    select({ works: ids = [], pattern = null, related = [], fly: move = true }) {
      sel = { works: new Set(ids), pattern, related: new Set(related) }; dirty = true; if (ids.length) atHome = false;
      if (!move || !ids.length) return;
      if (ids.length === 1) { const w = at.get(ids[0]); if (w) fly({ x: w.x, y: w.y, z: Math.max(cam.z, Z_CARD + .3) }); }
      else fit(ids, { maxZoom: pattern ? 1.9 : 1.3 });
    },
    setColouring(mode) { if (mode === colouring) return; colouring = mode; setWorks(works); if (!still) { grow = .3; growStart = performance.now() - 2600 * .11; } dirty = true; },
    sourcePaint: () => Object.fromEntries(Object.entries(SOURCE).map(([k, rgb]) => [k, css(rgb)])),
    focusWorks(ids) { if (!ids) focusPatterns = null; else { focusPatterns = new Set(ids); focusPatterns.pattern = new Set(); } dirty = true; },
    focusPatterns(ids) { if (!ids) focusPatterns = null; else { focusPatterns = new Set(ids.flatMap(p => [...(byPattern.get(p) || [])])); focusPatterns.pattern = new Set(ids); } dirty = true; },
    fit, home, zoomAt,
    pan(dx, dy) { atHome = false; fly({ x: cam.x + dx / cam.z, y: cam.y + dy / cam.z }, 260); },
    zoom: () => cam.z,
    cardsShown: () => cam.z >= Z_CARD,
  };
})();
