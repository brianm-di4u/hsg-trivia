// Procedural art: map terrain, landmark vignettes, category/space icons, tokens, stamps.
// Palettes are copied from shared/design/tokens.js (gilded-spa, thermal-water, ouachita-forest,
// nps-rustic, deco-neon); every hex there is an estimate (shared/design/README.md).
import { makeRng } from './util.js';

export const THEMES = {
  light: {
    paper: '#EFE6CF', paperEdge: '#D9C9A3', valley: '#E6D7B5', hill: '#B9C08A', hill2: '#97A66A', hillLine: '#7E8F5A',
    pine: '#2F4A2C', pine2: '#3B5E35', trunk: '#5A4330', water: '#2A8C99', waterDeep: '#1F5F6B', waterLine: '#BFE3E0',
    street: '#D9C9A3', streetLine: '#B8A57E', block: '#D4C29A', roof: '#A9432C', brick: '#B5654A', mortar: '#EAD9B8',
    text: '#1F2A24', label: '#3E3528', labelInk: '#EDE3C8', cream: '#F2EFE8', stucco: '#E8DFC9', tile: '#A9432C',
    green: '#4E7D5B', cobalt: '#2B4C9B', brass: '#D9A23A', steel: '#8C877C', track: '#C9A574', grass: '#8DB06A',
    space: '#FBF6EA', spaceInk: '#1F2F5C', shadow: 'rgba(31,42,36,0.28)', steam: 'rgba(255,255,255,0.55)', glow: '#D9A23A',
  },
  dark: {
    paper: '#14121F', paperEdge: '#2A2540', valley: '#1F1C2E', hill: '#22342A', hill2: '#1B2B22', hillLine: '#34503C',
    pine: '#0F2116', pine2: '#183322', trunk: '#3A2D22', water: '#123F4C', waterDeep: '#0C2C36', waterLine: '#2F7F8C',
    street: '#2B2740', streetLine: '#3A3550', block: '#272338', roof: '#7E2F1F', brick: '#7C3B2A', mortar: '#3E3226',
    text: '#D8CFBD', label: '#5E4B3C', labelInk: '#EDE3C8', cream: '#D8CFBD', stucco: '#BDB4A2', tile: '#B04A32',
    green: '#4E7D5B', cobalt: '#4F7BD9', brass: '#D4AF37', steel: '#9A95A0', track: '#5A4636', grass: '#2C4A2E',
    space: '#2A2638', spaceInk: '#D8CFBD', shadow: 'rgba(0,0,0,0.5)', steam: 'rgba(220,235,240,0.35)', glow: '#4FC3FF',
  },
};

export const TOKEN_SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon'];
export const TOKEN_COLORS = ['#D7263D', '#1D5BD6', '#14904A', '#F2A90C', '#8A43C4', '#F4F1EA'];
export const TOKEN_NAMES = ['Red circle', 'Blue square', 'Green triangle', 'Gold diamond', 'Purple star', 'White hexagon'];

