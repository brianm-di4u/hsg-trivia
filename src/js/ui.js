// DOM UI: scenes, side panel, modals, question card, keyboard map, live announcements.
// Rendering is "compute HTML → write only if changed" per region, preserving focus by data-key.
import { esc } from './util.js';
import { CATS, CAT, ERA, ERA_MODES, eraCount, BANK } from './data.js';
import { NODES, DISTRICTS, DISTRICT, TRAILHEAD, TOWER } from './board.js';
import { drawIcon, drawStamp, tokenPath, THEMES, TOKEN_NAMES } from './art.js';
import * as Game from './game.js';
import { G } from './game.js';
import * as Quiz from './quiz.js';
import { sfx } from './audio.js';
import * as Assets from './assets.js';

const $ = (s) => document.querySelector(s);
const last = {};
export const ui = { modal: null, setup: null, menuOpen: false, focusNext: null, modalAt: 0, revealAt: 0, revealQ: null };

// ---------- small render helpers ----------
const ico = (icon, color, ink, size = 28, cls = '') => `<canvas class="ico ${cls}" width="${size * 2}" height="${size * 2}" style="width:${size}px;height:${size}px" data-icon="${icon}" data-color="${color || ''}" data-ink="${ink}" aria-hidden="true"></canvas>`;
const tokenIco = (p, size = 22) => (Assets.has('pawn-' + p.shape)
  ? `<img class="tok pawn" src="assets/pawn-${p.shape}.webp" alt="" width="${Math.round(size * 0.87)}" height="${size}" aria-hidden="true">`
  : `<canvas class="tok" width="${size * 2}" height="${size * 2}" style="width:${size}px;height:${size}px" data-shape="${p.shape}" data-tcolor="${p.color}" aria-hidden="true"></canvas>`);
const btn = (act, label, { arg = '', cls = '', key = '', hint = '', dis = false, auto = false } = {}) =>
  `<button class="btn ${cls}" data-act="${act}" data-arg="${esc(arg)}" data-key="${esc(key || act + ':' + arg)}"${dis ? ' disabled' : ''}${auto ? ' data-autofocus' : ''}>${label}${hint ? `<span class="kbd" aria-hidden="true">${hint}</span>` : ''}</button>`;
const TICKET = '<svg class="ticket" viewBox="0 0 24 16" aria-hidden="true"><path d="M2 2h20v4a2 2 0 0 0 0 4v4H2v-4a2 2 0 0 0 0-4z" fill="currentColor"/><path d="M15 3v10" stroke="var(--color-surface)" stroke-width="1.4" stroke-dasharray="1.6 1.4"/></svg>';
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const eraName = (id) => (ERA[id] ? ERA[id].name : 'Any era');
// Painted art (assets/), used only when the manifest lists it; every use has a non-art fallback.
const artSrc = (name) => (Assets.has(name) ? `assets/${name}.webp` : null);
const DIST_OF = Object.fromEntries(DISTRICTS.map((d) => [d.cat, d]));
const SUBJECT_ART = [
  [/arlington/i, 'central', 'Central Avenue'], [/mountain tower|hot springs mountain/i, 'tower', 'Hot Springs Mountain'],
  [/oaklawn|racing|derby|thoroughbred|jockey/i, 'oaklawn', 'Oaklawn'], [/bathhouse|bath house|bathhouse row|fordyce|quapaw|buckstaff|maurice|superior|ozark|lamar|hale bath/i, 'row', 'Bathhouse Row'],
  [/lake (ouachita|hamilton|catherine)|garvan|dam\b|fishing|bass/i, 'lakes', 'The Lakes'], [/whittington|ballpark|spring training|baseball|majestic park|fogel|ban johnson/i, 'ballfields', 'The Ballfields'],
  [/happy hollow|mcleod/i, 'hollow', 'Happy Hollow'], [/park avenue|motor court|motel|velda rose/i, 'park', 'Park Avenue'], [/bridge street|parade/i, 'bridge', 'Bridge Street'],
];
function cardArt(q) {
  const text = q.text + ' ' + (q.choices[q.correctIndex] || '');
  for (const [re, key, name] of SUBJECT_ART) if (re.test(text) && artSrc('land-' + key)) return { src: artSrc('land-' + key), name };
  const d = DIST_OF[q.category]; return d && artSrc('land-' + d.key) ? { src: artSrc('land-' + d.key), name: d.name } : null;
}
const STAMP_ROT = { row: -9, bridge: 6, central: -4, oaklawn: 8, lakes: -7, ballfields: 5, hollow: -11, park: 7 };
const stampImg = (d, have, size = 92) => {
  const src = artSrc('stamp-' + d.key);
  return src ? `<img class="stampimg" src="${src}" alt="" width="${size}" height="${size}" style="--rot:${STAMP_ROT[d.key] || 0}deg" aria-hidden="true">`
    : `<canvas class="stampc" width="${size * 2}" height="${size * 2}" data-d="${d.key}" data-have="${have ? 1 : 0}" style="width:${size}px;height:${size}px" aria-hidden="true"></canvas>`;
};

function paintCanvases(root) {
  root.querySelectorAll('canvas.ico').forEach((c) => {
    const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
    const s = c.width / 2;
    if (c.dataset.color) { g.fillStyle = c.dataset.color; g.beginPath(); g.arc(s, s, s * 0.96, 0, 7); g.fill(); }
    const ink = c.dataset.ink === 'currentColor' ? getComputedStyle(c).color : c.dataset.ink;
    drawIcon(g, c.dataset.icon, s, s, s * (c.dataset.color ? 0.6 : 0.85), ink);
  });
  root.querySelectorAll('canvas.tok').forEach((c) => {
    const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); const s = c.width / 2;
    tokenPath(g, c.dataset.shape, s, s, s * 0.7); g.fillStyle = c.dataset.tcolor; g.fill(); g.lineWidth = s * 0.14; g.strokeStyle = '#141414'; g.stroke();
  });
  root.querySelectorAll('canvas.stampc').forEach((c) => {
    const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
    const d = DISTRICTS.find((x) => x.key === c.dataset.d); const T = THEMES[document.body.dataset.theme === 'dark' ? 'dark' : 'light'];
    drawStamp(g, c.width / 2, c.height / 2, c.width * 0.42, CAT[d.cat], d, c.dataset.have === '1', T, c.dataset.have === '1' ? -0.15 : 0);
  });
}

