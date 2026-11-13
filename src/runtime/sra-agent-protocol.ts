import type { ProposalTicket } from '../logos-engine/v7-runtime.ts';
import type { TraceEvent } from '../logos-engine/ir.ts';
import type { AgentObservation, SupportedAgentActionId } from './contracts.ts';

export interface SraKnowledgeSummary {
  cycles: number;
  choices: number;
  nodeCount: number;
  hypothesisCount: number;
  compositionCount: number;
  lastDecision: string | null;
  trace: readonly TraceEvent[];
}

export type SraAgentOperation =
  | { type: 'initialize'; sessionId: string; sequence: 0; observation: AgentObservation }
  | { type: 'observe'; sessionId: string; sequence: number; observation: AgentObservation; action: SupportedAgentActionId }
  | { type: 'choose'; sessionId: string; sequence: number }
  | { type: 'consume'; sessionId: string; sequence: number; proposal: ProposalTicket }
  | { type: 'abandon'; sessionId: string; sequence: number; proposalId: string };

export type SraAgentResult =
  | { kind: 'ready' | 'observed' | 'abandoned'; summary: SraKnowledgeSummary }
  | { kind: 'choice'; summary: SraKnowledgeSummary; action: SupportedAgentActionId; proposal: ProposalTicket }
  | { kind: 'consumed'; summary: SraKnowledgeSummary; action: SupportedAgentActionId; proposalId: string }
  | { kind: 'stopped'; summary: SraKnowledgeSummary; reason: 'terminal' | 'budget' | 'no-action' | 'unsupported'; message: string };

export type SraAgentErrorCode = 'cancelled' | 'budget' | 'stale' | 'invalid' | 'internal' | 'timeout';
export type SraWorkerRequest =
  | (SraAgentOperation & { id: number })
  | { type: 'cancel'; id: number; sessionId: string };
export type SraWorkerResponse = {
  id: number; sessionId: string; sequence: number;
} & ({ result: SraAgentResult } | { error: { code: SraAgentErrorCode; message: string } });

export interface SraAgentTransport {
  request(operation: SraAgentOperation): Promise<SraAgentResult>;
  cancel(sessionId: string): void;
  reset(reason: string): void;
  dispose(): void;
}

export class SraAgentError extends Error {
  readonly code: SraAgentErrorCode;
  constructor(code: SraAgentErrorCode, message: string) { super(message); this.name = 'SraAgentError'; this.code = code; }
}
