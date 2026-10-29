# MECHANICS — Valley of Vapors Trivia Trail

The core-mechanics foundation, built from the ideas in `SAMPLES.md` (state model after boardgame.io,
mulberry32 RNG, our own exact-step path search, a named-parameter WebAudio synth).

## 1. Architecture

```
src/index.html            page shell, DOM screens, inlines everything
src/styles/main.css       theme tokens (copied from shared/design), layout, components
src/js/util.js            mulberry32 RNG (public domain, bryc), math, easing, shuffle, hashing
src/js/data.js            categories, eras, question index, adaptive picker, timeline subset
src/js/board.js           board graph: districts, nodes, edges, costs, reachable(), paths
src/js/art.js             procedural drawing: terrain, buildings, icons, tokens, steam, stamps
src/js/render.js          canvas renderer: cached background layer + dynamic layer, camera
src/js/audio.js           WebAudio synth and named sound presets
src/js/trail.js           rules engine for the board game (pure-ish functions over state)
src/js/ai.js              AI movement, wager and answer decisions by level
src/js/quiz.js            Quick 10, Era Express and Daily Challenge
src/js/ui.js              DOM screens, modals, keyboard map, ARIA live announcements
src/js/main.js            boot, main loop, save/load, window.__game hooks
data/questions.json       audited question bank  → inlined as QUESTIONS
data/timeline-lite.json   confirmed timeline events (sensitive history excluded) → inlined as TIMELINE
```
Build: `node shared/tools/inline.mjs games/trivia` → `games/trivia/index.html` (one file, no requests).
The inliner resolves imports as snapshots (`const {a} = __mN`), so modules export only constants,
functions and objects that are mutated in place (`G`, `view`), never reassigned `let` bindings.
Data tools: `tools/make-timeline-lite.mjs`, `tools/apply-audit.mjs`, `tools/write-audit-log.mjs`.

## 2. Game loop and timing

- One `requestAnimationFrame` loop. `dt` is clamped to 50 ms. Rendering runs every frame; game logic is
  event-driven (no fixed tick needed: it is a turn-based game).
- Animations are tweens in a small queue (`anim`): token hops (180 ms per space, eased, with a small
  arc), camera pans, stamp press, dice/gauge spin (700 ms), steam particle bursts.
  `isIdle()` is true when the queue is empty, the camera has settled and the modal's 0.22 s open
  transition has finished (the sheet element persists while open, so content changes do not re-animate).
- `prefers-reduced-motion` (or Settings → Motion: Reduced) sets hop time to 0 (tokens jump), disables
  camera easing, steam particles and confetti, and shortens transitions to 0 ms.
- AI "thinking" uses `setTimeout` delays (Normal 700–1400 ms; Fast 150 ms). Delays are never
  shortened in tests: tests drive human seats or call `act()`.
- Question timer: counts down in the frame loop while the question modal is open and unanswered;
  `0` means off. Timeout counts as a wrong answer.

## 3. State model (one serializable object)

```js
state = {
  v: 1, scene: 'title',               // title|setup|game|quiz|eraSelect|daily|help|settings|win|results
  mode: null,                         // 'trail'|'quick'|'era'|'daily'
  rngSeed, rngState,                  // mulberry32 seed and live state
  settings: { sound, volume, motion, timer, textScale, theme, passScreen, aiSpeed },
  asked: [ids],                       // questions used this session (no repeats)
  trail: {
    target: 6, round: 1, turn: 0,     // stamps needed, round counter, index of active player
    phase: 'roll',                    // roll|choose|moving|question|feedback|wager|order|vent|warp|summit|pass|over
    roll: null, rerolled: false, dests: [{node, path, cost}], sel: 0,
    players: [{ id, name, kind:'human'|'ai', level:'easy'|'medium'|'hard', shape, color,
                node, stamps:[cat], tickets, skill, skip, correct, answered, catStats:{cat:[c,n]} }],
    pending: { kind, node, wager, warpOptions, events },   // what the current space asked for
    log: [string], winner: null
  },
  question: { id, category, difficulty, era, text, choices:[4], correctIndex, chosen, correct,
              timeLeft, timeMax, removed:[], source, explanation, confidence, purpose },
  quiz: { kind, era, idx, total, score, streak, bestStreak, results:[{id, correct, points}], date }
}
```
Static data (board geometry, question bank, timeline) is never in `state`; nodes are referenced by id.

## 4. Rules engine (`trail.js`)

Turn state machine (`trail.phase`):

```
pass? → roll ──(roll gauge 1–6)──▶ choose ──(pick dest)──▶ moving ──▶ resolve(space)
   ▲      │ trolley (2 tickets) ─────────────────────────────┘           │
   │      └ skip (Grand Jury) ──────────────────────────────────────────┐ │
   └──────────────── endTurn ◀── feedback/postcard/vent/warp/order ◀────┘◀┘
```
- `reachable(from, steps, player)`: depth-first search over the node graph; a path may not revisit a
  node; each node has an entry cost (1, or 2 on Short Cut); destinations are nodes where the path
  cost equals `steps` exactly, **or** the Tower whenever it is reached (absorbs leftover steps). Edges
  into the spur require `stamps.length >= target`. Each destination keeps its path for animation.
