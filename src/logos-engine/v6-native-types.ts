/** Shared public contracts for the native TypeScript transfer of V6. */
import type { ObservedInputDomain } from './v6-native-observer.ts';
import type { KnowledgeMemory } from './kernel.ts';
import type { ExecutionOptions, JsonObject, JsonValue, Primitive } from './ir.ts';
import type { NativeSrcReceipt } from './v6-src-program.ts';
export type NativeRows = readonly (readonly number[])[];
export type NativePoint = readonly [x: number, y: number];
export type NativeBox = readonly [left: number, top: number, right: number, bottom: number];
export type NativeRecord = Record<string, unknown>;
export type NativeMaybePromise<T> = T | Promise<T>;

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
}

export interface NativeAfterResult {
  readonly matched: boolean | null;
  readonly seal_prefix: boolean;
  readonly reason: string;
}

export interface NativeRecordResult extends NativeRecord {
  readonly events: readonly unknown[];
}

/** Cooperative scheduling does not authorize extra actions or clear memory. */
export interface NativeExecution {
  readonly signal?: AbortSignal;
  readonly yieldControl: () => Promise<void>;
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
  preservationObligations?(observation: NativeObservation, rows: NativeRows): NativeMaybePromise<readonly NativeRecord[]>;
  bind?(proposal: P, domain: ObservedInputDomain): NativeMaybePromise<void>;
  before(proposal: P, index: number, publicPacket: NativePublicObservation, observation: NativeObservation): NativeMaybePromise<NativeBeforeResult>;
  after(proposal: P, index: number, before: NativeObservation, after: NativeObservation,
    firstRows: NativeRows, secondRows: NativeRows): NativeMaybePromise<NativeAfterResult>;
  record(before: NativeObservation, after: NativeObservation, command: NativeCommand,
    firstRows: NativeRows, secondRows: NativeRows, proposal: P, index: number,
    frames: readonly NativeRows[]): NativeMaybePromise<NativeRecordResult>;
  state(): NativeRecord;
  /** All persistent state is reconstructed from the authoritative shared nodes. */
  restore(state: NativeRecord): void;
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
}

export interface NativeAuthorization {
  readonly observation_ref: string;
  readonly decision_revision: number;
  readonly action_index: number;
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
  inspectKnowledge?(): KnowledgeMemory;
  edit?(input: NativeGraphEdit, execution: NativeExecution): Promise<NativeRuntimeYield>;
  close(reason: string): NativeMaybePromise<void>;
}

export type NativeBackendFactory = () => NativeMaybePromise<NativeV6Backend>;
