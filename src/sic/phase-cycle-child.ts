import type { NativeBox, NativeCommand, NativeObservation } from '../logos-engine/v6-native-types.ts';
import { readSicNeed, type SicNeed } from './need-registry.ts';
import { sicNeedId } from './need-identity.ts';
import { maxObservedSupportPhases } from './phased-support-route.ts';

const cycleKind = 'measure_support_phase_cycle';
const parentKind = 'reach_target_on_observed_support_phases';
const contract = 'observe_controlled_terrain_return_to_initial_phase';

export type PhaseCycleMeasurement = {
  kind: 'measure';
  parent: SicNeed;
  control: NativeBox;
  opening: string;
  actionBudget: number;
};

export type PhaseCycleClosure = {
  need: SicNeed;
  control: NativeBox;
  opening: string;
  beforeRef: string;
  afterRef: string;
};

export type PhaseCycleDecision = PhaseCycleMeasurement | { kind: 'resume'; closures: PhaseCycleClosure[] };

export function phaseControlKey(control: NativeBox): string {
  return control.join(',');
}

export function phaseCycleNeed(parent: SicNeed, control: NativeBox, evidence: readonly string[]): SicNeed {
  const identity = { kind: cycleKind, scope: parent.scope, subjects: [phaseControlKey(control)],
    parentObjective: parent.id, satisfactionContract: contract };
  return { ...identity, id: sicNeedId(identity), status: 'assigned', evidence };
}

function field(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}

function readControl(value: unknown): NativeBox | undefined {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(x => Number.isSafeInteger(x) && x >= 0 && x < 64)) return;
  if (value[0] > value[2] || value[1] > value[3]) return;
  return [value[0], value[1], value[2], value[3]];
}

function revision(ref: unknown, scope: string): number {
  const prefix = scope + ':revision:';
  if (typeof ref !== 'string' || !ref.startsWith(prefix)) return -1;
  const match = /^(\d+):frame:[0-9a-f]+$/.exec(ref.slice(prefix.length));
  if (!match || !Number.isSafeInteger(Number(match[1]))) return -1;
  return Number(match[1]);
}

function readClosure(value: unknown, parent: SicNeed, observation: NativeObservation): PhaseCycleClosure | undefined {
  const need = readSicNeed(field(value, 'need'));
  const control = readControl(field(value, 'control'));
  const opening = field(value, 'opening');
  const beforeRef = field(value, 'beforeRef');
  const afterRef = field(value, 'afterRef');
  if (!need || !control || need.id !== phaseCycleNeed(parent, control, need.evidence).id || need.status !== 'assigned') return;
  if (typeof opening !== 'string' || typeof beforeRef !== 'string' || typeof afterRef !== 'string') return;
  const start = revision(opening, parent.scope), before = revision(beforeRef, parent.scope), after = revision(afterRef, parent.scope);
  if (start < 0 || start > before || after !== before + 1 || after > observation.revision) return;
  if (after === observation.revision && afterRef !== observation.observation_ref) return;
  return { need, control, opening, beforeRef, afterRef };
}

export function readPhaseCycleDecision(value: unknown, need: SicNeed | null, observation: NativeObservation,
  command: NativeCommand): PhaseCycleDecision | undefined {
  if (need?.status !== 'assigned' || revision(observation.observation_ref, need.scope) !== observation.revision) return;
  const kind = field(value, 'kind');
  if (kind === 'measure') {
    const parent = readSicNeed(field(value, 'parent')), control = readControl(field(value, 'control'));
    const opening = field(value, 'opening'), actionBudget = field(value, 'actionBudget');
    if (!control || parent?.status !== 'assigned' || parent.kind !== parentKind || parent.scope !== need.scope
      || need.id !== phaseCycleNeed(parent, control, need.evidence).id || typeof opening !== 'string'
      || typeof actionBudget !== 'number' || !Number.isSafeInteger(actionBudget) || actionBudget < 1 || actionBudget > maxObservedSupportPhases) return;
    const opened = revision(opening, need.scope);
    if (opened < 0 || opened > observation.revision || opened === observation.revision && opening !== observation.observation_ref
      || command.action_ref !== 'ACTION6' || command.data.x !== Math.floor((control[0] + control[2]) / 2)
      || command.data.y !== Math.floor((control[1] + control[3]) / 2)) return;
    return { kind, parent, control, opening, actionBudget };
  }
  if (kind !== 'resume' || need.kind !== parentKind) return;
  const entries = field(value, 'closures');
  if (!Array.isArray(entries) || !entries.length) return;
  const closures: PhaseCycleClosure[] = [];
  for (const entry of entries) {
    const closure = readClosure(entry, need, observation);
    if (!closure || closures.some(prior => prior.need.id === closure.need.id)) return;
    closures.push(closure);
  }
  return { kind, closures };
}

/** The family calls this only when the native return closes the selected cycle. */
export function bindPhaseCycleClosure(measurement: PhaseCycleMeasurement, need: SicNeed,
  before: NativeObservation, after: NativeObservation, command: NativeCommand): PhaseCycleClosure | undefined {
  const measure = readPhaseCycleDecision(measurement, need, before, command);
  if (measure?.kind !== 'measure' || before.level_epoch !== after.level_epoch || before.levels_completed !== after.levels_completed
    || before.state !== after.state || after.revision !== before.revision + 1
    || revision(after.observation_ref, need.scope) !== after.revision) return;
  return { need, control: measure.control, opening: measure.opening, beforeRef: before.observation_ref, afterRef: after.observation_ref };
}
