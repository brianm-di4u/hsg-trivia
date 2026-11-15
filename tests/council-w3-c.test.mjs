// Council wave 3, batch C: difficulty, progression and records
// (S6-07, P-N02, S4-10, S2-14, S3-03, S3-08, S4-08).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { H1, H2, soloGame, moveTo, waitFor, phase } from './helpers.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const KEY = 'hs-trivia-v1';
// The harness serializes initScript with toString, so a per-case script carries its data in its own source.
const withSave = (obj, today) => {
  const f = () => {};
  f.toString = () => `() => { ${today ? `window.__TEST_DATE__ = ${JSON.stringify(today)};` : ''} if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('hs-trivia-v1', JSON.stringify(${JSON.stringify(obj)})); } }`;
  return f;
};
const VETERAN = { v: 1, settings: { sound: true, volume: 0.7, timer: 0, aiSpeed: 'normal', seenCoach: true }, best: { quick: 0, era: {} }, daily: { last: null, streak: 0, results: {} }, trail: null };
const day = (d) => ({ score: 100, right: 5, marks: 'xxxxxxx', d });
const STREAKY = { ...VETERAN, daily: { last: '2026-11-03', streak: 3, results: { '2026-11-01': day(), '2026-11-02': day(), '2026-11-03': day() } } };
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
const setupHeader = (t) => t.game('scene', 'setup');

