/** Shared public contracts for the native TypeScript transfer of V6. */
import type { ObservedInputDomain } from './v6-native-observer.ts';
import type { KnowledgeMemory } from './kernel.ts';
import type { ExecutionOptions, JsonObject, JsonValue, Primitive } from './ir.ts';
import type { NativeSrcReceipt } from './v6-src-program.ts';
import type { NativeClickReturn } from './v6-native-click-return.ts';
import type { FamilyAgendaReceipt } from '../sic/family-agenda.ts';
export type NativeRows = readonly (readonly number[])[];
export type NativePoint = readonly [x: number, y: number];
export type NativeBox = readonly [left: number, top: number, right: number, bottom: number];
export type NativeRecord = Record<string, unknown>;
export type NativeMaybePromise<T> = T | Promise<T>;

export interface NativeSelectionGroup {
  readonly id: string;
  readonly families: readonly string[];
  /** Aligned with families, without adding duplicate memory/activation owners. */
  readonly entryPoints?: readonly (string | null)[];
}

export interface SicActionCoverage {
  readonly contactRecovery: number;
  readonly configurableFrontier: number;
  readonly fixedFrontier: number;
  readonly viewAccess: number;
  readonly information: number;
  readonly native: number;
  readonly sicOnly?: number;
}

/** Public transport attributes retain the original V6 spelling and meaning. */
export interface NativePublicObservation {
  readonly frame_rows: NativeRows;
  readonly frame_packet: readonly NativeRows[];
  readonly level: number;
  readonly levels_completed: number;
  readonly state: string;
  readonly step_index: number;
  readonly available_action_refs: readonly string[];
  readonly frame_hash: string;
}

export interface NativeEntity extends NativeRecord {
  readonly id: string;
  readonly signature: string;
  readonly position: NativePoint;
  readonly bbox: NativeBox;
  readonly area: number;
  readonly scale: number;
  readonly mask: readonly NativePoint[];
  readonly palette_value: number;
  readonly rectangular: boolean;
  readonly identity_ambiguous: boolean;
  readonly identity_scope: string;
}

export interface NativeObservation extends NativeRecord {
  readonly revision: number;
  readonly level_epoch: number;
  readonly frame_hash: string;
  readonly observation_ref: string;
  readonly coordinate_basis: 'screen';
  readonly entities: readonly NativeEntity[];
  readonly available_action_refs: readonly string[];
  readonly state: string;
  readonly levels_completed: number;
  readonly unknowns: readonly unknown[];
  readonly provenance: string;
}

export interface NativeCommand {
  readonly action_ref: string;
  readonly data: Readonly<Record<string, number>>;
}

/** Family-specific witnesses remain in their original JSON fields. */
export interface NativeProposal extends NativeRecord {
  readonly status: string;
  readonly kind: string;
  readonly actions: readonly NativeCommand[];
  readonly steps?: readonly NativeRecord[];
  readonly binding?: NativeRecord;
  readonly facts?: NativeRecord;
  readonly compositions?: readonly NativeRecord[];
}

export interface NativeBeforeResult {
  readonly admitted: boolean;
  readonly reason: string;
  /** Explicit native current-binding evidence; it never claims an action effect. */
  readonly native_binding_receipt?: NativeRecord;
}

export interface NativeAfterResult {
  readonly matched: boolean | null;
  readonly seal_prefix: boolean;
  readonly reason: string;
}

export interface NativeRecordResult extends NativeRecord {
  readonly events: readonly unknown[];
}

/** A conditional justification from actual acquired state, never an action ticket. */
export interface NativeLearnedPreparationWitness {
  readonly status: 'conditional_acquired_preparation';
  readonly kind: 'program_model' | 'occurrence_correspondence' | 'radial_point_method' | 'radial_point_method_revalidation';
  readonly observation_ref: string;
  readonly model_ids: readonly string[];
  readonly evidence_refs: readonly string[];
  readonly qualification: string;
}

/** Acquired context can support a new question without claiming its effect. */
export interface NativeGroundedInquiryWitness {
  readonly status: 'acquired_context_for_unknown_effect';
  readonly observation_ref: string;
  readonly context_model_ids: readonly string[];
  readonly evidence_refs: readonly string[];
  readonly qualification: string;
}

/** Cooperative scheduling does not authorize extra actions or clear memory. */
export interface NativeExecution {
  readonly signal?: AbortSignal;
  readonly yieldControl: () => Promise<void>;
  /** Same active-level budget as the runtime, expressed on the supplied clock. */
  readonly deadlineMs?: number;
  readonly now?: () => number;
  /** Current level quota, separate from the remaining session/prefix allowance. */
  readonly remainingLevelActions?: number;
  readonly reasoningMode?: import('../sic/reasoning-mode.ts').ReasoningMode;
  readonly observedControlledMotion?: import('../sic/public-input-exploration.ts').ControlledMotion;
  readonly readDirectionalMotion?: () => import('../sic/observed-translation.ts').DirectionalMotion | null;
  readonly readClickFields?: () => import('../sic/field-isolation.ts').ClickFieldEvidence | null;
  readonly readAnimatedCells?: (points: readonly NativePoint[]) => import('../sic/observed-animation.ts').AnimatedCellEvidence | null;
}

