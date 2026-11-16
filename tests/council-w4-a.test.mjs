// Council wave 4, batch A: saves, lifecycle and robustness; controls, rules and play
// (C4-01, C4-12, C4-13, C4-14, C4-15, C4-16, S3-13, S6-11, S1-09, S5-19).
import assert from 'node:assert/strict';
import { createSaveStore, isNewerSave, dailyHistory } from '../src/js/save.js';
import { fileURLToPath } from 'node:url';
import { H1, H2, soloGame, landOn, waitFor, phase } from './helpers.mjs';

const SHOTS = fileURLToPath(new URL('../../_council/hsg-trivia/wave-4/shots/', import.meta.url));
// The harness serializes initScript with toString, so a per-case script carries its data in its own source.
const withRaw = (raw) => {
  const f = () => {};
  f.toString = () => `() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('hs-trivia-v1', ${JSON.stringify(raw)}); } }`;
  return f;
};
// A save with Daily Challenges on 2026-11-02 to 04 (three in a row), 2026-11-08 and 2026-11-09, and today 2026-11-12: a best run of 3, a current run of 1.
const DAILY_SAVE = (() => {
  const r = (right, score) => ({ score, right, marks: '1111111'.slice(0, right).padEnd(7, '0') });
  return { v: 1, settings: { sound: true, volume: 0.7, timer: 0, aiSpeed: 'normal', seenCoach: true }, best: { quick: 0, era: {} },
    daily: { last: '2026-11-12', streak: 1, results: { '2026-11-02': r(7, 700), '2026-11-03': r(5, 500), '2026-11-04': r(6, 600), '2026-11-08': r(3, 300), '2026-11-09': r(4, 400), '2026-11-12': r(7, 700) } }, trail: null };
})();
const withDate = (obj, today) => {
  const f = () => {};
  f.toString = () => `() => { window.__TEST_DATE__ = ${JSON.stringify(today)}; if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('hs-trivia-v1', ${JSON.stringify(JSON.stringify(obj))}); } }`;
  return f;
};
const NEWER = JSON.stringify({ v: 2, settings: { sound: false, volume: 0.3, timer: 15 }, best: { quick: 777, era: {} }, daily: { last: null, streak: 0, results: {} }, trail: null, future: { keep: [1, 2, 3] } });
const DAMAGED = '{"v":1,"settings":{"sound":false';
// A gamepad of the standard layout whose pressed buttons are listed in window.__pad (the same fake as tests/council-w3-f.test.mjs).
const fakePad = () => {
  window.__pad = {};
  navigator.getGamepads = () => [{ connected: true, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: !!window.__pad[i] })) }];
};
const frames = (t, n) => t.page.evaluate((k) => new Promise((ok) => { let i = 0; const f = () => (++i >= k ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const press = async (t, i) => { await t.page.evaluate((b) => { window.__pad[b] = true; }, i); await frames(t, 4); await t.page.evaluate((b) => { window.__pad[b] = false; }, i); await frames(t, 2); };
const guard = (t, ms) => t.page.evaluate((m) => { window.__TEST_KEY_GUARD_MS = m; }, ms);
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

  // ---------------- C4-14 ----------------
  // The moment is 250 ms in the game. The cases widen it to a minute so a slow machine cannot let it run out between the card and the press,
  // then take it away to show that the same press works afterwards.
  {
    name: 'C4-14 a pad button just after a question appears does not answer it; a later one does',
    viewports: ['desktop'],
    initScript: fakePad,
    async run(t) {
      await soloGame(t, { seed: 9 });
      const s0 = await t.state();
      await guard(t, 60000);
      await landOn(t, s0.board.types.indexOf('cat'));
      await phase(t, 'question');
      await press(t, 0);
      t.equal((await t.state()).question.chosen, null, 'A within the moment answered nothing');
      await press(t, 2);
      t.equal((await t.state()).question.chosen, null, 'neither did X');
      await guard(t, 0);
      await press(t, 2);
      t.equal((await t.state()).question.chosen, 2, 'a later X answers C');
    },
  },
  {
    name: 'C4-14 a second A just after the list of places appears does not pick the first place; a later one does',
    viewports: ['desktop'],
    initScript: fakePad,
    async run(t) {
      await soloGame(t, { seed: 9 });
      await t.game('act', 'roll', 6);
      await phase(t, 'choose');
      await guard(t, 60000);
      await t.page.evaluate(() => document.querySelector('.dest').focus()); // a focused button is clicked by A directly, not through the key path
      await press(t, 0);
      t.equal((await t.state()).trail.phase, 'choose', 'the list is still open');
      await guard(t, 0);
      await press(t, 0);
      await waitFor(t, (x) => x.trail.phase !== 'choose', 3000, 'the later A to pick');
    },
  },

  // ---------------- S3-13 ----------------
  node('S3-13 the Daily history: best run, accuracy and the last 28 days come from the dated results', () => {
    const h = dailyHistory(DAILY_SAVE.daily, '2026-11-12');
    assert.equal(h.best, 3, 'the longest run of consecutive days'); assert.equal(h.played, 6);
    assert.equal(h.right, 7 + 5 + 6 + 3 + 4 + 7); assert.equal(h.total, 42);
    assert.equal(h.calendar.length, 28); assert.equal(h.calendar[27].date, '2026-11-12', 'today is last'); assert.equal(h.calendar[0].date, '2026-10-16', 'oldest first, 28 days');
    assert.deepEqual(h.calendar.find((c) => c.date === '2026-11-03'), { date: '2026-11-03', right: 5, total: 7 });
    assert.equal(h.calendar.find((c) => c.date === '2026-11-05').total, null, 'a day not played');
    const none = dailyHistory({ last: null, streak: 0, results: {} }, '2026-11-12'); assert.deepEqual([none.best, none.played, none.total], [0, 0, 0]);
    assert.equal(dailyHistory(undefined, '2026-11-12').calendar.length, 28, 'a missing daily record still draws an empty month');
    assert.equal(dailyHistory({ results: { '2026-11-02': 'x', 'junk': { right: 3 }, '2026-11-03': { right: 99, marks: '101' } } }, '2026-11-12').right, 3, 'damaged rows are skipped or clamped to their marks');
  }),
  {
    name: 'S3-13 the Trail record shows the best Daily streak, accuracy and a 28-day calendar',
    initScript: withDate(DAILY_SAVE, '2026-11-12'),
    async run(t) {
      await t.game('scene', 'record');
      await t.waitForStable(8000);
      const cal = await t.page.evaluate(() => [...document.querySelectorAll('.daily-cal li')].map((li) => ({ on: li.classList.contains('on'), today: li.classList.contains('today'), label: li.getAttribute('aria-label') })));
      t.equal(cal.length, 28, 'four weeks of days'); t.equal(cal.filter((c) => c.on).length, 6, 'six days played');
      t.expect(cal[27].today && cal[27].on, 'today is last and marked'); t.equal(cal[27].label, 'Nov 12: 7 of 7 right'); t.equal(cal[0].label, 'Oct 16: not played');
      const text = await t.page.evaluate(() => document.querySelector('.record-card').innerText);
      t.expect(/Best Daily streak\s*3/.test(text), 'best streak 3'); t.expect(/Daily Challenge streak\s*1/.test(text), 'current streak 1'); t.expect(/Daily answers right\s*76%/.test(text), 'accuracy 32 of 42');
      await t.page.evaluate(() => document.querySelector('.daily-cal').scrollIntoView({ block: 'center' }));
      await t.checkLayout({ allowScrollY: true });
      const box = await t.page.evaluate(() => { const r = document.querySelector('.daily-cal').getBoundingClientRect(); return { l: r.left, r: r.right, vw: innerWidth, minH: Math.min(...[...document.querySelectorAll('.daily-cal li')].map((li) => li.getBoundingClientRect().height)) }; });
      t.expect(box.l >= 0 && box.r <= box.vw, 'the calendar fits the width'); t.expect(box.minH >= 40, 'cells are tall enough to read: ' + box.minH);
      await t.page.screenshot({ path: SHOTS + 'S3-13-daily-calendar-' + t.viewport + '.png' });
    },
  },
  {
    name: 'S3-13 a save with no Daily results draws an empty calendar and no accuracy',
    viewports: ['desktop'],
    async run(t) {
      await t.game('scene', 'record');
      await t.waitForStable(8000);
      t.equal(await t.page.locator('.daily-cal li.on').count(), 0, 'nothing played');
      t.expect(/Daily answers right\s*—/.test(await t.page.evaluate(() => document.querySelector('.record-card').innerText)), 'a dash for accuracy');
    },
  },
];
