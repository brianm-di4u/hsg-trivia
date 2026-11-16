// Boot, main loop, save/load, input wiring and the window.__game test hooks.
import { makeRng, deepMerge, todayISO } from './util.js';
import { BANK, CAT, getQ } from './data.js';
import { NODES, ADJ, START, TOWER, TRAILHEAD, TROLLEYS, LANDMARK, VENT_PAIRS, SPUR_ENTRY, BOARD_W, BOARD_H, GEO_META } from './board.js';
import * as Game from './game.js';
import { G } from './game.js';
import * as Quiz from './quiz.js';
import * as R from './render.js';
import * as UI from './ui.js';
import { ui } from './ui.js';
import { sfx, setAudio, unlockAudio, audioStats, setSoundscape, setAudioPaused, audioList, audioRender, audioInfo } from './audio.js';
import { ART } from './assets.js';
import { createSaveStore, validTrail, validOpenQuestion, SEEN_MAX } from './save.js';

const SAVE_KEY = 'hs-trivia-v1';
const DEFAULT_SETTINGS = { sound: true, effects: true, music: true, ambience: true, haptics: true, volume: 0.7, timer: 30, motion: 'auto', textScale: 1, theme: 'auto', passScreen: true, aiSpeed: 'normal', seenCoach: true }; // aiSpeed 'normal' is what a save from before the setting existed meant; a new profile starts at Brisk (see baseSettings)
// What a setting is when the save does not name it: a new profile gets the Brisk AI speed, an older save keeps Normal. An unknown speed falls back to Brisk.
// seenCoach: only a brand-new profile is a newcomer who gets the first-run tips; a save that has no such key is an older player's.
const baseSettings = () => ({ ...DEFAULT_SETTINGS, aiSpeed: G.save.fresh ? Game.DEFAULT_AI_SPEED : DEFAULT_SETTINGS.aiSpeed, seenCoach: !G.save.fresh });
const validSpeed = (s) => ({ ...s, aiSpeed: Game.AI_PACE[s.aiSpeed] ? s.aiSpeed : Game.DEFAULT_AI_SPEED, seenCoach: typeof s.seenCoach === 'boolean' ? s.seenCoach : true, haptics: typeof s.haptics === 'boolean' ? s.haptics : true });

// ---------- save ----------
G.save = createSaveStore({ onConflict() {
  ui.saveConflict = true;
  UI.announce('The saved trip changed in another tab. This trip will not overwrite it.');
  UI.update();
} });
G.today = () => (window.__TEST_DATE__ || todayISO());

// Say so once when saving stops working (and again if it works, then fails again). The notice itself is drawn by ui.js.
let saveWarned = false;
function noted(result) {
  if (G.save.ok) saveWarned = false;
  else if (!saveWarned) { saveWarned = true; UI.announce('Progress is not being saved in this browser.'); }
  return result;
}

// The last turn-start snapshot handed to the save store, kept so a failed write can be retried when the page is hidden.
let turnSnap = null;
function saveTrail({ afterAnswer = false, inQuestion = false } = {}) {
  const t = G.state.trail; if (!t) return;
  // inQuestion: a human's open question is stored as it stands (question, choice order, time left), so Continue returns to it.
  const snap = t.phase === 'over' ? null : JSON.parse(JSON.stringify(inQuestion ? { ...t, question: G.state.question } : { ...t, phase: 'roll', roll: null, dests: [], pending: null }));
  if (snap && afterAnswer) {
    // Saved right after an answer scores: store the state endTurn will reach (the next player's turn), so that reloading
    // neither re-asks the question nor undoes the result. A missed Summit question sends the token to the trailhead.
    if (G.state.question && G.state.question.purpose === 'summit') snap.players[snap.turn].node = TRAILHEAD;
    snap.turn = (snap.turn + 1) % snap.players.length;
    if (snap.turn === 0) snap.round++;
  }
  turnSnap = { trail: snap, asked: G.state.asked.slice(-300), rng: G.rng.state };
  return noted(applyCommittedSettings(G.save.commitTrail(turnSnap)));
}
// Leaving the page: record the time left on an open question, and retry a write that failed.
function saveOnLeave() {
  const q = G.state.question, t = G.state.trail;
  if (G.state.scene === 'game' && t && t.phase === 'question' && q && q.chosen === null && Game.cur().kind === 'human') saveTrail({ inQuestion: true });
  else retryUnsavedTrail();
}
function retryUnsavedTrail() {
  if (turnSnap && turnSnap.trail && (G.save.pending.trail || G.save.pending.reservation)) noted(applyCommittedSettings(G.save.commitTrail(turnSnap)));
}
function saveQuiz(q) {
  if (q.practice) return { ok: true }; // a practice Daily is not counted: nothing is saved (S6-18)
  const right = q.results.filter((r) => r.correct).length;
  const result = noted(applyCommittedSettings(G.save.commitQuiz({ kind: q.kind, era: q.era, date: q.date, score: q.score, total: q.total, timer: q.timer,
    right, marks: q.results.map((r) => r.correct ? '1' : '0').join('') })));
  if (result.ok) G.hooks.record({ kind: 'quiz', mode: q.kind, right, total: q.results.length, dailyStreak: (G.save.data.daily && G.save.data.daily.streak) || 0 });
  return result;
}

