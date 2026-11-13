import type { OperationTraceSink } from '../logos-engine/v6-operation-trace.ts';
import type { TemporalSourceDecisionReceipt } from '../logos-engine/v6-temporal-decision-receipt.ts';
import {
  restoreTemporalObservationState,
  snapshotTemporalObservationState,
  type TemporalObservationState,
} from '../logos-engine/v6-temporal-observation-state.ts';
import {
  runTemporalSelectionBridge,
  type TemporalSelectionBridgeResult,
} from '../logos-engine/v6-temporal-selection-bridge.ts';
import type { TemporalSourceAuthority } from '../logos-engine/v6-temporal-selection-contract.ts';
import type { TemporalReturnMeasurement } from '../logos-engine/v6-temporal-return-contract.ts';
import type { AgentAction, AgentObservation } from './contracts.ts';
import type { AgentDecisionPort } from './v6-agent-worker-core.ts';

export const TEMPORAL_DECISION_PORT_SCHEMA_VERSION = 'sra.temporal_decision_port_envelope.v1' as const;

const CAPABILITY = 'temporal-decision-port';
const MAX_PENDING_ENVELOPES = 32;

export interface TemporalDecisionPortBinding {
  sessionId: string;
  observationSequence: number;
  observationFingerprint: string;
  temporalEpisodeId: string;
  temporalObservationId: string;
  temporalObservationRevision: number;
  decisionFingerprint: string;
}

/**
 * Fully attributed input supplied by an external producer.
 *
 * The envelope deliberately contains no action and no ACT authorization. A
 * future action-release contract must be defined and qualified separately.
 */
export interface TemporalDecisionPortEnvelope {
  schemaVersion: typeof TEMPORAL_DECISION_PORT_SCHEMA_VERSION;
  binding: TemporalDecisionPortBinding;
  state: TemporalObservationState;
  authority: TemporalSourceAuthority;
  decisionReceipt: TemporalSourceDecisionReceipt;
  consumeReturn?: TemporalReturnMeasurement;
  reason: string;
  actAuthorization: null;
}

export interface BindTemporalDecisionPortEnvelopeInput {
  observation: AgentObservation;
  state: TemporalObservationState;
  authority: TemporalSourceAuthority;
  decisionReceipt: TemporalSourceDecisionReceipt;
  consumeReturn?: TemporalReturnMeasurement;
  reason: string;
}

export type TemporalDecisionPortResolutionStatus =
  | 'missing_envelope'
  | 'blocked'
  | 'selection_refused'
  | 'action_withheld';

export interface TemporalDecisionPortResolution {
  status: TemporalDecisionPortResolutionStatus;
  sessionId: string;
  observationSequence: number;
  reason: string;
  decisionRef?: string;
  selectedRef?: string;
  consumedReturn?: boolean;
  actionReleased: false;
}

export interface TemporalDecisionPortSnapshot {
  activeSessionId: string | null;
  pendingEnvelopeCount: number;
  pendingSequences: readonly number[];
  lastResolution: TemporalDecisionPortResolution | null;
}

function updateHash(hash: number, bytes: Uint8Array): number {
  let next = hash;
  for (const byte of bytes) {
    next ^= byte;
    next = Math.imul(next, 16777619);
  }
  return next >>> 0;
}

/**
 * Exact public-observation transport identity.
 *
 * This is an accidental-divergence fingerprint, not a cryptographic trust root
 * and not semantic pixel analysis.
 */
export function fingerprintAgentObservation(observation: AgentObservation): string {
  if (
    observation.image.width !== 64
    || observation.image.height !== 64
    || observation.image.pixelFormat !== 'palette-index-u8'
    || !(observation.image.pixels instanceof Uint8Array)
    || observation.image.pixels.length !== 64 * 64
  ) {
    throw new Error('cannot fingerprint malformed public observation image');
  }

  const header = JSON.stringify({
    protocolVersion: observation.protocolVersion,
    sessionId: observation.sessionId,
    sequence: observation.sequence,
    width: observation.image.width,
    height: observation.image.height,
    pixelFormat: observation.image.pixelFormat,
    availableActionIds: [...observation.availableActionIds],
    state: observation.state,
    level: observation.level,
    levelsCompleted: observation.levelsCompleted,
  });

  let hash = updateHash(2166136261, new TextEncoder().encode(header));
  hash = updateHash(hash, Uint8Array.of(255));
  hash = updateHash(hash, observation.image.pixels);
  return `fnv1a32:${hash.toString(16).padStart(8, '0')}`;
}

