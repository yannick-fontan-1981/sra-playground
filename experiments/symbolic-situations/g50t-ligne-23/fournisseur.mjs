import {createInterface} from 'node:readline';
import {ObservedFrontier,frontierIndex} from './src/logos-engine/v6-observed-frontier.ts';

const g=new ObservedFrontier(1,4);
const cmd=id=>({action_ref:'ACTION'+id});
const domain=o=>o.available_action_refs.map(action_ref=>({action_ref}));
let proposal,occurrence;
async function transition(before,action,after){
  await g.observe(before,domain(before));
  const r=await g.recordTransition(before,action,after,{after_action_candidates:domain(after)});
  return {ref:r.transition_ref,edge:r.edge_ref};
}
async function answer(m){
  if(m.type==='past')return transition(m.before,cmd(m.id),m.after);
  if(m.type==='return'){
    const outcome=g.checkOutcome(proposal,m.after,0);
    const evidence=await transition(occurrence,proposal.actions[0],m.after);
    const oldIndex=await frontierIndex(occurrence);
    return {outcome,evidence,stillOpen:(await g.open(oldIndex)).map(q=>q.question_ref)};
  }
  occurrence=m.observation;
  proposal=await g.propose(occurrence,m.domain.map(cmd),{sic_agenda:true,sic_frontier:{inputOrder:'least_tried'}});
  const index=await frontierIndex(occurrence),node=g.nodes[index];
  const available=(await g.open(index)).map(q=>({ref:q.question_ref,action:q.action.action_ref,priority:q.priority}));
  const trials=Object.entries(node.actions).map(([k,a])=>({action:a.action_ref,refs:node.attempts[k]?.evidence_refs??[]}));
  const p=proposal,f=p.sic_frontier_decision;
  if(!p.actions.length)return {index,available,trials,status:p.status,need:p.sic_frontier_refusal?.need,actions:[]};
  const guard=await g.guard(p,occurrence),foreign=await g.guard(p,{...occurrence,observation_ref:occurrence.observation_ref+'-autre'});
  return {index,available,trials,status:p.status,kind:p.kind,strategy:f?.strategy,need:f?.need,prerequisite:f?.prerequisite,
    selected:p.question.question_ref,context:p.question.context_index,actions:p.actions.map(a=>a.action_ref),
    guard:guard.admitted,wrongOccurrence:foreign.admitted,route:p.route_refs.map(k=>({edge:k,witnesses:g.edges[k].evidence_refs})),
    projection:p.steps[0].expected_after};
}
for await(const line of createInterface({input:process.stdin})){
  console.log(JSON.stringify(await answer(JSON.parse(line))));
}
