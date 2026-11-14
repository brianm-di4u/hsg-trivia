// Trail Game rules engine + AI (MECHANICS §4, §6). All state lives in G.state (serializable);
// static board data lives in board.js. UI and renderer read the state and call these actions.
import { makeRng, clamp } from './util.js';
import { CATS, CAT, pickQuestion, makeQuestion, updateSkill, pickOrdering, pickPostcard, getQ, ERA } from './data.js';
import { NODES, START, TOWER, TRAILHEAD, TROLLEYS, LANDMARK, DISTRICTS, DISTRICT, reachable, ventPartner, hops } from './board.js';
import { TOKEN_SHAPES, TOKEN_COLORS } from './art.js';
import { sfx } from './audio.js';

export const G = {
  state: null,
  rng: makeRng(1),
  hooks: { update() {}, announce() {}, moveToken() {}, effect() {}, save() {}, scene() {} },
  timers: [],
  paused: false, // set while the tab is hidden or the pause menu is open: no AI or auto-advance timer is armed
};

export const AI_NAMES = { easy: 'Doc Vapor', medium: 'Miss Promenade', hard: 'The Professor' };
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
export const AI_ACC = { easy: { easy: 0.6, medium: 0.4, hard: 0.25 }, medium: { easy: 0.8, medium: 0.6, hard: 0.4 }, hard: { easy: 0.92, medium: 0.8, hard: 0.65 } };
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
  AI_REROLL_KEEP: 3, // a Hard AI re-rolls only if it keeps this many tickets after paying (was: tickets >= 4 at a price of 1)
  AI_EXPRESS_CHANCE: { easy: 0, medium: 0, hard: 1 }, // how readily each level buys an Express ticket when it can (only The Professor does)
  AI_HINT_SCOPE: { easy: 'any', medium: 'any', hard: 'landmark-hard' }, // which questions each level pays to 50/50: any, or only hard landmark questions (the Summit question always)
  AI_HINT_KEEP: { easy: 4, medium: 4, hard: 0 }, // tickets an AI keeps after buying a 50/50 or Summit hint
};
export const TARGETS = [{ n: 4, label: 'Day Trip' }, { n: 6, label: 'Weekend' }, { n: 8, label: 'Grand Tour' }];

export const T = () => G.state.trail;
export const cur = () => T().players[T().turn];
const log = (msg) => { const t = T(); t.log.unshift(msg); if (t.log.length > 30) t.log.length = 30; G.hooks.announce(msg); };
const eligible = (p) => p.stamps.length >= T().target;
export const isAI = (p = cur()) => p.kind === 'ai';

function clearTimers() { for (const id of G.timers) clearTimeout(id); G.timers = []; }
function later(ms, fn) { if (G.paused) return; const id = setTimeout(() => { G.timers = G.timers.filter((x) => x !== id); fn(); }, ms); G.timers.push(id); }
const aiDelay = (base) => (G.state.settings.aiSpeed === 'fast' ? Math.min(220, base) : base);
// Phases that end the turn by themselves after a short pause, with that pause in ms.
const AUTO_END = { landed: () => (isAI() ? aiDelay(500) : 450), stuck: () => 1200, skipped: () => (isAI() ? aiDelay(900) : 1200) };
function armAutoEnd(t) { const ph = t.phase; later(AUTO_END[ph](), () => { if (T() === t && t.phase === ph) endTurn(); }); }

