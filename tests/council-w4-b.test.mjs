// Council wave 4, batch B: controls, rules and play; difficulty, progression and records
// (S6-12, C4-04, C4-08, S5-20, S3-14, P-N05, S3-25, P-N03).
import assert from 'node:assert/strict';
import { createSaveStore } from '../src/js/save.js';
import { settleJournal, cleanRecord, applyIntent, freshRecord, JOURNAL_KEYS, JOURNAL_BEFORE, ACHIEVEMENTS } from '../src/js/record.js';
import { H1, soloGame, landOn, waitFor, phase } from './helpers.mjs';

const ALL = ['Sports', 'Entertainment', 'Nature & Lakes', 'People', 'History', 'Places & Landmarks', 'Food & Culture', 'Legends & Oddities'];
const render = (t, ...a) => t.page.evaluate((x) => window.__game.audioRender(...x), a);
const unlock = async (t) => { await t.page.mouse.click(5, 5); await waitFor(t, (s) => s.audio.state === 'running', 3000, 'audio running'); };
// How much of one frequency a WAV render holds in a window (seconds): a Goertzel sum over the left channel.
const power = (b64, f, from, to) => {
  const b = Buffer.from(b64, 'base64'), rate = b.readUInt32LE(24), w = (2 * Math.PI * f) / rate;
  let re = 0, im = 0;
  for (let i = Math.floor(from * rate); i < Math.floor(to * rate); i++) { const x = b.readInt16LE(44 + i * 4); re += x * Math.cos(w * i); im += x * Math.sin(w * i); }
  return re * re + im * im;
};
const median = (a) => a.slice().sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)];
const wavOf = async (t, tier) => (await render(t, 'cue:win', 4, true, undefined, { tier })).wav;

const KEY = 'hs-trivia-v1';
const stored = (t) => t.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const storedText = (t) => t.page.evaluate((k) => localStorage.getItem(k), KEY);
// The harness serializes initScript with toString, so a per-case script carries its data in its own source.
const withSave = (obj) => {
  const f = () => {};
  f.toString = () => `() => { window.__TEST_DATE__ = '2026-11-16'; if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('hs-trivia-v1', JSON.stringify(${JSON.stringify(obj)})); } }`;
  return f;
};
const node = (name, run) => ({ name, node: true, run });
const BASE = { v: 1, settings: { sound: true, volume: 0.7, timer: 0, aiSpeed: 'normal', seenCoach: true }, best: { quick: 0, era: {} }, daily: { last: null, streak: 0, results: {} }, trail: null };
// A save written by the wave-3 build: a human won a Grand Tour (eight stamps) in 14 rounds; only some pages were dated since the journal began.
const EIGHT_WIN = { ...BASE, stats: { games: 6, wins: 2, byLevel: { easy: [1, 2], medium: [1, 4], hard: [0, 0] }, cat: {}, bestStreak: 6, stamps: 30, summits: 2, fastest: { 8: 14, 6: 11 }, stars: { '8:medium': true } },
  ach: { 'first-stamp': '2026-10-01' }, profile: { title: null, cover: null }, journal: { row: '2026-11-02', oaklawn: '2026-11-05' } };
const SHORT_WINS = { ...EIGHT_WIN, stats: { ...EIGHT_WIN.stats, fastest: { 4: 8, 6: 11 }, stars: { '4:easy': true, '6:medium': true } }, journal: { row: '2026-11-02' } };
const SEVEN = { ...BASE, stats: { games: 1, wins: 0, stamps: 7 }, ach: { 'first-stamp': '2026-11-01' }, journal: Object.fromEntries(JOURNAL_KEYS.filter((k) => k !== 'ballfields').map((k) => [k, '2026-11-01'])) };
const memStore = (value) => {
  let raw = JSON.stringify(value);
  return { read: () => JSON.parse(raw), raw: () => raw, storage: () => ({ getItem: () => raw, setItem: (k, v) => { if (!k.endsWith('.bad')) raw = v; } }) };
};
const openRecord = async (t) => {
  await t.game('scene', 'title');
  await t.page.locator('#scene-title [data-arg="record"]').click();
  await t.page.locator('#scene-record .journal').waitFor();
};
const rect = (t, sel) => t.page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }, sel);
// Win the Ballfields stamp on the board: the eighth page of SEVEN.
const winBallfields = async (t) => {
  await soloGame(t, { settings: { seenCoach: true } });
  const s0 = await t.state();
  await landOn(t, s0.board.landmarks['Sports']);
  await phase(t, 'question');
  await t.game('act', 'answer', 'correct');
  await phase(t, 'feedback');
};

