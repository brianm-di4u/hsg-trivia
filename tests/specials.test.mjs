// Special spaces and the mountain (AC11–AC18, AC21).
import { soloGame, phase, landOn, moveTo, waitFor } from './helpers.mjs';

const firstOf = (s, type) => s.board.types.indexOf(type);
const ALL = ['Places & Landmarks', 'Food & Culture', 'History', 'Entertainment', 'Nature & Lakes', 'Sports', 'Legends & Oddities', 'People'];

export const tests = [
  {
    name: 'steam vent ride',
    async run(t) {
      await soloGame(t);
      let s = await t.state();
      const [a, b] = s.board.vents[0];
      s = await landOn(t, a);
      t.equal(s.trail.phase, 'vent', 'vent offers a ride');
      await t.shot('11-vent');
      await t.game('act', 'vent', true);
      await t.game('act', 'finishAnim');
      s = await phase(t, 'roll');
      t.equal(s.trail.players[0].node, b, 'rode to the paired vent');
    },
  },
  {
    name: 'post time wager',
    async run(t) {
      await soloGame(t);
      let s = await t.state();
      await t.game('setState', { trail: { players: [{ tickets: 5 }] } });
      s = await landOn(t, firstOf(s, 'wager'));
      t.equal(s.trail.phase, 'wager', 'wager space');
      await t.shot('09-wager');
      await t.checkLayout();
      await t.game('act', 'wager', 3);
      s = await phase(t, 'question');
      t.equal(s.question.purpose, 'wager', 'wager question');
      const hard = s.question.difficulty === 'hard';
      await t.game('act', 'answer', 'correct');
      s = await phase(t, 'feedback');
      t.equal(s.trail.players[0].tickets, 5 + (hard ? 6 : 3), 'wager paid');
      await t.game('act', 'continue');
      s = await phase(t, 'roll');
      await t.game('setState', { trail: { players: [{ tickets: 4 }] } });
      s = await landOn(t, s.board.types.lastIndexOf('wager'));
      await t.game('act', 'wager', 2);
      await phase(t, 'question');
      await t.game('act', 'answer', 'wrong');
      s = await phase(t, 'feedback');
      t.equal(s.trail.players[0].tickets, 2, 'wager lost');
    },
  },
  {
    name: 'time warp ordering and warp',
    async run(t) {
      await soloGame(t);
      let s = await t.state();
      s = await landOn(t, firstOf(s, 'warp'));
      t.equal(s.trail.phase, 'order', 'time warp asks for an order');
      t.equal(s.trail.pending.events.length, 3, 'three events');
      await t.page.click('.ev >> nth=1');
      await t.shot('10-timewarp');
      await t.checkLayout();
      await t.game('act', 'orderCorrect');
      s = await phase(t, 'orderResult');
      t.expect(s.trail.pending.ok, 'correct order accepted');
      await t.game('act', 'continue');
      s = await phase(t, 'warp');
      t.equal(s.trail.pending.options.length, 8, 'all eight landmarks offered');
      await t.shot('10b-warp-choose');
      const target = s.board.landmarks['Entertainment'];
      await t.game('act', 'warp', target);
      await t.game('act', 'finishAnim');
      s = await phase(t, 'question');
      t.equal(s.trail.players[0].node, target, 'warped to the landmark');
      t.equal(s.question.category, 'Entertainment', 'landmark category question');
      await t.game('act', 'answer', 'correct');
      s = await phase(t, 'feedback');
      t.expect(s.trail.players[0].stamps.includes('Entertainment'), 'warp landmark stamp');
    },
  },
  {
    name: 'postcard and grand jury',
    async run(t) {
      await soloGame(t);
      let s = await t.state();
      s = await landOn(t, firstOf(s, 'postcard'));
      t.equal(s.trail.phase, 'postcard', 'postcard');
      t.equal(s.trail.players[0].tickets, 4, 'postcard pays 1 ticket');
      await t.shot('12-postcard');
      await t.checkLayout();
      await t.game('act', 'continue');
      s = await phase(t, 'roll');
      s = await landOn(t, firstOf(s, 'jury'));
      t.equal(s.trail.phase, 'jury', 'grand jury');
      await t.shot('13-grandjury');
      await t.game('act', 'continue');
      s = await phase(t, 'question');
      t.equal(s.question.category, 'Legends & Oddities', 'legends question');
      await t.game('act', 'answer', 'wrong');
      s = await phase(t, 'feedback');
      t.expect(s.trail.players[0].skip, 'will skip next turn');
      await t.game('act', 'continue');
      s = await phase(t, 'skipped');
      s = await phase(t, 'roll', 4000);
      t.equal(s.trail.round, 4, 'skipped turn consumed a round');
    },
  },
  {
    name: 'trolley ride',
    async run(t) {
      await soloGame(t);
      let s = await t.state();
      t.expect(s.board.trolleys.includes(s.board.start), 'the Y is a trolley stop');
      await t.game('act', 'ui', 'trolley-open');
      await t.shot('14-trolley');
      const to = s.board.trolleys.find((x) => x !== s.board.start);
      await t.game('act', 'ui', 'trolley', String(to));
      await t.game('act', 'finishAnim');
      s = await phase(t, 'roll');
      t.equal(s.trail.players[0].node, to, 'rode the trolley');
      t.equal(s.trail.players[0].tickets, 1, 'trolley cost 2 tickets');
    },
  },
  {
    name: 'lifeline and reroll',
    async run(t) {
      await soloGame(t);
      let s = await t.state();
      await t.game('act', 'roll', 3);
      s = await phase(t, 'choose');
      await t.game('act', 'reroll');
      s = await phase(t, ['choose', 'stuck']);
      t.equal(s.trail.players[0].tickets, 2, 're-roll cost 1 ticket');
      t.expect(s.trail.rerolled, 're-roll used');
      await t.game('setState', { trail: { phase: 'roll', players: [{ tickets: 4 }] } });
      s = await landOn(t, s.board.types.indexOf('cat'));
      await t.game('act', 'lifeline');
      s = await t.state();
      t.equal(s.question.removed.length, 2, 'two wrong answers removed');
      t.expect(!s.question.removed.includes(s.question.correctIndex), 'correct answer kept');
      t.equal(s.trail.players[0].tickets, 2, '50/50 cost 2 tickets');
      await t.shot('18-lifeline');
    },
  },
  {
    name: 'mountain trail gating and short cut cost',
    async run(t) {
      await soloGame(t);
      let s = await t.state();
      const th = s.board.trailhead, entry = s.board.spurEntry;
      await t.game('setState', { trail: { players: [{ node: th }] } });
      await t.game('act', 'roll', 1);
      s = await phase(t, 'choose');
      t.expect(!s.trail.dests.includes(entry), 'trail closed without stamps');
      await t.shot('15-trail-locked');
      await t.game('setState', { trail: { phase: 'roll', players: [{ stamps: ALL.slice(0, 6) }] } });
      await t.game('act', 'roll', 1);
      s = await phase(t, 'choose');
      t.expect(s.trail.dests.includes(entry), 'trail open at the stamp target');
      // costs: find the fork (node with 3 spur neighbors) and test the steep branch
      const fork = s.board.types.findIndex((ty, i) => ty === 'trail' && s.board.costs[i] === 1 && s.board.costs[i + 1] === 2);
      await t.game('setState', { trail: { phase: 'roll', players: [{ node: fork }] } });
      await t.game('act', 'roll', 2);
      s = await phase(t, 'choose');
      t.expect(s.trail.dests.includes(fork + 1), 'first Short Cut space costs 2 steps');
      await t.game('setState', { trail: { phase: 'roll' } });
      await t.game('act', 'roll', 6);
      s = await phase(t, 'choose');
      t.expect(s.trail.dests.includes(s.board.tower), 'tower absorbs leftover steps');
    },
  },
  {
    name: 'summit win',
    async run(t) {
      await soloGame(t, { players: [{ kind: 'human', name: 'Ada' }, { kind: 'ai', level: 'hard' }] });
      let s = await t.state();
      await t.game('setState', { trail: { players: [{ stamps: ALL.slice(0, 6), tickets: 7 }] } });
      const before = s.board.tower - 1;
      s = await moveTo(t, before, 1, s.board.tower);
      t.equal(s.trail.phase, 'summit', 'summit intro');
      await t.shot('16a-summit-intro');
      await t.game('act', 'continue');
      s = await phase(t, 'question');
      t.equal(s.question.purpose, 'summit', 'summit question');
      t.equal(s.question.difficulty, 'hard', 'summit is hard');
      await t.shot('16-summit');
      await t.game('act', 'answer', 'correct');
      await phase(t, 'feedback');
      await t.game('act', 'continue');
      s = await waitFor(t, (x) => x.scene === 'win', 3000, 'win scene');
      t.equal(s.trail.winner, 0, 'Ada wins');
      await t.page.waitForTimeout(300);
      await t.shot('17-win');
      await t.checkLayout();
    },
  },
  {
    name: 'summit miss sends you back',
    viewports: ['desktop'],
    async run(t) {
      await soloGame(t);
      let s = await t.state();
      await t.game('setState', { trail: { players: [{ stamps: ALL.slice(0, 6), tickets: 2 }] } });
      s = await moveTo(t, s.board.tower - 1, 1, s.board.tower);
      await t.game('act', 'continue');
      await phase(t, 'question');
      await t.game('act', 'answer', 'wrong');
      await phase(t, 'feedback');
      await t.game('act', 'continue');
      await t.game('act', 'finishAnim');
      s = await phase(t, 'roll');
      t.equal(s.trail.players[0].node, s.board.trailhead, 'back at the trailhead');
      t.equal(s.trail.players[0].tickets, 1, 'lost a ticket');
    },
  },
];
