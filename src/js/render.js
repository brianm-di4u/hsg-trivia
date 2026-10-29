// Board renderer: cached background layer (terrain, route, spaces, labels) + per-frame dynamic layer
// (highlights, steam, tokens, effects), with a camera that fits the map or follows the active token.
import { THEMES, drawTerrain, drawRoute, drawLandmarks, drawIcon, drawToken, drawTower, roundRect, SPECIAL_ICON, LAKES } from './art.js';
import { NODES, ADJ, DISTRICTS, TOWER, VENT_PAIRS, START } from './board.js';
import { CAT } from './data.js';
import { easeInOut, lerp, makeRng } from './util.js';

const W = 1000;
export const view = {
  canvas: null, ctx: null, w: 0, h: 0, dpr: 1, theme: 'light', T: THEMES.light,
  cache: null, cacheKey: '', cam: { x: 500, y: 500, z: 1 }, camTarget: { x: 500, y: 500, z: 1 },
  mode: 'fit', backdrop: true, reduced: false, tok: {}, anims: [], particles: [], drag: null, manual: false, time: 0,
};

const EDGES = [];
ADJ.forEach((nbs, a) => nbs.forEach((b) => { if (a < b) EDGES.push([a, b]); }));

export function initView(canvas) {
  view.canvas = canvas; view.ctx = canvas.getContext('2d');
  const ro = new ResizeObserver(() => resize()); ro.observe(canvas.parentElement);
  resize();
}

export function resize() {
  const el = view.canvas.parentElement; const r = el.getBoundingClientRect();
  view.dpr = Math.min(2, window.devicePixelRatio || 1);
  view.w = Math.max(1, r.width); view.h = Math.max(1, r.height);
  view.canvas.width = Math.round(view.w * view.dpr); view.canvas.height = Math.round(view.h * view.dpr);
  view.canvas.style.width = view.w + 'px'; view.canvas.style.height = view.h + 'px';
  snapCamera();
}

export function setTheme(name) { view.theme = name; view.T = THEMES[name]; view.cacheKey = ''; }

const baseScale = () => (view.backdrop ? Math.max(view.w, view.h) / W * 1.04 : Math.min(view.w, view.h) / W * 0.98);
export const isZoomed = () => view.mode === 'follow';

function ensureCache() {
  const res = Math.min(2400, Math.ceil(W * baseScale() * view.dpr * (view.backdrop ? 1 : 2.0)));
  const key = view.theme + ':' + Math.max(1000, Math.round(res / 200) * 200);
  if (key === view.cacheKey) return;
  const size = Math.max(1000, Math.round(res / 200) * 200);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.scale(size / W, size / W);
  const T = view.T;
  drawTerrain(g, T, NODES, EDGES);
  drawLandmarks(g, T);
  drawRoute(g, T, NODES, EDGES);
  drawSpaces(g, T);
  drawLabels(g, T);
  view.cache = c; view.cacheKey = key;
}

function drawSpaces(g, T) {
  for (const n of NODES) {
    if (n.type === 'tower') continue;
    if (n.type === 'trail') {
      g.fillStyle = '#5E4B3C'; g.beginPath(); g.arc(n.x, n.y, n.steep ? 10 : 8, 0, 7); g.fill();
      g.strokeStyle = '#EDE3C8'; g.lineWidth = 1.6; g.stroke();
      if (n.steep) { g.fillStyle = '#EDE3C8'; g.font = 'bold 9px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2', n.x, n.y + 0.5); }
      continue;
    }
    const cat = n.cat && CAT[n.cat];
    const r = n.type === 'landmark' ? 21 : 15.5;
    g.fillStyle = T.shadow; g.beginPath(); g.arc(n.x + 1.5, n.y + 2.5, r, 0, 7); g.fill();
    if (n.type === 'cat' || n.type === 'landmark') {
      g.fillStyle = cat.color; g.beginPath(); g.arc(n.x, n.y, r, 0, 7); g.fill();
      if (n.type === 'landmark') {
        g.lineWidth = 4; g.strokeStyle = '#D9A23A'; g.stroke();
        g.lineWidth = 1.5; g.strokeStyle = '#3E3528'; g.beginPath(); g.arc(n.x, n.y, r + 2.5, 0, 7); g.stroke();
      } else { g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.stroke(); }
      drawIcon(g, cat.icon, n.x, n.y, r * 0.62, cat.ink);
    } else {
      g.fillStyle = T.space; g.beginPath(); g.arc(n.x, n.y, r, 0, 7); g.fill();
      g.lineWidth = 2.4; g.strokeStyle = n.type === 'vent' ? '#2A9D8F' : n.type === 'jury' ? '#9A2A1C' : n.type === 'start' ? '#D9A23A' : T.spaceInk; g.stroke();
      drawIcon(g, SPECIAL_ICON[n.type] || 'dot', n.x, n.y, r * 0.62, n.type === 'vent' ? '#1F7F74' : n.type === 'jury' ? '#9A2A1C' : T.spaceInk);
    }
  }
}

