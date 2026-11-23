# Valley of Vapors Trivia Trail

Trivia board game about the town. Part of **Hot Springs Games**, an open-source (MIT) collection of browser games set in
Hot Springs, Arkansas. The game ships as a self-contained `index.html`: art is drawn in code or painted into
`assets/`, sound is synthesized with WebAudio, and nothing loads from the network.

All games in the collection are original designs. Real places, schools and businesses appear as setting and
history only; no logos are reproduced and nothing implies endorsement. School rosters are fictional.

## Play

Open `index.html` in a browser, or serve the folder (`python -m http.server 8765`) and open http://127.0.0.1:8765/.

## Develop

```bash
npm run setup   # installs Playwright and Chromium for the test harness
npm run build   # rebuilds index.html from src/ (edit src/, not index.html)
npm test        # runs tests/*.test.mjs; screenshots land in screenshots/
```

Design docs: `PRD.md`, `MECHANICS.md`, `DEV-PLAN.md`, `REPORT.md`, `VISUAL-PLAN.md`, `VISUAL-REPORT.md`.

## Paths outside this repo

The game, its build and its tests use files inside this repo. The tools below can also use shared material from the Hot
Springs Games workspace (`reference/`, `research/`, or a sibling checkout in `repos/`). They find the workspace through the
`HSG_WORKSPACE` environment variable; when it is unset, the workspace is this repo's grandparent, which is right when the
repo sits at `<workspace>/repos/<repo>`. When the workspace copy is not there, each tool falls back to a path in this repo or
skips that step with a message.

- `tools/map/geo_common.py`: raw geodata from `reference/geo/` (`HSG_GEO_DIR` still overrides it), else `art-src/geo/raw/`.
- `tests/council-w4b-a.test.mjs` (K-04) compares `tests/fixtures/approved-wording.json` with the owner's `_council/owner-review/approved-wording.json` only when `HSG_WORKSPACE` is set; otherwise it logs that it skipped the comparison.
- Council-era tests write their extra captures to `screenshots/council/` (git-ignored).

## Vendored from the collection

This repo was split out of the original Hot Springs Games monorepo (kept offline), which holds the full research
corpus, `LESSONS.md` and the session brief. Copies kept here so the game builds and tests on its own:

- `shared/test-harness/`: the Playwright screenshot test runner (`run.mjs`, `art-pack.mjs`, `sheets.mjs`, `gallery.mjs`).
- `shared/tools/inline.mjs`: bundles `src/` into the single-file `index.html`.
- `research/`: `trivia-bank.json`, `timeline.json` come from the collection's shared research corpus.

Older docs in this repo refer to monorepo paths such as `games/trivia/` and `shared/...`; here the game
folder is the repo root.

## License

MIT (see `LICENSE`). Third-party code in `vendor/` keeps its own license.
