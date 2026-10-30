// Board renderer. The base layer is the painted map of the valley (assets/board-day|night: Blender passes from
// USGS, Census, NHD and OSM data, painted by tools/map/illustrate.mjs, with the real landmarks painted from
// photographs). Spaces and plates are drawn crisply on top into a cache once per size/theme; each frame adds
// highlights, steam, tokens and effects. A camera fits the board or follows the active token. Without the art
// (?art=0, or a failed load) the same layers sit on a plain parchment board, so the game is never blank.
import { THEMES, drawIcon, roundRect, SPECIAL_ICON, drawToken as drawVectorToken } from './art.js';
import { NODES, ADJ, TOWER, VENT_PAIRS, START, BOARD_W, BOARD_H, GEO_META, DISTRICT } from './board.js';
import { CAT } from './data.js';
import { easeInOut, lerp, makeRng } from './util.js';
import * as Assets from './assets.js';

const BW = BOARD_W, BH = BOARD_H;
const GEO = GEO_META || { nodes: [], edges: [], labels: [], steam: [], squash: 0.87 };
const SQ = GEO.squash || 0.87;   // ground circles become ellipses under the camera's tilt (data/board-geo.json)
// Token sprites (tools/map/tokens.py, art-src/tokens/tokens.json): 208×240, foot at (104, 169.5), 66.67 px per token-base radius.
const TOK = { w: 208, h: 240, fx: 104, fy: 169.5, unit: 66.67, r: 20 };

export const view = {
  canvas: null, ctx: null, w: 0, h: 0, dpr: 1, theme: 'light', T: THEMES.light, fontsReady: false,
  cache: null, cacheKey: '', cam: { x: BW / 2, y: BH / 2, z: 1 }, camTarget: { x: BW / 2, y: BH / 2, z: 1 },
  mode: 'fit', backdrop: true, reduced: false, tok: {}, anims: [], particles: [], drag: null, manual: false, time: 0,
};

// Edge polylines by node pair, for path previews that follow the baked route.
const EDGE_PTS = new Map();
for (const e of GEO.edges || []) { EDGE_PTS.set(e.a + ',' + e.b, e.pts); EDGE_PTS.set(e.b + ',' + e.a, e.pts.slice().reverse()); }
const edgePts = (a, b) => EDGE_PTS.get(a + ',' + b) || [[NODES[a].x, NODES[a].y], [NODES[b].x, NODES[b].y]];

export function initView(canvas) {
  view.canvas = canvas; view.ctx = canvas.getContext('2d');
  const ro = new ResizeObserver(() => resize()); ro.observe(canvas.parentElement);
  Assets.onLoad(() => { view.cacheKey = ''; });
  // Canvas text never starts a font load: ask for the board's faces (inlined in the CSS) before the first bake.
  Promise.allSettled(['700 16px Kalam', '400 16px Kalam', '16px Rye'].map((f) => document.fonts.load(f)))
    .then(() => { view.fontsReady = true; view.cacheKey = ''; });
  resize();
}

export function resize() {
  const el = view.canvas.parentElement; const r = el.getBoundingClientRect();
  view.dpr = Math.min(2, window.devicePixelRatio || 1);
  view.w = Math.max(1, r.width); view.h = Math.max(1, r.height);
  view.canvas.width = Math.round(view.w * view.dpr); view.canvas.height = Math.round(view.h * view.dpr);
  view.canvas.style.width = view.w + 'px'; view.canvas.style.height = view.h + 'px';
  view.dirty = true; snapCamera();
}

export function setTheme(name) { view.theme = name; view.T = THEMES[name]; view.cacheKey = ''; }

const baseScale = () => (view.backdrop ? Math.max(view.w / BW, view.h / BH) * 1.08 : Math.min(view.w / BW, view.h / BH) * 0.985);
const followZoom = () => (view.w < 600 ? 1.9 : 1.6);
export const isZoomed = () => view.mode === 'follow';

