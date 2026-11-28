import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['5161917eebb0e7f5d2ec6010f61bae1c2eff7b3f','640bd882150f8164b2e6a1a7de6b85b16c52711f'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree('d0e7527ca8033bd805a6d7a8bb021eff62e87021'));
assert.notEqual(tree(shas[1]),tree(shas[0]));
const files=execFileSync('git',['diff','--name-only',...shas,'--',':(top)src'],{encoding:'utf8'}).trim();
assert.equal(files,'src/logos-engine/v6-facet-examples.ts');
const cases=shas.map(sha=>Object.assign({},...['nominal','contrôles','ticket'].map(group=>{
  const a=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json'),'utf8'));
  assert.equal(a.sha,sha);assert.equal(a.group,group);return a.cases;
})));
const [old,fixed]=cases,n=old.catalogue.rows;
const t=(rows,i)=>rows[i-1].ticket,r=(rows,i)=>rows[i].return;
const e=(rows,i)=>rows.flatMap(x=>x.return?.events??[]).find(x=>x.after===r(rows,i).ref);
assert.deepEqual(old.catalogue,fixed.catalogue);
assert.equal(n.length-1,16);
assert.equal(n.slice(0,16).filter(row=>row.ticket.owner==='facet_examples').length,12);
assert.deepEqual([n[3].score,n[7].score,n[12].score,n[16].score],[1,2,3,3]);
for(const i of [4,8]){
  const a=t(n,i),b=e(n,i-1),response=e(n,i);
  assert.deepEqual([b.status,b.portable.boundary_ref,a.offer,a.refs.at(-1),response.status,response.matched],
    ['official_boundary',r(n,i-1).ref,'recall_seed_for_compound_reference',r(n,i-1).ref,'compound_seed_effect_matched',true]);
}
for(const all of cases)for(const {rows} of Object.values(all))for(let i=1;i<rows.length;i++){
  const q=t(rows,i),b=r(rows,i);
  assert.deepEqual([q.id,q.owner,q.admitted],[b.id,b.owner,true]);
  if(t(rows,i+1))assert.equal(t(rows,i+1).ref,b.ref);
}

const scenarios=[['référenceÉtrangère',3,t(n,3).ref],['ancienneFrontière',7,r(n,3).ref],['sansMéthodeSélectionnée',3,null]];
const results={};
for(const [key,boundary,foreign] of scenarios){
  const a=old[key],b=fixed[key],i=boundary+1,ref=r(n,boundary).ref;
  assert.deepEqual([a.rows.length-1,b.rows.length-1],[i,i]);
  assert.deepEqual(a.rows.slice(0,boundary),n.slice(0,boundary));
  assert.deepEqual(b.rows.slice(0,boundary),n.slice(0,boundary));
  assert.deepEqual([a.changes.length,b.changes.length],[1,1]);
  for(const k of [a,b]){
    assert.equal(k.changes[0].retour,ref);
    assert.deepEqual([k.rows[boundary].image,k.rows[boundary].niveau,k.rows[boundary].score,r(k.rows,boundary).packet],
      [n[boundary].image,n[boundary].niveau,n[boundary].score,r(n,boundary).packet]);
    assert.equal(e(k.rows,boundary).status,'official_boundary');
  }
  const [x,y]=[a.changes[0],b.changes[0]];
  if(foreign){
    assert.deepEqual(x,y);
    assert.notEqual(foreign,ref);
    assert.equal(x.avant.boundary_ref,ref);
    assert.deepEqual(x.après,{...x.avant,boundary_ref:foreign});
    assert.equal(t(a.rows,i).refs.at(-1),foreign);
  }else{
    assert.deepEqual([x.boundary,y.boundary],[ref,null]);
    assert.deepEqual(x.méthodeRetirée,t(n,boundary).method);
    assert.deepEqual(y.méthodeRetirée,x.méthodeRetirée);
    assert.equal(e(b.rows,boundary).portable.boundary_ref,undefined);
  }
  assert.deepEqual([t(a.rows,i).owner,t(a.rows,i).command,t(a.rows,i).data,r(a.rows,i).packet],
    ['facet_examples','ACTION6',t(n,i).data,r(n,i).packet]);
  assert.deepEqual([t(b.rows,i).owner,t(b.rows,i).command,t(b.rows,i).data,r(b.rows,i).owner,b.rows[i].score],
    ['observed_frontier','ACTION6',{x:10,y:14},'observed_frontier',n[boundary].score]);
  assert.notDeepEqual(r(b.rows,i).packet,r(a.rows,i).packet);
  results[key]={premierÉcart:i,parent:t(a.rows,i).data,correctif:t(b.rows,i).data,scoreAvant:n[boundary].score};
}
for(const all of cases){
  const {rows,changes:[proof]}=all.autreTicket;
  assert.deepEqual(rows,n.slice(0,5));
  assert.deepEqual([proof.tour,proof.obsolete,proof.autorisé,proof.score],[3,t(n,2).id,t(n,3).id,1]);
  assert.match(proof.erreur,/does not bind the one pending authorization/);
}
const stats=shas.map((sha,i)=>{
  const tests=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  const counts=[...tests.matchAll(/^ℹ (pass|fail) (\d+)/gm)].map(m=>Number(m[2]));
  assert.deepEqual(counts,i===0?[3,3]:[6,0]);
  return {sha,départs:Object.keys(cases[i]).length,gestes:Object.values(cases[i]).reduce((n,x)=>n+x.rows.length-1,0),
    testsAuteur:{réussis:counts[0],écarts:counts[1]}};
});
console.log(JSON.stringify({stats,nominal:16,facettes:12,gains:3,comparaisons:results,ticketPrécédentRefuséSurLesDeuxSHA:true},null,2));
