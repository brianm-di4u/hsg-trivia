// Trail Game rules engine + AI (MECHANICS §4, §6). All state lives in G.state (serializable);
// static board data lives in board.js. UI and renderer read the state and call these actions.
import { makeRng, clamp } from './util.js';
import { CATS, CAT, pickQuestion, makeQuestion, updateSkill, pickOrdering, pickPostcard, getQ, ERA } from './data.js';
import { NODES, START, TOWER, TRAILHEAD, TROLLEYS, LANDMARK, DISTRICTS, DISTRICT, reachable, ventPartner, hops } from './board.js';
import { TOKEN_SHAPES, TOKEN_COLORS } from './art.js';
import { sfx } from './audio.js';
import { AI_LINES } from './voices.js';

export const G = {
  state: null,
  rng: makeRng(1),
  hooks: { update() {}, announce() {}, dailyStart() {}, moveToken() {}, effect() {}, save() {}, seen() {}, scene() {}, finish() {}, record() { return null; }, say() {} },
  say: null, // the last thing a named opponent said: { pid, text, event }, for the question card
  voiceN: {}, // how many lines each character has spoken per event, so a character walks through their lines
  lastRecord: null, // what the Trail record made of the trip that just ended (earned achievements, personal bests), for the win card
  timers: [],
  paused: false, // set while the tab is hidden or the pause menu is open: no AI or auto-advance timer is armed
};

export const AI_NAMES = { easy: 'Doc Vapor', medium: 'Miss Promenade', hard: 'The Professor' };
export { AI_LINES }; // what each of the six names says, by event: see voices.js
const AI_EXTRA = ['Ticket Taker', 'Trail Boss', 'Lady Tufa'];
const AI_POOL = [AI_NAMES.easy, AI_NAMES.medium, AI_NAMES.hard, ...AI_EXTRA]; // six names for up to six AI seats