export interface NativeProgramHandle {
  readonly workflowId: string;
  run(inputs: JsonObject, options?: ExecutionOptions): Promise<{ result: JsonValue; receipt: NativeSrcReceipt }>;
}

/** Runtime injection: every run reads its actual IR from one common store. */
export interface NativeProgramRegistry {
  registerProgram(workflowId: string, callbacks: Readonly<Record<string, Primitive>>): Promise<NativeProgramHandle>;
}

/**
 * Python-family boundary, with named public arguments and original proposal keys.
 * Family ports with a different internal signature use a small explicit adapter.
 */
export interface NativeFamily<P extends NativeProposal = NativeProposal> {
  readonly id: string;
  attachPrograms?(registry: NativeProgramRegistry): NativeMaybePromise<void>;
  propose(observation: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number,
    execution?: NativeExecution): NativeMaybePromise<P | null>;
  /** One retained family can have distinct source entry points in two groups. */
  proposeInGroup?(group: string, observation: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number,
    execution?: NativeExecution): NativeMaybePromise<P | null>;
  /** Distinct ordered source entries can share one retained family owner. */
  proposeInSubquestion?(group: string, subquestion: string, observation: NativeObservation, rows: NativeRows,
    inputs: readonly NativeCommand[], remaining: number, execution?: NativeExecution): NativeMaybePromise<P | null>;
  /** A measured current abstention, such as an incomplete bounded search. */
  currentProposalRefusal?(observation: NativeObservation): NativeRecord | null;
  /** Source-local routing barrier, read only after this entry returned null.
   * A recognized interface may stop its remaining group without stopping later groups. */
  sourceGroupStop?(group: string, entry: string | null, observation: NativeObservation): NativeRecord | null;
  preservationObligations?(observation: NativeObservation, rows: NativeRows): NativeMaybePromise<readonly NativeRecord[]>;
  bind?(proposal: P, domain: ObservedInputDomain): NativeMaybePromise<void>;
  before(proposal: P, index: number, publicPacket: NativePublicObservation, observation: NativeObservation,
    execution?: NativeExecution): NativeMaybePromise<NativeBeforeResult>;
  after(proposal: P, index: number, before: NativeObservation, after: NativeObservation,
    firstRows: NativeRows, secondRows: NativeRows): NativeMaybePromise<NativeAfterResult>;
  record(before: NativeObservation, after: NativeObservation, command: NativeCommand,
    firstRows: NativeRows, secondRows: NativeRows, proposal: P, index: number,
    frames: readonly NativeRows[], execution?: NativeExecution): NativeMaybePromise<NativeRecordResult>;
  // execution is native scheduling context, never an extra Python source datum.
  /** Source refusal, read only after the real prefix has been fully acquired. */
  requestedStopReason?(observation: NativeObservation): string | null;
  /** Read-only: proves acquisition separately from the current before-action guard. */
  learnedPreparationWitness?(proposal: P, observation: NativeObservation): NativeMaybePromise<NativeLearnedPreparationWitness | null>;
  groundedInquiryWitness?(proposal: P, observation: NativeObservation): NativeMaybePromise<NativeGroundedInquiryWitness | null>;
  /** Read-only current relation or acquired context, explicitly distinguished. */
  currentInquiryWitness?(proposal: P, observation: NativeObservation, rows: NativeRows): NativeMaybePromise<NativeRecord | null>;
  /** Native composition attention reads the existing acquired owner. It must
   * not retain a second domain model or invoke record to consume its returns. */
  compositionDependencyState?(): NativeRecord;
  /** A native facade may constrain a fresh source question to the retained
   * parent. Ordinary family binding, guards and WHY/ACT remain mandatory. */
  proposeForRetainedComposition?(binding: NativeRecord, observation: NativeObservation, rows: NativeRows,
    inputs: readonly NativeCommand[], remaining: number, execution?: NativeExecution): NativeMaybePromise<P | null>;
  /** Native coordination only: a source-declared current service may take
   * precedence over an independent unknown-effect question. The caller must
   * supply its real current trial scope; this witness releases no action. */
  currentRequiredServiceWitness?(proposal: P, observation: NativeObservation, rows: NativeRows,
    currentTrial: NativeRecord): NativeMaybePromise<NativeRecord | null>;
  /** Native coordination only: distinguish an unacquired question from a
   * current continuation supported by an actual official acquisition. These
   * read-only attestations never authorize a physical action. */
  unacquiredInquiryWitness?(proposal: P, observation: NativeObservation): NativeMaybePromise<NativeRecord | null>;
  retainedSuccessWitness?(observation: NativeObservation): NativeMaybePromise<NativeRecord | null>;
  acquiredContinuationWitness?(proposal: P, observation: NativeObservation): NativeMaybePromise<NativeRecord | null>;
  state(): NativeRecord;
  /** All persistent state is reconstructed from the authoritative shared nodes. */
  restore(state: NativeRecord): void;
  /** Opt-in internal checkpoint with validated immutable branches. Public state still copies. */
  nativeState?(): NativeRecord;
  /** Reads the actual hydrated V7 value; changed inputs still require complete validation. */
  restoreNative?(state: Readonly<NativeRecord>): void;
}

