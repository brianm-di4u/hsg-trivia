// Council wave 4b, clean-up batch A: the approved wrong answers, a softer steam cue, one departure announcement, a fixture that checks itself
// (K-01, K-02, K-03, K-04).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { H1, waitFor } from './helpers.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const FIXTURE = REPO + 'tests/fixtures/approved-wording.json';
const OWNER_FILE = fileURLToPath(new URL('../../_council/owner-review/approved-wording.json', import.meta.url));
const SHOTS = fileURLToPath(new URL('../../_council/hsg-trivia/wave-4b/shots/', import.meta.url));
const KEY = 'hs-trivia-v1';
const node = (name, run) => ({ name, node: true, run });
const render = (t, ...a) => t.page.evaluate((x) => window.__game.audioRender(...x), a);
const median = (a) => a.slice().sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)];
const BASE = { v: 1, settings: { sound: true, volume: 0.7, timer: 0, aiSpeed: 'normal', seenCoach: true }, best: { quick: 0, era: {} }, daily: { last: null, streak: 0, results: {} }, trail: null };
// The harness serializes initScript with toString, so a per-case script carries its data in its own source.
const withSave = (obj) => {
  const f = () => {};
  f.toString = () => `() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('hs-trivia-v1', JSON.stringify(${JSON.stringify(obj)})); } }`;
  return f;
};

