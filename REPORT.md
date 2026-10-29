# REPORT — Valley of Vapors Trivia Trail (`games/trivia`)

## What was built

An original trivia board game about Hot Springs, Arkansas, shipped as one self-contained
`index.html` (468 KB) built from `src/` with `shared/tools/inline.mjs`.

- **Trail Game, 1–6 players.** Any mix of hot-seat humans and AI (Easy, Medium, Hard). Players roll a
  "steam gauge" and travel a code-drawn map: a downtown loop (Bathhouse Row, Bridge Street, Central
  Avenue) and an outer loop (Oaklawn, the Lakes, the Ballfields, Happy Hollow, Park Avenue), joined by
  Whittington Avenue.
  - Each district is one of the 8 bank categories. Its gold-ringed landmark awards a passport stamp.
  - After 4, 6 or 8 stamps, a player climbs the real NPS trails from the Grand Promenade trailhead. The
    Short Cut costs 2 steps per space (21.1% grade); the Peak Trail does not.
  - The player wins by answering the Summit question at the 216-ft Mountain Tower.
  - Original special spaces: steam-vent shortcuts (the Hot Springs Creek tunnel pair), Post Time
    wagers at Oaklawn, Time Warp (put three dated events in order, then warp to a landmark), Postcards,
    the Grand Jury, and trolley stops. Bath tickets pay for a 50/50, a re-roll or the trolley.
- **Quick 10, Era Express and Daily Challenge.**
  - Quick 10 is adaptive, with streak, speed and difficulty scoring.
  - Era Express offers six `timeline.json` eras, with ancient merged into frontier.
  - The Daily Challenge is 7 date-seeded questions, the same on every replay that day, with a
    streak and share text.
- **Every answer shows the explanation and the source name.** `claim` items carry a "Local claim" badge.
  No question repeats in a session until its pool runs out. Difficulty adapts to each player's skill.
- **Presentation and access.**
  - Art: a canvas map (terrain, lakes, Row skyline, Arlington, the lattice tower, brick route,
    colorblind-safe icons) with animated tokens, steam, a stamp burst and confetti.
  - Audio: WebAudio synthesized sound.
  - Accessibility: full keyboard play, adjustable timers (Off/30/20/10 s), reduced motion, text size
    100/115/130%, and day and night themes.
  - Mobile: a layout at 390×844.

## The question-bank audit (step A)

Full log: `research/question-audit.md`. Raw records: `research/audit-records/`. The bank is rebuilt
reproducibly from the untouched `research/trivia-bank.json` with `tools/apply-audit.mjs`.

| | |
|---|---|
| Questions | 512 → **511** (1 dropped: hs-0329, baptism location only on a fan site) |
| Changed | **349** (explanations trimmed to what the source says, distractors fixed, sources replaced, 2025–26 previews reworded) |
| Confidence | confirmed 470 / summary 21 / claim 21 → **confirmed 491 / claim 20 / summary 0** |
| "via search" sources | 7 → **0** |
| Flagged ids | all 10 re-verified against fetched pages, re-sourced where HMdb or PressReader were blocked; none dropped |

The audit ran in two passes:
1. Every question was checked against its fetched source page.
2. A random 40-question sample found that about 10% still had problems, so the second pass re-verified
   all 511 questions. It fixed 56 more (ok 455, fix 56).

A screenshot review caught one more (hs-0230).

**Residual risk:** the agents read pages through a summarizing fetch tool. A handful of facts rest on
a single source.

## Acceptance criteria (PRD §13)

