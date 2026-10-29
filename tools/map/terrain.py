# Board height field shared by preview.py and build_board.py: real terrain through the warp, with the
# rim vignettes blended in. z is in board units (u), relative to the Row's sidewalk.
import json, os
import numpy as np
import warp, vignettes
from geo_raster import elevation
from geo_common import GAME

EXAG = 1.7     # vertical exaggeration on top of the local horizontal scale
E0 = 178.0     # reference elevation (m) at the Row

def load_layout():
    p = os.path.join(GAME, 'art-src', 'geo', 'layout.json')
    if not os.path.exists(p): return None
    L = json.load(open(p))
    vs = []
    for v in L.get('vignettes', []):
        v = dict(v); v['real'] = np.asarray(v['real'], float); vs.append(v)
    vignettes.set_vignettes(vs)
    return L

def height_plan(U, V):
    U = np.asarray(U, float); V = np.asarray(V, float)
    X, Y = warp.from_plan(U, V)
    E = elevation(X, Y); E = np.where(np.isfinite(E), E, E0)
    s = warp.local_scale(X, Y)
    z = (E - E0) * s * EXAG
    return vignettes.blend_height(U, V, z, EXAG)