export const tests = [
  // ---------------- K-01 ----------------
  node('K-01 the thirty number questions carry their three approved wrong answers, in order', () => {
    const A = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).trivia.corrections.change;
    const by = new Map(JSON.parse(fs.readFileSync(REPO + 'data/questions.json', 'utf8')).questions.map((q) => [q.id, q]));
    const ids = Object.keys(A).filter((id) => A[id].wrong);
    assert.equal(ids.length, 30);
    for (const id of ids) {
      const q = by.get(id), want = A[id];
      assert.ok(q, id + ' is in the bank');
      assert.deepEqual(q.wrong, want.wrong, id + ' wrong answers');
      assert.notDeepEqual(q.wrong, want.wrongWas, id + ' no longer has the old list');
      assert.equal(want.wrong.length, 3);
      assert.ok(!q.wrong.includes(q.answer), id + ' does not repeat the answer among the wrong ones');
      assert.equal(new Set(q.wrong).size, 3, id + ' three different wrong answers');
    }
    assert.equal(by.size, 608);
  }),
  // ---------------- K-02 ----------------
  {
    name: 'K-02 the Steam sound switch defaults to today\'s sound, is saved under its own key and kept after a reload',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      t.equal((await t.state()).settings.softSteam, false, 'off for a new profile');
      await t.game('scene', 'title');
      await t.page.locator('#scene-title [data-arg="settings"]').click();
      const classic = t.page.locator('[data-key="set-softSteam-false"]'), soft = t.page.locator('[data-key="set-softSteam-true"]');
      await soft.waitFor();
      t.equal(await classic.getAttribute('aria-checked'), 'true', 'Classic is the one selected');
      t.equal(await t.page.locator('[role="radiogroup"][aria-label="Steam sound"]').count(), 1, 'the group is named for a screen reader');
      await soft.scrollIntoViewIfNeeded();
      await soft.click();
      t.equal((await t.state()).settings.softSteam, true, 'the switch turns it on');
      t.equal(await soft.getAttribute('aria-checked'), 'true', 'and shows it');
      await t.page.waitForFunction((k) => { const s = JSON.parse(localStorage.getItem(k) || 'null'); return s && s.settings && s.settings.softSteam === true; }, KEY, { timeout: 4000 }).catch(() => t.fail('the switch was not saved'));
      await t.page.screenshot({ path: SHOTS + 'K-02-steam-switch-' + t.viewport + '.png' });
      await t.page.reload();
      await t.page.waitForFunction(() => window.__game && window.__game.getState().scene, null, { timeout: 8000 });
      t.equal((await t.state()).settings.softSteam, true, 'kept after a reload');
      await t.game('setState', { settings: { softSteam: false } });
      t.equal((await t.state()).settings.softSteam, false, 'and the player can go back');
    },
  },
  {
    name: 'K-02 a save with a value that is not true or false reads Classic',
    viewports: ['desktop'],
    initScript: withSave({ ...BASE, settings: { ...BASE.settings, softSteam: 'loud' } }),
    async run(t) {
      t.equal((await t.state()).settings.softSteam, false, 'falls back to Classic');
    },
  },
  {
    name: 'K-02 a save from before the switch reads Classic and keeps its other settings',
    viewports: ['desktop'],
    initScript: withSave({ ...BASE, settings: { ...BASE.settings, volume: 0.4, timer: 20 } }),
    async run(t) {
      const s = (await t.state()).settings;
      t.equal([s.softSteam, s.volume, s.timer], [false, 0.4, 20], 'Classic, and the rest as saved');
    },
  },
  {
    name: 'K-02 the switch picks which steam is played',
    viewports: ['desktop'],
    async run(t) {
      await t.page.mouse.click(5, 5);
      await waitFor(t, (s) => s.audio.state === 'running', 3000, 'audio running');
      await t.game('setState', { settings: { softSteam: false } });
      await t.page.evaluate(() => window.__game.cue('steam'));
      await t.page.waitForTimeout(150);
      await t.game('setState', { settings: { softSteam: true } });
      await t.page.evaluate(() => window.__game.cue('steam'));
      const log = (await t.state()).audio.log.filter((c) => c.name === 'steam');
      t.equal(log.length, 2, 'two steam cues were struck');
      t.expect(log.length === 2 && !log[0].soft && log[1].soft === true, 'the first was the classic one, the second the softer: ' + JSON.stringify(log));
    },
  },
  {
    name: 'K-02 the softer steam sits in the cue band and matches the classic level at the default volume and at full volume',
    viewports: ['desktop'],
    async run(t) {
      const peaks = async (soft, volume) => { const p = []; for (let i = 0; i < 25; i++) p.push((await render(t, 'cue:steam', 2, false, volume, soft ? { soft: true } : {})).peak); return p; };
      for (const [vol, label] of [[undefined, 'default'], [1, 'full']]) {
        const c = await peaks(false, vol), s = await peaks(true, vol);
        t.log(`${label} volume: classic median peak ${median(c)} (loudest ${Math.max(...c)}), softer median peak ${median(s)} (loudest ${Math.max(...s)})`);
        t.expect(Math.max(...s) < 0.95, label + ': the softer steam never nears clipping: ' + Math.max(...s));
        t.expect(Math.abs(median(s) - median(c)) <= 0.05, `${label}: the softer steam's median peak ${median(s)} is within 0.05 of the classic ${median(c)}`);
        if (vol === undefined) t.expect(median(s) >= 0.2 && median(s) <= 0.45, 'inside the cue band 0.2..0.45: ' + median(s));
      }
    },
  },
  // ---------------- K-03 ----------------
  {
    name: 'K-03 a screen reader hears the departure line once at the start of a trip, and the log still opens with the plain line',
    viewports: ['desktop'],
    async run(t) {
      await t.page.evaluate(() => { window.__said = []; const l = document.querySelector('#live'); new MutationObserver(() => { if (l.textContent) window.__said.push(l.textContent); }).observe(l, { childList: true, characterData: true, subtree: true }); });
      await t.game('newGame', { mode: 'trail', players: [H1], target: 6, seed: 7 });
      await t.page.waitForFunction(() => window.__said.some((m) => /new trip begins/i.test(m)), null, { timeout: 4000 }).catch(() => t.fail('the departure line was never announced'));
      await t.page.waitForTimeout(500);
      const said = await t.page.evaluate(() => window.__said.filter((m) => /new trip begins/i.test(m)));
      t.equal(said, ['A new trip begins. Collect 6 stamps, then climb to the Mountain Tower.'], 'one announcement of the trip start, the whole sentence');
      const s = await t.state();
      t.equal(s.trail.log[s.trail.log.length - 1], 'A new trip begins.', 'the log opens with the plain line');
    },
  },
  // ---------------- K-04 ----------------
  node('K-04 the in-repo copy of the approved wording equals the owner\'s file when it is there', (t) => {
    const mine = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).trivia;
    assert.deepEqual(Object.keys(mine).sort(), ['corrections', 'dated', 'grandJury', 'journalFacts'], 'the fixture holds the four keys');
    if (!fs.existsSync(OWNER_FILE)) { t.log('skipped: ' + OWNER_FILE + ' is not here (a clone of this game on its own), so the fixture was not compared'); return; }
    const owner = JSON.parse(fs.readFileSync(OWNER_FILE, 'utf8')).trivia;
    for (const k of Object.keys(mine)) assert.deepEqual(mine[k], owner[k], 'tests/fixtures/approved-wording.json: "' + k + '" differs from the owner\'s approved-wording.json; copy the owner\'s text into the fixture');
    t.log('compared the four keys with ' + OWNER_FILE + ': equal');
  }),
];
