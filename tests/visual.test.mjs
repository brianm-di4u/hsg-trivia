// Title, setup, board art, help, settings, audio (AC26–AC29, AC31).
import { soloGame, phase, landOn, waitFor } from './helpers.mjs';

export const tests = [
  {
    name: 'title screen',
    async run(t) {
      const s = await t.state();
      t.equal(s.scene, 'title', 'boots to title');
      t.expect(s.bank >= 500, `bank has ${s.bank} questions`);
      t.expect(t.loadMs === undefined || t.loadMs < 2000, 'interactive in under 2 s');
      await t.shot('01-title');
      await t.checkLayout();
    },
  },
  {
    name: 'setup with six seats',
    async run(t) {
      await t.game('scene', 'setup');
      for (let i = 0; i < 4; i++) await t.game('act', 'ui', 'seat-add');
      await t.page.selectOption('#seat-kind-2', 'ai:easy');
      await t.page.selectOption('#seat-kind-3', 'ai:hard');
      await t.page.fill('#seat-name-0', 'Ada');
      await t.game('act', 'ui', 'target', '8');
      const n = await t.page.locator('.seat').count();
      t.equal(n, 6, 'six seats');
      await t.shot('02-setup');
      await t.checkLayout();
      await t.page.click('[data-act="start-trail"]');
      const s = await waitFor(t, (x) => x.scene === 'game', 3000, 'game scene');
      t.equal(s.trail.players.length, 6, 'six players');
      t.equal(s.trail.target, 8, 'grand tour target');
      t.equal(s.trail.players.map((p) => p.kind + (p.kind === 'ai' ? ':' + p.level : '')).slice(0, 4), ['human', 'ai:medium', 'ai:easy', 'ai:hard'], 'seat kinds');
      t.equal(new Set(s.trail.players.map((p) => p.shape)).size, 6, 'six distinct token shapes');
      await t.game('act', 'stopAI');
    },
  },
  {
    name: 'board art and tokens',
    async run(t) {
      await soloGame(t, { players: [{ kind: 'human', name: 'Ada' }, { kind: 'human', name: 'Bo' }, { kind: 'human', name: 'Cy' }] });
      await t.shot('03-board-start');
      await t.checkLayout();
      await t.game('act', 'roll', 4);
      await phase(t, 'choose');
      await t.shot('04-destinations');
    },
  },
  {
    name: 'help and settings',
    async run(t) {
      await t.game('scene', 'help');
      await t.shot('29-help');
      await t.checkLayout();
      await t.game('scene', 'settings');
      await t.shot('30-settings');
      await t.checkLayout();
    },
  },
  {
    name: 'synthesized audio after a gesture',
    viewports: ['desktop'],
    async run(t) {
      await t.page.click('[data-act="quick"]');
      let s = await waitFor(t, (x) => x.scene === 'quiz', 3000, 'quiz');
      await t.page.click('.ans >> nth=0');
      s = await t.state();
      t.expect(s.audio.ctx, 'AudioContext created after the first gesture');
      t.expect(s.audio.played >= 1, `sounds played (${s.audio.played})`);
      await t.page.keyboard.press('m');
      s = await t.state();
      t.equal(s.settings.sound, false, 'M mutes');
      t.equal(await t.page.getAttribute('#btn-sound', 'aria-pressed'), 'true', 'mute button pressed state');
    },
  },
];
