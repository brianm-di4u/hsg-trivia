# Art provenance

All painted art is original, made with OpenAI image generation through the Codex plugin (`codex:codex-rescue`) on
2026-10-28/29. The board and tokens are our own Blender renders (`tools/map/`). Raw PNGs in this folder are
git-ignored; the packed WebP files in `assets/` are what ships (`art.json` → `shared/test-harness/art-pack.mjs`).

Every prompt began with the same constraints:
- an original illustration for an open-source trivia board game set in Hot Springs, Arkansas
- no text, letters, numbers or signage words
- no logos or trademarks
- no real or recognisable people
- do not imitate any living artist

## Style pilots (approved, then used as references)

| File | Prompt summary |
|---|---|
| `pilot-row.png` → `land-row` | **Style:** gouache-and-ink travel poster, warm late-afternoon light from the left; cream, terracotta, sage, deep teal and brass palette. **Subject:** Bathhouse Row across Central Avenue, magnolias and a brick walk, Hot Springs Mountain and its tower behind. The Quapaw (tile dome, copper cupola), the Fordyce (cream brick, red hipped roof, stained-glass canopy) and the Ozark (twin three-tier towers). |
| `pilot-stamp-row.png` → `stamp-row` | A single cobalt rubber-stamp passport impression on white: scalloped circle, an engraving-style domed bathhouse with steam wisps, uneven ink. |

## Batches (each used the pilot as its style reference)

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
| `standee-*` (8) | Isolated painted miniatures on white, from a high three-quarter view: Arlington, tower, Oaklawn grandstand, ballpark, Happy Hollow shack, motor-court sign, dam, Bridge Street storefronts |

## Checks done on every image
- **Text:** checked at full size for stray lettering and logos. None found; the neon signs carry only arrows and starbursts.
- **People:** only small, generic figures.
- **Captions:** the card paintings are captioned "Illustration · <district>" in the game, so they are never mistaken for photographs.
