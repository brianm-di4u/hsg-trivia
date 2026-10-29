// WebAudio synth with named presets (ideas from ZzFX and jsfxr, SAMPLES.md #2–3; our own code).
// Every sound is oscillators and filtered noise with a short envelope; no audio files.

let ac = null, master = null, noiseBuf = null;
const opts = { on: true, volume: 0.7 };
export const audioStats = { played: 0, ctx: false };

function ensure() {
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ac = new AC();
    master = ac.createGain(); master.gain.value = opts.volume * 0.5; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 1, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    audioStats.ctx = true;
  } catch (e) { ac = null; }
  return ac;
}

export function setAudio({ on, volume }) {
  if (on !== undefined) opts.on = on;
  if (volume !== undefined) opts.volume = volume;
  if (master) master.gain.value = opts.volume * 0.5;
}

// Call from a user gesture (browsers keep audio suspended until then).
export function unlockAudio() { const c = ensure(); if (c && c.state === 'suspended') c.resume().catch(() => {}); }

function tone({ type = 'sine', f = 440, f2 = null, t = 0, a = 0.005, d = 0.15, v = 0.3, q = null }) {
  const now = ac.currentTime + t;
  const o = ac.createOscillator(); const g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, now);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + a + d);
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(v, now + a); g.gain.exponentialRampToValueAtTime(0.0001, now + a + d);
  let node = o;
  if (q) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = q; o.connect(fl); node = fl; }
  node.connect(g); g.connect(master); o.start(now); o.stop(now + a + d + 0.05);
}

function noise({ t = 0, d = 0.3, v = 0.25, type = 'bandpass', f = 1200, f2 = null, qv = 1 }) {
  const now = ac.currentTime + t;
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, now); fl.Q.value = qv;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, now + d);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(v, now + d * 0.2); g.gain.exponentialRampToValueAtTime(0.0001, now + d);
  s.connect(fl); fl.connect(g); g.connect(master); s.start(now); s.stop(now + d + 0.05);
}

const PRESETS = {
  click: () => tone({ type: 'square', f: 900, d: 0.03, v: 0.08, q: 2500 }),
  gauge: () => { for (let i = 0; i < 7; i++) tone({ type: 'triangle', f: 500 + i * 60, t: i * 0.08, d: 0.04, v: 0.12 }); },
  hop: () => { tone({ type: 'triangle', f: 320, f2: 220, d: 0.08, v: 0.18 }); noise({ d: 0.05, v: 0.05, f: 2000 }); },
  correct: () => { [523.25, 659.25, 783.99].forEach((f, i) => tone({ type: 'triangle', f, t: i * 0.09, d: 0.32, v: 0.22 })); tone({ type: 'sine', f: 1046.5, t: 0.27, d: 0.5, v: 0.12 }); },
  wrong: () => { tone({ type: 'sine', f: 311, t: 0, d: 0.22, v: 0.2, q: 900 }); tone({ type: 'sine', f: 233, t: 0.16, d: 0.35, v: 0.2, q: 700 }); },
  stamp: () => { tone({ type: 'sine', f: 140, f2: 60, d: 0.18, v: 0.5 }); noise({ d: 0.12, v: 0.25, type: 'lowpass', f: 900 }); noise({ t: 0.08, d: 0.25, v: 0.08, f: 3500, qv: 0.6 }); },
  steam: () => { noise({ d: 0.9, v: 0.22, f: 600, f2: 4000, qv: 0.7 }); },
  coin: () => { tone({ type: 'square', f: 988, d: 0.06, v: 0.08, q: 4000 }); tone({ type: 'square', f: 1319, t: 0.06, d: 0.22, v: 0.08, q: 4000 }); },
  bell: () => { [1, 2.76, 5.4].forEach((m, i) => tone({ type: 'sine', f: 660 * m, d: 0.9 - i * 0.25, v: 0.16 / (i + 1) })); tone({ type: 'sine', f: 660, t: 0.25, d: 0.7, v: 0.12 }); },
  warp: () => { tone({ type: 'sawtooth', f: 200, f2: 1200, d: 0.5, v: 0.1, q: 1800 }); tone({ type: 'sine', f: 1200, f2: 300, t: 0.45, d: 0.4, v: 0.12 }); },
  gavel: () => { noise({ d: 0.08, v: 0.4, type: 'lowpass', f: 700 }); tone({ type: 'sine', f: 180, f2: 90, d: 0.12, v: 0.4 }); },
  tick: () => tone({ type: 'sine', f: 1500, d: 0.03, v: 0.06 }),
  win: () => { [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ type: 'triangle', f, t: i * 0.12, d: 0.45, v: 0.2 })); [523.25, 659.25, 783.99].forEach((f) => tone({ type: 'sine', f, t: 0.7, d: 1.2, v: 0.12 })); },
  page: () => noise({ d: 0.18, v: 0.08, f: 3000, f2: 1500, qv: 0.5 }),
};

export function sfx(name) {
  if (!opts.on || !PRESETS[name]) return;
  const c = ensure(); if (!c || c.state !== 'running') return;
  try { PRESETS[name](); audioStats.played++; } catch (e) { /* audio must never break the game */ }
}
export const SOUND_NAMES = Object.keys(PRESETS);
