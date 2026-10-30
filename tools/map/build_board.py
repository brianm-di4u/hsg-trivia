# Builds the 3D truth under the illustrated Trivia Trail board in Blender, from public map data.
#   blender -b --factory-startup --python tools/map/build_board.py -- [--res 3200] [--norender] [--save]
# Inputs: art-src/geo/raw/* (USGS 3DEP DEM, Census TIGER roads, USGS NHD water, OSM downtown footprints)
#         art-src/geo/layout.json (board spaces + route, written by tools/map/layout.py)
# Everything goes through one orthographic camera that looks east, tilted 30 degrees from vertical. Blender does
# only what needs 3D (relief light, occlusion, building massing, projection); tools/map/illustrate.mjs paints the
# board from what this writes:
#   art-src/blender/passes/relief.png     terrain alone in white clay under the afternoon sun: relief and cast shadow
#   art-src/blender/passes/relief_b.png   the same with the buildings casting shadows (unseen by the camera)
#   art-src/blender/passes/cover.png      unlit land cover: R forest, G paved downtown, B park lawn
#   art-src/blender/passes/buildings.png  ordinary buildings, toon-shaded and inked, with the terrain held out
#   art-src/geo/illustrate.json           every line, area, site and anchor the illustrator draws, in board units
#   data/board-geo.json                   the game's projected spaces, route, labels and anchors (board units)
import sys, os, math, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import warp, geodata, vignettes
from geo_raster import elevation
from geo_common import GAME

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default):
    return type(default)(argv[argv.index(name) + 1]) if name in argv else default
RES = arg('--res', 3200)
SAVE = '--save' in argv
NORENDER = '--norender' in argv
EXT = 640                 # terrain half-extent (board units)
VIEW = 540                # half-width of the board on screen (plan y, north-south)
CAM_X = -40.0             # the camera centre sits a little west of the Row: the west rim carries more route
from terrain import EXAG, E0, TILT, height_plan, load_layout
t0 = time.time()
def log(*a): print(f'[{time.time() - t0:6.1f}s]', *a, flush=True)

geodata.init()
LAYOUT = load_layout()
PASSES = os.path.join(GAME, 'art-src', 'blender', 'passes'); os.makedirs(PASSES, exist_ok=True)

def plan_of(xy):
    u, v = warp.to_plan(xy[:, 0], xy[:, 1]); return np.stack([u, v], 1)

# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col_main = scene.collection
col_bld = bpy.data.collections.new('buildings'); col_main.children.link(col_bld)

def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

def node_mat(name, build):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(build(nt), out.inputs['Surface'])
    return m

def mesh_obj(name, verts, faces, material=None, smooth=False, attrs=None, col=None):
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
    ob = bpy.data.objects.new(name, me); (col or col_main).objects.link(ob)
    if material: me.materials.append(material)
    return ob

# ---------------------------------------------------------------- terrain and land cover
log('terrain')
STEP = 1.0
n = int(2 * EXT / STEP) + 1
g = np.linspace(-EXT, EXT, n)
U, V = np.meshgrid(g, g)
Z = height_plan(U, V)
verts = np.stack([U.ravel(), V.ravel(), Z.ravel()], 1)
ii = np.arange(n * n).reshape(n, n)
faces = np.stack([ii[:-1, :-1].ravel(), ii[:-1, 1:].ravel(), ii[1:, 1:].ravel(), ii[1:, :-1].ravel()], 1)
X, Y = warp.from_plan(U, V)
E = elevation(X, Y); E = np.where(np.isfinite(E), E, E0)
gy, gx = np.gradient(Z, STEP)
slope = np.hypot(gx, gy)
urban = vignettes.urban_mask(U, V, X, Y)
bld_osm, paths_osm, parks_osm = geodata.osm()
from geo_raster import fill_polygons
to_grid = lambda p: np.stack([(p[:, 0] + EXT) / STEP, (p[:, 1] + EXT) / STEP], 1)
def poly_area(p): return 0.5 * abs(np.sum(p[:, 0] * np.roll(p[:, 1], -1) - np.roll(p[:, 0], -1) * p[:, 1]))
# town parks and lawns only: the national park's boundary would turn whole mountains into lawn
parks_small = [plan_of(xy) for t, xy in parks_osm if poly_area(plan_of(xy)) < 4000]
park = fill_polygons(parks_small, n, n, to_grid).astype(float)
def box_blur(a, r):
    for ax in (0, 1):
        c = np.cumsum(np.pad(a, [(r + 1, r) if k == ax else (0, 0) for k in (0, 1)], mode='edge'), axis=ax)
        a = (np.take(c, range(2 * r + 1, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax] - 2 * r - 1), axis=ax)) / (2 * r + 1)
    return a
