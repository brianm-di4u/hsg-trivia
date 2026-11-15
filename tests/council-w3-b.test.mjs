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
  // ---------------- S3-12 ----------------
  {
    name: 'S3-12 the era cards and the Quick 10 button show the best score, and the results say what it was made of',
    initScript: withSave(VETERAN),
    async run(t) {
      await t.game('scene', 'title');
      await t.waitForStable(8000);
      const quick = await t.page.locator('#scene-title [data-act="quick"]').innerText();
      t.expect(/best 1,820/i.test(quick), 'Quick 10 says its best: ' + quick.replace(/\n/g, ' '));
      await t.game('scene', 'era');
      await t.waitForStable(8000);
      const cards = await t.page.evaluate(() => [...document.querySelectorAll('.era-card')].map((c) => ({ era: c.dataset.era, best: c.querySelector('.era-best') ? c.querySelector('.era-best').textContent : null })));
      t.equal(cards.find((c) => c.era === 'roaring').best, 'Best 1,340', 'the era with a score shows it');
      t.equal(cards.filter((c) => c.best).length, 1, 'the others show none');
      await t.shot('S3-12-era-best');
      await t.checkLayout({ allowScrollY: true });
    },
  },
  {
    name: 'S3-12 a best remembers how many were right and the timer it was played with; a lower score does not replace it',
    async run(t) {
      await t.game('setState', { settings: { timer: 0 } });
      await t.seed(11);
      await t.game('newGame', { mode: 'quick', seed: 11 });
      for (let i = 0; i < 10; i++) { await t.game('act', 'answer', i < 7 ? 'correct' : 'wrong'); await t.game('act', 'continue'); }
      await t.waitForStable(8000);
      let sv = await stored(t);
      t.expect(sv.best.quick > 0, 'a best was saved: ' + sv.best.quick);
      t.equal(JSON.stringify(sv.bestMeta.quick), JSON.stringify({ right: 7, total: 10, timer: 0 }), 'with what it was made of');
      const line = await t.page.locator('#scene-results .score').innerText();
      t.expect(/7 of 10 right/.test(line), 'the results show accuracy beside the points: ' + line);
      t.expect(/personal best [\d,]+ \(7 of 10, no timer\)/.test(line), 'and the best with its timer: ' + line);
      const best = sv.best.quick;
      // a worse game with the timer on changes nothing
      await t.game('setState', { settings: { timer: 30 } });
      await t.game('newGame', { mode: 'quick', seed: 12 });
      for (let i = 0; i < 10; i++) { await t.game('act', 'answer', i < 2 ? 'correct' : 'wrong'); await t.game('act', 'continue'); }
      sv = await stored(t);
      t.equal(sv.best.quick, best, 'the best stands');
      t.equal(sv.bestMeta.quick.right, 7, 'and so does its meta');
      // a better one with the timer on replaces both
      await t.game('newGame', { mode: 'quick', seed: 13 });
      for (let i = 0; i < 10; i++) { await t.game('act', 'answer', 'correct'); await t.game('act', 'continue'); }
      sv = await stored(t);
      t.expect(sv.best.quick > best, 'a better game raises it');
      t.equal(JSON.stringify(sv.bestMeta.quick), JSON.stringify({ right: 10, total: 10, timer: 30 }), 'and its meta moves with it');
      await t.shot('S3-12-results');
    },
  },
  {
    name: 'S3-12 a save from before has no meta, shows its points alone and keeps them; damaged meta is dropped',
    initScript: withSave({ ...VETERAN, bestMeta: { quick: { right: 'x', total: 10, timer: 0 }, era: { roaring: { right: 5, total: 10, timer: 20 }, bad: 5 } } }),
    async run(t) {
      const sv = await stored(t);
      t.equal(sv.best.quick, 1820, 'the old best is untouched');
      await t.game('scene', 'title'); await t.waitForStable(8000);
      t.expect(/best 1,820/i.test(await t.page.locator('#scene-title [data-act="quick"]').innerText()), 'it still shows');
      await t.game('setState', { settings: { timer: 0 } });
      await t.game('newGame', { mode: 'quick', seed: 3 });
      for (let i = 0; i < 10; i++) { await t.game('act', 'answer', 'wrong'); await t.game('act', 'continue'); }
      await t.waitForStable(8000);
      const line = await t.page.locator('#scene-results .score').innerText();
      t.expect(/personal best 1,820/.test(line) && !/personal best 1,820 \(/.test(line), 'a best with no meta is shown as points alone: ' + line);
    },
  },
];
