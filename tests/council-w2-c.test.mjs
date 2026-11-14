// Council wave 2, batch C: Trail record (S3-01), first-run teaching (S2-01), opponent voices (S4-01).
import assert from 'node:assert/strict';
import { H1, soloGame, moveTo, landOn, neighborOf, waitFor, phase } from './helpers.mjs';
import { createSaveStore } from '../src/js/save.js';
import { ACHIEVEMENTS, ACH, COVERS, TITLES, applyIntent, cleanRecord, freshRecord } from '../src/js/record.js';

const ALL = ['Sports', 'Entertainment', 'Nature & Lakes', 'People', 'History', 'Places & Landmarks', 'Food & Culture', 'Legends & Oddities'];
const KEY = 'hs-trivia-v1';
const copy = (v) => JSON.parse(JSON.stringify(v));
// The harness serializes initScript with toString, so a per-case script carries its data in its own source.
const withSave = (obj) => {
  const f = () => {};
  f.toString = () => `() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('hs-trivia-v1', JSON.stringify(${JSON.stringify(obj)})); } }`;
  return f;
};
const stored = (t) => t.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const text = (t, sel) => t.page.locator(sel).first().innerText();
const lower = async (t, sel) => (await text(t, sel)).toLowerCase(); // headings are set in capitals by the style sheet
// A save written by this game before wave 2: settings, bests, dailies, no record.
const PRE_WAVE = { v: 1, settings: { sound: true, volume: 0.7, timer: 30, aiSpeed: 'normal' }, best: { quick: 55, era: { roaring: 40 } }, daily: { last: '2026-11-10', streak: 2, results: { '2026-11-09': { score: 30, right: 4, marks: '1111000' }, '2026-11-10': { score: 35, right: 5, marks: '1111100' } } }, trail: null };
// A player with a few finished trips behind them (the tips are done, nothing is locked for them).
const VETERAN = { ...PRE_WAVE, settings: { ...PRE_WAVE.settings, seenCoach: true } };

// A finished trip: the human holds `have` stamps, stands next to the Tower, steps on, and answers the Summit question.
async function winTrip(t, { players = [H1, { kind: 'ai', level: 'hard' }], target = 6, round = 9, have = target } = {}) {
  await soloGame(t, { players, target, settings: { seenCoach: true } });
  const s0 = await t.state();
  await t.game('setState', { trail: { round, players: [{ stamps: ALL.slice(0, have), tickets: 7 }] } });
  await moveTo(t, s0.board.tower - 1, 1, s0.board.tower);
  await t.game('act', 'continue');
  await phase(t, 'question');
  await t.game('act', 'answer', 'correct');
  await phase(t, 'feedback');
  await t.game('act', 'continue');
  return waitFor(t, (x) => x.scene === 'win', 3000, 'win scene');
}

