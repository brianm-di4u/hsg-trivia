# Quick top-down preview of the warped plan (no Blender scene): hillshade + water + roads + buildings.
# blender -b --factory-startup --python tools/map/preview.py -- out.png [px_per_unit]
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import warp, geodata, vignettes, json
from terrain import height_plan, load_layout
from geo_raster import elevation, fill_polygons, stroke, write_png

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'preview.png'
PPU = float(argv[1]) if len(argv) > 1 else 1.5
EXT = 540
geodata.init()
LAYOUT = load_layout()
N = int(2 * EXT * PPU)
u = (np.arange(N) + 0.5) / PPU - EXT
U, V = np.meshgrid(u, -u)  # row 0 = north
X, Y = warp.from_plan(U, V)
E = elevation(X, Y)
E = np.where(np.isfinite(E), E, 120)
Z = height_plan(U, V)
gy, gx = np.gradient(Z, 1 / PPU)
# light from the north-west
lx, ly, lz = -0.55, 0.55, 0.63
nx, ny, nz = -gx, gy, np.ones_like(gx)
shade = (nx * lx + ny * ly + nz * lz) / np.sqrt(nx * nx + ny * ny + nz * nz)
t = np.clip((Z + 40) / 120, 0, 1)
base = np.stack([150 + 60 * t, 170 + 30 * t, 110 + 40 * t], -1)
img = base * (0.55 + 0.6 * np.clip(shade, 0, 1))[..., None]
RP = np.hypot(U, V)

to_px = lambda xy: np.stack([(xy[:, 0] + EXT) * PPU, (EXT - xy[:, 1]) * PPU], 1)
def plan(xy): return np.stack(warp.to_plan(xy[:, 0], xy[:, 1]), 1)

img[vignettes.lake_mask(U, V)] = [50, 120, 150]
for name, xy in geodata.streams():
    m = np.zeros((N, N), bool); stroke(m, to_px(plan(xy)), 1.2); img[m] = [60, 130, 160]
for cls, name, xy in geodata.roads():
    w = {'primary': 3.0, 'secondary': 2.2, 'local': 1.0}[cls] * PPU / 1.5
    m = np.zeros((N, N), bool); stroke(m, to_px(plan(xy)), w)
    img[m] = [235, 225, 200] if cls != 'local' else [215, 205, 185]
bld, paths, parks = geodata.osm()
bm = fill_polygons([plan(xy) for t, xy in bld], N, N, to_px)
img[bm] = [170, 80, 60]
for t, xy in paths:
    m = np.zeros((N, N), bool); stroke(m, to_px(plan(xy)), 0.8); img[m] = [120, 60, 30]
for v in vignettes.VIGNETTES:
    d = np.hypot(U - v['at'][0], V - v['at'][1]); img[(d > v['r']) & (d < v['r'] + 1.5)] = [255, 255, 255]
if LAYOUT:
    for e in LAYOUT['edges']:
        m = np.zeros((N, N), bool); stroke(m, to_px(np.array(e['pts'])), 5 * PPU); img[m] = [150, 70, 50] if not e['trail'] else [110, 80, 50]
    G = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-src', 'geo', 'graph.json')))
    COLS = {'row': [0, 114, 178], 'bridge': [140, 90, 43], 'central': [194, 65, 12], 'oaklawn': [86, 180, 233], 'lakes': [0, 122, 90], 'ballfields': [230, 159, 0], 'hollow': [91, 74, 139], 'park': [204, 121, 167]}
    for nd in LAYOUT['nodes']:
        g = G['nodes'][nd['id']]; c = COLS.get(g['district'], [250, 250, 250]) if g['type'] in ('cat', 'landmark') else [250, 245, 230]
        p = to_px(np.array([[nd['x'], nd['y']], [nd['x'] + 0.01, nd['y']]]))
        m = np.zeros((N, N), bool); stroke(m, p, (26 if g['type'] == 'landmark' else 20) * PPU); img[m] = [20, 20, 20]
        m = np.zeros((N, N), bool); stroke(m, p, (22 if g['type'] == 'landmark' else 16) * PPU); img[m] = c
write_png(OUT, img)
print('wrote', OUT, N)
