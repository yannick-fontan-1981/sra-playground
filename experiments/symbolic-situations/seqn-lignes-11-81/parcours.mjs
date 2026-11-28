import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {ProspectiveContactAdapter} from './src/logos-engine/v6-prospective-contact.ts';
import {factoredProposal,partition} from './src/logos-engine/v6-factored-return.ts';
import {ScoredRewriteAccess} from './src/logos-engine/v6-scored-rewrite.ts';

const src=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,src)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const replay=JSON.parse(gunzipSync(readFileSync(new URL('tests/fixtures/sic-seqn-public-returns.json.gz',import.meta.url))));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function modelSummary(m) {
  return m && {source:m.source,target:m.target,epoch:m.epoch,witnesses:m.witnesses,
    boundary:m.boundary_ref,command:m.boundary_action,key:hash(m)};
}
function changes(a,b) {return b.flatMap((row,y)=>row.flatMap((p,x)=>p===a[y][x]?[]:[[x,y]]));}
function pixelsOf(site) {return site.mask.map(([x,y])=>[site.origin[0]+x,site.origin[1]+y]);}
function show(name,i,real,prev,seed) {
  let selected;
  if(name==='canal8'&&i===8) {
    assert.equal(prev.factor.axis,'row');
    const dropBand=Boolean(seed[0]&1);
    selected=new Set(real.frame.flatMap((row,y)=>
      prev.factor.indices.includes(y)===dropBand ? row.map((_,x)=>String([x,y])) : []));
  }
  if(name==='masque12'&&i===12) {
    const sites=prev.rewrite.sites, site=sites[seed[1]%sites.length];
    selected=new Set(pixelsOf(site).map(String));
  }
  if(!selected)return real;
  const edit=frame=>frame.map((row,y)=>row.map((p,x)=>selected.has(String([x,y]))?prev.frame[y][x]:p));
  return {...real,frame:edit(real.frame),frames:real.frames.map(edit)};
}

