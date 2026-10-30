// The 2D board compositor; tools/map/illustrate.mjs calls window.paint(options) and saves the PNG.
// The board is a flat, hand-painted layer stack in the style of the reference maps (reference-samples/):
//   guide  a colour-coded plan of the real valley (hills, woods, lakes, roads, the route, landmark plots), the
//          composition an image model paints the base map from (art-src/board2d/base.png);
//   board  that painted base, then our own layers on top: the route path and its stone seats, the real landmarks
//          painted from photographs, the title scroll, the compass, a sheet of old paper.
// Everything is placed in board units (0..1000 across, as data/board-geo.json) through one transform, so a crop
// or a quick half-scale look is the same picture. Sizes written as px(n) are full-resolution pixels at 3200 across.
import { INK, DAY, NIGHT, FONTS } from './style.js';

const BASE = 'http://ill.local/';
const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = BASE + src; });
const loadJSON = (p) => fetch(BASE + p).then((r) => (r.ok ? r.json() : null));

function rng(seed) { let s = (Math.imul(seed | 0, 2654435761) >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function noise1(seed) {
  const r = rng(seed), v = Float32Array.from({ length: 1024 }, r);
  return (t) => { const i = Math.floor(t), f = t - i, w = f * f * (3 - 2 * f); return v[i & 1023] * (1 - w) + v[(i + 1) & 1023] * w; };
}
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// ---------------------------------------------------------------- polylines
function arclen(p) { const s = [0]; for (let i = 1; i < p.length; i++) s.push(s[i - 1] + dist(p[i], p[i - 1])); return s; }
function at(p, S, s) {
  let i = 1; while (i < p.length - 1 && S[i] < s) i++;
  const t = clamp((s - S[i - 1]) / ((S[i] - S[i - 1]) || 1));
  return [lerp(p[i - 1][0], p[i][0], t), lerp(p[i - 1][1], p[i][1], t), Math.atan2(p[i][1] - p[i - 1][1], p[i][0] - p[i - 1][0])];
}
function resample(p, step) {
  const S = arclen(p), L = S[S.length - 1], n = Math.max(1, Math.round(L / step)), out = [];
  for (let k = 0; k <= n; k++) { const q = at(p, S, (L * k) / n); out.push([q[0], q[1]]); }
  return out;
}
// A hand-drawn line: resampled, then pushed along its normal by smooth noise (amplitude and wavelength in units).
function wobble(p, amp, wave, seed) {
  if (p.length < 2 || amp <= 0) return p;
  const q = resample(p, Math.max(0.8, wave / 6)), n = noise1(seed), S = arclen(q);
  return q.map((pt, i) => {
    const a = q[Math.max(0, i - 1)], b = q[Math.min(q.length - 1, i + 1)], L = dist(a, b) || 1;
    const d = (n(S[i] / wave) - 0.5) * 2 * amp;
    return [pt[0] - ((b[1] - a[1]) / L) * d, pt[1] + ((b[0] - a[0]) / L) * d];
  });
}
function trace(g, p, close = false) { g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath(); }
function path2d(p, close = true) { const P = new Path2D(); p.forEach(([x, y], i) => (i ? P.lineTo(x, y) : P.moveTo(x, y))); if (close) P.closePath(); return P; }

// ---------------------------------------------------------------- the landmarks: what stands where, and how big
// Each real building is painted from photographs (art-src/landmarks.json, art-src/photo-refs/) and stands on its
// true footprint (lm, from OSM) or research anchor (site). Sizes are larger than life, as on the reference maps:
// k x the footprint's width on the board, or a fixed width wU in board units. aspect is the height/width used to
// reserve room in the guide before a painting exists.
const ROWN = ['Superior', 'Hale', 'Maurice', 'Fordyce', 'Quapaw', 'Ozark', 'Buckstaff', 'Lamar', 'Administration'];
const ROW_K = 1.6, ROW_OVERLAP = 0.22;
export const LANDMARKS = [
  ...ROWN.map((n) => ({ file: n.toLowerCase(), lm: n, row: true, aspect: 0.62 })),
  { file: 'arlington', lm: 'Arlington', k: 2.8, aspect: 0.75 }, { file: 'tower', lm: 'Mountain Tower', wU: 50, aspect: 1.5 },
  { file: 'army-navy', lm: 'Army-Navy', k: 1.45, aspect: 0.6 }, { file: 'medical-arts', lm: 'Medical Arts', k: 3.6, aspect: 1.7 },
  { file: 'southern-club', lm: 'Tussaud', k: 3.4, aspect: 0.9 },
  { file: 'malco', site: 'malco', wU: 44, aspect: 0.8 }, { file: 'mountainaire', site: 'mountainaire', wU: 64, aspect: 0.7 },
  { file: 'oaklawn', site: 'oaklawnGrandstand', wU: 104, aspect: 0.45 }, { file: 'happy-hollow', site: 'happyHollow', wU: 62, aspect: 0.6 },
  { file: 'ballpark', site: 'whittingtonPark', wU: 82, aspect: 0.55 }, { file: 'blakely-dam', site: 'blakelyDam', wU: 76, aspect: 0.45 },
  { file: 'anthony-chapel', site: 'garvanGardens', wU: 40, aspect: 1.1 },
];
// Where each landmark stands: the Row's bathhouses re-spaced along the Row only as far as needed (neighbours may
// overlap by ROW_OVERLAP of the narrower one, like one continuous street front) and set back behind the walk's
// spaces; the rest on their footprints, or nudged clear of the spaces when they stand on a research anchor.
function layoutLandmarks(I, nodes, rad, dims) {
  const SQ = I.squash, out = [], errors = [], report = [];
  const rowL = ROWN.map((n) => ({ n, L: I.landmarks[n] })).filter((r) => r.L).sort((a, b) => a.L.foot[0] - b.L.foot[0]);
  const c = rowL.map((r) => r.L.foot[0]), w = rowL.map((r) => r.L.width * ROW_K);
  for (let it = 0; it < 300; it++) for (let k = 1; k < c.length; k++) {
    const need = (w[k - 1] + w[k]) / 2 - Math.min(w[k - 1], w[k]) * ROW_OVERLAP - (c[k] - c[k - 1]);
    if (need > 0) { c[k - 1] -= need / 2; c[k] += need / 2; }
  }
  const rowX = {}, rowW = {}; rowL.forEach((r, k) => { rowX[r.n] = c[k]; rowW[r.n] = w[k]; });
  const shift = Math.max(0, ...rowL.map((r) => Math.abs(rowX[r.n] - r.L.foot[0])));
  report.push(`Row re-spaced: largest shift ${shift.toFixed(1)} u`);
  if (shift > 18) errors.push(`a bathhouse moved ${shift.toFixed(1)} u from its true centre`);
  for (const sp of LANDMARKS) {
    const L0 = sp.lm ? I.landmarks[sp.lm] : null;
    let foot = L0 ? [...L0.foot] : I.sites[sp.site] ? [...I.sites[sp.site]] : null;
    if (!foot) { errors.push(`landmark ${sp.file}: no anchor`); continue; }
    const aspect = dims[sp.file] || sp.aspect;
    if (sp.row) foot[0] = rowX[sp.lm];
    const wd = sp.row ? rowW[sp.lm] : sp.wU || L0.width * sp.k, h = wd * aspect;
    // anything but the Row steps to the nearest spot where no space covers it (the tower stands at the trails' end)
    if (!sp.row && sp.lm !== 'Mountain Tower') {
      const f0 = foot; foot = clearSpot(foot, wd, h, nodes, rad, out, 10);
      const moved = dist(f0, foot); if (moved > 1) report.push(`landmark ${sp.file}: stepped ${moved.toFixed(0)} u clear of the spaces`);
      if (moved > 95) errors.push(`landmark ${sp.file} had to move ${moved.toFixed(0)} u to clear the spaces`);
    }
    if (sp.row) {   // the walk's spaces are on the Row's front lawn: the building's base sits just behind them
      let setback = 0;
      for (const n of nodes) if (Math.abs(n.x - foot[0]) < wd / 2 + rad(n) * 0.6 && n.y - rad(n) * SQ - 2.5 < foot[1] && n.y > foot[1] - 4 && n.type !== 'trail')
        setback = Math.max(setback, foot[1] - (n.y - rad(n) * SQ - 2.5));
      foot = [foot[0], foot[1] - setback];
      if (setback > 22) errors.push(`landmark ${sp.file}: set back ${setback.toFixed(1)} u behind its true front`);
    }
    out.push({ ...sp, foot, w: wd, h });
  }
  const order = out.filter((s) => s.row).sort((a, b) => a.foot[0] - b.foot[0]).map((s) => s.lm);
  if (order.join() !== ROWN.filter((n) => order.includes(n)).join()) errors.push(`Bathhouse Row out of order: ${order.join(', ')}`);
  return { placed: out, errors, report };
}
// The nearest spot to `foot` where a picture of w x h (standing on its foot) clears every space and picture.
function clearSpot(foot, w, h, nodes, rad, placed, rings = 5) {
  let best = foot, bs = -1e9;
  for (let ring = 0; ring <= rings; ring++) for (let k = 0; k < (ring ? 16 : 1); k++) {
    const a = (k * Math.PI) / 8, q = [foot[0] + Math.cos(a) * ring * 9, foot[1] + Math.sin(a) * ring * 9];
    let c = 1e9;
    for (const n of nodes) c = Math.min(c, Math.max(Math.abs(n.x - q[0]) - w / 2, n.y > q[1] ? n.y - q[1] : q[1] - h - n.y, 0) - rad(n));
    for (const s of placed) c = Math.min(c, Math.max(Math.abs(s.foot[0] - q[0]) - (s.w + w) / 2, Math.abs(s.foot[1] - s.h / 2 - (q[1] - h / 2)) - (s.h + h) / 2, 0));
    const sc = Math.min(c, 4) * 3 - ring * 1.2;
    if (sc > bs) { bs = sc; best = q; }
  }
  return best;
}

// ---------------------------------------------------------------- the painting
window.paint = async (o) => {
  const t0 = performance.now();
  await Promise.all(['400 40px Kalam', '700 40px Kalam', '40px Rye'].map((f) => document.fonts.load(f)));
  const I = await loadJSON('art-src/geo/illustrate.json');
  const K = I.render.w / 1000;
  const px = (n) => n / K;
  const nodes = I.route.nodes, edges = I.route.edges, SQ = I.squash, HZ = I.horizon;
  const RAD = { landmark: 19, start: 16.5, trail: 7, tower: 0 };
  const rad = (n) => (n.type in RAD ? RAD[n.type] : 15.2);
  const report = [], errors = [];
  const dims = {};
  for (const sp of LANDMARKS) { const im = await sprite(sp.file); if (im) dims[sp.file] = im.height / im.width; }
  const lay = layoutLandmarks(I, nodes, rad, dims);
  report.push(...lay.report); errors.push(...lay.errors);
  if (o.mode === 'guide') return guide(I, o, lay.placed, report, errors, t0);
  if (o.mode === 'register') return register(I, o, report, errors, t0);

  // ---------------- the board
  const SC = o.scale || 1;
  const [cx, cy, cw, ch] = o.crop || [0, 0, 1000, I.h];
  const W = Math.round(cw * K * SC), H = Math.round(ch * K * SC);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.setTransform(K * SC, 0, 0, K * SC, -cx * K * SC, -cy * K * SC);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const P = DAY, N = o.night ? NIGHT : null;

  // 1. the painted base map: the image model's painting of the guide, which spans the board plus a margin each side
  const base = (await loadImg(`art-src/board2d/${o.base || 'base'}-aligned.png`)) || (await loadImg(`art-src/board2d/${o.base || 'base'}.png`));
  if (!base) { errors.push('no painted base yet: run the guide, paint it, save art-src/board2d/base.png'); }
  else {
    const PX = guideMargin(I);
    g.imageSmoothingQuality = 'high'; g.drawImage(base, -PX, 0, 1000 + 2 * PX, I.h);
  }

  // 2. the route: a cream path with a sepia edge, and a stone seat under every space (the game draws the medallions)
  const routeE = edges.map((e, k) => ({ ...e, p: wobble(e.pts, px(0.5), px(28), 1700 + k) }));
  const band = (e) => (e.trail ? 4.6 : 8.4);
  g.save(); g.globalAlpha = 0.32; g.strokeStyle = '#2a1c0c';
  for (const e of routeE) { g.lineWidth = band(e) + px(10); trace(g, e.p.map(([x, y]) => [x + 0.4, y + 1.4])); g.stroke(); }
  g.restore();
  for (const e of routeE) { g.strokeStyle = P.pathEdge; g.lineWidth = band(e) + px(5); trace(g, e.p); g.stroke(); }
  for (const e of routeE) { g.strokeStyle = e.trail ? '#e6d3a8' : P.path; g.lineWidth = band(e); trace(g, e.p); g.stroke(); }
  for (const e of routeE) { if (e.trail) continue; g.strokeStyle = 'rgba(150,115,70,0.35)'; g.lineWidth = px(1.6); g.setLineDash([px(2), px(9)]); trace(g, e.p); g.stroke(); }
  g.setLineDash([]);
  for (const n of nodes) {
    if (n.type === 'tower') continue;
    const r = rad(n) + (n.type === 'trail' ? 2.2 : 3.2);
    g.fillStyle = 'rgba(40,30,15,0.3)'; g.beginPath(); g.ellipse(n.x + 0.6, n.y + 1.6, r + 0.6, (r + 0.6) * SQ, 0, 0, 7); g.fill();
    g.fillStyle = P.seat; g.beginPath(); g.ellipse(n.x, n.y + 0.6, r, r * SQ, 0, 0, 7); g.fill();
    g.strokeStyle = P.pathEdge; g.lineWidth = px(3.4); g.stroke();
  }

  // 3. the landmarks, back to front
  const placed = [];
  for (const s of lay.placed) { const im = await sprite(s.file); if (!im) { report.push(`landmark ${s.file}: not painted yet`); continue; } placed.push({ ...s, im }); }
  placed.sort((a, b) => a.foot[1] - b.foot[1]);
  for (const s of placed) drawSprite(g, s, px);
  const geoPatch = { baked: ['mountain', 'compass', 'street'] };
  const tw_ = placed.find((s) => s.file === 'tower');
  if (tw_) geoPatch.tower = { base: tw_.foot, top: [+tw_.foot[0].toFixed(2), +(tw_.foot[1] - tw_.h * 0.97).toFixed(2)] };
  const steam = placed.filter((s) => s.row && s.lm !== 'Administration').map((s) => [+s.foot[0].toFixed(2), +(s.foot[1] - s.h * 0.8).toFixed(2)]);
  if (steam.length) geoPatch.steam = steam;

  // 4. title scroll (in the sky) and compass rose (a lower corner), clear of every space, path and landmark
  const free = (x, y, rw, rh) => {
    let c = 1e9;
    for (const n of nodes) c = Math.min(c, Math.max(Math.abs(n.x - x) - rw, Math.abs(n.y - y) - rh, 0) - rad(n));
    for (const e of routeE) for (const q of e.p) c = Math.min(c, Math.max(Math.abs(q[0] - x) - rw, Math.abs(q[1] - y) - rh, 0) - 6);
    for (const s of placed) c = Math.min(c, Math.max(Math.abs(s.foot[0] - x) - rw - s.w / 2, Math.abs(s.foot[1] - s.h / 2 - y) - rh - s.h / 2, 0));
    for (const L of I.labels) if (L.at && (L.kind === 'district' || L.kind === 'vignette')) c = Math.min(c, Math.max(Math.abs(L.at[0] - x) - rw - 60, Math.abs(L.at[1] - y) - rh - 14, 0));
    return c;
  };
  const best = (rw, rh, cands) => cands.map(([x, y]) => ({ x, y, c: free(x, y, rw, rh) })).sort((a, b) => b.c - a.c)[0];
  const TW = 178, TH = 54;
  const titleSpots = []; for (let x = TW + 20; x <= 1000 - TW - 20; x += 10) titleSpots.push([x, TH + 14]);
  const title = best(TW, TH, titleSpots);
  drawTitle(g, title.x, title.y, px);
  const compSpots = []; for (let x = 50; x <= 950; x += 10) compSpots.push([x, I.h - 50]); for (let y = HZ + 60; y <= I.h - 50; y += 10) compSpots.push([50, y], [950, y]);
  const comp = best(38, 38, compSpots);
  drawCompass(g, comp.x, comp.y, 30, I.north, px);
  placed.push({ foot: [comp.x, comp.y + 38], w: 76, h: 76 }, { foot: [title.x, title.y + TH], w: TW * 2, h: TH * 2 });
  g.font = `700 7.6px ${FONTS.hand}`;   // room for the two credit lines render.js draws (CREDITS there)
  const CW = Math.max(...['Downtown true to layout · directions true · far places moved closer · landmarks drawn larger than life',
    'Map data © OpenStreetMap contributors, USGS, US Census · landmarks painted from public-domain photographs'].map((t) => g.measureText(t).width)) + 14;
  const credSpots = []; for (let x = 16 + CW / 2; x <= 1000 - 16 - CW / 2; x += 10) credSpots.push([x, I.h - 21]);
  for (let y = I.h - 21; y >= I.h - 120; y -= 10) credSpots.push([1000 - 16 - CW / 2, y], [16 + CW / 2, y]);
  const cred = best(CW / 2, 12, credSpots);
  geoPatch.slots = { compass: [+comp.x.toFixed(1), +comp.y.toFixed(1)], credits: [+cred.x.toFixed(1), +cred.y.toFixed(1)] };
  report.push(`title at ${title.x.toFixed(0)},${title.y.toFixed(0)}; compass at ${comp.x.toFixed(0)},${comp.y.toFixed(0)} (clear ${comp.c.toFixed(1)})`);
  geoPatch.ambient = ambient(I, title, TW, TH, report);

  // 5. dusk for the dark theme: the painting graded cool, then lamplight, lit windows, stars and the tower's beacon
  if (N) {
    g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = N.grade; g.fillRect(-10, -10, 1020, I.h + 20); g.restore();
    g.save(); g.globalCompositeOperation = 'screen';
    const r = rng(37);
    for (let k = 0; k < 140; k++) { const x = r() * 1000, y = r() * (HZ - 40); g.fillStyle = `rgba(255,250,225,${0.35 + r() * 0.5})`; g.beginPath(); g.arc(x, y, 0.4 + r() * 0.8, 0, 7); g.fill(); }
    const glow = (x, y, rr, a, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, col + a + ')'); gr.addColorStop(1, col + '0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); };
    // lit windows: the painting's own dark panes (its darkest, bluest pixels) glow warm, so each landmark keeps its
    // detail; then a little lamplight pools at its door
    for (const s of placed) {
      if (!s.im) continue;
      const c = document.createElement('canvas'); c.width = s.im.width; c.height = s.im.height; const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(s.im, 0, 0); const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11, pane = d[i + 3] > 200 && lum < 95 && d[i + 2] >= d[i] - 10;
        if (pane) { d[i] = 255; d[i + 1] = 196; d[i + 2] = 110; d[i + 3] = 170; } else d[i + 3] = 0;
      }
      x.putImageData(id, 0, 0);
      g.drawImage(c, s.foot[0] - s.w / 2, s.foot[1] - s.h, s.w, s.h);
      glow(s.foot[0], s.foot[1], s.w * 0.3, 0.22, N.lamp);
    }
    for (const e of routeE) { const S = arclen(e.p); for (let s = 6; s < S.at(-1); s += 26) { const q = at(e.p, S, s); glow(q[0], q[1], 6, 0.35, N.lamp); } }
    if (tw_) glow(tw_.foot[0], tw_.foot[1] - tw_.h * 0.97, 14, 0.9, N.beacon);
    g.restore();
  }

  // 6. one sheet of old paper over everything: grain, fibres, darker edges; then the frame
  paper(g, W, H, I, !!N);
  g.strokeStyle = INK; g.lineWidth = px(8); g.strokeRect(4, 4, 992, I.h - 8);
  g.strokeStyle = 'rgba(58,42,26,0.6)'; g.lineWidth = px(2.4); g.strokeRect(10, 10, 980, I.h - 20);

  if (o.discs) previewSpaces(g, I, nodes, rad, px, await loadJSON('art-src/geo/graph.json'));
  const out = { w: W, h: H, ms: Math.round(performance.now() - t0), report, errors, geoPatch };
  out.png = cv.toDataURL('image/png').split(',')[1];
  return out;
};

// ---------------------------------------------------------------- where the game's ambient life goes (render.js drawAmbient)
// The lakes (for glints), a boat on each of the three big lakes, the lane round Oaklawn's oval for a racehorse,
// Central Avenue for a streetcar, the horizon and the title scroll (clouds fade behind it).
function ambient(I, title, TW, TH, report) {
  const area = (p) => Math.abs(p.reduce((a, q, i) => { const r = p[(i + 1) % p.length]; return a + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
  const box = (p) => p.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [1e9, 1e9, -1e9, -1e9]);
  const r1 = (v) => Math.round(v * 10) / 10;
  const lakes = I.lakes.filter((L) => L.pts.length > 3).map((L) => ({ pts: resample(L.pts, 3).map(([x, y]) => [r1(x), r1(y)]), a: area(L.pts) }))
    .filter((L) => L.a > 120 && L.pts.some(([x, y]) => y > I.horizon && x > 0 && x < 1000)).sort((a, b) => b.a - a.a);
  const inside = (p, x, y) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
  const boats = [];
  lakes.slice(0, 3).forEach((L, k) => {   // the most open water on each lake: the point farthest from every shore
    const b = box(L.pts); let bestP = null, bd = 0;
    for (let x = b[0]; x <= b[2]; x += 1.5) for (let y = b[1]; y <= b[3]; y += 1.5) {
      if (!inside(L.pts, x, y)) continue; const d = Math.min(...L.pts.map((q) => dist(q, [x, y])));
      if (d > bd) { bd = d; bestP = [x, y]; }
    }
    if (bestP && bd > 4) boats.push({ x: r1(bestP[0]), y: r1(bestP[1]), r: r1(Math.max(0, bd - 7)), w: k === 1 ? 11 : 12, kind: k === 1 ? 'fishing-boat' : 'sailboat' });
  });
  let track = null;
  if (I.oaklawnTrack.length === 2) {
    const o = I.oaklawnTrack[0], c = o.reduce((a, q) => [a[0] + q[0] / o.length, a[1] + q[1] / o.length], [0, 0]);
    track = resample(o.map(([x, y]) => [c[0] + (x - c[0]) * 0.93, c[1] + (y - c[1]) * 0.93]), 2).map(([x, y]) => [r1(x), r1(y)]);
  }
  const central = I.central ? resample(I.central.pts.filter(([x, y]) => x > 30 && x < 970 && y > I.horizon), 3).map(([x, y]) => [r1(x), r1(y)]) : null;
  report.push(`ambient: ${lakes.length} lakes, ${boats.length} boats, track ${!!track}, streetcar ${!!central}`);
  return { horizon: I.horizon, title: [title.x - TW, title.y - TH, title.x + TW, title.y + TH].map(r1), lakes: lakes.map((L) => ({ pts: L.pts, box: box(L.pts).map(r1), n: Math.round(L.a / 40) })),
    boats, track, central };
}

// ---------------------------------------------------------------- the guide for the image model
// The guide covers the board plus a margin each side, so it fills the model's 3:2 canvas (1536 x 1024).
const guideMargin = (I) => (1.5 * I.h - 1000) / 2;
async function guide(I, o, placed, report, errors, t0) {
  const PX = guideMargin(I), W = 1536, H = 1024, k = H / I.h;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.setTransform(k, 0, 0, k, PX * k, 0); g.lineCap = 'round'; g.lineJoin = 'round';
  const HZ = I.horizon;
  const C = { sky: '#cde3ea', far: ['#a9c4c6', '#8fb3ae', '#78a38f'], meadow: '#b8d47c', forest: '#3f7a3a', town: '#e2cfa2', plot: '#cfe39a',
    water: '#3d8cc8', road: '#f1e3c1', edge: '#8a6a40', path: '#f7ead0', bld: '#b5563a', track: '#c79660', infield: '#9fcd6a' };
  // ground: meadow, then woods and town from the land-cover mask, shaded by the relief so the hills read
  const [relief, cover] = await Promise.all(['relief', 'cover'].map((n) => loadImg(`art-src/blender/passes/${n}.png`)));
  g.fillStyle = C.forest; g.fillRect(-PX - 10, -10, 1000 + 2 * PX + 20, I.h + 20);
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const t = tmp.getContext('2d', { willReadFrequently: true });
  t.setTransform(k, 0, 0, k, PX * k, 0); t.filter = 'blur(3px)'; t.drawImage(cover, 0, 0, 1000, I.h);
  const cov = t.getImageData(0, 0, W, H).data;
  t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(0, 0, W, H); t.setTransform(k, 0, 0, k, PX * k, 0); t.filter = 'blur(2px)'; t.drawImage(relief, 0, 0, 1000, I.h);
  const rel = t.getImageData(0, 0, W, H).data;
  const id = g.getImageData(0, 0, W, H), d = id.data;
  const hexc = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mead = hexc(C.meadow), fo = hexc(C.forest), tn = hexc(C.town);
  for (let i = 0; i < d.length; i += 4) {
    if (cov[i + 3] < 10) continue;   // the margins stay woods
    const f = clamp((cov[i] / 255 - 0.3) / 0.35), u = cov[i + 1] / 255;
    let c = mead.map((v, j) => lerp(v, fo[j], f)); c = c.map((v, j) => lerp(v, tn[j], u * 0.95));
    const sh = clamp(rel[i] / 214, 0.55, 1.15);
    d[i] = c[0] * sh; d[i + 1] = c[1] * sh; d[i + 2] = c[2] * sh;
  }
  g.putImageData(id, 0, 0);
  // the Oaklawn oval, lakes, creeks, roads, the ordinary buildings
  if (I.oaklawnTrack.length === 2) { g.fillStyle = C.track; g.fill(path2d(I.oaklawnTrack[0])); g.fillStyle = C.infield; g.fill(path2d(I.oaklawnTrack[1])); }
  g.fillStyle = C.water; for (const L of I.lakes) if (L.pts.length > 3) g.fill(path2d(L.pts));
  g.strokeStyle = C.water; g.lineWidth = 3; for (const c of I.creeks) { trace(g, c.pts); g.stroke(); }
  const roads = I.roads.filter((r) => r.cls !== 'local' || r.w >= 2.3);
  for (const [w, col] of [[6.5, C.edge], [4.4, C.road]]) { g.strokeStyle = col; for (const r of roads) { g.lineWidth = r.cls === 'local' ? w * 0.55 : w; trace(g, r.pts); g.stroke(); } }
  if (I.central) for (const [w, col] of [[I.central.w + 2, C.edge], [I.central.w, C.road]]) { g.strokeStyle = col; g.lineWidth = w; trace(g, I.central.pts); g.stroke(); }
  const bld = await loadImg('art-src/blender/passes/buildings.png');
  if (bld) { const b = document.createElement('canvas'); b.width = W; b.height = H; const bx = b.getContext('2d');
    bx.setTransform(k, 0, 0, k, PX * k, 0); bx.drawImage(bld, 0, 0, 1000, I.h); bx.setTransform(1, 0, 0, 1, 0, 0);
    bx.globalCompositeOperation = 'source-in'; bx.fillStyle = C.bld; bx.fillRect(0, 0, W, H); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(b, 0, 0); g.restore(); }
  // the route: a wide cream band (the painting keeps it clear; the board draws the real path on top)
  for (const [w, col] of [[16, C.edge], [13, C.path]]) { g.strokeStyle = col; for (const e of I.route.edges) { g.lineWidth = e.trail ? w * 0.6 : w; trace(g, e.pts); g.stroke(); } }
  for (const n of I.route.nodes) { if (n.type === 'tower') continue; g.fillStyle = C.path; g.beginPath(); g.ellipse(n.x, n.y, 21, 21 * I.squash, 0, 0, 7); g.fill(); }
  // the landmark plots: lawn where the painted buildings will stand (the painting leaves them open)
  g.fillStyle = C.plot;
  for (const s of placed) { g.beginPath(); g.roundRect(s.foot[0] - s.w / 2, s.foot[1] - s.h, s.w, s.h + 3, 4); g.fill(); }
  if (I.oaklawnTrack.length === 2) { g.fillStyle = C.track; g.fill(path2d(I.oaklawnTrack[0])); g.fillStyle = C.infield; g.fill(path2d(I.oaklawnTrack[1])); }
  // the horizon: sky and three bands of distant ridges, running east to west
  g.fillStyle = C.sky; g.fillRect(-PX - 10, -10, 1000 + 2 * PX + 20, HZ);
  C.far.forEach((col, j) => {
    const n = noise1(700 + j), base = HZ - 50 + j * 16, amp = 9 + j * 4;
    g.fillStyle = col; g.beginPath(); g.moveTo(-PX - 10, HZ + 6);
    for (let x = -PX - 10; x <= 1000 + PX + 10; x += 6) g.lineTo(x, base - (n(x / (70 - j * 9)) * 0.7 + n(x / 23 + 50) * 0.3) * amp * 2);
    g.lineTo(1000 + PX + 10, HZ + 6); g.closePath(); g.fill();
  });
  const out = { w: W, h: H, ms: Math.round(performance.now() - t0), report, errors };
  out.png = cv.toDataURL('image/png').split(',')[1];
  return out;
}

// ---------------------------------------------------------------- registering the painting to the guide
// An image model paints the guide's composition faithfully but not exactly: features drift by up to a few percent.
// The route, the spaces, the track and the landmarks are drawn from data, so the painting is warped back onto the
// guide: a global affine fit, then a smooth field of local offsets, both found by matching the route's centreline
// to the painting's cream path and the lakes to its water (chamfer distance).
async function register(I, o, report, errors, t0) {
  const PX = guideMargin(I), W = 1536, H = 1024, k = H / I.h;
  const G = (x, y) => [(x + PX) * k, y * k];
  const im = await loadImg(`art-src/board2d/${o.base || 'base'}.png`);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(im, 0, 0, W, H); const src = x.getImageData(0, 0, W, H).data;
  // masks of the painting: cream path and road, and open water
  const cream = new Uint8Array(W * H), water = new Uint8Array(W * H);
  for (let i = 0, j = 0; i < W * H; i++, j += 4) {
    const r = src[j], gg = src[j + 1], b = src[j + 2];
    cream[i] = r > 205 && gg > 188 && b > 140 && r - b < 80 && r - gg < 32 ? 1 : 0;
    water[i] = b > r + 30 && b > gg + 5 && b > 110 ? 1 : 0;
  }
  const dt = (m) => {   // two-pass 3-4 chamfer distance to the nearest set pixel, in px
    const d = new Float32Array(W * H); for (let i = 0; i < W * H; i++) d[i] = m[i] ? 0 : 1e6;
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const i = y * W + xx; let v = d[i];
      if (xx > 0) v = Math.min(v, d[i - 1] + 3);
      if (y > 0) { v = Math.min(v, d[i - W] + 3); if (xx > 0) v = Math.min(v, d[i - W - 1] + 4); if (xx < W - 1) v = Math.min(v, d[i - W + 1] + 4); }
      d[i] = v;
    }
    for (let y = H - 1; y >= 0; y--) for (let xx = W - 1; xx >= 0; xx--) {
      const i = y * W + xx; let v = d[i];
      if (xx < W - 1) v = Math.min(v, d[i + 1] + 3);
      if (y < H - 1) { v = Math.min(v, d[i + W] + 3); if (xx < W - 1) v = Math.min(v, d[i + W + 1] + 4); if (xx > 0) v = Math.min(v, d[i + W - 1] + 4); }
      d[i] = v;
    }
    for (let i = 0; i < W * H; i++) d[i] /= 3;
    return d;
  };
  const DC = dt(cream), DW = dt(water);
  // the guide's points: the route's centreline (on the cream), and points well inside each lake (on the water)
  const pts = [];
  for (const e of I.route.edges) for (const q of resample(e.pts, 2.5)) pts.push({ p: G(...q), d: DC, w: e.trail ? 0.5 : 1 });
  const tst = document.createElement('canvas').getContext('2d');
  for (const L of I.lakes) {
    if (L.pts.length < 4) continue;
    const gp = L.pts.map((q) => G(...q)), P = path2d(gp), rr = rng(L.pts.length);
    const xs = gp.map((q) => q[0]), ys = gp.map((q) => q[1]);
    for (let n = 0, tries = 0; n < 60 && tries < 600; tries++) {
      const q = [lerp(Math.min(...xs), Math.max(...xs), rr()), lerp(Math.min(...ys), Math.max(...ys), rr())];
      if (q[1] < 190 || !tst.isPointInPath(P, ...q)) continue;
      if (![[6, 0], [-6, 0], [0, 6], [0, -6]].every(([a, b]) => tst.isPointInPath(P, q[0] + a, q[1] + b))) continue;
      pts.push({ p: q, d: DW, w: 0.8 }); n++;
    }
  }
  const look = (d, q) => { const xi = Math.round(q[0]), yi = Math.round(q[1]); return xi < 0 || yi < 0 || xi >= W || yi >= H ? 30 : Math.min(30, d[yi * W + xi]); };
  const cx = W / 2, cy = H / 2;
  const aff = (A, p) => [cx + A[0] * (p[0] - cx) + A[1] * (p[1] - cy) + A[2], cy + A[3] * (p[0] - cx) + A[4] * (p[1] - cy) + A[5]];
  const cost = (A, sel = pts, off = null) => {
    let s = 0, w = 0;
    for (const t of sel) { const q = aff(A, t.p); if (off) { q[0] += off[0]; q[1] += off[1]; } s += look(t.d, q) * t.w; w += t.w; }
    return s / w;
  };
  let A = [1, 0, 0, 0, 1, 0];
  report.push(`register: ${pts.length} points, cost before ${cost(A).toFixed(2)} px`);
  // coarse search over scale and shift, then a few rounds of coordinate descent on all six terms
  const coarse = pts.filter((_, i) => i % 4 === 0);
  let best = { c: cost(A, coarse), A };
  for (let sx = 0.94; sx <= 1.061; sx += 0.0125) for (let sy = 0.9; sy <= 1.061; sy += 0.0125)
    for (let tx = -40; tx <= 40; tx += 4) for (let ty = -50; ty <= 50; ty += 4) {
      const B = [sx, 0, tx, 0, sy, ty]; const cc = cost(B, coarse); if (cc < best.c) best = { c: cc, A: B };
    }
  A = best.A;
  const steps = [0.004, 0.004, 1, 0.004, 0.004, 1];
  for (let round = 0; round < 4; round++) for (let j = 0; j < 6; j++) for (const sgn of [1, -1]) {
    for (let it = 0; it < 12; it++) { const B = A.slice(); B[j] += (sgn * steps[j]) / (round + 1); if (cost(B) < cost(A)) A = B; else break; }
  }
  report.push(`register: affine ${A.map((v) => v.toFixed(3)).join(' ')}, cost ${cost(A).toFixed(2)} px`);
  // local offsets on a 12 x 8 grid, coarse then finer, each round smoothed with its neighbours
  const GX = 12, GY = 8, off = Array.from({ length: (GX + 1) * (GY + 1) }, () => [0, 0]);
  for (const R of [220, 140]) {
    const next = off.map((v) => v.slice());
    for (let j = 0; j <= GY; j++) for (let i = 0; i <= GX; i++) {
      const gx = (i / GX) * W, gy = (j / GY) * H;
      const sel = pts.filter((t) => Math.abs(t.p[0] - gx) < R && Math.abs(t.p[1] - gy) < R);
      if (sel.length < 20) continue;
      const o0 = off[j * (GX + 1) + i]; let bo = o0, bc = cost(A, sel, o0);
      for (let dx = -20; dx <= 20; dx += 2) for (let dy = -20; dy <= 20; dy += 2) {
        const oo = [o0[0] + dx, o0[1] + dy]; const cc = cost(A, sel, oo) + 0.004 * (dx * dx + dy * dy);
        if (cc < bc) { bc = cc; bo = oo; }
      }
      next[j * (GX + 1) + i] = bo;
    }
    for (let pass = 0; pass < 2; pass++) for (let j = 0; j <= GY; j++) for (let i = 0; i <= GX; i++) {
      let sx = 0, sy = 0, n = 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
        const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii > GX || jj > GY) continue;
        const v = next[jj * (GX + 1) + ii], w = a || b ? 1 : 2; sx += v[0] * w; sy += v[1] * w; n += w;
      }
      off[j * (GX + 1) + i] = [sx / n, sy / n];
    }
  }
  const field = (p) => {
    const fx = clamp(p[0] / W, 0, 1) * GX, fy = clamp(p[1] / H, 0, 1) * GY, i = Math.min(GX - 1, Math.floor(fx)), j = Math.min(GY - 1, Math.floor(fy)), u = fx - i, v = fy - j;
    const o00 = off[j * (GX + 1) + i], o10 = off[j * (GX + 1) + i + 1], o01 = off[(j + 1) * (GX + 1) + i], o11 = off[(j + 1) * (GX + 1) + i + 1];
    return [lerp(lerp(o00[0], o10[0], u), lerp(o01[0], o11[0], u), v), lerp(lerp(o00[1], o10[1], u), lerp(o01[1], o11[1], u), v)];
  };
  let s2 = 0, w2 = 0;
  for (const t of pts) { const q = aff(A, t.p), f = field(t.p); q[0] += f[0]; q[1] += f[1]; s2 += look(t.d, q) * t.w; w2 += t.w; }
  report.push(`register: with local offsets, cost ${(s2 / w2).toFixed(2)} px (largest offset ${Math.max(...off.map((v) => Math.hypot(...v))).toFixed(1)} px)`);
  // the warp: every guide pixel takes the painting's colour from where the fit says it went
  const out = new ImageData(W, H), d = out.data;
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const q = aff(A, [xx, y]), f = field([xx, y]);
    // past the painting's edge, mirror it back in (a clamp would smear the edge row into streaks)
    const refl = (v, n) => clamp(v < 0 ? -v : v > n - 1.001 ? 2 * (n - 1.001) - v : v, 0, n - 1.001);
    const sxp = refl(q[0] + f[0], W), syp = refl(q[1] + f[1], H);
    const x0 = Math.floor(sxp), y0 = Math.floor(syp), u = sxp - x0, v = syp - y0, i0 = (y0 * W + x0) * 4, j = (y * W + xx) * 4;
    for (let ch = 0; ch < 3; ch++) d[j + ch] = lerp(lerp(src[i0 + ch], src[i0 + 4 + ch], u), lerp(src[i0 + W * 4 + ch], src[i0 + W * 4 + 4 + ch], u), v);
    d[j + 3] = 255;
  }
  const oc = document.createElement('canvas'); oc.width = W; oc.height = H; oc.getContext('2d').putImageData(out, 0, 0);
  return { w: W, h: H, ms: Math.round(performance.now() - t0), report, errors, png: oc.toDataURL('image/png').split(',')[1] };
}