function sign(g, T, x, y, text, size = 15) {
  g.font = `bold ${size}px "Palatino Linotype","Book Antiqua",Palatino,Georgia,serif`;
  const w = g.measureText(text).width + 16, h = size + 10;
  g.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(g, x - w / 2 + 2, y - h / 2 + 2, w, h, 4); g.fill();
  g.fillStyle = T.label; roundRect(g, x - w / 2, y - h / 2, w, h, 4); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
  for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(x - w / 2 + 4, y - h / 2 + (h * i) / 3); g.lineTo(x + w / 2 - 4, y - h / 2 + (h * i) / 3 + 0.5); g.stroke(); }
  g.fillStyle = T.labelInk; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y + 1);
}

function drawLabels(g, T) {
  for (const d of DISTRICTS) sign(g, T, d.label[0], d.label[1], d.name, 15);
  sign(g, T, 842, 280, 'Mountain Tower', 13);
  sign(g, T, 735, 640, 'Hot Springs Mtn', 12);
  g.font = 'italic 13px Georgia,serif'; g.fillStyle = T.waterLine; g.textAlign = 'center';
  for (const l of LAKES) { g.fillStyle = '#E8F6F4'; g.globalAlpha = 0.9; g.fillText(l.name, l.cx, l.cy + (l.name === 'Lake Ouachita' ? 30 : 4)); g.globalAlpha = 1; }
}

// ---------- camera ----------
// Backdrop center: the map middle, or a focus point placed at `at` (0–1) of the screen height.
function backdropCenter() {
  const f = view.backdropFocus; if (!f) return { x: 500, y: 500 };
  return { x: f.x, y: f.y - ((f.at ?? 0.5) - 0.5) * view.h / baseScale() };
}
export function setCameraMode(mode) { view.mode = mode; view.manual = false; }
function camGoal(focus) {
  if (view.backdrop) return { ...backdropCenter(), z: 1 };
  if (view.mode === 'follow' && focus) {
    const z = view.w < 600 ? 1.9 : 1.6;
    const s = baseScale() * z; const hw = view.w / 2 / s, hh = view.h / 2 / s;
    return { x: Math.min(Math.max(focus.x, hw - 30), W - hw + 30), y: Math.min(Math.max(focus.y, hh - 30), W - hh + 30), z };
  }
  return { x: 500, y: 500, z: 1 };
}
export function snapCamera(focus) { const g = camGoal(focus || view.focus); Object.assign(view.cam, g); Object.assign(view.camTarget, g); }
export const camSettled = () => view.backdrop || Math.abs(view.cam.x - view.camTarget.x) < 0.5 && Math.abs(view.cam.y - view.camTarget.y) < 0.5 && Math.abs(view.cam.z - view.camTarget.z) < 0.003;

export function worldToScreen(x, y) { const s = baseScale() * view.cam.z; return [(x - view.cam.x) * s + view.w / 2, (y - view.cam.y) * s + view.h / 2]; }
export function screenToWorld(x, y) { const s = baseScale() * view.cam.z; return [(x - view.w / 2) / s + view.cam.x, (y - view.h / 2) / s + view.cam.y]; }

export function panBy(dx, dy) {
  const s = baseScale() * view.cam.z; view.manual = true;
  view.camTarget.x = view.cam.x = Math.min(W, Math.max(0, view.cam.x - dx / s));
  view.camTarget.y = view.cam.y = Math.min(W, Math.max(0, view.cam.y - dy / s));
}

// ---------- tokens and animation ----------
export function tokenPos(p) { if (!view.tok[p.id]) { const n = NODES[p.node]; view.tok[p.id] = { x: n.x, y: n.y, lift: 0 }; } return view.tok[p.id]; }
export function resetTokens() { view.tok = {}; view.anims = []; view.particles = []; }

export function animate(dur, update, done) {
  if (view.reduced || dur <= 0) { update(1); done && done(); return; }
  view.anims.push({ t: 0, dur, update, done });
}
// Completes every running tween, including hops queued by earlier tweens' callbacks.
export function finishAnims() {
  for (let guard = 0; view.anims.length && guard < 500; guard++) { const a = view.anims; view.anims = []; for (const x of a) { x.update(1); x.done && x.done(); } }
  Object.assign(view.cam, view.camTarget);
}
export const isAnimating = () => view.anims.length > 0;

