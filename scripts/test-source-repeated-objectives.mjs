import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {footprints,changedFootprints} from './source-contact-footprints.mjs';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';

const [environment,output,...files]=process.argv.slice(2);
const engine=await sourceBackend(resolve(environment)),results=[];
const center=part=>[0,1].map(i=>(part.bbox[i]+part.bbox[i+2])/2);
const distance=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
const token=s=>createHash('sha256').update(s).digest('hex').slice(0,12);

// A sibling becomes a potential objective only after A has left an earlier
// site and the missing peer has remained absent. Equal-duration alternatives
// receive the same historical suffix. Only the public engine awards a score.
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line),game=getGameByCode(r.code);
  assert.ok(game&&game.group!=='custom_4');
  if(r.error||r.resets||r.sourcePrefixActions||r.observedPriorLevelActions||r.start!==r.finish)continue;
  const rep=sourceReplay(engine,{},r),motors=new Map(),witnesses=[],tested=new Set(),trials=[];
  let board=rep.restore(0),shapes=footprints(board.frame);
  const live=b=>!rep.win(b)&&b.state==='NOT_FINISHED';
  const commands=r.steps.map(op);
  for(const [i,step] of r.steps.entries()){
    const actions=board.availableActionIds.filter(n=>n>=1&&n<=4).map(n=>'ACTION'+n);
    for(const w of witnesses){
      const actors=shapes.get(w.actor),peers=shapes.get(w.peer);
      if(peers?.has(w.site))w.returned=true;
      if(w.returned||!actors||actors.size!==1||!peers||peers.has(w.site)||peers.size>=w.before)continue;
      const from=center([...actors.values()][0]);
      if(distance(from,w.place)>w.pitch*.65&&peers.size<w.before)w.confirmed??=i;
      if(w.confirmed===undefined||trials.length>=8)continue;
      for(const input of actions){
        const displacements=motors.get(w.actor)?.get(input);
        if(displacements?.size!==1)continue;
        const delta=displacements.values().next().value,aim=from.map((v,k)=>v+delta[k]);
        const near=[...peers].filter(([,p])=>distance(center(p),aim)<=w.pitch*.45);
        if(near.length!==1||distance(from,center(near[0][1]))<=w.pitch*.55)continue;
        const [site,part]=near[0],signature=[w.actor,w.peer,site,input].join('/');
        if(tested.has(signature)||trials.length>=8)continue;
        tested.add(signature);
        const outcomes=[];
        for(const control of actions){
          const start=rep.restore(i);assert.equal(hash(start),hash(board));
          const next=rep.act(control),wonImmediately=rep.win(next);
          const after=live(next)?footprints(next.frame):null,actor=after?.get(w.actor),rest=after?.get(w.peer);
          const entered=actor?.size===1&&distance(center([...actor.values()][0]),center(part))<=w.pitch*.45;
          const reduced=!!(after&&entered&&(rest?.size??0)===peers.size-1&&!rest?.has(site));
          let end=next;
          for(const later of commands.slice(i+1)){
            if(!live(end)||!end.availableActionIds.includes(Number(later.split(':')[0].slice(6))))break;
            end=rep.act(later);
          }
          outcomes.push({input:control,reduced,wonImmediately,suffixWon:rep.win(end)});
        }
        // Can the same B still work without A? Keep only substitutions that
        // put the actor back at the identical approach to the same sibling.
        const alternatives=[],entry=rep.restore(w.step-1);
        for(const replace of entry.availableActionIds.filter(n=>n>=1&&n<=4).map(n=>'ACTION'+n)){
          if(replace===commands[w.step-1])continue;
          rep.restore(w.step-1);
          let b=rep.act(replace),replayed=0;
          for(const cmd of commands.slice(w.step,i)){
            if(!live(b)||!b.availableActionIds.includes(Number(cmd.split(':')[0].slice(6))))break;
            b=rep.act(cmd);replayed++;
          }
          if(replayed!==i-w.step||!live(b)||!b.availableActionIds.includes(Number(input.slice(6))))continue;
          const before=footprints(b.frame),subjects=before.get(w.actor),items=before.get(w.peer);
          if(subjects?.size!==1||distance(center([...subjects.values()][0]),from)!==0||!items?.has(w.site)||!items.has(site))continue;
          const returned=rep.act(input),wonImmediately=rep.win(returned),later=live(returned)?footprints(returned.frame):null;
          const subject=later?.get(w.actor),remaining=later?.get(w.peer);
          const reduced=!!(later&&subject?.size===1&&distance(center([...subject.values()][0]),center(part))<=w.pitch*.45&&
            (remaining?.size??0)===items.size-1&&!remaining?.has(site));
          let end=returned;
          for(const cmd of commands.slice(i+1)){
            if(!live(end)||!end.availableActionIds.includes(Number(cmd.split(':')[0].slice(6))))break;
            end=rep.act(cmd);
          }
          let changedOutsideFirst=0;
          for(let y=0;y<b.frame.length;y++)for(let x=0;x<b.frame[y].length;x++)
            if(b.frame[y][x]!==board.frame[y][x]&&distance([x,y],w.place)>w.pitch/2)changedOutsideFirst++;
          alternatives.push({replace,reduced,wonImmediately,suffixWon:rep.win(end),changedOutsideFirst});
        }
        trials.push({prefix:i,earlierContact:w.step,confirmed:w.confirmed,actor:token(w.actor),peer:token(w.peer),
          firstSite:w.place,nextSite:center(part),input,recorded:op(step),outcomes,withoutFirst:alternatives});
        rep.restore(i);
      }
    }
    const next=rep.act(op(step));assert.equal(hash(next).slice(0,16),step.to);
    if(!live(next))break;
    const after=footprints(next.frame);
    if(step.a>=1&&step.a<=4)for(const move of changedFootprints(shapes,after)){
      if(move.copies!==1)continue;
      const byInput=motors.get(move.shape)??new Map(),seen=byInput.get(op(step))??new Map();
      const delta=[move.dx,move.dy],pitch=Math.max(...delta.map(Math.abs));
      seen.set(delta.join(),delta);byInput.set(op(step),seen);motors.set(move.shape,byInput);
      for(const [peer,parts] of shapes){
        const rest=after.get(peer);
        if(peer===move.shape||parts.size<2||!rest||rest.size!==parts.size-1)continue;
        const lost=[...parts].filter(([site,p])=>!rest.has(site)&&distance(center(p),center(move.to))<=pitch*.45);
        if(lost.length!==1||distance(center(lost[0][1]),center(move.from))<=pitch*.55)continue;
        const [site,p]=lost[0];
        if(witnesses.some(w=>w.actor===move.shape&&w.peer===peer&&w.site===site))continue;
        witnesses.push({actor:move.shape,peer,site,place:center(p),pitch,before:parts.size,step:i+1});
      }
    }
    board=next;shapes=after;
  }
  const confirmations=witnesses.filter(w=>w.confirmed!==undefined).map(w=>({actor:token(w.actor),peer:token(w.peer),
    firstSite:w.place,pitch:w.pitch,step:w.step,confirmed:w.confirmed}));
  results.push({code:r.code,level:r.start,cap:r.cap,baselineWon:r.levels[0].won,contacts:witnesses.length,
    persistent:confirmations.length,confirmations,trials});
}
await writeFile(output,JSON.stringify(results));
console.log('episodes',results.length,'proposals',results.reduce((s,r)=>s+r.trials.length,0));