// ---------------------------------------------------------------- old paper over the finished board
function paper(g, W, H, I, night) {
  const TS = 256, tile = document.createElement('canvas'); tile.width = tile.height = TS; const t = tile.getContext('2d');
  const id = t.createImageData(TS, TS), r = rng(23);
  for (let i = 0; i < TS * TS; i++) { const v = 215 + r() * 40; id.data[i * 4] = v; id.data[i * 4 + 1] = v * 0.97; id.data[i * 4 + 2] = v * 0.9; id.data[i * 4 + 3] = 255; }
  t.putImageData(id, 0, 0);
  t.strokeStyle = 'rgba(150,120,80,0.18)'; t.lineWidth = 0.8;
  for (let k = 0; k < 60; k++) { const x = r() * TS, y = r() * TS, a = r() * 6.3, l = 6 + r() * 18; t.beginPath(); t.moveTo(x, y); t.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); t.stroke(); }
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply'; g.globalAlpha = night ? 0.12 : 0.22;
  g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(0, 0, W, H); g.restore();
  g.save(); g.globalCompositeOperation = 'multiply';
  const vg = g.createRadialGradient(500, I.h / 2, Math.min(500, I.h) * 0.7, 500, I.h / 2, 760);
  vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(1, night ? 'rgba(40,44,80,0.55)' : 'rgba(184,149,92,0.45)');
  g.fillStyle = vg; g.fillRect(-10, -10, 1020, I.h + 20); g.restore();
}

