export interface SituationScope {
  readonly session: string;
  readonly level: number;
}

export interface EvidenceRef {
  readonly kind: 'public_board' | 'native_return';
  readonly ref: string;
}

export type ControlModel = 'identified_click' | 'directional' | 'selection_then_transform' | 'other';

export interface SituationValues {
  readonly controlModel: ControlModel;
  readonly commandAvailable: boolean;
  readonly subjectObservable: boolean;
  readonly effectIsolatable: boolean;
  readonly riskBounded: boolean;
  readonly experimentPending: boolean;
  readonly passiveObservationPossible: boolean;
}

export type SituationKey = keyof SituationValues;
export type SituationTrait<T> =
  | { readonly status: 'known'; readonly value: T; readonly evidence: readonly [EvidenceRef, ...EvidenceRef[]] }
  | { readonly status: 'unknown' };

export type SituationTraits = { readonly [K in SituationKey]?: SituationTrait<SituationValues[K]> };

export interface SituationFrame {
  readonly schemaVersion: 1;
  readonly scope: SituationScope;
  readonly revision: number;
  readonly phase: 'observation' | 'terminal';
  readonly traits: SituationTraits;
}
