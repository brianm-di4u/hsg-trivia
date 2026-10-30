// Procedural art: category and space icons, the vector tokens (the fallback for the painted pawns), passport stamps.
// Palettes are copied from shared/design/tokens.js (gilded-spa, thermal-water, ouachita-forest,
// nps-rustic, deco-neon); every hex there is an estimate (shared/design/README.md).

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
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

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
