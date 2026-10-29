// Painted and rendered art: loaded with new Image() + decode() so it works from file:// as well as http.
// Only names listed in assets/manifest.json (inlined as ASSET_MANIFEST) are ever requested, so a missing
// file can't 404. `?art=0` turns the art off and the game falls back to its vector drawing.
/* global ASSET_MANIFEST */
const MAN = typeof ASSET_MANIFEST !== 'undefined' ? ASSET_MANIFEST : {};
const off = typeof location !== 'undefined' && /[?&]art=0\b/.test(location.search);
export const ART = { enabled: !off, imgs: {}, pending: 0, failed: [], listeners: [] };

export function has(name) { return ART.enabled && !!MAN[name]; }
export function img(name) { const r = ART.imgs[name]; return r && r.ok ? r.img : null; }

// Load once; resolves to the image or null. `onload` callbacks let renderers rebuild caches.
export function load(name) {
  if (!has(name)) return Promise.resolve(null);
  if (ART.imgs[name]) return ART.imgs[name].p;
  const im = new Image();
  const rec = { img: im, ok: false, p: null };
  ART.imgs[name] = rec; ART.pending++;
  rec.p = new Promise((resolve) => {
    im.onload = () => {
      const fin = () => { rec.ok = true; ART.pending--; ART.listeners.forEach((f) => f(name)); resolve(im); };
      if (im.decode) im.decode().then(fin, fin); else fin();
    };
    im.onerror = () => { ART.pending--; ART.failed.push(name); resolve(null); };
  });
  im.src = 'assets/' + name + '.webp';
  return rec.p;
}
export function onLoad(f) { ART.listeners.push(f); }
export const loading = () => ART.pending > 0;
export function manifest() { return MAN; }