// ---------- settings ----------
const mq = (q) => (window.matchMedia ? window.matchMedia(q).matches : false);
let appliedTheme = null;
function applySettings() {
  const s = G.state.settings;
  setAudio({ on: s.sound, volume: s.volume, effects: s.effects, music: s.music, ambience: s.ambience });
  const dark = s.theme === 'dark' || (s.theme === 'auto' && mq('(prefers-color-scheme: dark)'));
  document.body.dataset.theme = dark ? 'dark' : 'light';
  if (R.view.duskOn !== (s.theme === 'dusk')) { R.setDusk(s.theme === 'dusk'); R.requestArt(); }
  // setTheme throws the board cache away, so only call it when the resolved theme really changes (not on volume or mute).
  if (appliedTheme !== (dark ? 'dark' : 'light')) { appliedTheme = dark ? 'dark' : 'light'; R.setTheme(appliedTheme); R.requestArt(); }
  R.view.reduced = s.motion === 'reduced' || (s.motion === 'auto' && mq('(prefers-reduced-motion: reduce)'));
  document.body.classList.toggle('reduced', R.view.reduced);
  document.documentElement.style.fontSize = (16 * s.textScale) + 'px';

}

function syncSavedSettings() {
  Object.assign(G.state.settings, validSpeed({ ...baseSettings(), ...G.save.data.settings }));
  applySettings();
}
function applyCommittedSettings(result) {
  if (result.ok) syncSavedSettings();
  return result;
}
function changeSettings(changes) {
  Object.assign(G.state.settings, changes);
  const result = noted(applyCommittedSettings(G.save.updateSettings(changes)));
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
  if (name === 'game') Game.resume();
}
let prevScene = 'title';
function goto(name) { if (['help', 'settings'].includes(name)) prevScene = G.state.scene === 'help' || G.state.scene === 'settings' ? prevScene : G.state.scene; scene(name); }

// ---------- game hooks used by the rules engine ----------
G.hooks.update = () => UI.update();
G.hooks.announce = (m) => UI.announce(m);
G.hooks.save = saveTrail;
G.hooks.finish = () => R.finishAnims();
G.hooks.say = (p, text) => R.say(p, text);
G.hooks.saveQuiz = saveQuiz;
G.hooks.dailyStart = (date) => noted(G.save.commitDailyStart(date));
G.hooks.seen = () => noted(G.save.commitSeen(G.state.asked.slice(-SEEN_MAX)));
// The Trail record: a human's play (see record.js for the intents). Achievements earned show a toast; the result goes back to the rules engine.
G.hooks.record = (intent) => {
  const r = noted(applyCommittedSettings(G.save.commitProgress({ ...intent, today: G.today() })));
  if (!r.ok) return null;
  UI.toastAchievements(r.earned);
  if (r.earned.includes('journal-full')) ui.journalCeremony = true; // played when the journal is next opened
  if (G.state.scene === 'record' || G.state.scene === 'title') UI.update();
  return r;
};
G.hooks.scene = (n) => scene(n);
// The journal's full-passport ceremony (C4-04): a bell and a burst of confetti behind the card, drawn only when motion is allowed (the line and the page stamps are drawn in CSS).
G.hooks.journalDone = () => { sfx('bell'); const n = R.towerTop(); R.burst(n.x, n.y, ['#D7263D', '#1D5BD6', '#F2A90C', '#14904A', '#FFFFFF'], 60, 'confetti'); };
// Each hop of a walk steps up the pentatonic scale and sounds from where the token is on screen.
G.hooks.moveToken = (p, path, done, mode = 'walk') => {
  let step = 0;
  R.moveAlong(p, path, () => { done(); }, { mode, speed: p.kind === 'ai' ? Game.hopScale() : 1, onHop: () => {
    if (mode === 'jump') return sfx('steam');
    const tp = R.tokenPos(p); const sx = R.worldToScreen(tp.x, tp.y)[0];
    sfx('hop', { i: step++, pan: Math.max(-0.6, Math.min(0.6, (sx / (R.view.w || 1) * 2 - 1) * 0.6)) });
  } });
};
// A short pulse of the phone's motor on a wrong answer, a stamp and the win (S4-23): where the browser can vibrate, when the Vibration setting is on
// (it is, by default) and not when the player has asked for reduced motion. A person with a touch screen sees the switch in Settings.
const HAPTICS = { miss: 20, stamp: 20, win: [20, 50, 20, 50, 25] };
function haptic(kind) {
  if (!G.state.settings.haptics || R.view.reduced || typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(HAPTICS[kind]); } catch (e) { /* a device that refuses a pulse is not an error */ }
}
G.hooks.effect = (kind, p, purpose) => {
  if (HAPTICS[kind]) haptic(kind);
  if (kind === 'miss') return R.slump(p, purpose === 'summit' || purpose === 'jury');
  const tp = R.tokenPos(p);
  if (kind === 'stamp') { sfx('stamp'); R.burst(tp.x, tp.y - 10, ['#D9A23A', '#FFFFFF', '#A9432C'], 30); }
  if (kind === 'steam') R.burst(tp.x, tp.y - 10, ['rgba(255,255,255,0.9)', 'rgba(200,230,230,0.8)'], 20);
  if (kind === 'win') { const n = R.towerTop(); R.burst(n.x, n.y, ['#D7263D', '#1D5BD6', '#F2A90C', '#14904A', '#FFFFFF'], 90, 'confetti'); }
};

