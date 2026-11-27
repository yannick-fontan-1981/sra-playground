import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {archivePublique,budgets,candidat,gel,commande,monter,service} from './commun.mjs';
const [sha,group,out,selection]=process.argv.slice(2);
assert.ok([gel,candidat].includes(sha));
const groups={public:['nominal','indicateur','absente'],réserve:['pixel','altérée'],'reproduction-48':['altérée']};
let seed=Buffer.alloc(4);
if(group==='réserve'){
  const file=readFileSync(selection),hash=createHash('sha256').update(file).digest('hex');
  assert.ok(readFileSync(new URL('CONTRAT.md',import.meta.url),'utf8').includes(hash));
  seed=Buffer.from(JSON.parse(file).seed,'hex');
}
function edited(i,v){
  const obs=archivePublique[i].obs,prior=archivePublique[i-1].obs,points=[];
  for(let y=0;y<55;y++)for(let x=0;x<64;x++){
    if(prior.frame[y][x]!==obs.frame[y][x])points.push([x,y]);
  }
  assert.equal(points.length,56);
  const mask=v==='pixel'?[points[seed[0]%points.length]]:points;
  const apply=f=>{const a=f.map(r=>[...r]);for(const [x,y] of mask)a[y][x]=prior.frame[y][x];return a;};
  return {data:{...obs,frame:apply(obs.frame),frames:obs.frames.map(apply)},nombre:mask.length};
}
const engine=monter(sha),results=[];
try{
  for(const variant of groups[group]){
    const turns=[],cap={nominal:16,indicateur:1,pixel:4,absente:10,altérée:11}[variant];
    const earlier=group==='reproduction-48'?8:1+seed[1]%7;let pixels=0;
    await service(engine,variant,earlier,async({send})=>{
      for(let i=0;i<=cap;i++){
        let obs=archivePublique[i].obs;
        if((variant==='indicateur'&&i===1)||(variant==='pixel'&&i===4)){const o=edited(i,variant);obs=o.data;pixels=o.nombre;}
        const t=await send({observation:obs,budgets});turns.push(t);
        if(i<cap){assert.ok(t.ticket);assert.deepEqual(commande(t),archivePublique[i+1].command);}
      }
    });
    results.push({variant,turns,pixels});
    const last=turns.at(-1);console.log(JSON.stringify([variant,turns.length,last.état,last.type,last.point,last.raison]));
  }
}finally{engine.close();}
writeFileSync(out,JSON.stringify({sha,results})+'\n',{flag:'wx'});
