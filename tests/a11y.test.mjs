// Keyboard play, timers, reduced motion, text size, dark theme, no storage (AC30, AC32–AC34, AC38).
import { soloGame, phase, landOn, waitFor } from './helpers.mjs';

export const tests = [
  {
    name: 'keyboard-only play',
    viewports: ['desktop'],
    async run(t) {
      await t.seed(4);
      await t.game('setState', { settings: { timer: 0, aiSpeed: 'fast' } });
      // Title: Trail Game has focus → Enter
      await t.page.keyboard.press('Enter');
      let s = await waitFor(t, (x) => x.scene === 'setup', 2000, 'setup by keyboard');
      for (let i = 0; i < 20; i++) {
        const k = await t.page.evaluate(() => document.activeElement && document.activeElement.dataset.act);
        if (k === 'start-trail') break;
        await t.page.keyboard.press('Tab');
      }
      await t.page.keyboard.press('Enter');
      s = await waitFor(t, (x) => x.scene === 'game' && x.trail.phase === 'roll', 3000, 'game by keyboard');
      await t.page.keyboard.press('Space');
      s = await phase(t, ['choose', 'stuck']);
      if (s.trail.phase === 'choose' && s.trail.dests.length > 1) {
        await t.page.keyboard.press('ArrowRight');
        s = await t.state();
        t.equal(s.trail.sel, 1, 'arrow moves the selection');
      }
      await t.shot('31-keyboard-focus');
      await t.page.keyboard.press('Enter');
      s = await waitFor(t, (x) => !['choose', 'moving'].includes(x.trail.phase), 6000, 'landed');
      if (s.trail.phase === 'question') {
        await t.page.keyboard.press('b');
        s = await phase(t, 'feedback');
        t.equal(s.question.chosen, 1, 'B answers the second choice');
        await t.page.keyboard.press('Enter');
        s = await waitFor(t, (x) => x.trail.phase !== 'feedback', 3000, 'continued by keyboard');
      }
      t.log('keyboard turn ended in phase ' + s.trail.phase);
      await t.game('act', 'stopAI');
    },
  },
  {
    name: 'answer timer runs out',
    async run(t) {
      await soloGame(t, { settings: { timer: 10 } });
      let s = await t.state();
      s = await landOn(t, s.board.types.indexOf('cat'));
      t.equal(s.question.timeMax, 10, '10 s timer');
      await t.page.waitForTimeout(4000);
      await t.shot('32a-timer-running');
      s = await phase(t, 'feedback', 9000);
      t.equal(s.question.chosen, -1, 'timeout recorded');
      t.equal(s.question.correct, false, 'timeout counts as wrong');
      await t.shot('32-timeout');
    },
  },
  {
    name: 'reduced motion',
    reducedMotion: true,
    async run(t) {
      await soloGame(t);
      let s = await t.state();
      t.expect(s.ui.reduced, 'reduced motion detected');
      const to = s.board.landmarks['History'];
      const adj = await t.game('act', 'adj', to);
      await t.game('setState', { trail: { players: [{ node: adj[0] }] } });
      await t.game('act', 'roll', 1);
      await phase(t, 'choose');
      await t.game('act', 'choose', to);
      s = await t.state();
      t.expect(s.trail.phase !== 'moving', 'move completes instantly');
      await t.shot('33-reduced-motion');
    },
  },
  {
    name: 'large text',
    async run(t) {
      await soloGame(t, { settings: { textScale: 1.3 } });
      let s = await t.state();
      await landOn(t, s.board.types.indexOf('cat'));
      await t.shot('34-text-large');
      await t.checkLayout();
    },
  },
  {
    name: 'dark theme',
    colorScheme: 'dark',
    async run(t) {
      await soloGame(t);
      let s = await t.state();
      t.equal(s.ui.theme, 'dark', 'dark theme from the system');
      await t.game('act', 'roll', 5);
      await phase(t, 'choose');
      await t.shot('35-dark-board');
      await t.game('setState', { trail: { phase: 'roll' } });
      s = await landOn(t, s.board.landmarks['People']);
      await t.shot('35b-dark-question');
      await t.game('act', 'answer', 'correct');
      await phase(t, 'feedback');
      await t.shot('35c-dark-feedback');
      await t.game('scene', 'title');
      await t.shot('35d-dark-title');
    },
  },
  {
    name: 'works without storage',
    async run(t) {
      await t.page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } }); });
      await t.page.reload();
      await t.page.waitForFunction(() => window.__game);
      await soloGame(t);
      let s = await t.state();
      s = await landOn(t, s.board.types.indexOf('postcard'));
      await t.game('act', 'continue');
      s = await phase(t, 'roll');
      t.equal(s.storage, false, 'storage reported unavailable');
      t.equal(s.trail.round, 2, 'game continues');
      await t.shot('36-no-storage');
    },
  },
];
