import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';
import {footprints,changedFootprints} from './source-contact-footprints.mjs';

const [environment,output,...files]=process.argv.slice(2);
const engine=await sourceBackend(resolve(environment)),reports=[];
const key=p=>p.join(','),dims=b=>[b[2]-b[0]+1,b[3]-b[1]+1];
const between=(v,lo,hi)=>v>=lo&&v<=hi;
function features(frame,motions,input){
  const parts=footprints(frame),active=[];
  for(const [shape,motors] of motions){
    const rule=motors.get(input),group=parts.get(shape);
    if(!rule||!group||group.size!==1||rule.size!==1||motors.size<2)continue;
    const [dx,dy]=[...rule][0].split(',').map(Number),actor=[...group.values()][0].bbox;
    const [x,y]=[actor[0]+dx,actor[1]+dy],[w,h]=dims(actor);
    const pitch=Math.max(Math.abs(dx),Math.abs(dy));if(pitch>Math.max(w,h)*4)continue;
    const hits=[];
    for(const [type,items] of parts){
      if(type===shape)continue;
      for(const item of items.values()){
        const box=item.bbox,[sw,sh]=dims(box);
        if(Math.max(sw,sh)>pitch*2||sw*sh>4*w*h)continue;
        const cx=(box[0]+box[2])/2,cy=(box[1]+box[3])/2;
        if(!between(cx,x-0.5,x+w-0.5)||!between(cy,y-0.5,y+h-0.5))continue;
        if(between(cx,actor[0]-0.5,actor[2]+0.5)&&between(cy,actor[1]-0.5,actor[3]+0.5))continue;
        hits.push({unique:items.size===1,mobile:motions.has(type),sameSize:sw===w&&sh===h});
      }
    }
    active.push({hits,controls:motors.size});
  }
  return {models:active.length,contact:active.some(m=>m.hits.length),unique:active.some(m=>m.hits.some(h=>h.unique)),
    mobile:active.some(m=>m.hits.some(h=>h.mobile)),stationary:active.some(m=>m.hits.some(h=>!h.mobile)),sameSize:active.some(m=>m.hits.some(h=>h.sameSize))};
}
for(const f of files)for(const line of (await readFile(f,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line),game=getGameByCode(r.code);
  assert.ok(game&&game.group!=='custom_4');
  if(r.error||r.resets||r.observedPriorLevelActions||r.sourcePrefixActions||r.start!==r.finish)continue;
  const last=r.steps.at(-1),prep=r.steps.at(-2);
  if(!r.levels[0].won||!prep||!last||last.a<1||last.a>4){reports.push({code:r.code,level:r.start,trials:[]});continue;}
  const rep=sourceReplay(engine,{},r),prefix=r.steps.length-2,motions=new Map(),trials=[];
  function observe(b,n,input){
    for(const m of changedFootprints(footprints(b.frame),footprints(n.frame))){
      const school=motions.get(m.shape)??new Map(),deltas=school.get(input)??new Set();
      deltas.add(key([m.dx,m.dy]));school.set(input,deltas);motions.set(m.shape,school);
    }
  }
  let b=rep.restore(0);
  for(const s of r.steps.slice(0,prefix)){
    const n=rep.act(op(s));assert.equal(hash(n).slice(0,16),s.to);
    if(s.a>=1&&s.a<=4)observe(b,n,op(s));
    b=n;
  }
  const base=b,actions=[null,op(prep),...b.availableActionIds.filter(n=>n!==6).map(n=>'ACTION'+n)];
  for(const prepare of new Set(actions)){
    rep.restore(prefix);const n=prepare?rep.act(prepare):base;
    if(rep.win(n)||n.state!=='NOT_FINISHED')continue;
    const result=[];
    for(const input of n.availableActionIds.filter(n=>n>=1&&n<=4).map(n=>'ACTION'+n)){
      rep.restore(prefix);if(prepare)assert.equal(hash(rep.act(prepare)),hash(n));
      const prediction=features(n.frame,motions,input);
      const end=rep.act(input);result.push({input,...prediction,win:rep.win(end),changed:hash(end)!==hash(n)});
    }
    if(prepare===op(prep))assert.ok(result.some(x=>x.input===op(last)&&x.win));
    trials.push({prepare,observed:prepare===op(prep),image:hash(n).slice(0,16),result});
  }
  reports.push({code:r.code,level:r.start,trajectory:r.trajectory,prefix,last:op(last),trials});
}
await writeFile(output,JSON.stringify(reports));console.log('episodes',reports.length,'contrasts',reports.reduce((n,r)=>n+r.trials.length,0));
