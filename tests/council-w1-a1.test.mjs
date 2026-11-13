// Council wave 1, batch A1: stability, saves and lifecycle (part 1).
import assert from 'node:assert/strict';
import { createSaveStore } from '../src/js/save.js';
import { soloGame, landOn, phase, waitFor, H1 } from './helpers.mjs';

// Open and close Help straight away, as a player glancing at the rules would.
async function peekHelp(t) {
  await t.game('scene', 'help');
  await t.game('scene', 'game');
}

export const tests = [
  {
    name: 'S1-01 Help opened during a landed trolley space does not stall the turn',
    async run(t) {
      await soloGame(t);
      const s0 = await t.state();
      const trailNode = s0.board.types.indexOf('trolley');
      await landOn(t, trailNode);
      let s = await t.state();
      t.equal(s.trail.phase, 'landed', 'phase is landed after stopping on a trolley space');
      await peekHelp(t);
      s = await waitFor(t, (x) => x.trail.round === 2, 4000, 'turn to end by itself');
      t.equal(s.trail.phase, 'roll', 'next turn is ready to roll');
    },
  },
  {
    name: 'S1-01 Help opened during a skipped turn does not stall the turn',
    async run(t) {
      await soloGame(t);
      const s0 = await t.state();
      await t.game('setState', { trail: { players: [{ skip: true }] } });
      await landOn(t, s0.board.types.indexOf('postcard'));
      await t.game('act', 'continue');
      let s = await phase(t, 'skipped');
      await peekHelp(t);
      s = await waitFor(t, (x) => x.trail.round >= 3, 4000, 'skipped turn to end by itself');
      t.equal(s.trail.phase, 'roll', 'next turn is ready to roll');
    },
  },
];

// ---- S5-14 / S1-17: audio context handling ----
const hide = (page, hidden) => page.evaluate((h) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);
const audioState = async (t) => (await t.state()).audio.state;

tests.push(
  {
    name: 'S5-14 the first cue on the first gesture plays once the context resumes',
    viewports: ['desktop'],
    // A context that stays suspended for 200 ms after resume() is called, as a slow device does.
    initScript: () => {
      const Real = window.AudioContext;
      window.AudioContext = class extends Real {
        constructor() {
          super(); let st = 'suspended';
          Object.defineProperty(this, 'state', { get: () => st });
          this.resume = () => new Promise((r) => setTimeout(() => { st = 'running'; r(); }, 200));
        }
      };
    },
    async run(t) {
      await soloGame(t);
      const before = (await t.state()).audio.played;
      await t.page.keyboard.press('Space'); // first gesture: unlocks audio and rolls (gauge cue) in the same event
      await t.page.waitForTimeout(600);
      const s = await t.state();
      t.expect(s.trail.phase === 'choose', 'the roll happened');
      t.equal(s.audio.played, before + 1, 'the roll cue played after resume, not dropped');
    },
  },
  {
    name: 'S1-17 audio is suspended while the tab is hidden and resumes on return',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t);
      await t.page.keyboard.press('p'); await t.page.keyboard.press('Escape'); // real gestures start the context
      await waitFor(t, (s) => s.audio.state === 'running', 3000, 'audio running');
      await hide(t.page, true);
      await waitFor(t, (s) => s.audio.state === 'suspended', 2000, 'audio suspended while hidden');
      const played = (await t.state()).audio.played;
      await t.game('act', 'roll', 3);
      t.equal((await t.state()).audio.played, played, 'no cue plays in a hidden tab');
      await hide(t.page, false);
      await waitFor(t, (s) => s.audio.state === 'running', 2000, 'audio running again after return');
    },
  },
);

// ---- S6-01: corrupt, truncated or newer-version save blobs ----
const memory = (raw) => { const m = new Map(raw === undefined ? [] : [['hs-trivia-v1', raw]]); return { m, storage: () => ({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } }) }; };
const BAD = {
  truncated: '{"v":1,"settings":{"sound":fal',
  nullValue: 'null',
  arrayValue: '[]',
  futureVersion: JSON.stringify({ v: 2, future: { data: 1 } }),
  notJson: 'garbage',
};
for (const [name, raw] of Object.entries(BAD)) {
  tests.push({
    name: `S6-01 a ${name} save is quarantined and saving works again`,
    node: true,
    run() {
      const { m, storage } = memory(raw);
      const store = createSaveStore({ storage });
      assert.equal(store.load().ok, true, 'load succeeds with defaults');
      assert.equal(store.ok, true);
      assert.equal(store.updateSettings({ sound: false }).ok, true, 'a settings write goes through');
      assert.equal(JSON.parse(m.get('hs-trivia-v1')).settings.sound, false, 'the key now holds a valid save');
      assert.equal(m.get('hs-trivia-v1.bad'), raw, 'the unreadable blob was kept under the .bad key');
      assert.equal(store.reserveTrail().ok, true, 'a new trip can be reserved');
    },
  });
}
tests.push({
  name: 'S6-01 a healthy save is not copied to the .bad key',
  node: true,
  run() {
    const { m, storage } = memory(JSON.stringify({ v: 1, settings: { sound: true } }));
    const store = createSaveStore({ storage });
    store.load(); store.updateSettings({ volume: 0.2 });
    assert.equal(m.has('hs-trivia-v1.bad'), false);
  },
});

