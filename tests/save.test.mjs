// Pure synthetic storage fixtures. These do not claim earned gameplay; normal-input regression is separate.
import assert from 'node:assert/strict';
import { createSaveStore } from '../src/js/save.js';
import { deepMerge } from '../src/js/util.js';
const copy = (v) => JSON.parse(JSON.stringify(v));
const original = () => ({ v: 1, settings: { sound: true, volume: 0.7 }, best: { quick: 40, era: { old: 30 } }, daily: { last: null, streak: 0, results: {} }, trail: { turn: 0, marker: 'saved-old' }, asked: ['old'], rng: 0, extension: { preserved: true } });
function fixture(value = original()) {
  let raw = value === null ? null : JSON.stringify(value), failures = 0, blocked = false, serial = 0;
  const storage = { getItem() { if (blocked) throw Error('blocked'); return raw; }, setItem(k, v) { if (blocked || failures-- > 0) throw Error('failed write'); raw = v; } };
  return { read: () => raw === null ? null : JSON.parse(raw), replace: (v) => { raw = v === null ? null : JSON.stringify(v); }, fail: () => { failures = 1; }, block: (v) => { blocked = v; }, tab(onConflict) { const s = createSaveStore({ storage: () => storage, newGeneration: () => 'fixture-generation-' + (++serial), onConflict }); s.load(); return s; } };
}
const trip = (marker) => ({ trail: { marker, turn: 1 }, asked: [marker], rng: marker.length });
const row = (name, run) => ({ name, node: true, run });
export const tests = [
  row('stale actual-setting intent preserves the latest coherent trail and compatible unknown domains', () => {
    const f = fixture(), a = f.tab(), b = f.tab(); a.reserveTrail(); a.commitTrail(trip('earned-A'));
    const saved = f.read(); assert.equal(b.updateSettings({ sound: false }).ok, true);
    assert.deepEqual({ trail: f.read().trail, asked: f.read().asked, rng: f.read().rng, trailGeneration: f.read().trailGeneration }, { trail: saved.trail, asked: saved.asked, rng: saved.rng, trailGeneration: saved.trailGeneration });
    assert.deepEqual(f.read().extension, saved.extension); assert.equal(f.read().settings.sound, false);
  }),
  row('a changed setting does not replay other cached preferences', () => {
    const f = fixture(), a = f.tab(), b = f.tab(); a.updateSettings({ volume: 0.2 }); b.updateSettings({ sound: false });
    assert.deepEqual(f.read().settings, { sound: false, volume: 0.2 });
  }),
  row('unrelated settings refresh cannot adopt newer active trail authority', () => {
    const f = fixture(), a = f.tab(), b = f.tab(); b.reserveTrail(); b.commitTrail(trip('newer-B'));
    a.updateSettings({ sound: false }); const before = f.read();
    assert.equal(a.commitTrail(trip('stale-A')).reason, 'trail-conflict'); assert.deepEqual(f.read(), before);
  }),
  row('New reservation changes only generation and preserves the old trip before first completed turn', () => {
    const f = fixture(), a = f.tab(), before = f.read(); assert.equal(a.reserveTrail().ok, true);
    const after = f.read(); assert.equal(typeof after.trailGeneration, 'string'); delete after.trailGeneration; assert.deepEqual(after, before);
  }),
  row('distinct New intents invalidate old null-to-null branches', () => {
    const f = fixture(null), a = f.tab(), b = f.tab(); a.reserveTrail(); const first = f.read().trailGeneration; b.reserveTrail();
    assert.notEqual(f.read().trailGeneration, first); assert.equal(a.commitTrail(trip('old-A')).reason, 'trail-conflict'); assert.equal(b.commitTrail(trip('new-B')).ok, true);
  }),
  row('explicit Restart replaces the complete trail group on its first completed turn', () => {
    const f = fixture(), a = f.tab(); a.reserveTrail(); assert.deepEqual(f.read().asked, ['old']);
    a.commitTrail(trip('new-trip')); assert.deepEqual(f.read().trail, trip('new-trip').trail); assert.deepEqual(f.read().asked, ['new-trip']); assert.equal(f.read().rng, 8);
  }),
  row('failed reservation retains its original observation and rejects a subsequent foreign trip', () => {
    const f = fixture(), a = f.tab(), b = f.tab(); f.fail(); assert.equal(a.reserveTrail().ok, false); const pending = copy(a.pending.reservation);
    b.reserveTrail(); b.commitTrail(trip('foreign')); const before = f.read();
    assert.equal(a.retryTrailReservation().reason, 'trail-conflict'); assert.deepEqual(a.pending.reservation, pending); assert.deepEqual(f.read(), before);
    assert.equal(a.commitTrail(trip('unowned')).reason, 'trail-conflict'); assert.deepEqual(f.read(), before);
  }),
  row('failed reservation can retry against the same group while preserving fresh unrelated preferences', () => {
    const f = fixture(), a = f.tab(), b = f.tab(); f.fail(); a.reserveTrail(); const token = a.pending.reservation.token;
    b.updateSettings({ sound: false }); assert.equal(a.retryTrailReservation().ok, true); assert.equal(f.read().trailGeneration, token); assert.equal(f.read().settings.sound, false);
  }),
  row('failed trail write does not acknowledge its draft or overwrite a foreign successor', () => {
    const f = fixture(), a = f.tab(), b = f.tab(); a.reserveTrail(); b.adoptTrail(); f.fail(); assert.equal(a.commitTrail(trip('failed-A')).ok, false);
    assert.ok(a.pending.trail); b.commitTrail(trip('successful-B')); const before = f.read();
    assert.equal(a.commitTrail(trip('retry-A')).reason, 'trail-conflict'); assert.deepEqual(f.read(), before); assert.ok(a.pending.trail);
  }),
  row('failed trail write may retry when the acknowledged group is unchanged', () => {
    const f = fixture(), a = f.tab(); a.reserveTrail(); f.fail(); a.commitTrail(trip('pending')); const pending = copy(a.pending.trail);
    assert.equal(a.commitTrail(pending.payload).ok, true); assert.equal(a.pending.trail, null); assert.deepEqual(f.read().trail, pending.payload.trail);
  }),
  row('an older terminal clear cannot erase a newer active trip', () => {
    const f = fixture(), a = f.tab(), b = f.tab(); a.commitTrail(trip('newest')); const before = f.read();
    assert.equal(b.commitTrail({ trail: null, asked: [], rng: 0 }).reason, 'trail-conflict'); assert.deepEqual(f.read(), before);
  }),
  row('owned terminal clear advances generation to invalidate identical null snapshots', () => {
    const f = fixture(null), a = f.tab(); a.reserveTrail(); const b = f.tab(), before = f.read().trailGeneration;
    a.commitTrail({ trail: null, asked: [], rng: 0 }); assert.notEqual(f.read().trailGeneration, before);
    const cleared = f.read(); assert.equal(b.commitTrail({ trail: null, asked: [], rng: 0 }).reason, 'trail-conflict'); assert.deepEqual(f.read(), cleared);
  }),
  row('Continue explicitly adopts the latest whole trail including zero RNG', () => {
    const f = fixture(), a = f.tab(), b = f.tab(); b.reserveTrail(); b.commitTrail({ trail: { marker: 'B' }, asked: ['B'], rng: 0 });
    const adopted = a.adoptTrail(); assert.equal(adopted.rng, 0); assert.deepEqual(adopted.asked, ['B']); assert.equal(a.commitTrail(trip('continued-A')).ok, true);
  }),
  row('external clear is not repaired by replaying stale settings or cached record domains', () => {
    const f = fixture(), a = f.tab(); f.replace(null); a.updateSettings({ sound: false });
    assert.equal(f.read().trail, null); assert.equal(f.read().best.quick, 0); assert.equal(f.read().extension, undefined);
    a.commitQuiz({ kind: 'quick', score: 5 }); assert.equal(f.read().best.quick, 5); assert.equal(f.read().best.era.old, undefined);
    assert.equal(a.commitTrail(trip('stale-resurrection')).reason, 'trail-conflict');
  }),
  row('latest compatible unknown fields are preserved while removed cached fields are not resurrected', () => {
    const f = fixture(), a = f.tab(), next = original(); delete next.extension; next.future = { score: 7 }; f.replace(next); a.updateSettings({ sound: false });
    assert.deepEqual(f.read().future, { score: 7 }); assert.equal(f.read().extension, undefined);
  }),
  row('only newly earned best records merge by maximum without altering trail or latest settings', () => {
    const f = fixture(), a = f.tab(), b = f.tab(); a.commitQuiz({ kind: 'quick', score: 90 }); b.updateSettings({ sound: false });
    b.commitQuiz({ kind: 'quick', score: 50 }); b.commitQuiz({ kind: 'era', era: 'new', score: 12 });
    assert.equal(f.read().best.quick, 90); assert.equal(f.read().best.era.old, 30); assert.equal(f.read().best.era.new, 12); assert.equal(f.read().settings.sound, false); assert.deepEqual(f.read().trail, original().trail);
  }),
  row('Daily results union by date preserves first recorded result and derives coherent newest streak', () => {
    const f = fixture(), a = f.tab(), b = f.tab(); a.commitQuiz({ kind: 'daily', date: '2026-11-03', score: 30, right: 3, marks: '1110000' });
    b.commitQuiz({ kind: 'daily', date: '2026-11-04', score: 40, right: 4, marks: '1111000' }); a.commitQuiz({ kind: 'daily', date: '2026-11-03', score: 99, right: 7, marks: '1111111' });
    assert.equal(f.read().daily.results['2026-11-03'].score, 30); assert.equal(f.read().daily.results['2026-11-04'].score, 40); assert.equal(f.read().daily.last, '2026-11-04'); assert.equal(f.read().daily.streak, 2);
  }),
  row('an unrelated Quick score leaves current Daily metadata exactly intact', () => {
    const value = original(); value.daily = { last: '2026-11-03', streak: 17, results: { '2026-11-03': { score: 5 } }, future: 'keep' };
    const f = fixture(value), a = f.tab(); a.commitQuiz({ kind: 'quick', score: 50 }); assert.deepEqual(f.read().daily, value.daily);
  }),
  row('a failed newly earned record remains pending without reintroducing previously cached records after clear', () => {
    const f = fixture(), a = f.tab(); f.replace(null); f.fail(); a.commitQuiz({ kind: 'era', era: 'pending', score: 7 }); assert.equal(a.pending.quiz.length, 1);
    a.commitQuiz({ kind: 'quick', score: 5 }); assert.equal(f.read().best.era.pending, 7); assert.equal(f.read().best.era.old, undefined); assert.equal(f.read().best.quick, 5); assert.equal(a.pending.quiz.length, 0);
  }),
  row('a v1 old reader can still load trail settings best and additive generation', () => {
    const f = fixture(), a = f.tab(); a.reserveTrail(); a.commitTrail(trip('new-v1')); const legacy = { v: 1, settings: {}, best: { quick: 0, era: {} }, trail: null }; deepMerge(legacy, f.read());
    assert.equal(legacy.v, 1); assert.equal(legacy.trail.marker, 'new-v1'); assert.equal(legacy.best.quick, 40); assert.equal(legacy.settings.sound, true); assert.equal(legacy.trailGeneration, f.read().trailGeneration);
  }),
  row('blocked or failed storage does not throw, grant a reservation, or advance trail acknowledgment', () => {
    const f = fixture(), a = f.tab(); f.block(true); assert.equal(a.reserveTrail().ok, false); assert.equal(a.ok, false); assert.equal(a.commitTrail(trip('unsaved')).reason, 'storage-unavailable'); assert.ok(a.pending.reservation);
    f.block(false); const foreign = original(); foreign.trail = { marker: 'foreign' }; f.replace(foreign); assert.equal(a.retryTrailReservation().reason, 'trail-conflict');
  }),
  row('conflict notice is bounded per authority and a fresh explicit Continue re-arms it', () => {
    const f = fixture(); let notices = 0; const a = f.tab(() => notices++), b = f.tab(); b.commitTrail(trip('B1'));
    a.commitTrail(trip('A1')); a.commitTrail(trip('A2')); assert.equal(notices, 1); a.adoptTrail(); b.commitTrail(trip('B2')); a.commitTrail(trip('A3')); assert.equal(notices, 2);
  }),
  row('the guard includes asked and RNG changes even when the trail object is identical', () => {
    const f = fixture(), a = f.tab(), changed = original(); changed.rng = 123; changed.asked = ['foreign']; f.replace(changed); const before = f.read();
    assert.equal(a.commitTrail(trip('A')).reason, 'trail-conflict'); assert.deepEqual(f.read(), before);
  }),
  row('unsupported save versions fail closed without replacing raw data', () => {
    const f = fixture({ v: 2, future: { data: 1 } }), a = f.tab(), before = f.read(); assert.equal(a.updateSettings({ sound: false }).ok, false); assert.deepEqual(f.read(), before);
  }),

  row('recovery: next setting write consumes all failed explicit preference deltas', () => {
    const f = fixture(), a = f.tab(); f.fail(); assert.equal(a.updateSettings({ sound: false }).ok, false);
    assert.equal(a.updateSettings({ volume: 0.2 }).ok, true); assert.equal(f.read().settings.sound, false); assert.equal(f.read().settings.volume, 0.2); assert.deepEqual(a.pending.settings, {});
  }),
  row('recovery: ordinary completed turn safely retries its failed reservation', () => {
    const f = fixture(), a = f.tab(); f.fail(); assert.equal(a.reserveTrail().ok, false); const token = a.pending.reservation.token;
    assert.equal(a.commitTrail(trip('same-playable-trip')).ok, true); assert.equal(f.read().trailGeneration, token); assert.equal(f.read().trail.marker, 'same-playable-trip'); assert.equal(a.pending.reservation, null);
  }),
  row('recovery: an explicit New after prior reservation conflict is a fresh acknowledged intent', () => {
    const f = fixture(), a = f.tab(), b = f.tab(); f.fail(); a.reserveTrail(); b.reserveTrail(); b.commitTrail(trip('foreign'));
    const pending = copy(a.pending.reservation); assert.equal(a.retryTrailReservation().ok, false); assert.deepEqual(a.pending.reservation, pending);
    // The next call represents a NEW acknowledged user action after the conflict notice, not an automatic retry.
    assert.equal(a.reserveTrail().ok, true); assert.equal(a.commitTrail(trip('explicit-new')).ok, true); assert.equal(f.read().trail.marker, 'explicit-new');
  }),


  row('recovery: automatic same-trip reservation retry refuses a foreign saved group', () => {
    const f = fixture(), a = f.tab(), b = f.tab(); f.fail(); a.reserveTrail(); const originalAttempt=copy(a.pending.reservation);
    b.reserveTrail(); b.commitTrail(trip('foreign-newest')); const before=f.read();
    assert.equal(a.commitTrail(trip('same-trip-stale')).reason,'trail-conflict'); assert.deepEqual(f.read(),before); assert.deepEqual(a.pending.reservation,originalAttempt);
  }),

];
