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
    facts: [
      { text: "The Quapaw Bathhouse took its name from Native American artifacts found when its basement was dug.", source: "Encyclopedia of Arkansas: Bathhouse Row" },
      { text: "The Quapaw's dome tower is the highest on Bathhouse Row and is topped with a copper cupola.", source: "Encyclopedia of Arkansas: Bathhouse Row" },
      { text: "The National Park Service says the Quapaw is one of two places where visitors can soak in the thermal springs.", source: "National Park Service: Quapaw Bathhouse" },
      { text: "The Hale, built in 1892-93 to replace an earlier bathhouse, is the oldest surviving bathhouse on the Row.", source: "Encyclopedia of Arkansas: Bathhouse Row" },
      { text: "After the Lamar closed in 1985, the Buckstaff was the only bathhouse still operating on the Row.", source: "National Park Service: History & Culture" },
    ],
    types: ['cat', 'cat', 'vent', 'cat', 'landmark', 'trailhead', 'cat'],
    names: ['Superior', 'Hale', 'Display Spring vent', 'Fordyce', 'Quapaw Baths', 'Grand Promenade trailhead', 'Buckstaff'] },
  { key: 'bridge', name: 'Bridge Street', cat: 'Food & Culture', stamp: 'Bridge Street', blurb: 'About 98 ft — the shortest parade route',
    facts: [
      { text: "The first World's Shortest St. Patrick's Day Parade marched down Bridge Street on March 17, 2004, drawing more than 2,000 people.", source: "Encyclopedia of Arkansas: World's Shortest St. Patrick's Day Parade" },
      { text: "By 2016 the fire marshal estimated the Bridge Street parade crowd at nearly 30,000 people.", source: "Encyclopedia of Arkansas: World's Shortest St. Patrick's Day Parade" },
      { text: "Bridge Street was written up in Ripley's Believe It or Not as the world's shortest street in everyday use.", source: "Encyclopedia of Arkansas: World's Shortest St. Patrick's Day Parade" },
      { text: "A group of 100 marching \"Irish\" Elvis Presley impersonators once took part in the parade.", source: "Encyclopedia of Arkansas: World's Shortest St. Patrick's Day Parade" },
      { text: "The Malco Theatre, rebuilt after a Christmas Eve 1935 fire, stands on the site of the Princess Theatre, where Bridge Street meets Central Avenue and Broadway.", source: "Encyclopedia of Arkansas: Malco Theatre" },
    ],
    types: ['cat', 'postcard', 'cat', 'landmark', 'cat', 'vent', 'cat'],
    names: ['Reserve Street', 'Postcard', 'Malvern Avenue', 'Bridge Street', 'Malco Theatre', 'Steam vent', 'Downtown'] },
  { key: 'central', name: 'Central Avenue', cat: 'History', stamp: 'Arlington Hotel', blurb: '1924 · at the north end of Central Avenue',
    facts: [
      { text: "The second Arlington Hotel burned to the ground on April 5, 1923, and the current third hotel replaced it.", source: "Arlington Hotel: History" },
      { text: "The Arlington says Al Capone was a frequent guest in the 1930s and rented an entire floor for his entourage.", source: "Arlington Hotel: History" },
      { text: "In 1928 Senator Joe T. Robinson announced his acceptance of the Democratic vice-presidential nomination, broadcast by KTHS, the radio station based at the Arlington.", source: "Arlington Hotel: History" },
      { text: "The Southern Club, the private club of Charles Dugan and Dan Stuart, opened in 1893 at 250 Central Avenue and now houses a wax museum.", source: "Encyclopedia of Arkansas: Southern Club" },
      { text: "The Ohio Club, founded in 1905 at 336 Central Avenue, is considered Arkansas's oldest continually operating bar.", source: "Encyclopedia of Arkansas: Ohio Club" },
    ],
    types: ['cat', 'jury', 'cat', 'postcard', 'cat', 'cat', 'landmark'],
    names: ['Central Avenue', 'Grand Jury', 'Ohio Club', 'Postcard', 'Southern Club', 'Medical Arts', 'Arlington Hotel'] },
  { key: 'oaklawn', name: 'Oaklawn', cat: 'Entertainment', stamp: 'Oaklawn', blurb: 'Racing since 1904 or 1905 — sources differ',
    facts: [
      { text: "By 1914 Oaklawn was owned by brothers Louis A. and Charles Cella of St. Louis.", source: "Encyclopedia of Arkansas: Oaklawn Park Racetrack" },
      { text: "The first Arkansas Derby ran in 1936 with a purse of $5,000.", source: "Encyclopedia of Arkansas: Oaklawn Park Racetrack" },
      { text: "A state law passed February 27, 1907, banning betting on horse races forced Oaklawn to close after the 1907 season.", source: "Encyclopedia of Arkansas: Oaklawn Park Racetrack" },
      { text: "In 2005 Oaklawn and the Cella family received an Eclipse Award of Merit.", source: "Encyclopedia of Arkansas: Oaklawn Park Racetrack" },
    ],
    types: ['cat', 'wager', 'cat', 'landmark', 'wager', 'cat', 'trolley'],
    names: ['Grandstand', 'Post Time', 'Paddock', 'Oaklawn', 'Post Time', 'Homestretch', 'Oaklawn trolley stop'] },
  { key: 'lakes', name: 'The Lakes', cat: 'Nature & Lakes', stamp: 'Lake Ouachita', blurb: 'Blakely Mountain Dam, 1948–53',
    facts: [
      { text: "Blakely Mountain Dam is 231 feet tall and 1,100 feet long, and cost $31 million.", source: "Encyclopedia of Arkansas: Blakely Mountain Dam" },
      { text: "The dam's power plant began generating electricity on July 17, 1955, and the dam was dedicated on July 4, 1956.", source: "Encyclopedia of Arkansas: Blakely Mountain Dam" },
      { text: "Lake Ouachita covers over 40,000 acres and is the largest lake entirely within Arkansas.", source: "Encyclopedia of Arkansas: Blakely Mountain Dam" },
      { text: "Garvan Woodland Gardens is a 210-acre botanical garden on four and a half miles of Lake Hamilton shoreline.", source: "Encyclopedia of Arkansas: Garvan Woodland Gardens" },
      { text: "Lake Hamilton was created when Arkansas Power and Light built Carpenter Dam, which left the Garvan land as a large peninsula.", source: "Encyclopedia of Arkansas: Garvan Woodland Gardens" },
    ],
    types: ['cat', 'vent', 'cat', 'landmark', 'cat', 'postcard', 'cat'],
    names: ['Lake Hamilton', 'Creek mouth vent', 'Garvan Gardens', 'Lake Ouachita', 'Blakely Mountain Dam', 'Postcard', 'Lake Ouachita State Park'] },
  { key: 'ballfields', name: 'The Ballfields', cat: 'Sports', stamp: 'Whittington Park', blurb: 'Ballpark from 1894 · Ruth’s long homer, 1918',
    facts: [
      { text: "Babe Ruth trained at Hot Springs many times and became a very familiar face around town.", source: "Hot Springs Baseball Trail: Whittington Park" },
      { text: "Bill Dickey was discovered in Hot Springs while substituting for a friend in a semi-pro game at Whittington Park.", source: "Hot Springs Baseball Trail: Whittington Park" },
      { text: "Fogel Field, also known as Fordyce Field, was built in 1912 by the Hot Springs Park Company.", source: "Hot Springs Baseball Trail: See the Trail" },
      { text: "The Baseball Trail says more baseball was played at the Whittington Park corner than anywhere else in Hot Springs.", source: "Hot Springs Baseball Trail: Whittington Park" },
      { text: "The Baseball Trail says no player left a bigger legacy in Hot Springs than Honus Wagner, 'the Flying Dutchman.'", source: "Hot Springs Baseball Trail: Whittington Park" },
    ],
    types: ['cat', 'warp', 'cat', 'landmark', 'cat', 'trolley', 'cat'],
    names: ['Ban Johnson Field', 'Time Warp', 'Fogel Field', 'Whittington Park', 'Baseball Trail', 'Ballfields trolley stop', 'Whittington Avenue corner'] },
  { key: 'hollow', name: 'Happy Hollow', cat: 'Legends & Oddities', stamp: 'Happy Hollow', blurb: 'Home of a cold spring treated by ozone filtration',
    facts: [
      { text: "Photographer Norman McLeod came to Hot Springs in 1888, and Happy Hollow began as his picture studio.", source: "Encyclopedia of Arkansas: Happy Hollow" },
      { text: "Visitors posed for pictures in an old bathtub, on a burro, or taking a drink at the bar.", source: "Encyclopedia of Arkansas: Happy Hollow" },
      { text: "The park had a shooting gallery, a zoo and a souvenir shop.", source: "Encyclopedia of Arkansas: Happy Hollow" },
      { text: "Happy Hollow stood at the head of Fountain Street, just off Central Avenue.", source: "Encyclopedia of Arkansas: Happy Hollow" },
      { text: "The Encyclopedia of Arkansas says all that remains of Happy Hollow are its springs on the southeast slope of North Mountain.", source: "Encyclopedia of Arkansas: Happy Hollow" },
    ],
    types: ['cat', 'jury', 'cat', 'landmark', 'vent', 'warp', 'cat'],
    names: ['Goat Rock', 'Grand Jury', 'North Mountain', 'Happy Hollow', 'Happy Hollow Spring vent', 'Time Warp', 'Fountain Street'] },
  { key: 'park', name: 'Park Avenue', cat: 'People', stamp: 'Park Avenue', blurb: 'Motor courts and a mid-century hotel boom',
    facts: [
      { text: "Bill Clinton lived at 1011 Park Avenue as a child, from 1954 to 1961; the home is not open for tours.", source: "Encyclopedia of Arkansas: Bill Clinton Boyhood Home" },
      { text: "The Arkansas Historic Preservation Program calls the Clinton boyhood home the area's finest example of Tudor Revival style.", source: "Encyclopedia of Arkansas: Bill Clinton Boyhood Home" },
      { text: "The 1925 paved highway from Little Rock became Park Avenue as it entered Hot Springs.", source: "Encyclopedia of Arkansas: Mountainaire Hotel Historic District" },
      { text: "The Mountainaire's Art Moderne buildings on Park Avenue were built in 1947 by Alvin Albinson, who came from Florida for the tourist trade.", source: "Encyclopedia of Arkansas: Mountainaire Hotel Historic District" },
      { text: "The Velda Rose Tower Motor Hotel, an International Style hotel, was among the Arkansas additions to the National Register of Historic Places announced in 2024.", source: "Arkansas Historic Preservation Program" },
    ],
    types: ['cat', 'trolley', 'cat', 'landmark', 'cat', 'postcard', 'cat'],
    names: ['Velda Rose', 'Park Avenue trolley stop', 'Motor courts', 'Park Avenue', 'Tourist courts', 'Postcard', 'Mountainaire'] },
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
const WHIT_NAMES = ['Whittington Avenue at the Y', 'Whittington Avenue midway', 'Whittington Avenue near the Ballfields']; // three spaces, named so no two rows read alike (S4-05)
const whit = WHIT_NAMES.map((name) => addNode({ type: 'cat', district: 'ballfields', cat: 'Sports', name }));
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