export const tests = [
  // ---------------- S6-07 ----------------
  {
    name: 'S6-07 the page, the panel, the question sheet and the top bar keep clear of a notch and the home indicator',
    async run(t) {
      // A real device supplies env(safe-area-inset-*); the page reads it through three variables, which the test sets by hand.
      const set = (l, r, b) => t.page.evaluate(([a, c, d]) => { const s = document.documentElement.style; s.setProperty('--sal', a + 'px'); s.setProperty('--sar', c + 'px'); s.setProperty('--sab', d + 'px'); }, [l, r, b]);
      const vw = t.vp.width;
      await t.game('scene', 'title');
      await t.waitForStable(8000);
      const flat = await rect(t, '.page');
      t.equal(flat.left, 0, 'with no inset the page is edge to edge: left');
      t.equal(flat.right, vw, 'and right');
      await set(44, 44, 34);
      const page = await rect(t, '.page');
      t.equal(page.left, 44, 'the title page starts after the left inset');
      t.equal(page.right, vw - 44, 'and ends before the right inset');
      t.equal(Math.round(page.bottom), t.vp.height - 34, 'and stops above the home indicator');
      const bar = await t.page.evaluate(() => { const b = document.querySelector('#topbar'); const k = [...b.querySelectorAll('button')]; const f = k[0].getBoundingClientRect(), l = k[k.length - 1].getBoundingClientRect(); return { first: f.left, last: l.right }; });
      t.expect(bar.first >= 44, `the first top-bar button is clear of the notch: ${bar.first}`);
      t.expect(bar.last <= vw - 44, `the last top-bar button is clear of the notch: ${bar.last}`);
      // the game: panel and the question sheet
      await set(0, 0, 0);
      await soloGame(t, { settings: { seenCoach: true } });
      await t.waitForStable(8000);
      const base = await rect(t, '#panel');
      await set(44, 44, 34);
      const ph = await rect(t, '#panel');
      const inner = await t.page.evaluate(() => { const p = document.querySelector('#panel'); const kids = [...p.children].filter((c) => getComputedStyle(c).display !== 'none'); const pr = p.getBoundingClientRect(); const rs = kids.map((c) => c.getBoundingClientRect()); const cs = getComputedStyle(p); return { right: Math.max(...rs.map((r) => r.right)), pr: pr.right, padB: parseFloat(cs.paddingBottom), padR: parseFloat(cs.paddingRight), padL: parseFloat(cs.paddingLeft) }; });
      if (t.viewport === 'mobile') {
        t.equal(Math.round(ph.h - base.h), 34, 'the bottom sheet grows by the home-indicator inset (it is part of --panel-h)');
        t.expect(inner.padB >= 10 + 34 - 0.5, `its buttons sit above the home indicator: bottom padding ${inner.padB}`);
        t.expect(inner.padL >= 10 + 44 - 0.5 && inner.padR >= 10 + 44 - 0.5, `and inside the side insets: ${inner.padL} / ${inner.padR}`);
        const stage = await rect(t, '#stage');
        t.equal(Math.round(stage.bottom), Math.round(ph.top), 'the board stage still meets the sheet exactly');
      } else {
        t.expect(inner.padR >= 12 + 44 - 0.5, `the side panel keeps its content clear of the right inset: padding ${inner.padR}`);
        t.expect(inner.right <= ph.right - 44 + 0.5, `and its content ends before the notch: ${inner.right} of ${ph.right}`);
      }
      // an open question docks into the panel's place and keeps clear as well
      await t.game('act', 'roll', 3); await phase(t, 'choose');
      await t.game('setState', { trail: { phase: 'roll' } });
      const s = await t.state();
      const cat = s.board.types.indexOf('cat');
      await moveTo(t, (await t.game('act', 'adj', cat))[0], 1, cat);
      await phase(t, 'question');
      await t.waitForStable(8000);
      const dock = await t.page.evaluate(() => { const m = document.querySelector('#modal'); const s = getComputedStyle(m); return { padB: parseFloat(s.paddingBottom), padR: parseFloat(s.paddingRight), cls: m.className }; });
      t.expect(/dock/.test(dock.cls), 'the question is docked');
      t.expect(dock.padR >= 8 + 44 - 0.5, `the docked question card keeps clear of the right inset: ${dock.padR}`);
      if (t.viewport === 'mobile') t.expect(dock.padB >= 8 + 34 - 0.5, `and of the home indicator: ${dock.padB}`);
      await set(0, 0, 0);
    },
  },
  // ---------------- P-N02 ----------------
  {
    name: 'P-N02 the streak shown is 0 once a whole day has been missed, and the stored streak is left alone',
    node: true,
    async run() {
      const { liveStreak } = await import('../src/js/save.js');
      const d = { last: '2026-11-03', streak: 3 };
      assert.equal(liveStreak(d, '2026-11-03'), 3, 'played today: the streak stands');
      assert.equal(liveStreak(d, '2026-11-04'), 3, 'played yesterday: it can still be kept today');
      assert.equal(liveStreak(d, '2026-11-05'), 0, 'a day missed: it is gone');
      assert.equal(liveStreak(d, '2026-12-25'), 0, 'weeks later: gone');
      assert.equal(liveStreak({ last: '2026-02-28', streak: 2 }, '2026-03-01'), 2, 'across the end of a month');
      assert.equal(liveStreak({ last: '2026-12-31', streak: 2 }, '2027-01-01'), 2, 'and of a year');
      assert.equal(liveStreak({ last: null, streak: 0 }, '2026-11-03'), 0, 'no dailies yet');
      assert.equal(liveStreak(undefined, '2026-11-03'), 0, 'no daily record at all');
      assert.equal(liveStreak({ last: null, streak: 5 }, '2026-11-03'), 0, 'a streak with no date cannot be shown');
      assert.equal(liveStreak({ last: '2026-11-03', streak: 'x' }, '2026-11-03'), 0, 'a damaged streak shows nothing');
    },
  },
  {
    name: 'P-N02 the title and the record show 0 after a missed day and the streak on the day after a Daily; the save keeps the number',
    initScript: withSave(STREAKY, '2026-11-12'),
    async run(t) {
      await t.game('scene', 'title');
      await t.waitForStable(8000);
      t.expect(/Daily streak: 0\b/.test(await t.page.locator('#scene-title .foot').innerText()), 'the title says 0 nine days after the last Daily');
      await t.game('scene', 'record');
      await t.waitForStable(8000);
      const row = await t.page.evaluate(() => [...document.querySelectorAll('#scene-record .rec-list li')].map((l) => l.innerText.replace(/\s+/g, ' ')).find((x) => /Daily Challenge streak/.test(x)));
      t.expect(/streak\s*0$/.test(row), 'the record says 0 too: ' + row);
      const saved = await t.page.evaluate((k) => JSON.parse(localStorage.getItem(k)).daily, KEY);
      t.equal(saved.streak, 3, 'the stored number is untouched');
      // the day after the last Daily: still alive
      await t.page.evaluate(() => { window.__TEST_DATE__ = '2026-11-04'; });
      await t.game('scene', 'title');
      await t.waitForStable(8000);
      t.expect(/Daily streak: 3\b/.test(await t.page.locator('#scene-title .foot').innerText()), 'the title says 3 the day after');
      await t.shot('P-N02-title-streak');
    },
  },
];
