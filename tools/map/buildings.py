# Downtown buildings from OpenStreetMap footprints (ODbL; credited in SAMPLES.md and on the board).
# Every footprint keeps its true shape and proportions: it is placed at its warped centroid and scaled by
# the local board scale, so the widened street never distorts a building. Bathhouse Row and the Arlington
# get hand-set heights, roof forms and colours (research/bathhouse-row-layout.md).
import math
import numpy as np
import bpy, bmesh
from mathutils import Vector
import warp, geodata, vignettes

BH = 1.45  # building height exaggeration (diorama look)
TOWER_TOP = []
ROOF_TOPS = {}  # hero name -> (x, y, z) roof centre, for steam wisps
STANDEE = {'Arlington', 'Mountain Tower'}
STANDEE_AT = {}  # name -> (x, y, z) footprint centre on the ground

# name match -> (stories, wall, roof, roof form). Colours are estimates (research notes give swatches).
HERO = {
    'Superior': (2, '#d9c7a1', '#8b6f4e', 'flat'),
    'Hale': (2, '#efe7d6', '#b5552f', 'hip'),
    'Maurice': (3, '#eee6d4', '#4f7d5b', 'hip'),
    'Fordyce': (3, '#e7d7b4', '#a9432c', 'hip'),
    'Quapaw': (2, '#efe5cf', '#b8553a', 'dome'),
    'Ozark': (2, '#f1ece1', '#a9432c', 'towers'),
    'Buckstaff': (3, '#e3cfa4', '#cfc4ad', 'flat'),
    'Lamar': (2, '#e9e1cf', '#a9432c', 'flat'),
    'Administration': (2, '#efe6d2', '#a9432c', 'hip'),
    'Arlington': (11, '#efe3c8', '#a9432c', 'arlington'),
    'Mountain Tower': (1, '#8c877c', '#5c5650', 'tower'),
}
WALLS = ['#c07a58', '#d6c39c', '#b06a4e', '#e3d7bd', '#c9b9a0', '#d08a62', '#ebe1c9']
ROOFS = ['#7a6a5a', '#8a5a44', '#6d655c', '#9a6a4a', '#a9432c', '#7d7468']

def hero_of(tags):
    n = tags.get('name', '')
    for k in HERO:
        if k in n: return k
    return None

def _mats(mat, srgb):
    cache = {}
    def get(hexc, rough=0.85):
        if hexc not in cache: cache[hexc] = mat('b_' + hexc, srgb(hexc), rough)
        return cache[hexc]
    return get

def build(col, zat, mat, srgb, exag):
    get = _mats(mat, srgb)
    bld, paths, parks = geodata.osm()
    rng = np.random.default_rng(7)
    made = 0
    me_all = []
    for tags, xy in bld:
        xy = xy[:-1] if np.allclose(xy[0], xy[-1]) else xy
        if len(xy) < 3: continue
        c = xy.mean(0)
        P = np.array(warp.to_plan(np.array([c[0]]), np.array([c[1]]))).ravel()
        if np.abs(P).max() > 590: continue
        if vignettes.max_weight(P[:1], P[1:]) [0] > 0.2: continue
        s = float(warp.local_scale(np.array([c[0]]), np.array([c[1]]))[0])
        pv = P + (xy - c) * s
        # winding: make counter-clockwise
        area = 0.5 * np.sum(pv[:, 0] * np.roll(pv[:, 1], -1) - np.roll(pv[:, 0], -1) * pv[:, 1])
        if area < 0: pv = pv[::-1]
        if abs(area) < 0.8: continue
        zs = zat(pv); zb = float(zs.min()) - 0.4
        hero = hero_of(tags)
        if hero:
            st, wall, roof, form = HERO[hero]
        else:
            lv = tags.get('building:levels')
            try: st = float(lv)
            except (TypeError, ValueError): st = 2 if abs(area) > 40 else 1.5
            wall = WALLS[rng.integers(len(WALLS))]; roof = ROOFS[rng.integers(len(ROOFS))]; form = 'flat'
        if hero in STANDEE:
            STANDEE_AT[hero] = (float(P[0]), float(P[1]), float(zat(P[None])[0])); continue   # drawn by the game as a painted miniature (assets/standee-*)
        HB = 1.0 if not hero else 1.7  # hero buildings stand taller, tourist-map style
        if hero: pv = P + (pv - P) * 1.18
        h = st * 4.0 * s * BH * HB
        bm = bmesh.new()
        vs = [bm.verts.new((float(x), float(y), zb)) for x, y in pv]
        try: f = bm.faces.new(vs)
        except ValueError: bm.free(); continue
        r = bmesh.ops.extrude_face_region(bm, geom=[f])
        top_verts = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
        for v in top_verts: v.co.z = zb + 0.4 + h
        tops = [e for e in r['geom'] if isinstance(e, bmesh.types.BMFace)]
        top = max(tops, key=lambda q: q.calc_area())
        bm.faces.ensure_lookup_table()
        for fc in bm.faces: fc.material_index = 0
        top.material_index = 1
        if form in ('hip', 'dome', 'towers', 'arlington'):
            # low hipped/tiled roof: inset then raise
            ins = bmesh.ops.inset_region(bm, faces=[top], thickness=min(2.2, math.sqrt(abs(area)) * 0.18))
            for v in top.verts: v.co.z += min(3.0, math.sqrt(abs(area)) * 0.16) if form != 'arlington' else 1.5
        me = bpy.data.meshes.new('bld'); bm.to_mesh(me); bm.free()
        me.materials.append(get(wall)); me.materials.append(get(roof, 0.7))
        ob = bpy.data.objects.new(('hero_' + hero) if hero else 'bld', me); col.objects.link(ob)
        if hero:
            if hero == 'Mountain Tower': h = 0.6
            _hero_extras(col, hero, pv, zb + 0.4 + h, s, get)
            ROOF_TOPS[hero] = (float(pv[:, 0].mean()), float(pv[:, 1].mean()), zb + 0.4 + h)
        made += 1
    return made

