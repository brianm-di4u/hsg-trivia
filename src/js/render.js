// Board renderer. The base layer is the pre-rendered diorama of the valley (assets/board-day|night,
// built in Blender by tools/map/ from USGS, Census, NHD and OSM data). Spaces, labels and plates are
// drawn crisply on top into a cache once per size/theme; each frame adds highlights, steam, tokens and
// effects. A camera fits the board or follows the active token. Without the art (?art=0, or a failed
// load) the same layers sit on a vector board, so the game is never blank.
import { THEMES, drawIcon, roundRect, SPECIAL_ICON, drawToken as drawVectorToken, shade } from './art.js';
import { NODES, ADJ, TOWER, VENT_PAIRS, START, BOARD_W, BOARD_H, GEO_META, DISTRICT } from './board.js';
import { CAT } from './data.js';
import { easeInOut, lerp, makeRng } from './util.js';
import * as Assets from './assets.js';

const BW = BOARD_W, BH = BOARD_H;
const GEO = GEO_META || { nodes: [], edges: [], labels: [], steam: [], squash: 0.87 };
const SQ = GEO.squash || 0.87;   // ground circles become ellipses under the 30° camera tilt
// Token sprites (tools/map/tokens.py): 208×240, foot at (104, 155), 66.67 px per token-base radius.
const TOK = { w: 208, h: 240, fx: 104, fy: 155, unit: 66.67, r: 20 };

export const view = {
  canvas: null, ctx: null, w: 0, h: 0, dpr: 1, theme: 'light', T: THEMES.light,
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
  for (const sd of STANDEES) Assets.load('standee-' + sd.art);
}
export const artBusy = () => Assets.loading();

function ensureCache() {
  const a = boardArt();
  const hi = Assets.img(a.hi), lo = Assets.img(a.lo);
  const art = wantRes() > 1700 && hi ? hi : lo || hi;
  const res = Math.round(wantRes() / 100) * 100;
  const key = `${view.theme}:${res}:${art ? art.width : 0}:${STANDEES.filter((sd) => Assets.img('standee-' + sd.art)).length}`;
  if (key === view.cacheKey && view.cache) return;
  const c = view.cache && view.cache.width === res ? view.cache : document.createElement('canvas');
  c.width = res; c.height = Math.round(res * BH / BW);
  const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
  g.scale(res / BW, res / BW);
  const T = view.T;
  if (art) {
    g.imageSmoothingQuality = 'high';
    const night = view.theme === 'dark' && (art === Assets.img('board-night') || art === Assets.img('board-night-lo'));
    if (night) g.filter = 'brightness(1.6) saturate(1.15) contrast(1.05)';   // dusk, not a black void
    g.drawImage(art, 0, 0, BW, BH); g.filter = 'none';
  }
  else drawVectorBoard(g, T);
  if (view.theme === 'dark' && art && !Assets.img('board-night') && !Assets.img('board-night-lo')) {
    g.fillStyle = 'rgba(10,12,30,0.55)'; g.fillRect(0, 0, BW, BH);
  }
  SPOTS = null; drawStandees(g);
  drawPlates(g, T);
  drawSpaces(g, T);
  view.cache = c; view.cacheKey = key;
}

