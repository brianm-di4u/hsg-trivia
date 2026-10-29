# Vignette set pieces built from real data at each vignette's own scale: Oaklawn's one-mile oval (OSM
# relation "Oaklawn") with a grandstand on the Central Avenue side, and Blakely Mountain Dam's wall (OSM).
import numpy as np
import bpy, bmesh
import vignettes
from geo_common import load_json, to_m

def _ways(fname, pred):
    out = []
    for e in load_json(fname)['elements']:
        if e.get('type') != 'way' or 'geometry' not in e: continue
        if not pred(e.get('tags', {}), e): continue
        g = np.array([[q['lon'], q['lat']] for q in e['geometry']]); x, y = to_m(g[:, 0], g[:, 1])
        out.append(np.stack([x, y], 1))
    return out

def _vp(v, xy): return np.asarray(v['at']) + (np.asarray(xy) - v['real']) * v['scale']

def _poly(col, name, ring, z, m):
    bm = bmesh.new(); vs = [bm.verts.new((float(a), float(b), z)) for a, b in ring[:-1]]
    try: f = bm.faces.new(vs)
    except ValueError: bm.free(); return
    bmesh.ops.triangulate(bm, faces=[f]); me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); col.objects.link(ob); me.materials.append(m)

def build(col, zat, mat, srgb):
    V = {v['name']: v for v in vignettes.VIGNETTES}
    if 'oaklawn' in V:
        v = V['oaklawn']
        rings = sorted(_ways('osm-oaklawn.json', lambda t, e: not t), key=lambda r: -np.ptp(r[:, 0]) * np.ptp(r[:, 1]))
        if len(rings) >= 2:
            outer, inner = _vp(v, rings[0]), _vp(v, rings[1])
            z = float(np.median(zat(outer))) + 0.35
            _poly(col, 'oak_track', outer, z, mat('oak_dirt', srgb('#b98a5a'), 0.95))
            _poly(col, 'oak_infield', inner, z + 0.15, mat('oak_infield', srgb('#6f9a4a'), 0.9))
            # white rail just inside the outer edge
            c = outer.mean(0); rail = c + (outer - c) * 0.965
            for a, b in zip(rail[:-1], rail[1:]):
                pass
            # grandstand: west side of the track (Central Avenue side), facing east
            x0 = outer[:, 0].min(); y0, y1 = np.percentile(outer[:, 1], [30, 70])
            w = 6.5; h = 5.5
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x0 - w * 0.75, (y0 + y1) / 2, z + h / 2))
            o = bpy.context.active_object; o.scale = (w, (y1 - y0) * 0.9, h); o.data.materials.append(mat('oak_stand', srgb('#efe6d0'), 0.7))
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x0 - w * 0.6, (y0 + y1) / 2, z + h + 0.6))
            o = bpy.context.active_object; o.scale = (w * 1.2, (y1 - y0) * 0.95, 1.0); o.data.materials.append(mat('oak_roof', srgb('#3f6e4a'), 0.6))
    if 'ouachita' in V:
        v = V['ouachita']
        for dam in _ways('osm-vignettes.json', lambda t, e: t.get('waterway') == 'dam'):
            p = _vp(v, dam)
            if len(p) < 2: continue
            for a, b in zip(p[:-1], p[1:]):
                mid = (a + b) / 2; L = float(np.hypot(*(b - a))); ang = float(np.arctan2(b[1] - a[1], b[0] - a[0]))
                z = float(zat(mid[None])[0])
                bpy.ops.mesh.primitive_cube_add(size=1, location=(mid[0], mid[1], z + 1.6))
                o = bpy.context.active_object; o.scale = (L + 0.6, 2.4, 3.2); o.rotation_euler.z = ang
                o.data.materials.append(mat('dam', srgb('#d6d0c2'), 0.8))
