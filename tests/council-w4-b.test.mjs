// Council wave 4, batch B: controls, rules and play; difficulty, progression and records
// (S6-12, C4-04, C4-08, S5-20, S3-14, P-N05, S3-25, P-N03).
import { soloGame, waitFor, phase } from './helpers.mjs';

const rect = (t, sel) => t.page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }, sel);

export const tests = [
  // ---------------- S6-12 ----------------
  {
    name: 'S6-12 a right or middle click on a lit space chooses nothing; a left click still does',
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      await t.game('act', 'roll', 3);
      let s = await phase(t, 'choose');
      if (s.ui.camera === 'follow') await t.game('act', 'ui', 'zoom');
      await t.waitForStable(8000);
      s = await t.state();
      const box = await rect(t, '#board');
      let d = null;
      for (const id of s.trail.dests) { const p = await t.game('act', 'screenOf', id); if (!d && p[0] > box.left + 30 && p[0] < box.right - 30 && p[1] > box.top + 30 && p[1] < box.bottom - 30) d = { id, p }; }
      t.expect(d, 'a destination is on screen');
      await t.page.mouse.click(d.p[0], d.p[1], { button: 'right' });
      await t.page.mouse.click(d.p[0], d.p[1], { button: 'middle' });
      s = await t.state();
      t.equal(s.trail.phase, 'choose', 'neither button chose the space');
      await t.page.mouse.click(d.p[0], d.p[1]);
      s = await waitFor(t, (x) => x.trail.phase !== 'choose', 4000, 'the left click to choose');
      t.expect(s.trail.phase === 'moving' || s.trail.players[0].node === d.id, 'the token set off for that space');
      await t.game('act', 'finishAnim');
    },
  },
];
