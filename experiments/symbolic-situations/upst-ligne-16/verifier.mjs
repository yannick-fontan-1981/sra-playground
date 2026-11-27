import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {isDeepStrictEqual as eq} from 'node:util';
const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','0540f12425e9004dd63b3d701b9e4ea125c17482'];
const hash=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
const fixture=JSON.parse(gunzipSync(execFileSync('git',['show',shas[1]+':tests/fixtures/sic-point-contrasts-public.json.gz'])));
const sig={},summary={};
const raw=d=>d.map(({diagnostic,...r})=>r);
const diag=d=>d.diagnostic.findLast(row=>row.ref===d.ticket.observationRef);
const selected=d=>diag(d).alternatives.find(a=>eq(a.action.data,d.ticket.data));
function matches(d,r,value){
  const q=d.selection,checks=Object.fromEntries(Object.entries(q.predictions).map(([k,forecast])=>[k,forecast===value?'matched':'contradicted']));
  return r.value===value && r.supportChanged===value && eq(r.checks,checks) && r.ticket===d.ticket.id &&
    r.objective===q.objective.id && r.need?.id===q.need.id && r.need.status==='observed' &&
    r.proof===r.evidence && r.evidence===r.observation && r.observation===r.transition?.after && r.transition.before===d.ticket.observationRef &&
    eq(r.transition.command,{action_ref:d.ticket.actionRef,data:d.ticket.data}) && eq(r.newPairs,q.pairs);
}
for(const [j,sha] of shas.entries()){
  function load(group){
    const packet=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json')));assert.equal(packet.sha,sha);
    const {sha:ignore,...payload}=packet,digest=hash(payload);
    if(!j)sig[group]=digest;else assert.equal(digest,sig[group],group);
    return packet;
  }
  const publicRuns={};
  for(const name of ['UPST','EVAS']){
    const ordinary=load(name+'.direct').turns,observed=load(name+'.lecture').turns;
    assert.deepEqual(raw(observed),ordinary);
    publicRuns[name]=observed;
    const sources=fixture[name].observations,events=[];
    for(let i=0;i<sources.length-1;i++){
      const d=observed[i],r=observed[i+1].returned;
      const witness=fixture[name].commands[i];
      assert.equal(d.ticket.actionRef,'ACTION'+witness.id);assert.deepEqual(d.ticket.data,witness.data??{});
      if(d.strategy!=='point_contrast')continue;
      const a=selected(d),q=d.selection;
      assert.ok(a && d.guard && d.family==='information_goal' && d.kind==='experiment' && q.objective.parent==='G_protocol_completion' &&
        q.need.status==='assigned' && q.revision===d.ticket.observationRef && q.admissibles===diag(d).alternatives.length);
      for(const offer of diag(d).alternatives)assert.ok(offer.pairs.every(([k,l])=>offer.predictions[k]!==offer.predictions[l]) && offer.pairs.length);
      assert.deepEqual(q.predictions,a.predictions);assert.deepEqual(q.pairs,a.pairs);
      assert.ok(a.pixels.some(([x,y])=>d.ticket.data.x===x && d.ticket.data.y===y));
      const changed=a.pixels.some(([x,y])=>sources[i].frame[y][x]!==sources[i+1].frame[y][x]);
      assert.ok(matches(d,r,changed),'Support, hypothèses et acquisition '+name+' T'+(i+1));
      events.push({tour:i+1,point:d.ticket.data,offres:q.admissibles,mesure:changed,concordantes:Object.values(r.checks).filter(x=>x==='matched').length,
        contredites:Object.values(r.checks).filter(x=>x==='contradicted').length,paires:r.newPairs.length});
    }
    summary[name]=events;
  }
  const u=publicRuns.UPST,e=publicRuns.EVAS;
  assert.deepEqual(u.slice(0,5).map(d=>d.family),['observed_frontier','observed_frontier','observed_frontier','information_goal','observed_frontier']);
  assert.deepEqual(diag(u[3]).seen,[false,false,true]);assert.equal(diag(u[3]).alternatives.length,3);
  assert.deepEqual(u[3].ticket.data,{x:21,y:13});assert.equal(diag(u[4]).alternatives.length,0);
  assert.deepEqual(diag(u[4]).compared,u[4].returned.newPairs);assert.equal(u[4].strategy,'test_local_input');
  assert.deepEqual(summary.EVAS.map(r=>r.tour),[15,16]);assert.notEqual(e[14].selection.need.id,e[15].selection.need.id);
  assert.ok(e[15].selection.evidence.includes(e[15].returned.observation));
  assert.deepEqual(Object.keys(e[15].selection.predictions).sort(),Object.keys(e[15].returned.checks).filter(k=>e[15].returned.checks[k]==='matched').sort());
  const returns=[];
  for(const mode of ['dedans','dehors']){
    const {turns,intervention:p}=load('UPST.'+mode);assert.deepEqual(turns.slice(0,4),u.slice(0,4));
    const d=turns[3],r=turns[4].returned,a=selected(d);
    const changed=a.pixels.some(([x,y])=>x===p.x && y===p.y && p.avant!==p.apres);
    assert.equal(changed,mode==='dedans');assert.ok(matches(d,r,changed));returns.push(r);
  }
  assert.ok(!matches(u[3],returns[1],true));assert.ok(!matches(u[3],returns[0],false));
  const wrong={...returns[0],objective:e[14].selection.objective.id};
  assert.ok(!matches(u[3],wrong,true));
  const fallbacks={};
  for(const mode of ['sans-positif','paires-connues']){
    const {turns}=load('UPST.'+mode),d=turns[3],log=diag(d);
    assert.deepEqual(raw(turns.slice(0,3)),raw(u.slice(0,3)));assert.equal(d.ticket.observationRef,u[3].ticket.observationRef);
    assert.ok(log.offresAvant===3 && log.offresApres===0 && d.family==='observed_frontier' && d.strategy==='test_local_input');
    assert.ok(mode==='sans-positif'?log.témoinsPositifs===0:log.pairesConnues===2);
    fallbacks[mode]={famille:d.family,stratégie:d.strategy,point:d.ticket.data};
  }
  summary.reprisesConstruites=fallbacks;
  for(const group of ['domaine.dev','domaine.res'])assert.deepEqual(load(group).results.map(x=>x.length),[3,2,0,0]);
}
const trees=shas.map(s=>execFileSync('git',['rev-parse',s+':src'],{encoding:'utf8'}).trim());assert.equal(trees[0],trees[1]);
console.log(JSON.stringify({révisions:shas,arbreSrc:trees[0],résultats:summary,empreintesCommunes:sig},null,2));
