import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Effect, Experiment, Memory } from './preparation-experiments.ts';
import { projectEdit, type Edit } from './relative-edits.ts';

export const markedMotionStrategy = 'test_what_moves_after_a_conditional_change';
export type MarkedMotionTrial = {
  edit: number; motor: number; actor: string; from: string; dx: number; dy: number;
  distinguishingPixels: number; count: number;
};
export type MarkedMotionMemory = { edit: number; results: { trial: MarkedMotionTrial; result: string; ref: number }[] };

export function uniformMark(edit: Edit) {
  if (!edit.count) return null;
  const [, , old, ink] = edit.runs[0]!;
  const sites: number[] = [];
  for (const [start,length,from,to] of edit.runs) {
    if (from!==old || to!==ink) return null;
    for (let i=0;i<length;i++) sites.push(start+i);
  }
  return { sites, old, ink };
}

function discriminators(edit: Edit, marked: NativeRows, control: NativeRows, dx: number, dy: number) {
  const pattern=uniformMark(edit);
  if (!pattern) return null;
  const {sites,ink,old}=pattern, {width,height}=edit;
  const read=(rows:NativeRows,i:number)=>rows[Math.floor(i/width)]![i%width];
  if (!sites.every(i=>read(control,i)===old && read(marked,i)===ink)) return null;
  const shifted:number[]=[];
  for (const i of sites) {
    const x=i%width+dx, y=Math.floor(i/width)+dy;
    if (x<0 || x>=width || y<0 || y>=height) return null;
    shifted.push(y*width+x);
  }
  const origin=new Set(sites), target=new Set(shifted);
  const entering=shifted.filter(i=>!origin.has(i) && read(marked,i)!==ink && read(control,i)!==ink);
  const leaving=sites.filter(i=>!target.has(i));
  return entering.length && leaving.length ? {sites,shifted,entering,leaving,ink,read} : null;
}

export function proposeMarkedMotion(m:Memory, site:number, o:NativeObservation, rows:NativeRows):Experiment|null {
  const inquiry=m.markedMotion;
  if (!inquiry || m.pending || m.pendingSilentInput || m.cursorSelection?.pending ||
      (m.pairInquiry?.learning.planSolves && m.pairInquiry.learning.plan?.length)) return null;
  const activated=m.edges[inquiry.edit], edit=activated?.manipulation?.edit;
  if (!activated?.stable || !edit || activated.t!==site || !uniformMark(edit)) return null;
  const bare=projectEdit(rows,edit,{reverse:true,strict:true})?.board;
  if (!bare) return null;
  let best:MarkedMotionTrial|undefined;
  for (const [motor,edge] of m.edges.entries()) {
    const [move]=edge.effect.moves;
    if (edge.s!==activated.s || !edge.stable || !edge.manipulation || edge.effect.moves.length!==1 || !move ||
        !o.available_action_refs.includes(edge.cmd.split(':')[0]!) || m.edges.some(e=>e.s===site && e.cmd===edge.cmd)) continue;
    if (!o.entities.some(e=>!e.identity_ambiguous && e.signature===move.actor && e.position.join(',')===move.from)) continue;
    if (inquiry.results.some(r=>r.result==='mark_followed_the_measured_motion' && r.trial.actor===move.actor &&
        r.trial.dx*move.dy===r.trial.dy*move.dx)) continue;
    const control=projectEdit(bare,edge.manipulation.edit,{strict:true})?.board;
    const points=control && discriminators(edit,rows,control,move.dx,move.dy);
    if (!points) continue;
    const distinguishingPixels=points.entering.length+points.leaving.length;
    if (best && (best.distinguishingPixels>distinguishingPixels ||
        best.distinguishingPixels===distinguishingPixels && m.edges[best.motor]!.ref>=edge.ref)) continue;
    best={edit:inquiry.edit,motor,actor:move.actor,from:move.from,dx:move.dx,dy:move.dy,distinguishingPixels,count:edit.count};
  }
  if (!best) return null;
  const motor=m.edges[best.motor]!;
  return {phase:'testMarkedMotion',origin:site,a:activated.cmd,b:motor.cmd,markedMotion:best,
    rule:'compare_a_fixed_mark_with_a_mark_that_follows_a_measured_movement',refs:[activated.ref,motor.ref]};
}

export function assessMarkedMotion(m:Memory, trial:MarkedMotionTrial, before:NativeRows, after:NativeRows, effect:Effect) {
  const motor=m.edges[trial.motor]!, edit=m.edges[trial.edit]?.manipulation?.edit;
  const bare=edit && projectEdit(before,edit,{reverse:true,strict:true})?.board;
  const control=bare && motor.manipulation && projectEdit(bare,motor.manipulation.edit,{strict:true})?.board;
  const p=edit && control && discriminators(edit,before,control,trial.dx,trial.dy);
  if (!p || !effect.moves.some(v=>v.actor===trial.actor && v.from===trial.from && v.dx===trial.dx && v.dy===trial.dy))
    return 'comparison_movement_unconfirmed';
  const marked=(i:number)=>p.read(after,i)===p.ink;
  if (p.shifted.every(marked) && p.leaving.every(i=>!marked(i))) return 'mark_followed_the_measured_motion';
  if (p.sites.every(marked) && p.entering.every(i=>!marked(i))) return 'mark_stayed_at_its_previous_position';
  return 'neither_mark_prediction_matched';
}
