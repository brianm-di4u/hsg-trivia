// Council wave 1, batch A2: stability (part 2), screens, layout and words.
import assert from 'node:assert/strict';
import { createSaveStore } from '../src/js/save.js';
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