// a preview of the game's spaces (category medallions) for review sheets only; the game draws the real ones
function previewSpaces(g, I, nodes, rad, px, GR) {
  const COL = { row: '#0072B2', bridge: '#8C5A2B', central: '#C2410C', oaklawn: '#56B4E9', lakes: '#007A5A', ballfields: '#E69F00', hollow: '#5B4A8B', park: '#CC79A7' };
  nodes.forEach((n, i) => {
    if (n.type === 'tower') return; const gn = GR.nodes[i], r = rad(n), SQ = I.squash;
    g.fillStyle = 'rgba(40,30,15,0.3)'; g.beginPath(); g.ellipse(n.x + 0.6, n.y + 1.4, r, r * SQ, 0, 0, 7); g.fill();
    g.fillStyle = gn.type === 'cat' || gn.type === 'landmark' ? COL[gn.district] : gn.type === 'trail' ? '#6b5139' : '#fbf6ea';
    g.beginPath(); g.ellipse(n.x, n.y, r, r * SQ, 0, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = px(3.2); g.stroke();
    g.lineWidth = px(2.4); g.strokeStyle = '#fbf3dd'; g.beginPath(); g.ellipse(n.x, n.y, r - 2.4, (r - 2.4) * SQ, 0, 0, 7); g.stroke();
  });
}

// ---------------------------------------------------------------- sprites: keyed off their white ground and trimmed
const spriteCache = {};
async function sprite(name) {
  if (name in spriteCache) return spriteCache[name];
  const im = await loadImg(`art-src/sprites/${name}.png`);
  if (!im) return (spriteCache[name] = null);
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data, Wd = c.width, Hd = c.height;
  // flood-fill near-white from the border (as art-pack's keyWhite), then soften the alpha edge
  const lim = 255 - 26, seen = new Uint8Array(Wd * Hd), st = [];
  const white = (i) => p[i * 4] >= lim && p[i * 4 + 1] >= lim && p[i * 4 + 2] >= lim;
  for (let i = 0; i < Wd; i++) st.push(i, (Hd - 1) * Wd + i);
  for (let j = 0; j < Hd; j++) st.push(j * Wd, j * Wd + Wd - 1);
  while (st.length) {
    const i = st.pop(); if (seen[i] || !white(i)) continue; seen[i] = 1; p[i * 4 + 3] = 0;
    const xx = i % Wd, yy = (i / Wd) | 0;
    if (xx > 0) st.push(i - 1); if (xx < Wd - 1) st.push(i + 1); if (yy > 0) st.push(i - Wd); if (yy < Hd - 1) st.push(i + Wd);
  }
  for (let i = 0; i < Wd * Hd; i++) if (!seen[i]) {
    const xx = i % Wd, yy = (i / Wd) | 0;
    if ((xx > 0 && seen[i - 1]) || (xx < Wd - 1 && seen[i + 1]) || (yy > 0 && seen[i - Wd]) || (yy < Hd - 1 && seen[i + Wd])) p[i * 4 + 3] = 150;
  }
  let x0 = Wd, y0 = Hd, x1 = 0, y1 = 0;
  for (let i = 0; i < Wd * Hd; i++) if (p[i * 4 + 3] > 8) { const xx = i % Wd, yy = (i / Wd) | 0; x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy); }
  x.putImageData(d, 0, 0);
  const t = document.createElement('canvas'); t.width = x1 - x0 + 1; t.height = y1 - y0 + 1;
  t.getContext('2d').drawImage(c, -x0, -y0);
  return (spriteCache[name] = t);
}
function silhouette(im, color) {
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d');
  x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); return c;
}
function drawSprite(g, s, px) {
  const { foot: [fx, fy], w, h, im } = s;
  // cast shadow: the silhouette sheared away from the sun (up and a little left), then a soft contact shadow
  g.save(); g.transform(1, 0, 0.17, 0.42, fx, fy); g.globalAlpha = 0.22; g.filter = `blur(${px(3)}px)`;
  g.drawImage(silhouette(im, '#1c2a1e'), -w / 2, -h, w, h); g.restore();
  g.save(); g.fillStyle = 'rgba(40,32,18,0.3)'; g.beginPath(); g.ellipse(fx, fy - h * 0.01, w * 0.5, Math.max(1.2, w * 0.07), 0, 0, 7); g.fill(); g.restore();
  // a thin sepia ink edge all round, so a painted landmark carries the map's line weight
  const ink = silhouette(im, INK), e = px(2);
  for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; g.drawImage(ink, fx - w / 2 + Math.cos(a) * e, fy - h + Math.sin(a) * e, w, h); }
  g.drawImage(im, fx - w / 2, fy - h, w, h);
}

