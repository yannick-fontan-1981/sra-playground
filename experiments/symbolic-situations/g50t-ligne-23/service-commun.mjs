import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {join,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
export const candidate='ba04161fbce03f9660e9e73c14ed2c14ef2538d7';
export function verifyCheckout(dir){
  dir=resolve(dir);
  const git=(...args)=>execFileSync('git',['-C',dir,...args],{encoding:'utf8'}).trim();
  assert.equal(git('rev-parse','HEAD'),candidate);
  assert.equal(git('diff',candidate,'--name-only','--','src','reference','public/python','package.json','experiments/sic-agenda-offres'),'');
  return {dir,lot:join(dir,'experiments/sic-agenda-offres/essai-local-23'),url:pathToFileURL(dir+sep)};
}
export function localDecision(d){
  return !!(d.ticket && d.pre?.local && d.family==='observed_frontier' && d.strategy==='test_local_input' && d.kind==='experiment' &&
    d.pre.routeStatus==='unqueried' && d.pre.local.context===d.pre.index && d.ticket.actionRef===d.pre.local.action.action_ref &&
    d.ticket.actionIndex===0 && d.ticket.observationRef===d.pre.observation && d.guard?.admitted && d.guard.beforeRelease &&
    d.release?.admitted && d.release.nativeGate && d.question?.id===d.pre.local.ref && d.need?.status==='assigned' &&
    d.need.parentObjective==='G_protocol_completion' && isDeepStrictEqual(d.need.subjects,[d.question.id]) &&
    d.predictedEffectUnknown===true && d.expectedAfter===null);
}
export function localReturn(d,r){
  return !!(r.ticket===d.ticket.id && r.before===d.ticket.observationRef && r.after!==r.before && r.plan===d.plan &&
    r.status==='unknown_effect_observed' && r.matched===null && r.need?.id===d.need.id && r.need.status==='observed' &&
    r.frontier?.objective===d.question.id && r.frontier.need===d.need.id && r.frontier.status==='observed' &&
    r.need.evidence.includes(r.after) && r.transition?.before===r.before && r.transition.after===r.after &&
    r.transition.command.action_ref===d.ticket.actionRef && r.transition.acquisition?.startsWith('transition:'));
}