async function play(game,name,cap,budget,seed){
  const P=ProspectiveContactAdapter.prototype,S=ScoredRewriteAccess.prototype;
  const hooks=[],rows=[],events=[],interventions=[];
  function wrap(proto,key,fn){
    const original=proto[key];hooks.push(mock.method(proto,key,function(...args){return fn.call(this,original,args);}));
  }
  if(name==='sansTémoin11')wrap(P,'proposeFactored',function(original,args){
    const result=original.apply(this,args);
    if(!result || args[0].revision!==8)return result;
    const ref=result.factor_plan.channel_witnesses[0];
    const episode=this.memory.episode.filter(([before])=>before.ref!==ref);
    assert.equal(episode.length,this.memory.episode.length-1);
    interventions.push({tour:8,témoin:ref});
    return factoredProposal(episode,args[0],args[1],Math.min(16,args[2]));
  });
  if(name==='sansModèle81')wrap(P,'proposeScoredRewrite',async function(original,args){
    if(args[0].revision!==12||!this.memory.pre_score.model)return original.apply(this,args);
    const adapter=new ProspectiveContactAdapter();
    const state=this.memory.pre_score.state();
    interventions.push({tour:12,modèle:modelSummary(state.model)});
    adapter.memory.pre_score.restore({...state,model:null});
    return original.apply(adapter,args);
  });
  wrap(S,'record',async function(original,args){
    const [before,command,after,,,p]=args, saved=this.series, series=saved[p.proposal_id];
    if(name==='unÉchantillon'&&before.revision===11 && after.levels_completed>before.levels_completed && series?.length>1){
      interventions.push({tour:11,témoins:series.map(s=>s.before),gardé:series[0].before});
      this.series={...saved,[p.proposal_id]:series.slice(0,1)};
    }
    try{
      const result=await original.apply(this,args);
      for(const e of result)if(['factored_rewrite_sample','factored_rewrite_scored','scored_rewrite_test'].includes(e.kind))
        events.push({kind:e.kind,avant:before.observation_ref,après:after.observation_ref,action:command.action_ref,
          modèle:modelSummary(e.model),effet:e.outcome,supports:e.predicted_sites,count:e.rewrites?.length});
      return result;
    }finally{if(this.series!==saved && name==='unÉchantillon' && before.revision===11)this.series=saved;}
  });
  try{
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}), service=new V6AgentService(()=>runtime);
    const sessionId='sra-v6-'+replay.session;
    let board=game.dispatch({type:'load',code:'SEQN',level:1}),previous;
    for(let i=0;i<=cap;i++){
      const real=toV6PublicObservation(board,i), obs=show(name,i,real,previous,seed);
      if(name==='catalogue'||name==='prolongé'){
        const {palette,...canonical}=real;
        assert.deepEqual(canonical,replay.nominal.observations[i]);
      }
      const start=events.length;
      let reply=await service.handle({sessionId,sequence:i,observation:obs,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:budget}})});
      const outcome=reply.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply, p=snapshot.proposal, factor=p?.factor_plan, rewrite=p?.rewrite_plan;
      const guard=snapshot.trace.findLast(e=>e.kind==='before_guard');
      let ret;
      if(previous){
        ret={id:previous.id,ref:outcome.ref??outcome.observation_ref,famille:outcome.family,accord:outcome.matched,scelle:outcome.seal_prefix,
          raison:outcome.reason,jeu:hash([real.frame,real.frames]),servi:hash([obs.frame,obs.frames]),événements:events.slice(start)};
        if(previous.factor){
          const {axis,indices,expected}=previous.factor;
          ret.canaux={attendu:expected,physique:partition(real.frame,axis,indices),servi:partition(obs.frame,axis,indices),
            pixelsPhysiques:changes(previous.frame,real.frame).reduce((c,[,y])=>(c[indices.includes(y)?1:0]++,c),[0,0]),
            pixelsServis:changes(previous.frame,obs.frame).reduce((c,[,y])=>(c[indices.includes(y)?1:0]++,c),[0,0])};
        }
        if(previous.rewrite){
          const {target,sites}=previous.rewrite, pixels=sites.flatMap(pixelsOf);
          ret.rewrite={géométrie:pixels.length,physique:pixels.filter(([x,y])=>real.frame[y][x]===target).length,
            servi:pixels.filter(([x,y])=>obs.frame[y][x]===target).length};
        }
      }
      const index=ticket?.actionIndex;
      const partitionPlan=factor&&{axis:factor.axis,indices:factor.indices,retour:factor.return_ref,témoins:factor.channel_witnesses,
        plan:factor.steps.map(s=>s.action_ref),before:factor.steps[index].before,expected:factor.steps[index].expected_after};
      const rewritePlan=rewrite&&{source:rewrite.source,target:rewrite.target,sites:rewrite.sites};
      rows.push({tour:i+1,niveau:obs.level,score:obs.levelsCompleted,image:hash(obs.frame),
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,famille:snapshot.lastDecision,kind:p.kind,cmd:ticket.actionRef,
          admis:guard?.admitted,raison:guard?.reason,index,preuves:p.question?.hypothesis_refs,
          factor:partitionPlan,sites:rewrite?.sites.map(s=>({origin:s.origin,pixels:s.mask.length})),source:rewrite?.source,target:rewrite?.target},ret});
      if(!ticket||i===cap)break;
      if(name==='catalogue'||name==='prolongé')assert.equal(ticket.actionRef,'ACTION'+replay.nominal.commands[i].id);
      previous={id:ticket.id,frame:obs.frame,factor:partitionPlan,rewrite:rewritePlan};
      board=game.dispatch({type:'action',actionId:Number(ticket.actionRef.slice(6)),...(ticket.data?.x===undefined?{}:{data:ticket.data})});
    }
    return {rows,interventions,budget};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root,seed){
  const groups={nominal:[['catalogue',16,16],['prolongé',19,19]],
    contrôles:[['sansTémoin11',9,19],['sansModèle81',13,19],['unÉchantillon',12,19]],
    réserve:[['canal8',8,19],['masque12',12,19]]};
  assert.ok(groups[group]);
  const game=await sourceBackend(root),clock=mock.method(Date,'now',()=>1700000000000),cases={};
  try{for(const [name,cap,budget] of groups[group])cases[name]=await play(game,name,cap,budget,seed);}
  finally{clock.mock.restore();}
  return cases;
}