function newState() {
  return { v: 1, scene: 'title', mode: null, settings: validSpeed({ ...baseSettings(), ...(G.save.data.settings || {}) }), asked: (G.save.data.seen || []).slice(-SEEN_MAX), trail: null, question: null, quiz: null, rngSeed: 1 }; // asked starts from the questions remembered from earlier visits (S3-06)
}

// ---------- actions (shared by clicks, keys and __game.act) ----------
function startTrail(opts = {}) {
  const reserved = G.save.reserveTrail();
  if (!reserved.ok && reserved.reason === 'trail-conflict') return;
  ui.saveConflict = false;
  R.resetTokens();
  Game.newTrail(opts);
  scene('game');
  UI.departure(G.state.trail);
}
function askConfirm(c) { ui.confirm = c; UI.update(); }
function startQuiz(kind, opts) { Quiz.newQuiz(kind, opts); scene('quiz'); }

const ACTIONS = {
  goto: (a) => goto(a),
  back: () => scene(G.state.trail && prevScene === 'game' ? 'game' : prevScene === 'game' ? 'title' : prevScene || 'title'),
  'continue-trail': () => {
    const saved = G.save.adoptTrail();
    if (saved && !validTrail(saved.trail)) { G.save.trailDiscarded = true; UI.update(); return; } // never adopt a trip the game cannot draw
    if (!saved) { UI.update(); return; }
    ui.saveConflict = false;
    const sq = saved.trail.phase === 'question' && validOpenQuestion(saved.trail.question) ? saved.trail.question : null; delete saved.trail.question;
    const bq = sq && getQ(sq.id); // only a question that is still in the bank, with its true answer, is brought back
    const open = bq && CAT[sq.category] && sq.choices[sq.correctIndex] === bq.answer ? sq : null;
    G.state.trail = saved.trail; G.state.mode = 'trail'; G.state.asked = [...new Set([...(G.save.data.seen || []), ...(saved.asked || [])])].slice(-SEEN_MAX); // this trip's own history, after what other visits asked
    G.rng = makeRng((Date.now() ^ performance.now()) >>> 0); // new dice and questions, not a replay of the saved ones
    syncSavedSettings();
    R.resetTokens();
    if (open) { G.state.question = open; scene('game'); } // back to the question that was on screen, with its time left
    else { scene('game'); Game.beginTurn(); }
  },
  'start-trail': () => {
    const su = ui.setup;
    const opts = { players: su.seats.map((s) => ({ name: s.name, kind: s.kind, level: s.level })), target: su.target, qdiff: su.qdiff };
    const saved = G.save.trailDiscarded ? null : G.save.data.trail;
    if (saved && saved.phase !== 'over') askConfirm({ kind: 'new-trail', round: saved.round, opts }); else startTrail(opts);
  },
  restart: () => {
    const t = G.state.trail; if (!t) return;
    const opts = { players: t.players.map((p) => ({ name: p.name, kind: p.kind, level: p.level })), target: t.target, qdiff: t.qdiff };
    if (t.phase === 'over') startTrail(opts); else askConfirm({ kind: 'restart', round: t.round, opts });
  },
  'quiz-quit': () => { const qz = G.state.quiz; if (qz && qz.idx > 0) askConfirm({ kind: 'quit-quiz' }); else scene('title'); },
  'confirm-yes': () => {
    const c = ui.confirm; ui.confirm = null;
    if (c && c.kind === 'quit-quiz') scene('title'); else if (c) startTrail(c.opts);
    UI.update();
  },
  'confirm-no': () => { ui.confirm = null; UI.update(); },
  'crash-reload': () => window.location.reload(),
  'crash-quit': () => {
    // The live state may be what broke, so store the last good turn-start snapshot rather than the current state.
    try { if (turnSnap && turnSnap.trail) G.save.commitTrail(turnSnap); } catch (e) { /* best effort */ }
    G.state.trail = null; G.state.question = null; G.state.mode = null; // drop the broken live state so the title can draw
    ui.crash = false; scene('title');
  },
  'seat-add': () => { if (ui.setup.seats.length < 6) ui.setup.seats.push({ name: '', kind: 'ai', level: 'medium' }); UI.update(); },
  'seat-remove': (a) => { ui.setup.seats.splice(+a, 1); UI.update(); },
  target: (a) => { ui.setup.target = +a; sfx('click'); UI.update(); },
  qdiff: (a) => { if (Game.QDIFF[a]) ui.setup.qdiff = a; sfx('click'); UI.update(); },
  roll: () => { if (Game.cur().kind === 'human') Game.roll(); },
  reroll: () => Game.reroll(),
  'ai-speed': () => {
    const order = Object.keys(Game.AI_PACE); const next = order[(order.indexOf(G.state.settings.aiSpeed) + 1) % order.length];
    changeSettings({ aiSpeed: next }); sfx('click'); UI.announce(`AI speed: ${UI.AI_SPEED_LABEL[next]}.`); UI.update();
  },
  express: () => { if (Game.cur().kind === 'human') Game.express(); },
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
  'trolley-open': () => { if (Game.canTrolley()) { ui.modal = 'trolley'; sfx('page'); UI.update(); } },
  trolley: (a) => { ui.modal = null; Game.trolley(+a); },
  passport: () => { ui.modal = 'passport'; sfx('page'); UI.update(); },
  'close-modal': () => { if (ui.modal === 'trolley') sfx('page'); ui.modal = null; ui.menuOpen = false; UI.update(); },
  menu: () => { ui.menuOpen = true; UI.update(); },
  zoom: () => { R.setCameraMode(R.view.mode === 'follow' ? 'fit' : 'follow'); UI.update(); },
  wear: (a) => {
    const [kind, id] = a.split(':'); const r = G.save.commitProgress({ kind: 'profile', title: kind === 'title' ? id || null : G.save.data.profile.title, cover: kind === 'cover' ? id || null : G.save.data.profile.cover });
    noted(r); sfx('click'); UI.update();
  },
  'summit-redraw': () => { if (Game.cur().kind === 'human') Game.summitRedraw(); },
  'coach-next': () => UI.coachAction('next'),
  'coach-skip': () => { changeSettings({ seenCoach: true }); UI.coachAction('skip'); UI.announce('Tips off. Turn them back on in Settings.'); },
  'coach-replay': () => { changeSettings({ seenCoach: false }); UI.coachAction('replay'); sfx('click'); UI.update(); },
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
  document.addEventListener('pointerdown', (e) => { ui.input = e.pointerType === 'touch' ? 'touch' : 'mouse'; }, true);
  document.addEventListener('click', (e) => {
    unlockAudio();
    const b = e.target.closest('[data-act]');
    if (!b) { if (e.target.closest('#panel, #modal') && !ui.modal && !ui.menuOpen && !ui.confirm) Game.skipBeat(); return; } // a tap on an AI's card or the panel skips its beat
    if (b.disabled) return;
    e.preventDefault(); act(b.dataset.act, b.dataset.arg);
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.seat !== undefined) { ui.setup.seats[+el.dataset.seat].name = el.value; }
    // While dragging, only the sound follows; the setting is saved once, on 'change'.
    if (el.dataset.setting === 'volume') { G.state.settings.volume = el.value / 100; setAudio({ on: G.state.settings.sound, volume: G.state.settings.volume }); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.seatkind !== undefined) { const [k, l] = el.value.split(':'); const s = ui.setup.seats[+el.dataset.seatkind]; s.kind = k; s.level = l || 'medium'; UI.update(); }
    if (el.dataset.setting === 'volume') { changeSettings({ volume: el.value / 100 }); sfx('coin'); }
  });
  document.querySelector('#btn-home').addEventListener('click', () => { if (G.state.scene === 'game') { ui.menuOpen = true; UI.update(); } else if (G.state.scene === 'quiz') act('quiz-quit'); else scene('title'); });
  document.querySelector('#btn-help').addEventListener('click', () => goto('help'));
  document.querySelector('#btn-settings').addEventListener('click', () => goto('settings'));
  document.querySelector('#btn-sound').addEventListener('click', () => { changeSettings({ sound: !G.state.settings.sound }); UI.update(); sfx('click'); });
  document.querySelector('#btn-zoom').addEventListener('click', () => act('zoom'));

  // Board pointer: tap a highlighted space; drag to pan when zoomed. Any space is named on hover (a mouse) or a long press (a finger).
  // A tap that moves less than TAP_SLOP px is still a tap; one that hits no destination pulses the nearest one (S1-07).
  const cv = document.querySelector('#board');
  const TAP_SLOP = 10, LONG_PRESS_MS = 450, TIP_HOLD_MS = 2200;
  let down = null, tipTimer = 0;
  const here = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const showTip = (id) => R.setTip(id, UI.spaceLabel(id));
  const endPress = () => { if (down && down.timer) clearTimeout(down.timer); down = null; };
  cv.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; // a right or middle click is not a tap
    endPress(); clearTimeout(tipTimer); R.setTip(null);
    down = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, long: false };
    cv.setPointerCapture(e.pointerId); unlockAudio();
    if (G.state.scene === 'game' && !ui.saveConflict) down.timer = setTimeout(() => { if (!down || down.moved) return; const id = R.spaceAt(...here(down.at || e)); if (id !== null) { down.long = true; showTip(id); } }, LONG_PRESS_MS);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!down) {
      if (e.pointerType === 'mouse' && G.state.scene === 'game' && !R.view.backdrop && !ui.saveConflict && !ui.menuOpen && !ui.modal) { const id = R.spaceAt(...here(e)); if (id === null) R.setTip(null); else showTip(id); }
      return;
    }
    down.at = e;
    if (!down.moved && Math.hypot(e.clientX - down.sx, e.clientY - down.sy) > TAP_SLOP) { down.moved = true; clearTimeout(down.timer); }
    if (down.moved && R.view.mode === 'follow') { R.panBy(e.clientX - down.x, e.clientY - down.y); down.x = e.clientX; down.y = e.clientY; }
  });
  cv.addEventListener('pointerleave', () => { if (!down) R.setTip(null); });
  cv.addEventListener('pointercancel', () => { endPress(); R.setTip(null); });
  cv.addEventListener('pointerup', (e) => {
    if (!down) return; const { moved, long } = down; endPress();
    if (long) { clearTimeout(tipTimer); tipTimer = setTimeout(() => R.setTip(null), TIP_HOLD_MS); return; }
    if (moved || G.state.scene !== 'game' || ui.saveConflict) return;
    const t = G.state.trail; if (t && Game.cur().kind === 'ai' && !ui.modal && !ui.menuOpen && !ui.confirm) return void Game.skipBeat(); // a tap on the board skips an AI beat
    if (!t || Game.cur().kind !== 'human') return;
    const [x, y] = here(e); const hit = R.hitDest(x, y, t);
    if (hit === null) {
      if (!ui.modal && !ui.menuOpen && !ui.confirm && (t.phase === 'choose' || t.phase === 'warp')) { const near = R.nearestDest(x, y, t); if (near !== null) { R.nudgeDest(near); UI.announce('No space there. Tap one of the lit spaces, or a numbered button.'); } }
      return;
    }
    if (t.phase === 'choose') Game.choose(hit); else if (t.phase === 'warp') Game.warp(hit);
  });

  document.addEventListener('keydown', onKey);
  window.addEventListener('error', () => UI.showCrash());
  window.addEventListener('unhandledrejection', () => UI.showCrash());
  window.addEventListener('pagehide', saveOnLeave);
  document.addEventListener('visibilitychange', () => { syncPause(); if (document.visibilityState === 'hidden') saveOnLeave(); });
}

