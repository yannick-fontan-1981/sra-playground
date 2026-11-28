import {createHash} from 'node:crypto';
import {evaluateurJeu} from './evaluateur-jeu.mjs';
import {loadGame} from './frontiere-22-23/game.mjs';

export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function rejouerService({engine,vendor,gameCode,sessionId,describe,entries,limit=16,maxActions=16,reprise=false,
  onTurn=()=>{},initial=board=>board,present=({actual})=>actual}){
  const {createService,defaultRecoveryPack,packet}=await evaluateurJeu(engine),service=createService();
  const game=await loadGame(gameCode,vendor,engine);
  let board=initial(game.initial);
  let result=await service.handle({type:'init',sessionId,sequence:0,recovery:defaultRecoveryPack,
    budgets:{targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600),maxActions},observation:packet(board,0)});
  const steps=[];
  const issued=()=>{
    if(!result.ticket)return null;
    const {snapshot,ticket}=result,p=snapshot.proposal,ref=ticket.observationRef;
    const release=snapshot.trace.findLast(e=>e.kind==='sic_native_plan'),before=snapshot.trace.findLast(e=>e.kind==='before_guard');
    return structuredClone({ref,ticket:ticket.id,level:board.level,index:ticket.actionIndex,family:release?.family??snapshot.lastDecision,
      kind:p.kind,slot:p.field_subquestion??null,bundle:p.bundle_template?.operation_key??null,
      command:[ticket.actionRef,ticket.data??{}],guard:{admitted:before?.admitted,reason:before?.reason},refs:p.route_refs,
      evidence:p.bundle_template?.evidence,scope:entries.guards.get(ref)??null,cut:entries.cuts.get(ref)??null,
      ...describe(p,ticket.actionIndex)});
  };
  const resume=async sequence=>{
    while(result.kind==='boundary')result=await service.handle({type:'resume',sessionId,sequence});
  };
  for(let i=1;i<=limit;i++){
    await resume(i-1);
    const pre=issued();
    if(!pre)break;
    const actual=await game.step(Number(pre.command[0].slice(6)),pre.command[1]);
    const shown=present({board,actual,pre,i});
    onTurn(i+1);
    result=await service.handle({type:'advance',sessionId,sequence:i,ticketId:pre.ticket,observation:packet(shown,i),executionMs:0});
    const e=result.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
    const after={ref:e.observation_ref,matched:e.matched,seal:e.seal_prefix,reason:e.reason,levels:shown.levelsCompleted,
      packet:digest([actual.frame,actual.frames,actual.availableActionIds,actual.level,actual.levelsCompleted,actual.state]),
      physical:digest(actual.frame),presented:digest(shown.frame),record:entries.records.get(e.observation_ref)??null};
    steps.push({i,pre,after});
    board=shown;
  }
  if(reprise)await resume(steps.length);
  return {steps,stop:result.reason??null,next:issued()};
}
