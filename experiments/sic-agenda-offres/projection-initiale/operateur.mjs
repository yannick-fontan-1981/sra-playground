import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { play,root } from '../revision-96/parcours.mjs';
import { pinned,gel } from '../revision-96/moteurs.mjs';

const {values}=parseArgs({options:{fiche:{type:'string'},pyodide:{type:'string'},recu:{type:'string'},source:{type:'string'},
  moteur:{type:'string',default:'candidat'}}});
if(!values.fiche || !values.pyodide) throw Error('Indiquer --fiche et --pyodide.');
const card=JSON.parse(await readFile(values.fiche,'utf8'));
async function execute(engine) {
  const plans=[];
  globalThis[Symbol.for('sic.order.search')]=data=>plans.push(structuredClone(data));
  const url=new URL('src/logos-engine/v6-rooted-line-access.ts',engine).href;
  registerHooks({load(request,context,next) {
    const result=next(request,context);
    if(request!==url) return result;
    const code=result.source.toString(), mark='const candidates = result.plans.filter(', prepare='const plan = structuredClone({ scene, memory, commands: actions,';
    for(const m of [mark,prepare]) assert.equal(code.split(m).length,2);
    const search=`globalThis[Symbol.for('sic.order.search')]({stage:'recherche',ref:observation.observation_ref,
      order:scene.order,nodes:result.expanded_node_count,bounds:result.exhausted_bound_refs,count:result.plans.length,
      goals:result.plans.map(p=>({action:p.action_refs[0],projection:p.goal.predicted_rooted_match,
        observed:p.goal.rooted_match,trial:p.goal.projected_order_trial ?? null}))});`;
    const proposal=`if(kind==='conditional_composition') globalThis[Symbol.for('sic.order.search')]({
      stage:'proposition',ref:observation.observation_ref,action:actions[0],trial:search.projected_order_trial ?? null,why});`;
    return {...result,source:code.replace(mark,search+'\n      '+mark).replace(prepare,proposal+'\n    '+prepare)};
  }});
  const result=await play(card,resolve(values.pyodide),engine);
  const wanted=result.steps[3]?.returned.ref;
  const report={card,choice5:plans.filter(p=>p.ref===wanted),stop:result.stop.reason ?? null,completed:result.steps.at(-1)?.returned.completed,
    steps:result.steps.map(r=>({i:r.step,cmd:r.ticket.command,id:r.ticket.id,ref:r.pre.ref,model:r.pre.model,
      need:r.pre.need,strategy:r.pre.strategy,guard:r.guard,expected:r.pre.expected,after:r.returned,
      evidence:r.pre.evidence,pre:r.beforeChoice?.seal ?? null})),knowledge:result.steps[4]?.beforeChoice ?? result.stop.beforeChoice ?? null};
  if(values.recu) await writeFile(values.recu,JSON.stringify(report)+'\n');
  const first=report.choice5[0];
  console.log(JSON.stringify({gestes:report.steps.length,arret:report.stop,niveaux:report.completed,etats:first?.nodes,
    choix5:report.steps[4]?.cmd ?? null,ordre:first?.goals[0]?.trial?.status ?? null,choix13:report.steps[12]?.cmd ?? null}));
}
if(values.moteur==='candidat') await execute(values.source ?? root);
else if(values.moteur==='gel' && !values.source) await pinned(gel,execute);
else throw Error('Moteur candidat ou gel attendu.');