export interface NativeBudgets {
  readonly targetLevels: number;
  readonly levelActionCaps: readonly number[];
  readonly maxActions?: number;
}

/** Counts are reported only when they correspond to actual retained structures. */
export interface NativeRuntimeSnapshot extends NativeRecord {
  readonly actions: number;
  readonly cycles: number | null;
  readonly nodeCount: number | null;
  readonly hypothesisCount: number | null;
  readonly compositionCount: number | null;
  readonly levelsCompleted: number;
  readonly level: number;
  readonly activeSeconds: number;
  readonly lastDecision: string | null;
  readonly trace: readonly unknown[];
  readonly reason: string | null;
  readonly sourceCommit: string;
  readonly sourceDigest: string;
  readonly proposal: unknown;
  readonly graphChain?: string;
  readonly graphRevision?: number;
  readonly nativeExecutionDigest?: string;
  readonly lastClickReturn?: NativeClickReturn;
  readonly clickReturns?: readonly NativeClickReturn[];
  readonly omittedClickReturns?: number;
  readonly coverage?: { readonly sourceGroups: readonly NativeSelectionGroup[]; readonly [key: string]: unknown };
  readonly sicActionCoverage?: SicActionCoverage;
  readonly sicFamilySelection?: FamilyAgendaReceipt;
  readonly sicFamilyActions?: number;
}

export interface NativeAuthorization {
  readonly observation_ref: string;
  readonly decision_revision: number;
  readonly action_index: number;
}

/** Current authoritative graph/program identity, without diagnostic materialization. */
export interface NativeAuthorizationIdentity {
  readonly graphChain: string;
  readonly nativeExecutionDigest: string;
}

export interface NativeRuntimeYield {
  readonly kind: 'action' | 'boundary' | 'stopped';
  readonly reason: string | null;
  readonly command: NativeCommand | null;
  readonly authorization: NativeAuthorization | null;
  readonly snapshot: NativeRuntimeSnapshot;
}

export interface NativeInitialize {
  readonly sessionId: string;
  readonly observation: NativePublicObservation;
  readonly budgets: NativeBudgets;
}

export interface NativeOutcome {
  /** The service supplies the exact pending command, never a host substitute. */
  readonly command: NativeCommand;
  readonly observation: NativePublicObservation;
  readonly executionMs: number;
}

/** An edit is a graph transaction at a sealed prefix, never an action. */
export interface NativeGraphEdit {
  readonly expectedGraphChain: string;
  readonly reason: string;
  readonly changes: readonly (
    | { readonly type: 'set_family_enabled'; readonly familyId: string; readonly enabled: boolean }
    | { readonly type: 'replace_program'; readonly programId: string; readonly module: unknown }
  )[];
}

/** These rejections leave the graph, family memory and current session intact. */
export class NativeEditRejected extends Error {
  readonly code: 'stale_edit' | 'invalid_edit' | 'busy_edit';
  constructor(code: NativeEditRejected['code'], message: string) {
    super(message); this.name = 'NativeEditRejected'; this.code = code;
  }
}

/** No simulator or native-game handle crosses this backend boundary. */
export interface NativeV6Backend {
  readonly sourceCommit: string;
  readonly sourceDigest: string;
  initialize(input: NativeInitialize, execution: NativeExecution): Promise<NativeRuntimeYield>;
  advance(outcome: NativeOutcome, execution: NativeExecution): Promise<NativeRuntimeYield>;
  resume(execution: NativeExecution): Promise<NativeRuntimeYield>;
  snapshot(): NativeRuntimeSnapshot;
  /** Opt-in read of current authority; backends without it retain snapshot validation. */
  authorizationIdentity?(): NativeAuthorizationIdentity;
  inspectKnowledge?(): KnowledgeMemory;
  edit?(input: NativeGraphEdit, execution: NativeExecution): Promise<NativeRuntimeYield>;
  close(reason: string): NativeMaybePromise<void>;
}

export type NativeBackendFactory = (recovery?: import('../sic/active-recovery.ts').RecoveryPack) => NativeMaybePromise<NativeV6Backend>;
