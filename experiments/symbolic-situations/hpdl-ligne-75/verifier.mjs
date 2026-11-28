import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'66ce04946bccb531d5a6403ec36a5c2a90bf99a4'};
const arms=['nominal','sans-methode','preuve-etrangere','preuve-concurrente','stationnaire'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
assert.equal(tree(shas.gel),tree(shas.candidat));
const cases=Object.keys(shas).map(engine=>Object.fromEntries(arms.map(arm=>{
  const {sha,arm:name,...r}=JSON.parse(readFileSync(join(dir,engine+'.'+arm+'.json'),'utf8'));
  assert.deepEqual([sha,name],[shas[engine],arm]);
  for(const cut of [...r.steps.map(x=>x.pre.cut),r.next?.cut,r.lastCut].filter(Boolean))assert.equal(hash(cut.pre),cut.seal);
  return [arm,r];
})));
assert.deepEqual(cases[0],cases[1]);
const c=cases[0],n=c.nominal.steps;
const p=(rows,i)=>rows[i-1].pre,r=(rows,i)=>rows[i-1].after;
for(const run of Object.values(c)){
  assert.deepEqual(run.steps.slice(0,3),n.slice(0,3));
  for(let i=0;i<run.steps.length-1;i++)assert.equal(run.steps[i].after.ref,run.steps[i+1].pre.ref);
}
const learn=(rows,i,field,before,after)=>{
  const e=r(rows,i).record.registered.events[0];
  assert.deepEqual([e.field,e.before,e.after,e.evidence,e.authority],
    [field,before,after,[p(rows,i).ref,r(rows,i).ref],'observed_field_change_not_capture_law']);
  return e;
};
const at4=p(n,4),cut=at4.cut,offer=at4.plan.offer;
assert.deepEqual([p(n,3).family,p(n,3).command],['observed_frontier',['ACTION3',{}]]);
learn(n,3,'capacity',1,4);
const method=r(n,3).record.edits[0];
assert.deepEqual(cut.pre.edits,[method]);
assert.deepEqual(method.signature,cut.pre.geometry.signature);
assert.deepEqual([cut.pre.geometry.boxes.map(b=>b.capacity),cut.pre.geometry.word.map(x=>x.value),cut.bound,cut.offers.length,offer.cost],
  [[4,2],[8,8,9,9],{truncated:false,domain:8},1,4]);
assert.deepEqual([at4.family,at4.command,at4.guard,at4.plan.choice.release_authority],
  ['public_window_question',['ACTION6',{x:14,y:30}],{admitted:true,reason:'exact_current_geometry_method_and_payload'},false]);
assert.deepEqual(offer.edit,{box:0,field:'capacity',point:[14,30],desired:2});
assert.deepEqual(offer.methods,[method]);
assert.deepEqual(at4.refs,[at4.ref,...method.evidence]);
learn(n,4,'capacity',4,1);learn(n,5,'capacity',1,2);learn(n,6,'filter',8,9);
assert.deepEqual([r(n,4).matched,r(n,4).seal],[null,true]);
assert.deepEqual(p(n,5).command,at4.command);assert.notEqual(p(n,5).plan.offer.key,offer.key);
assert.equal(p(n,5).cut.pre.geometry.boxes[0].capacity,1);
assert.deepEqual([p(n,7).command,r(n,7).levels,r(n,7).record.registered.events[0].frames,p(n,8).level,p(n,8).cut.pre.portable[0].methods.length],
  [['ACTION5',{}],1,78,2,4]);
const loss=c['sans-methode'].steps,removed=p(loss,4).cut;
assert.deepEqual({...removed.pre,edits:[method]},cut.pre);
assert.deepEqual([removed.removed,removed.bound,removed.offers],[[method],null,[]]);
assert.deepEqual([p(loss,4).family,p(loss,4).command,p(loss,5).family,p(loss,5).command],
  ['observed_frontier',['ACTION4',{}],'public_window_question',p(n,5).command]);
learn(loss,4,'capacity',4,1);
const phys=x=>x.slice(0,5).map(s=>[s.pre.command,s.after.packet]);
const foreign=c['preuve-etrangere'].steps,near=c['preuve-concurrente'].steps,f=p(foreign,4).cut,a=p(near,4).cut;
assert.deepEqual(phys(foreign),phys(n));assert.deepEqual(phys(near),phys(n));
assert.notDeepEqual(f.foreign.signature,method.signature);
assert.deepEqual(a.foreign,{...f.foreign,signature:method.signature});
assert.deepEqual([f.offers,f.bound],[cut.offers,cut.bound]);
assert.deepEqual([a.offers.length,a.bound,a.offers[0].methods,a.offers[0].cost,a.offers[0].action],
  [1,cut.bound,[method,a.foreign],offer.cost,offer.action]);
assert.ok(p(near,4).refs.includes(a.foreign.evidence[0]));
assert.ok(!p(foreign,4).refs.includes(f.foreign.evidence[0]));
const held=c.stationnaire,still=r(held.steps,4);
assert.deepEqual(p(held.steps,4),at4);
assert.equal(still.packet,r(n,4).packet);assert.equal(still.presented,r(n,3).presented);
assert.deepEqual([still.record.registered.status,still.record.edits,still.record.attempts,
  held.next.family,held.next.command,held.next.cut.offers],
  ['no_supported_window_change',[method],[offer.key],'observed_frontier',['ACTION4',{}],[]]);
const count=n.filter(x=>x.pre.family==='public_window_question').length;
assert.equal(count,10);
const stats=Object.entries(shas).map(([engine,sha],i)=>({engine,sha,départs:arms.length,gestes:Object.values(cases[i]).reduce((n,r)=>n+r.steps.length,0)}));
console.log(JSON.stringify({stats,moteur:tree(shas.gel),catalogue:count,retourT4:[4,1],cibleT4:2,retourT5:[1,2],
  méthodeÉtrangèreIgnorée:true,méthodeHomologueAjoutée:true,offreInchangée:true,scoreAuT7:r(n,7).levels},null,2));
