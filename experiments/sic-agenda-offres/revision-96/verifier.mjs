import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { counterfactuals } from './contre-epreuves.mjs';
import { gel, historique, pinned, run } from './moteurs.mjs';
import { root } from './parcours.mjs';
import { sha } from './sonde.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'}}});
if (!values.pyodide) throw Error('Indiquer --pyodide et le chemin du paquet local.');
const tmp=await mkdtemp(join(tmpdir(),'sic-96-verif-'));
const cases=['historique','reposition','palette','borne','shadow','chaine-etrangere'];
const actionOrder=['revise_rooted_contact','reposition_root_before_contact'];
function local(path) { return fileURLToPath(new URL(path,import.meta.url)); }
async function execute(name,engine) {
  const receipt=join(tmp,name+'.json');
  run(process.execPath,[local('operateur.mjs'),'--fiche',local('public/'+name+'.json'),'--pyodide',resolve(values.pyodide),
    '--source',engine,'--recu',receipt]);
  return JSON.parse(await readFile(receipt,'utf8'));
}
function compact(row) {
  return {geste:row.step,commande:row.ticket.command,avantChoix:row.beforeChoice?.seal ?? null,avantEmission:row.seal,
    strategie:row.pre.strategy,profondeur:row.pre.distance,etats:row.pre.visited,accord:row.returned.matched,
    besoin:row.returned.need?.status ?? null,apres:row.returned.ref};
}
function checkPath(trace,last) {
  assert.equal(trace.steps.length,last);
  assert.equal(trace.stop.completed,1);
  const rows=trace.steps, [miss,first]=rows.slice(11,13);
  for (const r of rows) {
    assert.equal(r.guard.admitted,true);
    assert.equal(r.family,'public_occurrence_recall');
    assert.equal(r.kind,'rooted_line');
    assert.equal(sha(r.pre),r.seal);
    if(r.beforeChoice) {
      assert.equal(sha(r.beforeChoice.data),r.beforeChoice.seal);
      assert.equal(r.beforeChoice.data.ref,r.pre.ref);
      assert.equal(r.beforeChoice.data.layout,r.pre.layout);
    }
  }
  assert.deepEqual(rows.slice(0,4).map(r=>r.pre.model),Array(4).fill('calibrate'));
  assert.deepEqual(rows.slice(4,11).map(r=>r.returned.matched),Array(7).fill(true));
  assert.equal(miss.ticket.command,'ACTION2');
  assert.equal(miss.pre.model,'conditional_composition');
  assert.equal(miss.returned.matched,false);
  assert.equal(miss.returned.seal,true);
  const facts=first.beforeChoice.data, [w]=facts.evidence;
  assert.equal(facts.evidence.length,1);
  assert.deepEqual(w.expected,miss.pre.expected);
  assert.deepEqual(w.observed,miss.returned.physical);
  assert.deepEqual(w.observed.root,w.expected.root);
  assert.equal(w.observed.tip,w.expected.tip);
  assert.equal(w.chain,true);
  assert.equal(w.before,miss.pre.ref);
  assert.equal(w.after,miss.returned.ref);
  assert.equal(w.layout,first.pre.layout);
  assert.deepEqual(facts.previous.evidence,[w.before,w.after]);
  assert.equal(facts.previous.status,'admitted');
  assert.equal(facts.previous.id,first.pre.need);
  assert.deepEqual(first.pre.evidence,facts.previous.evidence);
  assert.deepEqual(first.pre.operations,['OP03','OP12','OP08','OP26']);
  assert.equal(first.pre.bundle,'OP18');
  const controls=facts.controls;
  for(const [key,translation,extent] of [['ACTION1',-6,0],['ACTION2',6,0],['ACTION3',0,-6],['ACTION4',0,6]]) {
    assert.deepEqual(controls[key].translation,[translation,0]);
    assert.equal(controls[key].extent,extent);
    assert.ok(controls[key].refs.every(ref=>rows.slice(0,4).some(r=>ref===r.pre.ref || ref===r.returned.ref)));
  }
  for(const r of rows.slice(12,-1)) {
    assert.equal(r.pre.model,'cell_push_revision');
    assert.equal(r.ticket.index,0);
    assert.equal(r.returned.matched,true);
    assert.deepEqual(r.pre.expected,r.returned.physical);
    assert.deepEqual(r.returned.need,{id:first.pre.need,status:'assigned'});
  }
  assert.equal(rows.at(-1).returned.matched,null);
  assert.deepEqual(rows.at(-1).returned.need,{id:first.pre.need,status:'satisfied'});
}
function checkCounterfactuals(c) {
  assert.notEqual(c.original.ref,c.ui.ref);
  assert.equal(c.ui.matched,true);
  assert.equal(c.ui.counterexamples,0);
  assert.equal(c.ui.need,null);
  assert.equal(c.wrongChain.matched,false);
  assert.equal(c.wrongChain.counterexamples,1);
  assert.equal(c.wrongChain.chain,null);
  assert.equal(c.wrongChain.need,null);
  for(const r of [c.wrongOutcome,c.wrongScope,c.secondFailure.next]){
    assert.equal(r.reason,'conditional_contact_model_refuted');
    assert.equal(r.blocks,true);
    assert.deepEqual(r.actions,[]);
  }
  assert.equal(c.secondFailure.matched,false);
  assert.equal(c.secondFailure.refutations,2);
  assert.equal(c.secondFailure.retained.id,c.actual.need);
  assert.equal(c.secondFailure.retained.status,'refuted');
  assert.equal(c.secondFailure.retained.outcomeRef,c.secondFailure.after);
  assert.equal(c.noAccess.reason,'rooted_cell_access_unresolved');
  assert.deepEqual(c.noAccess.agenda,actionOrder.map(id=>[id,'no_plan']));
  assert.equal(c.noAccess.need,'open');
  assert.ok(c.noAccess.visited>0);
  assert.deepEqual(c.shadow.agenda,actionOrder.map(id=>[id,'shadow']));
  assert.equal(c.shadow.visited,0);
  for(const stop of [c.noAccess,c.shadow]) {assert.equal(stop.release,false);assert.deepEqual(stop.actions,[]);}
  assert.deepEqual(c.fallback.agenda,[[actionOrder[1],'no_plan'],[actionOrder[0],'selected']]);
  assert.deepEqual(c.fallback.actions,['ACTION3']);
}
try {
  const runs={};
  for(const name of cases) runs[name]=await execute(name,root);
  const counter=await counterfactuals();
  checkCounterfactuals(counter);
  const initial=runs.historique.steps,alternate=runs.reposition.steps,color=runs.palette.steps;
  checkPath(runs.historique,19);
  checkPath(runs.reposition,21);
  checkPath(runs.palette,19);
  assert.equal(initial[12].ticket.command,'ACTION3');
  assert.equal(initial[12].pre.strategy,actionOrder[0]);
  assert.equal(initial[12].pre.distance,7);
  assert.equal(initial[12].pre.visited,64);
  assert.deepEqual(initial[11].pre.expected.pieces,[['material:14',[42,33,45,36]],['material:8',[42,25,45,28]],['material:9',[42,29,45,32]]]);
  assert.deepEqual(initial[11].returned.physical.pieces,[['material:14',[42,37,45,40]],['material:8',[42,25,45,28]],['material:9',[42,31,45,34]]]);
  for(const [i,p] of counter.publicPrefix.entries()){
    const ref = i ? initial[i-1].returned.ref : initial[0].pre.ref;
    assert.equal(p.ref,ref);
    if(i) assert.equal(initial[i-1].ticket.command,p.cmd);
  }
  assert.equal(counter.actual.need,initial[12].pre.need);
  assert.equal(sha(initial.slice(0,12)),sha(alternate.slice(0,12)));
  assert.deepEqual(initial[12].beforeChoice,alternate[12].beforeChoice);
  assert.equal(alternate[12].pre.strategy,actionOrder[1]);
  assert.equal(alternate[12].ticket.command,'ACTION1');
  assert.equal(alternate[12].pre.distance,9);
  assert.equal(alternate[12].pre.visited,78);
  assert.notDeepEqual(initial[12].pre.expected,alternate[12].pre.expected);
  assert.equal(alternate[13].pre.strategy,actionOrder[0]);
  assert.deepEqual(alternate[13].pre.agenda,[[actionOrder[1],'skipped'],[actionOrder[0],'selected']]);
  assert.notDeepEqual(initial[13].pre.physical,alternate[13].pre.physical);
  assert.deepEqual(color.map(x=>x.ticket.command),initial.map(x=>x.ticket.command));
  assert.deepEqual(initial[12].pre.order,['8','14','9']);
  assert.deepEqual(color[12].pre.order,['14','8','9']);
  assert.notEqual(color[12].pre.layout,initial[12].pre.layout);
  assert.notEqual(color[12].pre.need,initial[12].pre.need);
  for(const name of ['borne','shadow']) {
    assert.equal(sha(runs[name].steps),sha(initial.slice(0,12)));
    assert.equal(runs[name].stop.kind,'stopped');
    assert.deepEqual(runs[name].stop.beforeChoice,initial[12].beforeChoice);
  }
  assert.equal(runs.borne.stop.reason,counter.noAccess.reason);
  assert.equal(runs.shadow.stop.reason,counter.shadow.reason);
  const foreign=runs['chaine-etrangere'];
  assert.equal(sha(foreign.steps.slice(0,11)),sha(initial.slice(0,11)));
  assert.deepEqual(foreign.steps[11].pre,initial[11].pre);
  assert.equal(foreign.steps[11].returned.ref,counter.wrongChain.ref);
  assert.equal(foreign.steps[11].returned.matched,false);
  assert.equal(foreign.steps.length,12);
  assert.equal(foreign.stop.reason,'frontier_unknown');
  assert.equal(foreign.stop.beforeChoice.data.evidence[0].chain,null);
  assert.equal(foreign.stop.beforeChoice.data.previous,null);
  const parity={};
  for(const [label,ref] of [['historique',historique],['gel',gel]]) {
    await pinned(ref,async engine=>{
      parity[label]={};
      for(const name of label==='historique'?['historique']:cases) {
        const recorded=await execute(name,engine);
        assert.equal(sha(recorded),sha(runs[name]),label+' / '+name);
        parity[label][name]=sha(recorded);
      }
      if(label==='gel') assert.deepEqual(await counterfactuals(engine),counter);
    });
  }
  const detail=rows=>({retours:rows.slice(11).map(compact),faits13:rows[12].beforeChoice,projection13:rows[12].pre.expected});
  const report={gel,historique,candidat:run('git',['rev-parse','HEAD']).trim(),empreintes:parity,
    nominal:detail(initial),prioriteInverse:detail(alternate),permutation:detail(color),controles:counter,
    sansTrajet:runs.borne.stop.reason,shadow:runs.shadow.stop.reason,chaineEtrangere:{local:counter.wrongOutcome.reason,
      global:foreign.stop.reason,avantChoix:foreign.stop.beforeChoice.seal}};
  if(values.recu) await writeFile(values.recu,JSON.stringify(report,null,2)+'\n');
  console.log('SK48/96 · projection contredite au geste 12. ACTION3 au 13, niveau terminé au 19.');
  console.log('Priorité inversée : ACTION1 au 13, niveau terminé au 21. Couleurs permutées : besoin distinct, niveau terminé au 19.');
  console.log('Preuve étrangère, témoin physique insuffisant, deuxième réfutation, borne et shadow qualifiés. Parité vérifiée avec le gel.');
} finally {await rm(tmp,{recursive:true,force:true});}