// ---------- painted landmark miniatures ----------
// Each stands at its real place: the Arlington and the tower on their footprints (from the render), the outlying
// ones beside their district's landmark space, in the clearest direction found below.
const STANDEES = [
  { art: 'arlington', at: 'Arlington', w: 84, nudge: 46 }, { art: 'tower', at: 'Mountain Tower', w: 66, nudge: 24, behind: true },
  { art: 'oaklawn', near: 'oaklawn', w: 76 }, { art: 'ballpark', near: 'ballfields', w: 70 }, { art: 'hollow', near: 'hollow', w: 66 },
  { art: 'motel', near: 'park', w: 64 }, { art: 'dam', near: 'lakes', w: 70 }, { art: 'bridge', near: 'bridge', w: 62 },
];
let SPOTS = null;
// Clearance of a standee whose base point is (x, y): distance from its art box to every space, plate and other
// standee (negative = overlap). The art rises above the base point: box half-width w/2, height ~w*aspect.
function standeeClear(sd, x, y, pts, plates) {
  const hw = sd.w * 0.46, top = y - sd.h * 0.92, bot = y;
  let c = Math.min(x - hw, BW - x - hw, top - 2, BH - bot - 4);
  for (const [px, py, pr] of pts.concat(plates)) {
    const dx = Math.max(Math.abs(px - x) - hw, 0), dy = Math.max(top - py, py - bot, 0);
    c = Math.min(c, Math.hypot(dx, dy) - pr);
  }
  for (const sp of SPOTS) {
    const dx = Math.max(Math.abs(sp.x - x) - (hw + sp.w * 0.46), 0), dy = Math.max(top - sp.y, sp.y - sp.h * 0.92 - bot, 0);
    c = Math.min(c, Math.hypot(dx, dy) - 4);
  }
  return c;
}
function standeeSpots() {
  if (SPOTS) return SPOTS;
  const pts = NODES.filter((n) => n.type !== 'tower').map((n) => [n.x, n.y, spaceR(n) + 3]);
  const plates = (GEO.labels || []).filter((L) => L.at && L.kind !== 'street').map((L) => [L.at[0], L.at[1], L.kind === 'district' ? 30 : 22]);
  SPOTS = [];
  for (const sd0 of STANDEES) {
    const im = Assets.img('standee-' + sd0.art); const sd = { ...sd0, h: sd0.w * (im ? im.height / im.width : 1) };
    let base = null, R = 0;
    if (sd.at && GEO.standees && GEO.standees[sd.at]) { base = GEO.standees[sd.at]; R = sd.nudge || 0; }
    else if (sd.near && GEO.landmarks && GEO.landmarks[sd.near]) { base = GEO.landmarks[sd.near]; R = sd.w * 0.75 + 26; }
    if (!base) continue;
    let best = -1e9, at = base;
    // the true spot first, then rings outwards; the further it moves the more it costs
    const cands = [[base[0], base[1]]];
    for (const rr of [R * 0.35, R * 0.7, R]) for (let k = 0; k < 16; k++) { const ang = (k / 16) * Math.PI * 2; cands.push([base[0] + Math.cos(ang) * rr, base[1] + Math.sin(ang) * rr * 0.85]); }
    for (const [x, y] of cands) {
      let c = standeeClear(sd, x, y, sd.behind ? pts.filter(([px, py]) => Math.hypot(px - base[0], py - base[1]) > 6) : pts, plates);
      c -= Math.hypot(x - base[0], y - base[1]) * (sd.at ? 0.25 : 0.08);
      if (c > best) { best = c; at = [x, y]; }
    }
    SPOTS.push({ ...sd, x: at[0], y: at[1] });
  }
  return SPOTS;
}
function drawStandees(g) {
  for (const sd of standeeSpots()) {
    const im = Assets.img('standee-' + sd.art); if (!im) continue;
    const ww = sd.w, h = sd.h;
    g.save(); g.fillStyle = 'rgba(20,24,12,0.35)'; g.beginPath(); g.ellipse(sd.x + 6, sd.y + 1, ww * 0.42, ww * 0.12, -0.12, 0, Math.PI * 2); g.fill(); g.restore();
    g.save(); g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 4; g.shadowOffsetX = 2; g.shadowOffsetY = 2;
    g.drawImage(im, sd.x - ww / 2, sd.y - h * 0.94, ww, h); g.restore();
  }
}
export const towerTopY = () => { const sd = standeeSpots().find((x) => x.art === 'tower'); const im = Assets.img('standee-tower');
  return sd && im ? [sd.x, sd.y - sd.h * 0.94 + 10] : GEO.tower ? GEO.tower.top : null; };

