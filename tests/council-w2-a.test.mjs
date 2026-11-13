// Council wave 2, batch A: music, ambience and cue variation (S5-01, S5-02, S5-03).
import fs from 'node:fs';
import path from 'node:path';
import { soloGame, landOn, waitFor, phase } from './helpers.mjs';

const WAV_DIR = process.env.HS_WAV_DIR || '';
const SHOTS = path.resolve('..', '_council', 'hsg-trivia', 'wave-2', 'shots');
const BPM = { board: 92, question: 100, summit: 120, title: 78 };
const MUSIC = Object.keys(BPM);
const SCENES = ['valley', 'row', 'bridge', 'central', 'oaklawn', 'lakes', 'ballfields', 'hollow', 'park', 'mountain'];
// The cues a player hears in play and has to notice sit between 0.2 and 0.45 at the shipped volume (click and tick are quiet UI sounds).
const LOUD_CUES = ['hop', 'correct', 'wrong', 'stamp', 'steam', 'coin', 'bell', 'trolley', 'bugle', 'warp', 'gavel', 'win', 'page', 'gauge'];

const render = (t, name, seconds, wav = false) => t.page.evaluate(([n, s, w]) => window.__game.audioRender(n, s, w), [name, seconds, wav]);
const keep = (name, r) => { if (WAV_DIR && r.wav) { fs.mkdirSync(WAV_DIR, { recursive: true }); fs.writeFileSync(path.join(WAV_DIR, name.replace(/:/g, '-') + '.wav'), Buffer.from(r.wav, 'base64')); } };
const audio = (t) => t.page.evaluate(() => window.__game.audioState());
const unlock = async (t) => { await t.page.mouse.click(5, 5); await waitFor(t, (s) => s.audio.state === 'running', 3000, 'audio running'); };
const hide = (page, hidden) => page.evaluate((h) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);
async function until(t, pred, label) {
  const end = Date.now() + 6000;
  let a = await audio(t);
  while (Date.now() < end && !pred(a)) { await t.page.waitForTimeout(80); a = await audio(t); }
  t.expect(pred(a), 'timed out waiting for ' + label + ' ' + JSON.stringify(a));
  return a;
}