// ---------- art selection ----------
function boardArt() {
  const base = view.theme === 'dark' && Assets.has('board-night') ? 'board-night' : 'board-day';
  return { lo: base + '-lo', hi: base };
}
// Pixels the cache needs across the board width at the most zoomed camera we use.
function wantRes() {
  // The title/menu backdrop sits under a scrim, so it never needs more than the 1600 px copy.
  const z = view.backdrop ? 1 : followZoom();
  const cap = view.backdrop ? 1600 : view.w < 700 ? 2400 : 3200;
  return Math.max(800, Math.min(cap, Math.ceil(BW * baseScale() * view.dpr * z)));
}
export function requestArt() {
  if (!Assets.ART.enabled) return;
  const a = boardArt();
  Assets.load(a.lo);
  if (wantRes() > 1700) Assets.load(a.hi);
  for (const s of ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon']) Assets.load('token-' + s);
  for (const d of Object.keys(DISTRICT)) { Assets.load('land-' + d); Assets.load('stamp-' + d); }
  Assets.load('land-tower');
  for (const f of ['horse', 'sailboat', 'fishing-boat', 'streetcar']) if (Assets.has('doodle-' + f)) Assets.load('doodle-' + f);
}
export const artBusy = () => Assets.loading() || !view.fontsReady;

function ensureCache() {
  const a = boardArt();
  const hi = Assets.img(a.hi), lo = Assets.img(a.lo);
  const art = wantRes() > 1700 && hi ? hi : lo || hi;
  const res = Math.round(wantRes() / 100) * 100;
  const key = `${view.theme}:${res}:${art ? art.width : 0}:${view.fontsReady}`;
  if (key === view.cacheKey && view.cache) return;
  const c = view.cache && view.cache.width === res ? view.cache : document.createElement('canvas');
  c.width = res; c.height = Math.round(res * BH / BW);
  const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
  g.scale(res / BW, res / BW);
  const T = view.T;
  if (art) { g.imageSmoothingQuality = 'high'; g.drawImage(art, 0, 0, BW, BH); }
  else drawVectorBoard(g, T);
  if (view.theme === 'dark' && art && !Assets.img('board-night') && !Assets.img('board-night-lo')) {
    g.fillStyle = 'rgba(10,12,30,0.55)'; g.fillRect(0, 0, BW, BH);
  }
  drawPlates(g, T, !!art);
  drawSpaces(g, T);
  view.cache = c; view.cacheKey = key;
}

// The Mountain Tower's top (the goal's glow, plate and win focus): measured on the painting by the illustrator.
export const towerTopY = () => (GEO.tower ? GEO.tower.top : null);

// ---------- plain parchment board (no art) ----------
function drawVectorBoard(g, T) {
  g.fillStyle = '#e9dcb6'; g.fillRect(0, 0, BW, BH);
  const grd = g.createLinearGradient(0, 0, 0, BH); grd.addColorStop(0, 'rgba(150,185,115,0.35)'); grd.addColorStop(1, 'rgba(110,150,85,0.5)');
  g.fillStyle = grd; g.fillRect(0, 0, BW, BH);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [w, col] of [[11, INK], [8.4, '#f5e8c9']]) {
    g.lineWidth = w; g.strokeStyle = col;
    for (const e of GEO.edges || []) { g.beginPath(); e.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
  }
}

// ---------- plates, rings, the credits (static) ----------
// The painting's own hand: sepia ink, parchment scrolls, Rye display capitals and Kalam lettering (src/styles/fonts.css).
const INK = '#3a2a1a', DISPLAY = 'Rye, Georgia, serif', HAND = 'Kalam, "Segoe Print", cursive';
// A parchment scroll with rolled ends: the title in Rye, an optional Kalam sub-line, and a category pip.
function plate(g, x, y, text, sub, accent, size = 13) {
  g.font = `${size}px ${DISPLAY}`; const tw = g.measureText(text).width;
  const ss = Math.max(8.5, size * 0.66);
  g.font = `700 ${ss}px ${HAND}`; const sw = sub ? g.measureText(sub).width : 0;
  const w = Math.max(tw + (accent ? 10 : 0), sw) + 20, h = size + (sub ? ss * 1.15 : 0) + 9;
  const sheet = (dx, dy) => {
    g.beginPath(); g.moveTo(x - w / 2 + dx, y - h / 2 + dy); g.quadraticCurveTo(x + dx, y - h / 2 - 2.4 + dy, x + w / 2 + dx, y - h / 2 + dy);
    g.lineTo(x + w / 2 + dx, y + h / 2 + dy); g.quadraticCurveTo(x + dx, y + h / 2 - 2.4 + dy, x - w / 2 + dx, y + h / 2 + dy); g.closePath();
  };
  g.save();
  g.fillStyle = 'rgba(40,28,12,0.3)'; sheet(1.2, 2.2); g.fill();
  for (const s of [-1, 1]) {   // the rolled ends, tucked behind the sheet
    g.beginPath(); g.ellipse(x + s * (w / 2), y + 1, 4.2, h / 2 + 1.5, 0, 0, Math.PI * 2);
    g.fillStyle = '#cdb07a'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.ellipse(x + s * (w / 2), y + 1, 1.8, h / 2 - 2, 0, 0, Math.PI * 2); g.fillStyle = '#9e7d47'; g.fill();
  }
  const pg = g.createLinearGradient(0, y - h / 2, 0, y + h / 2); pg.addColorStop(0, '#f8eac6'); pg.addColorStop(1, '#e3c993');
  g.fillStyle = pg; sheet(0, 0); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const ty = y - (sub ? ss * 0.55 : 0) + 0.6;
  if (accent) { g.fillStyle = accent; g.beginPath(); g.arc(x - tw / 2 - 2, ty, 3, 0, Math.PI * 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke(); }
  g.fillStyle = INK; g.font = `${size}px ${DISPLAY}`; g.fillText(text, x + (accent ? 5 : 0), ty);
  if (sub) { g.font = `700 ${ss}px ${HAND}`; g.fillStyle = '#6b4626'; g.fillText(sub, x, y + size * 0.5 + 0.4); }
  g.restore();
  return { w, h };
}
function drawPlates(g, T, art) {
  const baked = new Set(art ? GEO.baked || [] : []);
  for (const L of GEO.labels || []) {
    if ((L.kind === 'vignette' || L.kind === 'ring') && L.ring) {   // the insets drawn closer than they are
      g.save(); g.setLineDash([3, 4]); g.lineWidth = 1.3; g.strokeStyle = 'rgba(58,42,26,0.55)';
      g.beginPath(); L.ring.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke(); g.restore();
    }
  }
  for (const L of GEO.labels || []) {
    if (!L.at || baked.has(L.kind)) continue;
    const [x, y] = L.at;
    if (L.kind === 'district') {
      const d = DISTRICT[L.key]; const cat = d && CAT[d.cat];
      if (L.key === 'row') { const r = rowPlate(); if (r) { plate(g, r[0], r[1], L.text, null, cat ? cat.color : null, 14); continue; } }
      if (L.anchor) { g.strokeStyle = 'rgba(58,42,26,0.85)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x, y); g.lineTo(L.anchor[0], L.anchor[1]); g.stroke(); }
      plate(g, x, y, L.text, L.sub || null, cat ? cat.color : null, 14);
    } else if (L.kind === 'vignette') {
      plate(g, x, y, L.text, L.truth ? `${L.truth} · moved closer` : null, null, 12.5);
    } else if (L.kind === 'mountain') {
      if (GEO.tower && L.text === 'Hot Springs Mountain') continue;   // named on the tower plate
      g.font = `12px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 3.4; g.strokeStyle = 'rgba(248,238,212,0.85)'; g.strokeText(L.text, x, y); g.fillStyle = INK; g.fillText(L.text, x, y);
    } else if (L.kind === 'street') {
      g.save(); g.translate(x, y); const a = L.dir ? Math.atan2(L.dir[1], L.dir[0]) : 0; g.rotate(Math.abs(a) > Math.PI / 2 ? a + Math.PI : a);
      g.font = `700 8.5px ${HAND}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(58,42,26,0.8)'; g.fillText(L.text.toUpperCase().split('').join(' '), 0, 0); g.restore();
    }
  }
  // the goal: a plate on a leader line beside the painted Mountain Tower
  const tt = towerTopY();
  if (tt) {
    const [tx, ty0] = tt; const ty = Math.max(ty0, 30); const px = tx + 92, py = ty + 26;
    g.strokeStyle = 'rgba(58,42,26,0.9)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(tx + 2, ty - 2); g.lineTo(px - 30, py + 4); g.stroke();
    g.fillStyle = '#c9a14a'; g.beginPath(); g.arc(tx, ty, 2.6, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke();
    plate(g, px, py, '★ Mountain Tower', 'the Summit · Hot Springs Mountain', '#c9a14a', 12.5);
  }
  // legend and credits on a parchment strip (OSM data is ODbL: attribution must be visible with the map), in the
  // bottom corner the spaces leave clearest
  const CREDITS = ['Downtown true to layout · directions true · far places moved closer · landmarks drawn larger than life',
    'Map data © OpenStreetMap contributors, USGS, US Census · landmarks painted from public-domain photographs'];
  g.font = `700 7.6px ${HAND}`; const cw = Math.max(...CREDITS.map((t) => g.measureText(t).width)) + 14, ch = 22;
  // the painting keeps a clear strip for it (GEO.slots.credits); without art, the clearest of three spots
  const spots = [[BW - 16 - cw / 2, BH - 21], [BW / 2, BH - 21], [16 + cw / 2 + (baked.has('compass') ? 0 : 70), BH - 21]];
  const hit = ([sx, sy]) => NODES.reduce((m, n) => Math.min(m, Math.max(Math.abs(n.x - sx) - cw / 2, Math.abs(n.y - sy) - ch / 2) - spaceR(n)), 1e9);
  const [cx0, cy0] = art && GEO.slots && GEO.slots.credits ? GEO.slots.credits : spots.sort((a, b) => hit(b) - hit(a))[0];
  g.save(); g.fillStyle = 'rgba(246,234,200,0.92)'; roundRect(g, cx0 - cw / 2, cy0 - ch / 2, cw, ch, 3); g.fill();
  g.strokeStyle = 'rgba(58,42,26,0.7)'; g.lineWidth = 0.9; g.stroke();
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
  CREDITS.forEach((t, i) => g.fillText(t, cx0, cy0 - 4.6 + i * 9.4)); g.restore();
  if (!baked.has('compass')) drawCompass(g, ...(GEO.slots && GEO.slots.compass ? GEO.slots.compass : [40, BH - 44]));
}
// A plain compass rose for the board without art (the painting carries its own); north points where GEO.north says.
function drawCompass(g, cx, cy) {
  const n = GEO.north || [-1, 0]; const a = Math.atan2(n[1], n[0]);
  g.save(); g.translate(cx, cy);
  g.fillStyle = 'rgba(246,234,200,0.92)'; g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, 20, 0, 7); g.fill(); g.stroke();
  for (let k = 0; k < 4; k++) { g.save(); g.rotate(a + k * Math.PI / 2); g.fillStyle = k ? '#b9a27a' : '#8e2f1c'; g.beginPath(); g.moveTo(k ? 12 : 17, 0); g.lineTo(0, -3.6); g.lineTo(0, 3.6); g.closePath(); g.fill(); g.stroke(); g.restore(); }
  g.font = `10px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
  g.fillText('N', Math.cos(a) * 27, Math.sin(a) * 27 + 0.5);
  g.restore();
}

// Bathhouse Row's plate: above (east of) the Row's spaces, between the Hale and the Fordyce.
function rowPlate() {
  const row = NODES.filter((n) => n.district === 'row' && n.type !== 'trailhead');
  if (!row.length) return null;
  const xs = row.map((n) => n.x), ys = row.map((n) => n.y);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, Math.min(...ys) - 44];
}

// ---------- spaces (static): colour medallions on the painted path's stone seats ----------
const RADIUS = { landmark: 19, start: 16.5, trail: 7 };   // the painted seats are ~3 u wider (tools/map/illustrate/page.js)
export const spaceR = (n) => RADIUS[n.type] || 15.2;
function ell(g, x, y, r) { g.beginPath(); g.ellipse(x, y, r, r * SQ, 0, 0, Math.PI * 2); }
function icon(g, kind, x, y, s, ink) { g.save(); g.translate(x, y); g.scale(1, SQ); drawIcon(g, kind, 0, 0, s, ink); g.restore(); }
function drawSpaces(g, T) {
  for (const n of NODES) {
    if (n.type === 'tower') continue;
    const r = spaceR(n) + (n.steep ? 1.5 : 0);
    g.fillStyle = 'rgba(40,28,12,0.32)'; ell(g, n.x + 0.8, n.y + 1.8, r + 0.3); g.fill();
    if (n.type === 'trail') {
      g.fillStyle = '#6b5139'; ell(g, n.x, n.y, r); g.fill();
      g.strokeStyle = '#f4e6c4'; g.lineWidth = 1.1; ell(g, n.x, n.y, r - 1.4); g.stroke();
      g.strokeStyle = INK; g.lineWidth = 1.1; ell(g, n.x, n.y, r); g.stroke();
      if (n.steep) { g.fillStyle = '#f4e6c4'; g.font = `700 7px ${HAND}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2', n.x, n.y + 0.4); }
      continue;
    }
    const cat = n.cat && CAT[n.cat];
    const face = n.type === 'cat' || n.type === 'landmark';
    const ring = n.type === 'vent' ? '#2A9D8F' : n.type === 'jury' ? '#9A2A1C' : n.type === 'start' ? '#C9A14A' : '#1F2F5C';
    g.fillStyle = face ? cat.color : '#fbf6ea'; ell(g, n.x, n.y, r); g.fill();
    // a cream ring inside the ink edge (two for a landmark); special spaces keep their coloured ring
    g.strokeStyle = face ? '#fbf3dd' : ring; g.lineWidth = face ? 1.5 : 2.2; ell(g, n.x, n.y, r - 2.3); g.stroke();
    if (n.type === 'landmark') { g.lineWidth = 1; ell(g, n.x, n.y, r - 4.8); g.stroke(); }
    g.strokeStyle = INK; g.lineWidth = 1.5; ell(g, n.x, n.y, r); g.stroke();
    if (face) icon(g, cat.icon, n.x, n.y, r * 0.7, cat.ink);
    else icon(g, SPECIAL_ICON[n.type] || 'dot', n.x, n.y, r * 0.6, n.type === 'vent' ? '#1F7F74' : n.type === 'jury' ? '#9A2A1C' : n.type === 'start' ? '#9a7426' : '#1F2F5C');
  }
}

// ---------- camera ----------
// Backdrop centre: the board middle, or a focus point placed at `at` (0–1) of the screen height, clamped so
// the board (plus the ambient drift) always covers the screen.
function backdropCenter() {
  const f = view.backdropFocus; if (!f) return { x: BW / 2, y: BH / 2 };
  const s = baseScale(); const hw = view.w / 2 / s + 18, hh = view.h / 2 / s + 12;
  const cl = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi));
  return { x: cl(f.x, hw, BW - hw), y: cl(f.y - ((f.at ?? 0.5) - 0.5) * view.h / s, hh, BH - hh) };
}
export function setCameraMode(mode) { view.mode = mode; view.manual = false; }
function camGoal(focus) {
  if (view.backdrop) return { ...backdropCenter(), z: 1 };
  if (view.mode === 'follow' && focus) {
    const z = followZoom();
    const s = baseScale() * z; const hw = view.w / 2 / s, hh = view.h / 2 / s;
    const cx = hw * 2 >= BW ? BW / 2 : Math.min(Math.max(focus.x, hw), BW - hw);
    const cy = hh * 2 >= BH ? BH / 2 : Math.min(Math.max(focus.y, hh), BH - hh);
    return { x: cx, y: cy, z };
  }
  return { x: BW / 2, y: BH / 2, z: 1 };
}
export function snapCamera(focus) { const g = camGoal(focus || view.focus); Object.assign(view.cam, g); Object.assign(view.camTarget, g); }
export const camSettled = () => view.backdrop || Math.abs(view.cam.x - view.camTarget.x) < 0.5 && Math.abs(view.cam.y - view.camTarget.y) < 0.5 && Math.abs(view.cam.z - view.camTarget.z) < 0.003;

