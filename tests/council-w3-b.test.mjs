// Council wave 3, batch B: controls, rules and play; difficulty, progression and records
// (S2-06, S3-12, S4-05, S6-08, S4-09, S4-13, S1-08, S3-07, S3-09, S3-11).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { H1, soloGame, landOn, moveTo, waitFor, phase } from './helpers.mjs';

const KEY = 'hs-trivia-v1';
const stored = (t) => t.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
// The harness serializes initScript with toString, so a per-case script carries its data in its own source.
const withSave = (obj) => {
  const f = () => {};
  f.toString = () => `() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('hs-trivia-v1', JSON.stringify(${JSON.stringify(obj)})); } }`;
  return f;
};
const VETERAN = { v: 1, settings: { sound: true, volume: 0.7, timer: 0, aiSpeed: 'normal', seenCoach: true }, best: { quick: 1820, era: { roaring: 1340 } }, daily: { last: null, streak: 0, results: {} }, trail: null };
const rect = (t, sel) => t.page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height }; }, sel);
// The human is at the Tower with the stamps for it and has just reached it: the Summit dialog is open.
const atSummit = async (t) => {
  const s = await t.state();
  const stamps = Object.keys(s.board.landmarks);
  await t.game('setState', { trail: { players: [{ stamps, tickets: 9 }] } });
  const nb = (await t.game('act', 'adj', s.board.tower)).find((n) => s.board.types[n] === 'trail');
  await moveTo(t, nb, 1, s.board.tower);
  return phase(t, 'summit');
};
const firstOf = async (t, type) => (await t.state()).board.types.indexOf(type);

export const tests = [
  // ---------------- S2-06 ----------------
  {
    name: 'S2-06 the latest log line sits under the turn header on a phone and is not repeated on a wide screen',
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      await t.game('act', 'roll', 3);
      await phase(t, 'choose');
      const r = await t.page.evaluate(() => {
        const l = document.querySelector('#panel .lastline'); const h = document.querySelector('#panel .turn'); const p = document.querySelector('#panel');
        const lr = l.getBoundingClientRect(); const hr = h.getBoundingClientRect(); const pr = p.getBoundingClientRect();
        return { display: getComputedStyle(l).display, text: l.textContent, top: lr.top, bottom: lr.bottom, headBottom: hr.bottom, panelTop: pr.top, panelBottom: pr.bottom, log: window.__game.getState().trail.log[0], hidden: l.getAttribute('aria-hidden') };
      });
      t.equal(r.text, r.log, 'the banner says the newest log line');
      t.equal(r.hidden, 'true', 'it is hidden from screen readers (the live region already reads each line)');
      if (t.viewport === 'mobile') {
        t.expect(r.display !== 'none', 'shown on a phone');
        t.expect(r.bottom - r.top >= 14, 'and it has room for its line, not squeezed to nothing: ' + (r.bottom - r.top));
        t.expect(r.top >= r.headBottom - 1 && r.top - r.headBottom < 12, `it sits right under the turn header (${r.headBottom} to ${r.top})`);
        t.expect(r.bottom < r.panelTop + 140, 'and is in the first screenful of the sheet: ' + (r.bottom - r.panelTop));
        await t.shot('S2-06-lastline');
      } else t.equal(r.display, 'none', 'not shown beside the full log on a wide screen');
    },
  },
];
