// AI seats play complete turns on their own (AC19).
import { waitFor } from './helpers.mjs';

export const tests = [
  {
    name: 'three AI seats play unattended',
    async run(t) {
      await t.seed(21);
      await t.game('setState', { settings: { aiSpeed: 'fast', timer: 0 } });
      await t.game('newGame', { mode: 'trail', players: [{ kind: 'ai', level: 'easy' }, { kind: 'ai', level: 'medium' }, { kind: 'ai', level: 'hard' }], target: 4 });
      await waitFor(t, (s) => s.trail.phase === 'question', 8000, 'an AI question');
      await t.page.waitForTimeout(150);
      await t.shot('19-ai-turn');
      const s = await waitFor(t, (x) => x.trail.round >= 5 || x.scene === 'win', 60000, 'four rounds of AI play');
      const answered = s.trail.players.reduce((n, p) => n + p.answered, 0);
      t.expect(answered >= 4, `AI answered questions (${answered})`);
      for (const p of s.trail.players) t.log(`${p.name} (${p.level}): ${p.correct}/${p.answered} right, ${p.stamps.length} stamps, ${p.tickets} tickets`);
      await t.game('act', 'stopAI');
    },
  },
  {
    name: 'AI accuracy is ordered by level',
    viewports: ['desktop'],
    async run(t) {
      await t.seed(5);
      const r = {};
      for (const level of ['easy', 'medium', 'hard']) r[level] = await t.game('act', 'aiSample', level, 600);
      t.log(Object.entries(r).map(([l, v]) => `${l}: ${v.easy.toFixed(2)}/${v.medium.toFixed(2)}/${v.hard.toFixed(2)}`).join(' · '));
      for (const d of ['easy', 'medium', 'hard']) t.expect(r.easy[d] < r.medium[d] && r.medium[d] < r.hard[d], `levels ordered on ${d} questions`);
    },
  },
];
