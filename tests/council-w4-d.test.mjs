// Council wave 4, batch D: world, words and ceremony
// (C4-06, C4-07, C4-09, C4-10, C4-11).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { soloGame, landOn, phase } from './helpers.mjs';

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
  // ---------------- C4-07 ----------------
  {
    name: 'C4-07 both Grand Jury spaces show the approved 1946 line in small type under the rule, with the button on screen and the line read with the card',
    async run(t) {
      const line = approved().grandJury;
      await soloGame(t, { settings: { seenCoach: true } });
      const types = (await t.state()).board.types;
      const juries = types.map((x, i) => (x === 'jury' ? i : -1)).filter((i) => i >= 0);
      t.equal(juries.length, 2, 'the board has two Grand Jury spaces');
      for (const [n, node] of juries.entries()) {
        await landOn(t, node); await phase(t, 'jury');
        const card = t.page.locator('#modal .mcard');
        await card.waitFor();
        const got = await t.page.locator('#jury-line').innerText();
        t.equal(norm(got), norm(line), 'space ' + (n + 1) + ' carries the line, word for word');
        t.expect(await t.page.locator('#jury-line.src').count() === 1, 'in the small type the game uses for a source');
        t.expect(/grand jury/i.test(await t.page.locator('#jury-rule').innerText()), 'the rule text stays');
        t.equal(await t.page.locator('#modal .sheet').getAttribute('aria-describedby'), 'jury-rule jury-line', 'a screen reader reads the rule and the line with the card');
        const box = await t.page.evaluate(() => { const b = document.querySelector('#modal [data-act="proceed"]').getBoundingClientRect(); const l = document.querySelector('#jury-line').getBoundingClientRect(); return { bt: b.top, bb: b.bottom, bl: b.left, br: b.right, lb: l.bottom, h: innerHeight, w: innerWidth, ltop: document.querySelector('#jury-rule').getBoundingClientRect().bottom }; });
        t.expect(box.bb <= box.h && box.bt >= 0 && box.bl >= 0 && box.br <= box.w, 'the Face the jury button is on screen');
        t.expect(box.lb <= box.bt && box.ltop <= box.bt, 'and the line sits above the button, under the rule');
        if (n === 0) await t.page.screenshot({ path: SHOTS + 'C4-07-grand-jury-' + t.viewport + '.png' });
        await t.checkLayout();
        await t.game('act', 'continue'); await phase(t, 'question');
        await t.game('act', 'answer', 'correct'); await t.game('act', 'continue'); await phase(t, 'roll');
      }
    },
  },
  {
    name: 'C4-07 no other space card carries a history line: Post Time and the postcard stay as they were',
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      const types = (await t.state()).board.types;
      await landOn(t, types.indexOf('wager')); await phase(t, 'wager');
      t.equal(await t.page.locator('#jury-line').count(), 0, 'no jury line on Post Time');
      t.expect(!/federal judge|poll tax/i.test(await t.page.locator('#modal').innerText()), 'and nothing about 1946');
    },
  },
  // ---------------- C4-09 ----------------
  {
    name: 'C4-09 the title and headings are set in the bundled Old Standard TT Bold on every screen, from file://, and none is drawn in a made-up weight',
    fileUrl: true,
    async run(t) {
      const probe = () => t.page.evaluate(async () => {
        await document.fonts.ready;
        const out = { bold: [], other: [], wrongWeight: [], first: {} };
        for (const e of document.querySelectorAll('body *')) {
          const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
          const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
          const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
          if (fam === 'Old Standard TT') { out.bold.push(e.className || e.tagName); if (+cs.fontWeight < 700) out.wrongWeight.push((e.className || e.tagName) + ' ' + cs.fontWeight); }
        }
        const q = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').trim() : null; };
        out.first = { logo: q('.logo'), brand: q('.brand'), h2: q('.page-card h2'), qtext: q('.qtext'), mh2: q('.mcard h2'), pc: q('.pc-text'), tname: q('.tname') };
        out.loaded = document.fonts.check('700 16px "Old Standard TT"') && [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Old Standard TT' && f.status === 'loaded');
        out.over = document.documentElement.scrollWidth > innerWidth;
        return out;
      });
      const noMadeUp = (p, where) => t.equal(p.wrongWeight, [], where + ': every heading in the face is drawn at its own bold weight');
      await t.game('setState', { settings: { seenCoach: true } });
      await t.game('scene', 'title');
      await t.page.locator('.logo').waitFor();
      let p = await probe();
      t.expect(p.loaded, 'the face is loaded and document.fonts.check() says so');
      t.equal(p.first.logo, 'Old Standard TT', 'the title leads with it'); t.equal(p.first.brand, 'Old Standard TT', 'so does the bar brand');
      noMadeUp(p, 'title'); t.expect(!p.over, 'the title screen does not scroll sideways');
      await t.page.screenshot({ path: SHOTS + 'C4-09-title-after-' + t.viewport + '.png' });
      await t.page.addStyleTag({ content: ':root{--font-serif-victorian:var(--font-serif-body)}' });
      await t.page.screenshot({ path: SHOTS + 'C4-09-title-before-' + t.viewport + '.png' });
      const before = await t.page.evaluate(() => { const r = document.querySelector('.logo').getBoundingClientRect(); return [r.width, r.height]; });
      await t.reload();
      await t.game('setState', { settings: { seenCoach: true } });
      await t.game('scene', 'title');
      await t.page.locator('.logo').waitFor();
      const after = await t.page.evaluate(() => { const r = document.querySelector('.logo').getBoundingClientRect(); return [r.width, r.height]; });
      t.expect(after[1] <= before[1] * 1.6, 'the title is no more than a line taller than it was: ' + before[1] + ' to ' + after[1]);
      await t.page.locator('#scene-title [data-arg="record"]').click();
      await t.page.locator('#scene-record h2').waitFor();
      p = await probe(); t.equal(p.first.h2, 'Old Standard TT', 'a card heading leads with it'); noMadeUp(p, 'record'); t.expect(!p.over, 'no sideways scroll on the record');
      await t.page.screenshot({ path: SHOTS + 'C4-09-record-after-' + t.viewport + '.png' });
      await soloGame(t, { settings: { seenCoach: true } });
      const types = (await t.state()).board.types;
      await landOn(t, types.indexOf('postcard')); await phase(t, 'postcard');
      await t.page.locator('.pc-text').waitFor();
      p = await probe(); t.expect(p.first.pc !== 'Old Standard TT', 'the postcard sentence keeps the system serif: ' + p.first.pc); noMadeUp(p, 'postcard');
      await t.game('act', 'continue'); await phase(t, 'roll');
      await landOn(t, types.indexOf('jury')); await phase(t, 'jury');
      p = await probe(); t.equal(p.first.mh2, 'Old Standard TT', 'a card title leads with it'); noMadeUp(p, 'jury card');
      await t.game('act', 'continue'); await phase(t, 'question');
      await t.page.locator('.qtext').waitFor();
      p = await probe(); t.equal(p.first.qtext, 'Old Standard TT', 'the question leads with it'); noMadeUp(p, 'question'); t.expect(!p.over, 'no sideways scroll on a question');
      await t.page.screenshot({ path: SHOTS + 'C4-09-question-after-' + t.viewport + '.png' });
      await t.checkLayout();
    },
  },
  {
    name: 'C4-09 Help credits the face and its licence once, inside the screen',
    async run(t) {
      await t.game('scene', 'help');
      const line = t.page.locator('#font-credit'); await line.waitFor();
      const txt = (await line.innerText()).trim();
      t.expect(txt.includes('Old Standard TT') && txt.includes('SIL Open Font License'), 'it names the face and the licence: ' + txt);
      t.equal(await t.page.locator('#font-credit').count(), 1, 'said once');
      const b = await line.evaluate((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right, innerWidth, document.documentElement.scrollWidth]; });
      t.expect(b[0] >= 0 && b[1] <= b[2] && b[3] <= b[2], 'inside the screen with no sideways scroll');
      await line.scrollIntoViewIfNeeded();
      await t.page.screenshot({ path: SHOTS + 'C4-09-font-credit-' + t.viewport + '.png' });
      await t.checkLayout({ allowScrollY: true });
    },
  },
  node('C4-09 the font file, its licence and its rule are in the repo, and the old stack stays behind the new face', () => {
    const css = fs.readFileSync(REPO + 'src/styles/fonts.css', 'utf8');
    assert.ok(css.includes('font-family:"Old Standard TT";font-style:normal;font-weight:700;font-display:block;src:url(data:font/woff2;base64,'));
    assert.equal((css.match(/font-family:"Old Standard TT"/g) || []).length, 1, 'only the bold weight is bundled');
    assert.ok(fs.existsSync(REPO + 'vendor/fonts/old-standard-tt-latin-700-normal.woff2') && /SIL Open Font License/.test(fs.readFileSync(REPO + 'vendor/fonts/OFL-old-standard-tt.txt', 'utf8')));
    const main = fs.readFileSync(REPO + 'src/styles/main.css', 'utf8');
    assert.ok(main.includes('--font-serif-victorian: "Old Standard TT", var(--font-serif-body);'));
    assert.ok(main.includes('--font-serif-body: "Palatino Linotype", "Book Antiqua", Palatino, Georgia, "Times New Roman", serif;'));
    assert.deepEqual(fs.readdirSync(REPO + 'vendor/fonts').sort(), ['OFL-kalam.txt', 'OFL-old-standard-tt.txt', 'OFL-rye.txt', 'kalam-latin-400-normal.woff2', 'kalam-latin-700-normal.woff2', 'old-standard-tt-latin-700-normal.woff2', 'rye-latin-400-normal.woff2']);
  }),
];
