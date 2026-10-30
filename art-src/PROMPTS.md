# Art provenance

All painted art is original, made with OpenAI image generation through the Codex plugin (`codex:codex-rescue`) on
2026-10-28/29. The pawns are our own Blender renders (`tools/map/tokens.py`). Raw PNGs in this folder are git-ignored;
the packed WebP files in `assets/` are what ships (`art.json` → `shared/test-harness/art-pack.mjs`).

Every prompt began with the same constraints:
- an original illustration for an open-source trivia board game set in Hot Springs, Arkansas
- no text, letters, numbers or signage words
- no logos or trademarks
- no real or recognisable people
- do not imitate any living artist

## The board (v3, 2026-10-29): a painted 2D map with the real landmarks layered on it

The board is built in layers by `tools/map/illustrate.mjs` (Canvas2D in the harness's Chromium):
1. **Guide** (`art-src/board2d/guide.png`, `--guide`): a colour-coded plan of the real valley drawn from public data
   (USGS relief, OSM land cover and buildings, NHD water, TIGER roads), with the route, its spaces and an empty lawn plot
   for every landmark. It is the composition, never shipped.
2. **Base painting** (`art-src/board2d/base.png`): the image model repaints the guide in the style of the three
   reference maps in `reference-samples/` (attached as style images). Prompt, in short: *repaint image 1 as a finished
   hand-painted illustrated board-game map in exactly the style of the references: ink-and-watercolour on warm aged
   parchment, every tree individually inked, dense forests on the hills, blue lakes with white wave strokes, layered
   distant blue-green ridges and a pale sky; follow image 1's composition exactly; the cream band becomes a cream dirt
   path with empty oval clearings; the plots stay open lawn; the red-brown blocks become small hand-drawn town
   buildings; no text, people, animals, boats or game pieces.* The model drifts by about 30 px, so
   `--register base` warps the painting back onto the guide (an affine fit plus a smooth field of local offsets,
   matching the route to the painted path and the lakes to the painted water): mean error 6.9 px → 1.4 px.
3. **On top, drawn from data:** the route path and the stone seat under every space, the landmark paintings at their
   true places (back to front, with cast and contact shadows and a sepia edge), the title scroll, the compass rose and a
   sheet of old paper. The night board is the same picture graded to dusk with lit windows, lamps and the tower beacon.

### Landmarks, painted from photographs of the real buildings

Each landmark was painted with its reference photos attached as input images, from a feature checklist written from
the sourced research (`art-src/landmarks.json`; `research/visual-style-guide.md`, `research/bathhouse-row-layout.md`),
then checked against the photos and regenerated (up to three times) where a feature was missing or wrong. Photo
credits and licences are in `art-src/photo-refs/sources.json`; the photos are consulted only, never shipped.

| Landmark | Photo sources | Notes |
|---|---|---|
| Superior, Hale, Maurice, Fordyce, Ozark, Buckstaff (Bathhouse Row) | Library of Congress: HABS AR-28 (1984) and Carol M. Highsmith (2020), no known restrictions | Front-on, from above, a little taller than life. Hale has ten upper arched windows (the real front has twelve). |
| Quapaw | HABS AR-28 colour (1984); Highsmith (2020) | Adds two small roof blocks the photos do not show. |
| Lamar | HABS AR-28; NPS photo | |
| Administration Building | HABS AR-28 | Painted from its main (Reserve Avenue) front. |
| Arlington Hotel | Highsmith (2020); NPS photo | Tower caps follow the photos (shallow), not the research note's "pyramidal". |
| Southern Club | Highsmith (2020) | Today's front: dark structural glass below, six round-arched windows above. |
| Army and Navy Hospital | NPS photo | |
| Hot Springs Mountain Tower | NPS photos (two partial views combined) | The real 1983 steel tower, not a castle. |
| Medical Arts Building, Malco Theatre, Mountainaire Hotel, Anthony Chapel, Oaklawn grandstand (today) | Wikimedia Commons, CC BY / CC BY-SA (no public-domain photo exists) | Consult-only references for original paintings; credited in `sources.json`. Mountainaire as in its 1940s postcards; Oaklawn as before the post-2019 expansion. |
| Happy Hollow (c. 1900), ballpark (c. 1912) | Detroit Publishing and Bain collections, LOC, no known restrictions | Composed from several period photos; the ballpark's full grandstand is reconstructed. |
| Blakely Mountain Dam | US Army Corps of Engineers brochure photo (LOC map collection, US government work) | |
| The Ohio Club | — | Not painted: no photo of its whole front exists under an allowed licence. |

### Figures that move on the board (`doodle-*`)

The racehorse (round Oaklawn's oval), a sailboat and a bass-fishing boat (on the lakes) and a c. 1900 Hot Springs
streetcar (on Central Avenue; from the Detroit Publishing photos in `photo-refs/streetcar/`, colours interpreted
from monochrome). Each was painted on white with the board map and the horse as style references.

## Card and passport art (v2, 2026-10-28)

### Style pilots (approved, then used as references)

| File | Prompt summary |
|---|---|
| `pilot-row.png` → `land-row` | **Style:** gouache-and-ink travel poster, warm late-afternoon light from the left; cream, terracotta, sage, deep teal and brass palette. **Subject:** Bathhouse Row across Central Avenue, magnolias and a brick walk, Hot Springs Mountain and its tower behind. The Quapaw (tile dome, copper cupola), the Fordyce (cream brick, red hipped roof, stained-glass canopy) and the Ozark (twin three-tier towers). |
| `pilot-stamp-row.png` → `stamp-row` | A single cobalt rubber-stamp passport impression on white: scalloped circle, an engraving-style domed bathhouse with steam wisps, uneven ink. |

### Batches (each used the pilot as its style reference)

| Asset | Subject |
|---|---|
| `land-central` | The Arlington Hotel (1924): twin towers with red-tile pyramid caps, at the fork of Central Avenue |
| `land-bridge` | Bridge Street, a one-block brick street with storefronts, parade bunting and a marching drum |
| `land-oaklawn` | Spring thoroughbred race, cream and green grandstand, plain-coloured silks |
| `land-lakes` | Lake Ouachita among pine ridges, a sailboat, the dam far off |
| `land-ballfields` | Early-1900s spring-training ballfield, wooden grandstand, flannel uniforms with no lettering |
| `land-hollow` | Happy Hollow around 1900: photo shack, bellows camera, painted cut-outs, a cold spring |
| `land-park` | A 1950s motor court at dusk: neon arrow sign with no words, a pool, two-tone cars |
| `land-tower` | The 216-ft Hot Springs Mountain Tower above the valley at golden hour |
| `stamp-*` (7) | One ink colour per district; each a different shape (perforated, oval, octagon, double ring, diamond, shield, rounded square) |

## Checks done on every image
- **Text:** checked at full size for stray lettering and logos. None found; the neon signs carry only arrows and starbursts, and marquees are blank.
- **People:** only small, generic figures with no faces.
- **Captions:** the card paintings are captioned "Illustration · <district>" in the game, so they are never mistaken for photographs.
