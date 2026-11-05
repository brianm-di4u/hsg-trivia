// Boot, main loop, save/load, input wiring and the window.__game test hooks.
import { makeRng, deepMerge, todayISO } from './util.js';
import { BANK } from './data.js';
import { NODES, ADJ, START, TOWER, TRAILHEAD, TROLLEYS, LANDMARK, VENT_PAIRS, SPUR_ENTRY, BOARD_W, BOARD_H, GEO_META } from './board.js';
import * as Game from './game.js';
import { G } from './game.js';
import * as Quiz from './quiz.js';
import * as R from './render.js';
import * as UI from './ui.js';
import { ui } from './ui.js';
import { sfx, setAudio, unlockAudio, audioStats } from './audio.js';
import { ART } from './assets.js';
import { createSaveStore } from './save.js';

const SAVE_KEY = 'hs-trivia-v1';
const DEFAULT_SETTINGS = { sound: true, volume: 0.7, timer: 30, motion: 'auto', textScale: 1, theme: 'auto', passScreen: true, aiSpeed: 'normal' };

// ---------- save ----------
G.save = createSaveStore({ onConflict() {
  ui.saveConflict = true;
  UI.announce('The saved trip changed in another tab. This trip will not overwrite it.');
  UI.update();
} });
G.today = () => (window.__TEST_DATE__ || todayISO());

function saveTrail() {
  const t = G.state.trail; if (!t) return;
  return applyCommittedSettings(G.save.commitTrail({
    trail: t.phase === 'over' ? null : JSON.parse(JSON.stringify({ ...t, phase: 'roll', roll: null, dests: [], pending: null })),
    asked: G.state.asked.slice(-300), rng: G.rng.state,
  }));
}
function saveQuiz(q) {
  return applyCommittedSettings(G.save.commitQuiz({ kind: q.kind, era: q.era, date: q.date, score: q.score,
    right: q.results.filter((r) => r.correct).length, marks: q.results.map((r) => r.correct ? '1' : '0').join('') }));
}

// ---------- settings ----------
const mq = (q) => (window.matchMedia ? window.matchMedia(q).matches : false);
function applySettings() {
  const s = G.state.settings;
  setAudio({ on: s.sound, volume: s.volume });
  const dark = s.theme === 'dark' || (s.theme === 'auto' && mq('(prefers-color-scheme: dark)'));
  document.body.dataset.theme = dark ? 'dark' : 'light';
  R.setTheme(dark ? 'dark' : 'light'); R.requestArt();
  R.view.reduced = s.motion === 'reduced' || (s.motion === 'auto' && mq('(prefers-reduced-motion: reduce)'));
  document.body.classList.toggle('reduced', R.view.reduced);
  document.documentElement.style.fontSize = (16 * s.textScale) + 'px';

}

function syncSavedSettings() {
  Object.assign(G.state.settings, DEFAULT_SETTINGS, G.save.data.settings);
  applySettings();
}
function applyCommittedSettings(result) {
  if (result.ok) syncSavedSettings();
  return result;
}
function changeSettings(changes) {
  Object.assign(G.state.settings, changes);
  const result = applyCommittedSettings(G.save.updateSettings(changes));
  if (!result.ok) applySettings();
  return result;
}

// ---------- scenes ----------
function scene(name) {
  if (name !== 'game') Game.stopAI();
  const backdrop = name !== 'game';
  R.view.backdrop = backdrop;
  if (backdrop) { R.view.mode = 'fit'; const tw = R.towerTop(); R.view.backdropFocus = name === 'win' ? { x: tw.x - 40, y: tw.y + 20, at: 0.72 } : null; }
  else { R.view.mode = R.view.w < 700 ? 'follow' : 'fit'; R.view.manual = false; }
  if (name === 'setup' && !ui.setup) ui.setup = null;
  UI.showScene(name);
  R.resize(); R.snapCamera(); R.requestArt();
  if (name === 'game') Game.aiMaybe();
}
let prevScene = 'title';
function goto(name) { if (['help', 'settings'].includes(name)) prevScene = G.state.scene === 'help' || G.state.scene === 'settings' ? prevScene : G.state.scene; scene(name); }