| AC | Status | Evidence / note |
|---|---|---|
| AC1 audited bank + log | **Met** | perf.test › bank is the audited copy; `research/question-audit.md` |
| AC2 explanation + source | **Met** | trail.test › feedback; shots 06, 07 |
| AC3 claim/summary badges | **Met** | trail.test › claim badge (07b). No `summary` items remain after the audit, but the badge code path exists |
| AC4 no repeats | **Met** | 60 Quick 10 questions in one session, none repeated |
| AC5 adaptive difficulty | **Met** | skill rises after correct answers and falls after wrong ones (perf.test) |
| AC6 setup 1–6, AI levels, target | **Met** | visual.test › setup with six seats (02) |
| AC7 exact-step destinations | **Met** | specials.test › gating, Short Cut cost, Tower absorbs |
| AC8 choose by click/tap, button, keys | **Met** | Panel buttons and keyboard are tested. Board tap is implemented and hand-checked in code but **not covered by an automated test** |
| AC9–AC10 tickets, stamps, passport | **Met** | trail.test; shots 08, 28 |
| AC11 vent | **Met** | shot 11 |
| AC12 Post Time | **Met** | win and loss settled (shot 09) |
| AC13 Time Warp | **Met** | ordering, warp, and the landmark stamp (shots 10, 10b) |
| AC14 Postcard | **Met** | shot 12 |
| AC15 Grand Jury | **Met** | skip consumed (shot 13) |
| AC16 Trolley | **Met** | shot 14 |
| AC17 trail gating + Summit | **Met** | win and miss (shots 15, 16a, 16, 17) |
| AC18 50/50 + re-roll | **Met** | shot 18 |
| AC19 AI | **Met** | 3 AI seats play 4 rounds unattended. Accuracy is ordered: easy .63/.42/.26, medium .80/.59/.41, hard .93/.77/.65 (easy/medium/hard questions) |
| AC20 pass screen | **Met** | shot 20 |
| AC21 win screen | **Met** | shot 17 |
| AC22 autosave + continue | **Met** | reload, then Continue (shot 21) |
| AC23 Quick 10 | **Met** | shots 22, 22b, 23 |
| AC24 Era Express | **Met** | all 10 questions come from the chosen era (shots 24, 25) |
| AC25 Daily | **Met** | same ids and choice order on replay, a different set the next day (shots 26, 27) |
| AC26 illustrated map | **Met** | shots 03, 04, 35 |
| AC27 animation/effects | **Met** | Verified only on stills and by state: hops, the steam loop, the stamp burst (28) and confetti (17) |
| AC28 synthesized audio | **Met** | Audio is created after a gesture, sounds fire and M mutes. Sound quality was **not listened to** (headless) |
| AC29 title/help/settings | **Met** | shots 01, 29, 30 |
| AC30 keyboard play | **Met** | Keyboard-only from title to setup to game, then roll, select, choose, answer and continue (31). The full title-to-win run uses the same keys but was not automated end to end |
| AC31 colorblind cues | **Met** | Every category has an icon and a label, tokens have 6 shapes, and the help legend shows both |
| AC32 timers incl. Off | **Met** | 10 s timeout counts as wrong (32a, 32) |
| AC33 reduced motion | **Met** | Media query and setting; moves finish instantly (33) |
| AC34 text size, contrast, themes | **Met** | Shown at 130% (34) and in the dark theme (35–35d). Every category key pair is ≥ 5.18:1 after the D22 fix, and the shared tokens pass 4.5:1 |
| AC35 mobile | **Met** | `checkLayout()` runs in every test. All 43 mobile shots were inspected and all controls are ≥ 44 px |
| AC36 single file, no requests, no errors | **Met** | 468 KB. The harness blocks external requests and fails on console errors. The `https://` strings in the file are inlined `sourceUrl` data, never fetched |
| AC37 performance | **Met** | 60.4 fps on the board, 60.4 while moving, 60.5 on the title; heap 9.5 MB; `loadMs` 99 |
| AC38 no storage | **Met** | Plays with `localStorage` throwing (36) |

## Test results

`node shared/test-harness/run.mjs games/trivia --milestone final`: **58/58 passed** across desktop and
mobile, with no console errors and no external requests.

- 87 screenshots are in `screenshots/final/` (44 desktop, 43 mobile), and **every one was opened and
  inspected**.
