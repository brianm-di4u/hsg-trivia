# The board map: data, projection and honest distortions

The Trail board is a Blender-rendered tabletop diorama of the real valley, built by `tools/map/` from
public data. This note records what is true on the board, what is distorted, and why.

## Data (all downloaded 2026-10-28 into `art-src/geo/raw/`, which is git-ignored and refetchable)

| Layer | Source | Licence | Query |
|---|---|---|---|
| Terrain | USGS 3DEP elevation, ImageServer `exportImage` | Public domain (USGS) | `elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage`. Region bbox −93.30,34.38 to −92.85,34.66 at 1600×1000 px (about 28 m). Downtown bbox −93.080,34.495 to −93.025,34.535 at 2400×2100 px (about 2 m). F32 TIFF |
| Streets | US Census TIGERweb, Transportation layers 2 (primary), 6 (secondary) and 8 (local) | Public domain (US Census) | `tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer/<layer>/query`, GeoJSON, bbox above (local roads −93.13,34.44 to −92.98,34.57) |
| Railroads | TIGERweb layer 9 | Public domain | same |
| Lakes | USGS National Hydrography Dataset, layer 12 (Waterbody, large scale) | Public domain (USGS) | `hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/12/query`, areasqkm > 0.02 |
| Creeks | NHD layer 6 (Flowline, large scale) | Public domain | named flowlines only (Hot Springs Creek, Gulpha Creek, …) |
| Building footprints, trails, parks (downtown) | OpenStreetMap via the Overpass API | **ODbL 1.0, © OpenStreetMap contributors** (credited in SAMPLES.md and on the board) | `way["building"]`, `way["highway"~"path|footway|steps|pedestrian|track"]`, `way["leisure"="park"]` in 34.500,−93.068 to 34.530,−93.035 |
| Oaklawn oval, Blakely Mountain Dam, the vignettes' buildings | OpenStreetMap (Overpass) | ODbL 1.0 | relation `name=Oaklawn` (track rings), `waterway=dam` near 34.57,−93.19 |
| Point anchors (bathhouses, Arlington, tower, trails, ballfields, lakes) | `research/geo-anchors.json` (GNIS, NRHP, Wikipedia, and centroids derived from OSM footprints), cited per point | various | see `research/bathhouse-row-layout.md` |

## What is true on the board

- **The camera.** The board is seen from the west, looking east and tilted 30° from vertical: the classic
  view of the Row's fronts with Hot Springs Mountain behind. North is to the left; the compass on the board shows it.
- **Bathhouse Row.**
  - The eight bathhouses run north to south in their confirmed order: Superior, Hale, Maurice, Fordyce, Quapaw,
    Ozark, Buckstaff, Lamar, then the Administration Building.
  - Each uses its true OSM footprint, scaled uniformly, so frontages and proportions are true.
  - Roof forms and colours come from the research notes: the Quapaw's tile dome, the Maurice's green tile,
    the Fordyce's red hipped roof, the Ozark's twin stepped towers.
  - Heights are exaggerated 1.45× for the diorama look.
- **Terrain.** It is real USGS elevation, with vertical relief scaled by the local horizontal scale ×1.7.
  This covers Hot Springs, North and West Mountains and the Whittington valley.
- **Streets and trails.** Every street is a real TIGER street; the Peak and Short Cut trail spaces sit on the OSM trail lines.
- **Spaces.** Every named space sits at its real place, within the route's spacing adjustment of at most about 18 board units.
  Examples: the Ohio Club at 336 Central, the Medical Arts Building, the Malco Theatre, Velda Rose, the Mountainaire, Goat Rock, North Mountain's summit, Happy Hollow, Whittington Park and the Ban Johnson / Fogel Field site.

## Honest distortions (stated on the board and in the How-to-play text)

1. **A magnifier on downtown** (`tools/map/warp.py`):
   - The scale is 0.80 board units per metre within 230 m of the Fordyce, then falls off log-like out to about 1.1 km,
     then flatter still to about 2.1 km.
   - Directions from the Row are exact; distances shrink with distance.
   - This is a standard tourist-map device. A single true-scale sheet was prototyped and rejected: 22 spaces
     sit on about 600 m of Central Avenue, while Lake Ouachita is about 15 km away.
2. **A wider Central Avenue.** Through downtown the street is widened by about 26 m on each side. That gives room
   for one line of spaces on the Row's walk and one on the west sidewalk. Buildings are moved, never stretched.
3. **Outlying places moved closer** (`tools/map/vignettes.py`):
   - Oaklawn (2.0 mi S), Lake Hamilton with Garvan Gardens (3.5 mi S), Lake Ouachita with Blakely Mountain Dam
     (9 mi WNW) and Lake Catherine (4.8 mi SE) are each a true-shape patch of real data at their own scale.
   - Each is set into the rim and outlined by a dashed ring, with a plate giving the real distance and "moved closer".
   - Lake Hamilton and Lake Ouachita sit about 30–45° off their true bearings, so the outer loop never crosses itself.
4. **The Mountain Tower is drawn 2.2× taller** than the other buildings' scale, because it is the game's goal.

## The route vs. the real roads

The route follows the game graph, not traffic:
- down the Row, round Bridge Street and back up Central's west side;
- then the outer loop clockwise: south to Oaklawn, west past the lakes, in along Whittington Avenue,
  north up Park Avenue, round North Mountain past Goat Rock, and down Fountain Street through Happy Hollow.

For the loop round North Mountain to follow the real roads, the board swaps which of the Happy Hollow and
Park Avenue districts connects to the Ballfields. The graph's shape and every district's length are unchanged
(`src/js/board.js`).