export const tests = [
  // ---------------- S6-12 ----------------
  {
    name: 'S6-12 a right or middle click on a lit space chooses nothing; a left click still does',
    async run(t) {
      await soloGame(t, { settings: { seenCoach: true } });
      await t.game('act', 'roll', 3);
      let s = await phase(t, 'choose');
      if (s.ui.camera === 'follow') await t.game('act', 'ui', 'zoom');
      await t.waitForStable(8000);
      s = await t.state();
      const box = await rect(t, '#board');
      let d = null;
      for (const id of s.trail.dests) { const p = await t.game('act', 'screenOf', id); if (!d && p[0] > box.left + 30 && p[0] < box.right - 30 && p[1] > box.top + 30 && p[1] < box.bottom - 30) d = { id, p }; }
      t.expect(d, 'a destination is on screen');
      await t.page.mouse.click(d.p[0], d.p[1], { button: 'right' });
      await t.page.mouse.click(d.p[0], d.p[1], { button: 'middle' });
      s = await t.state();
      t.equal(s.trail.phase, 'choose', 'neither button chose the space');
      await t.page.mouse.click(d.p[0], d.p[1]);
      s = await waitFor(t, (x) => x.trail.phase !== 'choose', 4000, 'the left click to choose');
      t.expect(s.trail.phase === 'moving' || s.trail.players[0].node === d.id, 'the token set off for that space');
      await t.game('act', 'finishAnim');
    },
  },
  // ---------------- C4-08 ----------------
  node('C4-08 the journal rules: an eight-stamp win opens every shut page, nothing else does, and a second pass changes nothing', () => {
    const d = cleanRecord(EIGHT_WIN);
    assert.equal(settleJournal(d, '2026-11-16'), true);
    assert.deepEqual(Object.fromEntries(JOURNAL_KEYS.map((k) => [k, d.journal[k]])),
      { row: '2026-11-02', bridge: JOURNAL_BEFORE, central: JOURNAL_BEFORE, oaklawn: '2026-11-05', lakes: JOURNAL_BEFORE, ballfields: JOURNAL_BEFORE, hollow: JOURNAL_BEFORE, park: JOURNAL_BEFORE }, 'dated pages keep their dates');
    assert.equal(d.ach['journal-full'], '2026-11-16', 'a full journal holds its achievement');
    assert.equal(d.ach['first-stamp'], '2026-10-01', 'earlier achievements are as they were');
    const again = JSON.stringify(d);
    assert.equal(settleJournal(d, '2026-11-20'), false, 'a second pass changes nothing');
    assert.equal(JSON.stringify(d), again);
    // the other proofs of a won eight-stamp trip: a star, the Grand Tour achievement
    assert.equal(settleJournal(cleanRecord({ stats: { stars: { '8:hard': true } } }), '2026-11-16'), true);
    assert.equal(settleJournal(cleanRecord({ ach: { 'grand-tour': '2026-11-01' } }), '2026-11-16'), true);
    // no proof: shorter wins, a stamp count, a fresh record
    for (const raw of [SHORT_WINS, { stats: { stamps: 99, games: 40, wins: 20, fastest: { 4: 5, 6: 9 } } }, {}]) {
      const r = cleanRecord(raw); const before = JSON.stringify(r);
      assert.equal(settleJournal(r, '2026-11-16'), false); assert.equal(JSON.stringify(r), before);
    }
  }),
  node('C4-08 a build from before drops the marker and keeps everything else; this build opens the pages again', () => {
    const m = memStore(EIGHT_WIN); const s = createSaveStore({ storage: m.storage }); s.load();
    assert.equal(s.settleJournal('2026-11-16').changed, true);
    const written = m.read();
    assert.equal(written.journal.bridge, JOURNAL_BEFORE);
    // wave 3's reader keeps a journal value only if it is a day: the marker is dropped, the dated pages stay
    const wave3 = Object.fromEntries(Object.entries(written.journal).filter(([, v]) => /^\d{4}-\d{2}-\d{2}$/.test(v)));
    assert.deepEqual(wave3, { row: '2026-11-02', oaklawn: '2026-11-05' });
    assert.equal(written.stats.fastest[8], 14); assert.equal(written.stats.stamps, 30);
    const back = createSaveStore({ storage: memStore({ ...written, journal: wave3, ach: { 'first-stamp': '2026-10-01' } }).storage }); back.load();
    assert.equal(back.settleJournal('2026-11-17').changed, true, 'opened again when the newer build returns');
    assert.equal(Object.keys(back.data.journal).length, 8);
  }),
  node('C4-08 a second load writes nothing, and a save with no proof is not written at all', () => {
    const m = memStore(EIGHT_WIN); const s = createSaveStore({ storage: m.storage }); s.load(); s.settleJournal('2026-11-16');
    const after = m.raw();
    const s2 = createSaveStore({ storage: m.storage }); s2.load();
    assert.equal(s2.settleJournal('2026-11-30').changed, false); assert.equal(m.raw(), after, 'byte for byte');
    const n = memStore(SHORT_WINS); const before = n.raw(); const s3 = createSaveStore({ storage: n.storage }); s3.load();
    assert.equal(s3.settleJournal('2026-11-16').changed, false); assert.equal(n.raw(), before);
    const fresh = createSaveStore({ storage: () => ({ getItem: () => null, setItem() { throw new Error('a fresh profile writes nothing at load'); } }) }); fresh.load();
    assert.equal(fresh.settleJournal('2026-11-16').changed, false);
  }),
  {
    name: 'C4-08 a veteran of eight-stamp wins opens to eight pages, the old ones keep their days, and a reload changes nothing',
    initScript: withSave(EIGHT_WIN),
    async run(t) {
      await t.game('setState', { settings: { seenCoach: true } });
      const sv = await stored(t);
      t.equal(Object.keys(sv.journal).length, 8, 'all eight pages are stored');
      t.equal(sv.journal.row, '2026-11-02', 'a dated page keeps its day');
      t.equal(sv.ach['journal-full'], '2026-11-16', 'and the achievement is held, dated today');
      await openRecord(t);
      const head = await t.page.locator('#scene-record h3', { hasText: 'Passport journal' }).innerText();
      t.expect(/8 of 8 pages/i.test(head), 'the record counts eight pages: ' + head);
      const got = await t.page.locator('#scene-record .jpage.got').allInnerTexts();
      t.equal(got.length, 8, 'eight open pages');
      t.equal(got.filter((x) => x.includes('won before the journal was kept')).length, 6, 'six of them say they were won before the journal was kept');
      t.expect(got.some((x) => x.includes('won 2026-11-02')) && got.some((x) => x.includes('won 2026-11-05')), 'the two dated pages show their days');
      t.equal(await t.page.locator('#scene-record .jpage.lock').count(), 0, 'none is shut');
      t.equal(await t.page.locator('#toast.on').count(), 0, 'no toast: the achievement is given quietly');
      t.equal((await t.state()).ui.ceremony, false, 'and no ceremony is waiting');
      await t.page.locator('#scene-record .journal').scrollIntoViewIfNeeded();
      await t.shot('C4-08-opened-journal');
      await t.checkLayout({ allowScrollY: true });
      const before = await storedText(t);
      await t.reload();
      t.equal(await storedText(t), before, 'a reload leaves the save byte for byte as it was');
    },
  },
  {
    name: 'C4-08 a save that shows only shorter wins keeps its journal as it was',
    initScript: withSave(SHORT_WINS),
    async run(t) {
      const sv = await stored(t);
      t.equal(JSON.stringify(sv), JSON.stringify(SHORT_WINS), 'nothing was written');
      await t.game('setState', { settings: { seenCoach: true } });
      await openRecord(t);
      t.equal(await t.page.locator('#scene-record .jpage.got').count(), 1, 'one page open');
      t.equal(await t.page.locator('#scene-record .jpage.lock').count(), 7, 'seven shut');
      t.equal(await t.page.locator('#scene-record .journal-done').count(), 0, 'no complete banner');
    },
  },
  // ---------------- C4-04 ----------------
  node('C4-04 holding all eight pages earns Journal Complete once; seven do not', () => {
    const d = freshRecord();
    JOURNAL_KEYS.slice(0, 7).forEach((k, i) => applyIntent(d, { kind: 'event', ev: 'stamp', count: i + 1, d: k, today: '2026-11-10' }));
    assert.equal(d.ach['journal-full'], undefined, 'seven pages are not enough');
    const r = applyIntent(d, { kind: 'event', ev: 'stamp', count: 8, d: JOURNAL_KEYS[7], today: '2026-11-11' });
    assert.ok(r.earned.includes('journal-full')); assert.equal(d.ach['journal-full'], '2026-11-11');
    const r2 = applyIntent(d, { kind: 'event', ev: 'stamp', count: 1, d: 'row', today: '2026-11-12' });
    assert.ok(!r2.earned.includes('journal-full'), 'earned once');
    const a = ACHIEVEMENTS.find((x) => x.id === 'journal-full');
    assert.ok(a.name.length < 30 && a.text.length < 80);
    // a save from before that already holds all eight pages is given it on load, quietly
    const old = cleanRecord({ journal: Object.fromEntries(JOURNAL_KEYS.map((k) => [k, '2026-11-01'])), ach: { 'first-stamp': '2026-11-01' } });
    assert.equal(settleJournal(old, '2026-11-16'), true); assert.equal(old.ach['journal-full'], '2026-11-16');
  }),
  {
    name: 'C4-04 the eighth page opens a ceremony on the journal: a bell, the line, the page stamps, once',
    initScript: withSave(SEVEN),
    async run(t) {
      await winBallfields(t);
      const sv = await stored(t);
      t.equal(Object.keys(sv.journal).length, 8, 'the eighth page is open');
      t.expect(typeof sv.ach['journal-full'] === 'string', 'the achievement is held');
      t.equal((await t.state()).ui.ceremony, true, 'the ceremony waits for the journal');
      await t.game('scene', 'title');
      await t.page.locator('#scene-title [data-arg="record"]').click();
      await t.page.locator('#scene-record .journal-done.ceremony').waitFor();
      t.equal(await t.page.locator('#scene-record .journal-done').innerText(), 'All eight pages are open. Your passport journal is complete.', 'one line in the game\'s voice');
      const s = await t.state();
      t.equal(s.ui.ceremony, false, 'played once');
      t.expect(s.audio.log.some((c) => c.name === 'bell'), 'with the bell');
      await t.page.locator('#scene-record .journal-done').scrollIntoViewIfNeeded();
      await t.shot('C4-04-journal-ceremony');
      await t.checkLayout({ allowScrollY: true });
      await t.game('scene', 'title');
      await t.page.locator('#scene-title [data-arg="record"]').click();
      await t.page.locator('#scene-record .journal-done').waitFor();
      t.equal(await t.page.locator('#scene-record .journal-done.ceremony').count(), 0, 'no second ceremony');
    },
  },
  {
    name: 'C4-04 under reduced motion the ceremony still shows its line and plays no animation',
    reducedMotion: true,
    initScript: withSave(SEVEN),
    async run(t) {
      await winBallfields(t);
      await t.game('scene', 'title');
      await t.page.locator('#scene-title [data-arg="record"]').click();
      await t.page.locator('#scene-record .journal-done.ceremony').waitFor();
      const anim = await t.page.evaluate(() => [getComputedStyle(document.querySelector('.journal-done'), '::before').animationName, getComputedStyle(document.querySelector('.jpage.got')).animationName]);
      t.equal(anim.join(), 'none,none', 'no animation under reduced motion: ' + anim);
      t.expect(await t.page.locator('#scene-record .journal-done').isVisible(), 'the line is there');
    },
  },

  // ---------------- S5-20 ----------------
  {
    name: 'S5-20 the win cue has three tiers: good is the fanfare as it was, great adds a bass, perfect adds a bell tail and a pad',
    viewports: ['desktop'],
    async run(t) {
      const w = [await wavOf(t, 0), await wavOf(t, 1), await wavOf(t, 2)];
      t.expect(w.every((x) => typeof x === 'string' && x.length > 1000), 'each tier renders a WAV');
      // A bass note under the fanfare (C3 for the first half second): present from tier 1, absent in tier 0.
      const bass = w.map((x) => power(x, 130.81, 0, 0.5));
      t.expect(bass[1] > bass[0] * 4 && bass[2] > bass[0] * 4, 'the bass: ' + bass.map((x) => x.toExponential(2)).join(' '));
      // The pad (E4 held from 0.6 s to about 3 s) and the bell tail (an inharmonic partial of the top note) are tier 2 only.
      const pad = w.map((x) => power(x, 329.63, 1.8, 2.8));
      t.expect(pad[2] > pad[0] * 20 && pad[2] > pad[1] * 20, 'the pad outlasts the chord: ' + pad.map((x) => x.toExponential(2)).join(' '));
      const bell = w.map((x) => power(x, 1046.5 * 2.76, 0.8, 1.6));
      t.expect(bell[2] > bell[0] * 5 && bell[2] > bell[1] * 5, 'the bell tail: ' + bell.map((x) => x.toExponential(2)).join(' '));
    },
  },
  {
    name: 'S5-20 every tier sits at a cue level at the default volume and stays under 0.95 at full volume',
    viewports: ['desktop'],
    async run(t) {
      for (const tier of [0, 1, 2]) {
        const soft = [], loud = [];
        for (let i = 0; i < 7; i++) soft.push((await render(t, 'cue:win', 4, false, undefined, { tier })).peak);
        for (let i = 0; i < 20; i++) loud.push((await render(t, 'cue:win', 4, false, 1, { tier })).peak);
        t.log('tier ' + tier + ': median peak ' + median(soft) + ' at the default volume, loudest of 20 at full volume ' + Math.max(...loud));
        t.expect(median(soft) >= 0.2 && median(soft) <= 0.45, 'tier ' + tier + ' median peak ' + median(soft) + ' is a cue level');
        t.expect(Math.max(...loud) < 0.95, 'tier ' + tier + ' at full volume peaks at ' + Math.max(...loud));
      }
      for (let i = 0; i < 3; i++) { const r = await render(t, 'mix', 9, false, 1); t.log('win moment peak ' + r.peak); t.expect(r.peak < 0.95, 'the win moment (board piece, Row bed, perfect win) at full volume peaks at ' + r.peak); }
    },
  },
  {
    name: 'S5-20 a poor result is a soft falling line, not a paper rustle',
    viewports: ['desktop'],
    async run(t) {
      const w = (await render(t, 'cue:consolation', 1.5, true)).wav;
      const at = (f, a, z) => power(w, f, a, z);
      t.expect(at(587.33, 0, 0.14) > at(392, 0, 0.14) * 4, 'it starts high');
      t.expect(at(392, 0.34, 0.6) > at(587.33, 0.34, 0.6) * 4, 'and ends low');
      const peaks = []; for (let i = 0; i < 7; i++) peaks.push((await render(t, 'cue:consolation', 1.5, false)).peak);
      t.log('consolation median peak ' + median(peaks));
      t.expect(median(peaks) >= 0.12 && median(peaks) <= 0.3, 'soft but heard: ' + median(peaks));
      const loud = []; for (let i = 0; i < 10; i++) loud.push((await render(t, 'cue:consolation', 1.5, false, 1)).peak);
      t.expect(Math.max(...loud) < 0.95, 'under 0.95 at full volume: ' + Math.max(...loud));
    },
  },
  {
    name: 'S5-20 a quiz result plays the tier its score earns, and the Summit win plays the top one',
    viewports: ['desktop'],
    async run(t) {
      await t.seed(11);
      await t.game('setState', { settings: { timer: 0, seenCoach: true } });
      await unlock(t);
      const run = async (rights) => {
        await t.game('newGame', { mode: 'quick' });
        for (let i = 0; i < 10; i++) { await t.game('act', 'answer', i < rights ? 'correct' : 'wrong'); await t.game('act', 'continue'); }
        await waitFor(t, (s) => s.scene === 'results', 4000, 'the results');
        const log = (await t.state()).audio.log;
        return log.filter((x) => x.name === 'win' || x.name === 'consolation' || x.name === 'page').pop();
      };
      for (const [rights, name, tier] of [[10, 'win', 2], [9, 'win', 1], [7, 'win', 0], [6, 'consolation', undefined]]) {
        const c = await run(rights);
        t.expect(c && c.name === name && c.tier === tier, rights + ' of 10 plays ' + name + (tier === undefined ? '' : ' tier ' + tier) + ': ' + JSON.stringify(c));
      }
      await t.game('scene', 'title');
      await soloGame(t, { players: [H1] });
      const s0 = await t.state();
      await t.game('setState', { trail: { phase: 'roll', players: [{ tickets: 9, node: 0, stamps: ALL.slice(0, 6) }] } });
      await landOn(t, s0.board.tower);
      await phase(t, 'summit'); await t.game('act', 'continue'); await phase(t, 'question');
      await t.game('act', 'answer', 'correct'); await t.game('act', 'continue'); await phase(t, 'over');
      const win = (await t.state()).audio.log.filter((x) => x.name === 'win').pop();
      t.expect(win && win.tier === 2, 'the Summit win is the perfect tier: ' + JSON.stringify(win));
    },
  },
];
