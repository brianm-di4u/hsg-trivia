# Board layout: places every space of the game graph (art-src/geo/graph.json) at its real location
# (research/geo-anchors.json, OSM footprints and trails) through the board projection, then relaxes the
# spacing and draws the route curves. Writes art-src/geo/layout.json for build_board.py.
#   blender -b --factory-startup --python tools/map/layout.py
import sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import warp, geodata, vignettes
from geo_common import GAME, LAT0, LON0, M_LAT, M_LON

G = json.load(open(os.path.join(GAME, 'art-src', 'geo', 'graph.json')))
A = json.load(open(os.path.join(GAME, 'research', 'geo-anchors.json')))
geodata.init()

def real(key):
    a = A[key]; return np.array([(a['lon'] - LON0) * M_LON, (a['lat'] - LAT0) * M_LAT])

def P(xy):
    xy = np.atleast_2d(np.asarray(xy, float)); u, v = warp.to_plan(xy[:, 0], xy[:, 1]); return np.stack([u, v], 1)

# ------------------------------------------------------------------ vignettes (outlying places, pulled in)
# at: plan centre; real: real centre (m); scale: u/m; r: radius (u); feather (u); base: reference elevation (m)
VIGS = [
    dict(name='oaklawn', label='Oaklawn', real=np.array([-342.0, -3150.0]), at=[-40, -440], scale=0.10, r=88, feather=34, base=170, zmul=0.6,
         truth='2.0 mi south'),
    dict(name='hamilton', label='Lake Hamilton', real=np.array([780.0, -7000.0]), at=[-300, -398], scale=0.048, r=112, feather=40, base=122, zmul=0.35,
         truth='3.5 mi south'),
    dict(name='ouachita', label='Lake Ouachita', real=np.array([-12300.0, 8600.0]), at=[-388, -105], scale=0.022, r=108, feather=38, base=176, zmul=0.25,
         truth='9 mi west-northwest'),
    dict(name='catherine', label='Lake Catherine', real=real('lakeCatherineShore') + [1500, -1500], at=[392, -430], scale=0.028, r=105, feather=40, base=93, zmul=0.3,
         truth='4.8 mi southeast'),
]
for v in VIGS: v['real'] = np.asarray(v['real'], float)
vignettes.set_vignettes(VIGS)
VIG = {v['name']: v for v in VIGS}
def VP(name, xy):
    v = VIG[name]; xy = np.asarray(xy, float)
    return np.asarray(v['at']) + (xy - v['real']) * v['scale']

# ------------------------------------------------------------------ downtown tracks
xc = lambda y: float(np.interp(y, warp.CENTRAL[0], warp.CENTRAL[1]))
ROW_OFF, WEST_OFF = 12.0, -12.0   # metres from Central Avenue's centreline (Row walk / west sidewalk)
def row(y): return P([xc(y) + ROW_OFF, y])[0]
def west(y): return P([xc(y) + WEST_OFF, y])[0]
def behind(key, dx=24.0):  # on the Grand Promenade side, behind a bathhouse
    r = real(key); return P([r[0] + dx, r[1]])[0]

osm_b, osm_p, osm_parks = geodata.osm()
def trail(name):
    segs = [xy for t, xy in osm_p if t.get('name') == name]
    return segs

def chain_from(segs, start):
    """Join OSM ways into one polyline starting nearest `start` (greedy)."""
    segs = [s.copy() for s in segs]; out = []
    cur = np.asarray(start, float)
    while segs:
        best = min(range(len(segs)), key=lambda i: min(np.hypot(*(segs[i][0] - cur)), np.hypot(*(segs[i][-1] - cur))))
        s = segs.pop(best)
        if np.hypot(*(s[-1] - cur)) < np.hypot(*(s[0] - cur)): s = s[::-1]
        if out and np.hypot(*(s[0] - cur)) > 120: continue
        out.extend(s.tolist()); cur = s[-1]
    return np.array(out)

def along(poly, fracs):
    poly = np.asarray(poly, float); seg = np.hypot(*np.diff(poly, axis=0).T); s = np.concatenate([[0], np.cumsum(seg)])
    return np.array([[np.interp(f * s[-1], s, poly[:, 0]), np.interp(f * s[-1], s, poly[:, 1])] for f in fracs])

