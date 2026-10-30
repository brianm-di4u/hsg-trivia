# Tree sites for the illustrated board: where the illustrator stamps its cartoon broadleaf and pine trees.
# A jittered grid, thinned by masks: off water, streets, buildings and the route, sparse on the valley floor and
# denser on the forested slopes (shortleaf pine high and dry, oak-hickory lower: the Ouachita mix).
import numpy as np
from geo_raster import stroke, fill_polygons
import warp, geodata

def sites(U, V, Z, X, Y, urban, slope, road_lines, layout, lakes=None, spacing=9.0):
    """-> (plan x, plan y, z, kind 0 broadleaf / 1 pine, local scale u/m, forest weight) arrays."""
    n = U.shape[0]; ext = -U[0, 0]; step = (U[0, 1] - U[0, 0])
    to_px = lambda p: np.stack([(p[:, 0] + ext) / step, (p[:, 1] + ext) / step], 1)  # grid index space (row = V)
    block = np.zeros((n, n), bool)
    for pts, w, name in road_lines['major'] + road_lines['local']:
        stroke(block, to_px(np.asarray(pts)), w + 3.0)
    if lakes is not None and len(lakes): block |= np.asarray(lakes, bool)
    bld, paths, parks = geodata.osm()
    prs = []
    for tags, xy in bld:
        c = xy.mean(0); P = np.array(warp.to_plan(np.array([c[0]]), np.array([c[1]]))).ravel()
        s = float(warp.local_scale(np.array([c[0]]), np.array([c[1]]))[0])
        prs.append(P + (xy - c) * s)
    bm = fill_polygons(prs, n, n, to_px)
    for _ in range(2):
        bm2 = bm.copy(); bm2[1:] |= bm[:-1]; bm2[:-1] |= bm[1:]; bm2[:, 1:] |= bm[:, :-1]; bm2[:, :-1] |= bm[:, 1:]; bm = bm2
    block |= bm
    if layout:
        for e in layout.get('edges', []):
            stroke(block, to_px(np.asarray(e['pts'])), 20)
        for nd in layout['nodes']:
            stroke(block, to_px(np.array([[nd['x'], nd['y']], [nd['x'] + 0.01, nd['y']]])), 40)
    rng = np.random.default_rng(42)
    gx = np.arange(-ext + spacing / 2, ext, spacing)
    PU, PV = np.meshgrid(gx, gx)
    PU = (PU + (rng.random(PU.shape) - 0.5) * spacing * 0.95).ravel(); PV = (PV + (rng.random(PV.shape) - 0.5) * spacing * 0.95).ravel()
    iu = np.clip(np.round((PU + ext) / step).astype(int), 0, n - 1); iv = np.clip(np.round((PV + ext) / step).astype(int), 0, n - 1)
    sl = slope[iv, iu]; ur = urban[iv, iu]
    forest = np.clip(sl * 1.6, 0, 1) * (1 - ur)
    # a few trees in town and on the valley floor (yards and lawns), clumps on the slopes
    clump = 0.5 + 0.5 * np.sin(PU * 0.045 + np.sin(PV * 0.03) * 2.0) * np.cos(PV * 0.05 - PU * 0.012)
    dens = 0.10 + 0.55 * forest * (0.55 + 0.45 * clump)
    keep = ~block[iv, iu] & (rng.random(PU.shape) < dens) & (rng.random(PU.shape) > ur * 0.8)
    PU, PV, iu, iv, forest = PU[keep], PV[keep], iu[keep], iv[keep], forest[keep]
    pz = Z[iv, iu]; xr, yr = X[iv, iu], Y[iv, iu]
    s = warp.local_scale(xr, yr)
    E = pz  # pines on the high dry ridges, broadleaf in the hollows
    pine_p = np.clip(0.25 + forest * 0.35 + (E - np.median(E)) / 120.0, 0.1, 0.8)
    kind = (rng.random(PU.shape) < pine_p).astype(int)
    print('tree sites', len(PU))
    return PU, PV, pz, kind, s, forest
