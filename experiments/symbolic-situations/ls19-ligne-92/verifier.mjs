import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as equal} from 'node:util';
const dir=process.argv[2],engines=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','b56ea7526d8b518296351ea6e6a58124ae82f3ce'];
const seals={},sample={};
function lawful(ticket,next){
  const ret=next.retour?.frontière;
  return ticket.admis && ticket.besoin.kind==='observe_untried_input_effect' &&
    ticket.besoin.subjects.includes(ticket.question) && ticket.question===ticket.libéré &&
    ticket.but==='G_protocol_completion' && ret?.status==='observed' && ret.objective===ticket.question &&
    ret.need===ticket.besoin.id && next.retour.ticket===ticket.ticket.id && next.retour.matched===null &&
    ticket.famille===(ticket.purpose==='view_continuity'?'view_continuity':'observed_frontier');
}
for(const engine of engines){
  function load(g){
    const p=JSON.parse(readFileSync(join(dir,engine.slice(0,8)+'.'+g+'.json')));assert.equal(p.sha,engine);
    const h=createHash('sha256').update(JSON.stringify(p.results)).digest('hex');
    if(seals[g])assert.equal(seals[g],h);else seals[g]=h;
    return p.results.map(r=>r.turns);
  }
  const [nom,noView]=load('jeu'),[prior,spent,none]=load('historique'),[last,fixed,moved]=load('réserve');
  assert.equal(nom.length,17);assert.equal(noView.length,17);
  const prefix=nom.slice(0,13);
  for(const t of [noView,prior,spent,none,last,fixed,moved])assert.deepEqual(t.slice(0,13),prefix);
  // Trois questions locales à T14 ; réception du ticket T14 puis nouveau choix à T15.
  const a=nom[13],b=nom[14],c=nom[15],q=a.audit.appels[0].locales;
  assert.equal(q.length,3);assert.equal(a.audit.vue.arrêts,2);assert.ok(a.audit.vue.clé);
  assert.ok(!a.audit.bord && a.audit.appels[0].trajets.length===0);
  assert.deepEqual([a.famille,a.stratégie,a.ticket.actionRef,b.famille,b.ticket.actionRef],['view_continuity','test_local_input','ACTION3','observed_frontier','ACTION3']);
  assert.ok(lawful(a,b)&&lawful(b,c));assert.notEqual(a.question,b.question);assert.notEqual(a.besoin.id,b.besoin.id);
  assert.equal(a.question,q[0][1]);assert.deepEqual(a.besoin.evidence,[a.ticket.observationRef,...a.audit.vue.preuves]);
  const off=noView[13];assert.deepEqual(off.audit.vue,a.audit.vue);assert.equal(off.purpose,null);
  assert.equal(off.famille,'observed_frontier');assert.equal(off.ticket.actionRef,a.ticket.actionRef);
  assert.equal(off.question,a.question);assert.equal(off.besoin.id,a.besoin.id);assert.deepEqual(off.besoin.evidence,[a.ticket.observationRef]);
  assert.equal(noView[14].retour.ref,b.retour.ref);assert.ok(lawful(off,noView[14]));
  assert.ok(!lawful({...off,famille:'view_continuity'},noView[14]));
  assert.ok(!lawful(a,{...b,retour:{...b.retour,frontière:{...b.retour.frontière,objective:nom[12].libéré}}}));
  assert.ok(!lawful(a,{...b,retour:{...b.retour,frontière:{...b.retour.frontière,need:b.besoin.id}}}));
  for(const [arr,removed] of [[prior,1],[last,2]]){
    const u=arr[13];assert.deepEqual(u.audit.avant,q);assert.equal(u.audit.essais.length,removed);
    assert.equal(new Set(u.audit.essais.map(v=>v[2])).size,removed);assert.ok(u.audit.essais.every(v=>v[2].startsWith('transition:')));
    const remain=q.filter(([,id])=>!u.audit.essais.some(x=>x[1]===id));
    assert.deepEqual(u.audit.appels[0].locales,remain);assert.equal(u.ticket.actionRef,remain[0][0]);
    assert.equal(u.famille,'view_continuity');assert.ok(lawful(u,arr[14]));assert.notEqual(u.besoin.id,a.besoin.id);
    assert.deepEqual(u.audit.appels[0].trajets,[]);assert.equal(u.audit.bord,0);
  }
  for(const arr of [spent,none]){
    const u=arr[13],call=u.audit.appels[0];assert.equal(u.audit.vue.clé,a.audit.vue.clé);assert.ok(!u.ticket);
    assert.deepEqual(call.locales,[]);assert.deepEqual(call.trajets,[{pas:null,question:null}]);assert.equal(call.statut,'frontier_exhausted');
    assert.equal(u.audit.bord,0);assert.equal(u.raison,'frontier_frontier_exhausted');
  }
  assert.equal(spent[13].audit.essais.length,3);assert.equal(none[13].audit.essais.length,0);assert.equal(none[13].audit.appels[0].disponibles,3);
  assert.equal(fixed[13].famille,'view_continuity');assert.equal(moved[13].famille,'observed_frontier');
  assert.equal(fixed[13].ticket.actionRef,moved[13].ticket.actionRef);assert.equal(moved[13].audit.vue.arrêts,0);assert.equal(moved[13].audit.vue.clé,null);
  assert.ok(moved[13].audit.bord>0);assert.ok(!equal(fixed[13].ticket.frameHash,moved[13].ticket.frameHash));
  assert.ok(lawful(fixed[13],fixed[14])&&lawful(moved[13],moved[14]));
  sample[engine]={famille:a.famille,question:a.question,besoin:a.besoin.id,retour:b.retour.ref,suivante:b.question,
    suivanteBesoin:b.besoin.id,commandesConstruites:[prior[13].ticket.actionRef,last[13].ticket.actionRef]};
}
console.log(JSON.stringify({départsParSHA:8,dansLeJeu:2,construits:6,reçusFalsifiésRejetésParSHA:3,empreintes:seals,mesures:sample},null,2));
