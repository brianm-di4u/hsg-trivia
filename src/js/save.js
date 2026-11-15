// Intent-scoped v1 persistence. A preference never writes a cached progress snapshot.
import { NODES } from './board.js';
import { freshRecord, cleanRecord, applyIntent } from './record.js';
const KEY = 'hs-trivia-v1';
const clone = (v) => JSON.parse(JSON.stringify(v));
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
const defaults = () => ({ v: 1, settings: {}, best: { quick: 0, era: {} }, daily: { last: null, streak: 0, results: {} }, trail: null, ...freshRecord() });
// The ids of the questions asked most recently, across trips and quizzes, so a new game does not start by repeating them (S3-06).
export const SEEN_MAX = 400;
const cleanSeen = (v) => (Array.isArray(v) ? v.filter((id) => typeof id === 'string' && id.length <= 40).slice(-SEEN_MAX) : []);
// What the best Quick 10 and each best Era Express chapter was made of: { right, total, timer }, so a score is read with its answer timer (S3-12).
// A separate key, absent until a best is set; a save from before has none and shows the points alone.
const cleanMeta1 = (m) => (object(m) && int(m.right, 0, 99) && int(m.total, 1, 99) && int(m.timer, 0, 600) ? { right: m.right, total: m.total, timer: m.timer } : null);
export const cleanBestMeta = (v) => {
  const out = { quick: object(v) ? cleanMeta1(v.quick) : null, era: {} };
  if (object(v) && object(v.era)) for (const k of Object.keys(v.era)) { const m = cleanMeta1(v.era[k]); if (m && k.length <= 20) out.era[k] = m; }
  return out;
};
const ordered = (v) => Array.isArray(v) ? v.map(ordered) : object(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordered(v[k])])) : v;
const signature = (v) => JSON.stringify(ordered(v));
const group = (data) => Object.fromEntries(['trail', 'asked', 'rng', 'trailGeneration'].filter((k) => own(data, k)).map((k) => [k, clone(data[k])]));
// A saved trip is only adopted if the game can draw and play it: anything else is set aside rather than crash the page.
const PHASES = new Set(['pass', 'roll', 'choose', 'moving', 'landed', 'stuck', 'skipped', 'question', 'feedback', 'vent', 'wager', 'order', 'orderResult', 'warp', 'postcard', 'jury', 'summit', 'over']);
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const validPlayer = (p) => object(p) && int(p.node, 0, NODES.length - 1) && (p.kind === 'human' || p.kind === 'ai') && typeof p.name === 'string'
  && typeof p.shape === 'string' && typeof p.color === 'string' && Array.isArray(p.stamps) && p.stamps.every((s) => typeof s === 'string')
  && num(p.tickets) && num(p.skill) && num(p.correct) && num(p.answered) && num(p.streak) && object(p.catStats) && (p.kind !== 'ai' || ['easy', 'medium', 'hard'].includes(p.level));
export const validTrail = (t) => object(t) && int(t.target, 1, 8) && int(t.round, 1, 1e6) && Array.isArray(t.players) && t.players.length >= 1 && t.players.length <= 6
  && t.players.every(validPlayer) && int(t.turn, 0, t.players.length - 1) && PHASES.has(t.phase) && Array.isArray(t.log) && Array.isArray(t.dests)
  && (t.pending === null || object(t.pending));
export const validOpenQuestion = (q) => object(q) && typeof q.id === 'string' && typeof q.category === 'string' && typeof q.text === 'string' && ['easy', 'medium', 'hard'].includes(q.difficulty)
  && Array.isArray(q.choices) && q.choices.length === 4 && q.choices.every((c) => typeof c === 'string') && int(q.correctIndex, 0, 3)
  && Array.isArray(q.removed) && q.chosen === null && num(q.timeLeft) && num(q.timeMax);
