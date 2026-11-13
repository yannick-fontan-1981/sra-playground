import type { GameObservation } from './browser-games.ts';
import type { AgentAction } from './contracts.ts';
import { isAgentAction, toAgentObservation } from './contracts.ts';
import type { NativeGraphEdit } from '../logos-engine/v6-native-types.ts';
import type { NativeClickReturn } from '../logos-engine/v6-native-click-return.ts';
import type { KnowledgeMemory } from '../logos-engine/kernel.ts';

export type { NativeGraphEdit } from '../logos-engine/v6-native-types.ts';

export const V6_REFERENCE_COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
export const V6_DEFAULT_ACTIONS_PER_LEVEL = 600;
export const V6_MAX_RUN_ACTIONS = 600;

/** Only the witnessed public frames enter the solver worker. */
export interface V6PublicObservation {
  frame: readonly (readonly number[])[];
  frames: readonly (readonly (readonly number[])[])[];
  availableActionIds: readonly number[];
  state: string;
  level: number;
  levelsCompleted: number;
  stepIndex: number;
}

export interface V6Budgets {
  targetLevels: number;
  levelActionCaps: number[];
  maxActions?: number;
}

export interface V6Command {
  actionRef: string;
  data: Record<string, unknown>;
}

export interface V6Ticket extends V6Command {
  id: string;
  sessionId: string;
  sourceDigest: string;
  /** Native store authorization; absent only for legacy/test backends. */
  graphChain?: string;
  nativeExecutionDigest?: string;
  /** Original V6 identities, deliberately opaque to the coordinator. */
  observationRef: string;
  frameHash: string;
  level: number;
  levelsCompleted: number;
  decisionRevision: number;
  /** Zero-based index inside the committed prefix, not a host sequence. */
  actionIndex: number;
}

/** Metrics come from the original solver; null means no exact counterpart. */
export interface V6BackendSnapshot {
  actions: number;
  cycles: number | null;
  nodeCount: number | null;
  hypothesisCount: number | null;
  compositionCount: number | null;
  levelsCompleted: number;
  level: number;
  activeSeconds: number;
  lastDecision: string | null;
  trace: readonly unknown[];
  reason: string | null;
  sourceCommit: string;
  sourceDigest: string;
  proposal: unknown;
  graphChain?: string;
  graphRevision?: number;
  nativeExecutionDigest?: string;
  lastClickReturn?: NativeClickReturn;
  clickReturns?: readonly NativeClickReturn[];
  omittedClickReturns?: number;
}

export type V6Phase = 'authorised_not_executed' | 'sealed_prefix' | 'stopped';
export interface V6AgentResult {
  ok: true;
  kind: 'action' | 'boundary' | 'stopped';
  sessionId: string;
  phase: V6Phase;
  reason: string | null;
  command: V6Command | null;
  ticket: V6Ticket | null;
  snapshot: V6BackendSnapshot;
  /** Returned only by an explicit read, never duplicated on every action. */
  knowledge?: KnowledgeMemory;
}

export type V6AgentOperation =
  | { type: 'init'; sessionId: string; sequence: 0; observation: V6PublicObservation; budgets: V6Budgets;
      recovery?: import('../sic/active-recovery.ts').RecoveryPack }
  | { type: 'advance'; sessionId: string; sequence: number; ticketId: string; observation: V6PublicObservation; executionMs: number }
  | { type: 'edit'; sessionId: string; sequence: number; edit: NativeGraphEdit }
  | { type: 'resume' | 'snapshot' | 'inspect' | 'close'; sessionId: string; sequence: number };

export interface V6WorkerRequest { id: number; operation: V6AgentOperation }
export type V6WorkerResponse = { id: number; sessionId: string; sequence: number } & (
  | { result: V6AgentResult }
  | { error: { code: string; message: string }; snapshot?: V6BackendSnapshot }
);

export interface V6AgentTransport {
  request(operation: V6AgentOperation): Promise<V6AgentResult>;
  /** Invalidation closes the entire coroutine; Pause deliberately does not. */
  reset(reason: string): void;
  dispose(): void;
}

export class V6AgentError extends Error {
  readonly code: string;
  readonly snapshot?: V6BackendSnapshot;
  constructor(code: string, message: string, snapshot?: V6BackendSnapshot) {
    super(message); this.name = 'V6AgentError'; this.code = code; this.snapshot = snapshot;
  }
}

export function emptyV6Snapshot(): V6BackendSnapshot {
  return {
    actions: 0, cycles: null, nodeCount: null, hypothesisCount: null, compositionCount: null,
    levelsCompleted: 0, level: 1, activeSeconds: 0, lastDecision: null, trace: [], reason: null,
    sourceCommit: V6_REFERENCE_COMMIT, sourceDigest: '', proposal: null,
  };
}

