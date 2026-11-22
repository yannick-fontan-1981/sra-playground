import type {NativeObservation} from '../logos-engine/v6-native-types.ts';
import {placePeers} from './actor-relative-parts.ts';
import type {MechanismPlan} from './reconfigure-local-mechanism.ts';
import type {LayoutStep} from './reachable-preview-configurations.ts';

type Evidence = {after: string; refs: number[]};
type Deferred = {observation: string; command: string; actor: string; part: string; expectedActor: number[];
  expectedPart: number[]; observedFrame: string; refutations: number[]; limit: number};
export type MechanismRefutations = {limit: number; returns: Record<string,Evidence>; deferred?: Deferred};

// A new objective or route cannot change the first step's prediction. Different
// role assignments, public controls or expected displacements can change it.
function predictionKey(o: NativeObservation, plan: MechanismPlan, step: LayoutStep) {
  const points = (ps: readonly number[][]) => ps.map(p => p.join(',')).sort();
  const fixedAt = (actor: [number,number]) =>
    points(placePeers(plan.fixed, plan.start, actor, plan.followingPeer?.offset));
  return JSON.stringify([o.level_epoch, o.frame_hash, [...o.available_action_refs].sort(), step.op, plan.p, plan.c,
    points(plan.actorPeers ?? []), plan.pitch, fixedAt(step.p), fixedAt(step.to), step.p, step.c, step.to, step.placed]);
}

export function observeStepReturn(memory: MechanismRefutations, before: NativeObservation, after: NativeObservation,
  plan: MechanismPlan, step: LayoutStep, matched: boolean) {
  if (step.stage !== 'move') return;
  const key = predictionKey(before,plan,step);
  if (matched) {
    delete memory.returns[key];
    return;
  }
  let evidence = memory.returns[key];
  if (!evidence || evidence.after !== after.frame_hash) {
    evidence = memory.returns[key] = {after:after.frame_hash, refs:[]};
  }
  if (evidence.refs.length < memory.limit && !evidence.refs.includes(after.revision)) evidence.refs.push(after.revision);
}

export function deferRefutedStep(memory: MechanismRefutations, o: NativeObservation, plan: MechanismPlan,
  step: LayoutStep, unstable: boolean) {
  if (unstable || step.stage !== 'move') return false;
  const evidence = memory.returns[predictionKey(o,plan,step)];
  if (!evidence || evidence.refs.length < memory.limit) return false;
  memory.deferred = {observation:o.observation_ref, command:step.op, actor:plan.p, part:plan.c,
    expectedActor:step.to, expectedPart:step.placed, observedFrame:evidence.after, refutations:[...evidence.refs], limit:memory.limit};
  return true;
}
