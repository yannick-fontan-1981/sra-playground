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
const tmp=await mkdtemp(join(tmpdir(),'catr-42-')),out=join(tmp,'prefixe.json');
const click=(x,y)=>['ACTION6',{x,y}];
function ticket(s,x,y,index){
  assert.deepEqual([s.issued.family,s.issued.entry,s.issued.type,s.issued.command,s.issued.index,s.issued.guard],
    ['public_occurrence_recall','observed_composition_services','chamber_relations',click(x,y),index,
      {admitted:true,reason:'current_relation_control_bound'}]);
}
async function replay(version,modes){
  const runs={};
  await withEngine(version,async engine=>{
    for(const v of modes){
      execFileSync(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',v,'--recu',out],
        {stdio:['ignore','ignore','inherit']});
      const run=JSON.parse(await readFile(out,'utf8'));
      for(const cut of [...run.steps.map(s=>s.issued.cut),run.next?.cut].filter(Boolean))
        assert.equal(cut.seal,digest(cut.pre));
      runs[v]=run;
    }
  });
  return runs;
}
try{
  const h=await replay('historique',['nominal']),g=await replay('gel',['nominal','sans-offre','contradiction','stationnaire']);
  assert.deepEqual(h.nominal,g.nominal);
  const n=g.nominal.steps,[a,b,c]=n,first=a.issued,cut=first.cut.pre,plan=first.plan,e=plan.edits[0];
  assert.equal(n.length,4);
  ticket(a,31,47,0);
  assert.equal(cut.layout.axes.length,8);
  assert.equal(cut.layout.controls.length,4);
  assert.equal(cut.layout.axes.filter(x=>x.target!==null).length,6);
  assert.deepEqual(cut.memory.evidence,[first.ref]);
  assert.deepEqual(first.refs,[first.ref]);
  assert.deepEqual(cut.memory.edges,{});
  assert.deepEqual([cut.domain.count,cut.domain.enumerated,cut.domain.checks,cut.domain.complete,cut.domain.bounded],[1,16,35,true,false]);
  assert.deepEqual(cut.domain.offers,[plan.candidate]);
  assert.deepEqual(plan.candidate.changes,['relation:9:12','relation:6:9','relation:11:12']);
  assert.equal(plan.kind,'relation_experiment');
  assert.deepEqual([e.id,e.old,e.new,e.known,e.point],['relation:9:12','12','10',false,[31,47]]);
  assert.equal(first.envelope.expected.level_epoch,1);
  assert.equal(first.envelope.expected.levels_completed,0);
  assert.deepEqual(first.envelope.point,[[31,47],12]);
  assert.deepEqual(first.envelope.real,first.guard);
  assert.deepEqual(first.envelope.foreign,{admitted:false,reason:'relation_binding_changed'});
  assert.deepEqual([a.after.matched,a.after.reason],[true,'observed_relation_projection']);
  assert.equal(a.after.record.detail.prediction_matched,true);
  assert.deepEqual(a.after.record.detail.changed_controls,[e.id]);
  const acquisition={evidence:[first.ref,a.after.ref],status:'observed_edit_under_current_binding'};
  assert.deepEqual(a.after.record.memory.edges[e.edge],acquisition);
  ticket(b,27,51,0);
  ticket(c,35,51,1);
  assert.deepEqual(b.issued.cut.pre.memory.edges[e.edge],acquisition);
  assert.equal(b.issued.plan.kind,'conditional_relation_contribution');
  assert.deepEqual(b.issued.plan.edits.map(edit=>edit.known),[true,true]);
  assert.deepEqual([b.after.matched,b.after.seal,c.after.matched,c.after.seal,c.after.levels],[true,false,null,true,1]);

  const held=g.stationnaire,st=held.steps[0];
  assert.equal(held.steps.length,1);
  assert.deepEqual(st.issued,first);
  assert.equal(st.after.packet,a.after.packet);
  assert.notEqual(st.after.shown,st.after.physical);
  assert.deepEqual([st.after.matched,st.after.seal],[false,true]);
  assert.deepEqual(st.after.record.detail.edit_contradiction,{changed:[],expected:e.id});
  assert.deepEqual(st.after.record.memory.edges,{});
  assert.deepEqual(st.after.record.memory.failed,[e.trial]);
  assert.deepEqual(held.next.command,click(27,51));
  assert.equal(held.next.plan.kind,'relation_experiment');
  assert.equal(held.next.plan.edits[0].known,false);

  const [fallback,resume]=g['sans-offre'].steps;
  assert.deepEqual(fallback.issued.cut,first.cut);
  assert.deepEqual(fallback.issued.disposition,{raw:'proposed',blocked:false,offered:null,contradictory:null});
  assert.deepEqual([fallback.issued.family,fallback.issued.type,fallback.issued.command],
    ['animated_contact','measured_animated_contact',click(31,51)]);
  ticket(resume,31,47,0);
  assert.equal(resume.after.matched,true);

  const conflict=g.contradiction;
  assert.equal(conflict.steps.length,0);
  assert.equal(conflict.stop,'frontier_unknown');
  assert.equal(conflict.last.rawReason,'shared_relation_rows_contradicted');
  assert.equal(conflict.last.blocked,true);
  const witness=conflict.last.contradictory,axis=cut.layout.axes.find(v=>v.id===witness.axis);
  assert.equal(witness.observation,first.ref);
  assert.equal(witness.context,axis.context);
  assert.equal(witness.observed,axis.value);
  assert.notEqual(witness.observed,witness.value);
  assert.equal(git('rev-parse','HEAD:src'),git('rev-parse','d0e7527c:src'));

  const receipt={versions:{...versions,qualification:git('rev-parse','HEAD'),attendus:git('rev-parse','44fa72aa')},
    prefixes:5,nominal:[a,b,c],retrait:[fallback,resume],contradiction:conflict,stationnaire:held,
    garde:{envelope:first.envelope,spatial:cut.layout.id},parite:digest(n)};
  if(values.recu)await writeFile(values.recu,JSON.stringify(receipt,null,2)+'\n');
  console.log('CATR 42 · cinq préfixes, relation consommée, refus local et retour de la chambre vérifiés.');
}finally{await rm(tmp,{recursive:true,force:true});}
