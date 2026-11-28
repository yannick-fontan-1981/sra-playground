import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const root=process.argv[2];
const versions={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'b8902646b6c968f78e5512f62d1d641b0bd20dd0'};
const arms={nominal:16,'stationnaire-t1':1,'duplique-t1':1,'autre-t1-a3':1,'autre-t1-a2':1,
  'sans-reception-t3':3,'stationnaire-t6':6,'sans-reception-t16':16};
const data={};
for(const [arm,gestures] of Object.entries(arms)){
  const [gel,candidat]=Object.entries(versions).map(([version,sha])=>{
    const {sha:found,...rest}=JSON.parse(readFileSync(join(root,version+'.'+arm+'.json'),'utf8'));
    assert.equal(found,sha);
    assert.equal(rest.arm,arm);
    assert.equal(rest.steps.length,gestures);
    return rest;
  });
  assert.deepEqual(gel,candidat);
  data[arm]=gel;
}
const n=data.nominal.steps;
const code=s=>s.pre.command[0];
const mark=r=>[r.mark.column,r.mark.values];
const expected=(s,i)=>s.after.record.event.controls['ACTION'+i];
const a=n[0],b=n[1];
assert.equal(n.filter(s=>s.pre.kind==='queued_field_experiment').length,16);
assert.equal(n.at(-1).after.levels,1);
assert.equal(a.pre.command[0],'ACTION1');
assert.equal(a.pre.bundle,'OP18');
assert.equal(a.pre.guard.admitted,true);
assert.deepEqual(a.after.record.refs,[a.pre.ref,a.after.ref]);
assert.deepEqual(mark(a.after.record.before),[3,[8,11,8]]);
assert.deepEqual(mark(a.after.record.final),[3,[8,8,11]]);
assert.deepEqual(mark(b.after.record.final),[3,[11,8,8]]);
assert.ok([a,b].every(x=>x.after.record.settledEqual&&x.after.record.frames===1));
assert.deepEqual(expected(a,1).permutations,[[0,2,1],[2,0,1]]);
assert.deepEqual(expected(b,1).permutations,[[2,0,1]]);

const still=data['stationnaire-t1'],dup=data['duplique-t1'];
assert.equal(still.steps[0].after.packet,a.after.packet);
assert.equal(dup.steps[0].after.packet,a.after.packet);
assert.equal(dup.steps[0].after.presented,a.after.presented);
assert.equal(dup.steps[0].after.record.frames,2);
assert.equal(expected(still.steps[0],1),undefined);
assert.equal(expected(dup.steps[0],1),undefined);
assert.deepEqual([still.next.command[0],dup.next.command[0],dup.next.plan.active.controls,n[1].pre.command[0]],
  ['ACTION2','ACTION1',{},'ACTION1']);

const formats=[];
for(const [name,command,kind,m,equal] of [
  ['autre-t1-a3','ACTION3','translate',[2,[8,11,8]],true],
  ['autre-t1-a2','ACTION2','receive',[3,[14,8,14]],false],
]){
  const {contrast,steps:[step]}=data[name],r=step.after.record;
  assert.equal(contrast.from,a.pre.cut.pre.input);
  assert.equal(contrast.command,command);
  assert.equal(code(step),'ACTION1');
  assert.equal(step.after.packet,a.after.packet);
  assert.notEqual(step.after.physical,step.after.presented);
  assert.deepEqual(mark(r.before),mark(a.after.record.before));
  assert.deepEqual(mark(r.final),m);
  assert.equal(r.settledEqual,equal);
  assert.equal(expected(step,1).kind,kind);
  formats.push({commandePhysique:command,serviAuTicket:code(step),configuration:m,statutAcquis:kind});
}
for(const [i,p,delta] of [[3,3,-1],[4,4,1]]){
  assert.equal(expected(n[i],p).kind,'translate');
  assert.equal(expected(n[i],p).delta,delta);
  const r=n[i].after.record;
  assert.equal(r.settledEqual,true);
  assert.deepEqual(mark(r.before)[1],mark(r.final)[1]);
}

const missing6=data['stationnaire-t6'];
assert.deepEqual(n[5].pre.plan.commands.map(a=>a.action_ref),['ACTION3','ACTION2']);
assert.equal(n[5].after.matched,true);
assert.equal(n[6].pre.index,1);
assert.equal(missing6.steps[5].after.matched,false);
assert.equal(missing6.steps[5].after.seal,true);
assert.equal(missing6.steps[5].after.packet,n[5].after.packet);
assert.equal(missing6.steps[5].after.record.event.refuted.length,1);
assert.deepEqual(expected(missing6.steps[5],3),expected(n[4],3));
assert.equal(missing6.next.command[0],code(n[6]));
assert.equal(missing6.next.index,0);

const receptions=[];
for(const [turn,removed] of [[3,[1]],[16,[1,2]]]){
  const gel=n[turn-1],reduced=data['sans-reception-t'+turn],ablation=reduced.steps.at(-1);
  const a=gel.after.record,b=ablation.after.record;
  assert.deepEqual(reduced.removed,removed);
  assert.deepEqual(a.placement.map(x=>x.index),removed);
  assert.deepEqual(b.placement,[]);
  assert.deepEqual(ablation.pre,gel.pre);
  assert.deepEqual([ablation.after.packet,ablation.after.presented],[gel.after.packet,gel.after.presented]);
  assert.deepEqual([gel.after.matched,ablation.after.matched,gel.after.seal,ablation.after.seal],[null,null,true,true]);
  assert.equal(a.event.last,'received_then_automatic_or_return_unknown');
  assert.equal(b.event.last,'unexplained_or_boundary');
  assert.equal(expected(gel,2).phase_index,1);
  if(turn===3){
    assert.equal(a.event.closure.length,2);
    assert.equal(expected(ablation,2),undefined);
    assert.equal(reduced.next.command[0],'ACTION2');
    assert.equal(code(n[3]),'ACTION3');
  }else{
    assert.equal(expected(gel,2).revalidated_epoch,2);
    assert.equal(expected(ablation,2).revalidated_epoch,1);
    assert.equal(expected(ablation,2).status,'portable_hypothesis_pending_revalidation');
  }
  receptions.push({tour:turn,ordinauxRetirés:removed,réception:a.event.last,sansTrame:b.event.last,
    statutContrôleSansTrame:expected(ablation,2)?.status??null,commandeSuivanteSansTrame:reduced.next?.command[0]??null});
}
console.log(JSON.stringify({stats:{versions:2,départsParVersion:Object.keys(arms).length,
  gestesServiceParVersion:Object.values(arms).reduce((a,b)=>a+b,0),gestesAuxiliairesParVersion:2,
  catalogue:16,niveauxTerminés:1},formats,receptions},null,2));
