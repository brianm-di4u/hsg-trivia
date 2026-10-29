// Visual pass: board art loads (no 404s), the vector fallback works, the projected board geometry is
// sane, board taps move the token (AC8), and close-ups of the Row and the tower.
import { soloGame, phase, waitFor } from './helpers.mjs';

export const tests = [
  {
    name: 'board art and tokens load from the manifest',
    async run(t) {
      await soloGame(t, { players: [{ kind: 'human', name: 'Ada' }, { kind: 'human', name: 'Bo' }] });
      const s = await waitFor(t, (x) => x.art.pending === 0, 8000, 'art loaded');
      t.equal(s.art.failed, [], 'no art failed to load');
      for (const k of ['board-day-lo', 'token-circle', 'token-square', 'land-row', 'stamp-row']) t.expect(s.art.loaded.includes(k), `${k} decoded`);
      const tm = await t.page.evaluate(() => { const r = performance.getEntriesByType('resource').find((x) => /board-day-lo/.test(x.name)); return r ? Math.round(r.responseEnd) : null; });
      t.log(`board art received ${tm} ms after navigation (game interactive at ${t.loadMs} ms)`);
      t.expect(tm !== null && tm < 3000, 'board art arrives within 3 s');
      await t.shot('40-board-art');
    },
  },
  {
    name: 'vector fallback without art',
    url: 'index.html?art=0',
    async run(t) {
      await soloGame(t, { players: [{ kind: 'human', name: 'Ada' }] });
      const s = await t.state();
      t.equal(s.art.enabled, false, 'art off');
      t.equal(s.art.loaded.length, 0, 'nothing requested');
      await t.game('act', 'roll', 3);
      await phase(t, 'choose');
      await t.shot('41-no-art-fallback');
      await t.checkLayout();
    },
  },
  {
    name: 'projected board geometry',
    viewports: ['desktop'],
    async run(t) {
      const g = await t.game('act', 'geo');
      t.equal(g.nodes.length, 70, '70 spaces');
      const out = g.nodes.filter((n) => n.x < n.r || n.x > g.w - n.r || n.y < n.r || n.y > g.h - n.r);
      t.equal(out.length, 0, `every space lies inside the board (${out.length} outside)`);
      // spaces never overlap: centre distance at least the sum of radii (ground ellipses, squash 0.87)
      let worst = 1e9, pair = null;
      for (let i = 0; i < g.nodes.length; i++) for (let j = i + 1; j < g.nodes.length; j++) {
        const a = g.nodes[i], b = g.nodes[j]; if (a.type === 'tower' || b.type === 'tower') continue;
        const d = Math.hypot(a.x - b.x, (a.y - b.y) / 0.87) - a.r - b.r;
        if (d < worst) { worst = d; pair = [i, j]; }
      }
      t.expect(worst >= -1.5, `closest pair of spaces ${pair} overlaps by ${(-worst).toFixed(1)} board units`);
    },
  },
  {
    name: 'tapping a highlighted space moves the token (AC8)',
    async run(t) {
      await soloGame(t, { players: [{ kind: 'human', name: 'Ada' }] });
      await t.game('act', 'roll', 2);
      let s = await phase(t, 'choose');
      const target = s.trail.dests[s.trail.dests.length - 1];
      const [x, y] = await t.game('act', 'screenOf', target);
      if (t.viewport === 'mobile') await t.tap([x, y]); else await t.page.mouse.click(x, y);
      await t.game('act', 'finishAnim');
      s = await waitFor(t, (q) => q.trail.players[0].node === target, 4000, 'token moved to the tapped space');
      t.equal(s.trail.players[0].node, target, 'moved to the tapped space');
    },
  },
  {
    name: 'close-ups: Bathhouse Row and the tower',
    async run(t) {
      await soloGame(t, { players: [{ kind: 'human', name: 'Ada' }, { kind: 'ai', level: 'easy' }] });
      await t.game('act', 'stopAI');
      const s = await t.state();
      await t.game('setState', { trail: { players: [{ node: s.board.landmarks['Places & Landmarks'] }] } });
      if (s.ui.camera !== 'follow') await t.game('act', 'ui', 'zoom');
      await t.waitFrames(30);
      await t.shot('42-closeup-row');
      await t.game('setState', { trail: { players: [{ node: s.board.tower - 1, stamps: ['Places & Landmarks', 'History', 'Sports', 'People', 'Food & Culture', 'Entertainment'] }] } });
      await t.waitFrames(40);
      await t.shot('43-closeup-tower');
    },
  },
];
