// Council wave 3, batch E: sound (CL-01, S2-07, S3-24, S4-23, S5-06, S5-13, S5-16, S5-17, S3-19).
import { H1, H2, soloGame, waitFor, phase } from './helpers.mjs';

const render = (t, ...a) => t.page.evaluate((x) => window.__game.audioRender(...x), a);
const audio = (t) => t.page.evaluate(() => window.__game.audioState());
const unlock = async (t) => { await t.page.mouse.click(5, 5); await waitFor(t, (s) => s.audio.state === 'running', 3000, 'audio running'); };

export const tests = [
  // ---------------- CL-01 ----------------
  {
    name: 'CL-01 the busiest moment stays under 0.95 with the volume at its maximum',
    viewports: ['desktop'],
    async run(t) {
      // The render hook takes the Volume slider as its fourth argument; the other controls are on/off.
      const soft = [], loud = [];
      for (let i = 0; i < 5; i++) { soft.push((await render(t, 'cue:hop', 1.5, false)).peak); loud.push((await render(t, 'cue:hop', 1.5, false, 1)).peak); }
      const mid = (a) => a.slice().sort((x, y) => x - y)[2];
      t.expect(mid(loud) > mid(soft) * 1.25, `the volume argument is used (a hop peaks at ${mid(soft)} at the shipped volume, ${mid(loud)} at full)`);
      for (let i = 0; i < 5; i++) { const r = await render(t, 'busy', 9, false, 1); t.expect(r.peak < 0.95, `busy moment at full volume peaks at ${r.peak}`); }
      // and the win: the board piece, the Row bed and the win cue
      for (let i = 0; i < 3; i++) { const r = await render(t, 'mix', 9, false, 1); t.expect(r.peak < 0.95, `win moment at full volume peaks at ${r.peak}`); }
    },
  },
  {
    name: 'CL-01 the loudest cues stay under 0.95 at full volume over 20 repeats each',
    viewports: ['desktop'],
    async run(t) {
      for (const n of ['win', 'stamp', 'bell', 'correct', 'gauge']) {
        let worst = 0;
        for (let i = 0; i < 20; i++) worst = Math.max(worst, (await render(t, 'cue:' + n, 2.5, false, 1)).peak);
        t.log(`${n}: loudest of 20 at full volume ${worst}`);
        t.expect(worst < 0.95, `${n} at full volume peaks at ${worst}`);
      }
    },
  },
];
