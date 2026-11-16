// WebAudio synth with named presets (ideas from ZzFX and jsfxr, SAMPLES.md #2–3; our own code).
// Every sound is oscillators and filtered noise with a short envelope; no audio files.
// Three layers share one master bus and a limiter: cues (sfx), music and ambience. Music and ambience are scored in
// music.js and played by the engine in audiokit.js; they follow the master Sound switch as well as their own.
import { makeAudioKit, measureAudio } from './audiokit.js';
import { SCORES, SCENES } from './music.js';

// Levels, in one place. MASTER_K turns the Volume slider (0..1) into gain; SFX_LEVEL, MUSIC_LEVEL and AMB_LEVEL set how
// the three layers sit against each other (cues loudest, music under them, ambience under the music).
const MASTER_K = 0.5, SFX_LEVEL = 2.2, MUSIC_LEVEL = 1.2, AMB_LEVEL = 1.2, DEFAULT_VOLUME = 0.7;
const PENTA = [0, 2, 4, 7, 9]; // major pentatonic: a hop walks up it and a run of right answers climbs

let ac = null, master = null, sfxIn = null, noiseBuf = null, kit = null, cueBase = 0, trim = 1;
const opts = { on: true, volume: DEFAULT_VOLUME, effects: true, music: true, ambience: true };
export const audioStats = { played: 0, log: [], noiseStarts: [], ctx: false, get noiseSeconds() { return noiseBuf ? noiseBuf.duration : 0; }, get state() { return ac ? ac.state : 'none'; } };

// S5-19: the noise every hop, gavel and steam cue is cut from. It is NOISE_SECONDS long (was 1 s) and each cue starts at a random place in the first
// NOISE_SECONDS - 1 of it (was 0 to 0.9 s), so the grain of two repeats differs more and a 0.9 s steam sweep does not use nearly the whole buffer.
// It stays white noise: a softer (pink) fill would change the colour and level of every noise cue, which needs listening, and is left to the owner's ears.
const NOISE_SECONDS = 3;
const makeNoise = (c) => {
  const b = c.createBuffer(1, Math.round(c.sampleRate * NOISE_SECONDS), c.sampleRate);
  const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
};
// A soft clip ends the chain: straight up to CLIP_FROM, then curving towards CLIP_TOP, so nothing passes 0.92 however loud the
// volume or the pile of cues (a landmark answer's right-answer cue and stamp thud struck together reached 1.05 at full volume).
// Everything under 0.75 is untouched, so no level at the shipped volume moves.
const CLIP_FROM = 0.75, CLIP_TOP = 0.92;
const SOFT_CLIP = (() => {
  const n = 4097, curve = new Float32Array(n), span = CLIP_TOP - CLIP_FROM;
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1, v = Math.abs(x); curve[i] = Math.sign(x) * (v <= CLIP_FROM ? v : CLIP_FROM + span * Math.tanh((v - CLIP_FROM) / span)); }
  return curve;
})();
// master gain, a limiter, the soft clip, the destination; cues enter at sfxIn, which also feeds two quiet echo taps for a little room.
function chain(c, dest, volume) {
  const m = c.createGain(); m.gain.value = volume * MASTER_K;
  const lim = c.createDynamicsCompressor();
  lim.threshold.value = -3; lim.knee.value = 2; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.12;
  const clip = c.createWaveShaper(); clip.curve = SOFT_CLIP; clip.oversample = '4x';
  m.connect(lim); lim.connect(clip); clip.connect(dest);
  const s = c.createGain(); s.gain.value = SFX_LEVEL; s.connect(m);
  for (const ms of [90, 140]) { const d = c.createDelay(0.5); d.delayTime.value = ms / 1000; const g = c.createGain(); g.gain.value = 0.16; s.connect(d); d.connect(g); g.connect(m); }
  return { master: m, sfxIn: s };
}

