// Council wave 3, batch D: feedback, teaching and help
// (S1-04, S1-07, S2-08, S4-16, S6-18, P-N06, S2-03, S3-04, S4-07).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { H1, H2, soloGame, moveTo, waitFor, phase } from './helpers.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));
// The harness serializes initScript with toString, so a per-case script carries its data in its own source.
const withSave = (obj, today) => {
  const f = () => {};
  f.toString = () => `() => { ${today ? `window.__TEST_DATE__ = ${JSON.stringify(today)};` : ''} if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('hs-trivia-v1', JSON.stringify(${JSON.stringify(obj)})); } }`;
  return f;
};
const VETERAN = { v: 1, settings: { sound: true, volume: 0.7, timer: 0, aiSpeed: 'normal', seenCoach: true }, best: { quick: 0, era: {} }, daily: { last: null, streak: 0, results: {} }, trail: null };
const rect = (t, sel) => t.page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height }; }, sel);
// Runs a snippet of the game's own rules in a separate Node process (the rules read a few globals the page would give them).
const inNode = (code) => {
  const head = `import fs from 'node:fs'; import { pathToFileURL } from 'node:url';
    globalThis.window = {}; for (const [k, f] of [['QUESTIONS','questions'],['TIMELINE','timeline-lite'],['BOARD_GEO','board-geo']]) globalThis[k] = JSON.parse(fs.readFileSync('data/' + f + '.json', 'utf8'));
    const imp = (f) => import(pathToFileURL(process.cwd() + '/src/js/' + f).href);`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', head + code], { cwd: REPO, encoding: 'utf8', timeout: 120000 });
  if (r.status !== 0) throw new Error('node snippet failed: ' + r.stderr.slice(0, 600));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};
const keysArmed = (t) => waitFor(t, (s) => s.ui.keyGuard === 0, 3000, 'the key guard to run out');
const shotDir = '../_council/hsg-trivia/wave-3/shots';

export const tests = [
  // ---------------- S1-04 ----------------
  // The moment is 250 ms in the game. These cases widen it to 8 s (a test hook) so that two presses a loaded machine delivers far apart still
  // count as a double press, and turn it off to show that a later press works.
  {
    name: 'S1-04 a second tap of R within a moment does not re-roll for a ticket; a later R still does',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      t.equal((await t.state()).ui.keyGuardMs, 250, 'the moment is a quarter of a second');
      await t.page.evaluate(() => { window.__TEST_KEY_GUARD_MS = 8000; });
      await t.page.keyboard.press('r'); // rolls
      await t.page.keyboard.press('r'); // the second tap of a double tap
      let s = await t.state();
      t.equal(s.trail.phase, 'choose', 'still choosing');
      t.equal(s.trail.players[0].tickets, 3, 'no ticket was spent');
      t.expect(!s.trail.rerolled, 'nothing was re-rolled');
      await t.page.evaluate(() => { window.__TEST_KEY_GUARD_MS = 0; });
      await keysArmed(t);
      await t.page.keyboard.press('r');
      s = await t.state();
      t.equal(s.trail.players[0].tickets, 2, 'a later R re-rolls for a ticket as before');
      t.expect(s.trail.rerolled, 're-rolled');
      await t.game('act', 'stopAI');
    },
  },
  {
    name: 'S1-04 Space twice rolls once and leaves the choice to the player',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      await t.page.evaluate(() => { window.__TEST_KEY_GUARD_MS = 8000; });
      await t.page.keyboard.press('Space');
      await t.page.keyboard.press('Space');
      let s = await t.state();
      t.equal(s.trail.phase, 'choose', 'the second Space did not pick the preselected destination');
      await t.page.evaluate(() => { window.__TEST_KEY_GUARD_MS = 0; });
      await keysArmed(t);
      await t.page.keyboard.press('Space');
      await waitFor(t, (x) => x.trail.phase !== 'choose', 3000, 'the later Space confirms');
      await t.game('act', 'finishAnim');
    },
  },
  {
    name: 'S1-04 Enter twice at the Grand Jury does not answer the first answer of the question that appears',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      await t.game('setState', { trail: { phase: 'jury', pending: { kind: 'jury' } } });
      await waitFor(t, (x) => x.trail.phase === 'jury', 2000, 'jury');
      await t.page.evaluate(() => { window.__TEST_KEY_GUARD_MS = 8000; });
      await t.page.keyboard.press('Enter');
      await t.page.keyboard.press('Enter');
      await phase(t, 'question');
      const s = await t.state();
      t.equal(s.trail.phase, 'question', 'the question is still open');
      t.equal(s.question.chosen, null, 'nothing was answered');
      // a deliberate answer still works
      await t.page.keyboard.press('b');
      await phase(t, 'feedback');
      t.equal((await t.state()).question.chosen, 1, 'B answers the second choice');
    },
  },
  {
    name: 'S1-04 a held key acts once',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      const press = (key, repeat) => t.page.evaluate(([k, r]) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, repeat: r, bubbles: true, cancelable: true })), [key, repeat]);
      await press('r', true);
      let s = await t.state();
      t.equal(s.trail.phase, 'roll', 'a repeat of R does not roll');
      await press('r', false);
      s = await phase(t, 'choose');
      t.equal(s.trail.phase, 'choose', 'the first press rolls');
      await t.page.evaluate(() => { window.__TEST_KEY_GUARD_MS = 0; });
      await keysArmed(t);
      await press('r', true);
      s = await t.state();
      t.expect(!s.trail.rerolled && s.trail.players[0].tickets === 3, 'a repeat of R does not re-roll');
      await t.game('act', 'stopAI');
    },
  },
];
