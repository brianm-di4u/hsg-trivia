// Before/after sheets: pairs each screenshot of one milestone with the same-named shot of another.
//
//   node tools/before-after.mjs [before=visual-before] [after=visual-final]
//
// Writes screenshots/<after>/before-after/<viewport>-NN.png (desktop: 2 pairs per sheet, mobile: 3), labelled
// BEFORE / AFTER. Renders with the harness's Chromium, so no image libraries are needed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(GAME);
const { chromium } = await import(pathToFileURL(path.join(ROOT, 'shared', 'test-harness', 'node_modules', 'playwright', 'index.mjs')).href);
const [before = 'visual-before', after = 'visual-final'] = process.argv.slice(2);
const SHOTS = path.join(GAME, 'screenshots');
const outDir = path.join(SHOTS, after, 'before-after');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
let written = 0;
for (const [vp, per, w] of [['desktop', 2, 640], ['mobile', 3, 260]]) {
  const a = path.join(SHOTS, before, vp), b = path.join(SHOTS, after, vp);
  if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
  const names = fs.readdirSync(a).filter((n) => n.endsWith('.png') && fs.existsSync(path.join(b, n))).sort();
  for (let s = 0; s * per < names.length; s++) {
    const group = names.slice(s * per, s * per + per);
    const url = (dir, n) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, n)).toString('base64');
    const cell = (dir, n, tag) => `<figure><img src="${url(dir, n)}" style="width:${w}px"><figcaption><b>${tag}</b> ${n.replace('.png', '')}</figcaption></figure>`;
    const html = `<body style="margin:0;background:#222;color:#eee;font:14px system-ui"><div style="display:flex;flex-direction:column;gap:10px;padding:10px">`
      + group.map((n) => `<div style="display:flex;gap:10px">${cell(a, n, 'BEFORE')}${cell(b, n, 'AFTER')}</div>`).join('')
      + `</div><style>figure{margin:0}figcaption{padding:4px 2px}</style></body>`;
    await page.setContent(html);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete));
    const file = path.join(outDir, `${vp}-${String(s + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: file, fullPage: true });
    written++;
  }
}
await browser.close();
console.log(written + ' before/after sheets in ' + path.relative(ROOT, outDir));
