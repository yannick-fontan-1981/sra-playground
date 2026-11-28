import assert from 'node:assert/strict';
import {mock} from 'node:test';
import {observeFrontier} from './experiments/sic-agenda-offres/frontiere-22-23/observation.mjs';
import {play} from './experiments/sic-agenda-offres/regn-22/operateur.mjs';
import {digest} from './src/logos-engine/canonical.ts';

const base=new URL('./',import.meta.url),loader=observeFrontier(()=>{},base);
const {NativeCallerCoordinator}=await import('./src/logos-engine/v6-native-caller.ts');
const {V6AgentService}=await import('./src/runtime/v6-agent-service.ts');
loader.deregister();
const brief=(edge)=>({id:edge.edge_id,source:edge.source,target:edge.target,action:edge.action,witnesses:edge.evidence_refs});
const route=(r)=>({arêtes:r[0]?.map(brief)??[],question:r[1]?.question_ref??null,contexte:r[1]?.context_index??null,commande:r[1]?.action??null});
async function enumerate(graph,start,order){
  const queue=[{index:start,path:[],seen:[start]}],candidates=[];
  const edges=Object.values(graph.edges).filter(e=>e.evidence_refs.length && graph.nodes[e.source]?.protocol.level_epoch===graph.nodes[start].protocol.level_epoch &&
    graph.nodes[e.target]?.protocol.level_epoch===graph.nodes[start].protocol.level_epoch && !['WIN','GAME_OVER'].includes(graph.nodes[e.target].protocol.state) &&
    Object.keys(graph.nodes[e.source].attempts[e.action_key].outcomes).length===1);
  for(let i=0;i<queue.length;i++){
    assert.ok(queue.length<2048,'domaine hors borne opérateur');
    const {index,path,seen}=queue[i];
    if(path.length)for(const q of await graph.open(index,order)){
      const trial=await digest([start,path[0].action_key,q.question_ref]);
      if((graph.navigation_trials[trial]??0)<2)candidates.push([path,q]);
    }
    for(const e of edges)if(e.source===index&&!seen.includes(e.target))queue.push({index:e.target,path:[...path,e],seen:[...seen,e.target]});
  }
  return candidates;
}
export async function run(name,card,vendor){
  const original=NativeCallerCoordinator.prototype.frontierOffer,checks=[];
  const detailed=['arrêt-15','reprise-16'].includes(name),appels=[],handle=V6AgentService.prototype.handle;
  const tap=detailed&&mock.method(V6AgentService.prototype,'handle',async function(input){
    const r=await handle.call(this,input);
    if(input.sequence===15)appels.push({appel:input.type,sequence:input.sequence,ticketEntrant:input.ticketId??null,
      réponse:r.kind,ticketSortant:r.ticket?.id??null,commande:r.ticket?.actionRef??null});
    return r;
  });
  const hook=mock.method(NativeCallerCoordinator.prototype,'frontierOffer',async function(obs,inputs){
    if(obs.revision!==16)return original.call(this,obs,inputs);
    const g=this.frontier,access=g.access;
    g.access=async function(start,order){
      const native=await access.call(this,start,order),candidates=await enumerate(this,start,order);
      const snap={ref:obs.observation_ref,local:(await this.open(start,order)).map(q=>q.question_ref),normal:route(native),possibles:candidates.map(route)};
      let selected=native;
      if(name==='retrait')selected=[null,null];
      if(name==='remplacement'){
        const within=candidates.filter(([path])=>path.length<=card.budget-16);
        const other=within.find(r=>r[1].question_ref!==native[1]?.question_ref || r[0][0].edge_id!==native[0]?.[0].edge_id);
        selected=other??within[0]??[null,null];snap.fournisseur='énumération';
      }
      if(name==='autre-question'){
        const alternatives=candidates.filter(r=>r[1].question_ref!==native[1]?.question_ref);
        alternatives.sort((a,b)=>a[0].length-b[0].length);
        assert.ok(alternatives.length);selected=alternatives[0];snap.fournisseur='énumération';
      }
      if(name==='question'&&native[1]){
        const open=this.open;
        this.open=async(...args)=>(await open.apply(this,args)).filter(q=>q.question_ref!==native[1].question_ref);
        try{selected=await access.call(this,start,order);}finally{delete this.open;}
      }
      if(name==='arête'&&native[0]?.length){
        const bySource=this.outgoingForEpoch;
        this.outgoingForEpoch=function(epoch){
          const result=new Map(bySource.call(this,epoch));const e=native[0][0];
          result.set(e.source,result.get(e.source).filter(s=>s.edge_id!==e.edge_id));return result;
        };
        try{selected=await access.call(this,start,order);}finally{delete this.outgoingForEpoch;}
      }
      snap.rendu=route(selected);checks.push(snap);return selected;
    };
    try{return await original.call(this,obs,inputs);}finally{delete g.access;}
  });
  try{return {...await play(base.href,card,vendor),checks,...(detailed?{appels}:{})};}finally{hook.mock.restore();if(tap)tap.mock.restore();}
}
