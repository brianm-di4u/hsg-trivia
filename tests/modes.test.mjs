// Quick 10, Era Express, Daily Challenge (AC23–AC25).
import { waitFor } from './helpers.mjs';

async function playQuiz(t, pattern, shotAt = {}) {
  for (let i = 0; ; i++) {
    const s = await t.state();
    if (s.scene !== 'quiz') return s;
    await t.game('act', 'answer', pattern(i) ? 'correct' : 'wrong');
    if (shotAt[i]) await t.shot(shotAt[i]);
    await t.game('act', 'continue');
  }
}

export const tests = [
  {
    name: 'quick 10',
    async run(t) {
      await t.seed(11);
      await t.game('setState', { settings: { timer: 20 } });
      await t.game('newGame', { mode: 'quick' });
      let s = await t.state();
      t.equal(s.scene, 'quiz', 'quiz scene');
      t.equal(s.quiz.total, 10, 'ten questions');
      await t.shot('22-quick-q');
      await t.checkLayout();
      s = await playQuiz(t, (i) => i % 3 !== 2, { 1: '22b-quick-feedback' });
      t.equal(s.scene, 'results', 'results after ten');
      t.equal(s.quiz.results.length, 10, 'ten results');
      t.expect(s.quiz.score > 0, 'scored points');
      t.equal(new Set(s.quiz.results.map((r) => r.id)).size, 10, 'no repeats');
      await t.shot('23-quick-results');
      await t.checkLayout();
    },
  },
  {
    name: 'era express',
    async run(t) {
      await t.game('scene', 'era');
      t.equal(await t.page.locator('.era-card').count(), 6, 'six era cards');
      await t.shot('24-era-select');
      await t.checkLayout();
      await t.page.click('.era-card[data-era="roaring"]');
      let s = await waitFor(t, (x) => x.scene === 'quiz', 3000, 'era quiz');
      t.equal(s.quiz.era, 'roaring', 'roaring era');
      const eras = [];
      for (let i = 0; i < 10; i++) {
        s = await t.state();
        if (s.scene !== 'quiz') break;
        eras.push(s.question.era);
        if (i === 0) await t.shot('25-era-q');
        await t.game('act', 'answer', 'correct');
        await t.game('act', 'continue');
      }
      t.expect(eras.length === 10 && eras.every((e) => e === 'roaring'), `all questions from the era (${eras.join(',')})`);
    },
  },
  {
    name: 'daily challenge is deterministic',
    async run(t) {
      await t.game('newGame', { mode: 'daily', date: '2026-10-28' });
      let s = await t.state();
      const ids = s.quiz.ids.slice();
      const choices = s.question.choices.slice();
      t.equal(ids.length, 7, 'seven questions');
      t.equal(new Set(ids).size, 7, 'distinct');
      await t.shot('26-daily-q');
      await t.game('seed', 999);
      await t.game('newGame', { mode: 'daily', date: '2026-10-28' });
      s = await t.state();
      t.equal(s.quiz.ids, ids, 'same questions on replay');
      t.equal(s.question.choices, choices, 'same choice order on replay');
      await t.game('newGame', { mode: 'daily', date: '2026-10-29' });
      s = await t.state();
      t.expect(JSON.stringify(s.quiz.ids) !== JSON.stringify(ids), 'different day, different set');
      s = await playQuiz(t, (i) => i < 5);
      t.equal(s.scene, 'results', 'daily results');
      const share = await t.page.locator('#share').inputValue();
      t.expect(share.includes('5/7'), 'share text has the score');
      await t.shot('27-daily-results');
      await t.checkLayout();
    },
  },
];
