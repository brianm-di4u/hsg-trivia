#!/usr/bin/env node
// Builds the painted 2D Trivia Trail board (tools/map/illustrate/page.js, Canvas2D in the harness's headless Chromium).
// The plan of the real valley comes from public data via tools/map/build_board.py (art-src/geo/illustrate.json); an
// image model paints the base map from that plan; this script aligns the painting and layers the route, the real
// landmarks, the title and the compass on top, checking the geography as it goes.
//
//   node tools/map/illustrate.mjs --guide              the colour-coded plan to paint from (art-src/board2d/guide.png)
//   node tools/map/illustrate.mjs --register base      warp the painted base onto the plan (art-src/board2d/base-aligned.png)
//   node tools/map/illustrate.mjs [--night] [--discs] [--crop x,y,w,h] [--scale 0.5] [--out file.png]
//
// --crop is in board units (0..1000 across); --scale shrinks the canvas for quick looks; --discs previews the game's
// spaces. Without --crop the board goes to art-src/illustrated/board-<day|night>.png, and the day board also patches
// data/board-geo.json with the points only the painting knows (the tower's top, steam roofs, the compass and credits
// slots, which labels are baked in, where the ambient figures go).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '..', '..');
const ROOT = path.resolve(GAME);
const { chromium } = await import(pathToFileURL(path.join(ROOT, 'shared', 'test-harness', 'node_modules', 'playwright', 'index.mjs')).href);

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const NIGHT = args.includes('--night');
const GUIDE = args.includes('--guide');
const REGISTER = opt('--register', null);   // the painted base to align to the guide, e.g. base or base-v2

const crop = opt('--crop', null)?.split(',').map(Number) || null;
const scale = Number(opt('--scale', '1'));
const outDir = path.join(GAME, 'art-src', 'illustrated');
fs.mkdirSync(outDir, { recursive: true });
const out = opt('--out', GUIDE ? path.join(GAME, 'art-src', 'board2d', 'guide.png') : REGISTER ? path.join(GAME, 'art-src', 'board2d', `${REGISTER}-aligned.png`) : path.join(outDir, `board-${NIGHT ? 'night' : 'day'}${crop ? '-crop' : ''}.png`));
fs.mkdirSync(path.dirname(out), { recursive: true });

// Every file the page asks for under http://ill.local/ is served from the game folder.
const MIME = { '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const browser = await chromium.launch({ args: ['--disable-web-security'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on('console', (m) => console.log('  page:', m.text()));
page.on('pageerror', (e) => { console.error('  page error:', e.message); process.exitCode = 1; });
await page.route('http://ill.local/**', (route) => {
  const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, '');
  const file = path.join(GAME, rel);
  if (!file.startsWith(GAME) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'missing ' + rel });
  route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
});
await page.goto('http://ill.local/tools/map/illustrate/index.html');
const result = await page.evaluate(async (o) => window.paint(o), { night: NIGHT, crop, scale, discs: args.includes('--discs'), mode: GUIDE ? 'guide' : REGISTER ? 'register' : 'board', base: REGISTER || opt('--base', 'base') });
if (!result || !result.png) { console.error('illustrate: nothing painted'); await browser.close(); process.exit(1); }
fs.writeFileSync(out, Buffer.from(result.png, 'base64'));
console.log(`wrote ${path.relative(ROOT, out)}  ${result.w}x${result.h}  ${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB  (${result.ms} ms)`);
for (const line of result.report || []) console.log('  ' + line);
if (result.errors?.length) {
  for (const e of result.errors) console.error('  CHECK FAILED: ' + e);
  process.exitCode = 1;
}
// The full day board owns the game-data write-back; crops and the night board never touch it.
if (result.geoPatch && !crop && !NIGHT && !GUIDE && !REGISTER) {
  const gp = path.join(GAME, 'data', 'board-geo.json');
  const geo = JSON.parse(fs.readFileSync(gp, 'utf8'));
  Object.assign(geo, result.geoPatch);
  fs.writeFileSync(gp, JSON.stringify(geo));
  console.log('patched data/board-geo.json:', Object.keys(result.geoPatch).join(', '));
}
await browser.close();