- Space resolution by node type: `cat` (question of district category, tickets by difficulty), `landmark`
  (question; correct → stamp + 2 tickets), `vent` (offer ride to partner), `wager` (Post Time), `warp`
  (order three events; success → choose a missing landmark, then answer its question), `postcard`
  (+1 ticket and a timeline fact), `jury` (Legends question; wrong → skip next turn), `trolley`/`start`
  (nothing on landing; next turn may ride for 2 tickets), `trail` (nothing), `tower` (Summit question).
- Summit: hard question (falls back to medium), category from a vane spin (random 8). Correct → win.
  Wrong → back to the Grand Promenade trailhead, −1 ticket.
- Lifeline (50/50): 2 tickets, removes two wrong choices, once per question. Re-roll: 1 ticket, once
  per turn, only in `choose` before moving.

## 5. Questions and adaptive difficulty (`data.js`)

- Index by category, era and difficulty at boot. `pick({category, era, player, difficulty})`:
  1. Target difficulty from the player's `skill` s ∈ [0,1] (start 0.35): weights
     easy=(1−s)², medium=2s(1−s)+0.1, hard=s². Sample with the seeded RNG.
  2. Candidates exclude `state.asked`. If empty at that difficulty, try the nearest difficulty; if the
     category (or era) is exhausted, forget asked ids for that pool only.
  3. Choices = answer + 3 wrong, shuffled with the RNG; `correctIndex` stored.
- Skill update after each answer (Elo-like): correct → s += 0.12·(1−s)·w, wrong → s −= 0.12·s·(2.4−w),
  where w = 1 (easy), 1.4 (medium), 1.8 (hard), so hard hits gain most and easy misses cost most.
  Clamped to [0.05, 0.95].
- Confidence flags: `claim` items show a "Local claim" badge and their wording attributes the claim;
  `summary` items show a "Lightly verified" badge. Confirmed items have no badge.
- Every feedback panel shows the explanation and `Source: <source name>` (no live link: the game makes no
  requests; the URL is shown as text in the passport's "Sources" list).

## 6. AI (`ai.js`)

| Level | Accuracy easy / medium / hard | Movement | Wager |
|---|---|---|---|
| Easy | 60% / 40% / 25% | random destination 60% of the time, else greedy | 1 |
| Medium | 80% / 60% / 40% | greedy | up to 2 |
| Hard | 92% / 80% / 65% | greedy + looks one roll ahead | up to 4, more when behind |

Greedy destination score: Tower 1000 (if eligible); landmark of a missing stamp 120; spur progress when
eligible 200 − distance; time warp 60 (if stamps missing); vent 40 if the partner is nearer a missing
landmark; wager 25 if tickets ≥ 3; postcard 20; category 15; grand jury −40. Ties break by RNG.
Answers: correct with the level probability for the question difficulty (×0.9 on the summit), else a
random wrong choice. Time-warp ordering uses the same probability (medium).

## 7. Input

- **Mouse/touch:** click a highlighted destination on the board or its button in the action panel;
  buttons for everything else. Drag to pan and a zoom button on the board (mobile defaults to Follow
  camera at 1.8×).
- **Keyboard:** `Space`/`R` roll · `←/→` or `Tab` cycle destinations · `Enter` confirm · `1–4` or `A–D`
  answer · `F` 50/50 · `T` trolley · `P` passport · `Esc` menu/close · `?` help · `M` mute. All controls
  are real `<button>`s in DOM order, so `Tab` reaches everything. Focus is moved into each modal and
  returned afterwards.
- An ARIA live region announces rolls, moves, answers and stamps.

## 8. Rendering

- Canvas 2D board, world 1000×1000 units, scaled to the board element with devicePixelRatio.
- Layer 1 (cached offscreen canvas, rebuilt on resize/theme): terrain, mountains with pines, lakes with
  shoreline, Hot Springs Creek, streets, Bathhouse Row skyline, district labels, route bricks, spaces
  with icons.
- Layer 2 (every frame): destination highlights (pulsing ring + numbered badges), tokens (shape +
  color + outline), steam wisps from vents and the Row, effects (stamp burst, confetti).
- Camera: `fit` (whole map) or `follow` (zoom on the active token); smooth pan.
- DOM over canvas for HUD, panels and modals (crisp text, accessibility).

## 9. RNG

mulberry32 (`util.js`), state = one uint32 in `state.rngState`; every random choice (rolls, picks,
shuffles, AI) goes through it, so `seed(n)` makes a game fully reproducible. Daily Challenge uses a
separate RNG seeded from the date string hash (FNV-1a), so it never disturbs the main stream.

## 10. Save format

`localStorage['hs-trivia-v1']` (all access wrapped in try/catch; the game runs without storage):
```js
{ v:1, settings:{…}, best:{ quick:0, era:{id:score} }, daily:{ last:'2026-10-28', streak:3,
  results:{ '2026-10-28': {score, marks:'✔✘✔…'} } }, trail: <state.trail snapshot or null> }
```
The trail game autosaves at each `endTurn`; the title screen offers Continue when a save exists.

## 11. `window.__game` hooks

`seed(n)`, `getState()`, `setState(s)`, `isIdle()`, `scene(name)`, `newGame(opts)`,
`act(name, ...args)`; full spec in `DEV-PLAN.md` §3.
