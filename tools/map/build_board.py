# Builds the Trivia Trail tabletop diorama in Blender from public map data and renders it.
#   blender -b --factory-startup --python tools/map/build_board.py -- [--res 1600] [--samples 32] [--night] [--save]
# Inputs: art-src/geo/raw/* (USGS 3DEP DEM, Census TIGER roads, USGS NHD water, OSM downtown footprints)
#         art-src/geo/layout.json (board spaces + route, written by tools/map/layout.py)
# Outputs: art-src/blender/renders/board-<day|night>.png, art-src/geo/board-projection.json
import sys, os, math, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import bpy, bmesh
from mathutils import Vector, Matrix
import warp, geodata, vignettes
from geo_raster import elevation
from geo_common import GAME, RAW

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default):
    return type(default)(argv[argv.index(name) + 1]) if name in argv else default
RES = arg('--res', 1600)
SAMPLES = arg('--samples', 32)
NIGHT = '--night' in argv
SAVE = '--save' in argv
NORENDER = '--norender' in argv
EXT = 640                 # terrain half-extent (board units)
VIEW = 540                # half-width of the board on screen (plan y, north-south)
CAM_X = -40.0             # the camera centre sits a little west of the Row: the west rim carries more route
from terrain import EXAG, E0, height_plan, load_layout
TILT = math.radians(30)   # camera tilt from vertical (looking east)
t0 = time.time()
def log(*a): print(f'[{time.time() - t0:6.1f}s]', *a, flush=True)

geodata.init()
LAYOUT = load_layout()

def plan_of(xy):
    u, v = warp.to_plan(xy[:, 0], xy[:, 1]); return np.stack([u, v], 1)

# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col_main = scene.collection

def mat(name, color, rough=0.8, metal=0.0, emit=None, emit_strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = emit_strength
    return m

def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

def mesh_obj(name, verts, faces, material=None, smooth=False, attrs=None):
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(verts)); me.vertices.foreach_set('co', np.asarray(verts, np.float32).ravel())
    faces = np.asarray(faces, np.int32)
    me.loops.add(faces.size); me.loops.foreach_set('vertex_index', faces.ravel())
    me.polygons.add(len(faces)); me.polygons.foreach_set('loop_start', np.arange(0, faces.size, faces.shape[1], dtype=np.int32))
    me.update(); me.validate()
    if smooth: me.shade_smooth()
    if attrs:
        for k, (dom, arr) in attrs.items():
            a = me.color_attributes.new(k, 'FLOAT_COLOR', dom); a.data.foreach_set('color', np.asarray(arr, np.float32).ravel())
    ob = bpy.data.objects.new(name, me); col_main.objects.link(ob)
    if material: me.materials.append(material)
    return ob

# ---------------------------------------------------------------- terrain
log('terrain')
STEP = 1.0
n = int(2 * EXT / STEP) + 1
g = np.linspace(-EXT, EXT, n)
U, V = np.meshgrid(g, g)
Z = height_plan(U, V)
# board base: drop the outer 12 u into a skirt so the diorama has a cut edge
verts = np.stack([U.ravel(), V.ravel(), Z.ravel()], 1)
ii = np.arange(n * n).reshape(n, n)
faces = np.stack([ii[:-1, :-1].ravel(), ii[:-1, 1:].ravel(), ii[1:, 1:].ravel(), ii[1:, :-1].ravel()], 1)
X, Y = warp.from_plan(U, V)
E = elevation(X, Y); E = np.where(np.isfinite(E), E, E0)
# ground colour per vertex: warm grass in the valley, darker forest floor on slopes, ochre on ridges
gy, gx = np.gradient(Z, STEP)
slope = np.hypot(gx, gy)
tE = np.clip((E - 170) / 200, 0, 1)
grass = np.array(srgb('#9aae66')); forest = np.array(srgb('#6a8048')); ridge = np.array(srgb('#a49a64'))
w_for = np.clip(slope * 1.5 + tE * 0.6, 0, 1)[..., None]
cg = grass * (1 - w_for) + forest * w_for
cg = cg * (1 - 0.25 * np.clip(tE - 0.6, 0, 1)[..., None]) + ridge * 0.25 * np.clip(tE - 0.6, 0, 1)[..., None]
urban = vignettes.urban_mask(U, V, X, Y)
pave = np.array(srgb('#b7ab92'))
cg = cg * (1 - urban[..., None]) + pave * urban[..., None]
col = np.concatenate([cg.reshape(-1, 3), np.ones((n * n, 1))], 1)
m_ter = bpy.data.materials.new('terrain'); m_ter.use_nodes = True
nt = m_ter.node_tree; bsdf = nt.nodes['Principled BSDF']; bsdf.inputs['Roughness'].default_value = 0.92
ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'col'
noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 0.08; noise.inputs['Detail'].default_value = 6
mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 0.35
ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (0.7, 0.7, 0.65, 1); ramp.color_ramp.elements[1].color = (1.1, 1.08, 1.0, 1)
nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
nt.links.new(ca.outputs['Color'], mix.inputs['A']); nt.links.new(ramp.outputs['Color'], mix.inputs['B'])
nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
terrain = mesh_obj('terrain', verts, faces, m_ter, smooth=True, attrs={'col': ('POINT', col)})
log('terrain verts', len(verts))

