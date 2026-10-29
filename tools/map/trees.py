# Forest scatter: shortleaf pine and oak-hickory, the Ouachita mix, as low-poly instances.
# A jittered grid keeps them evenly spaced; masks keep them off water, streets, buildings, lawns and the route.
import math
import numpy as np
import bpy
from geo_raster import stroke, fill_polygons
import warp, geodata

def _tree_meshes(mat, srgb):
    coll = bpy.data.collections.new('tree_kinds')
    kinds = []
    trunk = mat('trunk', srgb('#5a4330'), 0.9)
    def add(name, parts):
        objs = []
        for p in parts: objs.append(p())
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs: o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join(); o = bpy.context.active_object; o.name = f't{len(kinds)}_{name}'  # Collection Info sorts children by name
        for c in o.users_collection: c.objects.unlink(o)
        coll.objects.link(o); kinds.append(o)
    def cone(r, d, z, m, v=7):
        bpy.ops.mesh.primitive_cone_add(vertices=v, radius1=r, depth=d, location=(0, 0, z)); o = bpy.context.active_object; o.data.materials.append(m); return o
    def blob(r, z, m, sx=1, sz=0.9, sub=2):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=(0, 0, z)); o = bpy.context.active_object
        o.scale = (sx, sx, sz); o.data.materials.append(m)
        rng = np.random.default_rng(len(kinds) + 3)
        for v in o.data.vertices: v.co *= 1 + (rng.random() - 0.5) * 0.25
        o.data.shade_smooth(); return o
    def stem(h):
        bpy.ops.mesh.primitive_cylinder_add(vertices=5, radius=0.08, depth=h, location=(0, 0, h / 2)); o = bpy.context.active_object; o.data.materials.append(trunk); return o
    pine = mat('pine', srgb('#3f5a3a'), 0.95); pine2 = mat('pine2', srgb('#4a6640'), 0.95)
    oak = mat('oak', srgb('#62804a'), 0.95); oak2 = mat('oak2', srgb('#718d52'), 0.95)
    gold = mat('autumn_gold', srgb('#a2914f'), 0.95); rust = mat('autumn_rust', srgb('#94704a'), 0.95)
    # unit trees ~1 tall; scaled per instance
    add('pine', [lambda: stem(0.35), lambda: cone(0.36, 0.55, 0.45, pine), lambda: cone(0.28, 0.45, 0.68, pine), lambda: cone(0.16, 0.35, 0.88, pine2)])
    add('pine_tall', [lambda: stem(0.45), lambda: cone(0.22, 0.5, 0.6, pine2), lambda: cone(0.17, 0.42, 0.82, pine), lambda: cone(0.11, 0.3, 1.0, pine)])
    add('oak', [lambda: stem(0.3), lambda: blob(0.42, 0.62, oak, 1, 0.8)])
    add('oak_light', [lambda: stem(0.3), lambda: blob(0.38, 0.6, oak2, 1.1, 0.78)])
    add('hickory_gold', [lambda: stem(0.3), lambda: blob(0.38, 0.62, gold, 1, 0.85)])
    add('oak_rust', [lambda: stem(0.28), lambda: blob(0.34, 0.58, rust, 1, 0.85)])
    return coll, kinds

