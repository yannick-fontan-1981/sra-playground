import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual as same } from 'node:util';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','bb4a99b5ba41531eb70f1dccb6a97a919cefec56'];
const branch='parallel_branch_routing',cell='cell_patch_placement';
function read(sha,group) {
  const f=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json')));
  assert.equal(f.sha,sha);assert.equal(f.group,group);
  return f.results;
}
const runs=shas.map(sha=>Object.assign({},...['nominal','topologie','retrait','réserve'].map(g=>read(sha,g))));
assert.deepEqual(runs[0],runs[1]);
const c=runs[0], r=c.nominal.rows, subs=read(shas[1],'substitution');
const command=t=>[t.cmd,t.data];
const valid=(t,ret)=>ret.ticket===t.id && ret.family===t.family && same(command(t),[ret.cmd,ret.data]);
for(const entry of [...Object.values(c),...Object.values(subs)]){
  for(const [i,current] of entry.rows.slice(0,-1).entries()){
    const next=entry.rows[i+1];
    assert.ok(current.ticket.admitted);assert.ok(valid(current.ticket,next.returned));
    if(next.ticket)assert.equal(next.ticket.ref,next.returned.ref);
  }
}
assert.equal(r.length,17);
const topology=c.topologie.rows[0].ticket.topology;
assert.deepEqual(topology,{sources:[9],cavities:[5,11],lengths:[5],state:[[[12,16]],0]});
assert.equal(c.topologie.rows[0].ticket.id,r[0].ticket.id);

function countLine(kind) {
  const tickets=r.slice(0,-1).filter(row=>row.ticket.kind===kind);
  const admitted=r.slice(0,-1).flatMap(row=>row.offers.filter(o=>o.kind===kind && !o.suppress));
  const responses=tickets.map(row=>r[row.turn].returned);
  return {offres:admitted.length,tickets:tickets.length,retours:responses.length,
    confirmés:responses.filter(x=>x.matched===true).length,contredits:responses.filter(x=>x.matched===false).length,
    indéterminés:responses.filter(x=>x.matched===null).length};
}
const counts={4:countLine(branch),41:countLine(cell)};
assert.deepEqual(Object.values(counts[4]),[9,11,11,6,0,5]);
assert.deepEqual(Object.values(counts[41]),[5,5,5,0,0,5]);
assert.deepEqual(r.slice(0,11).map(row=>row.ticket.mode),['calibrate','calibrate','calibrate','calibrate','move','move','move','propagate','move','move','select']);
assert.deepEqual(r.slice(0,11).filter(row=>row.offers.length===0).map(row=>row.turn),[6,7]);
assert.equal(r[8].returned.reason,'official_boundary');
const nominalMotion=r[1].returned.events.find(e=>e.family==='branch_routing');
assert.deepEqual(nominalMotion.motion.ACTION1,[0,-4]);assert.equal(nominalMotion.refs.ACTION1,r[1].returned.ref);

