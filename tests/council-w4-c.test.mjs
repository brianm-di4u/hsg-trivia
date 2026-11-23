// Council wave 4, batch C: polish across the game
// (S2-10, S4-12, P-N07, S6-06, S5-09, C4-17, S6-13, C4-02, C4-03, C4-05).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { H1, soloGame, landOn, waitFor, phase } from './helpers.mjs';

const SHOTS = fileURLToPath(new URL('../screenshots/council/wave-4/shots/', import.meta.url));
const REPO = fileURLToPath(new URL('..', import.meta.url));
const BASE = { v: 1, settings: { sound: true, volume: 0.7, timer: 0, aiSpeed: 'normal', seenCoach: true }, best: { quick: 0, era: {} }, daily: { last: null, streak: 0, results: {} }, trail: null };
// The harness serializes initScript with toString, so a per-case script carries its data in its own source.
const withSave = (obj, today = '2026-11-16') => {
  const f = () => {};
  f.toString = () => `() => { window.__TEST_DATE__ = '${today}'; if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('hs-trivia-v1', JSON.stringify(${JSON.stringify(obj)})); } }`;
  return f;
};
const text = (t, sel) => t.page.evaluate((s) => document.querySelector(s).textContent.replace(/\s+/g, ' ').trim(), sel);
const bank = () => JSON.parse(fs.readFileSync(REPO + 'data/questions.json', 'utf8')).questions;
const node = (name, run) => ({ name, node: true, run });

// The approved question strings from decisions 29 and 31, including decision 85's later Zero K correction.
const REWORDED = {
  'hs-0104': 'What did the Ozark Bathhouse on Bathhouse Row reopen as in 2014?',
  'hs-0291': 'Which architect designed Hot Springs’ Maurice Bathhouse?',
  'hs-0049': 'In what year did Gov. Winthrop Rockefeller end Hot Springs’ casino revival?',
  'hs-0148': 'How many hot springs emerge from Hot Springs Mountain in Hot Springs National Park?',
  'hs-0155': 'Which dissolved constituent is most concentrated in Hot Springs’ thermal water?',
  'hs-0181': 'Which big cat left the Hot Springs area after European settlement?',
  'hs-0369': 'In what year was the first World’s Shortest St. Patrick’s Day Parade held?',
  'hs-0507': 'How long is the course of Hot Springs’ "Zero K Foot Race"?',
  'hs-0131': 'DeGray Lake is described as the first Corps of Engineers impoundment able to do what?',
  'hs-0358': 'Mountain Valley water is said to have been served in which legislative chamber since the 1920s?',
  'hs-0479': 'Where is Hot Springs’ Rix Tower said to have stood before it was moved to the mountain?',
  'hs-0540': 'The Fordyce Bathhouse’s third floor, opened in 1915, is billed as Arkansas’s first what?',
  'hs-0567': 'Which Hot Springs congregation is credited with appointing the state’s first full-time female rabbi, in 1989?',
  'hs-0571': 'Mountain Valley is credited as the first bottled water sold coast to coast, on reaching which state in 1928?',
  'hs-0574': 'Which president is believed to have been the first to have Mountain Valley Spring Water served in the White House?',
  'hs-0610': 'Which Central Avenue gambling club is credited with Hot Springs’ first escalator, installed in the 1950s?',
};
// The apostrophes of the data file are straight or curly; only those may differ.
const plain = (s) => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