def _hero_extras(col, hero, pv, ztop, s, get):
    cx, cy = pv.mean(0)
    w = pv[:, 0].max() - pv[:, 0].min(); d = pv[:, 1].max() - pv[:, 1].min()
    if hero == 'Quapaw':
        # the Row's tallest dome, mosaic tile over a drum; front faces west (-x)
        r = min(w, d) * 0.28
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=r, location=(cx, cy, ztop + 1.0))
        ob = bpy.context.active_object; ob.scale.z = 1.25
        bm = bmesh.new(); bm.from_mesh(ob.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.01], context='VERTS'); bm.to_mesh(ob.data); bm.free()
        ob.data.materials.append(get('#c7a24a', 0.35)); ob.data.shade_smooth()
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r * 1.02, depth=1.6, location=(cx, cy, ztop + 0.3))
        bpy.context.active_object.data.materials.append(get('#efe5cf'))
        bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, ztop + 1.0 + r * 1.25 + 0.6))
        o2 = bpy.context.active_object; o2.scale = (0.9, 0.9, 1.4); o2.data.materials.append(get('#5e9c8c', 0.4))
    elif hero == 'Ozark':
        # twin towers with stepped setbacks flank the entrance (west front)
        x0 = pv[:, 0].min() + w * 0.12
        for yy in (cy - d * 0.32, cy + d * 0.32):
            for k, (sz, hz) in enumerate([(w * 0.2, 3.2), (w * 0.16, 2.2), (w * 0.12, 1.6)]):
                bpy.ops.mesh.primitive_cube_add(size=1, location=(x0, yy, ztop + 1.6 + k * 2.4))
                o = bpy.context.active_object; o.scale = (sz, sz, hz); o.data.materials.append(get('#f1ece1'))
            bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=w * 0.1, depth=2.0, location=(x0, yy, ztop + 1.6 + 3 * 2.4))
            o = bpy.context.active_object; o.rotation_euler.z = math.pi / 4; o.data.materials.append(get('#a9432c', 0.6))
    elif hero == 'Mountain Tower':
        # 216-ft (66 m) observation tower: a slender steel shaft, enclosed glass deck and open deck on top
        H = 66 * s * BH * 2.2; r = 3.2 * s * BH + 1.3   # hero exaggeration: the game's goal must read at a glance
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=r, depth=H, location=(cx, cy, ztop + H / 2))
        o = bpy.context.active_object; o.data.materials.append(get('#9a958c', 0.45))
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=r * 2.6, depth=H * 0.07, location=(cx, cy, ztop + H * 0.9))
        o = bpy.context.active_object; o.data.materials.append(get('#5f8fa8', 0.15))
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=r * 2.9, depth=H * 0.02, location=(cx, cy, ztop + H * 0.95))
        o = bpy.context.active_object; o.data.materials.append(get('#d8d2c4', 0.5))
        bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=r * 2.4, depth=H * 0.05, location=(cx, cy, ztop + H * 0.985))
        o = bpy.context.active_object; o.data.materials.append(get('#6d655c', 0.6))
        TOWER_TOP[:] = [cx, cy, ztop + H]
    elif hero == 'Arlington':
        # twin towers on the west front, red tile caps
        for yy in (cy - d * 0.18, cy + d * 0.18):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(pv[:, 0].min() + w * 0.18, yy, ztop + 4))
            o = bpy.context.active_object; o.scale = (w * 0.14, w * 0.14, 8); o.data.materials.append(get('#efe3c8'))
            bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=w * 0.11, depth=3.5, location=(pv[:, 0].min() + w * 0.18, yy, ztop + 9.7))
            o = bpy.context.active_object; o.rotation_euler.z = math.pi / 4; o.data.materials.append(get('#a9432c', 0.6))