// Default name for every seat, never repeating: humans are "Traveler N"; each AI seat takes its level's
// name if still free, else the next unused name in AI_POOL. Names a player typed are reserved first.
export function defaultNames(seats) {
  const used = new Set(seats.map((s) => (s.name || '').trim()).filter(Boolean));
  return seats.map((s, i) => {
    if (s.kind !== 'ai') { const n = `Traveler ${i + 1}`; used.add(n); return n; }
    const n = [AI_NAMES[s.level || 'medium'], ...AI_POOL].find((x) => !used.has(x)) || `Traveler ${i + 1}`;
    used.add(n); return n;
  });
}
// Chance a computer traveler answers right, by level and question difficulty. S3-09 pulled the tiers together so each level beats the one below it about 65 to 35
// (before: Easy 0.6/0.4/0.25, Hard 0.92/0.8/0.65; Medium is unchanged). Easy also moves at random less often: ECON.AI_EASY_RANDOM_MOVE.
export const AI_ACC = { easy: { easy: 0.72, medium: 0.52, hard: 0.32 }, medium: { easy: 0.8, medium: 0.6, hard: 0.4 }, hard: { easy: 0.82, medium: 0.63, hard: 0.43 } };
// ---------- Ticket economy: every number to retune lives here (S3-02) ----------
export const ECON = {
  START_TICKETS: 3,
  DISTRICT_PAY: { easy: 1, medium: 2, hard: 3 }, // tickets for a right answer on a district space
  LANDMARK_PAY: 2, // tickets for a right answer on a landmark, on top of the stamp
  REROLL_COSTS: [1, 2, 3, 4], // was a flat 1. The n-th re-roll of a trip costs REROLL_COSTS[n]; the last price repeats.
  LIFELINE_COST: 2, // the 50/50 on any question (unchanged)
  SUMMIT_HINT_COST: 4, // was 2: on the Summit question the same 50/50 is the Summit hint
  EXPRESS_HARD: false, // true makes the Express landmark question always a hard one
  EXPRESS_COST: 6, // new: jump to the nearest landmark that has no stamp yet, then answer its question
  TROLLEY_COST: 2, // unchanged
  WAGER_BASE_CAP: 5, WAGER_MAX_CAP: 10, WAGER_HOARD_SHARE: 0.25, // was a flat cap of 5: now the larger of 5 and 25% of the hoard, up to 10
  SUMMIT_REDRAWS: 1, // S3-07: how many times a human may spin the Summit vane again for another category (0 turns the button off)
  FINAL_LAP_EXPRESS: 3, // S3-03: when the first traveler holds every stamp, the bell rings and each of the others may ride this many free Expresses (0 turns the Final Lap off; before wave 3 there was none)
  AI_EASY_RANDOM_MOVE: 0.1, // how often an Easy computer picks its destination at random instead of the best-scored one (S3-09: was 0.6)
  AI_REROLL_KEEP: 3, // a Hard AI re-rolls only if it keeps this many tickets after paying (was: tickets >= 4 at a price of 1)
  AI_EXPRESS_CHANCE: { easy: 0, medium: 0, hard: 1 }, // how readily each level buys an Express ticket when it can (only The Professor does)
  AI_HINT_SCOPE: { easy: 'any', medium: 'any', hard: 'landmark-hard' }, // which questions each level pays to 50/50: any, or only hard landmark questions (the Summit question always)
  AI_HINT_KEEP: { easy: 4, medium: 4, hard: 0 }, // tickets an AI keeps after buying a 50/50 or Summit hint
  AI_PERSONA_SWING: 0.1, // S3-04: a named computer traveler is this much more likely to answer right in its strong categories and as much less in its weak ones (0 turns the personalities off; before wave 3 there were none)
  AI_PERSONA_STEER: 6, // S3-04: and its destination score gets this much for an ordinary space of a strong category (0 for none)
};
// S2-14: how hard the questions of a trip run. A player's hidden skill (0.35 to start, up with right answers, down with misses) picks the mix of
// easy, medium and hard; this scales it: Relaxed halves it, Adaptive is the skill itself (what every trip was before), Expert lifts it to between 0.5 and 1.
export const QDIFF = { relaxed: { mul: 0.5, add: 0, label: 'Relaxed' }, adaptive: { mul: 1, add: 0, label: 'Adaptive' }, expert: { mul: 0.5, add: 0.5, label: 'Expert' } };
export const qdiffOf = (t = T()) => (t && QDIFF[t.qdiff] ? t.qdiff : 'adaptive'); // a trip saved before the setting existed is Adaptive
export const questionSkill = (p, t = T()) => { const m = QDIFF[qdiffOf(t)]; return clamp(p.skill * m.mul + m.add, 0, 1); };
// S3-04: what each named computer traveler is good and bad at. The same number of strong and weak categories each, so a level's accuracy over the whole bank is what it was;
// The Professor is even across the board. Keyed by the seat's default name; a seat keeps its persona if the player types another name over it.
export const AI_PERSONAS = {
  'Doc Vapor': { up: ['Sports', 'Nature & Lakes'], down: ['Legends & Oddities', 'Entertainment'] },
  'Miss Promenade': { up: ['History', 'Places & Landmarks'], down: ['Sports', 'Nature & Lakes'] },
  'The Professor': { up: [], down: [] },
  'Ticket Taker': { up: ['Entertainment', 'Food & Culture'], down: ['Sports', 'Places & Landmarks'] },
  'Trail Boss': { up: ['Nature & Lakes', 'Places & Landmarks'], down: ['Entertainment', 'Food & Culture'] },
  'Lady Tufa': { up: ['Legends & Oddities', 'People'], down: ['History', 'Sports'] },
};
// The shift to a persona's chance of a right answer in a category, and the one line that says it (shown on the setup row and in the traveler list).
export const personaShift = (p, cat) => { const ps = p && AI_PERSONAS[p.persona]; return ps && ECON.AI_PERSONA_SWING ? (ps.up.includes(cat) ? ECON.AI_PERSONA_SWING : 0) - (ps.down.includes(cat) ? ECON.AI_PERSONA_SWING : 0) : 0; };
export const personaTrait = (persona) => { const ps = AI_PERSONAS[persona]; if (!ps) return ''; if (!ps.up.length) return 'Even across every category.'; const s = (l) => l.map((c) => CAT[c].short).join(', '); return `Sharp on ${s(ps.up)}. Shaky on ${s(ps.down)}.`; };
const aiChance = (p, diff, cat) => clamp(AI_ACC[p.level][diff] + personaShift(p, cat), 0.05, 0.97);
// ---------- AI pace (S1-03): how long each AI beat lasts ----------
// A wait is scaled by factor, then capped; hop scales the AI token's walk. 'brisk' is the default for a new player.
export const AI_PACE = {
  normal: { factor: 1, cap: Infinity, hop: 1 }, // the old default, labelled Relaxed (about 7 s a turn)
  brisk: { factor: 0.55, cap: Infinity, hop: 0.6 },
  fast: { factor: 1, cap: 220, hop: 0.35 },
};
export const DEFAULT_AI_SPEED = 'brisk';
// S3-11: roughly how long a trip takes. Median rounds are from tools/econ-sim.mjs (Medium travelers, 80 games a row, seeds 1000 and up; index = travelers - 1).
export const TRIP_ROUNDS = { 4: [28, 23, 20, 20, 19, 18], 6: [41, 36, 34, 33, 31, 29], 8: [58, 50, 45, 43, 42, 42] };
const LEVEL_ROUNDS = { easy: 1.2, medium: 1, hard: 0.8 }; // a table of Easy computers took 43 rounds where Medium took 36, Hard 28 to 29
const TURN_SECONDS = { human: 20, normal: 6.6, brisk: 3.7, fast: 1.5 }; // computer turns are measured (PACE=... tools/econ-sim.mjs); a human turn (roll, choose, answer, read) is a plain guess
// Minutes for a trip: the seats are { kind, level }, the target is 4, 6 or 8.
export function tripMinutes(seats, target, aiSpeed = DEFAULT_AI_SPEED) {
  const n = Math.max(1, Math.min(6, seats.length)); const row = TRIP_ROUNDS[target] || TRIP_ROUNDS[6];
  const levels = seats.filter((s) => s.kind === 'ai').map((s) => LEVEL_ROUNDS[s.level] || 1);
  const rounds = row[n - 1] * (levels.length ? (levels.reduce((a, b) => a + b, 0) + (n - levels.length)) / n : 1);
  const secs = seats.reduce((a, s) => a + (s.kind === 'ai' ? TURN_SECONDS[aiSpeed] || TURN_SECONDS.brisk : TURN_SECONDS.human), 0);
  return (rounds * secs) / 60;
}
export const TARGETS = [{ n: 4, label: 'Day Trip' }, { n: 6, label: 'Weekend' }, { n: 8, label: 'Grand Tour' }];

export const T = () => G.state.trail;
export const cur = () => T().players[T().turn];
// extra: a second log line (a character's quip), read out together with msg so the live region does not drop either.
const log = (msg, extra) => { const t = T(); t.log.unshift(msg); if (extra) t.log.unshift(extra); if (t.log.length > 30) t.log.length = 30; G.hooks.announce(extra ? msg + ' ' + extra : msg); };