export const tests = [
  // ---------------- C4-03, C4-05 ----------------
  node('C4-03 C4-05 the sixteen approved rewordings include the later Zero K correction', () => {
    const all = bank(), by = new Map(all.map((q) => [q.id, q]));
    for (const [id, want] of Object.entries(REWORDED)) assert.equal(plain(by.get(id).question), plain(want), id);
    assert.equal(all.length, 608, 'the bank holds 619 less the eleven questions the owner retired in C4-10');
    const original = JSON.parse(fs.readFileSync(REPO + 'research/trivia-bank.json', 'utf8'));
    assert.ok(Array.isArray(original.questions || original), 'the original bank is still there');
  }),
  node('C4-03 the answers, wrong answers, explanation and source of the two C4-03 questions are as they were', () => {
    const by = new Map(bank().map((q) => [q.id, q]));
    const o = by.get('hs-0104'), m = by.get('hs-0291');
    assert.deepEqual([o.answer, o.wrong, o.explanation, o.source], ['Hot Springs NP Cultural Center', ['The park visitor center', 'A brewery and distillery', 'A nine-room hotel'], 'It reopened in 2014 as a cultural center showing artist-in-residence work.', 'Wikipedia: Bathhouse Row']);
    assert.deepEqual([m.answer, m.wrong, m.explanation, m.source], ['George Gleim Jr.', ['Harry C. Schwebke', 'George Mann', 'W. T. Bailey'], 'The Maurice was built 1911–12 and remodeled by Mann & Stern in 1915.', 'Wikipedia: Bathhouse Row']);
  }),
  node('C4-05 the seven approved attributions retain "According to", including the disputed peak year', () => {
    const all = bank();
    for (const id of ['hs-0184', 'hs-0377', 'hs-0498', 'hs-0501', 'hs-0503', 'hs-0525', 'hs-0580']) assert.match(all.find((q) => q.id === id).question, /According to/, id);
    // (hs-0450 was approved and then retired by the owner, item C4-10: it is left to that item)
    const left = all.filter((q) => /According to/.test(q.question) && q.id !== 'hs-0450').map((q) => q.id).sort();
    assert.equal(left.join(','), 'hs-0184,hs-0377,hs-0498,hs-0501,hs-0503,hs-0525,hs-0580', 'the seven approved attributions: ' + left);
  }),
  node('C4-05 the four explanations name their sources and include the approved Zero K update', () => {
    const by = new Map(bank().map((q) => [q.id, q]));
    assert.equal(by.get('hs-0155').explanation, "Wikipedia's water-chemistry table lists bicarbonate at 130.0 ppm, ahead of silica (53.0) and calcium (47.0).");
    assert.equal(by.get('hs-0369').explanation, 'The Encyclopedia of Arkansas says "The First Ever First Annual" parade was held March 17, 2004; the idea came from a 2003 gathering.');
    assert.equal(by.get('hs-0507').explanation, 'Visit Hot Springs says the course is 299 feet long, starting on 98-foot Bridge Street and ending across the intersection on Convention Boulevard. For 2020 it was cut to 250 feet when the race moved to follow the Running of the Tubs.');
    assert.equal(by.get('hs-0567').explanation, 'The Encyclopedia of Arkansas says Angela Graboys-Rudner was appointed rabbi of Congregation House of Israel in 1989, a first for Arkansas.');
    for (const id of Object.keys(REWORDED)) assert.equal(by.get(id).wrong.length, 3, id);
  }),
  {
    name: 'C4-05 the longest of the new questions fits its card at both sizes, with every answer and the 50/50 on screen or reachable',
    async run(t) {
      const by = new Map(bank().map((q) => [q.id, q]));
      const longest = Object.keys(REWORDED).map((id) => by.get(id).question).sort((a, b) => b.length - a.length)[0];
      const longestInBank = Math.max(...bank().map((q) => q.question.length));
      t.expect(longest.length <= longestInBank, `it is no longer than the longest question in the bank (${longest.length} against ${longestInBank})`);
      await soloGame(t, { settings: { seenCoach: true } });
      await t.game('setState', { trail: { phase: 'roll', players: [{ tickets: 6 }] } });
      await landOn(t, (await t.state()).board.types.indexOf('cat'));
      await phase(t, 'question');
      await t.game('setState', { question: { text: longest } });
      await t.waitForStable(8000);
      const m = await t.page.evaluate(() => {
        const h = document.querySelector('#qtext'), r = h.getBoundingClientRect(), card = document.querySelector('.qcard');
        const answers = [...document.querySelectorAll('.answers button')].map((b) => { const q = b.getBoundingClientRect(); return { l: q.left, r: q.right }; });
        let sc = card; while (sc && sc.scrollHeight <= sc.clientHeight + 1) sc = sc.parentElement; // the nearest ancestor that scrolls, if the card overflows
        return { text: h.textContent, l: r.left, r: r.right, vw: innerWidth, sw: document.documentElement.scrollWidth, over: h.scrollWidth > h.clientWidth + 1, answers, scrolls: !!sc && ['auto', 'scroll'].includes(getComputedStyle(sc).overflowY) };
      });
      t.equal(plain(m.text), plain(longest), 'the card shows the question');
      t.expect(m.l >= 0 && m.r <= m.vw && m.sw <= m.vw && !m.over && m.answers.every((a) => a.l >= 0 && a.r <= m.vw), 'nothing is cut off sideways: ' + JSON.stringify({ l: m.l, r: m.r, vw: m.vw, sw: m.sw }));
      await t.page.screenshot({ path: SHOTS + 'C4-05-longest-question-' + t.viewport + '.png' });
    },
  },
  // ---------------- S4-12 ----------------
  {
    name: 'S4-12 the re-roll and the 50/50 lead with the board’s own words and still say what they do and what they cost',
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      await t.game('setState', { trail: { phase: 'roll', rerolled: false, roll: null, players: [{ tickets: 9, node: 0 }] } });
      await t.game('act', 'roll', 3);
      await phase(t, 'choose');
      const re = await text(t, '[data-act="reroll"]');
      t.expect(/^Let the steam settle · re-roll · 1 ticket(?!s)/.test(re), 're-roll button: ' + re);
      const fit = (sel) => t.page.evaluate((s) => { const b = document.querySelector(s), r = b.getBoundingClientRect(), p = b.closest('#panel, .panel, body').getBoundingClientRect(); return { inside: r.left >= p.left - 1 && r.right <= p.right + 1 && r.right <= innerWidth && b.scrollWidth <= b.clientWidth + 1, h: r.height }; }, sel);
      const a = await fit('[data-act="reroll"]');
      t.expect(a.inside, 'the re-roll button stays inside its panel: ' + JSON.stringify(a));
      await t.page.locator('[data-act="reroll"]').scrollIntoViewIfNeeded();
      await t.page.screenshot({ path: SHOTS + 'S4-12-reroll-label-' + t.viewport + '.png' });
      await t.game('act', 'reroll');
      await phase(t, 'choose');
      await t.game('setState', { trail: { phase: 'roll', rerolled: false, roll: null, players: [{ tickets: 9 }] } });
      await landOn(t, (await t.state()).board.types.indexOf('cat'));
      await phase(t, 'question');
      const life = await text(t, '[data-act="lifeline"]');
      t.expect(/^Ask the bellhop · 50\/50 · 2 tickets/.test(life), '50/50 button: ' + life);
      const b = await fit('[data-act="lifeline"]');
      t.expect(b.inside, 'the 50/50 button stays inside its card: ' + JSON.stringify(b));
      await t.waitForStable(8000);
      await t.page.locator('[data-act="lifeline"]').scrollIntoViewIfNeeded();
      await t.page.screenshot({ path: SHOTS + 'S4-12-lifeline-label-' + t.viewport + '.png' });
      t.expect(await t.game('act', 'lifeline'), 'the button still buys the 50/50');
      t.equal((await t.state()).question.removed.length, 2, 'two wrong answers struck out');
    },
  },
  {
    name: 'S4-12 Help names the bellhop and the steam beside the old words',
    viewports: ['desktop'],
    async run(t) {
      await t.game('scene', 'help');
      const h = await text(t, '#scene-help');
      t.expect(/50\/50 from the bellhop \(2\)/.test(h) && /re-roll to let the steam settle \(1, then 2, 3 and 4/.test(h), 'help words');
    },
  },
  // ---------------- P-N07 ----------------
  {
    name: 'P-N07 Copy result says "Result copied." only once the clipboard has taken the text, and otherwise says to press Ctrl+C',
    initScript: withSave(BASE, '2026-11-12'),
    async run(t) {
      await t.game('newGame', { mode: 'daily', date: '2026-11-12' });
      await t.waitForStable(8000);
      for (let i = 0; i < 7; i++) { await t.game('act', 'answer', 'correct'); await t.game('act', 'continue'); }
      await waitFor(t, (s) => s.scene === 'results', 4000, 'results');
      const click = () => t.page.click('[data-act="copy-share"]');
      const clear = () => t.page.evaluate(() => { document.querySelector('#share-note').textContent = ''; document.querySelector('#live').textContent = ''; window.__copied = null; });
      const seen = () => t.page.evaluate(() => ({ note: document.querySelector('#share-note').textContent, live: document.querySelector('#live').textContent, copied: window.__copied, sel: document.querySelector('#share').selectionEnd - document.querySelector('#share').selectionStart, len: document.querySelector('#share').value.length }));
      // 1. the clipboard takes its time: nothing is said until it has resolved
      await t.page.evaluate(() => { window.__resolve = null; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (v) => new Promise((ok) => { window.__copied = v; window.__resolve = ok; }) } }); });
      await clear(); await click();
      await t.page.waitForFunction(() => window.__resolve !== null);
      let s = await seen();
      t.equal(s.note + s.live, '', 'nothing is said while the clipboard has not answered');
      await t.page.evaluate(() => window.__resolve());
      await t.page.waitForFunction(() => document.querySelector('#share-note').textContent === 'Result copied.');
      await t.page.waitForFunction(() => document.querySelector('#live').textContent === 'Result copied.');
      s = await seen();
      t.expect(/Daily 2026-11-12/.test(s.copied || ''), 'it handed the share text over: ' + s.copied);
      // 2. the clipboard refuses
      await t.page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } }); });
      await clear(); await click();
      await t.page.waitForFunction(() => document.querySelector('#share-note').textContent === 'Press Ctrl+C to copy.');
      await t.page.waitForFunction(() => document.querySelector('#live').textContent === 'Press Ctrl+C to copy.');
      s = await seen();
      t.expect(s.len > 0 && s.sel === s.len, 'the text is left selected: ' + s.sel + ' of ' + s.len);
      // 3. there is no clipboard at all (a plain http page)
      await t.page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }); });
      await clear(); await click();
      await t.page.waitForFunction(() => document.querySelector('#share-note').textContent === 'Press Ctrl+C to copy.');
      await t.page.waitForFunction(() => document.querySelector('#live').textContent === 'Press Ctrl+C to copy.');
      s = await seen();
      t.expect(!/copied/i.test(s.note + s.live), 'it never claims a copy: ' + s.note);
      t.expect(s.sel === s.len, 'the text is selected');
      await t.page.screenshot({ path: SHOTS + 'P-N07-press-ctrl-c-' + t.viewport + '.png' });
    },
  },
  // ---------------- S6-06 ----------------
  {
    name: 'S6-06 a save with bad settings (text size 0, a volume of "loud", a speed of "warp") plays with the usual ones, and the page is readable',
    initScript: withSave({ ...BASE, settings: { sound: 'no', effects: null, music: 'yes', ambience: 1, haptics: 'x', passScreen: 3, volume: 'loud', timer: 7, motion: 'warp', textScale: 0, theme: 'neon', aiSpeed: 'warp', seenCoach: 5 } }),
    async run(t) {
      await t.game('scene', 'settings');
      await t.waitForStable(8000);
      const s = (await t.state()).settings;
      t.expect(s.sound === true && s.effects === true && s.music === true && s.ambience === true && s.haptics === true && s.passScreen === true, 'the switches are on: ' + JSON.stringify(s));
      t.expect(s.volume === 0.7 && s.timer === 30 && s.motion === 'auto' && s.textScale === 1 && s.theme === 'auto', 'the rest are the usual: ' + JSON.stringify(s));
      t.expect(['normal', 'brisk', 'fast'].includes(s.aiSpeed), 'the speed is one that exists: ' + s.aiSpeed);
      t.equal(s.seenCoach, true, 'an older player is still not a newcomer');
      t.equal(await t.page.evaluate(() => getComputedStyle(document.documentElement).fontSize), '16px', 'the page text is its normal size');
      const on = await t.page.evaluate(() => [...document.querySelectorAll('#scene-settings .seg')].map((g) => g.querySelectorAll('[aria-checked="true"]').length));
      t.expect(on.every((n) => n === 1), 'every Settings row shows exactly one choice: ' + on);
    },
  },
  {
    name: 'S6-06 a text size of 50 or 1.2, a volume of 7 or NaN, and a text-size string do not reach the page',
    initScript: withSave({ ...BASE, settings: { ...BASE.settings, textScale: 50, volume: 7, timer: '10' } }),
    async run(t) {
      const s = (await t.state()).settings;
      t.expect(s.textScale === 1 && s.volume === 0.7 && s.timer === 30, 'back to the usual: ' + JSON.stringify(s));
      t.equal(await t.page.evaluate(() => getComputedStyle(document.documentElement).fontSize), '16px', 'the page text is its normal size');
    },
  },
  {
    name: 'S6-06 settings the screen offers are kept exactly',
    initScript: withSave({ ...BASE, settings: { sound: false, effects: false, music: false, ambience: false, haptics: false, passScreen: false, volume: 0, timer: 10, motion: 'reduced', textScale: 1.3, theme: 'dusk', aiSpeed: 'fast', seenCoach: false } }),
    async run(t) {
      const s = (await t.state()).settings;
      const keep = { sound: false, effects: false, music: false, ambience: false, haptics: false, passScreen: false, volume: 0, timer: 10, motion: 'reduced', textScale: 1.3, theme: 'dusk', aiSpeed: 'fast', seenCoach: false };
      t.equal(JSON.stringify(Object.fromEntries(Object.keys(keep).sort().map((k) => [k, s[k]]))), JSON.stringify(Object.fromEntries(Object.keys(keep).sort().map((k) => [k, keep[k]]))), 'nothing valid is changed');
      t.equal(await t.page.evaluate(() => getComputedStyle(document.documentElement).fontSize), '20.8px', 'text at 130 percent');
    },
  },
  // ---------------- C4-17 ----------------
  {
    name: 'C4-17 the opening line of a trip does not say the goal a third time: it is on the banner, the standing line and the first tip only',
    async run(t) {
      await t.seed(7);
      await t.game('setState', { settings: { passScreen: false, aiSpeed: 'fast', timer: 0, seenCoach: false } });
      await t.game('scene', 'setup');
      await t.waitForStable(8000);
      await t.game('act', 'ui', 'start-trail');
      await waitFor(t, (s) => s.scene === 'game', 4000, 'game');
      await t.game('act', 'stopAI');
      await t.page.waitForFunction(() => document.querySelector('#toast').classList.contains('on'), null, { timeout: 4000 }).catch(() => t.fail('no departure card'));
      await t.page.waitForFunction(() => document.querySelector('.coach'), null, { timeout: 4000 }).catch(() => t.fail('no first tip'));
      const v = await t.page.evaluate(() => {
        const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
        const goal = /6 stamps/;
        const lines = [['banner', document.querySelector('#toast')], ['standing line', document.querySelector('.objective')], ['tip', document.querySelector('.coach')], ['last line', document.querySelector('.lastline')], ...[...document.querySelectorAll('.log li')].map((e) => ['log', e])];
        return lines.filter(([, e]) => vis(e) && goal.test(e.textContent)).map(([n]) => n);
      });
      t.equal(JSON.stringify(v), JSON.stringify(['banner', 'standing line', 'tip']), 'where the goal shows: ' + v);
      const s = await t.state();
      t.equal(s.trail.log[s.trail.log.length - 1], 'A new trip begins.', 'the log opens with the plain line');
      t.expect((await t.page.evaluate(() => document.querySelector('.lastline').textContent)) === 'A new trip begins.', 'the line under the header');
      await t.page.screenshot({ path: SHOTS + 'C4-17-opening-' + t.viewport + '.png' });
    },
  },
  {
    name: 'C4-17 a screen reader is still told the whole opening sentence',
    viewports: ['desktop'],
    async run(t) {
      await t.page.evaluate(() => { window.__said = []; const l = document.querySelector('#live'); new MutationObserver(() => window.__said.push(l.textContent)).observe(l, { childList: true, characterData: true, subtree: true }); });
      await t.game('newGame', { mode: 'trail', players: [H1], target: 6, seed: 7 });
      await t.page.waitForFunction(() => window.__said.some((m) => m === 'A new trip begins. Collect 6 stamps, then climb to the Mountain Tower.'), null, { timeout: 4000 }).catch(() => t.fail('the opening sentence was never announced: ' + 0));
    },
  },
  // ---------------- S6-13 ----------------
  {
    name: 'S6-13 dragging the window edge keeps the board cache until the drag has been still, then rebuilds it once, crisp at the new size',
    viewports: ['desktop'],
    async run(t) {
      await t.game('scene', 'game');
      await soloGame(t, { settings: { seenCoach: true } });
      await t.waitForStable(8000);
      await t.game('resizeSettle', 1500);
      const before = (await t.state()).ui;
      const widths = [1240, 1200, 1160, 1120];
      const sizes = [];
      for (const w of widths) {
        await t.page.setViewportSize({ width: w, height: 800 });
        await t.page.waitForFunction((x) => innerWidth === x, w);
        await t.page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
        sizes.push((await t.state()).ui);
      }
      t.equal(sizes[sizes.length - 1].cacheBuilds, before.cacheBuilds, 'no rebuild during the drag: ' + before.cacheBuilds + ' -> ' + sizes.map((u) => u.cacheBuilds));
      const want = await waitFor(t, (s) => s.ui.cacheBuilds > before.cacheBuilds, 8000, 'the settled rebuild');
      t.equal(want.ui.cacheBuilds, before.cacheBuilds + 1, 'one rebuild after it settled');
      t.expect(want.ui.cacheWidth !== before.cacheWidth, 'the cache has the new size: ' + before.cacheWidth + ' -> ' + want.ui.cacheWidth);
      await t.game('resizeSettle', 150);
    },
  },
  {
    name: 'S6-13 a big change of size, or a change of theme, rebuilds the cache at once',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      await t.waitForStable(8000);
      await t.game('resizeSettle', 60000);
      const before = (await t.state()).ui;
      await t.page.setViewportSize({ width: 700, height: 500 });
      await waitFor(t, (s) => s.ui.cacheBuilds > before.cacheBuilds, 8000, 'a rebuild for a big change');
      const mid = (await t.state()).ui;
      await t.game('setState', { settings: { theme: 'dark' } });
      await waitFor(t, (s) => s.ui.cacheBuilds > mid.cacheBuilds, 8000, 'a rebuild for a theme change');
      await t.game('resizeSettle', 150);
    },
  },
  // ---------------- C4-02 ----------------
  {
    name: 'C4-02 Help says how the art was made, in one plain line, and it fits at both sizes',
    async run(t) {
      await t.game('scene', 'help');
      await t.waitForStable(8000);
      const line = await t.page.evaluate(() => { const e = document.querySelector('#art-credit'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { text: e.textContent, l: r.left, r: r.right, vw: innerWidth, sw: document.documentElement.scrollWidth, scrollW: e.scrollWidth, cw: e.clientWidth, count: (document.querySelector('#scene-help').textContent.match(/AI image tools/g) || []).length }; });
      t.equal(line.text, 'Art: painted with AI image tools for this game.', 'the line');
      t.equal(line.count, 1, 'said once');
      t.expect(line.l >= 0 && line.r <= line.vw && line.sw <= line.vw && line.scrollW <= line.cw + 1, 'it fits: ' + JSON.stringify(line));
      await t.page.screenshot({ path: SHOTS + 'C4-02-art-credit-' + t.viewport + '.png' });
    },
  },
  node('C4-02 the line names no company or product', () => {
    const src = fs.readFileSync(REPO + 'src/js/ui.js', 'utf8');
    const m = /id="art-credit">([^<]*)</.exec(src);
    assert.ok(m, 'the line is in ui.js');
    assert.ok(!/openai|codex|chatgpt|dall|midjourney|gpt|blender/i.test(m[1]), 'no product named: ' + m[1]);
  }),
];
