import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {mount} from '../ls19-ligne-90/montage.mjs';
import {dialogue} from '../g50t-ligne-23/dialogue.mjs';

const [sha,receipt,selection]=process.argv.slice(2);
let seed=Buffer.alloc(32);
if(selection){
  const bytes=readFileSync(selection),hash=createHash('sha256').update(bytes).digest('hex');
  assert.ok(readFileSync(new URL('CONTRAT.md',import.meta.url),'utf8').includes(hash));seed=Buffer.from(JSON.parse(bytes).seed,'hex');
}
const features=['signature','ring','pattern','tracked_distance'],order=[0,1,2];
if(selection){
  for(let i=3;i>0;i--){const j=seed[i]%(i+1);[features[i],features[j]]=[features[j],features[i]];}
  for(let i=2;i>0;i--){const j=seed[4+i]%(i+1);[order[i],order[j]]=[order[j],order[i]];}
}
const offset=selection?12+seed[7]%15:0;
const points=Array.from({length:5},(_,i)=>({x:2+offset+5*i,y:3+offset+(seed[8+i]%5)}));
function binding(i,bits){
  const values=Object.fromEntries(features.map((k,j)=>[k,k==='tracked_distance'?2+seed[10]%9+bits[j]:'v'+(seed[12]+j)+'-'+bits[j]]));
  return {action:{action_ref:'ACTION6',data:points[i]},mode:[1,'NOT_FINISHED'],
    frame_hash:'vue'+Math.min(i,2),observation_ref:'occ'+i,entity_ref:'e'+i,features:values};
}
const patterns=[[1,1,0,0],[1,0,0,0],[0,0,0,1]];
const options=order.map(i=>binding(i+2,patterns[i]));
const positive={...binding(0,[1,1,1,1]),observed_local_change:true,after_ref:'lecture1'};
const negative={...binding(1,[0,0,0,0]),observed_local_change:false,after_ref:'lecture2'};
const pairs=[];
for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)pairs.push([features[i],features[j]].sort());
const difference=(f,g,b)=>(b.features[f]===positive.features[f]) !== (b.features[g]===positive.features[g]);
const separated=pairs.filter(([f,g])=>difference(f,g,options[order.indexOf(0)]));
const branches=[{history:[positive,negative],spent:[]},{history:[positive,negative],spent:separated},
  {history:[positive,negative],spent:pairs},{history:[negative],spent:[]}];
const results=[];
const engine=mount(sha,'.');
try{
  copyFileSync(new URL('./points.mjs',import.meta.url),join(engine.program,'points.mjs'));
  await dialogue(['--permission','--allow-fs-read='+engine.program,'points.mjs'],engine.program,async({send})=>{
    for(const {history,spent} of branches){
      const list=await send({history,spent,options});
      // Énumérer les six paires de caractéristiques et les prévisions par égalité au témoin positif.
      const expected=[];
      if(history.includes(positive))for(const o of options){
        const splits=pairs.filter(([f,g])=>difference(f,g,o)).filter(p=>!spent.some(s=>s.join('|')===p.join('|')));
        if(!splits.length)continue;
        const predictions=Object.fromEntries(features.map(f=>[f,o.features[f]===positive.features[f]]));
        const yes=Object.values(predictions).filter(Boolean).length;
        expected.push({point:o.action.data,predictions,pairs:splits.map(p=>p.join('|')).sort(),score:Math.min(yes,4-yes)});
      }
      assert.equal(list.length,expected.length);
      for(const o of list){
        const e=expected.find(e=>e.point.x===o.point.x && e.point.y===o.point.y);
        assert.ok(e);assert.deepEqual(o.predictions,e.predictions);assert.deepEqual(o.pairs,e.pairs);
      }
      assert.equal(new Set(list.map(o=>String(o.point.x)+','+o.point.y)).size,list.length);
      if(list.length)assert.ok(expected.some(e=>e.score===Math.max(...expected.map(k=>k.score)) && e.point.x===list[0].point.x));
      results.push(list);
    }
  });
}finally{engine.close();}
assert.deepEqual(results.map(r=>r.length),[3,2,0,0]);
writeFileSync(receipt,JSON.stringify({sha,results})+'\n',{flag:'wx'});
console.log('4/4 configurations, offres 3 / 2 / 0 / 0.');
