// Question bank index, categories, eras and the adaptive picker.
// QUESTIONS and TIMELINE are global consts inlined by the build (see src/index.html).
import { shuffle, weightedPick, clamp } from './util.js';

/* global QUESTIONS, TIMELINE */

// Category colors are a game-derived Okabe–Ito based set (colorblind-aware); every use is paired
// with an icon and a text label, so color is never the only cue. `ink` is the icon/text color on the fill.
export const CATS = [
  // `short` is the destination list's word for a category. 'Places' was 'Landmarks', which read like the stamp space's own label "Landmark" (P-N06).
  { id: 'Places & Landmarks', short: 'Places', icon: 'dome', color: '#0072B2', ink: '#FFFFFF' },
  { id: 'Food & Culture', short: 'Food & Culture', icon: 'smoker', color: '#8C5A2B', ink: '#FFFFFF' },
  { id: 'History', short: 'History', icon: 'spring', color: '#C2410C', ink: '#FFFFFF' },
  { id: 'Entertainment', short: 'Entertainment', icon: 'reel', color: '#56B4E9', ink: '#10233A' },
  { id: 'Nature & Lakes', short: 'Nature & Lakes', icon: 'bass', color: '#007A5A', ink: '#FFFFFF' },
  { id: 'Sports', short: 'Sports', icon: 'baseball', color: '#E69F00', ink: '#2A1C00' },
  { id: 'Legends & Oddities', short: 'Legends', icon: 'merman', color: '#5B4A8B', ink: '#FFFFFF' },
  { id: 'People', short: 'People', icon: 'fedora', color: '#CC79A7', ink: '#2A1020' },
];
export const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]));

export const ERAS = TIMELINE.eras;
export const ERA = Object.fromEntries(ERAS.map((e) => [e.id, e]));
// Era palette defaults from shared/design/tokens.js ERA_PALETTE (bg / accent / ink).
export const ERA_TINT = {
  ancient: ['#1F3324', '#5C7A3A', '#EDEAE2'],
  frontier: ['#C9D3D6', '#8E3B2B', '#2A2420'],
  'gilded-spa': ['#E6D7B5', '#A9432C', '#1F2A24'],
  roaring: ['#14121F', '#D4AF37', '#D8CFBD'],
  midcentury: ['#8FD0E8', '#E2553D', '#222222'],
  revival: ['#3E3528', '#8C6A3F', '#EDE3C8'],
  modern: ['#1E4E79', '#3FA7A0', '#F6F3EC'],
  any: ['#F3E9D2', '#1F2F5C', '#1F2F5C'],
};

export const DIFFS = ['easy', 'medium', 'hard'];
export const DIFF_WEIGHT = { easy: 1, medium: 1.4, hard: 1.8 };

export const BANK = QUESTIONS.questions;
const byId = new Map(BANK.map((q) => [q.id, q]));
export const getQ = (id) => byId.get(id);

// Era ids for Era Express: `ancient` is too small for a round, so it rides with `frontier`.
// `short` is the one line the era card shows (S4-16): at most 120 characters, made only of words from the era's own summary in the timeline data.
export const ERA_MODES = [
  { id: 'frontier', label: 'Ancient & Frontier', eras: ['ancient', 'frontier'], short: 'Native peoples and novaculite quarries, the first settlers and cabins, and a Civil War capital.' },
  { id: 'gilded-spa', label: 'Gilded Spa', eras: ['gilded-spa'], short: 'The railroad, Victorian then brick bathhouses, great fires, Oaklawn and the birth of spring training.' },
  { id: 'roaring', label: 'Roaring Spa Town', eras: ['roaring'], short: 'National park status, Bathhouse Row at its peak, the visiting gangsters, the new lakes and World War II.' },
  { id: 'midcentury', label: 'Midcentury Vapors', eras: ['midcentury'], short: 'The GI Revolt, revived casinos, motor hotels, desegregation and the 1967 shutdown.' },
  { id: 'revival', label: 'Revival Years', eras: ['revival'], short: 'Bathhouse closures, Magic Springs, the Clinton years and the Fordyce visitor center.' },
  { id: 'modern', label: 'Modern Spa City', eras: ['modern'], short: 'Crystal Falls, adaptive reuse of the bathhouses, Oaklawn’s casino and the Majestic fire.' },
];
export const eraCount = (mode) => BANK.filter((q) => mode.eras.includes(q.era)).length;

