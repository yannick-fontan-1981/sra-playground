import type { NativeCommand, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Experiment } from './preparation-experiments.ts';
import type { FrontierContact, ContactMemory } from './contact-frontier.ts';
import { visualLayout } from './witnessed-preview-transfer.ts';
import { cellMatches } from './calibrate-spatial-controls.ts';
import { mechanismStance } from './reconfigure-local-mechanism.ts';
import { maximumCommittedActions } from './plan-step.ts';

type Pose = Record<string, number[]>;
type SpatialStep = {
  command: NativeCommand;
  kind: 'approach' | 'push';
  to: number | readonly number[];
  before?: Pose;
  after?: Pose;
};
function cells(role: string, t: FrontierContact, o: NativeObservation, rows: NativeRows) {
  return (visualLayout(o, rows)[role] ?? []).map(({ at }) =>
    Math.round((at[0] - t.origin[0]) / t.pitch[0]) + t.width * Math.round((at[1] - t.origin[1]) / t.pitch[1])
  ).sort((a, b) => a - b);
}
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const cardinal = (op: string) => /^ACTION[1-4]$/.test(op);
const command = (op: string): NativeCommand => ({ action_ref: op, data: {} });

// Bind the directly observable participants. A projected marker can move as the
// subject approaches a launch stance without changing the physical arrangement.
export function spatialStance(x: Experiment, step: SpatialStep, i: number, o: NativeObservation, rows: NativeRows, arrived: boolean) {
  if (x.mechanism) return mechanismStance(x.mechanism, i, o, rows, arrived);
  const t = x.contactProject, expected = arrived ? step.after : step.before;
  return !!t && !!expected && Object.entries(expected).every(([role, sites]) => same(cells(role, t, o, rows), sites));
}

export function preparedSpatialSeries(x: Experiment, o: NativeObservation, rows: NativeRows, remaining: number, memory?: ContactMemory) {
  const limit = Math.min(maximumCommittedActions, remaining);
  const path: SpatialStep[] = [];
  let launch = false;
  if (x.mechanism) {
    const m = x.mechanism, p = m.plan;
    if (!p.pitch || p.basis === 'test_displacement') return;
    // A retained plan advances its index only after the predicted return matched.
    const measured = p.steps.slice(0, m.index);
    for (const s of p.steps.slice(m.index)) {
      if (s.stage === 'read') { launch = true; break; }
      if (path.length >= limit || !cardinal(s.op) || s.stage === 'use' ||
        (p.controlEvidence?.some(c => c.op === s.op && c.basis === 'untested') &&
          !measured.some(previous => previous.op === s.op && previous.stage === s.stage))) break;
      const push = s.stage === 'write';
      if (push && (!cellMatches(s.to, s.c, p.pitch) || cellMatches(s.c, s.placed, p.pitch))) break;
      path.push({ kind: push ? 'push' : 'approach', command: command(s.op), to: s.to });
    }
  } else {
    const t = x.contactProject;
    if (!t || t.acquired) return;
    const preparingExperiment = t.project.purpose === 'test_support' || t.project.purpose === 'test_passenger';
    if (!preparingExperiment && t.project.purpose !== 'reach_goal') return;
    const roles = new Set([t.actor]);
    for (const s of t.project.steps) if (s.role) roles.add(s.role);
    if (t.relay && memory?.relayControl) {
      for (const role of [t.relay.pivotRole, t.relay.cargoRole, memory.relayControl.peer]) roles.add(role);
    }
    let pose: Pose = Object.fromEntries([...roles].map(role => [role, cells(role, t, o, rows)]));
    for (const s of t.project.steps) {
      if (s.op === t.transform) { launch = true; break; }
      if (path.length >= limit || !cardinal(s.op) || s.boundary || s.passenger || s.from === s.to ||
        !same(pose[t.actor]!, [s.from])) break;
      const next = { ...pose, [t.actor]: [s.to] };
      if (s.role) {
        // During a placement experiment, the first contact and any movement of
        // its control require acquisition (including possible loss of mobility).
        if (preparingExperiment && (!memory?.displaced.includes(s.role) || s.role === t.controlRole)) break;
        const parts = pose[s.role]!, placed = s.placed;
        if (placed === undefined || !parts.includes(s.to) || parts.includes(placed) ||
          placed - s.to !== s.to - s.from || (!t.relay && !memory?.displaced.includes(s.role) && !t.priorContact)) break;
        next[s.role] = parts.map(at => at === s.to ? placed : at).sort((a,b) => a-b);
      }
      path.push({ kind: s.role ? 'push' : 'approach', command: command(s.op), to: s.to, before: pose, after: next });
      pose = next;
    }
  }
  if (path.length >= 2 && (launch || path.some(s => s.kind === 'push')) && spatialStance(x, path[0]!, 0, o, rows, false)) return path;
}
export type { SpatialStep };