import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [directory]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',stations:'4946cf0297734b9464fc52256af6fb27846f3bad'};
const arms=['nominal','priorite','stationnaire','sans-effet','palette','banc'];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const order=['ACTION1','ACTION4','ACTION3','ACTION2'];
const runs=Object.fromEntries(Object.keys(sha).map(engine=>[engine,Object.fromEntries(arms.map(arm=>{
  const r=JSON.parse(readFileSync(join(directory,engine+'.'+arm+'.json'),'utf8'));
  assert.equal(r.sha,sha[engine]);assert.equal(r.arm,arm);
  for(const cut of [...r.steps.map(x=>x.issued.cut),r.lastCut,r.next?.cut].filter(Boolean))assert.equal(hash(cut.pre),cut.seal);
  return [arm,r];
}))]));
const physical=r=>r.steps.map(s=>[s.issued.command,s.after.packet]);
const screen=r=>r.steps.map(s=>[s.issued.command,s.after.normalized]);
function ownership(s,i,mode){
  assert.equal(s.i,i);
  assert.deepEqual([s.issued.family,s.issued.entry,s.issued.kind,s.issued.plan.kind,s.issued.admitted],
    ['public_occurrence_recall','observed_composition_services','rooted_line',mode,true]);
}
function calibrage(r){
  assert.deepEqual(r.steps.slice(0,4).map(s=>s.issued.command),order);
  let effects={};
  for(let i=1;i<=4;i++){
    const {issued,after}=r.steps[i-1], command=issued.command;
    ownership(r.steps[i-1],i,'calibrate');
    assert.deepEqual(issued.cut.pre.state.controls,effects);
    assert.deepEqual(issued.cut.pre.pending,order.slice(i-1));
    assert.deepEqual([issued.plan.expected,after.matched,after.seal],[null,null,true]);
    assert.deepEqual(after.record.state.controls[command].evidence,[issued.ref,after.ref]);
    effects={...effects,[command]:after.record.state.controls[command]};
  }
  return effects;
}
function initialPlan(r){
  const effects=calibrage(r);
  assert.equal(r.steps.length,5);
  const t5=r.steps[4],{issued,after}=t5;
  ownership(t5,5,'conditional_composition');
  assert.deepEqual([issued.cut.pre.state.controls,issued.cut.pre.state.tried,issued.cut.pre.pending],[effects,order,[]]);
  assert.deepEqual([issued.cut.pre.state.recovery,issued.cut.pre.state.refuted,after.need],[null,0,null]);
  assert.ok(issued.plan.expected);assert.equal(after.matched,true);
  assert.notEqual(after.normalized,r.steps[3].after.normalized);
  return {ordre:issued.cut.pre.order,commande:issued.command,expansions:issued.plan.search.nodes,
    gestesPlan:issued.plan.commands.length,statut:issued.plan.search.projected_order_trial?.status??null,confirmation:after.matched};
}
const out={};
for(const [engine,c] of Object.entries(runs)){
  const nominal=initialPlan(c.nominal);
  assert.deepEqual([nominal.commande,nominal.expansions,nominal.gestesPlan],['ACTION1',282,11]);
  const [first,second]=c.priorite.steps;
  const {priority:pa,pending:qa,...actual}=first.issued.cut.pre;
  const {priority:pn,pending:qn,...base}=c.nominal.steps[0].issued.cut.pre;
  assert.deepEqual(actual,base);assert.deepEqual(pn,qn);assert.deepEqual(pa,qa);
  assert.deepEqual([first.issued.command,second.issued.command],['ACTION4','ACTION1']);
  assert.deepEqual(first.after.record.state.controls.ACTION4.extent,6);
  const still=c.stationnaire.steps[0];
  assert.deepEqual(physical(c.stationnaire),physical(c.nominal).slice(0,1));
  assert.equal(still.issued.cut.pre.ref,c.nominal.steps[0].issued.cut.pre.ref);
  assert.notEqual(still.after.normalized,still.after.source);
  assert.deepEqual([still.after.record.state.controls,still.after.record.state.tried,c.stationnaire.next.command],[{},['ACTION1'],'ACTION4']);
  const absent=c['sans-effet'];
  assert.deepEqual(absent.steps,c.nominal.steps.slice(0,4));
  assert.deepEqual([absent.stop,absent.lastCut.offer.reason,absent.next],['frontier_unknown','rooted_control_effect_unresolved',null]);
  const {controls,...s}=absent.lastCut.pre.state;
  assert.deepEqual(Object.keys(controls).sort(),order.slice(1).sort());
  assert.deepEqual({...absent.lastCut.pre,state:{...s,controls:{...controls,ACTION1:absent.lastCut.removed}}},c.nominal.steps[4].issued.cut.pre);
  const t1=c.nominal.steps[0].after.record.state.controls.ACTION1;
  assert.deepEqual([t1.translation,t1.extent],[[-6,0],0]);
  const palette=c.palette;
  assert.deepEqual(physical(palette).slice(0,4),physical(c.nominal).slice(0,4));
  assert.notDeepEqual(screen(palette).slice(0,4),screen(c.nominal).slice(0,4));
  calibrage(palette);
  let p;
  if(engine==='gel'){
    assert.equal(palette.steps.length,4);assert.equal(palette.next,null);
    const {pre,offer}=palette.lastCut;
    assert.deepEqual([pre.declaredLimit,palette.stop,offer.reason,offer.search.bounds],
      [12,'frontier_unknown','rooted_contact_plan_unresolved',['bound.max_depth']]);
    p={ordre:pre.order,commande:null,expansions:offer.search.nodes,borne:offer.search.bounds[0]};
    assert.equal(p.expansions,792);
  } else {
    p=initialPlan(palette);
    assert.deepEqual([p.expansions,p.statut],[282,'compatible_unordered']);
  }
  const banc=initialPlan(c.banc);
  assert.deepEqual(physical(c.banc),physical(c.nominal));
  assert.notDeepEqual(screen(c.banc),screen(c.nominal));
  out[engine]={sha:sha[engine],départs:arms.length,gestes:Object.values(c).reduce((n,x)=>n+x.steps.length,0),
    nominal,palette9et14:p,banc8et13:banc};
}
for(const arm of arms)assert.deepEqual(physical(runs.gel[arm]).slice(0,4),physical(runs.stations[arm]).slice(0,4));
const forged=structuredClone(runs.stations.palette);
forged.steps[4].after.matched=false;
assert.throws(()=>initialPlan(forged),assert.AssertionError);
console.log(JSON.stringify(out,null,2));
