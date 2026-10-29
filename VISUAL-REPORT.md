# VISUAL-REPORT: Valley of Vapors Trivia Trail (`games/trivia`)

Visual enhancement pass, 2026-10-28/29. The plan is in [VISUAL-PLAN.md](VISUAL-PLAN.md). The review record is
`screenshots/visual-before`, `vis-m2` … `vis-m5` and `visual-final`, each with contact sheets; the final run also has
`before-after/` sheets.

## What changed

**The board is now a tabletop diorama of the real valley.**
- **Built from public data.** `tools/map/build_board.py` builds it in Blender 5.2 from:
  - USGS 3DEP elevation
  - Census TIGER streets
  - USGS NHD lakes and creeks
  - OpenStreetMap footprints and trails
  - the cited anchors in `research/geo-anchors.json`
- **Rendering.** It is rendered once in Cycles (OptiX) at 3200 px, with a Kuwahara painterly pass, and shipped as WebP
  (day 1.6 MB, plus a 0.6 MB first-paint copy).
- **Night version.** A separate night render has lamp-lit streets, lit windows, flood-lit bathhouse fronts and the tower beacon.
  It is the dark theme and loads only when that theme is on.
- **Viewpoint.** The camera looks east across Bathhouse Row's west-facing fronts to Hot Springs Mountain.
- **Bathhouse Row.**
  - The eight bathhouses are in their true north-to-south order (confirmed by HABS AR-28, the NHL nomination, the CLI and OSM).
  - Each uses its true footprint and frontage, with researched roof forms: the Quapaw's tile dome, the Maurice's green tile,
    the Ozark's twin stepped towers.
- **Space placement.** Every named space sits at its real place: the Ohio Club, the Southern Club, the Medical Arts Building,
  the Malco, Velda Rose, the Mountainaire, Goat Rock, North Mountain's summit, Whittington Park, the Ban Johnson and Fogel
  Field site, and the Peak and Short Cut trails on their OSM lines.
- **Honest distortions, stated on the board and in How to play** (`research/map-projection.md`):
  - a magnifier on downtown;
  - a widened Central Avenue;
  - Oaklawn and the three lakes moved closer as dashed-ring vignettes, each plate giving the real distance.
- **The route** is a raised Promenade-brick slab with stone pavers. Enamel space discs, district plates, a compass, credits
  and a ★ Mountain Tower goal plate are drawn crisply on top. A vector board remains as the fallback (`?art=0`).
- **Painted landmark miniatures** stand at their places: the Arlington, the tower, the Oaklawn grandstand, the
  ballpark, the Happy Hollow shack, the motor-court sign, Blakely Dam and the Bridge Street storefronts.
- **Steam** puffs rise from every bathhouse roof and steam vent. It is ambient, off under reduced motion, and redrawn at 30 fps.

**Tokens.** There are six lacquered pawns rendered in Blender with the board's camera and sun. Each pawn's cross-section
is its access shape (circle, square, triangle, diamond, star, hexagon), so shape still pairs with colour.
- Movement: they hop along the baked route curves with lift, a landing squash and a dust puff.
- Contact shadows shrink as a pawn rises.
- The active pawn has a halo ring and a bob.
- Tight-cropped copies appear in the HUD, on the pass screen and on the win plinth.

**Cards and moments**
- **Question card:**
  - A painted banner opens on every question (clip-reveal), then the category badge flips in.
  - The art follows the question's subject when it names a painted place (the Arlington, Oaklawn, the Row…), and otherwise the category's district.
  - A reward chip ("+2 tickets") replaces the repeated rules strip.
- **Answer feedback:**
  - The right answer fills green with a pop and a light burst behind it.
  - A wrong pick shakes.
  - The reward rises from the feedback.
- **Stamp slam.** The district's ink stamp lands on the card with a thump and an ink ring. On mobile it sits beside the text, never over it.
- **Passport.** It is a stitched booklet with a green and brass cover; earned stamps are inked and missing ones are faint.
- **Steam-gauge roll.** A brass gauge's needle swings past and settles on the number.
- **Summit and win.**
  - The summit intro carries the tower painting.
  - The win screen puts the winner's pawn on a brass plinth, deals in their stamps, and shows podium cards above the standings.
- **Title and panel.** The title card has a painted Bathhouse Row hero. The side panel has a "where you are" postcard of the current district.
- **UI kit.** Enamel primary buttons, paper panels, pill selects, numbers in tabular body type rather than monospace, and a readable log.

