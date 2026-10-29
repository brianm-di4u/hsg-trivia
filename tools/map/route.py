# The trail baked into the diorama: running-bond Promenade brick along the route, packed gravel on the
# mountain trails, and a low stone paver under every space. The game draws each space's enamel face,
# icon and highlights on top at the projected position (data/board-geo.json).
import math
import numpy as np
import bpy, bmesh

PAVER = {'landmark': 20.5, 'start': 18.0, 'trail': 8.5, 'tower': 0.0}
PAVER_DEFAULT = 16.8

def _brick(mat, srgb):
    m = bpy.data.materials.new('route_brick'); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = 0.75
    tc = nt.nodes.new('ShaderNodeTexCoord')
    br = nt.nodes.new('ShaderNodeTexBrick'); br.inputs['Scale'].default_value = 0.9
    br.inputs['Color1'].default_value = (*srgb('#b35e3f'), 1); br.inputs['Color2'].default_value = (*srgb('#9c4c33'), 1)
    br.inputs['Mortar'].default_value = (*srgb('#d9c7a3'), 1); br.inputs['Mortar Size'].default_value = 0.04
    br.inputs['Brick Width'].default_value = 1.6; br.inputs['Row Height'].default_value = 0.8
    nt.links.new(tc.outputs['Object'], br.inputs['Vector']); nt.links.new(br.outputs['Color'], b.inputs['Base Color'])
    return m

def build(col, layout, zat, mat, srgb, ribbons_obj):
    graph_types = {n['id']: n.get('type') for n in layout.get('graph', [])}
    brick = _brick(mat, srgb); gravel = mat('route_gravel', srgb('#b49a6c'), 0.95)
    curb = mat('route_curb', srgb('#efe6d0'), 0.8)
    lines_b = [(np.asarray(e['pts']), 16.0) for e in layout['edges'] if not e['trail']]
    lines_c = [(np.asarray(e['pts']), 20.5) for e in layout['edges'] if not e['trail']]
    lines_t = [(np.asarray(e['pts']), 9.0) for e in layout['edges'] if e['trail']]
    for ob in (ribbons_obj('route_curb', lines_c, None, 2.4, curb, step=0.8), ribbons_obj('route_brick', lines_b, None, 2.75, brick, step=0.8),
               ribbons_obj('route_trail', lines_t, None, 1.6, gravel, step=0.8)):
        if ob:  # a raised slab with sides, so the track casts a shadow and reads as a game piece
            m = ob.modifiers.new('slab', 'SOLIDIFY'); m.thickness = 2.6; m.offset = -1.0
    stone = mat('paver', srgb('#e9dfc7'), 0.7); stone_dark = mat('paver_rim', srgb('#7d6a52'), 0.8)
    for nd in layout['nodes']:
        t = nd.get('type', 'cat'); r = PAVER.get(t, PAVER_DEFAULT)
        if r <= 0: continue
        z = float(zat(np.array([[nd['x'], nd['y']]]))[0])
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=r + 1.0, depth=3.6, location=(nd['x'], nd['y'], z + 1.6))
        o = bpy.context.active_object; o.data.materials.append(stone_dark)
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=r, depth=3.6, location=(nd['x'], nd['y'], z + 2.0))
        o = bpy.context.active_object; o.data.materials.append(stone)
