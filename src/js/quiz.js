// Quick 10, Era Express and Daily Challenge (PRD §3, AC23–25).
import { makeRng, hash32, todayISO } from './util.js';
import { BANK, CATS, ERA_MODES, isDated, pickQuestion, makeQuestion, updateSkill } from './data.js';
import { G } from './game.js';
import { dailyTaken } from './save.js';
import { sfx } from './audio.js';

const MULT = { easy: 1, medium: 1.5, hard: 2 };
export const DAILY_LEN = 7;

export function newQuiz(kind, { era, date } = {}) {
  const total = kind === 'daily' ? DAILY_LEN : 10;
  const q = { kind, era: era || null, date: kind === 'daily' ? date || todayISO() : null, idx: -1, total, score: 0, streak: 0, bestStreak: 0, skill: 0.35, results: [], ids: [], timer: G.state.settings.timer | 0 };
  if (kind === 'daily') { q.ids = dailyIds(q.date); q.practice = dailyTaken(G.save && G.save.data.daily, q.date); } // S6-18: the first run of a date counts; a later one, finished or not, is practice
  G.state.quiz = q; G.state.mode = kind; G.state.question = null;
  next();
}

// Seven questions fixed by the date: confirmed items, seven different categories, easy → hard.
export function dailyIds(date) {
  const r = makeRng(hash32('hs-trivia-daily:' + date));
  const cats = CATS.map((c) => c.id);
  for (let i = cats.length - 1; i > 0; i--) { const j = r.int(i + 1); [cats[i], cats[j]] = [cats[j], cats[i]]; }
  const ramp = ['easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard'];
  const out = [];
  for (let k = 0; k < DAILY_LEN; k++) {
    const lasting = (q) => q.category === cats[k] && q.confidence === 'confirmed' && !isDated(q); // S4-10: nothing dated in the Daily
    let pool = BANK.filter((q) => lasting(q) && q.difficulty === ramp[k]);
    if (!pool.length) pool = BANK.filter(lasting);
    out.push(pool[r.int(pool.length)].id);
  }
  return out;
}

export function next() {
  const q = G.state.quiz;
  q.idx++;
  if (q.idx >= q.total) { finish(); return; }
  let src;
  if (q.kind === 'daily') {
    src = BANK.find((b) => b.id === q.ids[q.idx]);
  } else {
    const eras = q.kind === 'era' ? (ERA_MODES.find((m) => m.id === q.era) || ERA_MODES[0]).eras : undefined;
    src = pickQuestion(G.rng, G.state.asked, { eras, skill: q.skill });
    G.hooks.seen();
  }
  if (!src) { finish(); return; }
  // The daily uses its own RNG for choice order so every replay that day looks the same.
  const r = q.kind === 'daily' ? makeRng(hash32(q.date + src.id)) : G.rng;
  G.state.question = makeQuestion(src, r, 'quiz');
  if (q.kind === 'daily' && q.idx === 0 && !q.practice) G.hooks.dailyStart(q.date); // the date is taken from the first question on, even if this run is left unfinished
  const tm = G.state.settings.timer;
  G.state.question.timeMax = tm; G.state.question.timeLeft = tm;
  G.hooks.update();
}

// Called after answer() has marked the question.
export function settle() {
  const q = G.state.quiz; const qq = G.state.question;
  let pts = 0;
  if (qq.correct) {
    q.streak++; q.bestStreak = Math.max(q.bestStreak, q.streak);
    const base = 100 * MULT[qq.difficulty];
    const speed = qq.timeMax ? Math.round(50 * Math.max(0, qq.timeLeft) / qq.timeMax) : 0;
    const streakBonus = Math.min(0.5, 0.1 * (q.streak - 1));
    pts = Math.round(base * (1 + streakBonus)) + speed;
  } else q.streak = 0;
  q.skill = updateSkill(q.skill, qq.difficulty, qq.correct);
  q.score += pts;
  q.results.push({ id: qq.id, correct: qq.correct, points: pts, difficulty: qq.difficulty });
  qq.outcome = qq.correct ? [`+${pts} points${q.streak > 1 ? ` · streak ×${q.streak}` : ''}`] : ['Streak reset'];
  G.hooks.update();
}

function finish() {
  const q = G.state.quiz;
  q.done = true; G.state.question = null;
  sfx(q.results.filter((r) => r.correct).length >= q.total * 0.7 ? 'win' : 'page');
  G.hooks.saveQuiz(q);
  G.hooks.scene('results');
  G.hooks.update();
}

export const shareText = (q) => `Valley of Vapors Trivia Trail — Daily ${q.date}\n${q.results.map((r) => (r.correct ? '●' : '○')).join('')}  ${q.results.filter((r) => r.correct).length}/${q.total} · ${q.score} pts`;
