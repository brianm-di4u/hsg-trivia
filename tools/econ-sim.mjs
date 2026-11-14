// Ticket-economy simulation (S3-02): plays full Trail Games headless with the real rules engine (src/js/game.js) on virtual
// timers and reports, per row, win share, rounds, unspent tickets at the end and how often each ticket sink was used.
// Seat 0 of the HUMAN rows is a "human profile": it plays with the Hard AI's heuristics but its own answer accuracy.
// Usage: node tools/econ-sim.mjs [games per row = 300] [row numbers, comma separated = all]
// ECON='{"EXPRESS_COST":8}' node tools/econ-sim.mjs 200 1   overrides constants in game.js ECON for one run.
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
globalThis.window = {};
globalThis.QUESTIONS = JSON.parse(fs.readFileSync(REPO + '/data/questions.json', 'utf8'));
globalThis.TIMELINE = JSON.parse(fs.readFileSync(REPO + '/data/timeline-lite.json', 'utf8'));
globalThis.BOARD_GEO = JSON.parse(fs.readFileSync(REPO + '/data/board-geo.json', 'utf8'));
let now = 0, q = [], seq = 0;
globalThis.setTimeout = (fn, ms) => { const id = ++seq; q.push({ id, t: now + ms, fn }); return id; };
globalThis.clearTimeout = (id) => { q = q.filter((x) => x.id !== id); };
const imp = (f) => import(pathToFileURL(REPO + '/src/js/' + f).href);
const Game = await imp('game.js'); const { makeRng } = await imp('util.js');
const { G, AI_ACC } = Game;
if (process.env.ECON && Game.ECON) { const o = JSON.parse(process.env.ECON); for (const k of Object.keys(o)) Game.ECON[k] = (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) ? { ...Game.ECON[k], ...o[k] } : o[k]; }
const ORIG = JSON.parse(JSON.stringify(AI_ACC));
const N = +(process.argv[2] || 300);
function runGame(seats, target, seed, ev) {
  q = []; now = 0;
  G.rng = makeRng(seed);
  G.state = { settings: { aiSpeed: 'fast', timer: 0, passScreen: false }, asked: [], scene: 'game', mode: 'trail', question: null };
  G.hooks.announce = (m) => { if (/re-roll/.test(m)) ev.reroll++; else if (/Express/.test(m)) ev.express++; else if (/hint/.test(m)) ev.hint++; else if (/50\/50/.test(m)) ev.fifty++; else if (/trolley to/.test(m)) ev.trolley++; else if (/wagers/.test(m)) ev.wager++; };
  G.hooks.moveToken = (p, pth, cb) => { cb(); };
  G.hooks.scene = () => {}; G.hooks.effect = () => {}; G.hooks.save = () => {}; G.hooks.update = () => {};
  Game.newTrail({ players: seats.map((l) => ({ kind: 'ai', level: l })), target });
  let guard = 0;
  while (G.state.trail.phase !== 'over' && guard++ < 2e6) {
    q.sort((a, b) => a.t - b.t || a.id - b.id);
    const n = q.shift(); if (!n) break; now = n.t; n.fn();
    if (G.state.trail.round > 400) break;
  }
  const t = G.state.trail;
  return { over: t.phase === 'over', winner: t.winner, rounds: t.round, players: t.players };
}
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
function batch(label, seats, target, n = N, profile = null) {
  for (const l of ['easy', 'medium', 'hard']) Object.assign(AI_ACC[l], ORIG[l]);
  if (profile) Object.assign(AI_ACC.hard, profile);
  const ev = { reroll: 0, express: 0, hint: 0, fifty: 0, trolley: 0, wager: 0 };
  const wins = seats.map(() => 0); const rounds = []; const tix = seats.map(() => []); let done = 0;
  for (let i = 0; i < n; i++) {
    const r = runGame(seats, target, 1000 + i, ev);
    if (!r.over) continue; done++; wins[r.winner]++; rounds.push(r.rounds);
    r.players.forEach((p, k) => tix[k].push(p.tickets));
  }
  rounds.sort((a, b) => a - b);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const out = { label, games: done, win: wins.map((w) => +(100 * w / done).toFixed(1)), roundsMedian: rounds[Math.floor(rounds.length / 2)],
    endTicketsMedian: tix.map(med), endTicketsMean: tix.map((a) => +mean(a).toFixed(1)), per_game: Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, +(v / done).toFixed(1)])) };
  console.log(JSON.stringify(out));
  return out;
}
const HUMANS = { fan: { easy: 0.85, medium: 0.65, hard: 0.45 }, strong: { easy: 0.92, medium: 0.8, hard: 0.6 }, casual: { easy: 0.75, medium: 0.5, hard: 0.3 }, expert: { easy: 0.97, medium: 0.9, hard: 0.8 } };
const ROWS = [
  () => batch('AI easy mirror', ['easy', 'easy'], 6),
  () => batch('AI medium mirror', ['medium', 'medium'], 6),
  () => batch('AI hard mirror', ['hard', 'hard'], 6),
  () => batch('AI 4p medium', ['medium', 'medium', 'medium', 'medium'], 6),
  () => batch('AI medium mirror target8', ['medium', 'medium'], 8),
  () => batch('AI medium mirror target4', ['medium', 'medium'], 4),
  () => batch('AI medium vs hard', ['medium', 'hard'], 6),
  () => batch('AI easy vs hard', ['easy', 'hard'], 6),
  () => batch('AI easy vs medium', ['easy', 'medium'], 6),
  ...Object.entries(HUMANS).map(([k, acc]) => () => batch('HUMAN ' + k + ' vs Medium AI', ['hard', 'medium'], 6, N, acc)),
];
const pick = (process.argv[3] || ROWS.map((_, i) => i).join(',')).split(',').map(Number);
for (const i of pick) ROWS[i]();
