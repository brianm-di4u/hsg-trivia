// The Trail record: lifetime counters, achievements and the cosmetics they open (S3-01).
// Pure data and rules, no DOM and no storage: save.js applies an "intent" to the saved record, ui.js draws it.
// An intent is a small plain object describing something the player did (see applyIntent), so a write that fails can be retried.

export const LEVELS = ['easy', 'medium', 'hard'];
export const TARGET_SIZES = [4, 6, 8];
export const TARGET_NAMES = { 4: 'Day Trip', 6: 'Weekend', 8: 'Grand Tour' };
export const LEVEL_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const CAP = 1e6; // no counter grows past this, so a damaged save cannot hold an absurd number

// ---------- achievements: each is earned by play the game can verify, never by opening a menu ----------
// title: a title the player may wear once it is earned. cover: a passport cover that unlocks with it.
export const ACHIEVEMENTS = [
  { id: 'first-stamp', name: 'Ink on the Passport', text: 'Win your first district stamp.', title: 'Stamp Collector' },
  { id: 'streak5', name: 'Hot Streak', text: 'Answer five in a row in one trip.' },
  { id: 'time-warp', name: 'Time Traveler', text: 'Put the Time Warp events in the right order.' },
  { id: 'post-time', name: 'Post Time Pays', text: 'Win a wager of 3 tickets or more at Oaklawn.' },
  { id: 'express', name: 'First Class', text: 'Ride an Express ticket to a landmark.' },
  { id: 'first-summit', name: 'Top of the Mountain', text: 'Win a Trail Game at the Mountain Tower.', title: 'Summit Seeker', cover: 'copper' },
  { id: 'full-passport', name: 'Full Passport', text: 'Hold all eight district stamps in one trip.', title: 'Passport Perfect' },
  { id: 'streak10', name: 'Boiling Over', text: 'Answer ten in a row in one trip.', title: 'Steam Engine' },
  { id: 'grand-tour', name: 'Grand Tour', text: 'Win a Grand Tour of eight stamps.', cover: 'indigo' },
  { id: 'hard-win', name: 'Outfoxed the Professor', text: 'Win a trip with a Hard computer traveler at the table.', title: 'Quiz Champion', cover: 'crimson' },
  { id: 'perfect-ten', name: 'Perfect Ten', text: 'Answer all ten right in Quick 10 or Era Express.' },
  { id: 'regular', name: 'Bathhouse Regular', text: 'Finish 10 Trail Games.', title: 'Bathhouse Regular' },
  { id: 'daily-7', name: 'Daily Habit', text: 'Keep a seven-day Daily Challenge streak.', cover: 'emerald' },
  { id: 'well-rounded', name: 'Well Rounded', text: 'Answer 10 right in every one of the eight categories.', title: 'Local Scholar' },
  { id: 'journal-full', name: 'Journal Complete', text: 'Open all eight pages of the passport journal.' },
  { id: 'old-hand', name: 'Valley Veteran', text: 'Win 10 Trail Games.', title: 'Valley Veteran', cover: 'gilt' },
];
export const ACH = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
// Passport covers, drawn in CSS from these two colours. 'cream' is the cover everyone starts with.
export const COVERS = [
  { id: 'cream', name: 'Green and gold', from: '#23433a', to: '#1b342d', ink: '#f1e2b8' },
  { id: 'copper', name: 'Copper', from: '#8a4f2a', to: '#693a1e', ink: '#fbe6c8', need: 'first-summit' },
  { id: 'indigo', name: 'Indigo', from: '#2c3a73', to: '#1f2a55', ink: '#e9ecff', need: 'grand-tour' },
  { id: 'crimson', name: 'Crimson', from: '#8e2a36', to: '#671d27', ink: '#ffe9e4', need: 'hard-win' },
  { id: 'emerald', name: 'Emerald', from: '#1f6b4f', to: '#14503a', ink: '#e0fbe9', need: 'daily-7' },
  { id: 'gilt', name: 'Gilt', from: '#8c6d1f', to: '#6a5214', ink: '#fff6d6', need: 'old-hand' },
];
export const TITLES = ACHIEVEMENTS.filter((a) => a.title).map((a) => ({ id: a.id, name: a.title, need: a.id }));