// ---------- setup ----------
export function newTrail({ players, target = 6 }) {
  clearTimers();
  const seats = (players && players.length ? players : [{ kind: 'human' }, { kind: 'ai', level: 'medium' }]).slice(0, 6);
  const defaults = defaultNames(seats);
  G.state.trail = {
    target, round: 1, turn: 0, phase: 'roll', roll: null, rerolled: false, dests: [], sel: 0,
    players: seats.map((s, i) => {
      const name = (s.name || '').trim() || defaults[i];
      return { id: i, name, kind: s.kind === 'ai' ? 'ai' : 'human', level: s.level || 'medium', shape: TOKEN_SHAPES[i], color: TOKEN_COLORS[i],
        node: START, stamps: [], tickets: ECON.START_TICKETS, rerolls: 0, skill: 0.35, skip: false, correct: 0, answered: 0, catStats: {}, streak: 0 };
    }),
    pending: null, log: [], winner: null, lastTurnAt: Date.now(),
  };
  G.state.question = null;
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
  sfx('gauge');
  t.dests = reachable(p.node, t.roll, eligible(p)).map((d) => ({ node: d.node, path: d.path }));
  t.dests.sort((a, b) => scoreDest(p, b.node) - scoreDest(p, a.node) || a.node - b.node);
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
    case 'tower': t.pending = { kind: 'summit', cat: CATS[G.rng.int(CATS.length)].id }; t.phase = 'summit'; sfx('bell'); log(`${p.name} reached the Mountain Tower! Summit question time.`); break;
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
  const q = pickQuestion(G.rng, G.state.asked, { category, skill: p.skill, difficulty: forceDiff });
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
  sfx(q.correct ? 'correct' : 'wrong', { streak: run });
  if (G.state.mode !== 'trail') return true; // quiz modes settle in quiz.js
  const t = T(); const p = cur();
  p.answered++; if (q.correct) { p.correct++; p.streak++; } else p.streak = 0;
  const cs = p.catStats[q.category] || (p.catStats[q.category] = [0, 0]); cs[1]++; if (q.correct) cs[0]++;
  p.skill = updateSkill(p.skill, q.difficulty, q.correct);
  const out = [];
  const pay = ECON.DISTRICT_PAY[q.difficulty];
  switch (q.purpose) {
    case 'district':
      if (q.correct) { p.tickets += pay; out.push(`+${pay} ticket${pay > 1 ? 's' : ''}`); }
      break;
    case 'landmark': case 'warpLandmark': case 'expressLandmark': {
      const cat = q.landmarkCat || NODES[p.node].cat;
      if (q.correct) {
        p.tickets += ECON.LANDMARK_PAY;
        if (!p.stamps.includes(cat)) { p.stamps.push(cat); out.push(`Stamp earned: ${DISTRICTS.find((d) => d.cat === cat).stamp}!`); G.hooks.effect('stamp', p); }
        out.push(`+${ECON.LANDMARK_PAY} tickets`);
      }
      break;
    }
    case 'wager': {
      const w = q.wager || 0;
      if (q.correct) { const win = q.difficulty === 'hard' ? w * 2 : w; p.tickets += win; out.push(w ? `Won ${win} ticket${win === 1 ? '' : 's'}` : 'No wager, no loss'); }
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
  q.outcome = out;
  log(`${p.name} ${q.correct ? 'answered correctly' : i === -1 ? 'ran out of time' : 'missed'} (${q.category}). ${out.join(' · ')}`);
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
      if (q.correct) { t.phase = 'over'; G.state.question = null; G.hooks.effect('win', p); sfx('win'); G.hooks.save(); G.hooks.scene('win'); G.hooks.update(); return; }
      G.state.question = null; t.phase = 'moving'; G.hooks.update();
      G.hooks.moveToken(p, [p.node, TRAILHEAD], () => { p.node = TRAILHEAD; endTurn(); }, 'jump');
      return;
    }
    G.state.question = null; return endTurn();
  }
  if (t.phase === 'postcard') return endTurn();
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
export function canExpress(p = cur()) { return T().phase === 'roll' && !eligible(p) && p.tickets >= ECON.EXPRESS_COST && expressTarget(p) !== null; }
export function express() {
  const t = T(); const p = cur(); if (!canExpress(p)) return false;
  const to = expressTarget(p);
  p.tickets -= ECON.EXPRESS_COST; sfx('coin'); sfx('trolley');
  log(`${p.name} buys an Express ticket (${ECON.EXPRESS_COST} tickets) to ${NODES[to].name}.`);
  t.phase = 'moving'; G.hooks.update();
  G.hooks.moveToken(p, [p.node, to], () => { p.node = to; ask(NODES[to].cat, 'expressLandmark', { landmarkCat: NODES[to].cat }); }, 'jump');
  return true;
}

// ---------- turn end ----------
export function endTurn() {
  const t = T(); if (t.phase === 'over') return;
  G.state.question = null; t.pending = null;
  t.turn = (t.turn + 1) % t.players.length;
  if (t.turn === 0) t.round++;
  G.hooks.save();
  beginTurn();
}

// ---------- AI ----------
function scoreDest(p, node) {
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
  else if (n.type === 'cat') s = 15;
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
  if (p.level === 'easy' && G.rng.next() < 0.6) return G.rng.int(t.dests.length);
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
      const reply = () => { const acc = AI_ACC[p.level][q.difficulty] * (q.purpose === 'summit' ? 0.9 : 1); const a = q.removed.length ? acc + (1 - acc) / 2 : acc; answer(G.rng.next() < a ? q.correctIndex : pickWrong()); };
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
export function aiAccuracySample(level, n = 400) {
  const p = { level }; const out = {};
  for (const d of ['easy', 'medium', 'hard']) { let c = 0; for (let i = 0; i < n; i++) if (aiAnswerCorrect(p, d)) c++; out[d] = c / n; }
  return out;
}
export { eligible, CAT, ERA, getQ, NODES };
