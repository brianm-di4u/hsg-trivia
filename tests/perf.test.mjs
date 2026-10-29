// Performance and size budgets, content checks (AC1, AC4, AC5, AC36, AC37).
import { soloGame, phase } from './helpers.mjs';

export const tests = [
  {
    name: 'fps, memory and size',
    viewports: ['desktop'],
    async run(t) {
      t.log(`loadMs ${t.loadMs}`);
      const size = await t.page.evaluate(async () => (await (await fetch(location.href)).text()).length);
      t.log(`index.html ${(size / 1024).toFixed(1)} KB`);
      t.expect(size <= 2 * 1024 * 1024, 'HTML ≤ 2 MB');
      const titleFps = await t.fps(2000);
      await soloGame(t, { players: [{ kind: 'human' }, { kind: 'ai', level: 'hard' }, { kind: 'ai', level: 'easy' }] });
      const boardFps = await t.fps(2000);
      await t.game('act', 'roll', 6);
      await phase(t, 'choose');
      const s = await t.state();
      await t.game('act', 'choose', s.trail.dests[0]);
      const moveFps = await t.fps(1200);
      const mem = await t.memoryMB();
      t.log(`fps title ${titleFps} · board ${boardFps} · moving ${moveFps} · heap ${mem} MB`);
      t.expect(boardFps >= 55, `board fps ${boardFps} ≥ 55`);
      t.expect(moveFps >= 50, `moving fps ${moveFps} ≥ 50`);
      await t.game('act', 'stopAI');
    },
  },
  {
    // Busiest board: six tokens, steam, a pulsing destination set, zoomed in (follow camera), night art.
    name: 'busiest scene fps, art download',
    async run(t) {
      await t.game('setState', { settings: { theme: 'dark' } });
      await soloGame(t, { players: [{ kind: 'human' }, ...Array.from({ length: 5 }, () => ({ kind: 'ai', level: 'medium' }))], settings: { theme: 'dark' } });
      await t.game('act', 'stopAI');
      const st = await t.state();
      if (st.ui.camera !== 'follow') await t.game('act', 'ui', 'zoom');
      await t.game('act', 'roll', 6);
      await phase(t, 'choose');
      const fps = await t.fps(2500);
      const art = await t.page.evaluate(() => performance.getEntriesByType('resource').filter((r) => /\/assets\//.test(r.name))
        .map((r) => ({ n: r.name.split('/').pop(), kb: Math.round((r.encodedBodySize || r.transferSize || 0) / 1024) })));
      const kb = art.reduce((a, r) => a + r.kb, 0);
      t.log(`busiest fps ${fps} · art requests ${art.length} · ${kb} KB (${art.filter((r) => r.n.startsWith('board')).map((r) => r.n).join(', ')})`);
      t.expect(fps >= (t.viewport === 'mobile' ? 30 : 55), `busiest fps ${fps}`);
      t.expect(kb <= 6 * 1024, `art download ${kb} KB ≤ 6 MB`);
      await t.game('setState', { settings: { theme: 'auto' } });
    },
  },
  {
    name: 'bank is the audited copy; no repeats; adaptive skill',
    viewports: ['desktop'],
    async run(t) {
      const info = await t.page.evaluate(() => {
        const q = QUESTIONS.questions; // eslint-disable-line no-undef
        return {
          n: q.length, version: QUESTIONS.version, audited: QUESTIONS.audited, // eslint-disable-line no-undef
          dropped: q.some((x) => x.id === 'hs-0329'),
          bad: q.filter((x) => x.wrong.length !== 3 || x.wrong.includes(x.answer) || !x.explanation || !x.source).map((x) => x.id),
          viaSearch: q.filter((x) => /via search/i.test(x.source)).length,
        };
      });
      t.equal(info.n, 511, '511 audited questions');
      t.equal(info.version, 2, 'audited bank version');
      t.expect(!info.dropped, 'dropped question absent');
      t.equal(info.bad, [], 'every question has 3 distractors, an explanation and a source');
      t.equal(info.viaSearch, 0, 'no "via search" sources remain');
      // 6 Quick 10 rounds in one session: 60 questions without a repeat
      const seen = [];
      for (let r = 0; r < 6; r++) {
        await t.game('newGame', { mode: 'quick' });
        for (let i = 0; i < 10; i++) {
          const s = await t.state();
          seen.push(s.question.id);
          const sk = s.quiz.skill;
          await t.game('act', 'answer', r < 3 ? 'correct' : 'wrong');
          const s2 = await t.state();
          if (r < 3) t.expect(s2.quiz.skill > sk, 'skill rises after a correct answer');
          else t.expect(s2.quiz.skill < sk, 'skill falls after a wrong answer');
          await t.game('act', 'continue');
        }
      }
      t.equal(new Set(seen).size, 60, '60 questions, no repeats in a session');
    },
  },
];
