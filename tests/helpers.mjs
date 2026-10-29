// Shared helpers for the trivia tests (imported by *.test.mjs; not a test file itself).

export const H1 = { kind: 'human', name: 'Ada' };
export const H2 = { kind: 'human', name: 'Bo' };

export async function waitFor(t, pred, ms = 8000, label = 'condition') {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const s = await t.state();
    if (pred(s)) return s;
    await t.page.waitForTimeout(60);
  }
  t.fail(`timed out waiting for ${label}`);
  return t.state();
}

export const phase = (t, ph, ms) => waitFor(t, (s) => s.trail && (Array.isArray(ph) ? ph.includes(s.trail.phase) : s.trail.phase === ph), ms, `phase ${ph}`);

// Start a solo human game (no pass screen), seeded.
export async function soloGame(t, { seed = 7, target = 6, players = [H1], settings = {} } = {}) {
  await t.seed(seed);
  await t.game('setState', { settings: { passScreen: false, aiSpeed: 'fast', timer: 0, ...settings } });
  await t.game('newGame', { mode: 'trail', players, target, seed });
  await phase(t, 'roll');
}

// Put the active player on `from`, roll `n`, and move to `to` (must be a legal destination).
export async function moveTo(t, from, n, to) {
  await t.game('setState', { trail: { players: [{ node: from }] } });
  await t.game('act', 'roll', n);
  const s = await phase(t, 'choose');
  t.expect(s.trail.dests.includes(to), `node ${to} reachable from ${from} with ${n} (got ${s.trail.dests.join(',')})`);
  await t.game('act', 'choose', to);
  await t.game('act', 'finishAnim');
  return waitFor(t, (x) => x.trail.phase !== 'moving', 4000, 'move end');
}

// A neighbor of node `to` on the main route (so moveTo(t, nb, 1, to) is always legal).
export async function neighborOf(t, to) {
  const adj = await t.game('act', 'adj', to);
  const s = await t.state();
  return adj.find((n) => s.board.types[n] !== 'trail' && s.board.types[n] !== 'tower') ?? adj[0];
}

export async function landOn(t, to) { return moveTo(t, await neighborOf(t, to), 1, to); }