export const tests = [
  // ---------------- S3-01 ----------------
  {
    name: 'S3-01 record rules: counters, personal bests, Summit stars and achievements',
    node: true,
    async run(t) {
      const d = freshRecord();
      let r = applyIntent(d, { kind: 'event', ev: 'stamp', count: 1, today: '2026-11-13' });
      assert.deepEqual(r.earned, ['first-stamp']); assert.equal(d.stats.stamps, 1);
      assert.deepEqual(applyIntent(d, { kind: 'event', ev: 'stamp', count: 2, today: '2026-11-14' }).earned, [], 'earned once, the first date is kept');
      assert.equal(d.ach['first-stamp'], '2026-11-13');
      applyIntent(d, { kind: 'event', ev: 'stamp', count: 8, today: '2026-11-13' }); assert.ok(d.ach['full-passport']);
      applyIntent(d, { kind: 'event', ev: 'streak', n: 5 }); assert.ok(d.ach.streak5 && !d.ach.streak10); applyIntent(d, { kind: 'event', ev: 'streak', n: 10 }); assert.ok(d.ach.streak10); assert.equal(d.stats.bestStreak, 10);
      applyIntent(d, { kind: 'event', ev: 'wager', won: 2 }); assert.ok(!d.ach['post-time'], 'a wager of 2 is not enough'); applyIntent(d, { kind: 'event', ev: 'wager', won: 3 }); assert.ok(d.ach['post-time']);
      applyIntent(d, { kind: 'event', ev: 'express' }); applyIntent(d, { kind: 'event', ev: 'warp' }); applyIntent(d, { kind: 'event', ev: 'summit' });
      assert.ok(d.ach.express && d.ach['time-warp'] && d.stats.summits === 1);
      r = applyIntent(d, { kind: 'trail', won: true, target: 6, rounds: 30, levels: ['medium', 'hard'], cats: { Sports: [3, 5] }, streak: 4 });
      assert.equal(d.stats.games, 1); assert.equal(d.stats.wins, 1);
      assert.deepEqual(d.stats.byLevel.hard, [1, 1]); assert.deepEqual(d.stats.byLevel.medium, [1, 1]); assert.deepEqual(d.stats.byLevel.easy, [0, 0]);
      assert.deepEqual(d.stats.cat.Sports, [3, 5]); assert.equal(d.stats.fastest[6], 30);
      assert.deepEqual(r.best.map((b) => b.kind), ['fastest', 'star']); assert.ok(d.stats.stars['6:hard'] && !d.stats.stars['6:medium'], 'one star per target, for the hardest level beaten');
      assert.ok(d.ach['first-summit'] && d.ach['hard-win']);
      r = applyIntent(d, { kind: 'trail', won: true, target: 6, rounds: 35, levels: ['hard'], cats: {}, streak: 0 });
      assert.equal(d.stats.fastest[6], 30, 'a slower win is not a best'); assert.deepEqual(r.best, []);
      r = applyIntent(d, { kind: 'trail', won: true, target: 6, rounds: 22, levels: ['hard'], cats: {}, streak: 0 });
      assert.equal(r.best[0].prev, 30); assert.equal(d.stats.fastest[6], 22);
      r = applyIntent(d, { kind: 'trail', won: false, target: 8, rounds: 20, levels: ['easy'], cats: {}, streak: 0 });
      assert.deepEqual(d.stats.byLevel.easy, [0, 1], 'a loss is a game against that level and no win'); assert.equal(d.stats.fastest[8], undefined); assert.equal(d.stats.wins, 3);
      assert.ok(!d.ach['grand-tour']);
      applyIntent(d, { kind: 'trail', won: true, target: 8, rounds: 40, levels: [], cats: {}, streak: 0 }); assert.ok(d.ach['grand-tour']);
      assert.ok(!d.ach.regular, 'five games so far'); for (let i = 0; i < 6; i++) applyIntent(d, { kind: 'trail', won: i % 2 === 0, target: 4, rounds: 9, levels: ['easy'], cats: {}, streak: 0 });
      assert.ok(d.ach.regular, '10 finished games'); assert.ok(d.ach['old-hand'] === undefined || d.stats.wins >= 10);
      assert.ok(!d.ach['perfect-ten']); applyIntent(d, { kind: 'quiz', mode: 'quick', right: 9, total: 10 }); assert.ok(!d.ach['perfect-ten']);
      applyIntent(d, { kind: 'quiz', mode: 'era', right: 10, total: 10 }); assert.ok(d.ach['perfect-ten']);
      applyIntent(d, { kind: 'quiz', mode: 'daily', right: 7, total: 7, dailyStreak: 6 }); assert.ok(!d.ach['daily-7']); applyIntent(d, { kind: 'quiz', mode: 'daily', right: 3, total: 7, dailyStreak: 7 }); assert.ok(d.ach['daily-7']);
      const cats = Object.fromEntries(ALL.map((c) => [c, [10, 12]])); applyIntent(d, { kind: 'trail', won: false, target: 4, rounds: 9, levels: [], cats, streak: 0 }); assert.ok(d.ach['well-rounded']);
      // wearing: only what is earned
      assert.equal(applyIntent(d, { kind: 'profile', title: 'first-stamp', cover: 'copper' }) && d.profile.title, 'first-stamp'); assert.equal(d.profile.cover, 'copper');
      applyIntent(d, { kind: 'profile', title: 'streak10', cover: 'gilt' }); assert.equal(d.profile.cover, 'copper', 'a cover that is not earned is refused');
      const e = freshRecord(); applyIntent(e, { kind: 'profile', title: 'regular', cover: 'indigo' }); assert.deepEqual(e.profile, { title: null, cover: null });
      // every achievement is reachable by an intent above or by play: names and texts are present and short
      for (const a of ACHIEVEMENTS) { assert.ok(a.name && a.text && a.text.length < 80, a.id); assert.ok(a.name.length < 30, a.id); }
      assert.ok(ACHIEVEMENTS.length >= 12); assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
      assert.ok(TITLES.length >= 6 && COVERS.length >= 5 && COVERS[0].id === 'cream' && !COVERS[0].need);
      // repair: damaged values fall back, good ones stay
      const bad = cleanRecord({ stats: { games: 'x', wins: -4, byLevel: { easy: [9, 3] }, cat: { Sports: 'no', People: [2, 5] }, fastest: { 6: 12, 5: 3 }, stars: { '6:hard': true, '9:easy': true } }, ach: { 'first-stamp': '2026-11-13', bogus: '2026-11-13', express: 'yesterday' }, profile: { title: 'old-hand', cover: 'cream' } });
      assert.equal(bad.stats.games, 0); assert.equal(bad.stats.wins, 0); assert.deepEqual(bad.stats.byLevel.easy, [9, 9]); assert.deepEqual(Object.keys(bad.stats.cat), ['People']);
      assert.deepEqual(bad.stats.fastest, { 6: 12 }); assert.deepEqual(bad.stats.stars, { '6:hard': true }); assert.deepEqual(Object.keys(bad.ach), ['first-stamp']);
      assert.deepEqual(bad.profile, { title: null, cover: 'cream' }, 'a title that is not earned is dropped');
      assert.deepEqual(cleanRecord(null), freshRecord()); assert.deepEqual(cleanRecord('junk'), freshRecord());
    },
  },
  {
    name: 'S3-01 the save keeps the record: round trip, pre-wave save, damage, failed write',
    node: true,
    async run(t) {
      const mem = (value) => { let raw = value === null ? null : JSON.stringify(value), fail = 0; return { read: () => (raw === null ? null : JSON.parse(raw)), put: (v) => { raw = JSON.stringify(v); }, fail: (n = 1) => { fail = n; }, storage: () => ({ getItem: () => raw, setItem: (k, v) => { if (fail-- > 0) throw Error('full'); if (!k.endsWith('.bad')) raw = v; } }) }; };
      const m = mem(PRE_WAVE); const s = createSaveStore({ storage: m.storage }); s.load();
      assert.deepEqual(s.data.stats, freshRecord().stats, 'a save from before the record loads with an empty one'); assert.equal(s.data.best.quick, 55);
      const r = s.commitProgress({ kind: 'event', ev: 'stamp', count: 1, today: '2026-11-13' });
      assert.ok(r.ok); assert.deepEqual(r.earned, ['first-stamp']);
      const onDisk = m.read(); assert.equal(onDisk.stats.stamps, 1); assert.equal(onDisk.ach['first-stamp'], '2026-11-13');
      assert.equal(onDisk.best.quick, 55); assert.deepEqual(onDisk.best.era, { roaring: 40 }); assert.equal(onDisk.daily.streak, 2); assert.equal(onDisk.settings.aiSpeed, 'normal', 'nothing the save held is touched');
      assert.equal(onDisk.settings.seenCoach, undefined, 'an older save is not turned into a newcomer');
      const again = createSaveStore({ storage: m.storage }); again.load(); assert.equal(again.data.stats.stamps, 1, 'it survives a reload');
      // a failed write waits and is applied with the next one; nothing is counted twice
      m.fail(); const bad = s.commitProgress({ kind: 'event', ev: 'summit' }); assert.equal(bad.ok, false); assert.equal(m.read().stats.summits, 0);
      const ok = s.commitProgress({ kind: 'event', ev: 'summit' }); assert.ok(ok.ok); assert.equal(m.read().stats.summits, 2, 'the two summits are both kept once the write works');
      assert.equal(s.commitProgress({ kind: 'event', ev: 'summit' }).ok, true); assert.equal(m.read().stats.summits, 3);
      // a trail commit and a settings write never lose the record
      s.commitTrail({ trail: null, asked: [], rng: 1 }); s.updateSettings({ sound: false }); assert.equal(m.read().stats.summits, 3); assert.equal(m.read().ach['first-stamp'], '2026-11-13');
      // a hand-damaged record is repaired on load, and the rest of the save is untouched
      const dm = mem({ ...PRE_WAVE, stats: { games: 'lots', cat: 7 }, ach: [1, 2], profile: 'x' }); const ds = createSaveStore({ storage: dm.storage }); ds.load();
      assert.deepEqual(ds.data.stats, freshRecord().stats); assert.deepEqual(ds.data.ach, {}); assert.equal(ds.data.best.quick, 55);
      // a brand-new profile is the only one that gets the first-run tips
      const fm = mem(null); const fs = createSaveStore({ storage: fm.storage }); fs.load(); fs.updateSettings({ sound: true }); assert.equal(fm.read().settings.seenCoach, false);
    },
  },
  {
    name: 'S3-01 a finished trip is written to the Trail record and shown on the win card and the record screen',
    async run(t) {
      const s = await winTrip(t, { target: 6, round: 9 });
      t.equal(s.trail.winner, 0, 'the human wins');
      const sv = await stored(t);
      t.equal(sv.stats.games, 1, 'one game'); t.equal(sv.stats.wins, 1, 'one win'); t.equal(JSON.stringify(sv.stats.byLevel.hard), '[1,1]', 'against Hard');
      t.equal(sv.stats.fastest['6'], 9, 'fastest Weekend win is the 9 rounds it took'); t.expect(sv.stats.stars['6:hard'], 'Summit star for a Weekend against Hard');
      t.expect(sv.stats.summits >= 1, 'the Tower was reached'); t.expect(sv.stats.cat && typeof sv.stats.cat === 'object', 'category accuracy saved');
      t.expect(sv.ach['first-summit'] && sv.ach['hard-win'], 'Top of the Mountain and Outfoxed the Professor earned');
      const win = await text(t, '#scene-win');
      t.expect(win.includes('First Weekend win on record: 9 rounds'), 'the win card names the personal best');
      t.expect(win.includes('New Summit star: Weekend against Hard travelers'), 'and the new star');
      t.expect(win.includes('Achievement: Top of the Mountain'), 'and the achievement'); t.expect(/1 game played · 1 win · 100% win rate/.test(win), 'and the running total');
      await t.shot('S3-01-win-record');
      await t.checkLayout({ allowScrollY: true });
      await t.page.locator('#scene-win [data-act="goto"][data-arg="record"]').click();
      const rec = await text(t, '#scene-record');
      t.expect(rec.includes('Trail record'), 'record screen'); t.expect(/Hard\s*1\s*0\s*100%/.test(rec), 'Hard row: 1 won, 0 lost'); t.expect(rec.includes('9 rounds'), 'fastest win shown');
      t.expect(rec.includes('Top of the Mountain') && rec.includes('Outfoxed the Professor'), 'achievements listed');
      await t.shot('S3-01-record');
      await t.checkLayout({ allowScrollY: true });
      await t.reload();
      await t.game('scene', 'record');
      t.expect((await text(t, '#scene-record')).includes('9 rounds'), 'the record is still there after a reload');
    },
  },
  {
    name: 'S3-01 the title reaches the record screen and the achievements and locks are laid out',
    async run(t) {
      await t.game('setState', { settings: { seenCoach: true } });
      await t.game('scene', 'title');
      const btnLabel = await text(t, '#scene-title [data-arg="record"]');
      t.expect(btnLabel.includes('Trail Record'), 'the title has a Trail Record button');
      await t.page.locator('#scene-title [data-arg="record"]').click();
      const s = await t.state(); t.equal(s.scene, 'record', 'opens the record');
      const rec = await text(t, '#scene-record');
      t.expect(rec.toLowerCase().includes('achievements'), 'the record lists achievements'); t.expect(rec.includes('Locked: Win a Trail Game at the Mountain Tower.'), 'a locked cover says what unlocks it');
      t.equal(await t.page.locator('#scene-record .ach-list li').count(), ACHIEVEMENTS.length, 'every achievement is listed');
      t.expect(rec.includes('not yet'), 'unearned ones say so');
      await t.shot('S3-01-record-empty');
      await t.checkLayout({ allowScrollY: true });
      await t.page.keyboard.press('Escape'); t.equal((await t.state()).scene, 'title', 'Escape goes back to the title');
    },
  },
  {
    name: 'S3-01 an achievement shows a toast without interrupting play, and plays its cue',
    async run(t) {
      await soloGame(t, { players: [H1], settings: { seenCoach: true } });
      const s0 = await t.state();
      await landOn(t, s0.board.landmarks['Sports']);
      await phase(t, 'question');
      await t.game('act', 'answer', 'correct');
      await phase(t, 'feedback');
      await t.page.waitForSelector('#toast.on', { timeout: 3000 });
      const info = await t.page.evaluate(() => { const el = document.querySelector('#toast'); const cs = getComputedStyle(el); return { text: el.innerText, events: cs.pointerEvents, aria: el.getAttribute('aria-hidden'), focus: el.contains(document.activeElement) }; });
      t.expect(info.text.includes('Ink on the Passport') && info.text.includes('Win your first district stamp.'), 'toast names the achievement: ' + info.text.replace(/\s+/g, ' '));
      t.equal(info.events, 'none', 'a tap goes through it'); t.expect(!info.focus, 'it never takes focus');
      t.equal((await t.state()).trail.phase, 'feedback', 'play is not interrupted');
      await t.shot('S3-01-toast', { wait: false });
      const sv = await stored(t);
      t.equal(sv.ach['first-stamp'].length, 10, 'saved with its date'); t.equal(sv.stats.stamps, 1, 'stamp counted');
    },
  },
  {
    name: 'S3-01 an achievement cue sits in the cue range',
    viewports: ['desktop'],
    async run(t) {
      const r = await t.page.evaluate(() => window.__game.audioRender('cue:achieve', 2, false));
      t.expect(r.peak >= 0.2 && r.peak <= 0.45, 'achieve peaks at ' + r.peak.toFixed(3));
      t.log('achieve cue: peak ' + r.peak.toFixed(3) + ', rms ' + (r.rmsDb !== undefined ? r.rmsDb.toFixed(1) : r.rms) + ' dB');
    },
  },
  {
    name: 'S3-01 a title and a passport cover can be worn once earned, and survive a reload',
    initScript: withSave({ ...VETERAN, ach: { 'first-summit': '2026-11-01', 'hard-win': '2026-11-02' }, stats: { games: 3, wins: 2, byLevel: { easy: [0, 0], medium: [1, 1], hard: [1, 2] }, cat: {}, bestStreak: 6, stamps: 14, summits: 3, fastest: { 6: 21 }, stars: { '6:medium': true }, }, profile: { title: null, cover: null } }),
    async run(t) {
      await t.game('scene', 'record');
      const rec0 = await lower(t, '#scene-record');
      t.expect(rec0.includes('games') && rec0.includes('21 rounds') && rec0.includes('2 of ' + ACHIEVEMENTS.length), 'record from the save: ' + rec0.slice(0, 80).replace(/\s+/g, ' '));
      t.expect(await t.page.locator('[data-act="wear"][data-arg="title:first-summit"]').count() === 1, 'an earned title can be worn');
      t.expect(rec0.includes('locked: win 10 trail games.'), 'a title not yet earned says what it takes');
      await t.page.locator('[data-act="wear"][data-arg="title:first-summit"]').click();
      await t.page.locator('[data-act="wear"][data-arg="cover:crimson"]').click();
      const sv = await stored(t);
      t.equal(sv.profile.title, 'first-summit', 'title saved'); t.equal(sv.profile.cover, 'crimson', 'cover saved'); t.equal(sv.stats.games, 3, 'the rest of the record is kept');
      await t.shot('S3-01-record-wear', { fullPage: false });
      await t.reload();
      await soloGame(t, { players: [H1], settings: { seenCoach: true } });
      await t.page.locator('[data-act="passport"]').click();
      const pp = await t.page.evaluate(() => { const c = document.querySelector('.pp-cover'); return { sub: c.innerText, from: c.style.getPropertyValue('--cv-from') }; });
      t.expect(pp.sub.toLowerCase().includes('summit seeker'), 'the passport carries the worn title: ' + pp.sub.replace(/\s+/g, ' ')); t.equal(pp.from, '#8e2a36', 'and the worn cover');
      await t.shot('S3-01-passport-cover');
      await t.checkLayout({ allowScrollY: true });
    },
  },
  {
    name: 'S3-01 a title that is not earned falls back to none (a hand-edited save)',
    initScript: withSave({ ...VETERAN, profile: { title: 'old-hand', cover: 'gilt' } }),
    viewports: ['desktop'],
    async run(t) {
      const r = await t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-trivia-v1')).profile);
      t.equal(r.title, 'old-hand', 'the file is as it was written');
      await t.game('scene', 'record');
      const rec = await text(t, '#scene-record');
      t.expect(rec.includes('Locked: Win 10 Trail Games.'), 'still locked');
      await soloGame(t, { players: [H1], settings: { seenCoach: true } });
      await t.page.locator('[data-act="passport"]').click();
      const sub = await t.page.evaluate(() => ({ sub: document.querySelector('.pp-cover').innerText, from: document.querySelector('.pp-cover').style.getPropertyValue('--cv-from') }));
      t.expect(!sub.sub.includes('Valley Veteran'), 'no title worn'); t.equal(sub.from, '#23433a', 'default cover, no error');
    },
  },
  {
    name: 'S3-01 a save from before the record loads with everything it had, and counts from there',
    initScript: withSave(PRE_WAVE),
    async run(t) {
      const s0 = await t.state();
      t.equal(s0.settings.seenCoach, true, 'an older save is not a newcomer'); t.equal(s0.settings.aiSpeed, 'normal', 'its AI speed is kept');
      await t.game('scene', 'record');
      const rec = await text(t, '#scene-record');
      t.expect(rec.includes('55') && rec.includes('Daily Challenge streak') && /Daily Challenge streak\s*2/.test(rec), 'Quick best and daily streak come from the old save');
      t.expect(/Daily Challenges played\s*2/.test(rec), 'two Daily Challenges played');
      const w = await winTrip(t, { players: [H1, { kind: 'ai', level: 'easy' }], target: 4, round: 5 });
      const sv = await stored(t);
      t.equal(sv.best.quick, 55, 'Quick best intact'); t.equal(JSON.stringify(sv.best.era), '{"roaring":40}', 'era best intact'); t.equal(sv.daily.streak, 2, 'daily streak intact');
      t.equal(sv.stats.games, 1, 'the record starts counting'); t.equal(sv.stats.fastest['4'], 5, 'Day Trip best');
    },
  },
  {
    name: 'S3-01 a perfect Quick 10 earns Perfect Ten',
    viewports: ['desktop'],
    async run(t) {
      await t.game('setState', { settings: { seenCoach: true } });
      await t.game('newGame', { mode: 'quick', seed: 3 });
      for (let i = 0; i < 10; i++) { await t.game('act', 'answer', 'correct'); await t.game('act', 'continue'); }
      await waitFor(t, (x) => x.scene === 'results', 3000, 'results');
      const sv = await stored(t);
      t.expect(sv.ach['perfect-ten'], 'Perfect Ten earned'); t.equal(sv.best.quick > 0, true, 'and the Quick best is still written');
    },
  },
];

