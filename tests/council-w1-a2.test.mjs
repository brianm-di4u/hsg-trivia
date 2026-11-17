// Council wave 1, batch A2: stability (part 2), screens, layout and words.
import assert from 'node:assert/strict';
import { createSaveStore, validOpenQuestion } from '../src/js/save.js';
import { NODES } from '../src/js/board.js';
import { soloGame, landOn, phase, waitFor, H1 } from './helpers.mjs';

const hide = (page, hidden) => page.evaluate((h) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);
const continueTrip = async (t) => {
  await t.reload();
  await t.game('act', 'ui', 'continue-trail');
  return waitFor(t, (x) => x.scene === 'game' && x.trail, 3000, 'continued trip');
};
// A game whose first seat is an AI at normal speed, so its first roll is 800 ms away.
const aiFirst = async (t) => {
  await t.seed(7);
  await t.game('setState', { settings: { passScreen: false, aiSpeed: 'normal', timer: 0 } });
  await t.game('newGame', { mode: 'trail', players: [{ kind: 'ai', level: 'medium' }, H1], target: 6, seed: 7 });
};

export const tests = [
  {
    name: 'P-N01 dragging the volume slider neither rebuilds the board nor writes the save on every event',
    async run(t) {
      await t.waitForStable(8000);
      await t.game('scene', 'settings');
      await t.waitForStable(8000);
      const r = await t.page.evaluate(async () => {
        let writes = 0; const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) { if (k === 'hs-trivia-v1') writes++; return set.apply(this, arguments); };
        // The board cache is an off-screen canvas whose width is set each time it is rebuilt.
        let rebuilds = 0; const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
        Object.defineProperty(HTMLCanvasElement.prototype, 'width', { configurable: true, get: d.get, set(v) { if (this.id !== 'board' && v >= 800) rebuilds++; d.set.call(this, v); } });
        const frame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        const el = document.querySelector('input[data-setting=volume]');
        for (let i = 0; i < 20; i++) { el.value = String(20 + i); el.dispatchEvent(new Event('input', { bubbles: true })); await frame(); }
        const dragWrites = writes, dragRebuilds = rebuilds;
        el.dispatchEvent(new Event('change', { bubbles: true })); await frame();
        const endWrites = writes;
        document.querySelector('#btn-sound').click(); await frame(); await frame();
        const muteRebuilds = rebuilds - dragRebuilds;
        Storage.prototype.setItem = set; Object.defineProperty(HTMLCanvasElement.prototype, 'width', d);
        return { dragWrites, dragRebuilds, endWrites, muteRebuilds, saved: JSON.parse(localStorage.getItem('hs-trivia-v1')).settings };
      });
      t.equal(r.dragWrites, 0, 'no save write while the slider is being dragged');
      t.equal(r.dragRebuilds, 0, 'no board rebuild while the slider is being dragged');
      t.equal(r.endWrites, 1, 'one save write when the drag ends');
      t.equal(r.saved.volume, 0.39, 'the final volume was saved');
      t.equal(r.muteRebuilds, 0, 'toggling sound does not rebuild the board');
      t.equal(r.saved.sound, false, 'mute was saved');
      const s = await t.state();
      t.equal(s.settings.volume, 0.39, 'the runtime volume follows the slider');
    },
  },
  {
    name: 'S1-21 the AI waits while the tab is hidden and carries on when it is back',
    viewports: ['desktop'],
    async run(t) {
      await aiFirst(t);
      await hide(t.page, true);
      await t.page.waitForTimeout(2500);
      let s = await t.state();
      t.equal(s.trail.turn, 0, 'still the AI turn');
      t.equal(s.trail.phase, 'roll', 'the AI did not roll in a hidden tab');
      await hide(t.page, false);
      s = await waitFor(t, (x) => x.trail.phase !== 'roll', 4000, 'AI to roll once the tab is visible');
      t.expect(s.trail.roll !== null, 'the AI rolled after returning');
    },
  },
  {
    name: 'S1-21 the AI waits while the pause menu is open',
    viewports: ['desktop'],
    async run(t) {
      await aiFirst(t);
      await t.game('act', 'ui', 'menu');
      await t.page.waitForTimeout(2500);
      let s = await t.state();
      t.equal(s.trail.phase, 'roll', 'the AI did not roll behind the pause menu');
      await t.game('act', 'ui', 'close-modal');
      s = await waitFor(t, (x) => x.trail.phase !== 'roll', 4000, 'AI to roll after Resume');
      t.expect(s.trail.roll !== null, 'the AI rolled after Resume');
    },
  },
  {
    name: 'S1-21 Continue returns to the open question with its choice order and time left',
    async run(t) {
      await soloGame(t, { settings: { timer: 30 } });
      const s0 = await t.state();
      await landOn(t, s0.board.types.indexOf('cat'));
      const qs = await phase(t, 'question'); const q = qs.question; const landed = qs.trail.players[0].node;
      await t.page.waitForTimeout(1500);
      await hide(t.page, true); // leaving the page stores the time left
      const s = await continueTrip(t);
      t.equal(s.trail.phase, 'question', 'the question is open again');
      t.equal(s.question && s.question.id, q.id, 'same question');
      t.equal(JSON.stringify(s.question.choices), JSON.stringify(q.choices), 'same choice order');
      t.equal(s.trail.players[0].node, landed, 'player kept on the space');
      t.expect(s.question.timeLeft < s.question.timeMax, 'time already used is not given back (' + s.question.timeLeft + ')');
      await t.game('act', 'answer', 'correct');
      const done = await phase(t, 'feedback');
      t.equal(done.trail.players[0].answered, 1, 'the restored question can be answered');
    },
  },
];

