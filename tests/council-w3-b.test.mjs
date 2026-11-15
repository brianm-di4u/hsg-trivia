// Council wave 3, batch B: controls, rules and play; difficulty, progression and records
// (S2-06, S3-12, S4-05, S6-08, S4-09, S4-13, S1-08, S3-07, S3-09, S3-11).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { H1, soloGame, landOn, moveTo, waitFor, phase } from './helpers.mjs';

const KEY = 'hs-trivia-v1';
const stored = (t) => t.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
// The harness serializes initScript with toString, so a per-case script carries its data in its own source.
const withSave = (obj) => {
  const f = () => {};
  f.toString = () => `() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('hs-trivia-v1', JSON.stringify(${JSON.stringify(obj)})); } }`;
  return f;
};
const VETERAN = { v: 1, settings: { sound: true, volume: 0.7, timer: 0, aiSpeed: 'normal', seenCoach: true }, best: { quick: 1820, era: { roaring: 1340 } }, daily: { last: null, streak: 0, results: {} }, trail: null };
const rect = (t, sel) => t.page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height }; }, sel);
// The human is at the Tower with the stamps for it and has just reached it: the Summit dialog is open.
const atSummit = async (t) => {
  const s = await t.state();
  const stamps = Object.keys(s.board.landmarks);
  await t.game('setState', { trail: { players: [{ stamps, tickets: 9 }] } });
  const nb = (await t.game('act', 'adj', s.board.tower)).find((n) => s.board.types[n] === 'trail');
  await moveTo(t, nb, 1, s.board.tower);
  return phase(t, 'summit');
};
const firstOf = async (t, type) => (await t.state()).board.types.indexOf(type);