// ---------------- S2-01 ----------------
const words = (s) => s.trim().split(/\s+/).length;
const tip = (t) => t.page.evaluate(() => { const c = document.querySelector('.coach'); return c ? { id: c.dataset.tip, text: c.querySelector('p').innerText, where: c.closest('#modal') ? 'modal' : c.closest('#panel') ? 'panel' : '?', box: c.getBoundingClientRect().toJSON(), skip: !!c.querySelector('[data-act="coach-skip"]'), anim: getComputedStyle(c).animationName } : null; });
const box = (t, sel) => t.page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; }, sel);
const overlap = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const coachGame = async (t, extra = {}) => soloGame(t, { players: [H1], settings: { seenCoach: false, ...extra } });
const press = async (t, sel) => (t.viewport === 'mobile' ? t.tap(await t.page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })) : t.page.locator(sel).first().click());

tests.push(
  {
    name: 'S2-01 every tip is twelve words or fewer, for touch, mouse and keyboard',
    viewports: ['desktop'],
    async run(t) {
      for (const input of ['touch', 'mouse', 'keys']) {
        const list = await t.game('coachTexts', input);
        t.equal(list.length, 4, 'four tips');
        for (const x of list) t.expect(words(x) <= 12 && /[.!]$/.test(x), `${input}: "${x}" is ${words(x)} words`);
      }
      const keys = (await t.game('coachTexts', 'keys')).join(' '); const touch = (await t.game('coachTexts', 'touch')).join(' ');
      t.expect(/Press a number/.test(keys) && /Press A to D/.test(keys) && !/Tap/.test(keys), 'the keyboard words name keys');
      t.expect(/Tap a lit space/.test(touch) && /Tap an answer/.test(touch) && !/Press/.test(touch), 'the touch words say tap');
    },
  },
  {
    name: 'S2-01 a newcomer gets the tips in play, one at a time, each where it matters, and each ends when its thing is done',
    async run(t) {
      await coachGame(t);
      const s0 = await t.state();
      t.equal(s0.settings.seenCoach, false, 'a new profile has not seen the tips');
      let x = await tip(t);
      t.expect(x && x.id === 'goal' && x.where === 'panel', 'the goal tip shows at the first roll, in the panel');
      t.equal(x.text, 'Goal: win 6 stamps at gold-ring landmarks, then climb the Tower.', 'goal first');
      t.expect(x.skip, 'Skip tips is visible while a tip shows'); t.equal(await t.page.locator('.coach').count(), 1, 'one tip at a time');
      t.expect((await text(t, '#panel .objective')).includes('Collect 6 stamps, then climb to the Mountain Tower.'), 'the standing objective sits under the turn header');
      await t.shot('S2-01-tip-goal');
      const turn = await box(t, '#panel .turn'), rollBtn = await box(t, '[data-act="roll"]');
      t.expect(!overlap(x.box, turn) && !overlap(x.box, rollBtn), 'the tip covers neither the turn header nor the Roll button');
      t.expect(rollBtn.bottom <= (await t.page.evaluate(() => innerHeight)), 'the Roll button is still on screen');
      await t.checkLayout({ allowScrollY: true });
      // do the thing: roll (from beside a landmark, so the move leads to a landmark question), and the tip for choosing takes over
      const s = await t.state();
      await t.game('setState', { trail: { players: [{ node: await neighborOf(t, s.board.landmarks['Sports']) }] } });
      await t.game('act', 'roll', 1);
      await phase(t, 'choose');
      x = await tip(t);
      t.expect(x && x.id === 'move' && x.where === 'panel', 'the move tip replaces the goal tip');
      t.expect(t.viewport === 'mobile' ? x.text.startsWith('Tap a lit space') : x.text.startsWith('Click a lit space'), 'worded for the input in use: ' + (x && x.text));
      await t.shot('S2-01-tip-move');
      t.expect(!overlap(x.box, await box(t, '.dests')), 'it does not sit on the destination list');
      await t.game('act', 'choose', s.board.landmarks['Sports']);
      await t.game('act', 'finishAnim');
      await phase(t, 'question');
      x = await tip(t);
      t.expect(x && x.id === 'answer' && x.where === 'modal', 'the answer tip shows on the question card, not in the panel behind it');
      t.expect(/^(Tap|Click) an answer\. Landmark answers also pay stamps\.$/.test(x.text), 'answer words: ' + (x && x.text));
      const firstAns = await box(t, '.ans');
      t.expect(!overlap(x.box, firstAns) && x.box.bottom <= firstAns.top + 1, 'above the answers, covering none of them');
      await t.shot('S2-01-tip-answer');
      await t.checkLayout({ allowScrollY: true });
      await t.game('act', 'answer', 'correct'); await phase(t, 'feedback');
      t.equal(await tip(t), null, 'answering ends the answer tip');
      await t.game('act', 'continue');
      await phase(t, 'roll');
      x = await tip(t);
      t.expect(x && x.id === 'tickets', 'the tickets tip shows at the next roll'); t.equal(x && x.text, 'Tickets buy re-rolls, 50/50 hints and trolley rides.', 'tickets words');
      await t.shot('S2-01-tip-tickets');
      await press(t, '[data-act="roll"]');
      await phase(t, 'choose');
      t.equal(await tip(t), null, 'rolling ends the last tip');
      await waitFor(t, (st) => st.settings.seenCoach === true, 3000, 'seenCoach set');
      t.equal((await stored(t)).settings.seenCoach, true, 'seen is saved with the settings');
    },
  },
  {
    name: 'S2-01 Skip tips ends them for good, and Show tips again in Settings brings them back',
    async run(t) {
      await coachGame(t);
      t.expect((await tip(t)) !== null, 'a tip shows');
      await press(t, '[data-act="coach-skip"]');
      t.equal(await tip(t), null, 'gone');
      t.equal((await stored(t)).settings.seenCoach, true, 'saved as seen');
      await t.game('act', 'roll', 3); await phase(t, 'choose'); t.equal(await tip(t), null, 'no later tip either');
      await t.game('scene', 'settings');
      t.expect((await text(t, '#scene-settings')).includes('Show tips again'), 'Settings has the control');
      await t.page.locator('[data-act="coach-replay"]').click();
      t.equal((await stored(t)).settings.seenCoach, false, 'replay is saved');
      await t.shot('S2-01-settings-tips');
      await t.reload();
      await t.game('setState', { settings: { passScreen: false, aiSpeed: 'fast', timer: 0 } });
      await t.game('newGame', { mode: 'trail', players: [H1], target: 6, seed: 7 });
      await phase(t, 'roll');
      const x = await tip(t); t.expect(x && x.id === 'goal', 'the tips start again from the goal, after a reload too');
    },
  },
  {
    name: 'S2-01 a player with an existing save does not get the tips unless they ask',
    initScript: withSave(PRE_WAVE),
    async run(t) {
      const s = await t.state();
      t.equal(s.settings.seenCoach, true, 'an older save counts as seen');
      await t.game('setState', { settings: { passScreen: false, aiSpeed: 'fast', timer: 0 } });
      await t.game('newGame', { mode: 'trail', players: [H1], target: 6, seed: 7 });
      await phase(t, 'roll');
      t.equal(await tip(t), null, 'no tip');
      t.expect((await text(t, '#panel .objective')).includes('Collect 6 stamps'), 'the standing objective is still there');
      const sv = await stored(t);
      t.expect(sv.settings.seenCoach !== false, 'saving does not turn them into a newcomer');
      t.equal(sv.settings.aiSpeed, 'fast', 'settings they change are kept');
    },
  },
  {
    name: 'S2-01 the words follow the input in use: keys on a keyboard, taps on touch',
    async run(t) {
      await coachGame(t);
      if (t.viewport === 'desktop') {
        await t.page.keyboard.press('Space');
        await phase(t, 'choose');
        const x = await tip(t); t.expect(x && x.text === 'Press a number, or use arrows and Enter, to move there.', 'after a key press the tip names keys: ' + (x && x.text));
        t.equal((await t.state()).coach.input, 'keys', 'input is keys');
      } else {
        await press(t, '[data-act="roll"]'); await phase(t, 'choose');
        const x = await tip(t); t.expect(x && x.text.startsWith('Tap a lit space'), 'on touch the tip says Tap: ' + (x && x.text));
      }
    },
  },
  {
    name: 'S2-01 a tip is announced to screen readers, has no motion, and a tip you ignore ends by itself',
    reducedMotion: true,
    async run(t) {
      await coachGame(t);
      let live = '';
      for (let i = 0; i < 20 && !live.includes('Goal:'); i++) { await t.page.waitForTimeout(100); live = await text(t, '#live'); }
      t.expect(live.includes('Goal: win 6 stamps'), 'the live region reads the tip: ' + live);
      const x = await tip(t); t.equal(x && x.anim, 'none', 'the tip does not animate');
      t.equal((await t.state()).ui.reduced, true, 'reduced motion is on');
      await t.page.evaluate(() => { const d = Date.now; Date.now = () => d() + 25000; });
      await t.page.waitForTimeout(300);
      t.equal(await tip(t), null, 'an ignored tip ends by waiting');
      t.equal((await t.state()).coach.step, 1, 'and the next is the move tip');
    },
  },
  {
    name: 'S2-01 the goal is also permanent: setup card, pause card and Help',
    async run(t) {
      await t.game('setState', { settings: { seenCoach: true } });
      await t.game('scene', 'setup');
      const setup = await text(t, '#scene-setup');
      t.expect(setup.includes('Goal: win district stamps at the gold-ring landmarks') && setup.includes('Mountain Tower'), 'setup card states the goal and the stamp dots');
      await t.shot('S2-01-setup-goal');
      await t.checkLayout({ allowScrollY: true });
      await soloGame(t, { players: [H1], settings: { seenCoach: true } });
      await t.page.locator('[data-act="menu"]').click();
      t.expect((await text(t, '#modal')).includes('Collect 6 stamps, then climb to the Mountain Tower.'), 'pause card states the goal');
      await t.shot('S2-01-pause-goal');
      await t.page.keyboard.press('Escape');
      await t.game('scene', 'help');
      t.expect((await text(t, '#scene-help')).toLowerCase().includes('goal: collect your stamp target'), 'Help starts with the goal');
    },
  },
);