export const tests = [
  {
    name: 'S5-01 the hook lists four pieces of music and ten ambience scenes',
    viewports: ['desktop'],
    async run(t) {
      const l = await t.page.evaluate(() => window.__game.audioList());
      t.equal(JSON.stringify(l.music), JSON.stringify(MUSIC), 'music pieces');
      t.equal(JSON.stringify(l.ambience), JSON.stringify(SCENES), 'ambience scenes');
    },
  },
  ...MUSIC.map((name) => ({
    name: `S5-01 music "${name}" renders 60 s inside the mix limits, with form and variation`,
    viewports: ['desktop'],
    async run(t) {
      const r = await render(t, name, 60, !!WAV_DIR); keep('music-' + name, r);
      t.log(`${name}: peak ${r.peak} (${r.peakDb} dB), rms ${r.rmsDb} dBFS, longest silence ${r.longestSilence} s, stereo ${r.stereo}, built ${JSON.stringify(r.built)}`);
      t.expect(r.peak >= 0.06 && r.peak <= 0.16, `peak ${r.peak} within 0.06..0.16`);
      t.expect(r.rmsDb >= -40 && r.rmsDb <= -28, `rms ${r.rmsDb} dBFS within -40..-28`);
      t.expect(r.longestSilence <= 2, `longest silence ${r.longestSilence} s`);
      const formSeconds = r.built.formBars * 4 * 60 / BPM[name];
      t.expect(formSeconds >= 45, `form lasts ${formSeconds.toFixed(1)} s before it repeats`);
      t.expect(r.built.distinctBars >= 6, `distinct bars ${r.built.distinctBars}`);
      t.expect(r.built.pitches >= 6, `pitches ${r.built.pitches}`);
    },
  })),
  ...SCENES.map((name) => ({
    name: `S5-02 ambience "${name}" renders 30 s inside its limits with no silent stretch`,
    viewports: ['desktop'],
    async run(t) {
      const r = await render(t, name, 30, !!WAV_DIR); keep('ambience-' + name, r);
      t.log(`${name}: peak ${r.peak}, rms ${r.rmsDb} dBFS, longest silence ${r.longestSilence} s`);
      t.expect(r.peak < 0.07, `peak ${r.peak} under 0.07`);
      t.expect(r.rmsDb >= -52 && r.rmsDb <= -38, `rms ${r.rmsDb} dBFS within -52..-38`);
      t.expect(r.longestSilence <= 2, `longest silence ${r.longestSilence} s`);
    },
  })),
  {
    name: 'S5-03 every gameplay cue peaks between 0.2 and 0.45 at the shipped volume',
    viewports: ['desktop'],
    async run(t) {
      for (const n of LOUD_CUES) {
        const r = await render(t, 'cue:' + n, 3, !!WAV_DIR); keep('cue-' + n, r);
        t.log(`${n}: peak ${r.peak}`);
        t.expect(r.peak >= 0.2 && r.peak <= 0.45, `${n} peak ${r.peak} within 0.2..0.45`);
      }
    },
  },
  {
    name: 'S5-03 music, ambience and the loudest cue together stay under 0.95',
    viewports: ['desktop'],
    async run(t) {
      const r = await render(t, 'mix', 12, !!WAV_DIR); keep('mix-board-row-win', r);
      t.log(`mix: peak ${r.peak}, rms ${r.rmsDb} dBFS`);
      t.expect(r.peak < 0.95, `mix peak ${r.peak}`);
    },
  },
  {
    name: 'S5-03 no two repeats of a cue are the same, and a render does not touch the live audio',
    viewports: ['desktop'],
    async run(t) {
      const before = await audio(t);
      for (const n of ['hop', 'correct', 'wrong', 'coin', 'tick']) {
        const a = await render(t, 'cue:' + n, 1), b = await render(t, 'cue:' + n, 1);
        t.expect(JSON.stringify(a.secs) !== JSON.stringify(b.secs) || a.peak !== b.peak || a.stereo !== b.stereo, `two ${n} cues differ`);
      }
      t.equal(JSON.stringify(await audio(t)), JSON.stringify(before), 'audio state untouched by renders');
      t.equal((await t.state()).audio.state, 'none', 'rendering did not create the live context');
    },
  },
  {
    name: 'S5-01 nothing is made before the first gesture; after it the board piece plays',
    viewports: ['desktop'],
    async run(t) {
      let a = await audio(t);
      t.equal((await t.state()).audio.state, 'none', 'no context at boot');
      t.equal(a.music, null, 'no music before a gesture');
      await soloGame(t);
      t.equal((await t.state()).audio.state, 'none', 'still no context after starting a game by hook');
      await unlock(t);
      a = await until(t, (x) => x.music === 'board', 'board music');
      t.equal(a.ambience, 'valley', 'the start space sounds like the valley');
    },
  },
  {
    name: 'S5-01 the piece follows the game: menus, board, question, climb',
    async run(t) {
      await t.game('scene', 'title'); await unlock(t);
      await until(t, (x) => x.music === 'title' && x.ambience === 'valley', 'title piece');
      await soloGame(t);
      await until(t, (x) => x.music === 'board', 'board piece');
      const s0 = await t.state();
      await landOn(t, s0.board.types.indexOf('cat'));
      await phase(t, 'question');
      let a = await until(t, (x) => x.music === 'question', 'question piece');
      t.equal(a.want.tension, 0, 'no tension with time to spare');
      await t.game('setState', { question: { timeMax: 10, timeLeft: 4 } });
      a = await until(t, (x) => x.want.tension === 1, 'tension in the last seconds');
      await t.game('act', 'answer', 'correct');
      await t.game('act', 'continue');
      await phase(t, 'roll');
      const b = await t.state();
      await t.game('setState', { trail: { players: [{ node: b.board.tower - 4 }] } });
      a = await until(t, (x) => x.music === 'summit' && x.ambience === 'mountain', 'summit piece on the spur');
      const w1 = a.want.wind;
      await t.game('setState', { trail: { players: [{ node: b.board.tower - 1 }] } });
      a = await until(t, (x) => x.want.wind > w1, 'wind grows toward the Tower');
      await t.game('setState', { trail: { players: [{ node: b.board.types.indexOf('landmark') }] } });
      a = await until(t, (x) => x.ambience !== 'mountain', 'leaves the mountain');
      t.expect(SCENES.includes(a.ambience), `district scene ${a.ambience}`);
    },
  },
  {
    name: 'S5-01 Music, Ambience and Sound effects settings silence their layer and persist across a reload',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t); await unlock(t);
      await until(t, (x) => x.music === 'board' && x.ambience, 'both layers');
      await t.game('setState', { settings: { music: false } });
      let a = await audio(t);
      t.equal(a.music, null, 'music stopped'); t.equal(a.levels.music, 0, 'music bus at 0'); t.expect(a.ambience !== null, 'ambience still plays');
      await t.game('setState', { settings: { music: true, ambience: false } });
      a = await audio(t);
      t.equal(a.ambience, null, 'ambience stopped'); t.equal(a.levels.ambience, 0, 'ambience bus at 0'); t.expect(a.music === 'board', 'music back');
      await t.game('setState', { settings: { effects: false } });
      const played = (await t.state()).audio.played;
      await t.game('act', 'roll', 2);
      t.equal((await t.state()).audio.played, played, 'cues are silent with Sound effects off');
      a = await audio(t); t.expect(a.music === 'board', 'music unaffected by Sound effects');
      await t.reload();
      const s = await t.state();
      t.equal(s.settings.music, true, 'music saved'); t.equal(s.settings.ambience, false, 'ambience saved off'); t.equal(s.settings.effects, false, 'effects saved off');
      await t.game('scene', 'settings');
      t.equal(await t.page.getAttribute('[data-key="set-ambience-false"]', 'aria-checked'), 'true', 'the control shows Ambience off after reload');
    },
  },
  {
    name: 'S5-01 the master Sound switch silences music and ambience; an old save with sound off stays silent',
    viewports: ['desktop'],
    initScript: () => { if (!localStorage.getItem('hs-trivia-v1')) localStorage.setItem('hs-trivia-v1', JSON.stringify({ v: 1, settings: { sound: false, volume: 0.5 }, best: { quick: 0, era: {} }, daily: { last: null, streak: 0, results: {} }, trail: null })); },
    async run(t) {
      const s = await t.state();
      t.equal(s.settings.sound, false, 'pre-wave save: sound off');
      t.equal(s.settings.music, true, 'music defaults on for an old save'); t.equal(s.settings.ambience, true, 'ambience defaults on');
      await t.page.mouse.click(5, 5); await t.page.keyboard.press('Shift');
      let a = await audio(t);
      t.equal(a.music, null, 'no music with Sound off'); t.equal(a.ambience, null, 'no ambience with Sound off');
      t.equal(a.levels.music, 0, 'music bus 0');
      await t.game('setState', { settings: { sound: true } });
      await t.page.mouse.click(5, 5);
      a = await until(t, (x) => x.music === 'title', 'music with Sound on');
      await t.game('setState', { settings: { sound: false } });
      a = await audio(t); t.equal(a.music, null, 'silent again');
    },
  },
  {
    name: 'S5-01 the pause card and a hidden tab hold the music, and nothing is scheduled meanwhile',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t); await unlock(t);
      await until(t, (x) => x.music === 'board' && x.bars > 2, 'board piece playing');
      await t.page.keyboard.press('Escape');
      let a = await until(t, (x) => x.held, 'held on the pause card');
      const bars = a.bars; await t.page.waitForTimeout(1500);
      a = await audio(t); t.equal(a.bars, bars, 'no bar scheduled while the pause card is up');
      await t.page.keyboard.press('Escape');
      a = await until(t, (x) => !x.held && x.bars > bars, 'music resumes after the pause card');
      await hide(t.page, true);
      await waitFor(t, (s) => s.audio.state === 'suspended', 2000, 'suspended while hidden');
      a = await audio(t); t.expect(a.held, 'held while hidden');
      const b2 = a.bars; await t.page.waitForTimeout(800);
      t.equal((await audio(t)).bars, b2, 'no bar scheduled in a hidden tab');
      await hide(t.page, false);
      await waitFor(t, (s) => s.audio.state === 'running', 2000, 'running again');
      a = await until(t, (x) => !x.held && x.bars > b2, 'music back after the tab returns');
      const b3 = a.bars; await t.page.waitForTimeout(1200);
      const gained = (await audio(t)).bars - b3;
      t.expect(gained <= 2, `no pile of bars on return (${gained} in 1.2 s)`);
    },
  },
  {
    name: 'S5-03 a hop walks up the scale from where the token is, and a run of right answers climbs',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t); await unlock(t);
      const s0 = await t.state();
      await t.game('setState', { trail: { players: [{ node: s0.board.start }] } });
      await t.game('act', 'roll', 4);
      await t.game('act', 'choose');
      await waitFor(t, (s) => s.audio.log.filter((c) => c.name === 'hop').length >= 4, 6000, 'four hops');
      const hops = (await t.state()).audio.log.filter((c) => c.name === 'hop');
      t.equal(JSON.stringify(hops.slice(0, 4).map((h) => h.i)), '[0,1,2,3]', 'step index walks 0..3');
      t.expect(hops.every((h) => h.pan >= -0.6 && h.pan <= 0.6), 'pan stays inside +/-0.6');
      await t.game('act', 'finishAnim');
      await phase(t, 'question');
      await t.game('act', 'answer', 'correct'); await t.game('act', 'continue'); await phase(t, 'roll');
      const firstCat = s0.board.types.indexOf('cat');
      const askFrom = async (ans) => {
        await t.game('setState', { trail: { players: [{ node: s0.board.start }] } });
        await t.game('act', 'roll', firstCat - s0.board.start);
        await t.game('act', 'choose', firstCat); await t.game('act', 'finishAnim');
        await phase(t, 'question');
        await t.game('act', 'answer', ans);
        await t.game('act', 'continue'); await phase(t, 'roll');
      };
      await askFrom('correct'); await askFrom('correct');
      let streaks = (await t.state()).audio.log.filter((c) => c.name === 'correct').map((c) => c.streak);
      t.equal(JSON.stringify(streaks.slice(-3)), '[1,2,3]', 'three right in a row climb: ' + JSON.stringify(streaks));
      await askFrom('wrong'); await askFrom('correct');
      streaks = (await t.state()).audio.log.filter((c) => c.name === 'correct').map((c) => c.streak);
      t.equal(streaks[streaks.length - 1], 1, 'a wrong answer resets the climb');
    },
  },
  {
    name: 'S5-01 Settings shows Sound effects, Music and Ambience controls',
    async run(t) {
      await t.game('scene', 'settings');
      await t.page.waitForTimeout(200);
      for (const k of ['effects', 'music', 'ambience']) t.expect(await t.page.locator(`[data-key="set-${k}-true"]`).isVisible(), `${k} control present`);
      const box = await t.page.locator('#scene-settings .settings-card').boundingBox();
      t.expect(box.x >= 0 && box.x + box.width <= t.vp.width + 1, 'settings card fits the width');
      await t.checkLayout({ allowScrollY: true });
      fs.mkdirSync(SHOTS, { recursive: true });
      await t.page.screenshot({ path: path.join(SHOTS, `S5-01-settings-${t.viewport}.png`), fullPage: true });
    },
  },
];
