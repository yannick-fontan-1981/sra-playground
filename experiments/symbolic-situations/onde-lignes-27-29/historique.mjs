import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';
import {control,offsets,preimages} from './enumerer.mjs';

const [vendor,out]=process.argv.slice(2);
const sha='d0e7527ca8033bd805a6d7a8bb021eff62e87021',transport='592e8e1903fb32f30c3bf7fdfbedcbfee0d8c9e8';
const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim(),m=mount(sha,repo);
try{
  for(const [rev,files] of [[sha,['public/python']],[transport,['experiments/sic-agenda-offres/evaluateur-jeu.mjs',
    'experiments/sic-agenda-offres/frontiere-22-23/game.mjs']]]){
    const tar=join(m.program,rev+'.tar');execFileSync('git',['-C',repo,'archive','--output='+tar,rev,...files]);
    execFileSync('tar',['-xf',tar,'-C',m.program]);
  }
  const base=pathToFileURL(m.program+'/'),src='experiments/sic-agenda-offres/';
  const {loadGame}=await import(new URL(src+'frontiere-22-23/game.mjs',base));
  const {evaluateurJeu}=await import(new URL(src+'evaluateur-jeu.mjs',base));
  const {measurePeriodicSums}=await import(new URL('src/logos-engine/v6-periodic-sums.ts',base));
  const api=await evaluateurJeu(base),service=api.createService(),game=await loadGame('ONDE',vendor,base);
  const budgets={targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:16};
  const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10',turns=[];
  let b=game.initial,ticket=null,prevScene=null;
  for(let sequence=0;sequence<=16;sequence++){
    const obs=api.packet(b,sequence),scene=measurePeriodicSums(obs.frame);
    let r=await service.handle({sessionId,sequence,observation:obs,...(ticket?{type:'advance',ticketId:ticket.id,executionMs:0}:
      {type:'init',budgets,recovery:{...api.defaultRecoveryPack,openingCuriosity:'active'}})});
    const ret=r.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
    while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence});
    const s=r.snapshot,p=s.proposal,k=s.trace.findLast(e=>e.kind==='sic_native_plan'),step=p?.steps?.[s.planIndex??0];
    const sameScene=scene && prevScene && scene.layout===prevScene.layout;
    turns.push({i:sequence+1,niveau:obs.level,ref:r.ticket?.observationRef,type:p?.kind,famille:r.ticket&&k?.family,
      mode:p?.support_plan?.mode,cmd:r.ticket?.actionRef,point:r.ticket?.data,prédit:step?step.expected_after!=null:null,état:r.kind,
      retour:ret&&{matched:ret.matched,raison:ret.reason,ref:ret.observation_ref,ticket:ticket?.id},ticket:r.ticket?.id,
      profils:scene?.tracks.map(t=>({couleur:t.color,p:t.profile})),focus:scene?.selected,
      décalages:sameScene?scene.tracks.map((t,i)=>offsets(prevScene.tracks[i].profile,t.profile)):null,
      préimages:scene?preimages(scene.tracks.map(t=>t.profile),scene.detectors).length:null});
    if(!r.ticket)break;
    assert.ok(sequence<16);b=await game.step(Number(r.ticket.actionRef.slice(6)),r.ticket.data);ticket=r.ticket;prevScene=scene;
  }
  for(const [i,mode,niveau] of [[0,'initial_control_question',1],[1,'joint_phase_target',1],[6,'channel_question',3]]){
    assert.equal(turns[i].niveau,niveau);assert.equal(turns[i].mode,mode);assert.ok(turns[i].préimages>0);
    assert.equal(turns[i+1].retour.ticket,turns[i].ticket);
  }
  assert.equal(turns[0].cmd,turns[1].cmd);assert.equal(turns[0].prédit,false);assert.equal(turns[1].prédit,true);
  writeFileSync(out,JSON.stringify({sha,plafond:16,turns,construit:control()})+'\n',{flag:'wx'});
  console.log(JSON.stringify(turns.filter(t=>[1,2,7].includes(t.i)).map(t=>[t.i,t.niveau,t.mode,t.cmd,t.point,t.prédit])));
}finally{m.close();}
