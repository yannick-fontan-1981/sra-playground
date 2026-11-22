import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Edge, Effect, Experiment, Memory } from './preparation-experiments.ts';
import { uniformMark, type MarkedMotionTrial } from './marked-motion-experiment.ts';
import { projectEdit, type Edit } from './relative-edits.ts';

export const transportControlStrategy = 'retest_a_conditional_control_after_transport';
export const transportControlOutcomes = {
  control: ['mark_remains_at_the_landing', 'original_appearance_restored_at_the_landing'],
  motion: ['part_remains_at_the_release_site', 'part_still_follows_the_carrier'],
} as const;

export type TransportControlTrial = {
  stage: 'control' | 'motion';
  motion: MarkedMotionTrial;
  site: number;
  command: string;
  carrierFrom: string;
  dx: number;
  dy: number;
  distinguishingPixels: number;
};
export type TransportControlResult = {trial: TransportControlTrial; result: string; ref: number; site: number};

function translated(sites: number[], edit: Edit, dx: number, dy: number) {
  const result: number[] = [];
  for (const site of sites) {
    const x = site % edit.width + dx, y = Math.floor(site / edit.width) + dy;
    if (x < 0 || x >= edit.width || y < 0 || y >= edit.height) return null;
    result.push(y * edit.width + x);
  }
  return result;
}

function releaseSites(edit: Edit, motion: MarkedMotionTrial, rows: NativeRows, dx: number, dy: number) {
  const mark = uniformMark(edit);
  if (!mark || rows.length !== edit.height || rows[0]?.length !== edit.width) return null;
  const read = (board: NativeRows, site: number) => board[Math.floor(site / edit.width)]![site % edit.width];
  const origin = translated(mark.sites, edit, motion.dx, motion.dy);
  if (!origin || !origin.every(i => read(rows, i) === mark.old)) return null;
  const target = translated(origin, edit, dx, dy);
  if (!target) return null;
  const sourceSet = new Set(origin), targetSet = new Set(target);
  const entering = target.filter(i => !sourceSet.has(i) && read(rows, i) !== mark.old);
  const leaving = origin.filter(i => !targetSet.has(i));
  return entering.length && leaving.length ? {origin, target, entering, leaving, read, old: mark.old} : null;
}

function offered(trial: TransportControlTrial, editEdge: Edge, refs: number[]): Experiment {
  const control = trial.stage === 'control';
  return {phase: control ? 'testTransportControl' : 'testReleasedMotion', origin: trial.site,
    a: editEdge.cmd, b: trial.command, refs: [...new Set(refs)], transportControl: trial,
    rule: control ? 'compare_persistence_with_restoration_after_transport' : 'compare_independent_with_coupled_motion_after_restoration'};
}

export function proposeTransportControl(m: Memory, site: number, o: NativeObservation, rows: NativeRows): Experiment | null {
  const inquiry = m.markedMotion;
  if (!inquiry || m.pending || m.pendingSilentInput || m.cursorSelection?.pending ||
      (m.pairInquiry?.learning.planSolves && m.pairInquiry.learning.plan?.length)) return null;
  const editEdge = m.edges[inquiry.edit], edit = editEdge?.manipulation?.edit;
  if (!editEdge?.stable || !edit) return null;
  const history = m.transportControls ?? [];
  const untried = (command: string) => o.available_action_refs.includes(command) &&
    !m.edges.some(e => e.s === site && e.cmd === command);
  const evidence = inquiry.results.filter(r => r.result === 'mark_followed_the_measured_motion');
  for (const result of evidence) {
    const motion = result.trial;
    const carrier = o.entities.filter(e => !e.identity_ambiguous && e.signature === motion.actor);
    if (carrier.length !== 1) continue;
    const carrierFrom = carrier[0]!.position.join(',');
    const motor = m.edges[motion.motor];
    if (!motor?.stable) continue;
    const transport = m.edges.find(e => e.stable && e.s === editEdge.t && e.cmd === motor.cmd);
    if (!transport) continue;
    const refs = [editEdge.ref, motor.ref, result.ref];
    const restored = history.find(r => r.result === 'original_appearance_restored_at_the_landing' &&
      r.trial.site === transport.t && r.trial.motion.edit === motion.edit && r.trial.motion.motor === motion.motor && r.site === site);
    const resolved = history.some(r => r.trial.stage === 'motion' && r.trial.site === site &&
      r.trial.motion.edit === motion.edit && r.trial.motion.motor === motion.motor &&
      (r.result === 'part_remains_at_the_release_site' || r.result === 'part_still_follows_the_carrier'));
    if (restored && !resolved) {
      let best: Experiment | null = null;
      for (const edge of m.edges) {
        if (!edge.stable || !untried(edge.cmd)) continue;
        const move = edge.effect.moves.find(v => v.actor === motion.actor && (v.dx || v.dy));
        if (!move) continue;
        const sites = releaseSites(edit, motion, rows, move.dx, move.dy);
        if (!sites) continue;
        const distinguishingPixels = sites.entering.length + sites.leaving.length;
        if (best && best.transportControl!.distinguishingPixels >= distinguishingPixels) continue;
        best = offered({stage:'motion', motion, site, command:edge.cmd, carrierFrom, dx:move.dx, dy:move.dy,
          distinguishingPixels}, editEdge, [...refs, restored.ref, edge.ref]);
      }
      if (best) return best;
    }
    if (transport.t !== site || !untried(editEdge.cmd)) continue;
    const reversal = projectEdit(rows, edit, {reverse:true, strict:true, offset:[motion.dx,motion.dy]});
    if (!reversal) continue;
    return offered({stage:'control', motion, site, command:editEdge.cmd, carrierFrom, dx:0, dy:0,
      distinguishingPixels:edit.count}, editEdge, refs);
  }
  return null;
}

export function assessTransportControl(m: Memory, trial: TransportControlTrial, before: NativeRows, after: NativeRows, effect: Effect) {
  const {motion} = trial, edit = m.edges[motion.edit]?.manipulation?.edit;
  if (!edit || after.length !== edit.height || after.some(r => r.length !== edit.width)) return 'transport_comparison_unresolved';
  if (trial.stage === 'control') {
    const reversed = projectEdit(before, edit, {reverse:true, strict:true, offset:[motion.dx,motion.dy]});
    if (!reversed) return 'transport_comparison_unresolved';
    const matches = (board: NativeRows) => after.every((row,y) => row.every((value,x) => value === board[y]![x]));
    if (matches(reversed.board)) return 'original_appearance_restored_at_the_landing';
    if (matches(before)) return 'mark_remains_at_the_landing';
  } else {
    const sites = releaseSites(edit, motion, before, trial.dx, trial.dy);
    if (!sites || !effect.moves.some(v => v.actor === motion.actor && v.from === trial.carrierFrom &&
        v.dx === trial.dx && v.dy === trial.dy)) return 'transport_comparison_unresolved';
    const old = (i: number) => sites.read(after,i) === sites.old;
    if (sites.origin.every(old) && sites.entering.every(i => !old(i))) return 'part_remains_at_the_release_site';
    if (sites.target.every(old) && sites.leaving.every(i => !old(i))) return 'part_still_follows_the_carrier';
  }
  return 'transport_comparison_unresolved';
}
