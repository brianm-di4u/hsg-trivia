# Board layout: places every space of the game graph (art-src/geo/graph.json) at its real location
# (research/geo-anchors.json, OSM footprints and trails) through the board projection, then lays the route on
# the real streets and trails it is named after and spreads the spaces along them at an even pitch.
# Writes art-src/geo/layout.json for build_board.py.
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
put(G['nodes'][[n['id'] for n in N if n['name'] == 'Grand Promenade'][0]]['id'], P([real('quapaw')[0] + 84, real('quapaw')[1] + 6])[0], 1, 'Grand Promenade (set back up the hill: the painted bathhouses stand taller than life)')
put([n['id'] for n in N if n['name'] == 'Grand Promenade'][1], P([real('fordyce')[0] + 90, real('fordyce')[1] + 30])[0], 1, 'Grand Promenade (set back up the hill)')
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

# ------------------------------------------------------------------ tracks: the route runs on the real streets
# The graph is cut into tracks at its junctions; each track is cut into runs at hard pins (junctions, landmarks,
# vignette ends, the start, the tower). A run follows one real line (the Row walk, the west sidewalk, a TIGER
# street, an OSM trail or a lane round Oaklawn's oval) or, where none fits, a smooth curve through the anchors. The spaces between two pins
# are spread at an even arc-length pitch; named places (anchor weight >= 0.8, off the trails) pull softly.
TRACKS = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],                                       # the Row walk, Reserve St, Malvern Ave
    [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 0],                              # Bridge St, back up the west sidewalk
    [11] + list(range(22, 43)),                                                   # Oaklawn, the lakes, the ballfields
    [42, 59, 58, 57, 0],                                                          # Whittington Ave to the Arlington
    [42] + list(range(50, 57)) + list(range(43, 50)) + [0],                       # Park Ave, North Mountain, Fountain St
    [6, 60, 61, 62],                                                              # the Grand Promenade
    [62, 63, 64, 69],                                                             # the Short Cut
    [62, 65, 66, 67, 68, 69],                                                     # the Peak Trail
]
HARD = {0, 3, 5, 6, 8, 11, 17, 21, 22, 28, 29, 31, 32, 35, 36, 39, 42, 43, 46, 50, 53, 56, 58, 62, 69}
STRETCH = {(32, 35): 32}   # vignette runs too short for their spaces: slide this pin away from the run's other end
VIA = {(31, 32): [(-440.0, -400.0)]}   # connectors that bow round a vignette instead of crossing their own route
RUN_LINE = {  # (pin, pin) -> the real line the run follows; any run not listed is a curve through its anchors
    (0, 3): ('row',), (3, 5): ('row',), (5, 6): ('row',), (6, 8): ('row',), (11, 21): ('west',), (22, 28): ('oval',),
    (36, 39): ('street', 'Whittington Ave'), (39, 42): ('street', 'Whittington Ave'), (42, 58): ('street', 'Whittington Ave'),
    (50, 53): ('street', 'Park Ave'), (53, 56): ('street', 'Park Ave'), (46, 0): ('street', 'Fountain St'),
    (62, 69): ('trail',),
}
SOFT_W, SOFT_WIN = 0.5, 0.15   # pull of a named place toward its true spot; how far (x pitch) it may leave the even spot
RADIUS = {'landmark': 19.0, 'start': 16.5, 'trail': 7.0, 'tower': 7.0}   # disc radii, as render.js draws them
rad = lambda n: RADIUS.get(N[n]['type'], 15.2)
GAP_MIN = 8.6     # clear space between two discs; adjacent full-size spaces keep MIN_ADJ
for tr in TRACKS:
    assert tr[0] in HARD and tr[-1] in HARD, tr
assert sorted(tuple(sorted(e)) for e in G['edges']) == sorted(tuple(sorted((t[i], t[i + 1]))) for t in TRACKS for i in range(len(t) - 1))

def arclen(p):
    return np.concatenate([[0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))])

def at_s(p, s):
    S = arclen(p); return np.stack([np.interp(s, S, p[:, 0]), np.interp(s, S, p[:, 1])], -1)

