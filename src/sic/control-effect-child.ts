import type { NativeCommand, NativeObservation, NativePoint } from '../logos-engine/v6-native-types.ts';
import { equal } from '../logos-engine/canonical.ts';
import { controlEffectNeed } from './control-effect-next.ts';
import { sicNeedId } from './need-identity.ts';
import { readSicNeed, type SicNeed } from './need-registry.ts';
import { singleStepDisplacement } from './observed-translation.ts';

interface MovingSubject {
  readonly id: string;
  readonly start: NativePoint;
  readonly stepSize: number;
}

export interface ControlEffectChild {
  readonly status: 'awaiting_native_return';
  readonly need: SicNeed;
  readonly subject: MovingSubject;
  readonly opening: string;
  readonly levelEpoch: number;
  readonly command: NativeCommand;
  readonly actionBudget: 1;
}

interface NativeTrialTransition {
  readonly before: NativeObservation;
  readonly after: NativeObservation;
  readonly command: NativeCommand;
}

interface BoundControlReturn {
  readonly childId: string;
  readonly parentId: string;
  readonly subjectId: string;
  readonly command: NativeCommand;
  readonly levelEpoch: number;
  readonly beforeRef: string;
  readonly afterRef: string;
}

export type ControlEffectReturn = BoundControlReturn & (
  | { readonly status: 'observed_translation'; readonly destination: NativePoint; readonly displacement: NativePoint }
  | { readonly status: 'unresolved'; readonly reason: 'subject_not_reidentified' | 'no_single_axis_step' }
);

const scope = (ref: string) => ref.split(':revision:', 1)[0];
const trialContract = (action: string) => 'measure_one_axis_step_for_' + action;

export function currentControlSubjectPosition(observation: NativeObservation, signature: string): NativePoint | null {
  const subjects = observation.entities.filter(entity => entity.signature === signature);
  return subjects.length === 1 ? [subjects[0]!.bbox[0], subjects[0]!.bbox[1]] : null;
}

export function openControlEffectChild(parent: SicNeed, subject: MovingSubject, observation: NativeObservation,
  command: NativeCommand, remaining: number): ControlEffectChild | null {
  const opening = observation.observation_ref;
  if (!Number.isSafeInteger(remaining) || remaining < 1 || parent.status !== 'assigned'
    || parent.scope !== scope(opening) || !parent.evidence.includes(opening)
    || !subject.id || !equal(currentControlSubjectPosition(observation, subject.id), subject.start)
    || !Number.isSafeInteger(subject.stepSize) || subject.stepSize < 1
    || !observation.available_action_refs.includes(command.action_ref)) return null;
  const identity = { kind: controlEffectNeed, scope: parent.scope, parentObjective: parent.id, subjects: [subject.id],
    satisfactionContract: trialContract(command.action_ref) };
  return { status: 'awaiting_native_return', need: { ...identity, id: sicNeedId(identity), status: 'assigned', evidence: parent.evidence },
    subject, opening, levelEpoch: observation.level_epoch, command, actionBudget: 1 };
}

export function controlEffectChildIsCurrent(child: ControlEffectChild, parent: SicNeed, observation: NativeObservation,
  command: NativeCommand): boolean {
  const need = readSicNeed(child.need);
  return child.status === 'awaiting_native_return' && child.actionBudget === 1 && child.opening === observation.observation_ref
    && parent.status === 'assigned' && parent.evidence.includes(child.opening) && parent.scope === scope(child.opening)
    && child.levelEpoch === observation.level_epoch && need?.kind === controlEffectNeed && need.scope === parent.scope
    && need.satisfactionContract === trialContract(command.action_ref)
    && need.evidence.includes(child.opening) && need.parentObjective === parent.id && equal(need.subjects, [child.subject.id])
    && equal(currentControlSubjectPosition(observation, child.subject.id), child.subject.start)
    && equal(child.command, command);
}

function isDirectReturn(child: ControlEffectChild, { before, after, command }: NativeTrialTransition): boolean {
  return child.status === 'awaiting_native_return' && child.actionBudget === 1
    && child.opening === before.observation_ref && child.levelEpoch === before.level_epoch && equal(child.command, command)
    && before.level_epoch === after.level_epoch && before.levels_completed === after.levels_completed
    && before.state === after.state && after.revision === before.revision + 1
    && scope(before.observation_ref) === scope(after.observation_ref);
}

/** The family binds the subject signature and step. The positions come from the native observations. */
export function measureControlEffectChild(child: ControlEffectChild, transition: NativeTrialTransition): ControlEffectReturn | null {
  if (!isDirectReturn(child, transition)
    || !equal(currentControlSubjectPosition(transition.before, child.subject.id), child.subject.start)) return null;
  const proof = { childId: child.need.id, parentId: child.need.parentObjective, subjectId: child.subject.id,
    command: transition.command, levelEpoch: child.levelEpoch,
    beforeRef: transition.before.observation_ref, afterRef: transition.after.observation_ref };
  const destination = currentControlSubjectPosition(transition.after, child.subject.id);
  if (!destination) return { ...proof, status: 'unresolved', reason: 'subject_not_reidentified' };
  const displacement = singleStepDisplacement(child.subject.start, destination, child.subject.stepSize);
  return displacement ? { ...proof, status: 'observed_translation', destination, displacement }
    : { ...proof, status: 'unresolved', reason: 'no_single_axis_step' };
}

/** Require the released child, the direct native return and coherent measurement content. */
export function controlEffectReturnMatches(child: ControlEffectChild, result: ControlEffectReturn, transition: NativeTrialTransition): boolean {
  const measured = measureControlEffectChild(child, transition);
  return measured !== null && equal(result, measured);
}