// ---------- opponent voices (S4-01) ----------
const VOICE_GAP = 2; // a hard-question or miss quip is spoken at most once every this many rounds per character, so they do not talk over every turn
// A named opponent speaks: returns the log line (or null) and puts a speech bubble over the pawn. Never uses the dice, so a seeded game is unchanged.
function speak(p, event) {
  const set = p.kind === 'ai' && AI_LINES[p.name]; const lines = set && set[event]; if (!lines) return null;
  if ((event === 'hard' || event === 'miss') && p.spoke !== undefined && T().round - p.spoke < VOICE_GAP) return null;
  const k = p.name + ':' + event; const n = G.voiceN[k] | 0; G.voiceN[k] = n + 1;
  const text = lines[n % lines.length]; p.spoke = T().round;
  G.say = { pid: p.id, text, event }; G.hooks.say(p, text);
  return `${p.name}: “${text}”`;
}
// When the trip ends every computer traveler has a last word, for the win card.
function closing(t) {
  const out = [];
  for (const p of t.players) {
    const set = p.kind === 'ai' && AI_LINES[p.name]; if (!set) continue;
    const event = p.id === t.winner ? 'win' : 'lose'; const k = p.name + ':' + event; const n = G.voiceN[k] | 0; G.voiceN[k] = n + 1;
    out.push({ id: p.id, name: p.name, event, text: set[event][n % set[event].length] });
  }
  return out;
}
const eligible = (p) => p.stamps.length >= T().target;
export const isAI = (p = cur()) => p.kind === 'ai';
// The Trail record only counts what a human seat does (a computer traveler earns nothing for the player).
const record = (p, intent) => (p.kind === 'human' ? G.hooks.record({ kind: 'event', ...intent }) : null);

let beats = []; // the timers `later` has armed with what they will run, so skipBeat can run one early
function clearTimers() { for (const id of G.timers) clearTimeout(id); G.timers = []; beats = []; }
function later(ms, fn) {
  if (G.paused) return;
  const b = { at: Date.now() + ms, fn };
  b.id = setTimeout(() => { G.timers = G.timers.filter((x) => x !== b.id); beats = beats.filter((x) => x !== b); fn(); }, ms);
  G.timers.push(b.id); beats.push(b);
}
const pace = () => AI_PACE[G.state.settings.aiSpeed] || AI_PACE[DEFAULT_AI_SPEED];
const aiDelay = (base) => Math.min(pace().cap, Math.round(base * pace().factor));
export const hopScale = () => pace().hop;
// Run the next waiting AI or auto-advance beat now (a key or a tap while an AI plays); during a walk, finish the walk.
export function skipBeat() {
  const t = G.state && G.state.trail;
  if (G.paused || !t || G.state.mode !== 'trail' || G.state.scene !== 'game' || !isAI()) return false;
  if (t.phase === 'moving') { G.hooks.finish(); return true; }
  const b = beats.slice().sort((x, y) => x.at - y.at)[0];
  if (!b) return false;
  clearTimeout(b.id); G.timers = G.timers.filter((x) => x !== b.id); beats = beats.filter((x) => x !== b);
  b.fn();
  return true;
}
// Phases that end the turn by themselves after a short pause, with that pause in ms.
const HUMAN_WAIT = 700; // how long a human sees a stuck roll or a sit-out turn before it ends by itself (was 1200); Continue ends it at once
const AUTO_END = { landed: () => (isAI() ? aiDelay(500) : 450), stuck: () => (isAI() ? 1200 : HUMAN_WAIT), skipped: () => (isAI() ? aiDelay(900) : HUMAN_WAIT) };
function armAutoEnd(t) { const ph = t.phase; later(AUTO_END[ph](), () => { if (T() === t && t.phase === ph) endTurn(); }); }

// ---------- setup ----------
export function newTrail({ players, target = 6, qdiff = 'adaptive' }) {
  clearTimers();
  const seats = (players && players.length ? players : [{ kind: 'human' }, { kind: 'ai', level: 'medium' }]).slice(0, 6);
  const defaults = defaultNames(seats);
  G.state.trail = {
    target, qdiff: QDIFF[qdiff] ? qdiff : 'adaptive', round: 1, turn: 0, phase: 'roll', roll: null, rerolled: false, dests: [], sel: 0,
    players: seats.map((s, i) => {
      const name = (s.name || '').trim() || defaults[i];
      return { id: i, name, persona: s.kind === 'ai' ? defaults[i] : undefined, kind: s.kind === 'ai' ? 'ai' : 'human', level: s.level || 'medium', shape: TOKEN_SHAPES[i], color: TOKEN_COLORS[i],
        node: START, stamps: [], tickets: ECON.START_TICKETS, rerolls: 0, skill: 0.35, skip: false, correct: 0, answered: 0, catStats: {}, streak: 0 };
    }),
    pending: null, log: [], winner: null, lastTurnAt: Date.now(),
  };
  G.state.question = null; G.lastRecord = null; G.say = null; G.voiceN = {};
  G.state.mode = 'trail';
  log(`A new trip begins. Collect ${target} stamps, then climb to the Mountain Tower.`);
  G.hooks.save();
  beginTurn();
}

function humans() { return T().players.filter((p) => p.kind === 'human').length; }

export function beginTurn() {
  const t = T(); const p = cur();
  t.roll = null; t.rerolled = false; t.dests = []; t.sel = 0; t.pending = null; G.state.question = null;
  if (p.skip) {
    p.skip = false; log(`${p.name} sits out this turn (Grand Jury).`); t.phase = 'skipped';
    G.hooks.update();
    armAutoEnd(t);
    return;
  }
  t.phase = p.kind === 'human' && humans() >= 2 && G.state.settings.passScreen ? 'pass' : 'roll';
  G.hooks.update();
  aiMaybe();
}

export function pass() { if (T().phase === 'pass') { T().phase = 'roll'; G.hooks.update(); } }