export const tests = [
  // ---------------- S2-06 ----------------
  {
    name: 'S2-06 the latest log line sits under the turn header on a phone and is not repeated on a wide screen',
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      await t.game('act', 'roll', 3);
      await phase(t, 'choose');
      const r = await t.page.evaluate(() => {
        const l = document.querySelector('#panel .lastline'); const h = document.querySelector('#panel .turn'); const p = document.querySelector('#panel');
        const lr = l.getBoundingClientRect(); const hr = h.getBoundingClientRect(); const pr = p.getBoundingClientRect();
        return { display: getComputedStyle(l).display, text: l.textContent, top: lr.top, bottom: lr.bottom, headBottom: hr.bottom, panelTop: pr.top, panelBottom: pr.bottom, log: window.__game.getState().trail.log[0], hidden: l.getAttribute('aria-hidden') };
      });
      t.equal(r.text, r.log, 'the banner says the newest log line');
      t.equal(r.hidden, 'true', 'it is hidden from screen readers (the live region already reads each line)');
      if (t.viewport === 'mobile') {
        t.expect(r.display !== 'none', 'shown on a phone');
        t.expect(r.bottom - r.top >= 14, 'and it has room for its line, not squeezed to nothing: ' + (r.bottom - r.top));
        t.expect(r.top >= r.headBottom - 1 && r.top - r.headBottom < 12, `it sits right under the turn header (${r.headBottom} to ${r.top})`);
        t.expect(r.bottom < r.panelTop + 140, 'and is in the first screenful of the sheet: ' + (r.bottom - r.panelTop));
        await t.shot('S2-06-lastline');
      } else t.equal(r.display, 'none', 'not shown beside the full log on a wide screen');
    },
  },
  // ---------------- S3-12 ----------------
  {
    name: 'S3-12 the era cards and the Quick 10 button show the best score, and the results say what it was made of',
    initScript: withSave(VETERAN),
    async run(t) {
      await t.game('scene', 'title');
      await t.waitForStable(8000);
      const quick = await t.page.locator('#scene-title [data-act="quick"]').innerText();
      t.expect(/best 1,820/i.test(quick), 'Quick 10 says its best: ' + quick.replace(/\n/g, ' '));
      await t.game('scene', 'era');
      await t.waitForStable(8000);
      const cards = await t.page.evaluate(() => [...document.querySelectorAll('.era-card')].map((c) => ({ era: c.dataset.era, best: c.querySelector('.era-best') ? c.querySelector('.era-best').textContent : null })));
      t.equal(cards.find((c) => c.era === 'roaring').best, 'Best 1,340', 'the era with a score shows it');
      t.equal(cards.filter((c) => c.best).length, 1, 'the others show none');
      await t.shot('S3-12-era-best');
      await t.checkLayout({ allowScrollY: true });
    },
  },
  {
    name: 'S3-12 a best remembers how many were right and the timer it was played with; a lower score does not replace it',
    async run(t) {
      await t.game('setState', { settings: { timer: 0 } });
      await t.seed(11);
      await t.game('newGame', { mode: 'quick', seed: 11 });
      for (let i = 0; i < 10; i++) { await t.game('act', 'answer', i < 7 ? 'correct' : 'wrong'); await t.game('act', 'continue'); }
      await t.waitForStable(8000);
      let sv = await stored(t);
      t.expect(sv.best.quick > 0, 'a best was saved: ' + sv.best.quick);
      t.equal(JSON.stringify(sv.bestMeta.quick), JSON.stringify({ right: 7, total: 10, timer: 0 }), 'with what it was made of');
      const line = await t.page.locator('#scene-results .score').innerText();
      t.expect(/7 of 10 right/.test(line), 'the results show accuracy beside the points: ' + line);
      t.expect(/personal best [\d,]+ \(7 of 10, no timer\)/.test(line), 'and the best with its timer: ' + line);
      const best = sv.best.quick;
      // a worse game with the timer on changes nothing
      await t.game('setState', { settings: { timer: 30 } });
      await t.game('newGame', { mode: 'quick', seed: 12 });
      for (let i = 0; i < 10; i++) { await t.game('act', 'answer', i < 2 ? 'correct' : 'wrong'); await t.game('act', 'continue'); }
      sv = await stored(t);
      t.equal(sv.best.quick, best, 'the best stands');
      t.equal(sv.bestMeta.quick.right, 7, 'and so does its meta');
      // a better one with the timer on replaces both
      await t.game('newGame', { mode: 'quick', seed: 13 });
      for (let i = 0; i < 10; i++) { await t.game('act', 'answer', 'correct'); await t.game('act', 'continue'); }
      sv = await stored(t);
      t.expect(sv.best.quick > best, 'a better game raises it');
      t.equal(JSON.stringify(sv.bestMeta.quick), JSON.stringify({ right: 10, total: 10, timer: 30 }), 'and its meta moves with it');
      await t.shot('S3-12-results');
    },
  },
  {
    name: 'S3-12 a save from before has no meta, shows its points alone and keeps them; damaged meta is dropped',
    initScript: withSave({ ...VETERAN, bestMeta: { quick: { right: 'x', total: 10, timer: 0 }, era: { roaring: { right: 5, total: 10, timer: 20 }, bad: 5 } } }),
    async run(t) {
      const sv = await stored(t);
      t.equal(sv.best.quick, 1820, 'the old best is untouched');
      await t.game('scene', 'title'); await t.waitForStable(8000);
      t.expect(/best 1,820/i.test(await t.page.locator('#scene-title [data-act="quick"]').innerText()), 'it still shows');
      await t.game('setState', { settings: { timer: 0 } });
      await t.game('newGame', { mode: 'quick', seed: 3 });
      for (let i = 0; i < 10; i++) { await t.game('act', 'answer', 'wrong'); await t.game('act', 'continue'); }
      await t.waitForStable(8000);
      const line = await t.page.locator('#scene-results .score').innerText();
      t.expect(/personal best 1,820/.test(line) && !/personal best 1,820 \(/.test(line), 'a best with no meta is shown as points alone: ' + line);
    },
  },
  // ---------------- S4-05 ----------------
  {
    name: 'S4-05 no two spaces of the same plain kind share a name, and the trolley stops are told apart',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      const names = await t.page.evaluate(() => { const s = window.__game.getState(); return { types: s.board.types, trolleys: s.board.trolleys }; });
      // each named space, by node id, from the destination rows the game would show
      const rows = await t.page.evaluate(async () => {
        const out = {};
        const st = window.__game.getState();
        for (let n = 0; n < st.board.nodes; n++) {
          window.__game.setState({ trail: { phase: 'choose', roll: 1, dests: [{ node: n, path: [n] }], players: [{}] } });
          const el = document.querySelector('#panel .dest .dname'); out[n] = el ? el.textContent : null;
        }
        return out;
      });
      const plain = Object.entries(rows).filter(([n]) => names.types[n] === 'cat').map(([, v]) => v);
      t.equal(plain.length, names.types.filter((x) => x === 'cat').length, 'every ordinary space has a name');
      t.expect(plain.every(Boolean) && plain.length >= 30, 'and there are plenty to compare: ' + plain.length);
      const dup = plain.filter((v, i) => plain.indexOf(v) !== i);
      t.equal(dup.length, 0, 'no ordinary space shares a name: ' + dup.join(', '));
      const trol = Object.entries(rows).filter(([n]) => names.trolleys.includes(+n) && names.types[n] === 'trolley').map(([, v]) => v);
      t.equal(trol.length, 3, 'three trolley stops');
      t.equal(new Set(trol).size, 3, 'with three different names: ' + trol.join(' | '));
      t.expect(trol.every((v) => /trolley stop/i.test(v)), 'each says it is a trolley stop');
    },
  },
  // ---------------- S6-08 ----------------
  {
    name: 'S6-08 the whole title menu is on the first screen on short and small screens',
    viewports: ['desktop'],
    async run(t) {
      const sizes = [[844, 390], [1024, 600], [320, 568], [360, 640], [1280, 800]];
      for (const [w, h] of sizes) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.game('scene', 'title');
        await t.waitForStable(8000);
        const r = await t.page.evaluate(() => [...document.querySelectorAll('#scene-title .btn')].map((b) => { const r = b.getBoundingClientRect(); return { act: b.dataset.act + ':' + b.dataset.arg, top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }));
        t.expect(r.length >= 6, `${w}x${h}: the menu is there (${r.length} buttons)`);
        for (const b of r) t.expect(b.bottom <= h + 0.5 && b.top >= 0 && b.right <= w + 0.5, `${w}x${h}: ${b.act} is inside the screen (bottom ${Math.round(b.bottom)})`);
        const trail = r.find((b) => b.act === 'goto:setup');
        if (h <= 500) t.expect(trail.bottom <= 300, `${w}x${h}: Trail Game is among the first buttons (${Math.round(trail.bottom)})`);
        if (w === 844) await t.shot('S6-08-title-landscape');
        if (w === 320) await t.shot('S6-08-title-small');
        if (w === 1280) await t.shot('S6-08-title-desktop-size');
      }
      // with a trip to continue the menu has one more button: still all inside the screen on a phone on its side
      await t.page.setViewportSize({ width: 844, height: 390 });
      await t.game('newGame', { mode: 'trail', players: [H1], target: 4, seed: 4 });
      await t.game('scene', 'title');
      await t.waitForStable(8000);
      const cont = await t.page.evaluate(() => [...document.querySelectorAll('#scene-title .btn')].map((b) => ({ act: b.dataset.act, bottom: b.getBoundingClientRect().bottom })));
      t.expect(cont.some((b) => b.act === 'continue-trail'), 'the Continue button is there');
      for (const b of cont) t.expect(b.bottom <= 390.5, `844x390 with Continue: ${b.act} is inside the screen (bottom ${Math.round(b.bottom)})`);
      await t.shot('S6-08-title-landscape-continue');
    },
  },
  // ---------------- S4-09 ----------------
  {
    name: 'S4-09 a landmark stamp asks about its own place where the bank has such a question',
    viewports: ['desktop'],
    async run(t) {
      const WORDS = {
        row: /bathhouse|bath house|fordyce|quapaw|buckstaff|maurice|superior|ozark|lamar|hale bath|display spring/i,
        bridge: /bridge street|parade|malco|malvern|reserve street/i,
        lakes: /lake (ouachita|hamilton|catherine)|garvan|dam\b|fishing|bass/i,
        ballfields: /whittington|ballpark|spring training|baseball|majestic park|fogel|ban johnson/i,
      };
      await soloGame(t, { settings: { seenCoach: true } });
      const s0 = await t.state();
      const lm = s0.board.landmarks;
      const catOf = (key) => ({ row: 'Places & Landmarks', bridge: 'Food & Culture', lakes: 'Nature & Lakes', ballfields: 'Sports' })[key];
      let asked = 0;
      for (const [key, re] of Object.entries(WORDS)) {
        const node = lm[catOf(key)];
        for (let i = 0; i < 4; i++) {
          await t.seed(100 + i);
          await t.game('setState', { asked: [] });
          await landOn(t, node); await phase(t, 'question');
          const q = (await t.state()).question;
          t.expect(re.test(q.text), `${key} stamp, try ${i + 1}: "${q.text.slice(0, 70)}" is about the place`);
          asked++;
          await t.game('act', 'answer', 'wrong'); await t.game('act', 'continue'); await phase(t, 'roll');
        }
      }
      t.equal(asked, 16, 'sixteen stamp questions looked at');
      // a district the bank says little about falls back to its category
      await t.seed(5); await t.game('setState', { asked: [] });
      await landOn(t, lm['Legends & Oddities']); await phase(t, 'question');
      t.equal((await t.state()).question.category, 'Legends & Oddities', 'a district with no such question still asks its category');
      // an ordinary district space is not narrowed
      await t.game('act', 'answer', 'wrong'); await t.game('act', 'continue'); await phase(t, 'roll');
      const cats = new Set();
      const cat = await firstOf(t, 'cat');
      for (let i = 0; i < 12; i++) {
        await t.seed(300 + i); await t.game('setState', { asked: [] });
        await landOn(t, cat); await phase(t, 'question');
        cats.add((await t.state()).question.text);
        await t.game('act', 'answer', 'wrong'); await t.game('act', 'continue'); await phase(t, 'roll');
      }
      t.expect(cats.size >= 6, 'ordinary spaces still draw a spread of questions: ' + cats.size);
    },
  },
  // ---------------- S4-13 ----------------
  {
    name: 'S4-13 an open question leaves the board and the active token in view, and the Continue button reachable',
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      const cat = await firstOf(t, 'cat');
      await landOn(t, cat);
      await phase(t, 'question');
      await t.waitForStable(8000);
      const [tx, ty] = await t.game('act', 'screenOf', cat);
      const stage = await rect(t, '#stage'); const modal = await rect(t, '#modal'); const sheet = await rect(t, '#modal .sheet');
      t.expect(tx > stage.left && tx < stage.right && ty > stage.top && ty < stage.bottom, `the token (${Math.round(tx)}, ${Math.round(ty)}) is on the stage`);
      t.expect(!(tx >= sheet.left && tx <= sheet.right && ty >= sheet.top && ty <= sheet.bottom), 'and the question card is not over it');
      if (t.viewport === 'mobile') t.expect(modal.top >= stage.bottom - 1, `the card sits below the board (${modal.top} vs ${stage.bottom})`);
      else t.expect(modal.left >= stage.right - 1, `the card sits in the panel's column (${modal.left} vs ${stage.right})`);
      const scrim = await t.page.evaluate(() => { const b = document.querySelector('#board'); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && e.id; });
      t.equal(scrim, 'board', 'nothing is laid over the board');
      await t.shot('S4-13-question-docked');
      await t.game('act', 'answer', 'wrong');
      await t.waitForStable(8000);
      const cont = await rect(t, '#modal [data-act="proceed"]');
      const vh = await t.page.evaluate(() => innerHeight);
      t.expect(cont && cont.bottom <= vh + 1 && cont.top >= 0, 'Continue is on screen after the answer: ' + JSON.stringify(cont));
      await t.shot('S4-13-feedback-docked');
      await t.checkLayout({ allowScrollY: true });
    },
  },
  // ---------------- S1-08 ----------------
  {
    name: 'S1-08 a miss shakes the card and slumps the token; a hit does neither; the Summit and the Jury add cold steam',
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      const cat = await firstOf(t, 'cat');
      await landOn(t, cat); await phase(t, 'question');
      let fx = (await t.state()).ui.fx;
      await t.game('act', 'answer', 'wrong');
      const miss = await t.page.evaluate(() => { const c = document.querySelector('.qcard'); return { cls: c.className, anim: getComputedStyle(c).animationName }; });
      t.expect(miss.cls.includes('missed'), 'the card is marked missed: ' + miss.cls);
      t.equal(miss.anim, 'cardshake', 'and shakes');
      let now = (await t.state()).ui.fx;
      t.equal(now.slump, fx.slump + 1, 'the token slumps once');
      t.equal(now.chill, fx.chill, 'an ordinary miss has no cold steam');
      await t.game('act', 'continue');
      await phase(t, 'roll');
      // a hit: neither
      await landOn(t, cat); await phase(t, 'question');
      fx = (await t.state()).ui.fx;
      await t.game('act', 'answer', 'correct');
      const hit = await t.page.evaluate(() => document.querySelector('.qcard').className);
      t.expect(!hit.includes('missed'), 'a right answer does not shake the card');
      now = (await t.state()).ui.fx;
      t.equal(now.slump, fx.slump, 'and the token does not slump');
      await t.game('act', 'continue');
      await phase(t, 'roll');
      // the Grand Jury
      await landOn(t, await firstOf(t, 'jury')); await phase(t, 'jury');
      await t.game('act', 'continue'); await phase(t, 'question');
      fx = (await t.state()).ui.fx;
      await t.game('act', 'answer', 'wrong');
      now = (await t.state()).ui.fx;
      t.equal(now.chill, fx.chill + 1, 'a Grand Jury miss adds cold steam');
      await t.game('act', 'continue');
      await phase(t, ['roll', 'skipped']);
      // the Summit
      await t.game('setState', { trail: { phase: 'roll', players: [{ skip: false }] } });
      await atSummit(t);
      await t.game('act', 'continue'); await phase(t, 'question');
      fx = (await t.state()).ui.fx;
      await t.game('act', 'answer', 'wrong');
      now = (await t.state()).ui.fx;
      t.equal(now.chill, fx.chill + 1, 'a Summit miss adds cold steam');
      t.equal(now.slump, fx.slump + 1, 'and the token slumps');
    },
  },
  {
    name: 'S1-08 with reduced motion the card does not shake',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true, motion: 'reduced' } });
      await landOn(t, await firstOf(t, 'cat')); await phase(t, 'question');
      await t.game('act', 'answer', 'wrong');
      const anim = await t.page.evaluate(() => getComputedStyle(document.querySelector('.qcard')).animationName);
      t.equal(anim, 'none', 'no shake under reduced motion');
    },
  },
  // ---------------- S3-07 ----------------
  {
    name: 'S3-07 at the Summit a traveler may spin the vane again, once, and never gets the same category',
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      let s = await atSummit(t);
      const first = s.trail.pending.cat;
      t.expect(await t.page.locator('#modal [data-act="summit-redraw"]').count() === 1, 'the button is offered');
      await t.shot('S3-07-summit-redraw');
      await t.page.locator('#modal [data-act="summit-redraw"]').click();
      s = await t.state();
      t.expect(s.trail.pending.cat !== first, `the category changed (${first} to ${s.trail.pending.cat})`);
      t.equal(s.trail.pending.redraws, 1, 'and it is counted');
      t.equal(await t.page.locator('#modal [data-act="summit-redraw"]').count(), 0, 'the button goes after its one use');
      await t.page.keyboard.press('s');
      t.equal((await t.state()).trail.pending.cat, s.trail.pending.cat, 'the key does nothing a second time');
      await t.game('act', 'continue'); await phase(t, 'question');
      t.equal((await t.state()).question.category, s.trail.pending.cat, 'the question is from the category that is on the vane');
    },
  },
  {
    name: 'S3-07 the S key spins the vane',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      const s = await atSummit(t);
      await t.page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
      await t.page.keyboard.press('s');
      const now = await t.state();
      t.expect(now.trail.pending.cat !== s.trail.pending.cat && now.trail.pending.redraws === 1, 'S spun it');
    },
  },
  // ---------------- S3-09 ----------------
  {
    name: 'S3-09 each computer level beats the one below it, by about 65 to 35 and not by 90 to 10',
    node: true,
    async run(t) {
      // The economy simulation plays whole Trail Games with the real rules on virtual timers and fixed seeds (1000 and up),
      // so the answer is the same every run. 80 games a row; the windows are wide and sit far from the old figures (Hard 87 and 100).
      const sim = fileURLToPath(new URL('../tools/econ-sim.mjs', import.meta.url));
      const out = execFileSync(process.execPath, [sim, '80', '6,7,8'], { encoding: 'utf8', maxBuffer: 1 << 24, timeout: 280000 });
      const rows = Object.fromEntries(out.trim().split('\n').map((l) => JSON.parse(l)).map((r) => [r.label, r]));
      const mh = rows['AI medium vs hard'].win; const eh = rows['AI easy vs hard'].win; const em = rows['AI easy vs medium'].win;
      t.log(`Medium vs Hard ${mh.join('/')} · Easy vs Hard ${eh.join('/')} · Easy vs Medium ${em.join('/')}`);
      t.expect(mh[1] > 52 && mh[1] < 85, `Hard beats Medium by a fair margin, not a rout: ${mh[1]}`);
      t.expect(em[1] > 52 && em[1] < 85, `Medium beats Easy by a fair margin, not a rout: ${em[1]}`);
      t.expect(eh[1] > mh[1] - 5 && eh[1] < 97, `Hard beats Easy at least as clearly, but not always: ${eh[1]}`);
    },
  },
];
