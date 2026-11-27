import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as same} from 'node:util';
const [dir]=process.argv.slice(2),engines=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','e2e5b52fe4476f169c1ab1988d23a5f5368e305c','21fd159e8339ee464a5b7bee0824b93ccefe9995'];
const known={},seals={},samples={};
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function tied(row){return row.sujetsVisibles.length===1 && row.sujet===row.sujetsVisibles[0].forme;}
function physical(p,q){
  assert.equal(q.reçu.ticket,p.ticket.id);assert.equal(q.reçu.ref,q.ticket.observationRef);
  assert.deepEqual(q.porteurs,p.porteurs);assert.equal(q.reçu.matched,true);
  if(q.compte){
    assert.equal(q.compte.avant,p.ticket.observationRef);assert.equal(q.compte.après,q.reçu.ref);assert.deepEqual(q.compte.delta,[0,0]);
  }
}
function digestRow(r){return [r.ticket?.id,r.action,r.index,r.taille,r.préparé,r.plan,r.sujet,r.parent,r.support,r.reçu?.matched,r.reçu?.scellé];}
for(const [revision,engine] of engines.entries()){
  const fixed=revision===2;
  function load(g){
    const file=JSON.parse(readFileSync(join(dir,engine.slice(0,8)+'.'+g+'.json')));
    assert.equal(file.sha,engine);const cases=file.results;(seals[engine]??={})[g]=hash(cases);
    if(!revision)known[g]=cases;else if(!fixed && g!=='extraction')assert.deepEqual(cases,known[g]);
    return cases;
  }
  const h=load('historique')[0].turns;
  const capped=load('catalogue')[0].turns;
  assert.equal(capped.length,17);assert.equal(capped[16].raison,'session_action_budget');assert.ok(!capped[16].ticket);
  assert.deepEqual(capped.slice(0,16).map(digestRow),h.slice(0,16).map(digestRow));
  assert.equal(capped[16].reçu.ticket,capped[15].ticket.id);assert.equal(capped[16].reçu.matched,true);
  assert.equal(h.length,33);assert.ok(h.slice(0,32).every(r=>r.famille==='public_occurrence_recall' && r.kind==='reception_service' && r.autorisé));
  assert.deepEqual([h[0].plan,h[0].action,h[14].plan,h[15].plan,h[15].taille,h[16].taille],['control_probe','ACTION1','access','reception_observation',1,8]);
  assert.equal(h[15].confirmé,false);assert.equal(h[16].confirmé,true);physical(h[15],h[16]);physical(h[16],h[17]);
  assert.deepEqual([h[18].reçu.matched,h[18].plan,h[18].action,h[18].ticket.level],[null,'control_probe','ACTION1',2]);
  if(revision)assert.deepEqual(h.map(digestRow),known.historique[0].turns.map(digestRow));
  let oldSubject=h[16].sujet,changed=0;const scopes=[];
  for(const g of ['développement','réserve','témoin']){
    const cases=load(g);
    assert.equal(cases.length,g==='témoin'?1:2);
    if(cases.length===2){
      const [sameCase,changedCase]=cases;assert.equal(sameCase.terrain,changedCase.terrain);
      assert.notDeepEqual(sameCase.badge,changedCase.badge);assert.deepEqual(sameCase.turns.slice(0,17),changedCase.turns.slice(0,17));
    }
    for(const [i,c] of cases.entries()){
      const t=c.turns,original=t[16],next=t[17],again=t[18],changedRequest=c.variant!=='même';
      assert.equal(t.length,19);assert.equal(original.sujet,oldSubject);assert.equal(original.taille,8);
      const dépenses=[16,17,18].map(i=>t.slice(0,i).filter((p,j)=>p.plan==='reception_observation' && t[j+1].reçu?.ticket===p.ticket.id).length);
      assert.deepEqual(dépenses,[1,2,3]);assert.equal(original.compte.dépensé,1);
      physical(original,next);physical(next,again);
      assert.deepEqual(next.support,original.support);assert.deepEqual(next.porteurs,[original.support]);
      assert.equal(next.parent,'G_official_completion');assert.deepEqual(next.contribution,original.contribution);
      assert.ok([next,again].every(r=>r.action==='ACTION4' && r.plan==='reception_observation' && r.autorisé));
      assert.ok(next.ticket.id.endsWith(':native:18'));assert.ok(again.ticket.id.endsWith(':native:19'));
      assert.equal(next.sujetsVisibles.length,1);const current=next.sujetsVisibles[0];
      assert.equal(current.forme!==oldSubject,changedRequest);
      if(changedRequest){
        changed++;
        scopes.push(current.forme);assert.deepEqual(current.boîte.slice(0,2),c.positionMobile);
        assert.equal(c.badge.length,g==='témoin'?3:4);assert.notDeepEqual(original.sujetsVisibles[0].boîte,current.boîte);
      }
      if(g==='réserve')assert.equal(Math.abs(next.support[0]-h[16].support[0]),1);
      if(fixed && changedRequest){
        assert.equal(next.compte.sujetMesuré,current.forme);assert.equal(again.compte.sujetMesuré,current.forme);
        assert.deepEqual([next.compte.dépensé,again.compte.dépensé],[2,3]);
        assert.deepEqual([next.reçu.scellé,next.reçu.raison,next.index,next.taille,next.confirmé,next.compte.stationnaire],
          [true,'reception_subject_changed',0,1,false,null]);assert.equal(next.préparé,next.reçu.ref);assert.ok(tied(next));
        assert.deepEqual([again.index,again.taille,again.confirmé],[0,8,true]);assert.equal(again.préparé,again.reçu.ref);assert.ok(tied(again));
        assert.deepEqual(again.compte.stationnaire,again.support);
        // Mutant : même commande et bon récepteur, mauvais sujet.
        assert.ok(!tied({...next,sujet:oldSubject}));
      }else{
        assert.deepEqual([next.reçu.scellé,next.index,next.taille,again.index,again.taille],[false,1,8,2,8]);
        assert.equal(next.préparé,original.préparé);assert.equal(again.préparé,original.préparé);
        assert.equal(next.confirmé,true);assert.equal(tied(next),!changedRequest);
      }
      if(fixed){
        const before=known[g][i].turns;
        const first=t.findIndex((r,i)=>!same(digestRow(r),digestRow(before[i])));
        assert.equal(first,changedRequest?17:-1);
      }
      if(g==='témoin')samples[engine]={auRetourT17:{ticket:next.reçu.ticket,position:next.reçu.matched,scellé:next.reçu.scellé},
        ticket18:{id:next.ticket.id,action:next.action,index:next.index,longueur:next.taille,préparé:next.préparé,sujet:next.sujet},ticket19:{index:again.index,longueur:again.taille,sujet:again.sujet}};
    }
  }
  assert.equal(changed,3);assert.equal(new Set(scopes).size,3);
  if(revision){
    const x=load('extraction')[0].turns;assert.deepEqual(x.slice(0,16),h.slice(0,16));
    assert.deepEqual([x[16].offreRemplacée,x[16].index,x[16].taille,x[16].action,x[16].confirmé],[true,0,1,'ACTION4',false]);
    assert.equal(x[17].reçu.matched,true);assert.equal(x[17].index,0);assert.equal(x[17].taille,8);assert.equal(x[17].préparé,x[17].ticket.observationRef);
  }
}
console.log(JSON.stringify({départs:{gel:7,extraction:8,correctif:8},changementsDeSujetParSHA:3,ticketsCatalogueParSHA:16,ticketsParcoursProlongéParSHA:32,premierTicketDifférent:18,casL:samples,empreintes:seals},null,2));
