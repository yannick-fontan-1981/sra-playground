import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getGameByCode } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { measureComponentTranslations } from '../src/sic/observed-translation.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';

// At each fresh offer the solver chooses both the click and the motor before we play either arm.
const [env,solver,out,...files]=process.argv.slice(2);
const {newCursorMemory,offerCursorTrial,recordCursorTrial}=await import(pathToFileURL(resolve(solver,'src/sic/marked-cursor-selection.ts')).href);
const packPath=process.env.SIC_STUDY_RECOVERY_PACK;
const preference=packPath?JSON.parse(await readFile(packPath,'utf8')).configuration.informationPreference:undefined;
const engine=await sourceBackend(resolve(env)),episodes=[];
const contains=([l,t,r,b],[x,y,u,v])=>l<=x&&t<=y&&r>=u&&b>=v;
const alive=(rep,b)=>b.state==='NOT_FINISHED'&&!rep.win(b);
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const run=JSON.parse(line),game=getGameByCode(run.code);
  assert.ok(game&&game.group!=='custom_4');
  assert.ok(!run.error&&!run.resets&&!run.sourcePrefixActions&&!run.observedPriorLevelActions);
  const rep=sourceReplay(engine,{},run),cache=new Map(),memory=newCursorMemory(),tested=new Set(),trials=[];
  async function observe(b){
    const h=hash(b);
    if(!cache.has(h))cache.set(h,await measureNativeObservation({frame_rows:b.frame,frame_hash:h,state:b.state,
      level:b.level,levels_completed:b.levelsCompleted,available_action_refs:b.availableActionIds.map(a=>'ACTION'+a),
      palette:b.palette},cache.size,'source'));
    return cache.get(h);
  }
  let b=rep.restore(0);
  for(const [i,step] of run.steps.entries()){
    const o=await observe(b);
    const offer=offerCursorTrial(memory,o,b.frame,false,false,preference);
    const motor=offer?.contrast?.motor??offer?.projectedMove?.command??memory.motions.find(m=>offer&&contains(offer.source.box,m.box))?.command;
    const id=JSON.stringify([step.from,offer?.command,motor]);
    if(i+2<=run.cap&&offer?.stage==='select'&&motor&&!tested.has(id)){
      tested.add(id);
      const moves=(a,n)=>alive(rep,n)?measureComponentTranslations(a.frame,n.frame,p=>p.area>=2&&p.area<a.frame.length*a.frame[0].length/12):[];
      const direct=rep.act(motor),baseMoves=moves(b,direct);
      rep.restore(i);
      const prepared=rep.act(offer.command),engaged=alive(rep,prepared)&&prepared.availableActionIds.includes(Number(motor.slice(6)));
      const next=engaged?rep.act(motor):prepared,readyMoves=engaged?moves(prepared,next):[];
      const fromTarget=readyMoves.filter(m=>contains(offer.target.box,m.from.bbox));
      const predicted=offer.projectedMove?.delta;
      const matched=predicted?fromTarget.some(m=>m.displacement[0]===predicted[0]&&m.displacement[1]===predicted[1]):null;
      const [l,t,r,bottom]=offer.source.box;
      const oldStayed=prepared.frame.slice(t,bottom+1).every((row,y)=>row.slice(l,r+1).every((v,x)=>v===next.frame[t+y][l+x]));
      const redirected=oldStayed&&fromTarget.length>0&&baseMoves.some(m=>contains(offer.source.box,m.from.bbox))
        && !baseMoves.some(m=>contains(offer.target.box,m.from.bbox));
      let end=next;
      for(const s of run.steps.slice(i+2)){
        if(!alive(rep,end)||!end.availableActionIds.includes(s.a))break;
        end=rep.act(op(s));
      }
      trials.push({at:i+1,click:offer.command,motor,basis:offer.basis??'mark',projected:!!predicted,matched,redirected,won:rep.win(end)});
      rep.restore(i);
    }
    const n=rep.act(op(step));assert.equal(hash(n).slice(0,16),step.to);
    recordCursorTrial(memory,o,await observe(n),b.frame,n.frame,op(step));
    b=n;
  }
  assert.equal(rep.win(b),run.levels[0].won);
  episodes.push({code:run.code,level:run.start,won:rep.win(b),trials});
  console.log(run.code,run.start,trials.length,trials.filter(x=>x.redirected).length,trials.filter(x=>x.matched).length,trials.filter(x=>x.won).length);
}
await writeFile(out,JSON.stringify(episodes));