// ---------- game hooks used by the rules engine ----------
G.hooks.update = () => UI.update();
G.hooks.announce = (m) => UI.announce(m);
G.hooks.save = saveTrail;
G.hooks.saveQuiz = saveQuiz;
G.hooks.scene = (n) => scene(n);
G.hooks.moveToken = (p, path, done, mode = 'walk') => {
  R.moveAlong(p, path, () => { done(); }, { mode, onHop: () => sfx(mode === 'jump' ? 'steam' : 'hop') });
};
G.hooks.effect = (kind, p) => {
  const tp = R.tokenPos(p);
  if (kind === 'stamp') { sfx('stamp'); R.burst(tp.x, tp.y - 10, ['#D9A23A', '#FFFFFF', '#A9432C'], 30); }
  if (kind === 'steam') R.burst(tp.x, tp.y - 10, ['rgba(255,255,255,0.9)', 'rgba(200,230,230,0.8)'], 20);
  if (kind === 'win') { const n = R.towerTop(); R.burst(n.x, n.y, ['#D7263D', '#1D5BD6', '#F2A90C', '#14904A', '#FFFFFF'], 90, 'confetti'); }
};

function newState() {
  return { v: 1, scene: 'title', mode: null, settings: { ...DEFAULT_SETTINGS, ...(G.save.data.settings || {}) }, asked: [], trail: null, question: null, quiz: null, rngSeed: 1 };
}

// ---------- actions (shared by clicks, keys and __game.act) ----------
function startTrail(opts = {}) {
  const reserved = G.save.reserveTrail();
  if (!reserved.ok && reserved.reason === 'trail-conflict') return;
  ui.saveConflict = false;
  R.resetTokens();
  Game.newTrail(opts);
  scene('game');
}
function startQuiz(kind, opts) { Quiz.newQuiz(kind, opts); scene('quiz'); }

const ACTIONS = {
  goto: (a) => goto(a),
  back: () => scene(G.state.trail && prevScene === 'game' ? 'game' : prevScene === 'game' ? 'title' : prevScene || 'title'),
  'continue-trail': () => {
    const saved = G.save.adoptTrail(); if (!saved) { UI.update(); return; }
    ui.saveConflict = false;
    G.state.trail = saved.trail; G.state.mode = 'trail'; G.state.asked = (saved.asked || []).slice();
    if (saved.rng !== undefined) G.rng.state = saved.rng;
    syncSavedSettings();
    R.resetTokens(); scene('game'); Game.beginTurn();
  },
  'start-trail': () => {
    const su = ui.setup;
    startTrail({ players: su.seats.map((s) => ({ name: s.name, kind: s.kind, level: s.level })), target: su.target });
  },
  restart: () => { const t = G.state.trail; if (!t) return; startTrail({ players: t.players.map((p) => ({ name: p.name, kind: p.kind, level: p.level })), target: t.target }); },
  'seat-add': () => { if (ui.setup.seats.length < 6) ui.setup.seats.push({ name: '', kind: 'ai', level: 'medium' }); UI.update(); },
  'seat-remove': (a) => { ui.setup.seats.splice(+a, 1); UI.update(); },
  target: (a) => { ui.setup.target = +a; sfx('click'); UI.update(); },
  roll: () => { if (Game.cur().kind === 'human') Game.roll(); },
  reroll: () => Game.reroll(),
  choose: (a) => { if (Game.cur().kind === 'human') Game.choose(+a); },
  answer: (a) => {
    const q = G.state.question; if (!q || q.chosen !== null) return;
    if (G.state.mode === 'trail') { if (Game.cur().kind === 'human') Game.answer(+a); }
    else { Game.answer(+a); Quiz.settle(); }
  },
  lifeline: () => Game.lifeline(),
  proceed: () => Game.proceed(),
  pass: () => Game.pass(),
  vent: (a) => Game.vent(a === '1' || a === true),
  wager: (a) => Game.setWager(+a),
  'order-pick': (a) => Game.orderPick(+a),
  warp: (a) => Game.warp(+a),
  'trolley-open': () => { if (Game.canTrolley()) { ui.modal = 'trolley'; UI.update(); } },
  trolley: (a) => { ui.modal = null; Game.trolley(+a); },
  passport: () => { ui.modal = 'passport'; sfx('page'); UI.update(); },
  'close-modal': () => { ui.modal = null; ui.menuOpen = false; UI.update(); },
  menu: () => { ui.menuOpen = true; UI.update(); },
  zoom: () => { R.setCameraMode(R.view.mode === 'follow' ? 'fit' : 'follow'); UI.update(); },
  quick: () => startQuiz('quick'),
  'era-start': (a) => startQuiz('era', { era: a || 'gilded-spa' }),
  daily: () => startQuiz('daily', { date: G.today() }),
  'quiz-next': () => Quiz.next(),
  set: (a) => {
    const [k, v] = a.split('='); const s = G.state.settings;
    const value = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v;
    changeSettings({ [k]: value }); sfx('click'); UI.update();
  },
  'save-conflict-dismiss': () => { ui.saveConflict = false; UI.update(); },
  'save-conflict-title': () => { ui.saveConflict = false; scene('title'); },
  'copy-share': () => { const ta = document.querySelector('#share'); if (!ta) return; ta.select(); try { navigator.clipboard.writeText(ta.value).catch(() => {}); } catch (e) { /* select fallback */ } UI.announce('Result copied.'); },
};
function act(name, arg) { const f = ACTIONS[name]; if (f) f(arg); }

