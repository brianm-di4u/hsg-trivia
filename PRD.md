# PRD — Valley of Vapors Trivia Trail

## 1. Vision

A warm, illustrated trivia board game about Hot Springs, Arkansas. Up to six travelers wander a
hand-drawn map of the Spa City — Bathhouse Row, Central Avenue, Park Avenue, Happy Hollow, the
ballfields, the lakes, Oaklawn and Bridge Street — answering questions to collect landmark stamps in a
travel passport, then race up Hot Springs Mountain to the tower for one last Summit question.
Every answer teaches something true: each one is followed by a short explanation and its source.

**Pillars**
1. **True and sourced.** Only audited facts; explanation + source after every answer; claims labeled.
2. **A board worth looking at.** A code-drawn map of the real town layout, animated tokens, steam.
3. **Quick to start, fun at any table size.** Solo, hot-seat for up to six, AI opponents, short modes.
4. **Everyone can play.** Full keyboard play, colorblind-safe cues, adjustable or no timers, mobile.

## 2. Target players

Families and visitors to Hot Springs (ages 10+), local-history fans, classrooms (pass-and-play on one
screen), and solo players who want a 3-minute daily quiz.

## 3. Modes

| Mode | Players | Length | Summary |
|---|---|---|---|
| **Trail Game** | 1–6 (any mix of humans and AI) | 15–40 min | The board game below |
| **Quick 10** | 1 | 3 min | 10 adaptive questions, mixed categories, score + streaks, best score saved |
| **Era Express** | 1 | 3 min | Pick an era (from `timeline.json` ids); 10 questions from that era |
| **Daily Challenge** | 1 | 2 min | 7 questions chosen from the date; same for everyone that day; streak and shareable result text |

## 4. Trail Game rules (complete)

**Setup.** 1–6 seats. Each seat: name, Human or AI (Easy / Medium / Hard), a token with a unique
shape and color. Choose the stamp target: Day Trip (4), Weekend (6, default) or Grand Tour (8).
Everyone starts at **the Y** (Arlington) with 3 bath tickets.

**Goal.** Collect the target number of different district stamps, climb to the **Mountain Tower** and
answer the **Summit question** correctly. First to do so wins.

**On your turn**
1. *(Optional, at a trolley stop)* Ride the trolley to any other trolley stop for 2 tickets instead
   of rolling. Your turn then ends.
2. Roll the steam gauge (1–6).
3. Move exactly that many steps along the route, either direction, choosing at forks. You may not
   pass through the same space twice in one move. Highlighted spaces show where you can end.
   You may pay 1 ticket to re-roll once per turn before moving.
4. Resolve the space you land on:

| Space | Effect |
|---|---|
| District space (icon) | Answer a question in the district's category. Correct: +1 / +2 / +3 tickets for easy / medium / hard |
| **Landmark** (gold ring) | Answer a district question. Correct: that district's **stamp** (if new) + 2 tickets |
| **Steam vent** | You may ride the steam to the paired vent across town |
| **Post Time** (Oaklawn) | Wager 0–5 tickets, then answer a question. Correct: win the wager (×2 if hard). Wrong: lose it |
| **Time Warp** | Put three historical events in order. Correct: warp to any landmark you lack and answer its question now |
| **Postcard** | Read a historical postcard and take 1 ticket |
| **Grand Jury** | Answer a Legends & Oddities question or lose your next turn |
| **Trolley stop / the Y** | Nothing on landing; next turn you may ride |
| **Trail** (mountain) | Nothing — keep climbing |
| **Mountain Tower** | Summit question (hard; category by weather-vane spin). Correct: you win. Wrong: back to the trailhead, −1 ticket |

**The mountain.** The trailhead (Grand Promenade, behind Bathhouse Row) only opens once you hold the
stamp target. From the fork, the **Short Cut** is two spaces but each costs 2 steps (21.1% grade); the
**Peak Trail** is four ordinary spaces. Reaching the Tower ends your move even with steps left over.

**Questions.** Four choices. Optional timer (Off / 30 / 20 / 10 s; default 30). The **50/50** lifeline
costs 2 tickets. After answering, the card shows right/wrong, the explanation and the source name.