// ---------- roll and move ----------
export function roll(force) {
  const t = T(); if (t.phase !== 'roll') return false;
  const p = cur();
  t.roll = force ? clamp(force | 0, 1, 6) : 1 + G.rng.int(6);
  sfx('gauge', { n: t.roll });
  t.dests = reachable(p.node, t.roll, eligible(p)).map((d) => ({ node: d.node, path: d.path }));
  // A computer traveler's list is ordered best first (it takes the first). A human's is ordered across the board, left to right, so that nothing in the
  // order or in the preselected first row hints at the best move, and the arrow keys move across the map the way they read (S2-03).
  if (p.kind === 'ai') t.dests.sort((a, b) => scoreDest(p, b.node) - scoreDest(p, a.node) || a.node - b.node);
  else t.dests.sort((a, b) => NODES[a.node].x - NODES[b.node].x || NODES[a.node].y - NODES[b.node].y || a.node - b.node);
  t.sel = 0;
  log(`${p.name} rolled a ${t.roll}.`);
  if (!t.dests.length) {
    t.phase = 'stuck'; log(`No space is exactly ${t.roll} steps away. ${p.name} waits in the steam.`);
    G.hooks.update(); armAutoEnd(t);
    return true;
  }
  t.phase = 'choose';
  G.hooks.update(); aiMaybe();
  return true;
}

// The n-th re-roll of a trip costs REROLL_COSTS[n] (the last price repeats); one re-roll per turn.
export const rerollCost = (p = cur()) => ECON.REROLL_COSTS[Math.min(p.rerolls | 0, ECON.REROLL_COSTS.length - 1)];
export function reroll() {
  const t = T(); const p = cur(); const cost = rerollCost(p);
  if (t.phase !== 'choose' || t.rerolled || p.tickets < cost) return false;
  p.tickets -= cost; p.rerolls = (p.rerolls | 0) + 1; t.rerolled = true; t.phase = 'roll'; sfx('coin');
  log(`${p.name} spends ${cost === 1 ? 'a ticket' : cost + ' tickets'} to re-roll.`);
  return roll();
}

export function choose(arg) {
  const t = T(); if (t.phase !== 'choose') return false;
  // arg: a destination node id, or undefined for the currently selected destination.
  const d = arg === undefined ? t.dests[t.sel] : t.dests.find((x) => x.node === arg);
  if (!d) return false;
  const p = cur();
  t.phase = 'moving';
  G.hooks.update();
  G.hooks.moveToken(p, d.path, () => { p.node = d.node; resolve(); });
  return true;
}

export function selectDest(delta) { const t = T(); if (t.phase !== 'choose' || !t.dests.length) return; t.sel = (t.sel + delta + t.dests.length) % t.dests.length; sfx('click'); G.hooks.update(); }

// ---------- resolve the landed space ----------
function resolve() {
  const t = T(); const p = cur(); const n = NODES[p.node];
  switch (n.type) {
    case 'cat': return ask(n.cat, 'district');
    case 'landmark': return ask(n.cat, 'landmark');
    case 'vent': t.pending = { kind: 'vent', to: ventPartner(p.node) }; t.phase = 'vent'; sfx('steam'); break;
    case 'wager': t.pending = { kind: 'wager' }; t.phase = 'wager'; sfx('bugle'); break;
    case 'warp': t.pending = { kind: 'order', events: pickOrdering(G.rng), picks: [] }; t.phase = 'order'; sfx('warp'); break;
    case 'postcard': {
      const ev = pickPostcard(G.rng); p.tickets += 1; sfx('page');
      t.pending = { kind: 'postcard', ev }; t.phase = 'postcard'; log(`${p.name} found a postcard: ${ev.y} — ${ev.e}. +1 ticket.`); break;
    }
    case 'jury': t.pending = { kind: 'jury' }; t.phase = 'jury'; sfx('gavel'); break;
    case 'tower': t.pending = { kind: 'summit', cat: CATS[G.rng.int(CATS.length)].id }; t.phase = 'summit'; sfx('bell'); log(`${p.name} reached the Mountain Tower! Summit question time.`); record(p, { ev: 'summit' }); break;
    default:
      t.phase = 'landed'; G.hooks.update();
      armAutoEnd(t);
      return;
  }
  G.hooks.update(); aiMaybe();
}

function ask(category, purpose, extra = {}) {
  const t = T(); const p = cur();
  const forceDiff = purpose === 'summit' || (purpose === 'expressLandmark' && ECON.EXPRESS_HARD) ? 'hard' : undefined;
  const landmark = ['landmark', 'warpLandmark', 'expressLandmark'].includes(purpose) ? DISTRICTS.find((x) => x.cat === category) : null;
  const q = pickQuestion(G.rng, G.state.asked, { category, skill: questionSkill(p), difficulty: forceDiff, place: landmark && landmark.key });
  G.hooks.seen();
  G.state.question = makeQuestion(q, G.rng, purpose);
  Object.assign(G.state.question, { hadStamp: p.stamps.includes(category) }, extra);
  const tm = p.kind === 'human' ? G.state.settings.timer : 0;
  G.state.question.timeMax = tm; G.state.question.timeLeft = tm;
  t.phase = 'question';
  if (p.kind === 'human') G.hooks.save({ inQuestion: true }); // a reload brings back this very question
  G.hooks.update(); aiMaybe();
}

export function startPendingQuestion() {
  const t = T(); const pd = t.pending; if (!pd) return;
  if (t.phase === 'jury') return ask('Legends & Oddities', 'jury');
  if (t.phase === 'summit') return ask(pd.cat, 'summit');
}

