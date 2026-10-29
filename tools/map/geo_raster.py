# Raster helpers for the map build (numpy only): DEM sampling, polygon fill, thick lines, PNG out.
import math, zlib, struct, os
import numpy as np
from geo_common import read_tiff_f32, RAW, LAT0, LON0, M_LAT, M_LON

DEMS = [  # (file, lon0, lat0, lon1, lat1), finest first
    ('dem-downtown.tif', -93.080, 34.495, -93.025, 34.535),
    ('dem-region.tif', -93.30, 34.38, -92.85, 34.66),
]
_cache = {}

def _dem(i):
    if i not in _cache:
        f, a, b, c, d = DEMS[i]
        _cache[i] = read_tiff_f32(os.path.join(RAW, f))
    return _cache[i]

def _bilinear(img, px, py):
    h, w = img.shape
    px = np.clip(px, 0, w - 1.001); py = np.clip(py, 0, h - 1.001)
    x0 = np.floor(px).astype(int); y0 = np.floor(py).astype(int); fx = px - x0; fy = py - y0
    a = img[y0, x0]; b = img[y0, x0 + 1]; c = img[y0 + 1, x0]; d = img[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

def elevation(x, y):
    """Metres above sea level at real metric coords (x east, y north of the Fordyce)."""
    lon = LON0 + np.asarray(x) / M_LON; lat = LAT0 + np.asarray(y) / M_LAT
    out = np.full(np.shape(lon), np.nan)
    for i in reversed(range(len(DEMS))):  # coarse first, then overwrite with finer
        f, a, b, c, d = DEMS[i]; img = _dem(i); h, w = img.shape
        inside = (lon > a) & (lon < c) & (lat > b) & (lat < d)
        if i == 0:  # feather the fine DEM's edge into the coarse one
            m = np.minimum.reduce([(lon - a) / (c - a), (c - lon) / (c - a), (lat - b) / (d - b), (d - lat) / (d - b)])
            wgt = np.clip(m / 0.06, 0, 1)
        else:
            wgt = inside.astype(float)
        px = (lon - a) / (c - a) * w - 0.5; py = (d - lat) / (d - b) * h - 0.5
        v = _bilinear(img, px, py)
        v = np.where(v < -100, np.nan, v)
        out = np.where(inside & np.isfinite(v), np.where(np.isfinite(out), out * (1 - wgt) + v * wgt, v), out)
    return out

def fill_polygons(rings, W, H, to_px):
    """Even-odd scanline fill. rings: list of (N,2) arrays in plan coords; to_px maps plan->pixel."""
    mask = np.zeros((H, W), bool)
    ex0, ey0, ex1, ey1 = [], [], [], []
    for r in rings:
        p = to_px(r)
        ex0.append(p[:-1, 0]); ey0.append(p[:-1, 1]); ex1.append(p[1:, 0]); ey1.append(p[1:, 1])
    if not ex0: return mask
    x0 = np.concatenate(ex0); y0 = np.concatenate(ey0); x1 = np.concatenate(ex1); y1 = np.concatenate(ey1)
    ylo = np.minimum(y0, y1); yhi = np.maximum(y0, y1)
    order = np.argsort(ylo)
    x0, y0, x1, y1, ylo, yhi = x0[order], y0[order], x1[order], y1[order], ylo[order], yhi[order]
    for row in range(H):
        yc = row + 0.5
        sel = (ylo <= yc) & (yhi > yc)
        if not sel.any(): continue
        t = (yc - y0[sel]) / (y1[sel] - y0[sel])
        xs = np.sort(x0[sel] + t * (x1[sel] - x0[sel]))
        for k in range(0, len(xs) - 1, 2):
            a = int(math.ceil(xs[k] - 0.5)); b = int(math.floor(xs[k + 1] - 0.5))
            a, b = max(a, 0), min(b, W - 1)
            if b >= a: mask[row, a:b + 1] = True
    return mask

def stroke(mask_or_img, pts, width, value=True):
    """Stamp a thick polyline (pixel coords) into a 2-D array."""
    H, W = mask_or_img.shape[:2]
    r = max(width / 2.0, 0.5); ri = int(math.ceil(r))
    oy, ox = np.mgrid[-ri:ri + 1, -ri:ri + 1]; disk = (ox * ox + oy * oy) <= r * r + 0.25
    dy, dx = oy[disk], ox[disk]
    for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
        L = math.hypot(bx - ax, by - ay); n = max(1, int(L / max(0.7, r * 0.5)))
        t = np.linspace(0, 1, n + 1)
        cx = np.round(ax + (bx - ax) * t).astype(int); cy = np.round(ay + (by - ay) * t).astype(int)
        X = (cx[:, None] + dx[None, :]).ravel(); Y = (cy[:, None] + dy[None, :]).ravel()
        ok = (X >= 0) & (X < W) & (Y >= 0) & (Y < H)
        mask_or_img[Y[ok], X[ok]] = value

def write_png(path, rgb):
    rgb = np.clip(rgb, 0, 255).astype(np.uint8); H, W = rgb.shape[:2]
    ch = rgb.shape[2] if rgb.ndim == 3 else 1
    raw = b''.join(b'\x00' + rgb[y].tobytes() for y in range(H))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    ct = {1: 0, 3: 2, 4: 6}[ch]
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, ct, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b'')
    open(path, 'wb').write(png)
