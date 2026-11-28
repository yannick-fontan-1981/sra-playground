import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2];
const versions={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'24e9743683b22b2256104d9f4de2c84abb1a1de3'};
const common={nominal:16,'contradiction-n1':3,'contradiction-n2':9,locale:10,'locale-contredite':9,
  ancienne:9,etrangere:4,'locale-incomplete':9};
const captures={'capture-n1':1,'capture-n2':5,'capture-exacte':9};
const extra={gel:common,candidat:{...common,...captures}};
function read(v,name){
  const data=JSON.parse(readFileSync(join(dir,v+'.'+name+'.json'),'utf8'));
  assert.equal(data.sha,versions[v]);
  assert.equal(data.arm,name);
  assert.equal(data.steps.length,extra[v][name]);
  return data.steps;
}
const [gel,candidat]=Object.keys(versions).map(v=>Object.fromEntries(Object.keys(extra[v]).map(k=>[k,read(v,k)])));
const seed=JSON.parse(readFileSync(join(dir,'preuves-candidat.json'),'utf8'));
const n=candidat.nominal;
const readView=({ref,hash,available,geometry,epoch,values})=>[ref,hash,available,geometry,epoch,values];
const physical=({pre,after})=>[pre.ref,pre.family,pre.kind,pre.slot,pre.command,pre.guard,
  after.ref,after.matched,after.seal,after.levels,after.packet];
const ev=s=>[s.pre.ref,s.after.ref];
assert.deepEqual(n.map(physical),gel.nominal.map(physical));
assert.equal(n.filter(x=>x.pre.slot==='product_panel_composition').length,13);
for(const [key,name,index,before,after] of [
  ['n1','capture-n1',0,[4,4],[9,8]],['n2','capture-n2',4,[9,4,4],[4,8,4]],
  ['exact','capture-exacte',8,[4,4,11],[9,8,11]],
]){
  const step=candidat[name][index];
  assert.equal(step.after.packet,n[index].after.packet);
  assert.notEqual(step.after.presented,step.after.physical);
  assert.deepEqual(step.after.record,seed[key]);
  const [witness]=seed[key].counterexamples;
  assert.deepEqual([witness.before,witness.after,witness.changed_factors,witness.evidence],[before,after,[0,1],ev(step)]);
}

const conflict=[];
const refusal='factor_product_independence_refuted_in_current_scope';
for(const [arm,i,k,expectedFallback] of [
  ['contradiction-n1',2,'n1',['ACTION1',{}]],['contradiction-n2',8,'n2',['ACTION6',{x:45,y:20}]],
]){
  const o=gel[arm][i],c=candidat[arm][i],p=c.pre,old=o.pre;
  const raw=n[i].pre.cut.pre;
  assert.deepEqual(readView(p.cut.pre),readView(raw));
  assert.deepEqual(readView(old.cut.pre),readView(raw));
  assert.deepEqual(p.cut.pre.used.edges,raw.used.edges);
  assert.deepEqual(p.cut.pre.used.counterexamples,seed[k].counterexamples);
  assert.deepEqual(old.cut.pre.used,p.cut.pre.used);
  assert.ok(old.plan.compiled.length);
  assert.deepEqual(physical(o),physical(gel.nominal[i]));
  assert.equal(p.plan,null);
  assert.equal(p.cut.result.reason,refusal);
  assert.deepEqual(p.command,expectedFallback);
  assert.equal(p.guard.admitted,true);
  assert.equal(c.after.matched,null);
  conflict.push({tour:i+1,entrée:groupe(c),gel:o.pre.command,correctif:p.command,retour:c.after.ref,
    résultatOfficiel:c.after.levels});
}
function groupe(step){return [step.pre.family,step.pre.slot,step.pre.kind];}

const local=candidat.locale[8],l=local.pre.plan;
assert.deepEqual([seed.local.factor,seed.local.before,seed.local.after,seed.local.evidence],
  [1,[4,4,11],[4,8,11],ev(n[8])]);
assert.deepEqual([seed.partial.factor,seed.partial.before,seed.partial.after],[1,[9,4,4],[9,8,4]]);
assert.notDeepEqual(seed.partial.before,seed.local.before);
assert.deepEqual([l.local,l.compiled,l.commands.length,l.relation,l.projected],[seed.local,null,1,true,[4,8,11]]);
assert.ok(seed.local.evidence.every(ref=>local.pre.refs.includes(ref)));
assert.deepEqual([local.pre.command,local.after.packet,local.after.matched,local.after.seal],
  [n[8].pre.command,n[8].after.packet,true,true]);
assert.deepEqual(local.after.record.local,[{factor:1,before:[4,4,11],evidence:ev(local)}]);
assert.equal(candidat.locale[9].pre.index,0);
assert.equal(n[9].pre.index,1);
for(const [mode,counter,edge] of [
  ['locale-contredite',seed.exact.counterexamples[0],seed.local],
  ['ancienne',seed.n2.counterexamples[0],seed.local],
  ['locale-incomplete',seed.n2.counterexamples[0],seed.partial],
]){
  const {pre}=candidat[mode][8];
  assert.deepEqual(readView(pre.cut.pre),readView(local.pre.cut.pre));
  assert.deepEqual(pre.cut.pre.used.edges.at(-1),edge);
  assert.deepEqual(pre.cut.pre.used.counterexamples[0].evidence,counter.evidence);
  assert.equal(Object.hasOwn(pre.cut.pre.used.counterexamples[0],'before'),mode!=='ancienne');
  assert.equal(pre.plan,null);
  assert.equal(pre.cut.result.reason,refusal);
}
const foreign=candidat.etrangere[3].pre.cut.pre;
assert.deepEqual([foreign.prior.epoch,foreign.epoch,foreign.used],[1,2,null]);
assert.deepEqual(candidat.etrangere.map(physical),n.slice(0,4).map(physical));
assert.deepEqual(gel.etrangere.map(physical),gel.nominal.slice(0,4).map(physical));

console.log(JSON.stringify({stats:{versions:2,départsGel:Object.keys(common).length,
  gestesGel:Object.values(common).reduce((a,b)=>a+b,0),départsCorrectif:Object.keys(extra.candidat).length,
  gestesCorrectif:Object.values(extra.candidat).reduce((a,b)=>a+b,0),catalogue:16,compilationsContreditesRefusées:2,
  réexécutionsLocalesConfirmées:1},conflict,local:{tuple:seed.local.before,projection:seed.local.after,
    preuve:seed.local.evidence,retour:local.after.ref,scellé:local.after.seal,
    suivant:candidat.locale[9].pre.command},contrôleAutreÉpoque:{avant:foreign.prior.epoch,après:foreign.epoch}},null,2));
