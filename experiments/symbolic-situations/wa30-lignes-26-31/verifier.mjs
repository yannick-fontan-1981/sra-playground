import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','14a185d909d3b3cb42fcc8584b841865b8ff6dd0'];
const oriented='oriented_coupling', access='pre_score_contact', frontier='observed_frontier';
function read(sha,g){
  const f=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+g+'.json')));
  assert.equal(f.sha,sha);assert.equal(f.group,g);return f.cases;
}
const both=shas.map(sha=>Object.assign({},...['nominal','contrôles','réserve'].map(k=>read(sha,k))));
assert.deepEqual(both[0],both[1]);
const c=both[0],branch=read(shas[1],'branche');
const cat=c.catalogue.rows,long=c.prolongé.rows;
const ticket=(rows,t)=>rows[t-1].ticket, result=(rows,t)=>rows[t].ret;
const choice=t=>[t.owner,t.kind,t.cmd,t.data];
const ownerEvent=(ret,owner)=>ret.list.find(e=>e.family===owner);
const verified=(ret,t)=>ret.id===t.id && ret.owner===t.owner;
for(const {rows} of Object.values({...c,...branch})){
  for(let i=0;i<rows.length-1;i++){
    const t=rows[i].ticket,r=rows[i+1].ret;
    assert.ok(t.admitted);assert.ok(verified(r,t));
    assert.equal(rows[i+1].ticket?.ref??r.ref,r.ref);
  }
}
assert.equal(c.catalogue.budget,16);assert.equal(c.prolongé.budget,19);
for(let t=1;t<=16;t++){
  assert.deepEqual(choice(ticket(cat,t)),choice(ticket(long,t)));
  assert.deepEqual(result(cat,t),result(long,t));
}
const events26=cat.slice(0,16).filter(x=>x.ticket.owner===oriented);
assert.deepEqual(events26.map(x=>x.turn),Array.from({length:13},(_,i)=>i+3));
const invited=ownerEvent(result(cat,2),oriented);
assert.equal(invited.events[0].kind,'front_contour_invitation');
assert.deepEqual(invited.invitation,[8,9]);
const t3=ticket(cat,3);
assert.deepEqual(choice(t3),[oriented,'conditional_oriented_coupling','ACTION5',{}]);
assert.deepEqual([t3.pose,t3.face,t3.expected],[[8,10],[0,-1],null]);
assert.ok(t3.refs.includes(invited.events[0].ref));
const t3ret=result(cat,3),candidate=ownerEvent(t3ret,oriented), t4ret=result(cat,4);
assert.deepEqual([t3ret.matched,candidate.held,candidate.coupled],[null,[8,9],false]);
assert.deepEqual(candidate.events,[{kind:'visible_relation_change_candidate',ref:t3ret.ref}]);
const coupled=ownerEvent(t4ret,oriented);
assert.deepEqual([t4ret.matched,coupled.held,coupled.coupled],[true,[8,8],true]);
assert.deepEqual(coupled.events,[{kind:'public_rigid_pair_translation',ref:t4ret.ref,delta:[0,-1]}]);
assert.deepEqual([t3ret.physicalFrames,t4ret.physicalFrames],[[12],[44]]);

// Lecture des tuiles publiques, indépendante de la mémoire de relation du moteur.
const path='docs/migration/native-campaigns-v54/baseline-wa30/wa30-public-trace.json.gz';
const {packets}=JSON.parse(gunzipSync(execFileSync('git',['show',shas[0]+':'+path],{maxBuffer:16*1024*1024})));
const frame=t=>packets[t].packet.frame_rows;
const hash=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const tile=(t,x,y)=>frame(t).slice(y,y+4).map(row=>row.slice(x,x+4));
for(const t of [2,3,4,15,16,17])assert.equal(hash(frame(t)),result(long,t).physical);
assert.deepEqual(tile(2,32,40),tile(3,32,40));
assert.notDeepEqual(tile(2,32,36),tile(3,32,36));
assert.deepEqual(tile(3,32,40),tile(4,32,36));
assert.deepEqual(tile(3,32,36),tile(4,32,32));
const sortedTile=(...args)=>tile(...args).flat().sort((a,b)=>a-b);
assert.deepEqual(frame(15),frame(16));
assert.ok(sortedTile(16,32,32).every(c=>c===1));
assert.ok(sortedTile(17,36,32).every(c=>c===1));
assert.deepEqual(sortedTile(16,36,32),sortedTile(17,32,32));

const without=c.sansInvitation.rows, internal=branch.retraitInterne26.rows;
assert.deepEqual(without.slice(0,2),cat.slice(0,2));assert.equal(ticket(without,3).ref,t3.ref);
assert.deepEqual(choice(ticket(without,3)),[frontier,'experiment','ACTION1',{}]);
assert.equal(ticket(without,4).owner,oriented);assert.equal(ticket(without,4).cmd,'ACTION5');
assert.deepEqual(internal,without);
assert.deepEqual(c.sansInvitation.interventions,[{turn:3,invitation:[8,9]}]);
assert.deepEqual(branch.retraitInterne26.interventions,[{turn:3,eligible:true}]);
const component=result(c.composante26.rows,3);
assert.deepEqual(component.groupSizes,[12]);
assert.equal(component.served,t3ret.physical);
assert.deepEqual(ticket(c.composante26.rows,4),ticket(cat,4));
const still26=result(c.stationnaire26.rows,3),stillTime26=ownerEvent(still26,oriented);
assert.deepEqual([still26.observedFrames,stillTime26.events,stillTime26.held,stillTime26.coupled,stillTime26.tried],[[0],[],null,false,1]);
assert.equal(ticket(c.stationnaire26.rows,4).owner,frontier);