export function bindTemporalDecisionPortEnvelope(
  input: BindTemporalDecisionPortEnvelopeInput,
): TemporalDecisionPortEnvelope {
  if (!input.reason.trim()) throw new Error('temporal decision port reason must be non-empty');
  return structuredClone({
    schemaVersion: TEMPORAL_DECISION_PORT_SCHEMA_VERSION,
    binding: {
      sessionId: input.observation.sessionId,
      observationSequence: input.observation.sequence,
      observationFingerprint: fingerprintAgentObservation(input.observation),
      temporalEpisodeId: input.state.identity.episodeId,
      temporalObservationId: input.state.identity.observationId,
      temporalObservationRevision: input.state.identity.observationRevision,
      decisionFingerprint: input.decisionReceipt.decisionFingerprint,
    },
    state: input.state,
    authority: input.authority,
    decisionReceipt: input.decisionReceipt,
    consumeReturn: input.consumeReturn,
    reason: input.reason,
    actAuthorization: null,
  });
}

function bindingKey(sessionId: string, observationSequence: number): string {
  return JSON.stringify([sessionId, observationSequence]);
}

function portNeedId(observation: AgentObservation): string {
  return [
    'need',
    CAPABILITY,
    observation.sessionId,
    String(observation.sequence),
  ].join(':');
}

function boundedReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 512);
}

/**
 * Passive worker-compatible port for externally supplied TemporalSelection.
 *
 * The port validates and projects an envelope, but it never analyzes pixels,
 * creates candidates, chooses a candidate, manufactures an action or grants
 * ACT. Even an accepted selection returns undefined until a distinct action
 * release contract exists.
 */
export class PassiveTemporalDecisionPort implements AgentDecisionPort {
  readonly #trace?: OperationTraceSink;
  readonly #pending = new Map<string, TemporalDecisionPortEnvelope>();
  #activeSessionId: string | null = null;
  #lastResolution: TemporalDecisionPortResolution | null = null;
  #lastProjection: TemporalSelectionBridgeResult | null = null;

  constructor(trace?: OperationTraceSink) {
    this.#trace = trace;
  }

  initialize(sessionId: string, _seed: number): void {
    if (!sessionId) throw new Error('temporal decision port session id must be non-empty');
    this.#activeSessionId = sessionId;
    this.#pending.clear();
    this.#lastResolution = null;
    this.#lastProjection = null;
  }

  cancel(sessionId: string): void {
    if (this.#activeSessionId !== sessionId) return;
    this.#pending.clear();
    this.#activeSessionId = null;
    this.#lastResolution = null;
    this.#lastProjection = null;
  }

  submit(envelope: TemporalDecisionPortEnvelope): void {
    if (envelope.schemaVersion !== TEMPORAL_DECISION_PORT_SCHEMA_VERSION) {
      throw new Error('unsupported temporal decision port envelope version');
    }
    if (this.#activeSessionId === null) {
      throw new Error('temporal decision port is not initialized');
    }
    if (envelope.binding.sessionId !== this.#activeSessionId) {
      throw new Error('temporal decision envelope belongs to a different session');
    }
    if (!Number.isInteger(envelope.binding.observationSequence) || envelope.binding.observationSequence < 0) {
      throw new Error('temporal decision envelope observation sequence is invalid');
    }
    if (!envelope.binding.observationFingerprint) {
      throw new Error('temporal decision envelope observation fingerprint is required');
    }
    if (
      !envelope.binding.temporalEpisodeId
      || !envelope.binding.temporalObservationId
      || !Number.isInteger(envelope.binding.temporalObservationRevision)
      || envelope.binding.temporalObservationRevision < 0
      || !envelope.binding.decisionFingerprint
    ) {
      throw new Error('temporal decision envelope temporal binding is invalid');
    }
    if (!envelope.reason.trim()) {
      throw new Error('temporal decision envelope reason must be non-empty');
    }
    if (envelope.actAuthorization !== null) {
      throw new Error('temporal decision envelope cannot carry ACT authorization');
    }

    const key = bindingKey(envelope.binding.sessionId, envelope.binding.observationSequence);
    if (this.#pending.has(key)) {
      throw new Error('temporal decision envelope already queued for this observation');
    }
    if (this.#pending.size >= MAX_PENDING_ENVELOPES) {
      throw new Error('temporal decision envelope bound exceeded');
    }
    this.#pending.set(key, structuredClone(envelope));
  }

  decide(
    observation: AgentObservation,
    budgetMs: number,
    signal: AbortSignal,
  ): AgentAction | undefined {
    const id = portNeedId(observation);
    const actualFingerprint = fingerprintAgentObservation(observation);
    this.#lastProjection = null;
    this.#pruneStale(observation.sessionId, observation.sequence);

    if (this.#activeSessionId !== observation.sessionId) {
      this.#recordNeed(
        observation,
        id,
        [actualFingerprint],
        'partial',
        'public observation belongs to a different active session',
      );
      this.#block(
        observation,
        id,
        'temporal decision port observation belongs to a different active session',
      );
      return undefined;
    }