# ------------------------------------------------------------------ anchors for every node
N = G['nodes']
ids = {}
for n in N:
    if n['district']: ids.setdefault(n['district'], []).append(n['id'])
at = lambda k, i: ids[k][i]
pos = {}; anchor_w = {}; note = {}
def put(nid, p, w=1.0, why=''):
    pos[nid] = np.asarray(p, float); anchor_w[nid] = w; note[nid] = why

# START: the Central Avenue / Fountain Street corner at the Arlington's lawn
put(G['start'], P(real('centralFountain') + [10, -6])[0], 1, 'centralFountain')
# Bathhouse Row walk, north to south; the vent sits behind the Maurice at the Display Spring
put(at('row', 0), row(real('superior')[1]), 1, 'superior')
put(at('row', 1), row(real('hale')[1]), 1, 'hale')
put(at('row', 2), behind('displaySpring', 6), 1, 'displaySpring')
put(at('row', 3), row(real('fordyce')[1]), 1, 'fordyce')
put(at('row', 4), row(real('quapaw')[1]), 1, 'quapaw')
put(at('row', 5), row(real('ozark')[1] - 8), 1, 'ozark front / Promenade stairs')
put(at('row', 6), row(real('buckstaff')[1]), 1, 'buckstaff')
# Bridge Street district: Reserve St corner, Malvern Ave, Bridge St, Malco, back up the west side
put(at('bridge', 0), row(real('centralReserve')[1] - 18), 1, 'centralReserve')
put(at('bridge', 1), P(real('centralReserve') + [70, -95])[0], 0.4, 'Malvern Ave start')
put(at('bridge', 2), P(real('bridgeSt') + [150, 40])[0], 0.6, 'Malvern Ave')
put(at('bridge', 3), P(real('bridgeSt'))[0], 1, 'bridgeSt')
put(at('bridge', 4), P(real('malco') + [-8, 0])[0], 1, 'malco')
put(at('bridge', 5), west(-395), 0.5, 'west side')
put(at('bridge', 6), west(-300), 0.5, 'west side')
# Central Avenue west side, south to north
put(at('central', 0), west(-200), 0.6, 'west side at Reserve')
put(at('central', 1), west(-40), 0.5, 'west side')
put(at('central', 2), west(real('ohioClub')[1]), 1, 'ohioClub')
put(at('central', 3), west(205), 0.5, 'west side')
put(at('central', 4), west(255), 1, 'southernClub (250 Central)')
put(at('central', 5), west(real('medicalArts')[1] + 8), 1, 'medicalArts')
put(at('central', 6), P(real('arlington') + [-22, 8])[0], 1, 'arlington')
# Whittington Avenue from the Arlington past the Y
whit = [n['id'] for n in N if n['name'] == 'Whittington Avenue' and n['id'] != at('ballfields', 6)]
put(whit[0], P(real('arlington') + [-150, 140])[0], 0.5, 'Central north of the Arlington')
put(whit[1], P(real('parkWhittingtonY'))[0], 1, 'parkWhittingtonY')
put(whit[2], P(real('parkWhittingtonY') + [-260, -40])[0], 0.5, 'Whittington Ave')
# Ballfields, outer to inner along Whittington Avenue
put(at('ballfields', 0), P(real('banJohnson') + [-40, -60])[0], 1, 'banJohnson')
put(at('ballfields', 2), P(real('fogelField') + [120, 120])[0], 0.8, 'fogelField')
put(at('ballfields', 3), P(real('whittingtonPark'))[0], 1, 'whittingtonPark')
put(at('ballfields', 6), P(real('parkWhittingtonY') + [-520, -110])[0], 0.5, 'Whittington Ave')
# Park Avenue, from the Y north-east to the Mountainaire
put(at('park', 0), P(real('velda'))[0], 1, 'velda')
put(at('park', 2), P(real('parkAveCourtsS') + [40, 120])[0], 0.8, 'parkAveCourtsS')
put(at('park', 3), P((real('parkAveCourtsS') + real('parkAveCourtsN')) / 2)[0], 0.6, 'Park Ave courts strip')
put(at('park', 6), P(real('mountainaire'))[0], 1, 'mountainaire')
# Happy Hollow: Goat Rock, North Mountain, down to Happy Hollow and Fountain Street
put(at('hollow', 0), P(real('goatRock'))[0], 1, 'goatRock')
put(at('hollow', 2), P(real('northMountain'))[0], 1, 'northMountain')
put(at('hollow', 3), P(real('happyHollow'))[0], 1, 'happyHollow')
put(at('hollow', 6), P(real('centralFountain') + [150, 90])[0], 0.6, 'Fountain St')
# Oaklawn vignette: around the one-mile oval and grandstand
oc = VIG['oaklawn']['real']
for i, (dx, dy) in enumerate([(-250, 380), (-300, 160), (-310, -60), (-250, -280), (-60, -480), (-300, -560), (-520, -470)]):
    put(at('oaklawn', i), VP('oaklawn', oc + [dx, dy]), 0.9 if i == 3 else 0.6, 'oaklawn vignette')