// S1-04: a habitual double press must not do two things. A held key does nothing after its first press, and Enter, Space or R (roll, confirm,
// re-roll, answer a focused button) is ignored for KEY_GUARD_MS after the last one in a game or quiz, so the second tap of a double tap cannot
// re-roll for a ticket, pick the first destination or answer the question that has just appeared.
const KEY_GUARD_MS = 250;
let lastActKey = -1e9;
const keyGuardMs = () => (typeof window.__TEST_KEY_GUARD_MS === 'number' ? window.__TEST_KEY_GUARD_MS : KEY_GUARD_MS); // (a test widens the moment so that a slow machine cannot separate two presses)
const keyGuardLeft = () => Math.max(0, Math.round(keyGuardMs() - (performance.now() - lastActKey)));
function onKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  unlockAudio();
  if (/^(Arrow|Enter$|[a-zA-Z0-9 ]$)/.test(e.key)) ui.input = 'keys';
  const k = e.key; const ae = document.activeElement;
  const typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA');
  if (typing && k !== 'Escape') return;
  if (e.repeat && !/^(Arrow|Tab$)/.test(k)) return e.preventDefault();
  if ((k === 'Enter' || k === ' ' || k.toLowerCase() === 'r') && (G.state.scene === 'game' || G.state.scene === 'quiz')) {
    if (keyGuardLeft() > 0) return e.preventDefault();
    lastActKey = performance.now();
  }
  // S1-04: the first answer of a question that has just appeared is focused, and so is the first place of a list: an Enter or Space meant
  // for the card before it must not answer or choose. They are ignored for the same moment after a question or a list is shown.
  if ((k === 'Enter' || k === ' ') && G.state.scene === 'game' && G.state.trail && !ui.modal && !ui.menuOpen) {
    const ph = G.state.trail.phase, shown = ph === 'question' ? ui.revealAt : ph === 'choose' ? ui.listAt : -1e9;
    if (performance.now() - shown < keyGuardMs()) return e.preventDefault();
  }
  if (k.startsWith('Arrow') && G.state.scene === 'game') ui.listAt = -1e9; // a player who moves the choice knows what is under it
  // Let a focused button handle its own Enter/Space activation.
  if ((k === 'Enter' || k === ' ') && ae && ae.tagName === 'BUTTON') return;
  const st = G.state; const sc = st.scene; const lower = k.toLowerCase();
  const done = () => e.preventDefault();
  // Inside a radio group (the Settings choices, the length of a trip) the arrow keys move to the next option and choose it.
  if (ae && ae.getAttribute('role') === 'radio' && /^(Arrow(Left|Right|Up|Down)|Home|End)$/.test(k) && !ui.saveConflict && !ui.crash && !ui.confirm) {
    const opts = [...ae.parentElement.querySelectorAll('[role="radio"]')]; const i = opts.indexOf(ae);
    const to = k === 'Home' ? 0 : k === 'End' ? opts.length - 1 : (i + (k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 1) + opts.length) % opts.length;
    opts[to].click(); (document.querySelector(`[data-key="${CSS.escape(opts[to].dataset.key)}"]`) || opts[to]).focus({ preventScroll: true });
    return done();
  }
  if (ui.saveConflict) {
    if (k === 'Tab') return trapFocus(e);
    if (k === 'Escape') act('save-conflict-dismiss');
    return done();
  }
  if (ui.crash) { if (k === 'Tab') return trapFocus(e); return done(); }
  if (ui.confirm) {
    if (k === 'Tab') return trapFocus(e);
    if (k === 'Escape') act('confirm-no');
    return done();
  }
  if (lower === 'm') { document.querySelector('#btn-sound').click(); return done(); }
  if (k === '?') { goto('help'); return done(); }
  if (k === 'Tab') return trapFocus(e);
  if (sc === 'quiz') {
    const q = st.question; if (!q) return;
    if (q.chosen === null) { const i = answerKey(lower); if (i >= 0 && !q.removed.includes(i)) { act('answer', i); return done(); } }
    else if (k === 'Enter' || k === ' ') { act('quiz-next'); return done(); }
    if (k === 'Escape') { act('quiz-quit'); return done(); }
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
    if (t && !/^(Shift|Control|Alt|Meta|CapsLock|Tab|Escape)$/.test(k) && Game.skipBeat()) return done(); // any other key skips the AI's next beat
    return;
  }
  switch (t.phase) {
    case 'pass': if (k === 'Enter' || k === ' ') { act('pass'); return done(); } break;
    case 'roll':
      if (k === ' ' || lower === 'r' || k === 'Enter') { act('roll'); return done(); }
      if (lower === 't') { act('trolley-open'); return done(); }
      if (lower === 'e') { act('express'); return done(); }
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
    case 'feedback': case 'postcard': case 'orderResult': case 'jury': case 'summit': case 'stuck': case 'skipped':
      if (k === 'Enter' || k === ' ') { act('proceed'); return done(); }
      if (lower === 's' && t.phase === 'summit') { act('summit-redraw'); return done(); }
      break;
    case 'vent': if (lower === 'y') { act('vent', '1'); return done(); } if (lower === 'n') { act('vent', '0'); return done(); } break;
    case 'wager': if (/^[0-9]$/.test(k) && +k <= Game.wagerCap(p)) { act('wager', k); return done(); } break;
    case 'order': if (/^[1-3]$/.test(k)) { act('order-pick', +k - 1); return done(); } break;
    case 'warp': if (/^[1-9]$/.test(k) && +k <= t.pending.options.length) { act('warp', t.pending.options[+k - 1]); return done(); } break;
    default:
  }
}
// S6-15: a gamepad (the standard layout) plays through the same keys. The D-pad is the arrow keys, A is Enter (or the focused button), B and Start
// are Escape, X is R (roll, re-roll), Select is P (passport), the shoulder buttons are F (50/50). While a question is open A, B, X, Y answer A to D.
// In a menu, a sheet or a page the D-pad moves the focus from button to button and A presses it. A press is acted on once, when the button goes down.
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 2: 'r', 4: 'f', 5: 'f', 8: 'p', 9: 'Escape', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };
let padHeld = {};
function padPress(i) {
  unlockAudio(); ui.input = 'keys';
  const st = G.state, q = st.question;
  const over = ui.modal || ui.menuOpen || ui.confirm || ui.saveConflict || ui.crash;
  const asking = !over && q && q.chosen === null && (st.scene === 'quiz' || (st.scene === 'game' && st.trail && st.trail.phase === 'question'));
  // C4-14: the same moment the keys wait (S1-04) holds a face button back: an A that confirmed a place must not also answer the question it opened,
  // and a second A must not pick the first place of a list that has just appeared.
  const now = performance.now();
  if (asking && i <= 3 && now - ui.revealAt < keyGuardMs()) return;
  if (!over && i === 0 && st.scene === 'game' && st.trail && st.trail.phase === 'choose' && now - ui.listAt < keyGuardMs()) return;
  if (asking && i <= 3) return onKey({ key: 'abcd'[i], preventDefault() {} });
  const menuLike = over || (st.scene !== 'game' && st.scene !== 'quiz');
  if (menuLike && i >= 12 && i <= 15) {
    const root = !$modalEl().hidden ? $modalEl() : document.querySelector('#scene-' + st.scene);
    const items = root ? [...root.querySelectorAll('button:not([disabled])')].filter((b) => b.offsetParent !== null) : [];
    if (!items.length) return;
    const at = items.indexOf(document.activeElement);
    items[(at + (i === 12 || i === 14 ? -1 : 1) + items.length) % items.length].focus({ preventScroll: true });
    return;
  }
  const ae = document.activeElement;
  if (i === 0 && ae && ae.tagName === 'BUTTON' && !ae.disabled && (menuLike || !ae.closest('#topbar'))) return ae.click();
  if (PAD_KEYS[i]) onKey({ key: PAD_KEYS[i], preventDefault() {} });
}
const $modalEl = () => document.querySelector('#modal');
function pollPad() {
  let pads; try { pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : null; } catch (e) { return; }
  if (!pads) return;
  const now = {};
  for (const g of pads) if (g && g.connected) g.buttons.forEach((b, i) => { if (b && b.pressed) now[i] = true; });
  for (const i in now) if (!padHeld[i]) padPress(+i);
  padHeld = now;
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
// The AI and the auto-advancing phases hold while the tab is hidden or anything is open over the board (the pause menu, the Passport,
// the trolley sheet, the save-conflict notice), and pick up again after.
function syncPause() {
  Game.setPaused(document.visibilityState === 'hidden' || (G.state.scene === 'game' && (ui.menuOpen || !!ui.modal || ui.saveConflict)));
  setAudioPaused(G.state.scene === 'game' && ui.menuOpen);
}

// Which music and which place the sound should be in: the title's rag in menus, the board's swing in play, the ticking piece
// under a question, the climbing piece on the spur and at the Summit question; the valley's ambience, and the district of the
// active token on the board. Cheap enough for every frame: it only speaks to the audio when the answer changes.
let soundKey = '';
function syncSoundscape() {
  const st = G.state, t = st.trail; let music = 'title', ambience = 'valley', wind = 0, tension = 0;
  if (st.scene === 'quiz') { music = 'question'; const q = st.question; tension = q && q.chosen === null && q.timeMax > 0 && q.timeLeft <= 5 ? 1 : 0; }
  else if (st.scene === 'game' && t) {
    const p = Game.cur(), n = NODES[p.node], q = st.question, asking = (t.phase === 'question' || t.phase === 'feedback') && q;
    const climbing = n.district === 'mountain' || (asking && q.purpose === 'summit');
    music = climbing ? 'summit' : asking ? 'question' : 'board';
    ambience = n.district && n.district !== 'mountain' ? n.district : n.district === 'mountain' ? 'mountain' : 'valley';
    if (ambience === 'mountain') { const spur = NODES.filter((x) => x.spur); wind = Math.max(0, spur.indexOf(n)) / (spur.length - 1); }
    tension = asking && t.phase === 'question' && q.chosen === null && q.timeMax > 0 && q.timeLeft <= 5 ? 1 : 0;
  }
  const key = [music, ambience, wind.toFixed(2), tension].join('|');
  if (key !== soundKey) { soundKey = key; setSoundscape({ music, ambience, wind, tension }); }
}
let lastT = 0; let tickSec = -1; let warnKey = ''; let fpsFrames = 0;
// One bad frame must not end the loop for good: the next frame is always scheduled, and the player gets a way out.
function loop(ts) {
  try { frameStep(ts); } catch (e) { UI.showCrash(); } finally { requestAnimationFrame(loop); }
}
function frameStep(ts) {
  // Animation steps are capped at 50 ms so a stall never teleports tokens; the answer timer runs on wall-clock
  // time (capped at 0.5 s for a backgrounded tab), so a 10 s timer is 10 s even on a slow device.
  const raw = lastT ? (ts - lastT) / 1000 : 0.016; const dt = Math.min(0.05, raw); const tdt = Math.min(0.5, raw); lastT = ts; fpsFrames++;
  pollPad(); syncPause(); syncSoundscape(); UI.coachTick();
  const st = G.state;
  // question timer (humans only in the Trail Game)
  const q = st.question;
  const human = st.mode !== 'trail' || (st.trail && Game.cur().kind === 'human');
  const open = q && q.chosen === null && q.timeMax > 0 && human && !ui.modal && !ui.menuOpen && !ui.confirm && !ui.saveConflict && !ui.crash && (st.scene === 'quiz' || (st.scene === 'game' && st.trail.phase === 'question'));
  if (open) {
    q.timeLeft -= tdt;
    const sec = Math.ceil(q.timeLeft);
    if (sec !== tickSec && sec <= 5 && sec > 0) { tickSec = sec; sfx('tick', { sec }); }
    if ((sec === 10 || sec === 5) && sec < q.timeMax && warnKey !== q.id + ':' + sec) { warnKey = q.id + ':' + sec; UI.announce(`${sec} seconds left.`); }
    if (q.timeLeft <= 0) { q.timeLeft = 0; UI.announce('Time is up.'); Game.answer('timeout'); if (st.mode !== 'trail') Quiz.settle(); }
    UI.updateTimerBar();
  }
  R.frame(dt, st);
}

// ---------- test hooks ----------
function publicState() {
  const st = G.state; const t = st.trail;
  return JSON.parse(JSON.stringify({
    scene: st.scene, mode: st.mode, settings: st.settings, asked: st.asked,
    trail: t ? { target: t.target, qdiff: Game.qdiffOf(t), round: t.round, turn: t.turn, phase: t.phase, roll: t.roll, rerolled: t.rerolled, sel: t.sel,
      dests: t.dests.map((d) => d.node), destPaths: t.dests.map((d) => d.path),
      players: t.players.map(({ id, name, persona, kind, level, node, stamps, tickets, rerolls, skill, skip, correct, answered, shape, color, lap }) => ({ id, name, persona, kind, level, node, stamps, tickets, rerolls, skill, skip, correct, answered, shape, color, lap: lap | 0 })),
      pending: t.pending, winner: t.winner, lapBell: !!t.lapBell, final: t.final || null, log: t.log.slice(0, 6) } : null,
    question: st.question, quiz: st.quiz,
    board: { nodes: NODES.length, start: START, tower: TOWER, trailhead: TRAILHEAD, spurEntry: SPUR_ENTRY, trolleys: TROLLEYS, landmarks: LANDMARK, vents: VENT_PAIRS,
      types: NODES.map((n) => n.type), cats: NODES.map((n) => n.cat || null), costs: NODES.map((n) => n.cost) },
    coach: { step: ui.coachStep, tip: ui.coachSaid, input: ui.input },
    say: G.say,
    ui: { ceremony: !!ui.journalCeremony, rings: R.view.ringAlpha, ringFirst: R.view.ringFirst, frames: fpsFrames, draws: R.view.draws | 0, keyGuard: keyGuardLeft(), keyGuardMs: keyGuardMs(), listAt: ui.listAt, tip: R.view.tip ? { id: R.view.tip.id, text: R.view.tip.text } : null, nudge: R.view.nudge ? R.view.nudge.id : null, fx: { ...R.view.fx }, bubble: R.view.bubble ? R.view.bubble.text : null, modal: ui.modal, menu: ui.menuOpen, camera: R.view.mode, reduced: R.view.reduced, theme: document.body.dataset.theme, dusk: R.view.duskA, focus: document.activeElement ? (document.activeElement.dataset.key || document.activeElement.id || document.activeElement.tagName) : null },
    bank: BANK.length, storage: G.save.ok, audio: { ...audioStats },
    art: { enabled: ART.enabled, pending: ART.pending, failed: ART.failed.slice(), loaded: Object.keys(ART.imgs).filter((k) => ART.imgs[k].ok) },
  }));
}

window.__game = {
  seed(n) { G.state.rngSeed = n; G.rng = makeRng(n); return n; },
  getState: publicState,
  audioList,
  coachTexts: (input) => UI.coachTexts(input),
  voices: () => Game.AI_LINES,
  tripMinutes: (seats, target, speed) => Game.tripMinutes(seats, target, speed),
  audioRender,
  cue: sfx,
  audioState: audioInfo,
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
    if (mode === 'trail') startTrail({ players: opts.players, target: opts.target || 6, qdiff: opts.qdiff });
    else if (mode === 'daily') startQuiz('daily', { date: opts.date || G.today() });
    else startQuiz(mode, { era: opts.era });
    return publicState();
  },
  act(name, ...args) {
    const t = G.state.trail;
    switch (name) {
      case 'roll': return Game.roll(args[0]);
      case 'nearestStamp': { const n = Game.nearestStamp(); return n && { name: NODES[n.id].name, spaces: n.spaces }; }
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
      case 'express': return Game.express();
      case 'lifeline': return Game.lifeline();
      case 'pass': Game.pass(); return true;
      case 'finishAnim': R.finishAnims(); return true;
      case 'ui': act(args[0], args[1]); return true;
      case 'stopAI': Game.stopAI(); return true;
      case 'adj': return ADJ[args[0]].slice();
      case 'aiSample': return Game.aiAccuracySample(args[0], args[1], args[2]);
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
  noted(G.save.load());
  noted(G.save.settleJournal(G.today())); // C4-08, C4-04
  if (G.save.newer) UI.announce(UI.NEWER_SAVE_NOTE);
  G.state = newState();
  G.rng = makeRng((Date.now() ^ 0x5eed) >>> 0);
  ui.finishCoach = () => changeSettings({ seenCoach: true });
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
