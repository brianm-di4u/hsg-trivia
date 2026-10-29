# Town content: Valley of Vapors Trivia Trail

Every place, fact, name, color and story the game uses outside the question bank, with its source.
Questions themselves come from `data/questions.json` (an audited copy of `research/trivia-bank.json`;
see `question-audit.md`). Short board labels and stamp blurbs below are the only other factual text
on screen. Corpus paths are relative to the repo root; URLs are the corpus's inline sources.

## 1. Board districts and their categories

The board is an **original** winding loop through eight Hot Springs districts plus a mountain spur.
Placement on the map is stylized (not to scale) but keeps the real relative layout: Central Avenue
down the valley, Bathhouse Row on its east side, the Arlington at the north "Y", Whittington Avenue
running west from the Y, Park Avenue running northeast, North Mountain and Hot Springs Mountain to the
north and east, Oaklawn to the south and the lakes to the south and west.

| # | District | Category | Stamp landmark | Stamp blurb (on screen) | Source |
|---|---|---|---|---|---|
| 1 | Bathhouse Row | Places & Landmarks | Quapaw Baths | "1922 · the Row's tallest dome" | `research/places.json` id `quapaw-bathhouse` (NPS: Soak in the Springs); `bathhouse-row-and-springs.md` |
| 2 | Central Avenue | History | Arlington Hotel | "1924 · at the north Y of Central Avenue" | `places.json` `arlington-hotel` (Wikipedia: Arlington Hotel); `downtown-and-landmarks.md` intro |
| 3 | Park Avenue | People | Park Avenue | "Motor courts and a mid-century hotel boom" | `downtown-and-landmarks.md` (1950–1965 hotel and motel boom, Rex Nelson "Along Park Avenue"); `places.json` `park-avenue-motor-courts` |
| 4 | Happy Hollow | Legends & Oddities | Happy Hollow | "Home of a cold spring treated by ozone filtration" | Audited question hs-0157 (Wikipedia: Hot Springs National Park). The McLeod studio history in `other-attractions.md` is snippet-only, so it is not shown |
| 5 | The Ballfields | Sports | Whittington Park | "Ballpark from 1894 · Ruth's long homer, 1918" | `places.json` `whittington-park-ballpark` (Wikipedia: Ban Johnson Park) |
| 6 | The Lakes | Nature & Lakes | Lake Ouachita | "Blakely Mountain Dam, 1948–53" | `places.json` `lake-ouachita` (Wikipedia: Lake Ouachita) |
| 7 | Oaklawn | Entertainment | Oaklawn | "Racing since 1904 or 1905 — sources differ" | `places.json` `oaklawn`; `oaklawn-and-racing.md` (conflict kept as a hedge) |
| 8 | Bridge Street | Food & Culture | Bridge Street | "About 98 ft — the shortest parade route" | `culture-events-food.md` → World's Shortest St. Patrick's Day Parade (Las Vegas Sun/AP 2025; Visit Hot Springs) |
| — | Hot Springs Mountain | (finale) | Mountain Tower | "216 ft · opened June 3, 1983" | `other-attractions.md` → Hot Springs Mountain Tower (NPS; Wikipedia) |