# Lakes: Lake Hamilton shore, creek mouth, Garvan; then Blakely Dam and Lake Ouachita
put(at('lakes', 0), VP('hamilton', real('lakeHamiltonShore')), 0.8, 'lakeHamiltonShore')
put(at('lakes', 1), VP('hamilton', real('lakeHamiltonShore') + [-1100, -500]), 0.5, 'creek mouth (approx)')
put(at('lakes', 2), VP('hamilton', real('garvanGardens')), 1, 'garvanGardens')
put(at('lakes', 3), VP('ouachita', real('lakeOuachitaShore') + [200, 300]), 0.8, 'lakeOuachitaShore')
put(at('lakes', 4), VP('ouachita', real('blakelyDam')), 1, 'blakelyDam')
put(at('lakes', 6), VP('ouachita', real('lakeOuachitaSP')), 1, 'lakeOuachitaSP')
# Mountain spur: Grand Promenade behind the Row, then the Peak Trail and the Short Cut to the tower
gp = P(real('grandPromenadeS') * 0 + [real('ozark')[0] + 40, real('ozark')[1] + 20])[0]
put(G['nodes'][[n['id'] for n in N if n['name'] == 'Grand Promenade'][0]]['id'], P([real('quapaw')[0] + 44, real('quapaw')[1] + 6])[0], 1, 'Grand Promenade')
put([n['id'] for n in N if n['name'] == 'Grand Promenade'][1], P([real('fordyce')[0] + 50, real('fordyce')[1] + 30])[0], 1, 'Grand Promenade')
fork = [n['id'] for n in N if n['name'] == 'Trail fork'][0]
put(fork, P(real('peakTrailhead') + [30, 10])[0], 1, 'peakTrailhead')
peak = chain_from(trail('Peak Trail'), real('peakTrailhead'))
short = chain_from(trail('Short Cut Trail'), real('shortCutLower'))
kk = [n['id'] for n in N if n['name'].startswith('Peak Trail')]
ss = [n['id'] for n in N if n['name'].startswith('Short Cut')]
if len(peak) > 2:
    for nid, q in zip(kk, along(peak, [0.2, 0.42, 0.64, 0.84])): put(nid, P(q)[0], 0.8, 'Peak Trail (OSM)')
if len(short) > 2:
    for nid, q in zip(ss, along(short, [0.3, 0.75])): put(nid, P(q)[0], 0.8, 'Short Cut Trail (OSM)')
put(G['tower'], P(real('tower'))[0], 1, 'tower')

# ------------------------------------------------------------------ fill the unanchored spaces along their chains
adj = {n['id']: [] for n in N}
for a, b in G['edges']: adj[a].append(b); adj[b].append(a)
def chain_fill():
    for k, lst in ids.items():
        known = [i for i, nid in enumerate(lst) if nid in pos]
        for i, nid in enumerate(lst):
            if nid in pos: continue
            lo = max([j for j in known if j < i], default=None); hi = min([j for j in known if j > i], default=None)
            if lo is None or hi is None:
                # extrapolate from a neighbour outside the district
                nb = [x for x in adj[nid] if x in pos]
                if nb: put(nid, pos[nb[0]] + (np.random.default_rng(nid).random(2) - 0.5) * 20, 0.0, 'neighbour')
                continue
            t = (i - lo) / (hi - lo)
            put(nid, pos[lst[lo]] * (1 - t) + pos[lst[hi]] * t, 0.0, 'interpolated')
