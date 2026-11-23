// Council wave 3, batch F: sound and world, words and ceremony (S5-05, S6-15, S2-05, S4-03, S4-04, S4-06).
import { H1, soloGame, landOn, waitFor, phase } from './helpers.mjs';

const unlock = async (t) => { await t.page.mouse.click(5, 5); await waitFor(t, (s) => s.audio.state === 'running', 3000, 'audio running'); };
const names = async (t) => (await t.state()).audio.log.map((x) => x.name);
// The game does not strike a cue again within 80 ms of its own last start (src/js/audio.js, MIN_GAP / DEFAULT_GAP: a long cue would
// otherwise stack on itself at the Fast AI speed). Driven through the API, the next question can open well inside that gap, and the
// cue is then dropped as designed, so wait the gap out before an action that should strike the same cue again. Count the cues since a
// mark from the running total, not from the log, which keeps only the last 40.
const cueGap = (t) => t.page.waitForTimeout(100);
const mark = async (t) => (await t.state()).audio.played;
const since = async (t, m) => { const a = (await t.state()).audio, k = a.played - m; return k > 0 ? a.log.slice(-Math.min(k, a.log.length)).map((x) => x.name) : []; };
const render = (t, ...a) => t.page.evaluate((x) => window.__game.audioRender(...x), a);
// A gamepad of the standard layout whose pressed buttons are listed in window.__pad.
const fakePad = () => {
  window.__pad = {};
  window.__TEST_KEY_GUARD_MS = 0; // wave 4 (C4-14): a pad's A is held back for a moment after a question or a list appears; these cases press at once, and the hold has its own test
  navigator.getGamepads = () => [{ connected: true, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: !!window.__pad[i] })) }];
};
// Press a button for a few frames and let go: one press, however long it is held.
const frames = (t, n) => t.page.evaluate((k) => new Promise((ok) => { let i = 0; const f = () => (++i >= k ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const press = async (t, i, held = 4) => { await t.page.evaluate((b) => { window.__pad[b] = true; }, i); await frames(t, held); await t.page.evaluate((b) => { window.__pad[b] = false; }, i); await frames(t, 2); };
const focusKey = async (t) => (await t.state()).ui.focus;
const median = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];

export const tests = [
  // ---------------- S5-05 ----------------
  {
    name: 'S5-05 a question opening, a wager chip, the jury and the trolley sheet each have a cue',
    viewports: ['desktop'],
    async run(t) {
      await unlock(t);
      await soloGame(t, { players: [H1] });
      const s0 = await t.state();
      // a district question: a rising pair as it opens
      await landOn(t, s0.board.types.indexOf('cat'));
      await phase(t, 'question');
      t.expect((await names(t)).includes('ask'), 'the question opens with the ask cue: ' + (await names(t)).join());
      await t.game('act', 'answer', 'wrong'); await t.game('act', 'continue'); await phase(t, 'roll');
      // Post Time: the chip, then the question
      const w = s0.board.types.indexOf('wager');
      await t.game('setState', { trail: { players: [{ tickets: 6 }] } });
      await landOn(t, w);
      await phase(t, 'wager');
      await cueGap(t);
      const n0 = await mark(t);
      await t.game('act', 'wager', 2);
      await phase(t, 'question');
      const after = await since(t, n0);
      t.expect(after.includes('chip') && after.includes('ask') && after.indexOf('chip') < after.indexOf('ask'), 'a chip, then the question: ' + after.join());
      await t.game('act', 'answer', 'wrong'); await t.game('act', 'continue'); await phase(t, 'roll');
      // the Grand Jury: facing the jury opens a question
      await landOn(t, s0.board.types.indexOf('jury'));
      await phase(t, 'jury');
      await cueGap(t); // the wager question's ask was a moment ago
      const n1 = await mark(t);
      await t.game('act', 'continue');
      await phase(t, 'question');
      t.equal((await since(t, n1)).filter((x) => x === 'ask').length, 1, 'facing the jury sounds the question cue');
      await t.game('act', 'answer', 'correct'); await t.game('act', 'continue'); await phase(t, ['roll', 'landed']);
      // the trolley sheet opens with a page turn, and closing it does too
      await t.game('setState', { trail: { phase: 'roll', players: [{ tickets: 9, node: s0.board.trolleys[0] }] } });
      await t.page.waitForTimeout(120); // the page turn is held back for 80 ms after the last one
      const p0 = await mark(t);
      await t.game('act', 'ui', 'trolley-open');
      t.equal((await t.state()).ui.modal, 'trolley', 'the sheet is open');
      t.equal((await since(t, p0)).filter((x) => x === 'page').length, 1, 'opening the trolley sheet turns a page');
      await t.page.waitForTimeout(120);
      await t.game('act', 'ui', 'close-modal');
      t.equal((await since(t, p0)).filter((x) => x === 'page').length, 2, 'closing it does too');
    },
  },
  {
    name: 'S5-05 a computer traveler\'s question makes no ask cue, and the new cues sit at the cue level without clipping',
    viewports: ['desktop'],
    async run(t) {
      await unlock(t);
      await t.seed(7);
      await t.game('setState', { settings: { passScreen: false, aiSpeed: 'fast', timer: 0, seenCoach: true } });
      await t.game('newGame', { mode: 'trail', players: [{ kind: 'ai', level: 'medium' }, H1], target: 6, seed: 7 });
      await waitFor(t, (s) => s.trail && s.trail.turn === 1, 20000, 'the human turn');
      t.expect(!(await names(t)).includes('ask'), 'the computer\'s own questions are silent: ' + (await names(t)).join());
      for (const n of ['ask', 'chip']) {
        const peaks = [], loud = [];
        for (let i = 0; i < 5; i++) { peaks.push((await render(t, 'cue:' + n, 1.5, false)).peak); loud.push((await render(t, 'cue:' + n, 1.5, false, 1)).peak); }
        const m = median(peaks);
        t.log(`${n}: median peak ${m}, loudest at full volume ${Math.max(...loud)}`);
        t.expect(m >= 0.2 / 1.19 && m <= 0.45 * 1.19, `${n} median peak ${m} within the cue range`);
        t.expect(Math.max(...loud) < 0.95, `${n} stays under 0.95 at full volume`);
      }
    },
  },
  // ---------------- S6-15 ----------------
  {
    name: 'S6-15 a gamepad rolls, picks a space, answers and opens the menu',
    viewports: ['desktop'],
    initScript: fakePad,
    async run(t) {
      await soloGame(t, { players: [H1] });
      await t.game('act', 'roll', 6);
      await phase(t, 'choose');
      const s1 = await t.state();
      t.expect(s1.trail.dests.length > 1, 'more than one place to go');
      await press(t, 15);
      t.equal((await t.state()).trail.sel, 1, 'the D-pad moves the choice');
      await press(t, 14);
      t.equal((await t.state()).trail.sel, 0, 'and back');
      await press(t, 0);
      await phase(t, ['moving', 'question', 'landed', 'roll', 'feedback', 'vent', 'wager', 'jury', 'postcard', 'order', 'stuck']);
      const s2 = await t.state();
      t.expect(s2.trail.players[0].node !== 0 || s2.trail.phase !== 'choose', 'A confirms the choice');
      await t.game('act', 'finishAnim');
      // a question: the four face buttons are A to D
      await t.game('setState', { trail: { phase: 'roll' } });
      await t.game('act', 'finishAnim');
      await t.game('setState', { trail: { phase: 'roll', players: [{ node: 0 }] } });
      const cat = s1.board.types.indexOf('cat');
      await landOn(t, cat);
      await phase(t, 'question');
      await press(t, 2);
      const q = (await t.state()).question;
      t.equal(q.chosen, 2, 'X answers C');
      await phase(t, 'feedback');
      await press(t, 0);
      await phase(t, 'roll');
      // B opens the menu, the D-pad walks the buttons, A presses one, B closes
      await press(t, 1);
      t.equal((await t.state()).ui.menu, true, 'B opens the menu');
      const f0 = await focusKey(t);
      await press(t, 13);
      const f1 = await focusKey(t);
      t.expect(f1 && f1 !== f0, `the D-pad moves the focus (${f0} to ${f1})`);
      await press(t, 12);
      t.equal(await focusKey(t), f0, 'and back');
      await press(t, 0);
      t.equal((await t.state()).ui.menu, false, 'A on Resume closes the menu');
    },
  },
  {
    name: 'S6-15 a held button acts once, and the pad works on the title and the quiz',
    viewports: ['desktop'],
    initScript: fakePad,
    async run(t) {
      await t.game('scene', 'title');
      await t.waitForStable(8000);
      const f0 = await focusKey(t);
      await press(t, 13, 30); // held for thirty frames: one step
      const f1 = await focusKey(t);
      await press(t, 13, 2);
      const f2 = await focusKey(t);
      t.expect(f1 !== f0 && f2 !== f1, `one step for a long hold, one for a tap (${f0}, ${f1}, ${f2})`);
      await t.game('newGame', { mode: 'quick' });
      await waitFor(t, (s) => s.scene === 'quiz' && s.question, 6000, 'the quiz');
      await press(t, 3);
      t.equal((await t.state()).question.chosen, 3, 'Y answers D in a quiz');
    },
  },
  {
    name: 'S6-15 Help lists the pad, and nothing happens with no pad connected',
    viewports: ['desktop'],
    async run(t) {
      await t.game('scene', 'help');
      const txt = await t.page.evaluate(() => document.querySelector('#scene-help').innerText);
      t.expect(/gamepad/i.test(txt) && /D-pad/.test(txt), 'a Gamepad line in Help');
      t.expect(await t.page.evaluate(() => { try { return navigator.getGamepads().every((g) => !g); } catch (e) { return true; } }), 'no pad is connected in this browser');
    },
  },
  // ---------------- S2-05 ----------------
  {
    name: 'S2-05 a missed landmark says no stamp was lost and to land there again; a hit or a held stamp does not',
    async run(t) {
      await soloGame(t, { players: [H1] });
      const s0 = await t.state();
      const lm = s0.board.types.indexOf('landmark');
      await landOn(t, lm);
      await phase(t, 'question');
      await t.game('act', 'answer', 'wrong');
      const q = (await t.state()).question;
      t.expect(q.outcome.some((o) => /No stamp this time\. Land here again/.test(o)), 'a miss: ' + q.outcome.join(' | '));
      const shown = await t.page.evaluate(() => (document.querySelector('.outcome') || {}).textContent || '');
      t.expect(/Land here again/.test(shown), 'the card says it: ' + shown);
      await t.page.locator('.outcome').first().scrollIntoViewIfNeeded();
      await t.shot('S2-05-landmark-miss');
      await t.checkLayout();
      await t.game('act', 'continue'); await phase(t, 'roll');
      // a right answer: a stamp, no such line
      await landOn(t, s0.board.types.indexOf('landmark'));
      await phase(t, 'question');
      await t.game('act', 'answer', 'correct');
      t.expect(!(await t.state()).question.outcome.some((o) => /No stamp/.test(o)), 'a hit has no such line');
      await t.game('act', 'continue'); await phase(t, ['roll', 'landed']);
      // a miss at a district whose stamp is already held: nothing to retry
      await t.game('setState', { trail: { phase: 'roll', players: [{ stamps: ['Places & Landmarks'] }] } });
      const cat = (await t.state()).board.cats.findIndex((c, i) => c === 'Places & Landmarks' && s0.board.types[i] === 'landmark');
      await landOn(t, cat);
      await phase(t, 'question');
      await t.game('act', 'answer', 'wrong');
      t.expect(!(await t.state()).question.outcome.some((o) => /No stamp/.test(o)), 'a held stamp has no such line: ' + (await t.state()).question.outcome.join(' | '));
    },
  },
  {
    name: 'S2-05 each traveler shows one circle for each stamp the trip needs',
    async run(t) {
      for (const target of [4, 6, 8]) {
        await soloGame(t, { players: [H1], target });
        await t.waitForStable(6000);
        const n = await t.page.evaluate(() => document.querySelectorAll('#panel .pl .pips > *').length);
        t.equal(n, target, `a ${target}-stamp trip shows ${target} circles`);
        await t.game('setState', { trail: { players: [{ stamps: ['Sports', 'People'] }] } });
        await t.waitForStable(6000);
        const r = await t.page.evaluate(() => ({ all: document.querySelectorAll('#panel .pl .pips > *').length, empty: document.querySelectorAll('#panel .pl .pips .pip.empty').length, label: document.querySelector('#panel .pl .pips').getAttribute('aria-label') }));
        t.equal(r.all, target, 'still the same number after two stamps');
        t.equal(r.empty, target - 2, 'two are filled');
        t.expect(r.label === `2 of ${target} stamps`, 'the label says it: ' + r.label);
      }
      await soloGame(t, { players: [H1], target: 4 });
      await t.game('setState', { trail: { players: [{ stamps: ['Sports', 'People', 'History', 'Nature & Lakes', 'Food & Culture'] }] } });
      await t.waitForStable(6000);
      t.equal(await t.page.evaluate(() => document.querySelectorAll('#panel .pl .pips > *').length), 5, 'a trip gone past its target shows every stamp held');
      await t.page.locator('#panel .pl .pips').first().scrollIntoViewIfNeeded();
      await t.shot('S2-05-pips');
      await t.checkLayout();
    },
  },
  // ---------------- S4-03 ----------------
  {
    name: 'S4-03 the brand mark is drawn, in the header and on the passport, and the share text uses plain circles',
    async run(t) {
      await t.game('scene', 'title');
      await t.waitForStable(8000);
      const h = await t.page.evaluate(() => { const m = document.querySelector('#btn-home .brand-mark'); const r = m.querySelector('svg').getBoundingClientRect(); return { text: m.textContent.trim(), w: r.width, h: r.height, paths: m.querySelectorAll('path').length }; });
      t.equal(h.text, '', 'no symbol character in the header');
      t.expect(h.w >= 20 && h.h >= 20 && h.paths === 2, 'the drawn mark has size and its parts: ' + JSON.stringify(h));
      await t.shot('S4-03-brand-mark');
      await soloGame(t, { players: [H1] });
      await t.game('act', 'ui', 'passport');
      await waitFor(t, (s) => s.ui.modal === 'passport', 3000, 'passport');
      const p = await t.page.evaluate(() => { const m = document.querySelector('.pp-seal'); return { text: m.textContent.trim(), svg: !!m.querySelector('svg') }; });
      t.expect(p.svg && p.text === '', 'the passport seal is the drawn mark');
      await t.shot('S4-03-passport-seal');
      await t.game('act', 'ui', 'close-modal');
      await t.game('newGame', { mode: 'daily', date: '2026-11-12' });
      await t.waitForStable(8000);
      for (let i = 0; i < 7; i++) { await t.game('act', 'answer', i % 2 ? 'correct' : 'wrong'); await t.game('act', 'continue'); }
      await waitFor(t, (s) => s.scene === 'results', 4000, 'results');
      const share = await t.page.evaluate(() => document.querySelector('#share').value);
      t.expect(!/♨/.test(share) && /^[●○]{7} {2}/m.test(share), 'the share row is seven plain circles: ' + JSON.stringify(share));
    },
  },
  // ---------------- S4-04 ----------------
  {
    name: 'S4-04 the painting under a question takes the colour of its era and says the period',
    async run(t) {
      await t.game('newGame', { mode: 'era', era: 'gilded-spa' });
      await waitFor(t, (s) => s.scene === 'quiz' && s.question, 6000, 'the era quiz');
      await t.waitForStable(8000);
      const look = () => t.page.evaluate(() => { const b = document.querySelector('.qbanner'); return b && { era: b.dataset.era, tag: (b.querySelector('.qera') || {}).textContent || '', filter: getComputedStyle(b.querySelector('.qart')).filter, w: b.getBoundingClientRect().width, tagB: b.querySelector('.qera').getBoundingClientRect().bottom, capT: b.querySelector('.qcap').getBoundingClientRect().top }; });
      const a = await look();
      t.expect(a && a.era === 'gilded-spa', 'the banner carries the question\'s era: ' + JSON.stringify(a));
      t.expect(/^Gilded Spa 1875–1920$/.test(a.tag), 'the period is lettered on it: ' + a.tag);
      t.expect(/sepia/.test(a.filter), 'a gilded-spa painting is sepia: ' + a.filter);
      t.expect(a.tagB <= a.capT, 'the period sits above the caption');
      await t.shot('S4-04-era-gilded');
      for (const [era, want] of [['modern', /^(none)?$/], ['roaring', /grayscale/], ['midcentury', /saturate/]]) {
        await t.game('newGame', { mode: 'era', era });
        await waitFor(t, (s) => s.scene === 'quiz' && s.question, 6000, 'the ' + era + ' quiz');
        await t.waitForStable(8000);
        const b = await look();
        t.expect(b && b.era === era, era + ' banner era: ' + JSON.stringify(b));
        t.expect(want.test(b.filter === 'none' ? '' : b.filter), `${era} filter: ${b.filter}`);
      }
      await t.checkLayout();
    },
  },
  // ---------------- S4-06 ----------------
  {
    name: 'S4-06 the postcard greeting is set in the bundled Kalam, not whatever script the system has',
    async run(t) {
      await soloGame(t, { players: [H1] });
      const s0 = await t.state();
      await landOn(t, s0.board.types.indexOf('postcard'));
      await phase(t, 'postcard');
      await t.waitForStable(8000);
      const r = await t.page.evaluate(async () => { await document.fonts.ready; const g = document.querySelector('.pc-greet'); return g && { fam: getComputedStyle(g).fontFamily, ok: document.fonts.check('1.7rem Kalam'), right: g.getBoundingClientRect().right, vw: window.innerWidth }; });
      t.expect(r && /^"?Kalam/.test(r.fam) && r.ok, 'the greeting font: ' + JSON.stringify(r));
      await t.shot('S4-06-postcard-greeting');
      await t.checkLayout();
    },
  },
];
