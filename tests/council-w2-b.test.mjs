// Council wave 2, batch B: ticket economy (S3-02) and AI turn pace (S1-03).
import { spawnSync } from 'node:child_process';
import { H1, soloGame, landOn, waitFor, phase } from './helpers.mjs';

const ALL = ['Sports', 'Entertainment', 'Nature & Lakes', 'People', 'History', 'Places & Landmarks', 'Food & Culture', 'Legends & Oddities'];
const text = (t, sel) => t.page.locator(sel).first().innerText();
const me = async (t) => (await t.state()).trail.players[0];
const ticketsOf = async (t) => (await me(t)).tickets;

// The harness serializes initScript with toString, so a per-case script carries its data in its own source.
const withSave = (obj) => {
  const f = () => {};
  f.toString = () => `() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('hs-trivia-v1', JSON.stringify(${JSON.stringify(obj)})); } }`;
  return f;
};
const stored = (t) => t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-trivia-v1') || 'null'));
const speed = async (t) => (await t.state()).settings.aiSpeed;
// A game that opens with an AI turn at the given speed, then the human; resolves when the human's roll comes back.
async function aiTurn(t, aiSpeed, { skip = false } = {}) {
  await t.seed(7);
  await t.game('setState', { settings: { passScreen: false, aiSpeed, timer: 0 } });
  const t0 = Date.now();
  await t.game('newGame', { mode: 'trail', players: [{ kind: 'ai', level: 'medium' }, H1], target: 6, seed: 7 });
  let presses = 0;
  while (Date.now() - t0 < 20000) {
    const s = await t.state();
    if (s.trail.turn === 1 && s.trail.phase === 'roll') break;
    if (skip) { await t.page.keyboard.press('x'); presses++; await t.page.waitForTimeout(60); } else await t.page.waitForTimeout(50);
  }
  return { ms: Date.now() - t0, presses };
}

