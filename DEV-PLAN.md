# DEV-PLAN — Valley of Vapors Trivia Trail

## 1. Milestones

| Milestone | Goal | Tasks |
|---|---|---|
| **M1 Foundation** | Builds, boots, draws the map, hooks work | `src/` skeleton + inliner build; tokens copied into CSS; mulberry32; data index; board graph from waypoints; cached background renderer (terrain, lakes, streets, Row, route, spaces, icons); title screen; `window.__game` (seed/getState/setState/isIdle/scene/newGame/act) |
| **M2 Core loop** | One full turn cycle works | setup screen; roll → reachable → choose → animated move; question card with 4 choices, feedback, explanation, source; tickets; landmark stamps; passport; turn rotation; AI (all levels); win on Summit |
| **M3 Full rules & content** | Every rule and mode | vents, Post Time, Time Warp ordering + warp, postcards, Grand Jury, trolley, re-roll, 50/50, trail gating + Short Cut cost + Tower absorb; pass screen; autosave/continue; Quick 10; Era Express; Daily Challenge + share text; audited bank merged |
| **M4 Polish, audio, a11y** | Feels finished | WebAudio synth + all cues; steam particles, stamp burst, confetti; camera follow/zoom; keyboard map + focus management + live region; timers; reduced motion; text size; light/dark; mobile layout; help + settings content |
| **M5 Optimize & release** | Ship | measure fps/heap/size; trim; final full-matrix run at both viewports; REPORT.md |

## 2. Task notes

- Background layer is drawn once to an offscreen canvas per (size, theme) and blitted each frame.
- Question bank is inlined via `<!-- @inline ../data/questions.json as QUESTIONS -->` (the inliner
  resolves paths from `src/`, and the audited bank lives in `games/trivia/data/`).
- Timeline subset: `data/timeline-lite.json` (confirmed events with year ≥ 1541, fields year/era/event/source)
  generated from `research/timeline.json` by `tools/make-timeline-lite.mjs`.

## 3. `window.__game` hook spec

| Call | Returns / effect |
|---|---|
| `seed(n)` | reseeds the main RNG; returns `n` |
| `getState()` | `{ scene, mode, settings, asked, trail:{target, round, turn, phase, roll, dests:[nodeIds], players:[{name, kind, level, node, stamps, tickets, skill, skip}], pending, winner}, question:{id, category, difficulty, era, choices, correctIndex, chosen, correct, timeLeft, removed, confidence, source, explanation}, quiz, board:{nodes, trailhead, tower, vents, trolleys, landmarks:{cat:nodeId}}, ui:{modal, camera} }` |
| `setState(s)` | deep-merges `s` into `state` (e.g. move a player, give stamps), re-renders; returns `true` |
| `isIdle()` | `true` when no tween, camera pan or modal transition is running |
| `scene(name)` | `title`, `setup`, `game`, `help`, `settings`, `quick`, `era`, `daily`, `passport`, `win`, `results` |
| `newGame(opts)` | `opts = { mode:'trail'|'quick'|'era'|'daily', players:[{name, kind, level}], target, era, date, seed }` |
| `act('roll', n?)` | rolls (forced value `n` if given) |
| `act('choose', nodeIdOrIndex)` | picks a destination and moves (animation still runs) |
| `act('answer', i | 'correct' | 'wrong')` | answers the open question |
| `act('continue')` | closes feedback/postcard/etc. and advances |
| `act('wager', n)` / `act('order', [i,j,k])` / `act('vent', bool)` / `act('warp', nodeId)` / `act('trolley', nodeId)` / `act('reroll')` / `act('lifeline')` / `act('pass')` | the matching player decisions |
| `act('finishAnim')` | completes all running tweens immediately |

## 4. Test matrix

All tests in `tests/*.test.mjs`, both viewports unless noted. Screenshot names are per viewport under
`screenshots/<milestone>/<viewport>/`.

