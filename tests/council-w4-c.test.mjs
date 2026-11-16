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
  // ---------------- S4-12 ----------------
  {
    name: 'S4-12 the re-roll and the 50/50 lead with the board’s own words and still say what they do and what they cost',
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      await t.game('setState', { trail: { phase: 'roll', rerolled: false, roll: null, players: [{ tickets: 9, node: 0 }] } });
      await t.game('act', 'roll', 3);
      await phase(t, 'choose');
      const re = await text(t, '[data-act="reroll"]');
      t.expect(/^Let the steam settle · re-roll · 1 ticket(?!s)/.test(re), 're-roll button: ' + re);
      const fit = (sel) => t.page.evaluate((s) => { const b = document.querySelector(s), r = b.getBoundingClientRect(), p = b.closest('#panel, .panel, body').getBoundingClientRect(); return { inside: r.left >= p.left - 1 && r.right <= p.right + 1 && r.right <= innerWidth && b.scrollWidth <= b.clientWidth + 1, h: r.height }; }, sel);
      const a = await fit('[data-act="reroll"]');
      t.expect(a.inside, 'the re-roll button stays inside its panel: ' + JSON.stringify(a));
      await t.page.locator('[data-act="reroll"]').scrollIntoViewIfNeeded();
      await t.page.screenshot({ path: SHOTS + 'S4-12-reroll-label-' + t.viewport + '.png' });
      await t.game('act', 'reroll');
      await phase(t, 'choose');
      await t.game('setState', { trail: { phase: 'roll', rerolled: false, roll: null, players: [{ tickets: 9 }] } });
      await landOn(t, (await t.state()).board.types.indexOf('cat'));
      await phase(t, 'question');
      const life = await text(t, '[data-act="lifeline"]');
      t.expect(/^Ask the bellhop · 50\/50 · 2 tickets/.test(life), '50/50 button: ' + life);
      const b = await fit('[data-act="lifeline"]');
      t.expect(b.inside, 'the 50/50 button stays inside its card: ' + JSON.stringify(b));
      await t.waitForStable(8000);
      await t.page.locator('[data-act="lifeline"]').scrollIntoViewIfNeeded();
      await t.page.screenshot({ path: SHOTS + 'S4-12-lifeline-label-' + t.viewport + '.png' });
      t.expect(await t.game('act', 'lifeline'), 'the button still buys the 50/50');
      t.equal((await t.state()).question.removed.length, 2, 'two wrong answers struck out');
    },
  },
  {
    name: 'S4-12 Help names the bellhop and the steam beside the old words',
    viewports: ['desktop'],
    async run(t) {
      await t.game('scene', 'help');
      const h = await text(t, '#scene-help');
      t.expect(/50\/50 from the bellhop \(2\)/.test(h) && /re-roll to let the steam settle \(1, then 2, 3 and 4/.test(h), 'help words');
    },
  },


];