// ---------- primitive helpers ----------
function blob(ctx, cx, cy, rx, ry, seed, wobble = 0.18, n = 18) {
  const r = makeRng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (r.next() - 0.5) * 2 * wobble;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p0 = pts[i], p1 = pts[(i + 1) % n];
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(p0[0], p0[1], mx, my);
  }
  const p0 = pts[0], p1 = pts[1];
  ctx.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
  ctx.closePath();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function pine(ctx, x, y, h, T) {
  ctx.fillStyle = T.trunk; ctx.fillRect(x - 1.2, y - h * 0.15, 2.4, h * 0.2);
  ctx.fillStyle = T.pine;
  for (let i = 0; i < 3; i++) {
    const w = h * (0.42 - i * 0.1), top = y - h * (0.35 + i * 0.25), base = y - h * (0.1 + i * 0.25);
    ctx.beginPath(); ctx.moveTo(x, top - h * 0.2); ctx.lineTo(x + w, base); ctx.lineTo(x - w, base); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = T.pine2; ctx.beginPath(); ctx.moveTo(x, y - h * 1.05); ctx.lineTo(x + h * 0.12, y - h * 0.7); ctx.lineTo(x, y - h * 0.75); ctx.closePath(); ctx.fill();
}

// Catmull–Rom path through points (used for streets, creek and the route).
export function smoothPath(ctx, pts, closed = false) {
  if (pts.length < 2) return;
  ctx.moveTo(pts[0][0], pts[0][1]);
  const n = pts.length;
  for (let i = 0; i < n - (closed ? 0 : 1); i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const a = closed || i > 0 ? p0 : p1, d = closed || i < n - 2 ? p3 : p2;
    ctx.bezierCurveTo(p1[0] + (p2[0] - a[0]) / 6, p1[1] + (p2[1] - a[1]) / 6, p2[0] - (d[0] - p1[0]) / 6, p2[1] - (d[1] - p1[1]) / 6, p2[0], p2[1]);
  }
}

// ---------- terrain ----------
export const LAKES = [
  { name: 'Lake Ouachita', cx: 178, cy: 690, rx: 70, ry: 58, seed: 11 },
  { name: 'Lake Hamilton', cx: 245, cy: 832, rx: 118, ry: 42, seed: 12 },
  { name: 'Lake Catherine', cx: 800, cy: 880, rx: 120, ry: 48, seed: 13 },
];
const MOUNTAINS = [
  { name: 'Hot Springs Mountain', cx: 820, cy: 480, rx: 150, ry: 130, seed: 21 },
  { name: 'North Mountain', cx: 470, cy: 70, rx: 230, ry: 95, seed: 22 },
  { name: 'West Mountain', cx: 255, cy: 560, rx: 70, ry: 85, seed: 23 },
  { name: 'Sugarloaf', cx: 900, cy: 120, rx: 140, ry: 110, seed: 24 },
];

export function drawTerrain(ctx, T, nodes, edges) {
  ctx.fillStyle = T.paper; ctx.fillRect(-50, -50, 1100, 1100);
  // valley floor
  ctx.fillStyle = T.valley; blob(ctx, 500, 520, 470, 440, 3, 0.08, 24); ctx.fill();
  // mountains: stacked contour blobs
  for (const m of MOUNTAINS) {
    for (let k = 0; k < 4; k++) {
      const f = 1 - k * 0.22;
      ctx.fillStyle = k % 2 ? T.hill2 : T.hill;
      blob(ctx, m.cx, m.cy - k * 6, m.rx * f, m.ry * f, m.seed + k, 0.16, 20); ctx.fill();
      ctx.strokeStyle = T.hillLine; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  // downtown blocks inside the downtown loop
  const blocks = makeRng(77);
  for (let y = 350; y < 690; y += 34) {
    for (let x = 418; x < 585; x += 30) {
      if (Math.abs(x - 500) < 14) continue; // Central Avenue street
      if (blocks.next() < 0.18) continue;
      ctx.fillStyle = T.block; ctx.fillRect(x, y, 24, 26);
      ctx.fillStyle = T.roof; ctx.globalAlpha = 0.35 + blocks.next() * 0.3; ctx.fillRect(x, y, 24, 6); ctx.globalAlpha = 1;
    }
  }
  // streets (real street names, stylized geometry)
  const street = (pts, w) => {
    ctx.beginPath(); smoothPath(ctx, pts); ctx.strokeStyle = T.streetLine; ctx.lineWidth = w + 3; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); smoothPath(ctx, pts); ctx.strokeStyle = T.street; ctx.lineWidth = w; ctx.stroke();
  };
  street([[505, 290], [500, 420], [500, 560], [492, 700], [470, 790], [440, 880]], 10); // Central Avenue
  street([[505, 290], [580, 250], [650, 210], [720, 170], [800, 130]], 8); // Park Avenue
  street([[505, 290], [430, 270], [340, 285], [250, 330], [170, 380]], 8); // Whittington Avenue
  // Hot Springs Creek: under the Row, then south to Lake Hamilton (town-content §3)
  ctx.save();
  ctx.setLineDash([2, 6]);
  ctx.beginPath(); smoothPath(ctx, [[540, 300], [528, 420], [528, 560], [515, 690]]); ctx.strokeStyle = T.water; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
  ctx.beginPath(); smoothPath(ctx, [[515, 690], [470, 770], [390, 812], [330, 828]]); ctx.strokeStyle = T.water; ctx.lineWidth = 4; ctx.stroke();
  // lakes
  for (const l of LAKES) {
    ctx.fillStyle = T.waterDeep; blob(ctx, l.cx, l.cy, l.rx + 4, l.ry + 4, l.seed, 0.22, 22); ctx.fill();
    ctx.fillStyle = T.water; blob(ctx, l.cx, l.cy, l.rx, l.ry, l.seed, 0.22, 22); ctx.fill();
    ctx.strokeStyle = T.waterLine; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(l.cx + i * l.rx * 0.4, l.cy + i * 6, 9, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  // race-track oval near Oaklawn (generic oval, no business marks)
  ctx.save(); ctx.translate(575, 905);
  ctx.fillStyle = T.track; ctx.beginPath(); ctx.ellipse(0, 0, 100, 42, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = T.grass; ctx.beginPath(); ctx.ellipse(0, 0, 80, 26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = T.cream; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, 90, 34, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  // pines, scattered away from the route, lakes and downtown
  const r = makeRng(99);
  const near = (x, y, d) => nodes.some((n) => (n.x - x) ** 2 + (n.y - y) ** 2 < d * d);
  const inLake = (x, y) => LAKES.some((l) => ((x - l.cx) / (l.rx + 10)) ** 2 + ((y - l.cy) / (l.ry + 10)) ** 2 < 1);
  const trees = [];
  for (let i = 0; i < 700 && trees.length < 260; i++) {
    const x = r.next() * 1000, y = 20 + r.next() * 980;
    if (x > 400 && x < 600 && y > 300 && y < 720) continue;
    if (x > 480 && x < 680 && y > 840) continue; // track
    if (near(x, y, 34) || inLake(x, y)) continue;
    const onHill = MOUNTAINS.some((m) => ((x - m.cx) / m.rx) ** 2 + ((y - m.cy) / m.ry) ** 2 < 1);
    if (!onHill && r.next() < 0.55) continue;
    trees.push([x, y, 10 + r.next() * 9]);
  }
  trees.sort((a, b) => a[1] - b[1]);
  for (const [x, y, h] of trees) pine(ctx, x, y, h, T);
  // paper edge vignette
  const g = ctx.createRadialGradient(500, 500, 420, 500, 500, 760);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, T.paperEdge);
  ctx.fillStyle = g; ctx.globalAlpha = 0.6; ctx.fillRect(-50, -50, 1100, 1100); ctx.globalAlpha = 1;
}

// ---------- route ----------
// Running-bond Promenade brick along every edge (visual-style-guide Motif 11).
export function drawRoute(ctx, T, nodes, edges) {
  const seg = (a, b) => [[a.x, a.y], [b.x, b.y]];
  ctx.lineCap = 'round';
  for (const [a, b] of edges) {
    const A = nodes[a], B = nodes[b];
    const trail = A.spur && B.spur || (A.spur || B.spur);
    ctx.beginPath(); smoothPath(ctx, seg(A, B));
    ctx.strokeStyle = T.shadow; ctx.lineWidth = trail ? 12 : 17; ctx.stroke();
  }
  for (const [a, b] of edges) {
    const A = nodes[a], B = nodes[b];
    const trail = A.spur || B.spur;
    ctx.beginPath(); smoothPath(ctx, seg(A, B));
    ctx.strokeStyle = trail ? '#8C6A3F' : T.brick; ctx.lineWidth = trail ? 9 : 14; ctx.stroke();
    ctx.save(); ctx.setLineDash(trail ? [3, 5] : [6, 4]); ctx.beginPath(); smoothPath(ctx, seg(A, B));
    ctx.strokeStyle = T.mortar; ctx.lineWidth = trail ? 2 : 1.4; ctx.globalAlpha = 0.75; ctx.stroke(); ctx.restore();
  }
}

// ---------- icons (centered, size s ≈ radius) ----------
export function drawIcon(ctx, kind, x, y, s, ink) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1.2, s * 0.13); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const L = (pts, close) => { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px * s, py * s) : ctx.moveTo(px * s, py * s))); if (close) ctx.closePath(); };
  switch (kind) {
    case 'spring': // steam spring: pool + three wisps
      ctx.beginPath(); ctx.ellipse(0, s * 0.45, s * 0.75, s * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      for (const dx of [-0.35, 0, 0.35]) { ctx.beginPath(); ctx.moveTo(dx * s, s * 0.2); ctx.bezierCurveTo((dx + 0.22) * s, -0.05 * s, (dx - 0.22) * s, -0.3 * s, dx * s, -0.65 * s); ctx.stroke(); }
      break;
    case 'dome': // Quapaw-style dome on a block
      ctx.fillRect(-0.7 * s, 0.05 * s, 1.4 * s, 0.55 * s);
      ctx.beginPath(); ctx.ellipse(0, 0.05 * s, 0.5 * s, 0.55 * s, 0, Math.PI, 0); ctx.fill();
      ctx.fillRect(-0.08 * s, -0.72 * s, 0.16 * s, 0.24 * s);
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = s * 0.09;
      L([[-0.35, -0.12], [-0.17, -0.3], [0, -0.12], [0.17, -0.3], [0.35, -0.12]]); ctx.stroke();
      for (const dx of [-0.45, -0.15, 0.15, 0.45]) ctx.fillRect((dx - 0.06) * s, 0.22 * s, 0.12 * s, 0.25 * s);
      ctx.restore();
      break;
    case 'bass':
      ctx.beginPath(); ctx.ellipse(-0.1 * s, 0, 0.58 * s, 0.32 * s, 0, 0, Math.PI * 2); ctx.fill();
      L([[0.4, 0], [0.82, -0.32], [0.82, 0.32]], true); ctx.fill();
      L([[-0.25, -0.28], [-0.05, -0.5], [0.15, -0.28]], true); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(-0.45 * s, -0.06 * s, 0.07 * s, 0, 7); ctx.fill();
      ctx.lineWidth = s * 0.07; L([[-0.62, 0.1], [-0.4, 0.12]]); ctx.stroke(); ctx.restore();
      break;
    case 'baseball':
      ctx.lineWidth = s * 0.12; ctx.beginPath(); ctx.arc(0, 0, 0.66 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = s * 0.09; ctx.beginPath(); ctx.arc(-0.95 * s, 0, 0.62 * s, -0.75, 0.75); ctx.stroke();
      ctx.beginPath(); ctx.arc(0.95 * s, 0, 0.62 * s, Math.PI - 0.75, Math.PI + 0.75); ctx.stroke();
      for (const sgn of [-1, 1]) for (const t of [-0.45, -0.15, 0.15, 0.45]) {
        const cx = sgn * (-0.95 + 0.62 * Math.cos(t)) * s * -1, cy = 0.62 * Math.sin(t) * s;
        ctx.beginPath(); ctx.moveTo(cx - 0.08 * s * sgn, cy); ctx.lineTo(cx + 0.08 * s * sgn, cy); ctx.stroke();
      }
      break;
    case 'fedora':
      ctx.beginPath(); ctx.ellipse(0, 0.25 * s, 0.85 * s, 0.2 * s, 0, 0, Math.PI * 2); ctx.fill();
      L([[-0.48, 0.22], [-0.38, -0.45], [-0.08, -0.32], [0, -0.42], [0.08, -0.32], [0.38, -0.45], [0.48, 0.22]], true); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillRect(-0.47 * s, 0.0, 0.94 * s, 0.11 * s); ctx.restore();
      break;
    case 'smoker': // Food & Culture: plate with fork and knife (generic dining sign)
      ctx.lineWidth = s * 0.12; ctx.beginPath(); ctx.arc(0, 0.02 * s, 0.42 * s, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0.02 * s, 0.24 * s, 0, 7); ctx.fill();
      ctx.lineWidth = s * 0.1; L([[-0.72, -0.15], [-0.72, 0.72]]); ctx.stroke();
      for (const dx of [-0.84, -0.72, -0.6]) { L([[dx, -0.72], [dx, -0.32]]); ctx.stroke(); }
      L([[-0.86, -0.3], [-0.58, -0.3]]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.66 * s, 0.72 * s); ctx.lineTo(0.66 * s, -0.72 * s); ctx.quadraticCurveTo(0.9 * s, -0.4 * s, 0.8 * s, 0.05 * s); ctx.lineTo(0.66 * s, 0.05 * s); ctx.closePath(); ctx.fill();
      ctx.lineWidth = s * 0.1; L([[0.66, 0], [0.66, 0.72]]); ctx.stroke();
      break;
    case 'reel':
      ctx.beginPath(); ctx.arc(0, 0, 0.7 * s, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 5; i++) { const a = i * 1.2566 - 1.57; ctx.beginPath(); ctx.arc(Math.cos(a) * 0.38 * s, Math.sin(a) * 0.38 * s, 0.15 * s, 0, 7); ctx.fill(); }
      ctx.beginPath(); ctx.arc(0, 0, 0.08 * s, 0, 7); ctx.fill(); ctx.restore();
      break;
    case 'merman': // generic fish-tailed figure (no likeness): head, arms, curling tail, forked fin
      ctx.beginPath(); ctx.arc(-0.22 * s, -0.58 * s, 0.19 * s, 0, 7); ctx.fill();
      ctx.lineWidth = s * 0.26; ctx.beginPath(); ctx.moveTo(-0.22 * s, -0.36 * s); ctx.quadraticCurveTo(-0.3 * s, 0.25 * s, 0.32 * s, 0.38 * s); ctx.stroke();
      ctx.lineWidth = s * 0.1; L([[-0.2, -0.24], [-0.58, -0.02]]); ctx.stroke(); L([[-0.2, -0.24], [0.15, -0.1]]); ctx.stroke();
      L([[0.3, 0.38], [0.78, 0.08], [0.6, 0.42], [0.8, 0.74]], true); ctx.fill();
      break;
    case 'vent':
      ctx.beginPath(); ctx.ellipse(0, 0.5 * s, 0.7 * s, 0.22 * s, 0, Math.PI, 0); ctx.fill();
      for (const dx of [-0.3, 0.05, 0.38]) { ctx.beginPath(); ctx.moveTo(dx * s, 0.35 * s); ctx.bezierCurveTo((dx + 0.25) * s, 0.05 * s, (dx - 0.25) * s, -0.25 * s, (dx + 0.05) * s, -0.7 * s); ctx.stroke(); }
      break;
    case 'wager': // horseshoe
      ctx.lineWidth = s * 0.26; ctx.beginPath(); ctx.arc(0, -0.05 * s, 0.48 * s, Math.PI * 0.85, Math.PI * 0.15, false); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.42 * s, 0.2 * s); ctx.lineTo(-0.4 * s, 0.6 * s); ctx.moveTo(0.42 * s, 0.2 * s); ctx.lineTo(0.4 * s, 0.6 * s); ctx.stroke();
      break;
    case 'warp': // hourglass
      L([[-0.45, -0.65], [0.45, -0.65], [0.08, 0], [0.45, 0.65], [-0.45, 0.65], [-0.08, 0]], true); ctx.fill();
      ctx.fillRect(-0.6 * s, -0.78 * s, 1.2 * s, 0.13 * s); ctx.fillRect(-0.6 * s, 0.65 * s, 1.2 * s, 0.13 * s);
      break;
    case 'postcard':
      ctx.lineWidth = s * 0.11; ctx.strokeRect(-0.75 * s, -0.48 * s, 1.5 * s, 0.96 * s);
      ctx.fillRect(0.28 * s, -0.36 * s, 0.32 * s, 0.36 * s);
      ctx.lineWidth = s * 0.08; for (const yy of [-0.12, 0.12, 0.32]) { L([[-0.6, yy], [0.12, yy]]); ctx.stroke(); }
      break;
    case 'jury': // gavel
      ctx.save(); ctx.rotate(-0.6); roundRect(ctx, -0.55 * s, -0.42 * s, 0.75 * s, 0.38 * s, 0.08 * s); ctx.fill(); ctx.fillRect(-0.24 * s, -0.04 * s, 0.14 * s, 0.85 * s); ctx.restore();
      ctx.fillRect(-0.7 * s, 0.55 * s, 0.9 * s, 0.16 * s);
      break;
    case 'trolley':
      roundRect(ctx, -0.7 * s, -0.25 * s, 1.4 * s, 0.7 * s, 0.18 * s); ctx.fill();
      ctx.lineWidth = s * 0.08; L([[0, -0.25], [0.45, -0.85]]); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'destination-out';
      for (const dx of [-0.45, -0.1, 0.25]) ctx.fillRect(dx * s, -0.12 * s, 0.24 * s, 0.22 * s);
      ctx.restore();
      ctx.beginPath(); ctx.arc(-0.35 * s, 0.55 * s, 0.14 * s, 0, 7); ctx.arc(0.35 * s, 0.55 * s, 0.14 * s, 0, 7); ctx.fill();
      break;
    case 'trailhead': // signpost
      ctx.fillRect(-0.07 * s, -0.7 * s, 0.14 * s, 1.45 * s);
      L([[-0.55, -0.55], [0.45, -0.55], [0.7, -0.38], [0.45, -0.2], [-0.55, -0.2]], true); ctx.fill();
      L([[0.55, 0.0], [-0.45, 0.0], [-0.7, 0.17], [-0.45, 0.34], [0.55, 0.34]], true); ctx.fill();
      break;
    case 'tower':
      ctx.lineWidth = s * 0.1; L([[-0.35, 0.8], [-0.12, -0.45], [0.12, -0.45], [0.35, 0.8]]); ctx.stroke();
      L([[-0.3, 0.5], [0.22, 0.05], [-0.18, -0.2]]); ctx.stroke();
      ctx.fillRect(-0.32 * s, -0.8 * s, 0.64 * s, 0.38 * s);
      break;
    case 'star':
      ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2 ? 0.32 : 0.75) * s; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
      break;
    default:
      ctx.beginPath(); ctx.arc(0, 0, 0.25 * s, 0, 7); ctx.fill();
  }
  ctx.restore();
}

