import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','f768bac6c4c9c34d230b63fe6cec39663164b6ae'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
const transfer='ordered_support_transfer',kind='conditional_ordered_support_transfer';
function read(sha,g){
  const f=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+g+'.json')));
  assert.equal(f.sha,sha);assert.equal(f.group,g);return f.cases;
}
const runs=shas.map(sha=>Object.assign({},...['nominal','contrôles','réserve'].map(g=>read(sha,g))));
assert.deepEqual(runs[0],runs[1]);
const c=runs[0],n=c.prolongé.rows,cat=c.catalogue.rows;
const t=(rows,i)=>rows[i-1].ticket,r=(rows,i)=>rows[i].ret;
function find(rows,i){
  const event=rows.flatMap(row=>row.ret?.events??[]).find(e=>e.event.after===r(rows,i).ref);
  assert.ok(event);assert.equal(event.event.before,t(rows,i).ref);
  return event;
}
const choice=t=>[t.owner,t.kind,t.cmd,t.data,t.index];
for(const {rows} of Object.values(c))for(let i=0;i<rows.length-1;i++){
  const ticket=rows[i].ticket,ret=rows[i+1].ret;
  assert.ok(ticket.admitted);assert.equal(ticket.id,ret.id);assert.equal(ticket.owner,ret.owner);
  if(rows[i+1].ticket)assert.equal(rows[i+1].ticket.ref,ret.ref);
}
assert.equal(cat.length,17);assert.equal(n.length,20);
assert.equal(c.catalogue.budget,16);assert.equal(c.prolongé.budget,19);
for(let i=1;i<=16;i++){
  assert.deepEqual(t(cat,i),t(n,i));assert.deepEqual(r(cat,i),r(n,i));
  const ticket=t(n,i),ret=r(n,i),entry=find(n,i).event;
  assert.deepEqual([ticket.owner,ticket.kind,ticket.cmd,ticket.index],[transfer,kind,'ACTION6',(i-1)%2]);
  const boundary=[6,16].includes(i);
  assert.deepEqual([entry.selection_observed,entry.transfer_observed,entry.official_progress,entry.parent],
    [i%2===1,!boundary&&i%2===0,boundary,'G_official_completion']);
  assert.equal(ret.matched,boundary?null:true);
  if(i%2===0&&!boundary)assert.deepEqual(n[i].configuration,ticket.plan.expected);
}
assert.equal(t(n,17).owner,'public_framed_transfer');
const width=p=>p.member.bbox[2]-p.member.bbox[0]+1;
const on=[1,3,7].map(i=>{
  const {plan,data}=t(n,i);
  return {i,piles:plan.configuration,source:plan.source,destination:plan.destination,largeur:width(plan),point:data,cible:plan.target};
});
assert.deepEqual(on,[
  {i:1,piles:[[11,7],[],[]],source:0,destination:1,largeur:7,point:{x:13,y:51},cible:2},
  {i:3,piles:[[11],[7],[]],source:0,destination:2,largeur:11,point:{x:13,y:51},cible:2},
  {i:7,piles:[[15,11,7],[],[],[]],source:0,destination:1,largeur:7,point:{x:11,y:50},cible:3},
]);
assert.ok(t(n,3).refs.includes(r(n,2).ref));
assert.deepEqual(n[2].configuration,[[11],[7],[]]);
assert.deepEqual(n[8].configuration,[[15,11],[7],[],[]]);
assert.deepEqual(t(n,2).data,{x:31,y:51});
assert.deepEqual(t(n,8).data,{x:25,y:50});
assert.equal(n[6].score,1);assert.equal(n[16].score,2);

