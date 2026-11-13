// Generative music and ambience engine (a copy of the council audio kit, adapted for this game): a score or a scene is
// plain data, the engine schedules it ahead of the audio clock. Everything is oscillators and filtered noise.
//
//   kit.music.play(score, { fade }), kit.amb.play(scene, { fade }), kit.music.duck(6, 400), kit.music.intensity(0..1),
//   kit.hold() / kit.release(), kit.scheduleUntil(t) (what a test calls to render faster than real time).
// Added for this game: a piece keeps its place when it is crossfaded away and comes back where it left off
// (the board piece does not restart every turn), a wood-block tick for the quiz piece, and four more one-shots.
export function makeAudioKit(ctx, out, opt = {}) {
  const sr = ctx.sampleRate;
  let seed = (opt.seed || 0x5EED1) >>> 0;
  const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rr = (a, b) => a + (b - a) * rnd();
  const pick = (xs) => xs[(rnd() * xs.length) | 0];
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);
  const gain = (v, to) => { const n = ctx.createGain(); n.gain.value = v; if (to) n.connect(to); return n; };
  const panTo = (p, to) => { if (!p || !ctx.createStereoPanner) return to; const n = ctx.createStereoPanner(); n.pan.value = Math.max(-1, Math.min(1, p)); n.connect(to); return n; };
  const lowpass = (f, to, type = 'lowpass', q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; if (to) n.connect(to); return n; };
  const noiseBuf = ctx.createBuffer(1, sr * 2, sr);
  { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }
  const noise = (t, dur) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(t, rr(0, 1.9)); if (dur) s.stop(t + dur); return s; };

  let mLevel = opt.music ?? 0.5, aLevel = opt.ambience ?? 0.5, inten = 0, held = false, timer = 0;
  const musicBus = gain(mLevel, out), ambBus = gain(aLevel, out);
  const memo = new Map();   // a piece the player left keeps its place
  const dead = [];   // { at, nodes }: sub-buses to disconnect once their fade-out has finished
  const retire = (bus, nodes, at, fade) => {
    bus.gain.cancelScheduledValues(at); bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), at);
    bus.gain.linearRampToValueAtTime(0.0001, at + Math.max(fade, 0.02)); dead.push({ at: at + fade + 0.2, nodes });
  };

  // ------------------------------------------------------------------------------------------- instruments
  // sus: held for the note's length then released over r seconds. Otherwise percussive: decays over `decay`.
  // waves: one oscillator each, detuned +/- det cents. parts: extra sine partials [frequency multiple, gain].
  const INST = {
    pad:    { waves: ['triangle', 'sine'], det: 6, sus: true, a: 0.9, r: 1.8, lp: 1500 },
    organ:  { waves: ['sine'], parts: [[2, 0.4], [3, 0.15]], sus: true, a: 0.04, r: 0.25 },
    flute:  { waves: ['sine'], parts: [[2, 0.07]], sus: true, a: 0.06, r: 0.3, vib: 5 },
    brass:  { waves: ['sawtooth', 'square'], det: 5, sus: true, a: 0.03, r: 0.12, lp: 1900 },
    mallet: { waves: ['sine'], parts: [[3, 0.16], [4.2, 0.05]], a: 0.004, decay: 1.1 },
    piano:  { waves: ['triangle'], parts: [[2, 0.22], [3, 0.07]], a: 0.004, decay: 0.75 },
    pluck:  { waves: ['sawtooth'], a: 0.003, decay: 0.38, lp: 3400, lpTo: 500 },
    bass:   { waves: ['triangle'], parts: [[2, 0.12]], a: 0.008, decay: 0.55, lp: 800 },
    tuba:   { waves: ['sawtooth'], sus: true, a: 0.02, r: 0.08, lp: 420 },
  };
  function voice(m, t, midi, dur, ins, level, pn, dry) {
    const f = hz(midi), a = ins.a, end = ins.sus ? t + Math.max(dur, a) + ins.r : t + Math.max(dur * 0.5, 0.05) + ins.decay;
    const peak = level / Math.sqrt(ins.waves.length), env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(peak, t + a);
    if (ins.sus) { env.gain.setValueAtTime(peak, t + Math.max(dur, a)); env.gain.linearRampToValueAtTime(0.0001, end); }
    else env.gain.exponentialRampToValueAtTime(0.0001, end);
    let dst = panTo(pn, dry ? m.lp : m.inp);
    if (ins.lp) { const fl = lowpass(ins.lp, dst); if (ins.lpTo) { fl.frequency.setValueAtTime(ins.lp, t); fl.frequency.exponentialRampToValueAtTime(ins.lpTo, t + ins.decay); } dst = fl; }
    env.connect(dst);
    ins.waves.forEach((w, i) => {
      const o = ctx.createOscillator(); o.type = w; o.frequency.value = f; if (ins.det) o.detune.value = (i % 2 ? -1 : 1) * ins.det;
      if (ins.vib) { const l = ctx.createOscillator(), lg = gain(f * 0.004, o.frequency); l.frequency.value = ins.vib; l.connect(lg); l.start(t); l.stop(end + 0.05); }
      o.connect(env); o.start(t); o.stop(end + 0.05);
    });
    for (const [mult, pg] of ins.parts || []) { const o = ctx.createOscillator(); o.frequency.value = f * mult; o.connect(gain(pg, env)); o.start(t); o.stop(end + 0.05); }
  }
  const DRUM = {
    k: (m, t, v) => { const o = ctx.createOscillator(), e = gain(0.0001, m.lp); o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.11); e.gain.setValueAtTime(v, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(e); o.start(t); o.stop(t + 0.2); },
    s: (m, t, v) => { const e = gain(0.0001, lowpass(1900, m.inp, 'bandpass', 0.8)); e.gain.setValueAtTime(v * 0.9, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.13); noise(t, 0.15).connect(e); },
    h: (m, t, v) => { const e = gain(0.0001, lowpass(6500, m.lp, 'highpass')); e.gain.setValueAtTime(v * 0.35, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); noise(t, 0.06).connect(e); },
    t: (m, t, v) => { const o = ctx.createOscillator(), e = gain(0.0001, m.lp); o.frequency.value = 1750; e.gain.setValueAtTime(v * 0.7, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.035); o.connect(e); o.start(t); o.stop(t + 0.05); },   // wood-block tick
    b: (m, t, v) => { const e = gain(0.0001, lowpass(3200, m.inp, 'bandpass', 0.5)); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(v * 0.4, t + 0.03); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); noise(t, 0.22).connect(e); },   // brush
  };

  // ------------------------------------------------------------------------------------------------- music
  // A score is data:
  //   { bpm, beats: 4, spb: 2 (steps per beat: 2 = eighths, 4 = sixteenths), swing: 0..0.33,
  //     key: 62 (MIDI note of the tonic), scale: [0,2,4,5,7,9,11], sevenths: [4] (chord degrees that take a 7th),
  //     form: 'AABA', sections: { A: [0,5,3,4], B: [3,0,4,4] }   // chord roots as scale degrees, one bar each
  //                                                               // ([degree, bars] holds a chord for longer),
  //     pad:  { inst: 'pad', gain: 0.05 },
  //     bass: { inst: 'bass', pattern: 'root' | 'two' | 'walk', gain: 0.12 },
  //     comp: { inst: 'piano', at: [1, 3] (beats), gain: 0.04 },
  //     lead: { inst: 'mallet', gain: 0.09, oct: 1, lo: -2, hi: 9, classes: [0,1,2,4,5], vary: 0.3, rest: 0.15,
  //             rhythms: [[0,3,4,6], ...] (steps in the bar) },
  //     perc: { k: [0, 2], s: [1, 3], h: [0.5, 1.5, 2.5, 3.5], gain: 0.5 }, perc2: {...} (added at high intensity),
  //     lp: 4200, delay: 0.18 (echo level, 0 for none), delayBeats: 0.75 }
  // The lead is composed once per section bar and remembered, so A sounds like A each time it returns; on
  // every return a bar has a `vary` chance of a small variation that is not remembered.
  const RHY = {
    8: [[0, 3, 4, 6], [0, 2, 4], [0, 4, 6, 7], [2, 4, 6], [0, 3, 6], [0, 2, 3, 4, 6], [0, 4], [0, 1, 2, 4], [1, 2, 4, 6]],
    6: [[0, 2, 4], [0, 3], [0, 4, 5], [2, 4], [0, 2, 3, 4]],
    12: [[0, 4, 8], [0, 6], [0, 3, 6, 8, 10], [4, 6, 8], [0, 4, 6, 10]],
  };
  let cur = null;
  function buildBars(score) {
    const bars = [];
    for (const label of score.form) {
      const sec = score.sections[label], start = bars.length;
      for (const c of sec) { const [d, n] = Array.isArray(c) ? c : [c, 1]; for (let k = 0; k < n; k++) bars.push({ label, d, first: k === 0, len: n }); }
      bars.slice(start).forEach((b, i) => { b.i = i; }); bars[bars.length - 1].end = true;
    }
    return bars;
  }
  function mStart(score, at, fade) {
    const bus = gain(0.0001, musicBus), lp = lowpass(score.lp || 4200, bus), inp = gain(1, lp), nodes = [bus, lp, inp];
    if (score.delay !== 0) {
      const d = ctx.createDelay(1.5); d.delayTime.value = Math.min(1.4, (60 / score.bpm) * (score.delayBeats || 0.75));
      const fb = gain(0.3, d), wet = gain(score.delay ?? 0.18, lp); inp.connect(d); d.connect(fb); d.connect(wet); nodes.push(d, fb, wet);
    }
    bus.gain.setValueAtTime(0.0001, at); bus.gain.linearRampToValueAtTime(1, at + Math.max(fade, 0.02));
    const old = memo.get(score) || {};
    return { score, bus, lp, inp, nodes, bars: buildBars(score), t: at, bar: old.bar || 0, mem: old.mem || {}, rh: old.rh || {}, prev: old.prev ?? 4, dir: old.dir || 1, sigs: old.sigs || new Set(), pitches: old.pitches || new Set(), notes: old.notes || 0 };
  }
  function genMotif(m, B, spbar, spb) {
    const s = m.score, L = s.lead, classes = L.classes || [0, 1, 2, 4, 5], lo = L.lo ?? -2, hi = L.hi ?? 9;
    const cls = (k) => ((k % 7) + 7) % 7, tones = [cls(B.d), cls(B.d + 2), cls(B.d + 4)];
    const ladder = [], strong = [];
    for (let k = lo; k <= hi; k++) { if (classes.includes(cls(k))) ladder.push(k); if (tones.includes(cls(k))) strong.push(k); }
    const pool = L.rhythms || RHY[spbar] || [Array.from({ length: spbar / spb }, (_, i) => i * spb)];
    let rh;
    if (B.end) rh = [0];
    else if (rnd() < (L.rest ?? 0.15)) rh = [];
    else if (B.i >= 2 && m.rh[B.label + (B.i - 2)] && rnd() < 0.6) rh = m.rh[B.label + (B.i - 2)];
    else rh = pick(pool);
    m.rh[B.label + B.i] = rh;
    const mot = [];
    rh.forEach((st, j) => {
      let d;
      if (st % spb === 0 || B.end) {   // on the beat: a chord tone near the last note, preferring to move
        const near = (B.end ? strong.filter((k) => cls(k) !== tones[2]) : strong).slice().sort((x, y) => Math.abs(x - m.prev) - Math.abs(y - m.prev));
        const moved = near.filter((k) => k !== m.prev), c = moved.length ? moved : near;
        d = c[rnd() < 0.65 || c.length < 2 ? 0 : 1];
      } else {                         // off the beat: step along the scale, mostly keeping direction
        if (m.prev >= hi - 1) m.dir = -1; else if (m.prev <= lo + 1) m.dir = 1; else if (rnd() < 0.35) m.dir = -m.dir;
        const i = ladder.reduce((best, k, ix) => (Math.abs(k - m.prev) < Math.abs(ladder[best] - m.prev) ? ix : best), 0);
        d = ladder[Math.max(0, Math.min(ladder.length - 1, i + m.dir))];
      }
      const next = j + 1 < rh.length ? rh[j + 1] : spbar;
      mot.push({ st, d, len: B.end ? Math.min(spbar, spb * 3) : Math.max(1, next - st) });
      m.prev = d;
    });
    return mot;
  }
  function varyMotif(m, mot, B, spbar) {
    if (mot.length < 2 || B.end) return mot;
    const v = mot.map((n) => ({ ...n })), k = 1 + ((rnd() * (v.length - 1)) | 0), how = rnd();
    if (how < 0.5) v[k].d += rnd() < 0.5 ? 1 : -1;                                   // neighbour note
    else if (how < 0.75 && v.length > 2) v.pop();                                     // leave a breath
    else if (v[k].st - v[k - 1].st >= 2) v.splice(k, 0, { st: v[k].st - 1, d: v[k - 1].d + (v[k].d > v[k - 1].d ? 1 : -1), len: 1 });   // passing note
    return v;
  }
  function playBar(m, t0) {
    const s = m.score, spb = s.spb || 2, beats = s.beats || 4, spbar = spb * beats, sc = s.scale || [0, 2, 4, 5, 7, 9, 11];
    const beat = 60 / (s.bpm * (1 + 0.06 * inten)), step = beat / spb, barDur = beat * beats;
    const B = m.bars[m.bar % m.bars.length], nextB = m.bars[(m.bar + 1) % m.bars.length];
    const at = (st) => t0 + st * step + (st % 2 ? (s.swing || 0) * step : 0);
    const deg = (d) => s.key + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const fold = (n, lo) => lo + (((n - lo) % 12) + 12) % 12;
    const chord = [B.d, B.d + 2, B.d + 4].concat((s.sevenths || []).includes(((B.d % 7) + 7) % 7) ? [B.d + 6] : []);
    if (s.pad && B.first) for (const d of chord) voice(m, t0, fold(deg(d), s.key - 5), barDur * B.len, INST[s.pad.inst || 'pad'], (s.pad.gain ?? 0.05), rr(-0.4, 0.4), false);
    if (s.bass) {
      const ins = INST[s.bass.inst || 'bass'], lo = s.key - 24 + 12 * (s.bass.oct || 0), g = s.bass.gain ?? 0.12, root = fold(deg(B.d), lo);
      let fifth = fold(deg(B.d + 4), lo); if (fifth > root + 6) fifth -= 12;
      const p = s.bass.pattern || 'root';
      if (p === 'root') voice(m, t0, root, barDur * 0.9, ins, g, 0, true);
      else if (p === 'two') { voice(m, at(0), root, beat * 0.9, ins, g, 0, true); voice(m, at(spb * Math.floor(beats / 2)), fifth, beat * 0.9, ins, g * 0.9, 0, true); }
      else if (p === 'walk') {
        const target = fold(deg(nextB.d), lo), line = [root, fold(deg(B.d + 2), lo), fold(deg(B.d + 4), lo), target + (rnd() < 0.5 ? -1 : 1)];
        for (let b = 0; b < beats; b++) voice(m, at(b * spb), line[b % 4], beat * 0.9, ins, g * (b ? 0.85 : 1), 0, true);
      }
    }
    if (s.comp) for (const b of s.comp.at || [1, 3]) { const st = Math.round(b * spb); for (const d of chord) voice(m, at(st), fold(deg(d), s.key + 12 * (s.comp.oct || 0)), beat * (s.comp.len || 0.4), INST[s.comp.inst || 'piano'], (s.comp.gain ?? 0.04), s.comp.pan || 0, false); }
    for (const P of [s.perc, inten > 0.5 ? s.perc2 : null]) if (P) for (const key of Object.keys(DRUM)) for (const b of P[key] || []) DRUM[key](m, at(Math.round(b * spb)), (P.gain ?? 0.5) * 0.3);
    if (s.lead) {
      const L = s.lead, key = B.label + ':' + B.i; let mot = m.mem[key];
      if (!mot) mot = m.mem[key] = genMotif(m, B, spbar, spb); else if (rnd() < (L.vary ?? 0.3)) mot = varyMotif(m, mot, B, spbar);
      for (const n of mot) { const midi = deg(n.d) + 12 * ((L.oct ?? 1) + (inten > 0.8 && L.lift ? 1 : 0)); voice(m, at(n.st), midi, n.len * step * 0.92, INST[L.inst || 'mallet'], (L.gain ?? 0.09) * (1 + 0.2 * inten) * rr(0.88, 1), L.pan ?? rr(-0.25, 0.25), false); m.pitches.add(midi); m.notes++; }
      m.sigs.add(mot.map((n) => n.st + '.' + n.d).join(' '));
    }
    m.lp.frequency.setTargetAtTime((s.lp || 4200) * (1 + 0.6 * inten), t0, 0.4);
    return barDur;
  }
  const music = {
    play(score, o = {}) {
      const at = o.at ?? ctx.currentTime + 0.03, fade = o.fade ?? 1.2;
      if (cur && cur.score === score) return;
      if (cur) { memo.set(cur.score, cur); retire(cur.bus, cur.nodes, at, fade); }
      cur = score ? mStart(score, at, fade) : null;
    },
    stop(fade = 1) { music.play(null, { fade }); },
    level(v) { mLevel = v; if (!held) musicBus.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    duck(db = 6, ms = 400) { if (held) return; const t = ctx.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setTargetAtTime(mLevel * 10 ** (-db / 20), t, 0.02); musicBus.gain.setTargetAtTime(mLevel, t + ms / 1000, 0.25); },
    intensity(x) { inten = Math.max(0, Math.min(1, x)); },
    get score() { return cur && cur.score; },
    // For tests: how much the lead has really varied so far.
    info() { return cur ? { bars: cur.bar, formBars: cur.bars.length, distinctBars: cur.sigs.size, notes: cur.notes, pitches: cur.pitches.size } : null; },
  };

  // ---------------------------------------------------------------------------------------------- ambience
  // A scene is data:
  //   { beds:  [{ type: 'lowpass' | 'bandpass' | 'highpass', freq, q, gain, pan,
  //               lfo: { rate (Hz), depth 0..1 } (slow swell of the bed's level), flfo: { rate, depth (Hz) },
  //               param: 'wind', range: [0.2, 1] }],     // amb.set('wind', 0..1) moves this bed's level
  //     spots: [{ make: 'drip' | 'bird' | 'hiss' | 'bell' | 'cricket' | 'swell' | (ctx, dest, t, rnd) => {},
  //               every: [4, 10] (seconds between), gain, pan: [-0.6, 0.6], param: 'night' }] }
  // Beds are continuous; spots are sparse one-shots at random gaps so the place never loops audibly.
  const SPOT = {
    drip: (dst, t, v) => { const f = rr(1100, 2300), o = ctx.createOscillator(), e = gain(0.0001, dst); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.03); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.09); e.gain.setValueAtTime(v, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(e); o.start(t); o.stop(t + 0.14); },
    bird: (dst, t, v) => { const n = 2 + ((rnd() * 3) | 0), base = rr(2600, 4200); for (let i = 0; i < n; i++) { const s = t + i * rr(0.09, 0.16), o = ctx.createOscillator(), e = gain(0.0001, dst); o.frequency.setValueAtTime(base * rr(0.9, 1.1), s); o.frequency.exponentialRampToValueAtTime(base * rr(1.15, 1.5), s + 0.06); e.gain.setValueAtTime(0.0001, s); e.gain.linearRampToValueAtTime(v * 0.7, s + 0.015); e.gain.exponentialRampToValueAtTime(0.0001, s + 0.08); o.connect(e); o.start(s); o.stop(s + 0.1); } },
    hiss: (dst, t, v) => { const d = rr(0.7, 1.8), e = gain(0.0001, lowpass(rr(3500, 6000), dst, 'highpass')); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(v * 0.6, t + d * 0.3); e.gain.exponentialRampToValueAtTime(0.0001, t + d); noise(t, d + 0.05).connect(e); },
    bell: (dst, t, v) => { const f = rr(700, 1100); for (const [mult, pg, dec] of [[1, 1, 2.2], [2.76, 0.4, 1.3], [5.4, 0.18, 0.7]]) { const o = ctx.createOscillator(), e = gain(0.0001, dst); o.frequency.value = f * mult; e.gain.setValueAtTime(v * pg * 0.6, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dec); o.connect(e); o.start(t); o.stop(t + dec + 0.05); } },
    cricket: (dst, t, v) => { const f = rr(4200, 5200), n = 3 + ((rnd() * 4) | 0); for (let i = 0; i < n; i++) { const s = t + i * 0.055, o = ctx.createOscillator(), e = gain(0.0001, dst); o.frequency.value = f; e.gain.setValueAtTime(v * 0.35, s); e.gain.exponentialRampToValueAtTime(0.0001, s + 0.03); o.connect(e); o.start(s); o.stop(s + 0.04); } },
    swell: (dst, t, v) => { const d = rr(2.5, 5), e = gain(0.0001, lowpass(rr(500, 900), dst, 'bandpass', 0.6)); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(v, t + d * 0.45); e.gain.linearRampToValueAtTime(0.0001, t + d); noise(t, d + 0.05).connect(e); },
    // A far trolley bell: two quick clangs.
    trolley: (dst, t, v) => { const f = rr(820, 940); for (const at of [t, t + rr(0.2, 0.28)]) for (const [mult, pg, dec] of [[1, 1, 0.9], [2.4, 0.45, 0.5], [4.1, 0.2, 0.3]]) { const o = ctx.createOscillator(), e = gain(0.0001, dst); o.frequency.value = f * mult; e.gain.setValueAtTime(v * pg * 0.6, at); e.gain.exponentialRampToValueAtTime(0.0001, at + dec); o.connect(e); o.start(at); o.stop(at + dec + 0.05); } },
    // A short run of water over stones: band-passed noise whose centre wanders.
    burble: (dst, t, v) => { const d = rr(0.8, 1.8), f = lowpass(rr(500, 900), null, 'bandpass', 4), e = gain(0.0001, dst); f.connect(e); for (let i = 0; i < 6; i++) f.frequency.setValueAtTime(rr(450, 1300), t + (i * d) / 6); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(v, t + d * 0.25); e.gain.linearRampToValueAtTime(0.0001, t + d); noise(t, d + 0.05).connect(f); },
    // A lap of a small wave on a shore.
    lap: (dst, t, v) => { const d = rr(1.4, 2.6), e = gain(0.0001, lowpass(rr(300, 520), dst)); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(v, t + d * 0.4); e.gain.linearRampToValueAtTime(0.0001, t + d); noise(t, d + 0.05).connect(e); },
  };
  let scene = null;
  const params = {};
  function aStart(def, at, fade) {
    const bus = gain(0.0001, ambBus), nodes = [bus], beds = [];
    for (const b of def.beds || []) {
      const g = gain(b.gain ?? 0.05, panTo(b.pan || 0, bus)), f = lowpass(b.freq || 600, g, b.type || 'lowpass', b.q ?? 0.7), src = noise(at);
      src.connect(f); nodes.push(src, g, f);
      if (b.lfo) { const l = ctx.createOscillator(); l.frequency.value = b.lfo.rate; l.connect(gain((b.gain ?? 0.05) * b.lfo.depth * 0.5, g.gain)); l.start(at); nodes.push(l); }
      if (b.flfo) { const l = ctx.createOscillator(); l.frequency.value = b.flfo.rate; l.connect(gain(b.flfo.depth, f.frequency)); l.start(at); nodes.push(l); }
      beds.push({ def: b, g });
    }
    bus.gain.setValueAtTime(0.0001, at); bus.gain.linearRampToValueAtTime(1, at + Math.max(fade, 0.02));
    const sc = { def, bus, nodes, beds, spots: (def.spots || []).map((d) => ({ d, next: at + rr(0.3, d.every[1]) })) };
    for (const k of Object.keys(params)) applyParam(sc, k, params[k], at, 0.01);
    return sc;
  }
  function applyParam(sc, name, v, t, tc) { for (const b of sc.beds) if (b.def.param === name) { const r = b.def.range || [0, 1]; b.g.gain.setTargetAtTime((b.def.gain ?? 0.05) * (r[0] + (r[1] - r[0]) * v), t, tc); } }
  const amb = {
    play(def, o = {}) {
      const at = o.at ?? ctx.currentTime + 0.03, fade = o.fade ?? 2;
      if (scene && scene.def === def) return;
      if (scene) { const old = scene; retire(old.bus, old.nodes, at, fade); }
      scene = def ? aStart(def, at, fade) : null;
    },
    stop(fade = 1.5) { amb.play(null, { fade }); },
    level(v) { aLevel = v; if (!held) ambBus.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    set(name, v, tc = 0.5) { params[name] = v; if (scene) applyParam(scene, name, v, ctx.currentTime, tc); },
    get scene() { return scene && scene.def; },
  };

  // --------------------------------------------------------------------------------------------- scheduler
  function scheduleUntil(T) {
    const now = ctx.currentTime;
    if (!held) {
      if (cur) { if (cur.t < now - 0.05) cur.t = now + 0.05; let guard = 0; while (cur.t < T && guard++ < 400) { cur.t += playBar(cur, cur.t); cur.bar++; } }
      if (scene) for (const sp of scene.spots) {
        if (sp.next < now - 0.05) sp.next = now + rr(0.2, sp.d.every[1]);
        let guard = 0;
        while (sp.next < T && guard++ < 400) {
          const on = sp.d.param ? (params[sp.d.param] ?? 0) : 1;
          if (on > 0 && rnd() < on) { const p = sp.d.pan || [-0.5, 0.5], dst = panTo(rr(p[0], p[1]), scene.bus), v = (sp.d.gain ?? 0.05) * rr(0.6, 1); if (typeof sp.d.make === 'function') sp.d.make(ctx, dst, sp.next, rnd, v); else SPOT[sp.d.make](dst, sp.next, v); }
          sp.next += rr(sp.d.every[0], sp.d.every[1]);
        }
      }
    }
    for (let i = dead.length - 1; i >= 0; i--) if (dead[i].at < now) { for (const n of dead[i].nodes) { try { if (n.stop) n.stop(); } catch (e) { /* already stopped */ } try { n.disconnect(); } catch (e) { /* already gone */ } } dead.splice(i, 1); }
  }

  return {
    music, amb, scheduleUntil, INST,
    // Cue variation for the game's own tone() and noise(): multiply the frequency by f and the gain by g, start
    // a noise buffer at offset o (seconds), so no two repeats of a cue are sample-identical.
    jit(cents = 25, db = 1.5) { return { f: 2 ** (rr(-cents, cents) / 1200), g: 10 ** (rr(-db, 0) / 20), o: rr(0, 1.5) }; },
    start() { if (!timer) timer = setInterval(() => { if (ctx.state === 'running') scheduleUntil(ctx.currentTime + 0.25); }, 25); },
    stop() { if (timer) clearInterval(timer); timer = 0; },
    // Pause card or hidden tab: fade both buses out and schedule nothing until release().
    hold(tc = 0.08) { held = true; const t = ctx.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setTargetAtTime(0, t, tc); ambBus.gain.setTargetAtTime(0, t, tc); },
    release(tc = 0.3) { held = false; const t = ctx.currentTime; musicBus.gain.setTargetAtTime(mLevel, t, tc); ambBus.gain.setTargetAtTime(aLevel, t, tc); },
    get held() { return held; },
  };
}