function ensure() {
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ac = new AC();
    ({ master, sfxIn } = chain(ac, ac.destination, opts.volume));
    applyGains(true);
    noiseBuf = makeNoise(ac);
    kit = makeAudioKit(ac, master, { seed: (Date.now() & 0xffffff) | 1, music: MUSIC_LEVEL, ambience: AMB_LEVEL });
    kit.start();
    ac.onstatechange = () => { if (!held && ac.state !== 'running' && ac.state !== 'closed' && document.visibilityState !== 'hidden') unlockAudio(); };
    audioStats.ctx = true;
    applyLayers();
  } catch (e) { ac = null; kit = null; }
  return ac;
}

// The master and the cue bus follow the Sound switch, the Sound effects switch and the Volume slider. They glide (about 20 ms) rather than jump,
// so a slider drag does not zipper and a cue already sounding (a win chord, a steam sweep) goes quiet when sound is turned off.
const GAIN_GLIDE = 0.02;
function applyGains(now) {
  if (!ac || !master) return;
  const m = opts.on ? opts.volume * MASTER_K : 0, s = opts.on && opts.effects ? SFX_LEVEL : 0;
  if (now) { master.gain.value = m; sfxIn.gain.value = s; return; }
  master.gain.setTargetAtTime(m, ac.currentTime, GAIN_GLIDE); sfxIn.gain.setTargetAtTime(s, ac.currentTime, GAIN_GLIDE);
}

// ---- music and ambience: what the game asks for, and what the settings allow ----
let want = { music: null, ambience: null, wind: 0, tension: 0 };
function applyLayers() {
  if (!kit) return;
  const m = opts.on && opts.music, a = opts.on && opts.ambience;
  kit.music.level(m ? MUSIC_LEVEL : 0); kit.amb.level(a ? AMB_LEVEL : 0);
  if (m && want.music && SCORES[want.music]) kit.music.play(SCORES[want.music], { fade: 1.8 }); else kit.music.stop(0.6);
  if (a && want.ambience && SCENES[want.ambience]) kit.amb.play(SCENES[want.ambience], { fade: 3 }); else kit.amb.stop(1);
  kit.music.intensity(want.tension); kit.amb.set('wind', want.wind);
}
// The game says which piece and which place it is in; nothing sounds until the first gesture has made the context.
export function setSoundscape(next) {
  const changed = ['music', 'ambience'].some((k) => next[k] !== undefined && next[k] !== want[k]);
  want = { ...want, ...next };
  if (changed) applyLayers();
  else if (kit) { kit.music.intensity(want.tension); kit.amb.set('wind', want.wind); }
}

export function setAudio({ on, volume, effects, music, ambience }) {
  if (on !== undefined) opts.on = on;
  if (volume !== undefined) opts.volume = volume;
  if (effects !== undefined) opts.effects = effects !== false;
  if (music !== undefined) opts.music = music !== false;
  if (ambience !== undefined) opts.ambience = ambience !== false;
  applyGains();
  applyLayers();
}

// Call from a user gesture (browsers keep audio suspended until then). resume() settles later than the gesture's own
// cue, so sfx() holds one cue (the latest) while a resume is pending and plays it when the context is running.
let resuming = null, pending = null;
export function unlockAudio() {
  const c = ensure(); if (!c) return Promise.resolve();
  if (c.state === 'running' || held) return Promise.resolve();
  if (!resuming) {
    resuming = c.resume().catch(() => {}).then(() => { resuming = null; const name = pending; pending = null; if (name) sfx(name); applyLayers(); });
  }
  return resuming;
}

// A hidden tab must be silent (AI timers keep running there) and a context the system interrupted (iOS call, lock
// screen) must come back: suspend on hidden or pagehide, resume on return and on the next gesture. The pause card
// does not suspend the context (its buttons still click) but fades the music and ambience out and schedules nothing.
let held = false, paused = false;
function syncHold() { if (!kit) return; if (held || paused) kit.hold(); else kit.release(); }
function hold() { held = true; pending = null; syncHold(); if (ac && ac.state === 'running') ac.suspend().catch(() => {}); }
function release() { held = false; syncHold(); if (ac && ac.state !== 'running') unlockAudio(); }
export function setAudioPaused(on) { if (paused === on) return; paused = on; syncHold(); }
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? hold() : release()));
  window.addEventListener('pagehide', hold);
  window.addEventListener('pageshow', release);
}