def project(p, q):
    """Arc length along polyline p of the point nearest q."""
    a, b = p[:-1], p[1:]; d = b - a; L2 = np.maximum((d ** 2).sum(1), 1e-12)
    t = np.clip(((q - a) * d).sum(1) / L2, 0, 1); c = a + d * t[:, None]
    i = int(np.argmin(((c - q) ** 2).sum(1)))
    return float(arclen(p)[i] + t[i] * math.sqrt(L2[i]))

def resample(p, step):
    S = arclen(p); return at_s(p, np.linspace(0, S[-1], max(2, int(S[-1] / step) + 1)))

def chaikin(p, n=2):
    for _ in range(n):
        q = [p[0]]
        for a, b in zip(p[:-1], p[1:]): q += [0.75 * a + 0.25 * b, 0.25 * a + 0.75 * b]
        q.append(p[-1]); p = np.array(q)
    return p

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

def realy(p): return float(warp.from_plan(np.array([p[0]]), np.array([p[1]]))[1][0])

def line_between(kind, a, b, inner):
    """The real line for a run from pin a to pin b, in plan units, starting at a and ending at b."""
    pa, pb = pos[a], pos[b]
    if kind[0] in ('row', 'west'):
        f = row if kind[0] == 'row' else west
        ys = np.linspace(realy(pa), realy(pb), 60)
        core = np.array([f(y) for y in ys])
    elif kind[0] == 'street':
        ra = np.stack(warp.from_plan(np.array([pa[0], pb[0]]), np.array([pa[1], pb[1]])), 1)
        core = P(street_path(kind[1], ra[0], ra[1]))
    elif kind[0] == 'oval':   # closed: the lane runs the long way round, so the spaces circle the grounds
        L = float(arclen(oak_oval)[-1]); sa, sb = project(oak_oval, pa), project(oak_oval, pb)
        fwd = (sb - sa) % L; span = fwd if fwd > L / 2 else -(L - fwd)
        loop = np.vstack([oak_oval[:-1]] * 3); return at_s(loop, L + sa + np.linspace(0, span, 240))
    elif kind[0] == 'trail':
        name = {63: 'Short Cut Trail', 65: 'Peak Trail'}[inner[0]]
        core = P(chain_from(trail(name), np.stack(warp.from_plan(np.array([pa[0]]), np.array([pa[1]])), 1)[0]))
    sa, sb = project(core, pa), project(core, pb)
    lo_, hi_ = sorted((sa, sb)); S = arclen(core)
    keep = (S > lo_) & (S < hi_)
    sub = np.vstack([at_s(core, lo_)[None], core[keep], at_s(core, hi_)[None]])
    if sa > sb: sub = sub[::-1]
    return np.vstack([pa[None], sub, pb[None]])

def _oak_lane():
    """An ellipse round Oaklawn's one-mile oval (the extent of the OSM relation's member ways, in the vignette),
    scaled out so seven spaces fit round the grounds."""
    from geo_common import load_json, to_m
    pts = []
    for e in load_json('osm-oaklawn.json')['elements']:
        if e.get('type') == 'way' and 'geometry' in e and not e.get('tags'):
            g = np.array([[q['lon'], q['lat']] for q in e['geometry']]); x, y = to_m(g[:, 0], g[:, 1]); pts.append(np.stack([x, y], 1))
    p = VP('oaklawn', np.concatenate(pts)); c = (p.min(0) + p.max(0)) / 2; ax = (p.max(0) - p.min(0)) / 2
    ax = np.maximum(ax * OAK_LANE, 30.0)
    t = np.linspace(0, 2 * np.pi, 361); return np.stack([c[0] + ax[0] * np.cos(t), c[1] + ax[1] * np.sin(t)], 1)
OAK_LANE = 2.0
oak_oval = resample(_oak_lane(), 1.0)
for n in (22, 28):   # the oval run's two ends sit on the lane
    pos[n] = at_s(oak_oval, project(oak_oval, pos[n]))