const eligible=[{site:[36,29],action_ref:'ACTION1'},{site:[32,33],action_ref:'ACTION3'}];
function effect(rows,t,site,vector,retained=true){
  const p=ticket(rows,t),ret=result(rows,t),e=ownerEvent(ret,access);
  assert.deepEqual(choice(p),[access,'observed_effect_access',site.action_ref,{}]);
  assert.deepEqual([p.site,p.origin,p.effect,p.expected],[site.site,[36,33],'unknown_then_observe',null]);
  assert.deepEqual([ret.matched,ret.reason],[null,'experimental_contact_observed']);
  assert.deepEqual([e.kind,e.before,e.after,e.key,e.action,e.vector,e.measured,e.remoteExpected,e.remoteMatched,e.score,e.retained],
    ['pre_score_effect_contact',p.ref,ret.ref,p.key,p.cmd,vector,'measured',[],[],0,retained]);
  return e;
}
const e16=effect(long,16,eligible[0],[0,-4]);
effect(long,17,eligible[1],[-4,0]);
assert.deepEqual(ticket(long,16).eligible,eligible);
assert.deepEqual(ticket(long,17).eligible,eligible.slice(1));
assert.deepEqual([result(long,16).physicalFrames,result(long,17).physicalFrames],[[0],[44]]);
assert.deepEqual(choice(ticket(long,18)),[oriented,'conditional_oriented_coupling','ACTION3',{}]);
const alt=branch.autre31.rows,off=c.retrait31.rows,offInner=branch.retraitInterne31.rows;
for(const r of [alt,off,offInner]){
  assert.deepEqual(r.slice(0,15),long.slice(0,15));assert.equal(ticket(r,16).ref,ticket(long,16).ref);
}
assert.deepEqual(branch.autre31.interventions,[{turn:16,eligible}]);
assert.deepEqual(branch.retraitInterne31.interventions,[{turn:16,eligible}]);
const eAlt=effect(alt,16,eligible[1],[-4,0]);
assert.equal(eAlt.role,e16.role);
assert.deepEqual(choice(ticket(off,16)),[oriented,'conditional_oriented_coupling','ACTION3',{}]);
assert.deepEqual(ticket(offInner,16),ticket(off,16));assert.deepEqual(result(offInner,16),result(off,16));
assert.equal(result(alt,16).physical,result(off,16).physical);
assert.ok(!ownerEvent(result(off,16),access));
assert.ok(!verified({...result(alt,16),id:ticket(off,16).id,owner:ticket(off,16).owner},ticket(alt,16)));
assert.equal(ticket(alt,17).owner,oriented);assert.equal(ticket(off,17).owner,oriented);
const noReceipt=c.sansAcquisition.rows;
effect(noReceipt,16,eligible[0],[0,-4],false);
assert.deepEqual(choice(ticket(noReceipt,17)),choice(ticket(long,16)));
assert.deepEqual(ticket(noReceipt,17).site,eligible[0].site);
const still31=c.stationnaire31.rows;
assert.deepEqual(still31,long.slice(0,17));
const supplement=c.complément31.rows;
effect(supplement,17,eligible[1],[-4,0]);
assert.deepEqual([result(supplement,17).physicalFrames,result(supplement,17).observedFrames],[[44],[0]]);
assert.equal(ticket(supplement,18).owner,oriented);
const stats=shas.map((sha,i)=>{
  const cases=i?{...c,...branch}:c,text=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  const tests=i?7:4;
  assert.match(text,new RegExp('pass '+tests+'\\b'));assert.match(text,/fail 0/);
  return {sha,départs:Object.keys(cases).length,gestes:Object.values(cases).reduce((s,r)=>s+r.rows.length-1,0),testsAuteur:tests};
});
console.log(JSON.stringify({stats,nominal:{catalogue:16,prolongé:19,occurrences26Catalogue:events26.length,occurrences31Catalogue:1,occurrences31Prolongé:2},
  ligne26:{invitation:invited.invitation,candidatT3:candidate.events[0].kind,translationT4:coupled.events[0].delta,
    pixels:[12,44],retrait:choice(ticket(without,3)),suite:choice(ticket(without,4)),réserve:{composantes:component.groupSizes,stationnaire:choice(ticket(c.stationnaire26.rows,4))}},
  ligne31:{sites:eligible,pixels:[0,44],autre:choice(ticket(alt,16)),retrait:choice(ticket(off,16)),
    mêmeRetourPhysique:true,fausseAttributionRejetée:true,sansAcquisition:ticket(noReceipt,17).site,
    stationnaireT16:ticket(still31,17).site,stationnaireT17:choice(ticket(supplement,18))}},null,2));
