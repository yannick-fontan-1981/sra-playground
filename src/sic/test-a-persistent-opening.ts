import type { Reading, Scene } from './paired-scene.ts';
import { pointCommand } from './paired-scene.ts';
import { forecast, geometry, imagine, key, law, operandSetupCost, peer, type Learning } from './paired-displacements.ts';
import { walkingRegion } from './unknown-region-entry.ts';

type Need = { gate: number; controls: number[]; opening: string; goal: string };
export type OpeningEvidence = { bySubject: Record<number, string>; need?: Need };
type Node = { pose: Reading; depth: number; previous?: Node; op?: string };

export function observeRequiredOpening(s: Scene, m: Learning, before: Reading, after: Reading, ref: string) {
  for (const door of s.doors) {
    if (!after.opened.includes(door.site) || !door.controls.length) continue;
    const occupied = (v: Reading) => door.controls.every(p => v.subjects.includes(p) || v.pieces.includes(p));
    if (!before.opened.includes(door.site) && !occupied(before) && occupied(after) &&
        ![...before.subjects,...after.subjects,...before.pieces,...after.pieces].includes(door.site) &&
        door.controls.some(p => after.subjects.includes(p))) {
      (m.openings ??= {bySubject:{}}).bySubject[door.site] = ref;
    }
    const memory = m.openings, opening = memory?.bySubject[door.site];
    if (!memory || !opening || memory.need || m.checked.includes('material-opening/' + door.site)) continue;
    const holder = after.subjects.find(p => door.controls.includes(p));
    const goal = after.subjects.find(p => s.goals.includes(p) && p !== holder);
    if (holder === undefined || goal === undefined || !after.pieces.length || !occupied(after)) continue;
    const space = geometry(s);
    if (!walkingRegion(s,after,goal,space).has(holder)) continue;
    const closed = { ...space, walk:(v:Parameters<typeof space.walk>[0],p:number) => p !== door.site && space.walk(v,p) };
    if (walkingRegion(s,after,goal,closed).has(holder)) continue;
    memory.need = { gate:door.site, controls:door.controls, opening, goal:ref };
  }
}

export function persistentOpeningTest(s: Scene, m: Learning, v: Reading, ref: string, depth: number, budget: number) {
  const need = m.openings?.need;
  if (!need || v.pieces.length < need.controls.length) return;
  const space = geometry(s), ops = [...Object.keys(m.motors),'select'];
  const ranks = new Map<number, Node[]>(), seen = new Map([[key(v),0]]);
  const root:Node = {pose:v,depth:0};
  ranks.set(0,[root]);
  for (let i=0; ranks.size && i<budget; i++) {
    const rank=Math.min(...ranks.keys()), bucket=ranks.get(rank)!, n=bucket.pop()!;
    if (!bucket.length) ranks.delete(rank);
    if (n.depth !== seen.get(key(n.pose))) continue;
    if (need.controls.every(p => n.pose.pieces.includes(p)) && !n.pose.subjects.includes(need.gate) && !n.pose.pieces.includes(need.gate)) {
      const access=walkingRegion(s,n.pose,s.goals[0]!,space);
      if (n.pose.subjects.every(p=>access.has(p))) {
        if (!n.previous) return;
        let first=n;
        while (first.previous?.previous) first=first.previous;
        const f=forecast(s,m,v,first.pose,first.op!,n.depth===1 ? 'test_whether_material_keeps_the_route_open_for_both_subjects' : 'prepare_material_to_relieve_a_subject_holding_a_route_open',
          ['the_gate_stays_open_with_the_controls_held_by_material_or_it_closes','both_subjects_can_reach_the_objective_region'],ref);
        f.evidence=[...new Set([...f.evidence,need.opening,need.goal])];
        f.openingTest={gate:need.gate,controls:need.controls,remaining:n.depth};
        return f;
      }
    }
    if (n.depth>=depth) continue;
    for (const op of ops) {
      const pose=n.pose, command=op==='select'?pointCommand(s.grid,pose.subjects[peer(pose.active)]):op;
      const ticket=key(pose)+'|'+command;
      if (m.denied[ticket] || m.checked.includes('opening/'+ticket)) continue;
      const next=imagine(s,space,pose,op,m,law(m,pose.active));
      if (!next || next.pieces.length!==v.pieces.length) continue;
      const id=key(next), cost=n.depth+1;
      if ((seen.get(id)??Infinity)<=cost) continue;
      seen.set(id,cost);
      const distance=Math.max(...need.controls.map(control=>Math.min(...next.pieces.map(part=>
        operandSetupCost(s, part, control, next.subjects)))));
      const priority=cost+distance;
      const layer=ranks.get(priority)??[];
      if (!layer.length) ranks.set(priority,layer);
      layer.push({pose:next,depth:cost,previous:n,op});
    }
  }
}