// ---------- input ----------
function wireInput() {
  document.addEventListener('click', (e) => {
    unlockAudio();
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    e.preventDefault(); act(b.dataset.act, b.dataset.arg);
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.seat !== undefined) { ui.setup.seats[+el.dataset.seat].name = el.value; }
    if (el.dataset.setting === 'volume') { changeSettings({ volume: el.value / 100 }); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.seatkind !== undefined) { const [k, l] = el.value.split(':'); const s = ui.setup.seats[+el.dataset.seatkind]; s.kind = k; s.level = l || 'medium'; UI.update(); }
    if (el.dataset.setting === 'volume') sfx('coin');
  });
  document.querySelector('#btn-home').addEventListener('click', () => { if (G.state.scene === 'game') { ui.menuOpen = true; UI.update(); } else scene('title'); });
  document.querySelector('#btn-help').addEventListener('click', () => goto('help'));
  document.querySelector('#btn-settings').addEventListener('click', () => goto('settings'));
  document.querySelector('#btn-sound').addEventListener('click', () => { changeSettings({ sound: !G.state.settings.sound }); UI.update(); sfx('click'); });
  document.querySelector('#btn-zoom').addEventListener('click', () => act('zoom'));

  // Board pointer: tap a highlighted space; drag to pan when zoomed.
  const cv = document.querySelector('#board');
  let down = null;
  cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, moved: false }; cv.setPointerCapture(e.pointerId); unlockAudio(); });
  cv.addEventListener('pointermove', (e) => {
    if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) down.moved = true;
    if (down.moved && R.view.mode === 'follow') { R.panBy(dx, dy); down.x = e.clientX; down.y = e.clientY; }
  });
  cv.addEventListener('pointerup', (e) => {
    if (!down) return; const moved = down.moved; down = null;
    if (moved || G.state.scene !== 'game' || ui.saveConflict) return;
    const t = G.state.trail; if (!t || Game.cur().kind !== 'human') return;
    const r = cv.getBoundingClientRect(); const hit = R.hitDest(e.clientX - r.left, e.clientY - r.top, t);
    if (hit === null) return;
    if (t.phase === 'choose') Game.choose(hit); else if (t.phase === 'warp') Game.warp(hit);
  });

  document.addEventListener('keydown', onKey);
}

function onKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  unlockAudio();
  const k = e.key; const ae = document.activeElement;
  const typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA');
  if (typing && k !== 'Escape') return;
  // Let a focused button handle its own Enter/Space activation.
  if ((k === 'Enter' || k === ' ') && ae && ae.tagName === 'BUTTON') return;
  const st = G.state; const sc = st.scene; const lower = k.toLowerCase();
  const done = () => e.preventDefault();
  if (ui.saveConflict) {
    if (k === 'Tab') return trapFocus(e);
    if (k === 'Escape') act('save-conflict-dismiss');
    return done();
  }
  if (lower === 'm') { document.querySelector('#btn-sound').click(); return done(); }
  if (k === '?') { goto('help'); return done(); }
  if (k === 'Tab') return trapFocus(e);
  if (sc === 'quiz') {
    const q = st.question; if (!q) return;
    if (q.chosen === null) { const i = answerKey(lower); if (i >= 0 && !q.removed.includes(i)) { act('answer', i); return done(); } }
    else if (k === 'Enter' || k === ' ') { act('quiz-next'); return done(); }
    if (k === 'Escape') { scene('title'); return done(); }
    return;
  }
  if (sc !== 'game') {
    if (k === 'Escape' && sc !== 'title') { act(sc === 'help' || sc === 'settings' ? 'back' : 'goto', 'title'); return done(); }
    return;
  }
  // ---- game scene ----
  if (k === 'Escape') { if (ui.modal || ui.menuOpen) act('close-modal'); else act('menu'); return done(); }
  if (ui.menuOpen) return;
  if (ui.modal === 'trolley') { const n = +k; const opts = Game.trolleyOptions(); if (n >= 1 && n <= opts.length) { act('trolley', opts[n - 1]); return done(); } return; }
  if (ui.modal) return;
  if (lower === 'p') { act('passport'); return done(); }
  if (lower === 'z') { act('zoom'); return done(); }
  const t = st.trail; const p = Game.cur(); if (!t || p.kind !== 'human') {
    if ((k === 'Enter' || k === ' ') && ['feedback', 'postcard', 'orderResult'].includes(t && t.phase)) { act('proceed'); return done(); }
    return;
  }
  switch (t.phase) {
    case 'pass': if (k === 'Enter' || k === ' ') { act('pass'); return done(); } break;
    case 'roll':
      if (k === ' ' || lower === 'r' || k === 'Enter') { act('roll'); return done(); }
      if (lower === 't') { act('trolley-open'); return done(); }
      break;
    case 'choose':
      if (k === 'ArrowRight' || k === 'ArrowDown') { Game.selectDest(1); return done(); }
      if (k === 'ArrowLeft' || k === 'ArrowUp') { Game.selectDest(-1); return done(); }
      if (k === 'Enter' || k === ' ') { Game.choose(); return done(); }
      if (lower === 'r') { act('reroll'); return done(); }
      if (/^[1-9]$/.test(k) && +k <= t.dests.length) { Game.choose(t.dests[+k - 1].node); return done(); }
      break;
    case 'question': {
      const q = st.question; const i = answerKey(lower);
      if (i >= 0 && !q.removed.includes(i)) { act('answer', i); return done(); }
      if (lower === 'f') { act('lifeline'); return done(); }
      break;
    }
    case 'feedback': case 'postcard': case 'orderResult': case 'jury': case 'summit':
      if (k === 'Enter' || k === ' ') { act('proceed'); return done(); }
      break;
    case 'vent': if (lower === 'y') { act('vent', '1'); return done(); } if (lower === 'n') { act('vent', '0'); return done(); } break;
    case 'wager': if (/^[0-5]$/.test(k) && +k <= Math.min(5, p.tickets)) { act('wager', k); return done(); } break;
    case 'order': if (/^[1-3]$/.test(k)) { act('order-pick', +k - 1); return done(); } break;
    case 'warp': if (/^[1-9]$/.test(k) && +k <= t.pending.options.length) { act('warp', t.pending.options[+k - 1]); return done(); } break;
    default:
  }
}
const answerKey = (l) => ({ a: 0, b: 1, c: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 }[l] ?? -1);