def zat(pts):
    pts = np.asarray(pts, float)
    return height_plan(pts[:, 0], pts[:, 1])

# ---------------------------------------------------------------- ribbons (roads, creek, route)
def ribbon(pts, width, lift):
    pts = np.asarray(pts, float)
    if len(pts) < 2: return None
    d = np.gradient(pts, axis=0); L = np.hypot(d[:, 0], d[:, 1]); L[L == 0] = 1
    nrm = np.stack([-d[:, 1] / L, d[:, 0] / L], 1) * (width / 2)
    a = pts + nrm; b = pts - nrm
    za = zat(a) + lift; zb = zat(b) + lift
    v = np.concatenate([np.c_[a, za], np.c_[b, zb]])
    k = len(pts); f = [(i, i + 1, k + i + 1, k + i) for i in range(k - 1)]
    return v, np.array(f)

def resample(pts, step):
    pts = np.asarray(pts, float); seg = np.hypot(*np.diff(pts, axis=0).T); s = np.concatenate([[0], np.cumsum(seg)])
    if s[-1] < 1e-6: return pts[:1]
    t = np.linspace(0, s[-1], max(2, int(s[-1] / step) + 1))
    return np.stack([np.interp(t, s, pts[:, 0]), np.interp(t, s, pts[:, 1])], 1)

def ribbons_obj(name, lines, width_fn, lift, material, step=1.5):
    V, F, off = [], [], 0
    for pts, w in lines:
        rp = resample(pts, step)
        if len(rp) < 2: continue
        r = ribbon(rp, w, lift)
        if r is None: continue
        V.append(r[0]); F.append(r[1] + off); off += len(r[0])
    if not V: return None
    return mesh_obj(name, np.concatenate(V), np.concatenate(F), material)

def inside(p, ext=EXT - 4): return (np.abs(p[:, 0]) < ext) & (np.abs(p[:, 1]) < ext)

