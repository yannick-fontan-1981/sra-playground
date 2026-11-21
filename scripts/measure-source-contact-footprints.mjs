import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {GAME_CATALOG,getGameByCode} from '../src/games/catalog.ts';
import {hash,op,sourceReplay} from './sic-study-source-replay.mjs';
import {sourceBackend} from './sic-study-source-games.mjs';
import {exactJointPath} from '../src/logos-engine/v6-joint-transport.ts';
import {proposeContactExperiment,enactContactExperiment} from './source-contact-experiment.mjs';
import {footprints,changedFootprints,peerReturn,relativeSite,measuredFloor,recoverContactLayouts,matchesJointState} from './source-contact-footprints.mjs';

const [environment,out,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(environment));
const held=new Set(['hanoi_order',...GAME_CATALOG.filter(g=>g.group==='official').map(g=>g.family)]);
const reports=[];
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const run=JSON.parse(line),game=getGameByCode(run.code);assert.ok(game&&game.group!=='custom_4');
  if(run.error||held.has(game.family))continue;
  assert.ok(!run.resets&&!run.sourcePrefixActions&&!run.observedPriorLevelActions&&run.start===run.finish);
  const rep=sourceReplay(engine,{},run),cache=new Map(),history=new Map(),tested=new Set(),trials=[];
  const routed=new Set(),routes=[],prior=[];
  const selection={withMemory:null,currentBoardOnly:null};
  function view(board){const key=hash(board);if(!cache.has(key))cache.set(key,footprints(board.frame));return cache.get(key);}
  let b=rep.restore(0);
  for(const [i,s] of run.steps.entries()){
    const root=view(b),n=rep.act(op(s));assert.equal(hash(n).slice(0,16),s.to);
    if(prior.length<24)prior.push({rows:b.frame,forms:root});
    if(s.a>=1&&s.a<=4&&!rep.win(n)&&n.state==='NOT_FINISHED'){
      const next=view(n),moves=changedFootprints(root,next);
      for(const condition of Object.keys(selection)){
        if(selection[condition])continue;
        const observations=condition==='withMemory'?prior:[];
        const experiment=proposeContactExperiment(n.frame,next,observations,moves,history,op(s),run.cap-i-1);
        if(experiment){
          const outcome=enactContactExperiment(experiment,rep);
          if(outcome.won){
            rep.restore(i+1);
            assert.deepEqual(enactContactExperiment(experiment,rep),outcome);
          }
          selection[condition]={at:i+1,control:experiment.path[0][0],planned:experiment.path.length,...outcome};
          rep.restore(i+1);
        }
      }
      for(const a of moves){
        const controls=history.get(a.shape);
        if(!controls)continue;
        for(const p of moves){
          if(a.shape===p.shape||a.dx!==p.dx||a.dy!==p.dy)continue;
          const order=relativeSite(a.from,p.from,[a.dx,a.dy]);if(!order)continue;
          // The same body previously moved while every visible copy of this peer stayed in place.
          const evidence=[...controls].filter(([,c])=>!c.conflicted&&c.independent.has(p.shape));
          if(!evidence.length)continue;
          for(const [motor,c] of evidence){
            const now=relativeSite(a.to,p.to,c.delta);
            if(now===null||now===order||!n.availableActionIds.includes(Number(motor.slice(6))))continue;
            const key=JSON.stringify([a.shape,p.shape,order,now,motor]);
            if(tested.has(key)||tested.size>=16||i+2>run.cap)continue;
            tested.add(key);
            const fork=rep.act(motor);
            if(!rep.win(fork)&&fork.state==='NOT_FINISHED'){
              const end=view(fork),moved=peerReturn(next,end,a.shape,a.to,c.delta);
              const actual=peerReturn(next,end,p.shape,p.to,c.delta);
              trials.push({after:i+1,control:motor,sign:order,newSign:now,copies:p.copies,
                actor:moved,peer:actual,continuedAlongPreviousStep:peerReturn(next,end,p.shape,p.to,[a.dx,a.dy]),
                contactPredicts:'stayed',rigidPredicts:'travelled'});
              if(order===1&&moved==='travelled'&&actual==='stayed'){
                const current=end.get(a.shape).get(a.to.bbox.map((v,k)=>v+c.delta[k%2]).join(','));
                const actor={...a,to:current},surfaces=evidence.flatMap(([,item])=>[...item.surfaces.values()]);
                const metrics={};
                const layouts=recoverContactLayouts(fork.frame,actor,p,end,surfaces,metrics,prior);
                trials.at(-1).layoutEvidence=metrics;
                const pitch=Math.abs(a.dx||a.dy);
                const directions={};
                for(const [key,ctrl] of controls)if(!ctrl.conflicted&&Math.abs(ctrl.delta[0]||ctrl.delta[1])===pitch)
                  directions[key]=ctrl.delta.map(v=>v/pitch);
                directions[op(s)]=[a.dx/pitch,a.dy/pitch];
                for(const scene of layouts){
                  const routeKey=JSON.stringify([i,motor,scene.player,[...scene.floor].sort(),[...scene.boxes].sort(),[...scene.targets].sort()]);
                  if(routed.has(routeKey)||routed.size>=16)continue;
                  routed.add(routeKey);
                  const report={at:i+1,test:motor,controls:Object.keys(directions).length,
                    floor:scene.floor.size,boxes:scene.boxes.size,goals:scene.targets.size,planned:0,matched:0,played:0,won:false};
                  routes.push(report);
                  let search;
                  try{search=exactJointPath(scene,directions,performance.now()/1000+0.25);}
                  catch(error){report.stop=error.message;continue;}
                  report.planned=search.path.length;report.states=search.states;
                  rep.restore(i+1);assert.equal(hash(rep.act(motor)),hash(fork));
                  for(const [key,,state] of search.path.slice(0,Math.max(0,run.cap-i-2))){
                    const probe=rep.act(key);report.played++;
                    if(rep.win(probe)){report.won=true;break;}
                    if(probe.state!=='NOT_FINISHED'||!matchesJointState(view(probe),scene,actor,p,state))break;
                    report.matched++;
                  }
                }
              }
            }
            rep.restore(i+1);
          }
        }
      }
      for(const a of moves){
        const q=op(s),controls=history.get(a.shape)??new Map(),old=controls.get(q);
        if(old&&(old.delta[0]!==a.dx||old.delta[1]!==a.dy)){old.conflicted=true;continue;}
        if(old?.conflicted)continue;
        const record=old??{delta:[a.dx,a.dy],independent:new Set(),surfaces:new Map(),conflicted:false};
        for(const exposed of measuredFloor(b.frame,n.frame,a))record.surfaces.set(JSON.stringify(exposed),exposed);
        for(const [shape,group] of root){
          const after=next.get(shape);
          if(shape!==a.shape&&after?.size===group.size&&[...group.keys()].every(k=>after.has(k)))record.independent.add(shape);
        }
        controls.set(q,record);history.set(a.shape,controls);
      }
    }
    b=n;
  }
  assert.equal(rep.win(b),run.levels[0].won);reports.push({code:run.code,level:run.start,baselineWon:rep.win(b),selection,trials,routes});
}
await writeFile(out,JSON.stringify(reports));
const trials=reports.flatMap(r=>r.trials);
console.log(reports.length,trials.length,trials.filter(t=>t.actor==='travelled'&&t.peer==='stayed').length,
  trials.filter(t=>t.actor==='travelled'&&t.peer==='travelled').length);
