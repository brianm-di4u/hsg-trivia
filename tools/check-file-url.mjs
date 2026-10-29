// Opens the game straight from disk (file://), as a player double-clicking index.html would, at both viewports.
// It checks that every board, token, card and stamp image loads, that nothing logs an error, and that no request
// leaves the machine.
//
//   node tools/check-file-url.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(GAME);
const { chromium } = await import(pathToFileURL(path.join(ROOT, 'shared', 'test-harness', 'node_modules', 'playwright', 'index.mjs')).href);
const url = pathToFileURL(path.join(GAME, 'index.html')).href;
const browser = await chromium.launch();
let bad = 0;
for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport: vp });
  const errors = [], external = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
  await page.goto(url); await page.waitForFunction(() => window.__game);
  await page.evaluate(() => window.__game.newGame({ mode: 'trail', players: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] }));
  await page.waitForFunction(() => window.__game.getState().art.pending === 0, null, { timeout: 15000 });
  const art = await page.evaluate(() => window.__game.getState().art);
  const ok = art.failed.length === 0 && errors.length === 0 && external.length === 0 && art.loaded.length > 20;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${vp.width}×${vp.height} file:// · ${art.loaded.length} images loaded · ${art.failed.length} failed · ${errors.length} errors · ${external.length} external requests`);
  await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
