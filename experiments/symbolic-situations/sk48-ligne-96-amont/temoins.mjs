import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

export const groups=['historique','développement','réserve'];
export const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const read=file=>JSON.parse(readFileSync(file,'utf8'));
export function common(step){
  return [step.cmd,step.id,step.ref,step.model,step.need,step.strategy,step.guard,step.expected,step.after,step.evidence,step.pre];
}
function original(step){
  return [step.ticket.command,step.ticket.id,step.pre.ref,step.pre.model,step.pre.need,step.pre.strategy,
    step.guard,step.pre.expected,step.returned,step.pre.evidence,step.beforeChoice?.seal??null];
}
export function baseline(directory){
  const prior=read(new URL('../sk48-ligne-96/recu.json',import.meta.url)).empreintes;
  return Object.fromEntries(groups.map(group=>{
    const variants=['d0e7527c','08fa10a6'].map(sha=>read(join(directory,sha+'.'+group+'.json')).results);
    for(const variant of variants)assert.equal(hash(variant),prior[group]);
    return [group,variants[0].map(({card,result:{steps,stop}})=>({
      fiche:hash(card),tickets:steps.length,préfixe:hash(steps.map(original)),arrêt:stop.reason??null,niveaux:stop.completed??steps.at(-1).returned.completed
    }))];
  }));
}