| AC | Test (file › name) | Screenshot(s) |
|---|---|---|
| AC1 | `perf.test.mjs` › bank is the audited copy (511 questions, dropped id absent, no "via search", 3 distractors each) | — |
| AC2, AC3 | `trail.test.mjs` › question, feedback with explanation and source; claim badge | `05-question`, `06-feedback-correct`, `07-feedback-wrong`, `07b-claim-badge` |
| AC4, AC5 | `perf.test.mjs` › 60 Quick 10 questions without a repeat; skill rises/falls | — |
| AC6 | `setup.test.mjs` › six seats with AI levels | `02-setup` |
| AC7, AC8 | `trail.test.mjs` › roll highlights exact destinations; choose moves token | `03-board-start`, `04-destinations`, `04b-moved` |
| AC9, AC10 | `trail.test.mjs` › landmark stamp and passport | `28-stamp-burst`, `08-passport` |
| AC11 | `specials.test.mjs` › vent ride | `11-vent` |
| AC12 | `specials.test.mjs` › post time wager | `09-wager` |
| AC13 | `specials.test.mjs` › time warp ordering + warp | `10-timewarp`, `10b-warp-choose` |
| AC14 | `specials.test.mjs` › postcard | `12-postcard` |
| AC15 | `specials.test.mjs` › grand jury skip | `13-grandjury` |
| AC16 | `specials.test.mjs` › trolley ride | `14-trolley` |
| AC17 | `specials.test.mjs` › trail gating and short cut cost; summit win; summit miss | `15-trail-locked`, `16a-summit-intro`, `16-summit`, `17-win` |
| AC18 | `specials.test.mjs` › lifeline and reroll | `18-lifeline` |
| AC19 | `ai.test.mjs` › three AI seats play four rounds unattended; accuracy ordered by level (600 draws each) | `19-ai-turn` |
| AC20 | `trail.test.mjs` › pass screen between humans | `20-pass` |
| AC21 | `specials.test.mjs` › win screen | `17-win` |
| AC22 | `trail.test.mjs` › autosave + continue | `21-continue` |
| AC23 | `modes.test.mjs` › quick 10 | `22-quick-q`, `22b-quick-feedback`, `23-quick-results` |
| AC24 | `modes.test.mjs` › era express | `24-era-select`, `25-era-q` |
| AC25 | `modes.test.mjs` › daily deterministic | `26-daily-q`, `27-daily-results` |
| AC26, AC27 | `visual.test.mjs` › title, board art, effects | `01-title`, `03-board-start`, `28-stamp-burst` |
| AC28 | `visual.test.mjs` › synthesized audio after a gesture; M mutes (desktop) | — |
| AC29 | `visual.test.mjs` › help and settings | `29-help`, `30-settings` |
| AC30 | `a11y.test.mjs` › keyboard-only game: roll, choose, answer, continue | `31-keyboard-focus` |
| AC31 | `visual.test.mjs` (inspection) › icons + labels, token shapes | `03-board-start`, `08-passport` |
| AC32 | `a11y.test.mjs` › answer timer runs out | `32a-timer-running`, `32-timeout` |
| AC33 | `a11y.test.mjs` › reducedMotion: moves finish instantly | `33-reduced-motion` |
| AC34 | `a11y.test.mjs` › large text; dark theme | `34-text-large`, `35-dark-board`, `35b-dark-question`, `35c-dark-feedback`, `35d-dark-title` |
| AC35 | every test calls `t.checkLayout()`; mobile shots inspected for 44 px targets | all mobile shots |
| AC36 | harness (requests/console) + `perf.test.mjs` › file size | — |
| AC37 | `perf.test.mjs` › fps, heap, loadMs (desktop) | — |
| AC38 | `a11y.test.mjs` › storage blocked still boots and plays | `36-no-storage` |

## 5. Defect log