// S3-07: at the Tower a human may spin the vane once more; the new category is never the one just drawn.
export const canRedraw = (p = cur()) => { const t = T(); return t.phase === 'summit' && p.kind === 'human' && (t.pending.redraws | 0) < ECON.SUMMIT_REDRAWS; };
export function summitRedraw() {
  const t = T(); const p = cur(); if (!canRedraw(p)) return false;
  const others = CATS.filter((c) => c.id !== t.pending.cat);
  t.pending.cat = others[G.rng.int(others.length)].id; t.pending.redraws = (t.pending.redraws | 0) + 1;
  log(`${p.name} spins the vane again: ${t.pending.cat}.`); sfx('click'); G.hooks.update();
  return true;
}

// The most a traveler may wager: 5, or a quarter of the hoard when that is more, never above 10 or what they hold.
export const wagerCap = (p = cur()) => Math.min(p.tickets, Math.max(ECON.WAGER_BASE_CAP, Math.min(ECON.WAGER_MAX_CAP, Math.floor(p.tickets * ECON.WAGER_HOARD_SHARE))));
export function setWager(n) {
  const t = T(); const p = cur(); if (t.phase !== 'wager') return false;
  const w = clamp(n | 0, 0, wagerCap(p));
  t.pending.wager = w; log(`${p.name} wagers ${w} ticket${w === 1 ? '' : 's'} at Post Time.`);
  ask(CATS[G.rng.int(CATS.length)].id, 'wager', { wager: w });
  return true;
}

// The 50/50 costs 2 tickets; on the Summit question it is the Summit hint, 4 tickets.
export const lifelineCost = (q = G.state.question) => (q && q.purpose === 'summit' ? ECON.SUMMIT_HINT_COST : ECON.LIFELINE_COST);
export function lifeline() {
  const q = G.state.question; const p = cur();
  if (!q || q.chosen !== null || q.removed.length || p.tickets < lifelineCost(q) || G.state.mode !== 'trail') return false;
  const cost = lifelineCost(q); const hint = q.purpose === 'summit';
  p.tickets -= cost; sfx('coin');
  const wrongs = [0, 1, 2, 3].filter((i) => i !== q.correctIndex);
  const keep = wrongs[G.rng.int(3)];
  q.removed = wrongs.filter((i) => i !== keep);
  log(`${p.name} uses the ${hint ? 'Summit hint' : '50/50'} (${cost} tickets).`);
  G.hooks.update();
  return true;
}

// ---------- answering ----------
export function answer(choice) {
  const q = G.state.question; if (!q || q.chosen !== null) return false;
  let i = choice;
  if (choice === 'correct') i = q.correctIndex;
  else if (choice === 'wrong') i = [0, 1, 2, 3].find((k) => k !== q.correctIndex && !q.removed.includes(k));
  else if (choice === 'timeout') i = -1;
  if (i !== -1 && (i < 0 || i > 3 || q.removed.includes(i))) return false;
  q.chosen = i; q.correct = i === q.correctIndex;
  // a run of right answers climbs: the cue is told how many in a row this one makes
  const run = (G.state.mode === 'trail' ? cur().streak : (G.state.quiz && G.state.quiz.streak) || 0) + 1;
  // A right answer rings higher for a harder question; a run reaching 3 or 5 adds a chime to it (for a person, not a computer traveler).
  const person = G.state.mode !== 'trail' || cur().kind === 'human';
  sfx(q.correct ? 'correct' : i === -1 ? 'timeout' : 'wrong', { streak: run, tier: ['easy', 'medium', 'hard'].indexOf(q.difficulty) });
  if (q.correct && person && (run === 3 || run === 5)) sfx('streak', { n: run, at: 0.3 });
  if (G.state.mode !== 'trail') return true; // quiz modes settle in quiz.js
  const t = T(); const p = cur();
  p.answered++; if (q.correct) { p.correct++; p.streak++; p.bestStreak = Math.max(p.bestStreak | 0, p.streak); if (p.streak === 5 || p.streak === 10) record(p, { ev: 'streak', n: p.streak }); } else p.streak = 0;
  const cs = p.catStats[q.category] || (p.catStats[q.category] = [0, 0]); cs[1]++; if (q.correct) cs[0]++;
  p.skill = updateSkill(p.skill, q.difficulty, q.correct);
  const out = [], ticketsBefore = p.tickets;
  const pay = ECON.DISTRICT_PAY[q.difficulty];
  switch (q.purpose) {
    case 'district':
      if (q.correct) { p.tickets += pay; out.push(`+${pay} ticket${pay > 1 ? 's' : ''}`); }
      break;
    case 'landmark': case 'warpLandmark': case 'expressLandmark': {
      const cat = q.landmarkCat || NODES[p.node].cat;
      if (q.correct) {
        p.tickets += ECON.LANDMARK_PAY;
        if (!p.stamps.includes(cat)) { p.stamps.push(cat); out.push(`Stamp earned: ${DISTRICTS.find((d) => d.cat === cat).stamp}!`); const bell = finalLap(p); if (bell) out.push(bell); G.hooks.effect('stamp', p); record(p, { ev: 'stamp', count: p.stamps.length, d: DISTRICTS.find((d) => d.cat === cat).key }); }
        out.push(`+${ECON.LANDMARK_PAY} tickets`);
      }
      break;
    }
    case 'wager': {
      const w = q.wager || 0;
      if (q.correct) { const win = q.difficulty === 'hard' ? w * 2 : w; p.tickets += win; out.push(w ? `Won ${win} ticket${win === 1 ? '' : 's'}` : 'No wager, no loss'); if (w) record(p, { ev: 'wager', won: win }); }
      else { p.tickets -= w; out.push(w ? `Lost ${w} ticket${w === 1 ? '' : 's'}` : 'No wager, no loss'); }
      break;
    }
    case 'jury':
      if (!q.correct) { p.skip = true; out.push('Sit out your next turn'); } else out.push('Case dismissed!');
      break;
    case 'summit':
      if (q.correct) { t.winner = p.id; out.push('You conquered the Mountain Tower!'); }
      else { p.tickets = Math.max(0, p.tickets - 1); out.push('Back down to the Grand Promenade trailhead (−1 ticket)'); }
      break;
    default:
  }
  if (q.correct && out.length === 0) out.push('Well done');
  if (q.correct && person && p.tickets > ticketsBefore) sfx('coin', { at: 0.34, k: 2 ** ((Math.min(4, p.tickets - ticketsBefore) - 1) * 2 / 12) }); // tickets earned: a coin after the answer, higher for more
  q.outcome = out;
  const ev = p.kind !== 'ai' ? null : out.some((o) => o.startsWith('Stamp earned')) ? 'stamp' : q.purpose === 'summit' ? (q.correct ? null : 'summitMiss') : q.correct ? (q.difficulty === 'hard' ? 'hard' : null) : 'miss';
  if (!q.correct) G.hooks.effect('miss', p, q.purpose);
  log(`${p.name} ${q.correct ? 'answered correctly' : i === -1 ? 'ran out of time' : 'missed'} (${q.category}). ${out.join(' · ')}`, ev && speak(p, ev));
  t.phase = 'feedback';
  if (!(q.purpose === 'summit' && q.correct)) G.hooks.save({ afterAnswer: true }); // a reload cannot undo this answer
  G.hooks.update(); aiMaybe();
  return true;
}

