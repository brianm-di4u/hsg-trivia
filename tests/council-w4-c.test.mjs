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
  // ---------------- C4-02 ----------------
  {
    name: 'C4-02 Help says how the art was made, in one plain line, and it fits at both sizes',
    async run(t) {
      await t.game('scene', 'help');
      await t.waitForStable(8000);
      const line = await t.page.evaluate(() => { const e = document.querySelector('#art-credit'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { text: e.textContent, l: r.left, r: r.right, vw: innerWidth, sw: document.documentElement.scrollWidth, scrollW: e.scrollWidth, cw: e.clientWidth, count: (document.querySelector('#scene-help').textContent.match(/AI image tools/g) || []).length }; });
      t.equal(line.text, 'Art: painted with AI image tools for this game.', 'the line');
      t.equal(line.count, 1, 'said once');
      t.expect(line.l >= 0 && line.r <= line.vw && line.sw <= line.vw && line.scrollW <= line.cw + 1, 'it fits: ' + JSON.stringify(line));
      await t.page.screenshot({ path: SHOTS + 'C4-02-art-credit-' + t.viewport + '.png' });
    },
  },
  node('C4-02 the line names no company or product', () => {
    const src = fs.readFileSync(REPO + 'src/js/ui.js', 'utf8');
    const m = /id="art-credit">([^<]*)</.exec(src);
    assert.ok(m, 'the line is in ui.js');
    assert.ok(!/openai|codex|chatgpt|dall|midjourney|gpt|blender/i.test(m[1]), 'no product named: ' + m[1]);
  }),


];
