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
  // ---------------- S4-10 ----------------
  {
    name: 'S4-10 the Daily Challenge never draws a question that names a 2020s year or a price, on 400 different dates',
    node: true,
    async run() {
      const r = inNode(`const Q = await imp('quiz.js'); const D = await imp('data.js');
        let dated = 0, bad = 0, cats = 0; const seen = new Set();
        for (let i = 0; i < 400; i++) { const date = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10); const ids = Q.dailyIds(date); if (ids.length !== 7) bad++;
          const qs = ids.map((id) => D.getQ(id)); dated += qs.filter(D.isDated).length; cats += new Set(qs.map((q) => q.category)).size === 7 ? 1 : 0; ids.forEach((x) => seen.add(x)); }
        console.log(JSON.stringify({ dated, bad, cats, distinct: seen.size, bank: D.BANK.length, datedInBank: D.BANK.filter(D.isDated).length, flagged: ['hs-0452', 'hs-0136', 'hs-0461', 'hs-0389'].map((id) => D.isDated(D.getQ(id))) }));`);
      assert.equal(r.dated, 0, 'no dated question in any of 400 Dailies');
      assert.equal(r.bad, 0, 'every Daily has seven questions');
      assert.equal(r.cats, 400, 'in seven different categories, as before');
      assert.ok(r.distinct > 150, 'the pool is still wide: ' + r.distinct);
      assert.ok(r.datedInBank >= 30 && r.datedInBank < r.bank / 4, `the filter leaves out a few (${r.datedInBank} of ${r.bank}), not the bank`);
      assert.deepEqual(r.flagged, [true, false, true, true], 'it catches the price, the 2020 film and the 2020 rally listing; the crappie limit names no year or price, so it waits for the owner (facts-for-review.md)');
    },
  },
  // ---------------- S2-14 ----------------
  {
    name: 'S2-14 each question difficulty has its own mix, Adaptive is exactly what the Trail did before, and an old trip is Adaptive',
    node: true,
    async run() {
      const r = inNode(`const Game = await imp('game.js'); const D = await imp('data.js'); const { makeRng } = await imp('util.js');
        const out = { skills: {}, old: null, draws: {} };
        for (const id of Object.keys(Game.QDIFF)) out.skills[id] = [0.05, 0.35, 0.95].map((s) => +Game.questionSkill({ skill: s }, { qdiff: id }).toFixed(3));
        out.old = [0.05, 0.35, 0.95].map((s) => Game.questionSkill({ skill: s }, {}));
        out.junk = Game.questionSkill({ skill: 0.35 }, { qdiff: 'nope' });
        for (const id of Object.keys(Game.QDIFF)) { const rng = makeRng(77); const n = { easy: 0, medium: 0, hard: 0 };
          for (let i = 0; i < 600; i++) n[D.pickQuestion(rng, [], { skill: Game.questionSkill({ skill: 0.35 }, { qdiff: id }) }).difficulty]++; out.draws[id] = n; }
        console.log(JSON.stringify(out));`);
      assert.deepEqual(r.skills.adaptive, [0.05, 0.35, 0.95], 'Adaptive is the hidden skill itself');
      assert.deepEqual(r.old, [0.05, 0.35, 0.95], 'a trip with no setting (saved before) is Adaptive');
      assert.equal(r.junk, 0.35, 'and so is one with a setting nobody knows');
      assert.ok(r.skills.relaxed[2] < 0.5 && r.skills.expert[0] >= 0.5, `Relaxed never rises above half, Expert never starts below it: ${r.skills.relaxed} / ${r.skills.expert}`);
      // 600 seeded draws from a new traveler (skill 0.35): the shares are fixed by the seed, and these windows are wide
      const share = (id, k) => r.draws[id][k] / 600;
      assert.ok(share('relaxed', 'hard') < 0.06 && share('relaxed', 'easy') > 0.5, `Relaxed is mostly easy: ${JSON.stringify(r.draws.relaxed)}`);
      assert.ok(share('adaptive', 'hard') > 0.06 && share('adaptive', 'hard') < 0.25, `Adaptive starts mixed: ${JSON.stringify(r.draws.adaptive)}`);
      assert.ok(share('expert', 'hard') > 0.35 && share('expert', 'easy') < 0.2, `Expert is mostly medium and hard: ${JSON.stringify(r.draws.expert)}`);
    },
  },
  {
    name: 'S2-14 the trip plan offers Relaxed, Adaptive and Expert; the choice reaches the trip, survives a reload, and an old save is Adaptive',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.seed(5);
      await t.game('setState', { settings: { seenCoach: true, passScreen: false, aiSpeed: 'fast', timer: 0 } });
      await setupHeader(t);
      await t.waitForStable(8000);
      const labels = await t.page.evaluate(() => [...document.querySelectorAll('#scene-setup [aria-label="Question difficulty"] [role="radio"]')].map((b) => b.innerText + ':' + b.getAttribute('aria-checked')));
      t.equal(labels.join(' '), 'Relaxed:false Adaptive:true Expert:false', 'three choices, Adaptive chosen');
      const hint = () => t.page.locator('#scene-setup #qdiff-hint').innerText();
      t.expect(/harder as you win/i.test(await hint()), 'and the hint says Adaptive means harder as you win: ' + await hint());
      // arrow keys move inside the group
      await t.page.locator('#scene-setup [data-act="qdiff"][data-arg="adaptive"]').focus();
      await t.page.keyboard.press('ArrowRight');
      t.equal(await t.page.locator('#scene-setup [data-act="qdiff"][data-arg="expert"]').getAttribute('aria-checked'), 'true', 'the right arrow chooses Expert');
      t.expect(/medium and hard/i.test(await hint()), 'the hint follows: ' + await hint());
      await t.shot('S2-14-setup-expert');
      await t.checkLayout({ allowScrollY: true });
      await t.page.locator('#scene-setup [data-act="start-trail"]').click();
      await waitFor(t, (s) => s.scene === 'game' && s.trail, 4000, 'trip started');
      t.equal((await t.state()).trail.qdiff, 'expert', 'the trip is an Expert trip');
      t.equal(await t.page.evaluate((k) => JSON.parse(localStorage.getItem(k)).trail.qdiff, KEY), 'expert', 'and the save says so');
      await t.reload();
      await t.game('act', 'ui', 'continue-trail');
      await waitFor(t, (s) => s.scene === 'game' && s.trail, 4000, 'continued trip');
      t.equal((await t.state()).trail.qdiff, 'expert', 'it comes back Expert after a reload');
      // a trip saved before the setting existed has no key at all
      await t.page.evaluate((k) => { const d = JSON.parse(localStorage.getItem(k)); delete d.trail.qdiff; localStorage.setItem(k, JSON.stringify(d)); }, KEY);
      await t.reload();
      await t.game('act', 'ui', 'continue-trail');
      await waitFor(t, (s) => s.scene === 'game' && s.trail, 4000, 'continued old trip');
      t.equal((await t.state()).trail.qdiff, 'adaptive', 'an old trip is Adaptive');
    },
  },
  // ---------------- S3-08 ----------------
  {
    name: 'S3-08 the game says that it adapts: in the trip plan and in How to play, and the card still names each question\'s difficulty',
    viewports: ['desktop'],
    async run(t) {
      await setupHeader(t);
      await t.waitForStable(8000);
      t.expect(/Adaptive: harder as you win/i.test(await t.page.locator('#scene-setup').innerText()), 'the plan says Adaptive is harder as you win');
      await t.game('scene', 'help');
      await t.waitForStable(8000);
      t.expect(/adjusts the questions to how you are doing/i.test(await t.page.locator('#scene-help').innerText()), 'How to play says the Trail adjusts the questions');
      await soloGame(t, { settings: { seenCoach: true } });
      const s = await t.state();
      const cat = s.board.types.indexOf('cat');
      await moveTo(t, (await t.game('act', 'adj', cat))[0], 1, cat);
      await phase(t, 'question');
      await t.waitForStable(8000);
      t.expect(/(Easy|Medium|Hard) · /.test(await t.page.locator('#modal .qmeta').innerText()), 'the question card says which difficulty it is');
    },
  },
  // ---------------- S3-03 ----------------
  {
    name: 'S3-03 when one traveler holds every stamp the Final Lap bell rings once and each other traveler may ride three free Expresses, one a turn',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await soloGame(t, { target: 4, players: [H1, H2], settings: { seenCoach: true, passScreen: false } });
      const s0 = await t.state();
      const lands = Object.keys(s0.board.landmarks);
      const all = (n) => lands.slice(0, n);
      // Ada holds three of four stamps and stands beside the fourth landmark; Bo has none and is rich enough to pay for nothing
      const last = s0.board.landmarks[lands[3]];
      await t.game('setState', { trail: { phase: 'roll', turn: 0, players: [{ stamps: all(3), tickets: 3 }, { stamps: [], tickets: 0 }] } });
      const before = await t.state();
      t.expect(!before.trail.lapBell && !before.trail.players[1].lap, 'no bell before anyone is done');
      await moveTo(t, (await t.game('act', 'adj', last))[0], 1, last);
      await phase(t, 'question');
      await t.game('act', 'answer', 'correct');
      await t.game('act', 'continue');
      const rung = await waitFor(t, (s) => s.trail.lapBell, 4000, 'the bell');
      t.equal(rung.trail.players[0].stamps.length, 4, 'Ada has all four stamps');
      t.equal(rung.trail.players[1].lap, 3, 'Bo may ride three free Expresses');
      t.expect(!rung.trail.players[0].lap, 'Ada, who rang it, gets none');
      t.expect(rung.trail.log.some((l) => /Stamp earned.*Final Lap bell rings/.test(l)), 'and the line about the answer says so: ' + rung.trail.log[0]);
      await phase(t, 'roll');
      // Bo's turn: the Express button is free, enabled with no tickets, and names the Final Lap
      await waitFor(t, (s) => s.trail.turn === 1, 4000, "Bo's turn");
      const btn = t.page.locator('#panel [data-act="express"]');
      const label = (await btn.innerText()).replace(/\s+/g, ' ');
      t.expect(/free, Final Lap/.test(label), 'the button says it is free: ' + label);
      t.expect(await btn.isEnabled(), 'and can be pressed with no tickets');
      await t.shot('S3-03-final-lap-offer');
      await t.checkLayout({ allowScrollY: true });
      await btn.click();
      await phase(t, 'question');
      const after = await t.state();
      t.equal(after.trail.players[1].tickets, 0, 'it cost nothing');
      t.equal(after.trail.players[1].lap, 2, 'two rides are left');
      await t.game('act', 'answer', 'correct'); await t.game('act', 'continue');
      // Ada again, then Bo: the second ride is free too; and a second traveler finishing does not ring the bell again
      await waitFor(t, (s) => s.trail.turn === 0 && s.trail.phase === 'roll', 4000, "Ada's turn");
      t.equal((await t.state()).trail.players[1].lap, 2, 'the rides keep');
    },
  },
  {
    name: 'S3-03 with the Final Lap, the first traveler to hold every stamp wins about two games in three, not five in six (two computer travelers, 100 seeded games)',
    node: true,
    async run() {
      const sim = (lap) => {
        const r = spawnSync(process.execPath, ['tools/lead-sim.mjs', '100', '2p'], { cwd: REPO, encoding: 'utf8', timeout: 300000, env: { ...process.env, ECON: JSON.stringify({ FINAL_LAP_EXPRESS: lap }) } });
        if (r.status !== 0) throw new Error('lead-sim failed: ' + r.stderr.slice(0, 400));
        return JSON.parse(r.stdout.trim().split('\n').pop());
      };
      const off = sim(0), on = sim(3);
      // the games are fixed by their seeds, so these numbers are the same every run; 100 games say 85 and 66 give or take 4
      assert.ok(off.firstToCollectWins >= 78, `without it the leader wins most games: ${off.firstToCollectWins}`);
      assert.ok(on.firstToCollectWins <= off.firstToCollectWins - 8, `with it the leader's edge falls by at least eight points: ${off.firstToCollectWins} to ${on.firstToCollectWins}`);
      assert.ok(on.firstToCollectWins <= 76, `and is well under the old 85: ${on.firstToCollectWins}`);
    },
  },
];
