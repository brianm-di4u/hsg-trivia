// Writes art-src/geo/graph.json (node ids, types, districts, names, edges) from the game's own board
// graph, so the Python map layout never duplicates it.  node games/trivia/tools/map/export-graph.mjs
import { writeFileSync } from 'node:fs';
import { NODES, ADJ, DISTRICTS, TRAILHEAD, TOWER, START, VENT_PAIRS } from '../../src/js/board.js';
const out = {
  nodes: NODES.map((n) => ({ id: n.id, type: n.type, district: n.district, name: n.name, cost: n.cost, spur: !!n.spur, x: n.x, y: n.y })),
  edges: ADJ.flatMap((nb, a) => nb.filter((b) => a < b).map((b) => [a, b])),
  districts: DISTRICTS.map((d) => ({ key: d.key, name: d.name, cat: d.cat })),
  trailhead: TRAILHEAD, tower: TOWER, start: START, vents: VENT_PAIRS,
};
writeFileSync(new URL('../../art-src/geo/graph.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('nodes', out.nodes.length, 'edges', out.edges.length);