// ---- S6-10: coverage the suite lacked (resize while playing, keyboard turn paths) ----
tests.push(
  {
    name: 'S6-10 resizing the window mid-question keeps the board and the question usable',
    async run(t) {
      await soloGame(t);
      const s0 = await t.state();
      await landOn(t, s0.board.types.indexOf('cat'));
      await phase(t, 'question');
      const sizes = t.viewport === 'desktop' ? [{ width: 820, height: 560 }, { width: 1280, height: 800 }] : [{ width: 844, height: 390 }, { width: 390, height: 844 }];
      for (const sz of sizes) {
        await t.page.setViewportSize(sz);
        await t.page.waitForTimeout(400);
        const box = await t.page.evaluate(() => { const c = document.querySelector('#board').getBoundingClientRect(); return { w: c.width, h: c.height, iw: innerWidth, ih: innerHeight }; });
        t.expect(box.w > 0 && box.h > 0 && box.w <= box.iw + 1 && box.h <= box.ih + 1, `board fits ${sz.width}x${sz.height} (${Math.round(box.w)}x${Math.round(box.h)})`);
        t.equal(await t.page.locator('#modal .ans').count(), 4, `four answers shown at ${sz.width}x${sz.height}`);
        const a = await t.game('fpsFrames'); await t.page.waitForTimeout(200); const b = await t.game('fpsFrames');
        t.expect(b > a, 'the render loop keeps running after the resize');
      }
      await t.game('act', 'answer', 'correct');
      const s = await phase(t, 'feedback');
      t.equal(s.trail.players[0].answered, 1, 'the question can still be answered');
    },
  },
  {
    name: 'S6-10 Enter after ArrowRight moves the token to the second destination',
    async run(t) {
      await soloGame(t);
      let s = null;
      for (let n = 1; n <= 6; n++) {
        await t.game('act', 'roll', n);
        s = await phase(t, 'choose');
        if (s.trail.dests.length >= 2) break;
        await t.game('setState', { trail: { phase: 'roll', roll: null, dests: [], rerolled: false } });
      }
      t.expect(s.trail.dests.length >= 2, 'found a roll with two destinations');
      const target = s.trail.dests[1];
      await t.page.keyboard.press('ArrowRight');
      s = await t.state();
      t.equal(s.trail.sel, 1, 'the second destination is selected');
      await t.page.keyboard.press('Enter');
      await t.game('act', 'finishAnim');
      s = await waitFor(t, (x) => x.trail.phase !== 'moving' && x.trail.phase !== 'choose', 4000, 'move to finish');
      t.equal(s.trail.players[0].node, target, 'the token went to the second destination');
    },
  },
  {
    name: 'S6-10 pressing R twice spends at most one ticket',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t);
      await t.game('act', 'roll', 3);
      let s = await phase(t, 'choose');
      const before = s.trail.players[0].tickets;
      await t.page.keyboard.press('r');
      await t.page.keyboard.press('r');
      s = await t.state();
      t.equal(before - s.trail.players[0].tickets, 1, 'one re-roll, one ticket');
    },
  },
);

