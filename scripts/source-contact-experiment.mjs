import {exactJointPath,jointSuccessor} from '../src/logos-engine/v6-joint-transport.ts';
import {recoverContactLayouts,relativeSite,matchesJointState,footprints} from './source-contact-footprints.mjs';
import {createHash} from 'node:crypto';
import {hash} from './sic-study-source-replay.mjs';
import {rememberTransportAppearance,measureRetainedTransport} from '../src/sic/transport-contact-observation.ts';

// Choose a separating move and a continuation from the same observed position.
// No future public board, branch score or recorded suffix is available to the selector.
export function proposeContactExperiment(rows,forms,prior,moves,history,input,remaining) {
  const choices=[],seen=new Set();const deadline=performance.now()/1000+0.4;
  for(const actor of moves){
    const controls=history.get(actor.shape);if(!controls)continue;
    const pitch=Math.abs(actor.dx||actor.dy);
    for(const peer of moves){
      if(actor.shape===peer.shape||actor.dx!==peer.dx||actor.dy!==peer.dy||relativeSite(actor.from,peer.from,[actor.dx,actor.dy])!==1)continue;
      const evidence=[...controls].filter(([,v])=>!v.conflicted&&v.independent.has(peer.shape));
      const directions=Object.fromEntries([...controls].filter(([,v])=>!v.conflicted&&Math.abs(v.delta[0]||v.delta[1])===pitch)
        .map(([k,v])=>[k,v.delta.map(n=>n/pitch)]));
      directions[input]=[actor.dx/pitch,actor.dy/pitch];
      const surfaces=evidence.flatMap(([,v])=>[...v.surfaces.values()]);
      for(const scene of recoverContactLayouts(rows,actor,peer,forms,surfaces,{},prior)){
        for(const [motor,c] of evidence){
          if(!directions[motor]||relativeSite(actor.to,peer.to,c.delta)===1)continue;
          const result=jointSuccessor([scene.player,scene.boxes],directions[motor],scene.floor);
          if(!result||result[1])continue;
          const key=JSON.stringify([actor.shape,scene.player,[...scene.floor].sort(),[...scene.boxes].sort(),[...scene.targets].sort(),motor]);
          if(seen.has(key)||performance.now()/1000>=deadline)continue;
          seen.add(key);
          let path;
          try{path=exactJointPath({...scene,player:result[0][0]},directions,deadline).path;}catch{continue;}
          if(!path.length||1+path.length>remaining)continue;
          choices.push({scene,actor,peer,path:[[motor,false,result[0]],...path]});
        }
      }
    }
  }
  const choice=choices.sort((a,b)=>a.path.length-b.path.length)[0];
  if(choice)choice.appearance=rememberTransportAppearance(rows,choice.scene);
  return choice;
}

export function enactContactExperiment(choice,rep){
  const digest=createHash('sha256');let matched=0,appearanceMatches=0;
  const score=(played,won)=>({played,matched,won,digest:digest.digest('hex'),appearanceMatches});
  for(const [key,,state] of choice.path){
    const board=rep.act(key);
    digest.update(JSON.stringify([key,hash(board)]));
    if(rep.win(board))return score(matched+1,true);
    if(board.state!=='NOT_FINISHED'||!matchesJointState(footprints(board.frame),choice.scene,choice.actor,choice.peer,state))
      return score(matched+1,false);
    if(choice.appearance){
      try {
        const targets=[...choice.scene.targets].map(k=>k.split(',').map(Number));
        const scene=measureRetainedTransport(board.frame,choice.appearance,targets,choice.scene);
        if(scene.player.join(',')===state[0].join(',')&&scene.boxes.size===state[1].size&&[...state[1]].every(k=>scene.boxes.has(k)))appearanceMatches++;
      } catch { /* The native appearance model cannot yet recognize this intermediate state. */ }
    }
    matched++;
  }
  return score(matched,false);
}