export const SPECIAL_ICON = { vent: 'vent', wager: 'wager', warp: 'warp', postcard: 'postcard', jury: 'jury', trolley: 'trolley', trailhead: 'trailhead', start: 'star', tower: 'tower', trail: 'dot' };

// ---------- tokens ----------
export function tokenPath(ctx, shape, x, y, r) {
  ctx.beginPath();
  if (shape === 'circle') ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (shape === 'square') { ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7); }
  else if (shape === 'triangle') { ctx.moveTo(x, y - r * 1.1); ctx.lineTo(x + r * 1.05, y + r * 0.75); ctx.lineTo(x - r * 1.05, y + r * 0.75); ctx.closePath(); }
  else if (shape === 'diamond') { ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 0.95, y); ctx.lineTo(x, y + r * 1.15); ctx.lineTo(x - r * 0.95, y); ctx.closePath(); }
  else if (shape === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.5 : r * 1.12; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
  else { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); }
}

export function drawToken(ctx, shape, color, x, y, r, { lift = 0, active = false, T } = {}) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.7, r * 0.9, r * 0.35, 0, 0, 7); ctx.fill();
  const yy = y - lift;
  tokenPath(ctx, shape, x, yy, r);
  const g = ctx.createLinearGradient(x, yy - r, x, yy + r);
  g.addColorStop(0, shade(color, 0.35)); g.addColorStop(1, color);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = '#141414'; ctx.stroke();
  if (active) { tokenPath(ctx, shape, x, yy, r + 4); ctx.lineWidth = 2.5; ctx.strokeStyle = (T && T.glow) || '#D9A23A'; ctx.stroke(); }
  ctx.restore();
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r + (255 - r) * amt); g = Math.round(g + (255 - g) * amt); b = Math.round(b + (255 - b) * amt);
  return `rgb(${r},${g},${b})`;
}

