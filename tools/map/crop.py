# Crop/scale a PNG for review:  blender -b --factory-startup --python tools/map/crop.py -- in.png out.png x0 y0 w h [scale]
import bpy, sys
import numpy as np
a = sys.argv[sys.argv.index('--') + 1:]
src, dst = a[0], a[1]; x0, y0, w, h = map(int, a[2:6]); sc = float(a[6]) if len(a) > 6 else 1.0
im = bpy.data.images.load(src); W, H = im.size
px = np.array(im.pixels[:], np.float32).reshape(H, W, 4)[::-1]
c = px[y0:y0 + h, x0:x0 + w]
if sc != 1.0:
    ys = (np.arange(int(h * sc)) / sc).astype(int); xs = (np.arange(int(w * sc)) / sc).astype(int); c = c[ys][:, xs]
o = bpy.data.images.new('c', c.shape[1], c.shape[0], alpha=True); o.pixels = c[::-1].ravel()
o.filepath_raw = dst; o.file_format = 'PNG'; o.save()
