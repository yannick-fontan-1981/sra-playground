import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {measureNativeObservation,publicFrameHash} from '../src/logos-engine/v6-native-observer.ts';
import {observePreviewBindings,newPreviewLearning,visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {observePursuit} from '../src/sic/pursuit-composition.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';

const [environment,output,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(environment)),reports=[];
async function observation(b,i){return measureNativeObservation({frame_rows:b.frame,level:b.level,levels_completed:b.levelsCompleted,
  state:b.state,available_action_refs:b.availableActionIds.map(n=>'ACTION'+n),frame_hash:await publicFrameHash(b.frame)},i,'source-audit');}
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const run=JSON.parse(line),g=getGameByCode(run.code);assert.ok(g&&g.group!=='custom_4');
  if(run.error||run.resets||run.sourcePrefixActions||run.observedPriorLevelActions||run.start!==run.finish)continue;
  const rep=sourceReplay(engine,{},run),learn=newPreviewLearning(),memory={pairs:{}},stats=new Map();
  let b=rep.restore(0),o=await observation(b,0);
  for(const [i,s] of run.steps.entries()){
    const n=rep.act(op(s));assert.equal(hash(n).slice(0,16),s.to);if(rep.win(n)||n.state!=='NOT_FINISHED')break;
    const a=await observation(n,i+1),old=visualLayout(o,b.frame),next=visualLayout(a,n.frame);
    observePursuit(memory,old,next,op(s),a.observation_ref);
    observePreviewBindings(learn,o,a,old,next,op(s));
    for(const [id,r] of Object.entries(memory.pairs)){
      const m=learn.partMotion?.[r.actor];if(!m)continue;
      const d=Object.entries(m.displacements??m.axes).filter(([k])=>/^ACTION[1-4]$/.test(k));
      const stable=d.filter(([,v])=>Object.keys(v).length===1&&Object.values(v).some(x=>Math.abs(x.d[0])+Math.abs(x.d[1])===r.pitch));
      const prev=stats.get(id)??{first:i+1,eligible:null,largestPopulation:0};prev.largestPopulation=Math.max(prev.largestPopulation,next[r.peer]?.length??0);
      if(!prev.eligible&&next[r.actor]?.length===1&&r.away>=3&&r.away>=4*r.toward&&r.responses.length>=2&&stable.length>=2)prev.eligible=i+1;
      stats.set(id,prev);
    }
    b=n;o=a;
  }
  const pairs=Object.entries(memory.pairs).map(([id,r])=>({actor:r.actor,peer:r.peer,pitch:r.pitch,away:r.away,toward:r.toward,
    responses:r.responses,observations:r.samples.length,...stats.get(id),motors:Object.fromEntries(Object.entries(learn.partMotion?.[r.actor]?.displacements??{}).filter(([k])=>/^ACTION[1-4]$/.test(k)).map(([k,v])=>[k,Object.values(v).map(x=>[x.d,x.count])]))}));
  reports.push({code:run.code,level:run.start,trajectory:run.trajectory,pairs:pairs.sort((a,b)=>b.away+b.toward-a.away-a.toward)});
}
await writeFile(output,JSON.stringify(reports));console.log(reports.map(r=>[r.code,r.level,r.pairs.length]));
