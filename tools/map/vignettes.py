# Outer-ring vignettes and masks. The inner disk (about 1.5 km around Bathhouse Row) is real terrain
# through warp.py. Oaklawn and the three Ouachita River lakes are too far away for one sheet, so each one is
# pasted into the rim as a true-shape patch of real data, at its true bearing from the Row. The board labels
# say so and give the real distance.
import numpy as np
import warp, geodata
from geo_raster import elevation

# Each vignette: real centre (m), board centre (plan u), scale (u per m), radius (u), feather (u).
VIGNETTES = []

def set_vignettes(v):
    VIGNETTES[:] = v

def _vig_weight(U, V, vg):
    d = np.hypot(U - vg['at'][0], V - vg['at'][1])
    return np.clip((vg['r'] - d) / vg['feather'], 0, 1) ** 1.5

def vig_to_real(U, V, vg):
    s = vg['scale']; c = vg['real']
    return c[0] + (U - vg['at'][0]) / s, c[1] + (V - vg['at'][1]) / s

# ---- lakes inside vignettes: an NHD raster in real coordinates; the bed is carved under one flat water disc
_LAKE = {}
def _lake_raster(vg):
    from geo_raster import fill_polygons
    key = vg['name']
    if key in _LAKE: return _LAKE[key]
    R = vg['r'] / vg['scale']; res = max(6.0, R / 700.0); n = int(2 * R / res) + 1
    x0, y0 = vg['real'][0] - R, vg['real'][1] - R
    to_px = lambda xy: np.stack([(xy[:, 0] - x0) / res, (xy[:, 1] - y0) / res], 1)
    m = np.zeros((n, n), bool)
    for name, rings in geodata.water():
        bb = np.concatenate(rings)
        if bb[:, 0].max() < x0 or bb[:, 0].min() > x0 + 2 * R or bb[:, 1].max() < y0 or bb[:, 1].min() > y0 + 2 * R: continue
        m |= fill_polygons(rings, n, n, to_px)
    lvl = None
    if m.any():
        iy, ix = np.nonzero(m); k = np.linspace(0, len(ix) - 1, min(400, len(ix))).astype(int)
        E = elevation(x0 + (ix[k] + 0.5) * res, y0 + (iy[k] + 0.5) * res); lvl = float(np.nanmedian(E))
    _LAKE[key] = (x0, y0, res, m, lvl)
    return _LAKE[key]

def _in_lake(vg, X, Y):
    x0, y0, res, m, lvl = _lake_raster(vg)
    if lvl is None: return np.zeros(np.shape(X), bool)
    ix = np.clip(((X - x0) / res).astype(int), 0, m.shape[1] - 1); iy = np.clip(((Y - y0) / res).astype(int), 0, m.shape[0] - 1)
    return m[iy, ix]

def water_level(vg, exag=1.7):
    lvl = _lake_raster(vg)[4]
    if lvl is None: return None
    return (lvl - vg['base']) * vg['scale'] * exag * vg.get('zmul', 1.0) + vg.get('zoff', 0.0)

def lake_mask(U, V):
    out = np.zeros(np.shape(U), bool)
    for vg in VIGNETTES:
        w = _vig_weight(U, V, vg); sel = w > 0.02
        if not sel.any(): continue
        X, Y = vig_to_real(U[sel], V[sel], vg); out[sel] |= _in_lake(vg, X, Y)
    return out

def blend_height(U, V, z, exag):
    for vg in VIGNETTES:
        w = _vig_weight(U, V, vg)
        if not np.any(w > 0): continue
        X, Y = vig_to_real(U, V, vg)
        E = elevation(X, Y); E = np.where(np.isfinite(E), E, vg['base'])
        zv = (E - vg['base']) * vg['scale'] * exag * vg.get('zmul', 1.0) + vg.get('zoff', 0.0)
        zw = water_level(vg, exag)
        if zw is not None:
            wet = _in_lake(vg, X, Y)
            zv = np.where(wet, zw - 1.6, np.maximum(zv, zw + 0.45))
            # outside the flat-water core the lake bed must not show: let the shore rise over it
            z = np.where(wet & (w < 0.97), np.maximum(z, zw + 0.5), z)
        z = z * (1 - w) + zv * w
    return z

def max_weight(U, V):
    w = np.zeros(np.shape(U))
    for vg in VIGNETTES: w = np.maximum(w, _vig_weight(U, V, vg))
    return w

def urban_mask(U, V, X, Y):
    """0..1 paved mask: downtown blocks along Central Avenue. Bathhouse Row's front lawn and the
    Arlington Lawn (east side, Reserve St to Fountain St) stay grass, as on the real Row."""
    xc = np.interp(Y, warp.CENTRAL[0], warp.CENTRAL[1])
    d = X - xc; ad = np.abs(d)
    m = np.clip((95 - ad) / 40, 0, 1) * np.clip((Y + 1150) / 200, 0, 1) * np.clip((560 - Y) / 120, 0, 1)
    lawn = (d > 7) & (Y > -225) & (Y < 300)
    m = np.where(lawn, 0.0, m)
    for v in VIGNETTES:  # vignettes carry their own ground
        m = m * (1 - _vig_weight(U, V, v))
    return m * 0.85

def water_discs(exag=1.7):
    """[(name, centre, radius, z)] one flat water disc per vignette that holds a lake."""
    out = []
    for vg in VIGNETTES:
        zw = water_level(vg, exag)
        if zw is not None: out.append((vg['name'], vg['at'], vg['r'] - vg['feather'] * 0.98, zw))
    return out

def _clip_disk(p, c, r, n=96):
    """Sutherland-Hodgman clip of polygon p against a regular n-gon inscribed in the disk (c, r)."""
    c = np.asarray(c, float)
    ang = np.linspace(0, 2 * np.pi, n, endpoint=False)
    clip = c + np.stack([np.cos(ang), np.sin(ang)], 1) * r
    out = [tuple(q) for q in np.asarray(p, float)]
    if len(out) > 1 and out[0] == out[-1]: out = out[:-1]
    for i in range(n):
        a, b = clip[i], clip[(i + 1) % n]
        ex, ey = b - a
        inside = lambda q: ex * (q[1] - a[1]) - ey * (q[0] - a[0]) >= 0
        def cross(p1, p2):
            x1, y1 = p1; x2, y2 = p2
            dx, dy = x2 - x1, y2 - y1
            den = ex * dy - ey * dx
            if abs(den) < 1e-12: return p2
            t = (ex * (a[1] - y1) - ey * (a[0] - x1)) / -den if False else ((a[0] - x1) * ey - (a[1] - y1) * ex) / (dx * ey - dy * ex)
            return (x1 + dx * t, y1 + dy * t)
        inp, out = out, []
        if not inp: break
        s = inp[-1]
        for e in inp:
            if inside(e):
                if not inside(s): out.append(cross(s, e))
                out.append(e)
            elif inside(s): out.append(cross(s, e))
            s = e
    if len(out) < 3: return None
    out.append(out[0])
    return np.array(out)