// ---- cues ----
const rand = (a, b) => a + Math.random() * (b - a);
const dB = (x) => 10 ** (x / 20);
const panned = (pan, to) => { if (!pan || !ac.createStereoPanner) return to; const p = ac.createStereoPanner(); p.pan.value = Math.max(-0.7, Math.min(0.7, pan)); p.connect(to); return p; };

// Every cue is varied a little each time it plays (10 to 30 cents of detune, up to 1.5 dB of gain, a random start in the
// noise buffer) so two repeats are never sample-identical. j: scales that variation (0 turns it off). pair: detune the body into two voices
// of that many cents. pan: -0.7..0.7, left to right.
function tone({ type = 'sine', f = 440, f2 = null, t = 0, a = 0.005, d = 0.15, v = 0.3, q = null, pan = 0, pair = 0, j = 1 }) {
  const now = ac.currentTime + cueBase + t;
  const k = 2 ** (rand(-20, 20) * j / 1200); f *= k; if (f2) f2 *= k; v *= trim * dB(rand(-1.5, 0) * j);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(v, now + a); g.gain.exponentialRampToValueAtTime(0.0001, now + a + d);
  let node = g;
  if (q) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = q; fl.connect(g); node = fl; }
  g.connect(panned(pan, sfxIn));
  for (const c of pair ? [pair, -pair] : [0]) {
    const o = ac.createOscillator(); o.type = type; o.detune.value = c; o.frequency.setValueAtTime(f, now);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + a + d);
    o.connect(node); o.start(now); o.stop(now + a + d + 0.05);
  }
}

function noise({ t = 0, d = 0.3, v = 0.25, type = 'bandpass', f = 1200, f2 = null, qv = 1, pan = 0 }) {
  const now = ac.currentTime + cueBase + t; v *= trim * dB(rand(-1.5, 0));
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, now); fl.Q.value = qv;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, now + d);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(v, now + d * 0.2); g.gain.exponentialRampToValueAtTime(0.0001, now + d);
  s.connect(fl); fl.connect(g); g.connect(panned(pan, sfxIn)); const at = rand(0, NOISE_SECONDS - 1); audioStats.noiseStarts.push(at); if (audioStats.noiseStarts.length > 40) audioStats.noiseStarts.shift();
  s.start(now, at); s.stop(now + d + 0.05);
}

