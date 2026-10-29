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

## Visual pass: data, art and benchmarks

No third-party code is vendored. The map and art come from public data and from original generated art.

| Item | Source | License | Where it is used |
|---|---|---|---|
| Terrain | USGS 3DEP elevation (ImageServer exportImage, 1/3 arc-second and finer) | Public domain | `tools/map/` builds the board render; raw files are in `art-src/geo/raw/` (git-ignored, refetchable) |
| Streets, railroads | US Census TIGERweb, Transportation layers 2/6/8/9 | Public domain | board render |
| Lakes, creeks | USGS National Hydrography Dataset, layers 6 and 12 | Public domain | board render |
| Downtown building footprints, trails, the Oaklawn oval, Blakely Mountain Dam | OpenStreetMap via the Overpass API | ODbL 1.0, © OpenStreetMap contributors | board render. Attribution is printed on the board and in How to play |
| Point anchors | `research/geo-anchors.json` (GNIS, NRHP and Wikipedia coordinates, plus centroids derived from OSM) | facts, cited per point | `tools/map/layout.py` |
| Landmark paintings and passport stamps | Original images generated with OpenAI image generation through Codex. Prompts are recorded in the visual pass notes: no text, no logos, no real people | Project's own (MIT) | `assets/land-*.webp`, `assets/stamp-*.webp` |
| Board diorama and token sprites | Rendered in Blender 5.2 (Cycles) by our own scripts in `tools/map/` | Project's own (MIT) | `assets/board-*.webp`, `assets/token-*.webp` |

**Benchmarks** for the visual review are store screenshots of Ticket to Ride, Trivial Pursuit Live! 2,
Wingspan, NEW MONOPOLY, Trivia Crack and Root. They are kept in `benchmarks/` (git-ignored) with a README
of their source URLs. They were used only to compare quality; no art, layout, characters or trademarks were copied.