# forest: steep or high ground, smoothed so the slopes read as wooded hillsides and the valley floors as open meadow
slope_s = box_blur(box_blur(slope, 6), 6)
tE = np.clip((E - 170) / 200, 0, 1)
forest = np.clip((slope_s - 0.18) / 0.5 + tE * 0.35, 0, 1) * (1 - urban) * (1 - park * 0.8)
cover = np.stack([forest, urban, park * (1 - urban), np.ones_like(forest)], -1).reshape(-1, 4)
def _clay(nt):
    d = nt.nodes.new('ShaderNodeBsdfDiffuse'); d.inputs['Color'].default_value = (0.8, 0.8, 0.8, 1); return d.outputs['BSDF']
m_clay = node_mat('clay', _clay)
def _cover(nt):
    a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'cover'
    e = nt.nodes.new('ShaderNodeEmission'); nt.links.new(a.outputs['Color'], e.inputs['Color']); return e.outputs['Emission']
m_cover = node_mat('cover', _cover)
m_hold = node_mat('holdout', lambda nt: nt.nodes.new('ShaderNodeHoldout').outputs['Holdout'])
terrain = mesh_obj('terrain', verts, faces, m_clay, smooth=True, attrs={'cover': ('POINT', cover)})
log('terrain verts', len(verts))

def zat(pts):
    pts = np.asarray(pts, float)
    return height_plan(pts[:, 0], pts[:, 1])

def inside(p, ext=EXT - 4): return (np.abs(p[:, 0]) < ext) & (np.abs(p[:, 1]) < ext)

def vig_w(p):
    w = np.zeros(len(p))
    for vg in vignettes.VIGNETTES: w = np.maximum(w, vignettes._vig_weight(p[:, 0], p[:, 1], vg))
    return w

def runs_of(mask):
    idx = np.where(mask)[0]
    return [r for r in np.split(idx, np.where(np.diff(idx) > 1)[0] + 1) if len(r) >= 2]

def to_vig(vg, xy): return np.asarray(vg['at']) + (np.asarray(xy) - vg['real']) * vg['scale']
def in_vig(vg, p, k=0.97): return np.hypot(p[:, 0] - vg['at'][0], p[:, 1] - vg['at'][1]) < (vg['r'] - vg['feather'] * 0.35) * k

