# Board projection for the Trivia Trail map (see research/map-projection.md).
#
# Real coordinates are metres east/north of the Fordyce Bathhouse (geo_common.to_m). The board is a
# "rubber-sheet" tourist map with two honest distortions, both stated on the board:
#   1. Central Avenue is widened through downtown, so the Bathhouse Row walk and the west sidewalk
#      can each carry a line of spaces. Buildings keep their true shape and proportions.
#   2. Distance from Bathhouse Row is compressed radially (a magnifier on downtown), so Oaklawn and the
#      three Ouachita River lakes fit on one table. Bearings from the Row are kept exactly.
# The output "plan" coordinates are board units (u), x east, y north, origin at the Row.
import math
import numpy as np

# --- 1. street widening ------------------------------------------------------------------------
# Central Avenue's centreline through downtown, (y, x) knots in metres from TIGER "Central Ave".
CENTRAL = None          # filled by set_central()
WIDEN = 26.0            # metres added on each side of the centreline (street becomes ~2*WIDEN wider)
BAND = 9.0              # half-width of the real street band that gets stretched
Y_FULL = (-420.0, 470.0)   # widening is full between these northings
Y_TAPER = 380.0            # ... and fades to zero over this distance beyond them
X_TAPER = (500.0, 1600.0)  # fades with east/west distance from the street

def set_central(knots):
    global CENTRAL
    k = sorted(knots)
    CENTRAL = (np.array([a for a, _ in k]), np.array([b for _, b in k]))

def _xc(y):
    return np.interp(y, CENTRAL[0], CENTRAL[1])

def _smooth(t):
    t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)

def _wfac(x, y):
    ylo, yhi = Y_FULL
    fy = 1 - _smooth(np.maximum(ylo - y, y - yhi) / Y_TAPER)
    d = np.abs(x - _xc(y))
    fx = 1 - _smooth((d - X_TAPER[0]) / (X_TAPER[1] - X_TAPER[0]))
    return fy * fx

def widen(x, y):
    x = np.asarray(x, float); y = np.asarray(y, float)
    xc = _xc(y); d = x - xc; D = WIDEN * _wfac(x, y)
    inside = np.abs(d) < BAND
    out = np.where(inside, xc + d * (BAND + D) / BAND, x + np.sign(d) * D)
    return out, y

def unwiden(x, y):
    x = np.asarray(x, float); y = np.asarray(y, float)
    # D depends (weakly) on x, so iterate.
    xr = x.copy()
    for _ in range(6):
        xc = _xc(y); D = WIDEN * _wfac(xr, y); d = x - xc
        inside = np.abs(d) < BAND + D
        xr = np.where(inside, xc + d * BAND / (BAND + D), x - np.sign(d) * D)
    return xr, y

# --- 2. radial magnifier -----------------------------------------------------------------------
# Distance from the Row (m) -> board radius (u). Monotone; slope 0.80 u/m at the centre.
R0, S0 = 230.0, 0.80   # linear (true-shape) core: 0.80 u/m out to R0, then log-like
K_LOG = 0.85
SLOPE_FLOOR = 0.20     # ...never flatter than this out to 1.1 km, so the band stays readable
SLOPE_FLOOR_FAR = 0.06 # ...then flatter, so the ballfields (1.9 km) and Park Avenue's far end (2.1 km) fit
R_M = np.concatenate([[0], np.geomspace(R0, 9000, 160)])
_slope = np.maximum(S0 * R0 * K_LOG / np.maximum(R_M, R0), np.where(R_M < 1100, SLOPE_FLOOR, SLOPE_FLOOR_FAR)); _slope[0] = S0
_slope = np.where(R_M <= R0, S0, _slope)
R_U = np.concatenate([[0], np.cumsum(np.diff(R_M) * 0.5 * (_slope[1:] + _slope[:-1]))])
ANISO = (1.0, 1.0)   # extra squeeze of the north-south axis (screen x) vs east-west (screen up)

def _f(r): return np.interp(r, R_M, R_U)
def _finv(u): return np.interp(u, R_U, R_M)

def radial(x, y):
    x = np.asarray(x, float); y = np.asarray(y, float)
    r = np.hypot(x, y); s = np.where(r > 1e-9, _f(r) / np.maximum(r, 1e-9), R_U[1] / R_M[1])
    return x * s * ANISO[0], y * s * ANISO[1]

def unradial(u, v):
    u = np.asarray(u, float) / ANISO[0]; v = np.asarray(v, float) / ANISO[1]
    q = np.hypot(u, v); s = np.where(q > 1e-9, _finv(q) / np.maximum(q, 1e-9), R_M[1] / R_U[1])
    return u * s, v * s

def local_scale(x, y):
    """Board units per metre near (x, y), geometric mean of radial and tangential scale."""
    r = np.maximum(np.hypot(x, y), 1.0)
    dr = 2.0
    fp = (_f(r + dr) - _f(np.maximum(r - dr, 0))) / (r + dr - np.maximum(r - dr, 0))
    ft = _f(r) / r
    return np.sqrt(np.maximum(fp, 1e-6) * ft) * math.sqrt(ANISO[0] * ANISO[1])

# --- full transform ----------------------------------------------------------------------------
def to_plan(x, y):
    return radial(*widen(x, y))

def from_plan(u, v):
    return unwiden(*unradial(u, v))
