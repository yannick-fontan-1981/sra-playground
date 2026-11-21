import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';
import {footprints,changedFootprints} from './source-contact-footprints.mjs';
import {getGameByCode} from '../src/games/catalog.ts';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {cursorCandidates,newCursorMemory,recordCursorTrial} from '../src/sic/marked-cursor-selection.ts';
import {planRoleOccupancy} from '../src/sic/role-occupancy-experiment.ts';
import {measureTransferredPopulationSelection} from '../src/sic/population-placement.ts';
import {measureReferencePopulation,referencePopulationPoint} from '../src/logos-engine/v6-reference-population-observation.ts';

const [environment,output,...args]=process.argv.slice(2),engine=await sourceBackend(resolve(environment));
const grounded=args.includes('--after-selection'), files=args.filter(x=>x!=='--after-selection');
const results=[], site=box=>box.slice(0,2), key=p=>p.join(',');
const within=(a,b)=>a[0]>=b[0] && a[1]>=b[1] && a[2]<=b[2] && a[3]<=b[3];
const offset=(s,b)=>[s[0],s[1],s[0]+b[2]-b[0],s[1]+b[3]-b[1]];
const patch=(rows,b)=>Array.from({length:b[3]-b[1]+1},(_,j)=>rows[b[1]+j]?.slice(b[0],b[2]+1).join(',')).join('/');
const marked=(rows,at,t)=>t.offsets.every(([x,y])=>rows[at[1]+y]?.[at[0]+x]===t.ink);
for(const path of files)for(const line of (await readFile(path,'utf8')).trim().split(/\r?\n/)){
  const run=JSON.parse(line);assert.ok(getGameByCode(run.code)?.group!=='custom_4');
  if(run.error||run.resets||run.sourcePrefixActions||run.observedPriorLevelActions||run.start!==run.finish)continue;
  if(!run.steps.some(s=>s.a===6))continue;
  const rep=sourceReplay(engine,{},run),cache=new Map(),moves=[],memory=newCursorMemory(),tested=new Set(),trials=[];
  const live=b=>b.state==='NOT_FINISHED'&&!rep.win(b);
  async function view(b) {
    const id=hash(b);
    if(!cache.has(id)){
      const o=await measureNativeObservation({frame_rows:b.frame,frame_hash:id,level:b.level,levels_completed:b.levelsCompleted,
        state:b.state,available_action_refs:b.availableActionIds.map(a=>'ACTION'+a),palette:b.palette},cache.size,'source');
      cache.set(id,{o,groups:footprints(b.frame)});
    }
    return cache.get(id);
  }
  let board=rep.restore(0),current=await view(board),pairsAt=0,withMotors=0,learnedScene=null;
  for(const [i,step] of run.steps.entries()){
    if(i>=3 && i%2===0 && trials.length<5 && board.availableActionIds.includes(6)){
      const population=grounded&&learnedScene?measureReferencePopulation(board.frame,learnedScene):null;
      const marks=cursorCandidates(current.o,board.frame,memory).filter(m=>!grounded || population?.bodies.some(({cell})=>{
        const {x,y}=referencePopulationPoint(population,cell);
        return within([x,y,x,y],m.target.box);
      }));
      if(marks.length)pairsAt++;
      const options=[];
      for(const mark of marks){
        const first=site(mark.source.box),second=site(mark.target.box);
        const shapes=new Set([...current.groups].filter(([,group])=>[...group.values()].some(p=>within(p.bbox,mark.source.box)
          && [mark.ink,mark.source.ink].includes(p.color))).map(([shape])=>shape));
        const samples=moves.filter(m=>shapes.has(m.shape));
        const motors=[];
        for(const input of new Set(samples.map(m=>m.input))){
          const witnesses=samples.filter(m=>m.input===input);
          if(new Set(witnesses.map(m=>key([m.dx,m.dy]))).size===1)motors.push(witnesses[0]);
        }
        if(motors.length<2)continue;
        withMotors++;
        const seenFree=new Set(samples.filter(m=>m.ground!==null).map(m=>m.ground));
        const possible=s=>{
          const box=offset(s,mark.source.box);
          if(box[0]<0||box[1]<0||box[3]>=board.frame.length||box[2]>=board.frame[0].length)return false;
          return key(s)===key(first)||seenFree.has(patch(board.frame,box));
        };
        const plan=planRoleOccupancy(first,second,motors,possible,Math.min(7,run.cap-i-2),tested);
        if(plan)options.push({mark,plan,first,second});
      }
      const selected=options.sort((a,b)=>a.plan.clear.length-b.plan.clear.length)[0];
      if(selected){
        const {mark,plan,first,second}=selected;
        const signature=[key(first),key(second),...plan.occupied.slice(0,-1).map(p=>p.input),plan.occupied.at(-1).input,plan.clear.at(-1).input,plan.test.input].join('/');
        tested.add(signature);
        function arm(path){
          let b=rep.restore(i);const scoreStart=hash(b);
          assert.equal(scoreStart,hash(board));let verified=0,oldSite=first;
          for(const step of path){
            if(!marked(b.frame,oldSite,mark)||marked(b.frame,step.site,mark))break;
            b=rep.act(step.input);
            if(!live(b)||!marked(b.frame,step.site,mark)||marked(b.frame,oldSite,mark))break;
            oldSite=step.site;verified++;
          }
          const result={verified,preparation:path.length,won:rep.win(b)};
          if(!live(b)||verified!==path.length)return result;
          const parked=path.at(-1).site,parkBox=offset(parked,mark.source.box);
          result.secondAppearanceRetained=patch(board.frame,mark.target.box)===patch(b.frame,mark.target.box);
          if(!b.availableActionIds.includes(6)||marked(b.frame,second,mark))return result;
          const beforeSwitch=b;b=rep.act('ACTION6:'+key(mark.point));
          result.clickedImageChanged=hash(beforeSwitch)!==hash(b);
          const acquired=live(b)?measureTransferredPopulationSelection(beforeSwitch.frame,b.frame,mark.point):null;
          const cellAt=(sc,pos)=>sc.bodies.find(body=>{
            const {x,y}=referencePopulationPoint(sc,body.cell);return within([x,y,x,y],offset(pos,mark.target.box));
          });
          const populationBound=acquired && cellAt(acquired.scene,parked) &&
            key(cellAt(acquired.scene,second)?.cell??[])===key(acquired.selection)
            && patch(beforeSwitch.frame,parkBox)!==patch(b.frame,parkBox);
          result.transferred=!!populationBound||live(b)&&marked(b.frame,second,mark)&&!marked(b.frame,parked,mark)
            && patch(beforeSwitch.frame,parkBox)!==patch(b.frame,parkBox);
          result.populationBound=!!populationBound;
          if(!result.transferred || !b.availableActionIds.includes(Number(plan.test.input.slice(6))))return result;
          const after=rep.act(plan.test.input);
          result.won=rep.win(after);
          if(live(after)){
            const arrived=marked(after.frame,plan.destination,mark)&&!marked(after.frame,second,mark);
            const stayed=marked(after.frame,second,mark)&&patch(after.frame,mark.target.box)===patch(b.frame,mark.target.box);
            result.second=arrived?'arrived':stayed?'stayed':'other';
            result.firstRetained=patch(b.frame,parkBox)===patch(after.frame,parkBox);
            if(populationBound){
              const actual=measureReferencePopulation(after.frame,acquired.scene);
              if(actual){
                const old=new Set(acquired.scene.bodies.map(p=>key(p.cell))),now=new Set(actual.bodies.map(p=>key(p.cell)));
                const parkedBody=cellAt(acquired.scene,parked),from=key(acquired.selection);
                const dest=cellAt(actual,plan.destination),gone=[...old].filter(k=>!now.has(k)),added=[...now].filter(k=>!old.has(k));
                result.firstRetained=now.has(key(parkedBody.cell));
                result.second=!gone.length&&!added.length?'stayed':gone.length===1 && gone[0]===from && added.length===1 && dest && added[0]===key(dest.cell)?'arrived':'other';
              }
            }
          }
          let end=after,used=i+path.length+2;
          for(const st of run.steps.slice(i)){
            if(used>=run.cap||!live(end)||!end.availableActionIds.includes(st.a))break;
            end=rep.act(op(st));used++;
          }
          result.suffixWon=rep.win(end);result.used=used;
          return result;
        }
        trials.push({prefix:i,first,second,destination:plan.destination,test:plan.test.input,source:plan.test.ref,
          occupied:plan.occupied.map(s=>s.input),clear:plan.clear.map(s=>s.input),withOccupant:arm(plan.occupied),withoutOccupant:arm(plan.clear)});
        board=rep.restore(i);
      }
    }
    const next=rep.act(op(step));assert.equal(hash(next).slice(0,16),step.to);
    if(live(next)){
      const target=await view(next);
      if(grounded && step.a===6){
        const selection=measureTransferredPopulationSelection(board.frame,next.frame,[step.data.x,step.data.y]);
        if(selection)learnedScene=selection.scene;
      }
      if(step.a>=1&&step.a<=4) for(const m of changedFootprints(current.groups,target.groups)){
        const disjoint=m.from.bbox[2]<m.to.bbox[0]||m.to.bbox[2]<m.from.bbox[0]||m.from.bbox[3]<m.to.bbox[1]||m.to.bbox[3]<m.from.bbox[1];
        moves.push({input:op(step),ref:i+1,shape:m.shape,dx:m.dx,dy:m.dy,ground:disjoint?patch(next.frame,m.from.bbox):null});
      }
      recordCursorTrial(memory,current.o,target.o,board.frame,next.frame,op(step));current=target;
    }
    board=next;
  }
  results.push({code:run.code,level:run.start,baseline:run.levels[0].won,pairsAt,withMotors,trials});
}
await writeFile(output,JSON.stringify(results));console.log('episodes',results.length,'proposals',results.reduce((n,r)=>n+r.trials.length,0));
