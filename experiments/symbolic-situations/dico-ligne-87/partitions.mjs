import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,copyFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {mount} from '../ls19-ligne-90/montage.mjs';
import {dialogue} from '../g50t-ligne-23/dialogue.mjs';
const [sha,receipt,reserve]=process.argv.slice(2);
let seed=Buffer.alloc(32);
if(reserve){
  const b=readFileSync(reserve);assert.ok(readFileSync(new URL('CONTRAT.md',import.meta.url),'utf8').includes(createHash('sha256').update(b).digest('hex')));
  seed=Buffer.from(JSON.parse(b).seed,'hex');
}
const members=Array.from({length:8},(_,i)=>i),order=[0,1,2,3],ids=members.map(i=>i+(reserve?13:0));
function mix(a,offset){for(let i=a.length-1;i>0;i--){const j=seed[offset+i]%(i+1);[a[j],a[i]]=[a[i],a[j]];}}
if(reserve){mix(ids,0);mix(order,9);}
const groups=[[0,1,2,3],[2,4,5,7],[1,3,6],[7]];
const queries=order.map(i=>({tested:groups[i].map(k=>ids[k]).sort((a,b)=>a-b),
  command:{action_ref:'ACTION6',data:{x:2+6*i+(reserve?17:0),y:3+i+seed[16+i]%11}}}));
const lex=(a,b)=>{for(let i=0;i<Math.min(a.length,b.length);i++)if(a[i]!==b[i])return a[i]-b[i];return a.length-b.length;};
function expected(options){
  const split=q=>{
    const inside=ids.filter(k=>q.tested.includes(k)),outside=ids.filter(k=>!q.tested.includes(k));
    return {global:inside.length,local:outside.length,remaining:Math.max(inside.length,outside.length)};
  };
  const cost=Math.min(...options.map(q=>split(q).remaining));
  const optimum=options.filter(q=>split(q).remaining===cost).sort((a,b)=>lex(a.tested,b.tested));
  return {cost,optimum,split};
}
const first=expected(queries).optimum[0];
const variants=[queries,[...queries].reverse(),queries.map(q=>q===first?{...q,tested:q.tested.slice(0,2)}:q),queries.filter(q=>q.tested.length<4)];
const outputs=[],tree=mount(sha,'.');
try{
  copyFileSync(new URL('./classement.mjs',import.meta.url),join(tree.program,'classement.mjs'));
  if(!existsSync(join(tree.program,'src/sic/subset-query.ts'))){
    // Le gel garde le tri dans propose(). Exercer sa ligne de classement exacte, avec son comparateur natif.
    const source=readFileSync(join(tree.program,'src/logos-engine/v6-subset-diagnosis.ts'),'utf8');
    const clause=source.split(/\r?\n/).map(s=>s.trim()).filter(s=>s.startsWith('offers.sort('));
    assert.equal(clause.length,1);
    writeFileSync(join(tree.program,'ordre-gel.mjs'),
      "import {supportCompare as compare} from './src/logos-engine/v6-support-measurements.ts';\nexport function select(offers){\n"+clause[0]+"\nreturn offers[0];\n}");
  }
  await dialogue(['--permission','--allow-fs-read='+tree.program,'classement.mjs'],tree.program,async({send})=>{
    for(const [i,q] of variants.entries()){
      const d=await send({members:i===1?[...ids].reverse():ids,queries:q}),e=expected(q);
      for(const o of d.offers)for(const [k,v] of Object.entries(e.split(o)))assert.equal(o[k],v);
      assert.deepEqual(d.winner.command,e.optimum[0].command);assert.equal(d.winner.remaining,e.cost);
      outputs.push({cost:e.cost,admis:e.optimum.map(x=>x.command.data),selected:d.winner.command.data});
    }
  });
}finally{tree.close();}
assert.deepEqual(outputs.map(r=>r.cost),[4,4,4,5]);assert.equal(outputs[0].admis.length,2);
assert.deepEqual(outputs[0],outputs[1]);assert.notDeepEqual(outputs[2].selected,outputs[0].selected);
assert.ok(!outputs[2].admis.some(point=>point.x===outputs[0].selected.x && point.y===outputs[0].selected.y));
writeFileSync(receipt,JSON.stringify({sha,outputs,rejetCommandeHistorique:true})+'\n',{flag:'wx'});
console.log('4/4 partitions, coûts 4,4,4,5 ; ancienne commande rejetée après dégradation.');