// ---------------- S4-01 ----------------
const NAMES = ['Doc Vapor', 'Miss Promenade', 'The Professor', 'Ticket Taker', 'Trail Boss', 'Lady Tufa'];
const EVENTS = ['stamp', 'hard', 'miss', 'summitMiss', 'win', 'lose'];
const logTop = async (t, n = 3) => (await t.state()).trail.log.slice(0, n);
// Two computer travelers, the game held on the pause card so their own timers stay quiet; the test plays their turns by hand.
async function cast(t, players, { seed = 7 } = {}) {
  await t.seed(seed);
  await t.game('setState', { settings: { passScreen: false, aiSpeed: 'normal', timer: 0, seenCoach: true } });
  await t.game('newGame', { mode: 'trail', players, target: 6, seed });
  await t.game('act', 'ui', 'menu');
  await waitFor(t, (s) => s.ui.menu, 2000, 'paused');
}
// The active traveler (a computer one: its own timers are quiet while paused) is put on `from`, rolls a 1 and steps to `to`.
async function step(t, from, to, extra = {}) {
  let s = await t.state(); const me = s.trail.turn;
  await t.game('setState', { trail: { phase: 'roll', rerolled: false, roll: null, dests: [], players: s.trail.players.map((p, i) => (i === me ? { node: from, ...extra } : {})) } });
  await t.game('act', 'roll', 1);
  s = await phase(t, 'choose'); t.expect(s.trail.dests.includes(to), 'node ' + to + ' is one step from ' + from);
  await t.game('act', 'choose', to); await t.game('act', 'finishAnim');
  return waitFor(t, (x) => x.trail.phase !== 'moving', 4000, 'move end');
}
async function toQuestion(t) {
  const lm = (await t.state()).board.landmarks['Sports'];
  await step(t, await neighborOf(t, lm), lm);
  return phase(t, 'question');
}
const aiAnswer = async (t, how) => { await toQuestion(t); await t.game('act', 'answer', how); return phase(t, 'feedback'); };