export function worldToScreen(x, y) { const s = baseScale() * view.cam.z; return [(x - view.cam.x) * s + view.w / 2, (y - view.cam.y) * s + view.h / 2]; }
export function screenToWorld(x, y) { const s = baseScale() * view.cam.z; return [(x - view.w / 2) / s + view.cam.x, (y - view.h / 2) / s + view.cam.y]; }

export function panBy(dx, dy) {
  const s = baseScale() * view.cam.z; view.manual = true;
  view.camTarget.x = view.cam.x = Math.min(BW, Math.max(0, view.cam.x - dx / s));
  view.camTarget.y = view.cam.y = Math.min(BH, Math.max(0, view.cam.y - dy / s));
}

// ---------- tokens and animation ----------
export function tokenPos(p) { if (!view.tok[p.id]) { const n = NODES[p.node]; view.tok[p.id] = { x: n.x, y: n.y, lift: 0, sq: 0 }; } return view.tok[p.id]; }
export function resetTokens() { view.tok = {}; view.anims = []; view.particles = []; }

export function animate(dur, update, done) {
  if (view.reduced || dur <= 0) { update(1); done && done(); return; }
  view.anims.push({ t: 0, dur, update, done });
}
export function finishAnims() {
  for (let guard = 0; view.anims.length && guard < 500; guard++) { const a = view.anims; view.anims = []; for (const x of a) { x.update(1); x.done && x.done(); } }
  Object.assign(view.cam, view.camTarget);
}
export const isAnimating = () => view.anims.length > 0;