def _gn_instancer(coll):
    ng = bpy.data.node_groups.new('scatter', 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N = ng.nodes; L = ng.links
    gi = N.new('NodeGroupInput'); go = N.new('NodeGroupOutput')
    ci = N.new('GeometryNodeCollectionInfo'); ci.inputs['Collection'].default_value = coll
    ci.inputs['Separate Children'].default_value = True; ci.inputs['Reset Children'].default_value = True
    iop = N.new('GeometryNodeInstanceOnPoints'); iop.inputs['Pick Instance'].default_value = True
    kind = N.new('GeometryNodeInputNamedAttribute'); kind.data_type = 'INT'; kind.inputs['Name'].default_value = 'kind'
    scl = N.new('GeometryNodeInputNamedAttribute'); scl.data_type = 'FLOAT_VECTOR'; scl.inputs['Name'].default_value = 'scl'
    rot = N.new('GeometryNodeInputNamedAttribute'); rot.data_type = 'FLOAT_VECTOR'; rot.inputs['Name'].default_value = 'rot'
    L.new(gi.outputs['Geometry'], iop.inputs['Points']); L.new(ci.outputs['Instances'], iop.inputs['Instance'])
    L.new(kind.outputs['Attribute'], iop.inputs['Instance Index']); L.new(scl.outputs['Attribute'], iop.inputs['Scale'])
    L.new(rot.outputs['Attribute'], iop.inputs['Rotation'])
    L.new(iop.outputs['Instances'], go.inputs['Geometry'])
    return ng

def scatter(col, U, V, Z, X, Y, urban, slope, road_lines, layout, zat, mat, srgb, lakes=None, spacing=4.6):
    n = U.shape[0]; ext = -U[0, 0]; step = (U[0, 1] - U[0, 0])
    to_px = lambda p: np.stack([(p[:, 0] + ext) / step, (p[:, 1] + ext) / step], 1)  # grid index space (row = V)
    block = np.zeros((n, n), bool)
    for pts, w in road_lines['major'] + road_lines['local']:
        stroke(block, to_px(np.asarray(pts)), w + 2.5)
    if lakes is not None and len(lakes): block |= np.asarray(lakes, bool)
    bld, paths, parks = geodata.osm()
    prs = []
    for tags, xy in bld:
        c = xy.mean(0); P = np.array(warp.to_plan(np.array([c[0]]), np.array([c[1]]))).ravel()
        s = float(warp.local_scale(np.array([c[0]]), np.array([c[1]]))[0])
        prs.append(P + (xy - c) * s)
    bm = fill_polygons(prs, n, n, to_px)
    # dilate building mask a little
    bm2 = bm.copy(); bm2[1:] |= bm[:-1]; bm2[:-1] |= bm[1:]; bm2[:, 1:] |= bm[:, :-1]; bm2[:, :-1] |= bm[:, 1:]
    block |= bm2
    if layout:
        for e in layout.get('edges', []):
            stroke(block, to_px(np.asarray(e['pts'])), 12)
        for nd in layout['nodes']:
            stroke(block, to_px(np.array([[nd['x'], nd['y']], [nd['x'] + 0.01, nd['y']]])), 30)
    for extra in getattr(scatter, 'extra_blocks', []):
        block |= extra(U, V, n, to_px)
    rng = np.random.default_rng(42)
    gx = np.arange(-ext + spacing / 2, ext, spacing)
    PU, PV = np.meshgrid(gx, gx)
    PU = PU + (rng.random(PU.shape) - 0.5) * spacing * 0.9; PV = PV + (rng.random(PV.shape) - 0.5) * spacing * 0.9
    PU = PU.ravel(); PV = PV.ravel()
    iu = np.clip(np.round((PU + ext) / step).astype(int), 0, n - 1); iv = np.clip(np.round((PV + ext) / step).astype(int), 0, n - 1)
    ok = ~block[iv, iu]
    ur = urban[iv, iu]
    keep = ok & (rng.random(PU.shape) > ur * 1.1)
    # thinner in the flat valley floor (lawns and yards), dense on slopes
    sl = slope[iv, iu]
    dens = np.clip(0.35 + sl * 2.2, 0.35, 1.0)
    keep &= rng.random(PU.shape) < dens
    PU, PV = PU[keep], PV[keep]
    pz = Z[iv[keep], iu[keep]]
    xr, yr = X[iv[keep], iu[keep]], Y[iv[keep], iu[keep]]
    s = warp.local_scale(xr, yr)
    h = np.clip(16.0 * s * 1.5, 5.4, 14.0) * (0.85 + rng.random(PU.shape) * 0.3)
    kind = rng.choice(6, size=PU.shape, p=[0.26, 0.16, 0.30, 0.22, 0.04, 0.02])
    me = bpy.data.meshes.new('tree_pts'); me.vertices.add(len(PU))
    me.vertices.foreach_set('co', np.stack([PU, PV, pz - 0.3], 1).astype(np.float32).ravel())
    a = me.attributes.new('kind', 'INT', 'POINT'); a.data.foreach_set('value', kind.astype(np.int32))
    sc = np.stack([h * (0.9 + 0.2 * rng.random(PU.shape)), h * (0.9 + 0.2 * rng.random(PU.shape)), h], 1)
    a = me.attributes.new('scl', 'FLOAT_VECTOR', 'POINT'); a.data.foreach_set('vector', sc.astype(np.float32).ravel())
    rt = np.stack([np.zeros_like(PU), np.zeros_like(PU), rng.random(PU.shape) * 6.28], 1)
    a = me.attributes.new('rot', 'FLOAT_VECTOR', 'POINT'); a.data.foreach_set('vector', rt.astype(np.float32).ravel())
    ob = bpy.data.objects.new('trees', me); col.objects.link(ob)
    coll, kinds = _tree_meshes(mat, srgb)
    mod = ob.modifiers.new('scatter', 'NODES'); mod.node_group = _gn_instancer(coll)
    print('trees', len(PU))
    return ob