// Énumère les configurations abstraites pour vérifier la longueur minimale à partir des seules piles.
function distance(start,target){
  const visited=new Set([JSON.stringify(start)]), pending=[[start,0]], size=start.flat().length;
  for(const [piles,steps] of pending){
    if(piles[target].length===size)return steps;
    for(const [i,pile] of piles.entries()){
      const top=pile.at(-1);if(top===undefined)continue;
      for(const [j,dest] of piles.entries()){
        if(i===j || (dest.length>0 && dest.at(-1)<=top))continue;
        const next=piles.map(p=>p.slice());next[i].pop();next[j].push(top);
        const k=JSON.stringify(next);
        if(!visited.has(k)){visited.add(k);pending.push([next,steps+1]);}
      }
    }
  }
  return Infinity;
}
for(const step of on){
  const after=step.piles.map(x=>x.slice());after[step.source].pop();after[step.destination].push(step.largeur);
  assert.equal(distance(step.piles,step.cible),1+distance(after,step.cible));
}
assert.deepEqual(on.map(s=>distance(s.piles,s.cible)),[3,2,5]);

const off=c.retrait.rows;
assert.deepEqual(c.retrait.interventions,[{tour:1,ref:t(n,1).ref,source:0}]);
assert.equal(t(off,1).ref,t(n,1).ref);
assert.deepEqual([t(off,1).owner,t(off,2).owner],['public_framed_transfer','public_framed_transfer']);
assert.deepEqual([t(off,1).data,t(off,2).data],[{x:13,y:50},{x:13,y:48}]);
assert.ok(r(off,1).pixels[0]>0&&r(off,2).pixels[0]>0);
assert.deepEqual(choice(t(off,3)),choice(t(n,1)));
assert.deepEqual(choice(t(off,4)),choice(t(n,2)));
assert.equal(find(off,4).event.transfer_observed,true);
const first=t(n,1), selected=r(n,1), border=selected.bbox;
assert.equal(first.plan.member.value,14);assert.equal(selected.pixels[0],28);
const [l,top,right,bottom]=first.plan.member.bbox;
assert.ok(border[0]<l&&border[1]<top&&border[2]>right&&border[3]>bottom);
for(const name of ['marque','autreMembre']){
  const rows=c[name].rows, outcome=r(rows,1);
  assert.deepEqual(t(rows,1),first);assert.equal(outcome.real,selected.real);
  assert.deepEqual([outcome.matched,outcome.seals],[false,true]);
  const evidence=find(rows,1);
  assert.deepEqual([evidence.event.selection_observed,evidence.event.transfer_observed,evidence.closed],[false,false,[first.plan.key]]);
  assert.notDeepEqual(t(rows,2).data,t(n,2).data);
}
const wrong=c.autreMembre.rows, noMark=c.marque.rows;
assert.equal(r(wrong,1).variation.observationComparée,3);
assert.equal(r(noMark,1).variation.modificationsDansLeMembre,6);
assert.equal(r(noMark,1).pixels[1],0);
const stationary=c.dépôtStationnaire.rows;
assert.deepEqual(t(stationary,2),t(n,2));assert.equal(r(stationary,2).real,r(n,2).real);
assert.equal(r(stationary,2).pixels[1],0);
assert.deepEqual([r(stationary,2).matched,r(stationary,2).seals,find(stationary,2).event.transfer_observed],[false,true,false]);
const validates=(proof,ticket)=>proof.member===width(ticket.plan) && proof.ref===selected.ref;
assert.ok(validates({member:7,ref:selected.ref},first));
assert.ok(!validates({member:11,ref:selected.ref},first));

const stats=shas.map(sha=>{
  const tests=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  assert.match(tests,/pass 3\b/);assert.match(tests,/fail 0/);
  return {sha,départs:Object.keys(c).length,gestes:Object.values(c).reduce((s,x)=>s+x.rows.length-1,0),testsAuteur:3};
});
console.log(JSON.stringify({stats,moteur:tree(shas[0]),catalogue:16,témoins:on,dépôts:{T2:n[2].configuration,T8:n[8].configuration},
  retrait:off.slice(0,4).map(row=>choice(row.ticket)),réserve:{marque:[border,first.plan.member.bbox],
    suiteMarque:choice(t(noMark,2)),suiteAutreMembre:choice(t(wrong,2)),suiteDépôt:choice(t(stationary,3))}},null,2));