Category icons follow `research/game-hooks.md` §4 idea 2 (catalog numbers from
`visual-style-guide.md` → Icon catalog): History = steam spring (#1), Places & Landmarks = Quapaw dome
(#5), Nature & Lakes = bass (#37), Sports = baseball (#42), People = fedora (#29, generic, no
likeness), Food & Culture = plate with fork and knife, Entertainment = film reel, Legends & Oddities =
merman (a generic fish-tailed figure). No logos or brand marks. game-hooks suggested a smoker for Food &
Culture; drawn small it read as an animal in screenshot review (DEV-PLAN defect D3), so a generic dining
sign replaced it.

Real places are settings only. The help screen says: "Real Hot Springs places appear as setting only.
No business, park or school endorses or is affiliated with this game."

## 2. Spaces named after real places (board labels only)

Each district's ordinary spaces carry short place labels drawn from `places.json` (names only):

- **Bathhouse Row:** Superior, Hale, Maurice, Fordyce, Ozark, Buckstaff, Lamar (`visual-style-guide.md` → Skyline recipe and row order; north→south order per Wikipedia: Bathhouse Row), Grand Promenade (trail, 0.5 mi, 3.7%).
- **Central Avenue:** Arlington, Southern Club, Ohio Club, Medical Arts (`places.json`; `downtown-and-landmarks.md`).
- **Park Avenue:** Velda Rose, motor courts, Mountainaire (`downtown-and-landmarks.md`).
- **Happy Hollow:** North Mountain, Happy Hollow Spring (cold jug-filling spring, `places.json`), Goat Rock (trail).
- **The Ballfields:** Whittington Park, Fogel Field, Majestic Park (`places.json`; `baseball-spring-training.md`).
- **The Lakes:** Lake Hamilton (named for Hamilton Moses), Lake Catherine, Garvan Gardens, Lake Ouachita (`places.json`).
- **Oaklawn:** grandstand, paddock, post time (generic racing words).
- **Bridge Street:** Malvern Avenue / Pleasant Street ("Black Broadway", `places.json` `pleasant-street-historic-district`), Malco Theatre (film festival screenings), Bridge Street.

## 3. Special spaces (original mechanics, real flavor)

| Space | Flavor fact | Source |
|---|---|---|
| **Steam vent** (paired shortcuts) | The springs average about 143 °F, "easily the hottest springs east of the Rocky Mountains" | `geography-lakes-mountains.md` → Temperature (NPS Display Spring) |
| Vent pair "Creek Tunnel": Bathhouse Row ↔ the Lakes | Hot Springs Creek runs in a tunnel under Bathhouse Row and empties into Lake Hamilton | `geography-lakes-mountains.md` → Hot Springs Creek and the arch (Wikipedia: Hot Springs, AR) |
| **Post Time** wager spaces (Oaklawn) | Oaklawn's January–May race meet | `culture-events-food.md` → Events calendar |
| **Time Warp** (order three events) | Events from `research/timeline.json`: `confidence: confirmed`, 1541–2025, three different eras, distinct years. Sensitive history (civil-rights entries, killings, lynchings, bombings, slavery, deaths) is excluded because Time Warp and Postcards are gameplay (corpus content rules) | `timeline.json` via `tools/make-timeline-lite.mjs` |
| **Postcard** (free fact + 1 ticket) | One `timeline.json` event (confirmed) shown as a linen postcard with its year and source | `timeline.json`; linen look from `visual-style-guide.md` P6 |
| **Grand Jury** (Legends question or lose a turn) | Board-game hook from the gangster notes; no real person named | `research/game-hooks.md` §4 idea 10 |
| **Trolley stop** | Early electric streetcars (icon #43); trolley fares are not sourced, so the cost is game tickets only | `visual-style-guide.md` → Icon catalog |

## 4. The mountain spur (finale climb)

Real NPS trail names and grades set the route (`geography-lakes-mountains.md` → Trails, NPS Hot Springs &
North Mountain Trails page):

| Spur segment | Real trail | Fact shown | Game effect |
|---|---|---|---|
| Trailhead | Grand Promenade | 0.5 mi, 3.7% grade | entry point (needs the stamp target) |
| Fork A | Short Cut | 0.2 mi, 21.1% — the park's steepest | 2 spaces, each costs 2 steps |
| Fork B | Peak Trail | 0.6 mi, 12.6%, tops at 1,044 ft | 4 spaces, 1 step each |
| Summit | Hot Springs Mountain Tower | 216 ft lattice steel tower, opened June 3, 1983 | finale question |

Tower history for the win screen: Woolman's wooden tower (1877, NPS), the Rix steel tower (opened 1906
per the Sentinel-Record; the corpus flags conflicts), the 216-ft tower (1983) — shown hedged:
"Three towers have stood here since 1877."

## 5. Eras (era mode, Time Warp, postcards)

Ids, names and ranges from `research/timeline.json` → `eras` (matching `research/00-INDEX.md`):
`ancient` Ancient Valley (before 1804), `frontier` Frontier Springs (1804–1874), `gilded-spa` Gilded
Spa (1875–1920), `roaring` Roaring Spa Town (1921–1946), `midcentury` Midcentury Vapors (1947–1967),
`revival` Revival Years (1968–1999), `modern` Modern Spa City (2000–2026). Era-mode cards use the era's
one-line `summary` from `timeline.json`. `ancient` has too few questions for a 10-question round, so
era mode offers "Ancient & Frontier" as one card.

## 6. Colors and type

- Board: `gilded-spa` palette (cream brick #E6D7B5, red tile #A9432C, terra cotta #C46A3E, Maurice green
  #4E7D5B, cobalt #2B4C9B, brass #D9A23A, marble #F2EFE8, wrought iron #1F2A24).
- Water and steam: `thermal-water` (pool #1F5F6B, algae #2A9D8F, tufa #9A968C/#C8C3B6, steam white at 25–35%).
- Forest/mountains: `ouachita-forest` (#1F3324, #2F4A2C, #5C7A3A); trails: `nps-rustic` (#3E3528, #5E4B3C, #EDE3C8).
- Question cards: `linen-postcard` (#F3E9D2 bg, #FBF6EA surface, #1F2F5C text, #4A5675 muted).
- Era mode tints use `ERA_PALETTE` from `shared/design/tokens.js`.
- UI text uses the shared default theme (`--color-*`, light and dark) — all pairs ≥ 4.5:1 per `shared/design/README.md`.
- Fonts: `--font-serif-victorian` for titles, `--font-sans` for UI, `--font-mono` for tickets/scores.
- Every hex is an estimate (see `shared/design/README.md`).
- Category colors are a game-derived, colorblind-aware set (Okabe–Ito based) and always paired with an icon and a text label.

## 7. Fictional content

- Player names default to fictional travelers ("Traveler 1"…); AI opponents are fictional
  archetypes with invented names: "Doc Vapor" (easy), "Miss Promenade" (medium), "The Professor" (hard),
  plus "Ticket Taker", "Trail Boss", "Lady Tufa". No real person is a character.
- Bath tickets are a game currency; no historic price is implied.
