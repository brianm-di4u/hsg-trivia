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
  // ---------------- C4-17 ----------------
  {
    name: 'C4-17 the opening line of a trip does not say the goal a third time: it is on the banner, the standing line and the first tip only',
    async run(t) {
      await t.seed(7);
      await t.game('setState', { settings: { passScreen: false, aiSpeed: 'fast', timer: 0, seenCoach: false } });
      await t.game('scene', 'setup');
      await t.waitForStable(8000);
      await t.game('act', 'ui', 'start-trail');
      await waitFor(t, (s) => s.scene === 'game', 4000, 'game');
      await t.game('act', 'stopAI');
      await t.page.waitForFunction(() => document.querySelector('#toast').classList.contains('on'), null, { timeout: 4000 }).catch(() => t.fail('no departure card'));
      await t.page.waitForFunction(() => document.querySelector('.coach'), null, { timeout: 4000 }).catch(() => t.fail('no first tip'));
      const v = await t.page.evaluate(() => {
        const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
        const goal = /6 stamps/;
        const lines = [['banner', document.querySelector('#toast')], ['standing line', document.querySelector('.objective')], ['tip', document.querySelector('.coach')], ['last line', document.querySelector('.lastline')], ...[...document.querySelectorAll('.log li')].map((e) => ['log', e])];
        return lines.filter(([, e]) => vis(e) && goal.test(e.textContent)).map(([n]) => n);
      });
      t.equal(JSON.stringify(v), JSON.stringify(['banner', 'standing line', 'tip']), 'where the goal shows: ' + v);
      const s = await t.state();
      t.equal(s.trail.log[s.trail.log.length - 1], 'A new trip begins.', 'the log opens with the plain line');
      t.expect((await t.page.evaluate(() => document.querySelector('.lastline').textContent)) === 'A new trip begins.', 'the line under the header');
      await t.page.screenshot({ path: SHOTS + 'C4-17-opening-' + t.viewport + '.png' });
    },
  },
  {
    name: 'C4-17 a screen reader is still told the whole opening sentence',
    viewports: ['desktop'],
    async run(t) {
      await t.page.evaluate(() => { window.__said = []; const l = document.querySelector('#live'); new MutationObserver(() => window.__said.push(l.textContent)).observe(l, { childList: true, characterData: true, subtree: true }); });
      await t.game('newGame', { mode: 'trail', players: [H1], target: 6, seed: 7 });
      await t.page.waitForFunction(() => window.__said.some((m) => m === 'A new trip begins. Collect 6 stamps, then climb to the Mountain Tower.'), null, { timeout: 4000 }).catch(() => t.fail('the opening sentence was never announced: ' + 0));
    },
  },


];
