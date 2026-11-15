// Council wave 3, batch A: saves, lifecycle and robustness (S1-05, S1-06, S2-09, S3-06, S3-20, S4-02, S5-18).
import assert from 'node:assert/strict';
import { H1, soloGame, landOn, waitFor, phase } from './helpers.mjs';
import { createSaveStore, SEEN_MAX } from '../src/js/save.js';
import { applyIntent, cleanRecord, freshRecord, JOURNAL_KEYS } from '../src/js/record.js';

const KEY = 'hs-trivia-v1';
const stored = (t) => t.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const text = (t, sel) => t.page.locator(sel).first().innerText();
// The harness serializes initScript with toString, so a per-case script carries its data in its own source.
const withSave = (obj) => {
  const f = () => {};
  f.toString = () => `() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('hs-trivia-v1', JSON.stringify(${JSON.stringify(obj)})); } }`;
  return f;
};
const VETERAN = { v: 1, settings: { sound: true, volume: 0.7, timer: 0, aiSpeed: 'normal', seenCoach: true }, best: { quick: 55, era: {} }, daily: { last: null, streak: 0, results: {} }, trail: null };
const ids = (n, from = 0) => Array.from({ length: n }, (_, i) => 'hs-' + String(from + i).padStart(4, '0'));
// A game whose first seat is an AI at normal speed, so its first roll is 800 ms away.
const aiFirst = async (t) => {
  await t.seed(7);
  await t.game('setState', { settings: { passScreen: false, aiSpeed: 'normal', timer: 0, seenCoach: true } });
  await t.game('newGame', { mode: 'trail', players: [{ kind: 'ai', level: 'medium' }, H1], target: 6, seed: 7 });
};
const memStore = (value) => {
  let raw = value === null ? null : JSON.stringify(value);
  return { read: () => (raw === null ? null : JSON.parse(raw)), storage: () => ({ getItem: () => raw, setItem: (k, v) => { if (!k.endsWith('.bad')) raw = v; } }) };
};
// A solo human is sent to a Grand Jury sit-out: the next turn is a 'skipped' one. Returns the state once on the board, before the turn ends.
const readyToSit = async (t) => {
  const s0 = await t.state();
  await t.game('setState', { trail: { players: [{ skip: true }] } });
  await landOn(t, s0.board.types.indexOf('postcard'));
  await phase(t, 'postcard');
};

export const tests = [
  // ---------------- S1-05 ----------------
  {
    name: 'S1-05 the AI waits while the Passport is open and carries on when it closes',
    viewports: ['desktop'],
    async run(t) {
      await aiFirst(t);
      await t.game('act', 'ui', 'passport');
      await t.page.waitForTimeout(2200); // the first roll is 800 ms away at this pace; a slower machine only makes this check gentler
      let s = await t.state();
      t.equal(s.trail.phase, 'roll', 'the AI did not roll behind the Passport');
      await t.game('act', 'ui', 'close-modal');
      s = await waitFor(t, (x) => x.trail.phase !== 'roll', 5000, 'the AI to roll once the Passport is closed');
      t.expect(s.trail.roll !== null, 'the AI rolled after the Passport closed');
    },
  },
];
