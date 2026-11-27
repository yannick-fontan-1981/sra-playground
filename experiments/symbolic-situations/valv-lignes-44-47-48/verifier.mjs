import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {archivePublique,gel,candidat} from './commun.mjs';
const dir=process.argv[2],live=JSON.parse(readFileSync(join(dir,'jeu.json'))),hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const suffix=['envelope_fill_experiment','field_service_experiment','field_service_transfer_experiment'];
const receipts=['envelope_fill_context','field_service_context','field_service_transfer'];
const seals={},report={};
function owns(t,n,e){return !!(t.ticket && n.retour && e && n.retour.ticket===t.ticket.id && same(e.refs,[t.ref,n.retour.ref]));}
function official(pair,t,n){
  return n.ticket.level===t.ticket.level+1 && n.retour.ticket===t.ticket.id && same(pair,[t.ref,n.retour.ref]);
}
function delta(i){
  const a=archivePublique[i-1].obs.frame,b=archivePublique[i].obs.frame;let field=0,hud=0;
  for(let y=0;y<b.length;y++)for(let x=0;x<b[y].length;x++)if(a[y][x]!==b[y][x]){if(y<55)field++;else hud++;}
  return [field,hud];
}
assert.equal(live.sha,candidat);assert.equal(live.chargements,1);
for(const engine of [gel,candidat]){
  function load(group){
    const p=JSON.parse(readFileSync(join(dir,engine.slice(0,8)+'.'+group+'.json')));
    assert.equal(p.sha,engine);const h=hash(p.results);if(seals[group])assert.equal(h,seals[group]);else seals[group]=h;
    return p.results.map(r=>r.turns);
  }
  const [t,indicator,missing]=load('public'),[pixel,altered]=load('réserve'),[reproduction]=load('reproduction-48');
  assert.deepEqual(t,live.nominal);assert.equal(t.length,17);
  for(let i=0;i<16;i++){
    const d=t[i],n=t[i+1];assert.equal(d.famille,'public_occurrence_recall');assert.equal(d.sousQuestion,'field_service_composition');
    assert.equal(d.ticket.actionRef,'ACTION6');assert.equal(d.admis,true);assert.equal(d.périmé,false);
    assert.deepEqual([d.ticket.data.x,d.ticket.data.y],d.point);assert.equal(n.retour.ticket,d.ticket.id);
    assert.equal(n.retour.matched,null);assert.equal(n.retour.raison,'unknown_control_response_observed');
    const j=suffix.indexOf(d.type),kind=j>=0?receipts[j]:'nested_control_response';
    assert.ok(n.events.some(e=>e.kind===kind && owns(d,n,e)),i+1+' '+kind);
  }
  assert.deepEqual(suffix.map(k=>t.filter(r=>r.type===k).length),[3,6,6]);
  assert.deepEqual(delta(1),[56,16]);assert.deepEqual(delta(4),[56,16]);
  assert.equal(t[1].ticket.frameHash,t[3].ticket.frameHash);assert.equal(t[0].ticket.frameHash,t[4].ticket.frameHash);
  assert.deepEqual(t.slice(1,5).map(d=>[d.phase,d.point]),[['repeat',[32,50]],['contrast',[8,50]],['repeat_contrast',[8,50]],['isolate',[50,33]]]);
  const evt=(n,kind)=>t[n].events.find(e=>e.kind===kind);
  assert.equal(evt(1,receipts[0]).phase,'repeat');assert.equal(evt(2,receipts[0]).répétable,false);assert.equal(evt(2,receipts[0]).phase,'contrast');
  assert.equal(evt(4,receipts[0]).restauré,true);assert.equal(evt(4,receipts[0]).opaque.length,1);
  const measured=evt(5,receipts[1]);assert.ok(measured.préservé && measured.orientation);assert.equal(measured.phase,'serve');
  assert.deepEqual(t[5].point,[32,50]);
  const witness=evt(10,receipts[2]).frontière;assert.ok(official(witness,t[9],t[10]));
  assert.deepEqual([t[10].phase,t[10].point,t[11].phase,t[11].point],['revalidate_source_access',[11,35],'revalidate_conditional_service',[32,51]]);
  assert.deepEqual(evt(11,receipts[2]).essai,{point:[11,35],de:'horizontal',à:'vertical'});
  assert.deepEqual(indicator.slice(0,1),t.slice(0,1));assert.notEqual(indicator[1].type,suffix[0]);
  assert.equal(indicator[1].état,'stopped');assert.equal(indicator[1].raison,'nested_control_effect_requires_composition');
  assert.deepEqual(pixel.slice(0,4),t.slice(0,4));assert.equal(pixel[4].état,'stopped');assert.equal(pixel[4].raison,'field_restoration_unconfirmed');
  for(const arr of [missing,altered,reproduction]){
    assert.deepEqual(arr.slice(0,10),t.slice(0,10));assert.deepEqual(arr[10].proof.avant,witness);assert.equal(arr[10].ticket.frameHash,t[10].ticket.frameHash);
    assert.ok(!official(arr[10].proof.après,t[9],arr[10]));
  }
  assert.equal(missing[10].proof.après,null);assert.equal(missing[10].type,'nested_control_experiment');assert.deepEqual(missing[10].point,[32,51]);
  assert.ok(t.slice(0,8).some(d=>d.ref===altered[10].proof.après[0]));assert.equal(altered[10].proof.après[1],witness[1]);
  assert.equal(altered[10].type,suffix[2]);assert.equal(altered[10].admis,true);assert.deepEqual(altered[10].point,t[10].point);
  assert.ok(owns(altered[10],altered[11],altered[11].events.find(e=>e.kind===receipts[2])));
  assert.deepEqual(reproduction[10].proof.après,[t[8].ref,t[10].ref]);assert.equal(reproduction[10].type,suffix[2]);
  assert.ok(owns(reproduction[10],reproduction[11],reproduction[11].events.find(e=>e.kind===receipts[2])));
  assert.ok(!owns(t[1],t[2],evt(5,receipts[1])));
  report.indicateur={état:indicator[1].état,famille:indicator[1].famille,type:indicator[1].type,point:indicator[1].point??null};
}
const replis={};
for(const [j,turn] of [2,5,11].entries()){
  const {repli:d,suite:n}=live.replis[turn],baseline=live.nominal[turn-1];
  assert.equal(d.withdrawn,suffix[j]);assert.equal(d.ticket.observationRef,baseline.ref);assert.equal(d.admis,true);
  assert.equal(d.type,'nested_control_experiment');assert.deepEqual(d.point,[32,turn===11?51:50]);
  assert.ok(owns(d,n,n.events.find(e=>e.kind==='nested_control_response')));assert.equal(n.retour.matched,null);
  assert.equal(n.type,suffix[j]);assert.equal(n.phase,baseline.phase);assert.deepEqual(n.point,baseline.point);
  if(turn===2)assert.equal(n.retour.ref,live.nominal[turn].retour.ref);
  assert.ok(!owns(d,n,live.nominal[turn+1].events[0]));
  replis[turn]={point:d.point,retour:n.retour.ref,acquisitions:n.events.map(e=>e.kind),suivant:n.type,phase:n.phase,pointSuivant:n.point??null,arrêt:n.raison};
}
console.log(JSON.stringify({gel,candidat,chargementsJeu:1,gestesNominaux:16,observationsJeu:17,départsPréenregistrésParSHA:5,reproductionsSupplémentairesParSHA:1,retraitsSurBranche:3,
  occurrences:{44:3,47:6,48:6},premierÉcartProvenance:{ligne:48,tour:11,présenceRequise:true,paireAltéréeAdmise:true},replis,...report,empreintes:seals},null,2));
