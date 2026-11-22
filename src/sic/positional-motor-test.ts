import type {NativeBox, NativeObservation, NativePoint, NativeRows} from '../logos-engine/v6-native-types.ts';
import type {CursorTrial, MeasuredControl} from './marked-cursor-selection.ts';

type Motion = {
  actor: string; command: string; box: NativeBox; delta: NativePoint;
  before: string; after: string; previousSurface: string; nextSurface: string;
};
export type MotorTest = {
  actor: string; command: string; from: NativePoint; delta: NativePoint; evidence: string[];
} & ({
  basis: 'different_entry_surface' | 'previous_stride_leaves_peer_out_of_view';
  outcomes: readonly ['same_subject_repeats_displacement', 'same_subject_stays'];
} | {
  basis: 'two_observed_displacements';
  rivalDelta: NativePoint;
  outcomes: readonly ['latest_displacement_repeated', 'earlier_displacement_returned'];
});
type StrideComparison = { test: MotorTest & {basis:'two_observed_displacements'}; box: NativeBox; observation: string };
export type MotorStudy = {
  motions: Motion[]; tested: Record<string, true>;
  comparison?: StrideComparison;
  controls: Record<string, MeasuredControl>;
};
export const motorStudy = (): MotorStudy => ({motions:[], tested:{}, controls:{}});

function insideAfter(rows: NativeRows, [l,t,r,b]: NativeBox, [dx,dy]: NativePoint) {
  return l+dx>=0 && t+dy>=0 && r+dx<(rows[0]?.length??0) && b+dy<rows.length;
}
// Compare just the newly covered part of the subject's bounding box.
function leadingSurface(rows: NativeRows, [l,t,r,b]: NativeBox, [dx,dy]: NativePoint) {
  if (!insideAfter(rows,[l,t,r,b],[dx,dy])) return;
  const colors = [];
  for (let y=t+dy; y<=b+dy; y++) for (let x=l+dx; x<=r+dx; x++)
    if (x<l || x>r || y<t || y>b) colors.push(rows[y]![x]);
  return colors.join(',');
}
const key = (m: Motion) => JSON.stringify([m.actor,m.command,m.delta,m.previousSurface,m.nextSurface]);
const sameBox = (a: NativeBox,b: NativeBox) => a.every((v,i) => v===b[i]);
const equalDelta = (a: NativePoint,b: NativePoint) => a[0]===b[0] && a[1]===b[1];
const controlKey = (image: string, box: NativeBox, command: string) => JSON.stringify([image,box,command]);
function translation(from: NativeBox, to?: NativeBox): NativePoint | undefined {
  if (!to || from[2]-from[0]!==to[2]-to[0] || from[3]-from[1]!==to[3]-to[1]) return;
  return [to[0]-from[0],to[1]-from[1]];
}

export function useMeasuredControl(study: MotorStudy, observation: NativeObservation, trial: CursorTrial): CursorTrial {
  if (trial.stage!=='select' || !trial.contrast) return trial;
  const control=study.controls[controlKey(observation.frame_hash,trial.source.box,trial.contrast.motor)];
  if (!control) return trial;
  if (control.actor && !observation.entities.some(e=>!e.identity_ambiguous && e.signature===control.actor &&
      e.palette_value===trial.source.ink && sameBox(e.bbox,trial.source.box))) return trial;
  return {...trial, evidence:[...new Set([...trial.evidence,control.observation])], contrast:{
    ...trial.contrast, measuredWithoutSelection:control,
    outcomes:[control.result==='same_subject_stays'?'both_subjects_stay':'previous_subject_moves','selected_subject_moves'],
  }};
}

