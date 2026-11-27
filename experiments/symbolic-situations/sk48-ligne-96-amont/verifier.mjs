import assert from 'node:assert/strict';
import {join} from 'node:path';
import {isDeepStrictEqual as equal} from 'node:util';
import {baseline,common,groups,hash,read} from './temoins.mjs';

const [dir,pixelsFile,oldDir]=process.argv.slice(2);
const old=read(new URL('temoins.json',import.meta.url)),pixels=read(pixelsFile);
if(oldDir)assert.deepEqual(baseline(oldDir),old);
const sha='4946cf0297734b9464fc52256af6fb27846f3bad';
function project(view,pair,negative=false){
  function label(id){
    if(negative && id!==8)id=id===9?14:9;
    return 'material:'+(pair.includes(id)?pair[1-pair.indexOf(id)]:id);
  }
  const pieces=view.pieces.map(([id,box])=>[label(id),box]).sort(([a],[b])=>a.localeCompare(b,'en'));
  return {root:view.root,tip:view.tip,pieces};
}
function checkProjection(result){
  const [search,proposal]=result.choice5,step=result.steps[4];
  assert.equal(search.stage,'recherche');assert.equal(proposal.stage,'proposition');
  assert.equal(search.ref,step.ref);assert.equal(proposal.ref,step.ref);assert.equal(proposal.action.action_ref,step.cmd);
  assert.equal(step.model,'conditional_composition');assert.equal(step.cmd,'ACTION1');
  const goal=search.goals.find(g=>g.action===step.cmd);
  assert.equal(goal.projection,false);assert.equal(goal.observed,false);
  assert.deepEqual(goal.trial,proposal.trial);assert.equal(goal.trial.status,'compatible_unordered');
  const stations=Object.fromEntries(goal.trial.groups.flatMap(g=>g.members.map(m=>[m.type_ref,g.station])));
  const order=goal.trial.requested.map(id=>stations[id]);assert.deepEqual(order,[20,26,26]);
}
const bilan={};
for (const group of [...groups,'nouvelle','banc']){
  const {sha:actual,results}=read(join(dir,group+'.json'));assert.equal(actual,sha);
  assert.equal(results.length,['banc','historique'].includes(group)?2:4);
  const count={départs:results.length,contradictionT12:0,reprisesConfirmées:0,abstentions:0,niveauxTerminés:0,ticketsCommuns:0};
  const parent=group==='banc'?read(join(dir,'banc-parent.json')):null;
  if(parent){
    assert.equal(parent.sha,'08fa10a6b9986e7028551fbfc9d9e16eb83726b7');
    const rows=parent.results.map(({alternate,negative,card,result})=>({alternate,negative,card,result}));
    assert.equal(hash(rows),'5667aecba3050407242d2d9b228100afd2ed0630cf36bb57a411d99b4ddf3b23');
  }
  for(const [i,{card,negative,alternate,result}] of results.entries()){
    assert.equal(alternate,Boolean(i%2));assert.equal(negative,i>=2);
    const {steps,completed,stop}=result;
    if(old[group]){
      const b=old[group][i];assert.equal(hash(card),b.fiche);assert.equal(hash(steps.slice(0,b.tickets).map(common)),b.préfixe);
      assert.equal(completed,b.niveaux);
      if(group==='développement'){assert.equal(b.tickets,4);assert.equal(b.arrêt,'frontier_unknown');}
      else{assert.equal(steps.length,b.tickets);assert.equal(stop,b.arrêt);}
      count.ticketsCommuns+=b.tickets;
    }
    if(parent){
      const row=parent.results[i];assert.deepEqual(card,row.card);
      assert.deepEqual(steps.map(common),row.result.steps.map(s=>[s.ticket.command,s.ticket.id,s.pre.ref,s.pre.model,s.pre.need,s.pre.strategy,
        s.guard,s.pre.expected,s.returned,s.pre.evidence,s.beforeChoice?.seal??null]));
      count.ticketsCommuns+=steps.length;
    }
    checkProjection(result);
    assert.ok(steps.every(s=>s.guard.admitted));
    const t12=steps[11],ret=t12.after;
    assert.equal(t12.cmd,'ACTION2');assert.equal(ret.matched,false);assert.equal(ret.seal,true);
    for(const [j,s] of steps.slice(0,12).entries())assert.deepEqual(s.after.physical,project(pixels.prefix[j+1],card.couleurs,negative && j===11));
    assert.deepEqual(ret.physical.root,t12.expected.root);assert.equal(ret.physical.tip,t12.expected.tip);
    const positions=new Map(t12.expected.pieces);
    assert.equal(ret.physical.pieces.filter(([id,box])=>equal(positions.get(id),box)).length,1);
    count.contradictionT12++;
    if(negative){
      assert.equal(steps.length,12);assert.equal(stop,'frontier_unknown');count.abstentions++;
    }else{
      const t=steps[12],cmd=alternate?'ACTION1':'ACTION3';
      assert.equal(t.cmd,cmd);assert.equal(t.strategy,alternate?'reposition_root_before_contact':'revise_rooted_contact');
      assert.equal(t.ref,ret.ref);assert.deepEqual(t.evidence,[t12.ref,ret.ref]);
      assert.equal(t.after.matched,true);assert.ok(t.need);assert.equal(t.need,t.after.need.id);
      assert.deepEqual(t.expected,t.after.physical);assert.deepEqual(t.after.physical,project(pixels.alternatives[cmd],card.couleurs));
      if(alternate)assert.equal(t.pre,results[0].result.steps[12].pre);
      const full=card.gestes===24;assert.equal(steps.length,full?(alternate?21:19):13);assert.equal(completed,full?1:0);
      count.reprisesConfirmées++;count.niveauxTerminés+=completed;
    }
  }
  bilan[group]=count;
}
const {stations,résultats}=read(join(dir,'stations.json'));
assert.equal(new Set(résultats.map(r=>r.requested.join(','))).size,6);
for(const {requested,admissible,statut} of résultats){
  assert.deepEqual([...requested].sort(),Object.keys(stations).sort());
  assert.equal(admissible,requested.every((v,i)=>i===0||stations[v]>=stations[requested[i-1]]));
  assert.equal(statut,admissible?'compatible_unordered':'incompatible');
}
assert.equal(résultats.filter(r=>r.admissible).length,2);
console.log(JSON.stringify({sha,groupes:bilan,ordres:{compatibles:2,inversionsRefusées:4}},null,2));
