import type { NativeObservation } from '../logos-engine/v6-native-types.ts';
import { controlledStrokes, rememberMotion } from './controlled-parts.ts';
import type { PreviewLearning } from './witnessed-preview-transfer.ts';
import type { P05AcquiredEffect, P05LearnerOptions, P05Point, P05PublicReturn } from './p05-acquisition.ts';

/** This is a named subsystem baseline, not a replay of the full SIC worker. */
export const frozenP05Provenance = {
  revision: '20433007224accc36e3d7976696d9ee7a783a227',
  module: 'src/sic/controlled-parts.ts',
  gitBlob: '35bf4e14f1d632d6e4e732846670ecfe1f940160',
  functions: ['rememberMotion', 'controlledStrokes'],
  scope: 'direct-return command-to-dominant-vector subsystem',
  nativeWorker: false,
} as const;

export interface FrozenP05Vector {
  readonly command: string;
  readonly receiver: string;
  readonly delta: P05Point;
  readonly status: 'unqualified_vector';
  /** The observer adds trace links; the frozen selector itself returns refs: []. */
  readonly observedReturnIds: readonly string[];
  readonly selectorEvidence: readonly number[];
}

export interface FrozenP05ObservedEffect {
  readonly command: string;
  readonly receiver: string;
  readonly delta: P05Point;
  readonly supportingReturnIds: readonly string[];
}

const nativeObservation = (ref: string, revision: number): NativeObservation => ({
  revision, level_epoch: 0, frame_hash: ref, observation_ref: ref,
  coordinate_basis: 'screen', entities: [], available_action_refs: [], state: 'RUNNING',
  levels_completed: 0, unknowns: [], provenance: 'public-P05-receipt-adapter',
});

export class FrozenP05MotionAdapter {
  private readonly learning: PreviewLearning = {
    bindings: {}, lastActor: {}, seen: {}, rejected: {}, last: null, motion: {},
  };
  private readonly receipts: P05PublicReturn[] = [];
  private readonly seen = new Set<string>();
  private readonly available = new Set<string>();
  private readonly priorClaims: readonly P05AcquiredEffect[];
  private importedPrior = false;

  constructor(options: P05LearnerOptions) {
    this.priorClaims = structuredClone(options.priorClaims ?? []);
  }

  addReturn(receipt: P05PublicReturn): void {
    if (this.seen.has(receipt.id)) return;
    this.seen.add(receipt.id);
    this.receipts.push(structuredClone(receipt));
    if (receipt.kind !== 'command' || !receipt.before) return;
    this.available.add(receipt.command);
    if (!this.importedPrior) {
      // Imported vectors remain prior memory. They do not become current proof.
      for (const prior of this.priorClaims) {
        const role = prior.receiver === 'selected' ? receipt.before.selected : prior.receiver;
        if (!receipt.before.subjects.some(subject => subject.id === role)) continue;
        const ref = prior.supportingReturnIds[0] ?? 'old:unreferenced';
        rememberMotion(this.learning, role, [0, 0], [...prior.delta], prior.command,
          nativeObservation(ref, 0), nativeObservation(ref + ':after', 1));
      }
      this.importedPrior = true;
    }
    if (!receipt.after || receipt.after.epoch !== receipt.before.epoch) return;
    for (const before of receipt.before.subjects) {
      const after = receipt.after.subjects.find(subject => subject.id === before.id);
      if (!after) continue;
      rememberMotion(this.learning, before.id, [...before.position], [...after.position], receipt.command,
        nativeObservation(receipt.before.ref, this.receipts.length - 1),
        nativeObservation(receipt.after.ref, this.receipts.length));
    }
  }

  vectors(): readonly FrozenP05Vector[] {
    return Object.entries(this.learning.partMotion ?? {}).flatMap(([role, motion]) =>
      controlledStrokes(motion, this.available).map(motor => ({
        command: motor.op, receiver: role, delta: [...motor.d] as P05Point,
        status: 'unqualified_vector' as const, selectorEvidence: [...motor.refs],
        observedReturnIds: this.receipts.filter(receipt => {
          if (receipt.kind !== 'command' || receipt.command !== motor.op || !receipt.before || !receipt.after) return false;
          const before = receipt.before.subjects.find(subject => subject.id === role)?.position;
          const after = receipt.after.subjects.find(subject => subject.id === role)?.position;
          return before && after && after[0] - before[0] === motor.d[0] && after[1] - before[1] === motor.d[1];
        }).map(receipt => receipt.id),
      })));
  }

  /** All nonzero raw displacements learned by the unchanged frozen recorder. */
  observedEffects(): readonly FrozenP05ObservedEffect[] {
    return Object.entries(this.learning.partMotion ?? {}).flatMap(([role, motion]) =>
      Object.entries(motion.displacements ?? {}).flatMap(([command, histogram]) =>
        Object.values(histogram).filter(stroke => stroke.d.some(Boolean)).map(stroke => ({
          command, receiver: role, delta: [...stroke.d] as P05Point,
          supportingReturnIds: this.receipts.filter(receipt => {
            if (receipt.kind !== 'command' || receipt.command !== command || !receipt.before || !receipt.after) return false;
            const before = receipt.before.subjects.find(subject => subject.id === role)?.position;
            const after = receipt.after.subjects.find(subject => subject.id === role)?.position;
            return before && after && after[0] - before[0] === stroke.d[0] && after[1] - before[1] === stroke.d[1];
          }).map(receipt => receipt.id),
        }))));
  }

  /**
   * This frozen boundary does not publish a context/latency/resource contract.
   * Returning a manufactured full claim would misrepresent the source module.
   * Its actual vector capability is reported independently by vectors().
   */
  claims(): readonly P05AcquiredEffect[] { return []; }

  diagnostics() {
    return {
      receipts: this.receipts.length,
      stationaryReturnIds: this.receipts.filter(receipt => receipt.kind === 'command' && receipt.before && receipt.after
        && receipt.before.subjects.every(subject => {
          const returned = receipt.after!.subjects.find(after => after.id === subject.id);
          return returned && returned.position[0] === subject.position[0] && returned.position[1] === subject.position[1];
        })).map(receipt => receipt.id),
      missingReturnIds: this.receipts.filter(receipt => !receipt.after).map(receipt => receipt.id),
      staleProofIds: [...new Set(this.priorClaims.flatMap(prior => prior.supportingReturnIds))],
      recordedDisplacements: structuredClone(Object.fromEntries(Object.entries(this.learning.partMotion ?? {})
        .map(([role, motion]) => [role, motion.displacements ?? {}]))),
    };
  }
}

export const createFrozenP05Learner = (options: P05LearnerOptions) => new FrozenP05MotionAdapter(options);