// Hop along the baked route (following each edge's curve), or one arcing jump.
export function moveAlong(p, path, done, { mode = 'walk', onHop } = {}) {
  const tp = tokenPos(p);
  if (view.reduced) { const n = NODES[path[path.length - 1]]; tp.x = n.x; tp.y = n.y; tp.lift = 0; done(); return; }
  const steps = mode === 'jump' ? [path[path.length - 1]] : path.slice(1);
  let i = 0; let prev = path[0];
  const hop = () => {
    if (i >= steps.length) { done(); return; }
    const to = steps[i]; const from = { x: tp.x, y: tp.y };
    const pts = mode === 'jump' ? [[from.x, from.y], [NODES[to].x, NODES[to].y]] : edgePts(prev, to);
    const seg = []; let L = 0; for (let k = 1; k < pts.length; k++) { const d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); seg.push(d); L += d; }
    const dur = mode === 'jump' ? 700 : Math.max(170, Math.min(320, L * 4.2));
    const height = mode === 'jump' ? 64 : 8 + Math.min(10, L * 0.12);
    const dir = Math.sign(NODES[to].x - from.x) || 1;
    animate(dur, (k) => {
      const e = easeInOut(k); let s = e * L, j = 0;
      while (j < seg.length - 1 && s > seg[j]) { s -= seg[j]; j++; }
      const f = seg[j] ? Math.min(1, s / seg[j]) : 1;
      tp.x = lerp(pts[j][0], pts[j + 1][0], f); tp.y = lerp(pts[j][1], pts[j + 1][1], f);
      tp.lift = Math.sin(Math.PI * k) * height;
      // a little crouch before take-off, a stretch in the air, a squash on landing (negative sq = stretch)
      tp.sq = k < 0.1 ? (0.1 - k) * 4 : k > 0.88 ? (1 - k) * 2.2 : -Math.sin(Math.PI * k) * 0.45;
      tp.lean = Math.sin(Math.PI * k) * dir * (mode === 'jump' ? 0.22 : 0.14);
    }, () => {
      tp.lift = 0; tp.sq = 0; tp.lean = 0; const n = NODES[to]; tp.x = n.x; tp.y = n.y;
      dust(tp.x, tp.y); ring(tp.x, tp.y);
      onHop && onHop(to); prev = to; i++; hop();
    });
  };
  hop();
}

