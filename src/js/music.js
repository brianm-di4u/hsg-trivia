// This game's own music and ambience, written as data for the engine in audiokit.js.
// Chord roots are scale degrees (0 = I, 1 = ii, 2 = iii, 3 = IV, 4 = V, 5 = vi; in the minor piece 0 = i, 3 = iv,
// 5 = VI, 6 = VII). Every piece has the form AABA with eight-bar sections, so it plays for more than a minute
// before it comes round again, and the lead is varied on every return.
const MINOR = [0, 2, 3, 5, 7, 8, 10];

export const SCORES = {
  // The board: an easy jazz-age swing in B flat. Brushes, an upright walking line, a soft pad and vibes. About 83 s.
  board: {
    bpm: 92, swing: 0.22, key: 58, sevenths: [1, 4, 5], form: 'AABA',
    sections: { A: [0, 5, 1, 4, 0, 3, 1, 4], B: [3, 3, 2, 5, 1, 4, 0, 4] },
    pad: { inst: 'pad', gain: 0.03 },
    bass: { inst: 'bass', pattern: 'walk', gain: 0.1 },
    comp: { inst: 'piano', at: [1, 3], gain: 0.026, len: 0.3 },
    lead: { inst: 'mallet', gain: 0.075, vary: 0.35, rest: 0.18, classes: [0, 1, 2, 4, 5] },
    perc: { b: [1, 3], h: [1.5, 3.5], gain: 0.5 },
    lp: 3800, delay: 0.2, delayBeats: 0.75,
  },
  // A question on the table: A minor, dry, a wood-block tick on every beat. Tension doubles the tick. About 77 s.
  question: {
    bpm: 100, key: 57, scale: MINOR, sevenths: [4], form: 'AABA',
    sections: { A: [0, 5, 3, 6, 0, 5, 3, 4], B: [3, 3, 6, 6, 5, 5, 4, 4] },
    pad: { inst: 'organ', gain: 0.026 },
    bass: { inst: 'pluck', pattern: 'two', gain: 0.07 },
    lead: { inst: 'pluck', gain: 0.07, vary: 0.3, rest: 0.3, classes: [0, 2, 4, 6] },
    perc: { t: [0, 1, 2, 3], gain: 0.7 }, perc2: { t: [0.5, 1.5, 2.5, 3.5], h: [0.5, 1.5, 2.5, 3.5], gain: 0.4 },
    lp: 2900, delay: 0,
  },
  // The climb to the Mountain Tower: D major, quicker, brighter, a steady pulse. About 64 s.
  summit: {
    bpm: 120, key: 62, sevenths: [4], form: 'AABA',
    sections: { A: [0, 4, 5, 3, 0, 4, 3, 4], B: [3, 4, 0, 5, 3, 4, 0, [4, 1]] },
    pad: { inst: 'pad', gain: 0.032 },
    bass: { inst: 'bass', pattern: 'two', gain: 0.1 },
    comp: { inst: 'organ', at: [0.5, 1.5, 2.5, 3.5], gain: 0.02, len: 0.25 },
    lead: { inst: 'flute', gain: 0.07, oct: 1, vary: 0.3, rest: 0.1, lift: true, classes: [0, 1, 2, 4, 5] },
    perc: { k: [0, 2], h: [0.5, 1.5, 2.5, 3.5], gain: 0.4 }, perc2: { s: [1, 3], gain: 0.3 },
    lp: 4600, delay: 0.14, delayBeats: 0.5,
  },
  // Title, setup, help and results: a slow spa-town rag in F, piano over an oom-pah bass. About 98 s.
  title: {
    bpm: 78, swing: 0.16, key: 53, sevenths: [4], form: 'AABA',
    sections: { A: [0, 0, 4, 4, 4, 4, 0, 0], B: [3, 3, 0, 0, 1, 4, 0, 4] },
    pad: { inst: 'pad', gain: 0.024 },
    bass: { inst: 'bass', pattern: 'two', gain: 0.1 },
    comp: { inst: 'piano', at: [1, 3], gain: 0.026, len: 0.3 },
    lead: { inst: 'piano', gain: 0.075, vary: 0.3, rest: 0.1, rhythms: [[0, 1, 3, 4, 6], [0, 3, 4, 7], [1, 2, 4, 5, 7], [0, 2, 3, 5, 6], [0, 3, 6], [0, 2, 4, 6]] },
    lp: 4200, delay: 0.1, delayBeats: 0.5,
  },
};

// Places. A bed is a slow wash of filtered noise; a spot is a sparse one-shot at random gaps. They are small and sit
// under the music. `wind` on the mountain follows how high up the spur the token is.
const trolley = { make: 'trolley', every: [16, 34], gain: 0.03, pan: [-0.8, -0.3] };
const water = { type: 'lowpass', freq: 520, gain: 0.06, lfo: { rate: 0.07, depth: 0.5 }, flfo: { rate: 0.05, depth: 140 } };
const steamAir = { type: 'bandpass', freq: 2400, q: 0.6, gain: 0.012, pan: 0.3, lfo: { rate: 0.11, depth: 0.8 } };