chain_fill(); chain_fill()
missing = [n['id'] for n in N if n['id'] not in pos]
assert not missing, missing

# ------------------------------------------------------------------ relax spacing
ids_all = sorted(pos)
X = np.array([pos[i] for i in ids_all]); X0 = X.copy(); W = np.array([anchor_w[i] for i in ids_all])
idx = {nid: k for k, nid in enumerate(ids_all)}
E = np.array([[idx[a], idx[b]] for a, b in G['edges']])
MIN_ADJ, MIN_ANY = 41.0, 39.0
for it in range(400):
    F = np.zeros_like(X)
    # anchor springs
    F += (X0 - X) * (0.02 + 0.25 * W[:, None])
    # pairwise repulsion
    d = X[:, None, :] - X[None, :, :]; L = np.hypot(d[..., 0], d[..., 1]) + np.eye(len(X)) * 1e9
    push = np.clip(MIN_ANY - L, 0, None) / L
    F += (d * push[..., None]).sum(1) * 0.5
    # adjacent pairs: keep at least MIN_ADJ apart, pull together beyond 70
    for a, b in E:
        v = X[b] - X[a]; l = math.hypot(*v) + 1e-9
        if l < MIN_ADJ: f = (l - MIN_ADJ) * 0.5
        elif l > 70: f = (l - 70) * 0.05
        else: continue
        F[a] += v / l * f; F[b] -= v / l * f
    X += F * 0.5
for nid in ids_all: pos[nid] = X[idx[nid]]

# ------------------------------------------------------------------ route curves (Catmull-Rom through chains)
def cr(pts, n=10):
    pts = np.asarray(pts, float)
    if len(pts) == 2: return np.linspace(pts[0], pts[1], n + 1)
    out = []
    P0 = np.vstack([2 * pts[0] - pts[1], pts, 2 * pts[-1] - pts[-2]])
    for i in range(1, len(P0) - 2):
        p0, p1, p2, p3 = P0[i - 1], P0[i], P0[i + 1], P0[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1]); return np.array(out)

edges = []
for a, b in G['edges']:
    # smooth using each end's other neighbour for tangents
    na = [x for x in adj[a] if x != b]; nb = [x for x in adj[b] if x != a]
    pa = pos[na[0]] if len(na) == 1 else 2 * pos[a] - pos[b]
    pb = pos[nb[0]] if len(nb) == 1 else 2 * pos[b] - pos[a]
    seg = cr([pa, pos[a], pos[b], pb], 14)
    seg = seg[14:29]
    edges.append({'a': a, 'b': b, 'pts': seg.round(2).tolist(), 'trail': N[a]['spur'] or N[b]['spur']})

out = {
    'nodes': [{'id': nid, 'x': round(float(pos[nid][0]), 2), 'y': round(float(pos[nid][1]), 2), 'src': note[nid],
               'type': N[nid]['type'], 'district': N[nid]['district'], 'name': N[nid]['name']} for nid in ids_all],
    'edges': edges,
    'vignettes': [{k: (v[k].tolist() if isinstance(v[k], np.ndarray) else v[k]) for k in v} for v in VIGS],
}
json.dump(out, open(os.path.join(GAME, 'art-src', 'geo', 'layout.json'), 'w'), indent=1)
# report spacing
dmin = min(math.hypot(*(pos[a] - pos[b])) for a, b in G['edges'])
print('layout ok', len(out['nodes']), 'nodes; min adjacent spacing', round(dmin, 1))
for nid in ids_all:
    moved = math.hypot(*(pos[nid] - X0[idx[nid]]))
    if moved > 18 and anchor_w[nid] >= 0.8: print('  moved', nid, N[nid]['name'], round(moved, 1))