- `screenshots/index.html` is the current gallery.
- 22 defects were found and fixed through screenshots and tests. They are logged in `DEV-PLAN.md` §5.
  Examples: icons misreading as animals or a phone handset, a modal captured mid-fade, a passport stamp
  label overflowing its ring, the postcard title colliding with its stamp box, and a contrast failure
  on Nature & Lakes.

Milestone runs: `m1` (8/8), `m2` (52/57: two real bugs, D7 and D8), `m3` (57/57), `final` (58/58).

## Performance

| Metric | Value | Budget |
|---|---|---|
| `index.html` | 468.5 KB (questions ≈ 310 KB, timeline ≈ 46 KB) | ≤ 2 MB |
| Interactive (`loadMs`) | ≈ 99 ms | ≤ 2 s |
| FPS title / board / moving (desktop) | 60.5 / 60.4 / 60.4 | ≥ 55 |
| JS heap | 9.5 MB | — |

Trimming was already done by design:
- The map is drawn once into a cached offscreen layer, re-rendered only on resize or theme change.
- Per-frame drawing covers only highlights, tokens, steam and particles.
- DOM regions are written only when their HTML changes.

## Known gaps

- **Board tap is not covered by an automated test.** Click and touch go through the same `choose()` path
  as the tested buttons. Pinch-zoom is not implemented; there is a Close-up / Whole map button and drag-to-pan.
- **Postcard and Time Warp facts come from `research/timeline.json`** (`confirmed` entries only, with
  sensitive history excluded). They were not re-fetched in the question audit.
  - The stamp blurbs and board labels are sourced in `research/town-content.md`. Five of the eight
    blurbs restate facts from audited questions.
  - The Quapaw "tallest dome" and the Park Avenue motor-court blurbs come from the corpus.
- **AI doesn't use the 50/50.** It does re-roll (Hard only), ride the trolley, wager by level and play Time Warp.
- **Sound was not listened to.** The cues are short synthesized presets and should get a human ear.
- **The map is stylized, not to scale.**
  - Relative positions follow the corpus: the Y, the Row on the east side, Whittington to the west,
    Park Avenue to the northeast, the mountain to the east, Oaklawn to the south.
  - Lake Catherine is placed for composition only.
- **Out of scope per the PRD:** map-pin rounds, Number Hunt, festival-calendar spaces and fog weather.

## Harness requests

1. **The `@inline` path is relative to `src/`.** The brief's example `<!-- @inline data/questions.json as QUESTIONS -->` resolves
   to `src/data/…`, but the audited bank lives in `games/trivia/data/`. I used `../data/questions.json`.
   Suggest documenting this in the inliner header or resolving `@inline` from the game folder.
2. **Screenshot volume.** Each run writes about 25 MB of PNGs. With m1, m2, m3 and final, this folder holds
   about 80 MB. Suggest committing only `screenshots/final/` and `index.html`, or gitignoring
   `screenshots/m*/`. The coordinator should decide. I left all milestones in place as the process record.
3. **`report.json` field name.** It records `pass`, while the README shows only console output. A
   one-line schema note (name, viewport, pass, failures, logs, shots) would help tests and tools read
   reports.
4. **Bundler snapshots imports.** `inline.mjs` turns imports into `const {a} = __mN`, so imports are
   snapshots, not live bindings. Worth a line in `LESSONS.md`: export objects you mutate, never
   reassigned `let`s.
5. **`t.shot()` waits up to 5 s.** It waits whenever `isIdle()` is false. A game with ambient camera drift or a
   CSS entry animation should exclude the drift from `isIdle()` and include the animation. That is
   worth a line in the README (see D1 and D9).

## Files

`index.html` (built) · `src/` (sources) · `data/questions.json` (audited bank) · `data/timeline-lite.json` ·
`tools/` (timeline subset, audit merge, audit log) · `tests/` (8 files, 58 runs) · `research/town-content.md` ·
`research/question-audit.md` · `research/audit-records/` · `SAMPLES.md` · `MECHANICS.md` · `PRD.md` ·
`DEV-PLAN.md` · `REPORT.md`. Nothing outside `games/trivia/` was modified; nothing was committed.
