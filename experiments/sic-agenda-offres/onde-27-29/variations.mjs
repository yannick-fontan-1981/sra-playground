import assert from 'node:assert/strict';

const command = proposal => proposal?.actions[0] ?? null;
function result(p) {
  return p && {kind:p.kind,cmd:command(p),probe:p.steps[0].probe,count:p.actions.length,
    expected:p.steps[0].expected_after,refs:p.route_refs};
}
export async function inspect(turn, source, engine) {
  if (![1,2,7].includes(turn)) return;
  const {PeriodicSums,measurePeriodicSums,periodicOffsets} = await import(new URL('src/logos-engine/v6-periodic-sums.ts',engine));
  const {supportParts,supportBox} = await import(new URL('src/logos-engine/v6-support-measurements.ts',engine));
  const {pre,proposal,propose,record}=source, {obs,rows,state,config}=pre;
  const scene=measurePeriodicSums(rows);
  const witnessMode={1:'initial_control_question',2:'joint_phase_target',7:'channel_question'}[turn];
  if (proposal.support_plan.mode!==witnessMode) return {differentMode:result(proposal)};
  const fresh = () => {
    const family = new PeriodicSums(config);
    family.restore(state);
    return family;
  };
  const offer = (family,remaining=pre.remaining,frame=rows) => propose.call(family,obs,frame,pre.inputs,remaining);
  if (turn===1) {
    const family=fresh(), returns=[];
    for(let i=0; i<config.initial_control_question.ordered_input_hypotheses.length;i++) {
      const p=await offer(family);
      if(!p) break;
      // Fixture locale : la même image revient, sans déplacement, après cette question.
      const after={...obs,observation_ref:obs.observation_ref+'-stable-'+i};
      const r=record.call(family,obs,after,command(p),rows,rows,p,0);
      returns.push({cmd:command(p),after:after.observation_ref,acquired:r.events.at(-1).mechanical_acquisition});
    }
    const ambiguous=rows.map(row=>[...row]), w=rows[0].length;
    const colors=rows.flat().reduce((counts,n)=>counts.set(n,(counts.get(n)??0)+1),new Map());
    const background=[...colors].sort((a,b)=>b[1]-a[1])[0][0];
    for(const part of supportParts(rows)) {
      const [l,,r]=supportBox(part);
      if(part.area>=2 && part.area<=6 && ((l===0&&r<=2)||(r===w-1&&l>=w-3))) {
        for(const [y,x] of part.pixels) ambiguous[y][x]=background;
      }
    }
    const unbound=measurePeriodicSums(ambiguous);
    assert.ok(unbound && unbound.selected===null);
    return {returns,afterExhaustion:result(await offer(family)),refs:family.refs,
      ambiguous:{periods:unbound.tracks.map(t=>t.period),focus:unbound.selected,offer:result(await offer(fresh(),pre.remaining,ambiguous))}};
  }
  if(turn===2) {
    const previous=fresh(); previous.refs=[]; previous.individual={};
    const noLaw=result(await offer(previous));
    const reversed=fresh(), action=command(proposal).action_ref;
    reversed.individual[action]=-reversed.individual[action];
    const reverseAtOne=result(await offer(reversed,1)), actualAtOne=result(await offer(fresh(),1));
    const filter=fresh(), targets=filter.targets.bind(filter), search=filter.search.bind(filter);
    const first=scene.tracks.map((t,i)=>i===scene.selected?(state.individual[action]+t.period)%t.period:0);
    let used;
    // Un fournisseur local de préimages ne rend ici qu'un sous-ensemble de solutions effectivement mesurées.
    filter.targets=(s,o)=>{const all=targets(s,o);const retained=new Set(all);retained.delete(JSON.stringify(first));return retained;};
    filter.search=(s,allowed,bound)=>{used=allowed.size;return search(s,allowed,bound);};
    const alternate=result(await offer(filter));
    return {noLaw,reverseAtOne,actualAtOne,alternate,retainedPreimages:used,first,
      totalPreimages:proposal.support_plan.preimage_proof.target_refs.length};
  }
  const first=scene.controls.find(c=>c.point[0]===command(proposal).data?.x);
  if(!first || proposal.support_plan.mode!=='channel_question') return {wide:result(proposal)};
  const remembered=fresh();
  // Antécédent public construit : ce contrôle a déjà été essayé dans cette scène, sans loi apprise.
  remembered.tried.add(proposal.support_plan.question_key);
  const pending=fresh(), partial=fresh(), complete=fresh();
  const [one]=scene.tracks;
  partial.collective[first.shape]={[one.color]:0};
  complete.collective[first.shape]=Object.fromEntries(scene.tracks.map(t=>[t.color,0]));
  const token=obs.observation_ref+'-fixture-immobile';
  for(const f of [partial,complete]) f.refs.push(token);
  const other=result(await offer(remembered));
  const noResponse=record.call(pending,obs,{...obs,observation_ref:token},command(proposal),rows,rows,proposal,0);
  const stableNext=result(await offer(pending));
  const all=scene.tracks.map(t=>({...t,period:4,profile:[1,2,1,2]}));
  const shifted=all.map(t=>({...t,profile:[2,1,2,1]}));
  return {other,partial:result(await offer(partial)),complete:result(await offer(complete)),token,
    afterNoChange:noResponse.events,stableNext,learned:pending.collective,
    largerBudget:result(await offer(fresh(),64)),otherPeriodBootstrap:result(await offer(new PeriodicSums(config))),
    ambiguousOffset:periodicOffsets({tracks:all},{tracks:shifted})};
}
