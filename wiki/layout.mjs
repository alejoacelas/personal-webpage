// Lays the works out as a map. Works that share patterns end up near each other,
// and the land is grown around wherever works are: dense ground becomes high ground.
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from 'd3-force';
import { contours } from 'd3-contour';
import { blur2 } from 'd3-array';

const STEP = 10;          // terrain grid, in world units
const MARGIN = 420;       // open sea around the land
const WORK_R = 30;        // half the room each work gets

// Repeatable noise, so the coastline is the same on every build.
function hash(x, y, seed) { let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function noise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const rand = (i, seed) => hash(i, i * 7 + 3, seed);

export function layout({ works, patterns, areas }) {
  const count = new Map(patterns.map(p => [p.id, 0]));
  for (const w of works) for (const [p] of w.patterns) count.set(p, count.get(p) + 1);

  // ---- 1. Patterns: pulled towards their area and towards patterns they share works with.
  const areaNodes = areas.map((a, i) => ({ id: 'a:' + a.id, area: true, x: Math.cos(i / areas.length * 2 * Math.PI) * 900, y: Math.sin(i / areas.length * 2 * Math.PI) * 560 }));
  const areaAt = new Map(areaNodes.map(n => [n.id, n]));
  const pNodes = patterns.map((p, i) => {
    const a = areaAt.get('a:' + p.area) || areaNodes[0];
    return { id: p.id, r: 78 + 13 * Math.sqrt(count.get(p.id)), x: a.x + (rand(i, 1) - .5) * 300, y: a.y + (rand(i, 2) - .5) * 300 };
  });
  const pAt = new Map(pNodes.map(n => [n.id, n]));
  const shared = new Map();
  for (const w of works) for (const [a] of w.patterns) for (const [b] of w.patterns) if (a < b) shared.set(a + '|' + b, (shared.get(a + '|' + b) || 0) + 1);
  const links = patterns.map(p => ({ source: p.id, target: 'a:' + p.area, distance: 190, strength: .45 }));
  for (const [key, n] of shared) {
    const [a, b] = key.split('|');
    const j = n / (count.get(a) + count.get(b) - n);
    if (j > .04) links.push({ source: a, target: b, distance: pAt.get(a).r + pAt.get(b).r, strength: Math.min(.5, j * 1.6) });
  }
  for (const p of patterns) for (const r of p.related || []) if (pAt.has(r.id)) links.push({ source: p.id, target: r.id, distance: pAt.get(p.id).r + pAt.get(r.id).r + 40, strength: .06 });
  forceSimulation([...areaNodes, ...pNodes])
    .force('link', forceLink(links).id(n => n.id).distance(l => l.distance).strength(l => l.strength))
    .force('charge', forceManyBody().strength(n => n.area ? -5200 : -700).distanceMax(1600))
    .force('collide', forceCollide(n => n.area ? 60 : n.r).strength(.9).iterations(2))
    .force('x', forceX(0).strength(.018)).force('y', forceY(0).strength(.034))
    .stop().tick(600);

  // ---- 2. Works: tied to each of their patterns, so a work in several sits between them.
  for (const n of pNodes) { n.fx = n.x; n.fy = n.y; n.pattern = true; }
  const loose = works.filter(w => !w.patterns.length);
  const wNodes = works.filter(w => w.patterns.length).map((w, i) => {
    let x = 0, y = 0, t = 0;
    for (const [p, s] of w.patterns) { const n = pAt.get(p); x += n.x * s; y += n.y * s; t += s; }
    const angle = rand(i, 3) * 2 * Math.PI, d = 40 + rand(i, 4) * 90;
    return { id: w.id, x: x / t + Math.cos(angle) * d, y: y / t + Math.sin(angle) * d };
  });
  const wLinks = works.flatMap(w => w.patterns.map(([p, s]) => ({ source: w.id, target: p, strength: (s === 2 ? .85 : .1) / Math.sqrt(w.patterns.filter(x => x[1] === s).length), distance: 30 + pAt.get(p).r * .55 })));
  forceSimulation([...pNodes, ...wNodes])
    .force('link', forceLink(wLinks).id(n => n.id).distance(l => l.distance).strength(l => l.strength))
    .force('collide', forceCollide(n => n.pattern ? 64 : WORK_R).strength(1).iterations(4))
    .stop().tick(500);

  // Works no pattern claims go on a small island of their own, off the south-east coast.
  let maxX = Math.max(...wNodes.map(n => n.x)), maxY = Math.max(...wNodes.map(n => n.y));
  const looseNodes = loose.map((w, i) => { const a = i * 2.39996, d = WORK_R * 1.45 * Math.sqrt(i + .5); return { id: w.id, x: maxX - 40 + Math.cos(a) * d, y: maxY + 240 + Math.sin(a) * d }; });

  // ---- 3. Shift everything into positive coordinates with sea around it.
  const all = [...pNodes, ...wNodes, ...looseNodes];
  const minX = Math.min(...all.map(n => n.x)) - MARGIN, minY = Math.min(...all.map(n => n.y)) - MARGIN;
  for (const n of all) { n.x -= minX; n.y -= minY; }
  const width = Math.ceil((Math.max(...all.map(n => n.x)) + MARGIN) / STEP) * STEP, height = Math.ceil((Math.max(...all.map(n => n.y)) + MARGIN) / STEP) * STEP;
  const nx = width / STEP, ny = height / STEP;

  // ---- 4. Terrain: every work and pattern raises the ground around it.
  const splat = (field, x, y, sigma, amount) => {
    const cx = x / STEP, cy = y / STEP, s = sigma / STEP, reach = Math.ceil(s * 3);
    for (let j = Math.max(0, Math.floor(cy - reach)); j <= Math.min(ny - 1, cy + reach); j++)
      for (let i = Math.max(0, Math.floor(cx - reach)); i <= Math.min(nx - 1, cx + reach); i++)
        field[j * nx + i] += amount * Math.exp(-((i - cx) ** 2 + (j - cy) ** 2) / (2 * s * s));
  };
  const ground = new Float64Array(nx * ny);
  for (const n of [...wNodes, ...looseNodes]) splat(ground, n.x, n.y, 58, 1);
  for (const n of pNodes) splat(ground, n.x, n.y, 80, 1.6);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const wobble = .62 + .5 * noise(i / 21, j / 21, 11) + .26 * noise(i / 6.5, j / 6.5, 12) + .1 * noise(i / 2.4, j / 2.4, 13);
    ground[j * nx + i] *= wobble;
  }
  blur2({ data: ground, width: nx, height: ny }, 1.2);
  const peak = ground.reduce((a, b) => Math.max(a, b), 0);
  const COAST = .5;
  const ringArea = ring => { let a = 0; for (let i = 0, n = ring.length; i < n; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % n]; a += x1 * y2 - x2 * y1; } return Math.abs(a / 2); };
  const trace = (field, level, minArea = 0) => contours().size([nx, ny]).thresholds([level])(field)[0].coordinates
    .filter(poly => ringArea(poly[0]) * STEP * STEP > minArea)
    .map(poly => poly.filter((ring, i) => i === 0 || ringArea(ring) * STEP * STEP > 600).map(ring => ring.map(([x, y]) => [Math.round(x * STEP * 10) / 10, Math.round(y * STEP * 10) / 10])));
  const land = trace(ground, COAST, 3500);
  const rings = [.72, .5, .33].map(f => trace(ground, COAST * f, 3500));
  const hills = [];
  for (let level = COAST * 2.3; level < peak * .94; level *= 1.42) hills.push(trace(ground, level, 900));

  // ---- 5. Territories: each area owns the ground where its works outweigh every other area's.
  const areaOf = new Map(patterns.map(p => [p.id, p.area]));
  const fields = new Map(areas.map(a => [a.id, new Float64Array(nx * ny)]));
  const wAt = new Map([...wNodes, ...looseNodes].map(n => [n.id, n]));
  for (const w of works) {
    const n = wAt.get(w.id), total = w.patterns.reduce((t, p) => t + p[1], 0);
    for (const [p, s] of w.patterns) splat(fields.get(areaOf.get(p)), n.x, n.y, 95, s / total);
  }
  for (const p of patterns) splat(fields.get(p.area), pAt.get(p.id).x, pAt.get(p.id).y, 110, 1.2);
  const territories = {};
  for (const a of areas) {
    const mine = fields.get(a.id), lead = new Float64Array(nx * ny);
    for (let k = 0; k < lead.length; k++) { let other = 0; for (const [id, f] of fields) if (id !== a.id && f[k] > other) other = f[k]; lead[k] = mine[k] - other; }
    blur2({ data: lead, width: nx, height: ny }, 1);
    territories[a.id] = trace(lead, 1e-6, 2500);
  }
  // Where each area's name goes: the middle of its patterns, weighted by how much work each holds.
  const areaSpots = {};
  for (const a of areas) {
    let x = 0, y = 0, t = 0;
    for (const p of patterns) if (p.area === a.id) { const n = pAt.get(p.id), c = count.get(p.id) + 1; x += n.x * c; y += n.y * c; t += c; }
    if (t) areaSpots[a.id] = [Math.round(x / t), Math.round(y / t)];
  }
  let mx = 0, my = 0, mt = 0;
  for (const n of pNodes) { const c = count.get(n.id) + 1; mx += n.x * c; my += n.y * c; mt += c; }
  mx /= mt; my /= mt;
  const reach = Math.max(...pNodes.map(n => Math.hypot(n.x - mx, n.y - my)));
  const tint = Object.fromEntries(pNodes.map(n => [n.id, [Math.round((Math.atan2(n.y - my, n.x - mx) * 180 / Math.PI + 360 + 20) % 360), Math.round(Math.hypot(n.x - mx, n.y - my) / reach * 100) / 100]]));
  const round = n => [Math.round(n.x * 10) / 10, Math.round(n.y * 10) / 10];
  return {
    width, height, land, rings, hills, territories, areas: areaSpots, tint,
    patterns: Object.fromEntries(pNodes.map(n => [n.id, round(n)])),
    works: Object.fromEntries([...wNodes, ...looseNodes].map(n => [n.id, round(n)])),
    loose: looseNodes.length ? [Math.round(looseNodes[0].x), Math.round(looseNodes[0].y)] : null,
  };
}