    const key = bindingKey(observation.sessionId, observation.sequence);
    const envelope = this.#pending.get(key);
    if (!envelope) {
      this.#recordNeed(observation, id, [actualFingerprint], 'partial', 'no attributed temporal envelope');
      this.#recordOutcome(
        observation,
        id,
        'refused',
        'not_produced',
        'refuse',
        false,
        'no attributed temporal decision envelope is available for this observation',
        undefined,
      );
      this.#resolve({
        status: 'missing_envelope',
        sessionId: observation.sessionId,
        observationSequence: observation.sequence,
        reason: 'no attributed temporal decision envelope is available',
        actionReleased: false,
      });
      return undefined;
    }

    this.#pending.delete(key);
    const refs = [actualFingerprint, envelope.decisionReceipt.decisionFingerprint];
    this.#recordNeed(observation, id, refs, 'complete', envelope.reason);

    if (
      this.#activeSessionId !== observation.sessionId
      || !Number.isFinite(budgetMs)
      || budgetMs <= 0
      || signal.aborted
    ) {
      const reason = signal.aborted
        ? 'temporal decision port evaluation was aborted'
        : 'temporal decision port observation is outside the active runtime session or budget';
      this.#block(observation, id, reason, envelope.decisionReceipt.decisionFingerprint);
      return undefined;
    }

    if (envelope.binding.observationFingerprint !== actualFingerprint) {
      this.#block(
        observation,
        id,
        'temporal decision envelope public observation fingerprint mismatch',
        envelope.decisionReceipt.decisionFingerprint,
      );
      return undefined;
    }

    if (
      envelope.binding.temporalEpisodeId !== envelope.state.identity.episodeId
      || envelope.binding.temporalObservationId !== envelope.state.identity.observationId
      || envelope.binding.temporalObservationRevision !== envelope.state.identity.observationRevision
      || envelope.binding.decisionFingerprint !== envelope.decisionReceipt.decisionFingerprint
    ) {
      this.#block(
        observation,
        id,
        'temporal decision envelope binding no longer matches its state or decision receipt',
        envelope.decisionReceipt.decisionFingerprint,
      );
      return undefined;
    }

    try {
      const restored = restoreTemporalObservationState(
        snapshotTemporalObservationState(envelope.state),
        envelope.authority,
      );
      const projection = runTemporalSelectionBridge(
        restored,
        envelope.authority,
        envelope.decisionReceipt,
        {
          reason: envelope.reason,
          trace: this.#trace,
          consumeReturn: envelope.consumeReturn,
          producer: 'passiveTemporalDecisionPort',
          caller: 'passiveTemporalDecisionPort',
          consumer: 'passiveTemporalDecisionPort',
        },
      );
      this.#lastProjection = structuredClone(projection);

      if (projection.decision.status === 'refused') {
        const reason = `verified TemporalSelection refusal preserved: ${projection.decision.reason}`;
        this.#recordOutcome(
          observation,
          id,
          'refused',
          'complete',
          'refuse',
          false,
          reason,
          envelope.decisionReceipt.decisionFingerprint,
        );
        this.#resolve({
          status: 'selection_refused',
          sessionId: observation.sessionId,
          observationSequence: observation.sequence,
          reason,
          decisionRef: envelope.decisionReceipt.decisionFingerprint,
          consumedReturn: projection.consumedReturn,
          actionReleased: false,
        });
        return undefined;
      }

      const reason = 'selection projected, but action withheld because no separate ACT authorization exists';
      this.#recordOutcome(
        observation,
        id,
        'accepted',
        'complete',
        'refuse',
        true,
        reason,
        envelope.decisionReceipt.decisionFingerprint,
      );
      this.#resolve({
        status: 'action_withheld',
        sessionId: observation.sessionId,
        observationSequence: observation.sequence,
        reason,
        decisionRef: envelope.decisionReceipt.decisionFingerprint,
        selectedRef: projection.decision.selectedRef,
        consumedReturn: projection.consumedReturn,
        actionReleased: false,
      });
      return undefined;
    } catch (error) {
      this.#lastProjection = null;
      this.#block(
        observation,
        id,
        `temporal decision envelope blocked: ${boundedReason(error)}`,
        envelope.decisionReceipt.decisionFingerprint,
      );
      return undefined;
    }
  }

  snapshot(): TemporalDecisionPortSnapshot {
    const pendingSequences = [...this.#pending.values()]
      .filter(item => item.binding.sessionId === this.#activeSessionId)
      .map(item => item.binding.observationSequence)
      .sort((a, b) => a - b);
    return {
      activeSessionId: this.#activeSessionId,
      pendingEnvelopeCount: this.#pending.size,
      pendingSequences,
      lastResolution: this.#lastResolution ? structuredClone(this.#lastResolution) : null,
    };
  }

  latestProjection(): TemporalSelectionBridgeResult | null {
    return this.#lastProjection ? structuredClone(this.#lastProjection) : null;
  }

  #pruneStale(sessionId: string, currentSequence: number): void {
    for (const [key, envelope] of this.#pending) {
      if (
        envelope.binding.sessionId === sessionId
        && envelope.binding.observationSequence < currentSequence
      ) {
        this.#pending.delete(key);
      }
    }
  }

  #resolve(resolution: TemporalDecisionPortResolution): void {
    this.#lastResolution = structuredClone(resolution);
  }

  #block(
    observation: AgentObservation,
    needId: string,
    reason: string,
    decisionRef?: string,
  ): void {
    this.#recordOutcome(
      observation,
      needId,
      'blocked',
      'unknown',
      'refuse',
      false,
      reason,
      decisionRef,
    );
    this.#resolve({
      status: 'blocked',
      sessionId: observation.sessionId,
      observationSequence: observation.sequence,
      reason,
      decisionRef,
      actionReleased: false,
    });
  }

  #recordNeed(
    observation: AgentObservation,
    needId: string,
    dependencyRefs: readonly string[],
    completeness: 'complete' | 'partial',
    reason: string,
  ): void {
    if (!this.#trace) return;
    if (this.#trace.countersOnly) {
      this.#trace.countNeed(CAPABILITY);
      return;
    }
    this.#trace.record({
      kind: 'need',
      needId,
      needKind: CAPABILITY,
      reason,
      producer: 'passiveTemporalDecisionPort',
      episodeId: observation.sessionId,
      levelEpoch: observation.level,
      observationId: `${observation.sessionId}:${observation.sequence}`,
      observationRevision: observation.sequence,
      dependencyRefs: [...dependencyRefs],
      completeness,
    });
  }

  #recordOutcome(
    observation: AgentObservation,
    needId: string,
    mode: 'accepted' | 'refused' | 'blocked',
    resultStatus: 'complete' | 'unknown' | 'not_produced',
    effectKind: 'refuse',
    semanticEffect: boolean,
    reason: string,
    decisionRef?: string,
  ): void {
    if (!this.#trace) return;
    if (this.#trace.countersOnly) {
      this.#trace.countCapability(CAPABILITY, mode);
      this.#trace.countCapabilityConsumption(CAPABILITY, effectKind);
      return;
    }
    this.#trace.record({
      kind: 'capability',
      needId,
      capability: CAPABILITY,
      caller: 'passiveTemporalDecisionPort',
      mode,
      reason,
      inputRefs: decisionRef ? [decisionRef] : [],
      dependencyRevisions: { observation: observation.sequence },
      resultStatus,
      resultSummary: {
        actionReleased: false,
        actAuthorizationPresent: false,
        decisionRef: decisionRef ?? null,
      },
    });
    this.#trace.record({
      kind: 'capability_consumption',
      needId,
      capability: CAPABILITY,
      consumer: 'passiveTemporalDecisionPort',
      decisionRef: decisionRef ?? `${observation.sessionId}:${observation.sequence}`,
      effectKind,
      semanticEffect,
      reason,
    });
  }
}
