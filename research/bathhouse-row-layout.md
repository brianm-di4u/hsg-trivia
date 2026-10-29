# Bathhouse Row and Downtown Hot Springs: Verified Layout for the Tabletop Map

Scope: layout geometry only. History, colors and anecdotes are in `research/bathhouse-row-and-springs.md` and `research/downtown-and-landmarks.md`. This file confirms the north-to-south order and the addresses that those files left unverified, and adds measured frontages, the Row's length, street alignments and distances. Coordinates are in `geo-anchors.json`.

**Measurement method.** I measured frontages from the HABS AR-28 site plan (1984, drawn by Michael Peters). That sheet includes a straightened streetscape elevation of all nine buildings, drawn at the same scale as the plan. The scale bar reads 0–200 ft at 2.49 px/ft, from a 400-dpi render of the NPS-hosted PDF. I cross-checked against OpenStreetMap building footprints and the HABS Fordyce west-elevation sheet. Expect about ±5 ft.
Sources: [HABS AR-28 drawings (NPS copy)](https://npshistory.com/publications/hosp/habs-bathhouse-row.pdf); [LOC record HABS AR-28](https://www.loc.gov/item/ar0031/); [OSM footprints](https://www.openstreetmap.org/way/999352516)

**Abbreviations used below.**
- NHL = the 1974/1987 nomination: [NHL nomination](https://npgallery.nps.gov/NRHP/GetAsset/NHLS/74000275_text)
- CLI = the Cultural Landscapes Inventory: [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf)
- NPS sheet = the per-bathhouse NPS sheets, for example [Superior](https://npshistory.com/publications/hosp/bathhouses/superior.pdf)
- LMP = the 1989 Landscape Management Plan: [LMP 1989](https://npshistory.com/publications/hosp/lmp-bathhouse-row-1989.pdf)

---

## 1. North-to-south order: CONFIRMED

The order is **Superior, Hale, Maurice, Fordyce, Quapaw, Ozark, Buckstaff, Lamar**, followed by the Administration Building at the Reserve Street corner. Four independent sources agree:

- **HABS AR-28 site plan.** The streetscape elevation and the plan labels read, left to right, "SUPERIOR, HALE, MAURICE, FORDYCE, QUAPAW, OZARK, BUCKSTAFF, LAMAR, VISITORS CENTER". Reserve Ave is at the right end. The north arrow is illegible in the scan, so I took orientation from the street labels. — [HABS AR-28](https://npshistory.com/publications/hosp/habs-bathhouse-row.pdf). The HABS data page lists the bathhouses in the same order — [HABS data pages](https://tile.loc.gov/storage-services/master/pnp/habshaer/ar/ar0000/ar0031/data/ar0031data.pdf)
- **NHL nomination.** It says "The northernmost bathhouse on the row is the Superior". It describes the eight bathhouses in this same sequence and says the Administration Building is "Finishing the southern corner" — [NHL](https://npgallery.nps.gov/NRHP/GetAsset/NHLS/74000275_text)
- **NHL and CLI.** The Maurice and Fordyce are "strategically located at the north and south sides of the historic entrance" — [NHL](https://npgallery.nps.gov/NRHP/GetAsset/NHLS/74000275_text); [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf)
- **OSM footprint centroids.** Latitude falls steadily from the Superior (34.51487) to the Lamar (34.51215) and the Admin Building (34.51191) — [OSM](https://www.openstreetmap.org/way/1002548146)

## 2. Per-bathhouse table

**How to read the dimensions.**
- **Front (HABS)** is the wall-to-wall width on the HABS streetscape.
- **OSM front × depth** is the minimum bounding rectangle of the OSM footprint. Porches and rear wings are included.
- **Lat/lon** is the OSM polygon centroid (derived).

| # | Building | Address | Front HABS ft | OSM front × depth ft | Stories | Lat, lon |
|---|---|---|---|---|---|---|
| 1 | Superior | 329 Central | 89 | 82 × 110 (L-plan) | 2 + basement | 34.514870, -93.053311 |
| 2 | Hale | 341 Central | 116 | 123 × 81 | 2½ | 34.514551, -93.053363 |
| 3 | Maurice | 359 Central (conflict: 355) | 89 | 94 × 110 | 3 | 34.514091, -93.053400 |
| 4 | Fordyce | 369 Central | 107 (101 wall-to-wall, 110 at eaves, per Fordyce sheet) | 104 × 94 | 3 | 34.513714, -93.053473 |
| 5 | Quapaw | 413 Central | 185 | 180 × 98 | mostly 1, with a narrow 2nd story | 34.513245, -93.053581 |
| 6 | Ozark | 425 Central (conflict: 491) | 110 | 103 × 103 | 2 | 34.512765, -93.053622 |
| 7 | Buckstaff | 509 Central | 105 | 101 × 101 | 3 | 34.512428, -93.053597 |
| 8 | Lamar | 515 Central | 95 | 90 × 111 | 2 | 34.512151, -93.053563 |
| — | Admin Bldg | 101 Reserve St | 42 (narrow end faces Central) | 47 × 81 (long axis E–W) | 2 | 34.511910, -93.053584 |

**Address sources**
- **Superior 329:** [arkansas.com](https://www.arkansas.com/bars-pubs/superior-bathhouse-brewery); [OSM](https://www.openstreetmap.org/way/1002548146)
- **Hale 341:** [Visit Hot Springs](https://hotsprings.org/places/lodging/hotel-hale/); [OSM](https://www.openstreetmap.org/way/1002531001)
- **Maurice 359 (OSM) vs 355 (SAH Archipedia):** CONFLICT — [OSM](https://www.openstreetmap.org/way/1213679525); [SAH Archipedia AR-01-GA7](https://sah-archipedia.org/buildings/AR-01-GA7)
- **Fordyce 369:** [HMdb](https://www.hmdb.org/m.asp?m=61771); [arkansas.com](https://www.arkansas.com/hot-springs/landmarks/fordyce-bathhouse-national-park-visitor-center)
- **Quapaw 413:** [NPS](https://www.nps.gov/hosp/planyourvisit/soak-in-the-springs.htm); [SAH AR-01-GA5](https://sah-archipedia.org/buildings/AR-01-GA5)
- **Ozark 425 (arkansas.com, OSM) vs 491 (Texas Tech archive):** CONFLICT — [arkansas.com](https://www.arkansas.com/hot-springs/landmarks/ozark-bathhouse-cultural-center); [TTU](https://exhibits.lib.ttu.edu/s/openarch/item/30066)
- **Buckstaff 509:** [NPS](https://www.nps.gov/hosp/planyourvisit/soak-in-the-springs.htm)
- **Lamar 515:** [arkansas.com](https://www.arkansas.com/hot-springs/shopping-wellness/bathhouse-row-emporium)
- **Admin 101 Reserve:** [NPS](https://www.nps.gov/hosp/historyculture/maps.htm)

**Frontage cross-check.** Sum of the eight frontages: 896 ft. Gaps between buildings (HABS, N→S):

| Between | Gap (ft) | What is there |
|---|---|---|
| Superior / Hale | ~4 | nearly touching |
| Hale / Maurice | ~59 | Dripping Spring and thermal fountain |
| Maurice / Fordyce | ~45 | main entrance |
| Fordyce / Quapaw | ~33 | — |
| Quapaw / Ozark | ~30 | — |
| Ozark / Buckstaff | ~17 | — |
| Buckstaff / Lamar | ~11 | — |
| Lamar / Admin | ~12 | — |

- Fountains between the Hale and Maurice — [NPS](https://www.nps.gov/thingstodo/drink-the-water.htm)
- Building fronts stand 57–82 ft from the Central Ave centerline. Their rear walls are 48–73 ft from the Grand Promenade. Both figures are derived from OSM.

### Dates, architects, style, roof (per building)

**Superior**
- **Dates:** opened Feb 1, 1916 — [NPS sheet](https://npshistory.com/publications/hosp/bathhouses/superior.pdf)
- **Architect:** Harry C. Schwebke (NHL). Conflict: "Harvey C." (EOA, per the prior notes).
- **Style:** eclectic commercial, of classical-revival origin.
- **Form and roof:** L-plan. One-story sun porch projects forward. Brick parapets; flat roofs. Green-tile paterae.
- **Size:** "smallest bathhouse on the Row". 11,000 sq ft (NPS sheet) vs "more than 10,000" (NHL).

**Hale**
- **Dates:** 1892–93 (NHL); "most … completed in 1892" (NPS sheet). Remodels: Mann & Stern **1914** (NPS sheet, CLI) vs **1919** (NHL): CONFLICT. Converted to Mission style 1939–40 by Thompson, Sanders & Ginocchio.
- **Architect:** George and Fremont Orff (of Minneapolis, per CLI) — [NPS sheet](https://npshistory.com/publications/hosp/bathhouses/hale.pdf); [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf)
- **Roof:** red-tile hip roof over stucco, with a Spanish bell gable — [NHL](https://npgallery.nps.gov/NRHP/GetAsset/NHLS/74000275_text)
- **Size:** 12,000 sq ft.

**Maurice**
- **Dates:** begun 1911; opened Jan 1, 1912; Mann & Stern remodel 1915 — [NPS sheet](https://npshistory.com/publications/hosp/bathhouses/maurice.pdf)
- **Architect:** George Gleim Jr. "of Chicago" (NHL) vs "of New York City" (CLI): CONFLICT.
- **Style:** Renaissance Revival / Mediterranean.
- **Form and roof:** generally square plan. Predominantly flat roof; parapets and visible roof sections in **green tile**. Stucco inset with colored tiles. Metal-and-wire-glass skylights.
- **Size:** 23,000 sq ft (NPS sheet) vs "nearly 30,000 … including basement" (NHL): CONFLICT.

**Fordyce**
- **Dates:** built 1914–15; opened Mar 1, 1915 — [NPS sheet](https://npshistory.com/publications/hosp/bathhouses/fordyce.pdf)
- **Architect:** Mann & Stern.
- **Style:** Renaissance Revival with Spanish and Italian elements.
- **Facade:** seven bays. Cream brick in a lozenge pattern on floors 2–3; rusticated terra cotta at the base; stained-glass and copper marquee.
- **Roof:** the visible roofs are hipped, in decorative tile; the rest is flat with skylights — [NHL](https://npgallery.nps.gov/NRHP/GetAsset/NHLS/74000275_text)
- **Height:** eaves about 39–40 ft and rooftop structures about 57 ft above the sidewalk. Measured from the HABS Fordyce west-elevation sheet (scale 3/16" = 1'-0").
- **Size:** about 28,000 sq ft, called "the largest bathhouse on the Row" (NPS sheet). This CONFLICTS with the NHL's 30,000 sq ft for the Maurice.

**Quapaw**
- **Dates:** 1922. Built on two lots (the Horseshoe and Magnesia sites) — [NPS sheet](https://npshistory.com/publications/hosp/bathhouses/quapaw.pdf)
- **Architect:** Mann & Stern.
- **Style:** Spanish Colonial Revival.
- **Form:** first floor U-shaped; narrow 2nd story across the facade.
- **Dome:** colored-tile chevron mosaic with a band of rectangles and diamonds at the base. It rests on an octagonal base, has a copper cupola, and is framed by two massive finials. Sloped roofs in red clay tile; shell-and-sculpin parapets — [NHL](https://npgallery.nps.gov/NRHP/GetAsset/NHLS/74000275_text)
- **Size:** 24,000 sq ft (NPS sheet) vs ">20,000" (NHL).
- **Comfort stations:** two men's and women's comfort stations (Mann & Stern, 1923) stand behind the Quapaw on either side — [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf)

**Ozark**
- **Dates:** completed summer 1922 — [NPS sheet](https://npshistory.com/publications/hosp/bathhouses/ozark.pdf)
- **Architect:** Mann & Stern.
- **Style:** Spanish Colonial Revival.
- **Form and roof:** trapezoidal plan. Twin towers with three-tier setbacks; hipped red-clay-tile tower caps with finials; flat roof elsewhere. A 1942 renovation brought the wings forward and made the towers less prominent.
- **Size:** 14,000 sq ft.

**Buckstaff**
- **Dates:** opened Feb 1, 1912.
- **Architect:** **Frank W. Gibb and Company** — [NPS sheet](https://npshistory.com/publications/hosp/bathhouses/buckstaff.pdf); [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf). This was "not named" in the prior notes.
- **Style:** Neo-Classical Revival.
- **Facade and roof:** seven bays of two-story Doric columns; urns; rooftop sun porches at the north and south ends.
- **Brick color:** "cream-colored brick" (NHL) vs "taupe brick" (NPS sheet): CONFLICT.
- **Size:** 27,000 sq ft on three floors.

**Lamar**
- **Dates:** opened April 16, 1923 — [NPS sheet](https://npshistory.com/publications/hosp/bathhouses/lamar.pdf)
- **Architect:** Harry Schwebke (NPS sheet, CLI) vs "Roberts & Schwebke" (NPS Bathhouse Row page): CONFLICT.
- **Style:** transitional commercial.
- **Form and roof:** reinforced concrete with stucco. Flat roof; parapets capped with brick and clay tile. A one-story sun porch runs nearly the full front.

**Administration Building**
- **Dates and architect:** 1936, by the NPS Eastern Division, Branch of Plans and Design.
- **Style and roof:** Spanish Colonial Revival; clay-tile hip roof — [NHL](https://npgallery.nps.gov/NRHP/GetAsset/NHLS/74000275_text)
- **Orientation:** HABS calls it "the only structure not facing Central Avenue" — [HABS data](https://tile.loc.gov/storage-services/master/pnp/habshaer/ar/ar0000/ar0031/data/ar0031data.pdf). Its address is on Reserve St.

## 3. The Row as a whole

- **Side of the street:** "East side of Central Avenue between Reserve and Fountain Streets" — [NHL](https://npgallery.nps.gov/NRHP/GetAsset/NHLS/74000275_text)
- **Area:** 6.14 acres (1974 nomination) — [NHL](https://npgallery.nps.gov/NRHP/GetAsset/NHLS/74000275_text). The CLI's "Reservation Front" covers 18.00 acres and includes the hillside parks — [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf)
- **Length along Central (Reserve St to Fountain St):**
  - 1,705 ft along the OSM centerline between the two intersections — [OSM](https://www.openstreetmap.org/way/695791275)
  - "some 1700 feet" — [LMP 1989](https://npshistory.com/publications/hosp/lmp-bathhouse-row-1989.pdf)
  - 1,670 ft straight line between CLI boundary points A and B (UTM 15N 495057/3818896 and 495120/3819401) — [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf)
- **Built frontage:**
  - Superior's north wall to the Lamar's south wall: **~1,096 ft** (HABS) or ~1,077 ft (OSM)
  - To the Admin Building's south wall: **~1,150 ft** (HABS) or ~1,144 ft (OSM)
  - The remaining ~550 ft to Fountain St is **Arlington Lawn**. The CLI bounds it on the south by the Superior's north side and on the west by Central and Fountain — [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf)
- **Bearing:** the Row runs about N7°E overall, from CLI points A to B. Along OSM the alignment is:
  - Due north (359°) from Reserve St to about the Ozark/Quapaw line (~460 ft north of Reserve)
  - 7° past the Fordyce
  - ~11° alongside the Hale and Superior
  - Straightening to 0° just before Fountain St — [OSM](https://www.openstreetmap.org/way/695791275)
  - The HABS plan shows the same thing: the southern buildings sit square to the page and the northern ones are tilted — [HABS](https://npshistory.com/publications/hosp/habs-bathhouse-row.pdf)
- **Reserve St end:**
  - The Admin Building holds the corner. Next to it are the Grand Promenade's south stairs and the **Noble Fountain**, moved there in July 1957 — [NPS GP sheet](https://npshistory.com/publications/hosp/bathhouses/grand-promenade.pdf); [NPS Noble](https://www.nps.gov/places/noble-fountain-hot.htm)
  - The demolished Imperial Bathhouse, "the only bathhouse to face south", stood at this end until June 5, 1937 — [NPS GP sheet](https://npshistory.com/publications/hosp/bathhouses/grand-promenade.pdf)
- **Fountain St end:** Arlington Lawn, the Hot Water Cascade and the Grand Promenade's Fountain St ramp. The first two Arlington hotels stood on the lawn — [Baseball Trail](https://hotspringsbaseballtrail.com/see-the-trail/)
- **Setback and lawn:**
  - "All of the buildings are set back the same distance from the sidewalk" (NHL; no figure is given).
  - Stevens's 1890s plan: a 14-ft concrete promenade plus a 9-ft lawn border at the curb. Elevated streetcar landings 12 ft wide cut through the border. Lombardy poplars were to be replaced by a line of magnolias.
  - By 1939 the Magnolia Promenade was "a 12 foot wide concrete walkway" — [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf)
  - Today a single row of Southern Magnolias stands in a curbed turf strip. Then come the walk, a low Chinese-holly hedge and each building's lawn — [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf)
- **Main entrance:**
  - Located between the Maurice and Fordyce, at about the center of the Row. Two bronze eagles stand on stone pylons. A concrete path leads to the double staircase of the Stevens Balustrade, which has a hemicycle fountain niche — [NHL](https://npgallery.nps.gov/NRHP/GetAsset/NHLS/74000275_text)
  - The walk rises about 6 ft to the balustrade. The entrance climbs 30–40 ft above Central overall — [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf)
- **Grand Promenade (behind the Row):**
  - **NPS figures:** 0.5 mi; 619–717 ft elevation; 3.7% grade. Four access points: Reserve St stairs, Fountain St ramp, the Stevens Balustrade, and a ramp behind the Fordyce — [NPS trails](https://www.nps.gov/hosp/planyourvisit/hot-springs-and-north-mountain-trails.htm)
  - **OSM length:** about 1,870 ft for the brick spine (Reserve St to the Arlington Lawn path), plus a 525-ft footway to Fountain St. Total ≈ 2,390 ft (0.45 mi) — [OSM](https://www.openstreetmap.org/way/250880917)
  - **Width:** 22 ft as graded; reduced to 18 ft in 1956 — [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf)
  - **Completion date:** final landscaping July 25, 1958 ([NPS GP sheet](https://npshistory.com/publications/hosp/bathhouses/grand-promenade.pdf)) vs "completed in the early 1960s" ([NHL](https://npgallery.nps.gov/NRHP/GetAsset/NHLS/74000275_text)): CONFLICT
  - Named a National Recreation Trail April 13, 1982 (NPS GP sheet).
- **Hot Springs Creek arch date:** 1884 (NHL) vs completed 1886 (CLI) vs 1882–83 (prior notes): CONFLICT.

## 4. Nearby elements

- **Arlington Hotel (1924, Mann & Stern):**
  - Location: 239 Central, at 34.516667, -93.053056 — [Wikipedia](https://en.wikipedia.org/wiki/Arlington_Hotel_(Hot_Springs_National_Park))
  - It fills the wedge north of Fountain St and east of Central's NW-running leg, facing the Central/Fountain junction (34.516248, -93.053389).
  - The **Park/Whittington Y** is ~1,050 ft further NW along Central, at 34.518767, -93.055844 — [OSM](https://www.openstreetmap.org/way/1481563210)
- **Hot Springs Mountain Tower:**
  - Height: 216 ft — [NPS](https://www.nps.gov/places/hot-springs-mountain-tower.htm); [Wikipedia](https://en.wikipedia.org/wiki/Hot_Springs_Mountain_Tower)
  - Upper (open) deck at 1,256 ft above sea level (NPS).
  - Tower coordinates: 34.5172278, -93.0461056 (Wikipedia).
  - Summit (GNIS 57949): 34.517554, -93.045650 — [USGS geonames](https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/5)
  - Summit elevation CONFLICT: 1,041 ft (GNIS via [mytopo](https://geo.mytopo.com/feature/arkansas/garland/summit/57949/hot-springs-mountain/)) vs 315 m / 1,033 ft (OSM) vs tower base 1,060 ft ([MiraCosta guide](https://gotbooks.miracosta.edu/gonp/hosp/html/hosp0206.html)).
  - Straight line from the Row: 0.49 mi at 062°.
- **Display Spring:**
  - On the hillside directly behind the Maurice, at OSM spring node 34.514086, -93.053074 — [OSM](https://www.openstreetmap.org/node/11247323174)
  - The CLI places the Display Spring and Maurice Spring in the "Foreground Park" — [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf)
  - The Maurice Spring fountain and retaining wall "just north of the Maurice", 1903 — [NHL](https://npgallery.nps.gov/NRHP/GetAsset/NHLS/74000275_text)
- **Hot (Thermal) Water Cascade:**
  - Built about 1982 and non-contributing. It is a man-made tufa outcrop that starts west of the Grand Promenade and flows into a geometric thermal pool on Arlington Lawn.
  - CLI GPS: UTM 15N 495168/3819379, which converts to 34.516057, -93.052644 — [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf)
- **Noble Fountain:** "on Reserve St. (at the south entrance of the Grand Promenade)". Stone, with two iron eagles on a globe, beside a staircase — [NPS](https://www.nps.gov/thingstodo/drink-the-water.htm); [NPS place](https://www.nps.gov/places/noble-fountain-hot.htm)
- **Other fountains:**
  - The Shell Fountain on the Stevens Balustrade, between the Fordyce and Maurice.
  - The Dripping Spring between the Hale and Maurice.
  - Jug fountains in front of the Admin Building and the Libbey center on Reserve St — [NPS](https://www.nps.gov/thingstodo/drink-the-water.htm)
- **Peak Trail:**
  - 0.6 mi, 12.6% grade, 644–1,044 ft elevation. Paved at first, then gravel; climbs from the Grand Promenade to the Tower — [NPS trails](https://www.nps.gov/hosp/planyourvisit/hot-springs-and-north-mountain-trails.htm)
  - OSM: 2,817 ft (0.53 mi), from 34.514544, -93.053008 (Promenade behind the Hale) to 34.517071, -93.046009 (Tower) — [OSM](https://www.openstreetmap.org/way/982266806)
- **Short Cut Trail:**
  - 0.2 mi, **21.1%** grade, 813–1,036 ft elevation. Links the Oertel Trail with the Hot Springs Mountain Trail near a picnic area (NPS).
  - OSM: 991 ft, from 34.513841, -93.050261 to 34.515577, -93.047820 — [OSM](https://www.openstreetmap.org/way/626283169)
- **Tufa Terrace Trail:** 0.3 mi, 6%, 650–745 ft, paved (NPS).

## 5. Downtown street geography (all from OSM unless noted)

- **Central Ave:**
  - South of Reserve St it runs due north. It crosses the Bridge St junction (34.509445, -93.054034), where the alignment south of Bridge St turns to ~19°.
  - It follows the Row as described in §3.
  - At **Fountain St it bends about 45° left**, turning NW (bearing 310–340°) for ~1,020 ft to the **Y**. There Park Ave continues N/NNE and Whittington Ave goes W/WSW — [OSM](https://www.openstreetmap.org/way/1481563210)
- **Park Ave:** runs from the Y (34.5188, -93.0558) about 5,000 ft north and then NE to 34.5306, -93.0481. The motor courts line 311–1011 Park — [OSM](https://www.openstreetmap.org/way/911123309); [NRHP list](https://en.wikipedia.org/wiki/National_Register_of_Historic_Places_listings_in_Garland_County,_Arkansas)
- **Whittington Ave:** runs west from the Y about 1.1 mi up the Whittington valley, past Whittington Park (Sabie St) to the Alligator Farm and Ban Johnson / Fogel sites (847–870 Whittington) — [OSM](https://www.openstreetmap.org/way/12809350)
- **Fountain St:**
  - Leaves Central at 34.516248, -93.053389 heading NE (~55°). It climbs between Arlington Lawn and the hotel, then 1,650 ft to a bend at 34.5188, -93.0489, where the Happy Hollow markers stand.
  - It continues NE another ~3,900 ft into the gorge between Hot Springs and North mountains, near Hot Springs Mountain Drive — [OSM](https://www.openstreetmap.org/way/12810305); [HMdb](https://www.hmdb.org/m.asp?m=145652)
  - The HMdb text puts the marker "1.2 miles north of Central", which disagrees with the ~0.3 mi road distance: CONFLICT.
- **Reserve St:** runs east from Central (34.511616, -93.054023) along the Admin Building, then past the Army-Navy Hospital (563 ft to the first bend, then 1,175 ft more) — [OSM](https://www.openstreetmap.org/way/912626292)
- **Bridge St:**
  - Runs east–west from Central to the start of Malvern Ave, at about 34.50945. It is 0.31 mi south of the Row point.
  - Length CONFLICT: OSM centerline-to-centerline is **179 ft**, vs the well-known claim of 98 ft ("World's Shortest Street") — [OSM](https://www.openstreetmap.org/way/12805886); [AP via Las Vegas Sun](https://lasvegassun.com/news/2025/mar/17/arkansas-city-boasts-worlds-shortest-st-patricks-d/). The two may measure different things; curb lines were not checked.
- **Malvern Ave:** begins at the east end of Bridge St (34.509453, -93.053439) and runs SE about 1.0 mi, past the Pleasant St district — [OSM](https://www.openstreetmap.org/way/911123284)
- **Hot Springs Creek:**
  - OSM traces a **6,118-ft culvert**. It starts at 34.52243, -93.05527 under Park Ave, passes through the Y, and follows Central's NW leg.
  - It then runs south **under the east edge of Central / the Magnolia Promenade**, 10–15 m east of the street centerline, past Reserve St.
  - It turns SSE under the blocks east of Central and comes out into the open at **34.507257, -93.052004**.
  - From there it flows south ~2.7 mi to Lake Hamilton (34.4635, -93.0443) — [OSM](https://www.openstreetmap.org/way/1213972844); [OSM](https://www.openstreetmap.org/way/352881672)
  - The bathhouses were built on its east bank — [NHL](https://npgallery.nps.gov/NRHP/GetAsset/NHLS/74000275_text). Wikipedia says the creek "rises near Whittington Avenue"; OSM traces its source up Park Ave. Whittington Creek may be the source of the disagreement (open question).
- **West-side landmarks (west side of Central, facing the Row):**
  - **Southern Club, 250 Central:** 34.5161, -93.0535, opposite the Arlington Lawn — [OSM](https://www.openstreetmap.org/way/1002532568)
  - **Medical Arts Building, 236 Central:** 34.516389, -93.053889, by the Fountain junction — [Wikipedia](https://en.wikipedia.org/wiki/Medical_Arts_Building_(Hot_Springs,_Arkansas))
  - **Ohio Club, 336 Central:** 34.5149, -93.0538, **directly opposite the Superior** — [Nominatim/OSM](https://nominatim.openstreetmap.org/search?q=336+Central+Avenue,+Hot+Springs,+Arkansas)
  - **Malco Theatre, 817 Central:** 0.34 mi south of the Row point, just north of Bridge St. Coordinate CONFLICT: 34.508967, -93.054236 ([NRHP list](https://en.wikipedia.org/wiki/National_Register_of_Historic_Places_listings_in_Garland_County,_Arkansas); the Nominatim address point agrees) vs 34.510556, -93.054167 ([Wikipedia](https://en.wikipedia.org/wiki/Malco_Theatre)).

## 6. Distances and bearings from Bathhouse Row

The origin is the NRHP district point, 34.513889, -93.053611. Straight line is great-circle distance; bearing is true. Drive distance is from the OSRM demo router on OSM roads, from the same origin — [OSRM](https://router.project-osrm.org/).

| Target (anchor key) | Straight line | Bearing | Drive |
|---|---|---|---|
| Arlington Hotel (`arlington`) | 0.19 mi / 0.31 km | 009° N | 0.2 mi |
| Happy Hollow markers (`happyHollow`) | 0.42 mi / 0.68 km | 037° NE | 0.5 mi |
| Mountain Tower (`tower`) | 0.49 mi / 0.78 km | 062° ENE | 1.9 mi (by road) |
| Park Ave motor courts, south end at 311 Park | 0.52 mi | 353° N | 0.6 mi |
| Park Ave strip, north end at 1011 Park | 1.29 mi | 020° NNE | 1.5 mi |
| Whittington Park HD (`whittingtonPark`) | 0.72 mi / 1.15 km | 285° WNW | 1.0 mi |
| Fogel Field / Ban Johnson Park sites | 1.12 / 1.17 mi | 274° W | 1.5 / 1.6 mi |
| Majestic Park (`majesticPark`) | 1.28 mi / 2.06 km | 175° S | 1.6 mi |
| Oaklawn (`oaklawn`) | 2.01 mi / 3.23 km | 186° S | 2.3 mi |
| Lake Hamilton, nearest shore (Hot Springs Creek arm) | 3.52 mi / 5.67 km | 171° S | 4.5 mi |
| Garvan Woodland Gardens | 5.49 mi / 8.84 km | 175° S | 8.7 mi |
| Carpenter Dam | 5.20 mi | 162° SSE | 6.4 mi |
| Lake Catherine, nearest shore | 4.78 mi / 7.70 km | 127° SE | 5.6 mi |
| Lake Catherine State Park | 9.34 mi / 15.0 km | 124° SE | 15.0 mi |
| Lake Ouachita, nearest shore (by Blakely Dam) | 8.99 mi / 14.5 km | 298° WNW | 14.5 mi |
| Lake Ouachita State Park | 10.09 mi / 16.3 km | 316° NW | 17.4 mi |
| Blakely Mountain Dam | 9.00 mi | 297° WNW | 14.4 mi |

**Coordinate sources for the table**
- Lake shorelines are computed from OSM polygons: [Hamilton](https://www.openstreetmap.org/relation/1950316), [Catherine](https://www.openstreetmap.org/relation/3368421), [Ouachita](https://www.openstreetmap.org/relation/1909083).
- Park and venue points: [Oaklawn](https://en.wikipedia.org/wiki/Oaklawn_Racing_Casino_Resort), [Majestic Park](https://en.wikipedia.org/wiki/Majestic_Park), [Fogel Field](https://en.wikipedia.org/wiki/Fogel_Field), [Ban Johnson Park](https://en.wikipedia.org/wiki/Ban_Johnson_Park), [Garvan](https://en.wikipedia.org/wiki/Garvan_Woodland_Gardens), [Lake Catherine SP](https://en.wikipedia.org/wiki/Lake_Catherine_State_Park), [Lake Ouachita SP](https://en.wikipedia.org/wiki/Lake_Ouachita_State_Park)

**Mountains (GNIS)** — [USGS geonames](https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/5)
- North Mountain: 1.11 mi at 038°
- Sugarloaf Mountain: 1.61 mi at 286°
- West Mountain summit: 2.75 mi at 260°. This point is the ridge high point (433 m per OSM), well west of the park's West Mountain Drive overlooks, which are ~0.9 mi away.
- Goat Rock viewpoint: 1.24 mi at 042° — [OSM](https://www.openstreetmap.org/node/4465433144)

## Open questions

1. **Maurice address:** 359 (OSM) or 355 (SAH Archipedia)? **Ozark address:** 425 or 491? Garland County assessor or NPS lease records would settle both.
2. The HABS north arrow is illegible in the scan. Orientation was taken from the street labels; a clean LOC TIFF of AR-28 sheet 2 would confirm it. loc.gov refused connections from this machine.
3. Frontage tolerances: the HABS widths may include cornices. Only the Fordyce was checked against its own measured sheet (101 ft wall, 110 ft eaves). The other HABS elevation sheets, pages 2–15 of the PDF, could tighten every width and give heights.
4. Is the Quapaw's 180–185 ft frontage the main block only, or does the HABS streetscape include the 1923 comfort stations behind it?
5. Size and "largest" conflict: Maurice 23,000 vs ~30,000 sq ft; Fordyce described as largest at ~28,000.
6. Architect conflicts: Lamar (Schwebke vs Roberts & Schwebke), Maurice (Gleim of Chicago or of New York), Hale remodel (1914 or 1919). Buckstaff brick: cream or taupe?
7. Bridge St: the 98-ft figure vs 179 ft centerline-to-centerline. A curb-to-curb measurement is needed.
8. The Grand Promenade's 0.5 mi (NPS) vs ~0.45 mi (OSM). Its elevation at the Reserve St stairs vs Central Ave's elevation (~590 ft?) was not found in a primary source.
9. The Happy Hollow amusement park's footprint is unknown. The HMdb marker point is a proxy, and the HMdb "1.2 miles" distance is wrong.
10. The full 2010 CLR (`clr-ea-2010.pdf` on npshistory.com) was not mined. It may contain lot-line dimensions and the Arlington Lawn plan.
