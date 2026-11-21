import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {measureNativeObservation,publicFrameHash} from '../src/logos-engine/v6-native-observer.ts';
import {newPreviewLearning,observePreviewBindings,visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {observePursuit,choosePursuit} from '../src/sic/pursuit-composition.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';

const [environment,path,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(environment)),rows=[];
async function view(b,n){
  return measureNativeObservation({frame_rows:b.frame,level:b.level,levels_completed:b.levelsCompleted,state:b.state,
    available_action_refs:b.availableActionIds.map(a=>'ACTION'+a),frame_hash:await publicFrameHash(b.frame)},n,'source-trial');
}
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const run=JSON.parse(line),g=getGameByCode(run.code);assert.ok(g&&g.group!=='custom_4');
  if(run.error||run.resets||run.sourcePrefixActions||run.observedPriorLevelActions||run.start!==run.finish)continue;
  const rep=sourceReplay(engine,{},run),learn=newPreviewLearning(),memory={pairs:{}},attempts={},tape=[],uses=[],tested=new Map();
  let b=rep.restore(0),o=await view(b,0),changedAt=null;
  while(tape.length<run.cap&&b.state==='NOT_FINISHED'&&!rep.win(b)){
    const i=tape.length,layout=visualLayout(o,b.frame),inputs=new Set(o.available_action_refs);
    const chosen=choosePursuit(memory,learn,layout,b.frame,inputs,attempts);
    const reference=run.steps[i],historic=reference&&op(reference);
    let cmd=historic;
    if(chosen){
      cmd=chosen.input;const k=[chosen.actor,chosen.peer,chosen.from,chosen.target,cmd].join('/');
      attempts[k]=(attempts[k]??0)+1;
    }else if(changedAt!==null||!cmd){
      cmd=[...inputs].filter(s=>/^ACTION[1-4]$/.test(s)).sort((a,c)=>(tested.get(o.frame_hash+'/'+a)??0)-(tested.get(o.frame_hash+'/'+c)??0))[0];
    }
    if(!cmd)break;
    if(cmd!==historic&&changedAt===null)changedAt=i;
    tested.set(o.frame_hash+'/'+cmd,(tested.get(o.frame_hash+'/'+cmd)??0)+1);
    const n=rep.act(cmd),after=await view(n,i+1),newLayout=visualLayout(after,n.frame);
    if(changedAt===null)assert.equal(hash(n).slice(0,16),reference.to);
    if(chosen){
      const peers=newLayout[chosen.peer]??[],old=layout[chosen.peer]??[];
      uses.push({i,actor:chosen.actor,peer:chosen.peer,op:cmd,horizon:chosen.horizon,basis:chosen.basis,
        at:chosen.from,to:chosen.to,target:chosen.target,options:chosen.peerOptions.length,
        actorMatched:newLayout[chosen.actor]?.some(p=>p.at.join()===chosen.to.join())??false,
        peerCountBefore:old.length,peerCountAfter:peers.length,score:rep.win(n)});
    }
    if(!rep.win(n)&&n.state==='NOT_FINISHED'){
      observePursuit(memory,layout,newLayout,cmd,after.observation_ref);
      observePreviewBindings(learn,o,after,layout,newLayout,cmd);
    }
    tape.push({cmd,from:hash(b).slice(0,16),to:hash(n).slice(0,16)});o=after;b=n;
  }
  const won=rep.win(b);let checked=rep.restore(0);
  for(const t of tape){assert.equal(hash(checked).slice(0,16),t.from);checked=rep.act(t.cmd);assert.equal(hash(checked).slice(0,16),t.to);}
  assert.equal(rep.win(checked),won);
  rows.push({code:run.code,level:run.start,baseline:run.levels[0].won,baselineActions:run.issued,won,actions:tape.length,changedAt,uses,tape});
  console.log(run.code,run.start,changedAt,uses.length,won,tape.length);
}
await writeFile(path,JSON.stringify(rows));
