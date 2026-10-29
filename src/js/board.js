// Board graph: an original winding route through eight Hot Springs districts plus the mountain spur.
// Board units: the board image is BOARD_W (1000) wide and BOARD_H tall, seen looking east: north is
// screen-left and east is screen-up, so Bathhouse Row's west-facing fronts face the player with Hot Springs
// Mountain and the tower behind. Positions come from data/board-geo.json, built by tools/map/ from real
// coordinates (research/geo-anchors.json): every named space sits at its real place on a tourist-map
// projection of the valley (VISUAL-PLAN.md). Spaces are listed in route order.
/* global BOARD_GEO */
export const GEO_META = typeof BOARD_GEO !== 'undefined' ? BOARD_GEO : null;
export const BOARD_W = 1000;
export const BOARD_H = (GEO_META && GEO_META.h) || 900;

export const DISTRICTS = [
  { key: 'row', name: 'Bathhouse Row', cat: 'Places & Landmarks', stamp: 'Quapaw Baths', blurb: '1922 · the widest front on the Row, under a tile dome',
    types: ['cat', 'cat', 'vent', 'cat', 'landmark', 'trailhead', 'cat'],
    names: ['Superior', 'Hale', 'Display Spring vent', 'Fordyce', 'Quapaw Baths', 'Grand Promenade trailhead', 'Buckstaff'] },
  { key: 'bridge', name: 'Bridge Street', cat: 'Food & Culture', stamp: 'Bridge Street', blurb: 'About 98 ft — the shortest parade route',
    types: ['cat', 'postcard', 'cat', 'landmark', 'cat', 'vent', 'cat'],
    names: ['Reserve Street', 'Postcard', 'Malvern Avenue', 'Bridge Street', 'Malco Theatre', 'Steam vent', 'Downtown'] },
  { key: 'central', name: 'Central Avenue', cat: 'History', stamp: 'Arlington Hotel', blurb: '1924 · at the north end of Central Avenue',
    types: ['cat', 'jury', 'cat', 'postcard', 'cat', 'cat', 'landmark'],
    names: ['Central Avenue', 'Grand Jury', 'Ohio Club', 'Postcard', 'Southern Club', 'Medical Arts', 'Arlington Hotel'] },
  { key: 'oaklawn', name: 'Oaklawn', cat: 'Entertainment', stamp: 'Oaklawn', blurb: 'Racing since 1904 or 1905 — sources differ',
    types: ['cat', 'wager', 'cat', 'landmark', 'wager', 'cat', 'trolley'],
    names: ['Grandstand', 'Post Time', 'Paddock', 'Oaklawn', 'Post Time', 'Homestretch', 'Trolley stop'] },
  { key: 'lakes', name: 'The Lakes', cat: 'Nature & Lakes', stamp: 'Lake Ouachita', blurb: 'Blakely Mountain Dam, 1948–53',
    types: ['cat', 'vent', 'cat', 'landmark', 'cat', 'postcard', 'cat'],
    names: ['Lake Hamilton', 'Creek mouth vent', 'Garvan Gardens', 'Lake Ouachita', 'Blakely Mountain Dam', 'Postcard', 'Lake Ouachita State Park'] },
  { key: 'ballfields', name: 'The Ballfields', cat: 'Sports', stamp: 'Whittington Park', blurb: 'Ballpark from 1894 · Ruth’s long homer, 1918',
    types: ['cat', 'warp', 'cat', 'landmark', 'cat', 'trolley', 'cat'],
    names: ['Ban Johnson Field', 'Time Warp', 'Fogel Field', 'Whittington Park', 'Baseball Trail', 'Trolley stop', 'Whittington Avenue'] },
  { key: 'hollow', name: 'Happy Hollow', cat: 'Legends & Oddities', stamp: 'Happy Hollow', blurb: 'Home of a cold spring treated by ozone filtration',
    types: ['cat', 'jury', 'cat', 'landmark', 'vent', 'warp', 'cat'],
    names: ['Goat Rock', 'Grand Jury', 'North Mountain', 'Happy Hollow', 'Happy Hollow Spring vent', 'Time Warp', 'Fountain Street'] },
  { key: 'park', name: 'Park Avenue', cat: 'People', stamp: 'Park Avenue', blurb: 'Motor courts and a mid-century hotel boom',
    types: ['cat', 'trolley', 'cat', 'landmark', 'cat', 'postcard', 'cat'],
    names: ['Velda Rose', 'Trolley stop', 'Motor courts', 'Park Avenue', 'Tourist courts', 'Postcard', 'Mountainaire'] },
];
export const DISTRICT = Object.fromEntries(DISTRICTS.map((d) => [d.key, d]));

