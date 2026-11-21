import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {measureNativeObservation,publicFrameHash} from '../src/logos-engine/v6-native-observer.ts';
import {newPreviewLearning,observePreviewBindings,visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {choosePursuit,observePursuit} from '../src/sic/pursuit-composition.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';

const [environment,output,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(environment)),reports=[];
const key=p=>p.join(','),add=(p,d)=>p.map((v,i)=>v+d[i]),same=(p,q)=>key(p)===key(q);
async function observation(b,i){return measureNativeObservation({frame_rows:b.frame,level:b.level,levels_completed:b.levelsCompleted,state:b.state,
  available_action_refs:b.availableActionIds.map(n=>'ACTION'+n),frame_hash:await publicFrameHash(b.frame)},i,'source-frontier');}
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line),g=getGameByCode(r.code);assert.ok(g&&g.group!=='custom_4');
  if(r.error||r.resets||r.sourcePrefixActions||r.observedPriorLevelActions||r.start!==r.finish)continue;
  const rep=sourceReplay(engine,{},r),learn=newPreviewLearning(),memory={pairs:{}},counts={};
  const tried=new Set(),examples=[],tests=[];
  let b=rep.restore(0),o=await observation(b,0);
  for(const [i,step] of r.steps.entries()){
    const layout=visualLayout(o,b.frame),views=[];
    const proposal=choosePursuit(memory,learn,layout,b.frame,new Set(o.available_action_refs),{},t=>views.push(t));
    let offer;
    for(const t of views){
      const reachable=new Set(t.reachable.map(key));
      for(const goal of t.targets){
        const connected=reachable.has(key(goal));
        const status=connected?(proposal?'route_available':'connected_without_joint_route'):'outside';
        counts[status]=(counts[status]??0)+1;if(connected)continue;
        const within=p=>p[0]>=0&&p[1]>=0&&p[0]<b.frame[0].length*2&&p[1]<b.frame.length*2;
        const passable=p=>t.known.has(key(p))||same(p,goal)||b.frame[Math.floor(p[1]/2)]?.[Math.floor(p[0]/2)]===t.floor;
        const directions=[[t.pitch,0],[-t.pitch,0],[0,t.pitch],[0,-t.pitch]],back=[goal],away=new Set([key(goal)]);
        for(let j=0;j<back.length;j++)for(const d of directions){
          const v=add(back[j],d),k=key(v);if(!within(v)||away.has(k)||!passable(v))continue;away.add(k);back.push(v);
        }
        const surface=[];
        for(const v of t.reachable)for(const motor of t.motors){
          const barrier=add(v,motor.d),k=key(barrier);
          if(!within(barrier)||reachable.has(k)||!directions.some(d=>away.has(key(add(barrier,d)))))continue;
          const roles=Object.entries(layout).filter(([name,parts])=>name!==t.actor&&name!==t.peer&&parts.some(p=>
            Math.abs(p.at[0]-barrier[0])<=t.pitch/3&&Math.abs(p.at[1]-barrier[1])<=t.pitch/3&&
            Math.max(p.box[2]-p.box[0]+1,p.box[3]-p.box[1]+1)<=t.pitch));
          surface.push({v,barrier,input:motor.op,roles:roles.map(([name])=>name)});
        }
        const sampleKey=[t.actor,t.peer,t.from,goal,t.floor,reachable.size,away.size].join('/');
        if(examples.length<8&&!examples.some(x=>x.sampleKey===sampleKey))examples.push({prefix:i,sampleKey,from:t.from,goal,
          home:reachable.size,other:away.size,adjacentCutCells:new Set(surface.map(s=>key(s.barrier))).size,
          distinctObjectCuts:new Set(surface.filter(s=>s.roles.length).map(s=>key(s.barrier))).size});
        if(offer||tests.length>=4)continue;
        const queue=[{p:t.from,word:[]}],seen=new Set([key(t.from)]);
        for(let j=0;j<queue.length&&!offer;j++){
          const node=queue[j],s=surface.find(s=>same(s.v,node.p)&&s.roles.length&&!tried.has([s.roles[0],s.barrier,s.input].join('/')));
          if(s&&i+node.word.length+1<=r.cap){offer={t,s,preparation:node.word};break;}
          if(node.word.length===8)continue;
          for(const m of t.motors){
            const v=add(node.p,m.d),k=key(v);if(seen.has(k)||!reachable.has(k))continue;seen.add(k);queue.push({p:v,word:[...node.word,m.op]});
          }
        }
      }
    }
    if(offer){
      const {t,s,preparation}=offer,role=s.roles[0];tried.add([role,s.barrier,s.input].join('/'));
      async function arm(word){
        let board=rep.restore(i);
        for(const c of word){board=rep.act(c);if(rep.win(board)||board.state!=='NOT_FINISHED')return {won:rep.win(board)};}
        const before=visualLayout(await observation(board,i+word.length),board.frame);
        const placed=before[t.actor]?.some(z=>same(z.at,s.v))??false;const n=rep.act(s.input);
        const after=visualLayout(await observation(n,i+word.length+1),n.frame);
        const old=before[role]??[],next=after[role]??[],diff=old.filter(z=>!next.some(q=>same(q.at,z.at)));
        const returned=next.filter(z=>!old.some(q=>same(q.at,z.at)));
        return {placed,actorAtCut:after[t.actor]?.some(z=>same(z.at,s.barrier))??false,moved:diff.length===1&&returned.length===1
          ?{from:diff[0].at,to:returned[0].at}:null,won:rep.win(n)};
      }
      tests.push({prefix:i,actor:t.actor,peer:t.peer,barrier:s.barrier,from:s.v,goal:t.targets,role,input:s.input,preparation,prepared:await arm(preparation),bare:await arm([])});
      b=rep.restore(i);
    }
    const n=rep.act(op(step));assert.equal(hash(n).slice(0,16),step.to);if(rep.win(n)||n.state!=='NOT_FINISHED')break;
    const a=await observation(n,i+1),next=visualLayout(a,n.frame);
    observePursuit(memory,layout,next,op(step),a.observation_ref);observePreviewBindings(learn,o,a,layout,next,op(step));
    b=n;o=a;
  }
  reports.push({code:r.code,level:r.start,counts,examples,tests});
}
await writeFile(output,JSON.stringify(reports));console.log('episodes',reports.length,'interventions',reports.reduce((n,r)=>n+r.tests.length,0));