// ---------- landmark vignettes ----------
function facade(ctx, T, x, y, w, h, kind) {
  ctx.fillStyle = kind === 'maurice' || kind === 'lamar' ? T.stucco : T.cream;
  ctx.fillRect(x, y - h, w, h);
  ctx.strokeStyle = T.text; ctx.lineWidth = 0.8; ctx.strokeRect(x, y - h, w, h);
  ctx.fillStyle = T.text; ctx.globalAlpha = 0.55;
  for (let i = 1; i < 5; i++) ctx.fillRect(x + (i * w) / 5 - 1, y - h * 0.62, 2, h * 0.38);
  ctx.globalAlpha = 1;
  if (kind === 'quapaw') {
    ctx.fillStyle = T.brass; ctx.beginPath(); ctx.ellipse(x + w / 2, y - h, w * 0.3, h * 0.55, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = T.cobalt; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i <= 4; i++) ctx.lineTo(x + w / 2 - w * 0.22 + i * w * 0.11, y - h - (i % 2 ? h * 0.38 : h * 0.18)); ctx.stroke();
    ctx.fillStyle = T.text; ctx.fillRect(x + w / 2 - 1.5, y - h * 1.7, 3, h * 0.2);
  } else if (kind === 'ozark') {
    ctx.fillStyle = T.cream; ctx.fillRect(x, y - h * 1.35, w * 0.22, h * 0.35); ctx.fillRect(x + w * 0.78, y - h * 1.35, w * 0.22, h * 0.35);
    ctx.fillStyle = T.tile; for (const tx of [x, x + w * 0.78]) { ctx.beginPath(); ctx.moveTo(tx, y - h * 1.35); ctx.lineTo(tx + w * 0.11, y - h * 1.6); ctx.lineTo(tx + w * 0.22, y - h * 1.35); ctx.fill(); }
  } else if (kind === 'maurice') {
    ctx.fillStyle = T.green; ctx.fillRect(x - 1, y - h - 4, w + 2, 5);
  } else if (kind === 'hale' || kind === 'fordyce') {
    ctx.fillStyle = T.tile; ctx.beginPath(); ctx.moveTo(x - 2, y - h); ctx.lineTo(x + w / 2, y - h - h * 0.4); ctx.lineTo(x + w + 2, y - h); ctx.fill();
  } else {
    ctx.fillStyle = T.tile; ctx.fillRect(x - 1, y - h - 2, w + 2, 3);
  }
}

