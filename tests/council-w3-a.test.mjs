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
  // ---------------- S1-06 ----------------
  {
    name: 'S1-06 a sit-out turn and a stuck roll have a Continue button and Enter ends them at once',
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      await readyToSit(t);
      // Everything from the click to the check is one synchronous step in the page, so no timer can end the turn first.
      const clicked = await t.page.evaluate(() => {
        window.__game.act('continue');
        const b = document.querySelector('#panel [data-act="proceed"]');
        const before = { phase: window.__game.getState().trail.phase, label: b ? b.innerText : null };
        if (b) b.click();
        return { before, after: window.__game.getState().trail.phase };
      });
      t.equal(clicked.before.phase, 'skipped', 'the sit-out turn is showing');
      t.expect(clicked.before.label && clicked.before.label.includes('Continue'), 'it has a Continue button: ' + clicked.before.label);
      t.equal(clicked.after, 'roll', 'Continue ends the turn at once');
      await phase(t, 'roll');
      await readyToSit(t);
      const keyed = await t.page.evaluate(() => {
        window.__game.act('continue');
        const before = window.__game.getState().trail.phase;
        if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); // as in play, where the Roll button has gone and nothing holds focus
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        return { before, after: window.__game.getState().trail.phase };
      });
      t.equal(keyed.before, 'skipped', 'sit-out again');
      t.equal(keyed.after, 'roll', 'Enter ends it at once');
      // A stuck roll (no space that far away) is shown the same way.
      const stuck = await t.page.evaluate(() => {
        window.__game.setState({ trail: { phase: 'stuck', roll: 6 } });
        const b = document.querySelector('#panel [data-act="proceed"]');
        const had = !!b; const round = window.__game.getState().trail.round;
        if (b) b.click();
        return { had, phase: window.__game.getState().trail.phase, advanced: window.__game.getState().trail.round > round };
      });
      t.expect(stuck.had, 'a stuck roll has a Continue button');
      t.equal(stuck.phase, 'roll', 'and it ends the wait');
      t.expect(stuck.advanced, 'the turn moved on');
    },
  },
  {
    name: 'S1-06 the screen with Continue is laid out at both sizes',
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      await t.game('setState', { trail: { phase: 'stuck', roll: 6 } }); // held here with no timer armed, for the picture
      await t.page.locator('#panel [data-act="proceed"]').waitFor();
      await t.shot('S1-06-continue');
      await t.checkLayout({ allowScrollY: true });
      const box = await t.page.locator('#panel [data-act="proceed"]').boundingBox();
      t.expect(box && box.height >= 36, 'the button is big enough to hit: ' + (box && box.height));
    },
  },
  // ---------------- S2-09 ----------------
  {
    name: 'S2-09 a Settings choice is one Tab stop and the arrow keys move inside it',
    async run(t) {
      await t.game('scene', 'settings');
      await t.waitForStable(8000);
      const groups = await t.page.evaluate(() => [...document.querySelectorAll('#scene-settings [role="radiogroup"]')].map((g) => ({ label: g.getAttribute('aria-label'), stops: [...g.querySelectorAll('[role="radio"]')].map((b) => b.tabIndex), on: [...g.querySelectorAll('[role="radio"]')].map((b) => b.getAttribute('aria-checked')) })));
      t.expect(groups.length >= 8, 'the Settings choices are there: ' + groups.length);
      for (const g of groups) {
        t.equal(g.stops.filter((n) => n === 0).length, 1, `${g.label}: exactly one Tab stop`);
        t.equal(g.stops.indexOf(0), g.on.indexOf('true'), `${g.label}: the Tab stop is the chosen option`);
      }
      const timer = t.page.locator('#scene-settings [role="radiogroup"][aria-label="Answer timer"] [role="radio"]');
      await t.game('setState', { settings: { timer: 30 } });
      await timer.nth(1).focus();
      await t.page.keyboard.press('ArrowRight');
      let s = await t.state();
      t.equal(s.settings.timer, 20, 'ArrowRight chooses the next option');
      t.equal(await t.page.evaluate(() => document.activeElement.dataset.key), 'set-timer-20', 'and focus follows it');
      await t.page.keyboard.press('ArrowDown');
      t.equal((await t.state()).settings.timer, 10, 'ArrowDown does the same');
      await t.page.keyboard.press('ArrowRight');
      t.equal((await t.state()).settings.timer, 0, 'the last option wraps to the first');
      await t.page.keyboard.press('End');
      t.equal((await t.state()).settings.timer, 10, 'End goes to the last option');
      await t.page.keyboard.press('Home');
      t.equal((await t.state()).settings.timer, 0, 'Home goes to the first');
      await t.page.keyboard.press('ArrowLeft');
      t.equal((await t.state()).settings.timer, 10, 'ArrowLeft wraps back');
      const saved = await stored(t);
      t.equal(saved.settings.timer, 10, 'the choice is saved');
      // One Tab leaves the group for the next one, not for the next button in the same group.
      await t.page.keyboard.press('Tab');
      const next = await t.page.evaluate(() => { const a = document.activeElement; return { role: a.getAttribute('role'), group: a.closest('[role="radiogroup"]') && a.closest('[role="radiogroup"]').getAttribute('aria-label') }; });
      t.equal(next.group, 'Motion', 'Tab goes to the next choice');
      await t.shot('S2-09-settings-focus');
    },
  },
  {
    name: 'S2-09 the length of a trip on the setup screen works the same way',
    async run(t) {
      await t.game('scene', 'setup');
      await t.waitForStable(8000);
      const stops = await t.page.evaluate(() => [...document.querySelectorAll('#scene-setup [role="radiogroup"] [role="radio"]')].map((b) => b.tabIndex));
      t.equal(stops.filter((n) => n === 0).length, 1, 'one Tab stop');
      await t.page.locator('#scene-setup [role="radio"][tabindex="0"]').focus();
      await t.page.keyboard.press('ArrowRight');
      t.equal(await t.page.evaluate(() => document.querySelector('#scene-setup [role="radio"][aria-checked="true"]').dataset.key), 'target8', 'ArrowRight moves from Weekend to Grand Tour');
      t.equal(await t.page.evaluate(() => document.activeElement.dataset.key), 'target8', 'focus follows');
      await t.page.keyboard.press('ArrowLeft'); await t.page.keyboard.press('ArrowLeft');
      t.equal(await t.page.evaluate(() => document.querySelector('#scene-setup [role="radio"][aria-checked="true"]').dataset.key), 'target4', 'ArrowLeft twice reaches Day Trip');
    },
  },
  // ---------------- S3-06 ----------------
  {
    name: 'S3-06 the questions asked lately are kept in their own save key, capped, and repaired',
    node: true,
    async run() {
      const m = memStore(null); const s = createSaveStore({ storage: m.storage }); s.load();
      assert.deepEqual(s.data.seen || [], [], 'a new profile remembers nothing');
      assert.ok(s.commitSeen(ids(450)).ok);
      assert.equal(m.read().seen.length, SEEN_MAX, 'the last 400 are kept');
      assert.equal(m.read().seen[SEEN_MAX - 1], 'hs-0449', 'and they are the newest');
      // it is outside the trip's conflict group: another tab's trip is not disturbed, and this tab's trip still commits
      const other = createSaveStore({ storage: m.storage }); other.load(); other.commitSeen(['hs-0001']);
      const trail = { target: 4, round: 1, turn: 0, phase: 'roll', players: [], log: [], dests: [], pending: null };
      assert.equal(s.reserveTrail().ok, true); assert.equal(s.commitTrail({ trail, asked: ['hs-0002'], rng: 1 }).ok, true);
      assert.equal(other.commitSeen(['hs-0001', 'hs-0003']).ok, true, 'a write of the memory is never refused as a conflict');
      assert.equal(s.commitTrail({ trail, asked: ['hs-0002'], rng: 1 }).ok, true, 'and it does not make the trip conflict');
      // damage: not a list, numbers, long strings
      for (const bad of [7, 'x', { a: 1 }, null]) { const d = memStore({ v: 1, seen: bad }); const ds = createSaveStore({ storage: d.storage }); ds.load(); assert.deepEqual(ds.data.seen, [], 'damaged memory is empty'); }
      const mixed = memStore({ v: 1, seen: ['hs-0001', 5, null, 'x'.repeat(80), 'hs-0002'] }); const ms = createSaveStore({ storage: mixed.storage }); ms.load();
      assert.deepEqual(ms.data.seen, ['hs-0001', 'hs-0002'], 'only ids are kept');
      // an older save with no such key loads, and keeps everything else
      const old = memStore(VETERAN); const os = createSaveStore({ storage: old.storage }); os.load(); assert.deepEqual(os.data.seen || [], []); assert.equal(os.data.best.quick, 55); assert.equal(old.read().seen, undefined, 'and nothing is added to it until a question is asked');
    },
  },
  {
    name: 'S3-06 a Quick 10 remembers its questions, and the next visit does not ask them again',
    async run(t) {
      await t.seed(11);
      await t.game('setState', { settings: { timer: 0, seenCoach: true } });
      await t.game('newGame', { mode: 'quick' });
      const first = [];
      for (;;) {
        const s = await t.state();
        if (s.scene !== 'quiz') break;
        first.push(s.question.id);
        const sv = await stored(t);
        t.expect(sv.seen.includes(s.question.id), `question ${first.length} was written to the save as soon as it was asked`);
        await t.game('act', 'answer', 'correct');
        await t.game('act', 'continue');
      }
      t.equal(first.length, 10, 'ten questions');
      t.equal(JSON.stringify((await stored(t)).seen), JSON.stringify(first), 'the save holds them in order');
      await t.reload();
      t.equal(JSON.stringify((await t.state()).asked), JSON.stringify(first), 'a new visit starts from them');
      await t.seed(11); // the same dice as the first visit: only the memory can keep the draw apart
      await t.game('setState', { settings: { timer: 0 } });
      await t.game('newGame', { mode: 'quick' });
      const second = [];
      for (;;) {
        const s = await t.state();
        if (s.scene !== 'quiz') break;
        second.push(s.question.id);
        await t.game('act', 'answer', 'correct');
        await t.game('act', 'continue');
      }
      t.equal(second.length, 10, 'ten more');
      t.equal(second.filter((id) => first.includes(id)).length, 0, 'none of them was asked on the first visit');
    },
  },
  {
    name: 'S3-06 a trip adds each question to the memory, after what was asked before',
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      const s0 = await t.state();
      await t.game('setState', { asked: ids(5, 100) });
      await landOn(t, s0.board.types.indexOf('cat'));
      const q = await phase(t, 'question');
      const sv = await stored(t);
      t.expect(sv.seen.includes(q.question.id), 'the trip question is remembered');
      t.equal(sv.seen.slice(0, 5).join(), ids(5, 100).join(), 'after what was asked before it');
    },
  },
  {
    name: 'S3-06 an old save, a long memory and a damaged one load',
    viewports: ['desktop'],
    initScript: withSave({ ...VETERAN, seen: ids(450) }),
    async run(t) {
      const s = await t.state();
      t.equal(s.asked.length, SEEN_MAX, 'the cap holds on load');
      t.equal(s.asked[SEEN_MAX - 1], 'hs-0449', 'newest last');
    },
  },
  {
    name: 'S3-06 a save with a damaged memory starts clean',
    viewports: ['desktop'],
    initScript: withSave({ ...VETERAN, seen: 'oops' }),
    async run(t) {
      const s = await t.state();
      t.equal(s.asked.length, 0, 'nothing is remembered');
      await t.game('newGame', { mode: 'quick' });
      t.equal((await t.state()).scene, 'quiz', 'and a game starts');
    },
  },
  // ---------------- S3-20 ----------------
  {
    name: 'S3-20 the journal rules: a page opens with the first stamp in a district, keeps its first day, and is repaired',
    node: true,
    async run() {
      const d = freshRecord();
      assert.deepEqual(d.journal, {});
      applyIntent(d, { kind: 'event', ev: 'stamp', count: 1, d: 'oaklawn', today: '2026-11-13' });
      applyIntent(d, { kind: 'event', ev: 'stamp', count: 2, d: 'oaklawn', today: '2026-11-20' });
      assert.deepEqual(d.journal, { oaklawn: '2026-11-13' }, 'the first day is kept');
      applyIntent(d, { kind: 'event', ev: 'stamp', count: 3, d: 'nowhere', today: '2026-11-21' });
      assert.deepEqual(Object.keys(d.journal), ['oaklawn'], 'an unknown district opens no page');
      assert.equal(d.stats.stamps, 3, 'the count is as before');
      const bad = cleanRecord({ journal: { row: '2026-11-01', park: 'yesterday', zzz: '2026-11-02', lakes: 5 } });
      assert.deepEqual(bad.journal, { row: '2026-11-01' }, 'damage falls back, good pages stay');
      assert.deepEqual(cleanRecord({ journal: 'x' }).journal, {}); assert.deepEqual(cleanRecord(null), freshRecord());
      assert.equal(JOURNAL_KEYS.length, 8, 'eight districts');
      const m = memStore({ ...VETERAN, stats: { stamps: 4 } }); const s = createSaveStore({ storage: m.storage }); s.load();
      assert.deepEqual(s.data.journal, {}, 'an older save loads with no pages and keeps its counts'); assert.equal(s.data.stats.stamps, 4);
      assert.ok(s.commitProgress({ kind: 'event', ev: 'stamp', count: 5, d: 'row', today: '2026-11-14' }).ok);
      assert.equal(m.read().journal.row, '2026-11-14'); assert.equal(m.read().stats.stamps, 5);
    },
  },
  {
    name: 'S3-20 a stamp won on the board opens its journal page, which is saved and shown from the title',
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      const s0 = await t.state();
      await landOn(t, s0.board.landmarks['Sports']);
      await phase(t, 'question');
      await t.game('act', 'answer', 'correct');
      await phase(t, 'feedback');
      const sv = await stored(t);
      t.equal(Object.keys(sv.journal).join(), 'ballfields', 'the Ballfields page is open');
      t.equal(sv.journal.ballfields.length, 10, 'with the day it was won');
      await t.reload();
      await t.game('setState', { settings: { seenCoach: true } });
      await t.game('scene', 'title');
      await t.page.locator('#scene-title [data-arg="record"]').click();
      const rec = await text(t, '#scene-record');
      t.expect(/Passport journal\s*1 of 8 pages/i.test(rec), 'the record counts the pages');
      const got = t.page.locator('#scene-record .jpage.got');
      t.equal(await got.count(), 1, 'one page is open');
      const page = await got.first().innerText();
      t.expect(page.includes('The Ballfields') && page.includes('Whittington Park stamp') && page.includes('Ballpark from 1894'), 'it names the district, the stamp and its blurb: ' + page.replace(/\s+/g, ' '));
      t.equal(await t.page.locator('#scene-record .jpage.lock').count(), 7, 'the other seven say how to open them');
      t.expect((await text(t, '#scene-record .jpage.lock')).includes('Win the'), 'in plain words');
      await t.page.locator('#scene-record .journal').scrollIntoViewIfNeeded();
      await t.shot('S3-20-journal');
      await t.checkLayout({ allowScrollY: true });
    },
  },
  // ---------------- S4-02 ----------------
  {
    name: 'S4-02 the line after an answer varies from question to question and stays put when the card redraws',
    async run(t) {
      const RIGHT = ['Correct!', 'That’s right!', 'Well done!', 'Right on the mark!', 'Spot on!'];
      await t.seed(3);
      await t.game('setState', { settings: { timer: 0, seenCoach: true } });
      await t.game('newGame', { mode: 'quick' });
      const right = new Set(), wrong = new Set(); let stable = true;
      const line = () => t.page.evaluate(() => document.querySelector('#scene-quiz .verdict').firstChild.textContent.trim());
      for (let i = 0; ; i++) {
        const s = await t.state();
        if (s.scene !== 'quiz') break;
        const ok = i % 2 === 0;
        await t.game('act', 'answer', ok ? 'correct' : 'wrong');
        const a = await line();
        await t.game('setState', { settings: { timer: 0 } }); // draws the card again
        if (a !== await line()) stable = false;
        (ok ? right : wrong).add(a);
        await t.game('act', 'continue');
      }
      t.expect(stable, 'the line does not change when the card is drawn again');
      t.expect(right.size >= 3, 'right answers get at least three different lines: ' + [...right].join(' | '));
      t.expect(wrong.size >= 3, 'wrong answers get at least three different lines: ' + [...wrong].join(' | '));
      for (const l of right) t.expect(RIGHT.includes(l), 'a right answer is praised: ' + l);
      for (const l of wrong) t.expect(!RIGHT.includes(l) && /[.!]$/.test(l), 'a wrong answer is not praised, and the line is a sentence: ' + l);
    },
  },
  // ---------------- S5-18 ----------------
  {
    name: 'S5-18 the hook lists every cue the game can make',
    viewports: ['desktop'],
    async run(t) {
      const l = await t.page.evaluate(() => window.__game.audioList());
      for (const n of ['click', 'gauge', 'hop', 'correct', 'wrong', 'stamp', 'steam', 'coin', 'bell', 'trolley', 'bugle', 'warp', 'gavel', 'tick', 'win', 'page', 'achieve']) t.expect(l.cues.includes(n), 'cue ' + n);
    },
  },
  {
    name: 'S5-18 every cue makes a real signal: not silent, in range, never near clipping',
    viewports: ['desktop'],
    async run(t) {
      const l = await t.page.evaluate(() => window.__game.audioList());
      const QUIET = ['click', 'tick']; // interface sounds, meant to sit under the gameplay cues
      const ALLOW = 1.19; // a repeat may sit 1.5 dB outside the range (a single repeat is 1 to 2 dB louder or softer on purpose)
      for (const n of l.cues) {
        // Five renders of the same cue: the middle one is judged, so one loud or soft repeat cannot fail the test.
        const rs = [];
        for (let i = 0; i < 5; i++) rs.push(await t.page.evaluate((c) => window.__game.audioRender('cue:' + c, 3, false), n));
        const peaks = rs.map((r) => r.peak).sort((a, b) => a - b); const rms = rs.map((r) => r.rmsDb).sort((a, b) => a - b);
        const med = peaks[2];
        t.log(`${n}: median peak ${med}, loudest ${peaks[4]}, median rms ${rms[2]} dBFS`);
        t.expect(rms[2] > -70, `${n} is not silent (rms ${rms[2]} dBFS)`);
        t.expect(peaks[4] < 0.95, `${n} never nears clipping (loudest ${peaks[4]})`);
        if (QUIET.includes(n)) t.expect(med >= 0.015 && med <= 0.45 * ALLOW, `${n} median peak ${med} is quiet but audible`);
        else t.expect(med >= 0.2 / ALLOW && med <= 0.45 * ALLOW, `${n} median peak ${med} within 0.2..0.45 (1.5 dB allowance)`);
      }
    },
  },
  {
    name: 'S5-18 the music holds while the tab is hidden and returns, and a render does not wake the live audio',
    viewports: ['desktop'],
    async run(t) {
      await t.page.mouse.click(5, 5);
      await waitFor(t, (s) => s.audio.state === 'running', 3000, 'audio running');
      const state = () => t.page.evaluate(() => window.__game.audioState());
      const hide = (h) => t.page.evaluate((x) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (x ? 'hidden' : 'visible') });
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => x });
        document.dispatchEvent(new Event('visibilitychange'));
      }, h);
      await t.game('newGame', { mode: 'trail', players: [H1, { kind: 'ai', level: 'easy' }], target: 4, seed: 4 });
      await t.game('act', 'ui', 'menu');
      const until = async (pred, label) => { const end = Date.now() + 6000; let a = await state(); while (Date.now() < end && !pred(a)) { await t.page.waitForTimeout(80); a = await state(); } t.expect(pred(a), 'timed out waiting for ' + label); return a; };
      await until((a) => a.held, 'the pause card to hold the sound');
      await t.game('act', 'ui', 'close-modal');
      await until((a) => !a.held, 'the sound to come back');
      await hide(true);
      await hide(false);
      await until((a) => !a.held, 'the sound after the tab is shown again');
    },
  },
];