# ---------------------------------------------------------------- roads, rail, creeks, trails (plan units)
log('lines')
road_lines = {'major': [], 'local': []}
for cls, name, xy in geodata.roads():
    p = plan_of(xy)
    for r in runs_of(inside(p) & (vig_w(p) < 0.35)):
        s = float(warp.local_scale(np.array([xy[r[len(r) // 2]][0]]), np.array([xy[r[len(r) // 2]][1]]))[0])
        if cls == 'local': road_lines['local'].append((p[r], max(1.1, 8 * s), name))
        else: road_lines['major'].append((p[r], max(2.6, 12 * s), name))
for vg in vignettes.VIGNETTES:
    for cls, name, xy in geodata.roads():
        q = to_vig(vg, xy)
        for r in runs_of(in_vig(vg, q)):
            road_lines['local' if cls == 'local' else 'major'].append((q[r], 1.6 if cls == 'local' else 2.6, name))
rail_lines = [plan_of(xy)[r] for xy in geodata.rail() for r in runs_of(inside(plan_of(xy)) & (vig_w(plan_of(xy)) < 0.35))]
creeks = []
for name, xy in geodata.streams():
    p = plan_of(xy)
    for r in runs_of(inside(p) & (vig_w(p) < 0.35)): creeks.append((p[r], name))
    for vg in vignettes.VIGNETTES:
        q = to_vig(vg, xy)
        for r in runs_of(in_vig(vg, q)): creeks.append((q[r], name))
trails = []
for t, xy in paths_osm:
    if t.get('highway') not in ('path', 'footway', 'track', 'steps') or not (t.get('name') or t.get('highway') == 'path'): continue
    p = plan_of(xy)
    for r in runs_of(inside(p)): trails.append((p[r], t.get('name', '')))

# ---------------------------------------------------------------- water areas: NHD lakes, in the core and in each vignette
log('water')
lakes = []   # (name, plan ring, z)
for name, rings in geodata.water():
    outer = rings[0]; p = plan_of(outer)
    if inside(p).any() and vig_w(p).max() < 0.35 and len(p) > 3:
        lakes.append((name, p, None))
    for vg in vignettes.VIGNETTES:
        R_real = (vg['r'] - vg['feather'] * 0.35) / vg['scale']
        if np.hypot(*(outer - vg['real']).T).min() > R_real: continue
        clip = vignettes._clip_disk(to_vig(vg, outer), vg['at'], vg['r'] - vg['feather'] * 0.35)
        if clip is not None and len(clip) > 3: lakes.append((name, clip, vignettes.water_level(vg, EXAG)))

# ---------------------------------------------------------------- buildings (ordinary ones; landmarks are sprites)
log('buildings')
import buildings
INK = srgb('#2b2118')
_toon = {}
def toon(hexc):
    """Two-and-a-half tone cel shading: the sun's light stepped through a constant ramp, times the flat colour."""
    if hexc in _toon: return _toon[hexc]
    def build(nt):
        d = nt.nodes.new('ShaderNodeBsdfDiffuse'); s2r = nt.nodes.new('ShaderNodeShaderToRGB')
        ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation = 'CONSTANT'
        el = ramp.color_ramp.elements; el[0].position = 0.0; el[0].color = (0.58, 0.6, 0.7, 1)
        el.new(0.18).color = (0.8, 0.8, 0.84, 1); el[1].position = 0.42; el[1].color = (1.0, 1.0, 1.0, 1)
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
        em = nt.nodes.new('ShaderNodeEmission')
        nt.links.new(d.outputs['BSDF'], s2r.inputs['Shader']); nt.links.new(s2r.outputs['Color'], ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], mix.inputs['A']); nt.links.new(mix.outputs['Result'], em.inputs['Color'])
        # windows: a grid of dark panes on the walls (not the roofs), one row per storey, as on the downtown blocks
        tc = nt.nodes.new('ShaderNodeTexCoord'); sx = nt.nodes.new('ShaderNodeSeparateXYZ'); cb = nt.nodes.new('ShaderNodeCombineXYZ')
        add = nt.nodes.new('ShaderNodeMath'); add.operation = 'ADD'
        nt.links.new(tc.outputs['Object'], sx.inputs['Vector']); nt.links.new(sx.outputs['X'], add.inputs[0]); nt.links.new(sx.outputs['Y'], add.inputs[1])
        nt.links.new(add.outputs['Value'], cb.inputs['X']); nt.links.new(sx.outputs['Z'], cb.inputs['Y'])
        br = nt.nodes.new('ShaderNodeTexBrick'); br.offset = 0.0
        for k, v in (('Scale', 1.0), ('Mortar Size', 0.95), ('Brick Width', 2.3), ('Row Height', 3.4), ('Mortar Smooth', 0.0)): br.inputs[k].default_value = v
        nt.links.new(cb.outputs['Vector'], br.inputs['Vector'])
        geo_ = nt.nodes.new('ShaderNodeNewGeometry'); nz = nt.nodes.new('ShaderNodeSeparateXYZ'); wall = nt.nodes.new('ShaderNodeMath'); wall.operation = 'LESS_THAN'
        absz = nt.nodes.new('ShaderNodeMath'); absz.operation = 'ABSOLUTE'
        nt.links.new(geo_.outputs['Normal'], nz.inputs['Vector']); nt.links.new(nz.outputs['Z'], absz.inputs[0]); nt.links.new(absz.outputs['Value'], wall.inputs[0]); wall.inputs[1].default_value = 0.5
        pane = nt.nodes.new('ShaderNodeMath'); pane.operation = 'MULTIPLY'; inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0
        nt.links.new(br.outputs['Fac'], inv.inputs[1]); nt.links.new(inv.outputs['Value'], pane.inputs[0]); nt.links.new(wall.outputs['Value'], pane.inputs[1])
        win = nt.nodes.new('ShaderNodeMix'); win.data_type = 'RGBA'
        win.inputs['A'].default_value = (*srgb(hexc), 1); win.inputs['B'].default_value = (*srgb('#3d3a42'), 1)
        nt.links.new(pane.outputs['Value'], win.inputs['Factor']); nt.links.new(win.outputs['Result'], mix.inputs['B'])
        return em.outputs['Emission']
    _toon[hexc] = node_mat('toon_' + hexc, build); return _toon[hexc]
nb = buildings.build(col_bld, zat, toon)
log('buildings', nb, 'landmarks', sorted(buildings.LANDMARKS))

# ---------------------------------------------------------------- camera + light
log('camera')
cam_d = bpy.data.cameras.new('cam'); cam_d.type = 'ORTHO'
cam = bpy.data.objects.new('cam', cam_d); col_main.objects.link(cam); scene.camera = cam
# Looking east (+x), tilted TILT from vertical. Screen right = south (-y), screen up = east (+x).
fwd = Vector((math.sin(TILT), 0, -math.cos(TILT)))
up = Vector((math.cos(TILT), 0, math.sin(TILT)))
right = fwd.cross(up)
R = np.array([[right.x, up.x, -fwd.x], [right.y, up.y, -fwd.y], [right.z, up.z, -fwd.z]])
from mathutils import Matrix
# Framing: across, the north-south span is fixed (VIEW). Up the screen, the play area (every space, every
# vignette inset, the landmarks) sits in the lower part with a margin; above the farthest of it is the horizon
# band, where the illustrator paints the distant Ouachita ridges and the sky.
upv = np.array(up)
pts_c = [[n['x'], n['y'], float(zat(np.array([[n['x'], n['y']]]))[0])] for n in (LAYOUT['nodes'] if LAYOUT else [])]
for vg in vignettes.VIGNETTES:
    for a in np.linspace(0, 2 * math.pi, 49):
        q = np.array([[vg['at'][0] + math.cos(a) * vg['r'], vg['at'][1] + math.sin(a) * vg['r']]]); pts_c.append([*q[0], float(zat(q)[0])])
for L in buildings.LANDMARKS.values(): pts_c.append([L['c'][0], L['c'][1], L['z']])
u_c = np.asarray(pts_c) @ upv
MARGIN_B, MARGIN_T, BAND = 26.0, 22.0, 0.17
H_U = float(np.clip((u_c.max() - u_c.min() + MARGIN_B + MARGIN_T) / (1 - BAND), 0.78 * 2 * VIEW, 0.92 * 2 * VIEW))
u_bot = u_c.min() - MARGIN_B; u_mid = u_bot + H_U / 2
HORIZON_U = u_c.max() + MARGIN_T          # screen height (from the frame's bottom) where the band begins
cam.matrix_world = Matrix.Translation(Vector((CAM_X, 0, 0)) + up * (u_mid - CAM_X * up.x) - fwd * 2000) @ Matrix(R.tolist()).to_4x4()
log('frame', round(H_U, 1), 'tall; play area', round(u_c.max() - u_c.min(), 1), '; horizon band', round(1 - (HORIZON_U - u_bot) / H_U, 3))
cam_d.ortho_scale = 2 * VIEW
cam_d.clip_start = 1; cam_d.clip_end = 5000
scene.render.resolution_x = RES; scene.render.resolution_y = int(round(RES * H_U / (2 * VIEW)))
scene.render.resolution_percentage = 100
RX, RY = scene.render.resolution_x, scene.render.resolution_y
BH_U = 1000 * RY / RX

world = bpy.data.worlds.new('world'); scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']
sun_d = bpy.data.lights.new('sun', 'SUN'); sun = bpy.data.objects.new('sun', sun_d); col_main.objects.link(sun)
# the afternoon sun from the west-south-west, as on the Row's west-facing fronts; low enough to model the ridges
az, el = math.radians(200), math.radians(34)
sdir = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
sun.rotation_euler = sdir.to_track_quat('Z', 'Y').to_euler()
sun_d.energy = 3.2; sun_d.angle = math.radians(7)

# ---------------------------------------------------------------- projection (board units: 0..1000 across, 0..BH_U down)
CAM_INV = np.array(cam.matrix_world.inverted())
def proj(p):
    """(N,3) plan points -> (N,2) board units, as Blender's camera frames them (orthographic, width-fitted)."""
    p = np.asarray(p, float); q = p @ CAM_INV[:3, :3].T + CAM_INV[:3, 3]
    x = q[:, 0] / cam_d.ortho_scale + 0.5; y = q[:, 1] / (cam_d.ortho_scale * RY / RX) + 0.5
    return np.stack([x * 1000, (1 - y) * BH_U], 1)
from bpy_extras.object_utils import world_to_camera_view
def to_board(x, y, z):
    v = world_to_camera_view(scene, cam, Vector((float(x), float(y), float(z))))
    return [round(v.x * 1000, 2), round((1 - v.y) * BH_U, 2)]
_chk = proj(np.array([[100.0, -200.0, 30.0]]))[0]; _ref = to_board(100, -200, 30)
assert abs(_chk[0] - _ref[0]) < 0.05 and abs(_chk[1] - _ref[1]) < 0.05, (_chk, _ref)
def drape(p2, lift=0.0, z=None):
    p2 = np.asarray(p2, float); zz = (zat(p2) if z is None else np.full(len(p2), z)) + lift
    return proj(np.c_[p2, zz])
def rnd(a, k=1): return np.round(np.asarray(a, float), k).tolist()
def zq(x, y): return float(zat(np.array([[x, y]]))[0])

# ---------------------------------------------------------------- tree sites, with a sight line to the camera
log('trees')
import trees
TU, TV, TZ, TK, TS, TF = trees.sites(U, V, Z, X, Y, urban, slope, road_lines, LAYOUT, lakes=vignettes.lake_mask(U, V))
dg = bpy.context.evaluated_depsgraph_get()
bvh = BVHTree.FromObject(terrain, dg)
to_cam = -fwd
seen = np.array([bvh.ray_cast(Vector((float(u), float(v), float(z) + 1.0)), to_cam)[0] is None for u, v, z in zip(TU, TV, TZ)])
log('tree sites visible', int(seen.sum()), 'of', len(seen))

# ---------------------------------------------------------------- the illustrator's data
log('illustrate.json')
VG = {v['name']: v for v in vignettes.VIGNETTES}
ill = {'w': 1000, 'h': round(BH_U, 2), 'render': {'w': RX, 'h': RY}, 'pxPerUnit': RX / 1000.0,
       'unitsPerPlan': 1000.0 / (2 * VIEW), 'squash': round(math.cos(TILT), 4),
       'horizon': round(float((1 - (HORIZON_U - u_bot) / H_U) * BH_U), 2)}
# local scale (board units per metre, warp and all) on a coarse board grid, so painted trees can shrink with it
_g = np.arange(-EXT + 10, EXT, 20.0); _GU, _GV = np.meshgrid(_g, _g); _GU, _GV = _GU.ravel(), _GV.ravel()
_GX, _GY = warp.from_plan(_GU, _GV); _S = warp.local_scale(_GX, _GY) * ill['unitsPerPlan']
for vg in vignettes.VIGNETTES:
    _w = vignettes._vig_weight(_GU, _GV, vg); _S = _S * (1 - _w) + vg['scale'] * ill['unitsPerPlan'] * _w
_B = drape(np.c_[_GU, _GV]); _in = (_B[:, 0] > -20) & (_B[:, 0] < 1020) & (_B[:, 1] > -20) & (_B[:, 1] < BH_U + 20)
ill['scaleGrid'] = [[round(float(b[0]), 1), round(float(b[1]), 1), round(float(s), 4)] for b, s in zip(_B[_in], _S[_in])]
ill['roads'] = [{'cls': k, 'name': nm, 'w': round(w * ill['unitsPerPlan'], 2), 'pts': rnd(drape(p, 0.3))}
                for k in ('local', 'major') for p, w, nm in road_lines[k]]
ill['rail'] = [rnd(drape(p, 0.3)) for p in rail_lines]
ill['creeks'] = [{'name': nm, 'pts': rnd(drape(p, 0.2))} for p, nm in creeks]
ill['trails'] = [{'name': nm, 'pts': rnd(drape(p, 0.2))} for p, nm in trails]
ill['lakes'] = [{'name': nm, 'pts': rnd(drape(p, 0.0, z)), 'vignette': z is not None} for nm, p, z in lakes]
ill['parks'] = [rnd(drape(plan_of(xy), 0.1)) for t, xy in parks_osm if inside(plan_of(xy)).any()]
ill['trees'] = [[round(float(b[0]), 1), round(float(b[1]), 1), int(k), round(float(s * EXAG), 3), round(float(f), 2)]
                for b, k, s, f, ok in zip(drape(np.c_[TU, TV], z=None), TK, TS, TF, seen) if ok]
ill['vignettes'] = [{'name': v['name'], 'label': v['label'], 'truth': v.get('truth', ''),
                     'ring': rnd(drape(np.stack([v['at'][0] + np.cos(a) * v['r'] * 0.96, v['at'][1] + np.sin(a) * v['r'] * 0.96], 1)))}
                    for v in vignettes.VIGNETTES for a in [np.linspace(0, 2 * math.pi, 97)]]
# Oaklawn's one-mile oval and Blakely Mountain Dam, at their vignettes' scale
import features
oak = []
if 'oaklawn' in VG:
    rings = sorted(features._ways('osm-oaklawn.json', lambda t, e: not t), key=lambda r: -np.ptp(r[:, 0]) * np.ptp(r[:, 1]))
    oak = [rnd(drape(to_vig(VG['oaklawn'], r), 0.3)) for r in rings[:2]]
ill['oaklawnTrack'] = oak
ill['dams'] = [rnd(drape(to_vig(VG['ouachita'], d), 1.0)) for d in features._ways('osm-vignettes.json', lambda t, e: t.get('waterway') == 'dam')] if 'ouachita' in VG else []
# landmarks: true footprint (projected at ground level), the foot of the west front, and the footprint's width on screen
lm = {}
for name, L in buildings.LANDMARKS.items():
    poly = np.asarray(L['poly']); z = L['z']
    fp = proj(np.c_[poly, np.full(len(poly), z)])
    west = poly[poly[:, 0] <= np.percentile(poly[:, 0], 30)]
    foot = proj(np.array([[west[:, 0].mean(), poly[:, 1].mean(), z]]))[0]
    lm[name] = {'poly': rnd(fp), 'foot': rnd(foot, 2), 'width': round(float(np.ptp(fp[:, 0])), 2),
                'c': rnd(proj(np.array([[L['c'][0], L['c'][1], z]]))[0], 2), 'metres': round(float(np.ptp(poly[:, 1]) / L['scale']), 1)}
# outlying landmarks and doodle sites: research anchors, through the warp or into their vignette
from geo_common import LAT0, LON0, M_LAT, M_LON
ANCH = json.load(open(os.path.join(GAME, 'research', 'geo-anchors.json')))
def real(k): a = ANCH[k]; return np.array([(a['lon'] - LON0) * M_LON, (a['lat'] - LAT0) * M_LAT])
def site(k, vig=None, off=(0, 0)):
    p = to_vig(VG[vig], real(k) + off) if vig else plan_of((real(k) + off)[None])[0]
    return rnd(drape(p[None])[0], 2)
ill['sites'] = {
    'oaklawnGrandstand': site('oaklawn', 'oaklawn', (-260, 0)), 'oaklawnOval': site('oaklawn', 'oaklawn'),
    'happyHollow': site('happyHollow'), 'whittingtonPark': site('whittingtonPark'), 'banJohnson': site('banJohnson'),
    'fogelField': site('fogelField'), 'majesticPark': site('majesticPark'),
    'blakelyDam': site('blakelyDam', 'ouachita'), 'bridgeSt': site('bridgeSt'), 'parkAveCourts': site('parkAveCourtsS'),
    'garvanGardens': site('garvanGardens', 'hamilton'), 'lakeHamilton': site('lakeHamiltonShore', 'hamilton', (-900, -700)),
    'lakeOuachita': site('lakeOuachitaShore', 'ouachita', (-1500, 600)), 'lakeCatherine': site('lakeCatherineShore', 'catherine', (-300, 200)),
    'creekDaylight': site('creekDaylight'), 'westMountain': site('westMountain'), 'northMountain': site('northMountain'),
    'hotSpringsMtnSummit': site('hotSpringsMtnSummit'), 'sugarloaf': site('sugarloaf'), 'goatRock': site('goatRock'),
    'peakTrailTop': site('peakTrailTop'), 'shortCutLower': site('shortCutLower'),
    'malco': site('malco'), 'mountainaire': site('mountainaire'), 'southernClub': site('southernClub'), 'ohioClub': site('ohioClub'),
    'medicalArts': site('medicalArts'), 'armyNavy': site('armyNavyHospital'), 'admin': site('admin'), 'velda': site('velda'),
}
ill['landmarks'] = lm
# ridge paths for the hillside lettering: the long axis of the high ground round each summit, draped on the terrain
def ridge(key, rad=95.0, length=150.0, off=(0.0, 0.0)):
    c = plan_of(real(key)[None])[0] + np.asarray(off)
    sel = np.hypot(U - c[0], V - c[1]) < rad
    zs = Z[sel]; hi = zs > np.percentile(zs, 70)
    pts = np.stack([U[sel][hi], V[sel][hi]], 1); m = pts.mean(0)
    w, vec = np.linalg.eigh(np.cov((pts - m).T)); ax = vec[:, -1]
    line = m[None] + np.linspace(-length / 2, length / 2, 40)[:, None] * ax[None]
    return rnd(drape(line, 2.0))
ill['ridges'] = {'HOT SPRINGS MOUNTAIN': ridge('hotSpringsMtnSummit', 110, 330), 'NORTH MOUNTAIN': ridge('northMountain', 90, 260),
                 'WEST MOUNTAIN': ridge('westMountain', 110, 300), 'NATIONAL PARK': ridge('westMountain', 110, 280, (-34, 0)),
                 'SUGARLOAF MOUNTAIN': ridge('sugarloaf', 90, 260)}
# Central Avenue through downtown: the widened boulevard between the Row walk and the west sidewalk
_cy = np.linspace(-600, 430, 160); _cl = np.stack(warp.to_plan(warp._xc(_cy), _cy), 1)
ill['central'] = {'pts': rnd(drape(_cl, 0.4)), 'w': round(24.0 * 1000.0 / (2 * VIEW), 2)}
ill['north'] = [a - b for a, b in zip(to_board(0, 100, 0), to_board(0, 0, 0))]

# ---------------------------------------------------------------- game data (board units)
geo = {'w': 1000, 'h': round(BH_U, 2), 'tilt': math.degrees(TILT), 'squash': round(math.cos(TILT), 4), 'horizon': ill['horizon']}
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
    geo['tracks'] = [{k: t[k] for k in ('name', 'ids', 'pitch', 'cv')} for t in LAYOUT.get('tracks', [])]
    # labels: district plates beside each landmark, in the clearest of 24 directions
    P = np.array([[n['x'], n['y']] for n in nodes])
    Eall = np.concatenate([np.asarray(e['pts']) for e in LAYOUT['edges']])
    # Plates are rectangles on screen; in plan, screen-x is -y and screen-up is +x (foreshortened).
    PU = 1000.0 / (2 * VIEW)                    # board units per plan unit across the screen
    def plate_half(text, size, sub=False):
        w_b = 0.56 * size * len(text) + 28; h_b = size + 12 + (size * 0.8 if sub else 0)
        return (h_b / 2) / (PU * math.cos(TILT)), (w_b / 2) / PU     # (half along plan x, half along plan y)
    RN = {'landmark': 20, 'start': 18, 'trail': 9}
    NR = np.array([RN.get(n['type'], 17) for n in nodes], float)
    rects = []
    def clearance(q, h):
        dx = np.maximum(np.abs(P[:, 0] - q[0]) - h[0], 0); dy = np.maximum(np.abs(P[:, 1] - q[1]) - h[1], 0)
        c = (np.hypot(dx, dy) - NR).min()
        ex = np.maximum(np.abs(Eall[:, 0] - q[0]) - h[0], 0); ey = np.maximum(np.abs(Eall[:, 1] - q[1]) - h[1], 0)
        c = min(c, (np.hypot(ex, ey) - 6).min())
        for (r0, rh) in rects:
            gx_ = max(abs(r0[0] - q[0]) - rh[0] - h[0], 0); gy_ = max(abs(r0[1] - q[1]) - rh[1] - h[1], 0)
            c = min(c, math.hypot(gx_, gy_) - 4 if (gx_ or gy_) else -50)
        b = to_board(q[0], q[1], zq(*q)); hb = h[0] * PU * math.cos(TILT); wb = h[1] * PU
        c = min(c, b[0] - wb - 12, 1000 - 12 - b[0] - wb, b[1] - hb - ill['horizon'] - 8, BH_U - 12 - b[1] - hb)
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
    for d in json.load(open(os.path.join(GAME, 'art-src', 'geo', 'graph.json')))['districts']:
        lmk = [n for n in nodes if n['district'] == d['key'] and n['type'] == 'landmark'][0]
        vg = VG.get(vig_by_district.get(d['key'], ''))
        sub = f"{vg['truth']} · moved closer" if vg else None
        h = plate_half(d['name'], 14, bool(sub))
        q = place([lmk['x'], lmk['y']], h)
        labels.append({'text': d['name'], 'kind': 'district', 'key': d['key'], 'sub': sub, 'at': to_board(q[0], q[1], zq(*q) + 2), 'anchor': to_board(lmk['x'], lmk['y'], zq(lmk['x'], lmk['y']) + 1.4)})
    for vg in vignettes.VIGNETTES:
        ring = [to_board(vg['at'][0] + math.cos(a) * vg['r'] * 0.96, vg['at'][1] + math.sin(a) * vg['r'] * 0.96, zq(vg['at'][0] + math.cos(a) * vg['r'] * 0.96, vg['at'][1] + math.sin(a) * vg['r'] * 0.96)) for a in np.linspace(0, 2 * math.pi, 49)]
        if vg['name'] in vig_by_district.values():
            labels.append({'text': '', 'kind': 'ring', 'ring': ring}); continue
        h = plate_half(vg['label'], 11.5, True)
        q = place(vg['at'], h, radii=(0, 30, 50, 70, 90))
        labels.append({'text': vg['label'], 'kind': 'vignette', 'truth': vg.get('truth', ''), 'at': to_board(q[0], q[1], zq(*q) + 2), 'ring': ring})
    def anchor_plan(k):
        u, v = warp.to_plan(*[np.array([c]) for c in real(k)]); return float(u[0]), float(v[0])
    for k, text in [('hotSpringsMtnSummit', 'Hot Springs Mountain'), ('westMountainOverlook', 'West Mountain'), ('northMountain', 'North Mountain')]:
        u, v = anchor_plan(k); h = plate_half(text, 11, False); q = place([u, v], h, radii=(0, 20, 36, 52))
        labels.append({'text': text, 'kind': 'mountain', 'at': to_board(q[0], q[1], zq(*q) + 2)})
    # street name along Central Avenue, between the two lines of spaces
    cu, cv = warp.to_plan(np.array([warp._xc(-40)]), np.array([-40.0]))
    labels.append({'text': 'Central Avenue', 'kind': 'street', 'at': to_board(cu[0], cv[0], zq(cu[0], cv[0]) + 0.5),
                   'dir': [a - b for a, b in zip(to_board(cu[0], cv[0] - 50, 0), to_board(cu[0], cv[0] + 50, 0))]})
    geo['labels'] = labels
    geo['north'] = ill['north']
    geo['steam'] = [to_board(*xyz) for k, xyz in buildings.ROOF_TOPS.items() if k in ('Superior', 'Hale', 'Maurice', 'Fordyce', 'Quapaw', 'Ozark', 'Buckstaff', 'Lamar')]
    if 'Mountain Tower' in lm:
        b = lm['Mountain Tower']['foot']; geo['tower'] = {'base': b, 'top': [b[0], round(b[1] - 92, 2)]}
    geo['render'] = {'w': RX, 'h': RY}
    # the route and its spaces for the illustrator (it bakes the trail band and each space's paver seat)
    G = json.load(open(os.path.join(GAME, 'art-src', 'geo', 'graph.json')))
    ill['route'] = {'nodes': [{'x': g_['x'], 'y': g_['y'], 'type': G['nodes'][i]['type'], 'spur': G['nodes'][i]['spur']} for i, g_ in enumerate(geo['nodes'])],
                    'edges': [{'a': e['a'], 'b': e['b'], 'trail': e['trail'], 'pts': rnd(drape(np.asarray(e['pts']), 0.9))} for e in LAYOUT['edges']]}
    ill['labels'] = labels
    prev = json.load(open(os.path.join(GAME, 'data', 'board-geo.json'))) if os.path.exists(os.path.join(GAME, 'data', 'board-geo.json')) else {}
    for k in ('frieze', 'baked', 'slots'):   # written by the illustrator; keep them across a rebuild
        if k in prev: geo[k] = prev[k]
    if 'tower' in prev and 'tower' in geo and prev['tower'].get('base') == geo['tower']['base']: geo['tower'] = prev['tower']
    json.dump(geo, open(os.path.join(GAME, 'data', 'board-geo.json'), 'w'))
    log('wrote data/board-geo.json', len(geo['nodes']), 'nodes')
json.dump(ill, open(os.path.join(GAME, 'art-src', 'geo', 'illustrate.json'), 'w'))
log('wrote art-src/geo/illustrate.json', {k: len(v) for k, v in ill.items() if isinstance(v, (list, dict))})

# ---------------------------------------------------------------- render the passes (EEVEE)
for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try: scene.render.engine = eng; break
    except TypeError: pass
ee = scene.eevee
for k, v in (('taa_render_samples', 48), ('use_shadows', True), ('shadow_ray_count', 4), ('shadow_step_count', 12),
             ('use_gtao', True), ('gtao_distance', 30.0), ('fast_gi_distance', 30.0), ('horizon_quality', 0.5)):
    try: setattr(ee, k, v)
    except (AttributeError, TypeError): pass
scene.view_settings.view_transform = 'Standard'; scene.view_settings.look = 'None'
scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
# Freestyle ink on the buildings pass: silhouettes, creases (wall/roof breaks) and borders, one weight
scene.render.line_thickness_mode = 'ABSOLUTE'; scene.render.line_thickness = max(1.0, RES / 1600)
vl = scene.view_layers[0]; fs = vl.freestyle_settings
ls = fs.linesets[0] if fs.linesets else fs.linesets.new('ink')
ls.select_by_collection = True; ls.collection = col_bld
ls.select_silhouette = ls.select_border = ls.select_crease = True
if ls.linestyle is None: ls.linestyle = bpy.data.linestyles.new('ink')
ls.linestyle.color = srgb('#3a2a1a'); ls.linestyle.thickness = max(1.0, RES / 2000)
fs.crease_angle = math.radians(140)

def render(name, terrain_mat, show_bld, bld_camera=True, freestyle=False, transparent=False, world=(0.3, 0.33, 0.38, 0.9), sun_on=True):
    terrain.data.materials[0] = terrain_mat
    for ob in col_bld.objects:
        ob.hide_render = not show_bld; ob.visible_camera = bld_camera
    scene.render.use_freestyle = freestyle; scene.render.film_transparent = transparent
    bg.inputs['Color'].default_value = world[:3] + (1,); bg.inputs['Strength'].default_value = world[3]
    sun.hide_render = not sun_on
    scene.render.filepath = os.path.join(PASSES, name + '.png')
    if NORENDER: return
    log('render', name); bpy.ops.render.render(write_still=True)

render('relief', m_clay, False)
render('relief_b', m_clay, True, bld_camera=False)
render('cover', m_cover, False, world=(0, 0, 0, 0), sun_on=False)
render('buildings', m_hold, True, freestyle=True, transparent=True)
if SAVE:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(GAME, 'art-src', 'blender', 'board.blend'))
log('done')