function trapFocus(e) {
  const modal = document.querySelector('#modal');
  if (modal.hidden) return;
  const f = [...modal.querySelectorAll('button:not([disabled]), input, select, textarea')];
  if (!f.length) return;
  const i = f.indexOf(document.activeElement);
  if (e.shiftKey && (i <= 0)) { f[f.length - 1].focus(); e.preventDefault(); }
  else if (!e.shiftKey && (i === f.length - 1 || i === -1)) { f[0].focus(); e.preventDefault(); }
}

// ---------- loop ----------
let lastT = 0; let tickSec = -1; let fpsFrames = 0;
function loop(ts) {
  // Animation steps are capped at 50 ms so a stall never teleports tokens; the answer timer runs on wall-clock
  // time (capped at 0.5 s for a backgrounded tab), so a 10 s timer is 10 s even on a slow device.
  const raw = lastT ? (ts - lastT) / 1000 : 0.016; const dt = Math.min(0.05, raw); const tdt = Math.min(0.5, raw); lastT = ts; fpsFrames++;
  const st = G.state;
  // question timer (humans only in the Trail Game)
  const q = st.question;
  const human = st.mode !== 'trail' || (st.trail && Game.cur().kind === 'human');
  const open = q && q.chosen === null && q.timeMax > 0 && human && !ui.modal && !ui.menuOpen && !ui.saveConflict && (st.scene === 'quiz' || (st.scene === 'game' && st.trail.phase === 'question'));
  if (open) {
    q.timeLeft -= tdt;
    const sec = Math.ceil(q.timeLeft);
    if (sec !== tickSec && sec <= 5 && sec > 0) { tickSec = sec; sfx('tick'); }
    if (q.timeLeft <= 0) { q.timeLeft = 0; UI.announce('Time is up.'); Game.answer('timeout'); if (st.mode !== 'trail') Quiz.settle(); }
    UI.updateTimerBar();
  }
  R.frame(dt, st);
  requestAnimationFrame(loop);
}

// ---------- test hooks ----------
function publicState() {
  const st = G.state; const t = st.trail;
  return JSON.parse(JSON.stringify({
    scene: st.scene, mode: st.mode, settings: st.settings, asked: st.asked,
    trail: t ? { target: t.target, round: t.round, turn: t.turn, phase: t.phase, roll: t.roll, rerolled: t.rerolled, sel: t.sel,
      dests: t.dests.map((d) => d.node), destPaths: t.dests.map((d) => d.path),
      players: t.players.map(({ id, name, kind, level, node, stamps, tickets, skill, skip, correct, answered, shape, color }) => ({ id, name, kind, level, node, stamps, tickets, skill, skip, correct, answered, shape, color })),
      pending: t.pending, winner: t.winner, log: t.log.slice(0, 6) } : null,
    question: st.question, quiz: st.quiz,
    board: { nodes: NODES.length, start: START, tower: TOWER, trailhead: TRAILHEAD, spurEntry: SPUR_ENTRY, trolleys: TROLLEYS, landmarks: LANDMARK, vents: VENT_PAIRS,
      types: NODES.map((n) => n.type), cats: NODES.map((n) => n.cat || null), costs: NODES.map((n) => n.cost) },
    ui: { modal: ui.modal, menu: ui.menuOpen, camera: R.view.mode, reduced: R.view.reduced, theme: document.body.dataset.theme, focus: document.activeElement ? (document.activeElement.dataset.key || document.activeElement.id || document.activeElement.tagName) : null },
    bank: BANK.length, storage: G.save.ok, audio: { ...audioStats },
    art: { enabled: ART.enabled, pending: ART.pending, failed: ART.failed.slice(), loaded: Object.keys(ART.imgs).filter((k) => ART.imgs[k].ok) },
  }));
}

