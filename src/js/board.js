// Board graph: an original winding route through eight Hot Springs districts plus the mountain spur.
// World units: 1000×1000, north up. Layout is stylized but keeps the real relative positions
// (research/town-content.md §1): the Y and Arlington at the top of the valley, Bathhouse Row on the
// east side, Central Avenue on the west side, Whittington Avenue running west from the Y,
// Park Avenue to the northeast, North Mountain / Happy Hollow north, Hot Springs Mountain east,
// Oaklawn south, the lakes west and south.

export const DISTRICTS = [
  { key: 'row', name: 'Bathhouse Row', cat: 'Places & Landmarks', stamp: 'Quapaw Baths', blurb: '1922 · the Row’s tallest dome',
    label: [702, 405],
    pts: [[575, 330], [605, 378], [618, 432], [622, 488], [618, 545], [608, 600], [590, 652]],
    types: ['cat', 'cat', 'vent', 'cat', 'landmark', 'trailhead', 'cat'],
    names: ['Superior', 'Hale', 'Display Spring vent', 'Fordyce', 'Quapaw Baths', 'Grand Promenade trailhead', 'Buckstaff'] },
  { key: 'bridge', name: 'Bridge Street', cat: 'Food & Culture', stamp: 'Bridge Street', blurb: 'About 98 ft — the shortest parade route',
    label: [585, 790],
    pts: [[565, 700], [528, 737], [485, 754], [440, 750], [400, 724], [378, 682], [372, 634]],
    types: ['cat', 'postcard', 'cat', 'landmark', 'cat', 'vent', 'cat'],
    names: ['Malvern Avenue', 'Postcard', 'Pleasant Street', 'Bridge Street', 'Malco Theatre', 'Steam vent', 'Downtown'] },
  { key: 'central', name: 'Central Avenue', cat: 'History', stamp: 'Arlington Hotel', blurb: '1924 · at the north Y of Central Avenue',
    label: [300, 520],
    pts: [[375, 584], [380, 532], [388, 480], [398, 428], [412, 380], [432, 337], [462, 302]],
    types: ['cat', 'jury', 'cat', 'cat', 'postcard', 'cat', 'landmark'],
    names: ['Medical Arts', 'Grand Jury', 'Ohio Club', 'Southern Club', 'Postcard', 'Central Avenue', 'Arlington Hotel'] },
  { key: 'oaklawn', name: 'Oaklawn', cat: 'Entertainment', stamp: 'Oaklawn', blurb: 'Racing since 1904 or 1905 — sources differ',
    label: [470, 905],
    pts: [[436, 802], [420, 852], [386, 895], [336, 925], [281, 940], [226, 936], [176, 916]],
    types: ['cat', 'wager', 'cat', 'landmark', 'wager', 'cat', 'trolley'],
    names: ['Grandstand', 'Post Time', 'Paddock', 'Oaklawn', 'Post Time', 'Homestretch', 'Trolley stop'] },
  { key: 'lakes', name: 'The Lakes', cat: 'Nature & Lakes', stamp: 'Lake Ouachita', blurb: 'Blakely Mountain Dam, 1948–53',
    label: [205, 760],
    pts: [[131, 883], [96, 840], [73, 790], [63, 735], [62, 680], [70, 626], [86, 573]],
    types: ['cat', 'vent', 'cat', 'landmark', 'cat', 'postcard', 'cat'],
    names: ['Lake Hamilton', 'Creek mouth vent', 'Garvan Gardens', 'Lake Ouachita', 'Lakeshore', 'Postcard', 'Lake Ouachita State Park'] },
  { key: 'ballfields', name: 'The Ballfields', cat: 'Sports', stamp: 'Whittington Park', blurb: 'Ballpark from 1894 · Ruth’s long homer, 1918',
    label: [215, 470],
    pts: [[106, 522], [131, 475], [161, 432], [196, 393], [233, 357], [268, 322], [300, 287]],
    types: ['cat', 'warp', 'cat', 'landmark', 'cat', 'trolley', 'cat'],
    names: ['Fogel Field', 'Time Warp', 'Majestic Park', 'Whittington Park', 'Ban Johnson Field', 'Trolley stop', 'Whittington Avenue'] },
  { key: 'hollow', name: 'Happy Hollow', cat: 'Legends & Oddities', stamp: 'Happy Hollow', blurb: 'Home of a cold spring treated by ozone filtration',
    label: [470, 78],
    pts: [[320, 222], [355, 182], [400, 150], [452, 130], [508, 122], [563, 126], [615, 142]],
    types: ['cat', 'jury', 'cat', 'landmark', 'vent', 'warp', 'cat'],
    names: ['North Mountain', 'Grand Jury', 'Happy Hollow Spring', 'Happy Hollow', 'Steam vent', 'Time Warp', 'Goat Rock'] },
  { key: 'park', name: 'Park Avenue', cat: 'People', stamp: 'Park Avenue', blurb: 'Motor courts and a mid-century hotel boom',
    label: [800, 200],
    pts: [[668, 180], [715, 212], [740, 258], [722, 304], [678, 320], [628, 308], [576, 288]],
    types: ['cat', 'trolley', 'cat', 'landmark', 'cat', 'postcard', 'cat'],
    names: ['Mountainaire', 'Trolley stop', 'Motor courts', 'Park Avenue', 'Velda Rose', 'Postcard', 'Fountain Street'] },
];
export const DISTRICT = Object.fromEntries(DISTRICTS.map((d) => [d.key, d]));

