import assert from 'node:assert/strict';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {mount} from '../ls19-ligne-90/montage.mjs';
import {dialogue} from '../g50t-ligne-23/dialogue.mjs';
import {historical,squareWorld,candidate} from './situations.mjs';
const [sha,group,path,selection]=process.argv.slice(2);
assert.ok(['ZIPP','construit','retrait'].includes(group) && (group!=='retrait'||sha===candidate));
let seed=null;
if(selection){const bytes=readFileSync(selection);
  assert.ok(readFileSync(new URL('CONTRAT.md',import.meta.url),'utf8').includes(createHash('sha256').update(bytes).digest('hex')));
  seed=Buffer.from(JSON.parse(bytes).seed,'hex');
}
const real=group!=='construit',m=mount(sha,'.'),results=[];
try{
  copyFileSync(new URL('./moteur.mjs',import.meta.url),join(m.program,'worker.mjs'));
  const args=['--permission','--allow-fs-read='+m.program];
  if(group==='retrait'){copyFileSync(new URL('./retrait.mjs',import.meta.url),join(m.program,'retrait.mjs'));args.push('--import','./retrait.mjs');}
  args.push('worker.mjs');
  for(const mode of real?[group]:['répète','stable','inverse','aucun']){
    const game=real?null:squareWorld(mode,seed),turns=[],positions=[];
    await dialogue(args,m.program,async({send})=>{
      let observation=real?historical.observations[0]:game.initial;
      const limit=real?(group==='retrait'?14:16):2;
      for(let i=0;i<=limit;i++){
        if(!real){
          const dots=observation.frame.flatMap((row,y)=>row.flatMap((v,x)=>v===9?[[x,y]]:[]));
          assert.equal(dots.length,4);positions.push([Math.min(...dots.map(p=>p[0])),Math.min(...dots.map(p=>p[1]))]);
        }
        const r=await send(i?{observation}:{observation,budgets:real?historical.budgets:game.budgets,
          sessionId:real?historical.sessionId:'controle-public'});
        turns.push(r);if(i===limit || !r.ticket)break;
        if(real){
          const cmd=historical.commands[i];assert.equal(r.command.actionRef,'ACTION'+cmd.id);assert.deepEqual(r.command.data??{},cmd.data??{});
          observation=historical.observations[i+1];
        }else observation=game.step(r.command);
      }
    });results.push({mode,turns,positions});
  }
}finally{m.close();}
writeFileSync(path,JSON.stringify({sha,group,results})+'\n',{flag:'wx'});
for(const r of results){const i=real?14:1,d=r.turns[i];console.log(JSON.stringify({mode:r.mode,entrées:r.turns.length,
  famille:d?.family,essai:d?.acquisition?.experiment,mesure:r.turns[i+1]?.ret?.matched}));}