// Continue from feedback / postcard / order result etc.
export function proceed() {
  const t = T(); const p = cur(); const q = G.state.question;
  if (t.phase === 'feedback') {
    if (q && q.purpose === 'summit') {
      if (q.correct) { t.phase = 'over'; G.state.question = null; t.final = closing(t); G.lastRecord = finishRecord(t); G.hooks.effect('win', p); sfx('win'); G.hooks.save(); G.hooks.scene('win'); G.hooks.update(); return; }
      G.state.question = null; t.phase = 'moving'; G.hooks.update();
      G.hooks.moveToken(p, [p.node, TRAILHEAD], () => { p.node = TRAILHEAD; endTurn(); }, 'jump');
      return;
    }
    G.state.question = null; return endTurn();
  }
  if (t.phase === 'postcard') return endTurn();
  if (t.phase === 'stuck' || t.phase === 'skipped') { clearTimers(); return endTurn(); } // Continue: the wait for the next turn is cut short
  if (t.phase === 'orderResult') {
    if (t.pending.ok) {
      t.pending = { kind: 'warp', options: warpOptions(p) }; t.phase = 'warp'; G.hooks.update(); aiMaybe(); return;
    }
    return endTurn();
  }
  if (t.phase === 'jury' || t.phase === 'summit') return startPendingQuestion();
  return false;
}

// ---------- special spaces ----------
export function vent(ride) {
  const t = T(); const p = cur(); if (t.phase !== 'vent') return false;
  if (!ride) { log(`${p.name} stays put by the vent.`); return endTurn(); }
  const to = t.pending.to; sfx('steam');
  log(`${p.name} rides the steam to ${NODES[to].name} in ${DISTRICT[NODES[to].district].name}.`);
  t.phase = 'moving'; G.hooks.update();
  G.hooks.effect('steam', p);
  G.hooks.moveToken(p, [p.node, to], () => { p.node = to; endTurn(); }, 'jump');
  return true;
}

export function orderPick(idx) {
  const t = T(); if (t.phase !== 'order') return false;
  const pd = t.pending; if (pd.picks.includes(idx) || idx < 0 || idx > 2) return false;
  pd.picks.push(idx); sfx('click');
  if (pd.picks.length === 3) finishOrder(pd.picks);
  else G.hooks.update();
  return true;
}
export function order(arr) {
  const t = T(); if (t.phase !== 'order') return false;
  t.pending.picks = arr.slice(0, 3); finishOrder(t.pending.picks); return true;
}
function finishOrder(picks) {
  const t = T(); const p = cur(); const evs = t.pending.events;
  const ok = picks.every((ix, k) => k === 0 || evs[picks[k - 1]].y < evs[ix].y);
  t.pending.ok = ok; t.phase = 'orderResult';
  sfx(ok ? 'correct' : 'wrong', { streak: 1 });
  if (ok) record(p, { ev: 'warp' });
  log(ok ? `${p.name} put history in order — time warp!` : `${p.name} scrambled the timeline.`);
  G.hooks.update(); aiMaybe();
}
function warpOptions(p) {
  const opts = DISTRICTS.filter((d) => !p.stamps.includes(d.cat)).map((d) => LANDMARK[d.cat]);
  return opts.length ? opts : [TRAILHEAD];
}
export function warp(nodeId) {
  const t = T(); const p = cur(); if (t.phase !== 'warp') return false;
  const opts = t.pending.options; const to = opts.includes(nodeId) ? nodeId : opts[0];
  t.phase = 'moving'; G.hooks.update(); sfx('warp');
  log(`${p.name} warps to ${NODES[to].name}.`);
  G.hooks.moveToken(p, [p.node, to], () => {
    p.node = to;
    if (NODES[to].type === 'landmark') ask(NODES[to].cat, 'warpLandmark', { landmarkCat: NODES[to].cat });
    else endTurn();
  }, 'jump');
  return true;
}

