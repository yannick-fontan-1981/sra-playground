import type { GameObservation } from '../runtime/browser-games.ts';
import { isTerminalState, type AgentAction } from '../runtime/contracts.ts';
import type { V6AgentSnapshot } from '../runtime/v6-agent.ts';
import { evaluateControlEffect, type ControlEffectResolution } from './know-control-effect.ts';
import type { EvidenceRef, SituationFrame } from './situation.ts';

type ShadowBoard = Pick<GameObservation, 'gameCode' | 'level' | 'state' | 'availableActionIds'>;
type ShadowAgent = Pick<V6AgentSnapshot, 'sessionId' | 'sequence' | 'status' | 'busy' | 'trace' | 'pendingAction' | 'level'>;

export interface ShadowView {
  readonly gameCode: string;
  readonly frame: SituationFrame;
  readonly commands: readonly number[];
  readonly nextAction: AgentAction | null;
  readonly returnCheck: { readonly matched: boolean | null; readonly evidence: EvidenceRef } | null;
  readonly resolution: ControlEffectResolution;
}

function findReturn(agent: ShadowAgent, board: ShadowBoard): ShadowView['returnCheck'] {
  if (!agent.sessionId || agent.sequence < 1 || agent.status === 'error') return null;
  const prefix = `${agent.sessionId}:epoch:${board.level}:revision:${agent.sequence + 1}:frame:`;
  for (const item of agent.trace.slice(-128).reverse()) {
    if (typeof item !== 'object' || item === null) continue;
    if ('kind' in item && item.kind === 'actual_outcome' && 'observation_ref' in item
      && typeof item.observation_ref === 'string' && item.observation_ref.startsWith(prefix)
      && 'matched' in item && (item.matched === null || typeof item.matched === 'boolean')) {
      return { matched: item.matched, evidence: { kind: 'native_return', ref: item.observation_ref } };
    }
  }
  return null;
}

/** Project a settled public snapshot. No commands, graph reads or writes go back to V6. */
export function readControlEffectShadow(board: ShadowBoard, agent: ShadowAgent | null, boardRevision: number): ShadowView | null {
  if (agent?.busy) return null;
  const current = agent?.sessionId && agent.level === board.level ? agent : null;
  const scope = { session: current?.sessionId ?? `board:${board.gameCode}:${boardRevision}`, level: board.level };
  const revision = current?.sequence ?? boardRevision;
  const phase = isTerminalState(board.state) ? 'terminal' : 'observation';
  const commands = [...new Set(board.availableActionIds)].filter(id => Number.isInteger(id) && id >= 1 && id <= 7);
  const nextAction = phase === 'observation' && current?.status === 'paused' ? current.pendingAction : null;
  const hasCommand = nextAction ? commands.includes(nextAction.id) : commands.length ? undefined : false;
  const frame: SituationFrame = {
    schemaVersion: 1, scope, revision, phase,
    traits: hasCommand === undefined ? {} : {
      commandAvailable: { status: 'known', value: hasCommand, evidence: [
        { kind: 'public_board', ref: `${scope.session}:${scope.level}:${revision}` },
      ] },
    },
  };
  return {
    gameCode: board.gameCode,
    frame,
    commands,
    nextAction: hasCommand ? nextAction : null,
    returnCheck: current ? findReturn(current, board) : null,
    // The browser protocol exposes a command and a return, but has no SIC contract
    // that certifies the controlled subject or attributes a causal effect to it.
    resolution: evaluateControlEffect({
      scope,
      controlRef: hasCommand && nextAction ? JSON.stringify(nextAction) : null,
      subjectRef: null,
    }, frame),
  };
}
