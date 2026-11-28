import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','19ffd927b588257ce54cf1a35c166ce41ecebf5b'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
const owner='contextual_compartments',kind='contextual_compartment_question';
function read(sha,g){
  const f=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+g+'.json')));
  assert.equal(f.sha,sha);assert.equal(f.group,g);return f.results;
}
const runs=shas.map(sha=>Object.assign({},...['nominal','contrôles','réserve'].map(g=>read(sha,g))));
assert.deepEqual(runs[0],runs[1]);
const c=runs[0],n=c.nominal.steps;
const click=(x,y)=>['ACTION6',{x,y}];
const choice=p=>[p.family,p.type,p.command];
for(const item of Object.values(c))for(const [i,{pre,after}] of item.steps.entries()){
  assert.ok(pre.admitted);assert.equal(pre.ticket,after.ticket);assert.equal(pre.family,after.owner);
  const next=item.steps[i+1]?.pre??item.next;if(next)assert.equal(next.ref,after.ref);
}
const [a,b]=n;
assert.deepEqual(choice(a.pre),[owner,kind,click(44,50)]);
assert.equal(a.pre.cut9.pre.fact.frames.length,11);
const choices=a.pre.cut9.pre.fact.frames.filter(f=>f.border===a.pre.cut9.pre.fact.mark);
assert.deepEqual(choices.map(f=>[f.box,f.filled,f.closed]),[[[43,44,46,57],24,true]]);
assert.deepEqual(a.pre.compartment.control.box,choices[0].box);
assert.equal(a.pre.compartment.expected,null);assert.deepEqual(a.pre.refs,[a.pre.ref]);
const response=step=>step.after.compartment.events.find(e=>e.kind==='contextual_compartment_response');
assert.equal(response(a).after,a.after.ref);
assert.equal(response(a).local_changed,true);
assert.deepEqual(a.after.compartment.attempted,[a.pre.compartment.key]);
assert.deepEqual(a.after.compartment.dependencies,[[choices[0].box,[]]]);
assert.deepEqual([a.after.matched,a.after.seal,a.after.reason],[null,true,'unknown_compartment_response']);
assert.deepEqual(choice(b.pre),[owner,kind,click(53,30)]);
assert.deepEqual(b.pre.compartment.control.box,[50,23,57,37]);
assert.deepEqual(b.pre.cut9.pre.fact.refs,[a.after.ref]);
assert.deepEqual(n[9].pre.compartment.dependencies.filter(e=>e.receivers.length>0),
  [{control:[16,48,23,57],receivers:[[25,20,28,37]]}]);
assert.equal(n[9].pre.level,2);
assert.deepEqual(n[9].pre.compartment.control.box,[25,20,28,37]);
assert.ok(n[9].pre.refs.includes(n[8].after.ref));

const [off,recovery]=c['sans-offre-9'].steps;
assert.deepEqual(off.pre.cut9,a.pre.cut9);
assert.deepEqual(choice(off.pre),['observed_frontier','experiment',['ACTION5',{}]]);
assert.deepEqual(choice(recovery.pre),choice(a.pre));
const still=c['retour-9'], edit=c.composante;
for(const run of [still,edit]){
  const step=run.steps[0];
  assert.deepEqual(step.pre,a.pre);assert.equal(step.after.packet,a.after.packet);
  assert.equal(step.after.images,a.after.images);assert.deepEqual(step.after.compartment.attempted,[a.pre.compartment.key]);
}
assert.equal(still.steps[0].after.pixels.shown,0);
assert.equal(response(still.steps[0]).local_changed,false);
assert.deepEqual(still.next.command,['ACTION5',{}]);assert.equal(still.next.family,'observed_frontier');
const reduced=edit.steps[0],eligible=reduced.after.components;
assert.equal(eligible.reduce((s,x)=>s+x,0),a.after.pixels.real);
assert.ok(eligible.includes(reduced.after.pixels.shown)||eligible.length===0 && reduced.after.pixels.shown===0);
assert.deepEqual(reduced.after.pixels,{real:134,shown:57});
assert.equal(response(reduced).local_changed,true);
assert.deepEqual([edit.next.family,edit.next.command],['observed_frontier',['ACTION5',{}]]);
const good=(event,step)=>step.pre.family===owner&&event.after===step.after.ref;
assert.ok(good(response(a),a));
assert.ok(!good(response(a),off));
assert.ok(!good({...response(a),after:b.after.ref},a));

const noEvidence=c['sans-acquis-9'];
assert.deepEqual(noEvidence.steps.slice(0,3).map(s=>[s.pre.command,s.after.packet]),n.slice(0,3).map(s=>[s.pre.command,s.after.packet]));
assert.equal(noEvidence.steps[0].after.compartment,null);
const cold=n[2].pre;
assert.deepEqual([cold.entry,cold.command,cold.recall.context],['observed_occurrence_recall',click(34,7),null]);
assert.deepEqual([cold.cut56.pre.fact.seen,cold.cut56.pre.fact.models],[[],[]]);
assert.deepEqual(noEvidence.steps[2].pre.recall,cold.recall);
const counts=n.filter(s=>s.pre.type===kind).length;
assert.equal(counts,15);
const stats=shas.map(sha=>({sha,départs:Object.keys(c).length,gestes:Object.values(c).reduce((s,r)=>s+r.steps.length,0)}));
console.log(JSON.stringify({stats,moteur:tree(shas[0]),catalogue:{ligne9:counts,auCatalogue:17,témoin56:3},T1:{compartiment:choices[0].box,commande:a.pre.command,pixels:a.after.pixels},
  T2:{compartiment:b.pre.compartment.control.box,commande:b.pre.command},N2:{dépendance:n[9].pre.compartment.dependencies.filter(e=>e.receivers.length>0)},
  retrait:choice(off.pre),stationnaire:{suite:still.next.command,tentativeInscrite:true},
  réserve:{composantes:eligible,pixels:reduced.after.pixels,local:response(reduced).local_changed,suite:{famille:edit.next.family,commande:edit.next.command}},
  fauxReçusRejetés:2},null,2));
