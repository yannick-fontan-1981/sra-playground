import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {GAME_CATALOG,getGameByCode} from '../src/games/catalog.ts';
import {geometricComponents} from '../src/logos-engine/v6-native-observer.ts';
import {measureComponentTranslations} from '../src/sic/observed-translation.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';

// Replace one preparation before the same directional action. Keep the
// subsequent source commands and the original budget for the score control.
const [environment,out,...files]=process.argv.slice(2);
const engine=await sourceBackend(resolve(environment)),episodes=[];
const held=new Set(['hanoi_order',...GAME_CATALOG.filter(g=>g.group==='official').map(g=>g.family)]);
const small=(rows,p)=>p.area>1 && p.area<=rows.length*rows[0].length/16;
const overlap=([l,t,r,b],[x,y,u,v])=>l<=u && t<=v && x<=r && y<=b;
const shape=p=>p.bbox.slice(2).map((n,i)=>n-p.bbox[i]+1);
const moves=(a,b)=>measureComponentTranslations(a.frame,b.frame,p=>small(a.frame,p));
const alive=(rep,b)=>b.state==='NOT_FINISHED'&&!rep.win(b);
function alternatives(root,command,history,knownMoves) {
  const result=new Set();
  for(const n of root.availableActionIds)
    if(n!==6 && n!==7 && !knownMoves.has('ACTION'+n) && n!==command.a)result.add('ACTION'+n);
  if(!root.availableActionIds.includes(6))return [...result];
  const familiar=[...history].reverse().slice(0,12);
  if(!familiar.length)return [...result];
  const parts=geometricComponents(root.frame).filter(p=>small(root.frame,p));
  const candidates=parts.map(p=>{
    const [width,height]=shape(p);
    const cost=Math.min(...familiar.map(m=>{
      const [w,h]=shape(m.to);
      return Math.abs(w-width)+Math.abs(h-height)+Math.abs(Math.log(p.area/m.to.area))*2;
    }));
    return {p,cost};
  }).sort((a,b)=>a.cost-b.cost);
  const used=[];
  for(const {p,cost} of candidates){
    if(cost>2 || used.some(b=>overlap(b,p.bbox)) || familiar.some(m=>overlap(p.bbox,m.to.bbox)))continue;
    used.push(p.bbox);
    const [l,t,r,b]=p.bbox;result.add('ACTION6:'+Math.floor((l+r)/2)+','+Math.floor((t+b)/2));
    if(used.length===4)break;
  }
  return [...result];
}
for(const file of files) for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line),g=getGameByCode(r.code);assert.ok(g&&g.group!=='custom_4');
  if(r.error||held.has(g.family))continue;
  assert.ok(!r.resets&&!r.sourcePrefixActions&&!r.observedPriorLevelActions&&r.start===r.finish);
  const rep=sourceReplay(engine,{},r),history=[],knownMoves=new Set(),tests=[],seen=new Set();
  let board=rep.restore(0),samples=0;
  for(const [i,a] of r.steps.entries()){
    const b=r.steps[i+1];
    if(b && b.a>=1 && b.a<=4 && samples<8 && board.availableActionIds.includes(b.a) &&
        history.length && !seen.has(a.from+'/'+b.a)){
      const options=alternatives(board,b,history,knownMoves).filter(input=>input!==op(a));
      if(options.length){
        samples++;seen.add(a.from+'/'+b.a);
        const direct=rep.act(op(b)),normal=alive(rep,direct)?moves(board,direct):[];
        for(const input of options){
          const root=rep.restore(i),prepared=rep.act(input);
          if(!alive(rep,prepared)||!prepared.availableActionIds.includes(b.a))continue;
          const next=rep.act(op(b)),ready=alive(rep,next)?moves(prepared,next):[];
          const redirected=normal.length>0 && ready.length>0 &&
            normal.every(m=>ready.every(n=>!overlap(m.from.bbox,n.from.bbox)));
          const enabled=!normal.length && ready.length>0;
          if(!redirected && !enabled && !rep.win(next))continue;
          let end=next,valid=true;
          for(const step of r.steps.slice(i+2)){
            if(!alive(rep,end))break;
            if(!end.availableActionIds.includes(step.a)){valid=false;break;}
            end=rep.act(op(step));
          }
          tests.push({at:i+1,input,b:op(b),redirected,enabled,score:valid?Number(rep.win(end)):null});
        }
        board=rep.restore(i);
      }
    }
    const next=rep.act(op(a));assert.equal(hash(next).slice(0,16),a.to);
    if(alive(rep,next) && a.a<=4){
      const measured=moves(board,next);
      if(measured.length){knownMoves.add(op(a));history.push(...measured);}
    }
    board=next;
  }
  assert.equal(rep.win(board),r.levels[0].won);
  episodes.push({code:r.code,level:r.start,won:rep.win(board),samples,tests});
}
const tests=episodes.flatMap(e=>e.tests);
const summary={episodes:episodes.length,origins:episodes.reduce((n,e)=>n+e.samples,0),
  redirected:tests.filter(t=>t.redirected).length,enabled:tests.filter(t=>t.enabled).length,
  converted:episodes.filter(e=>!e.won&&e.tests.some(t=>t.score===1)).map(e=>[e.code,e.level])};
await writeFile(out,JSON.stringify({summary,episodes}));console.log(JSON.stringify(summary));