function write(el, html, key) {
  if (!el) return false;
  if (last[key] === html) return false;
  const ae = document.activeElement; const fk = ae && el.contains(ae) ? ae.dataset.key : null;
  el.innerHTML = html; last[key] = html;
  paintCanvases(el);
  const again = fk && el.querySelector(`[data-key="${CSS.escape(fk)}"]`);
  if (again) again.focus({ preventScroll: true });
  return true;
}

export function announce(msg) { const l = $('#live'); if (l) { l.textContent = ''; setTimeout(() => { l.textContent = msg; }, 30); } }

// ---------- scenes ----------
const SCENES = ['title', 'setup', 'game', 'quiz', 'era', 'results', 'help', 'settings', 'win'];
export function showScene(name) {
  G.state.scene = name;
  document.body.className = document.body.className.replace(/\bscene-\S+/g, '').trim() + ' scene-' + name;
  for (const s of SCENES) { const el = $('#scene-' + s); if (el) el.hidden = s !== name; }
  ui.modal = null; ui.menuOpen = false;
  ui.focusNext = 'scene';
  update();
}

export function update() {
  const st = G.state; const sc = st.scene;
  if (sc === 'title') write($('#scene-title'), titleHTML(), 'title');
  if (sc === 'setup') write($('#scene-setup'), setupHTML(), 'setup');
  if (sc === 'era') write($('#scene-era'), eraHTML(), 'era');
  if (sc === 'help') write($('#scene-help'), helpHTML(), 'help');
  if (sc === 'settings') write($('#scene-settings'), settingsHTML(), 'settings');
  if (sc === 'results') write($('#scene-results'), resultsHTML(), 'results');
  if (sc === 'win') write($('#scene-win'), winHTML(), 'win');
  if (sc === 'quiz') write($('#scene-quiz'), quizHTML(), 'quiz');
  if (sc === 'game') write($('#panel'), panelHTML(), 'panel');
  const m = sc === 'game' ? modalHTML() : '';
  const modal = $('#modal');
  const was = !modal.hidden;
  if (m) {
    let sheet = modal.firstElementChild;
    if (!sheet) { modal.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="mtitle"></div>'; sheet = modal.firstElementChild; last.modal = ''; }
    if (!was) { modal.hidden = false; sheet.classList.remove('enter'); void sheet.offsetWidth; sheet.classList.add('enter'); ui.modalAt = performance.now(); }
    if (write(sheet, m, 'modal') && !modal.contains(document.activeElement)) focusFirst(modal);
  } else if (was) { modal.hidden = true; last.modal = ''; modal.innerHTML = ''; if (sc === 'game') focusFirst($('#panel')); }
  document.body.classList.toggle('modal-open', !!m);
  if (ui.focusNext === 'scene') { ui.focusNext = null; const root = sc === 'game' ? (m ? modal : $('#panel')) : $('#scene-' + sc); focusFirst(root); }
  updateTopbar();
}

function focusFirst(root) {
  if (!root) return;
  const el = root.querySelector('[data-autofocus]') || root.querySelector('button:not([disabled]), input, select');
  if (el) el.focus({ preventScroll: true });
}

function updateTopbar() {
  const s = G.state.settings;
  const b = $('#btn-sound'); if (b) { b.setAttribute('aria-pressed', String(!s.sound)); b.setAttribute('aria-label', s.sound ? 'Mute sound (M)' : 'Unmute sound (M)'); b.classList.toggle('off', !s.sound); }
  const z = $('#btn-zoom'); if (z) { const v = G.view; z.textContent = v && v.mode === 'follow' ? 'Whole map' : 'Close-up'; }
}

// ---------- title ----------
function titleHTML() {
  const sv = G.save.data; const has = G.save.data.trail && G.save.data.trail.phase !== 'over';
  const daily = sv.daily && sv.daily.results && sv.daily.results[G.today()];
  const hero = artSrc('land-row');
  return `<div class="page-card title-card">
    ${hero ? `<div class="title-art"><img src="${hero}" alt="" aria-hidden="true"></div>` : ''}
    <p class="eyebrow">Hot Springs, Arkansas</p>
    <h1 class="logo">Valley of Vapors<span>Trivia Trail</span></h1>
    <p class="tag">Answer your way across the Spa City, fill your passport with landmark stamps, then race up to the Mountain Tower for the Summit question.</p>
    <div class="menu">
      ${has ? btn('continue-trail', 'Continue your trip', { cls: 'primary', auto: true }) : ''}
      ${btn('goto', 'Trail Game <small>board game · 1–6 players</small>', { arg: 'setup', cls: has ? '' : 'primary', auto: !has })}
      ${btn('quick', 'Quick 10 <small>ten questions, solo</small>')}
      ${btn('goto', 'Era Express <small>pick a period of history</small>', { arg: 'era' })}
      ${btn('daily', `Daily Challenge <small>${daily ? `done today · ${daily.score} pts` : `7 questions for ${G.today()}`}</small>`)}
    </div>
    <div class="menu small">${btn('goto', 'How to play', { arg: 'help' })}${btn('goto', 'Settings', { arg: 'settings' })}</div>
    <p class="foot">${BANK.length} sourced questions · Best Quick 10: ${sv.best.quick || '—'} · Daily streak: ${(sv.daily && sv.daily.streak) || 0}</p>
  </div>`;
}

// ---------- setup ----------
function defaultSetup() { return { seats: [{ name: '', kind: 'human', level: 'medium' }, { name: '', kind: 'ai', level: 'medium' }], target: 6 }; }
function setupHTML() {
  const su = ui.setup || (ui.setup = defaultSetup());
  const names = Game.defaultNames(su.seats);
  const rows = su.seats.map((s, i) => `<li class="seat">
      ${tokenIco({ shape: ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon'][i], color: ['#D7263D', '#1D5BD6', '#14904A', '#F2A90C', '#8A43C4', '#F4F1EA'][i] }, 26)}
      <label class="sr-only" for="seat-name-${i}">Seat ${i + 1} name (${TOKEN_NAMES[i]} token)</label>
      <input id="seat-name-${i}" data-key="name${i}" data-seat="${i}" class="seat-name" maxlength="16" placeholder="${esc(names[i])}" value="${esc(s.name)}">
      <label class="sr-only" for="seat-kind-${i}">Seat ${i + 1} player type</label>
      <select id="seat-kind-${i}" data-key="kind${i}" data-seatkind="${i}">
        ${[['human', 'Human'], ['ai:easy', 'AI · Easy'], ['ai:medium', 'AI · Medium'], ['ai:hard', 'AI · Hard']].map(([v, l]) => `<option value="${v}"${(s.kind === 'human' ? 'human' : 'ai:' + s.level) === v ? ' selected' : ''}>${l}</option>`).join('')}
      </select>
      ${su.seats.length > 1 ? btn('seat-remove', '<span aria-hidden="true">✕</span><span class="sr-only">Remove seat ' + (i + 1) + '</span>', { arg: String(i), cls: 'icon' }) : ''}
    </li>`).join('');
  return `<div class="page-card setup-card">
    <h2>Plan your trip</h2>
    <h3>Travelers <small>(${su.seats.length} of 6)</small></h3>
    <ol class="seats">${rows}</ol>
    ${su.seats.length < 6 ? btn('seat-add', '+ Add a traveler', { cls: 'ghost' }) : ''}
    <h3>Stamps to collect</h3>
    <div class="seg" role="radiogroup" aria-label="Stamps to collect">${Game.TARGETS.map((x) => `<button class="seg-b${su.target === x.n ? ' on' : ''}" role="radio" aria-checked="${su.target === x.n}" data-act="target" data-arg="${x.n}" data-key="target${x.n}">${x.label}<small>${x.n} stamps</small></button>`).join('')}</div>
    <p class="hint">Answer timer: <strong>${G.state.settings.timer ? G.state.settings.timer + ' s' : 'Off'}</strong> · change it in Settings. Hot-seat: pass the device when the screen says so.</p>
    <div class="row">${btn('goto', 'Back', { arg: 'title', cls: 'ghost' })}${btn('start-trail', 'Start the trip', { cls: 'primary' })}</div>
  </div>`;
}

// ---------- game panel ----------
// The roll shows on a steam-pressure gauge: the needle swings once per new roll, then rests on the number.
function gaugeHTML(t) {
  const key = t.round + ':' + t.turn + ':' + t.roll;
  const spin = ui.gaugeKey !== key; ui.gaugeKey = key;
  const ang = (i) => -135 + (i - 1) * 54;
  const marks = [1, 2, 3, 4, 5, 6].map((i) => {
    const a = ((ang(i) - 90) * Math.PI) / 180;
    return `<text x="${(30 + Math.cos(a) * 17).toFixed(1)}" y="${(31.6 + Math.sin(a) * 17).toFixed(1)}"${i === t.roll ? ' class="on"' : ''}>${i}</text>`;
  }).join('');
  return `<svg class="gauge${spin ? ' spin' : ''}" viewBox="0 0 60 60" style="--a:${ang(t.roll)}deg" aria-hidden="true"><circle cx="30" cy="30" r="28" class="g-rim"/><circle cx="30" cy="30" r="24.5" class="g-face"/><path class="g-arc" d="M11.6 48.4 A26 26 0 1 1 48.4 48.4"/>${marks}<g class="g-needle"><path d="M30 32 L30 10"/><circle cx="30" cy="30" r="3.4"/></g></svg>`;
}
function stampPips(p) {
  return `<span class="pips" aria-label="${p.stamps.length} stamps">${DISTRICTS.map((d) => { const have = p.stamps.includes(d.cat); const c = CAT[d.cat]; return have ? ico(c.icon, c.color, c.ink, 16, 'pip') : '<span class="pip empty"></span>'; }).join('')}</span>`;
}

function panelHTML() {
  const t = Game.T(); if (!t) return '';
  const p = Game.cur(); const ai = p.kind === 'ai';
  let action = '';
  const who = `<strong>${esc(p.name)}</strong>`;
  switch (t.phase) {
    case 'roll':
      action = ai ? `<p class="status">${who} is getting ready…</p>` :
        `${btn('roll', 'Roll the steam gauge', { cls: 'primary big', hint: 'Space', auto: true })}
         ${Game.canTrolley(p) ? btn('trolley-open', 'Ride the trolley · 2 tickets', { cls: 'ghost', hint: 'T' }) : ''}`;
      break;
    case 'choose': {
      const list = t.dests.map((d, i) => {
        const n = NODES[d.node]; const c = n.cat ? CAT[n.cat] : null;
        const kind = n.type === 'landmark' ? `Landmark · ${c.short}` : n.type === 'cat' ? c.short : { vent: 'Steam vent', wager: 'Post Time wager', warp: 'Time Warp', postcard: 'Postcard', jury: 'Grand Jury', trolley: 'Trolley stop', start: 'The Y · trolley', trailhead: 'Trailhead', trail: 'Mountain trail', tower: 'Mountain Tower!' }[n.type];
        const dn = n.district && DISTRICT[n.district] ? DISTRICT[n.district].name : n.district === 'mountain' ? 'Hot Springs Mountain' : 'Downtown';
        return `<li><button class="dest${i === t.sel ? ' sel' : ''}" data-act="choose" data-arg="${d.node}" data-key="dest${d.node}"${ai ? ' disabled' : ''} aria-current="${i === t.sel}">
          <span class="num" aria-hidden="true">${i + 1}</span>${c && (n.type === 'cat' || n.type === 'landmark') ? ico(c.icon, c.color, c.ink, 24) : ico(n.type === 'tower' ? 'tower' : n.type === 'trail' ? 'trailhead' : ({ start: 'star' }[n.type] || n.type), '', 'currentColor', 24)}
          <span class="dtext"><span class="dname">${esc(n.name)}</span><span class="dsub">${esc(kind)} · ${esc(dn)}</span></span></button></li>`;
      }).join('');
      action = `<p class="status rolled">${gaugeHTML(t)}<span>${who} rolled <span class="die" aria-label="${t.roll}">${t.roll}</span> ${ai ? 'and is choosing…' : '— pick where to stop:'}</span></p>
        <ol class="dests" aria-label="Destinations">${list}</ol>
        ${!ai && !t.rerolled ? btn('reroll', 'Re-roll · 1 ticket', { cls: 'ghost small', hint: 'R', dis: p.tickets < 1 }) : ''}`;
      break;
    }
    case 'moving': action = `<p class="status">${who} is on the move…</p>`; break;
    case 'skipped': action = `<p class="status">${who} sits out this turn.</p>`; break;
    case 'stuck': action = `<p class="status">No space is exactly ${t.roll} away — ${who} waits in the steam.</p>`; break;
    case 'landed': action = `<p class="status">${who} stops at ${esc(NODES[p.node].name)}.</p>`; break;
    case 'over': action = `<p class="status">${who} wins!</p>`; break;
    default: action = `<p class="status">${who} ${ai ? 'is thinking…' : ['question', 'feedback'].includes(t.phase) ? 'answers at ' + esc(NODES[p.node].name) : '— your move'}</p>`;
  }
  const players = t.players.map((q, i) => `<li class="pl${i === t.turn ? ' on' : ''}" style="--pc:${q.color}">${tokenIco(q, 30)}
      <span class="pname">${esc(q.name)}${q.kind === 'ai' ? ` <small>AI · ${q.level}</small>` : ''}${q.skip ? ' <small class="warn">skips next</small>' : ''}</span>
      ${stampPips(q)}<span class="pstat"><span>${q.stamps.length}/${t.target}</span><span class="tix" title="Bath tickets">${TICKET}<span class="sr-only">tickets:</span> ${q.tickets}</span></span></li>`).join('');
  const el = Game.eligible(p);
  // Where the active token stands: the district painting, its blurb and the space name.
  const here = NODES[p.node]; const hd = here.district && DISTRICT[here.district];
  const hsrc = hd ? artSrc('land-' + hd.key) : here.district === 'mountain' ? artSrc('land-tower') : artSrc('land-row');
  const hname = hd ? hd.name : here.district === 'mountain' ? 'Hot Springs Mountain' : 'Downtown';
  const herecard = hsrc ? `<figure class="here"><img src="${hsrc}" alt="" aria-hidden="true"><figcaption><strong>${esc(here.name)}</strong><span>${esc(hname)}${hd ? ' · ' + esc(hd.blurb) : ''}</span></figcaption></figure>` : '';
  return `<div class="turn" style="--pc:${p.color}">${tokenIco(p, 44)}<div><div class="tname">${esc(p.name)}’s turn</div><div class="tsub">Round ${t.round} · ${p.stamps.length}/${t.target} stamps · ${plural(p.tickets, 'ticket')}${el ? ' · <strong class="ok">Trail open!</strong>' : ''}</div></div></div>
    <div class="action">${action}</div>
    ${herecard}
    <ol class="players" aria-label="Travelers">${players}</ol>
    <div class="tools">${btn('passport', 'Passport', { cls: 'ghost small', hint: 'P' })}${btn('menu', 'Menu', { cls: 'ghost small', hint: 'Esc' })}</div>
    <ul class="log" aria-label="Recent events">${t.log.slice(0, 4).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
}

// ---------- question card ----------
export function questionCardHTML(q, { purposeLine = '', allowLifeline = false, tickets = 0, canAnswer = true } = {}) {
  const c = CAT[q.category];
  const answered = q.chosen !== null;
  const badge = q.confidence === 'claim' ? '<span class="badge claim" title="This is how the place bills itself; not independently verified.">Local claim</span>'
    : q.confidence === 'summary' ? '<span class="badge summary" title="Supported by a search summary rather than a full source read.">Lightly verified</span>' : '';
  const answers = q.choices.map((txt, i) => {
    const gone = q.removed.includes(i);
    let cls = 'ans';
    if (answered) { if (i === q.correctIndex) cls += ' right'; else if (i === q.chosen) cls += ' wrong'; else cls += ' dim'; }
    if (gone) cls += ' gone';
    const mark = answered && i === q.correctIndex ? '<span class="mark" aria-label="correct answer">✔</span>' : answered && i === q.chosen ? '<span class="mark" aria-label="your answer">✘</span>' : '';
    if (answered && i === q.correctIndex && q.correct) cls += ' burst';
    return `<button class="${cls}" data-act="answer" data-arg="${i}" data-key="ans${i}"${answered || gone || !canAnswer ? ' disabled' : ''}${!answered && i === 0 && canAnswer ? ' data-autofocus' : ''}><span class="key" aria-hidden="true">${'ABCD'[i]}</span><span class="atext">${esc(txt)}</span>${mark}</button>`;
  }).join('');
  const dist = DIST_OF[q.category];
  const art = cardArt(q); const banner = art && art.src;
  const fresh = !answered;
  if (fresh && ui.revealQ !== q.id) { ui.revealQ = q.id; ui.revealAt = performance.now(); }
  if (answered && ui.answeredQ !== q.id) { ui.answeredQ = q.id; ui.answerAt = performance.now(); }
  const slam = answered && dist && (q.outcome || []).some((o) => o.startsWith('Stamp earned')) ? `<div class="slam" aria-hidden="true">${stampImg(dist, true, 104)}</div>` : '';
  const gain = answered && q.correct ? (q.outcome || []).find((o) => /^\+\d|^Won \d/.test(o)) : null;
  const fly = gain ? `<span class="flyup" aria-hidden="true">${esc(gain.replace(/^Won /, '+'))}</span>` : '';
  const fb = answered ? `<div class="fb ${q.correct ? 'ok' : 'bad'}" role="status">${slam}${fly}
      <p class="verdict">${q.correct ? 'Correct!' : q.chosen === -1 ? 'Time’s up!' : 'Not quite.'} ${q.outcome && q.outcome.length ? `<span class="outcome">${esc(q.outcome.join(' · '))}</span>` : ''}</p>
      ${!q.correct ? `<p class="ansline">Answer: <strong>${esc(q.choices[q.correctIndex])}</strong></p>` : ''}
      <p class="expl">${esc(q.explanation)}</p>
      <p class="src">Source: ${esc(q.source)}</p></div>` : '';
  return `<div class="qcard${banner ? ' has-art' : ''}${fresh ? ' reveal' : ''}${slam ? ' slammed' : ''}" style="--cat:${c.color};--catink:${c.ink}">
    ${banner ? `<div class="qbanner"><img class="qart" src="${banner}" alt="" aria-hidden="true"><span class="qcap">Illustration · ${esc(art.name)}</span></div>` : ''}
    <div class="qhead">${ico(c.icon, c.color, c.ink, 40)}<div class="qh"><div class="qcat" id="mtitle">${esc(q.category)}</div><div class="qmeta">${DIFF_LABEL[q.difficulty]} · ${esc(eraName(q.era))}</div></div>${badge}</div>
    ${purposeLine ? `<p class="purpose">${purposeLine}</p>` : ''}
    ${q.timeMax && !answered ? `<div class="timer" role="timer" aria-label="Time left"><div class="bar" style="width:${(100 * q.timeLeft / q.timeMax).toFixed(1)}%"></div></div>` : ''}
    <h2 class="qtext">${esc(q.text)}</h2>
    <div class="answers">${answers}</div>
    ${!answered && allowLifeline ? `<div class="qtools">${btn('lifeline', '50/50 · 2 tickets', { cls: 'ghost small', hint: 'F', dis: tickets < 2 || q.removed.length > 0 })}</div>` : ''}
    ${fb}
  </div>`;
}

// ---------- game modals ----------
function modalHTML() {
  const t = Game.T(); if (!t) return '';
  if (ui.menuOpen) return menuHTML();
  if (ui.modal === 'passport') return passportHTML();
  if (ui.modal === 'trolley') return trolleyHTML();
  const p = Game.cur(); const ai = p.kind === 'ai'; const q = G.state.question; const pd = t.pending;
  const cont = (label = 'Continue') => ai ? `<p class="hint ai-note">${esc(p.name)} will continue…</p>` + btn('proceed', label + ' now', { cls: 'ghost small', hint: 'Enter' }) : btn('proceed', label, { cls: 'primary', hint: 'Enter', auto: true });
  switch (t.phase) {
    case 'pass': return `<div class="mcard center"><h2 id="mtitle">Pass the device</h2>${tokenIco(p, 56)}<p class="big">to <strong>${esc(p.name)}</strong></p><p class="hint">Others, look away from the next question!</p>${btn('pass', `I’m ${esc(p.name)} — let’s go`, { cls: 'primary', hint: 'Enter', auto: true })}</div>`;
    case 'question': case 'feedback': {
      const n = NODES[p.node];
      const stampOf = () => (DISTRICT[n.district] ? DISTRICT[n.district].stamp : '');
      const purpose = ({
        district: () => `<span class="chip-pay">+${({ easy: 1, medium: 2, hard: 3 })[q.difficulty]} ${({ easy: 1, medium: 2, hard: 3 })[q.difficulty] === 1 ? 'ticket' : 'tickets'}</span> ${esc(n.name)}`,
        landmark: () => q.hadStamp ? `${esc(n.name)} · you already hold this stamp — answer for 2 tickets` : `<strong>Landmark!</strong> Answer to win the <strong>${esc(stampOf())}</strong> stamp`,
        warpLandmark: () => `<strong>Time-warp landmark!</strong> Answer to win the <strong>${esc(stampOf())}</strong> stamp`,
        wager: () => `<strong>Post Time</strong> · wager: ${plural(q.wager || 0, 'ticket')}${q.difficulty === 'hard' ? ' · hard question pays double' : ''}`,
        jury: () => '<strong>Grand Jury</strong> · miss it and you sit out your next turn',
        summit: () => '<strong>Summit question</strong> · answer correctly to win the game!',
      }[q.purpose] || (() => ''))();
      const card = questionCardHTML(q, { purposeLine: purpose, allowLifeline: !ai, tickets: p.tickets, canAnswer: !ai });
      return `${ai && q.chosen === null ? `<p class="ai-banner">${esc(p.name)} is answering…</p>` : ''}${card}${q.chosen !== null ? `<div class="mfoot">${cont(q.purpose === 'summit' && q.correct ? 'Celebrate' : 'Continue')}</div>` : ''}`;
    }
    case 'vent': {
      const to = NODES[pd.to];
      return `<div class="mcard"><div class="mhead">${ico('vent', '#2A9D8F', '#FFFFFF', 44)}<h2 id="mtitle">Steam vent</h2></div>
        <p>The springs average about 143 °F. Ride the steam to <strong>${esc(to.name)}</strong> in ${esc(DISTRICT[to.district].name)}?</p>
        ${NODES[p.node].district === 'row' || to.district === 'row' ? '<p class="fact">Hot Springs Creek runs in a tunnel under Bathhouse Row and empties into Lake Hamilton.</p>' : ''}
        <div class="row">${ai ? '<p class="hint">Deciding…</p>' : btn('vent', 'Ride the steam', { arg: '1', cls: 'primary', hint: 'Y', auto: true }) + btn('vent', 'Stay here', { arg: '0', cls: 'ghost', hint: 'N' })}</div></div>`;
    }
    case 'wager': {
      const max = Math.min(5, p.tickets);
      const opts = Array.from({ length: max + 1 }, (_, i) => btn('wager', String(i), { arg: String(i), cls: 'chip' + (i === Math.min(2, max) ? ' primary' : ''), hint: '', auto: i === Math.min(2, max), dis: ai })).join('');
      return `<div class="mcard"><div class="mhead">${ico('wager', '#56B4E9', '#10233A', 44)}<h2 id="mtitle">Post Time at Oaklawn</h2></div>
        <p>Wager up to 5 of your ${plural(p.tickets, 'ticket')} on the next question (any category). Right: win the wager — <strong>double</strong> on a hard question. Wrong: lose it.</p>
        <div class="chips" aria-label="Wager">${opts}</div>${ai ? '<p class="hint">Placing a bet…</p>' : '<p class="hint key-hint">Keys 0–5</p>'}</div>`;
    }
    case 'order': case 'orderResult': {
      const done = t.phase === 'orderResult';
      const evs = pd.events;
      const right = [0, 1, 2].sort((a, b) => evs[a].y - evs[b].y);
      const items = evs.map((e, i) => {
        const at = pd.picks.indexOf(i);
        return `<button class="ev${at >= 0 ? ' picked' : ''}" data-act="order-pick" data-arg="${i}" data-key="ev${i}"${done || at >= 0 || ai ? ' disabled' : ''}${!done && i === 0 ? ' data-autofocus' : ''}>
          <span class="evn" aria-hidden="true">${at >= 0 ? at + 1 : '·'}</span><span class="evt">${esc(e.e)}${done ? ` <strong class="yr">${e.y}</strong>` : ''}</span><span class="kbd" aria-hidden="true">${i + 1}</span></button>`;
      }).join('');
      return `<div class="mcard"><div class="mhead">${ico('warp', '#5B4A8B', '#FFFFFF', 44)}<h2 id="mtitle">Time Warp</h2></div>
        <p>${done ? (pd.ok ? '<strong class="ok">In order — the time warp opens!</strong> Next, choose a landmark to warp to.' : '<strong class="bad">Not quite.</strong> The right order:') : 'Tap the events from <strong>oldest</strong> to <strong>newest</strong>.'}</p>
        <div class="events">${items}</div>
        ${done ? `<ol class="order-key">${right.map((i) => `<li><strong>${evs[i].y}</strong> ${esc(evs[i].e)} <small>(${esc(evs[i].s)})</small></li>`).join('')}</ol><div class="mfoot">${cont()}</div>` : ''}</div>`;
    }
    case 'warp': {
      const list = pd.options.map((id, i) => { const n = NODES[id]; const c = n.cat ? CAT[n.cat] : null; return btn('warp', `${c ? ico(c.icon, c.color, c.ink, 22) : ''}<span>${esc(n.name)}</span><small>${esc(DISTRICT[n.district] ? DISTRICT[n.district].name : '')}</small>`, { arg: String(id), cls: 'listb', hint: String(i + 1), auto: i === 0, dis: ai }); }).join('');
      return `<div class="mcard"><div class="mhead">${ico('warp', '#5B4A8B', '#FFFFFF', 44)}<h2 id="mtitle">Warp to a landmark</h2></div><p>Pick a landmark you don’t have yet. You’ll answer its question right away.</p><div class="list">${list}</div></div>`;
    }
    case 'postcard': {
      const ev = pd.ev; const era = ERA[ev.era];
      return `<div class="mcard postcard"><div class="pc-stamp" aria-hidden="true">${ev.y}</div><p class="pc-greet" id="mtitle">Greetings from Hot Springs</p>
        <p class="pc-year">${ev.y} · ${esc(era ? era.name : '')}</p><p class="pc-text">${esc(ev.e)}</p><p class="src">Source: ${esc(ev.s)}</p><p class="outcome">+1 ticket</p><div class="mfoot">${cont()}</div></div>`;
    }
    case 'jury': return `<div class="mcard"><div class="mhead">${ico('jury', '#9A2A1C', '#FFFFFF', 44)}<h2 id="mtitle">Grand Jury!</h2></div><p>You’ve been called before the grand jury. Answer a <strong>Legends &amp; Oddities</strong> question, or sit out your next turn.</p><div class="mfoot">${cont('Face the jury')}</div></div>`;
    case 'summit': {
      const c = CAT[pd.cat];
      const tw = artSrc('land-tower');
      return `<div class="mcard center summit">${tw ? `<div class="mbanner"><img src="${tw}" alt="" aria-hidden="true"></div>` : ''}<div class="mhead">${ico('tower', '#8C877C', '#FFFFFF', 44)}<h2 id="mtitle">The Summit question</h2></div><p>You climbed to the 216-ft Mountain Tower. The weather vane swings to…</p><p class="vane">${ico(c.icon, c.color, c.ink, 48)}<strong>${esc(c.id)}</strong></p><p class="hint">A hard question. Get it right to win; miss and you head back to the trailhead.</p><div class="mfoot">${cont('Take the question')}</div></div>`;
    }
    default: return '';
  }
}

function passportHTML() {
  const t = Game.T(); const p = Game.cur();
  const stamps = DISTRICTS.map((d) => { const have = p.stamps.includes(d.cat); const cs = p.catStats[d.cat] || [0, 0];
    return `<li class="stamp${have ? ' have' : ''}">${stampImg(d, have)}
      <div><strong>${esc(d.name)}</strong><small>${esc(d.cat)} · ${have ? 'stamped' : 'not yet'}</small><small>${esc(d.blurb)}</small><small>${cs[1] ? `${cs[0]}/${cs[1]} right` : 'no questions yet'}</small></div></li>`; }).join('');
  return `<div class="mcard passport"><div class="pp-cover"><span class="pp-seal" aria-hidden="true">♨</span><h2 id="mtitle">${esc(p.name)}’s passport</h2><span class="pp-sub">Valley of Vapors · Hot Springs</span></div>
    <p>${p.stamps.length} of ${t.target} stamps needed · ${plural(p.tickets, 'ticket')} · ${p.answered ? Math.round((100 * p.correct) / p.answered) : 0}% right</p>
    <ul class="stamps">${stamps}</ul>
    <p class="hint">Stamps come from answering correctly on a district’s gold-ringed landmark. ${Game.eligible(p) ? 'Your trail to the Mountain Tower is open — head to the Grand Promenade trailhead behind Bathhouse Row.' : ''}</p>
    <div class="mfoot">${btn('close-modal', 'Close', { cls: 'primary', hint: 'Esc', auto: true })}</div></div>`;
}

function trolleyHTML() {
  const list = Game.trolleyOptions().map((id, i) => { const n = NODES[id]; return btn('trolley', `${ico('trolley', '', 'currentColor', 22)}<span>${esc(n.name)}</span><small>${esc(n.district ? DISTRICT[n.district].name : 'The Y')}</small>`, { arg: String(id), cls: 'listb', hint: String(i + 1), auto: i === 0 }); }).join('');
  return `<div class="mcard"><div class="mhead">${ico('trolley', '#1F2F5C', '#FFFFFF', 44)}<h2 id="mtitle">Ride the trolley</h2></div><p>Pay 2 tickets to ride to another stop. Your turn ends there.</p><div class="list">${list}</div><div class="mfoot">${btn('close-modal', 'Cancel', { cls: 'ghost', hint: 'Esc' })}</div></div>`;
}

function menuHTML() {
  return `<div class="mcard center"><h2 id="mtitle">Paused</h2><div class="menu">${btn('close-modal', 'Resume', { cls: 'primary', auto: true })}${btn('goto', 'How to play', { arg: 'help' })}${btn('goto', 'Settings', { arg: 'settings' })}${btn('restart', 'Restart this trip')}${btn('goto', 'Save &amp; quit to title', { arg: 'title' })}</div></div>`;
}

// ---------- quiz scene ----------
function quizHTML() {
  const qz = G.state.quiz; const q = G.state.question; if (!qz || !q) return '';
  const title = qz.kind === 'daily' ? `Daily Challenge · ${qz.date}` : qz.kind === 'era' ? `Era Express · ${esc((ERA_MODES.find((m) => m.id === qz.era) || {}).label || '')}` : 'Quick 10';
  const tint = qz.kind === 'era' ? qz.era : 'any';
  return `<div class="quiz-wrap" data-era="${tint}">
    <div class="quiz-top"><span class="qt-title">${title}</span><span class="qt-prog" aria-label="Question ${qz.idx + 1} of ${qz.total}">${qz.idx + 1} / ${qz.total}</span><span class="qt-score">${qz.score} pts${qz.streak > 1 ? ` · streak ${qz.streak}` : ''}</span></div>
    <div class="dots" aria-hidden="true">${Array.from({ length: qz.total }, (_, i) => `<span class="${i < qz.results.length ? (qz.results[i].correct ? 'y' : 'n') : i === qz.idx ? 'cur' : ''}"></span>`).join('')}</div>
    ${questionCardHTML(q)}
    ${q.chosen !== null ? `<div class="mfoot">${btn('quiz-next', qz.idx + 1 >= qz.total ? 'See results' : 'Next question', { cls: 'primary', hint: 'Enter', auto: true })}</div>` : `<div class="mfoot">${btn('goto', 'Quit', { arg: 'title', cls: 'ghost small' })}</div>`}
  </div>`;
}

function resultsHTML() {
  const qz = G.state.quiz; if (!qz) return '';
  const right = qz.results.filter((r) => r.correct).length;
  const best = qz.kind === 'quick' ? G.save.data.best.quick : qz.kind === 'era' ? (G.save.data.best.era || {})[qz.era] : null;
  const rows = qz.results.map((r) => { const b = BANK.find((x) => x.id === r.id); return `<li class="${r.correct ? 'y' : 'n'}"><span aria-label="${r.correct ? 'correct' : 'wrong'}">${r.correct ? '✔' : '✘'}</span> ${esc(b.question)} <small>— ${esc(b.answer)}</small></li>`; }).join('');
  const title = qz.kind === 'daily' ? `Daily Challenge · ${qz.date}` : qz.kind === 'era' ? `Era Express · ${esc((ERA_MODES.find((m) => m.id === qz.era) || {}).label || '')}` : 'Quick 10';
  return `<div class="page-card results-card"><p class="eyebrow">${title}</p><h2>${right} of ${qz.total} right</h2>
    <p class="score">${qz.score} points · best streak ${qz.bestStreak}${best ? ` · personal best ${best}` : ''}</p>
    ${qz.kind === 'daily' ? `<p>Daily streak: <strong>${(G.save.data.daily && G.save.data.daily.streak) || 1}</strong></p><label for="share" class="sr-only">Share text</label><textarea id="share" readonly rows="3" data-key="share">${esc(Quiz.shareText(qz))}</textarea>${btn('copy-share', 'Copy result')}` : ''}
    <ol class="review">${rows}</ol>
    <div class="row">${btn('goto', 'Title', { arg: 'title', cls: 'ghost' })}${qz.kind === 'daily' ? '' : btn(qz.kind === 'era' ? 'era-start' : 'quick', 'Play again', { arg: qz.era || '', cls: 'primary', auto: true })}</div></div>`;
}

function eraHTML() {
  const cards = ERA_MODES.map((m, i) => { const e = ERA[m.eras[m.eras.length - 1]]; const first = ERA[m.eras[0]];
    const yrs = m.eras.length > 1 ? `before ${e.end + 1}` : `${e.start}–${e.end}`;
    return `<button class="era-card" data-era="${m.id}" data-act="era-start" data-arg="${m.id}" data-key="era${m.id}"${i === 0 ? ' data-autofocus' : ''}>
      <span class="era-name">${esc(m.label)}</span><span class="era-yrs">${yrs} · ${eraCount(m)} questions</span><span class="era-sum">${esc(m.eras.length > 1 ? first.summary + ' ' + e.summary : e.summary)}</span></button>`; }).join('');
  return `<div class="page-card era-page"><h2>Era Express</h2><p>Ten questions from one chapter of Hot Springs history.</p><div class="eras">${cards}</div><div class="row">${btn('goto', 'Back', { arg: 'title', cls: 'ghost' })}</div></div>`;
}

function winHTML() {
  const t = Game.T(); if (!t || t.winner === null) return '';
  const w = t.players[t.winner];
  const order = t.players.slice().sort((a, b) => (b.id === t.winner) - (a.id === t.winner) || b.stamps.length - a.stamps.length || b.tickets - a.tickets);
  const tw = artSrc('land-tower');
  const podium = order.slice(0, 3).map((p, i) => `<li class="pod p${i + 1}"><span class="place">${['1st', '2nd', '3rd'][i]}</span>${tokenIco(p, 30)}<strong>${esc(p.name)}</strong><span class="pstamps">${DISTRICTS.map((d) => (p.stamps.includes(d.cat) ? `<span class="mini" style="--c:${CAT[d.cat].color}" title="${esc(d.stamp)}"></span>` : '')).join('')}</span><small>${plural(p.stamps.length, 'stamp')} · ${plural(p.tickets, 'ticket')}</small></li>`).join('');
  return `<div class="page-card win-card">${tw ? `<div class="win-art"><img src="${tw}" alt="" aria-hidden="true"></div>` : ''}<p class="eyebrow">Summit reached · round ${t.round}</p><div class="plinth" aria-hidden="true">${tokenIco(w, 96)}<span class="plinth-top"></span></div><div class="win-stamps" aria-hidden="true">${DISTRICTS.filter((d) => w.stamps.includes(d.cat)).map((d, i) => `<span style="--i:${i}">${stampImg(d, true, 46)}</span>`).join('')}</div><h2>${esc(w.name)} conquered the Mountain Tower!</h2>
    <p>Three towers have stood on Hot Springs Mountain since 1877; today’s rises 216 feet.</p>
    <ol class="podium">${podium}</ol>
    <table class="standings"><thead><tr><th>Traveler</th><th>Stamps</th><th>Tickets</th><th>Right</th></tr></thead><tbody>
    ${order.map((p) => `<tr><td>${tokenIco(p, 18)} ${esc(p.name)}</td><td>${p.stamps.length}</td><td>${p.tickets}</td><td>${p.correct}/${p.answered}</td></tr>`).join('')}</tbody></table>
    <div class="row">${btn('goto', 'Title', { arg: 'title', cls: 'ghost' })}${btn('restart', 'Play again', { cls: 'primary', auto: true })}</div></div>`;
}

// ---------- help & settings ----------
function helpHTML() {
  const legend = CATS.map((c) => { const d = DISTRICTS.find((x) => x.cat === c.id); return `<li>${ico(c.icon, c.color, c.ink, 30)}<span><strong>${esc(c.id)}</strong><small>${esc(d.name)} · stamp: ${esc(d.stamp)}</small></span></li>`; }).join('');
  const sp = [['landmark', 'star', 'Landmark (gold ring): answer correctly for the district stamp + 2 tickets'], ['vent', 'vent', 'Steam vent: ride to the paired vent across town'], ['wager', 'wager', 'Post Time (Oaklawn): wager 0–5 tickets on a question'], ['warp', 'warp', 'Time Warp: put three events in order, then warp to a landmark'], ['postcard', 'postcard', 'Postcard: a piece of history and 1 ticket'], ['jury', 'jury', 'Grand Jury: miss a Legends question and lose a turn'], ['trolley', 'trolley', 'Trolley stop: next turn, pay 2 tickets to ride to another stop'], ['trail', 'trailhead', 'Mountain trail: opens once you hold your stamp target. Short Cut spaces cost 2 steps']];
  return `<div class="page-card help-card"><h2>How to play</h2>
    <p><strong>Goal:</strong> collect your stamp target (4, 6 or 8 district stamps), climb from the Grand Promenade trailhead to the Mountain Tower, and answer the Summit question.</p>
    <ol class="rules"><li>Roll the steam gauge (1–6) and move exactly that many spaces, either way. Highlighted spaces show where you can stop.</li>
    <li>Answer the question for the space. District spaces pay tickets (Easy 1, Medium 2, Hard 3).</li>
    <li>Spend tickets on a 50/50 (2), a re-roll (1) or the trolley (2). Win more at Post Time.</li>
    <li>After every answer you’ll see what’s true and where it comes from.</li></ol>
    <h3>Districts and categories</h3><ul class="legend">${legend}</ul>
    <h3>Special spaces</h3><ul class="legend">${sp.map(([, i, t]) => `<li>${ico(i, '', 'currentColor', 26)}<span>${t}</span></li>`).join('')}</ul>
    <h3>Keyboard</h3><p class="keys"><kbd>Space</kbd> roll · <kbd>←</kbd><kbd>→</kbd> or <kbd>1</kbd>–<kbd>9</kbd> pick a space · <kbd>Enter</kbd> confirm / continue · <kbd>A</kbd>–<kbd>D</kbd> or <kbd>1</kbd>–<kbd>4</kbd> answer · <kbd>F</kbd> 50/50 · <kbd>R</kbd> re-roll · <kbd>T</kbd> trolley · <kbd>P</kbd> passport · <kbd>Z</kbd> zoom · <kbd>M</kbd> mute · <kbd>Esc</kbd> menu</p>
    <h3>About the facts</h3><p>Questions come from a sourced research corpus and were audited against their sources. “Local claim” marks how a place bills itself. Real Hot Springs places appear as setting only; no business, park or school endorses or is affiliated with this game. Characters are fictional.</p>
    <h3>About the map</h3><p>The board is a model of the real valley, seen from the west: Bathhouse Row’s eight bathhouses stand in their true north-to-south order (Superior, Hale, Maurice, Fordyce, Quapaw, Ozark, Buckstaff, Lamar), with Hot Springs Mountain and its tower behind. Downtown is magnified and Central Avenue is drawn wider so both sidewalks can carry spaces; directions from the Row are true. Oaklawn and the three lakes are moved closer and ringed with a dashed line, and their plates give the real distance. The paintings on question cards are illustrations, not photographs.</p>
    <p class="hint">Terrain: USGS 3DEP. Streets: US Census TIGER. Lakes and creeks: USGS National Hydrography Dataset (all public domain). Building footprints and trails: © OpenStreetMap contributors (ODbL).</p>
    <div class="row">${btn('back', 'Back', { cls: 'primary', auto: true })}</div></div>`;
}

function settingsHTML() {
  const s = G.state.settings;
  const seg = (key, opts) => `<div class="seg" role="radiogroup" aria-label="${key}">${opts.map(([v, l]) => `<button class="seg-b${String(s[key]) === String(v) ? ' on' : ''}" role="radio" aria-checked="${String(s[key]) === String(v)}" data-act="set" data-arg="${key}=${v}" data-key="set-${key}-${v}">${l}</button>`).join('')}</div>`;
  return `<div class="page-card settings-card"><h2>Settings</h2>
    <h3>Sound</h3>${seg('sound', [[true, 'On'], [false, 'Off']])}
    <label class="slider">Volume <input type="range" min="0" max="100" value="${Math.round(s.volume * 100)}" data-key="volume" data-setting="volume" aria-label="Volume"></label>
    <h3>Answer timer</h3>${seg('timer', [[0, 'Off'], [30, '30 s'], [20, '20 s'], [10, '10 s']])}
    <h3>Motion</h3>${seg('motion', [['auto', 'System'], ['full', 'Full'], ['reduced', 'Reduced']])}
    <h3>Text size</h3>${seg('textScale', [[1, '100%'], [1.15, '115%'], [1.3, '130%']])}
    <h3>Theme</h3>${seg('theme', [['auto', 'System'], ['light', 'Day'], ['dark', 'Night']])}
    <h3>Hot-seat pass screen</h3>${seg('passScreen', [[true, 'On'], [false, 'Off']])}
    <h3>AI speed</h3>${seg('aiSpeed', [['normal', 'Normal'], ['fast', 'Fast']])}
    <div class="row">${btn('back', 'Done', { cls: 'primary' })}</div></div>`;
}

export function updateTimerBar() {
  const q = G.state.question; const bar = document.querySelector('.qcard .timer .bar');
  if (bar && q && q.timeMax) { bar.style.width = (100 * Math.max(0, q.timeLeft) / q.timeMax).toFixed(1) + '%'; bar.classList.toggle('low', q.timeLeft < 5); }
}
