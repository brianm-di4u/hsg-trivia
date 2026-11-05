// Intent-scoped v1 persistence. A preference never writes a cached progress snapshot.
const KEY = 'hs-trivia-v1';
const clone = (v) => JSON.parse(JSON.stringify(v));
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
const defaults = () => ({ v: 1, settings: {}, best: { quick: 0, era: {} }, daily: { last: null, streak: 0, results: {} }, trail: null });
const ordered = (v) => Array.isArray(v) ? v.map(ordered) : object(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordered(v[k])])) : v;
const signature = (v) => JSON.stringify(ordered(v));
const group = (data) => Object.fromEntries(['trail', 'asked', 'rng', 'trailGeneration'].filter((k) => own(data, k)).map((k) => [k, clone(data[k])]));
const SETTINGS = new Set(['sound', 'volume', 'timer', 'motion', 'textScale', 'theme', 'passScreen', 'aiSpeed']);
let fallbackGeneration = 0;
const generation = () => globalThis.crypto?.randomUUID?.() || ('trip-' + Date.now().toString(36) + '-' + (++fallbackGeneration) + '-' + Math.random().toString(36).slice(2));
const previousDay = (day) => { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

export function createSaveStore({ storage = () => window.localStorage, newGeneration = generation, onConflict = () => {} } = {}) {
  let trailBase = null, conflictNotified = false;
  const store = { data: defaults(), ok: true, pending: { reservation: null, trail: null, settings: {}, quiz: [] } };
  const read = () => {
    const raw = storage().getItem(KEY);
    if (raw === null) return defaults(); // External clear never falls back to an old cached object.
    const data = JSON.parse(raw);
    if (!object(data) || data.v !== 1 || ['settings', 'best', 'daily'].some((k) => own(data, k) && !object(data[k]))) throw new Error('Unsupported save data');
    const out = { ...defaults(), ...data };
    out.settings = { ...out.settings };
    out.best = { ...out.best, era: { ...(out.best.era || {}) } };
    out.daily = { ...out.daily, results: { ...(out.daily.results || {}) } };
    return out;
  };
  const unavailable = () => { store.ok = false; return { ok: false, reason: 'storage-unavailable' }; };
  const conflict = (current) => {
    store.data = clone(current); // Refresh title/record display without adopting active Trail ownership.
    if (!conflictNotified) { conflictNotified = true; onConflict(); }
    return { ok: false, reason: 'trail-conflict' };
  };
  const write = (next) => {
    try { storage().setItem(KEY, JSON.stringify(next)); store.data = clone(next); store.ok = true; return true; }
    catch { store.ok = false; return false; }
  };
  const readOrNull = () => { try { return read(); } catch { store.ok = false; return null; } };
  store.load = () => {
    const current = readOrNull();
    if (!current) return unavailable();
    store.data = clone(current); trailBase = group(current); conflictNotified = false;
    store.pending = { reservation: null, trail: null, settings: {}, quiz: [] };
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
    trailBase = group(next); store.pending.trail = null;
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
      if (q.kind === 'quick') next.best.quick = Math.max(next.best.quick || 0, q.score);
      if (q.kind === 'era') next.best.era[q.era] = Math.max(next.best.era[q.era] || 0, q.score);
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
  return store;
}