// a ring that spreads across the stone seat where a token lands
function ring(x, y) { if (!view.reduced) view.particles.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.45, c: 'rgba(255,248,226,0.95)', kind: 'ring', s: 9, rot: 0, g: 0 }); }

function dust(x, y) {
  if (view.reduced) return;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    view.particles.push({ x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6 * SQ, vx: Math.cos(a) * 26, vy: Math.sin(a) * 12 - 6, life: 0, max: 0.35, c: 'rgba(235,225,200,0.8)', kind: 'puff', s: 2.2, rot: 0, g: 0 });
  }
}

export function burst(x, y, colors, n = 26, kind = 'spark') {
  if (view.reduced) return;
  const r = makeRng((x * 31 + y * 17 + view.time) | 0);
  for (let i = 0; i < n; i++) {
    const a = r.next() * Math.PI * 2, sp = 60 + r.next() * 160;
    view.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'confetti' ? 120 : 40), life: 0, max: 0.9 + r.next() * 0.8, c: colors[i % colors.length], kind, s: 2 + r.next() * 3, rot: r.next() * 6, g: 260 });
  }
}

// ---------- frame ----------
export function frame(dt, st) {
  view.time += dt;
  for (const a of view.anims.slice()) {
    a.t += dt * 1000;
    const k = Math.min(1, a.t / a.dur); a.update(k);
    if (k >= 1) { view.anims.splice(view.anims.indexOf(a), 1); a.done && a.done(); }
  }
  const trail = st && st.trail;
  const active = trail && st.mode === 'trail' && !view.backdrop ? trail.players[trail.turn] : null;
  view.focus = active ? tokenPos(active) : null;
  if (!view.manual) Object.assign(view.camTarget, camGoal(view.focus));
  const k = view.reduced ? 1 : Math.min(1, dt * 5);
  view.cam.x = lerp(view.cam.x, view.camTarget.x, k); view.cam.y = lerp(view.cam.y, view.camTarget.y, k); view.cam.z = lerp(view.cam.z, view.camTarget.z, k);
  if (view.backdrop && !view.reduced) { const f = backdropCenter(); view.cam.x = f.x + Math.sin(view.time * 0.05) * 16; view.cam.y = f.y + Math.cos(view.time * 0.04) * 10; }
  // With only ambient motion (steam, backdrop drift, the active token's bob) a 30 fps redraw is enough;
  // tweens, particles, camera moves and destination pulses draw every frame.
  const t = st && st.trail; const pulsing = t && st.mode === 'trail' && !view.backdrop && ['choose', 'warp'].includes(t.phase);
  const busy = view.anims.length || view.particles.length || !camSettled() || pulsing || view.dirty;
  view.odd = !view.odd;
  if (busy || view.odd) { view.dirty = false; draw(st, dt + (busy ? 0 : view.lastSkip || 0)); view.lastSkip = 0; } else view.lastSkip = dt;
}