log('roads')
m_road = mat('road', srgb('#b8ad8c'), 0.92); m_road_major = mat('road_major', srgb('#ddd2b8'), 0.85)
road_lines = {'major': [], 'local': []}
for cls, name, xy in geodata.roads():
    p = plan_of(xy)
    keep = inside(p)
    if keep.sum() < 2: continue
    # split at gaps where the line leaves the board
    idx = np.where(keep)[0]; runs = np.split(idx, np.where(np.diff(idx) > 1)[0] + 1)
    for r in runs:
        if len(r) < 2: continue
        q = p[r]
        real_mid = xy[r[len(r) // 2]]
        s = float(warp.local_scale(np.array([real_mid[0]]), np.array([real_mid[1]]))[0])
        if cls == 'local': road_lines['local'].append((q, max(1.1, 8 * s)))
        else: road_lines['major'].append((q, max(2.6, 12 * s)))
def vig_w(p):
    w = np.zeros(len(p))
    for vg in vignettes.VIGNETTES: w = np.maximum(w, vignettes._vig_weight(p[:, 0], p[:, 1], vg))
    return w
for key in ('local', 'major'):
    kept = []
    for q, wd in road_lines[key]:
        ok = vig_w(q) < 0.35
        idx = np.where(ok)[0]
        for r in np.split(idx, np.where(np.diff(idx) > 1)[0] + 1):
            if len(r) >= 2: kept.append((q[r], wd))
    road_lines[key] = kept
for vg in vignettes.VIGNETTES:
    R_real = vg['r'] / vg['scale']
    for cls, name, xy in geodata.roads():
        d = np.hypot(xy[:, 0] - vg['real'][0], xy[:, 1] - vg['real'][1])
        idx = np.where(d < R_real * 0.97)[0]
        for r in np.split(idx, np.where(np.diff(idx) > 1)[0] + 1):
            if len(r) < 2: continue
            q = np.asarray(vg['at']) + (xy[r] - vg['real']) * vg['scale']
            if cls == 'local': road_lines['local'].append((q, 1.6))
            else: road_lines['major'].append((q, 2.6))
ribbons_obj('roads_local', road_lines['local'], None, 0.25, m_road)
ribbons_obj('roads_major', road_lines['major'], None, 0.35, m_road_major)

# Central Avenue through downtown: asphalt between the two lines of spaces, with a centre line
m_asph = mat('asphalt', srgb('#5e5b55'), 0.7); m_line = mat('centre_line', srgb('#e8c15a'), 0.6)
ys = np.linspace(-600, 430, 160)
cl = np.stack(warp.to_plan(warp._xc(ys), ys), 1)
ribbons_obj('central_asphalt', [(cl, 24.0)], None, 0.42, m_asph, step=1.0)
dash = [(cl[i:i + 3], 1.0) for i in range(0, len(cl) - 3, 6)]
ribbons_obj('central_line', dash, None, 0.5, m_line, step=0.5)

# Hot Springs Creek (open channel south of the Row; it runs in a tunnel under Central Avenue)
m_creek = mat('creek', srgb('#3f8f9a'), 0.15)
creek = [(plan_of(xy), 2.6) for nm, xy in geodata.streams() if nm in ('Hot Springs Creek', 'Gulpha Creek')]
creek = [(p[inside(p)], w) for p, w in creek if inside(p).sum() > 2]
ribbons_obj('creek', creek, None, 0.2, m_creek)

# ---------------------------------------------------------------- water (lakes inside the board + vignettes)
log('water')
m_water = bpy.data.materials.new('water'); m_water.use_nodes = True
wb = m_water.node_tree.nodes['Principled BSDF']; wb.inputs['Base Color'].default_value = (*srgb('#2b7486'), 1)
wb.inputs['Roughness'].default_value = 0.08; wb.inputs['Specular IOR Level'].default_value = 0.8
for nm, c, r, z in vignettes.water_discs(EXAG):
    bpy.ops.mesh.primitive_circle_add(vertices=96, radius=r, fill_type='NGON', location=(c[0], c[1], z))
    ob = bpy.context.active_object; ob.name = 'water_' + nm; ob.data.materials.append(m_water)

# ---------------------------------------------------------------- buildings
log('buildings')
import buildings
bobjs = buildings.build(col_main, zat, mat, srgb, EXAG)
log('buildings done', bobjs)

import features
features.build(col_main, zat, mat, srgb)

# ---------------------------------------------------------------- route + spaces
if LAYOUT:
    import route
    route.build(col_main, LAYOUT, zat, mat, srgb, ribbons_obj)
import buildings

# ---------------------------------------------------------------- trees
log('trees')
import trees
trees.scatter(col_main, U, V, Z, X, Y, urban, slope, road_lines, LAYOUT, zat, mat, srgb, lakes=vignettes.lake_mask(U, V))

if NIGHT:
    import night
    night.dress(col_main, LAYOUT, zat, road_lines)

# ---------------------------------------------------------------- camera + light
log('camera')
cam_d = bpy.data.cameras.new('cam'); cam_d.type = 'ORTHO'
cam = bpy.data.objects.new('cam', cam_d); col_main.objects.link(cam); scene.camera = cam
# Looking east (+x), tilted TILT from vertical. Screen right = south (-y), screen up = east (+x).
fwd = Vector((math.sin(TILT), 0, -math.cos(TILT)))
up = Vector((math.cos(TILT), 0, math.sin(TILT)))
right = fwd.cross(up)
R = Matrix((right, up, -fwd)).transposed()
cam.matrix_world = Matrix.Translation(Vector((CAM_X, 0, 0)) - fwd * 2000) @ R.to_4x4()
# board extents on screen: x spans plan y [-EXT, EXT]; y spans plan x [-EXT, EXT] * cos(TILT) + relief
H_U = 2 * VIEW * math.cos(TILT) - 36 + 60   # full-bleed: a little taller than the north-south span
cam_d.ortho_scale = 2 * VIEW
cam_d.clip_start = 1; cam_d.clip_end = 5000
scene.render.resolution_x = RES; scene.render.resolution_y = int(round(RES * H_U / (2 * VIEW)))
cam_d.shift_y = 0.0

world = bpy.data.worlds.new('world'); scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']
if NIGHT:
    bg.inputs['Color'].default_value = (0.03, 0.05, 0.11, 1); bg.inputs['Strength'].default_value = 0.9
else:
    bg.inputs['Color'].default_value = (0.62, 0.72, 0.85, 1); bg.inputs['Strength'].default_value = 0.55
sun_d = bpy.data.lights.new('sun', 'SUN'); sun = bpy.data.objects.new('sun', sun_d); col_main.objects.link(sun)
# afternoon sun from the south-west, as on the Row's west-facing fronts
az, el = math.radians(225), math.radians(38)
sdir = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
sun.rotation_euler = sdir.to_track_quat('Z', 'Y').to_euler()
sun_d.energy = 0.55 if NIGHT else 4.2; sun_d.angle = math.radians(3.5)
sun_d.color = (0.6, 0.7, 1.0) if NIGHT else (1.0, 0.93, 0.82)

# ---------------------------------------------------------------- render
scene.render.engine = 'CYCLES'
cy = scene.cycles; cy.samples = SAMPLES; cy.use_denoising = True
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for dt in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = dt; prefs.get_devices()
            if any(d.type == dt for d in prefs.devices):
                for d in prefs.devices: d.use = d.type == dt
                cy.device = 'GPU'; log('device', dt); break
        except Exception: pass
except Exception as e: log('gpu setup failed', e)
scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
# Painterly pass: an anisotropic Kuwahara filter turns the path-traced detail into brush-like strokes, so
# the board sits closer to the painted card art; a slight warm lift keeps it a tabletop, not a photo.
try:
    ng = bpy.data.node_groups.new('board_comp', 'CompositorNodeTree')
    ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    rl = ng.nodes.new('CompositorNodeRLayers'); kw = ng.nodes.new('CompositorNodeKuwahara'); out = ng.nodes.new('NodeGroupOutput')
    kw.inputs['Type'].default_value = 'Anisotropic' if not isinstance(kw.inputs['Type'].default_value, (int, float)) else 1
    kw.inputs['Size'].default_value = max(2, int(round(RES / 900)))
    kw.inputs['Sharpness'].default_value = 0.55; kw.inputs['Eccentricity'].default_value = 1.0; kw.inputs['Uniformity'].default_value = 4
    ng.links.new(rl.outputs['Image'], kw.inputs['Image']); ng.links.new(kw.outputs['Image'], out.inputs['Image'])
    scene.compositing_node_group = ng
    log('painterly pass on, size', kw.inputs['Size'].default_value)
except Exception as e:
    log('painterly pass skipped:', e)
scene.render.image_settings.file_format = 'PNG'
outdir = os.path.join(GAME, 'art-src', 'blender', 'renders'); os.makedirs(outdir, exist_ok=True)
out = os.path.join(outdir, f'board-{"night" if NIGHT else "day"}-{RES}.png')
scene.render.filepath = out

# projection export: plan (x, y, z) -> image pixel (for the game overlay)
def project(p):
    v = cam.matrix_world.inverted() @ Vector(p)
    sx = (v.x / cam_d.ortho_scale + 0.5) * scene.render.resolution_x
    sy = (0.5 - v.y / cam_d.ortho_scale * scene.render.resolution_x / scene.render.resolution_y * (scene.render.resolution_y / scene.render.resolution_x)) * scene.render.resolution_y
    return sx, sy
proj = {'res': [scene.render.resolution_x, scene.render.resolution_y], 'orthoScale': cam_d.ortho_scale,
        'matrix': [list(r) for r in cam.matrix_world.inverted()], 'tilt': math.degrees(TILT)}
json.dump(proj, open(os.path.join(GAME, 'art-src', 'geo', 'board-projection.json'), 'w'), indent=1)
# ---------------------------------------------------------------- game data export (board units)
from bpy_extras.object_utils import world_to_camera_view
scene.render.resolution_percentage = 100
RX, RY = scene.render.resolution_x, scene.render.resolution_y
BH_U = 1000 * RY / RX
def to_board(x, y, z):
    v = world_to_camera_view(scene, cam, Vector((float(x), float(y), float(z))))
    return [round(v.x * 1000, 2), round((1 - v.y) * BH_U, 2)]
def zq(x, y): return float(zat(np.array([[x, y]]))[0])
geo = {'w': 1000, 'h': round(BH_U, 2), 'tilt': math.degrees(TILT), 'squash': round(math.cos(TILT), 4)}
if LAYOUT:
    nodes = sorted(LAYOUT['nodes'], key=lambda n: n['id'])
    geo['nodes'] = []
    for nd in nodes:
        b = to_board(nd['x'], nd['y'], zq(nd['x'], nd['y']) + 1.45)
        geo['nodes'].append({'x': b[0], 'y': b[1]})
    geo['edges'] = []
    for e in LAYOUT['edges']:
        pts = np.asarray(e['pts']); zs = zat(pts) + 0.9
        geo['edges'].append({'a': e['a'], 'b': e['b'], 'pts': [to_board(p[0], p[1], z) for p, z in zip(pts, zs)][::2] + [to_board(pts[-1][0], pts[-1][1], zs[-1])]})
    # labels: district plates beside each landmark, in the clearest of 12 directions
    P = np.array([[n['x'], n['y']] for n in nodes])
    E = np.concatenate([np.asarray(e['pts']) for e in LAYOUT['edges']])
    # Plates are rectangles on screen; in plan, screen-x is -y and screen-up is +x (foreshortened).
    PU = 1000.0 / (2 * VIEW)                    # board units per plan unit across the screen
    def plate_half(text, size, sub=False):
        w_b = 0.56 * size * len(text) + 20; h_b = size + 10 + (size * 0.8 if sub else 0)
        return (h_b / 2) / (PU * math.cos(TILT)), (w_b / 2) / PU     # (half along plan x, half along plan y)
    RN = {'landmark': 20, 'start': 18, 'trail': 9}
    NR = np.array([RN.get(n['type'], 17) for n in nodes], float)
    rects = []
    def clearance(q, h):
        dx = np.maximum(np.abs(P[:, 0] - q[0]) - h[0], 0); dy = np.maximum(np.abs(P[:, 1] - q[1]) - h[1], 0)
        c = (np.hypot(dx, dy) - NR).min()
        ex = np.maximum(np.abs(E[:, 0] - q[0]) - h[0], 0); ey = np.maximum(np.abs(E[:, 1] - q[1]) - h[1], 0)
        c = min(c, (np.hypot(ex, ey) - 6).min())
        for (r0, rh) in rects:
            gx = max(abs(r0[0] - q[0]) - rh[0] - h[0], 0); gy = max(abs(r0[1] - q[1]) - rh[1] - h[1], 0)
            c = min(c, math.hypot(gx, gy) - 4 if (gx or gy) else -50)
        # inside the visible board
        top = (H_U / 2) / math.cos(TILT) - 8
        c = min(c, (VIEW - 10 - abs(q[1])) - h[1], top - abs(q[0] - CAM_X) - h[0])
        return c
    def place(c, h, radii=(34, 48, 62, 78, 96)):
        best, bs = None, -1e9
        for rad in radii:
            for k in range(24):
                a = k * math.pi / 12; q = np.asarray(c, float) + [math.cos(a) * rad, math.sin(a) * rad]
                sc = clearance(q, h) - rad * 0.06
                if sc > bs: bs, best = sc, q
            if bs > 6: break
        rects.append((best, h)); return best
    labels = []
    vig_by_district = {'oaklawn': 'oaklawn'}
    VG = {v['name']: v for v in vignettes.VIGNETTES}
    for d in json.load(open(os.path.join(GAME, 'art-src', 'geo', 'graph.json')))['districts']:
        lm = [n for n in nodes if n['district'] == d['key'] and n['type'] == 'landmark'][0]
        vg = VG.get(vig_by_district.get(d['key'], ''))
        sub = f"{vg['truth']} · moved closer" if vg else None
        h = plate_half(d['name'], 14, bool(sub))
        q = place([lm['x'], lm['y']], h)
        labels.append({'text': d['name'], 'kind': 'district', 'key': d['key'], 'sub': sub, 'at': to_board(q[0], q[1], zq(*q) + 2), 'anchor': to_board(lm['x'], lm['y'], zq(lm['x'], lm['y']) + 1.4)})
    for vg in vignettes.VIGNETTES:
        ring = [to_board(vg['at'][0] + math.cos(a) * vg['r'] * 0.96, vg['at'][1] + math.sin(a) * vg['r'] * 0.96, zq(vg['at'][0] + math.cos(a) * vg['r'] * 0.96, vg['at'][1] + math.sin(a) * vg['r'] * 0.96)) for a in np.linspace(0, 2 * math.pi, 49)]
        if vg['name'] in vig_by_district.values():
            labels.append({'text': '', 'kind': 'ring', 'ring': ring}); continue
        h = plate_half(vg['label'], 11.5, True)
        q = place(vg['at'], h, radii=(0, 30, 50, 70, 90))
        labels.append({'text': vg['label'], 'kind': 'vignette', 'truth': vg.get('truth', ''), 'at': to_board(q[0], q[1], zq(*q) + 2), 'ring': ring})
    from geo_common import LAT0, LON0, M_LAT, M_LON
    ANCH = json.load(open(os.path.join(GAME, 'research', 'geo-anchors.json')))
    def anchor_plan(k):
        a = ANCH[k]; x = (a['lon'] - LON0) * M_LON; y = (a['lat'] - LAT0) * M_LAT
        u, v = warp.to_plan(np.array([x]), np.array([y])); return float(u[0]), float(v[0])
    for k, text in [('hotSpringsMtnSummit', 'Hot Springs Mountain'), ('westMountainOverlook', 'West Mountain'), ('northMountain', 'North Mountain')]:
        u, v = anchor_plan(k); h = plate_half(text, 11, False); q = place([u, v], h, radii=(0, 20, 36, 52))
        labels.append({'text': text, 'kind': 'mountain', 'at': to_board(q[0], q[1], zq(*q) + 2)})
    # street name along Central Avenue, between the two lines of spaces
    cu, cv = warp.to_plan(np.array([warp._xc(-40)]), np.array([-40.0]))
    labels.append({'text': 'Central Avenue', 'kind': 'street', 'at': to_board(cu[0], cv[0], zq(cu[0], cv[0]) + 0.5),
                   'dir': [a - b for a, b in zip(to_board(cu[0], cv[0] - 50, 0), to_board(cu[0], cv[0] + 50, 0))]})
    geo['labels'] = labels
    geo['north'] = [a - b for a, b in zip(to_board(0, 100, 0), to_board(0, 0, 0))]
    geo['steam'] = [to_board(*xyz) for k, xyz in buildings.ROOF_TOPS.items() if k not in ('Arlington', 'Mountain Tower', 'Administration')]
    # painted miniatures the game draws on top (assets/standee-*): ground anchor in board units
    st = {}
    for name, (x, y, z) in buildings.STANDEE_AT.items(): st[name] = to_board(x, y, z)
    geo['standees'] = st
    if 'Mountain Tower' in st:
        b = st['Mountain Tower']; geo['tower'] = {'base': b, 'top': [b[0], round(b[1] - 92, 2)]}
    # where to stand the outlying miniatures: next to each district's landmark space (board units)
    geo['landmarks'] = {n['district']: to_board(n['x'], n['y'], zq(n['x'], n['y'])) for n in nodes if n['type'] == 'landmark'}
    geo['render'] = {'w': RX, 'h': RY}
    json.dump(geo, open(os.path.join(GAME, 'data', 'board-geo.json'), 'w'))
    log('wrote data/board-geo.json', len(geo['nodes']), 'nodes')

if SAVE:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(GAME, 'art-src', 'blender', 'board.blend'))
log('render', out, scene.render.resolution_x, scene.render.resolution_y)
if not NORENDER: bpy.ops.render.render(write_still=True)
log('done')
