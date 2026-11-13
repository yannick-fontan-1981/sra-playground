import type { AgentAction, AgentObservation } from '../../src/runtime/contracts.ts';
import type { AgentDecisionPort } from '../../src/runtime/v6-agent-worker-core.ts';
import type { CompositionBundle } from '../../src/logos-engine/v6-composition-engine.ts';
import { releaseBundle } from '../../src/logos-engine/v6-native-authority.ts';
import type { OperationResultCache } from '../../src/logos-engine/v6-operation-cache.ts';
import type { OperationTraceSink } from '../../src/logos-engine/v6-operation-trace.ts';
import type { SymbolicRecord } from '../../src/logos-engine/v6-operations.ts';

export interface PreparedLogosDecision {
  bundle: CompositionBundle;
  state: SymbolicRecord;
  action: AgentAction;
}

export type LogosDecisionProducer =
  (observation: AgentObservation) => PreparedLogosDecision | undefined;

export interface LogosDecisionPortOptions {
  trace?: OperationTraceSink;
  cache?: OperationResultCache;
}

/**
 * Test-only bridge proving that an already-produced symbolic decision can cross
 * AgentWorkerCore -> native Logos authority -> public AgentAction.
 *
 * This helper does not perceive pixels, create symbolic state, choose a goal,
 * or synthesize a bundle. Those responsibilities remain external dependencies.
 */
export class LogosDecisionPort implements AgentDecisionPort {
  constructor(
    readonly producer: LogosDecisionProducer,
    readonly options: LogosDecisionPortOptions = {},
  ) {}

  decide(observation: AgentObservation): AgentAction | undefined {
    const prepared = this.producer(observation);
    if (!prepared) return undefined;

    const actionBound = prepared.bundle.actions.some(candidate =>
      JSON.stringify(candidate) === JSON.stringify(prepared.action));
    if (!actionBound) {
      throw new Error('prepared action is not contained in the supplied Logos bundle');
    }

    const release = releaseBundle(
      prepared.bundle,
      prepared.state,
      {
        episodeId: observation.sessionId,
        levelEpoch: `${observation.sessionId}:level:${observation.level}`,
        observationId: `observation:${observation.sequence}`,
        observationRevision: observation.sequence,
      },
      this.options.trace,
      this.options.cache,
    );

    return release.releaseAllowed ? structuredClone(prepared.action) : undefined;
  }
}