function draw(st, dt) {
  const { ctx, dpr } = view; const T = view.T;
  ensureCache();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = table(ctx); ctx.fillRect(0, 0, view.w, view.h);
  const s = baseScale() * view.cam.z;
  if (!view.backdrop) {   // board edge: thickness, a drop shadow, then a thin brass bevel
    const [x0, y0] = worldToScreen(0, 0), [x1, y1] = worldToScreen(BW, BH);
    // soft shadow from stacked translucent rects (shadowBlur on a full-screen rect costs ~15 fps)
    for (let i = 4; i >= 1; i--) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x0 - i * 2, y0 - i * 1.5 + 6, x1 - x0 + i * 4, y1 - y0 + i * 3 + 4); }
    ctx.fillStyle = view.theme === 'dark' ? '#1d1a14' : '#5a4630'; ctx.fillRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 12);
  }
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (view.w / 2 - view.cam.x * s), dpr * (view.h / 2 - view.cam.y * s));
  ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(view.cache, 0, 0, BW, BH);
  const trail = st && st.mode === 'trail' && !view.backdrop ? st.trail : null;
  const active = trail ? trail.players[trail.turn] : null;
  const el = active && active.stamps.length >= trail.target;
  const tt = towerTopY();
  if (el && tt) towerGlow(ctx, tt, view.reduced ? 0.8 : 0.6 + 0.4 * Math.sin(view.time * 4));
  drawAmbient(ctx, dt);
  drawSteam(ctx);
  if (trail) {
    for (const cat of active.stamps) {
      const n = NODES.find((x) => x.type === 'landmark' && x.cat === cat);
      const bx = n.x + 12, by = n.y - 11;
      ctx.fillStyle = '#2E6A3C'; ctx.beginPath(); ctx.arc(bx, by, 6, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(bx - 3, by); ctx.lineTo(bx - 0.6, by + 2.4); ctx.lineTo(bx + 3.2, by - 2.6); ctx.stroke();
    }
    if (trail.phase === 'choose') drawDests(ctx, trail, T);
    if (trail.phase === 'warp' && trail.pending) drawTargets(ctx, trail.pending.options, T);
    drawTokens(ctx, trail, T);
  }
  drawParticles(ctx, dt);
}

