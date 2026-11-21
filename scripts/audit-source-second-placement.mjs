import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';
import {changedFootprints,footprints} from './source-contact-footprints.mjs';

const [environment,output,study,...files]=process.argv.slice(2);
const allowPeerTransit=process.env.SIC_STUDY_ALLOW_PEER_TRANSIT==='1';
const source=await sourceBackend(resolve(environment));
const episodes=new Map(),results=[];
for(const f of files)for(const s of (await readFile(f,'utf8')).trim().split(/\r?\n/)){
  const run=JSON.parse(s),game=getGameByCode(run.code);
  assert.ok(game&&game.group!=='custom_4'&&!run.sourcePrefixActions&&!run.observedPriorLevelActions&&!run.resets);
  episodes.set([run.code,run.start].join('/'),run);
}
const signature=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
const key=box=>box.join(','),corner=box=>box.slice(0,2);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const paired=t=>t.atCondition.peer==='predicted'&&t.away.peer==='stayed';
for(const row of JSON.parse(await readFile(study,'utf8'))){
  const run=episodes.get([row.code,row.level].join('/'));if(!run)continue;
  const rep=sourceReplay(source,{},run);
  for(const trial of row.trials.filter(t=>t.continuation&&paired(t)&&!paired(t.continuation))){
    const second=trial.continuation;
    const live=b=>b.state==='NOT_FINISHED'&&!rep.win(b);
    const observed=new Map();
    function parts(b){const h=hash(b);if(!observed.has(h))observed.set(h,footprints(b.frame));return observed.get(h);}
    let b=rep.restore(0);const inputs=new Set();
    for(const step of run.steps.slice(0,trial.prefix)){
      const n=rep.act(op(step));assert.equal(hash(n).slice(0,16),step.to);
      if(step.a>=1&&step.a<=4&&changedFootprints(parts(b),parts(n)).some(m=>signature(m.shape)===trial.actor))inputs.add(op(step));
      b=n;
    }
    const start=()=>{rep.restore(trial.prefix);for(const input of trial.present)rep.act(input);return rep.act(trial.test);};
    for(const input of trial.present)b=rep.act(input);
    const n=rep.act(trial.test),moved=changedFootprints(parts(b),parts(n));
    const peer=moved.find(m=>signature(m.shape)===trial.peer&&key(corner(m.from.bbox))===key(trial.newPeer));
    if(!peer||key(corner(peer.to.bbox))!==key(second.from))continue;
    const actor=moved.find(m=>signature(m.shape)===trial.actor&&key(corner(m.from.bbox))===key(add(trial.newPeer,trial.requiredOffset)));
    if(!actor)continue;
    const peerBox=peer.to.bbox,desired=key(add(second.from,second.requiredOffset));
    const target=key(second.to),restore=word=>{let value=start();for(const input of word)value=rep.act(input);return value;};
    const firstControls={};
    function execute(node,input){
      const first=restore(node.word);assert.equal(hash(first),node.frame);
      const next=rep.act(input);
      const diagnose=reason=>{if(!node.word.length)firstControls[input]=reason;return null;};
      if(!live(next))return diagnose(rep.win(next)?'score':'terminal');
      const moves=changedFootprints(parts(first),parts(next));
      let peerNext=node.peerBox;
      const move=moves.find(m=>m.shape===actor.shape&&key(m.from.bbox)===key(node.box));
      if(!parts(next).get(peer.shape)?.has(key(node.peerBox))){
        const peerMove=moves.find(m=>m.shape===peer.shape&&key(m.from.bbox)===key(node.peerBox));
        if(!peerMove)return diagnose('peer_footprint_left_or_changed');
        diagnose({outcome:'peer_moved',peer:[peerMove.dx,peerMove.dy],actor:move?[move.dx,move.dy]:null});
        if(!allowPeerTransit)return null;
        peerNext=peerMove.to.bbox;
      }
      const group=parts(next).get(actor.shape);if(!group)return diagnose('actor_appearance_untracked');
      const box=move?.to.bbox??(group.has(key(node.box))?node.box:null);
      if(!box)return diagnose('actor_motion_unresolved');
      const h=hash(next);
      if(!node.word.length&&!firstControls[input])firstControls[input]=h===node.frame?'unchanged':move?'actor_moved_peer_held':'actor_held_peer_held';
      return {word:[...node.word,input],box,peerBox:peerNext,frame:h};
    }
    function test(node){
      const first=restore(node.word);assert.equal(hash(first),node.frame);
      const next=rep.act(second.input);
      if(!live(next))return rep.win(next)?'score':'terminal';
      const move=changedFootprints(parts(first),parts(next)).find(m=>m.shape===peer.shape&&key(m.from.bbox)===key(peerBox));
      return move?(key(corner(move.to.bbox))===target?'predicted':'other_motion'):
        parts(next).get(peer.shape)?.has(key(peerBox))?'stayed':'unresolved';
    }
    const initial={word:[],box:actor.to.bbox,peerBox,frame:hash(n)},queue=[initial],visited=new Set([initial.frame]);
    const maxDepth=Math.min(6,run.cap-trial.prefix-trial.present.length-2);
    const alternatives=new Map(),reached=new Map(),outcomes=new Map();
    function outcome(node){if(!outcomes.has(node.frame))outcomes.set(node.frame,test(node));return outcomes.get(node.frame);}
    let expanded=0,poses=0,pairs=0,found;
    while(queue.length&&expanded<40&&!found){
      const node=queue.shift();if(node.word.length>=maxDepth)continue;expanded++;
      const children=[...inputs].map(input=>execute(node,input)).filter(Boolean);
      const restored=children.filter(s=>key(s.peerBox)===key(peerBox));
      for(const child of restored){
        const map=key(corner(child.box))===desired?reached:alternatives;
        map.set(child.word.length+'/'+child.frame,child);
      }
      for(const good of restored.filter(s=>key(corner(s.box))===desired)){
        poses++;
        for(const control of restored.filter(s=>key(corner(s.box))!==desired)){
          pairs++;
          const yes=outcome(good),no=outcome(control);
          if(yes==='predicted'&&no==='stayed'){
            found={present:good.word,absent:control.word,input:second.input,active:yes,control:no,comparison:'same_last_decision'};break;
          }
        }
        if(found)break;
      }
      for(const child of children)if(!visited.has(child.frame)){queue.push(child);visited.add(child.frame);}
    }
    const reachedNodes=[...reached.values()];
    const poseOutcomes={};
    for(const node of reachedNodes){const result=outcome(node);poseOutcomes[result]=(poseOutcomes[result]??0)+1;}
    const achieved=reachedNodes.filter(s=>outcome(s)==='predicted');
    if(!found)for(const good of achieved){
      const control=[...alternatives.values()].find(s=>s.word.length===good.word.length&&outcome(s)==='stayed');
      if(control){found={present:good.word,absent:control.word,input:second.input,active:'predicted',control:'stayed',comparison:'equal_duration'};break;}
    }
    results.push({code:run.code,level:run.start,prefix:trial.prefix,trajectory:run.trajectory,desired:desired.split(',').map(Number),
      inputs:[...inputs],firstControls,allowPeerTransit,maxDepth,expanded,poses,pairs,
      poseOutcomes,effectReached:achieved.length,found:found??null});
  }
}
await writeFile(output,JSON.stringify(results));console.log('cases',results.length,'repaired',results.filter(r=>r.found).length);
