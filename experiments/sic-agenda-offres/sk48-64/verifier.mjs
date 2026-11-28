import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {digest} from './operateur.mjs';
import {git,versions,withEngine} from '../moteur-reference.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'}}});
const vendor=resolve(values.pyodide),worker=fileURLToPath(new URL('operateur.mjs',import.meta.url));
const tmp=await mkdtemp(join(tmpdir(),'sk48-64-')),out=join(tmp,'prefixe.json');
const order=['ACTION1','ACTION4','ACTION3','ACTION2'];
function ticket(s,command,kind){
  assert.deepEqual([s.issued.family,s.issued.entry,s.issued.kind,s.issued.command,s.issued.plan.kind,s.issued.admitted],
    ['public_occurrence_recall','observed_composition_services','rooted_line',command,kind,true]);
  assert.equal(s.issued.guard,'current_rooted_reference_and_projection');
  assert.equal(s.after.need,null);
}
function physical(run,n){
  return run.steps.slice(0,n).map(s=>[s.issued.command,s.after.packet]);
}
function cleanState(s){
  assert.equal(s.issued.cut.pre.state.recovery,null);
  assert.equal(s.issued.cut.pre.state.refuted,0);
  assert.equal(s.issued.plan.search?.sic_decision??null,null);
}
try{
  const matrix={historique:['nominal'],gel:['nominal','priorite','stationnaire','sans-effet','palette'],stations:['nominal','palette']},runs={};
  for(const [v,arms]of Object.entries(matrix)){
    runs[v]={};
    await withEngine(v,async engine=>{
      for(const arm of arms){
        execFileSync(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',arm,'--recu',out],
          {stdio:['ignore','ignore','inherit']});
        const run=JSON.parse(await readFile(out,'utf8'));
        for(const cut of [...run.steps.map(s=>s.issued.cut),run.next?.cut,run.lastCut].filter(Boolean))
          assert.equal(digest(cut.pre),cut.seal);
        runs[v][arm]=run;
      }
    });
  }
  const {historique:h,gel:g,stations:c}=runs;
  assert.deepEqual(h.nominal,g.nominal);
  const [t1,t2,t3,t4,t5]=g.nominal.steps;
  assert.equal(g.nominal.steps.length,5);
  assert.deepEqual(t1.issued.cut.pre.physical.root,[11,36,16,41]);
  assert.equal(t1.issued.cut.pre.physical.tip,22);
  assert.deepEqual(t1.issued.cut.pre.order,['8','14','9']);
  assert.deepEqual(t1.issued.cut.pre.pending,order);
  assert.deepEqual(t1.issued.cut.pre.state.controls,{});
  for(const [i,s] of g.nominal.steps.slice(0,4).entries()){
    ticket(s,order[i],'calibrate');
    cleanState(s);
    assert.equal(s.issued.plan.expected,null);
    assert.deepEqual([s.after.matched,s.after.seal],[null,true]);
    const event=s.after.record;
    assert.equal(event.detail.after,s.after.ref);
    assert.deepEqual(event.state.controls[order[i]].evidence,[s.issued.ref,s.after.ref]);
  }
  const t1Effect=t1.after.record.state.controls.ACTION1;
  assert.deepEqual(t1Effect.translation,[-6,0]);
  assert.equal(t1Effect.extent,0);
  assert.deepEqual(t2.issued.cut.pre.state.controls.ACTION1,t1Effect);
  assert.deepEqual(t2.issued.cut.pre.pending,order.slice(1));

  const alternative=g.priorite.steps;
  ticket(alternative[0],'ACTION4','calibrate');
  ticket(alternative[1],'ACTION1','calibrate');
  const {priority,pending,...same}=alternative[0].issued.cut.pre;
  const {priority:baselinePriority,pending:baselinePending,...baseline}=t1.issued.cut.pre;
  assert.deepEqual(same,baseline);
  assert.deepEqual(priority,['ACTION4','ACTION1','ACTION3','ACTION2']);
  assert.deepEqual(priority,pending);
  assert.deepEqual(baselinePriority,baselinePending);
  assert.deepEqual(alternative[0].after.record.detail.observed_effect,{root_translation:[0,0],extent_delta:6});

  const stationary=g.stationnaire,still=stationary.steps[0];
  assert.deepEqual(still.issued,t1.issued);
  assert.equal(still.after.packet,t1.after.packet);
  assert.notEqual(still.after.normalized,still.after.source);
  assert.deepEqual(still.after.record.state.controls,{});
  assert.deepEqual(still.after.record.state.tried,['ACTION1']);
  assert.equal(stationary.next.command,'ACTION4');
  assert.ok(!stationary.next.cut.pre.pending.includes('ACTION1'));

  assert.deepEqual(t5.issued.cut.pre.state.tried,order);
  assert.deepEqual(t5.issued.cut.pre.state.controls,t4.after.record.state.controls);
  assert.deepEqual(t5.issued.cut.pre.pending,[]);
  ticket(t5,'ACTION1','conditional_composition');
  cleanState(t5);
  assert.equal(t5.issued.plan.search.nodes,282);
  assert.equal(t5.issued.plan.commands.length,11);
  assert.equal(t5.after.matched,true);

  const missing=g['sans-effet'],loss=missing.lastCut;
  assert.deepEqual(missing.steps,g.nominal.steps.slice(0,4));
  assert.equal(missing.stop,'frontier_unknown');
  assert.equal(loss.offer.reason,'rooted_control_effect_unresolved');
  assert.equal(loss.offer.blocks,true);
  assert.deepEqual(loss.pre.state.tried,order);
  assert.deepEqual(loss.pre.pending,[]);
  assert.deepEqual(loss.removed,t1Effect);
  assert.deepEqual({...loss.pre,state:{...loss.pre.state,controls:{...loss.pre.state.controls,ACTION1:t1Effect}}},t5.issued.cut.pre);

  const reversed=g.palette,corrected=c.palette,next=corrected.steps[4];
  assert.equal(reversed.steps.length,4);
  assert.deepEqual(physical(reversed,4),physical(g.nominal,4));
  assert.deepEqual(corrected.steps.slice(0,4),reversed.steps);
  assert.equal(reversed.lastCut.offer.reason,'rooted_contact_plan_unresolved');
  assert.equal(reversed.lastCut.pre.declaredLimit,12);
  assert.equal(reversed.lastCut.offer.search.nodes,792);
  assert.deepEqual(reversed.lastCut.offer.search.bounds,['bound.max_depth']);
  assert.equal(reversed.lastCut.offer.blocks,true);
  assert.equal(reversed.stop,'frontier_unknown');
  ticket(next,'ACTION1','conditional_composition');
  cleanState(next);
  assert.deepEqual(next.issued.cut.pre,reversed.lastCut.pre);
  assert.deepEqual(next.issued.cut.pre.order,['8','9','14']);
  assert.equal(next.issued.plan.search.nodes,282);
  assert.equal(next.issued.plan.search.projected_order_trial.status,'compatible_unordered');
  assert.equal(next.after.matched,true);
  assert.deepEqual(physical(c.nominal,5),physical(g.nominal,5));
  assert.deepEqual(c.nominal.steps.slice(0,4),g.nominal.steps.slice(0,4));
  assert.equal(git('rev-parse','HEAD:src'),git('rev-parse','d0e7527c:src'));

  const receipt={versions:{...versions,qualification:git('rev-parse','HEAD'),attendus:git('rev-parse','40774688')},
    t1,t2,priorite:alternative,stationnaire:stationary,premierPlan:t5,sansEffet:{stop:missing.stop,cut:loss},
    permutation:{gel:reversed.lastCut,stations:next},prefixes:8};
  if(values.recu)await writeFile(values.recu,JSON.stringify(receipt,null,2)+'\n');
  console.log('SK48 64 · huit préfixes. Calibrage, refus par effet manquant, plan initial et permutation vérifiés avant 96.');
}finally{await rm(tmp,{recursive:true,force:true});}