## 5. Hot Springs content map

| Where | Content | Source |
|---|---|---|
| Districts, stamps, labels, special-space flavor | see `research/town-content.md` §1–4 | corpus |
| District questions | the 8 bank categories mapped to districts | `data/questions.json` |
| Era Express, Time Warp, Postcards | era ids and summaries; confirmed timeline events | `research/timeline.json` |
| Mountain spur | NPS trail names and grades; 216-ft tower | `geography-lakes-mountains.md`, `other-attractions.md` |
| Map art | Bathhouse Row skyline order, tower recipe, icons, palettes | `visual-style-guide.md`, `shared/design` |

## 6. Screens and UX flow

```
Title ─┬─ Trail Game → Setup → Board ⇄ (Question / Wager / Time Warp / Vent / Postcard / Passport) → Win
       ├─ Quick 10 → Question ×10 → Results
       ├─ Era Express → Era select → Question ×10 → Results
       ├─ Daily Challenge → Question ×7 → Daily results (share text, streak)
       ├─ How to Play
       └─ Settings
```
- **Title:** illustrated map backdrop with steam, game title, mode buttons, Continue (if saved game).
- **Board:** map canvas; side panel (bottom on mobile) with the turn banner, player list (token,
  name, stamps x/target, tickets), action buttons (Roll, Re-roll, Trolley, Passport, destinations),
  and a short log.
- **Question card:** a linen postcard: category icon + name, difficulty pips, era tag, confidence
  badge, question, four answer buttons (1–4), timer bar, 50/50. Feedback: correct/incorrect state on
  buttons, explanation, "Source: …", Continue.
- **Passport:** eight stamp slots (drawn landmark stamps), tickets, accuracy per category.
- **Win:** tower panorama, winner's token, standings, stats, Play again / Title.
- **Pass screen** (hot-seat, ≥2 humans, setting on): "Pass to <name>" so others don't see the card early.

## 7. Art direction

- Board in the `gilded-spa` palette over `ouachita-forest` hills, `thermal-water` lakes and steam,
  `nps-rustic` trail spur; route of running-bond Promenade brick (Motif 11); Bathhouse Row skyline
  south→north (Lamar … Superior) with the Quapaw chevron dome; the Arlington's two towers at the Y; the
  lattice Mountain Tower; tufa terraces at the vents.
- Question cards in `linen-postcard` (cream, navy text, stamp square, cancel lines).
- Stamps: round/rect passport stamps with the landmark silhouette, district name and a cancel ring.
- Era Express tints the card with the era palette (`ERA_PALETTE`).
- Light theme (default gilded) and dark theme (deco-neon based), auto by `prefers-color-scheme` and a
  manual toggle.
- No logos, no likenesses. Category icons: steam spring, Quapaw dome, bass, baseball, fedora, smoker,
  film reel, merman.

## 8. Audio direction

All WebAudio synthesis: soft gauge clicks while rolling, wooden hop per space, a bright 3-note chime
for correct, a soft low two-tone for wrong (never harsh), a stamp "thunk" with paper rustle, steam
whoosh (filtered noise sweep), coin ching for tickets, a trolley bell, a short fanfare for the summit
win. Master volume and mute in Settings; `M` toggles mute. Audio starts only after a user gesture.

## 9. Accessibility

- Every action reachable by keyboard; visible focus rings; logical tab order; focus trapped in modals.
- Text contrast ≥ 4.5:1 (shared tokens); question text ≥ 18 px on desktop, ≥ 17 px on mobile.
- Category identity never by color alone: icon + name label + space pattern.
- Player tokens differ by shape (circle, square, triangle, diamond, star, hexagon) as well as color.
- Timers adjustable, including Off. Timeout is announced.
- `prefers-reduced-motion` honored, plus a Motion setting (Full / Reduced).
- Text size setting: 100 / 115 / 130%.
- ARIA live region announces rolls, moves, results and stamps.

## 10. Mobile and touch

Portrait 390×844 without horizontal scroll; board on top (follow camera), panel below; all touch
targets ≥ 44 px; answer buttons full-width; landscape and desktop use a side panel.

