import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2];
const versions=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','a0df8a9b13b51e63d08b5ca184c996ba20453e9c'];
const read=(sha,group,ext)=>readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.'+ext),'utf8');
const cases={};
for(const group of ['catalogue','retraits','retours']){
  const [gel,candidat]=versions.map(sha=>{
    const r=JSON.parse(read(sha,group,'json'));
    assert.equal(r.sha,sha);
    assert.equal(r.group,group);
    return r.cases;
  });
  assert.deepEqual(gel,candidat);
  Object.assign(cases,gel);
}
for(const sha of versions){
  const tap=read(sha,'auteur','txt');
  assert.match(tap,/\bpass 2\b/);
  assert.match(tap,/\bfail 0\b/);
}
const {nominal,historique7,historique9,sélectionStationnaire,mouvementStationnaire,autreRécepteur}=cases;
const actual=nominal.rows;
const row=(tour,arm=nominal)=>arm.rows[tour-1];
const moved=event=>Object.keys(event.avant).filter(k=>JSON.stringify(event.avant[k])!==JSON.stringify(event.après[k]));
const count=arm=>arm.rows.filter(r=>r.ret).length;
assert.deepEqual(Object.values(cases).map(count),[16,6,8,2,7,9]);
assert.equal(actual.slice(0,16).filter(r=>r.ticket.owner==='selected_rigid'&&r.ticket.admitted).length,16);
assert.equal(actual.filter(r=>r.ret?.matched===true).length,12);
assert.equal(actual.filter(r=>r.ret?.matched===null).length,4);
assert.equal(actual.at(-1).score,1);
assert.deepEqual(actual.filter((r,i)=>i>0&&r.score>actual[i-1].score).map(r=>r.tour-1),[12]);

for(const [turn,key] of [[1,'11'],[6,'6'],[8,'12']]){
  const t=row(turn).ticket,r=row(turn+1).ret;
  assert.equal(t.sujet,key);
  assert.equal(t.mode,'select');
  assert.equal(r.id,t.id);
  assert.deepEqual([r.event.sujet,r.event.detail.role_status,r.event.detail.selection_pixels_changed],
    [key,'selected_receiver_hypothesis',true]);
  assert.equal(r.matched,true);
  assert.deepEqual([r.event.detail.before,r.event.detail.after],[t.ref,r.ref]);
  assert.deepEqual(r.event.avant,r.event.après);
}
for(const [turn,key,before,after,verdict] of [
  [2,'11',[1,3],[2,3],null],[7,'6',[0,3],[0,2],true],[9,'12',[0,4],[0,3],true],
]){
  const t=row(turn).ticket,r=row(turn+1).ret;
  assert.equal(t.sujet,key);
  assert.equal(r.id,t.id);
  assert.deepEqual([r.matched,r.event.detail.role_status,r.event.sujet],[verdict,'observed_exclusive_receiver',key]);
  assert.deepEqual([r.event.detail.before,r.event.detail.after],[t.ref,r.ref]);
  assert.deepEqual([moved(r.event),r.event.avant[key],r.event.après[key]],[[key],before,after]);
}
assert.equal(row(7).ticket.command,row(9).ticket.command);
assert.equal(row(7).ticket.command,'ACTION1');

for(const [turn,arm] of [[7,historique7],[9,historique9]]){
  const base=row(turn),variant=row(turn,arm),[i]=arm.interventions;
  assert.equal(variant.vu,base.vu);
  assert.equal(i.ref,base.ticket.ref);
  assert.equal(i.sujet,base.ticket.sujet);
  assert.notEqual(i.ancien,i.sujet);
  assert.equal(variant.ticket,null);
  assert.equal(variant.arrêt,'composition_target_unbound_action_set');
}
const still=row(2,sélectionStationnaire).ret;
assert.equal(still.packet,row(2).ret.packet);
assert.deepEqual([still.original,still.servi,still.event.detail.selection_pixels_changed,still.event.detail.role_status],
  [46,0,false,'selected_receiver_hypothesis']);
assert.equal(row(2,sélectionStationnaire).ticket.command,'ACTION4');
assert.equal(row(3,sélectionStationnaire).ret.event.detail.role_status,'observed_exclusive_receiver');
const stationary=row(8,mouvementStationnaire).ret;
assert.equal(stationary.packet,row(8).ret.packet);
assert.equal(stationary.servi,0);
assert.equal(stationary.matched,false);
assert.deepEqual(moved(stationary.event),[]);
assert.equal(row(8,mouvementStationnaire).arrêt,'rigid_control_or_collision_model_refuted');
const wrong=row(10,autreRécepteur).ret;
assert.equal(wrong.packet,row(10).ret.packet);
assert.equal(wrong.matched,false);
assert.ok(wrong.scellé);
assert.equal(autreRécepteur.alternate.expected,'12');
assert.notEqual(autreRécepteur.alternate.moved[0],'12');
assert.deepEqual(moved(wrong.event),autreRécepteur.alternate.moved);
assert.equal(wrong.event.detail.compatible_model_count,0);
assert.deepEqual([wrong.event.sujet,wrong.event.detail.role_status],['12','observed_exclusive_receiver']);
assert.equal(row(10,autreRécepteur).ticket,null);
assert.equal(row(10,autreRécepteur).arrêt,'rigid_control_or_collision_model_refuted');

console.log(JSON.stringify({stats:{versions:2,départsParVersion:Object.keys(cases).length,gestesParVersion:48,
  gestesContrefactuelsParVersion:9,
  catalogue:16,retoursConfirmés:12,retoursSansPrédiction:4,niveauxTerminés:1,testsAuteurParVersion:2},
  sujets:[1,2,6,7,8,9].map(tour=>({tour,sujet:row(tour).ticket.sujet,commande:row(tour).ticket.command,
    avant:row(tour+1).ret.event.detail.before,après:row(tour+1).ret.event.detail.after,
    rôle:row(tour+1).ret.event.detail.role_status})),conflit:{...autreRécepteur.alternate,
      modèleRestant:wrong.event.detail.compatible_model_count,traceDeRôle:wrong.event.detail.role_status,
      sujetDeLaTrace:wrong.event.sujet,arrêt:row(10,autreRécepteur).arrêt}},null,2));
