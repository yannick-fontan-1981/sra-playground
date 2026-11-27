import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as eq} from 'node:util';
import {gel,candidat} from './commun.mjs';
import {chronologie,firstEffects,readWord} from './chronologie.mjs';
const dir=process.argv[2],live=JSON.parse(readFileSync(join(dir,'jeu.json'))),obs=JSON.parse(gunzipSync(readFileSync(join(dir,'observations.gz'))));
const types=['marked_collection_edit','public_program_composition','public_program_respondent_probe'],seals={},traces={};
const E=(r,type)=>r.events.find(e=>e.type===type);
function owns(t,n,e){return !!e && n.retour.ticket===t.ticket.id && eq(e.refs,[t.ticket.observationRef,n.retour.ref]);}
function justified(claim,reading){return reading.some(r=>r.premier>=0 && eq(r.mot,claim.mot) && eq(r.après,claim.après) && eq(r.avant,claim.avant) && r.premier===claim.premier);}
assert.equal(live.chargements,1);assert.equal(obs.length,17);
for(const engine of [gel,candidat]){
  function load(group){
    const p=JSON.parse(readFileSync(join(dir,engine.slice(0,8)+'.'+group+'.json')));assert.equal(p.sha,engine);
    const h=createHash('sha256').update(JSON.stringify(p.results)).digest('hex');if(seals[group])assert.equal(seals[group],h);else seals[group]=h;
    return p.results;
  }
  const [t,noEdit,noModel]=load('décisions').map(r=>r.turns);
  assert.deepEqual(t,live.nominal);assert.deepEqual(types.map(k=>t.slice(0,13).filter(r=>r.type===k).length),[3,8,2]);
  for(let i=0;i<13;i++){assert.equal(t[i].famille,'public_occurrence_recall');assert.equal(t[i].familleProgramme,'observed_program_composition');assert.ok(t[i].admis);assert.equal(t[i+1].retour.ticket,t[i].ticket.id);}
  const word=[8,8,14,9,9],g=t[12].géométrie;
  assert.deepEqual(t.slice(0,3).map(r=>r.collection),[[14,11,9,10],[14,11,9],[8,14,11,9]]);
  assert.deepEqual(t.slice(0,3).map(r=>r.mode),['remove','insert','execute']);
  for(const i of [0,1,2])assert.ok(owns(t[i],t[i+1],E(t[i+1],'marked_collection_result')));
  assert.deepEqual(t.slice(1,4).map(r=>r.retour.matched),[true,true,null]);assert.equal(obs[3].level,2);
  const model=E(t[3],'fitted_program_composition');
  assert.deepEqual(model.refs,[t[2].ticket.observationRef,t[3].retour.ref,t[0].ticket.observationRef,t[1].retour.ref]);
  assert.equal(model.modèle,t[3].modèle);
  assert.deepEqual([t[3].étape,t[3].mot,t[3].ticket.data],[ 'insert',[9],{x:16,y:56}]);
  assert.deepEqual(t.slice(4,9).map(d=>d.étape),['insert','insert','insert','insert','execute']);
  assert.deepEqual(t.slice(8,10).map(d=>[d.ticket.actionRef,d.mot]),[['ACTION5',word],['ACTION5',word]]);
  assert.ok(owns(t[8],t[9],E(t[9],'program_composition_reconciled')));
  assert.deepEqual(E(t[9],'program_composition_reconciled').base,[44,21]);assert.ok(readWord(obs[9].frame,g,word,[44,21]).complet);
  assert.equal(t[10].retour.matched,null);assert.equal(obs[10].level,3);assert.ok(readWord(obs[10].frames.at(-2),g,word,[48,23]).complet);
  assert.ok(!readWord(obs[10].frame,g,word,[48,23]).complet);
  assert.deepEqual([noEdit[0].ticket,noEdit[1].type,noEdit[1].retour.matched],[t[0].ticket,'experiment',false]);
  assert.deepEqual(noModel.slice(0,3),t.slice(0,3));assert.equal(noModel[3].ticket.frameHash,t[3].ticket.frameHash);
  assert.ok(noModel[3].withdrawn>0);assert.equal(noModel[3].type,'measured_animated_contact');
  assert.deepEqual([t[11].étape,t[11].ticket.data,t[12].étape,t[12].ticket.actionRef,t[12].mot],['insert',{x:36,y:56},'execute','ACTION5',[11,9]]);
  assert.equal(t[12].retour.matched,true);assert.equal(t[13].retour.matched,null);assert.ok(readWord(obs[13].frame,g,[11,9],[38,37]).complet);
  const result=E(t[13],'respondent_probe_result'),A=result.prévus[0],B=result.révélés[0];assert.equal(B.origines.length,1);
  const subjects=[{mot:A.mot,avant:A.avant,après:A.après},{mot:B.mot,avant:B.origines[0],après:B.après}];
  const conditions=[{variant:'jeu',turns:t},...load('ordre')];
  for(const {variant,turns} of conditions){
    assert.deepEqual(turns.slice(0,13),t.slice(0,13));const n=turns[13],receipt=E(n,'respondent_probe_result'),order=E(n,'observed_respondent_order');
    assert.ok(owns(turns[12],n,receipt));assert.equal(n.retour.ref,t[13].retour.ref);assert.ok(receipt.restauré);assert.equal(receipt.progression,false);
    const frames=variant==='jeu'?obs[13].frames:variant==='finale'?[obs[13].frame]:chronologie(obs[12].frame,obs[13].frames,variant==='premier-révélé');
    assert.deepEqual(frames.at(-1),obs[13].frame);
    const reading=firstEffects(obs[12].frame,frames,g,subjects);
    if(variant==='finale'){
      assert.equal(order,undefined);assert.equal(n.état,'stopped');assert.equal(receipt.prévus[1].indices.length,0);assert.equal(receipt.prévus[0].indices.length,1);
    }else{
      assert.ok(owns(turns[12],n,order));assert.ok(reading.every(v=>v.premier>=0));assert.deepEqual(order.ordre.map(v=>[v.mot,v.premier]),reading.toSorted((a,b)=>a.premier-b.premier).map(v=>[v.mot,v.premier]));
      for(const v of reading)assert.ok(justified(v,reading));
      assert.ok(!justified({...reading[0],mot:reading[1].mot},reading));
      assert.ok(!justified({...reading[1],après:reading[0].après},reading));assert.ok(!justified({...reading[0],premier:reading[1].premier},reading));
    }
    traces[variant]={images:frames.length,ordre:order?.ordre??null,suivant:n.type,arrêt:n.raison};
  }
  assert.deepEqual(traces['premier-visible'].ordre.map(o=>o.mot).reverse(),traces['premier-révélé'].ordre.map(o=>o.mot));
  const [{turns:rel,palette}]=load('réserve'),rename=v=>v===palette[0]?palette[1]:v===palette[1]?palette[0]:v;
  for(let i=0;i<13;i++){assert.deepEqual(rel[i].ticket.data,t[i].ticket.data);assert.equal(rel[i].type,t[i].type);if(t[i].mot)assert.deepEqual(rel[i].mot,t[i].mot.map(rename));}
  assert.deepEqual(E(rel[13],'observed_respondent_order').ordre.map(o=>[o.mot,o.premier]),traces.jeu.ordre.map(o=>[o.mot.map(rename),o.premier]));
}
const replis={};
for(const [j,i] of [1,4,12].entries()){
  const {repli:d,suite:n}=live.replis[i];assert.equal(d.withdrawn,types[j]);assert.equal(d.ticket.observationRef,live.nominal[i-1].ticket.observationRef);
  assert.deepEqual([d.famille,d.type,d.ticket.actionRef],[['observed_frontier','experiment','ACTION5'],['animated_contact','measured_animated_contact','ACTION6'],['containment','containment_and_contact','ACTION5']][j]);
  assert.equal(n.retour.ticket,d.ticket.id);assert.ok(n.retour.ref);assert.deepEqual([n.type,n.état],[['marked_collection_edit','action'],[null,'stopped'],['experiment','action']][j]);
  replis[i]={famille:d.famille,type:d.type,action:d.ticket.actionRef,point:d.ticket.data,suite:n.type,arrêt:n.raison};
}
console.log(JSON.stringify({chargements:1,gestes:16,départsParSHA:7,retraitsSurBranche:3,occurrences:{52:3,57:8,58:2},chronologies:traces,replis,empreintes:seals},null,2));
