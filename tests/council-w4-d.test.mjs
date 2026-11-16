// Council wave 4, batch D: world, words and ceremony
// (C4-06, C4-07, C4-09, C4-10, C4-11).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SHOTS = fileURLToPath(new URL('../../_council/hsg-trivia/wave-4/shots/', import.meta.url));
const REPO = fileURLToPath(new URL('..', import.meta.url));
const APPROVED = fileURLToPath(new URL('../../_council/owner-review/approved-wording.json', import.meta.url));
const BASE = { v: 1, settings: { sound: true, volume: 0.7, timer: 0, aiSpeed: 'normal', seenCoach: true }, best: { quick: 0, era: {} }, daily: { last: null, streak: 0, results: {} }, trail: null };
// The harness serializes initScript with toString, so a per-case script carries its data in its own source.
const withSave = (obj, today = '2026-11-16') => {
  const f = () => {};
  f.toString = () => `() => { window.__TEST_DATE__ = '${today}'; if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('hs-trivia-v1', JSON.stringify(${JSON.stringify(obj)})); } }`;
  return f;
};
const node = (name, run) => ({ name, node: true, run });
const norm = (s) => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
const approved = () => JSON.parse(fs.readFileSync(APPROVED, 'utf8')).trivia;

// A save with three journal pages open (a district's stamp was won on those days).
const THREE = { ...BASE, stats: { games: 2, wins: 1, stamps: 3 }, ach: { 'first-stamp': '2026-11-01' }, journal: { row: '2026-11-01', central: '2026-11-02', oaklawn: '2026-11-03' } };
const openRecord = async (t) => {
  await t.game('scene', 'title');
  await t.page.locator('#scene-title [data-arg="record"]').click();
  await t.page.locator('#scene-record .journal').waitFor();
};

export const tests = [
  // ---------------- C4-06 ----------------
  node('C4-06 every district carries its approved facts in order, word for word, and the blurb stays', async () => {
    const { DISTRICTS } = await import(pathToFileURL(REPO + 'src/js/board.js').href);
    const want = approved().journalFacts;
    assert.deepEqual(DISTRICTS.map((d) => d.key).sort(), Object.keys(want).sort());
    let n = 0;
    for (const d of DISTRICTS) {
      assert.equal(d.facts.length, want[d.key].length, d.key + ' fact count');
      assert.equal(d.facts.length, d.key === 'oaklawn' ? 4 : 5, d.key + ': five a district, four for Oaklawn');
      want[d.key].forEach((w, i) => { assert.equal(norm(d.facts[i].text), norm(w.text), d.key + ' fact ' + (i + 1)); assert.equal(norm(d.facts[i].source), norm(w.source), d.key + ' source ' + (i + 1)); n++; });
      assert.ok(d.blurb && d.blurb.length > 10, d.key + ' keeps its blurb');
    }
    assert.equal(n, 39);
  }),
  {
    name: 'C4-06 an opened page lists its facts in order behind a closed disclosure; a shut page lists none; nothing overflows',
    initScript: withSave(THREE),
    async run(t) {
      const { DISTRICTS } = await import(pathToFileURL(REPO + 'src/js/board.js').href);
      await t.game('setState', { settings: { seenCoach: true } });
      await openRecord(t);
      const btns = t.page.locator('#scene-record .jpage.got .jfacts-btn');
      t.equal(await btns.count(), 3, 'one disclosure on each of the three opened pages');
      t.equal(await t.page.locator('#scene-record .jpage.lock .jfacts-btn, #scene-record .jpage.lock .jfacts').count(), 0, 'a shut page shows nothing new');
      t.equal(await t.page.locator('#scene-record .jfacts').count(), 0, 'they start closed');
      t.equal(await btns.first().getAttribute('aria-expanded'), 'false', 'and say so');
      t.equal((await btns.first().innerText()).trim(), 'Show 5 facts', 'the button says how many facts it holds');
      t.equal((await btns.nth(2).innerText()).trim(), 'Show 4 facts', 'four for Oaklawn');
      // by keyboard: focus the button and press Enter
      await btns.first().focus();
      await t.page.keyboard.press('Enter');
      const list = t.page.locator('#scene-record .jfacts').first();
      await list.waitFor();
      const row = DISTRICTS.find((d) => d.key === 'row');
      const items = await list.locator('li').allInnerTexts();
      t.equal(items.length, 5, 'five facts listed');
      items.forEach((txt, i) => {
        t.expect(txt.includes(row.facts[i].text), 'fact ' + (i + 1) + ' is in order');
        t.expect(txt.includes('Source: ' + row.facts[i].source), 'and names its source');
      });
      t.equal(await btns.first().getAttribute('aria-expanded'), 'true', 'the button says it is open');
      t.equal(await t.page.evaluate(() => document.activeElement.dataset.key), 'jfacts-row', 'focus stays on the button');
      t.expect(await btns.first().getAttribute('aria-controls') === await list.getAttribute('id'), 'it names the list it opens');
      // a page that was not opened shows no list at all
      t.equal(await t.page.locator('#scene-record .jpage.lock .jfacts').count(), 0, 'a shut page still has no facts');
      // the open state survives another change on the card (wearing a title re-draws it) and a second press closes it
      await t.page.locator('#scene-record .jpage.got .jfacts-btn').nth(1).click();
      t.equal(await t.page.locator('#scene-record .jfacts').count(), 2, 'a second page opens beside the first');
      await t.page.locator('#scene-record .jfacts-btn').first().click();
      t.equal(await t.page.locator('#scene-record .jfacts').count(), 1, 'the first closes again');
      await t.page.locator('#scene-record .jfacts-btn').first().click();
      await t.page.locator('#scene-record .jfacts').first().scrollIntoViewIfNeeded();
      await t.page.screenshot({ path: SHOTS + 'C4-06-journal-facts-' + t.viewport + '.png' });
      const wide = await t.page.evaluate(() => { const c = document.querySelector('#scene-record'); const r = c.getBoundingClientRect(); return [...c.querySelectorAll('.jfacts, .jfacts li, .jfacts-btn')].filter((e) => { const b = e.getBoundingClientRect(); return b.right > innerWidth + 0.5 || b.left < -0.5 || e.scrollWidth > e.clientWidth + 1; }).length + (document.documentElement.scrollWidth > innerWidth ? 1 : 0) + (r.width ? 0 : 1); });
      t.equal(wide, 0, 'no fact, source or button runs past the screen');
      await t.checkLayout({ allowScrollY: true });
    },
  },
  {
    name: 'C4-06 the disclosure opens by touch on a phone and is read as a button with its state',
    initScript: withSave(THREE),
    async run(t) {
      await t.game('setState', { settings: { seenCoach: true } });
      await openRecord(t);
      const b = t.page.locator('#scene-record .jfacts-btn').first();
      t.equal(await b.evaluate((e) => e.tagName), 'BUTTON');
      await b.tap().catch(async () => { await b.click(); });
      t.equal(await t.page.locator('#scene-record .jfacts li').count(), 5, 'opened');
      const name = await t.page.locator('#scene-record .jfacts').first().getAttribute('aria-label');
      t.expect(/Bathhouse Row: 5 facts/.test(name), 'the list is named with its district and count: ' + name);
    },
  },
];
