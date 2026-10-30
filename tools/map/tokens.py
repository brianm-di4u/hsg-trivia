# Player tokens: six lacquered pawns whose cross-section is the player's accessibility shape
# (circle, square, triangle, diamond, star, hexagon), rendered at the board camera's tilt and sun.
#   blender -b --factory-startup --python tools/map/tokens.py
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
from geo_common import GAME

SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon']
COLORS = ['#D7263D', '#1D5BD6', '#14904A', '#F2A90C', '#8A43C4', '#F4F1EA']
from terrain import TILT   # the board camera's tilt, so the pawns stand at the board's angle

def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

def outline(shape, r, n=48):
    if shape == 'circle': return [(r * math.cos(a), r * math.sin(a)) for a in [i * 2 * math.pi / n for i in range(n)]]
    if shape == 'square': k = r * 0.86; return [(-k, -k), (k, -k), (k, k), (-k, k)]
    if shape == 'triangle': return [(r * 1.12 * math.cos(a), r * 1.12 * math.sin(a)) for a in [math.pi / 2 + i * 2 * math.pi / 3 for i in range(3)]]
    if shape == 'diamond': return [(0, -r * 1.12), (r * 0.92, 0), (0, r * 1.12), (-r * 0.92, 0)]
    if shape == 'star': return [((r * 1.12 if i % 2 == 0 else r * 0.52) * math.cos(math.pi / 2 + i * math.pi / 5), (r * 1.12 if i % 2 == 0 else r * 0.52) * math.sin(math.pi / 2 + i * math.pi / 5)) for i in range(10)]
    return [(r * math.cos(i * math.pi / 3), r * math.sin(i * math.pi / 3)) for i in range(6)]

def prism(shape, r, z0, h, top_scale=1.0, bevel=0.06, mat=None, name='p'):
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, z0)) for x, y in outline(shape, r)]
    hi = [bm.verts.new((x * top_scale, y * top_scale, z0 + h)) for x, y in outline(shape, r)]
    bm.faces.new(lo[::-1]); bm.faces.new(hi)
    k = len(lo)
    for i in range(k): bm.faces.new((lo[i], lo[(i + 1) % k], hi[(i + 1) % k], hi[i]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    if bevel:
        m = ob.modifiers.new('bevel', 'BEVEL'); m.width = bevel; m.segments = 3; m.limit_method = 'ANGLE'
    if shape == 'circle': me.shade_smooth()
    if mat: me.materials.append(mat)
    return ob

def lacquer(hexc):
    m = bpy.data.materials.new('lac' + hexc); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(hexc), 1); b.inputs['Roughness'].default_value = 0.22
    b.inputs['Coat Weight'].default_value = 0.6; b.inputs['Coat Roughness'].default_value = 0.08
    return m

def metal(hexc, rough=0.3):
    m = bpy.data.materials.new('met' + hexc); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(hexc), 1); b.inputs['Metallic'].default_value = 1.0; b.inputs['Roughness'].default_value = rough
    return m

def build_token(shape, color):
    for o in list(bpy.context.scene.collection.objects):
        if o.type == 'MESH': bpy.data.objects.remove(o)
    lac = lacquer(color); brass = metal('#c9a14a', 0.28); dark = lacquer('#1d1b19')
    # base plinth (shape), brass band, tapered body (shape), collar, cap
    prism(shape, 1.0, 0.0, 0.30, 0.97, 0.07, lac, 'base')
    prism(shape, 0.93, 0.30, 0.07, 1.0, 0.02, brass, 'band')
    prism(shape, 0.70, 0.37, 0.95, 0.62, 0.05, lac, 'body')
    prism(shape, 0.56, 1.32, 0.10, 1.0, 0.03, brass, 'collar')
    if shape == 'circle':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.42, location=(0, 0, 1.72))
        o = bpy.context.active_object; o.data.materials.append(lac); o.data.shade_smooth()
    else:
        prism(shape, 0.50, 1.42, 0.42, 0.70, 0.08, lac, 'cap')
    # tiny brass steam finial on top
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.11, location=(0, 0, 2.18 if shape == 'circle' else 1.93))
    o = bpy.context.active_object; o.data.materials.append(brass); o.data.shade_smooth()

def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    cam_d = bpy.data.cameras.new('cam'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = 3.6
    cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
    fwd = Vector((math.sin(TILT), 0, -math.cos(TILT))); up = Vector((math.cos(TILT), 0, math.sin(TILT))); right = fwd.cross(up)
    R = Matrix((right, up, -fwd)).transposed()
    cam.matrix_world = Matrix.Translation(Vector((0, 0, 1.05)) - fwd * 20) @ R.to_4x4()
    sun_d = bpy.data.lights.new('sun', 'SUN'); sun = bpy.data.objects.new('sun', sun_d); sc.collection.objects.link(sun)
    az, el = math.radians(225), math.radians(38)
    sdir = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
    sun.rotation_euler = sdir.to_track_quat('Z', 'Y').to_euler(); sun_d.energy = 4.0; sun_d.angle = math.radians(4)
    world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.8, 0.9, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.7
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 96; sc.cycles.use_denoising = True
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'OPTIX'; prefs.get_devices()
        for d in prefs.devices: d.use = d.type == 'OPTIX'
        sc.cycles.device = 'GPU'
    except Exception: pass
    sc.render.film_transparent = True
    sc.render.resolution_x = 208; sc.render.resolution_y = 240
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'

setup()
out = os.path.join(GAME, 'art-src', 'tokens'); os.makedirs(out, exist_ok=True)
for s, c in zip(SHAPES, COLORS):
    build_token(s, c)
    bpy.context.scene.render.filepath = os.path.join(out, f'token-{s}.png')
    bpy.ops.render.render(write_still=True)
    print('token', s)
# where the token's foot (world origin) lands in the sprite, for the game to anchor it
cam = bpy.context.scene.camera; r = bpy.context.scene.render
from bpy_extras.object_utils import world_to_camera_view
p = world_to_camera_view(bpy.context.scene, cam, Vector((0, 0, 0)))
import json
json.dump({'w': r.resolution_x, 'h': r.resolution_y, 'footX': round(p.x * r.resolution_x, 1), 'footY': round((1 - p.y) * r.resolution_y, 1),
           'unitPx': round(r.resolution_y / 3.6, 2), 'shapes': SHAPES}, open(os.path.join(out, 'tokens.json'), 'w'))