// Build nodes and edges.
export const NODES = [];
const adj = [];
function addNode(n) { n.id = NODES.length; n.cost = n.cost || 1; NODES.push(n); adj.push([]); return n.id; }
function link(a, b) { if (!adj[a].includes(b)) adj[a].push(b); if (!adj[b].includes(a)) adj[b].push(a); }

export const START = addNode({ x: 505, y: 290, type: 'start', district: null, name: 'The Y · Arlington lawn' });
const ids = {};
for (const d of DISTRICTS) {
  ids[d.key] = d.pts.map(([x, y], i) => addNode({ x, y, type: d.types[i], district: d.key, cat: d.cat, name: d.names[i] }));
  for (let i = 1; i < ids[d.key].length; i++) link(ids[d.key][i - 1], ids[d.key][i]);
}
const at = (k, i) => ids[k][i];
// Downtown loop: Y → Row (south) → Bridge (west) → Central (north) → Y.
link(START, at('row', 0)); link(at('row', 6), at('bridge', 0)); link(at('bridge', 6), at('central', 0)); link(at('central', 6), START);
// Outer loop: Bridge Street → Oaklawn → Lakes → Ballfields → Happy Hollow → Park Avenue → Y.
link(at('bridge', 3), at('oaklawn', 0)); link(at('oaklawn', 6), at('lakes', 0)); link(at('lakes', 6), at('ballfields', 0));
link(at('ballfields', 6), at('hollow', 0)); link(at('hollow', 6), at('park', 0)); link(at('park', 6), START);
// Whittington Avenue: from the Y west to the ballfields.
const whit = [[452, 252], [397, 252], [346, 266]].map(([x, y]) => addNode({ x, y, type: 'cat', district: 'ballfields', cat: 'Sports', name: 'Whittington Avenue' }));
link(START, whit[0]); link(whit[0], whit[1]); link(whit[1], whit[2]); link(whit[2], at('ballfields', 6));

