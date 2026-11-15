// Council wave 3, batch E: sound (CL-01, S2-07, S3-24, S4-23, S5-06, S5-13, S5-16, S5-17, S3-19).
import { H1, H2, soloGame, landOn, waitFor, phase } from './helpers.mjs';

const render = (t, ...a) => t.page.evaluate((x) => window.__game.audioRender(...x), a);
const audio = (t) => t.page.evaluate(() => window.__game.audioState());
const unlock = async (t) => { await t.page.mouse.click(5, 5); await waitFor(t, (s) => s.audio.state === 'running', 3000, 'audio running'); };

// The pitch of a cue in a window (seconds), from a WAV render: zero crossings in the left channel.
const hz = (b64, from, to) => {
  const b = Buffer.from(b64, 'base64'), rate = b.readUInt32LE(24), at = (i) => b.readInt16LE(44 + i * 4);
  const a = Math.floor(from * rate), z = Math.floor(to * rate); let n = 0;
  for (let i = a + 1; i < z; i++) if ((at(i - 1) < 0) !== (at(i) < 0)) n++;
  return n / 2 / (to - from);
};
const wav = (t, name, seconds, o) => render(t, name, seconds, true, 0.7, o);

export const tests = [
  // ---------------- CL-01 ----------------
  {
    name: 'CL-01 the busiest moment stays under 0.95 with the volume at its maximum',
    viewports: ['desktop'],
    async run(t) {
      // The render hook takes the Volume slider as its fourth argument; the other controls are on/off.
      const soft = [], loud = [];
      for (let i = 0; i < 5; i++) { soft.push((await render(t, 'cue:hop', 1.5, false)).peak); loud.push((await render(t, 'cue:hop', 1.5, false, 1)).peak); }
      const mid = (a) => a.slice().sort((x, y) => x - y)[2];
      t.expect(mid(loud) > mid(soft) * 1.25, `the volume argument is used (a hop peaks at ${mid(soft)} at the shipped volume, ${mid(loud)} at full)`);
      for (let i = 0; i < 5; i++) { const r = await render(t, 'busy', 9, false, 1); t.expect(r.peak < 0.95, `busy moment at full volume peaks at ${r.peak}`); }
      // and the win: the board piece, the Row bed and the win cue
      for (let i = 0; i < 3; i++) { const r = await render(t, 'mix', 9, false, 1); t.expect(r.peak < 0.95, `win moment at full volume peaks at ${r.peak}`); }
    },
  },
  {
    name: 'CL-01 the loudest cues stay under 0.95 at full volume over 20 repeats each',
    viewports: ['desktop'],
    async run(t) {
      for (const n of ['win', 'stamp', 'bell', 'correct', 'gauge']) {
        let worst = 0;
        for (let i = 0; i < 20; i++) worst = Math.max(worst, (await render(t, 'cue:' + n, 2.5, false, 1)).peak);
        t.log(`${n}: loudest of 20 at full volume ${worst}`);
        t.expect(worst < 0.95, `${n} at full volume peaks at ${worst}`);
      }
    },
  },
  // ---------------- S5-13 ----------------
  {
    name: 'S5-13 turning sound off silences a cue already sounding, and the volume glides',
    viewports: ['desktop'],
    async run(t) {
      await unlock(t);
      const gains = async () => (await audio(t)).gains;
      let g = await waitFor2(t, async () => (await gains()).master > 0.3, 'master at the default volume');
      t.expect(Math.abs(g.master - 0.35) < 0.01 && Math.abs(g.sfx - 2.2) < 0.01, 'default master 0.35 and cue bus 2.2: ' + JSON.stringify(g));
      // a volume change does not jump: read straight after the change, in the same task
      const jump = await t.page.evaluate(() => { window.__game.setState({ settings: { volume: 0.2 } }); return window.__game.audioState().gains.master; });
      t.expect(jump > 0.3, 'the master gain has not jumped to its new value (' + jump + ')');
      g = await waitFor2(t, async () => Math.abs((await gains()).master - 0.1) < 0.005, 'master glides to 0.1');
      // Sound off: master and the cue bus go to nothing; the sting that was playing is silenced with them
      await t.game('setState', { settings: { sound: false } });
      g = await waitFor2(t, async () => { const x = await gains(); return x.master < 0.001 && x.sfx < 0.001; }, 'master and cue bus silent');
      await t.game('setState', { settings: { sound: true } });
      g = await waitFor2(t, async () => { const x = await gains(); return x.master > 0.09 && x.sfx > 2; }, 'back on');
      // Sound effects off silences the cue bus only: the music's own switch is separate
      await t.game('setState', { settings: { effects: false } });
      g = await waitFor2(t, async () => (await gains()).sfx < 0.001, 'cue bus silent with Sound effects off');
      t.expect(g.master > 0.09, 'the master stays up for the music: ' + JSON.stringify(g));
    },
  },
  // ---------------- S5-06 ----------------
  {
    name: 'S5-06 the steam gauge counts the roll: a 6 lands higher and later than a 1',
    viewports: ['desktop'],
    async run(t) {
      // n + 2 ticks, then a settle note at 440 * 2^((n-1)/6) Hz; judged just after the ticks and their echoes have died
      const settle = async (n) => { const r = await wav(t, 'cue:gauge', 2, { n }); const end = (n + 2) * 0.08; return { f: hz(r.wav, end + 0.14, end + 0.3), secs: r.secs }; };
      const one = await settle(1), six = await settle(6);
      t.log(`settle note: roll 1 ${one.f.toFixed(0)} Hz, roll 6 ${six.f.toFixed(0)} Hz`);
      t.expect(one.f > 330 && one.f < 560, 'a 1 settles near 440 Hz: ' + one.f);
      t.expect(six.f > 640 && six.f < 940, 'a 6 settles near 784 Hz: ' + six.f);
      t.expect(six.f / one.f > 1.4, 'a 6 is clearly higher than a 1');
      // the game says which roll it is: the cue log carries n
      await unlock(t); await soloGame(t);
      for (const n of [1, 6]) {
        await t.game('act', 'roll', n); await phase(t, 'choose');
        const log = (await t.state()).audio.log.filter((x) => x.name === 'gauge');
        t.equal(log[log.length - 1].n, n, 'the gauge cue for a roll of ' + n + ' carries it');
        await t.game('setState', { trail: { phase: 'roll' } });
      }
    },
  },
  // ---------------- S5-16 ----------------
  {
    name: 'S5-16 running out of time has its own cue, and the tick is audible and climbs each second',
    viewports: ['desktop'],
    async run(t) {
      await unlock(t);
      await soloGame(t, { settings: { timer: 10 } });
      const s0 = await t.state();
      await landOn(t, s0.board.types.indexOf('cat'));
      await phase(t, 'question');
      await t.game('setState', { question: { timeLeft: 5.3 } });
      const ticks = () => t.state().then((s) => s.audio.log.filter((x) => x.name === 'tick').map((x) => x.sec));
      for (let end = Date.now() + 9000; Date.now() < end && (await ticks()).length < 5; ) await t.page.waitForTimeout(80);
      const secs = await ticks();
      t.equal(JSON.stringify(secs.slice(0, 5)), JSON.stringify([5, 4, 3, 2, 1]), 'a tick each second from 5 down to 1');
      await phase(t, 'feedback');
      const names = (await t.state()).audio.log.map((x) => x.name);
      t.expect(names.includes('timeout') && !names.slice(names.indexOf('timeout')).includes('wrong'), 'time up plays the timeout cue, not the wrong-answer cue: ' + names.join());
      // a wrong answer still has its own sound
    },
  },
  {
    name: 'S5-16 a wrong answer still plays the wrong cue; the tick climbs and is no longer inaudible',
    viewports: ['desktop'],
    async run(t) {
      await unlock(t); await soloGame(t);
      const s0 = await t.state();
      await landOn(t, s0.board.types.indexOf('cat'));
      await phase(t, 'question');
      await t.game('act', 'answer', 'wrong');
      const names = (await t.state()).audio.log.map((x) => x.name);
      t.expect(names.includes('wrong') && !names.includes('timeout'), 'wrong answer: ' + names.join());
      const f5 = hz((await wav(t, 'cue:tick', 0.3, { sec: 5 })).wav, 0.02, 0.05), f1 = hz((await wav(t, 'cue:tick', 0.3, { sec: 1 })).wav, 0.02, 0.05);
      t.log(`tick pitch: 5 s left ${f5.toFixed(0)} Hz, 1 s left ${f1.toFixed(0)} Hz`);
      t.expect(f1 / f5 > 1.3, 'the tick is higher with 1 second left than with 5');
      const peaks = []; for (let i = 0; i < 5; i++) peaks.push((await render(t, 'cue:tick', 1, false, 0.7, { sec: 3 })).peak);
      peaks.sort((a, b) => a - b);
      t.expect(peaks[2] >= 0.07, 'the tick is audible: median peak ' + peaks[2] + ' (it was 0.02)');
      const to = []; for (let i = 0; i < 5; i++) to.push((await render(t, 'cue:timeout', 2.5, false)).peak);
      to.sort((a, b) => a - b);
      t.expect(to[2] >= 0.2 / 1.19 && to[2] <= 0.45 * 1.19, 'the timeout cue sits with the other cues: median peak ' + to[2]);
    },
  },
  // ---------------- S5-17 ----------------
  {
    name: 'S5-17 a cue struck again within a few milliseconds does not pile on itself',
    viewports: ['desktop'],
    async run(t) {
      await unlock(t);
      const played = async () => (await t.state()).audio.played;
      const base = await played();
      // one task: the audio clock cannot move between the calls
      await t.page.evaluate(() => { for (let i = 0; i < 4; i++) window.__game.cue('steam'); });
      t.equal(await played() - base, 1, 'four steam cues in one moment sound once');
      await t.page.evaluate(() => { for (let i = 0; i < 3; i++) window.__game.cue('hop', { i }); window.__game.cue('click'); });
      t.equal(await played() - base, 3, 'a different cue is not held back by the first (steam, hop, click = 3)');
      await t.page.waitForTimeout(250);
      await t.page.evaluate(() => window.__game.cue('steam'));
      t.equal(await played() - base, 4, 'the same cue sounds again after a short gap');
    },
  },
  // ---------------- S3-24 ----------------
  {
    name: 'S3-24 a right answer rings higher for a harder question, and a run of 3 or 5 adds a chime',
    viewports: ['desktop'],
    async run(t) {
      const w = async (tier) => hz((await wav(t, 'cue:correct', 0.3, { streak: 1, tier })).wav, 0.035, 0.085);
      const [e, m, h] = [await w(0), await w(1), await w(2)];
      t.log(`right-answer pitch (zero crossings): easy ${e.toFixed(0)}, medium ${m.toFixed(0)}, hard ${h.toFixed(0)}`);
      t.expect(h / e > 1.15 && h / e < 1.4, 'hard rings about four semitones above easy: ' + (h / e).toFixed(2));
      t.expect(m > e && h > m, 'easy < medium < hard');
      await unlock(t); await soloGame(t);
      const s0 = await t.state();
      await landOn(t, s0.board.types.indexOf('cat'));
      await phase(t, 'question');
      await t.game('setState', { trail: { players: [{ streak: 2 }] } });
      const q = (await t.state()).question;
      await t.game('act', 'answer', 'correct');
      const log = (await t.state()).audio.log;
      const c = log.filter((x) => x.name === 'correct').pop();
      t.equal(c.tier, ['easy', 'medium', 'hard'].indexOf(q.difficulty), 'the cue is told the difficulty of the question');
      const ch = log.filter((x) => x.name === 'streak').pop();
      t.expect(ch && ch.n === 3, 'the third right answer in a row adds the chime: ' + JSON.stringify(ch));
    },
  },
  {
    name: 'S3-24 tickets earned play a coin after the answer; a miss plays none and a first right answer has no chime',
    viewports: ['desktop'],
    async run(t) {
      await unlock(t); await soloGame(t);
      const s0 = await t.state();
      await landOn(t, s0.board.types.indexOf('cat'));
      await phase(t, 'question');
      const before = (await t.state()).trail.players[0].tickets;
      await t.game('act', 'answer', 'correct');
      const s = await t.state(), names = s.audio.log.map((x) => x.name);
      t.expect(s.trail.players[0].tickets > before, 'the answer paid tickets');
      const coin = s.audio.log.filter((x) => x.name === 'coin').pop();
      t.expect(coin && coin.at > 0.2 && coin.k >= 1, 'a coin follows the answer cue: ' + JSON.stringify(coin));
      t.expect(!names.includes('streak'), 'no chime for a first right answer');
      await t.game('act', 'continue'); await phase(t, 'roll');
      const n0 = (await t.state()).audio.log.filter((x) => x.name === 'coin').length;
      await landOn(t, s0.board.types.indexOf('cat', s0.board.types.indexOf('cat') + 1));
      await phase(t, 'question');
      await t.game('act', 'answer', 'wrong');
      t.equal((await t.state()).audio.log.filter((x) => x.name === 'coin').length, n0, 'a wrong answer pays nothing and plays no coin');
    },
  },
  {
    name: 'S3-24 the turn passing to another traveler ticks softly',
    viewports: ['desktop'],
    async run(t) {
      await unlock(t);
      await soloGame(t, { players: [H1, H2] });
      const s0 = await t.state();
      await landOn(t, s0.board.types.indexOf('cat'));
      await phase(t, 'question');
      await t.game('act', 'answer', 'wrong');
      await t.game('act', 'continue');
      const s = await waitFor(t, (x) => x.trail.turn === 1, 4000, 'the next turn');
      const tk = s.audio.log.filter((x) => x.name === 'turn').pop();
      t.expect(tk && tk.me === true, 'the turn of a person starts with a tick: ' + JSON.stringify(tk));
    },
  },
];
async function waitFor2(t, pred, label, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await pred()) return (await audio(t)).gains; await t.page.waitForTimeout(60); }
  t.fail('timed out waiting for ' + label); return (await audio(t)).gains;
}