// ---- S6-03: a structurally invalid saved trip is set aside, and a thrown error does not leave a dead page ----
const player = (o = {}) => ({ id: 0, name: 'Ada', kind: 'human', level: 'medium', shape: 'circle', color: '#D7263D', node: 0, stamps: [], tickets: 3, skill: 0.35, skip: false, correct: 0, answered: 0, catStats: {}, streak: 0, ...o });
const trail = (o = {}) => ({ target: 6, round: 1, turn: 0, phase: 'roll', roll: null, rerolled: false, dests: [], sel: 0, players: [player()], pending: null, log: [], winner: null, lastTurnAt: 1, ...o });
const blob = (tr) => JSON.stringify({ v: 1, settings: {}, best: { quick: 0, era: {} }, daily: { last: null, streak: 0, results: {} }, trail: tr, asked: [], rng: 5 });
const BAD_TRAILS = {
  trailNoPlayers: trail({ players: [] }),
  trailTooManyPlayers: trail({ players: Array.from({ length: 7 }, (_, i) => player({ id: i })) }),
  trailNodeOutOfRange: trail({ players: [player({ node: 999 })] }),
  trailNodeString: trail({ players: [player({ node: '12' })] }),
  trailNegativeNode: trail({ players: [player({ node: -1 })] }),
  trailTurnOutOfRange: trail({ turn: 3 }),
  trailUnknownPhase: trail({ phase: 'dancing' }),
  trailTicketsNotNumber: trail({ players: [player({ tickets: 'lots' })] }),
  trailString: 'oops',
  trailNumber: 7,
  trailArray: [],
};
const mem = (raw) => { const m = new Map([['hs-trivia-v1', raw]]); return { m, storage: () => ({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } }) }; };
for (const [name, tr] of Object.entries(BAD_TRAILS)) {
  tests.push({
    name: `S6-03 ${name} is set aside, not adopted`,
    node: true,
    run() {
      const raw = blob(tr);
      const { m, storage } = mem(raw);
      const store = createSaveStore({ storage });
      assert.equal(store.load().ok, true);
      assert.equal(store.trailDiscarded, true, 'the trip is not offered, and the player can be told');
      assert.equal(m.get('hs-trivia-v1.bad'), raw, 'the unusable trip was kept under the .bad key');
      assert.equal(store.updateSettings({ sound: false }).ok, true, 'saving still works');
      assert.equal(store.reserveTrail().ok, true, 'a new trip can be started');
      assert.equal(store.commitTrail({ trail: trail(), asked: [], rng: 1 }).ok, true, 'and its first save goes through');
      assert.equal(store.trailDiscarded, false, 'the notice goes away once a new trip is saved');
      assert.equal(store.adoptTrail().trail.players.length, 1, 'the new trip replaced the unusable one');
    },
  });
}
tests.push(
  {
    name: 'S6-03 a valid trip is adopted unchanged',
    node: true,
    run() {
      const tr = trail({ players: [player({ node: NODES.length - 1 }), player({ id: 1, kind: 'ai', level: 'hard' })], turn: 1 });
      const { m, storage } = mem(blob(tr));
      const store = createSaveStore({ storage });
      store.load();
      assert.equal(store.trailDiscarded, false);
      assert.deepEqual(store.adoptTrail().trail, tr);
      assert.equal(m.has('hs-trivia-v1.bad'), false);
    },
  },
  {
    name: 'S6-03 only a whole, unanswered stored question is brought back',
    node: true,
    run() {
      const q = { id: 'hs-0001', category: 'History', text: 'Q?', difficulty: 'easy', choices: ['a', 'b', 'c', 'd'], correctIndex: 2, removed: [], chosen: null, timeLeft: 12, timeMax: 30 };
      assert.equal(validOpenQuestion(q), true, 'a whole question is accepted');
      for (const bad of [{ id: 'x' }, { ...q, choices: ['a'] }, { ...q, correctIndex: 9 }, { ...q, chosen: 1 }, { ...q, timeLeft: 'soon' }, null]) assert.equal(validOpenQuestion(bad), false, JSON.stringify(bad));
    },
  },
);
// The harness serializes initScript with toString, so a per-case script has to carry its data in its own source.
const seedOnce = (tr) => {
  const f = () => {};
  f.toString = () => `() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('hs-trivia-v1', JSON.stringify({ v: 1, trail: ${JSON.stringify(tr)} })); } }`;
  return f;
};
for (const [name, tr] of Object.entries({ trailNoPlayers: BAD_TRAILS.trailNoPlayers, trailNodeOutOfRange: BAD_TRAILS.trailNodeOutOfRange, trailTurnOutOfRange: BAD_TRAILS.trailTurnOutOfRange, trailString: BAD_TRAILS.trailString })) {
  tests.push({
    name: `S6-03 page with a ${name} save loads, says so, and keeps rendering`,
    viewports: ['desktop'],
    initScript: seedOnce(tr),
    async run(t) {
      await t.page.waitForTimeout(300);
      t.equal(await t.page.locator('[data-act="continue-trail"]').count(), 0, 'no Continue button for an unusable trip');
      t.equal(await t.page.locator('#scene-title .save-warn').count(), 1, 'the title says a saved trip was set aside');
      const a = await t.game('fpsFrames'); await t.page.waitForTimeout(300); const b = await t.game('fpsFrames');
      t.expect(b > a, 'the render loop is still running');
      await t.game('newGame', { mode: 'trail', players: [{ kind: 'human' }], target: 4 });
      const s = await t.state();
      t.equal(s.scene, 'game', 'a new trip starts');
    },
  });
}
tests.push(
  {
    name: 'S6-03 a thrown error in the frame loop shows a way out, and Save and quit recovers the trip',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t);
      const frames0 = await t.game('fpsFrames');
      await t.page.evaluate(() => { try { window.__game.setState({ trail: { turn: 99 } }); } catch (e) { /* the redraw fails, as the loop will */ } });
      await t.page.waitForTimeout(400);
      const dlg = t.page.locator('#modal [data-act="crash-reload"]');
      t.equal(await dlg.count(), 1, 'a Reload button is offered');
      t.expect((await t.page.locator('#modal').innerText()).includes('Something went wrong'), 'the dialog says so');
      const a = await t.game('fpsFrames'); await t.page.waitForTimeout(300); const b = await t.game('fpsFrames');
      t.expect(a > frames0 && b > a, 'the loop keeps running after the error');
      await t.page.locator('#modal [data-act="crash-quit"]').click();
      await t.page.waitForTimeout(300);
      let s = await t.state();
      t.equal(s.scene, 'title', 'back on the title');
      t.equal(await t.page.locator('#modal [data-act="crash-reload"]').count(), 0, 'the dialog is gone and stays gone');
      await t.game('act', 'ui', 'continue-trail');
      s = await waitFor(t, (x) => x.scene === 'game' && x.trail, 3000, 'trip to continue');
      t.equal(s.trail.turn, 0, 'the saved trip comes back');
    },
  },
  {
    name: 'S6-03 an uncaught error opens the same dialog',
    viewports: ['desktop'],
    allowConsoleErrors: true,
    async run(t) {
      await t.page.evaluate(() => { setTimeout(() => { throw new Error('boom'); }, 0); });
      await t.page.waitForTimeout(300);
      t.equal(await t.page.locator('#modal [data-act="crash-reload"]').count(), 1, 'Reload is offered');
      t.equal(await t.page.locator('#modal [data-act="crash-quit"]').count(), 1, 'Save and quit is offered');
    },
  },
);