export function trolleyOptions(p = cur()) { return TROLLEYS.filter((id) => id !== p.node); }
export function canTrolley(p = cur()) { return T().phase === 'roll' && TROLLEYS.includes(p.node) && p.tickets >= ECON.TROLLEY_COST; }
export function trolley(nodeId) {
  const t = T(); const p = cur(); if (!canTrolley(p)) return false;
  const opts = trolleyOptions(p); const to = opts.includes(nodeId) ? nodeId : opts[0];
  p.tickets -= ECON.TROLLEY_COST; sfx('trolley');
  log(`${p.name} rides the trolley to ${NODES[to].name} (${ECON.TROLLEY_COST} tickets).`);
  t.phase = 'moving'; G.hooks.update();
  G.hooks.moveToken(p, [p.node, to], () => { p.node = to; endTurn(); }, 'jump');
  return true;
}

// Express ticket: from the roll, pay to jump to the nearest landmark with no stamp yet and answer its question.
export function expressTarget(p = cur()) {
  const left = DISTRICTS.filter((d) => !p.stamps.includes(d.cat)).map((d) => LANDMARK[d.cat]).filter((id) => id !== p.node);
  if (!left.length) return null;
  return left.reduce((best, id) => (hops(p.node, id) < hops(p.node, best) ? id : best), left[0]);
}
export const expressCost = (p = cur()) => (p.lap > 0 ? 0 : ECON.EXPRESS_COST); // a traveler holding the Final Lap ride pays nothing
export function canExpress(p = cur()) { return T().phase === 'roll' && !eligible(p) && p.tickets >= expressCost(p) && expressTarget(p) !== null; }
// S3-03: the first traveler to hold every stamp rings the Final Lap bell (the answer's own line says so): each of the others may ride a free Express (ECON.FINAL_LAP_EXPRESS of them) to the nearest landmark they have no stamp for.
function finalLap(p) {
  const t = T(); if (!(ECON.FINAL_LAP_EXPRESS > 0) || t.lapBell || !eligible(p)) return '';
  t.lapBell = true; sfx('bell');
  const others = t.players.filter((o) => o !== p && !eligible(o)); others.forEach((o) => { o.lap = ECON.FINAL_LAP_EXPRESS; });
  return `The Final Lap bell rings: everyone else may ride ${ECON.FINAL_LAP_EXPRESS === 1 ? 'one free Express' : ECON.FINAL_LAP_EXPRESS + ' free Expresses'}.`;
}
export function express() {
  const t = T(); const p = cur(); if (!canExpress(p)) return false;
  const to = expressTarget(p);
  const cost = expressCost(p); const free = p.lap > 0; if (free) p.lap--;
  p.tickets -= cost; sfx('coin'); sfx('trolley'); record(p, { ev: 'express' });
  log(free ? `${p.name} rides the free Final Lap Express to ${NODES[to].name}.` : `${p.name} buys an Express ticket (${cost} tickets) to ${NODES[to].name}.`);
  t.phase = 'moving'; G.hooks.update();
  G.hooks.moveToken(p, [p.node, to], () => { p.node = to; ask(NODES[to].cat, 'expressLandmark', { landmarkCat: NODES[to].cat }); }, 'jump');
  return true;
}

// ---------- the Trail record: a finished trip is written once, when the Summit question is won ----------
// A trip counts when a human seat is in it; a win is a human seat winning. Each computer level at the table is a game against that level.
function finishRecord(t) {
  const humans = t.players.filter((x) => x.kind === 'human');
  if (!humans.length) return null;
  const cats = {};
  for (const h of humans) for (const [c, a] of Object.entries(h.catStats || {})) { const r = cats[c] || (cats[c] = [0, 0]); r[0] += a[0]; r[1] += a[1]; }
  return G.hooks.record({ kind: 'trail', won: t.players[t.winner].kind === 'human', target: t.target, rounds: t.round,
    levels: [...new Set(t.players.filter((x) => x.kind === 'ai').map((x) => x.level))], cats, streak: Math.max(...humans.map((h) => Math.max(h.bestStreak | 0, h.streak | 0))) });
}

// ---------- turn end ----------
export function endTurn() {
  const t = T(); if (t.phase === 'over') return;
  G.state.question = null; t.pending = null;
  t.turn = (t.turn + 1) % t.players.length;
  if (t.turn === 0) t.round++;
  if (t.players.length > 1) sfx('turn', { me: t.players[t.turn].kind === 'human' });
  G.hooks.save();
  beginTurn();
}

// ---------- AI ----------
export function scoreDest(p, node) {
  const n = NODES[node];
  const el = eligible(p);
  if (node === TOWER) return el ? 1000 : -5;
  let s = 0;
  if (n.type === 'landmark') s = p.stamps.includes(n.cat) ? 18 : 120;
  else if (n.spur) s = el ? 200 - hops(node, TOWER) * 10 : 0;
  else if (n.type === 'warp') s = p.stamps.length < 8 ? 60 : 10;
  else if (n.type === 'vent') {
    const to = ventPartner(node);
    const best = (from) => Math.min(...DISTRICTS.filter((d) => !p.stamps.includes(d.cat)).map((d) => hops(from, LANDMARK[d.cat])), 99);
    s = best(to) < best(node) ? 45 : 8;
  } else if (n.type === 'wager') s = p.tickets >= 3 ? 25 : 5;
  else if (n.type === 'postcard') s = 20;
  else if (n.type === 'cat') s = 15 + (personaShift(p, n.cat) > 0 ? ECON.AI_PERSONA_STEER : 0);
  else if (n.type === 'jury') s = -40;
  else if (n.type === 'trailhead') s = el ? 150 : 12;
  else s = 5;
  // Prefer ending nearer a missing landmark (or the tower once eligible).
  const goals = el ? [TOWER] : DISTRICTS.filter((d) => !p.stamps.includes(d.cat)).map((d) => LANDMARK[d.cat]);
  if (goals.length) s -= Math.min(...goals.map((gl) => hops(node, gl, el))) * 2;
  return s;
}