let TABLE = null;
function table(ctx) {
  const dark = view.theme === 'dark'; const key = dark ? 'd' : 'l';
  if (TABLE && TABLE.key === key) return TABLE.pat;
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
  g.fillStyle = dark ? '#121019' : '#4a3a28'; g.fillRect(0, 0, 96, 96);
  const r = makeRng(5);
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${dark ? '255,255,255' : '255,230,190'},${0.02 + r.next() * 0.05})`; g.lineWidth = 0.6 + r.next(); const y = r.next() * 96; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(32, y + (r.next() - 0.5) * 6, 64, y + (r.next() - 0.5) * 6, 96, y); g.stroke(); }
  TABLE = { key, pat: ctx.createPattern(c, 'repeat') }; return TABLE.pat;
}
function towerGlow(ctx, [x, y], k) {
  const g = ctx.createRadialGradient(x, y, 2, x, y, 34);
  g.addColorStop(0, `rgba(255,226,140,${0.75 * k})`); g.addColorStop(1, 'rgba(255,226,140,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 34, 0, 7); ctx.fill();
}

function strokePath(ctx, path) {
  ctx.beginPath(); let first = true;
  for (let i = 1; i < path.length; i++) {
    for (const [x, y] of edgePts(path[i - 1], path[i])) { if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y); }
  }
  ctx.stroke();
}

function drawDests(ctx, trail, T) {
  const pulse = view.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(view.time * 6);
  const p = trail.players[trail.turn];
  const sel = trail.dests[trail.sel];
  const pc = p.color === '#F4F1EA' ? '#1F2A24' : p.color;
  if (sel) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 6.5; strokePath(ctx, sel.path);
    ctx.strokeStyle = pc; ctx.lineWidth = 3.6; ctx.setLineDash([1.5, 6.5]); ctx.lineDashOffset = view.reduced ? 0 : -view.time * 18; strokePath(ctx, sel.path);
    ctx.restore();
  }
  trail.dests.forEach((d, i) => {
    const n = NODES[d.node]; const isSel = i === trail.sel;
    const r = spaceR(n) + 5 + pulse * 3 + (isSel ? 3 : 0);
    ctx.lineWidth = isSel ? 4.5 : 3.2; ctx.strokeStyle = isSel ? '#FFFFFF' : T.glow;
    ell(ctx, n.x, n.y, r); ctx.stroke();
    ctx.lineWidth = isSel ? 2.2 : 1.4; ctx.strokeStyle = '#1F2A24'; ell(ctx, n.x, n.y, r + 2.6); ctx.stroke();
    const bx = n.x + r * 0.78, by = n.y - r * 0.78 * SQ - 3;
    ctx.fillStyle = isSel ? '#1F2A24' : '#FFFFFF'; ctx.beginPath(); ctx.arc(bx, by, 7.5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#1F2A24'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = isSel ? '#FFFFFF' : '#1F2A24'; ctx.font = 'bold 9.5px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), bx, by + 0.5);
  });
}

function drawTargets(ctx, ids, T) {
  const pulse = view.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(view.time * 6);
  for (const id of ids) { const n = NODES[id]; ctx.lineWidth = 3.5; ctx.strokeStyle = T.glow; ell(ctx, n.x, n.y, spaceR(n) + 7 + pulse * 4); ctx.stroke(); }
}

function drawTokens(ctx, trail, T) {
  const groups = {};
  for (const p of trail.players) { const tp = tokenPos(p); const key = Math.round(tp.x) + ',' + Math.round(tp.y); (groups[key] = groups[key] || []).push(p); }
  const list = [];
  for (const key in groups) {
    const g = groups[key];
    g.forEach((p, i) => { const tp = tokenPos(p); const off = g.length > 1 ? 9 : 0; const a = (i / g.length) * Math.PI * 2 - Math.PI / 2; list.push({ p, x: tp.x + Math.cos(a) * off, y: tp.y + Math.sin(a) * off * SQ, lift: tp.lift, sq: tp.sq || 0, lean: tp.lean || 0 }); });
  }
  list.sort((a, b) => a.y - b.y);
  const activeId = trail.players[trail.turn].id;
  for (const it of list) {
    const act = it.p.id === activeId;
    // the active pawn bounces gently in place, with a small squash each time it touches down
    const ph = view.time * 3, bob = act && !view.reduced && !it.lift ? Math.abs(Math.sin(ph)) * 2.6 : 0;
    if (act && !view.reduced && !it.lift) it.sq = Math.max(0, 0.35 - Math.abs(Math.sin(ph)) * 2) * 0.9;
    const lift = it.lift + bob;
    // contact shadow shrinks as the token rises
    const sh = Math.max(0.45, 1 - lift / 70);
    ctx.fillStyle = `rgba(0,0,0,${0.38 * sh})`; ctx.beginPath(); ctx.ellipse(it.x + 1.5, it.y + 1.2, TOK.r * 1.05 * sh, TOK.r * 0.62 * sh, 0, 0, 7); ctx.fill();
    if (act) {
      const pc = it.p.color === '#F4F1EA' ? '#FFFFFF' : it.p.color;
      ctx.lineWidth = 2.4; ctx.strokeStyle = pc; ctx.globalAlpha = view.reduced ? 0.9 : 0.6 + 0.4 * Math.sin(view.time * 4);
      ell(ctx, it.x, it.y, TOK.r + 5); ctx.stroke(); ctx.globalAlpha = 1;
    }
    const spr = Assets.img('token-' + it.p.shape);
    if (spr) {
      const k = TOK.r / TOK.unit; const sx = 1 + it.sq * 0.12, sy = 1 - it.sq * 0.14;
      const w = TOK.w * k * sx, h = TOK.h * k * sy;
      ctx.save(); ctx.translate(it.x, it.y - lift); ctx.rotate(it.lean);   // leans into the hop, about its foot
      ctx.drawImage(spr, -TOK.fx * k * sx, -TOK.fy * k * sy, w, h); ctx.restore();
    } else {
      drawVectorToken(ctx, it.p.shape, it.p.color, it.x, it.y, 8.5, { lift: lift + 6, active: false, T });
    }
  }
}

// ---------- ambient life (not part of isIdle, off under reduced motion) ----------
// Clouds drift across the painted sky, a few birds cross now and then, light glints on the lakes, and some painted
// figures go about their day where they really would: a racehorse round Oaklawn's oval, boats on the lakes, a
// streetcar up and down Central Avenue. Places come from the painting (GEO.ambient, tools/map/illustrate/page.js).
const AMB = GEO.ambient || null;
let SKY = null;
function cloudSprite(seed) {
  const r = makeRng(seed), W = 200, H = 80, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const puffs = []; const n = 5 + Math.floor(r.next() * 3);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; puffs.push([20 + t * 160, 52 - Math.sin(t * Math.PI) * (16 + r.next() * 12), 14 + Math.sin(t * Math.PI) * (12 + r.next() * 8)]); }
  g.strokeStyle = 'rgba(96,104,112,0.55)'; g.lineWidth = 4;
  for (const [x, y, rr] of puffs) { g.beginPath(); g.arc(x, y, rr, 0, 7); g.stroke(); }
  g.fillStyle = '#fffdf6'; for (const [x, y, rr] of puffs) { g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(184,204,216,0.6)'; g.beginPath(); g.ellipse(100, 60, 86, 7, 0, 0, 7); g.fill();
  g.globalCompositeOperation = 'destination-out'; g.fillRect(0, 64, W, H);
  return c;
}
function sky() {
  if (SKY) return SKY;
  const r = makeRng(41), top = 10, bot = Math.max(30, (AMB && AMB.horizon || 140) - 40);
  SKY = { clouds: Array.from({ length: 5 }, (_, i) => ({ img: cloudSprite(11 + i * 7), x: r.next() * (BW + 200) - 100, y: top + r.next() * (bot - top), w: 50 + r.next() * 40, v: 2 + r.next() * 2.5 })),
    glints: [] };
  for (const L of (AMB && AMB.lakes) || []) {
    const [x0, y0, x1, y1] = L.box; const P = new Path2D(); L.pts.forEach(([x, y], i) => (i ? P.lineTo(x, y) : P.moveTo(x, y))); P.closePath();
    const tst = document.createElement('canvas').getContext('2d');
    for (let k = 0, tries = 0; k < Math.min(14, L.n) && tries < 200; tries++) {
      const x = x0 + r.next() * (x1 - x0), y = y0 + r.next() * (y1 - y0);
      if (tst.isPointInPath(P, x, y)) { SKY.glints.push({ x, y, ph: r.next() * 6.3, sp: 0.6 + r.next() * 0.9, s: 1.2 + r.next() * 1.6 }); k++; }
    }
  }
  return SKY;
}
function alongLoop(pts, s) {   // point and heading at arc length s along a closed or open polyline
  let L = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
  s = ((s % L) + L) % L; let j = 0; while (j < seg.length - 1 && s > seg[j]) { s -= seg[j]; j++; }
  const f = seg[j] ? s / seg[j] : 0, a = pts[j], b = pts[j + 1];
  return { x: lerp(a[0], b[0], f), y: lerp(a[1], b[1], f), dx: b[0] - a[0], L };
}
function figure(ctx, name, x, y, w, flip, rot = 0, alpha = 1) {
  const im = Assets.img(name); if (!im) return;
  const h = (w * im.height) / im.width;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot); if (flip) ctx.scale(-1, 1);
  ctx.fillStyle = 'rgba(30,24,12,0.25)'; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.42, w * 0.08, 0, 0, 7); ctx.fill();
  ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
}
function drawAmbient(ctx, dt) {
  if (view.reduced || !AMB) return;
  const t = view.time, S = sky(), night = view.theme === 'dark';
  // clouds (they fade where they pass behind the title scroll)
  const tr = AMB.title;
  for (const c of S.clouds) {
    const x = ((c.x + t * c.v + 150) % (BW + 300)) - 150, h = c.w * 0.4;
    let a = night ? 0.35 : 0.85;
    if (tr && x + c.w / 2 > tr[0] && x - c.w / 2 < tr[2] && c.y + h > tr[1] && c.y < tr[3]) a *= 0.15;
    ctx.globalAlpha = a; ctx.drawImage(c.img, x - c.w / 2, c.y, c.w, h);
  }
  ctx.globalAlpha = 1;
  // a small flock crossing the sky every 24 seconds
  const cyc = 24, ft = t % cyc;
  if (!night && ft < 14) {
    const dir = Math.floor(t / cyc) % 2 ? -1 : 1, x0 = dir > 0 ? -30 : BW + 30, y0 = 40 + (Math.floor(t / cyc) % 3) * 22;
    ctx.strokeStyle = 'rgba(58,42,26,0.85)'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const bx = x0 + dir * (ft * 80 - i * 9 - (i % 2) * 4), by = y0 + i * 3.4 + Math.sin(t * 1.3 + i) * 2, f = Math.sin(t * 11 + i * 1.7) * 2.2;
      ctx.beginPath(); ctx.moveTo(bx - 4, by - f); ctx.quadraticCurveTo(bx - 2, by - 1.5, bx, by); ctx.quadraticCurveTo(bx + 2, by - 1.5, bx + 4, by - f); ctx.stroke();
    }
  }
  // glints of light on the lakes
  for (const q of S.glints) {
    const k = Math.max(0, Math.sin(t * q.sp + q.ph)) ** 6; if (k < 0.05) continue;
    const s = q.s * (0.6 + k * 0.6);
    ctx.globalAlpha = k * (night ? 0.6 : 0.95); ctx.strokeStyle = night ? '#dfe8ff' : '#ffffff'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(q.x - s, q.y); ctx.lineTo(q.x + s, q.y); ctx.moveTo(q.x, q.y - s * 0.7); ctx.lineTo(q.x, q.y + s * 0.7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // a racehorse round the oval, boats on the lakes, a streetcar on Central Avenue
  if (AMB.track) { const p = alongLoop(AMB.track, t * 26); figure(ctx, 'doodle-horse', p.x, p.y + Math.abs(Math.sin(t * 9)) * -0.8, 15, p.dx < 0); }
  for (const b of AMB.boats || []) {
    const x = b.x + Math.sin(t * 0.12 + b.x) * b.r, y = b.y + Math.sin(t * 0.09 + b.y) * b.r * 0.4 + Math.sin(t * 1.6 + b.x) * 0.5;
    figure(ctx, 'doodle-' + b.kind, x, y, b.w, Math.cos(t * 0.12 + b.x) < 0, Math.sin(t * 1.3 + b.y) * 0.05);
  }
  if (AMB.central) {
    const L = alongLoop(AMB.central, 0).L, s = (t * 7) % (2 * L), fwd = s < L, p = alongLoop(AMB.central, fwd ? s : 2 * L - s);
    figure(ctx, 'doodle-streetcar', p.x, p.y + 3, 15, fwd ? p.dx < 0 : p.dx > 0);
  }
}

// Steam: soft puffs rising from the bathhouse roofs and every steam vent (ambient, not part of isIdle).
const STEAM_SRC = () => (GEO.steam || []).concat(VENT_PAIRS.flat().map((id) => [NODES[id].x, NODES[id].y]));
let PUFF = null;
function puff() {
  if (PUFF) return PUFF;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); PUFF = c; return c;
}
function drawSteam(ctx) {
  if (view.reduced) return;
  const t = view.time; const srcs = STEAM_SRC(); const img = puff();
  for (let si = 0; si < srcs.length; si++) {
    const [x, y] = srcs[si];
    for (let k = 0; k < 4; k++) {
      const ph = (t * 0.22 + k / 4 + si * 0.37) % 1;
      const yy = y - 4 - ph * 38; const xx = x + Math.sin(t * 0.9 + k * 1.7 + si) * (3 + ph * 7);
      const r = 3.5 + ph * 11;
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.46;
      ctx.drawImage(img, xx - r, yy - r, r * 2, r * 2);
    }
  }
  ctx.globalAlpha = 1;
}

function drawParticles(ctx, dt = 1 / 60) {
  dt = Math.min(0.05, dt || 1 / 60);
  view.particles = view.particles.filter((q) => (q.life += dt) < q.max);
  for (const q of view.particles) {
    q.vy += (q.g ?? 260) * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.98; q.rot += dt * 6;
    ctx.globalAlpha = 1 - q.life / q.max; ctx.fillStyle = q.c;
    if (q.kind === 'confetti') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillRect(-q.s, -q.s / 2, q.s * 2, q.s); ctx.restore(); }
    else if (q.kind === 'ring') { const r = q.s * (1 + (q.life / q.max) * 1.6); ctx.strokeStyle = q.c; ctx.lineWidth = 2; ell(ctx, q.x, q.y, r); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(q.x, q.y, q.s * (q.kind === 'puff' ? 1 + q.life * 4 : 1), 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

export function hitDest(sx, sy, trail) {
  const [x, y] = screenToWorld(sx, sy);
  let best = null, bd = 26 * 26;
  const ids = trail.phase === 'choose' ? trail.dests.map((d) => d.node) : trail.phase === 'warp' ? trail.pending.options : [];
  for (const id of ids) { const n = NODES[id]; const d = (n.x - x) ** 2 + ((n.y - y) / SQ) ** 2; if (d < bd) { bd = d; best = id; } }
  return best;
}
export const towerTop = () => { const t = towerTopY(); return t ? { x: t[0], y: t[1] } : { x: NODES[TOWER].x, y: NODES[TOWER].y - 40 }; };
export { START, ADJ };
