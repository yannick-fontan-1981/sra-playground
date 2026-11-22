import type {NativeBox, NativeObservation, NativePoint, NativeRows} from '../logos-engine/v6-native-types.ts';
import type {CursorTrial} from './marked-cursor-selection.ts';

type Motion = {
  actor: string; command: string; box: NativeBox; delta: NativePoint;
  before: string; after: string; previousSurface: string; nextSurface: string;
};
export type MotorTest = {
  actor: string; command: string; from: NativePoint; delta: NativePoint; evidence: string[];
  basis: 'different_entry_surface' | 'previous_stride_leaves_peer_out_of_view';
  outcomes: readonly ['same_subject_repeats_displacement', 'same_subject_stays'];
};
export type MotorStudy = {
  motions: Motion[]; tested: Record<string, true>;
  controls: Record<string, {result: 'same_subject_repeats_displacement' | 'same_subject_stays'; observation: string}>;
};
export const motorStudy = (): MotorStudy => ({motions:[], tested:{}, controls:{}});

// Compare just the newly covered part of the subject's bounding box.
function leadingSurface(rows: NativeRows, [l,t,r,b]: NativeBox, [dx,dy]: NativePoint) {
  if (l+dx<0 || t+dy<0 || r+dx>=(rows[0]?.length??0) || b+dy>=rows.length) return;
  const colors = [];
  for (let y=t+dy; y<=b+dy; y++) for (let x=l+dx; x<=r+dx; x++)
    if (x<l || x>r || y<t || y>b) colors.push(rows[y]![x]);
  return colors.join(',');
}
const key = (m: Motion) => JSON.stringify([m.actor,m.command,m.delta,m.previousSurface,m.nextSurface]);
const sameBox = (a: NativeBox,b: NativeBox) => a.every((v,i) => v===b[i]);
const controlKey = (image: string, box: NativeBox, command: string) => JSON.stringify([image,box,command]);

export function useMeasuredControl(study: MotorStudy, observation: NativeObservation, trial: CursorTrial): CursorTrial {
  if (trial.stage!=='select' || !trial.contrast) return trial;
  const control=study.controls[controlKey(observation.frame_hash,trial.source.box,trial.contrast.motor)];
  if (!control) return trial;
  return {...trial, evidence:[...new Set([...trial.evidence,control.observation])], contrast:{
    ...trial.contrast, measuredWithoutSelection:control,
    outcomes:[control.result==='same_subject_stays'?'both_subjects_stay':'previous_subject_moves','selected_subject_moves'],
  }};
}

export function recordMotorContext(study: MotorStudy, before: NativeObservation, after: NativeObservation,
  command: string, rows: NativeRows, next: NativeRows, test?: MotorTest): string | undefined {
  const previous = study.motions;
  study.motions = [];
  if (before.level_epoch!==after.level_epoch || before.levels_completed!==after.levels_completed || before.state!==after.state)
    return test ? 'motor_test_ended_at_boundary' : undefined;
  if (!/^ACTION[1-4]$/.test(command)) return;
  const visible = new Map(after.entities.filter(e=>!e.identity_ambiguous).map(e=>[e.signature,e]));
  let result: string | undefined;
  if (test) {
    const old = previous.find(m=>m.after===before.observation_ref && m.command===command && m.actor===test.actor);
    if (old) {
      const body = visible.get(old.actor);
      result = !body ? 'subject_unresolved' : sameBox(body.bbox,old.box) ? 'same_subject_stays'
        : body.bbox.every((v,i)=>v===old.box[i]!+old.delta[i%2]!) ? 'same_subject_repeats_displacement' : 'different_displacement';
      if (result==='same_subject_stays' || result==='same_subject_repeats_displacement') {
        study.tested[key(old)] = true;
        study.controls[controlKey(before.frame_hash,old.box,command)] = {result,observation:after.observation_ref};
      } else study.tested[key(old)+before.frame_hash] = true;
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
  return result;
}

export function proposeMotorTest(study: MotorStudy, observation: NativeObservation, rows: NativeRows, cursor?: CursorTrial | null): MotorTest | undefined {
  if (cursor && (cursor.stage!=='select' || !cursor.contrast)) return;
  const motions=study.motions.filter(m=>m.after===observation.observation_ref && observation.available_action_refs.includes(m.command)
    && (!cursor || (m.command===cursor.contrast!.motor && sameBox(m.box,cursor.source.box))));
  if (motions.length!==1) return;
  const m=motions[0]!;
  if (study.tested[key(m)] || study.tested[key(m)+observation.frame_hash]) return;
  const peerOutside=cursor && leadingSurface(rows,cursor.target.box,m.delta)===undefined;
  if (m.previousSurface===m.nextSurface && !peerOutside) return;
  return {actor:m.actor,command:m.command,from:[m.box[0],m.box[1]],delta:m.delta,evidence:[m.before,m.after],
    basis:peerOutside?'previous_stride_leaves_peer_out_of_view':'different_entry_surface',
    outcomes:['same_subject_repeats_displacement','same_subject_stays']};
}