def street_path(name, ra, rb, snap=8.0):
    """Shortest path (metres) along the TIGER segments named `name` between the vertices nearest ra and rb.
    Segment ends closer than `snap` m are joined, so split ways and dual carriageways form one network."""
    import heapq
    segs = [xy for cls, nm, xy in geodata.roads() if nm == name]
    V = np.concatenate(segs); nbr = [[] for _ in V]; off = 0
    for s in segs:
        for i in range(len(s) - 1):
            w = float(np.hypot(*(s[i + 1] - s[i]))); nbr[off + i].append((off + i + 1, w)); nbr[off + i + 1].append((off + i, w))
        off += len(s)
    for i in range(len(V)):
        d = np.hypot(*(V - V[i]).T)
        for j in np.where(d < snap)[0]:
            if j != i: nbr[i].append((int(j), float(d[j])))
    src = int(np.argmin(np.hypot(*(V - ra).T))); dst = int(np.argmin(np.hypot(*(V - rb).T)))
    dist = {src: 0.0}; prev = {}; q = [(0.0, src)]
    while q:
        d0, u = heapq.heappop(q)
        if u == dst: break
        if d0 > dist[u]: continue
        for v, w in nbr[u]:
            if d0 + w < dist.get(v, 1e18): dist[v] = d0 + w; prev[v] = u; heapq.heappush(q, (d0 + w, v))
    assert dst in dist, f'{name}: no path'
    path = [dst]
    while path[-1] != src: path.append(prev[path[-1]])
    return V[path[::-1]]

anchor_pt = {nid: pos[nid].copy() for nid in pos if anchor_w[nid] > 0}
MIN_ADJ_PIN = MIN_ADJ = 41.0
is_soft = lambda n: n not in HARD and anchor_w.get(n, 0) >= 0.8 and not N[n]['spur']

# pins first: nudge hard pins apart where two true places sit closer than two discs (the Arlington and the
# start corner), with springs back to their true spots
hard = sorted(HARD); Xh = np.array([pos[n] for n in hard]); X0h = Xh.copy()
Rh = np.array([rad(n) for n in hard]); need_h = np.maximum(Rh[:, None] + Rh[None, :] + GAP_MIN, MIN_ADJ_PIN)
for it in range(200):
    d = Xh[:, None, :] - Xh[None, :, :]; Ld = np.hypot(d[..., 0], d[..., 1]) + np.eye(len(Xh)) * 1e9
    push = np.clip(need_h - Ld, 0, None) / Ld
    if push.max() <= 1e-3: break
    Xh += ((d * push[..., None]).sum(1) * 0.5 + (X0h - Xh) * 0.05) * 0.5
for n, p in zip(hard, Xh):
    if math.hypot(*(p - pos[n])) > 1: print('  pin nudged', n, N[n]['name'], round(float(math.hypot(*(p - pos[n]))), 1))
    pos[n] = p
for (a, b), mv in STRETCH.items():
    tr = next(t for t in TRACKS if a in t and b in t); gaps = abs(tr.index(b) - tr.index(a))
    other = b if mv == a else a; d = pos[mv] - pos[other]; L = math.hypot(*d); need = gaps * (MIN_ADJ + 3)
    if L < need: pos[mv] = pos[other] + d / L * need; print('  pin stretched', mv, N[mv]['name'], round(need - L, 1))

def run_geometry(a, b, inner):
    kind = RUN_LINE.get((a, b)) or RUN_LINE.get((b, a))
    g = line_between(kind, a, b, inner) if kind else None
    if g is not None and kind[0] == 'street' and arclen(g)[-1] > 1.5 * math.hypot(*(pos[b] - pos[a])) + 30:
        print(f'  run {a}>{b}: {kind[1]} doubles back here; using a curve through the anchors'); g = None
    if g is None:   # a smooth curve through every anchored space of the run (shape hints included)
        ctrl = [pos[a]] + [anchor_pt[n] for n in inner if n in anchor_pt] + [np.array(v) for v in VIA.get((a, b), [])] + [pos[b]]
        g = cr(ctrl, 14)
    g = chaikin(resample(g, 1.0), 2)
    return resample(g, 1.0)

