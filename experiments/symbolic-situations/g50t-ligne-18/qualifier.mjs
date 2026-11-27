import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {mount} from '../ls19-ligne-90/montage.mjs';
import {dialogue} from '../g50t-ligne-23/dialogue.mjs';
const [sha,mode,receipt,selection]=process.argv.slice(2);
const blob=execFileSync('git',['show','ada97e9c:tests/fixtures/sic-linked-contact-g50t-public.json.gz']);
assert.equal(createHash('sha256').update(blob).digest('hex'),'bc055cf27effb3eaffda87aa524ae67ad7b492479aa439373fd61c7f17b8320b');
const fixture=JSON.parse(gunzipSync(blob)),engine=mount(sha,'.'),results=[];
let seed=null;
if(selection){const bytes=readFileSync(selection);assert.ok(readFileSync(new URL('CONTRAT.md',import.meta.url),'utf8').includes(createHash('sha256').update(bytes).digest('hex')));seed=Buffer.from(JSON.parse(bytes).seed,'hex');}
try{
  copyFileSync(new URL('./moteur.mjs',import.meta.url),join(engine.program,'worker.mjs'));
  const args=['--permission','--allow-fs-read='+engine.program];
  if(mode==='retrait'){copyFileSync(new URL('./retrait.mjs',import.meta.url),join(engine.program,'retrait.mjs'));args.push('--import','./retrait.mjs');}
  if(['mesurée','épuisée'].includes(mode)){
    copyFileSync(new URL('./preuve.mjs',import.meta.url),join(engine.program,'preuve.mjs'));
    writeFileSync(join(engine.program,'condition.txt'),mode);args.push('--import','./preuve.mjs');
  }
  args.push('worker.mjs');
  const stopAtChoice=['mesurée','épuisée','retrait'].includes(mode);
  const variants=mode==='historique' || stopAtChoice?[mode]:seed?['extérieur','distant']:['stationnaire','arrivée','extérieur','distant'];
  for(const v of variants){
    const turns=[];let change=null;
    await dialogue(args,engine.program,async({send})=>{
      let obs=fixture.observations[0];const limit=v==='historique'?10:stopAtChoice?2:8;
      for(let i=0;i<=limit;i++){
        const row=await send(i?{obs}:{obs,budgets:fixture.budgets,sid:fixture.sessionId});turns.push(row);
        if(i===limit)break;
        const given=fixture.commands[i];assert.equal(row.command.actionRef,'ACTION'+given.id);assert.deepEqual(row.command.data??{},given.data??{});
        const prior=obs;obs=fixture.observations[i+1];
        if(i===7 && v!=='historique'){
          const peer=row.support;assert.ok(peer?.length>1);
          const frame=structuredClone(v==='stationnaire'?prior.frame:obs.frame);
          for(const [x,y] of peer)frame[y][x]=prior.frame[y][x];
          if(['extérieur','distant'].includes(v)){
            const candidates=v==='distant'?peer:[[0,0],[1,0],[2,0],[3,0],[4,0],[5,0]];
            const k=seed?1+seed[0]%(candidates.length-1):0;
            const [x,y]=candidates[k];
            assert.equal(peer.some(p=>p[0]===x && p[1]===y),v==='distant');
            const old=frame[y][x];frame[y][x]=(old+1)%16;change=[x,y,old,frame[y][x]];
          }
          obs={...obs,frame,frames:[frame]};
        }
      }
    });
    results.push({variant:v,turns,change});
  }
}finally{engine.close();}
writeFileSync(receipt,JSON.stringify({sha,results})+'\n',{flag:'wx'});
console.log(JSON.stringify(results.map(x=>[x.variant,x.turns.length,x.turns.flatMap(d=>d.events).flatMap(e=>e.comparison).map(c=>c.pixels.length)])));