function publicFrame(value: readonly (readonly number[])[]): readonly (readonly number[])[] {
  if (!Array.isArray(value) || value.length !== 64 || value.some(row => !Array.isArray(row) || row.length !== 64
    || row.some(pixel => !Number.isInteger(pixel) || pixel < 0 || pixel > 15))) {
    throw new V6AgentError('invalid', 'A V6 public frame must contain 64 × 64 palette indices.');
  }
  return Object.freeze(value.map(row => Object.freeze([...row])));
}

/** A detached allowlist; native engine objects, undo history and metadata stay out. */
export function toV6PublicObservation(observation: GameObservation, stepIndex = 0): V6PublicObservation {
  // Reuse the established public boundary for game/state/action validation.
  toAgentObservation(observation, 'v6-projection-validation', 0);
  if (typeof stepIndex !== 'number' || !Number.isSafeInteger(stepIndex) || stepIndex < 0) {
    throw new V6AgentError('invalid', 'The public transport step index is invalid.');
  }
  const frame = publicFrame(observation.frame);
  if (!Array.isArray(observation.frames)) throw new V6AgentError('invalid', 'The native game did not provide its public animation frames.');
  const frames = observation.frames.length ? observation.frames.map(publicFrame) : [frame];
  return Object.freeze({
    frame, frames: Object.freeze(frames), availableActionIds: Object.freeze([...observation.availableActionIds]),
    state: observation.state, level: observation.level, levelsCompleted: observation.levelsCompleted, stepIndex,
  });
}

export function sameV6Observation(expected: V6PublicObservation, actual: GameObservation | null): boolean {
  if (!actual) return false;
  try {
    const current = toV6PublicObservation(actual, expected.stepIndex);
    return current.stepIndex === expected.stepIndex && current.state === expected.state && current.level === expected.level
      && current.levelsCompleted === expected.levelsCompleted
      && current.availableActionIds.length === expected.availableActionIds.length
      && current.availableActionIds.every((id, i) => id === expected.availableActionIds[i])
      && current.frames.length === expected.frames.length
      && current.frame.every((row, y) => row.every((pixel, x) => pixel === expected.frame[y]![x]))
      && current.frames.every((frame, f) => frame.every((row, y) => row.every((pixel, x) => pixel === expected.frames[f]![y]![x])));
  } catch { return false; }
}

/** Convert only an explicit native command; no fallback or reset/undo alias. */
export function nativeV6Action(command: V6Command): AgentAction {
  if (!command || typeof command !== 'object' || !/^ACTION[1-7]$/.test(command.actionRef)
    || !command.data || typeof command.data !== 'object' || Array.isArray(command.data)) {
    throw new V6AgentError('invalid', 'V6 returned an invalid native command.');
  }
  const id = Number(command.actionRef.slice(6));
  const action: unknown = id === 6 ? { id, data: { ...command.data } } : { id };
  if ((id !== 6 && Object.keys(command.data).length !== 0) || !isAgentAction(action)) {
    throw new V6AgentError('invalid', 'V6 returned invalid arguments for the native command.');
  }
  return Object.freeze(action.id === 6 ? { id: 6, data: Object.freeze({ ...action.data }) } : { id: action.id });
}

export function sameV6Action(a: AgentAction, b: AgentAction): boolean {
  return a.id === b.id && (a.id !== 6 || b.id === 6 && a.data.x === b.data.x && a.data.y === b.data.y);
}

/** Original V6 frame identity: compact JSON rows, SHA-256 truncated to 16 hex. */
export async function v6FrameHash(frame: readonly (readonly number[])[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(frame));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/** Recheck an RPC packet without admitting extra fields or shared mutable rows. */
export function validateV6PublicObservation(value: V6PublicObservation): V6PublicObservation {
  const keys = ['frame', 'frames', 'availableActionIds', 'state', 'level', 'levelsCompleted', 'stepIndex'];
  if (!value || typeof value !== 'object' || Object.keys(value).length !== keys.length
    || keys.some(key => !Object.hasOwn(value, key))) throw new V6AgentError('invalid', 'Malformed V6 public observation.');
  if (!Array.isArray(value.frames) || value.frames.length < 1 || value.frames.length > 1024) throw new V6AgentError('invalid', 'Invalid public animation packet.');
  const normalized = toV6PublicObservation({
    gameCode: 'browser-public', frame: value.frame as number[][], frames: value.frames as number[][][],
    availableActionIds: value.availableActionIds as number[], state: value.state, level: value.level,
    levelsCompleted: value.levelsCompleted, levelCount: value.level,
    canUndo: false, canSelectLevel: false, defaultFps: 10,
  }, value.stepIndex);
  const final = normalized.frames.at(-1)!;
  if (!normalized.frame.every((row, y) => row.every((pixel, x) => pixel === final[y]![x]))) {
    throw new V6AgentError('invalid', 'The final public frame differs from the last animation frame.');
  }
  return normalized;
}