export function recordMotorContext(study: MotorStudy, before: NativeObservation, after: NativeObservation,
  command: string, rows: NativeRows, next: NativeRows, test?: MotorTest, compareStrides=false): {result:string; motorDelta?:NativePoint} | undefined {
  const previous = study.motions;
  const proposed = study.comparison;
  delete study.comparison;
  study.motions = [];
  if (before.level_epoch!==after.level_epoch || before.levels_completed!==after.levels_completed || before.state!==after.state)
    return test ? {result:'motor_test_ended_at_boundary'} : undefined;
  if (!/^ACTION[1-4]$/.test(command)) return;
  const visible = new Map(after.entities.filter(e=>!e.identity_ambiguous).map(e=>[e.signature,e]));
  let result: string | undefined;
  let motorDelta: NativePoint | undefined;
  if (test?.basis==='two_observed_displacements') {
    if (!proposed || proposed.observation!==before.observation_ref || command!==test.command) return;
    const site=controlKey(before.frame_hash,proposed.box,command);
    study.tested[site] = true;
    const delta=translation(proposed.box,visible.get(test.actor)?.bbox);
    if (!delta) return {result:'subject_unresolved'};
    motorDelta=delta;
    const latest=equalDelta(delta,test.delta);
    study.controls[site] = {
      result:latest?'same_subject_repeats_displacement':equalDelta(delta,[0,0])?'same_subject_stays':'different_displacement',
      observation:after.observation_ref,delta,actor:test.actor,
    };
    result=latest?'latest_displacement_repeated':equalDelta(delta,test.rivalDelta)?'earlier_displacement_returned':'neither_observed_displacement';
  } else if (test) {
    const old = previous.find(m=>m.after===before.observation_ref && m.command===command && m.actor===test.actor);
    if (old) {
      const body = visible.get(old.actor);
      result = !body ? 'subject_unresolved' : sameBox(body.bbox,old.box) ? 'same_subject_stays'
        : body.bbox.every((v,i)=>v===old.box[i]!+old.delta[i%2]!) ? 'same_subject_repeats_displacement' : 'different_displacement';
      if (result==='same_subject_stays' || result==='same_subject_repeats_displacement') {
        study.tested[key(old)] = true;
        study.controls[controlKey(before.frame_hash,old.box,command)] = {result,observation:after.observation_ref};
      } else {
        study.tested[key(old)+before.frame_hash] = true;
        const delta=compareStrides ? translation(old.box,body?.bbox) : undefined;
        if (body && delta && result==='different_displacement') {
          motorDelta=delta;
          study.controls[controlKey(before.frame_hash,old.box,command)] = {result,observation:after.observation_ref,delta,actor:old.actor};
          study.comparison={observation:after.observation_ref,box:body.bbox,test:{
            basis:'two_observed_displacements',actor:old.actor,command,from:[body.bbox[0],body.bbox[1]],
            delta,rivalDelta:old.delta,evidence:[...test.evidence,after.observation_ref],
            outcomes:['latest_displacement_repeated','earlier_displacement_returned'],
          }};
        }
      }
    }
  }
  for (const from of before.entities) {
    if (from.identity_ambiguous || from.area<2) continue;
    const to = visible.get(from.signature);
    if (!to) continue;
    const dx=to.bbox[0]-from.bbox[0], dy=to.bbox[1]-from.bbox[1];
    if ((dx===0)===(dy===0) || Math.abs(dx)>2*(from.bbox[2]-from.bbox[0]+1) || Math.abs(dy)>2*(from.bbox[3]-from.bbox[1]+1)) continue;
    const delta: NativePoint=[dx,dy];
    const previousSurface=leadingSurface(rows,from.bbox,delta), nextSurface=leadingSurface(next,to.bbox,delta);
    if (previousSurface===undefined || nextSurface===undefined) continue;
    study.motions.push({actor:from.signature,command,delta,box:to.bbox,before:before.observation_ref,after:after.observation_ref,previousSurface,nextSurface});
  }
  return result ? {result,...(motorDelta ? {motorDelta} : {})} : undefined;
}

export function proposeMotorTest(study: MotorStudy, observation: NativeObservation, rows: NativeRows, cursor?: CursorTrial | null): MotorTest | undefined {
  if (cursor && (cursor.stage!=='select' || !cursor.contrast)) return;
  const pair=study.comparison;
  if (!cursor && pair && pair.observation===observation.observation_ref) {
    const test=pair.test, site=controlKey(observation.frame_hash,pair.box,test.command);
    if (observation.available_action_refs.includes(test.command) && !study.tested[site] && !study.controls[site]
        && insideAfter(rows,pair.box,test.delta) && insideAfter(rows,pair.box,test.rivalDelta))
      return test;
  }
  const motions=study.motions.filter(m=>m.after===observation.observation_ref && observation.available_action_refs.includes(m.command)
    && (!cursor || (m.command===cursor.contrast!.motor && sameBox(m.box,cursor.source.box))));
  if (motions.length!==1) return;
  const m=motions[0]!;
  if (study.controls[controlKey(observation.frame_hash,m.box,m.command)]?.delta) return;
  if (study.tested[key(m)] || study.tested[key(m)+observation.frame_hash]) return;
  const peerOutside=cursor && leadingSurface(rows,cursor.target.box,m.delta)===undefined;
  if (m.previousSurface===m.nextSurface && !peerOutside) return;
  return {actor:m.actor,command:m.command,from:[m.box[0],m.box[1]],delta:m.delta,evidence:[m.before,m.after],
    basis:peerOutside?'previous_stride_leaves_peer_out_of_view':'different_entry_surface',
    outcomes:['same_subject_repeats_displacement','same_subject_stays']};
}
