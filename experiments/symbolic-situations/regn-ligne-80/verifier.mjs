import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as equal} from 'node:util';
const dir=process.argv[2],shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','6bfb8ccf9df3aa8597e74f0fd3f30a5744c55b35'];
const read=f=>JSON.parse(readFileSync(join(dir,f))),digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const all=shas.map(sha=>Object.assign({},...['budget','n1','n2'].map(g=>{
  const f=read(sha.slice(0,8)+'.'+g+'.json');assert.equal(f.sha,sha);return f.results;
})));
assert.deepEqual(all[0],all[1]);const cases=all[0],n=cases.nominal.steps;
function owns(row,request,receipt){
  return request.ticket===row.pre.ticket && request.before===row.pre.ref && receipt.ref===row.after.ref && receipt.family===row.after.family;
}
function label(t){return [t.pre.family,t.pre.frontier??t.pre.kind,t.pre.cmd,t.after.matched,t.after.completed];}
for(const {card,steps} of Object.values(cases)){
  assert.equal(steps.length,card.gestes);
  for(const [i,t] of steps.entries()){
    assert.equal(digest(t.pre),t.seal);assert.ok(t.pre.guard);
    if(steps[i+1])assert.equal(steps[i+1].pre.ref,t.after.ref);
  }
}
const results={};
for(const [turn,length] of [[3,1],[8,2]]){
  const s=n[turn-1],p=s.pre,offer=p.offer,ep=offer.before.episode;
  assert.equal(ep.length,length+1);assert.equal(ep[0][0].frame,ep.at(-1)[2].frame);assert.equal(ep.at(-1)[2].ref,p.ref);
  for(const [i,[from,cmd,to]] of ep.entries()){
    assert.equal(cmd,'ACTION3');assert.equal(from.epoch,p.level);assert.equal(to.epoch,p.level);assert.equal(from.score,to.score);
    if(i)assert.equal(from.ref,ep[i-1][2].ref);
  }
  assert.equal(p.focus.access_steps,length);assert.equal(p.focus.return_ref,p.ref);assert.equal(p.edges.length,length);
  const choices=offer.domains.at(-1).offered;assert.equal(choices.length,1);assert.equal(choices[0].question,p.question.question);
  for(let i=0;i<length;i++){
    const t=n[turn-1+i];assert.equal(t.pre.global,'returned_branch_contrast');assert.equal(t.pre.family,'returned_branch_contrast');
    assert.equal(t.pre.step,i);assert.equal(t.pre.cmd,'ACTION3');assert.ok(t.pre.expected);assert.ok(t.after.ref.endsWith(t.pre.expected));
    assert.equal(t.after.matched,true);assert.equal(t.after.seal,false);
  }
  const probe=n[turn-1+length];assert.equal(probe.pre.cmd,'ACTION4');assert.equal(probe.pre.expected,null);
  assert.equal(probe.after.matched,null);assert.equal(probe.after.seal,true);assert.equal(probe.after.completed,p.level);
  for(const key of ['retour','question']){
    const r=cases[key+turn].steps;assert.deepEqual(r.slice(0,turn-1),n.slice(0,turn-1));
    const t=r[turn-1];assert.equal(t.pre.ref,p.ref);assert.deepEqual(t.pre.offer.before.episode,ep);assert.equal(t.pre.offer.decision,null);
    if(key==='retour')assert.deepEqual(t.pre.offer.before.used,offer.before.used.slice(0,-1));
    else{const d=t.pre.offer.domains.at(-1);assert.deepEqual(d.available,choices);assert.deepEqual(d.offered,[]);}
    assert.equal(t.pre.family,'observed_frontier');assert.equal(t.pre.frontier,'test_local_input');assert.equal(t.pre.cmd,'ACTION4');
    assert.equal(t.after.matched,null);assert.equal(t.after.completed,p.level-1);
  }
  const request={ticket:s.pre.ticket,before:s.pre.ref};assert.ok(owns(s,request,s.after));
  assert.ok(!owns(s,request,probe.after));assert.ok(!owns(s,request,n[turn===3?7:2].after));
  results[turn]={accès:length,question:probe.pre.cmd,prochaineÉpoque:n[turn+length].pre.level,
    repli:label(cases['retour'+turn].steps[turn-1]),suite:label(cases['retour'+turn].steps[turn])};
}
const wide=cases.large.steps,first=wide.findIndex((t,i)=>!equal(label(t),label(n[i])));
assert.equal(first,15);assert.equal(wide[15].pre.family,'returned_branch_contrast');assert.equal(n[15].pre.family,'observed_frontier');
assert.equal(n[15].pre.cmd,wide[15].pre.cmd);assert.equal(n[15].after.ref,wide[15].after.ref);assert.equal(n[15].after.matched,true);
console.log(JSON.stringify({shas,départsParRévision:6,gestesParRévision:Object.values(cases).reduce((k,c)=>k+c.steps.length,0),résultats:results,
  premierÉcartDeBudget:{tour:16,borne16:label(n[15]),borne600:label(wide[15])},attributionsInvalidesRejetées:4},null,2));
