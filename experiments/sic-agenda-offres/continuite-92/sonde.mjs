import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
export const sha=data=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
export async function install(engine,variant,turn) {
  const events=[];
  let frontierRefInCall=null;
  const emit=(kind,ref,data)=>events.push({kind,ref,data:structuredClone(data),seal:sha(data)});
  const selected = obs=>obs.revision===turn;
  const url=new URL('src/logos-engine/v6-observed-frontier.ts',engine).href;
  const viewUrl=new URL('src/logos-engine/v6-view-frontier.ts',engine).href;
  const native=path=>import(new URL('src/logos-engine/'+path,engine));
  const mark='const agenda = usesAgenda ? selectFrontierStrategy(localQuestion, route, frontierRef(observation)) : null;';
  globalThis[Symbol.for('sic.continuity.pre')] = (ref,data)=>emit('questions',ref,data);
  globalThis[Symbol.for('sic.continuity.view')] = (ref,data)=>emit('vue-parcours',ref,data);
  globalThis[Symbol.for('sic.continuity.counts')] = data=>{
    if(frontierRefInCall) emit('frequences',frontierRefInCall,data);
  };
  registerHooks({load(request,context,next) {
    const result=next(request,context);
    if(request===viewUrl) {
      const source=result.source.toString(), block='return propose({ ...situation, obstruction', edge='for (const rule of rules) {';
      for(const marker of [block,edge]) assert.equal(source.split(marker).length,2);
      const tap="globalThis[Symbol.for('sic.continuity.view')](obs.observation_ref,";
      return {...result,source:source.replace(block,tap+"{phase:'obstruction',offres:Object.keys(offers)}); "+block)
        .replace(edge,tap+"{phase:'trajets',regles:rules.length}); "+edge)};
    }
    if(request!==url) return result;
    const source=result.source.toString();
    assert.equal(source.split(mark).length,2);
    const tap=`if (usesAgenda && !fixedExperiment) globalThis[Symbol.for('sic.continuity.pre')](frontierRef(observation),{
      evidence:continuity?.evidence ?? null, questions:questions.map(q=>({id:q.question_ref,command:q.action,priority:q.priority})),
      chosenByOrder:localQuestion?.question_ref ?? null,routeAttempted:!localQuestion && options.return_episode==null,
      route:route ? {steps:route.path.length,question:route.question.question_ref} : null
    });`;
    // Dans le seul processus témoin, le même arbitre reçoit la seconde offre déjà calculée.
    const replacement=variant==='autre-offre' ? mark.replace('selectFrontierStrategy(localQuestion,',
      'selectFrontierStrategy(continuity && observation.revision==='+turn+' && questions[1] ? questions[1] : localQuestion,') : mark;
    const rank='const ranked = questions.sort(';
    assert.equal(source.split(rank).length,2);
    const measured=`globalThis[Symbol.for('sic.continuity.counts')]({index,order,questions:questions.map(q=>({
      id:q.question_ref,priority:q.priority,usage:counts.get(q) ?? null,command:q.action.action_ref}))});`;
    return {...result,source:source.replace(mark,tap+'\n    '+replacement).replace(rank,measured+'\n    '+rank)};
  }});
  const {NativeCallerCoordinator}=await native('v6-native-caller.ts');
  const {ObservedFrontier}=await native('v6-observed-frontier.ts');
  const {ViewFrontier}=await native('v6-view-frontier.ts');
  const {pythonTruthy}=await native('v6-operations.ts');
  const view=ViewFrontier.prototype.propose,record=ViewFrontier.prototype.record,
    continuity=NativeCallerCoordinator.prototype.continuityOffer,frontier=ObservedFrontier.prototype.propose;
  let firstStop;
  ViewFrontier.prototype.record=async function(before,after,...args) {
    const result=await record.call(this,before,after,...args);
    emit('vue-acquise',after.observation_ref,{status:result.status,offset:result.registration?.offset ?? null,
      pixels:result.new_viewport_pixels,block:result.blockage_question ?? null,ref:result.after_ref ?? null});
    return result;
  };
  ViewFrontier.prototype.propose=async function(obs,rows,inputs,...args) {
    if(obs.revision===turn-1 && this.block?.fail_count===1) firstStop=structuredClone(this.block);
    if(selected(obs) && variant==='premier-arret') {assert.ok(firstStop);this.block=structuredClone(firstStop);}
    if(selected(obs) && variant==='sans-question') {this.block=null;this.reveals=[];}
    const b=this.block;
    const data={segment:this.segment,origin:this.origin,question:this.hasObservedViewQuestion(),refs:this.continuityEvidence(),
      block:b?{key:b.key,count:b.fail_count,refs:b.refs,command:b.command,poses:b.poses,position:b.position,signature:b.signature}:null,
      reveal:this.reveals.at(-1)?.source ?? null,followup:this.followup?.source ?? null,plain:inputs.filter(a=>!pythonTruthy(a.data)).map(a=>a.action_ref),
      points:inputs.filter(a=>pythonTruthy(a.data)).length};
    emit('vue-avant',obs.observation_ref,data);
    const p=await view.call(this,obs,rows,inputs,...args);
    emit('vue-offre',obs.observation_ref,{status:p?.status ?? null,kind:p?.kind ?? null,strategy:p?.sic_view_decision?.strategy ?? null,
      command:p?.actions?.[0] ?? null,blockUnrelated:p?.block_unrelated_probe ?? null});
    return p;
  };
  NativeCallerCoordinator.prototype.continuityOffer=async function(obs,inputs) {
    const list=selected(obs) && variant==='ponctuelles' ? inputs.filter(a=>pythonTruthy(a.data)) : inputs;
    emit('continuite-avant',obs.observation_ref,{question:this.view?.hasObservedViewQuestion() ?? false,
      evidence:this.view?.continuityEvidence() ?? [],plain:list.filter(a=>!pythonTruthy(a.data)).map(a=>a.action_ref),total:list.length});
    const p=await continuity.call(this,obs,list);
    emit('continuite-offre',obs.observation_ref,{status:p?.status ?? null,kind:p?.kind ?? null,actions:p?.actions ?? [],
      purpose:p?.sic_frontier_decision?.purpose ?? null,objective:p?.sic_frontier_decision?.objective?.id ?? null});
    return p;
  };
  ObservedFrontier.prototype.propose=async function(obs,inputs,options={}) {
    frontierRefInCall=obs.observation_ref;
    try {
      if(selected(obs) && variant==='but-ordinaire' && options.sic_view_continuity) {
        const {sic_view_continuity,...rest}=options;
        return await frontier.call(this,obs,inputs,rest);
      }
      return await frontier.call(this,obs,inputs,options);
    } finally {frontierRefInCall=null;}
  };
  return events;
}