export function drawLandmarks(ctx, T) {
  // Bathhouse Row skyline, north → south down the east side of Central (visual-style-guide row order)
  const row = ['superior', 'hale', 'maurice', 'fordyce', 'quapaw', 'ozark', 'buckstaff', 'lamar'];
  row.forEach((k, i) => facade(ctx, T, 548, 372 + i * 36, 34, 18, k));
  // Arlington Hotel at the Y: two towers
  ctx.save(); ctx.translate(560, 255);
  ctx.fillStyle = T.cream; ctx.fillRect(-30, -16, 60, 22); ctx.strokeStyle = T.text; ctx.lineWidth = 0.8; ctx.strokeRect(-30, -16, 60, 22);
  for (const tx of [-24, 14]) { ctx.fillStyle = T.cream; ctx.fillRect(tx, -32, 10, 18); ctx.strokeRect(tx, -32, 10, 18); ctx.fillStyle = T.tile; ctx.beginPath(); ctx.moveTo(tx - 1, -32); ctx.lineTo(tx + 5, -40); ctx.lineTo(tx + 11, -32); ctx.fill(); }
  ctx.fillStyle = T.text; ctx.globalAlpha = 0.5; for (let i = 0; i < 6; i++) ctx.fillRect(-26 + i * 9, -10, 4, 10); ctx.globalAlpha = 1;
  ctx.restore();
  // Whittington Park ball diamond
  ctx.save(); ctx.translate(262, 430); ctx.rotate(-0.6);
  ctx.fillStyle = T.grass; ctx.beginPath(); ctx.moveTo(0, 22); ctx.arc(0, 22, 40, -Math.PI * 0.75, -Math.PI * 0.25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = T.track; ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(13, 9); ctx.lineTo(0, -4); ctx.lineTo(-13, 9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = T.cream; for (const [bx, by] of [[0, 22], [13, 9], [0, -4], [-13, 9]]) ctx.fillRect(bx - 2, by - 2, 4, 4);
  ctx.restore();
  // Happy Hollow: a little photo-studio cabin
  ctx.save(); ctx.translate(455, 198);
  ctx.fillStyle = '#8C6A3F'; ctx.fillRect(-14, -10, 28, 16); ctx.fillStyle = T.roof; ctx.beginPath(); ctx.moveTo(-18, -10); ctx.lineTo(0, -22); ctx.lineTo(18, -10); ctx.fill();
  ctx.fillStyle = T.cream; ctx.fillRect(-4, -4, 8, 10);
  ctx.restore();
  // Park Avenue: mid-century hotel slab (generic)
  ctx.save(); ctx.translate(850, 160);
  ctx.fillStyle = T.stucco; ctx.fillRect(-10, -46, 20, 46); ctx.strokeStyle = T.text; ctx.lineWidth = 0.8; ctx.strokeRect(-10, -46, 20, 46);
  ctx.fillStyle = '#3FA7A0'; for (let r = 0; r < 7; r++) ctx.fillRect(-8, -43 + r * 6, 16, 2);
  ctx.fillStyle = T.block; ctx.fillRect(-22, -6, 44, 8);
  ctx.restore();
  // Bridge Street: tiny sign
  ctx.save(); ctx.translate(470, 703);
  ctx.fillStyle = T.text; ctx.fillRect(-1, -4, 2, 14); ctx.fillStyle = T.green; ctx.fillRect(-18, -12, 36, 10);
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 7px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BRIDGE ST', 0, -7);
  ctx.restore();
  // Oaklawn grandstand by the track
  ctx.save(); ctx.translate(575, 850);
  ctx.fillStyle = T.cream; ctx.fillRect(-46, -14, 92, 14); ctx.strokeStyle = T.text; ctx.lineWidth = 0.8; ctx.strokeRect(-46, -14, 92, 14);
  ctx.fillStyle = T.green; ctx.beginPath(); ctx.moveTo(-50, -14); ctx.lineTo(50, -14); ctx.lineTo(42, -22); ctx.lineTo(-42, -22); ctx.closePath(); ctx.fill();
  ctx.restore();
  // Lake Ouachita: a little boat
  ctx.save(); ctx.translate(182, 700);
  ctx.fillStyle = T.cream; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(8, 5); ctx.lineTo(-8, 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = T.text; ctx.fillRect(-0.8, -14, 1.6, 14); ctx.fillStyle = T.cream; ctx.beginPath(); ctx.moveTo(1, -14); ctx.lineTo(10, -2); ctx.lineTo(1, -2); ctx.fill();
  ctx.restore();
}

// Mountain Tower: tall lattice with an observation deck (visual-style-guide recipe), drawn every
// frame so it can glow when a player is eligible.
export function drawTower(ctx, T, x, y, glow = 0) {
  ctx.save(); ctx.translate(x, y);
  const h = 92, top = -h - 14;
  if (glow > 0) { ctx.shadowColor = T.glow; ctx.shadowBlur = 14 * glow; }
  ctx.strokeStyle = T.steel; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(-14, -14); ctx.lineTo(-5, top + 12); ctx.moveTo(14, -14); ctx.lineTo(5, top + 12); ctx.stroke();
  ctx.lineWidth = 1.2; ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const t0 = i / 6, t1 = (i + 1) / 6, y0 = -14 + (top + 12 + 14) * t0, y1 = -14 + (top + 12 + 14) * t1;
    const w0 = 14 - 9 * t0, w1 = 14 - 9 * t1;
    ctx.moveTo(-w0, y0); ctx.lineTo(w1, y1); ctx.moveTo(w0, y0); ctx.lineTo(-w1, y1);
  }
  ctx.stroke();
  ctx.fillStyle = T.steel; ctx.fillRect(-12, top, 24, 13); ctx.fillStyle = T.cream; ctx.fillRect(-10, top + 3, 20, 5);
  ctx.fillStyle = T.text; ctx.fillRect(-1, top - 9, 2, 9);
  ctx.restore();
}

// ---------- passport stamp ----------
export function drawStamp(ctx, x, y, r, cat, district, have, T, rot = -0.12) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const color = have ? cat.color : 'rgba(120,110,90,0.35)';
  ctx.strokeStyle = color; ctx.lineWidth = r * 0.07;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([r * 0.08, r * 0.06]); ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  if (have) { ctx.fillStyle = cat.color; ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  drawIcon(ctx, cat.icon, 0, -r * 0.12, r * 0.42, color);
  ctx.fillStyle = color; ctx.font = `bold ${Math.round(r * 0.17)}px "Courier New", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(district.stamp.toUpperCase(), 0, r * 0.48, r * 1.3); // maxWidth keeps long names inside the ring
  ctx.restore();
}
