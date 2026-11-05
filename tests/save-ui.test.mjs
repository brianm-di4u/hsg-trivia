// Synthetic existing-hook setup for error UI only. Not earned gameplay coverage.
import { soloGame, landOn, phase } from './helpers.mjs';
export const tests = [{ name: 'stale trip conflict uses the existing dialog and preserves the newer reserved slot', viewports: ['desktop'], async run(t) {
  await soloGame(t); const s = await t.state(); await landOn(t, s.board.types.indexOf('postcard'));
  const b = await t.page.context().newPage(); await b.goto(t.page.url()); await b.waitForFunction(() => !!window.__game);
  await b.evaluate(() => window.__game.newGame({ mode: 'trail', players: [{ kind: 'human', name: 'Other fixture' }] }));
  const reserved = await b.evaluate(() => localStorage.getItem('hs-trivia-v1'));
  await t.game('act', 'continue'); await phase(t, 'roll');
  t.equal(await t.page.locator('#mtitle').textContent(), 'Saved trip changed', 'actual conflict notice shown');
  t.equal(await t.page.evaluate(() => localStorage.getItem('hs-trivia-v1')), reserved, 'stale endTurn did not overwrite newer slot');
  await t.shot('save-conflict-dialog'); await t.checkLayout();
  await t.page.click('[data-act="save-conflict-title"]'); t.equal((await t.state()).scene, 'title', 'existing title route works');
  t.equal(await t.page.locator('#modal').isVisible(), false, 'conflict dialog closes on explicit title route'); await b.close();
} }];
