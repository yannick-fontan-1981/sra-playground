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
const tmp=await mkdtemp(join(tmpdir(),'tu93-39-')),out=join(tmp,'rejeu.json');
const variants=['nominal','sans-action4','retrait-offre','stationnaire','preuve-etrangere'];
const graph='alternating_graph_access';
function ticket(s,command,index){
  assert.deepEqual([s.pre.family,s.pre.entry,s.pre.type,s.pre.command,s.pre.index,s.pre.admitted],
    ['public_occurrence_recall','alternating_graph_composition',graph,command,index,true]);
  assert.equal(s.pre.guard,'current_graph_actor_and_command_bound');
}
async function replay(version,modes){
  const runs={};
  await withEngine(version,async engine=>{
    for(const mode of modes){
      execFileSync(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',mode,'--recu',out],
        {stdio:['ignore','ignore','inherit']});
      const run=JSON.parse(await readFile(out,'utf8'));
      for(const cut of [...run.steps.map(s=>s.pre.cut),run.next?.cut,run.lastCut].filter(Boolean))
        assert.equal(cut.seal,digest(cut.fact));
      runs[mode]=run;
    }
  });
  return runs;
}
try{
  const h=await replay('historique',['nominal']),g=await replay('gel',variants);
  assert.deepEqual(h.nominal,g.nominal);
  const n=g.nominal.steps,a=n[14],b=n[15],plan=a.pre.plan,m=plan.measurement;
  assert.equal(n.length,16);
  assert.equal(g.nominal.stop,'session_action_budget');
  assert.deepEqual(n.slice(0,14).map(s=>s.pre.family),Array(14).fill('observed_frontier'));
  for(const v of variants.slice(1))assert.deepEqual(g[v].steps.slice(0,14),n.slice(0,14));
  ticket(a,'ACTION4',0);
  ticket(b,'ACTION2',1);
  assert.deepEqual(plan.actor,{bbox:[15,15,17,17],size:3,histogram:[[4,1],[9,8]]});
  assert.deepEqual(plan.steps,[
    {action_ref:'ACTION4',from:[15,15],to:[15,21],destination_histogram:[[0,9]],ordinary_support:true},
    {action_ref:'ACTION2',from:[15,21],to:[21,21],destination_histogram:[[0,9]],ordinary_support:true},
  ]);
  assert.equal(a.pre.cut.fact.remaining,2);
  assert.equal(m.alternating_material_measurement_frame_ref,a.pre.ref);
  assert.equal(m.unique_alternating_material_graph_description_present,true);
  assert.equal(m.translated_overlay_matches_alternating_pitch_and_edge,true);
  assert.equal(m.alternating_material_first_shortest_edge_count,18);
  assert.equal(m.alternating_material_graph_node_count,31);
  assert.equal(m.alternating_material_graph_edge_count,32);
  assert.deepEqual(m.alternating_material_first_shortest_action_refs.slice(0,2),['ACTION4','ACTION2']);
  assert.equal(plan.instrumental,null);
  assert.deepEqual(a.pre.refs,[a.pre.ref,...plan.evidence]);
  const acquisition=a.pre.cut.fact.samples.filter(s=>s.signature===plan.signature&&s.action==='ACTION4');
  assert.equal(acquisition.length,1);
  assert.deepEqual(acquisition[0].delta,[0,6]);
  assert.deepEqual(acquisition[0].evidence,[n[3].pre.ref,n[3].after.ref]);
  for(const s of [a,b])assert.deepEqual([s.after.matched,s.after.reason,s.after.levels],[true,'conditional_graph_displacement',0]);
  assert.equal(a.after.seal,false);
  assert.deepEqual(b.after.record.last.delta,[6,0]);
  assert.deepEqual(b.after.record.last.evidence,[a.after.ref,b.after.ref]);

  const l=g['sans-action4'].steps,loss=l[14].pre.cut;
  assert.deepEqual(loss.removed,acquisition);
  assert.deepEqual(loss.fact.actors,a.pre.cut.fact.actors);
  assert.deepEqual(loss.fact.samples,a.pre.cut.fact.samples.filter(s=>!acquisition.includes(s)));
  assert.deepEqual(loss.authored,{status:'abstained',reason:'graph_access_absent_or_ambiguous',blocking:false});
  assert.deepEqual([l[14].pre.family,l[14].pre.command],['observed_frontier','ACTION3']);
  ticket(l[15],'ACTION4',0);
  assert.equal(l[15].after.matched,true);

  const w=g['retrait-offre'].steps,t=w[14],withdrawn=t.pre.cut;
  assert.deepEqual(withdrawn.fact,a.pre.cut.fact);
  assert.deepEqual(withdrawn.proposed,a.pre.cut.proposed);
  assert.deepEqual(withdrawn.authored,{status:'abstained',reason:'withdrawn_in_qualification',blocking:false});
  assert.deepEqual([t.pre.family,t.pre.command],['observed_frontier','ACTION3']);
  ticket(w[15],'ACTION4',0);
  assert.deepEqual(w.slice(14).map(s=>s.after.packet),l.slice(14).map(s=>s.after.packet));

  const foreign=g['preuve-etrangere'].steps,f=foreign[14].pre.cut;
  assert.notEqual(f.added.signature,plan.signature);
  assert.deepEqual(f.added.delta,[0,-6]);
  assert.deepEqual(f.proposed,a.pre.cut.proposed);
  assert.deepEqual(f.authored,a.pre.cut.authored);
  assert.deepEqual({...foreign[14],pre:{...foreign[14].pre,cut:a.pre.cut}},a);
  assert.deepEqual(foreign[15],b);

  const s=g.stationnaire,st=s.steps[14];
  assert.equal(s.steps.length,15);
  assert.deepEqual(st.pre,a.pre);
  assert.equal(st.after.packet,a.after.packet);
  assert.notEqual(st.after.shown,st.after.physical);
  assert.deepEqual([st.after.matched,st.after.seal,st.after.reason],[false,true,'graph_displacement_or_extra_effect_diverged']);
  assert.deepEqual(st.after.record.refused,[plan.trial]);
  assert.deepEqual(s.next.cut.fact.refused,[plan.trial]);
  assert.deepEqual([s.next.family,s.next.command,s.next.index],['observed_frontier','ACTION3',0]);

  const receipt={versions:{...versions,qualification:git('rev-parse','HEAD'),attendus:git('rev-parse','f27f6439')},
    prefixes:6,nominal:[a,b],suppression:l.slice(14),retrait:w.slice(14),stationnaire:{t15:st,next:s.next},etranger:f.added,
    acquisition,parite:digest(n)};
  if(values.recu)await writeFile(values.recu,JSON.stringify(receipt,null,2)+'\n');
  console.log('TU93 39 · six préfixes. Route alternée, échantillon décisif, retour contraire et poursuite vérifiés.');
}finally{await rm(tmp,{recursive:true,force:true});}