export const tests = [
  // ---------------- S3-02 ----------------
  {
    name: 'S3-02 a re-roll costs 1, 2, 3, 4 tickets and then stays at 4, and the button says so before you pay',
    async run(t) {
      await soloGame(t);
      const costs = [];
      for (let i = 0; i < 6; i++) {
        await t.game('setState', { trail: { phase: 'roll', rerolled: false, roll: null, players: [{ tickets: 20, node: 0 }] } });
        await t.game('act', 'roll', 3);
        let s = await phase(t, 'choose');
        const label = await text(t, '[data-act="reroll"]');
        const want = Math.min(i + 1, 4);
        t.expect(label.includes(`${want} ticket`), `re-roll button names its price (${want}): "${label.replace(/\s+/g, ' ')}"`);
        const before = (await me(t)).tickets;
        t.expect(await t.game('act', 'reroll'), 're-roll accepted');
        s = await t.state();
        costs.push(before - s.trail.players[0].tickets);
        t.equal(s.trail.players[0].rerolls, i + 1, 'the trip counts its re-rolls');
        if (i === 0) await t.shot('S3-02-reroll-price');
      }
      t.equal(JSON.stringify(costs), JSON.stringify([1, 2, 3, 4, 4, 4]), 'prices paid');
    },
  },
  {
    name: 'S3-02 a re-roll you cannot afford is refused and its button is disabled',
    async run(t) {
      await soloGame(t);
      await t.game('setState', { trail: { phase: 'roll', rerolled: false, players: [{ tickets: 3, rerolls: 3 }] } });
      await t.game('act', 'roll', 3);
      await phase(t, 'choose');
      t.expect(await t.page.locator('[data-act="reroll"]').isDisabled(), 'button disabled at 3 tickets when the price is 4');
      t.equal(await t.game('act', 'reroll'), false, 'refused');
      t.equal(await ticketsOf(t), 3, 'nothing spent');
    },
  },
  {
    name: 'S3-02 the wager cap is 5, or a quarter of the hoard up to 10',
    async run(t) {
      await soloGame(t);
      const cases = [[3, 3], [12, 5], [20, 5], [28, 7], [40, 10], [90, 10]];
      for (const [tickets, cap] of cases) {
        await t.game('setState', { trail: { phase: 'roll', players: [{ tickets }] } });
        await landOn(t, (await t.state()).board.types.indexOf('wager'));
        const s = await t.state();
        t.equal(s.trail.phase, 'wager', 'on the wager space');
        const chips = await t.page.locator('.chips [data-act="wager"]').count();
        t.equal(chips, cap + 1, `${tickets} tickets: chips 0..${cap}`);
        if (tickets === 40) await t.shot('S3-02-wager-10');
        await t.game('act', 'wager', 99);
        const after = await t.state();
        t.equal(after.trail.pending.wager, cap, `${tickets} tickets: a bigger wager is clamped to ${cap}`);
        await t.game('act', 'answer', 'correct'); await t.game('act', 'continue');
        await phase(t, ['roll', 'landed']);
      }
    },
  },
  {
    name: 'S3-02 the wager keys 0-9 work for a large hoard',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t);
      await t.game('setState', { trail: { phase: 'roll', players: [{ tickets: 40 }] } });
      await landOn(t, (await t.state()).board.types.indexOf('wager'));
      t.expect((await text(t, '.key-hint')).includes('0–9'), 'the hint names keys 0-9');
      await t.page.keyboard.press('7');
      const s = await t.state();
      t.equal(s.trail.pending.wager, 7, 'key 7 wagers 7');
    },
  },
  {
    name: 'S3-02 the Express ticket shows where it goes and what it costs, and is greyed out when too dear',
    async run(t) {
      await soloGame(t);
      await t.game('setState', { trail: { phase: 'roll', players: [{ tickets: 5, node: 0 }] } });
      let label = await text(t, '[data-act="express"]');
      t.expect(/Express to .+ · 6 tickets/.test(label.replace(/\s+/g, ' ')), `label: ${label.replace(/\s+/g, ' ')}`);
      t.expect(await t.page.locator('[data-act="express"]').isDisabled(), 'disabled with 5 tickets');
      t.equal(await t.game('act', 'express'), false, 'refused with 5 tickets');
      await t.game('setState', { trail: { players: [{ tickets: 6 }] } });
      t.expect(!(await t.page.locator('[data-act="express"]').isDisabled()), 'enabled with 6 tickets');
      await t.shot('S3-02-express-button');
      await t.checkLayout();
    },
  },
  {
    name: 'S3-02 Express jumps to the nearest landmark with no stamp and asks its question; the stamp is earned',
    async run(t) {
      await soloGame(t);
      await t.game('setState', { trail: { phase: 'roll', players: [{ tickets: 9, node: 0 }] } });
      const s0 = await t.state();
      const lm = Object.values(s0.board.landmarks);
      t.expect(await t.game('act', 'express'), 'Express accepted');
      await t.game('act', 'finishAnim');
      let s = await waitFor(t, (x) => x.trail.phase === 'question', 4000, 'landmark question');
      const p = s.trail.players[0];
      t.equal(p.tickets, 3, 'cost 6 tickets');
      t.expect(lm.includes(p.node), 'standing on a landmark');
      t.equal(s.question.purpose, 'expressLandmark', 'the question is an Express landmark question');
      t.expect((await text(t, '.purpose')).includes('Express landmark'), 'the card says so');
      await t.shot('S3-02-express-question');
      await t.game('act', 'answer', 'correct');
      s = await t.state();
      t.equal(s.trail.players[0].stamps.length, 1, 'stamp earned');
      t.equal(s.trail.players[0].tickets, 5, 'the landmark pays 2 tickets');
      await t.game('act', 'continue');
      s = await phase(t, ['roll', 'landed']);
      // never to a landmark already stamped
      const stamped = s.trail.players[0].stamps[0];
      await t.game('setState', { trail: { phase: 'roll', players: [{ tickets: 9, node: 0 }] } });
      await t.game('act', 'express'); await t.game('act', 'finishAnim');
      s = await waitFor(t, (x) => x.trail.phase === 'question', 4000, 'second landmark question');
      t.expect(s.question.category !== stamped, 'a second Express goes to a landmark with no stamp');
    },
  },
  {
    name: 'S3-02 Express is not offered once the stamp target is met, and the E key buys it',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t);
      await t.game('setState', { trail: { phase: 'roll', players: [{ tickets: 10, node: 0, stamps: ALL.slice(0, 6) }] } });
      t.equal(await t.page.locator('[data-act="express"]').count(), 0, 'no button at the stamp target');
      t.equal(await t.game('act', 'express'), false, 'refused at the stamp target');
      await t.game('setState', { trail: { players: [{ stamps: [] }] } });
      await t.page.keyboard.press('e');
      const s = await waitFor(t, (x) => ['moving', 'question'].includes(x.trail.phase), 3000, 'Express by key');
      t.equal(s.trail.players[0].tickets, 4, 'E bought it');
    },
  },
  {
    name: 'S3-02 the 50/50 costs 2 and on the Summit question the Summit hint costs 4',
    async run(t) {
      await soloGame(t);
      await t.game('setState', { trail: { phase: 'roll', players: [{ tickets: 9 }] } });
      await landOn(t, (await t.state()).board.types.indexOf('cat'));
      let label = await text(t, '[data-act="lifeline"]');
      t.expect(/50\/50 · 2 tickets/.test(label), `label: ${label}`);
      await t.game('act', 'lifeline');
      t.equal(await ticketsOf(t), 7, '50/50 cost 2');
      await t.game('act', 'answer', 'correct'); await t.game('act', 'continue');
      await phase(t, ['roll', 'landed']);
      const s = await t.state();
      await t.game('setState', { trail: { phase: 'roll', players: [{ tickets: 9, node: 0, stamps: ALL.slice(0, 6) }] } });
      await landOn(t, s.board.tower);
      await phase(t, 'summit');
      await t.game('act', 'continue');
      await phase(t, 'question');
      label = await text(t, '[data-act="lifeline"]');
      t.expect(/Summit hint · 4 tickets/.test(label), `label: ${label}`);
      await t.shot('S3-02-summit-hint');
      await t.game('act', 'lifeline');
      const st = await t.state();
      t.equal(st.trail.players[0].tickets, 5, 'Summit hint cost 4');
      t.equal(st.question.removed.length, 2, 'two wrong answers struck out');
      await t.game('setState', { trail: { players: [{ tickets: 3 }] }, question: { removed: [] } });
      t.equal(await t.game('act', 'lifeline'), false, 'cannot buy the Summit hint with 3 tickets');
    },
  },
  {
    name: 'S3-02 Help names both new buys and the new prices',
    viewports: ['desktop'],
    async run(t) {
      await t.game('scene', 'help');
      const h = await text(t, '#scene-help');
      t.expect(h.includes('Express ticket') && h.includes('Summit hint'), 'Express ticket and Summit hint are described');
      t.expect(h.includes('2, 3 and 4'), 're-roll escalation is described');
      t.expect(h.includes('quarter of your hoard'), 'wager cap is described');
    },
  },
  {
    name: 'S3-02 a Hard AI with tickets buys Express; a Medium AI does not',
    viewports: ['desktop'],
    async run(t) {
      await t.seed(11);
      await t.game('setState', { settings: { passScreen: false, aiSpeed: 'fast', timer: 0 } });
      await t.game('newGame', { mode: 'trail', players: [{ kind: 'ai', level: 'hard' }, { kind: 'ai', level: 'medium' }], target: 6, seed: 11 });
      await t.game('act', 'stopAI');
      await t.game('setState', { trail: { phase: 'roll', turn: 1, players: [{ tickets: 12, node: 0 }, { tickets: 12, node: 0 }] } });
      await t.game('scene', 'game');
      await waitFor(t, (x) => x.trail.turn === 0 && x.trail.phase !== 'roll' || x.trail.round > 1, 6000, 'the Medium AI finishes its turn');
      let st = await t.state();
      t.expect(!st.trail.log.some((l) => /Express/.test(l)), 'the Medium AI did not buy Express');
      await t.game('act', 'stopAI');
      await t.game('setState', { trail: { phase: 'roll', turn: 0, players: [{ tickets: 12, node: 0 }] } });
      await t.game('scene', 'game');
      st = await waitFor(t, (x) => x.trail.log.some((l) => /Express ticket/.test(l)), 6000, 'the Hard AI buys Express');
      t.expect(st.trail.log.some((l) => /The Professor buys an Express ticket/.test(l)), 'by name in the log');
    },
  },
  {
    name: 'S3-02 a trip saved before this wave (no re-roll count) loads and charges 1 ticket for the first re-roll',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t);
      await t.game('act', 'roll', 2); await phase(t, 'choose');
      await t.game('act', 'chooseIndex', 0); await t.game('act', 'finishAnim');
      await waitFor(t, (s) => ['question', 'landed', 'vent', 'wager', 'order', 'postcard', 'jury', 'roll'].includes(s.trail.phase), 4000, 'landing');
      await t.page.evaluate(() => {
        const k = 'hs-trivia-v1'; const d = JSON.parse(localStorage.getItem(k));
        for (const p of d.trail.players) delete p.rerolls;
        localStorage.setItem(k, JSON.stringify(d));
      });
      await t.reload();
      await t.game('act', 'ui', 'continue-trail');
      await waitFor(t, (s) => s.scene === 'game' && s.trail, 3000, 'continued trip');
      await t.game('setState', { trail: { phase: 'roll', rerolled: false, players: [{ tickets: 10 }] } });
      await t.game('act', 'roll', 3); await phase(t, 'choose');
      const before = await ticketsOf(t);
      await t.game('act', 'reroll');
      t.equal(before - await ticketsOf(t), 1, 'first re-roll of an old trip costs 1');
      t.equal((await me(t)).rerolls, 1, 'and is counted from now on');
    },
  },
  {
    name: 'S3-02 the re-roll count survives a reload in the middle of a trip',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t);
      await t.game('setState', { trail: { phase: 'roll', players: [{ tickets: 20, rerolls: 2 }] } });
      await landOn(t, (await t.state()).board.types.indexOf('cat'));
      await t.game('act', 'answer', 'correct'); await t.game('act', 'continue'); // the trip is saved when the turn ends
      await phase(t, 'roll');
      await t.reload();
      await t.game('act', 'ui', 'continue-trail');
      await waitFor(t, (s) => s.scene === 'game' && s.trail, 3000, 'continued trip');
      t.equal((await me(t)).rerolls, 2, 're-roll count restored');
    },
  },
  {
    name: 'S3-02 economy simulation: unspent tickets end under 8 and the human profile keeps its edge over Normal',
    node: true,
    async run(t) {
      const run = (rows, games) => {
        const r = spawnSync(process.execPath, ['tools/econ-sim.mjs', String(games), rows], { encoding: 'utf8', timeout: 240000 });
        if (r.status !== 0) { t.fail('simulation failed: ' + r.stderr.slice(0, 400)); return []; }
        return r.stdout.trim().split('\n').map((l) => JSON.parse(l));
      };
      const [med, easy, hard] = run('1,0,2', 60);
      t.log(`medium mirror: end tickets median ${med.endTicketsMedian}, easy ${easy.endTicketsMedian}, hard ${hard.endTicketsMedian}`);
      for (const [name, row] of [['Medium', med], ['Easy', easy], ['Hard', hard]]) {
        for (const m of row.endTicketsMedian) t.expect(m < 8, `${name} AI median unspent tickets ${m} is under 8`);
      }
      const [fan, strong] = run('9,10', 120);
      t.log(`human fan: win ${fan.win[0]} % (was 76.7), end tickets ${fan.endTicketsMedian}; strong: win ${strong.win[0]} % (was 89), end tickets ${strong.endTicketsMedian}`);
      for (const m of [...fan.endTicketsMedian, ...strong.endTicketsMedian]) t.expect(m < 8, `human-profile median unspent ${m} is under 8`);
      t.expect(fan.win[0] >= 76.7 - 10, `fan profile still wins ${fan.win[0]} % against Medium (was 76.7 %; run is small, so a 10-point band)`);
      // S3-03 (wave 3): the Final Lap gives the trailing traveler free Expresses, so the stronger player's edge is smaller on purpose (88 % to 73 % over 300 games); it must still be a clear edge.
      // C4-16: the floor is the seeded 300-game measurement at the wave-3 tip, 80.3 % (tools/econ-sim.mjs 300 10; 72.7 % before the personas), less the same 10-point band as the fan profile.
      // The run is seeded, so these 120 games give the same 81.7 % every time; a Final Lap or persona twice as strong would drop below 70.3 %.
      t.expect(strong.win[0] >= 80.3 - 10, `strong profile still wins ${strong.win[0]} % against Medium (80.3 % over 300 games at the wave-3 tip; was 89 % before the Final Lap)`);
      const [mh, em] = run('6,8', 80);
      t.expect(mh.win[1] > 55, `Hard beats Medium (${mh.win[1]} %; S3-09 pulled the tiers to about 65/35, it was above 70)`);
      t.expect(em.win[1] > 55, `Medium beats Easy (${em.win[1]} %; S3-09 pulled the tiers to about 65/35, it was above 85)`);
    },
  },
  // ---------------- S1-03 ----------------
  {
    name: 'S1-03 a new player starts at Brisk, and the speed is written with their first save',
    viewports: ['desktop'],
    async run(t) {
      t.equal(await speed(t), 'brisk', 'default AI speed');
      t.equal(await stored(t), null, 'nothing is stored until the player does something');
      await t.game('setState', { settings: { volume: 0.5 } });
      const d = await stored(t);
      t.equal(d.settings.aiSpeed, 'brisk', 'the first save names Brisk');
      await t.reload();
      t.equal(await speed(t), 'brisk', 'still Brisk after a reload');
    },
  },
  ...[['a save from before the setting existed (no aiSpeed)', { v: 1, settings: { volume: 0.4 } }, 'normal'],
    ['a save with Fast chosen', { v: 1, settings: { aiSpeed: 'fast' } }, 'fast'],
    ['a save with Relaxed chosen', { v: 1, settings: { aiSpeed: 'normal' } }, 'normal'],
    ['a hand-edited save with an unknown speed', { v: 1, settings: { aiSpeed: 'turbo' } }, 'brisk']].map(([label, save, want]) => ({
    name: `S1-03 ${label} plays at ${want}`,
    viewports: ['desktop'],
    initScript: withSave(save),
    async run(t) {
      t.equal(await speed(t), want, 'AI speed on load');
      await t.game('setState', { settings: { volume: 0.6 } });
      await t.reload();
      t.equal(await speed(t), want, 'unchanged by saving another setting and reloading');
    },
  })),
  {
    name: 'S1-03 Settings offers Relaxed, Brisk and Fast and the choice is saved',
    async run(t) {
      await t.game('scene', 'settings');
      const labels = await t.page.locator('[aria-label="AI speed"] .seg-b').allInnerTexts();
      t.equal(labels.join('|'), 'Relaxed|Brisk|Fast', 'three speeds');
      t.equal(await t.page.locator('[aria-label="AI speed"] .seg-b.on').innerText(), 'Brisk', 'Brisk is selected');
      await t.page.locator('[data-key="set-aiSpeed-fast"]').click();
      t.equal((await stored(t)).settings.aiSpeed, 'fast', 'saved');
      await t.shot('S1-03-settings-ai-speed');
      await t.reload();
      t.equal(await speed(t), 'fast', 'kept after a reload');
    },
  },
  {
    name: 'S1-03 the panel has an AI speed button that cycles the speed; it is not there without an AI',
    async run(t) {
      await soloGame(t);
      t.equal(await t.page.locator('[data-act="ai-speed"]').count(), 0, 'no button in a game without AI seats');
      await t.game('setState', { settings: { aiSpeed: 'brisk' } });
      await t.game('newGame', { mode: 'trail', players: [H1, { kind: 'ai', level: 'easy' }], target: 6 });
      await phase(t, 'roll');
      const b = t.page.locator('[data-act="ai-speed"]');
      t.expect((await b.innerText()).includes('Brisk'), 'shows the current speed');
      const box = await b.boundingBox();
      t.expect(box.height >= 30 && box.width >= 44, `target size ${box.width}x${box.height}`);
      await t.shot('S1-03-panel-ai-speed');
      await b.click(); t.equal(await speed(t), 'fast', 'Brisk to Fast');
      await b.click(); t.equal(await speed(t), 'normal', 'Fast to Relaxed');
      t.expect((await b.innerText()).includes('Relaxed'), 'label follows');
      await b.click(); t.equal(await speed(t), 'brisk', 'Relaxed to Brisk');
      t.equal((await stored(t)).settings.aiSpeed, 'brisk', 'saved');
      await t.checkLayout();
    },
  },
  {
    name: 'S1-03 a key press skips the AI beat that is waiting; a human turn is not skipped',
    viewports: ['desktop'],
    async run(t) {
      await t.seed(7);
      await t.game('setState', { settings: { passScreen: false, aiSpeed: 'normal', timer: 0 } });
      // C4-15: every wait is stretched a thousand times (800 ms becomes about 13 minutes), so the roll can only come from the key, on any machine.
      await t.page.evaluate(() => { window.__TEST_BEAT_STRETCH = 1000; });
      await t.game('newGame', { mode: 'trail', players: [{ kind: 'ai', level: 'medium' }, H1], target: 6, seed: 7 });
      let s = await t.state();
      t.equal(s.trail.phase, 'roll', 'the AI is about to roll (800 ms away at Relaxed)');
      await t.page.keyboard.press('x');
      s = await waitFor(t, (x) => x.trail.phase !== 'roll', 15000, 'the roll after one key');
      await t.game('act', 'stopAI');
      await t.game('setState', { trail: { phase: 'roll', turn: 1 } });
      await t.page.keyboard.press('x');
      await t.page.waitForTimeout(150);
      s = await t.state();
      t.equal(s.trail.phase, 'roll', 'the key did nothing on the human turn');
    },
  },
  {
    name: 'S1-03 a tap on the board skips the AI beat that is waiting',
    async run(t) {
      await t.seed(7);
      await t.game('setState', { settings: { passScreen: false, aiSpeed: 'normal', timer: 0 } });
      await t.page.evaluate(() => { window.__TEST_BEAT_STRETCH = 1000; }); // C4-15: only the tap can end the wait
      await t.game('newGame', { mode: 'trail', players: [{ kind: 'ai', level: 'medium' }, H1], target: 6, seed: 7 });
      await t.game('act', 'stopAI');
      await t.shot('S1-03-ai-turn-hint', { wait: false });
      await t.game('scene', 'game');
      const r = await t.page.locator('#board').boundingBox();
      if (t.viewport === 'mobile') await t.tap([r.x + r.width / 2, r.y + r.height / 2]); else await t.page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
      await waitFor(t, (x) => x.trail.phase !== 'roll', 15000, 'the roll after a tap');
    },
  },
  {
    name: 'S1-03 skipping through a whole AI turn takes a couple of seconds',
    viewports: ['desktop'],
    async run(t) {
      const r = await aiTurn(t, 'normal', { skip: true });
      t.log(`one AI turn at Relaxed, skipped with a key: ${r.ms} ms in ${r.presses} presses`);
      t.expect(r.ms < 5000, `whole AI turn skipped in ${r.ms} ms`);
      const s = await t.state();
      t.equal(s.trail.turn, 1, 'back to the human');
    },
  },
  {
    name: 'S1-03 an AI turn at Brisk is shorter than at Relaxed, and Fast shorter again (walk included)',
    viewports: ['desktop'],
    async run(t) {
      const slow = await aiTurn(t, 'normal');
      const mid = await aiTurn(t, 'brisk');
      const fast = await aiTurn(t, 'fast');
      t.log(`first AI turn, same seed: Relaxed ${slow.ms} ms, Brisk ${mid.ms} ms, Fast ${fast.ms} ms`);
      t.expect(mid.ms < slow.ms * 0.8, `Brisk ${mid.ms} is under 80% of Relaxed ${slow.ms}`);
      t.expect(fast.ms < mid.ms, `Fast ${fast.ms} is shorter than Brisk ${mid.ms}`);
    },
  },
  {
    name: 'S1-03 pace in the rules engine: seconds per AI turn at each speed',
    node: true,
    async run(t) {
      const out = {};
      for (const sp of ['normal', 'brisk', 'fast']) {
        const r = spawnSync(process.execPath, ['tools/econ-sim.mjs', '12', '1'], { encoding: 'utf8', timeout: 120000, env: { ...process.env, PACE: sp } });
        if (r.status !== 0) { t.fail('pace run failed: ' + r.stderr.slice(0, 300)); return; }
        out[sp] = JSON.parse(r.stdout.trim().split('\n')[0]).secondsPerTurn;
      }
      t.log(`seconds per AI turn: Relaxed ${out.normal}, Brisk ${out.brisk}, Fast ${out.fast}`);
      t.expect(out.normal > 5.5 && out.normal < 8, `Relaxed is the old pace, about 7 s (${out.normal})`);
      t.expect(out.brisk < out.normal * 0.65, `Brisk is well under Relaxed (${out.brisk})`);
      t.expect(out.brisk > 2.5, `Brisk is not a blur (${out.brisk})`);
      t.expect(out.fast < out.brisk, `Fast is quicker still (${out.fast})`);
    },
  },
  {
    name: 'S1-03 an existing save keeps its AI speed through a reload mid-trip',
    viewports: ['desktop'],
    initScript: withSave({ v: 1, settings: { aiSpeed: 'normal' } }),
    async run(t) {
      await t.game('newGame', { mode: 'trail', players: [H1, { kind: 'ai', level: 'easy' }], target: 6 });
      await t.reload();
      t.equal(await speed(t), 'normal', 'Relaxed after the reload');
    },
  },
];
