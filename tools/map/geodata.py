# Loads the raw public data (TIGER roads, NHD water, OSM downtown) into real metric coordinates.
import numpy as np
from geo_common import load_json, to_m
import warp

def _lines(geom):
    t, c = geom['type'], geom['coordinates']
    if t == 'LineString': return [c]
    if t == 'MultiLineString': return c
    return []

def _xy(coords):
    a = np.array(coords, float)[:, :2]
    x, y = to_m(a[:, 0], a[:, 1]); return np.stack([x, y], 1)

def roads():
    """[(cls, name, (N,2) metres)] with cls in primary|secondary|local."""
    out = []
    for f, cls in [('roads-primary.json', 'primary'), ('roads-secondary.json', 'secondary'), ('roads-local-0.json', 'local')]:
        for ft in load_json(f)['features']:
            for ln in _lines(ft['geometry']):
                out.append((cls, ft['properties'].get('NAME') or '', _xy(ln)))
    return out

def rail():
    return [_xy(ln) for ft in load_json('rail.json')['features'] for ln in _lines(ft['geometry'])]

def water():
    """[(name, [rings (N,2)])] lakes/ponds."""
    out = []
    for ft in load_json('water.json')['features']:
        g = ft['geometry']; polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
        for poly in polys:
            out.append((ft['properties'].get('GNIS_NAME') or '', [_xy(r) for r in poly]))
    return out

def streams():
    return [(ft['properties'].get('gnis_name') or ft['properties'].get('GNIS_NAME') or '', _xy(ln))
            for ft in load_json('flow.json')['features'] for ln in _lines(ft['geometry'])]

def osm():
    """buildings: [(tags, (N,2))], paths: [(tags, (N,2))]"""
    els = load_json('osm-downtown.json')['elements']
    b, p, parks = [], [], []
    for e in els:
        g = e.get('geometry');
        if not g: continue
        xy = _xy([[q['lon'], q['lat']] for q in g]); tags = e.get('tags', {})
        if 'building' in tags: b.append((tags, xy))
        elif 'highway' in tags: p.append((tags, xy))
        elif tags.get('leisure') == 'park': parks.append((tags, xy))
    return b, p, parks

def central_knots():
    """Central Avenue centreline through downtown as (y, x) knots, 40 m bins."""
    pts = np.concatenate([xy for cls, n, xy in roads() if n == 'Central Ave'])
    sel = (np.abs(pts[:, 1]) < 2500) & (np.abs(pts[:, 0]) < 900)
    pts = pts[sel]
    knots = []
    for y0 in np.arange(-2500, 2500, 40):
        m = (pts[:, 1] >= y0) & (pts[:, 1] < y0 + 40)
        if m.sum(): knots.append((float(pts[m, 1].mean()), float(pts[m, 0].mean())))
    return knots

def init():
    warp.set_central(central_knots())
