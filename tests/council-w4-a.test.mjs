// Council wave 4, batch A: saves, lifecycle and robustness; controls, rules and play
// (C4-01, C4-12, C4-13, C4-14, C4-15, C4-16, S3-13, S6-11, S1-09, S5-19).
import assert from 'node:assert/strict';
import { createSaveStore, isNewerSave } from '../src/js/save.js';
import { fileURLToPath } from 'node:url';
import { H1, H2, soloGame, waitFor, phase } from './helpers.mjs';

const SHOTS = fileURLToPath(new URL('../../_council/hsg-trivia/wave-4/shots/', import.meta.url));
// The harness serializes initScript with toString, so a per-case script carries its data in its own source.
const withRaw = (raw) => {
  const f = () => {};
  f.toString = () => `() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('hs-trivia-v1', ${JSON.stringify(raw)}); } }`;
  return f;
};
const NEWER = JSON.stringify({ v: 2, settings: { sound: false, volume: 0.3, timer: 15 }, best: { quick: 777, era: {} }, daily: { last: null, streak: 0, results: {} }, trail: null, future: { keep: [1, 2, 3] } });
const DAMAGED = '{"v":1,"settings":{"sound":false';
const node = (name, run) => ({ name, node: true, run });

const memoryStorage = (raw) => { const m = { 'hs-trivia-v1': raw }; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, m }; };

export const tests = [
  // ---------------- C4-01 ----------------
  node('C4-01 a save with a higher version is left byte for byte as it is; the visit plays in memory', () => {
    const st = memoryStorage(NEWER); const s = createSaveStore({ storage: () => st }); s.load();
    assert.equal(s.newer, true); assert.equal(s.ok, true);
    assert.equal(s.updateSettings({ sound: true, volume: 0.9 }).ok, true);
    s.reserveTrail(); s.commitTrail({ trail: { turn: 1 }, asked: ['x'], rng: 5 });
    s.commitQuiz({ kind: 'quick', score: 50, right: 5, total: 10, timer: 30 });
    s.commitSeen(['a']); s.commitDailyStart('2026-11-16');
    assert.equal(st.m['hs-trivia-v1'], NEWER, 'the stored text did not change');
    assert.equal('hs-trivia-v1.bad' in st.m, false, 'nothing was set aside either');
    assert.equal(s.data.settings.volume, 0.9, 'this visit still sees its own settings');
    assert.equal(s.data.best.quick, 50, 'and its own score, in memory');
  }),
  node('C4-01 only a readable save with a higher version counts as newer', () => {
    assert.equal(isNewerSave(NEWER), true);
    assert.equal(isNewerSave('{"v":1}'), false);
    assert.equal(isNewerSave(DAMAGED), false);
    assert.equal(isNewerSave('{"settings":{}}'), false, 'no version number: nothing to compare');
    assert.equal(isNewerSave(null), false);
    assert.equal(isNewerSave('[2]'), false);
  }),
  node('C4-01 a damaged save is still set aside and replaced', () => {
    const st = memoryStorage(DAMAGED); const s = createSaveStore({ storage: () => st }); s.load();
    assert.equal(s.newer, false);
    assert.equal(s.updateSettings({ sound: true }).ok, true);
    assert.equal(st.m['hs-trivia-v1.bad'], DAMAGED); assert.equal(JSON.parse(st.m['hs-trivia-v1']).v, 1);
  }),
  {
    name: 'C4-01 in the page: a newer save survives a visit of changes and games, and the player is told',
    initScript: withRaw(NEWER),
    async run(t) {
      await waitFor(t, (s) => s.scene === 'title', 5000, 'the title');
      const note = await t.page.evaluate(() => document.querySelector('.save-warn')?.textContent || '');
      t.expect(/not being saved/.test(note) && /newer version/.test(note), 'the title says this visit is not saved: ' + note);
      await t.checkLayout();
      await t.page.evaluate(() => document.querySelector('.save-warn').scrollIntoView({ block: 'end' }));
      await t.page.screenshot({ path: SHOTS + 'C4-01-newer-save-notice-' + t.viewport + '.png' });
      await t.page.evaluate(() => { const g = window.__game; g.setState({ settings: { sound: true, volume: 0.5, timer: 0, passScreen: false } }); });
      await soloGame(t, { seed: 3 });
      await t.game('newGame', { mode: 'daily', date: '2026-11-16' });
      const raw = await t.page.evaluate(() => localStorage.getItem('hs-trivia-v1'));
      t.equal(raw, NEWER, 'the newer save is the same text after the visit');
      t.equal(await t.page.evaluate(() => localStorage.getItem('hs-trivia-v1.bad')), null, 'and no copy was made');
      await t.page.reload();
      await waitFor(t, (s) => s.scene === 'title', 5000, 'the title again');
      t.equal(await t.page.evaluate(() => localStorage.getItem('hs-trivia-v1')), NEWER, 'still the same after a reload');
    },
  },
  {
    name: 'C4-01 in the page: a damaged save is set aside as before and no newer-version notice shows',
    initScript: withRaw(DAMAGED),
    viewports: ['desktop'],
    async run(t) {
      await waitFor(t, (s) => s.scene === 'title', 5000, 'the title');
      await t.page.evaluate(() => window.__game.setState({ settings: { volume: 0.4 } }));
      t.equal(await t.page.evaluate(() => localStorage.getItem('hs-trivia-v1.bad')), DAMAGED, 'kept under .bad');
      t.expect(!/newer version/.test(await t.page.evaluate(() => document.body.innerText)), 'no newer-version notice');
    },
  },

  // ---------------- C4-12 ----------------
  // ui.listAt is when the list of places last appeared; the Enter/Space hold of S1-04 is measured from it, so every new list must restamp it.
  {
    name: 'C4-12 a second traveler on the same space rolling the same number gets the list held again',
    async run(t) {
      await soloGame(t, { seed: 5, players: [H1, H2] });
      await t.game('act', 'roll', 3);
      const first = await phase(t, 'choose');
      const a = first.ui.listAt;
      await t.game('setState', { trail: { phase: 'roll', roll: null, dests: [], turn: 1 } });
      await t.game('act', 'roll', 3);
      const second = await phase(t, 'choose');
      t.equal(second.trail.turn, 1, 'the second traveler');
      t.equal(second.trail.dests.join(), first.trail.dests.join(), 'the very same list of places');
      t.expect(second.ui.listAt > a, 'the hold was stamped again: ' + a + ' then ' + second.ui.listAt);
    },
  },
  {
    name: 'C4-12 a re-roll (which rolls at once, with no other phase between) holds its new list',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t, { seed: 5 });
      await t.game('act', 'roll', 3);
      const first = await phase(t, 'choose');
      await t.game('act', 'reroll');
      const second = await waitFor(t, (x) => x.trail.phase === 'choose' && x.trail.rerolled, 4000, 'the re-rolled list');
      t.expect(second.ui.listAt > first.ui.listAt, 'the hold was stamped again, even if the number came up the same');
    },
  },
];
