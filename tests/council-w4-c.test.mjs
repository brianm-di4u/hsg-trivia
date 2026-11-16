// Council wave 4, batch C: polish across the game
// (S2-10, S4-12, P-N07, S6-06, S5-09, C4-17, S6-13, C4-02, C4-03, C4-05).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { H1, soloGame, landOn, waitFor, phase } from './helpers.mjs';

const SHOTS = fileURLToPath(new URL('../../_council/hsg-trivia/wave-4/shots/', import.meta.url));
const REPO = fileURLToPath(new URL('..', import.meta.url));
const BASE = { v: 1, settings: { sound: true, volume: 0.7, timer: 0, aiSpeed: 'normal', seenCoach: true }, best: { quick: 0, era: {} }, daily: { last: null, streak: 0, results: {} }, trail: null };
// The harness serializes initScript with toString, so a per-case script carries its data in its own source.
const withSave = (obj, today = '2026-11-16') => {
  const f = () => {};
  f.toString = () => `() => { window.__TEST_DATE__ = '${today}'; if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('hs-trivia-v1', JSON.stringify(${JSON.stringify(obj)})); } }`;
  return f;
};
const text = (t, sel) => t.page.evaluate((s) => document.querySelector(s).textContent.replace(/\s+/g, ' ').trim(), sel);
const bank = () => JSON.parse(fs.readFileSync(REPO + 'data/questions.json', 'utf8')).questions;
const node = (name, run) => ({ name, node: true, run });

// The question strings the owner approved (decisions 29 and 31): the two C4-03 rewordings and the fourteen that no longer open with "According to".
const REWORDED = {
  'hs-0104': 'What did the Ozark Bathhouse on Bathhouse Row reopen as in 2014?',
  'hs-0291': 'Which architect designed Hot Springs’ Maurice Bathhouse?',
  'hs-0049': 'In what year did Gov. Winthrop Rockefeller end Hot Springs’ casino revival?',
  'hs-0148': 'How many hot springs emerge from Hot Springs Mountain in Hot Springs National Park?',
  'hs-0155': 'Which dissolved constituent is most concentrated in Hot Springs’ thermal water?',
  'hs-0181': 'Which big cat left the Hot Springs area after European settlement?',
  'hs-0369': 'In what year was the first World’s Shortest St. Patrick’s Day Parade held?',
  'hs-0507': 'How long is Hot Springs’ "Zero K Foot Race"?',
  'hs-0131': 'DeGray Lake is described as the first Corps of Engineers impoundment able to do what?',
  'hs-0358': 'Mountain Valley water is said to have been served in which legislative chamber since the 1920s?',
  'hs-0479': 'Where is Hot Springs’ Rix Tower said to have stood before it was moved to the mountain?',
  'hs-0540': 'The Fordyce Bathhouse’s third floor, opened in 1915, is billed as Arkansas’s first what?',
  'hs-0567': 'Which Hot Springs congregation is credited with appointing the state’s first full-time female rabbi, in 1989?',
  'hs-0571': 'Mountain Valley is credited as the first bottled water sold coast to coast, on reaching which state in 1928?',
  'hs-0574': 'Which president is believed to have been the first to have Mountain Valley Spring Water served in the White House?',
  'hs-0610': 'Which Central Avenue gambling club is credited with Hot Springs’ first escalator, installed in the 1950s?',
};
// The apostrophes of the data file are straight or curly; only those may differ.
const plain = (s) => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

export const tests = [
  // ---------------- S6-13 ----------------
  {
    name: 'S6-13 dragging the window edge keeps the board cache until the drag has been still, then rebuilds it once, crisp at the new size',
    viewports: ['desktop'],
    async run(t) {
      await t.game('scene', 'game');
      await soloGame(t, { settings: { seenCoach: true } });
      await t.waitForStable(8000);
      await t.game('resizeSettle', 1500);
      const before = (await t.state()).ui;
      const widths = [1240, 1200, 1160, 1120];
      const sizes = [];
      for (const w of widths) {
        await t.page.setViewportSize({ width: w, height: 800 });
        await t.page.waitForFunction((x) => innerWidth === x, w);
        await t.page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
        sizes.push((await t.state()).ui);
      }
      t.equal(sizes[sizes.length - 1].cacheBuilds, before.cacheBuilds, 'no rebuild during the drag: ' + before.cacheBuilds + ' -> ' + sizes.map((u) => u.cacheBuilds));
      const want = await waitFor(t, (s) => s.ui.cacheBuilds > before.cacheBuilds, 8000, 'the settled rebuild');
      t.equal(want.ui.cacheBuilds, before.cacheBuilds + 1, 'one rebuild after it settled');
      t.expect(want.ui.cacheWidth !== before.cacheWidth, 'the cache has the new size: ' + before.cacheWidth + ' -> ' + want.ui.cacheWidth);
      await t.game('resizeSettle', 150);
    },
  },
  {
    name: 'S6-13 a big change of size, or a change of theme, rebuilds the cache at once',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      await t.waitForStable(8000);
      await t.game('resizeSettle', 60000);
      const before = (await t.state()).ui;
      await t.page.setViewportSize({ width: 700, height: 500 });
      await waitFor(t, (s) => s.ui.cacheBuilds > before.cacheBuilds, 8000, 'a rebuild for a big change');
      const mid = (await t.state()).ui;
      await t.game('setState', { settings: { theme: 'dark' } });
      await waitFor(t, (s) => s.ui.cacheBuilds > mid.cacheBuilds, 8000, 'a rebuild for a theme change');
      await t.game('resizeSettle', 150);
    },
  },


];
