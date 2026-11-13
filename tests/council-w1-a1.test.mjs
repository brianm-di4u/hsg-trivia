// Council wave 1, batch A1: stability, saves and lifecycle (part 1).
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