// Which district a question is about (S4-09), read from the question's own words: the landmark stamp asks about its place when the bank has such a question.
// Only the question text is read, never the answer. A district the bank says little about (see the counts in the S4-09 report) falls back to its category.
export const PLACE_RES = {
  row: /bathhouse|bath house|fordyce|quapaw|buckstaff|maurice|superior|ozark|lamar|hale bath|display spring/i,
  bridge: /bridge street|parade|malco|malvern|reserve street/i,
  central: /arlington|central avenue|ohio club|southern club|medical arts/i,
  oaklawn: /oaklawn|racing|derby|thoroughbred|jockey|racetrack|grandstand|paddock/i,
  lakes: /lake (ouachita|hamilton|catherine)|garvan|dam|fishing|bass/i,
  ballfields: /whittington|ballpark|spring training|baseball|majestic park|fogel|ban johnson/i,
  hollow: /happy hollow|mcleod|goat rock|north mountain/i,
  park: /park avenue|motor court|motel|velda rose|tourist court|mountainaire/i,
};
export const isAbout = (q, place) => !!PLACE_RES[place] && PLACE_RES[place].test(q.question);

// S4-10: a question that names a 2020s year or a dollar price will be wrong within a year or two. The Daily Challenge, which every player sees, leaves these out.
export const isDated = (q) => /\b202\d\b|\$\d/.test([q.question, q.answer, ...q.wrong, q.explanation].join(' '));

// Difficulty weights from a player's skill s in [0,1] (MECHANICS §5).
export function diffWeights(s) {
  return { easy: (1 - s) * (1 - s), medium: 2 * s * (1 - s) + 0.1, hard: s * s };
}

export function updateSkill(s, diff, correct) {
  const w = DIFF_WEIGHT[diff] || 1;
  // Hard misses cost less than easy misses; hard hits gain more.
  s = correct ? s + 0.12 * (1 - s) * w : s - 0.12 * s * (2.4 - w);
  return clamp(s, 0.05, 0.95);
}

// Pick a question. `asked` is the session's used-id array (mutated). Filters: category, eras[],
// difficulty (forced) or skill (adaptive). Never repeats until the filtered pool is exhausted.
export function pickQuestion(rng, asked, { category, eras, difficulty, skill = 0.35, pool, place } = {}) {
  const base = pool || BANK.filter((q) => (!category || q.category === category) && (!eras || eras.includes(q.era)));
  if (!base.length) return null;
  const used = new Set(asked);
  let fresh = base.filter((q) => !used.has(q.id));
  if (!fresh.length) {
    // Pool exhausted: forget this pool's ids only.
    const ids = new Set(base.map((q) => q.id));
    for (let i = asked.length - 1; i >= 0; i--) if (ids.has(asked[i])) asked.splice(i, 1);
    fresh = base.slice();
  }
  if (place) { const about = fresh.filter((q) => isAbout(q, place)); if (about.length) fresh = about; } // a landmark prefers questions about its own place
  const want = difficulty || weightedPick(diffWeights(skill), rng);
  const order = { easy: ['easy', 'medium', 'hard'], medium: ['medium', 'easy', 'hard'], hard: ['hard', 'medium', 'easy'] }[want];
  for (const d of order) {
    const c = fresh.filter((q) => q.difficulty === d);
    if (c.length) { const q = c[rng.int(c.length)]; asked.push(q.id); return q; }
  }
  return null;
}

// Build the on-screen question object (choices shuffled with the seeded RNG).
export function makeQuestion(q, rng, purpose = 'district') {
  const choices = shuffle([q.answer, ...q.wrong.slice(0, 3)], rng);
  return {
    id: q.id, category: q.category, difficulty: q.difficulty, era: q.era, text: q.question,
    choices, correctIndex: choices.indexOf(q.answer), chosen: null, correct: null,
    removed: [], timeLeft: 0, timeMax: 0, purpose,
    explanation: q.explanation, source: q.source, sourceUrl: q.sourceUrl, confidence: q.confidence,
  };
}

// Timeline helpers (Time Warp and Postcards).
export const EVENTS = TIMELINE.events;
// P-N05: the events a Time Warp offers come from one era or two neighbouring ones, so the order is a real puzzle and not a guess at which era is oldest.
// ORDER_MIN_GAP: no two events offered together are closer than this many years, so the repo's own dates always settle one right order; no two read the same.
// (Before: one event from each of three different eras, so a median 33 years between the nearest two, and only distinct years were asked for.)
export const ORDER_MIN_GAP = 5;
export function pickOrdering(rng, n = 3) {
  const eras = ERAS.map((e) => e.id).filter((id) => id !== 'ancient');
  for (let tries = 0; tries < 50; tries++) {
    const i = rng.int(eras.length - 1);
    const pool = shuffle(EVENTS.filter((e) => e.era === eras[i] || e.era === eras[i + 1]), rng);
    const got = [];
    for (const e of pool) { if (got.every((g) => Math.abs(g.y - e.y) >= ORDER_MIN_GAP && g.e !== e.e)) got.push(e); if (got.length === n) return got; }
  }
  return shuffle(EVENTS, rng).slice(0, n);
}
export const pickPostcard = (rng) => EVENTS[rng.int(EVENTS.length)];