// Hop along a path (or one arcing jump), calling onHop for each space and done at the end.
export function moveAlong(p, path, done, { mode = 'walk', onHop } = {}) {
  const tp = tokenPos(p);
  if (view.reduced) { const n = NODES[path[path.length - 1]]; tp.x = n.x; tp.y = n.y; tp.lift = 0; done(); return; }
  const steps = mode === 'jump' ? [path[path.length - 1]] : path.slice(1);
  let i = 0;
  const hop = () => {
    if (i >= steps.length) { done(); return; }
    const from = { x: tp.x, y: tp.y }; const to = NODES[steps[i]];
    const dur = mode === 'jump' ? 650 : 190;
    const height = mode === 'jump' ? 70 : 10;
    animate(dur, (k) => { const e = easeInOut(k); tp.x = lerp(from.x, to.x, e); tp.y = lerp(from.y, to.y, e); tp.lift = Math.sin(Math.PI * k) * height; }, () => {
      tp.lift = 0; onHop && onHop(steps[i]); i++; hop();
    });
  };
  hop();
}

export function burst(x, y, colors, n = 26, kind = 'spark') {
  if (view.reduced) return;
  const r = makeRng((x * 31 + y * 17 + view.time) | 0);
  for (let i = 0; i < n; i++) {
    const a = r.next() * Math.PI * 2, sp = 60 + r.next() * 160;
    view.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'confetti' ? 120 : 40), life: 0, max: 0.9 + r.next() * 0.8, c: colors[i % colors.length], kind, s: 2 + r.next() * 3, rot: r.next() * 6 });
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
  // camera ease
  const trail = st && st.trail;
  const active = trail && st.mode === 'trail' && !view.backdrop ? trail.players[trail.turn] : null;
  view.focus = active ? tokenPos(active) : null;
  if (!view.manual) Object.assign(view.camTarget, camGoal(view.focus));
  const k = view.reduced ? 1 : Math.min(1, dt * 5);
  view.cam.x = lerp(view.cam.x, view.camTarget.x, k); view.cam.y = lerp(view.cam.y, view.camTarget.y, k); view.cam.z = lerp(view.cam.z, view.camTarget.z, k);
  if (view.backdrop && !view.reduced) { const f = backdropCenter(); view.cam.x = f.x + Math.sin(view.time * 0.05) * 18; view.cam.y = f.y + Math.cos(view.time * 0.04) * 12; }
  draw(st);
}

function draw(st) {
  const { ctx, dpr } = view; const T = view.T;
  ensureCache();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = T.paper; ctx.fillRect(0, 0, view.w, view.h);
  const s = baseScale() * view.cam.z;
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (view.w / 2 - view.cam.x * s), dpr * (view.h / 2 - view.cam.y * s));
  ctx.drawImage(view.cache, 0, 0, W, W);
  const trail = st && st.mode === 'trail' && !view.backdrop ? st.trail : null;
  const active = trail ? trail.players[trail.turn] : null;
  const el = active && active.stamps.length >= trail.target;
  drawTower(ctx, T, NODES[TOWER].x, NODES[TOWER].y + 8, el ? 0.6 + 0.4 * Math.sin(view.time * 4) : 0);
  drawSteam(ctx);
  if (trail) {
    // stamps the active player already holds: small check on those landmarks
    for (const cat of active.stamps) {
      const n = NODES.find((x) => x.type === 'landmark' && x.cat === cat);
      ctx.fillStyle = '#2E6A3C'; ctx.beginPath(); ctx.arc(n.x + 15, n.y - 15, 7, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(n.x + 11.5, n.y - 15); ctx.lineTo(n.x + 14.5, n.y - 12); ctx.lineTo(n.x + 19, n.y - 18.5); ctx.stroke();
    }
    if (trail.phase === 'choose') drawDests(ctx, trail, T);
    if (trail.phase === 'warp' && trail.pending) drawTargets(ctx, trail.pending.options, T);
    drawTokens(ctx, trail, T);
  }
  drawParticles(ctx);
}