## Review scores (independent adversarial reviewer; same brief, screenshots only)

| Axis | Before (`visual-before`) | Round 2 (`vis-m3`) | Round 3 (`vis-m5`, final review) | Best benchmark |
|---|---|---|---|---|
| Art quality | 4 | 5 | **6** | 9–10 (Root, Wingspan) |
| Lighting and depth | 2 | 5 | **5** | 9 (NEW MONOPOLY) |
| Animation and game feel | 3 | 4 | **5** | 9 (Trivia Crack, TPL2) |
| UI design | 5 | 6 | **6** | 9 (Wingspan) |
| Typography | 6 | 6 | **7** | 8–9 |
| Readability | 6 | 5 | **6** | 9 (Ticket to Ride) |
| Mobile | 6 | 6 | **7** | 9 (Trivia Crack) |
| Authenticity of setting | 6 | 8 | **7** | 9 |

The round-2 gap list drove milestone 4. Its fixes:
- the terrain was toned down and the route made 2–3× bolder;
- the pawns were made about 1.4× bigger;
- landmark miniatures were added to the board;
- the tower was made the goal, with a plate and a glow when the trail opens;
- the space glyphs were made larger;
- the win-screen plinth and rewards, the reward fly-up and the light burst were added;
- mobile stamp overlap was fixed, the destinations list made two-column, the passport subtitle shortened, map sublabels set to at least 9.5 px, and card subject art matched to the question.

**Final round (vis-m5).** Total moved from 38/80 to 49/80. This round's reviewer was stricter on authenticity (8 → 7),
because two places share one painting, as listed under Known gaps.

Fixed after the final review, then re-tested and re-shot in `visual-final` (70/70):
- **Overflow:** the win and title cards overflowed at 1280×800; their buttons now fit.
- **Tower art:** the tower miniature read as a water tank, so it was regenerated as the real steel lattice tower.
- **Night board:** it was near-black and is now graded to dusk.
- **Labels:**
  - the Bathhouse Row plate moved to the Row's real (east) side;
  - the compass became a cartouche;
  - the credit line is larger;
  - the mobile map button no longer covers the tower plate.
- **Panel:** the duplicated turn line is gone.
- **Feedback:**
  - the timer bar is thicker and pulses under 5 s;
  - a wrong pick desaturates;
  - the reward fly-up no longer hits the card edge.
- **Pawns:** about 18% larger.

**Remaining MAJOR gaps** the reviewer named, judged against Root, Wingspan and Monopoly, are listed under Known gaps.

## Tests

Final run: `node shared/test-harness/run.mjs games/trivia --milestone visual-final`. **70/70 pass.** There were 0 console errors and
0 external requests; the harness fails a test on either. The run produced 95 screenshots, and all of them were inspected
through the 14 contact sheets, with key shots opened at full size. The 37 before/after sheets are in `screenshots/visual-final/before-after/`.

| File | Desktop | Mobile | Shots |
|---|---|---|---|
| a11y.test.mjs | 6/6 | 5/5 | 19 |
| ai.test.mjs | 2/2 | 1/1 | 2 |
| art.test.mjs (new) | 5/5 | 4/4 | 8 |
| modes.test.mjs | 3/3 | 3/3 | 14 |
| perf.test.mjs | 3/3 | 1/1 | 0 |
| specials.test.mjs | 9/9 | 8/8 | 24 |
| trail.test.mjs | 5/5 | 5/5 | 16 |
| visual.test.mjs | 6/6 | 4/4 | 12 |
| **Total** | **39/39** | **31/31** | **95** |

The baseline was 59/59; this pass added 11 tests. `node games/trivia/tools/check-file-url.mjs` gives **PASS** at 1280×800 and at 390×844,
loading from `file://` with 32 images, 0 failed, 0 errors and 0 external requests.

New in this pass:
- **`tests/art.test.mjs`:**
  - assets load from the manifest with no failures;
  - the `?art=0` vector fallback works;
  - the projected geometry fits: all 70 spaces lie inside the board and none overlap;
  - board tap and click move the token. This was REPORT.md's untested part of AC8, now covered at both viewports with real touch on mobile;
  - close-ups of the Row and the tower.
- **`tests/perf.test.mjs` › busiest scene:**
  - six pawns, steam, the pulsing destination set, follow camera and night art;
  - fps and art download measured at both viewports.