## 11. Performance budgets

60 fps on a mid-range laptop (board idle and while tokens move); `index.html` ≤ 2 MB (questions
included); interactive ≤ 2 s; zero network requests; zero console errors.

## 12. Save / load

Settings, best scores, daily streak and an in-progress Trail Game autosave in `localStorage`
(try/catch; the game works without storage).

## 13. Acceptance criteria

**Content and audit**
- AC1 The bank is the audited `data/questions.json`; every change and drop is logged in `research/question-audit.md`.
- AC2 Every answer shows an explanation and the source name.
- AC3 `claim` questions show a "Local claim" badge; `summary` questions show a "Lightly verified" badge.
- AC4 No question repeats within a session until its pool is exhausted.
- AC5 Difficulty adapts to each player's results (skill rises after correct answers, falls after wrong).

**Trail Game**
- AC6 Setup supports 1–6 seats, each Human or AI Easy/Medium/Hard, and a stamp target of 4/6/8.
- AC7 Rolling 1–6 highlights exactly the spaces reachable with that many steps (no revisits; Short Cut costs 2; Tower absorbs).
- AC8 A destination can be chosen by click/tap, by its panel button, or by arrows + Enter; the token animates along the path.
- AC9 District spaces ask a question of the district's category; correct answers pay tickets by difficulty.
- AC10 Landmarks award the district stamp on a correct answer; the passport shows it.
- AC11 Steam vents offer a ride to the paired vent.
- AC12 Post Time takes a 0–5 wager and settles it on the answer.
- AC13 Time Warp asks to order three dated events; success lets the player warp to a missing landmark and answer.
- AC14 Postcards show a timeline event and pay 1 ticket.
- AC15 Grand Jury: a wrong Legends answer makes the player skip the next turn.
- AC16 Trolley: at a stop, pay 2 tickets to ride to another stop instead of rolling.
- AC17 The trail opens only at the stamp target; the Summit question wins or sends the player back to the trailhead.
- AC18 50/50 lifeline (2 tickets) removes two wrong answers; re-roll costs 1 ticket once per turn.
- AC19 AI seats play complete turns on their own at three distinguishable skill levels.
- AC20 Pass-device screen appears between human turns when 2+ humans play (setting).
- AC21 A win screen shows the winner, standings and stats.
- AC22 The game autosaves each turn and can be continued from the title screen.

**Other modes**
- AC23 Quick 10: ten adaptive questions, score with difficulty, streak and time bonuses; best score saved.
- AC24 Era Express: era picker using `timeline.json` era ids and summaries; ten questions from that era.
- AC25 Daily Challenge: seven questions determined by the date, identical across replays that day; result, streak and share text.

**Presentation**
- AC26 Code-drawn illustrated map (terrain, lakes, Row skyline, Arlington, tower, route bricks, icons).
- AC27 Tokens animate; steam wisps rise from vents; stamps and wins have effects.
- AC28 Synthesized sound for roll, hop, correct, wrong, stamp, steam, tickets, trolley, win; mute and volume.
- AC29 Title, How to Play and Settings screens.

**Accessibility, mobile, quality**
- AC30 Full keyboard play from title to win, with visible focus.
- AC31 Colorblind-safe: icons + labels for categories, shapes for tokens.
- AC32 Timer setting Off/30/20/10 s; timeout counts as wrong and is announced.
- AC33 Reduced motion honored (media query and setting).
- AC34 Text size setting; text contrast ≥ 4.5:1; light and dark themes.
- AC35 Mobile 390×844: no horizontal overflow, controls on screen, touch targets ≥ 44 px.
- AC36 Single self-contained HTML ≤ 2 MB; zero network requests; zero console errors.
- AC37 ≥ 55 fps average on the board in the test harness (desktop); interactive ≤ 2 s.
- AC38 Works with `localStorage` unavailable.

## 14. Out of scope

Online multiplayer; user accounts or leaderboards; real images, photos or web fonts; voice-over;
custom question editor; translations; map-pin rounds and "Number Hunt" closest-guess cards (good
future modes, see game-hooks ideas 7–8); festival/calendar-month spaces; seasonal fog weather.