function drawDests(ctx, trail, T) {
  const pulse = view.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(view.time * 6);
  const p = trail.players[trail.turn];
  const sel = trail.dests[trail.sel];
  if (sel) {
    ctx.save(); ctx.strokeStyle = p.color === '#F4F1EA' ? '#1F2A24' : p.color; ctx.lineWidth = 5; ctx.setLineDash([2, 7]); ctx.lineCap = 'round';
    ctx.beginPath(); sel.path.forEach((id, i) => { const n = NODES[id]; i ? ctx.lineTo(n.x, n.y) : ctx.moveTo(n.x, n.y); }); ctx.stroke(); ctx.restore();
  }
  trail.dests.forEach((d, i) => {
    const n = NODES[d.node]; const isSel = i === trail.sel;
    const r = (NODES[d.node].type === 'landmark' ? 25 : 20) + pulse * 4 + (isSel ? 4 : 0);
    ctx.lineWidth = isSel ? 5 : 3.5; ctx.strokeStyle = isSel ? '#FFFFFF' : T.glow;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 7); ctx.stroke();
    ctx.lineWidth = isSel ? 2.5 : 1.5; ctx.strokeStyle = '#1F2A24'; ctx.beginPath(); ctx.arc(n.x, n.y, r + 3, 0, 7); ctx.stroke();
    // numbered badge (keyboard: 1–9)
    const bx = n.x + r * 0.75, by = n.y - r * 0.75;
    ctx.fillStyle = isSel ? '#1F2A24' : '#FFFFFF'; ctx.beginPath(); ctx.arc(bx, by, 9, 0, 7); ctx.fill();
    ctx.strokeStyle = '#1F2A24'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = isSel ? '#FFFFFF' : '#1F2A24'; ctx.font = 'bold 11px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), bx, by + 0.5);
  });
}

function drawTargets(ctx, ids, T) {
  const pulse = view.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(view.time * 6);
  for (const id of ids) { const n = NODES[id]; ctx.lineWidth = 4; ctx.strokeStyle = T.glow; ctx.beginPath(); ctx.arc(n.x, n.y, 26 + pulse * 5, 0, 7); ctx.stroke(); }
}

function drawTokens(ctx, trail, T) {
  const groups = {};
  for (const p of trail.players) { const tp = tokenPos(p); const key = Math.round(tp.x) + ',' + Math.round(tp.y); (groups[key] = groups[key] || []).push(p); }
  const list = [];
  for (const key in groups) {
    const g = groups[key];
    g.forEach((p, i) => { const tp = tokenPos(p); const off = g.length > 1 ? 11 : 0; const a = (i / g.length) * Math.PI * 2 - Math.PI / 2; list.push({ p, x: tp.x + Math.cos(a) * off, y: tp.y + Math.sin(a) * off, lift: tp.lift }); });
  }
  list.sort((a, b) => a.y - b.y);
  const activeId = trail.players[trail.turn].id;
  for (const it of list) {
    const bob = it.p.id === activeId && !view.reduced && !it.lift ? Math.abs(Math.sin(view.time * 3)) * 3 : 0;
    drawToken(ctx, it.p.shape, it.p.color, it.x, it.y, 10, { lift: it.lift + 6 + bob, active: it.p.id === activeId, T });
  }
}

// Steam wisps from the vents and behind the Row (motif 7), deterministic per time.
function drawSteam(ctx) {
  if (view.reduced) return;
  const t = view.time;
  const srcs = VENT_PAIRS.flat().map((id) => NODES[id]).concat([{ x: 532, y: 400 }, { x: 532, y: 470 }, { x: 532, y: 540 }]);
  ctx.save(); ctx.strokeStyle = view.T.steam; ctx.lineCap = 'round';
  srcs.forEach((n, si) => {
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.45 + k / 3 + si * 0.37) % 1;
      const y0 = n.y - 8 - ph * 46; const x0 = n.x + (k - 1) * 6;
      ctx.globalAlpha = (1 - ph) * 0.8; ctx.lineWidth = 3 + ph * 4;
      ctx.beginPath(); ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + Math.sin(t * 2 + k + si) * 8, y0 - 8, x0 + Math.sin(t * 1.5 + k) * 4, y0 - 16); ctx.stroke();
    }
  });
  ctx.restore();
}

function drawParticles(ctx) {
  const dt = 1 / 60;
  view.particles = view.particles.filter((q) => (q.life += dt) < q.max);
  for (const q of view.particles) {
    q.vy += 260 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.98; q.rot += dt * 6;
    ctx.globalAlpha = 1 - q.life / q.max; ctx.fillStyle = q.c;
    if (q.kind === 'confetti') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillRect(-q.s, -q.s / 2, q.s * 2, q.s); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(q.x, q.y, q.s, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

export function hitDest(sx, sy, trail) {
  const [x, y] = screenToWorld(sx, sy);
  let best = null, bd = 30 * 30;
  const ids = trail.phase === 'choose' ? trail.dests.map((d) => d.node) : trail.phase === 'warp' ? trail.pending.options : [];
  for (const id of ids) { const n = NODES[id]; const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = id; } }
  return best;
}
export { START };
