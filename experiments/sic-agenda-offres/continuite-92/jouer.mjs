import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { loadGame } from '../frontiere-22-23/game.mjs';
import { install, sha } from './sonde.mjs';

export const root=new URL('../../../',import.meta.url).href;
export const variants=['nominal','premier-arret','sans-question','but-ordinaire','autre-offre','ponctuelles','commande-retiree'];
export async function play(vendor,variant='nominal',engine=root,observeHooks=true) {
  if (!variants.includes(variant)) throw Error('Condition inconnue.');
  if (!observeHooks && variant!=='nominal') throw Error('Le témoin sans sonde exige le réglage nominal.');
  const gameCode='LS19',focus=14,events=observeHooks ? await install(engine,variant,focus) : [];
  const {createNativeV6Runtime}=await import(new URL('src/logos-engine/v6-native-runtime.ts',engine));
  const {V6AgentService}=await import(new URL('src/runtime/v6-agent-service.ts',engine));
  const {toV6PublicObservation}=await import(new URL('src/runtime/v6-agent-protocol.ts',engine));
  const dir=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',engine);
  const doc=async path=>JSON.parse(await readFile(new URL(path,dir),'utf8'));
  const declarations={common:await doc('laya_proto/common_frontier_policy.drm.json'),strategy:await doc('morphology_policy/strategy.drm')};
  const pack=JSON.parse(gunzipSync(await readFile(new URL('tests/fixtures/sic-view-edge-ls19-l1.json.gz',root))));
  const {sessionId,budgets}=pack;
  const game=await loadGame(gameCode,vendor,engine);
  const runtime=await createNativeV6Runtime(declarations,{now:()=>0});
  const service=new V6AgentService(()=>runtime);
  const history=[],prefix=[];
  const observe=(board,i)=>{
    const packet=toV6PublicObservation({...board,gameCode},i);
    if(gameCode==='LS19' && i<pack.observations.length) {
      const {palette,...archived}=packet;
      assert.equal(sha(archived),sha(pack.observations[i]),'observation archivée '+i);
      prefix.push(sha(archived));
    }
    // Qualification de l'admission : l'opérateur restreint une seule fois le domaine public.
    if(i===focus-1 && variant==='commande-retiree') return {...packet,availableActionIds:packet.availableActionIds.filter(id=>id!==3)};
    return packet;
  };
  let result=await service.handle({type:'init',sessionId,sequence:0,budgets,observation:observe(game.initial,0)});
  for(let i=0;i<16;i++) {
    while(result.kind==='boundary') result=await service.handle({type:'resume',sessionId,sequence:i});
    const {ticket,snapshot}=result;
    if(!ticket) return {prefix,history,stop:result.reason,tail:events.filter(e=>e.ref===history.at(-1)?.returned.ref)};
    const p=snapshot.proposal,f=p.sic_frontier_decision,v=p.sic_view_decision;
    const release=snapshot.trace.findLast(e=>e.kind==='sic_native_plan'),g=snapshot.trace.findLast(e=>e.kind==='before_guard');
    const before=events.filter(e=>e.ref===ticket.observationRef && e.kind!=='vue-acquise');
    if(gameCode==='LS19' && i<pack.commands.length) assert.deepEqual(result.command,pack.commands[i]);
    const row={i:i+1,ticket:{id:ticket.id,command:ticket.actionRef,data:ticket.data,index:ticket.actionIndex,ref:ticket.observationRef},
      before,family:release.family,strategy:release.strategy,kind:p.kind,purpose:f?.purpose ?? null,
      need:f?.need ?? v?.need ?? null,objective:f?.objective ?? v?.objective ?? null,
      agenda:f?.agenda?.map(e=>[e.id,e.result]) ?? null,guard:{accepted:g.admitted,reason:g.reason}};
    const board=await game.step(Number(ticket.actionRef.slice(6)),ticket.data);
    result=await service.handle({type:'advance',sessionId,sequence:i+1,ticketId:ticket.id,observation:observe(board,i+1),executionMs:0});
    const e=result.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
    const acquiredView=result.snapshot.trace.findLast(item=>item.kind==='sic_view_return' && item.evidence===e?.observation_ref);
    history.push({...row,returned:{ref:e?.observation_ref,matched:e?.matched,status:e?.status ?? null,reason:e?.reason ?? null,
      acquisition:e?.sic_frontier_outcome ?? null,view:acquiredView ? {objective:acquiredView.objective,status:acquiredView.status,
        newPixels:acquiredView.newPixels} : null,
      registration:events.findLast(r=>r.kind==='vue-acquise' && r.ref===e?.observation_ref)?.data ?? null,completed:board.levelsCompleted}});
  }
  return {prefix,history,stop:result.reason ?? null};
}
