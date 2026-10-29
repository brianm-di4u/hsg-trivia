# Code-sample survey

Viewed 2026-10-28. No sample code was downloaded or run; `reference-samples/` stays empty. Each sample
was read on its project page only.

| # | Project | URL | License | Version / commit | Core mechanic it covers |
|---|---|---|---|---|---|
| 1 | boardgame.io | https://github.com/boardgameio/boardgame.io | MIT | `main` as viewed 2026-10-28 (≈1,914 commits; no release shown on page) | Serializable game state, pure move functions, turns and phases |
| 2 | ZzFX (Zuper Zmall Zound Zynth) | https://github.com/KilledByAPixel/ZzFX | MIT | ZzFXMicro v1.4.0 header; `main` as viewed | Tiny WebAudio sound-effect synthesis from a parameter list |
| 3 | jsfxr | https://github.com/chr15m/jsfxr | Unlicense | `master` as viewed | Classic sfxr presets (pickup, hit, blip) as WebAudio |
| 4 | bryc/code — PRNGs.md (mulberry32) | https://github.com/bryc/code/blob/master/jshash/PRNGs.md | Public domain (stated on the page) | `master` as viewed | Seedable 32-bit PRNG |
| 5 | emilRacz21/quiz-javascript | https://github.com/emilRacz21/quiz-javascript | MIT declared in README only; no LICENSE file visible | `main`, 21 commits | Vanilla-JS multiple-choice quiz with category/difficulty pick and countdown timer |
| 6 | Red Blob Games — Introduction to A* (BFS section) | https://www.redblobgames.com/pathfinding/a-star/introduction.html | No code license stated (copyright notice only) | page as viewed | Breadth-first search with a frontier queue and `came_from` map |

## Notes per sample

**1. boardgame.io** — *Does well:* game state `G` is a plain serializable object; moves are functions
that take state and return the next state; phases change the rule set (e.g. setup → play → end).
*Does badly (for us):* framework plus a multiplayer server is far heavier than a single offline HTML file
needs; React-oriented client. **Verdict: ideas only.** We take the shape: one serializable `state`,
named actions (`act('roll')`, `act('choose', id)`, `act('answer', i)`) and an explicit `phase` field.

**2. ZzFX** — *Does well:* every sound is a short parameter list rendered by one function; envelopes
(attack/sustain/release), pitch slide and noise in a few lines; zero assets. *Does badly:* the minified
code is hard to read and tweak; parameter arrays are opaque. **Verdict: ideas only** (MIT would allow
adaptation, but we write a clearer small synth with named parameters: oscillator, ADSR, pitch slide,
filtered noise).

**3. jsfxr** — *Does well:* named presets (pickupCoin, hitHurt, blipSelect) map neatly onto game
events. *Does badly:* generates buffers per sound (large code); UI-centric. **Verdict: ideas only** — we
borrow the preset *vocabulary* (coin, blip, hurt, powerup) for our own sound list.

**4. mulberry32 (bryc)** — *Does well:* 4 lines, fast, good enough statistical quality for games,
state is one 32-bit integer (trivially serializable into the save). *Does badly:* 32-bit state only.
**Verdict: ADAPTED** (public domain). Lives in `src/js/util.js` with an attribution comment.

**5. quiz-javascript** — *Does well:* simple flow: pick category/difficulty → question → timer →
results with a grade. *Does badly:* depends on a network API (Open Trivia DB); README lists UI and
responsiveness as unfinished; no stated keyboard or screen-reader support; the license is only a README
line. **Verdict: reference only** (unclear-license rule). Our quiz flow (question → feedback with
explanation and source → continue) is our own, with keyboard keys 1–4 and an ARIA live region.

**6. Red Blob Games BFS** — *Does well:* clearest explanation of a frontier queue plus `came_from`
pointers to rebuild paths. *Does badly:* nothing for our use, but no code license is given.
**Verdict: reference only.** BFS is textbook; our `reachable(node, steps)` walk is written from scratch:
a depth-limited search over the board graph that forbids immediate backtracking and records the path
to each destination for token animation.

## Side-by-side review: what becomes the foundation

| Concern | Foundation | From |
|---|---|---|
| State model | One serializable `state` object; `phase` field drives the turn state machine; named actions | boardgame.io (idea) |
| RNG | mulberry32, seed and state saved in `state.rngState` | bryc (adapted, PD) |
| Movement | Exact-step search on a graph of board nodes with "no U-turn" rule; path kept for animation | Red Blob BFS (idea) |
| Quiz flow | Category → adaptive difficulty → shuffled choices → timer → feedback with explanation and source | quiz-javascript (idea), our own design |
| Audio | Named-parameter WebAudio synth; preset vocabulary (coin, blip, hurt, powerup, whoosh) | ZzFX + jsfxr (ideas) |

Nothing from any commercial trivia board game (board shape, wedge tokens, category colors or names)
was used or consulted.
