import type { PublicObservation, V7Runtime } from '../logos-engine/v7-runtime.ts';
import { perceiveFrame } from '../logos-engine/public-observer.ts';
import { frameFromAgentObservation, isSupportedAgentActionId, isTerminalState } from './contracts.ts';
import type { AgentObservation, SupportedAgentActionId } from './contracts.ts';
import { SraAgentError } from './sra-agent-protocol.ts';
import type { SraAgentOperation, SraAgentResult, SraKnowledgeSummary } from './sra-agent-protocol.ts';

const EXECUTION = { maxInstructions: 4096, deadlineMs: 2000, yieldEvery: 32 } as const;

/** Worker-side state machine. Its only execution authority is a one-use proposal. */
export class SraAgentService {
  private readonly createRuntime: () => Promise<V7Runtime>;
  private runtime: V7Runtime | null = null;
  private sessionId = '';
  private sequence = 0;
  private gameCode = '';
  private level = 0;
  private publicState = '';
  private current: PublicObservation | null = null;
  private pendingAction: { action: SupportedAgentActionId; sequence: number; proposalId: string } | null = null;
  private busy = false;

  constructor(createRuntime: () => Promise<V7Runtime>) { this.createRuntime = createRuntime; }

  summary(): SraKnowledgeSummary {
    const nodes = Object.values(this.runtime?.memory.nodes ?? {});
    const choice = this.runtime?.lastChoice;
    return {
      cycles: this.runtime?.sequence ?? 0, choices: this.runtime?.choices.length ?? 0,
      nodeCount: nodes.length,
      hypothesisCount: nodes.filter(node => node.kind === 'hypothesis').length,
      compositionCount: nodes.filter(node => node.kind === 'composition').length,
      lastDecision: choice?.decision ? `${String(choice.decision.action)} · ${choice.policyId}` : null,
      trace: this.runtime?.lastTrace.slice(-128) ?? [],
    };
  }

  private checkSignal(signal?: AbortSignal): void {
    if (signal?.aborted) throw new SraAgentError('cancelled', 'Reasoning paused.');
  }

  private async perceive(observation: AgentObservation): Promise<PublicObservation> {
    return perceiveFrame({
      frame: frameFromAgentObservation(observation),
      availableActionIds: observation.availableActionIds,
      state: observation.state,
      levelsCompleted: observation.levelsCompleted,
    }, { id: `${observation.sessionId}:observation:${observation.sequence}`, scope: `${observation.sessionId}:${observation.gameCode}:level:${observation.level}` });
  }

  async handle(operation: SraAgentOperation, signal?: AbortSignal): Promise<SraAgentResult> {
    if (this.busy) throw new SraAgentError('invalid', 'The reasoning worker is already processing an operation.');
    this.busy = true;
    try {
      this.checkSignal(signal);
      if (!operation.sessionId || !Number.isSafeInteger(operation.sequence) || operation.sequence < 0) throw new SraAgentError('invalid', 'Invalid reasoning request identity.');
      if (operation.type === 'initialize') {
        if (operation.sequence !== 0 || operation.observation.sequence !== 0 || operation.observation.sessionId !== operation.sessionId) throw new SraAgentError('invalid', 'Invalid initial observation identity.');
        const runtime = await this.createRuntime();
        const current = await this.perceive(operation.observation);
        this.checkSignal(signal);
        await runtime.advance({ before: null, after: current, action: null }, { ...EXECUTION, signal });
        this.checkSignal(signal);
        this.runtime = runtime; this.current = current; this.sessionId = operation.sessionId;
        this.sequence = 0; this.gameCode = operation.observation.gameCode; this.level = operation.observation.level;
        this.publicState = operation.observation.state; this.pendingAction = null;
        return { kind: 'ready', summary: this.summary() };
      }
      if (!this.runtime || !this.current || operation.sessionId !== this.sessionId) throw new SraAgentError('stale', 'The reasoning session has changed.');
      if (operation.type === 'observe') {
        if (!this.pendingAction || operation.sequence !== this.sequence + 1 || this.pendingAction.sequence !== this.sequence
          || operation.action !== this.pendingAction.action || operation.observation.sessionId !== this.sessionId
          || operation.observation.sequence !== operation.sequence || operation.observation.gameCode !== this.gameCode
          || operation.observation.level !== this.level) throw new SraAgentError('stale', 'The action outcome does not match the pending proposal.');
        const current = await this.perceive(operation.observation);
        this.checkSignal(signal);
        await this.runtime.advance({ before: this.current, after: current, action: `ACTION${operation.action}` }, { ...EXECUTION, signal });
        this.checkSignal(signal);
        this.current = current; this.sequence = operation.sequence; this.publicState = operation.observation.state; this.pendingAction = null;
        return { kind: 'observed', summary: this.summary() };
      }
      if (operation.sequence !== this.sequence) throw new SraAgentError('stale', 'The observation sequence has changed.');
      if (operation.type === 'abandon') {
        if (!this.pendingAction || operation.proposalId !== this.pendingAction.proposalId) throw new SraAgentError('stale', 'The abandoned reservation is no longer current.');
        // The runtime ticket stays consumed. A cancelled host handoff is not a
        // witnessed action and must not create knowledge of a fake transition.
        this.pendingAction = null;
        return { kind: 'abandoned', summary: this.summary() };
      }
      if (isTerminalState(this.publicState)) return { kind: 'stopped', summary: this.summary(), reason: 'terminal', message: `The game reports ${this.publicState}.` };
      if (this.pendingAction) throw new SraAgentError('stale', 'The previous proposal needs its witnessed action outcome.');
      if (operation.type === 'choose') {
        // Reserve an acquisition slot before releasing an action. No automatic
        // memory reset and no move whose outcome cannot fit the event budget.
        const limits = this.runtime.kernel.drm.limits as { events: number };
        if (this.runtime.sequence >= limits.events || this.runtime.choices.length >= limits.events) {
          return { kind: 'stopped', summary: this.summary(), reason: 'budget', message: 'The V7 session budget is reached. Start a new reasoning session to continue from this position.' };
        }
        const choice = await this.runtime.choose(this.current, { ...EXECUTION, signal, policyRef: 'native_context_curiosity' });
        this.checkSignal(signal);
        if (!choice.proposal) return { kind: 'stopped', summary: this.summary(), reason: 'no-action', message: 'V7 has no grounded action proposal in this observation.' };
        const command = await this.runtime.validateProposal(choice.proposal);
        this.checkSignal(signal);
        const action = Number(command.actionRef.replace(/^ACTION/, ''));
        if (!isSupportedAgentActionId(action) || Object.keys(command.data).length !== 0) {
          return { kind: 'stopped', summary: this.summary(), reason: 'unsupported', message: 'This first agent supports ACTION1–5. Coordinate clicks and recovery remain deferred.' };
        }
        return { kind: 'choice', summary: this.summary(), action, proposal: choice.proposal };
      }
      const command = await this.runtime.consumeProposal(operation.proposal);
      const action = Number(command.actionRef.replace(/^ACTION/, ''));
      if (!isSupportedAgentActionId(action) || Object.keys(command.data).length !== 0) throw new SraAgentError('invalid', 'The proposal is not a supported native command.');
      this.pendingAction = { action, sequence: this.sequence, proposalId: command.proposalId };
      return { kind: 'consumed', summary: this.summary(), action, proposalId: command.proposalId };
    } finally { this.busy = false; }
  }
}