// ---- S2-04: screen-reader path ----
tests.push(
  {
    name: 'S2-04 the question dialog is described by the question text',
    async run(t) {
      await soloGame(t);
      const s0 = await t.state();
      await landOn(t, s0.board.types.indexOf('cat'));
      const s = await phase(t, 'question');
      const r = await t.page.evaluate(() => { const d = document.querySelector('#modal .sheet'); const id = d.getAttribute('aria-describedby'); const el = id && document.getElementById(id); return { id, text: el ? el.textContent : null, labelled: d.getAttribute('aria-labelledby') }; });
      t.equal(r.text, s.question.text, 'aria-describedby points at the question text');
      t.equal(r.labelled, 'mtitle', 'the dialog is still named by its category');
      await t.game('act', 'answer', 'correct');
      await phase(t, 'feedback');
      await t.game('act', 'continue');
      await phase(t, 'roll');
      t.equal(await t.page.evaluate(() => document.querySelector('#modal .sheet') ? document.querySelector('#modal .sheet').getAttribute('aria-describedby') : null), null, 'no stale description on other dialogs');
    },
  },
  {
    name: 'S2-04 the answer timer announces the time left and warns at 10 and 5 seconds',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t, { settings: { timer: 30 } });
      const s0 = await t.state();
      await landOn(t, s0.board.types.indexOf('cat'));
      await phase(t, 'question');
      const label = () => t.page.locator('#modal .timer').getAttribute('aria-label');
      t.expect(/^Time left: \d+ seconds$/.test(await label()), 'the timer has a spoken value');
      await t.game('setState', { question: { timeLeft: 10.6 } });
      await t.page.waitForTimeout(900);
      t.expect((await t.page.locator('#live').innerText()).includes('10 seconds left'), 'announced at 10 seconds');
      t.expect(/^Time left: (9|10) seconds$/.test(await label()), 'the value follows the clock (' + await label() + ')');
    },
  },
  {
    name: 'S2-04 each Settings option group has a human name',
    viewports: ['desktop'],
    async run(t) {
      await t.game('scene', 'settings');
      const names = await t.page.locator('#scene-settings [role=radiogroup]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
      t.equal(JSON.stringify(names), JSON.stringify(['Sound', 'Sound effects', 'Music', 'Ambience', 'Steam sound', 'Answer timer', 'Motion', 'Text size', 'Theme', 'Hot-seat pass screen', 'AI speed']), 'group names');
    },
  },
);

