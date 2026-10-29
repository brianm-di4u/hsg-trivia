# VISUAL-PLAN: Valley of Vapors Trivia Trail

Visual campaign plan. The baseline is `screenshots/visual-before` (59/59 tests). Benchmarks are in
`benchmarks/` (git-ignored): Ticket to Ride, Trivial Pursuit Live! 2, Wingspan, NEW MONOPOLY, Trivia Crack and Root.

## Baseline review (independent adversarial reviewer)

| Axis | Ours | Best benchmark |
|---|---|---|
| Art quality | 4 | 9 (Root, Wingspan) |
| Lighting and depth | 2 | 9 (Monopoly) |
| Animation and game feel | 3 | 9 (Trivia Crack, TPL2) |
| UI design | 5 | 9 (Wingspan) |
| Typography | 6 | 8 |
| Readability | 6 | 9 (Ticket to Ride) |
| Mobile | 6 | 9 (Trivia Crack) |
| Authenticity of setting | 6 | 9 |

The top gaps, in the reviewer's order:
1. a flat clip-art board
2. unrecognisable landmarks
3. no reward moment for a stamp
4. no lighting model
5. primitive tokens
6. small board spaces, with categories coded by colour only
7. a spreadsheet win screen
8. a bare question card
9. a passport that isn't a passport
10. generic web chrome
11. an undersized desktop board
12. no "vapors"
13. no roll object
14. timid feedback
15. a detached Continue bar
16. mobile board layout
17. clipped mobile dialogs
18. monospace numbers
19. a flat dark theme

The reviewer said to keep: the sourced-fact feedback, the 2×2 / 1-column answer grid, the numbered destination preview, the
category colour and icon system, shape plus colour tokens, the accessibility settings, and real place names.

## Direction: a 2D board built from a 3D-rendered diorama of the real valley

**Chosen:** a pre-rendered Blender diorama, built from public map data and seen by an orthographic camera
that looks **east** and is tilted 30° from vertical. This is the classic view of Hot Springs: Bathhouse Row's
west-facing fronts along Central Avenue, with Hot Springs Mountain and the Mountain Tower rising behind.
Everything that changes during play is drawn on a 2D canvas on top of the render:
- spaces, highlights, tokens, labels, steam and effects.

Why not real-time three.js:
- A real-time scene would cost download size, phone battery and a WebGL dependency, for a camera that barely moves.
- A board game wants a readable, stable table.
- A pre-render gives path-traced light, soft shadows and roughly 40,000 trees for the price of one image,
  works on any device without WebGL, and leaves the route and spaces crisp on the canvas (the reviewer's main readability risk).

Why not a single true-scale map: the route puts 22 spaces along about 600 m of Central Avenue, but
Oaklawn is 3.5 km away and Lake Ouachita about 15 km. A true-scale sheet, or a single fisheye, smears the rim into bands.
This was prototyped and rejected (`tools/map/preview.py`). The board therefore uses a **tourist-map projection**:
- **Downtown core, true shape** (`tools/map/warp.py`):
  - 0.75 board units per metre inside 230 m of the Fordyce, then a log-like falloff to about 1.5 km;
    bearings from the Row are exact.
  - Central Avenue is widened through downtown, so the Row walk and the west sidewalk can each carry a line of spaces.
  - Buildings keep their true footprints and proportions, from OSM.
- **Rim vignettes** (`tools/map/vignettes.py`): Oaklawn, Lake Hamilton with Garvan Gardens, and Lake Ouachita with
  Blakely Mountain Dam. Each is a true-shape patch of real data at its own scale, set at its true bearing from the Row.
  Signposts give the real distance. Lake Catherine is scenery in the south-east corner.
- The board says so in its legend: "Downtown at true layout; outlying places moved closer. Directions are true."

## Assets

| Asset | Tool | Notes |
|---|---|---|
| Board day render (`assets/board-day.webp`, plus `-lo`) | Blender (Cycles, OptiX) via `tools/map/build_board.py` | DEM terrain, TIGER streets, NHD water, OSM footprints, Row hero models, forest instances, brick route ribbon |
| Board night render | same script with `--night` | Lit windows, street lamps, moonlit steam; used by the dark theme |
| 6 player tokens | Blender (`tools/map/tokens.py`) | Lacquered pawns whose cross-section is the access shape; same camera and sun as the board |
| 8 district landmark paintings (card headers, passport art) | Codex image gen | One style pilot, then one batch using the pilot as reference |
| 8 passport stamps (ink, transparent) | Codex | Each stamp a different shape: oval, rectangle, scalloped, etc. |
| 8 category emblems (enamel badges) for the category reveal | Codex | Kept alongside the vector icons, which stay the fallback |
| Title-screen vignette (Row and mountain at dusk) | Codex, or the night render cropped | |
| Paper, leather and brass UI kit (textures) | Codex | 9-slice panels |

## Research additions

- `research/bathhouse-row-layout.md` and `research/geo-anchors.json` (agent pass): the north-to-south order, addresses,
  dates, architects, frontages, the Row's length and the downtown street geography, each with a source.
- **Confirmed from OSM footprints:** the north-to-south order is Superior, Hale, Maurice, Fordyce, Quapaw, Ozark, Buckstaff,
  Lamar, then the Administration Building. Building centroids are about 300 m apart from Superior to Lamar.
- `art-src/geo/SOURCES.md` lists every downloaded dataset, with its query URL and licence.

## Performance plan

- One board image per theme: a 1600 px "lo" copy (about 250 KB) paints first; a 3200 px copy (about 2 MB WebP) swaps in when decoded.
- Night art loads only when the dark theme is on.
- Token sprites are 208×240 WebP, about 10 KB each.
- The canvas draws one image blit plus overlays per frame. Rendering stops when idle, apart from ambient steam, which
  is throttled to 30 fps and off under reduced motion.
- Targets:
  - 60 fps on desktop and 30+ fps on phones
  - first paint under 1 s from local disk
  - `index.html` under 1 MB, total download under 6 MB
- Fallback: `?art=0`, or any image failure, draws the vector board, so the game is never blank.
  WebGL is not used, so there is no WebGL fallback to need.

## Test plan

- The existing 59 tests keep passing at both viewports.
- New `tests/art.test.mjs`:
  - every asset in `assets/manifest.json` loads, with no 404s
  - `isIdle()` stays false until the board art has decoded
  - `?art=0` renders the fallback with zero errors
  - every node projects inside the board image
  - no two spaces overlap
  - every space lies within 2 board units of its route ribbon
- New visual shots:
  - the board at both viewports, day and night
  - close-ups of the Row and of the tower
  - the category reveal, the stamp slam and the win scene
- Board tap test, closing the AC8 gap from REPORT.md: tap a highlighted space and check the move.
- fps in the busiest scene (6 tokens, steam, a highlight pulse) at both viewports.