// o: { i: step along a walk, pan: screen position -1..1, streak: right answers in a row, tier: 0 easy, 1 medium, 2 hard, n: the roll or the run,
//      k: pitch multiplier, at: seconds to wait before it sounds }
const PRESETS = {
  click: () => { tone({ type: 'sine', f: 760, f2: 560, d: 0.03, v: 0.12 }); noise({ d: 0.025, v: 0.1, f: 2200, qv: 1.5 }); },
  // The steam gauge counts the roll: n + 2 ticks climb, then a held note settles at a pitch set by n (a 1 lands low, a 6 high) with a bell partial.
  gauge: (o) => {
    const n = Math.min(6, Math.max(1, o.n | 0 || 4)), w = rand(-0.3, 0.3), end = (n + 2) * 0.08, f = 440 * 2 ** ((n - 1) / 6);
    for (let i = 0; i < n + 2; i++) tone({ type: 'triangle', f: 500 + i * 60, t: i * 0.08, d: 0.04, v: 0.12, pan: w * (i / (n + 1)), j: 0.4 });
    tone({ type: 'triangle', f, t: end, d: 0.35, v: 0.08, pan: w, pair: 5 }); tone({ type: 'sine', f: f * 2.76, t: end, d: 0.22, v: 0.02, pan: w });
  },
  hop: (o) => {
    const i = o.i | 0, f = 261.63 * 2 ** ((PENTA[i % 5] + 12 * (Math.floor(i / 5) % 2)) / 12), pan = o.pan || 0;
    tone({ type: 'triangle', f, f2: f * 0.7, d: 0.09, v: 0.34, pan, pair: 6 }); tone({ type: 'sine', f: f * 2, f2: f * 1.4, d: 0.05, v: 0.06, pan });
    noise({ d: 0.05, v: 0.13, f: 2000, pan });
  },
  correct: (o) => {
    const k = 2 ** ((Math.min(7, Math.max(0, (o.streak || 1) - 1)) + 2 * Math.min(2, Math.max(0, o.tier | 0))) / 12), pan = rand(-0.2, 0.2); // a hard question rings up to four semitones above an easy one
    [523.25, 659.25, 783.99].forEach((f, i) => { tone({ type: 'triangle', f: f * k, t: i * 0.09, d: 0.32, v: 0.3, pan, pair: 6 }); tone({ type: 'sine', f: f * k * 2, t: i * 0.09, d: 0.5, v: 0.05, pan }); });
    tone({ type: 'sine', f: 1046.5 * k, t: 0.27, d: 0.5, v: 0.16, pan });
    for (const m of [1, 2, 3]) tone({ type: 'sine', f: 523.25 * k * m, d: 0.6, v: 0.16 / m, pan, j: 0.4 });
    noise({ d: 0.03, v: 0.12, type: 'highpass', f: 5000, pan });
  },
  wrong: () => {
    const pan = rand(-0.2, 0.2);
    tone({ type: 'sine', f: 311, t: 0, d: 0.22, v: 0.4, q: 900, pan, pair: 8 }); tone({ type: 'sine', f: 233, t: 0.16, d: 0.35, v: 0.4, q: 700, pan, pair: 8 });
    noise({ d: 0.1, v: 0.1, type: 'lowpass', f: 500, pan });
  },
  stamp: () => { tone({ type: 'sine', f: 140, f2: 60, d: 0.18, v: 0.6 }); noise({ d: 0.12, v: 0.3, type: 'lowpass', f: 900 }); noise({ t: 0.08, d: 0.25, v: 0.1, f: 3500, qv: 0.6 }); },
  steam: () => { noise({ d: 0.9, v: 0.26, f: 600, f2: 4000, qv: 0.7, pan: rand(-0.3, 0.3) }); },
  coin: (o) => { const pan = rand(-0.2, 0.2), k = o.k || 1; tone({ type: 'square', f: 988 * k, d: 0.06, v: 0.12, q: 4000, pan }); tone({ type: 'square', f: 1319 * k, t: 0.06, d: 0.22, v: 0.12, q: 4000, pan }); },
  // A run of right answers reaches 3 or 5: a quick rising chime (a fourth note for the 5) on top of the answer's own cue.
  streak: (o) => { const pan = rand(-0.2, 0.2); (o.n >= 5 ? [1046.5, 1318.5, 1568, 2093] : [1046.5, 1318.5, 1568]).forEach((f, i) => { tone({ type: 'sine', f, t: i * 0.07, d: 0.3, v: 0.22, pan }); tone({ type: 'triangle', f: f * 2.01, t: i * 0.07, d: 0.18, v: 0.05, pan, pair: 6 }); }); },
  // The turn passes to someone: one soft tick, a little higher when it is a person's turn.
  turn: (o) => { const f = o.me ? 880 : 660; tone({ type: 'sine', f, f2: f * 0.9, d: 0.05, v: 0.2 }); noise({ d: 0.02, v: 0.05, f: 2600, qv: 1.5 }); },
  // A question opens: two soft notes, a fourth apart and rising, brighter than the interface ticks (a person's turn only).
  ask: () => { const pan = rand(-0.15, 0.15); [[587.33, 0], [783.99, 0.1]].forEach(([f, t]) => { tone({ type: 'sine', f, t, d: 0.28, v: 0.24, pan }); tone({ type: 'triangle', f: f * 2, t, d: 0.12, v: 0.05, pan, pair: 6 }); }); },
  // A ticket chip set down on the Post Time wager: a short woody clack with a ceramic ring.
  chip: () => { const pan = rand(-0.2, 0.2); tone({ type: 'triangle', f: 330, f2: 200, d: 0.05, v: 0.4, pan }); tone({ type: 'sine', f: 1850, d: 0.12, v: 0.1, pan }); noise({ d: 0.03, v: 0.18, f: 1800, qv: 2, pan }); },
  bell: () => { [1, 2.76, 5.4].forEach((m, i) => tone({ type: 'sine', f: 660 * m, d: 0.9 - i * 0.25, v: 0.3 / (i + 1) })); tone({ type: 'sine', f: 660, t: 0.25, d: 0.7, v: 0.2 }); },
  trolley: () => { const pan = rand(-0.4, 0.4); for (const at of [0, 0.22]) [1, 2.4, 4.1].forEach((m, i) => tone({ type: 'sine', f: 880 * m, t: at, d: 0.7 - i * 0.2, v: 0.28 / (i + 1), pan })); },
  // Post Time: three short notes and a long one.
  bugle: () => { [[392, 0, 0.12], [523.25, 0.16, 0.12], [659.25, 0.32, 0.12], [783.99, 0.48, 0.55]].forEach(([f, t, d]) => { tone({ type: 'sawtooth', f, t, d, a: 0.02, v: 0.16, q: 2200, pair: 5 }); tone({ type: 'square', f: f * 0.5, t, d, a: 0.02, v: 0.06, q: 900 }); }); },
  warp: () => { tone({ type: 'sawtooth', f: 200, f2: 1200, d: 0.5, v: 0.14, q: 1800 }); tone({ type: 'sine', f: 1200, f2: 300, t: 0.45, d: 0.4, v: 0.2 }); },
  gavel: () => { noise({ d: 0.08, v: 0.5, type: 'lowpass', f: 700 }); tone({ type: 'sine', f: 180, f2: 90, d: 0.12, v: 0.6 }); },
  // The answer timer's tick, once a second under 5 s: it climbs a whole tone each second (o.sec is the seconds left, 5 down to 1).
  tick: (o) => { const f = 1500 * 2 ** ((5 - Math.min(5, Math.max(1, o.sec | 0 || 5))) * 2 / 12); tone({ type: 'sine', f, d: 0.06, v: 0.45 }); noise({ d: 0.02, v: 0.2, type: 'highpass', f: 4000 }); },
  // Time ran out: a buzzy two-step fall (sawtooth under a low-pass with a breath of noise), unlike the soft sine fall of a wrong answer.
  timeout: () => {
    const pan = rand(-0.2, 0.2);
    tone({ type: 'sawtooth', f: 330, f2: 220, d: 0.26, v: 0.3, q: 1300, pan, pair: 9 }); tone({ type: 'sawtooth', f: 247, f2: 123, t: 0.22, d: 0.42, v: 0.3, q: 1000, pan, pair: 9 });
    noise({ d: 0.5, v: 0.1, type: 'lowpass', f: 700, pan });
  },
  // The win fanfare in three tiers (S5-20): tier 0 (good) is the five rising notes and the chord, as it always was; tier 1 (great) adds a bass note under them;
  // tier 2 (perfect, and the Summit win) adds a bell tail and a pad of long soft notes that outlasts the chord.
  win: (o) => {
    const pan = rand(-0.15, 0.15), tier = Math.min(2, Math.max(0, o.tier | 0));
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ type: 'triangle', f, t: i * 0.12, d: 0.45, v: 0.3, pan, pair: 6 }));
    [523.25, 659.25, 783.99].forEach((f) => tone({ type: 'sine', f, t: 0.7, d: 1.2, v: 0.16, pan }));
    if (tier >= 1) { tone({ type: 'sine', f: 130.81, t: 0, d: 0.9, v: 0.26, pan, j: 0.4 }); tone({ type: 'sine', f: 196, t: 0.48, d: 1.1, v: 0.2, pan, j: 0.4 }); }
    if (tier >= 2) {
      [1, 2.76, 5.4].forEach((m, i) => tone({ type: 'sine', f: 1046.5 * m, t: 0.62, d: 1.5 - i * 0.4, v: 0.14 / (i + 1), pan }));
      [261.63, 329.63, 392].forEach((f) => tone({ type: 'sine', f, t: 0.6, a: 0.45, d: 2.1, v: 0.08, pan, j: 0.4 }));
    }
  },
  // A quiz result under 70 %: three soft notes falling, kinder than the paper rustle it replaces (S5-20).
  consolation: () => { const pan = rand(-0.15, 0.15); [[587.33, 0], [493.88, 0.16], [392, 0.32]].forEach(([f, t], i) => { tone({ type: 'sine', f, t, d: 0.5 - i * 0.06, v: 0.22, pan, pair: 5 }); tone({ type: 'triangle', f: f * 2, t, d: 0.18, v: 0.03, pan, pair: 6 }); }); },
  page: () => noise({ d: 0.18, v: 0.14, f: 3000, f2: 1500, qv: 0.5, pan: rand(-0.3, 0.3) }),
  // An achievement: a small two-note bell (a fifth apart) with a soft shimmer, short enough to sit on top of play.
  achieve: () => { const pan = rand(-0.15, 0.15); [[783.99, 0], [1174.66, 0.13]].forEach(([f, t]) => { tone({ type: 'sine', f, t, d: 0.7, v: 0.3, pan }); tone({ type: 'triangle', f: f * 2.01, t, d: 0.35, v: 0.07, pan, pair: 6 }); }); noise({ t: 0.13, d: 0.3, v: 0.05, type: 'highpass', f: 6000, pan }); },
};
// How loud each cue sits at the default volume: the preset's own shape is kept, this trims the whole cue so that the ones
// the player must notice peak near 0.3 (measured by audioRender). click and tick are quiet interface sounds.
const TRIM = { hop: 2.4, correct: 0.7, wrong: 0.56, stamp: 2.5, steam: 3.1, coin: 3.6, bell: 1.45, trolley: 0.9, bugle: 1.1, warp: 1.8, gavel: 2.4, win: 0.85, consolation: 0.75, page: 6.6, gauge: 3.2, tick: 1, timeout: 0.8, streak: 1.5, turn: 2.5, ask: 1.5, chip: 4 };
const play = (name, o) => { trim = TRIM[name] || 1; const base = cueBase; cueBase += o.at || 0; try { PRESETS[name](o); } finally { trim = 1; cueBase = base; } };
// The big cues the music steps back for.
const DUCKS = { correct: 6, wrong: 6, timeout: 6, win: 8, stamp: 5 };

