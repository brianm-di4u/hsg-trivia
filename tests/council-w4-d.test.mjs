// Council wave 4, batch D: world, words and ceremony
// (C4-06, C4-07, C4-09, C4-10, C4-11).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { soloGame, landOn, phase, waitFor } from './helpers.mjs';

const SHOTS = fileURLToPath(new URL('../../_council/hsg-trivia/wave-4/shots/', import.meta.url));
const REPO = fileURLToPath(new URL('..', import.meta.url));
// The owner's approved strings this file checks, kept in the repo so that the tests need nothing outside it (copied from the owner's approved-wording file: the trivia journalFacts, grandJury, dated and corrections).
const APPROVED = fileURLToPath(new URL('./fixtures/approved-wording.json', import.meta.url));
const BASE = { v: 1, settings: { sound: true, volume: 0.7, timer: 0, aiSpeed: 'normal', seenCoach: true }, best: { quick: 0, era: {} }, daily: { last: null, streak: 0, results: {} }, trail: null };
// The harness serializes initScript with toString, so a per-case script carries its data in its own source.
const withSave = (obj, today = '2026-11-16') => {
  const f = () => {};
  f.toString = () => `() => { window.__TEST_DATE__ = '${today}'; if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('hs-trivia-v1', JSON.stringify(${JSON.stringify(obj)})); } }`;
  return f;
};
const node = (name, run) => ({ name, node: true, run });
// Runs a snippet of the game's own rules in a separate Node process (the rules read a few globals the page would give them).
const inNode = (code) => {
  const head = `import fs from 'node:fs'; import { pathToFileURL } from 'node:url';
    globalThis.window = {}; for (const [k, f] of [['QUESTIONS','questions'],['TIMELINE','timeline-lite'],['BOARD_GEO','board-geo']]) globalThis[k] = JSON.parse(fs.readFileSync('data/' + f + '.json', 'utf8'));
    const imp = (f) => import(pathToFileURL(process.cwd() + '/src/js/' + f).href);`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', head + code], { cwd: REPO, encoding: 'utf8', timeout: 120000 });
  if (r.status !== 0) throw new Error('node snippet failed: ' + r.stderr.slice(0, 600));
  return JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
};
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
  // ---------------- C4-10, C4-11 ----------------
  node('C4-10 C4-11 the question file carries every approved change and correction word for word, and the eleven retired questions are out', () => {
    const A = approved(), file = JSON.parse(fs.readFileSync(REPO + 'data/questions.json', 'utf8')), by = new Map(file.questions.map((q) => [q.id, q]));
    const change = { ...A.dated.change, ...A.corrections.change };
    assert.equal(Object.keys(A.dated.change).length, 17); assert.equal(Object.keys(A.corrections.change).length, 3); assert.equal(A.dated.retire.length, 11);
    for (const [id, c] of Object.entries(change)) {
      const q = by.get(id); assert.ok(q, id + ' is still in the bank');
      for (const k of ['question', 'answer', 'wrong', 'explanation']) {
        if (c[k] == null) continue;
        assert.deepEqual(Array.isArray(c[k]) ? c[k].map(norm) : norm(q[k]), Array.isArray(c[k]) ? q[k].map(norm) : norm(c[k]), id + '.' + k);
        assert.notDeepEqual(norm(JSON.stringify(q[k])), norm(JSON.stringify(c[k + 'Was'])), id + '.' + k + ' is no longer the old wording');
      }
      assert.ok(!q.wrong.includes(q.answer) && q.wrong.length === 3, id + ': the right answer is not among three wrong ones');
    }
    for (const id of A.dated.retire) assert.ok(!by.has(id), id + ' is retired');
    assert.equal(file.questions.length, 608, '619 less the eleven');
    assert.equal(new Set(file.questions.map((q) => q.id)).size, 608, 'no id twice');
    // the particular three of C4-11
    assert.ok(!/1896/.test(by.get('hs-0612').question + by.get('hs-0612').explanation), 'the cave question names no closing year');
    assert.ok(/2013/.test(by.get('hs-0102').explanation) && !/2012/.test(by.get('hs-0102').explanation), 'the brewery opened in 2013');
    assert.equal(by.get('hs-0350').answer, 'Worked as an insurance agent');
    // the supplement note still counts the 108 researched questions, none of which was retired
    assert.equal(file.supplement[0].count, 108); assert.ok(A.dated.retire.every((id) => id < file.supplement[0].from));
  }),
  node('C4-10 the retired questions leave the Daily, the era counts and the pools cleanly', () => {
    const retired = approved().dated.retire;
    const r = inNode(`const Q = await imp('quiz.js'); const D = await imp('data.js');
      const out = { bad: [], missing: [], retired: [], bank: D.BANK.length, eras: D.ERA_MODES.map((m) => [m.id, D.eraCount(m)]), thin: [] };
      for (let i = 0; i < 400; i++) { const date = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), ids = Q.dailyIds(date);
        if (ids.length !== 7 || new Set(ids).size !== 7) out.bad.push(date); for (const id of ids) { if (!D.getQ(id)) out.missing.push(id); if (${JSON.stringify(retired)}.includes(id)) out.retired.push(id); } }
      for (const c of D.CATS) for (const d of ['easy', 'medium', 'hard']) if (D.BANK.filter((q) => q.category === c.id && q.difficulty === d).length < 10) out.thin.push(c.id + ' ' + d);
      console.log(JSON.stringify(out));`);
    assert.deepEqual([r.bad, r.missing, r.retired, r.thin], [[], [], [], []], 'every Daily of 400 dates has seven live questions, none retired');
    assert.equal(r.bank, 608);
    for (const [id, n] of r.eras) assert.ok(n >= 30, id + ' still has a full chapter: ' + n);
  }),
  node('C4-10 the seven reframed questions stay out of the Daily, so the boards of dates that did not draw a retired question are the ones wave 3 dealt', () => {
    const held = ['hs-0225', 'hs-0264', 'hs-0388', 'hs-0396', 'hs-0459', 'hs-0460', 'hs-0466'];
    // Boards dealt at the end of wave 3 (the question file before C4-10), for dates whose board no retired question touches.
    const wave3 = {
      '2026-11-16': ['hs-0004', 'hs-0429', 'hs-0472', 'hs-0078', 'hs-0309', 'hs-0203', 'hs-0113'],
      '2026-11-26': ['hs-0330', 'hs-0002', 'hs-0463', 'hs-0208', 'hs-0351', 'hs-0113', 'hs-0542'],
      '2027-03-01': ['hs-0361', 'hs-0013', 'hs-0481', 'hs-0128', 'hs-0279', 'hs-0536', 'hs-0418'],
      '2027-08-08': ['hs-0320', 'hs-0003', 'hs-0120', 'hs-0385', 'hs-0446', 'hs-0533', 'hs-0221'],
    };
    const r = inNode(`const Q = await imp('quiz.js'); const out = { held: 0, boards: {} };
      for (let i = 0; i < 400; i++) { const d = new Date(Date.UTC(2026, 10, 16 + i)).toISOString().slice(0, 10), ids = Q.dailyIds(d); out.held += ids.filter((id) => ${JSON.stringify(held)}.includes(id)).length; }
      for (const d of ${JSON.stringify(Object.keys(wave3))}) out.boards[d] = Q.dailyIds(d);
      console.log(JSON.stringify(out));`);
    assert.equal(r.held, 0, 'none of the seven is ever dealt in 400 Dailies');
    assert.deepEqual(r.boards, wave3);
  }),
  {
    name: 'C4-10 a save that names a retired question loads and plays: in the seen list, and as the open question of a trip',
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      const types = (await t.state()).board.types;
      await landOn(t, types.indexOf('cat')); await phase(t, 'question');
      await t.page.evaluate(() => {
        const k = 'hs-trivia-v1', d = JSON.parse(localStorage.getItem(k));
        if (!d.trail || !d.trail.question) throw new Error('the open question was not saved');
        d.trail.question.id = 'hs-0450'; d.seen = ['hs-0136', 'hs-0450', 'hs-0001'];
        d.asked = ['hs-0136', 'hs-0450'];
        localStorage.setItem(k, JSON.stringify(d));
      });
      await t.reload();
      t.equal(await t.page.locator('[data-act="continue-trail"]').count(), 1, 'the trip can still be continued');
      await t.game('act', 'ui', 'continue-trail');
      const s = await waitFor(t, (x) => x.scene === 'game' && x.trail, 4000, 'continued trip');
      t.expect(!s.question || s.question.id !== 'hs-0450', 'the retired question is not brought back');
      t.equal(await t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-trivia-v1')).seen.includes('hs-0136')), true, 'the seen list is left as it was (nothing is lost)');
      await t.game('newGame', { mode: 'quick' });
      const q = await t.state(); t.expect(!!q.question && !['hs-0136', 'hs-0450'].includes(q.question.id), 'a quiz starts and draws a live question');
    },
  },
];
