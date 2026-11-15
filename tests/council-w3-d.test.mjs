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

  // ---------------- S1-07 ----------------
  {
    name: 'S1-07 a tap that misses pulses the nearest destination, a sloppy tap still counts, a cancelled press does nothing, and a space is named by a long press',
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      await t.game('act', 'roll', 3);
      let s = await phase(t, 'choose');
      if (s.ui.camera === 'follow') { await t.game('act', 'ui', 'zoom'); } // the Whole map view on a phone is the hard case: small spaces
      await t.waitForStable(8000);
      s = await t.state();
      const box = await rect(t, '#board');
      const at = async (id) => (await t.game('act', 'screenOf', id));
      const inBoard = ([x, y]) => x > box.left + 30 && x < box.right - 30 && y > box.top + 30 && y < box.bottom - 30;
      const dests = [];
      for (const id of s.trail.dests) { const p = await at(id); if (inBoard(p)) dests.push({ id, p }); }
      t.expect(dests.length >= 1, 'a destination is on screen: ' + s.trail.dests.length);
      const d = dests[0];
      // a miss: some other space far from every destination
      let far = null;
      for (let id = 0; id < s.board.nodes && !far; id++) {
        if (s.trail.dests.includes(id)) continue;
        const p = await at(id); if (!inBoard(p)) continue;
        const all = await Promise.all(s.trail.dests.map(at));
        if (all.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 70)) far = { id, p };
      }
      t.expect(far, 'found a spot far from every destination');
      await t.page.mouse.click(far.p[0], far.p[1]);
      s = await waitFor(t, (x) => x.ui.nudge !== null, 3000, 'the nearest ring to pulse');
      t.expect(s.trail.dests.includes(s.ui.nudge), 'the pulsing ring is a destination: ' + s.ui.nudge);
      t.equal(s.trail.phase, 'choose', 'a miss chooses nothing');
      await t.page.waitForFunction(() => /No space there/.test(document.querySelector('#live').textContent), null, { timeout: 4000 }).catch(() => t.fail('the miss was not announced to a screen reader'));
      // a cancelled press (the browser took the touch for scrolling) leaves nothing behind
      await t.page.mouse.move(d.p[0], d.p[1]); await t.page.mouse.down();
      await t.page.evaluate(() => document.querySelector('#board').dispatchEvent(new PointerEvent('pointercancel', { bubbles: true })));
      await t.page.mouse.up();
      s = await t.state();
      t.equal(s.trail.phase, 'choose', 'a cancelled press chooses nothing');
      // a long press names the space and does not choose it
      await t.page.mouse.move(d.p[0], d.p[1]); await t.page.mouse.down();
      s = await waitFor(t, (x) => x.ui.tip !== null, 4000, 'the name label');
      t.equal(s.ui.tip.id, d.id, 'it names the space under the finger');
      t.expect(s.ui.tip.text.length > 3, 'with its name: ' + s.ui.tip.text);
      await t.waitForStable(8000);
      await t.shot('S1-07-name-label');
      await t.page.mouse.up();
      s = await t.state();
      t.equal(s.trail.phase, 'choose', 'releasing a long press does not choose the space');
      await waitFor(t, (x) => x.ui.tip === null, 8000, 'the label to go');
      // a tap with a little slip (more than the old 6 px, under the new 10 px) is still a tap
      // (it ends 16 px from the space's centre: a finger's tap on the Whole map view, where the space itself is about 10 px across)
      await t.page.mouse.move(d.p[0], d.p[1] - 18); await t.page.mouse.down();
      await t.page.mouse.move(d.p[0] + 3, d.p[1] - 16); await t.page.mouse.move(d.p[0] + 5, d.p[1] - 15);
      await t.page.mouse.up();
      s = await waitFor(t, (x) => x.trail.phase !== 'choose', 4000, 'the sloppy tap to choose');
      t.equal(s.trail.players[0].node === d.id || s.trail.phase === 'moving', true, 'the token set off for that space');
      await t.game('act', 'finishAnim');
    },
  },
  {
    name: 'S1-07 hovering a space with a mouse names it',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      const s = await t.state();
      const id = s.board.landmarks['Sports'];
      const [x, y] = await t.game('act', 'screenOf', id);
      await t.page.mouse.move(x - 40, y - 40); await t.page.mouse.move(x, y);
      let st = await waitFor(t, (v) => v.ui.tip !== null, 4000, 'a label on hover');
      t.equal(st.ui.tip.id, id, 'the space under the pointer');
      t.expect(/Whittington Park/.test(st.ui.tip.text) && /Landmark/.test(st.ui.tip.text), 'its name and what it is: ' + st.ui.tip.text);
      await t.waitForStable(8000);
      await t.shot('S1-07-hover-label');
      const box = await rect(t, '#board');
      await t.page.mouse.move(box.left + 4, box.top + 4);
      await waitFor(t, (v) => v.ui.tip === null, 3000, 'the label to go when the pointer leaves the spaces');
    },
  },

  // ---------------- S2-08 ----------------
  {
    name: 'S2-08 the seat player-type pill shows its whole label on the setup card',
    initScript: withSave(VETERAN),
    async run(t) {
      await t.game('scene', 'setup');
      await t.waitForStable(8000);
      // every option's text, in the select's own font, must fit inside the select once its padding and arrow room are taken off
      const r = await t.page.evaluate(() => {
        const sel = document.querySelector('#seat-kind-1'); const cs = getComputedStyle(sel);
        const g = document.createElement('canvas').getContext('2d'); g.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
        const room = sel.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
        return { room, widest: Math.max(...[...sel.options].map((o) => g.measureText(o.textContent).width)), label: sel.options[sel.selectedIndex].textContent };
      });
      t.expect(r.widest <= r.room, `the longest label (${r.widest.toFixed(1)} px) fits the select (${r.room.toFixed(1)} px)`);
      await t.shot('S2-08-setup-seats');
    },
  },
  {
    name: 'S2-08 the Daily Challenge says today or a short date, never 2026-11-12, and the share text keeps the full date',
    initScript: withSave(VETERAN, '2026-11-12'),
    async run(t) {
      await t.game('scene', 'title');
      await t.waitForStable(8000);
      const btn = await t.page.evaluate(() => document.querySelector('[data-act="daily"]').textContent);
      t.expect(/7 questions for today/.test(btn) && !/2026/.test(btn), 'the title button: ' + btn);
      await t.game('newGame', { mode: 'daily', date: '2026-11-12' });
      await t.waitForStable(8000);
      const head = await t.page.evaluate(() => document.querySelector('.qt-title').textContent);
      t.equal(head, 'Daily Challenge · Nov 12', 'the quiz header');
      for (let i = 0; i < 7; i++) { await t.game('act', 'answer', 'correct'); await t.game('act', 'continue'); }
      await waitFor(t, (s) => s.scene === 'results', 4000, 'results');
      const res = await t.page.evaluate(() => ({ eyebrow: document.querySelector('.results-card .eyebrow').textContent, share: document.querySelector('#share').value }));
      t.equal(res.eyebrow, 'Daily Challenge · Nov 12', 'the results header');
      t.expect(/Daily 2026-11-12/.test(res.share), 'the text to share keeps the full date');
    },
  },
  {
    name: 'S2-08 a destination row does not say its kind twice, and the start space is not called The Y',
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      const s0 = await t.state();
      const rows = async (from, n) => {
        await t.game('setState', { trail: { phase: 'roll', roll: null, dests: [], rerolled: false, players: [{ node: from }] } });
        await t.game('act', 'roll', n); await phase(t, 'choose'); await t.waitForStable(8000);
        return t.page.evaluate(() => [...document.querySelectorAll('.dest')].map((b) => ({ id: +b.dataset.arg, name: b.querySelector('.dname').textContent, sub: b.querySelector('.dsub').textContent })));
      };
      const first = (type) => s0.board.types.indexOf(type);
      const neighbor = async (id) => (await t.game('act', 'adj', id))[0];
      let list = await rows(await neighbor(first('postcard')), 1);
      let r = list.find((x) => x.id === first('postcard'));
      t.expect(r && r.name === 'Postcard' && r.sub === 'Bridge Street', 'the postcard row names its district once: ' + JSON.stringify(r));
      list = await rows(await neighbor(first('jury')), 1);
      r = list.find((x) => x.id === first('jury'));
      t.expect(r && r.name === 'Grand Jury' && r.sub === 'Central Avenue', 'the Grand Jury row: ' + JSON.stringify(r));
      list = await rows(await neighbor(first('trolley')), 1);
      r = list.find((x) => x.id === first('trolley'));
      t.expect(r && r.sub === 'Oaklawn', 'the Oaklawn trolley stop row: ' + JSON.stringify(r));
      list = await rows(await neighbor(s0.board.start), 1);
      r = list.find((x) => x.id === s0.board.start);
      t.expect(r && r.sub === 'Start · trolley stop · Downtown' && !/The Y/.test(r.sub), 'the start row says what it is: ' + JSON.stringify(r));
      list = await rows(await neighbor(first('cat')), 1);
      r = list.find((x) => x.id === first('cat'));
      t.expect(r && /^[A-Za-z &]+ · /.test(r.sub), 'an ordinary space still names its category: ' + JSON.stringify(r));
      // the trolley sheet calls the start space's place Downtown
      await t.game('setState', { trail: { phase: 'roll', roll: null, dests: [], rerolled: false, players: [{ node: first('trolley'), tickets: 5 }] } });
      await t.game('act', 'ui', 'trolley-open');
      await waitFor(t, (s) => s.ui.modal === 'trolley', 3000, 'the trolley sheet');
      const small = await t.page.evaluate(() => [...document.querySelectorAll('#modal .listb small')].map((e) => e.textContent));
      t.expect(small.includes('Downtown') && !small.includes('The Y'), 'the trolley sheet: ' + small.join(' | '));
    },
  },
];