// ---------- vector fallback board (no art) ----------
function drawVectorBoard(g, T) {
  const grd = g.createLinearGradient(0, 0, 0, BH); grd.addColorStop(0, T.hill2); grd.addColorStop(0.5, T.valley); grd.addColorStop(1, T.hill);
  g.fillStyle = grd; g.fillRect(0, 0, BW, BH);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [w, col] of [[13, T.shadow], [10, T.brick]]) {
    g.lineWidth = w; g.strokeStyle = col;
    for (const e of GEO.edges || []) { g.beginPath(); e.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
  }
}

// ---------- labels and vignette rings (static) ----------
const SERIF = '"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif';
function plate(g, T, x, y, text, sub, accent, size = 13) {
  g.font = `700 ${size}px ${SERIF}`; const tw = g.measureText(text).width;
  const ss = Math.max(9.5, size * 0.72);
  g.font = `600 ${ss}px system-ui,sans-serif`; const sw = sub ? g.measureText(sub).width : 0;
  const w = Math.max(tw, sw) + 18, h = size + (sub ? ss * 1.1 : 0) + 9;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 5; g.shadowOffsetY = 2;
  g.fillStyle = '#2f2a22'; roundRect(g, x - w / 2, y - h / 2, w, h, 4); g.fill();
  g.restore();
  g.strokeStyle = '#c9a14a'; g.lineWidth = 1.3; roundRect(g, x - w / 2 + 1.5, y - h / 2 + 1.5, w - 3, h - 3, 3); g.stroke();
  if (accent) { g.fillStyle = accent; g.fillRect(x - w / 2 + 3, y - h / 2 + 3, 3.5, h - 6); }
  g.fillStyle = '#f3e9d2'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${size}px ${SERIF}`; g.fillText(text, x + (accent ? 2 : 0), y - (sub ? size * 0.36 : 0) + 0.5);
  if (sub) { g.font = `600 ${ss}px system-ui,sans-serif`; g.fillStyle = '#e2d2ae'; g.fillText(sub, x + (accent ? 2 : 0), y + size * 0.5); }
  return { w, h };
}
function drawPlates(g, T) {
  for (const L of GEO.labels || []) {
    if ((L.kind === 'vignette' || L.kind === 'ring') && L.ring) {
      g.save(); g.setLineDash([3, 4]); g.lineWidth = 1.6; g.strokeStyle = 'rgba(255,248,230,0.75)';
      g.beginPath(); L.ring.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke(); g.restore();
    }
  }
  for (const L of GEO.labels || []) {
    if (!L.at) continue;
    const [x, y] = L.at;
    if (L.kind === 'district') {
      const d = DISTRICT[L.key]; const cat = d && CAT[d.cat];
      if (L.key === 'row') { const r = rowPlate(); if (r) { plate(g, T, r[0], r[1], L.text, null, cat ? cat.color : null, 14); continue; } }
      if (L.anchor) { g.strokeStyle = 'rgba(47,42,34,0.8)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(L.anchor[0], L.anchor[1]); g.stroke(); }
      plate(g, T, x, y, L.text, L.sub || null, cat ? cat.color : null, 14);
    } else if (L.kind === 'vignette') {
      plate(g, T, x, y, L.text, L.truth ? `${L.truth} · moved closer` : null, null, 12.5);
    } else if (L.kind === 'mountain') {
      if (GEO.tower && L.text === 'Hot Springs Mountain') continue;   // named on the tower plate
      g.font = `italic 700 12px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 3.2; g.strokeStyle = 'rgba(20,28,16,0.7)'; g.strokeText(L.text, x, y); g.fillStyle = '#f6f0dc'; g.fillText(L.text, x, y);
    } else if (L.kind === 'street') {
      g.save(); g.translate(x, y); const a = L.dir ? Math.atan2(L.dir[1], L.dir[0]) : 0; g.rotate(Math.abs(a) > Math.PI / 2 ? a + Math.PI : a);
      g.font = `700 8.5px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(70,58,42,0.75)'; g.fillText(L.text.toUpperCase().split('').join(' '), 0, 0); g.restore();
    }
  }
  // the goal: a plate on a leader line above the rendered Mountain Tower
  const tt = towerTopY();
  if (tt) {
    const [tx, ty0] = tt; const ty = Math.max(ty0, 30); const px = tx + 92, py = ty + 26;
    g.strokeStyle = 'rgba(47,42,34,0.85)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(tx + 2, ty - 2); g.lineTo(px - 30, py + 4); g.stroke();
    g.fillStyle = '#c9a14a'; g.beginPath(); g.arc(tx, ty, 2.6, 0, 7); g.fill();
    plate(g, T, px, py, '★ Mountain Tower', 'the Summit · Hot Springs Mountain', '#c9a14a', 12.5);
  }
  // legend and credits (OSM data is ODbL: attribution must be visible with the map)
  g.font = '600 10.5px system-ui,sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const lines = ['Downtown true to layout · directions true · far places moved closer · map data © OpenStreetMap, USGS, US Census'];
  lines.forEach((t, i) => { const y = BH - 10 - (lines.length - 1 - i) * 12; g.lineWidth = 2.6; g.strokeStyle = 'rgba(20,24,16,0.7)'; g.strokeText(t, 64, y); g.fillStyle = 'rgba(250,244,228,0.95)'; g.fillText(t, 64, y); });
  // compass: north on this board points screen-left
  const n = GEO.north || [-1, 0]; const a = Math.atan2(n[1], n[0]);
  const cx = 32, cy = BH - 34;
  g.save(); g.translate(cx, cy);
  g.fillStyle = 'rgba(47,42,34,0.88)'; g.beginPath(); g.arc(0, 0, 24, 0, 7); g.fill();
  g.strokeStyle = '#c9a14a'; g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, 21.5, 0, 7); g.stroke();
  for (let k = 0; k < 4; k++) { g.save(); g.rotate(a + k * Math.PI / 2); g.fillStyle = k ? 'rgba(243,233,210,0.55)' : '#f3e9d2'; g.beginPath(); g.moveTo(k ? 13 : 18, 0); g.lineTo(0, -3.6); g.lineTo(0, 3.6); g.closePath(); g.fill(); g.restore(); }
  g.font = '700 9px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f3e9d2';
  g.fillText('N', Math.cos(a) * 20 + (Math.cos(a) < 0 ? -10 : 10), Math.sin(a) * 20 + 0.5);
  g.restore();
}

// Bathhouse Row's plate: above (east of) the Row's spaces, between the Hale and the Fordyce.
function rowPlate() {
  const row = NODES.filter((n) => n.district === 'row' && n.type !== 'trailhead');
  if (!row.length) return null;
  const xs = row.map((n) => n.x), ys = row.map((n) => n.y);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, Math.min(...ys) - 44];
}

// ---------- spaces (static): enamel discs set into the stone pavers ----------
const RADIUS = { landmark: 19, start: 16.5, trail: 7 };   // the baked pavers are ~1.5 u wider (tools/map/route.py)
export const spaceR = (n) => RADIUS[n.type] || 15.2;
function ell(g, x, y, r) { g.beginPath(); g.ellipse(x, y, r, r * SQ, 0, 0, Math.PI * 2); }
function icon(g, kind, x, y, s, ink) { g.save(); g.translate(x, y); g.scale(1, SQ); drawIcon(g, kind, 0, 0, s, ink); g.restore(); }
function drawSpaces(g, T) {
  for (const n of NODES) {
    if (n.type === 'tower') continue;
    const r = spaceR(n);
    if (n.type === 'trail') {
      g.fillStyle = 'rgba(0,0,0,0.35)'; ell(g, n.x + 0.6, n.y + 1.2, r + 0.8); g.fill();
      g.fillStyle = '#5E4B3C'; ell(g, n.x, n.y, r + (n.steep ? 1.5 : 0)); g.fill();
      g.strokeStyle = '#EDE3C8'; g.lineWidth = 1.3; g.stroke();
      if (n.steep) { g.fillStyle = '#EDE3C8'; g.font = 'bold 7px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2', n.x, n.y + 0.4); }
      continue;
    }
    const cat = n.cat && CAT[n.cat];
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 3; g.shadowOffsetY = 1.5;
    g.fillStyle = n.type === 'landmark' ? '#8a6a2a' : '#f7f1e3'; ell(g, n.x, n.y, r + (n.type === 'landmark' ? 3.2 : 1.6)); g.fill();
    g.restore();
    if (n.type === 'landmark') {
      const br = g.createLinearGradient(n.x - r, n.y - r, n.x + r, n.y + r);
      br.addColorStop(0, '#f3d98a'); br.addColorStop(0.5, '#c9a14a'); br.addColorStop(1, '#8a6a2a');
      g.fillStyle = br; ell(g, n.x, n.y, r + 2.6); g.fill();
    }
    if (n.type === 'cat' || n.type === 'landmark') {
      const fc = g.createRadialGradient(n.x - r * 0.35, n.y - r * 0.45, r * 0.1, n.x, n.y, r * 1.05);
      fc.addColorStop(0, shade(cat.color, 0.3)); fc.addColorStop(1, cat.color);
      g.fillStyle = fc; ell(g, n.x, n.y, r); g.fill();
      icon(g, cat.icon, n.x, n.y, r * 0.74, cat.ink);
    } else {
      const ring = n.type === 'vent' ? '#2A9D8F' : n.type === 'jury' ? '#9A2A1C' : n.type === 'start' ? '#C9A14A' : '#1F2F5C';
      g.fillStyle = '#FBF6EA'; ell(g, n.x, n.y, r); g.fill();
      g.lineWidth = 2.2; g.strokeStyle = ring; ell(g, n.x, n.y, r - 1.1); g.stroke();
      icon(g, SPECIAL_ICON[n.type] || 'dot', n.x, n.y, r * 0.6, n.type === 'vent' ? '#1F7F74' : n.type === 'jury' ? '#9A2A1C' : n.type === 'start' ? '#9a7426' : '#1F2F5C');
    }
    // enamel gloss
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.ellipse(n.x - r * 0.25, n.y - r * 0.38 * SQ, r * 0.55, r * 0.22, -0.35, 0, Math.PI * 2); g.fill();
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
    animate(dur, (k) => {
      const e = easeInOut(k); let s = e * L, j = 0;
      while (j < seg.length - 1 && s > seg[j]) { s -= seg[j]; j++; }
      const f = seg[j] ? Math.min(1, s / seg[j]) : 1;
      tp.x = lerp(pts[j][0], pts[j + 1][0], f); tp.y = lerp(pts[j][1], pts[j + 1][1], f);
      tp.lift = Math.sin(Math.PI * k) * height; tp.sq = k > 0.88 ? (1 - k) * 2.2 : 0;
    }, () => {
      tp.lift = 0; tp.sq = 0; const n = NODES[to]; tp.x = n.x; tp.y = n.y;
      dust(tp.x, tp.y);
      onHop && onHop(to); prev = to; i++; hop();
    });
  };
  hop();
}

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
    g.forEach((p, i) => { const tp = tokenPos(p); const off = g.length > 1 ? 9 : 0; const a = (i / g.length) * Math.PI * 2 - Math.PI / 2; list.push({ p, x: tp.x + Math.cos(a) * off, y: tp.y + Math.sin(a) * off * SQ, lift: tp.lift, sq: tp.sq || 0 }); });
  }
  list.sort((a, b) => a.y - b.y);
  const activeId = trail.players[trail.turn].id;
  for (const it of list) {
    const act = it.p.id === activeId;
    const bob = act && !view.reduced && !it.lift ? Math.abs(Math.sin(view.time * 3)) * 2.2 : 0;
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
      ctx.drawImage(spr, it.x - TOK.fx * k * sx, it.y - lift - TOK.fy * k * sy, w, h);
    } else {
      drawVectorToken(ctx, it.p.shape, it.p.color, it.x, it.y, 8.5, { lift: lift + 6, active: false, T });
    }
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