- **`tools/check-file-url.mjs`** opens `index.html` from `file://` at both viewports: 32 images load, with 0 errors and 0 external requests.

## Performance

| Measure | Before | After (`visual-final`, quiet machine) | Target |
|---|---|---|---|
| fps, title (animated backdrop) | 60.5 | 59.1 | 60 |
| fps, board idle (desktop) | 60.4 | 59.8 | ≥55 |
| fps, token moving (desktop) | 60.4 | 59.9 | ≥50 |
| fps, busiest scene: 6 pawns, steam, pulse, zoom, night (desktop / mobile 390×844 @2×) | — | 59.3 / 60.5 | ≥55 / ≥30 |
| JS heap | 9.5 MB | 9.5 MB | — |
| Interactive (`loadMs`) | 99 ms | 164 ms | ≤2 s |
| Board art arrives (desktop / mobile) | — | 74 / 177 ms after navigation | ≤3 s |
| `index.html` | 468 KB | 534 KB | ≤2 MB |
| Assets on disk (all) | 0 | 4.8 MB WebP (41 files) | ≤6 MB |
| Downloaded in a session (day + night, both 1.6 k boards, all cards and stamps) | — | 2.76 MB, 39 requests | — |

- **Measurement caveat.** Several sessions ran Playwright and Blender at once (up to about 31 headless Chromium instances), so
  some runs fell to 18–40 fps. The figures in the table are from quiet-machine runs.
- **Render cost.**
  - `imageSmoothingQuality = 'high'` on the full-screen board blit and a full-screen `shadowBlur` each cost 15–40 fps.
    Both were removed; the cached board is blitted with `'low'` smoothing, since it is already pre-filtered at the right size.
  - Steam uses one pre-rendered puff sprite, not per-frame gradients.
- **Loading.**
  - Progressive: the 1.6 k board (0.6 MB) paints first, about 0.1–0.2 s after navigation from local disk. The 3.2 k board loads
    only when the zoom needs it: the follow camera on desktop, or close-ups on phones.
  - The title backdrop never asks for more than 1.6 k.
- **Fallback.**
  - The game has no WebGL dependency at all; the pre-rendered art is plain 2D canvas.
  - `?art=0`, or any image failure, draws the vector board.
  - Under reduced motion the game drops steam, particles, hops and card animations.

## Known gaps

**Visual, named by the final adversarial review (MAJOR unless marked):**
1. **The route is not yet a seated, even-pitch track.** Spaces are enamel discs of three sizes, and they bunch up where the real geography is dense:
   Central Avenue, Happy Hollow and Oaklawn. *Lever:* repack `tools/map/layout.py` to an even arc-length pitch per district, and render
   the discs into the slab in Blender instead of drawing them on top.
2. **Terrain texture and anonymous downtown blocks.** The forest is still a uniform tree field at one value. Downtown buildings other than the
   eight bathhouses, the Arlington and the tower are generic OSM boxes. *Lever:* a calmer canopy (a second Kuwahara pass at size 4, or a painted
   overlay) and roof colours from the Sanborn maps.
3. **No single strong key light or board object.** There is a wood edge and table now, but no hillshade multiply or unified sprite shadows.
4. **The roll and the win are animated, but not cinematic.**
   - There is no centre-screen gauge and no camera push to the tower on the Summit.
   - The win plinth and stamps are a CSS sequence, not a board sequence.
5. **The side panel is still web-card shaped.** There are no passport-cover player plaques, ticket-stub counters or card-stock answer tiles.
6. **MINOR:**
   - The Bathhouse Row painting is shared by the Row, Arlington Lawn and the start space.
   - The summit trail markers are plain stones.
   - The passport is a booklet but not a spread.

**Not visual, but noticed:**
- **Question-to-landmark mismatch (content).** At a district's landmark, the game asks a question from that district's *category*. So the
  Quapaw landmark can ask about the Arlington, because both are Places & Landmarks. The card art now follows the question's subject, but the
  rule itself is unchanged (MECHANICS §6). It is a candidate for a later content pass.
- **Measurement noise.** fps drops to 18–40 whenever many other sessions run headless Chromium. The table gives quiet-machine figures; an
  unlucky full run can fail `perf.test` on load alone.
- **Unchanged from REPORT.md:**
  - no human has listened to the audio or used a screen reader;
  - the vector fallback board (`?art=0`) is functional but plainer than before, since the old drawn terrain was removed with the old layout.

