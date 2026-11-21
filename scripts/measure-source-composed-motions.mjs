import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op} from './sic-study-source-replay.mjs';
import {footprints,changedFootprints} from './source-contact-footprints.mjs';
const [environment,study,out]=process.argv.slice(2),engine=await sourceBackend(resolve(environment)),reports=[];
const read=async name=>readFile(resolve(study,name),'utf8');
const reference=await Promise.all(['SWCH','KEYD','LOGI','VOIS'].map(async code=>({rs:JSON.parse(await read('compose45-payoff-'+code+'.json')),
  tapes:(await read('compose45-baseline-'+code+'-upper.jsonl')).trim().split(/\r?\n/).map(JSON.parse)})));
const outer=await Promise.all([0,1].map(async k=>JSON.parse(await read('compose46-outer-'+k+'.json'))));
const inputs=(await Promise.all([0,1,2,3].map(k=>read('compose46-outer-input-'+k+'.jsonl')))).flatMap(data=>data.trim().split(/\r?\n/).map(JSON.parse));
reference.push({rs:outer.flat(),tapes:inputs});
for(const {rs,tapes} of reference)for(const r of rs){
 if(!r.trials.length)continue;
 assert.ok(getGameByCode(r.code)?.group!=='custom_4');
 const run=tapes.find(q=>q.code===r.code&&q.start===r.level),rep=sourceReplay(engine,{},run);
 for(const t of r.trials.filter(t=>t.arms.abc.observed.every(Boolean))){
  const directions=new Map(),history=[];let board=rep.restore(0);
  function shifts(first,second){return changedFootprints(footprints(first.frame),footprints(second.frame));}
  for(const step of run.steps.slice(0,t.at)){
    const input=op(step),next=rep.act(input);history.push(input);
    if(/^ACTION[1-4]$/.test(input))for(const move of shifts(board,next)){
      const data=directions.get(move.shape)??new Map(),axes=data.get(input)??new Set();
      axes.add(move.dx?'x':'y');data.set(input,axes);directions.set(move.shape,data);
    }
    board=next;
  }
  function arm(word){
    let current=rep.restore(t.at);
    for(const key of word.slice(0,-1)){if(rep.win(current)||current.state!=='NOT_FINISHED')return null;current=rep.act(key);}
    if(rep.win(current)||current.state!=='NOT_FINISHED')return null;
    const next=rep.act(word.at(-1));if(rep.win(next)||next.state!=='NOT_FINISHED')return null;
    return shifts(current,next);
  }
  const [a,b,c]=t.word,sham=history.find(k=>!t.word.includes(k)&&board.availableActionIds.includes(Number(k.split(':')[0].slice(6))));
  const controls={bare:arm([c]),dropA:arm([b,c]),dropB:arm([a,c]),swap:arm([b,a,c])};
  if(sham){controls.subA=arm([sham,b,c]);controls.subB=arm([a,sham,c]);}
  const planned=arm(t.word)??[];
  const grounded=planned.filter(m=>{
    const evidence=directions.get(m.shape);
    return evidence&&[...evidence].some(([key,axes])=>axes.has('x')&&[...evidence].some(([other,ay])=>other!==key&&ay.has('y')));
  });
  const keys=m=>({kind:m.shape+'@'+m.dx+','+m.dy,site:m.from.bbox.join(',')});
  reports.push({code:r.code,level:r.level,at:t.at,word:t.word,measuredTranslations:planned.length,movers:grounded.map(m=>{
    const {kind,site}=keys(m);
    return {shapeHash:createHash('sha256').update(m.shape).digest('hex').slice(0,16),size:m.from.area,dx:m.dx,dy:m.dy,
      origin:m.from.bbox.slice(0,2),alternatives:Object.fromEntries(Object.entries(controls).map(([k,moves])=>[k,moves===null?null:{
        atSite:moves.some(v=>keys(v).kind===kind&&keys(v).site===site),anywhere:moves.some(v=>keys(v).kind===kind)}]))};
  })});
 }
}
await writeFile(out,JSON.stringify(reports));console.log(reports.length,reports.filter(r=>r.movers.length).length);
