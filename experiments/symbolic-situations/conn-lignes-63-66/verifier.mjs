import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyTimeline} from './chronologie.mjs';

const dir=process.argv[2],read=(file)=>JSON.parse(readFileSync(join(dir,file)));
const versions=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','f8607d2ac0dac47900da3504365b3968a523a549'];
const views=versions.map(sha=>Object.assign({},...['initial','appui','temps'].map(g=>{
  const f=read(sha.slice(0,8)+'.'+g+'.json');assert.equal(f.sha,sha);return f.results;
})));
assert.deepEqual(views[0],views[1]);const results=views[0],nominal=results.nominal;
const line='repeated_line_completion',support='supported_line_preparation';
const xy=t=>[t.point?.x,t.point?.y],info=t=>[t.famille,t.type,t.point,t.retour?.raison];
const get=(t,kind)=>t.acquisitions.find(e=>e.kind===kind);
assert.equal(Object.keys(results).length,9);assert.equal(nominal.length,17);
for(const rows of Object.values(results)){
  for(const [i,r] of rows.slice(0,-1).entries()){
    assert.ok(r.ticket && r.admis);assert.equal(rows[i+1].retour.ticket,r.ticket);
    if(rows[i+1].ticket)assert.equal(rows[i+1].retour.ref,rows[i+1].ref);
  }
}
assert.deepEqual(nominal.slice(0,16).filter(t=>t.type===line).map(t=>t.i),[1,2,3,4,5]);
assert.deepEqual(nominal.slice(0,16).filter(t=>t.type===support).map(t=>t.i),[13,14,15,16]);
for(const t of nominal.slice(0,5)){
  assert.equal(t.sousQuestion,'recurrent_series');assert.equal(t.origine,3);assert.equal(t.longueur,4);assert.equal(t.palette,11);assert.equal(t.supports,4);
  const n=nominal[t.i],event=get(n,'repeated_line_trial');assert.equal(event.before,t.ref);assert.equal(event.after,n.retour.ref);
  assert.equal(n.retour.matched,t.i===5?null:t.i!==4);
  if(t.i<5)assert.equal(n.carré,n.retour.matched);
}
assert.equal(nominal[5].retour.raison,'official_boundary_or_terminal');
const scored=get(nominal[5],'repeated_line_scored');assert.equal(scored.candidate_length,4);assert.equal(scored.source,nominal[5].ref);
for(const t of nominal.slice(12,16)){
  const n=nominal[t.i],e=get(n,'supported_insertion_observation');
  assert.equal(t.sousQuestion,'recurrent_series');assert.equal(t.longueur,4);assert.ok(t.refs.includes(scored.source));
  assert.equal(e.source,t.ref);assert.equal(e.after,n.retour.ref);assert.equal(n.retour.matched,true);
  assert.equal(n.retour.raison,'prepared_contribution_and_compatible_response_observed');
}
const single=results['champ-seul'][0];assert.equal(single.preuve.champs,1);assert.equal(single.famille,'observed_frontier');
for(const name of ['finales','finale-T12','sans-but']){
  const rows=results[name];assert.ok(rows.length>=14);
  for(let i=0;i<=12;i++)assert.equal(rows[i].ref,nominal[i].ref);
  const decision=rows[12];assert.deepEqual(decision.preuve.buts,nominal[12].preuve.buts);
  const sampleFlags=decision.preuve.échantillons.map(s=>s[3]);
  assert.deepEqual(sampleFlags,name==='finales'?[false,false,false]:name==='finale-T12'?[true,true,false]:[true,true,true]);
  for(const [i,s] of decision.preuve.échantillons.entries())assert.deepEqual(s.slice(0,3),nominal[12].preuve.échantillons[i].slice(0,3));
  assert.equal(decision.famille,'observed_frontier');assert.deepEqual(xy(decision),[10,25]);assert.equal(rows[13].retour.ticket,decision.ticket);
  if(name==='sans-but'){
    assert.equal(rows[13].type,support);assert.deepEqual(xy(rows[13]),[31,46]);assert.equal(rows[14].retour.matched,true);
  }else{
    assert.equal(rows[13].famille,'observed_frontier');assert.deepEqual(xy(rows[13]),[10,18]);
  }
}
const alternates={};
for(const [turn,type] of [[1,line],[13,support]]){
  for(const mode of ['retrait','substitution']){
    const name=mode+'-'+(turn===1?63:66),rows=results[name],d=rows[turn-1],n=rows[turn];
    assert.equal(d.preuve.omis,type);assert.equal(d.ref,nominal[turn-1].ref);
    assert.notDeepEqual(xy(d),xy(nominal[turn-1]));assert.equal(n.retour.ticket,d.ticket);
    if(mode==='substitution'){
      assert.equal(d.famille,'public_occurrence_recall');assert.equal(d.type,type);assert.equal(n.type,type);assert.equal(n.retour.matched,true);
      const e=get(n,turn===1?'repeated_line_trial':'supported_insertion_observation');assert.equal(e.before??e.source,d.ref);assert.equal(e.after,n.ref);
      assert.deepEqual(xy(d),turn===1?[47,22]:[31,46]);assert.deepEqual(xy(n),turn===1?[15,13]:[52,32]);
    }else{
      assert.equal(d.famille,'observed_frontier');assert.deepEqual(xy(d),turn===1?[1,61]:[10,25]);
      assert.equal(n.retour.matched,null);assert.equal(n.type,type);assert.deepEqual(xy(n),turn===1?[15,13]:[31,46]);
      assert.equal(rows[turn+1].retour.matched,true);
    }
    alternates[name]={ticket:info(d),retour:n.retour.matched,raison:n.retour.raison??null,suivant:info(n)};
  }
}
const stockFile=join(dir,'f8607d2a.tests-auteur.txt');
const stock=existsSync(stockFile)?readFileSync(stockFile,'utf8'):null;
if(stock){assert.match(stock,/pass 7/);assert.match(stock,/fail 0/);}
const temporal=Object.fromEntries(['finales','finale-T12','sans-but'].map(n=>[n,{observations:results[n][12].preuve.échantillons.map(s=>s.slice(2)),ticket:info(results[n][12]),suivant:info(results[n][13])}]));
console.log(JSON.stringify({versions,départsParSHA:9,occurrences:{63:5,66:4},testsDeLAuteur:stock?7:null,
  empreinteCommune:createHash('sha256').update(JSON.stringify(results)).digest('hex'),chronologie:await verifyTimeline(nominal),alternates,temporal},null,2));