// Mountain spur (real NPS trails, geography-lakes-mountains.md → Trails).
export const TRAILHEAD = at('row', 5);
const g0 = addNode({ x: 662, y: 594, type: 'trail', district: 'mountain', name: 'Grand Promenade', spur: true });
const g1 = addNode({ x: 712, y: 577, type: 'trail', district: 'mountain', name: 'Grand Promenade', spur: true });
const fork = addNode({ x: 758, y: 548, type: 'trail', district: 'mountain', name: 'Trail fork', spur: true });
const s0 = addNode({ x: 790, y: 505, type: 'trail', district: 'mountain', name: 'Short Cut (21.1% grade)', spur: true, cost: 2, steep: true });
const s1 = addNode({ x: 818, y: 462, type: 'trail', district: 'mountain', name: 'Short Cut (21.1% grade)', spur: true, cost: 2, steep: true });
const k0 = addNode({ x: 808, y: 568, type: 'trail', district: 'mountain', name: 'Peak Trail (12.6% grade)', spur: true });
const k1 = addNode({ x: 851, y: 543, type: 'trail', district: 'mountain', name: 'Peak Trail (12.6% grade)', spur: true });
const k2 = addNode({ x: 880, y: 502, type: 'trail', district: 'mountain', name: 'Peak Trail (12.6% grade)', spur: true });
const k3 = addNode({ x: 874, y: 455, type: 'trail', district: 'mountain', name: 'Peak Trail (12.6% grade)', spur: true });
export const TOWER = addNode({ x: 842, y: 408, type: 'tower', district: 'mountain', name: 'Hot Springs Mountain Tower', spur: true });
link(TRAILHEAD, g0); link(g0, g1); link(g1, fork);
link(fork, s0); link(s0, s1); link(s1, TOWER);
link(fork, k0); link(k0, k1); link(k1, k2); link(k2, k3); link(k3, TOWER);
export const SPUR_ENTRY = g0;

export const ADJ = adj;
// Steam-vent pairs: Hot Springs Creek runs under the Row and empties into Lake Hamilton (town-content §3).
export const VENT_PAIRS = [[at('row', 2), at('lakes', 1)], [at('bridge', 5), at('hollow', 4)]];
export const ventPartner = (id) => { for (const [a, b] of VENT_PAIRS) { if (a === id) return b; if (b === id) return a; } return null; };
export const TROLLEYS = NODES.filter((n) => n.type === 'trolley' || n.type === 'start').map((n) => n.id);
export const LANDMARK = Object.fromEntries(DISTRICTS.map((d) => [d.cat, ids[d.key][d.types.indexOf('landmark')]]));
export const districtOf = (id) => DISTRICT[NODES[id].district] || null;

// All destinations reachable with exactly `steps` (MECHANICS §4). A path never revisits a node; each
// entered node costs node.cost; entering the spur needs `eligible`; the Tower absorbs leftover steps.
export function reachable(from, steps, eligible) {
  const out = new Map();
  const path = [from];
  const seen = new Set([from]);
  (function dfs(node, left) {
    for (const nb of ADJ[node]) {
      if (seen.has(nb)) continue;
      if (nb === SPUR_ENTRY && node === TRAILHEAD && !eligible) continue;
      const c = NODES[nb].cost;
      if (c > left) continue;
      path.push(nb); seen.add(nb);
      if (nb === TOWER || left - c === 0) { if (!out.has(nb)) out.set(nb, path.slice()); }
      else dfs(nb, left - c);
      path.pop(); seen.delete(nb);
    }
  })(from, steps);
  return [...out.entries()].map(([node, p]) => ({ node, path: p }));
}

// Shortest hop distance (BFS, ignoring costs), used by the AI.
export function hops(from, to, eligible = true) {
  if (from === to) return 0;
  const dist = new Map([[from, 0]]); const q = [from];
  while (q.length) {
    const n = q.shift();
    for (const nb of ADJ[n]) {
      if (dist.has(nb)) continue;
      if (nb === SPUR_ENTRY && n === TRAILHEAD && !eligible) continue;
      dist.set(nb, dist.get(n) + NODES[nb].cost);
      if (nb === to) return dist.get(nb);
      q.push(nb);
    }
  }
  return 99;
}
