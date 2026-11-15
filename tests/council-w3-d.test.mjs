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

  // ---------------- S4-16 ----------------
  {
    name: 'S4-16 each Era Express card has a one-line summary of 120 characters or fewer, made only of words from its era’s own summary',
    viewports: ['desktop'],
    async run() {
      const r = inNode(`const d = await imp('data.js'); const words = (s) => s.toLowerCase().replace(/\u2019/g, "'").match(/[a-z0-9'\u2013-]+/g) || [];
        console.log(JSON.stringify(d.ERA_MODES.map((m) => { const src = new Set(m.eras.flatMap((e) => words(d.ERA[e].summary))); return { id: m.id, n: m.short.length, extra: words(m.short).filter((w) => w.length >= 5 && !src.has(w)) }; })));`);
      assert.equal(r.length, 6, 'six era cards');
      for (const m of r) { assert.ok(m.n > 20 && m.n <= 120, m.id + ' short is ' + m.n + ' characters'); assert.deepEqual(m.extra, [], m.id + ' uses only words of its era summary'); }
    },
  },
  {
    name: 'S4-16 the six Era Express cards share one height and one lightness range, with readable ink',
    initScript: withSave(VETERAN),
    async run(t) {
      await t.game('scene', 'era');
      await t.waitForStable(8000);
      const cards = await t.page.evaluate(() => {
        const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const light = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return (mx + mn) / 2 * 100; };
        return [...document.querySelectorAll('.era-card')].map((e) => { const cs = getComputedStyle(e); const L1 = lum(cs.backgroundColor), L2 = lum(cs.color); const r = e.getBoundingClientRect(); return { h: r.height, l: light(cs.backgroundColor), contrast: (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05), lines: e.querySelector('.era-sum').getBoundingClientRect().height / parseFloat(getComputedStyle(e.querySelector('.era-sum')).lineHeight || 20) }; });
      });
      t.equal(cards.length, 6, 'six cards');
      t.expect(Math.max(...cards.map((c) => c.h)) - Math.min(...cards.map((c) => c.h)) < 1.5, 'one height: ' + cards.map((c) => Math.round(c.h)).join(', '));
      t.expect(Math.min(...cards.map((c) => c.l)) >= 75 && Math.max(...cards.map((c) => c.l)) - Math.min(...cards.map((c) => c.l)) <= 12, 'one lightness range: ' + cards.map((c) => Math.round(c.l)).join(', '));
      t.expect(Math.min(...cards.map((c) => c.contrast)) >= 7, 'the ink reads on every card: ' + cards.map((c) => c.contrast.toFixed(1)).join(', '));
      const back = await rect(t, '#scene-era [data-act="goto"]');
      if (t.viewport === 'desktop') t.expect(back.bottom <= t.vp.height, 'Back is on the first screen: ' + Math.round(back.bottom));
      await t.shot('S4-16-era-cards');
    },
  },

  // ---------------- S6-18 ----------------
  {
    name: 'S6-18 the save marks a Daily as started, keeps the newest 30 days, repairs damage, and an older save reads as before',
    viewports: ['desktop'],
    async run() {
      const r = inNode(`const sv = await imp('save.js'); const mk = (init) => { const m = init ? { 'hs-trivia-v1': JSON.stringify(init) } : {}; return { m, mem: { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } } }; };
        const out = {}; const a = mk(); const s = sv.createSaveStore({ storage: () => a.mem }); s.load();
        out.before = sv.dailyTaken(s.data.daily, '2026-11-12');
        s.commitDailyStart('2026-11-12'); out.started = JSON.parse(a.m['hs-trivia-v1']).daily.started; out.after = sv.dailyTaken(s.data.daily, '2026-11-12'); out.other = sv.dailyTaken(s.data.daily, '2026-11-13');
        s.commitQuiz({ kind: 'daily', date: '2026-11-12', score: 300, right: 4, total: 7, timer: 0, marks: '1111000' }); const res = JSON.parse(a.m['hs-trivia-v1']).daily; out.result = res.results['2026-11-12'] && res.results['2026-11-12'].score; out.streak = res.streak;
        s.commitDailyStart('2026-11-12'); out.again = Object.keys(JSON.parse(a.m['hs-trivia-v1']).daily.started);
        const old = { v: 1, settings: {}, best: { quick: 0, era: {} }, daily: { last: '2026-11-03', streak: 1, results: { '2026-11-03': { score: 50, right: 3, marks: '1110000' } } }, trail: null };
        const b = mk(old); const s2 = sv.createSaveStore({ storage: () => b.mem }); s2.load(); out.oldHasKey = 'started' in s2.data.daily; out.oldTaken = sv.dailyTaken(s2.data.daily, '2026-11-03'); out.oldFree = sv.dailyTaken(s2.data.daily, '2026-11-04');
        const c = mk({ ...old, daily: { ...old.daily, started: { x: true, '2026-11-01': 'yes', '2026-11-02': true, '2026-11-05': false } } }); const s3 = sv.createSaveStore({ storage: () => c.mem }); s3.load(); out.repaired = Object.keys(s3.data.daily.started);
        const many = {}; for (let i = 1; i <= 40; i++) many['2026-10-' + String(i).padStart(2, '0')] = true;
        const d = mk({ ...old, daily: { ...old.daily, started: many } }); const s4 = sv.createSaveStore({ storage: () => d.mem }); s4.load(); s4.commitDailyStart('2026-11-20'); const kept = Object.keys(JSON.parse(d.m['hs-trivia-v1']).daily.started); out.kept = kept.length; out.newest = kept.includes('2026-11-20');
        console.log(JSON.stringify(out));`);
      assert.equal(r.before, false, 'a new date is not taken');
      assert.deepEqual(r.started, { '2026-11-12': true }, 'the first question marks the date');
      assert.equal(r.after, true); assert.equal(r.other, false, 'only that date');
      assert.equal(r.result, 300, 'a result is still written'); assert.equal(r.streak, 1);
      assert.deepEqual(r.again, ['2026-11-12'], 'starting twice marks once');
      assert.equal(r.oldHasKey, false, 'a save from before gains no key by being read');
      assert.equal(r.oldTaken, true, 'a date with a result is taken'); assert.equal(r.oldFree, false);
      assert.deepEqual(r.repaired, ['2026-11-02'], 'damaged marks fall away, a good one stays');
      assert.equal(r.kept, 30, 'at most 30 days are kept'); assert.equal(r.newest, true, 'the newest among them');
    },
  },
  {
    name: 'S6-18 an abandoned Daily makes the next run practice: labelled, not saved, no streak, nothing to share',
    initScript: withSave(VETERAN, '2026-11-12'),
    async run(t) {
      const saved = () => t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-trivia-v1')).daily);
      await t.game('newGame', { mode: 'daily', date: '2026-11-12' });
      let s = await t.state();
      t.equal(s.quiz.practice, false, 'the first run counts');
      t.equal(await t.page.evaluate(() => !!document.querySelector('.practice')), false, 'and carries no practice label');
      t.equal((await saved()).started['2026-11-12'], true, 'the first question marked the date as started');
      await t.game('act', 'ui', 'quiz-quit'); // at the first question this goes straight to the title
      await waitFor(t, (x) => x.scene === 'title', 3000, 'title');
      const lab = await t.page.evaluate(() => document.querySelector('[data-act="daily"]').textContent);
      t.expect(/started today/.test(lab) && /practice/.test(lab), 'the title button says so: ' + lab);
      await t.game('newGame', { mode: 'daily', date: '2026-11-12' });
      s = await t.state();
      t.equal(s.quiz.practice, true, 'the next run is practice');
      await t.waitForStable(8000);
      const note = await rect(t, '.practice');
      t.expect(note && note.right <= t.vp.width && note.left >= 0, 'the label fits the screen');
      t.equal(await t.page.evaluate(() => document.querySelector('.practice').textContent), 'Practice (not counted)', 'the label');
      await t.shot('S6-18-practice-label');
      for (let i = 0; i < 7; i++) { await t.game('act', 'answer', 'correct'); await t.game('act', 'continue'); }
      await waitFor(t, (x) => x.scene === 'results', 4000, 'results');
      const res = await t.page.evaluate(() => ({ eyebrow: document.querySelector('.results-card .eyebrow').textContent, share: !!document.querySelector('#share'), note: (document.querySelector('.results-card .practice') || {}).textContent }));
      t.expect(/Practice/.test(res.eyebrow) && /not counted/.test(res.note), 'the results say practice: ' + res.eyebrow);
      t.equal(res.share, false, 'there is no perfect score to post');
      const d = await saved();
      t.equal(d.results['2026-11-12'], undefined, 'no result was written for the date');
      t.equal(d.streak, 0, 'and no streak');
      await t.shot('S6-18-practice-results');
    },
  },
  {
    name: 'S6-18 a finished Daily keeps its first result; a perfect replay the same day changes nothing',
    initScript: withSave(VETERAN, '2026-11-12'),
    async run(t) {
      const saved = () => t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-trivia-v1')).daily);
      await t.game('newGame', { mode: 'daily', date: '2026-11-12' });
      for (let i = 0; i < 7; i++) { await t.game('act', 'answer', 'wrong'); await t.game('act', 'continue'); }
      await waitFor(t, (x) => x.scene === 'results', 4000, 'results');
      let d = await saved();
      t.equal(d.results['2026-11-12'].right, 0, 'the first run was written: no answers right');
      t.equal(d.streak, 1, 'a streak of one');
      await t.game('newGame', { mode: 'daily', date: '2026-11-12' });
      t.equal((await t.state()).quiz.practice, true, 'the replay is practice');
      for (let i = 0; i < 7; i++) { await t.game('act', 'answer', 'correct'); await t.game('act', 'continue'); }
      await waitFor(t, (x) => x.scene === 'results', 4000, 'results');
      d = await saved();
      t.equal(d.results['2026-11-12'].right, 0, 'the first result stands');
      await t.game('scene', 'title');
      const lab = await t.page.evaluate(() => document.querySelector('[data-act="daily"]').textContent);
      t.expect(/done today/.test(lab) && /practice/.test(lab), 'the title button: ' + lab);
    },
  },

  // ---------------- P-N06 ----------------
  {
    name: 'P-N06 a stamp space reads Landmark with a gold edge, and an ordinary Places & Landmarks space reads Places: no row says Landmarks',
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      const s0 = await t.state();
      const stamp = s0.board.landmarks['Places & Landmarks'];
      const place = s0.board.types.findIndex((ty, i) => ty === 'cat' && s0.board.cats[i] === 'Places & Landmarks');
      const row = async (id) => {
        const nb = (await t.game('act', 'adj', id))[0];
        await t.game('setState', { trail: { phase: 'roll', roll: null, dests: [], rerolled: false, players: [{ node: nb }] } });
        await t.game('act', 'roll', 1); await phase(t, 'choose'); await t.waitForStable(8000);
        return t.page.evaluate((nid) => { const b = document.querySelector('.dest[data-arg="' + nid + '"]'); if (!b) return null; const cs = getComputedStyle(b); return { sub: b.querySelector('.dsub').textContent, all: [...document.querySelectorAll('.dest .dsub')].map((e) => e.textContent), lm: b.classList.contains('lm'), edge: cs.borderLeftColor, edgeW: parseFloat(cs.borderLeftWidth) }; }, id);
      };
      let r = await row(stamp);
      t.expect(r && r.sub === 'Landmark · Places · Bathhouse Row', 'the stamp space: ' + (r && r.sub));
      t.expect(r.lm && r.edge === 'rgb(217, 162, 58)' && r.edgeW >= 5, 'with a gold edge: ' + r.edge + ' ' + r.edgeW);
      await t.shot('P-N06-stamp-row');
      r = await row(place);
      t.expect(r && r.sub === 'Places · Bathhouse Row', 'the ordinary space: ' + (r && r.sub));
      t.expect(!r.lm && r.edgeW < 5, 'and has no gold edge');
      t.expect(!r.all.some((x) => /Landmarks/.test(x)), 'no row says Landmarks: ' + r.all.join(' | '));
    },
  },

  // ---------------- S2-03 ----------------
  {
    name: 'S2-03 a human’s destination list runs left to right across the board, with no hint in its order; a computer traveler still takes its best first',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t, { seed: 11, players: [H1, { kind: 'ai', level: 'medium' }], settings: { seenCoach: true } });
      await t.game('act', 'stopAI');
      const s0 = await t.state();
      const geo = await t.game('act', 'geo');
      const order = (ids) => ids.slice().sort((a, b) => geo.nodes[a].x - geo.nodes[b].x || geo.nodes[a].y - geo.nodes[b].y || a - b);
      const stamp = s0.board.landmarks['Places & Landmarks'];
      const near = (await t.game('act', 'adj', stamp))[0];
      let seenMany = 0, notBestFirst = 0;
      for (const [from, n] of [[near, 1], [near, 2], [s0.board.start, 3], [s0.board.start, 5], [s0.board.landmarks['Sports'], 2], [s0.board.landmarks['History'], 4]]) {
        await t.game('setState', { trail: { phase: 'roll', roll: null, dests: [], rerolled: false, players: [{ node: from }] } });
        await t.game('act', 'roll', n);
        const s = await phase(t, ['choose', 'stuck']);
        if (s.trail.phase !== 'choose') continue;
        t.equal(s.trail.dests.join(), order(s.trail.dests).join(), `from space ${from} with a ${n}: left to right`);
        t.equal(s.trail.sel, 0, 'the first row is selected, whatever it is');
        if (s.trail.dests.length > 1) seenMany++;
        if (s.trail.dests[0] !== stamp && s.trail.dests.includes(stamp)) notBestFirst++;
      }
      t.expect(seenMany >= 3, 'several lists with more than one row were checked: ' + seenMany);
      t.expect(notBestFirst >= 1, 'a list where the stamp space is on offer but is not first: ' + notBestFirst);
      // the arrow keys step across the map in that order
      await t.game('setState', { trail: { phase: 'roll', roll: null, dests: [], rerolled: false, players: [{ node: near }] } });
      await t.game('act', 'roll', 1);
      let s = await phase(t, 'choose');
      await t.page.keyboard.press('ArrowRight');
      s = await t.state();
      t.equal(s.trail.sel, 1 % s.trail.dests.length, 'ArrowRight selects the next space to the right');
      // the computer traveler's own list is still best first (the stamp space scores highest)
      await t.game('setState', { trail: { turn: 1, phase: 'roll', roll: null, dests: [], rerolled: false, players: [{}, { node: near }] } });
      await t.game('act', 'roll', 1);
      s = await phase(t, 'choose');
      t.equal(s.trail.dests[0], stamp, 'a computer traveler takes the stamp space first');
    },
  },

  // ---------------- S3-04 ----------------
  {
    name: 'S3-04 every named computer traveler has a persona with as many strong categories as weak ones, so a level’s accuracy is unchanged, and the strong ones steer its choice of space',
    viewports: ['desktop'],
    async run() {
      const r = inNode(`const g = await imp('game.js'); const d = await imp('data.js');
        g.G.state = { trail: { target: 6, players: [] } };
        const cats = d.CATS.map((c) => c.id); const out = { sums: {}, bad: [], traits: {}, steer: {} };
        for (const [name, ps] of Object.entries(g.AI_PERSONAS)) {
          out.sums[name] = +cats.reduce((a, c) => a + g.personaShift({ persona: name }, c), 0).toFixed(9);
          for (const c of [...ps.up, ...ps.down]) if (!cats.includes(c)) out.bad.push(name + ' unknown category ' + c);
          if (ps.up.some((c) => ps.down.includes(c))) out.bad.push(name + ' is strong and weak in one category');
          if (ps.up.length !== ps.down.length) out.bad.push(name + ' has unequal strong and weak lists');
          out.traits[name] = g.personaTrait(name);
        }
        out.defaults = g.defaultNames(['easy', 'medium', 'hard', 'medium', 'medium', 'medium'].map((level) => ({ kind: 'ai', level })));
        out.known = out.defaults.every((n) => !!g.AI_PERSONAS[n]);
        let lo = 1, hi = 0; for (const l of ['easy', 'medium', 'hard']) for (const df of ['easy', 'medium', 'hard']) for (const c of cats) for (const n of Object.keys(g.AI_PERSONAS)) { const v = g.AI_ACC[l][df] + g.personaShift({ persona: n }, c); lo = Math.min(lo, v); hi = Math.max(hi, v); }
        out.lo = lo; out.hi = hi;
        const p = (persona) => ({ stamps: [], tickets: 3, persona, level: 'medium' });
        const at = (cat) => g.NODES.find((n) => n.type === 'cat' && n.cat === cat).id;
        const diff = (persona, cat) => g.scoreDest(p(persona), at(cat)) - g.scoreDest(p(undefined), at(cat));
        out.steer = { strong: diff('Doc Vapor', 'Sports'), weak: diff('Doc Vapor', 'Legends & Oddities'), flat: diff('The Professor', 'Sports'), none: diff(undefined, 'Sports') };
        g.ECON.AI_PERSONA_STEER = 0; out.steerOff = diff('Doc Vapor', 'Sports');
        console.log(JSON.stringify(out));`);
      assert.deepEqual(r.bad, [], 'personas are well formed');
      for (const [name, sum] of Object.entries(r.sums)) assert.equal(sum, 0, name + ' shifts add up to nothing over the eight categories');
      assert.equal(r.known, true, 'every default AI name has a persona: ' + r.defaults.join(', '));
      assert.ok(r.lo >= 0.05 && r.hi <= 0.97, 'a chance stays inside 5 to 97 percent: ' + r.lo + ' to ' + r.hi);
      assert.equal(r.traits['The Professor'], 'Even across every category.');
      assert.equal(r.traits['Doc Vapor'], 'Sharp on Sports, Nature & Lakes. Shaky on Legends, Entertainment.');
      assert.equal(r.steer.strong, 6, 'an ordinary space of a strong category scores 6 more'); assert.equal(r.steer.weak, 0); assert.equal(r.steer.flat, 0); assert.equal(r.steer.none, 0);
      assert.equal(r.steerOff, 0, 'with the constant at 0 the score is what it was');
    },
  },
  {
    name: 'S3-04 a persona answers about 20 points better in a strong category than a weak one, in the engine’s own accuracy rule',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t);
      await t.seed(31); // the draws below are fixed by this seed: the same answer every run
      const r = await t.game('act', 'aiSample', 'medium', 3000, 'Doc Vapor');
      const flat = await t.game('act', 'aiSample', 'medium', 3000, 'The Professor');
      t.expect(r.cat['Sports'] - r.cat['Legends & Oddities'] > 0.14, `Doc Vapor: Sports ${r.cat['Sports']} against Legends ${r.cat['Legends & Oddities']}`);
      t.expect(Math.abs(r.cat['History'] - 0.6) < 0.04, 'a category outside both lists stays at the Medium level (0.6): ' + r.cat['History']);
      const spread = Math.max(...Object.values(flat.cat)) - Math.min(...Object.values(flat.cat));
      t.expect(spread < 0.06, 'The Professor is the same everywhere: spread ' + spread.toFixed(3));
    },
  },
  {
    name: 'S3-04 the setup row and the traveler list say what a computer traveler is good and bad at; a trip saved before has no persona and shows nothing',
    initScript: withSave(VETERAN),
    async run(t) {
      await t.game('scene', 'setup');
      await t.waitForStable(8000);
      const row = async (i) => t.page.evaluate((k) => { const li = document.querySelectorAll('.seat')[k]; const e = li.querySelector('.trait'); const r = e && e.getBoundingClientRect(); return e ? { text: e.textContent, right: r.right, left: r.left, w: innerWidth } : null; }, i);
      t.equal(await row(0), null, 'a human seat has none');
      let r = await row(1);
      t.equal(r.text, 'Sharp on History, Places. Shaky on Sports, Nature & Lakes.', 'the Medium computer is Miss Promenade');
      t.expect(r.left >= 0 && r.right <= r.w, 'and fits the screen');
      await t.shot('S3-04-setup-trait');
      await t.page.selectOption('#seat-kind-1', 'ai:hard');
      r = await t.page.evaluate(() => document.querySelectorAll('.seat')[1].querySelector('.trait').textContent);
      t.equal(r, 'Even across every category.', 'a Hard computer is The Professor');
      await t.page.selectOption('#seat-kind-1', 'ai:easy');
      await t.game('act', 'ui', 'start-trail');
      await waitFor(t, (s) => s.scene === 'game', 4000, 'game');
      await t.game('act', 'stopAI');
      await t.waitForStable(8000);
      const s = await t.state();
      t.equal(s.trail.players[1].persona, 'Doc Vapor', 'the traveler carries its persona');
      const list = await t.page.evaluate(() => [...document.querySelectorAll('.players .pl')].map((l) => (l.querySelector('.trait') || {}).textContent || ''));
      t.equal(list[0], '', 'no line for the human');
      t.equal(list[1], 'Sharp on Sports, Nature & Lakes. Shaky on Legends, Entertainment.', 'the traveler list says it');
      await t.shot('S3-04-panel-trait');
      await t.game('setState', { trail: { players: [{}, { persona: undefined }] } });
      await t.waitForStable(8000);
      const list2 = await t.page.evaluate(() => [...document.querySelectorAll('.players .pl')].map((l) => (l.querySelector('.trait') || {}).textContent || ''));
      t.equal(list2[1], '', 'a traveler from before the personas shows no line, and nothing breaks');
    },
  },

  // ---------------- S4-07 ----------------
  {
    name: 'S4-07 a new trip opens with a short departure card that takes no taps and goes by itself',
    initScript: withSave(VETERAN),
    async run(t) {
      await t.game('scene', 'setup');
      await t.waitForStable(8000);
      await t.game('act', 'ui', 'start-trail');
      await waitFor(t, (s) => s.scene === 'game', 4000, 'game');
      await t.game('act', 'stopAI');
      await t.page.waitForFunction(() => document.querySelector('#toast').classList.contains('on'), null, { timeout: 4000 }).catch(() => t.fail('no departure card'));
      const card = await t.page.evaluate(() => { const e = document.querySelector('#toast'); const r = e.getBoundingClientRect(); const p = document.querySelector('#panel').getBoundingClientRect(); return { text: e.textContent, events: getComputedStyle(e).pointerEvents, r: { l: r.left, t: r.top, rt: r.right, b: r.bottom }, p: { l: p.left, t: p.top, rt: p.right, b: p.bottom }, vw: innerWidth }; });
      t.expect(/Departure/.test(card.text) && /All aboard at Arlington Lawn/.test(card.text) && /Collect 6 stamps, then climb the Mountain Tower\./.test(card.text), 'the card: ' + card.text);
      t.equal(card.events, 'none', 'it takes no taps');
      const overlap = card.r.l < card.p.rt && card.r.rt > card.p.l && card.r.t < card.p.b && card.r.b > card.p.t;
      t.expect(!overlap && card.r.l >= 0 && card.r.rt <= card.vw, 'it does not cover the panel or leave the screen');
      await t.shot('S4-07-departure-card');
      // the roll button still works with the card up
      await t.page.click('[data-act="roll"]');
      await phase(t, ['choose', 'stuck']);
      await t.page.waitForFunction(() => !document.querySelector('#toast').classList.contains('on'), null, { timeout: 8000 }).catch(() => t.fail('the departure card did not go away'));
    },
  },
  {
    name: 'S4-07 the win card says who won and by how much: a close race, a clear lead, or that a computer beat you to the summit',
    async run(t) {
      const cardText = async () => t.page.evaluate(() => ({ h: document.querySelector('.win-card h2').textContent, line: (document.querySelector('.win-card .win-line') || {}).textContent || '' }));
      const ALL6 = ['Sports', 'Entertainment', 'Nature & Lakes', 'People', 'History', 'Places & Landmarks'];
      const finish = async (s0, winner) => {
        await moveTo(t, s0.board.tower - 1, 1, s0.board.tower);
        await t.game('act', 'continue');
        await phase(t, 'question');
        await t.game('act', 'answer', 'correct');
        await phase(t, 'feedback');
        await t.game('act', 'continue');
        return waitFor(t, (x) => x.scene === 'win', 4000, 'win scene');
      };
      // a human wins with the computer a few stamps behind
      await soloGame(t, { players: [H1, { kind: 'ai', level: 'hard' }], settings: { seenCoach: true } });
      let s0 = await t.state();
      await t.game('act', 'stopAI');
      await t.game('setState', { trail: { players: [{ stamps: ALL6, tickets: 7 }, { stamps: ALL6.slice(0, 3) }] } });
      await finish(s0);
      let c = await cardText();
      t.equal(c.h, 'Ada conquered the Mountain Tower!', 'the title when a person wins');
      t.equal(c.line, 'The next traveler, The Professor, held 3 of 6 stamps.', 'a clear lead');
      await t.shot('S4-07-win-human');
      // the same, with the computer holding every stamp too
      await soloGame(t, { players: [H1, { kind: 'ai', level: 'hard' }], settings: { seenCoach: true } });
      s0 = await t.state();
      await t.game('act', 'stopAI');
      await t.game('setState', { trail: { players: [{ stamps: ALL6, tickets: 7 }, { stamps: ALL6 }] } });
      await finish(s0);
      c = await cardText();
      t.equal(c.line, 'A close race: The Professor held all 6 stamps too.', 'a close race');
      // a computer traveler wins: the person is told they were beaten to the summit
      await soloGame(t, { players: [{ kind: 'ai', level: 'hard' }, H1], settings: { seenCoach: true } });
      s0 = await t.state();
      await t.game('act', 'stopAI');
      await t.game('setState', { trail: { players: [{ stamps: ALL6, tickets: 7 }, { stamps: ALL6.slice(0, 2) }] } });
      await finish(s0);
      c = await cardText();
      t.equal(c.h, 'The Professor reached the Mountain Tower first!', 'the title when a computer wins');
      t.equal(c.line, 'You were beaten to the summit. The mountain will wait.', 'and the person is told');
      await t.shot('S4-07-win-computer');
      await t.checkLayout({ allowScrollY: true });
    },
  },
  {
    name: 'S4-07 a quiz result is a postcard with a score stamp and a line for how it went',
    async run(t) {
      const tiers = [[10, 'Spa City local'], [7, 'Bathhouse Row regular'], [5, 'Getting to know the Row'], [0, 'Visiting for the first time']];
      for (const [right, tier] of tiers) {
        await t.game('newGame', { mode: 'quick', seed: 5 });
        for (let i = 0; i < 10; i++) { await t.game('act', 'answer', i < right ? 'correct' : 'wrong'); await t.game('act', 'continue'); }
        await waitFor(t, (s) => s.scene === 'results', 4000, 'results');
        await t.waitForStable(8000);
        const r = await t.page.evaluate(() => ({ stamp: document.querySelector('.rc-head .pc-stamp').textContent, tier: document.querySelector('.rc-tier').textContent, greet: document.querySelector('.rc-head .pc-greet').textContent }));
        t.equal(r.stamp, right + '/10', 'the stamp shows the score');
        t.equal(r.tier, tier, `${right} of 10`);
        t.equal(r.greet, 'Greetings from Hot Springs', 'the postcard greeting');
        if (right === 7) {
          await t.page.waitForFunction(() => !document.querySelector('#toast').classList.contains('on') && getComputedStyle(document.querySelector('#toast')).opacity === '0', null, { timeout: 20000 }).catch(() => {});
          await t.page.evaluate(() => { const c = document.querySelector('.results-card'); c.parentElement.scrollTop = 0; window.scrollTo(0, 0); });
          await t.shot('S4-07-quiz-postcard');
        }
      }
      await t.checkLayout({ allowScrollY: true });
    },
  },
];
