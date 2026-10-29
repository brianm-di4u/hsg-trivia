# Review overlay: draws data/board-geo.json nodes (district colours), labels and vignette rings on a render.
#   blender -b --factory-startup --python tools/map/overlay.py -- render.png out.png
import bpy, sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geo_common import GAME
a = sys.argv[sys.argv.index('--') + 1:]
im = bpy.data.images.load(a[0]); W, H = im.size
px = np.array(im.pixels[:], np.float32).reshape(H, W, 4)[::-1].copy()
geo = json.load(open(os.path.join(GAME, 'data', 'board-geo.json')))
G = json.load(open(os.path.join(GAME, 'art-src', 'geo', 'graph.json')))
k = W / 1000.0
COLS = {'row': (0, .45, .7), 'bridge': (.55, .35, .17), 'central': (.76, .25, .05), 'oaklawn': (.34, .7, .91), 'lakes': (0, .48, .35),
        'ballfields': (.9, .62, 0), 'hollow': (.36, .29, .55), 'park': (.8, .47, .65), 'mountain': (.4, .3, .2)}
def disk(x, y, r, c):
    x0, x1 = int(max(0, x - r)), int(min(W, x + r + 1)); y0, y1 = int(max(0, y - r)), int(min(H, y + r + 1))
    if x1 <= x0 or y1 <= y0: return
    yy, xx = np.mgrid[y0:y1, x0:x1]; m = (xx - x) ** 2 + (yy - y) ** 2 <= r * r
    px[y0:y1, x0:x1][m, :3] = c
for i, n in enumerate(geo['nodes']):
    g = G['nodes'][i]; c = COLS.get(g['district'], (1, 1, 1))
    r = (16 if g['type'] == 'landmark' else 11 if g['type'] != 'trail' else 6) * k
    disk(n['x'] * k, n['y'] * k, r + 2 * k, (0, 0, 0)); disk(n['x'] * k, n['y'] * k, r, c if g['type'] in ('cat', 'landmark', 'trail') else (1, 1, 1))
for L in geo.get('labels', []):
    disk(L['at'][0] * k, L['at'][1] * k, 6 * k, (1, 0, 1))
    for q in L.get('ring', []): disk(q[0] * k, q[1] * k, 1.5 * k, (1, 1, 1))
o = bpy.data.images.new('o', W, H, alpha=True); o.pixels = px[::-1].ravel(); o.filepath_raw = a[1]; o.file_format = 'PNG'; o.save()
