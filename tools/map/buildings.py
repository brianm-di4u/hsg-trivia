# Downtown buildings from OpenStreetMap footprints (ODbL; credited in SAMPLES.md and on the board).
# Every footprint keeps its true shape and proportions: it is placed at its warped centroid and scaled by
# the local board scale, so the widened street never distorts a building. Ordinary buildings are extruded here
# for the toon-shaded buildings pass. Landmarks are not built: the illustrator draws each one as a painted
# caricature standing on its true footprint, so only their footprints and anchors are recorded.
import math
import numpy as np
import bpy, bmesh
import warp, geodata, vignettes

BH = 1.45  # building height exaggeration (diorama look)
ROOF_TOPS = {}  # landmark name -> (x, y, z) roof centre, for steam wisps
LANDMARKS = {}  # landmark name -> {'poly': (N,2) plan footprint, 'c': (x, y), 'z': ground z, 'scale': u/m}

# OSM name match -> stories (for steam heights). Landmarks drawn as sprites (tools/map/illustrate.mjs).
HERO = {
    'Superior': 2, 'Hale': 2, 'Maurice': 3, 'Fordyce': 3, 'Quapaw': 2, 'Ozark': 2, 'Buckstaff': 3, 'Lamar': 2,
    'Administration': 2, 'Arlington': 11, 'Mountain Tower': 1, 'Army-Navy': 5, 'Medical Arts': 16,
    'Ohio Club': 3, 'Tussaud': 3,   # the Southern Club building (250 Central) now holds the wax museum
}
WALLS = ['#d98b5f', '#e8d3a6', '#c9765a', '#f0e2c2', '#dcc8a0', '#e39a6a', '#f3e8cf', '#b9a58a']
ROOFS = ['#8f6a52', '#a24a33', '#7d756b', '#b5603f', '#6f7f86', '#8c4a3a']

def hero_of(tags):
    n = tags.get('name', '')
    for k in HERO:
        if k in n: return k
    return None

def build(col, zat, toon):
    """Extrude the ordinary footprints into `col` with toon materials from toon(hex). Returns the count."""
    bld, paths, parks = geodata.osm()
    rng = np.random.default_rng(7)
    made = 0
    for tags, xy in bld:
        xy = xy[:-1] if np.allclose(xy[0], xy[-1]) else xy
        if len(xy) < 3: continue
        c = xy.mean(0)
        P = np.array(warp.to_plan(np.array([c[0]]), np.array([c[1]]))).ravel()
        if np.abs(P).max() > 590: continue
        if vignettes.max_weight(P[:1], P[1:])[0] > 0.2: continue
        s = float(warp.local_scale(np.array([c[0]]), np.array([c[1]]))[0])
        pv = P + (xy - c) * s
        area = 0.5 * np.sum(pv[:, 0] * np.roll(pv[:, 1], -1) - np.roll(pv[:, 0], -1) * pv[:, 1])
        if area < 0: pv = pv[::-1]
        if abs(area) < 0.8: continue
        zs = zat(pv); zb = float(zs.min()) - 0.4
        hero = hero_of(tags)
        if hero:
            z0 = float(zat(P[None])[0])
            LANDMARKS[hero] = {'poly': pv, 'c': (float(P[0]), float(P[1])), 'z': z0, 'scale': s}
            ROOF_TOPS[hero] = (float(P[0]), float(P[1]), z0 + HERO[hero] * 4.0 * s * BH * 1.7)
            continue
        lv = tags.get('building:levels')
        try: st = float(lv)
        except (TypeError, ValueError): st = 2 if abs(area) > 40 else 1.5
        wall = WALLS[rng.integers(len(WALLS))]; roof = ROOFS[rng.integers(len(ROOFS))]
        h = st * 4.0 * s * BH
        bm = bmesh.new()
        vs = [bm.verts.new((float(x), float(y), zb)) for x, y in pv]
        try: f = bm.faces.new(vs)
        except ValueError: bm.free(); continue
        r = bmesh.ops.extrude_face_region(bm, geom=[f])
        for v in [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]: v.co.z = zb + 0.4 + h
        tops = [e for e in r['geom'] if isinstance(e, bmesh.types.BMFace)]
        top = max(tops, key=lambda q: q.calc_area())
        for fc in bm.faces: fc.material_index = 0
        top.material_index = 1
        if abs(area) > 25 and rng.random() < 0.55:   # a low hipped roof on about half the larger blocks
            bmesh.ops.inset_region(bm, faces=[top], thickness=min(2.0, math.sqrt(abs(area)) * 0.16))
            for v in top.verts: v.co.z += min(2.6, math.sqrt(abs(area)) * 0.14)
        me = bpy.data.meshes.new('bld'); bm.to_mesh(me); bm.free()
        me.materials.append(toon(wall)); me.materials.append(toon(roof))
        ob = bpy.data.objects.new('bld', me); col.objects.link(ob)
        made += 1
    return made