const SETTINGS = new Set(['sound', 'effects', 'music', 'ambience', 'volume', 'timer', 'motion', 'textScale', 'theme', 'passScreen', 'aiSpeed', 'seenCoach']);
// A brand-new profile gets the Brisk AI speed written with its first save. A save from before this setting existed has no aiSpeed: that player played at Normal and keeps it.
export const FRESH_PROFILE_SETTINGS = { aiSpeed: 'brisk', seenCoach: false }; // seenCoach false: a brand-new player gets the first-run tips; a save without the key is not a newcomer
let fallbackGeneration = 0;
const generation = () => globalThis.crypto?.randomUUID?.() || ('trip-' + Date.now().toString(36) + '-' + (++fallbackGeneration) + '-' + Math.random().toString(36).slice(2));
const previousDay = (day) => { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

export function createSaveStore({ storage = () => window.localStorage, newGeneration = generation, onConflict = () => {} } = {}) {
  let trailBase = null, conflictNotified = false;
  const store = { data: defaults(), ok: true, fresh: true, trailDiscarded: false, pending: { reservation: null, trail: null, settings: {}, quiz: [], progress: [] } };
  const read = () => {
    const raw = storage().getItem(KEY);
    if (raw === null) return defaults(); // External clear never falls back to an old cached object.
    let data = null;
    try { data = JSON.parse(raw); } catch { /* truncated or not JSON: handled below */ }
    if (!object(data) || data.v !== 1 || ['settings', 'best', 'daily'].some((k) => own(data, k) && !object(data[k]))) {
      // Unreadable (cut off, wrong shape, other version): keep the raw text for recovery and start from defaults, so
      // the next write replaces the key instead of every write being refused for good.
      try { storage().setItem(KEY + '.bad', raw); } catch { /* quarantine is best effort */ }
      return defaults();
    }
    const out = { ...defaults(), ...data };
    out.settings = { ...out.settings };
    out.best = { ...out.best, era: { ...(out.best.era || {}) } };
    out.daily = { ...out.daily, results: { ...(out.daily.results || {}) } };
    if (own(data, 'bestMeta')) out.bestMeta = cleanBestMeta(data.bestMeta);
    if (own(data, 'seen')) out.seen = cleanSeen(data.seen); // absent until the first question is asked: a save from before gains nothing else
    Object.assign(out, cleanRecord(data)); // stats, ach, profile: defaults for a save that predates them, repair for a damaged one
    return out;
  };
  const unavailable = () => { store.ok = false; return { ok: false, reason: 'storage-unavailable' }; };
  const conflict = (current) => {
    store.data = clone(current); // Refresh title/record display without adopting active Trail ownership.
    if (!conflictNotified) { conflictNotified = true; onConflict(); }
    return { ok: false, reason: 'trail-conflict' };
  };
  const write = (next) => {
    if (store.fresh) next = { ...next, settings: { ...FRESH_PROFILE_SETTINGS, ...next.settings } };
    try { storage().setItem(KEY, JSON.stringify(next)); store.data = clone(next); store.ok = true; store.fresh = false; return true; }
    catch { store.ok = false; return false; }
  };
  const readOrNull = () => { try { return read(); } catch { store.ok = false; return null; } };
  store.load = () => {
    try { store.fresh = storage().getItem(KEY) === null; } catch { store.fresh = true; }
    const current = readOrNull();
    if (!current) return unavailable();
    store.data = clone(current); trailBase = group(current); conflictNotified = false;
    store.pending = { reservation: null, trail: null, settings: {}, quiz: [], progress: [] };
    // A trip the game could not play is not offered. Its raw text is kept under the .bad key and the live key is replaced by the next trip's first save.
    store.trailDiscarded = !!current.trail && !validTrail(current.trail);
    if (store.trailDiscarded) { try { storage().setItem(KEY + '.bad', storage().getItem(KEY)); } catch { /* quarantine is best effort */ } }
    return { ok: true };
  };
  store.updateSettings = (changes) => {
    const intent = Object.fromEntries(Object.entries(changes).filter(([k]) => SETTINGS.has(k)));
    Object.assign(store.pending.settings, clone(intent));
    const current = readOrNull(); if (!current) return unavailable();
    const next = { ...current, settings: { ...current.settings, ...store.pending.settings } };
    if (!write(next)) return unavailable();
    store.pending.settings = {};
    return { ok: true };
  };
  store.retryTrailReservation = () => {
    // Retry only the original observed group/token. Never acquire a later foreign slot.
    const pending = store.pending.reservation;
    if (!pending) return { ok: true };
    const current = readOrNull();
    if (!current || pending.expected === null) return unavailable();
    if (signature(group(current)) !== signature(pending.expected)) return conflict(current);
    const next = { ...current, trailGeneration: pending.token };
    if (!write(next)) return unavailable();
    trailBase = group(next); conflictNotified = false; store.pending.reservation = null;
    return { ok: true };
  };
  store.reserveTrail = () => {
    // Called only for a fresh acknowledged user New/Restart intent, not automatic retry.
    const current = readOrNull();
    store.pending.reservation = { expected: current ? group(current) : trailBase && clone(trailBase), token: newGeneration() };
    store.pending.trail = null;
    conflictNotified = false;
    if (!current) return unavailable();
    return store.retryTrailReservation();
  };
  store.commitTrail = ({ trail, asked, rng }) => {
    const terminalToken = trail === null ? (store.pending.trail?.terminalToken || newGeneration()) : null;
    store.pending.trail = { payload: clone({ trail, asked, rng }), expected: trailBase && clone(trailBase), terminalToken };
    if (store.pending.reservation) {
      const reserved = store.retryTrailReservation();
      if (!reserved.ok) return reserved;
      store.pending.trail.expected = clone(trailBase);
    }
    if (trailBase === null) return { ok: false, reason: 'reservation-pending' };
    const current = readOrNull(); if (!current) return unavailable();
    if (signature(group(current)) !== signature(trailBase)) return conflict(current);
    const next = { ...current, trail: clone(trail), asked: clone(asked), rng };
    if (terminalToken) next.trailGeneration = terminalToken;
    if (!write(next)) return unavailable();
    trailBase = group(next); store.pending.trail = null; store.trailDiscarded = false;
    return { ok: true };
  };
  store.adoptTrail = () => {
    const current = readOrNull(); if (!current) return null;
    store.data = clone(current);
    if (!current.trail) return null;
    trailBase = group(current); conflictNotified = false; store.pending.reservation = null; store.pending.trail = null;
    return clone(group(current));
  };
  store.commitQuiz = (intent) => {
    // Only newly completed (including failed, still pending) results, never cached record snapshots.
    store.pending.quiz.push(clone(intent));
    const current = readOrNull(); if (!current) return unavailable();
    const next = clone(current);
    let dailyChanged = false;
    for (const q of store.pending.quiz) {
      const meta = int(q.right, 0, 99) && int(q.total, 1, 99) && int(q.timer, 0, 600) ? { right: q.right, total: q.total, timer: q.timer } : null;
      if (q.kind === 'quick') { if (q.score > (next.best.quick || 0)) { next.best.quick = q.score; if (meta) next.bestMeta = { ...cleanBestMeta(next.bestMeta), quick: meta }; } }
      if (q.kind === 'era') { if (q.score > (next.best.era[q.era] || 0)) { next.best.era[q.era] = q.score; if (meta) { const bm = cleanBestMeta(next.bestMeta); bm.era[q.era] = meta; next.bestMeta = bm; } } }
      if (q.kind === 'daily' && !own(next.daily.results, q.date)) { next.daily.results[q.date] = { score: q.score, right: q.right, marks: q.marks }; dailyChanged = true; }
    }
    const days = Object.keys(next.daily.results).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    if (dailyChanged && days.length) {
      next.daily.last = days[days.length - 1];
      let d = next.daily.last, streak = 0;
      while (own(next.daily.results, d)) { streak++; d = previousDay(d); }
      next.daily.streak = streak;
    }
    if (!write(next)) return unavailable();
    store.pending.quiz = [];
    return { ok: true };
  };
  // The questions asked lately (S3-06): its own key, outside the trip's conflict group, so a quiz can record it and no other tab's trip is touched.
  store.commitSeen = (ids) => {
    const current = readOrNull(); if (!current) return unavailable();
    if (!write({ ...current, seen: cleanSeen(ids) })) return unavailable();
    return { ok: true };
  };
  // The Trail record (S3-01): lifetime counters, achievements, worn title and cover. Each call hands in one intent (see record.js);
  // an intent whose write fails waits and is applied with the next one. Returns what was newly earned, for the toast and the win card.
  store.commitProgress = (intent) => {
    store.pending.progress.push(clone(intent));
    const current = readOrNull(); if (!current) return unavailable();
    const next = clone(current); const earned = [], best = [];
    for (const it of store.pending.progress) { const r = applyIntent(next, it); earned.push(...r.earned); best.push(...r.best); }
    if (!write(next)) return unavailable();
    store.pending.progress = [];
    return { ok: true, earned, best };
  };
  return store;
}