// ---------- the saved shape, with defaults and repair ----------
const zero = () => ({ games: 0, wins: 0, byLevel: { easy: [0, 0], medium: [0, 0], hard: [0, 0] }, cat: {}, bestStreak: 0, stamps: 0, summits: 0, fastest: {}, stars: {} });
// journal: the day each district's stamp was first won, by district key (S3-20); it fills from now on, a trip played before it has no dates.
// A page opened by the journal's first load for a save that proves an eight-stamp win holds JOURNAL_BEFORE in place of a day (C4-08).
// A build from before it drops that value when it reads the record, so its pages stay shut and nothing else changes; this build opens them again on the next load.
export const JOURNAL_BEFORE = 'before';
export const JOURNAL_KEYS = ['row', 'bridge', 'central', 'oaklawn', 'lakes', 'ballfields', 'hollow', 'park'];
export const freshRecord = () => ({ stats: zero(), ach: {}, profile: { title: null, cover: null }, journal: {} });
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const cnt = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(CAP, Math.floor(v))) : 0);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
// Anything damaged falls back to its default; nothing the player has is ever lowered by the repair.
export function cleanRecord(raw) {
  const out = freshRecord(); const r = isObj(raw) ? raw : {}; const s = isObj(r.stats) ? r.stats : {};
  for (const k of ['games', 'wins', 'bestStreak', 'stamps', 'summits']) out.stats[k] = cnt(s[k]);
  for (const l of LEVELS) { const a = isObj(s.byLevel) && Array.isArray(s.byLevel[l]) ? s.byLevel[l] : []; out.stats.byLevel[l] = [cnt(a[0]), Math.max(cnt(a[0]), cnt(a[1]))]; }
  if (isObj(s.cat)) for (const [k, a] of Object.entries(s.cat).slice(0, 40)) if (Array.isArray(a)) out.stats.cat[String(k).slice(0, 40)] = [cnt(a[0]), Math.max(cnt(a[0]), cnt(a[1]))];
  if (isObj(s.fastest)) for (const n of TARGET_SIZES) if (cnt(s.fastest[n]) > 0) out.stats.fastest[n] = cnt(s.fastest[n]);
  if (isObj(s.stars)) for (const n of TARGET_SIZES) for (const l of LEVELS) if (s.stars[n + ':' + l] === true) out.stats.stars[n + ':' + l] = true;
  if (isObj(r.ach)) for (const a of ACHIEVEMENTS) if (typeof r.ach[a.id] === 'string' && DAY.test(r.ach[a.id])) out.ach[a.id] = r.ach[a.id];
  if (isObj(r.journal)) for (const k of JOURNAL_KEYS) if (typeof r.journal[k] === 'string' && (DAY.test(r.journal[k]) || r.journal[k] === JOURNAL_BEFORE)) out.journal[k] = r.journal[k];
  const p = isObj(r.profile) ? r.profile : {};
  out.profile.title = TITLES.some((t) => t.id === p.title && out.ach[t.need]) ? p.title : null;
  out.profile.cover = COVERS.some((c) => c.id === p.cover && (!c.need || out.ach[c.need])) ? p.cover : null;
  return out;
}

export const coverUnlocked = (rec, c) => !c.need || !!rec.ach[c.need];
export const titleName = (id) => (TITLES.find((t) => t.id === id) || {}).name || null;
export const coverOf = (rec) => COVERS.find((c) => c.id === rec.profile.cover && coverUnlocked(rec, c)) || COVERS[0];

// C4-08 and C4-04: on load, a record that shows a human seat won an eight-stamp trip (the fastest eight-stamp win, an eight-stamp Summit star or Grand Tour)
// opens every journal page that is still shut, marked JOURNAL_BEFORE ("won before the journal was kept"); a record that shows only shorter wins or a stamp count opens nothing.
// A journal with all eight pages open then holds the Journal Complete achievement, dated today and given without a toast. Pages already dated keep their dates.
// Returns true when anything changed, so the caller writes only then.
export function settleJournal(data, today) {
  const st = data.stats, day = DAY.test(today || '') ? today : '2026-01-01';
  const wonEight = cnt(st.fastest[8]) > 0 || LEVELS.some((l) => st.stars['8:' + l] === true) || !!data.ach['grand-tour'];
  let changed = false;
  if (wonEight) for (const k of JOURNAL_KEYS) if (!data.journal[k]) { data.journal[k] = JOURNAL_BEFORE; changed = true; }
  if (JOURNAL_KEYS.every((k) => data.journal[k]) && !data.ach['journal-full']) { data.ach['journal-full'] = day; changed = true; }
  return changed;
}

