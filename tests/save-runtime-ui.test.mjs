// Hook-assisted current-trip setup; actual preference/Passport input. Dispatch only, no audio-output claim.
import { soloGame, landOn, phase } from './helpers.mjs';
export const tests=[{name:'successful turn persistence applies latest shared preferences without adopting another board',viewports:['desktop'],async run(t){
 await soloGame(t);await t.page.keyboard.press('p');await t.page.waitForTimeout(150);await t.page.keyboard.press('Escape');
 const beforeControl=(await t.state()).audio.played;await t.page.keyboard.press('p');await t.page.waitForTimeout(80);const afterControl=(await t.state()).audio.played;
 t.expect(afterControl>beforeControl,'positive unmuted Passport preset dispatch');await t.page.keyboard.press('Escape');
 const b=await t.page.context().newPage();await b.goto(t.page.url());await b.waitForFunction(()=>!!window.__game);await b.click('[data-act="goto"][data-arg="settings"]');
 for(const value of['sound=false','motion=reduced','textScale=1.3'])await b.click('[data-act="set"][data-arg="'+value+'"]');
 await t.page.bringToFront();const initial=await t.state();await landOn(t,initial.board.types.indexOf('postcard'));const beforeTurn=await t.state();await t.game('act','continue');const after=await phase(t,'roll');
 t.equal(after.settings.sound,false,'A runtime applies latest Sound');t.equal(after.settings.motion,'reduced','A runtime applies latest Motion');t.equal(after.settings.textScale,1.3,'A runtime applies latest text size');
 t.equal(await t.page.evaluate(()=>document.documentElement.style.fontSize),'20.8px','actual DOM font applied');t.equal(await t.page.evaluate(()=>document.body.classList.contains('reduced')),true,'actual reduced DOM class applied');t.equal(after.ui.reduced,true,'renderer reduced flag applied');
 t.equal(after.trail.players,beforeTurn.trail.players,'settings sync preserves active player board/progression');t.equal(after.asked,beforeTurn.asked,'settings sync preserves active asked history');
 const saved=await t.page.evaluate(()=>JSON.parse(localStorage.getItem('hs-trivia-v1')));t.equal(saved.asked,after.asked,'committed asked group matches active trip');t.expect(Number.isInteger(saved.rng),'RNG retained in coherent saved group (private live RNG not directly exposed)');
 const played=after.audio.played;await t.page.keyboard.press('p');await t.page.waitForTimeout(80);t.equal((await t.state()).audio.played,played,'muted Passport dispatch is suppressed after sync');t.log('Preset counter is dispatch evidence only; signal output and audibility remain UNVERIFIED.');await t.shot('shared-settings-applied');await t.page.keyboard.press('Escape');await b.close();
}}];
