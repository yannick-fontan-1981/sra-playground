import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {getGameByCode} from '../src/games/catalog.ts';
import {measureNativeObservation,publicFrameHash} from '../src/logos-engine/v6-native-observer.ts';
import {visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';

const [environment,output,candidate,control]=process.argv.slice(2),engine=await sourceBackend(resolve(environment));
const read=async file=>(await readFile(file,'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const baselines=await read(control),results=[],same=(a,b)=>a.join()===b.join();
async function scene(b,i){
  const o=await measureNativeObservation({frame_rows:b.frame,level:b.level,levels_completed:b.levelsCompleted,state:b.state,
    available_action_refs:b.availableActionIds.map(a=>'ACTION'+a),frame_hash:await publicFrameHash(b.frame)},i,'source-proof');
  return visualLayout(o,b.frame);
}
for(const r of await read(candidate)){
  const g=getGameByCode(r.code);assert.ok(g&&g.group!=='custom_4'&&!r.resets&&!r.sourcePrefixActions&&!r.observedPriorLevelActions);
  const baseline=baselines.find(b=>b.code===r.code&&b.start===r.start&&b.initial===r.initial&&b.cap===r.cap);assert.ok(baseline);
  const base=sourceReplay(engine,{},baseline);assert.equal(base.win(base.restore(baseline.issued)),baseline.levels[0].won);
  const rep=sourceReplay(engine,{},r);let b=rep.restore(0),active;
  const blocks=[];
  for(const [i,c] of r.replayCommands.entries()){
    assert.equal(hash(b).slice(0,16),c.from);const n=rep.act(op(r.steps[i]));assert.equal(hash(n).slice(0,16),c.to);
    if(c.reactiveContact){
      const t=c.reactiveContact,old=await scene(b,i),next=await scene(n,i+1),oldPeers=old[t.peer]??[],newPeers=next[t.peer]??[];
      assert.ok(old[t.actor]?.some(s=>same(s.at,t.from)));
      assert.ok(oldPeers.some(s=>same(s.at,t.target)));
      const held=oldPeers.filter(s=>!same(s.at,t.target));
      const actor=next[t.actor]?.some(s=>same(s.at,t.to))??false;
      const reduced=newPeers.length<oldPeers.length&&same(t.target,t.to);
      const peer=newPeers.some(s=>!held.some(p=>same(p.at,s.at))&&t.peerOptions.some(p=>same(s.at,p)));
      if(!active){active={start:i+1,end:i+1,actorMatches:0,peerMatches:0,steps:0,contacts:[],horizons:[],basis:[]};blocks.push(active);}
      active.end=i+1;active.steps++;active.actorMatches+=Number(actor);active.peerMatches+=Number(peer||reduced||rep.win(n));
      active.horizons.push(t.horizon);if(!active.basis.includes(t.basis))active.basis.push(t.basis);
      if(reduced||rep.win(n))active.contacts.push({step:i+1,before:oldPeers.length,after:newPeers.length,won:rep.win(n)});
    }else active=undefined;
    b=n;
  }
  assert.equal(rep.win(b),r.levels[0].won);
  for(const block of blocks){
    const i=block.start-1,n=block.end-i,start=rep.restore(i),suffix=r.steps.slice(block.end).map(op);
    function measure(replacement){
      let v=rep.restore(i),used=i;
      for(const cmd of [...replacement,...suffix]){
        if(rep.win(v)||v.state!=='NOT_FINISHED'||used>=r.cap||!v.availableActionIds.includes(Number(cmd.split(':')[0].slice(6))))break;
        v=rep.act(cmd);used++;
      }
      return {won:rep.win(v),used,end:hash(v).slice(0,16)};
    }
    block.omitted=measure([]);
    block.replacedByBaseline=measure(baseline.steps.slice(i,block.end).map(op));
    block.constantControls=start.availableActionIds.filter(a=>a!==6).map(a=>({input:'ACTION'+a,...measure(Array(n).fill('ACTION'+a))}));
  }
  results.push({code:r.code,level:r.start,initial:r.initial,cap:r.cap,baselineWon:baseline.levels[0].won,
    baselineActions:baseline.issued,baselineTape:baseline.trajectory,won:r.levels[0].won,actions:r.issued,tape:r.trajectory,
    withdrawal:r.withdrawal?.family,finalFamily:r.replayCommands.at(-1)?.family,blocks});
}
await writeFile(output,JSON.stringify(results));console.log('verified',results.map(r=>[r.code,r.level,r.won,r.actions,r.blocks.length]));
