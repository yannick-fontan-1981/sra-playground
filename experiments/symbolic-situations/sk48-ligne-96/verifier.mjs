import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as same} from 'node:util';
const dir=process.argv[2],seals={},totals={};
const pixels=JSON.parse(readFileSync(join(dir,'pixels.json')));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const engines=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','08fa10a6b9986e7028551fbfc9d9e16eb83726b7'];
function project(view,palette,negative=false){
  const id=c=>palette.includes(c)?palette[1-palette.indexOf(c)]:c;
  const pieces=view.pieces.map(([c,box])=>{
    const v=negative&&c!==8?(c===9?14:9):c;
    return ['material:'+id(v),box];
  }).sort(([a],[b])=>a<b?-1:1);
  return {root:view.root,tip:view.tip,pieces};
}
function checkControls(facts,steps){
  for(const [i,r] of steps.slice(0,4).entries()){
    const control=facts.controls[r.ticket.command],old=pixels.prefix[i],now=pixels.prefix[i+1];
    assert.deepEqual(control.translation,[now.root[1]-old.root[1],now.root[0]-old.root[0]]);
    assert.equal(control.extent,now.tip-old.tip);
    assert.deepEqual(control.refs,[r.pre.ref,r.returned.ref]);assert.equal(r.pre.model,'calibrate');
  }
}
for(const engine of engines){
  const count={départsInitiaux:0,complément:0,nonAtteints:0,contradictions:0,reprisesConfirmées:0,refusSansTémoin:0,niveauxTerminés:0};
  let historique;
  for(const g of ['historique','développement','réserve','complément']){
    const file=JSON.parse(readFileSync(join(dir,engine.slice(0,8)+'.'+g+'.json')));
    assert.equal(file.sha,engine);assert.equal(file.op,engines[1]);
    const cases=file.results,digest=sha(cases);
    if(seals[g])assert.equal(digest,seals[g]);else seals[g]=digest;
    assert.equal(cases.length,['historique','complément'].includes(g)?2:4);
    if(g==='complément')count.complément+=cases.length;else count.départsInitiaux+=cases.length;
    for(const [i,test] of cases.entries()){
      const {negative,alternate,result:{steps,stop},card}=test;
      if(i%2===1)assert.deepEqual(steps.slice(0,12),cases[i-1].result.steps.slice(0,12));
      for(const r of steps){assert.ok(r.guard.admitted);assert.equal(sha(r.pre),r.seal);}
      const palette=card.couleurs;
      if(g==='développement'){
        assert.deepEqual(palette,[9,14]);assert.equal(steps.length,4);assert.equal(stop.reason,'frontier_unknown');
        const facts=stop.beforeChoice.data;assert.deepEqual(facts.order,['8','9','14']);
        assert.equal(facts.ref,steps[3].returned.ref);assert.deepEqual(facts.evidence,[]);checkControls(facts,steps);
        assert.deepEqual(steps.map(r=>r.ticket.command),historique.steps.slice(0,4).map(r=>r.ticket.command));
        for(const [j,r] of steps.entries())assert.deepEqual(r.returned.physical,project(pixels.prefix[j+1],palette));
        assert.deepEqual(steps,cases[0].result.steps);assert.equal(historique.steps[4].pre.model,'conditional_composition');
        count.nonAtteints++;continue;
      }
      const miss=steps[11],after=miss.returned,fp=steps[12],facts=(fp?.beforeChoice??stop.beforeChoice).data;
      assert.equal(miss.ticket.command,'ACTION2');assert.equal(miss.pre.model,'conditional_composition');
      assert.equal(after.matched,false);assert.equal(after.seal,true);count.contradictions++;
      for(const [j,r] of steps.slice(0,12).entries()){
        assert.deepEqual(r.pre.physical,project(pixels.prefix[j],palette));
        assert.deepEqual(r.returned.physical,project(pixels.prefix[j+1],palette,negative&&j===11));
      }
      assert.deepEqual(after.physical.root,miss.pre.expected.root);assert.equal(after.physical.tip,miss.pre.expected.tip);
      assert.equal(after.physical.pieces.filter(([id,p])=>same(new Map(miss.pre.expected.pieces).get(id),p)).length,1);
      // Le seul accord du support donnerait un faux positif pour la prédiction complète.
      assert.ok(!same(after.physical,miss.pre.expected));
      checkControls(facts,steps);assert.equal(facts.ref,after.ref);
      assert.equal(facts.evidence.length,1);const e=facts.evidence[0];
      assert.equal(e.before,miss.pre.ref);assert.equal(e.after,after.ref);assert.deepEqual(e.expected,miss.pre.expected);assert.deepEqual(e.observed,after.physical);
      if(negative){
        assert.equal(steps.length,12);assert.equal(stop.reason,'frontier_unknown');assert.equal(e.chain,null);
        assert.ok(!facts.previous);count.refusSansTémoin++;continue;
      }
      assert.equal(e.chain,true);assert.equal(facts.previous.status,'admitted');
      const cmd=alternate?'ACTION1':'ACTION3',other=alternate?'ACTION3':'ACTION1';
      assert.equal(fp.ticket.command,cmd);assert.equal(fp.kind,'rooted_line');assert.equal(fp.family,'public_occurrence_recall');
      assert.equal(fp.pre.strategy,alternate?'reposition_root_before_contact':'revise_rooted_contact');
      assert.equal(fp.pre.ref,after.ref);assert.deepEqual(fp.pre.evidence,[miss.pre.ref,after.ref]);
      assert.equal(fp.returned.matched,true);assert.equal(fp.returned.need.id,facts.previous.id);assert.equal(fp.returned.need.status,'assigned');
      assert.deepEqual(fp.pre.expected,fp.returned.physical);assert.deepEqual(fp.returned.physical,project(pixels.alternatives[cmd],palette));
      assert.ok(!same(fp.pre.expected,project(pixels.alternatives[other],palette)));
      if(alternate)assert.equal(fp.beforeChoice.seal,cases[i-1].result.steps[12].beforeChoice.seal);
      count.reprisesConfirmées++;
      if(g==='historique'){assert.equal(steps.length,alternate?21:19);assert.equal(stop.completed,1);assert.equal(steps.at(-1).returned.need.status,'satisfied');count.niveauxTerminés++;if(!alternate)historique=test.result;}
      else{assert.equal(steps.length,13);assert.equal(stop.completed,0);}
    }
  }
  assert.deepEqual(count,{départsInitiaux:10,complément:2,nonAtteints:4,contradictions:8,reprisesConfirmées:4,refusSansTémoin:4,niveauxTerminés:2});
  totals[engine]=count;
}
console.log(JSON.stringify({totauxParRévision:totals,empreintes:seals},null,2));
