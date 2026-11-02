# Shared helpers for the map build (run inside Blender's Python, which bundles numpy).
import json, struct, math, os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(HERE, '..', '..'))
# Raw geodata (git-ignored, refetchable). In the Hot Springs Games workspace it is shared: reference/geo/downtown/
# holds the TIGER, NHD and OSM downloads, reference/geo/elevation/ the 3DEP DEM tiles (also used by hsg-tub-rally).
# A checkout outside the workspace keeps both in art-src/geo/raw/. HSG_GEO_DIR overrides reference/geo.
_GEO = os.environ.get('HSG_GEO_DIR') or os.path.normpath(os.path.join(GAME, '..', '..', 'reference', 'geo'))
if os.path.isdir(_GEO):
    RAW, DEM_DIR = os.path.join(_GEO, 'downtown'), os.path.join(_GEO, 'elevation')
else:
    RAW = DEM_DIR = os.path.join(GAME, 'art-src', 'geo', 'raw')

def read_tiff_f32(path):
    """Uncompressed single-band float32 TIFF (what the USGS 3DEP exportImage call returns)."""
    b = open(path, 'rb').read()
    assert b[:2] == b'II'
    off = struct.unpack_from('<I', b, 4)[0]
    n = struct.unpack_from('<H', b, off)[0]
    tags = {}
    for i in range(n):
        tag, typ, cnt, val = struct.unpack_from('<HHII', b, off + 2 + i * 12)
        if typ == 3 and cnt == 1: val = struct.unpack_from('<H', b, off + 2 + i * 12 + 8)[0]
        tags[tag] = (typ, cnt, val)
    w, h = tags[256][2], tags[257][2]
    def arr(tag):
        typ, cnt, val = tags[tag]
        if cnt == 1: return [val]
        fmt = '<' + ('H' if typ == 3 else 'I') * cnt
        return list(struct.unpack_from(fmt, b, val))
    if 273 in tags:  # strips
        offs, cnts = arr(273), arr(279)
        data = b''.join(b[o:o + c] for o, c in zip(offs, cnts))
        return np.frombuffer(data, dtype='<f4', count=w * h).reshape(h, w).astype(np.float64)
    tw, th = tags[322][2], tags[323][2]  # tiles
    offs = arr(324)
    a = np.zeros((h, w))
    tx = (w + tw - 1) // tw
    for i, o in enumerate(offs):
        r, c = divmod(i, tx)
        t = np.frombuffer(b, dtype='<f4', count=tw * th, offset=o).reshape(th, tw)
        y0, x0 = r * th, c * tw
        a[y0:y0 + th, x0:x0 + tw] = t[:min(th, h - y0), :min(tw, w - x0)]
    return a

# Local metric frame centred on the Fordyce Bathhouse (approx. middle of Bathhouse Row).
LAT0, LON0 = 34.5136, -93.0533
M_LAT = 110946.0
M_LON = 111320.0 * math.cos(math.radians(LAT0))
def to_m(lon, lat):
    return ((lon - LON0) * M_LON, (lat - LAT0) * M_LAT)  # x east, y north (metres)

def load_json(name):
    return json.load(open(os.path.join(RAW, name), encoding='utf-8'))