// Renders `seconds` of audio faster than real time and measures it, so a test can check music and ambience
// that nobody in the test run can hear. `build(ctx, dest)` builds the graph on the offline context and schedules
// everything up to `seconds` (for the kit: make a kit on ctx, play, then kit.scheduleUntil(seconds)); whatever it
// returns comes back as `built` (return kit.music.info() to get the variation counts).
//   peak, rms: linear, 0..1 (peakDb, rmsDb in dBFS). longestSilence: seconds in a row below -60 dBFS.
//   stereo: side level over mid level (0 = mono). secs: RMS of each second. wav: base64 16-bit WAV if asked.
export async function measureAudio(build, seconds, o = {}) {
  const rate = o.rate || 22050, OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const oc = new OC(2, Math.ceil(rate * seconds), rate), made = build(oc, oc.destination);
  const buf = await oc.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
  let peak = 0, mid = 0, side = 0, run = 0, longest = 0; const secs = [];
  for (let s = 0; s * rate < n; s++) {
    const end = Math.min(n, (s + 1) * rate); let e = 0;
    for (let i = s * rate; i < end; i++) { const a = (L[i] + R[i]) / 2, d = (L[i] - R[i]) / 2, p = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (p > peak) peak = p; e += a * a; side += d * d; }
    mid += e; const r = Math.sqrt(e / (end - s * rate)); secs.push(+r.toFixed(5));
    if (r < 0.001) { run++; longest = Math.max(longest, run); } else run = 0;
  }
  const rms = Math.sqrt(mid / n), db = (x) => +(20 * Math.log10(Math.max(x, 1e-9))).toFixed(1);
  const res = { seconds, peak: +peak.toFixed(4), rms: +rms.toFixed(4), peakDb: db(peak), rmsDb: db(rms), longestSilence: longest, stereo: +(Math.sqrt(side / n) / (rms || 1)).toFixed(3), secs, built: typeof made === 'function' ? made() : made };
  if (o.wav) {
    const bytes = new Uint8Array(44 + n * 4), v = new DataView(bytes.buffer), str = (at, s) => { for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); res.wav = btoa(bin);
  }
  return res;
}
