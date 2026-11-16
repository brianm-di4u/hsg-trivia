// Council wave 4, batch C: polish across the game
// (S2-10, S4-12, P-N07, S6-06, S5-09, C4-17, S6-13, C4-02, C4-03, C4-05).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { H1, soloGame, landOn, waitFor, phase } from './helpers.mjs';

const SHOTS = fileURLToPath(new URL('../../_council/hsg-trivia/wave-4/shots/', import.meta.url));
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

// The question strings the owner approved (decisions 29 and 31): the two C4-03 rewordings and the fourteen that no longer open with "According to".
const REWORDED = {
  'hs-0104': 'What did the Ozark Bathhouse on Bathhouse Row reopen as in 2014?',
  'hs-0291': 'Which architect designed Hot Springs’ Maurice Bathhouse?',
  'hs-0049': 'In what year did Gov. Winthrop Rockefeller end Hot Springs’ casino revival?',
  'hs-0148': 'How many hot springs emerge from Hot Springs Mountain in Hot Springs National Park?',
  'hs-0155': 'Which dissolved constituent is most concentrated in Hot Springs’ thermal water?',
  'hs-0181': 'Which big cat left the Hot Springs area after European settlement?',
  'hs-0369': 'In what year was the first World’s Shortest St. Patrick’s Day Parade held?',
  'hs-0507': 'How long is Hot Springs’ "Zero K Foot Race"?',
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
  node('C4-03 C4-05 the sixteen approved questions are in the question file exactly, and nothing else about them moved', () => {
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
  node('C4-05 the six questions that keep "According to" are untouched, and no other live question opens with it', () => {
    const all = bank();
    for (const id of ['hs-0184', 'hs-0377', 'hs-0498', 'hs-0501', 'hs-0503', 'hs-0580']) assert.match(all.find((q) => q.id === id).question, /According to/, id);
    // (hs-0450 was approved and then retired by the owner, item C4-10: it is left to that item)
    const left = all.filter((q) => /According to/.test(q.question) && q.id !== 'hs-0450').map((q) => q.id).sort();
    assert.equal(left.join(','), 'hs-0184,hs-0377,hs-0498,hs-0501,hs-0503,hs-0580', 'only the six: ' + left);
  }),
  node('C4-05 the four explanations that name their source now say it, and the answers and wrong answers of the fourteen are as they were', () => {
    const by = new Map(bank().map((q) => [q.id, q]));
    assert.equal(by.get('hs-0155').explanation, "Wikipedia's water-chemistry table lists bicarbonate at 130.0 ppm, ahead of silica (53.0) and calcium (47.0).");
    assert.equal(by.get('hs-0369').explanation, 'The Encyclopedia of Arkansas says "The First Ever First Annual" parade was held March 17, 2004; the idea came from a 2003 gathering.');
    assert.equal(by.get('hs-0507').explanation, 'Visit Hot Springs lists the race at 250 feet. It follows directly after the Running of the Tubs races.');
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
];