window.__game = {
  seed(n) { G.state.rngSeed = n; G.rng = makeRng(n); return n; },
  getState: publicState,
  setState(s) {
    const st = G.state;
    if (s.settings) changeSettings(s.settings);
    if (s.trail && st.trail) {
      const { players, ...rest } = s.trail;
      Object.assign(st.trail, rest);
      if (players) players.forEach((pp, i) => { if (pp && st.trail.players[i]) { Object.assign(st.trail.players[i], pp); if (pp.node !== undefined) { const n = NODES[pp.node]; const tp = R.tokenPos(st.trail.players[i]); tp.x = n.x; tp.y = n.y; } } });
    }
    if (s.question !== undefined) st.question = s.question === null ? null : Object.assign(st.question || {}, s.question);
    if (s.asked) st.asked = s.asked.slice();
    UI.update(); return true;
  },
  // Idle = no tween, camera settled, board art decoded, and the modal's 0.22 s rise transition has finished.
  isIdle() { const now = performance.now(); return !R.isAnimating() && R.camSettled() && !R.artBusy() && (R.view.reduced || (now - ui.modalAt > 300 && now - ui.revealAt > 760 && now - (ui.answerAt || 0) > 1000)); },
  scene(name) { scene(name); return G.state.scene; },
  newGame(opts = {}) {
    if (opts.seed !== undefined) this.seed(opts.seed);
    const mode = opts.mode || 'trail';
    if (mode === 'trail') startTrail({ players: opts.players, target: opts.target || 6 });
    else if (mode === 'daily') startQuiz('daily', { date: opts.date || G.today() });
    else startQuiz(mode, { era: opts.era });
    return publicState();
  },
  act(name, ...args) {
    const t = G.state.trail;
    switch (name) {
      case 'roll': return Game.roll(args[0]);
      case 'choose': return Game.choose(args[0]);
      case 'chooseIndex': return t && t.dests[args[0]] ? Game.choose(t.dests[args[0]].node) : false;
      case 'answer': { const r = Game.answer(args[0]); if (r && G.state.mode !== 'trail') Quiz.settle(); return r; }
      case 'continue': if (G.state.scene === 'quiz') { Quiz.next(); return true; } return Game.proceed();
      case 'wager': return Game.setWager(args[0]);
      case 'order': return Game.order(args[0]);
      case 'orderCorrect': { const ev = t.pending.events; return Game.order([0, 1, 2].sort((a, b) => ev[a].y - ev[b].y)); }
      case 'vent': return Game.vent(args[0]);
      case 'warp': return Game.warp(args[0]);
      case 'trolley': return Game.trolley(args[0]);
      case 'reroll': return Game.reroll();
      case 'lifeline': return Game.lifeline();
      case 'pass': Game.pass(); return true;
      case 'finishAnim': R.finishAnims(); return true;
      case 'ui': act(args[0], args[1]); return true;
      case 'stopAI': Game.stopAI(); return true;
      case 'adj': return ADJ[args[0]].slice();
      case 'aiSample': return Game.aiAccuracySample(args[0], args[1]);
      // board geometry for tests: node positions and radii (board units), and a node's position on screen (CSS px)
      case 'geo': return { w: BOARD_W, h: BOARD_H, squash: GEO_META ? GEO_META.squash : 0.87, horizon: GEO_META && GEO_META.horizon || 0, tracks: GEO_META ? GEO_META.tracks || [] : [],
        edges: GEO_META ? GEO_META.edges : [], nodes: NODES.map((n) => ({ x: n.x, y: n.y, r: R.spaceR(n), type: n.type })) };
      case 'screenOf': { const n = NODES[args[0]]; const [x, y] = R.worldToScreen(n.x, n.y); const r = document.querySelector('#board').getBoundingClientRect(); return [r.left + x, r.top + y]; }
      default: return false;
    }
  },
  fpsFrames: () => fpsFrames,
};

// ---------- boot ----------
function boot() {
  G.save.load();
  G.state = newState();
  G.rng = makeRng((Date.now() ^ 0x5eed) >>> 0);
  R.initView(document.querySelector('#board'));
  G.view = R.view;
  applySettings();
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applySettings());
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => applySettings());
  }
  wireInput();
  scene('title');
  requestAnimationFrame(loop);
}
boot();