def solve_run(n_gaps, L, soft):
    """Arc positions of a run's inner spaces between pins at 0 and L. Minimises the spread of the gaps
    (sum of (gap - pitch)^2, whose minimum is an even pitch) plus SOFT_W * (s - s*)^2 for named places; a
    named place pulled more than SOFT_WIN pitches off its even spot is clamped there and the rest re-solved."""
    k = n_gaps - 1; p = L / n_gaps
    if k <= 0: return np.array([]), p
    fixed = {}
    for _ in range(4):
        M = np.diag(np.full(k, 2.0)) - np.eye(k, k=1) - np.eye(k, k=-1); r = np.zeros(k); r[-1] += L
        for i, s0 in soft.items():
            M[i, i] += SOFT_W; r[i] += SOFT_W * s0
        for i, s0 in fixed.items():
            M[i, :] = 0; M[i, i] = 1; r[i] = s0
        s = np.linalg.solve(M, r)
        even = lambda i: (i + 1) * p
        bad = {i: float(np.clip(s[i], even(i) - SOFT_WIN * p, even(i) + SOFT_WIN * p)) for i in soft
               if i not in fixed and abs(s[i] - even(i)) > SOFT_WIN * p + 1e-6}
        if not bad: break
        fixed.update(bad)
    return s, p

run_of = {}      # node -> (run index, s)
runs = []        # {a, b, ids, geom, pitch}
for ti, tr in enumerate(TRACKS):
    pins = [i for i, nid in enumerate(tr) if nid in HARD]
    for p0, p1 in zip(pins[:-1], pins[1:]):
        a, b, inner = tr[p0], tr[p1], tr[p0 + 1:p1]
        geom = run_geometry(a, b, inner); L = float(arclen(geom)[-1])
        soft = {i: project(geom, anchor_pt[n]) for i, n in enumerate(inner) if is_soft(n)}
        s, p = solve_run(len(inner) + 1, L, soft)
        ri = len(runs); runs.append({'a': a, 'b': b, 'ids': [a] + inner + [b], 'geom': geom, 'pitch': p, 'track': ti})
        run_of.setdefault(a, (ri, 0.0)); run_of.setdefault(b, (ri, L))
        for n, si in zip(inner, s): run_of[n] = (ri, float(si))
        for n, si in zip(inner, s): pos[n] = at_s(geom, si)

# ------------------------------------------------------------------ overlap guard: slide along the street only
ids_all = sorted(pos)
adj_pairs = {tuple(sorted(e)) for e in G['edges']}
R_ = np.array([rad(n) for n in ids_all])
NEED = R_[:, None] + R_[None, :] + GAP_MIN
free = [n for n in ids_all if n not in HARD]
moved0 = {n: pos[n].copy() for n in free}
for it in range(300):
    X = np.array([pos[n] for n in ids_all]); idx = {n: k for k, n in enumerate(ids_all)}
    d = X[:, None, :] - X[None, :, :]; Ld = np.hypot(d[..., 0], d[..., 1]) + np.eye(len(X)) * 1e9
    need = NEED.copy()
    for a, b in adj_pairs:
        if not (N[a]['spur'] or N[b]['spur']): need[idx[a], idx[b]] = need[idx[b], idx[a]] = max(MIN_ADJ, NEED[idx[a], idx[b]])
    push = np.clip(need - Ld, 0, None) / Ld
    if push.max() <= 1e-3: break
    F = (d * push[..., None]).sum(1) * 0.5
    for n in free:
        ri, s = run_of[n]; geom = runs[ri]['geom']; L = float(arclen(geom)[-1])
        t = at_s(geom, min(L, s + 1.0)) - at_s(geom, max(0.0, s - 1.0)); t = t / (np.hypot(*t) + 1e-9)
        ids = runs[ri]['ids']; k = ids.index(n)
        lo = run_of[ids[k - 1]][1] + 1.0 if run_of[ids[k - 1]][0] == ri else 1.0
        hi = run_of[ids[k + 1]][1] - 1.0 if run_of[ids[k + 1]][0] == ri else L - 1.0
        s = float(np.clip(s + float(F[idx[n]] @ t) * 0.5, lo, hi))
        run_of[n] = (ri, s); pos[n] = at_s(geom, s)
for n in free:
    m = math.hypot(*(pos[n] - moved0[n]))
    if m > 4: print('  overlap guard moved', n, N[n]['name'], round(m, 1))

