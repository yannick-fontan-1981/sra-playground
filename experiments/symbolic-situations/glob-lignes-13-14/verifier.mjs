import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','48aae7fc05ed8d8409b1aa3a05efa4fa9c65c06d'];
const json=name=>JSON.parse(readFileSync(join(dir,name)));
const runs=shas.map(sha=>Object.assign({},...['décisions','placement','réserve'].map(group=>{
  const input=json(sha.slice(0,8)+'.'+group+'.json');
  assert.equal(input.sha,sha);assert.equal(input.group,group);
  return Object.fromEntries(Object.entries(input.results).map(([name,r])=>[name,r.steps]));
})));
const dependency='fixed_origin_dependency', access='fixed_program_origin_access';
const n=runs[0].nominal;
function outcome(row){return [row.pre.family,row.pre.kind,row.pre.cmd,row.pre.data,row.after.matched];}
function fallback(row){assert.deepEqual(outcome(row),['observed_frontier','experiment','ACTION6',{x:10,y:17},null]);}
function checkOrigin(row,from,to,point,placements=29){
  assert.deepEqual(outcome(row),['fixed_origin',access,'ACTION6',point,true]);
  const {pre,after}=row, domain=pre.selected.origins;
  assert.equal(pre.index,0);assert.equal(pre.origin,from);assert.equal(pre.target,to);
  assert.equal(pre.trace.at(-1),String(to));assert.equal(pre.models,8);
  assert.deepEqual(domain.safe,[String(from)]);assert.equal(domain.domain.length,placements);
  assert.deepEqual(domain.eligible.map(o=>[o.origin,o.command.data]),[[from,point]]);
  assert.deepEqual(pre.expected,{placed_node:from});assert.equal(after.seal,false);
}
function samplesFromVisiblePhases(word,trace){
  let start=trace.find(t=>t.node!==null)?.node;
  const pairs={};
  for(const [index,label] of word.entries()){
    const nodes=trace.filter(s=>s.active===index && s.node!==null);
    if(start==null || nodes.length===0)break;
    const end=nodes.at(-1).node;
    (pairs[label]??=[]).push([start,end]);
    start=end;
  }
  return pairs;
}
const receiptFor=steps=>{
  const q=steps[2],e=q.after.record.events.find(e=>e.kind==='fixed_program_public_execution');
  const pairs=samplesFromVisiblePhases(q.pre.selected.pre.scene.word,e.transitions);
  assert.deepEqual(e.samples,pairs);
  assert.deepEqual([e.before,e.after],[q.pre.ref,q.after.ref]);
  return {ticket:q.pre.ticket,before:e.before,after:e.after,pairs};
};
for(const [i,r] of runs.entries()){
  const native=json((i?'candidat':'gel')+'.entrée.json').steps;
  const withoutExtra=r.nominal.map(({pre,after,i})=>{
    const {family,ticket,...observed}=after;
    return {pre,after:observed,i};
  });
  assert.deepEqual(withoutExtra,native);
  for(const [name,steps] of Object.entries(r)){
    if(name!=='dependance') assert.deepEqual(steps,runs[0][name]);
    for(const [idx,s] of steps.entries()){
      assert.equal(s.i,idx+1);assert.equal(s.after.ticket,s.pre.ticket);assert.equal(s.after.family,s.pre.family);
      assert.ok(s.pre.guard);
    }
  }
  const nominal=r.nominal;
  assert.deepEqual(outcome(nominal[2]),['fixed_origin',dependency,'ACTION5',{},null]);
  assert.deepEqual(nominal[2].pre.refs,[nominal[1].pre.ref,nominal[1].after.ref]);
  assert.deepEqual(nominal[2].pre.selected.pre.inert,['ACTION5']);
  assert.equal(nominal[2].pre.selected.pre.pending.ref,nominal[2].pre.ref);
  assert.equal(nominal[1].after.record.events[0].kind,'placement_changed_with_unchanged_word');
  for(const name of ['reference','inertie']){
    const s=r[name];assert.deepEqual(s.slice(0,2),nominal.slice(0,2));
    assert.equal(s[2].pre.ref,nominal[2].pre.ref);fallback(s[2]);
  }
  assert.equal(r.reference[2].pre.selected.pre.pending.ref,nominal[1].pre.ref);
  assert.deepEqual(r.inertie[2].pre.selected.pre.inert,[]);
  checkOrigin(nominal[3],10,23,{x:31,y:12});
  const launch=nominal[4];
  assert.equal(launch.pre.cmd,'ACTION5');assert.equal(launch.pre.index,1);assert.equal(launch.after.completed,1);
  assert.equal(launch.after.matched,null);
  assert.deepEqual(r.acces.slice(0,3),nominal.slice(0,3));fallback(r.acces[3]);checkOrigin(r.acces[4],10,23,{x:31,y:12},28);
  assert.equal(r.placement[3].after.matched,false);assert.equal(r.placement[3].after.seal,true);
  checkOrigin(r.placement[4],10,23,{x:31,y:12});assert.equal(r.placement[4].after.completed,0);
  checkOrigin(r.cible[3],11,24,{x:37,y:12});
  const full=receiptFor(nominal), limits=receiptFor(r.bornes), partial=receiptFor(r.palier);
  assert.equal(Object.values(full.pairs).flat().length,12);
  for(const s of [r.bornes,r.palier]){
    assert.deepEqual(s.slice(0,2),nominal.slice(0,2));
    assert.deepEqual(s[2].pre,nominal[2].pre);
    assert.equal(s[2].after.shownFrames,66);assert.equal(s[2].after.rawFrames,66);
    assert.equal(s[2].after.ref,nominal[2].after.ref);
  }
  assert.deepEqual([limits.ticket,limits.before,limits.after],[full.ticket,full.before,full.after]);
  assert.deepEqual(Object.values(limits.pairs).flat(),[[13,13]]);
  assert.ok(!isDeepStrictEqual(full,limits),'reçu multitrames attribué à tort aux bornes');
  assert.deepEqual(partial,full);fallback(r.bornes[3]);checkOrigin(r.palier[3],10,23,{x:31,y:12});
}
assert.deepEqual(runs[0].dependance,n.slice(0,4));
fallback(runs[1].dependance[2]);
const total=Object.values(runs[0]).reduce((sum,s)=>sum+s.length,0);
console.log(JSON.stringify({shas,départsParSHA:Object.keys(runs[0]).length,gestesParSHA:total,témoinEntréeLivréeParSHA:n.length,
  dépendance:{nominal:outcome(n[2]),référenceAntérieure:outcome(runs[0].reference[2]),
    retraitGel:outcome(runs[0].dependance[2]),retraitBranche:outcome(runs[1].dependance[2])},
  accès:{nominal:outcome(n[3]),originesAdmissibles:[10],cible:23,autreCible:{origine:11,cible:24,point:runs[0].cible[3].pre.data},
    placementAbsent:runs[0].placement[3].after.matched,réessai:runs[0].placement[4].pre.cmd},
  réserve:{images:66,transitionsParInstruction:{complet:12,bornes:1,palier:12},
    suiteBornes:outcome(runs[0].bornes[3]),suitePalier:outcome(runs[0].palier[3])}},null,2));