function aiChooseIndex(p) {
  const t = T();
  if (p.level === 'easy' && G.rng.next() < ECON.AI_EASY_RANDOM_MOVE) return G.rng.int(t.dests.length);
  return 0; // dests are pre-sorted by score
}

function aiAnswerCorrect(p, diff, mult = 1) { return G.rng.next() < AI_ACC[p.level][diff] * mult; }

export function aiMaybe() {
  const t = T(); if (!t || G.state.mode !== 'trail' || G.state.scene !== 'game') return;
  const p = cur(); if (p.kind !== 'ai') return;
  const ph = t.phase;
  const go = (ms, fn) => later(aiDelay(ms), () => { if (T() === t && t.phase === ph && cur() === p) fn(); });
  switch (ph) {
    case 'roll':
      if (p.lap > 0 && canExpress(p)) return go(800, () => express());
      if (canExpress(p) && p.tickets >= ECON.EXPRESS_COST && G.rng.next() < ECON.AI_EXPRESS_CHANCE[p.level]) return go(800, () => express());
      if (canTrolley(p) && !eligible(p) && p.tickets >= 5 && G.rng.next() < 0.3) return go(800, () => trolley(trolleyOptions(p)[G.rng.int(trolleyOptions(p).length)]));
      return go(800, () => roll());
    case 'choose':
      if (!t.rerolled && p.level === 'hard' && p.tickets >= rerollCost(p) + ECON.AI_REROLL_KEEP && scoreDest(p, t.dests[0].node) < 15) return go(700, () => reroll());
      return go(900, () => { t.sel = aiChooseIndex(p); G.hooks.update(); later(aiDelay(350), () => { if (t.phase === 'choose') choose(); }); });
    case 'question': {
      const q = G.state.question;
      const pickWrong = () => { const w = [0, 1, 2, 3].filter((k) => k !== q.correctIndex && !q.removed.includes(k)); return w[G.rng.int(w.length)]; };
      // With two wrong answers struck out an AI that did not know still has a coin-flip: acc + (1 - acc) / 2.
      const reply = () => { const acc = aiChance(p, q.difficulty, q.category) * (q.purpose === 'summit' ? 0.9 : 1); const a = q.removed.length ? acc + (1 - acc) / 2 : acc; answer(G.rng.next() < a ? q.correctIndex : pickWrong()); };
      // An AI buys the 50/50 (the Summit hint on the Summit question) where its level's scope says so, if it can pay and still keep its reserve.
      const lm = ['landmark', 'warpLandmark', 'expressLandmark'].includes(q.purpose); const hard = q.difficulty === 'hard';
      const wantsHint = !q.removed.length && p.tickets >= lifelineCost(q) + ECON.AI_HINT_KEEP[p.level]
        && (q.purpose === 'summit' || ECON.AI_HINT_SCOPE[p.level] === 'any' || (lm && hard));
      if (wantsHint) return go(700, () => { lifeline(); later(aiDelay(800), () => { if (G.state.question === q && q.chosen === null) reply(); }); });
      return go(1400, reply);
    }
    case 'feedback': return go(2600, () => proceed());
    case 'vent': return go(900, () => vent(scoreDest(p, t.pending.to) >= scoreDest(p, p.node)));
    case 'wager': {
      const cap = { easy: 1, medium: 2, hard: 4 }[p.level];
      const behind = T().players.some((o) => o !== p && o.stamps.length > p.stamps.length);
      return go(900, () => setWager(Math.min(p.tickets, cap + (p.level === 'hard' && behind ? 1 : 0))));
    }
    case 'order': {
      const evs = t.pending.events; const right = [0, 1, 2].sort((a, b) => evs[a].y - evs[b].y);
      const ok = aiAnswerCorrect(p, 'medium');
      return go(1500, () => order(ok ? right : [right[1], right[0], right[2]]));
    }
    case 'orderResult': case 'postcard': return go(1800, () => proceed());
    case 'warp': return go(900, () => warp(t.pending.options[G.rng.int(t.pending.options.length)]));
    case 'jury': case 'summit': return go(1300, () => proceed());
    case 'pass': return go(300, () => pass());
    default:
  }
}

export function stopAI() { clearTimers(); }
// One owner for paused: while paused nothing is armed (see later); leaving it re-arms what the current phase needs.
export function setPaused(on) {
  if (G.paused === on) return;
  G.paused = on;
  if (on) clearTimers(); else resume();
}
// Back on the board after Help or Settings: stopAI cleared every pending timer, so re-arm the one this phase needs.
export function resume() {
  const t = T(); if (!t || G.state.mode !== 'trail' || G.state.scene !== 'game') return;
  if (AUTO_END[t.phase]) armAutoEnd(t);
  aiMaybe();
}
// Test hook: empirical accuracy of the AI answer rule for a level over n draws per difficulty.
// With a persona's name it also gives the rate on medium questions in each category (S3-04).
export function aiAccuracySample(level, n = 400, persona = null) {
  const p = { level, persona }; const out = {};
  for (const d of ['easy', 'medium', 'hard']) { let c = 0; for (let i = 0; i < n; i++) if (aiAnswerCorrect(p, d)) c++; out[d] = c / n; }
  if (persona) { out.cat = {}; for (const cat of CATS) { let c = 0; for (let i = 0; i < n; i++) if (G.rng.next() < aiChance(p, 'medium', cat.id)) c++; out.cat[cat.id] = c / n; } }
  return out;
}
export { eligible, CAT, ERA, getQ, NODES };
