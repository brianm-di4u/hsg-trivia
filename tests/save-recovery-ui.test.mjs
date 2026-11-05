// Labelled browser fault-injection fixtures; not earned gameplay.
import { H1, landOn, phase } from './helpers.mjs';
const failNextWrite = (page) => page.evaluate(() => { const original = Storage.prototype.setItem; let fail = true; Storage.prototype.setItem = function(key,value) { if (key === 'hs-trivia-v1' && fail) { fail = false; throw Error('fixture one failed save'); } return original.call(this,key,value); }; });
export const tests = [
 { name:'recovery UI: failed Sound then real Volume input preserves both runtime and persisted preferences',viewports:['desktop'],async run(t){
   await t.page.click('[data-act="goto"][data-arg="settings"]'); await failNextWrite(t.page);
   await t.page.click('[data-act="set"][data-arg="sound=false"]'); t.equal((await t.state()).settings.sound,false,'local sound preference changed before failed write');
   await t.page.locator('input[data-setting="volume"]').click(); await t.page.keyboard.press('Home'); for(let i=0;i<20;i++)await t.page.keyboard.press('ArrowRight');
   const saved=await t.page.evaluate(()=>JSON.parse(localStorage.getItem('hs-trivia-v1')));t.equal(saved.settings.sound,false,'pending sound persisted on recovered volume write');t.equal((await t.state()).settings.sound,false,'runtime sound did not revert');t.equal(saved.settings.volume,0.2,'actual volume keyboard path persisted');await t.shot('pending-settings-recovered');
 }},
 { name:'recovery UI: failed New reservation autosaves on ordinary same-trip completed turn after storage recovery',viewports:['desktop'],async run(t){
   await t.game('setState',{settings:{passScreen:false,timer:0}});await failNextWrite(t.page);await t.game('newGame',{mode:'trail',players:[H1]});
   await phase(t,'roll');const state=await t.state();await landOn(t,state.board.types.indexOf('postcard'));await t.game('act','continue');await phase(t,'roll');
   const saved=await t.page.evaluate(()=>JSON.parse(localStorage.getItem('hs-trivia-v1')));t.expect(!!saved.trail,'same playable trip wrote a coherent autosave after storage recovery');t.expect(typeof saved.trailGeneration==='string','original reserved token persisted');t.equal(saved.trail?.round,2,'actual fixture completed turn saved');await t.shot('reservation-recovered-autosave');
 }},
];