export const SCENES = {
  // Title and menus: the whole valley at once, a long way off.
  valley: { beds: [water, steamAir], spots: [{ make: 'burble', every: [3, 8], gain: 0.04 }, { make: 'hiss', every: [10, 22], gain: 0.03 }, { make: 'bird', every: [9, 20], gain: 0.02 }, trolley] },
  // Bathhouse Row: warm water in stone, steam, drips.
  row: { beds: [water, steamAir], spots: [{ make: 'drip', every: [1.5, 5], gain: 0.045 }, { make: 'hiss', every: [8, 16], gain: 0.035 }, trolley] },
  // Bridge Street: the creek under the street.
  bridge: { beds: [{ type: 'bandpass', freq: 850, q: 0.5, gain: 0.05, lfo: { rate: 0.09, depth: 0.5 }, flfo: { rate: 0.06, depth: 220 } }, steamAir],
    spots: [{ make: 'burble', every: [1.5, 4], gain: 0.045 }, trolley] },
  // Central Avenue: street murmur, the trolley, a little steam.
  central: { beds: [{ type: 'bandpass', freq: 700, q: 0.5, gain: 0.04, lfo: { rate: 0.13, depth: 0.5 } }, steamAir],
    spots: [{ make: 'swell', every: [8, 16], gain: 0.03 }, { make: 'hiss', every: [12, 24], gain: 0.025 }, { make: 'trolley', every: [9, 20], gain: 0.034, pan: [-0.8, -0.3] }] },
  // Oaklawn: a crowd that swells and falls away, a far bell.
  oaklawn: { beds: [{ type: 'bandpass', freq: 700, q: 0.5, gain: 0.05, lfo: { rate: 0.13, depth: 0.6 } }, { type: 'bandpass', freq: 1600, q: 0.7, gain: 0.016, lfo: { rate: 0.21, depth: 0.6 }, pan: -0.3 }],
    spots: [{ make: 'swell', every: [5, 10], gain: 0.05 }, { make: 'bell', every: [14, 30], gain: 0.03 }] },
  // The Lakes: small waves on a shore, birds.
  lakes: { beds: [{ type: 'lowpass', freq: 300, gain: 0.07, lfo: { rate: 0.2, depth: 0.8 }, flfo: { rate: 0.03, depth: 80 } }, { type: 'lowpass', freq: 900, gain: 0.02, lfo: { rate: 0.13, depth: 0.6 }, pan: -0.3 }],
    spots: [{ make: 'lap', every: [2, 5], gain: 0.05 }, { make: 'bird', every: [3, 8], gain: 0.025 }, { make: 'bird', every: [7, 15], gain: 0.018, pan: [0.3, 0.8] }] },
  // The Ballfields: open air, a faint far crowd.
  ballfields: { beds: [{ type: 'lowpass', freq: 380, gain: 0.05, lfo: { rate: 0.09, depth: 0.7 }, flfo: { rate: 0.04, depth: 120 } }, { type: 'bandpass', freq: 800, q: 0.5, gain: 0.012, lfo: { rate: 0.17, depth: 0.8 }, pan: 0.4 }],
    spots: [{ make: 'bird', every: [5, 12], gain: 0.025 }, { make: 'swell', every: [10, 20], gain: 0.03, pan: [0.3, 0.8] }, trolley] },
  // Happy Hollow: a cold spring in the trees.
  hollow: { beds: [{ type: 'bandpass', freq: 700, q: 0.8, gain: 0.04, lfo: { rate: 0.1, depth: 0.5 }, flfo: { rate: 0.07, depth: 180 } }, { type: 'lowpass', freq: 340, gain: 0.04, lfo: { rate: 0.06, depth: 0.7 } }],
    spots: [{ make: 'burble', every: [2, 6], gain: 0.04 }, { make: 'bird', every: [4, 11], gain: 0.025 }, { make: 'drip', every: [5, 12], gain: 0.03 }] },
  // Park Avenue: breeze, birds, the trolley.
  park: { beds: [{ type: 'lowpass', freq: 420, gain: 0.05, lfo: { rate: 0.08, depth: 0.6 }, flfo: { rate: 0.05, depth: 130 } }, steamAir],
    spots: [{ make: 'bird', every: [3, 9], gain: 0.025 }, { make: 'trolley', every: [12, 26], gain: 0.03, pan: [-0.8, -0.3] }] },
  // The mountain spur: wind that grows toward the Tower, birds.
  mountain: { beds: [{ type: 'lowpass', freq: 380, gain: 0.06, lfo: { rate: 0.09, depth: 0.7 }, flfo: { rate: 0.04, depth: 120 }, param: 'wind', range: [0.5, 1.6] },
      { type: 'bandpass', freq: 1100, q: 0.5, gain: 0.01, lfo: { rate: 0.12, depth: 0.9 }, param: 'wind', range: [0.2, 1.8], pan: -0.3 }],
    spots: [{ make: 'bird', every: [5, 14], gain: 0.022 }, { make: 'bird', every: [9, 20], gain: 0.016, pan: [-0.8, -0.3] }] },
};
