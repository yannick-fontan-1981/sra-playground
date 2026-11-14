import type { GameObservation } from '../runtime/browser-games.ts';
import { isTerminalState, type AgentAction } from '../runtime/contracts.ts';
import type { V6AgentSnapshot } from '../runtime/v6-agent.ts';
import type { NativeClickReturn } from '../logos-engine/v6-native-click-return.ts';
import { compareClickReturns, type ClickEvidence } from './click-evidence.ts';
import { evaluateControlEffect, type ControlEffectResolution } from './know-control-effect.ts';
import type { EvidenceRef, SituationFrame } from './situation.ts';
import { readFrontierRefusal, readNativeResolution, readOpenNeed, readRecoveryRefusal, type NativeResolution } from './native-resolution.ts';

type ShadowBoard = Pick<GameObservation, 'gameCode' | 'level' | 'state' | 'availableActionIds'>;
type ShadowAgent = Pick<V6AgentSnapshot, 'sessionId' | 'sequence' | 'status' | 'busy' | 'trace' | 'pendingAction'
  | 'level' | 'lastClickReturn' | 'clickReturns' | 'omittedClickReturns'>
  & Partial<Pick<V6AgentSnapshot, 'lastDecision' | 'proposal' | 'phase'>>;

export interface ShadowView {
  readonly gameCode: string;
  readonly frame: SituationFrame;
  readonly commands: readonly number[];
  readonly nextAction: AgentAction | null;
  readonly returnCheck: { readonly matched: boolean | null; readonly evidence: EvidenceRef } | null;
  readonly clickReturn: NativeClickReturn | null;
  readonly clickEvidence: ClickEvidence | null;
  readonly resolution: ControlEffectResolution;
  readonly native: NativeResolution | null;
  readonly recoveryRefusal?: ReturnType<typeof readRecoveryRefusal>;
  readonly frontierRefusal?: ReturnType<typeof readFrontierRefusal>;
  readonly openNeed?: ReturnType<typeof readOpenNeed>;
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

function bindClickReturn(agent: ShadowAgent, board: ShadowBoard, returnRef: string): NativeClickReturn | null {
  const receipt = agent.lastClickReturn;
  if (!receipt || receipt.toLevel !== board.level || receipt.afterRef !== returnRef) return null;
  const beforePrefix = `${agent.sessionId}:epoch:${receipt.fromLevel}:revision:${agent.sequence}:frame:`;
  return receipt.beforeRef.startsWith(beforePrefix) ? receipt : null;
}

function readClickEvidence(agent: ShadowAgent): ClickEvidence | null {
  const returns = agent.clickReturns?.filter(receipt => {
    const { sequence, fromLevel, toLevel } = receipt;
    return Number.isSafeInteger(sequence) && sequence > 0 && sequence <= agent.sequence
      && receipt.beforeRef.startsWith(`${agent.sessionId}:epoch:${fromLevel}:revision:${sequence}:frame:`)
      && receipt.afterRef.startsWith(`${agent.sessionId}:epoch:${toLevel}:revision:${sequence + 1}:frame:`);
  });
  return returns?.length ? compareClickReturns(returns, agent.omittedClickReturns ?? 0) : null;
}

/** Project a settled public snapshot. No commands, graph reads or writes go back to V6. */
export function readControlEffectShadow(board: ShadowBoard, agent: ShadowAgent | null, boardRevision: number): ShadowView | null {
  if (agent?.busy) return null;
  const current = agent?.sessionId && agent.level === board.level ? agent : null;
  const returnCheck = current ? findReturn(current, board) : null;
  const clickReturn = current && returnCheck ? bindClickReturn(current, board, returnCheck.evidence.ref) : null;
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
    returnCheck,
    clickReturn,
    clickEvidence: current && current.status !== 'error' ? readClickEvidence(current) : null,
    recoveryRefusal: current?.status === 'stopped' ? readRecoveryRefusal(current) : null,
    frontierRefusal: current?.status === 'stopped' ? readFrontierRefusal(current) : undefined,
    openNeed: current?.status === 'stopped' ? readOpenNeed(current) : undefined,
    native: current && current.status !== 'error' ? readNativeResolution({
      ...current, lastDecision: current.lastDecision ?? null, proposal: current.proposal ?? null, phase: current.phase ?? null,
    }) : null,
    // The receipt describes a past click. It cannot bind the next command's subject.
    resolution: evaluateControlEffect({
      scope,
      controlRef: hasCommand && nextAction ? JSON.stringify(nextAction) : null,
      subjectRef: null,
    }, frame),
  };
}