tests.push(
  {
    name: 'S4-01 all six names have lines for every event, three or four each, proofread and in their own voices',
    viewports: ['desktop'],
    async run(t) {
      await t.game('setState', { settings: { seenCoach: true, passScreen: false } });
      await t.game('newGame', { mode: 'trail', players: [{ kind: 'ai', level: 'easy' }, { kind: 'ai', level: 'medium' }, { kind: 'ai', level: 'hard' }, { kind: 'ai', level: 'easy' }, { kind: 'ai', level: 'medium' }, { kind: 'ai', level: 'hard' }], target: 4 });
      await t.game('act', 'stopAI');
      const seated = (await t.state()).trail.players.map((p) => p.name);
      t.equal(JSON.stringify(seated.slice().sort()), JSON.stringify(NAMES.slice().sort()), 'six AI seats take the six names');
      const lines = await t.game('voices');
      t.equal(JSON.stringify(Object.keys(lines).sort()), JSON.stringify(NAMES.slice().sort()), 'a set for each name');
      const seen = new Set();
      for (const n of NAMES) {
        t.equal(JSON.stringify(Object.keys(lines[n]).sort()), JSON.stringify(EVENTS.slice().sort()), n + ' has every event');
        for (const e of EVENTS) {
          const l = lines[n][e];
          t.expect(l.length >= 3 && l.length <= 4, `${n} ${e}: ${l.length} lines`);
          t.expect(new Set(l).size === l.length, `${n} ${e}: no repeated line`);
          for (const x of l) {
            t.expect(x.length <= 52 && x.length >= 8, `${n} ${e}: "${x}" is ${x.length} characters`);
            t.expect(/^[A-Z“]/.test(x) && /[.!?]$/.test(x), `${n} ${e}: "${x}" starts with a capital and ends with a stop`);
            t.expect(!/\s{2}|\s[.,!?]|[.,!?][A-Za-z]/.test(x) && !/\d/.test(x), `${n} ${e}: "${x}" is clean and carries no figures`);
            t.expect(!seen.has(x), `"${x}" is only used once`); seen.add(x);
          }
        }
      }
      const jargon = Object.values(lines).flatMap((o) => Object.values(o).flat()).filter((x) => /\b(teh|recieve|definately|seperate|wich|occured)\b/i.test(x));
      t.equal(jargon.length, 0, 'no common misspellings');
    },
  },
  {
    name: 'S4-01 a named opponent speaks after a miss: log line, speech bubble over the pawn and a line on the question card',
    async run(t) {
      await cast(t, [{ kind: 'ai', level: 'medium' }, H1]);
      const who = (await t.state()).trail.players[0].name; t.equal(who, 'Miss Promenade', 'the Medium AI is Miss Promenade');
      await toQuestion(t);
      await t.game('act', 'ui', 'close-modal');
      await t.game('act', 'answer', 'wrong');
      const s = await phase(t, 'feedback');
      const top = s.trail.log[0];
      t.expect(/^Miss Promenade: “.+”$/.test(top), 'the log line is her quip: ' + top);
      const lines = await t.game('voices');
      t.expect(lines['Miss Promenade'].miss.some((l) => top === `Miss Promenade: “${l}”`), 'a line from her miss set');
      t.equal(s.say.event, 'miss', 'the say record names the event'); t.equal(s.ui.bubble, s.say.text, 'the bubble over the pawn holds the same words');
      const modal = await text(t, '#modal');
      t.expect(modal.includes(`Miss Promenade: “${s.say.text}”`), 'the question card shows it too');
      const live = await text(t, '#live');
      t.expect(live.includes('Miss Promenade missed') && live.includes('“'), 'one announcement carries the result and the quip: ' + live);
      await t.shot('S4-01-quip-card', { wait: false });
      await t.game('act', 'continue');
      await t.game('act', 'stopAI');
      await t.page.waitForTimeout(250);
      await t.shot('S4-01-bubble', { wait: false });
      await t.page.waitForTimeout(4000);
      t.equal((await t.state()).ui.bubble, null, 'the bubble is gone after a few seconds');
    },
  },
  {
    name: 'S4-01 a stamp always gets a line; a miss only every other round, so they do not talk over every turn',
    viewports: ['desktop'],
    async run(t) {
      await cast(t, [{ kind: 'ai', level: 'medium' }, { kind: 'ai', level: 'hard' }]);
      const heard = [];
      const quip = async () => { const l = (await logTop(t, 1))[0]; return /^(Miss Promenade|The Professor): “/.test(l) ? l : null; };
      let s = await aiAnswer(t, 'wrong'); heard.push(await quip());          // round 1, Miss Promenade
      await t.game('act', 'continue'); await phase(t, 'roll');
      await aiAnswer(t, 'wrong'); heard.push(await quip());                  // round 1, The Professor
      await t.game('act', 'continue'); await phase(t, 'roll');
      await aiAnswer(t, 'wrong'); heard.push(await quip());                  // round 2, Miss Promenade: too soon
      await t.game('act', 'continue'); await phase(t, 'roll');
      await aiAnswer(t, 'wrong'); heard.push(await quip());                  // round 2, The Professor: too soon
      await t.game('act', 'continue'); await phase(t, 'roll');
      await aiAnswer(t, 'wrong'); heard.push(await quip());                  // round 3, Miss Promenade: two rounds on
      t.expect(heard[0] !== null && heard[1] !== null, 'each speaks on a first miss: ' + JSON.stringify(heard.slice(0, 2)));
      t.expect(heard[2] === null && heard[3] === null, 'and not on the very next round');
      t.expect(heard[4] !== null, 'but again two rounds on');
      t.expect(heard[0].split(': ')[1] !== heard[4].split(': ')[1], 'and with a different line, not the same one again');
      // a stamp is always said
      await t.game('act', 'continue'); await phase(t, 'roll');
      s = await aiAnswer(t, 'correct'); const l = (await logTop(t, 1))[0];
      t.expect(/: “.+”$/.test(l) && s.say.event === 'stamp', 'a stamp is always spoken: ' + l);
    },
  },
  {
    name: 'S4-01 falling at the Tower, winning it and losing it all have lines; the win card names the cast',
    async run(t) {
      await cast(t, [{ kind: 'ai', level: 'hard' }, H1]);
      const s0 = await t.state(); const tower = s0.board.tower;
      await step(t, tower - 1, tower, { stamps: ALL.slice(0, 6) });
      await t.game('act', 'continue'); await phase(t, 'question');
      await t.game('act', 'answer', 'wrong');
      let s = await phase(t, 'feedback');
      t.equal(s.say && s.say.event, 'summitMiss', 'a miss at the Tower is its own event'); t.expect(/^The Professor: “.+”$/.test(s.trail.log[0]), 'quip logged: ' + s.trail.log[0]);
      t.equal(s.ui.bubble, s.say.text, 'and shown over the pawn');
      await t.game('act', 'continue');
      await waitFor(t, (x) => x.trail.turn === 1, 4000, 'next turn');
      // now The Professor wins
      await t.game('act', 'stopAI');
      await t.game('setState', { trail: { turn: 0 } });
      await step(t, tower - 1, tower, { stamps: ALL.slice(0, 6) });
      await t.game('act', 'continue'); await phase(t, 'question');
      await t.game('act', 'answer', 'correct'); await phase(t, 'feedback');
      await t.game('act', 'continue');
      s = await waitFor(t, (x) => x.scene === 'win', 3000, 'win scene');
      t.equal(s.trail.winner, 0, 'The Professor wins');
      t.expect(Array.isArray(s.trail.final) && s.trail.final.length === 1 && s.trail.final[0].event === 'win' && s.trail.final[0].name === 'The Professor', 'the closing words are the winner\'s: ' + JSON.stringify(s.trail.final));
      const win = await text(t, '#scene-win .cast');
      t.expect(win.includes('The Professor') && win.includes(`“${s.trail.final[0].text}”`), 'the win card names him and quotes him: ' + win);
      await t.shot('S4-01-win-cast');
      await t.checkLayout({ allowScrollY: true });
    },
  },
  {
    name: 'S4-01 when a human wins, each computer traveler has a losing word on the win card',
    async run(t) {
      const s = await winTrip(t, { players: [H1, { kind: 'ai', level: 'easy' }, { kind: 'ai', level: 'medium' }] });
      const f = s.trail.final; t.equal(f.length, 2, 'two computer travelers');
      t.expect(f.every((x) => x.event === 'lose'), 'both lose');
      const lines = await t.game('voices');
      for (const x of f) t.expect(lines[x.name].lose.includes(x.text), `${x.name}'s line is from their set`);
      const card = await text(t, '#scene-win .cast');
      t.expect(card.includes('Doc Vapor') && card.includes('Miss Promenade'), 'the card lists both: ' + card.replace(/\s+/g, ' '));
      await t.shot('S4-01-win-cast-lose');
      await t.checkLayout({ allowScrollY: true });
    },
  },
  {
    name: 'S4-01 humans and AI seats with a name the player typed stay quiet',
    viewports: ['desktop'],
    async run(t) {
      await cast(t, [{ kind: 'ai', level: 'medium', name: 'Zed' }, H1]);
      await aiAnswer(t, 'wrong');
      t.expect(!/: “/.test((await logTop(t, 1))[0]), 'a custom-named AI has no lines: ' + (await logTop(t, 1))[0]);
      t.equal((await t.state()).ui.bubble, null, 'and no bubble');
      await t.game('act', 'continue');
    },
  },
);
