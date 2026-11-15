// Catch-up measure (S3-03): plays full Trail Games between computer travelers with the real rules (src/js/game.js) on virtual timers and
// reports how often the first traveler to collect all their stamps wins, and how often the sole stamp leader at round 12 does.
// Usage: node tools/lead-sim.mjs [games per row = 300] [rows: 2p, 4p or both]       ECON='{"FINAL_LAP_EXPRESS":0}' node tools/lead-sim.mjs 300   overrides constants in game.js ECON.
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
const { G } = Game;
if (process.env.ECON) { const o = JSON.parse(process.env.ECON); for (const k of Object.keys(o)) Game.ECON[k] = (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) ? { ...Game.ECON[k], ...o[k] } : o[k]; }
const N = +(process.argv[2] || 300);
function runLead(seats, target, seed) {
  q = []; now = 0; G.rng = makeRng(seed);
  G.state = { settings: { aiSpeed: 'fast', timer: 0, passScreen: false }, asked: [], scene: 'game', mode: 'trail', question: null };
  G.hooks.announce = () => {}; G.hooks.moveToken = (p, pth, cb) => { cb(); };
  G.hooks.scene = () => {}; G.hooks.effect = () => {}; G.hooks.save = () => {}; G.hooks.update = () => {};
  Game.newTrail({ players: seats.map((l) => ({ kind: 'ai', level: l })), target });
  let guard = 0; const t = G.state.trail; let eligFirst = null, mid = null;
  while (t.phase !== 'over' && guard++ < 2e6) {
    q.sort((a, b) => a.t - b.t || a.id - b.id); const n = q.shift(); if (!n) break; now = n.t; n.fn();
    if (eligFirst === null) { const e = t.players.find((p) => p.stamps.length >= target); if (e) eligFirst = e.id; }
    if (mid === null && t.round >= 12 && t.turn === 0) { const mx = Math.max(...t.players.map((p) => p.stamps.length)); const ls = t.players.filter((p) => p.stamps.length === mx); mid = ls.length === 1 ? ls[0].id : -1; }
    if (t.round > 400) break;
  }
  return { over: t.phase === 'over', winner: t.winner, eligFirst, mid, rounds: t.round };
}
const WANT = process.argv[3] || 'both';
for (const [name, seats] of [['2p medium', ['medium', 'medium']], ['4p medium', ['medium', 'medium', 'medium', 'medium']]]) {
  if (WANT !== 'both' && !name.startsWith(WANT)) continue;
  let games = 0, eligWin = 0, midN = 0, midWin = 0; const rounds = [];
  for (let i = 0; i < N; i++) {
    const r = runLead(seats, 6, 5000 + i); if (!r.over) continue; games++; rounds.push(r.rounds);
    if (r.eligFirst === r.winner) eligWin++;
    if (r.mid >= 0) { midN++; if (r.mid === r.winner) midWin++; }
  }
  rounds.sort((a, b) => a - b);
  console.log(JSON.stringify({ label: name, games, firstToCollectWins: +(100 * eligWin / games).toFixed(1), chance: +(100 / seats.length).toFixed(0), leaderAtRound12Wins: +(100 * midWin / midN).toFixed(1), leaderN: midN, roundsMedian: rounds[Math.floor(rounds.length / 2)] }));
}