// ---------- applying an intent ----------
// data: the saved object (it has stats, ach, profile). Returns { earned: [ids], best: [notes] } and changes data in place.
//   { kind: 'event', ev: 'stamp', count, d }   a human earned the stamp of district `d` and now holds `count`
//   { kind: 'event', ev: 'streak', n }      a human is on a run of n right answers
//   { kind: 'event', ev: 'summit' | 'express' | 'warp' }   a human reached the Tower / bought an Express / ordered a Time Warp right
//   { kind: 'event', ev: 'wager', won }     a human won `won` tickets at Post Time
//   { kind: 'trail', won, target, rounds, levels, cats, streak }   a Trail Game ended with a human seat in it
//   { kind: 'quiz', mode, right, total, dailyStreak }               a solo mode ended
//   { kind: 'profile', title, cover }       wear a title and a cover (only ones that are earned)
export function applyIntent(data, intent) {
  const st = data.stats, earned = [], best = [];
  const earn = (id) => { if (!data.ach[id]) { data.ach[id] = DAY.test(intent.today || '') ? intent.today : '2026-01-01'; earned.push(id); } };
  const bump = (k, by = 1) => { st[k] = Math.min(CAP, st[k] + by); };
  if (intent.kind === 'event') {
    if (intent.ev === 'stamp') { bump('stamps'); if (JOURNAL_KEYS.includes(intent.d) && !data.journal[intent.d]) data.journal[intent.d] = DAY.test(intent.today || '') ? intent.today : '2026-01-01'; earn('first-stamp'); if (intent.count >= 8) earn('full-passport'); if (JOURNAL_KEYS.every((k) => data.journal[k])) earn('journal-full'); }
    else if (intent.ev === 'streak') { st.bestStreak = Math.max(st.bestStreak, cnt(intent.n)); if (intent.n >= 5) earn('streak5'); if (intent.n >= 10) earn('streak10'); }
    else if (intent.ev === 'summit') bump('summits');
    else if (intent.ev === 'express') earn('express');
    else if (intent.ev === 'warp') earn('time-warp');
    else if (intent.ev === 'wager' && intent.won >= 3) earn('post-time');
  } else if (intent.kind === 'trail') {
    bump('games');
    const levels = (intent.levels || []).filter((l) => LEVELS.includes(l));
    for (const l of levels) { st.byLevel[l][0] = Math.min(CAP, st.byLevel[l][0] + (intent.won ? 1 : 0)); st.byLevel[l][1] = Math.min(CAP, st.byLevel[l][1] + 1); }
    for (const [c, a] of Object.entries(intent.cats || {})) { const cs = st.cat[c] || (st.cat[c] = [0, 0]); cs[0] = Math.min(CAP, cs[0] + cnt(a[0])); cs[1] = Math.min(CAP, cs[1] + cnt(a[1])); }
    st.bestStreak = Math.max(st.bestStreak, cnt(intent.streak));
    if (intent.won) {
      bump('wins'); earn('first-summit');
      const target = TARGET_SIZES.includes(intent.target) ? intent.target : 6, rounds = Math.max(1, cnt(intent.rounds));
      if (!st.fastest[target] || rounds < st.fastest[target]) { best.push({ kind: 'fastest', target, rounds, prev: st.fastest[target] || null }); st.fastest[target] = rounds; }
      if (target === 8) earn('grand-tour');
      if (levels.includes('hard')) earn('hard-win');
      // A Summit star for each stamp target and the hardest computer traveler beaten at that table.
      const top = LEVELS.slice().reverse().find((l) => levels.includes(l));
      if (top && !st.stars[target + ':' + top]) { st.stars[target + ':' + top] = true; best.push({ kind: 'star', target, level: top }); }
    }
    if (st.games >= 10) earn('regular');
    if (st.wins >= 10) earn('old-hand');
    if (Object.values(st.cat).filter((a) => a[0] >= 10).length >= 8) earn('well-rounded');
  } else if (intent.kind === 'quiz') {
    if (intent.mode !== 'daily' && intent.total >= 10 && intent.right >= intent.total) earn('perfect-ten');
    if (intent.dailyStreak >= 7) earn('daily-7');
  } else if (intent.kind === 'profile') {
    const t = TITLES.find((x) => x.id === intent.title); const c = COVERS.find((x) => x.id === intent.cover);
    if (intent.title === null || (t && data.ach[t.need])) data.profile.title = t ? t.id : null;
    if (intent.cover === null || (c && coverUnlocked(data, c))) data.profile.cover = c ? c.id : null;
  }
  return { earned, best };
}
