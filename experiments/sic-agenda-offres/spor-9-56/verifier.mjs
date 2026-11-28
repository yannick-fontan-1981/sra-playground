import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { digest } from './operateur.mjs';
import { git,versions,withEngine } from '../moteur-reference.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'}}});
const vendor=resolve(values.pyodide);
const compartment='contextual_compartments',question='contextual_compartment_question',recall='public_occurrence_recall',entry='observed_occurrence_recall';
const variants={nominal:16,'sans-offre-9':5,'sans-acquis-9':5,'retour-9':3,'sans-enclos-56':4};
const click=(x,y)=>['ACTION6',{x,y}];
function ticket(s,[family,type,action]){
  assert.deepEqual([s.pre.family,s.pre.type,s.pre.command,s.pre.admitted],[family,type,action,true]);
}
function recap(s){
  const {ref,level,ticket,family,type,entry,command,refs,guard}=s.pre;
  const {packet,levels,matched,seal,reason}=s.after;
  return {geste:s.i,ref,level,ticket,family,type,entry,command,refs,guard,return:{packet,levels,matched,seal,reason}};
}
function check9(g){
  const n=g.nominal.steps,[a,b]=n;
  ticket(a,[compartment,question,click(44,50)]);
  assert.equal(a.pre.guard,'current_compartment_occurrences_and_context');
  assert.equal(a.pre.cut9.pre.fact.frames.length,11);
  assert.deepEqual(a.pre.cut9.pre.fact.frames.filter(f=>f.border===a.pre.cut9.pre.fact.mark).map(f=>[f.box,f.filled,f.closed]),
    [[[43,44,46,57],24,true]]);
  assert.deepEqual(a.pre.compartment.control.box,[43,44,46,57]);
  assert.equal(a.pre.compartment.expected,null);
  assert.deepEqual(a.pre.refs,[a.pre.ref]);
  const r=a.after.compartment;
  assert.equal(r.events[0].kind,'contextual_compartment_response');
  assert.equal(r.events[0].after,a.after.ref);
  assert.equal(r.events[0].local_changed,true);
  assert.deepEqual(r.dependencies,[[[43,44,46,57],[]]]);
  assert.deepEqual(r.attempted,[a.pre.compartment.key]);
  assert.deepEqual([a.after.matched,a.after.seal,a.after.reason],[null,true,'unknown_compartment_response']);
  ticket(b,[compartment,question,click(53,30)]);
  assert.deepEqual(b.pre.compartment.control.box,[50,23,57,37]);
  assert.deepEqual(b.pre.cut9.pre.fact.refs,[a.after.ref]);
  assert.deepEqual(b.pre.refs,[a.after.ref,a.after.ref]);
  const still=g['retour-9'],s=still.steps[0];
  assert.equal(still.steps.length,1);
  assert.deepEqual(s.pre,a.pre);
  assert.equal(s.after.packet,a.after.packet);
  assert.notEqual(s.after.shown,s.after.physical);
  assert.equal(s.after.compartment.events[0].local_changed,false);
  assert.deepEqual(s.after.compartment.attempted,[a.pre.compartment.key]);
  assert.equal(still.next.family,'observed_frontier');
  assert.deepEqual(still.next.command,['ACTION5',{}]);
  assert.equal(still.next.cut9.nominal,null);
  const withdrawn=g['sans-offre-9'].steps;
  assert.deepEqual(withdrawn[0].pre.cut9,a.pre.cut9);
  ticket(withdrawn[0],['observed_frontier','experiment',['ACTION5',{}]]);
  ticket(withdrawn[1],[compartment,question,click(44,50)]);
  assert.deepEqual(n[9].pre.compartment.dependencies.filter(v=>v.receivers.length),
    [{control:[16,48,23,57],receivers:[[25,20,28,37]]}]);
  assert.deepEqual(n[9].pre.compartment.control.box,[25,20,28,37]);
  return {temoin:a,reprise:b,stationnaire:still,retrait:withdrawn.slice(0,2),receveur:[n[8],n[9]].map(recap)};
}
function check56(g){
  const n=g.nominal.steps,t=n[2],p=t.pre.recall,cut=t.pre.cut56.pre.fact;
  ticket(t,[recall,recall,click(34,7)]);
  assert.equal(t.pre.entry,entry);
  assert.equal(t.pre.guard,'public_occurrence_bound');
  assert.equal(p.reason,'test_observed_enclosing_emphasis');
  assert.equal(p.context,null);
  assert.equal(cut.prior,null);
  assert.equal(cut.calibration,null);
  assert.deepEqual(cut.seen,[]);
  assert.deepEqual(cut.models,[]);
  assert.deepEqual(p.predictions,[]);
  assert.deepEqual(p.support,[]);
  assert.equal(p.source.occurrences.length,1);
  assert.deepEqual(p.selected,p.source.occurrences[0]);
  assert.deepEqual(p.selected.bbox,[20,6,49,8]);
  assert.equal(p.selected.marked,true);
  assert.deepEqual(p.source.calibration.outline_extent,[42,5]);
  assert.deepEqual(p.source.calibration.evidence,[t.pre.ref]);
  assert.deepEqual(t.pre.refs,[t.pre.ref]);
  assert.equal(t.after.recall[0].kind,'occurrence_recall_transition');
  assert.equal(t.after.recall[0].mode,'unknown_or_no_effect');
  assert.deepEqual(t.after.recall[0].evidence,[t.pre.ref,t.after.ref]);
  assert.deepEqual([t.after.matched,t.after.seal,t.after.levels],[null,true,0]);

  const noAcq=g['sans-acquis-9'].steps;
  assert.equal(noAcq[0].after.compartment,null);
  assert.deepEqual(noAcq[1].pre.cut9.pre.fact.refs,[]);
  assert.deepEqual(noAcq[1].pre.refs,[n[1].pre.ref]);
  assert.deepEqual(noAcq.slice(0,3).map(s=>[s.pre.command,s.after.packet]),n.slice(0,3).map(s=>[s.pre.command,s.after.packet]));
  assert.deepEqual(noAcq[2].pre.cut56,t.pre.cut56);
  assert.deepEqual(noAcq[2].pre.recall,t.pre.recall);

  const noMark=g['sans-enclos-56'].steps;
  assert.deepEqual(noMark[0],n[0]);
  assert.deepEqual(noMark[1].pre,n[1].pre);
  assert.equal(noMark[1].after.packet,n[1].after.packet);
  assert.notEqual(noMark[1].after.physical,noMark[1].after.shown);
  assert.deepEqual(noMark[1].after.removed,{point:[19,6],value:3,background:5,box:[19,5,60,9],body:p.selected.bbox});
  assert.equal(noMark[2].pre.cut56.pre.fact.candidates,null);
  assert.equal(noMark[2].pre.cut56.reason,null);
  ticket(noMark[2],[compartment,question,click(55,29)]);
  ticket(noMark[3],[recall,recall,click(32,7)]);
  assert.equal(noMark[3].pre.recall.reason,'test_observed_enclosing_emphasis');
  return {temoin:t,sansAcquis:noAcq.slice(0,3).map(recap),sansEnclos:noMark.slice(1).map(s=>({ticket:recap(s),removed:s.after.removed,cut:s.pre.cut56}))};
}
const tmp=await mkdtemp(join(tmpdir(),'spor-9-56-')),out=join(tmp,'rejeu.json'),worker=fileURLToPath(new URL('operateur.mjs',import.meta.url));
try{
  const runs={};
  for(const version of ['historique','gel','candidat']){
    runs[version]={};
    await withEngine(version,async engine=>{
      for(const [variant,turns]of Object.entries(variants)){
        if(version!=='gel'&&variant!=='nominal')continue;
        execFileSync(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',variant,'--gestes',String(turns),'--recu',out],
          {stdio:['ignore','ignore','inherit']});
        const run=JSON.parse(await readFile(out,'utf8'));
        for(const s of run.steps)for(const cut of [s.pre.cut9?.pre,s.pre.cut56?.pre].filter(Boolean))
          assert.equal(digest(cut.fact),cut.digest);
        runs[version][variant]=run;
      }
    });
  }
  const {historique:h,gel:g,candidat:c}=runs;
  assert.deepEqual(h.nominal,g.nominal);
  assert.deepEqual(g.nominal,c.nominal);
  const nominal=g.nominal.steps;
  assert.equal(nominal.length,16);
  assert.equal(g.nominal.stop,'session_action_budget');
  assert.equal(nominal.at(-1).after.levels,1);
  assert.equal(nominal.filter(s=>s.pre.type===question).length,15);
  assert.deepEqual(nominal.filter(s=>s.pre.entry===entry).map(s=>s.i),[3]);
  const receipt={versions:{...versions,qualification:git('rev-parse','HEAD'),attendus:git('rev-parse','a472c396')},
    ligne9:check9(g),ligne56:check56(g),spor:{tours:nominal.map(recap),compartiment:15,rappel:1,coupure:g.nominal.stop},
    parite:digest(g.nominal)};
  if(values.recu)await writeFile(values.recu,JSON.stringify(receipt,null,2)+'\n');
  console.log('SPOR · sept préfixes. 9 : compartiment, retour, retrait et reprise. 56 : enclos courant requis au T3, reçu de compartiment dispensable.');
}finally{await rm(tmp,{recursive:true,force:true});}
