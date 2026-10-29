# Night dressing for the dark theme (build_board.py --night): moonlight, warm street lamps along downtown
# streets and the route, lit windows, flood-lit bathhouse fronts, and a glowing tower deck.
import math
import numpy as np
import bpy
from mathutils import Vector
import warp, buildings

WARM = (1.0, 0.72, 0.42)

def _emit(name, color, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    o = nt.nodes.new('ShaderNodeOutputMaterial'); e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*color, 1); e.inputs['Strength'].default_value = strength
    nt.links.new(e.outputs['Emission'], o.inputs['Surface']); return m

def _windows_on_walls():
    """Add a warm window grid (emission masked by a brick pattern in object space) to every wall material."""
    for m in bpy.data.materials:
        if not m.name.startswith('b_') or not m.use_nodes: continue
        nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
        if not b: continue
        tc = nt.nodes.new('ShaderNodeTexCoord')
        br = nt.nodes.new('ShaderNodeTexBrick'); br.inputs['Scale'].default_value = 0.55
        br.inputs['Mortar Size'].default_value = 0.35; br.inputs['Brick Width'].default_value = 0.9; br.inputs['Row Height'].default_value = 1.6
        br.inputs['Color1'].default_value = (1, 1, 1, 1); br.inputs['Color2'].default_value = (0.15, 0.15, 0.15, 1); br.inputs['Mortar'].default_value = (0, 0, 0, 1)
        br.offset = 0.0
        nt.links.new(tc.outputs['Object'], br.inputs['Vector'])
        sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Normal'], sep.inputs['Vector'])
        # walls only (normal.z ~ 0): mask = 1 - |nz|
        ab = nt.nodes.new('ShaderNodeMath'); ab.operation = 'ABSOLUTE'; nt.links.new(sep.outputs['Z'], ab.inputs[0])
        inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0; nt.links.new(ab.outputs[0], inv.inputs[1])
        mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; nt.links.new(br.outputs['Fac'], mul.inputs[0]); nt.links.new(inv.outputs[0], mul.inputs[1])
        nt.links.new(mul.outputs[0], b.inputs['Emission Strength'])
        b.inputs['Emission Color'].default_value = (*WARM, 1)
        # scale strength
        k = nt.nodes.new('ShaderNodeMath'); k.operation = 'MULTIPLY'; k.inputs[1].default_value = 2.2
        nt.links.new(mul.outputs[0], k.inputs[0]); nt.links.new(k.outputs[0], b.inputs['Emission Strength'])

def dress(col, layout, zat, road_lines):
    _windows_on_walls()
    lamp = _emit('lamp', WARM, 30.0)
    # street lamps: along Central Avenue both sides, and every other route edge midpoint
    pts = []
    ys = np.linspace(-560, 420, 34)
    for side in (-1, 1):
        x = warp._xc(ys) + side * 9.5
        u, v = warp.to_plan(x, ys); pts += list(zip(u, v))
    if layout:
        for k, e in enumerate(layout['edges']):
            if e['trail'] or k % 2: continue
            q = np.asarray(e['pts']); m = q[len(q) // 2]; pts.append((m[0] + 6, m[1] + 6))
    for (u, v) in pts:
        z = float(zat(np.array([[u, v]]))[0])
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=4, radius=0.9, location=(u, v, z + 5.2))
        bpy.context.active_object.data.materials.append(lamp)
        ld = bpy.data.lights.new('lamp', 'POINT'); ld.energy = 900; ld.color = WARM; ld.shadow_soft_size = 1.2
        lo = bpy.data.objects.new('lamp', ld); lo.location = (u, v, z + 6.0); col.objects.link(lo)
    # flood-lit bathhouse fronts: an area light in front of each, aimed east at the facade
    for name, (x, y, ztop) in buildings.ROOF_TOPS.items():
        if name in ('Mountain Tower',): continue
        ld = bpy.data.lights.new('flood', 'AREA'); ld.energy = 2600 if name != 'Arlington' else 5200; ld.size = 16; ld.color = (1.0, 0.85, 0.65)
        lo = bpy.data.objects.new('flood', ld); col.objects.link(lo)
        lo.location = (x - 26, y, ztop - 2)
        lo.rotation_euler = (Vector((1, 0, -0.25))).to_track_quat('-Z', 'Y').to_euler()
    # tower deck glow and beacon
    if buildings.TOWER_TOP:
        x, y, z = buildings.TOWER_TOP
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=1.6, location=(x, y, z + 1.4))
        bpy.context.active_object.data.materials.append(_emit('beacon', (1.0, 0.25, 0.18), 60.0))
        ld = bpy.data.lights.new('deck', 'POINT'); ld.energy = 6000; ld.color = (1.0, 0.86, 0.6)
        lo = bpy.data.objects.new('deck', ld); lo.location = (x, y, z - 4); col.objects.link(lo)
    # route bricks glow faintly warm (lamplight on the Promenade)
    for m in bpy.data.materials:
        if m.name in ('route_brick',):
            b = m.node_tree.nodes['Principled BSDF']; b.inputs['Emission Color'].default_value = (0.9, 0.45, 0.25, 1); b.inputs['Emission Strength'].default_value = 0.25
