import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {mount} from '../ls19-ligne-90/montage.mjs';
import {dialogue} from '../g50t-ligne-23/dialogue.mjs';
const [sha,group,out,selection]=process.argv.slice(2),hash=b=>createHash('sha256').update(b).digest('hex');
const blob=execFileSync('git',['show','e2e5b52f:tests/fixtures/sic-reception-fogw-public.json.gz']);
assert.equal(hash(blob),'402b7d46df795555a38af28f99c72f360b8d36ff83e8f4e227f8a4b98a00cdf3');
const fixture=JSON.parse(gunzipSync(blob));
let dx=0;
if(group==='réserve'){
  const s=readFileSync(selection);assert.ok(readFileSync(new URL('CONTRAT.md',import.meta.url),'utf8').includes(hash(s)));
  dx=(Buffer.from(JSON.parse(s).seed,'hex')[0]&1)?1:-1;
}
function translate(frame){
  if(!dx)return frame;
  return frame.map(row=>{
    assert.equal(row[dx===1?row.length-1:0],4);
    return dx===1?[4,...row.slice(0,-1)]:[...row.slice(1),4];
  });
}
const shape=dx?[[2,0],[1,0],[1,1],[0,1]]:[[0,0],[1,0],[1,1],[2,1]];
const [wx,wy]=dx?[38,34]:[34,22];
function prepare(obs,variant,at){
  const edit=src=>{
    let frame=src;
    if(variant==='L' && at>=17){
      frame=structuredClone(src);
      for(let y=57;y<=60;y++)for(let x=24;x<=27;x++)frame[y][x]=3;
      for(let y=25;y<=29;y++)for(let x=27;x<=31;x++)frame[y][x]=15;
      for(const [x,y] of [[0,0],[1,0],[0,1]]){frame[57+y][24+x]=5;frame[26+y][28+x]=10;}
    }else if(['même','nouvelle'].includes(variant)&&at>=17){
      frame=structuredClone(src);
      for(const [x,y] of shape)frame[wy+y][wx+x]=10;
      if(variant==='nouvelle'){
        for(let y=57;y<=60;y++)for(let x=24;x<=27;x++)frame[y][x]=3;
        for(const [x,y] of shape)frame[57+y][24+x]=5;
      }
    }
    return translate(frame);
  };
  return {...obs,frame:edit(obs.frame),frames:obs.frames.map(edit)};
}
const variants={catalogue:['catalogue'],historique:['historique'],développement:['même','nouvelle'],réserve:['même','nouvelle'],extraction:['unitaire'],témoin:['L']}[group];
const engine=mount(sha,'.'),results=[];
try{
  copyFileSync(new URL('./moteur.mjs',import.meta.url),join(engine.program,'worker.mjs'));
  for(const variant of variants){
    const turns=[],limit=variant==='historique'?fixture.commands.length:variant==='catalogue'?16:18;
    const recorded=await dialogue(['--permission','--allow-fs-read='+engine.program,'worker.mjs',variant],engine.program,async({send})=>{
      let terrain=null,badge=null;
      for(let i=0;i<=limit;i++){
        const holdAgain=i===18&&['même','nouvelle','L'].includes(variant);
        const obs=holdAgain?{...fixture.observations[17],stepIndex:fixture.observations[18].stepIndex,frames:[fixture.observations[17].frame]}:fixture.observations[i];
        const observation=prepare(obs,variant,i);
        const budgets=variant==='catalogue'?fixture.budgets:fixture.extendedBudgets;
        const row=await send({observation,budgets,sessionId:fixture.sessionId});turns.push(row);
        if(i===17){
          terrain=hash(JSON.stringify(observation.frame.slice(0,56)));
          badge=observation.frame.slice(57,61).flatMap((r,y)=>r.slice(24+dx,28+dx).flatMap((v,x)=>v===5?[[x,y]]:[]));
        }
        if(i===limit||!row.ticket)break;
        // Aucun retour archivé n’est servi après une autre commande.
        assert.equal(row.action,'ACTION'+fixture.commands[i].id);
      }
      return {terrain,badge};
    });
    results.push({variant,turns,...recorded,positionMobile:variant==='L'?[28,26]:[wx+dx,wy]});
  }
}finally{engine.close();}
writeFileSync(out,JSON.stringify({sha,results})+'\n',{flag:'wx'});
console.log(JSON.stringify(results.map(r=>[r.variant,r.turns.length,r.turns.slice(16,19).map(t=>[t.plan,t.action,t.index,t.taille,t.reçu?.matched,t.reçu?.scellé])])));