// ---------------------------------------------------------------- the title scroll and the compass rose
function drawTitle(g, x, y, px) {
  g.save(); g.translate(x, y);
  const W = 336, H = 92;
  // rolled ends: a shaded parchment roll at each side, a little taller than the sheet, with the curl showing at the ends
  for (const s of [-1, 1]) {
    const x0 = s * (W / 2) - 9, rh = H + 16, y0 = -rh / 2 + 4;
    const cyl = g.createLinearGradient(x0, 0, x0 + 18, 0);
    cyl.addColorStop(0, '#a7854e'); cyl.addColorStop(0.35, '#f1dfb4'); cyl.addColorStop(0.7, '#d9bd84'); cyl.addColorStop(1, '#94723f');
    g.beginPath(); g.roundRect(x0, y0, 18, rh, 7); g.fillStyle = cyl; g.fill(); g.strokeStyle = INK; g.lineWidth = px(3.4); g.stroke();
    for (const yy of [y0 + 3, y0 + rh - 3]) {
      g.beginPath(); g.ellipse(x0 + 9, yy, 9, 3.4, 0, 0, 7); g.fillStyle = '#c9a86c'; g.fill(); g.lineWidth = px(2.4); g.stroke();
      g.beginPath(); g.ellipse(x0 + 9 + s * 1.5, yy, 4.2, 1.6, 0, 0, 7); g.fillStyle = '#7c5b2e'; g.fill();
    }
  }
  // the sheet: wavy top and bottom edges, as if the parchment were curling
  g.beginPath(); g.moveTo(-W / 2, -H / 2 + 4);
  g.bezierCurveTo(-W / 4, -H / 2 - 8, W / 4, -H / 2 + 10, W / 2, -H / 2 + 2);
  g.lineTo(W / 2, H / 2 + 6); g.bezierCurveTo(W / 4, H / 2 - 4, -W / 4, H / 2 + 14, -W / 2, H / 2 + 4); g.closePath();
  const gr = g.createLinearGradient(0, -H / 2, 0, H / 2); gr.addColorStop(0, '#f6e7c1'); gr.addColorStop(0.55, '#ecd7a4'); gr.addColorStop(1, '#d9bd84');
  g.fillStyle = gr; g.fill(); g.strokeStyle = INK; g.lineWidth = px(4); g.stroke();
  g.strokeStyle = 'rgba(120,85,40,0.25)'; g.lineWidth = px(1.4);
  for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-W / 2 + 14, -H / 2 + 18 + k * 18); g.bezierCurveTo(-W / 6, -H / 2 + 10 + k * 18, W / 6, -H / 2 + 26 + k * 18, W / 2 - 14, -H / 2 + 16 + k * 18); g.stroke(); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `46px ${FONTS.title}`; g.lineWidth = px(10); g.strokeStyle = '#f6e7c1'; g.strokeText('HOT SPRINGS', 0, -10);
  g.fillStyle = INK; g.fillText('HOT SPRINGS', 0, -10);
  g.font = `15px ${FONTS.title}`; g.fillStyle = '#7d2a1c'; g.fillText('A R K A N S A S', 0, 22);
  g.font = `700 9px ${FONTS.hand}`; g.fillStyle = '#4a3420'; g.fillText('~ the Valley of Vapors ~', 0, 37);
  g.restore();
}
function drawCompass(g, x, y, r, north, px) {
  const a = Math.atan2(north[1], north[0]);
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(244,231,196,0.9)'; g.strokeStyle = INK; g.lineWidth = px(3);
  g.beginPath(); g.arc(0, 0, r * 0.66, 0, 7); g.fill(); g.stroke();
  g.lineWidth = px(1.4); g.beginPath(); g.arc(0, 0, r * 0.56, 0, 7); g.stroke();
  for (let k = 0; k < 32; k++) { const t = (k / 32) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(t) * r * 0.56, Math.sin(t) * r * 0.56); g.lineTo(Math.cos(t) * r * (k % 4 ? 0.61 : 0.66), Math.sin(t) * r * (k % 4 ? 0.61 : 0.66)); g.stroke(); }
  for (let k = 7; k >= 0; k--) {
    const t = a + (k * Math.PI) / 4, L = k % 2 ? r * 0.7 : r, wd = k % 2 ? r * 0.1 : r * 0.15;
    for (const side of [-1, 1]) {
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(t) * L, Math.sin(t) * L);
      g.lineTo(Math.cos(t + (side * Math.PI) / 2) * wd, Math.sin(t + (side * Math.PI) / 2) * wd); g.closePath();
      g.fillStyle = k === 0 ? (side < 0 ? '#8e2f1c' : '#c9573a') : k % 2 ? (side < 0 ? '#a88b5c' : '#ead7a8') : (side < 0 ? INK : '#f3e5c2');
      g.fill(); g.lineWidth = px(1.6); g.strokeStyle = INK; g.stroke();
    }
  }
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
  ['N', 'E', 'S', 'W'].forEach((ch, k) => {
    const t = a + (k * Math.PI) / 2, R = r + 8; g.font = `${k ? 8 : 11}px ${FONTS.title}`;
    g.lineWidth = px(7); g.strokeStyle = 'rgba(244,231,196,0.95)';
    g.strokeText(ch, Math.cos(t) * R, Math.sin(t) * R + 0.5); g.fillText(ch, Math.cos(t) * R, Math.sin(t) * R + 0.5);
  });
  g.restore();
}