## New research (with sources), and facts for the shared `research/`

- **`research/bathhouse-row-layout.md`** (about 280 lines, every fact cited):
  - **North-to-south order: CONFIRMED.** Four independent sources agree:
    - the HABS AR-28 site plan, 1984;
    - the NHL nomination ("the northernmost bathhouse on the row is the Superior"; the Administration Building is "finishing the southern corner");
    - the Cultural Landscapes Inventory;
    - OSM centroids.
  - **Addresses:**

    | Bathhouse | Address |
    |---|---|
    | Superior | 329 Central |
    | Hale | 341 |
    | Maurice | 359, conflicting with 355 |
    | Fordyce | 369 |
    | Quapaw | 413 |
    | Ozark | 425, conflicting with 491 |
    | Buckstaff | 509 |
    | Lamar | 515 |
    | Administration Building | 101 Reserve St |

  - **Frontages from the HABS streetscape**, about ±5 ft:

    | Bathhouse | Frontage (ft) |
    |---|---|
    | Superior | 89 |
    | Hale | 116 |
    | Maurice | 89 |
    | Fordyce | 107 |
    | Quapaw | 185 |
    | Ozark | 110 |
    | Buckstaff | 105 |
    | Lamar | 95 |
    | Administration Building | 42 |

  - **Lengths:** the eight buildings span about 1,096 ft. Central Avenue from Reserve St to Fountain St is about 1,705 ft (the 1989 LMP says "some 1700 feet").
  - **Corrections to the shared notes:**
    - The Buckstaff's architect is Frank W. Gibb & Co.
    - The Hale's is George and Fremont Orff.
    - Hot Springs Creek runs in a 6,100-ft culvert under the east edge of Central Avenue.
- **`research/geo-anchors.json`:** 59 cited coordinates (GNIS, NRHP, Wikipedia, and centroids derived from OSM), each marked surveyed, derived or approx.
- **`research/map-projection.md`:** every downloaded dataset with its query and licence; what is true on the board and what is distorted.
- **Distances from the Row** (straight line):

  | Place | Distance and direction |
  |---|---|
  | Oaklawn | 2.0 mi S |
  | Lake Hamilton's nearest shore | 3.5 mi S |
  | Lake Catherine's nearest shore | 4.8 mi SE |
  | Lake Ouachita by Blakely Dam | 9.0 mi WNW |
  | Lake Ouachita State Park | 10.1 mi NW |

**Suggested for the shared `research/`** (for the coordinator):
- Mark the north-to-south order and the addresses as confirmed in `bathhouse-row-and-springs.md`.
- Copy in the frontage table and the architect corrections.
- Record these conflicts:
  - addresses: Maurice 359 vs 355, Ozark 425 vs 491;
  - Lamar architect: Schwebke vs Roberts & Schwebke;
  - Bridge Street length: 98 ft vs 179 ft between centerlines;
  - Grand Promenade completion: 1958 vs the early 1960s.
- Consider moving `geo-anchors.json` to the shared `research/`.

## Shared-data, harness and repo requests

1. **`.gitignore`.** The root rule `games/*/art-src/*.png` does not cover subfolders. I added a game-local `games/trivia/.gitignore`
   that ignores `art-src/geo/raw/` (32 MB of refetchable USGS, Census, NHD and OSM data) and `art-src/tokens/*.png`.
   Consider adding `games/*/art-src/**/*.png` and `games/*/art-src/geo/raw/` at the root.
2. **Harness: a before/after mode for `sheets.mjs`.** Mahjong and trivia each carry a copy of `tools/before-after.mjs`.
3. **Harness: fps under load.** `t.fps` is noisy when other sessions run Chromium. Consider logging the machine's
   headless-Chromium count next to fps, or a `--quiet-check` that waits for the machine to go idle.
4. **LESSONS candidates:**
   - Map pipeline: USGS 3DEP exportImage returns tiled TIFFs; TIGERweb needs a browser User-Agent; Blender's Python has numpy.
   - Rendering: avoid `imageSmoothingQuality = 'high'` and full-screen `shadowBlur` per frame.
   - Blender: geometry-nodes Collection Info orders instances by name.
   - Timers: question timers should run on wall-clock time, not capped frame time.
   - Details are in the side-session notes, `trivia-visual-notes.md`.