// Build nodes and edges.
export const NODES = [];
const adj = [];
function addNode(n) {
  n.id = NODES.length; n.cost = n.cost || 1;
  const g = GEO_META && GEO_META.nodes[n.id]; n.x = g ? g.x : 0; n.y = g ? g.y : 0;
  NODES.push(n); adj.push([]); return n.id;
}
function link(a, b) { if (!adj[a].includes(b)) adj[a].push(b); if (!adj[b].includes(a)) adj[b].push(a); }

export const START = addNode({ type: 'start', district: null, name: 'Arlington Lawn · Fountain Street' });
const ids = {};
for (const d of DISTRICTS) {
  ids[d.key] = d.names.map((name, i) => addNode({ type: d.types[i], district: d.key, cat: d.cat, name }));
  for (let i = 1; i < ids[d.key].length; i++) link(ids[d.key][i - 1], ids[d.key][i]);
}
const at = (k, i) => ids[k][i];
// Downtown loop: Arlington → down the Row (east side) → Bridge Street → up Central's west side → Arlington.
link(START, at('row', 0)); link(at('row', 6), at('bridge', 0)); link(at('bridge', 6), at('central', 0)); link(at('central', 6), START);
// Outer loop, clockwise along real roads: south to Oaklawn, west past the lakes, in along Whittington
// Avenue, north up Park Avenue, round North Mountain and back down Fountain Street to the Arlington.
link(at('bridge', 3), at('oaklawn', 0)); link(at('oaklawn', 6), at('lakes', 0)); link(at('lakes', 6), at('ballfields', 0));
link(at('ballfields', 6), at('park', 0)); link(at('park', 6), at('hollow', 0)); link(at('hollow', 6), START);
// Whittington Avenue: from the Arlington past the Y, west to the ballfields.
const whit = [0, 1, 2].map(() => addNode({ type: 'cat', district: 'ballfields', cat: 'Sports', name: 'Whittington Avenue' }));
link(START, whit[0]); link(whit[0], whit[1]); link(whit[1], whit[2]); link(whit[2], at('ballfields', 6));

// Mountain spur (real NPS trails, geography-lakes-mountains.md → Trails).
export const TRAILHEAD = at('row', 5);
const g0 = addNode({ type: 'trail', district: 'mountain', name: 'Grand Promenade', spur: true });
const g1 = addNode({ type: 'trail', district: 'mountain', name: 'Grand Promenade', spur: true });
const fork = addNode({ type: 'trail', district: 'mountain', name: 'Trail fork', spur: true });
const s0 = addNode({ type: 'trail', district: 'mountain', name: 'Short Cut (21.1% grade)', spur: true, cost: 2, steep: true });
const s1 = addNode({ type: 'trail', district: 'mountain', name: 'Short Cut (21.1% grade)', spur: true, cost: 2, steep: true });
const k0 = addNode({ type: 'trail', district: 'mountain', name: 'Peak Trail (12.6% grade)', spur: true });
const k1 = addNode({ type: 'trail', district: 'mountain', name: 'Peak Trail (12.6% grade)', spur: true });
const k2 = addNode({ type: 'trail', district: 'mountain', name: 'Peak Trail (12.6% grade)', spur: true });
const k3 = addNode({ type: 'trail', district: 'mountain', name: 'Peak Trail (12.6% grade)', spur: true });
export const TOWER = addNode({ type: 'tower', district: 'mountain', name: 'Hot Springs Mountain Tower', spur: true });
link(TRAILHEAD, g0); link(g0, g1); link(g1, fork);
link(fork, s0); link(s0, s1); link(s1, TOWER);
link(fork, k0); link(k0, k1); link(k1, k2); link(k2, k3); link(k3, TOWER);
export const SPUR_ENTRY = g0;

export const ADJ = adj;
// Steam-vent pairs: Hot Springs Creek runs under the Row and empties into Lake Hamilton (town-content §3);
// the second pair links the creek's open channel south of Bridge Street to Happy Hollow's spring.
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