// ---- S6-02: tell the player when progress is not being saved ----
const WARN = 'Progress is not being saved in this browser';
const blockReads = () => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { if (k === 'hs-trivia-v1') throw new Error('blocked'); return g.call(this, k); }; };
const blockWrites = () => { const s = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'hs-trivia-v1' && window.__blockSave) throw new Error('blocked'); return s.call(this, k, v); }; };

tests.push(
  {
    name: 'S6-02 blocked storage shows a not-saved notice on the title and announces it',
    initScript: blockReads,
    async run(t) {
      await t.page.waitForTimeout(300);
      const chip = t.page.locator('#scene-title .save-warn');
      t.equal(await chip.count(), 1, 'notice in the title');
      t.expect((await chip.innerText()).includes(WARN), 'notice wording');
      t.expect((await t.page.locator('#live').innerText()).includes(WARN), 'announced to screen readers');
      await t.checkLayout();
      await t.shot('s6-02-title-unsaved');
    },
  },
  {
    name: 'S6-02 a failed write mid-game shows the notice in the panel',
    initScript: blockWrites,
    async run(t) {
      await soloGame(t);
      await t.page.evaluate(() => { window.__blockSave = true; }); // storage works at first, then fails
      t.equal(await t.page.locator('.save-warn').count(), 0, 'no notice while saving works');
      const s0 = await t.state();
      await landOn(t, s0.board.types.indexOf('postcard'));
      await t.game('act', 'continue'); // ends the turn, which writes the save
      await phase(t, 'roll');
      await t.page.waitForTimeout(100);
      const chip = t.page.locator('#panel .save-warn');
      t.equal(await chip.count(), 1, 'notice in the panel');
      t.expect((await t.page.locator('#live').innerText()).includes(WARN), 'announced');
      await t.checkLayout();
      await t.shot('s6-02-panel-unsaved');
    },
  },
  {
    name: 'S6-02 working storage shows no notice',
    async run(t) {
      await soloGame(t);
      const s0 = await t.state();
      await landOn(t, s0.board.types.indexOf('postcard'));
      await t.game('act', 'continue');
      await phase(t, 'roll');
      t.equal(await t.page.locator('.save-warn').count(), 0, 'no notice');
    },
  },
);

// ---- S6-09: a new trip is saved at once, and a failed save is retried when the page is hidden ----
const savedTrail = (t) => t.page.evaluate(() => { const v = localStorage.getItem('hs-trivia-v1'); return v ? JSON.parse(v).trail : null; });

tests.push(
  {
    name: 'S6-09 a new trip is written before its first turn ends',
    async run(t) {
      await soloGame(t, { players: [H1, { kind: 'ai', level: 'easy' }] });
      const tr = await savedTrail(t);
      t.expect(tr && tr.players && tr.players.length === 2, 'trip is in storage straight after Start');
      t.equal(tr && tr.round, 1, 'round 1 saved');
    },
  },
  {
    name: 'S6-09 a failed save is retried when the page is hidden',
    initScript: blockWrites,
    async run(t) {
      await t.page.evaluate(() => { window.__blockSave = true; });
      await soloGame(t);
      t.equal(await savedTrail(t), null, 'nothing stored while storage refuses writes');
      await t.page.evaluate(() => { window.__blockSave = false; window.dispatchEvent(new Event('pagehide')); });
      const tr = await savedTrail(t);
      t.expect(tr && tr.players && tr.players.length === 1, 'turn-start snapshot stored on pagehide');
      t.equal(tr && tr.phase, 'roll', 'stored as a turn start');
    },
  },
);

// ---- S6-04: a reload cannot undo an answer or replay the same dice ----
const rollSequence = async (t, n) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    await t.game('act', 'roll');
    out.push((await t.state()).trail.roll);
    await t.game('setState', { trail: { phase: 'roll' } });
  }
  return out;
};
const continueTrip = async (t) => {
  await t.reload();
  await t.game('act', 'ui', 'continue-trail');
  return waitFor(t, (s) => s.scene === 'game' && s.trail, 3000, 'continued trip');
};

tests.push(
  {
    name: 'S6-04 a wrong answer is kept when the page is reloaded before the turn ends',
    async run(t) {
      await soloGame(t);
      const s0 = await t.state();
      await landOn(t, s0.board.types.indexOf('cat'));
      await t.game('act', 'answer', 'wrong');
      const fb = await phase(t, 'feedback');
      const after = fb.trail.players[0];
      const s = await continueTrip(t);
      t.equal(s.trail.round, 2, 'the answered turn is over, not offered again');
      t.equal(s.trail.phase, 'roll', 'next turn waits for a roll');
      t.equal(s.question, null, 'the answered question does not come back');
      t.equal(s.trail.players[0].node, after.node, 'token stays where the answer was given');
      t.equal(s.trail.players[0].tickets, after.tickets, 'tickets after the answer are kept');
      t.equal(s.trail.players[0].answered, 1, 'the answer still counts');
    },
  },
  {
    name: 'S6-04 Continue deals new dice rather than replaying the saved ones',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t);
      await continueTrip(t);
      const a = await rollSequence(t, 8);
      await continueTrip(t);
      const b = await rollSequence(t, 8);
      t.expect(a.join('') !== b.join(''), `two Continues give different rolls (${a.join('')} vs ${b.join('')})`);
    },
  },
);