# ------------------------------------------------------------------ route curves: each edge is its slice of the run
edges = []
for a, b in G['edges']:
    ri = next(i for i, r in enumerate(runs) if a in r['ids'] and b in r['ids'] and abs(r['ids'].index(a) - r['ids'].index(b)) == 1)
    r = runs[ri]; sa = run_of[a][1] if run_of[a][0] == ri else (0.0 if a == r['a'] else float(arclen(r['geom'])[-1]))
    sb = run_of[b][1] if run_of[b][0] == ri else (0.0 if b == r['a'] else float(arclen(r['geom'])[-1]))
    s = np.linspace(sa, sb, 15)
    seg = at_s(r['geom'], s); seg[0] = pos[a]; seg[-1] = pos[b]
    edges.append({'a': a, 'b': b, 'pts': seg.round(2).tolist(), 'trail': N[a]['spur'] or N[b]['spur']})

# pitch report: the gap (along the route) between neighbouring spaces, per run and per track
def gap(a, b):
    e = next(e for e in edges if {e['a'], e['b']} == {a, b}); return float(arclen(np.array(e['pts']))[-1])
tracks_out = []
for ri, r in enumerate(runs):
    g = np.array([gap(a, b) for a, b in zip(r['ids'][:-1], r['ids'][1:])])
    cv = float(g.std() / g.mean()) if len(g) > 1 else 0.0
    tracks_out.append({'name': f"{N[r['a']]['name']} > {N[r['b']]['name']}", 'track': r['track'], 'ids': r['ids'],
                       'pitch': round(float(g.mean()), 1), 'cv': round(cv, 3), 'minGap': round(float(g.min()), 1)})
    print(f"  run {r['a']:>2}>{r['b']:<2} {len(g):>2} gaps  pitch {g.mean():6.1f}  cv {cv:.3f}  min {g.min():5.1f}  {N[r['a']]['name']} > {N[r['b']]['name']}")
# acceptance: even pitch inside every run of 3+ gaps (looser where pins split the Row, Central Avenue and the
# Promenade behind them), and no two discs touching
LOOSE = {(0, 3), (3, 5), (6, 8), (11, 17), (17, 21), (6, 62)}
for t in tracks_out:
    a, b = t['ids'][0], t['ids'][-1]
    lim = 0.25 if (a, b) in LOOSE else 0.15
    assert len(t['ids']) < 4 or t['cv'] <= lim, f"uneven run {t['name']}: cv {t['cv']} > {lim}"
for i, a in enumerate(ids_all):
    for b in ids_all[i + 1:]:
        d = math.hypot(*(pos[a] - pos[b]))
        assert d >= rad(a) + rad(b) + 2, f'spaces {a} and {b} touch ({d:.1f} u)'
pin_of = lambda n: 'hard' if n in HARD else ('soft' if is_soft(n) else 'free')

out = {
    'nodes': [{'id': nid, 'x': round(float(pos[nid][0]), 2), 'y': round(float(pos[nid][1]), 2), 'src': note.get(nid, 'even pitch'),
               'type': N[nid]['type'], 'district': N[nid]['district'], 'name': N[nid]['name'],
               'run': run_of[nid][0], 's': round(run_of[nid][1], 2), 'pin': pin_of(nid)} for nid in ids_all],
    'edges': edges,
    'tracks': tracks_out,
    'vignettes': [{k: (v[k].tolist() if isinstance(v[k], np.ndarray) else v[k]) for k in v} for v in VIGS],
}
json.dump(out, open(os.path.join(GAME, 'art-src', 'geo', 'layout.json'), 'w'), indent=1)
# report spacing, and how far each named place sits from its true spot
dmin = min(math.hypot(*(pos[a] - pos[b])) for a, b in G['edges'])
print('layout ok', len(out['nodes']), 'nodes; min adjacent spacing', round(dmin, 1))
for nid in ids_all:
    if nid not in anchor_pt or not (nid in HARD or is_soft(nid)): continue
    moved = math.hypot(*(pos[nid] - anchor_pt[nid]))
    if moved > 18: print('  moved', nid, N[nid]['name'], round(moved, 1))
