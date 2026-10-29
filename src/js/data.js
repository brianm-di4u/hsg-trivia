// Question bank index, categories, eras and the adaptive picker.
// QUESTIONS and TIMELINE are global consts inlined by the build (see src/index.html).
import { shuffle, weightedPick, clamp } from './util.js';

/* global QUESTIONS, TIMELINE */

// Category colors are a game-derived Okabe–Ito based set (colorblind-aware); every use is paired
// with an icon and a text label, so color is never the only cue. `ink` is the icon/text color on the fill.
export const CATS = [
  { id: 'Places & Landmarks', short: 'Landmarks', icon: 'dome', color: '#0072B2', ink: '#FFFFFF' },
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
export const ERA_MODES = [
  { id: 'frontier', label: 'Ancient & Frontier', eras: ['ancient', 'frontier'] },
  { id: 'gilded-spa', label: 'Gilded Spa', eras: ['gilded-spa'] },
  { id: 'roaring', label: 'Roaring Spa Town', eras: ['roaring'] },
  { id: 'midcentury', label: 'Midcentury Vapors', eras: ['midcentury'] },
  { id: 'revival', label: 'Revival Years', eras: ['revival'] },
  { id: 'modern', label: 'Modern Spa City', eras: ['modern'] },
];
export const eraCount = (mode) => BANK.filter((q) => mode.eras.includes(q.era)).length;

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
export function pickQuestion(rng, asked, { category, eras, difficulty, skill = 0.35, pool } = {}) {
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
export function pickOrdering(rng, n = 3) {
  for (let tries = 0; tries < 50; tries++) {
    const eras = shuffle(ERAS.map((e) => e.id).filter((id) => id !== 'ancient'), rng).slice(0, n);
    const evs = eras.map((era) => { const list = EVENTS.filter((e) => e.era === era); return list[rng.int(list.length)]; });
    if (evs.every(Boolean) && new Set(evs.map((e) => e.y)).size === n) return shuffle(evs, rng);
  }
  return shuffle(EVENTS, rng).slice(0, n);
}
export const pickPostcard = (rng) => EVENTS[rng.int(EVENTS.length)];