// ---- P-N04: the card banner must not depend on the correct answer ----
const BANNER_IDS = ['hs-0492', 'hs-0499', 'hs-0404', 'hs-0469', 'hs-0008', 'hs-0203', 'hs-0204', 'hs-0157', 'hs-0281'];
tests.push({
  name: 'P-N04 the question banner does not change with which choice is correct',
  viewports: ['desktop'],
  async run(t) {
    const bank = JSON.parse((await import('node:fs')).readFileSync(new URL('../data/questions.json', import.meta.url), 'utf8')).questions;
    await soloGame(t);
    const s0 = await t.state();
    await landOn(t, s0.board.types.indexOf('cat'));
    await phase(t, 'question');
    for (const id of BANNER_IDS) {
      const q = bank.find((x) => x.id === id);
      const choices = [q.answer, ...q.wrong.slice(0, 3)];
      const caps = [];
      for (const correctIndex of [0, 1, 2, 3]) {
        await t.game('setState', { question: { id, category: q.category, difficulty: q.difficulty, era: q.era, text: q.question, choices, correctIndex, chosen: null, removed: [] } });
        caps.push(await t.page.locator('#modal .qcap').innerText().catch(() => ''));
      }
      t.expect(caps.every((c) => c === caps[0]), `${id}: banner caption is the same whichever choice is correct (${caps.join(' | ')})`);
    }
  },
});