| # | Milestone | Found by | Defect | Fix | Status |
|---|---|---|---|---|---|
| D1 | M1 | screenshots 01/03 | Shots took 5 s: the title backdrop's slow camera drift kept `isIdle()` false | `camSettled()` ignores the drifting backdrop camera | fixed |
| D2 | M1 | screenshot 03 | "Mountain Tower" sign and the Park Avenue hotel vignette overlapped; the "Bathhouse Row" sign covered a Row space | Hotel moved onto Sugarloaf (850,160), tower sign lowered, Row sign moved east of the route | fixed |
| D3 | M1/M3 | screenshots 03, 08 | Food & Culture "smoker" icon read as a llama on spaces and stamps | Replaced with a plate + fork + knife icon | fixed |
| D4 | M1 | screenshot 29 | Legends "merman" icon read as a telephone handset | Redrawn as head, arms, curling tail and forked fin | fixed |
| D5 | M1 | screenshot 29 | Help-legend icons drawn with `currentColor`, which canvas ignores (black in dark mode) | Resolve `currentColor` from computed style before drawing | fixed |
| D6 | M1 | screenshot 04 | Duplicate "Close-up" buttons (panel and board); the board one was transparent over the map | Panel copy removed; board button gets an opaque background | fixed |
| D7 | M2 | test | Summit modal threw: purpose lines were all evaluated eagerly, and the tower has no district stamp | Purpose lines built lazily per purpose | fixed |
| D8 | M2 | test | Time-warp test reset `pending` and lost the events (test bug) | Removed the reset | fixed |
| D9 | M3 | screenshots 05–07 | Modal captured mid-fade (map showed through the card); every modal update rebuilt the sheet and replayed the animation | Persistent sheet, animation only on open; `isIdle()` waits for the 0.22 s transition | fixed |
| D10 | M3 | screenshot 35c | Feedback said "you already hold this stamp" right after earning it | Question records `hadStamp` when asked | fixed |
| D11 | M3 | screenshot 35 | Destination list showed the district icon for special spaces (a trolley stop showed a baseball) | Category icon only for district and landmark spaces | fixed |
| D12 | M3 | screenshot 19 | Panel ticket emoji rendered as a black bar; AI "will continue" note floated on the scrim | Inline SVG ticket; footer under modals gets a card background | fixed |
| D13 | M3 | screenshots 23, 24 | Page cards 94% opaque: map icons showed through results text | Page background 98.5% (light) / 98% (dark) | fixed |
| D14 | M3 | screenshot 07 | hs-0230 "In which year did the Bathers win…" while the explanation lists other title years | Question reworded "which of these years" (audit batch-9) | fixed |
| D15 | M3 | screenshot 22 | Quiz progress dots low-contrast over the light map | Dots sit on a dark pill | fixed |
| D17 | final | screenshots 22, 25, 26 | Quiz "Next question" / "Quit" buttons floated on the map with no backing | Quiz footer gets a card background | fixed |
| D18 | final | mobile 08 | Passport stamp names (QUAPAW BATHS, WHITTINGTON PARK) ran outside the stamp ring | Smaller type with a fillText maxWidth inside the ring | fixed |
| D19 | final | mobile 12 | "Greetings from Hot Springs" collided with the postcard's year stamp; large empty gap above the event text | Right margin reserved for the stamp; gap removed | fixed |
| D20 | final | mobile 17 | Win screen showed downtown, and the confetti burst at the tower was off-screen | Win backdrop camera centers on the tower | fixed |
| D21 | final | mobile 18 | 50/50 left two blank holes in the single-column answer list | Removed answers collapse (`display: none`) | fixed |
| D22 | final | contrast script | Nature & Lakes key letters white on #009E73 were 3.42:1 | Category color darkened to #007A5A (5.34:1); all eight category/ink pairs now 5.2–7.5:1 | fixed |
| D23 | review | review + mobile 02 | AI seats defaulted to the same name (three "Miss Promenade"); after the fix, long default names were clipped in the mobile name field | Shared `defaultNames()` (no repeats for up to 6 seats, typed names reserved) used by setup and game start; mobile seat grid tightened | fixed |
| D16 | M3 | screenshot 09 | "Keys 0–5" hint shown on touch devices | Hint hidden with `@media (hover: none)` | fixed |