function assertCell(rows,i,point) {
  const t=rows[i].ticket,ret=rows[i+1].returned,e=ret.events.find(v=>v.kind==='cell_patch_placement_evidence');
  assert.equal(t.family,'public_occurrence_recall');assert.equal(t.kind,cell);assert.equal(t.sub,'cell_patch_composition');
  assert.equal(t.expectedMotif,null);assert.deepEqual(t.field.shape,[2,2]);
  assert.deepEqual(t.point,point);
  const center=t.field.origin.map((x,k)=>x+t.field.pitch[k]*point[k]+Math.floor((t.field.size[k]-1)/2));
  assert.deepEqual([t.data.x,t.data.y],center);
  assert.ok(rows[i].offers.some(o=>o.ref===t.ref && o.kind===cell && same(o.point,t.point) && !o.suppress));
  assert.equal(ret.matched,null);assert.equal(ret.seen.local,0);assert.equal(ret.real.local,0);
  assert.deepEqual(e.models,[]);assert.deepEqual([e.before,e.after],[t.ref,ret.ref]);
  return e;
}
for(let i=11;i<16;i++){
  const e=assertCell(r,i,[0,1]);
  assert.equal(e.unchanged,false);assert.deepEqual(e.refused,[]);
  assert.ok(r[i+1].returned.real.points.every(([,y])=>y===63));
}
assert.deepEqual(r[12].returned.real.points,[[4,63],[5,63]]);
const stationary=c.stationnaire.rows;
assert.deepEqual(stationary.slice(0,12),r.slice(0,12));
const rejected=assertCell(stationary,11,[0,1]);
assert.deepEqual(stationary[12].returned.realFrames,[2]);assert.deepEqual(stationary[12].returned.servedFrames,[0]);
assert.equal(rejected.unchanged,true);assert.deepEqual(rejected.refused,[r[11].ticket.trial]);
assert.equal(stationary[12].ticket.kind,branch);assert.equal(stationary[12].ticket.cmd,'ACTION4');
assert.equal(stationary[13].returned.matched,true);
for(const [line,i] of [[4,0],[41,11]]){
  const withdrawn=c['retrait'+line].rows;
  assert.deepEqual(withdrawn.slice(0,i),r.slice(0,i));
  assert.ok(withdrawn[i].offers.some(o=>o.suppress && o.ref===r[i].ticket.ref));
  const chosen=subs['autre'+line].rows, choice=subs['autre'+line].choices;
  assert.equal(choice.length,1);
  assert.equal(chosen[i].ticket.ref,r[i].ticket.ref);assert.deepEqual(chosen.slice(0,i),r.slice(0,i));
  assert.equal(chosen[i].ticket.family,r[i].ticket.family);assert.notDeepEqual(command(chosen[i].ticket),command(r[i].ticket));
  const empty=subs['vide'+line].rows;
  for(let k=i;k<withdrawn.length;k++){
    assert.deepEqual(empty[k].ticket,withdrawn[k].ticket);
    assert.deepEqual(empty[k].returned,withdrawn[k].returned);
  }
}
const off4=c.retrait4.rows;
assert.deepEqual(command(off4[0].ticket),command(r[0].ticket));assert.equal(off4[0].ticket.family,'observed_frontier');
assert.equal(off4[1].ticket.cmd,'ACTION1');assert.equal(off4[1].ticket.kind,branch);
assert.ok(!off4[1].returned.events.some(e=>e.motion?.ACTION1));
const off41=c.retrait41.rows;
assert.deepEqual(command(off41[11].ticket),['ACTION4',{}]);assert.equal(off41[11].ticket.kind,branch);
assert.deepEqual(off41[11].ticket.expected,[[[12,16],[28,24],[28,36]],0]);assert.equal(off41[12].returned.matched,true);
assert.equal(off41[12].ticket.cmd,'ACTION4');
const alt4=subs.autre4.rows,alt41=subs.autre41.rows;
assert.deepEqual(subs.autre4.choices[0].ordered,['ACTION1','ACTION2','ACTION3','ACTION4','ACTION5']);
assert.equal(alt4[0].ticket.cmd,'ACTION4');
const altEvent=alt4[1].returned.events.find(e=>e.family==='branch_routing');
assert.deepEqual(altEvent.before,nominalMotion.before);assert.deepEqual(altEvent.motion.ACTION4,[4,0]);
assert.equal(altEvent.refs.ACTION4,alt4[1].returned.ref);assert.equal(alt4[1].ticket.cmd,'ACTION1');
assert.deepEqual(subs.autre41.choices[0].ordered,[[0,1],[1,0]]);
assertCell(alt41,11,[1,0]);assert.deepEqual(alt41[12].returned.real,r[12].returned.real);
assert.deepEqual(command(alt41[12].ticket),['ACTION6',{x:13,y:25}]);
const forged=[];
for(const i of [0,11]){
  const t=r[i].ticket, ret=r[i+1].returned;
  const others=r.slice(0,-1).filter(row=>row.ticket.id!==t.id);
  const equalCommand=others.filter(row=>same(command(row.ticket),command(t)));
  const candidates=equalCommand.length?equalCommand:others;
  candidates.sort((a,b)=>Math.abs(a.turn-i-1)-Math.abs(b.turn-i-1)||a.turn-b.turn);
  assert.ok(!valid(t,{...ret,ticket:candidates[0].ticket.id}));
  forged.push({tour:i+1,ticketEmprunté:candidates[0].turn,mêmeCommande:same(command(candidates[0].ticket),command(t))});
}
const stats=shas.map((sha,i)=>{
  const cases=i?{...runs[i],...subs}:runs[i];
  const report=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  const auteur=i?8:4;
  assert.match(report,new RegExp('pass '+auteur+'\\b'));assert.match(report,/fail 0/);
  return {sha,départs:Object.keys(cases).length,dontLectureInitiale:1,
    gestes:Object.values(cases).reduce((sum,r)=>sum+r.rows.length-1,0),testsAuteur:auteur};
});
console.log(JSON.stringify({stats,nominal:counts,fauxReçusRejetés:forged,topologie:topology,
  autreCalibrage:{commande:alt4[0].ticket.cmd,delta:altEvent.motion.ACTION4,suite:alt4[1].ticket.cmd},
  placement:{point:command(r[11].ticket),autrePoint:command(alt41[11].ticket),variationFinale:r[12].returned.real,
    suite:command(r[12].ticket),suiteStationnaire:command(stationary[12].ticket),repli:command(off41[11].ticket)}},null,2));