// A cue is not struck again within a short gap of its own last start: at the Fast AI speed the same long cue (a 0.9 s steam sweep, the
// arpeggio) would otherwise be laid on top of itself. A walk's hops come quicker than that, so they have a shorter gap.
// It is judged on the page's own clock, not the audio clock, which stands still while the context is slow to start.
const MIN_GAP = { hop: 40 }, DEFAULT_GAP = 80, lastAt = {};
export function sfx(name, o = {}) {
  if (!opts.on || !opts.effects || !PRESETS[name]) return;
  const c = ensure(); if (!c) return;
  if (c.state !== 'running') { if (resuming) pending = name; return; }
  const at = performance.now();
  if (at - (lastAt[name] === undefined ? -1 : lastAt[name]) < (MIN_GAP[name] || DEFAULT_GAP)) return;
  lastAt[name] = at;
  try { play(name, o); audioStats.played++; audioStats.log.push({ name, ...o }); if (audioStats.log.length > 40) audioStats.log.shift(); if (DUCKS[name] && kit) kit.music.duck(DUCKS[name], name === 'win' ? (o.tier >= 2 ? 2600 : 1600) : 700); } catch (e) { /* audio must never break the game */ }
}
export const SOUND_NAMES = Object.keys(PRESETS);

// ---- test hooks: what pieces exist, and a render of one on its own ----
export const audioList = () => ({ music: Object.keys(SCORES), ambience: Object.keys(SCENES), cues: SOUND_NAMES });
export const audioInfo = () => ({
  held: held || paused, music: kit && kit.music.score ? Object.keys(SCORES).find((k) => SCORES[k] === kit.music.score) : null,
  ambience: kit && kit.amb.scene ? Object.keys(SCENES).find((k) => SCENES[k] === kit.amb.scene) : null,
  gains: { master: master ? master.gain.value : null, sfx: sfxIn ? sfxIn.gain.value : null },
  levels: { on: opts.on, effects: opts.effects, music: opts.on && opts.music ? MUSIC_LEVEL : 0, ambience: opts.on && opts.ambience ? AMB_LEVEL : 0 },
  bars: kit && kit.music.info() ? kit.music.info().bars : 0, want: { ...want },
});
// Renders a piece ('board', ...), a scene ('row', ...), a cue ('cue:correct'), or all three at once ('mix') on an
// offline context at the shipped level (default volume), and measures it. Never touches the live audio or settings.
// volume: the Volume slider to render at (0..1; the default is the shipped one, 1 is the slider at its maximum). 'busy' is the
// loudest moment a landmark answer makes: the board piece, the Row bed, and a stamp struck with a right answer, a coin just after (the winning stamp's own win cue comes later, in 'mix').
// o: the options the cue is played with ('cue:' pieces only; the default is a first right answer in the middle).
export function audioRender(name, seconds = 30, wantWav = false, volume = DEFAULT_VOLUME, o = { streak: 1, i: 2, pan: 0 }) {
  const build = (oc, dest) => {
    const { master: m, sfxIn: s } = chain(oc, dest, volume);
    const k = makeAudioKit(oc, m, { seed: 11, music: MUSIC_LEVEL, ambience: AMB_LEVEL });
    // A cue is built by the same preset code as in play: point it at the offline context for the call, then put the live one back.
    const cue = (n, at, o = {}) => { const live = { ac, sfxIn, noiseBuf }; ac = oc; sfxIn = s; noiseBuf = makeNoise(oc); cueBase = at; try { play(n, o); } finally { ({ ac, sfxIn, noiseBuf } = live); cueBase = 0; } };
    if (SCORES[name]) { k.music.play(SCORES[name], { fade: 0.02, at: 0 }); k.scheduleUntil(seconds); return () => k.music.info(); }
    if (SCENES[name]) { k.amb.play(SCENES[name], { fade: 0.02, at: 0 }); k.scheduleUntil(seconds); return () => ({ scene: name }); }
    if (name === 'mix') { k.music.play(SCORES.board, { fade: 0.02, at: 0 }); k.amb.play(SCENES.row, { fade: 0.02, at: 0 }); k.scheduleUntil(seconds); cue('win', 5, { tier: 2 }); return () => k.music.info(); }
    if (name === 'busy') { k.music.play(SCORES.board, { fade: 0.02, at: 0 }); k.amb.play(SCENES.row, { fade: 0.02, at: 0 }); k.scheduleUntil(seconds); for (const n of ['stamp', 'correct']) cue(n, 5, { streak: 3, i: 2 }); cue('coin', 5.3); return () => k.music.info(); }
    if (name.startsWith('cue:') && PRESETS[name.slice(4)]) { cue(name.slice(4), 0, o); return () => ({ cue: name.slice(4) }); }
    throw new Error('unknown audio piece: ' + name);
  };
  return measureAudio(build, seconds, { wav: wantWav });
}
