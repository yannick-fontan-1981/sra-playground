import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';
import {footprints,changedFootprints} from './source-contact-footprints.mjs';
import {getGameByCode} from '../src/games/catalog.ts';
import {planRoleOccupancy} from '../src/sic/role-occupancy-experiment.ts';

const [environment,output,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(environment)),reports=[];
const compose=process.env.SIC_STUDY_COMPOSE_CONTACT==='1';
const preferObservedLandings=process.env.SIC_STUDY_PREFER_OBSERVED_LANDINGS==='1';
const site=p=>p.slice(0,2),key=p=>p.join(','),signature=shape=>createHash('sha256').update(shape).digest('hex').slice(0,12);
const shift=(p,dx,dy)=>[p[0]+dx,p[1]+dy,p[2]+dx,p[3]+dy];
const boxAt=(p,s)=>shift(p,s[0]-p[0],s[1]-p[1]);
const disjoint=(a,b)=>a[2]<b[0]||b[2]<a[0]||a[3]<b[1]||b[3]<a[1];
const patch=(rows,p)=>Array.from({length:p[3]-p[1]+1},(_,j)=>rows[p[1]+j]?.slice(p[0],p[2]+1).join(',')).join('/');
// Only the part of the board newly entered by the peer may obstruct this move.
function landing(rows,from,dx,dy){
  const [x0,y0,x1,y1]=shift(from,dx,dy);
  if(x0<0||y0<0||x1>=rows[0].length||y1>=rows.length)return null;
  const cells=[];
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    if(x<from[0]||x>from[2]||y<from[1]||y>from[3])cells.push(rows[y][x]);
  }
  return cells.join(',');
}
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const run=JSON.parse(line),g=getGameByCode(run.code);assert.ok(g && g.group!=='custom_4');
  if(run.error||run.resets||run.sourcePrefixActions||run.observedPriorLevelActions||run.start!==run.finish)continue;
  const rep=sourceReplay(engine,{},run),cache=new Map(),history=[],models=new Map(),tested=new Set(),trials=[];
  const live=b=>b.state==='NOT_FINISHED'&&!rep.win(b);
  function parts(b){const f=hash(b);if(!cache.has(f))cache.set(f,footprints(b.frame));return cache.get(f);}
  let board=rep.restore(0);
  for(const [i,step] of run.steps.entries()){
    const current=parts(board),options=[];
    if(i%2===0 && trials.length<3)for(const model of models.values()){
      const pieces=current.get(model.actor),targets=current.get(model.peer);
      if(!pieces||!targets)continue;
      const free=history.filter(h=>h.shape===model.actor && h.stationary.has(model.peer));
      if(!free.some(h=>h.input===model.input))continue;
      const motors=[];
      for(const input of new Set(free.map(h=>h.input))){
        const refs=free.filter(h=>h.input===input);
        if(new Set(refs.map(h=>key([h.dx,h.dy]))).size===1)motors.push(refs[0]);
      }
      if(motors.length<2)continue;
      const grounds=new Set(free.flatMap(h=>h.ground===null?[]:[h.ground]));
      const sites=new Set(free.flatMap(h=>[key(h.from),key(h.to)]));
      for(const actor of pieces.values())for(const peer of targets.values()){
        if(model.observed.has(key(site(peer.bbox))))continue;
        const possible=s=>{
          const box=boxAt(actor.bbox,s);
          if(box[0]<0||box[1]<0||box[2]>=board.frame[0].length||box[3]>=board.frame.length)return false;
          if([...targets.values()].some(p=>!disjoint(p.bbox,box)))return false;
          return sites.has(key(s))||grounds.has(patch(board.frame,box));
        };
        const plan=planRoleOccupancy(site(actor.bbox),site(peer.bbox),motors,possible,Math.min(6,run.cap-i-1),tested,
          {input:model.input,offset:model.offset});
        if(!plan)continue;
        if(!compose){options.push({plan,actor,peer,model});continue;}
        // Project both subjects, then solve for the new actor position needed by a different effect.
        const nextActor=[plan.destination[0]+plan.test.dx,plan.destination[1]+plan.test.dy];
        const nextPeer=shift(peer.bbox,model.peerDx,model.peerDy);
        for(const second of models.values()){
          if(second.actor!==model.actor||second.peer!==model.peer||second.observed.has(key(site(nextPeer))))continue;
          if(model.peerDx*second.peerDx+model.peerDy*second.peerDy!==0)continue;
          const freeAfter=s=>{
            const box=boxAt(actor.bbox,s);
            if(!disjoint(box,nextPeer))return false;
            if([...targets.values()].some(p=>key(p.bbox)!==key(peer.bbox)&&!disjoint(box,p.bbox)))return false;
            return sites.has(key(s))||grounds.has(patch(board.frame,box))||key(s)===key(site(peer.bbox))||key(s)===key(site(actor.bbox));
          };
          const limit=Math.min(8,run.cap-i-plan.occupied.length-2);
          const continuation=planRoleOccupancy(nextActor,site(nextPeer),motors,s=>
            s[0]>=0&&s[1]>=0&&s[0]+actor.bbox[2]-actor.bbox[0]<board.frame[0].length&&
            s[1]+actor.bbox[3]-actor.bbox[1]<board.frame.length&&freeAfter(s),limit,new Set(),
            {input:second.input,offset:second.offset});
          if(continuation){
            const firstKnown=model.landings.has(landing(board.frame,peer.bbox,model.peerDx,model.peerDy));
            const secondKnown=second.landings.has(landing(board.frame,nextPeer,second.peerDx,second.peerDy));
            options.push({plan,actor,peer,model,second,continuation,knownLandings:Number(firstKnown)+Number(secondKnown)});
          }
        }
      }
    }
    const cost=a=>a.plan.clear.length+(a.continuation?.clear.length??0);
    const chosen=options.sort((a,b)=>(preferObservedLandings? (b.knownLandings??0)-(a.knownLandings??0):0)||cost(a)-cost(b))[0];
    if(chosen){
      const {plan,actor,peer,model}=chosen;
      tested.add([key(site(actor.bbox)),key(site(peer.bbox)),...plan.occupied.slice(0,-1).map(p=>p.input),plan.occupied.at(-1).input,plan.clear.at(-1).input,plan.test.input].join('/'));
      function arm(preparation){
        let b=rep.restore(i),verified=0,from=actor.bbox;
        for(const action of preparation){
          const n=rep.act(action.input);if(!live(n))return {verified,won:rep.win(n)};
          const moved=changedFootprints(parts(b),parts(n)),actual=moved.find(m=>m.shape===model.actor&&key(m.from.bbox)===key(from));
          if(!actual||key(site(actual.to.bbox))!==key(action.site)||!parts(n).get(model.peer)?.has(key(peer.bbox)))return {verified,won:false};
          verified++;from=actual.to.bbox;b=n;
        }
        const shiftedPeer=shift(peer.bbox,model.peerDx,model.peerDy);
        const firstLanding=model.landings.has(landing(b.frame,peer.bbox,model.peerDx,model.peerDy));
        const secondLanding=model.landings.has(landing(b.frame,shiftedPeer,model.peerDx,model.peerDy));
        const sameOffset=plan.test.dx===model.peerDx&&plan.test.dy===model.peerDy;
        const together=key(site(from))===key(plan.destination);
        const repeatForecast=together&&firstLanding&&secondLanding&&sameOffset&&i+preparation.length+2<=run.cap;
        const n=rep.act(plan.test.input),out={verified,won:rep.win(n),knownLanding:firstLanding,repeatForecast};
        if(live(n)){
          const moved=changedFootprints(parts(b),parts(n)).find(m=>m.shape===model.peer&&key(m.from.bbox)===key(peer.bbox));
          out.peer=moved?(moved.dx===model.peerDx&&moved.dy===model.peerDy?'predicted':'other_motion'):
            parts(n).get(model.peer)?.has(key(peer.bbox))?'stayed':'unresolved';
        }
        let end=n,issued=i+preparation.length+1;
        for(const s of run.steps.slice(i)){
          if(issued>=run.cap||!live(end)||!end.availableActionIds.includes(s.a))break;
          end=rep.act(op(s));issued++;
        }
        out.suffixWon=rep.win(end);out.issued=issued;
        if(i+preparation.length+2<=run.cap&&live(n)){
          rep.restore(i);for(const c of preparation)rep.act(c.input);
          const again=rep.act(plan.test.input);assert.equal(hash(again),hash(n));
          const twice=rep.act(plan.test.input);out.repeatWon=rep.win(twice);
          if(live(twice)){
            const startBox=out.peer==='predicted'?shiftedPeer:peer.bbox;
            const moved=changedFootprints(parts(again),parts(twice)).find(m=>m.shape===model.peer&&key(m.from.bbox)===key(startBox));
            out.repeatPeer=moved?(moved.dx===model.peerDx&&moved.dy===model.peerDy?'predicted':'other_motion'):
              parts(twice).get(model.peer)?.has(key(startBox))?'stayed':'unresolved';
          }
        }
        return out;
      }
      const trial={prefix:i,ref:model.ref,actor:signature(model.actor),peer:signature(model.peer),oldPeer:model.origin,newPeer:site(peer.bbox),
        requiredOffset:model.offset,test:model.input,peerDx:model.peerDx,peerDy:model.peerDy,
        present:plan.occupied.map(c=>c.input),absent:plan.clear.map(c=>c.input),atCondition:arm(plan.occupied),away:arm(plan.clear)};
      if(chosen.continuation){
        const {continuation,second}=chosen;
        const nextPeer=shift(peer.bbox,model.peerDx,model.peerDy);
        const nextActor=boxAt(actor.bbox,[plan.destination[0]+plan.test.dx,plan.destination[1]+plan.test.dy]);
        function testContinuation(preparation){
          rep.restore(i);for(const act of plan.occupied)rep.act(act.input);
          let b=rep.act(plan.test.input),from=nextActor;
          if(!live(b)||!parts(b).get(model.actor)?.has(key(from))||!parts(b).get(model.peer)?.has(key(nextPeer)))return {first:false};
          let verified=0;
          for(const action of preparation){
            const n=rep.act(action.input);if(!live(n))return {first:true,verified,won:rep.win(n)};
            const move=changedFootprints(parts(b),parts(n)).find(m=>m.shape===model.actor&&key(m.from.bbox)===key(from));
            if(!move||key(site(move.to.bbox))!==key(action.site)||!parts(n).get(model.peer)?.has(key(nextPeer)))return {first:true,verified};
            verified++;from=move.to.bbox;b=n;
          }
          const n=rep.act(continuation.test.input),won=rep.win(n);
          if(!live(n))return {first:true,verified,won};
          const move=changedFootprints(parts(b),parts(n)).find(m=>m.shape===model.peer&&key(m.from.bbox)===key(nextPeer));
          const outcome=move?(move.dx===second.peerDx&&move.dy===second.peerDy?'predicted':'other_motion'):
            parts(n).get(model.peer)?.has(key(nextPeer))?'stayed':'unresolved';
          let last=n,issued=i+plan.occupied.length+preparation.length+2;
          for(const s of run.steps.slice(i)){
            if(issued>=run.cap||!live(last)||!last.availableActionIds.includes(s.a))break;
            last=rep.act(op(s));issued++;
          }
          return {first:true,verified,peer:outcome,won,suffixWon:rep.win(last)};
        }
        trial.continuation={ref:second.ref,input:second.input,oldPeer:second.origin,from:site(nextPeer),
          to:site(shift(nextPeer,second.peerDx,second.peerDy)),requiredOffset:second.offset,
          present:continuation.occupied.map(a=>a.input),absent:continuation.clear.map(a=>a.input),
          atCondition:testContinuation(continuation.occupied),away:testContinuation(continuation.clear)};
      }
      trials.push(trial);
      board=rep.restore(i);
    }
    const n=rep.act(op(step));assert.equal(hash(n).slice(0,16),step.to);
    if(live(n)&&step.a>=1&&step.a<=4){
      const returned=parts(n),moves=changedFootprints(current,returned);
      const stationary=new Set([...current].filter(([shape,old])=>{const next=returned.get(shape);return next?.size===old.size && [...old.keys()].every(k=>next.has(k));}).map(([s])=>s));
      for(const a of moves){
        history.push({input:op(step),ref:i+1,shape:a.shape,dx:a.dx,dy:a.dy,from:site(a.from.bbox),to:site(a.to.bbox),stationary,
          ground:disjoint(a.from.bbox,a.to.bbox)?patch(n.frame,a.from.bbox):null});
        for(const p of moves){
          if(p.shape===a.shape||!disjoint(a.from.bbox,p.from.bbox))continue;
          const offset=[a.from.bbox[0]-p.from.bbox[0],a.from.bbox[1]-p.from.bbox[1]];
          if(Math.max(...offset.map(Math.abs))>2*Math.max(Math.abs(a.dx),Math.abs(a.dy)))continue;
          const id=JSON.stringify([a.shape,p.shape,op(step),offset,p.dx,p.dy]);
          const existing=models.get(id),origin=site(p.from.bbox);
          const entered=landing(board.frame,p.from.bbox,p.dx,p.dy);if(entered===null)continue;
          if(existing){existing.observed.add(key(origin));existing.landings.add(entered);}
          else models.set(id,{actor:a.shape,peer:p.shape,input:op(step),offset,peerDx:p.dx,peerDy:p.dy,ref:i+1,origin,
            observed:new Set([key(origin)]),landings:new Set([entered])});
        }
      }
    }
    board=n;
  }
  reports.push({code:run.code,level:run.start,initial:run.initial,trajectory:run.trajectory,
    cap:run.cap,won:run.levels[0].won,models:models.size,trials});
}
await writeFile(output,JSON.stringify(reports));console.log('episodes',reports.length,'proposals',reports.reduce((n,r)=>n+r.trials.length,0));
