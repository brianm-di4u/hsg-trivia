// Core loop: questions, feedback, landmark stamps, passport, pass screen, autosave (AC2–AC10, AC20, AC22).
import { soloGame, phase, landOn, waitFor, H1, H2 } from './helpers.mjs';

const firstOf = (s, type, cat) => s.board.types.findIndex((ty, i) => ty === type && (!cat || s.board.cats[i] === cat));

export const tests = [
  {
    name: 'question, feedback with explanation and source',
    async run(t) {
      await soloGame(t);
      let s = await t.state();
      const cat = firstOf(s, 'cat', 'History');
      s = await landOn(t, cat);
      t.equal(s.trail.phase, 'question', 'district space asks a question');
      t.equal(s.question.category, 'History', 'question matches the district category');
      t.equal(s.question.choices.length, 4, 'four choices');
      await t.shot('05-question');
      await t.checkLayout();
      const before = s.trail.players[0].tickets;
      await t.game('act', 'answer', 'correct');
      s = await phase(t, 'feedback');
      const pay = { easy: 1, medium: 2, hard: 3 }[s.question.difficulty];
      t.equal(s.trail.players[0].tickets, before + pay, 'tickets paid by difficulty');
      const txt = await t.page.locator('.fb').innerText();
      t.expect(txt.includes(s.question.explanation.slice(0, 30)), 'explanation shown');
      t.expect(txt.includes('Source: ' + s.question.source), 'source shown');
      await t.shot('06-feedback-correct');
      await t.page.keyboard.press('Enter');
      s = await phase(t, 'roll');
      // a wrong answer
      s = await landOn(t, firstOf(s, 'cat', 'Sports'));
      await t.game('act', 'answer', 'wrong');
      s = await phase(t, 'feedback');
      t.expect(s.question.correct === false, 'marked wrong');
      t.expect((await t.page.locator('.ans.right').count()) === 1, 'correct answer highlighted');
      await t.shot('07-feedback-wrong');
      await t.checkLayout();
    },
  },
  {
    name: 'claim badge',
    async run(t) {
      await soloGame(t);
      const s0 = await t.state();
      await landOn(t, firstOf(s0, 'cat', 'Food & Culture'));
      const claim = await t.page.evaluate(() => QUESTIONS.questions.find((q) => q.confidence === 'claim')); // eslint-disable-line no-undef
      await t.game('setState', { question: { id: claim.id, category: claim.category, text: claim.question, choices: [claim.answer, ...claim.wrong], correctIndex: 0, confidence: 'claim', explanation: claim.explanation, source: claim.source } });
      t.equal(await t.page.locator('.badge.claim').count(), 1, 'Local claim badge shown');
      await t.shot('07b-claim-badge');
    },
  },
  {
    name: 'landmark stamp and passport',
    async run(t) {
      await soloGame(t);
      let s = await t.state();
      const lm = s.board.landmarks['Places & Landmarks'];
      s = await landOn(t, lm);
      t.equal(s.question.purpose, 'landmark', 'landmark question');
      await t.game('act', 'answer', 'correct');
      s = await phase(t, 'feedback');
      t.expect(s.trail.players[0].stamps.includes('Places & Landmarks'), 'stamp awarded');
      t.expect(s.question.outcome.some((o) => o.includes('Stamp earned')), 'stamp announced');
      await t.shot('28-stamp-burst');
      await t.game('act', 'continue');
      await phase(t, 'roll');
      // second stamp via another landmark
      s = await landOn(t, s.board.landmarks['Nature & Lakes']);
      await t.game('act', 'answer', 'correct');
      await phase(t, 'feedback');
      await t.game('act', 'continue');
      await phase(t, 'roll');
      await t.page.keyboard.press('p');
      s = await waitFor(t, (x) => x.ui.modal === 'passport', 2000, 'passport');
      t.equal(await t.page.locator('.stamp.have').count(), 2, 'two stamps in passport');
      await t.shot('08-passport');
      await t.checkLayout();
      await t.page.keyboard.press('Escape');
      s = await waitFor(t, (x) => x.ui.modal === null, 2000, 'passport closed');
    },
  },
  {
    name: 'pass screen between two humans',
    async run(t) {
      await t.seed(3);
      await t.game('setState', { settings: { passScreen: true, timer: 0 } });
      await t.game('newGame', { mode: 'trail', players: [H1, H2], target: 4 });
      let s = await phase(t, 'pass');
      await t.shot('20-pass');
      await t.page.keyboard.press('Enter');
      s = await phase(t, 'roll');
      t.equal(s.trail.turn, 0, 'first player rolls after passing');
    },
  },
  {
    name: 'autosave and continue',
    async run(t) {
      await soloGame(t, { players: [H1, { kind: 'ai', level: 'easy' }] });
      let s = await t.state();
      s = await landOn(t, s.board.landmarks['Sports']);
      await t.game('act', 'answer', 'correct');
      await phase(t, 'feedback');
      await t.game('act', 'stopAI');
      await t.game('act', 'continue');
      s = await waitFor(t, (x) => x.trail.turn === 1, 3000, 'turn passes');
      await t.page.reload();
      await t.page.waitForFunction(() => window.__game);
      t.equal(await t.page.locator('[data-act="continue-trail"]').count(), 1, 'Continue offered on the title');
      await t.page.click('[data-act="continue-trail"]');
      s = await waitFor(t, (x) => x.scene === 'game' && x.trail, 3000, 'continued');
      t.expect(s.trail.players[0].stamps.includes('Sports'), 'stamp survived the reload');
      t.equal(s.trail.turn, 1, 'turn order restored');
      await t.game('act', 'stopAI');
      await t.shot('21-continue');
    },
  },
];
