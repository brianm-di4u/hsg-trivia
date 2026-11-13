// Council wave 1, batch A2: stability (part 2), screens, layout and words.
import { soloGame } from './helpers.mjs';

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
];
