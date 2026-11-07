import type { CompiledModule, ExecutionOptions, JsonObject, JsonValue, TraceEvent } from './ir.ts';
import { executeWorkflow, SrcExecutionError, validateCompiledModule } from './interpreter.ts';
import { arrayValue, assertPortableNumber, canonical, compareUnicode, digest, equal, exactKeys, immutableJson, objectValue, ownValue, stringValue } from './canonical.ts';
import { blockers, emptyMemory, Kernel, memoryValue } from './kernel.ts';
import type { KnowledgeMemory, KnowledgeNode } from './kernel.ts';

export interface PublicObservation extends JsonObject {
  readonly id: string;
  readonly scope: string;
  readonly values: JsonObject;
  readonly actions: readonly string[];
}

export interface ObservationEvent extends JsonObject {
  readonly before: PublicObservation | null;
  readonly after: PublicObservation;
  readonly action: string | null;
}

export interface V7RuntimeConfiguration {
  readonly logos: unknown;
  readonly drm: unknown;
  readonly generators: CompiledModule;
  readonly activation: CompiledModule;
  readonly experiment?: CompiledModule;
  /** Digest of the caller's declared, versioned TS execution manifest; not a Python engine digest. */
  readonly sourceDigest: string;
  /** Optional hashes exported by the original Python WorkflowRegistry. */
  readonly workflowHashes?: { readonly generators: string; readonly activation: string; readonly experiment?: string };
}

export interface CycleReceipt {
  readonly sequence: number;
  readonly srcStatus: 'completed';
  readonly sourceDigest: string;
  readonly workflowHash: string;
  readonly workflowHashKind: 'python-transitive-source' | 'compiler-semantic';
  readonly inputDigest: string;
  readonly deltaCount: number;
  readonly graphChain: string | null;
  readonly instructions: number;
  readonly durationMs: number;
  readonly trace: readonly TraceEvent[];
}

export interface ActivationRequest {
  readonly disabledKinds?: readonly string[];
  readonly disabledNodes?: readonly string[];
  readonly reason: string;
}

export interface ActivationReceipt {
  readonly sequence: number;
  readonly activationRef: string;
  readonly revision: number;
  readonly sourceDigest: string;
  readonly workflowHash: string;
  readonly workflowHashKind: 'python-transitive-source' | 'compiler-semantic';
  readonly beforeChain: string | null;
  readonly configuredChain: string | null;
  readonly graphChain: string | null;
  readonly configuration: JsonObject;
  readonly executed: false;
  readonly instructions: number;
  readonly durationMs: number;
  readonly trace: readonly TraceEvent[];
  readonly reconsideration?: CycleReceipt;
}

export interface ChoiceOptions extends ExecutionOptions {
  readonly policyRef?: string;
}

export interface ProposalTicket extends JsonObject {
  readonly choiceSequence: number;
  readonly sourceDigest: string;
  readonly graphChain: string;
  readonly observationRef: string;
  readonly decisionId: string;
  readonly decisionRevision: number;
}

/** A validated command for the host; consuming it does not execute an action. */
export interface ProposalCommand extends JsonObject {
  readonly actionRef: string;
  readonly data: JsonObject;
  readonly proposalId: string;
  readonly observationRef: string;
  readonly sourceDigest: string;
  readonly graphChain: string;
  readonly choiceSequence: number;
  readonly executed: false;
}

export interface ChoiceReceipt {
  readonly sequence: number;
  readonly srcStatus: 'completed';
  readonly observationRef: string;
  readonly currentObservation: PublicObservation;
  readonly basis: string | null;
  readonly sourceDigest: string;
  readonly workflowHash: string;
  readonly workflowHashKind: 'python-transitive-source' | 'compiler-semantic';
  readonly policyRef: string;
  readonly policyId: string;
  readonly decision: KnowledgeNode | null;
  readonly options: readonly KnowledgeNode[];
  readonly groundings: JsonObject;
  readonly deltaCount: number;
  readonly graphChain: string | null;
  readonly executed: false;
  readonly instructions: number;
  readonly durationMs: number;
  readonly trace: readonly TraceEvent[];
  readonly proposal: ProposalTicket | null;
}

/** Original V7 empty_argument_bindings: no inferred coordinates or recovery authority. */
export function emptyArgumentBindings(actions: readonly string[], interfaces: JsonObject): JsonObject {
  return immutableJson(Object.fromEntries(actions.map(action => {
    const declaration = Object.hasOwn(interfaces, action) ? objectValue(interfaces[action], 'input declaration') : null;
    const authority = declaration && Object.hasOwn(declaration, 'required_authority')
      ? arrayValue(declaration.required_authority, 'required authority').map(value => stringValue(value)) : [];
    const required = declaration ? arrayValue(declaration.required_arguments, 'required arguments').map(value => stringValue(value)) : [];
    const grounded = declaration !== null && required.length === 0 && authority.length === 0;
    const reason = grounded ? 'arguments_complete' : authority.length ? `authority_missing:${authority.join(',')}`
      : declaration === null ? 'interface_undeclared' : `missing_arguments:${required.join(',')}`;
    return [action, { grounded, reason, command: grounded ? { action_ref: action, data: {} } : null }];
  })));
}

function frozenTrace(trace: readonly TraceEvent[]): readonly TraceEvent[] {
  return immutableJson(trace) as unknown as readonly TraceEvent[];
}

function ensureNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Execution cancelled; committed memory was retained', 'AbortError');
}

/**
 * The bounded public bridge for the original generators/activation/experiment
 * SRC programs. Acquisition, contradiction, composition and choice run through
 * compiler IR; this bridge contains no replacement acquisition algorithm.
 *
 * Every operation publishes one immutable result only after complete execution.
 * Failed/cancelled operations retain memory, observation identities and sequence.
 * This transactional failure behavior is explicit; Python increments its attempted
 * cycle counter before scheduling. Successful histories retain Python semantics.
 */
export class V7Runtime {
  readonly kernel: Kernel;
  readonly sourceDigest: string;
  readonly generators: CompiledModule;
  readonly activation: CompiledModule;
  readonly experiment?: CompiledModule;
  private readonly workflowHashes?: { readonly generators: string; readonly activation: string; readonly experiment?: string };
  private readonly limits: Readonly<Record<'nodes' | 'facts' | 'actions' | 'events' | 'src_instructions', number>>;
  private _memory: KnowledgeMemory = emptyMemory();
  private _sequence = 0;
  private _lastTrace: readonly TraceEvent[] = Object.freeze([]);
  private _receipts: readonly CycleReceipt[] = Object.freeze([]);
  private _activationReceipts: readonly ActivationReceipt[] = Object.freeze([]);
  private _choices: readonly ChoiceReceipt[] = Object.freeze([]);
  private readonly consumedProposals = new Set<string>();
  private readonly observations = new Map<string, PublicObservation>();
  private _currentObservation: PublicObservation | null = null;
  private busy = false;

  constructor(configuration: V7RuntimeConfiguration) {
    this.kernel = new Kernel(configuration.logos, configuration.drm, configuration.sourceDigest);
    this.sourceDigest = this.kernel.sourceDigest;
    this.generators = validateCompiledModule(immutableJson(configuration.generators), this.kernel.primitives);
    this.activation = validateCompiledModule(immutableJson(configuration.activation), this.kernel.primitives);
    if (configuration.experiment) {
      this.experiment = validateCompiledModule(immutableJson(configuration.experiment), this.kernel.primitives);
      if (!this.experiment.workflows.some(workflow => workflow.id === 'prototype.v7_experiment.choose')) {
        throw new TypeError('Required V7 experiment workflow is missing');
      }
    }
    if (!this.generators.workflows.some(workflow => workflow.id === 'prototype.v7.cycle')
      || !this.activation.workflows.some(workflow => workflow.id === 'prototype.v7_activation.configure')) {
      throw new TypeError('Required V7 generators and activation workflows are missing');
    }
    const declarations = objectValue(this.kernel.drm.limits, 'DRM limits');
    const maxima = { nodes: 512, facts: 8, actions: 8, events: 32, src_instructions: 8192 } as const;
    const limits = {} as Record<keyof typeof maxima, number>;
    for (const key of Object.keys(maxima) as (keyof typeof maxima)[]) {
      const value = declarations[key];
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > maxima[key]) {
        throw new RangeError(`Unsupported declared ${key} budget (1..${maxima[key]})`);
      }
      limits[key] = value;
    }
    this.limits = Object.freeze(limits);
    const availability = objectValue(this.kernel.drm.availability, 'availability declaration');
    objectValue(availability.default, 'default availability');
    objectValue(availability.dependency_fields, 'dependency fields');
    if (configuration.workflowHashes) {
      this.workflowHashes = Object.freeze({
        generators: stringValue(configuration.workflowHashes.generators),
        activation: stringValue(configuration.workflowHashes.activation),
        ...(configuration.workflowHashes.experiment === undefined ? {} : { experiment: stringValue(configuration.workflowHashes.experiment) }),
      });
    }
  }

  get memory(): KnowledgeMemory { return this._memory; }
  get sequence(): number { return this._sequence; }
  get lastTrace(): readonly TraceEvent[] { return this._lastTrace; }
  get receipts(): readonly CycleReceipt[] { return this._receipts; }
  get activationReceipts(): readonly ActivationReceipt[] { return this._activationReceipts; }
  get choices(): readonly ChoiceReceipt[] { return this._choices; }
  get lastChoice(): ChoiceReceipt | null { return this._choices.at(-1) ?? null; }
  get currentObservation(): PublicObservation | null { return this._currentObservation; }

  /** Validates and freezes only public, witnessed observations. */
  validateEvent(input: unknown): ObservationEvent {
    const event = objectValue(immutableJson(input), 'observation event');
    exactKeys(event, ['before', 'after', 'action'], 'observation event');
    for (const candidate of [event.before, event.after]) {
      if (candidate === null) continue;
      const observation = objectValue(candidate, 'observation');
      exactKeys(observation, ['id', 'scope', 'values', 'actions'], 'observation');
      for (const key of ['id', 'scope']) if (!stringValue(observation[key], key)) throw new TypeError('Observation identity and scope must be nonempty');
      const values = objectValue(observation.values, 'measured values');
      const entries = Object.entries(values);
      if (entries.length < 1 || entries.length > this.limits.facts) throw new RangeError('Unsupported observation size');
      for (const [key, value] of entries) {
        if (!key || !['string', 'number', 'boolean'].includes(typeof value)) {
          throw new TypeError('Facts must be named measured scalars; null is unknown, not a measured value');
        }
        if (typeof value === 'number') assertPortableNumber(value);
      }
      canonical(values);
      const actions = arrayValue(observation.actions, 'actions');
      if (actions.length > this.limits.actions || actions.some(action => typeof action !== 'string' || !action)
        || new Set(actions).size !== actions.length) throw new TypeError('Malformed or over-budget action vocabulary');
      const prior = this.observations.get(observation.id as string);
      if (prior !== undefined && !equal(prior, observation)) throw new TypeError('An observation identity was rebound to different content');
    }
    if (event.after === null) throw new TypeError('Current observation required');
    const after = objectValue(event.after);
    if (event.before === null) {
      if (event.action !== null) throw new TypeError('A witnessed action requires a before observation');
    } else {
      const before = objectValue(event.before);
      const beforeValues = objectValue(before.values), afterValues = objectValue(after.values);
      if (before.scope !== after.scope || Object.keys(beforeValues).length !== Object.keys(afterValues).length
        || Object.keys(beforeValues).some(key => !Object.hasOwn(afterValues, key))) {
        throw new TypeError('Cross-scope or changing-domain transition unsupported; keep it unknown');
      }
      if (typeof event.action !== 'string' || !arrayValue(before.actions).includes(event.action)) throw new TypeError('Witnessed action absent from the observed input vocabulary');
      if (before.id === after.id) throw new TypeError('A transition requires two distinct observation identities');
    }
    return event as ObservationEvent;
  }

  async advance(event: unknown, options: ExecutionOptions = {}): Promise<CycleReceipt> {
    return this.exclusive(async () => {
      if (this._sequence >= this.limits.events) throw new RangeError('Declared event budget exhausted');
      const validated = this.validateEvent(event);
      const result = await this.runCycle(this._memory, validated, this._sequence + 1, options);
      ensureNotAborted(options.signal);
      this.publishCycle(result.memory, validated, result.receipt);
      return result.receipt;
    });
  }

  /** Execute the original experiment SRC against this runtime's committed graph. */
  async choose(observation: PublicObservation, options: ChoiceOptions = {}): Promise<ChoiceReceipt> {
    return this.exclusive(async () => {
      const started = performance.now();
      ensureNotAborted(options.signal);
      if (!this.experiment) throw new Error('The compiled V7 experiment program was not loaded');
      if (this._choices.length >= this.limits.events) throw new RangeError('Declared choice budget exhausted');
      const current = this.validateEvent({ before: null, after: observation, action: null }).after;
      if (this.currentObservation === null || !equal(current, this.currentObservation)) {
        throw new TypeError('Experiment request does not bind the current committed observation');
      }
      const policyRef = options.policyRef ?? 'native_context_curiosity';
      const policies = objectValue(this.kernel.drm.experimental_policies, 'experimental policies');
      const policy = objectValue(ownValue(policies, stringValue(policyRef, 'policy reference')), 'experimental policy');
      const interfaces = objectValue(objectValue(this.kernel.drm.public_interface).actions, 'public input interface');
      const groundings = emptyArgumentBindings(current.actions, interfaces);
      const basis = this._memory.chain;
      const observationNode = await this.kernel.identity('observation', [['observation', current]]);
      const request = immutableJson({
        memory: this._memory, observation: current, observation_node: observationNode,
        bindings: groundings, policy, basis, availability: await this.activationInputs(this._memory),
      });
      const execution = await executeWorkflow(this.experiment, 'prototype.v7_experiment.choose',
        { request }, this.kernel.primitives, this.boundedOptions(options));
      ensureNotAborted(options.signal);
      const memory = this.resultMemory(execution.bindings);
      const candidates = this.kernel.select(memory, 'experiment').filter(node => node.basis === basis);
      const proposedOptions = this.kernel.select(memory, 'experiment_option').filter(node => node.basis === basis);
      if (candidates.length > 1) throw new Error('More than one SRC proposal for the same decision basis');
      const decision = candidates[0] ?? null;
      const sequence = this._choices.length + 1;
      const proposal: ProposalTicket | null = decision === null ? null : immutableJson({
        choiceSequence: sequence, sourceDigest: this.sourceDigest,
        graphChain: stringValue(memory.chain, 'proposal graph chain'),
        observationRef: current.id, decisionId: decision.id, decisionRevision: decision.revision,
      });
      const receipt: ChoiceReceipt = Object.freeze({
        sequence, srcStatus: 'completed', observationRef: current.id,
        currentObservation: current, basis, sourceDigest: this.sourceDigest,
        ...this.workflowProvenance('experiment'), policyRef, policyId: stringValue(policy.id, 'policy identity'),
        decision, options: immutableJson(proposedOptions), groundings,
        deltaCount: memory.deltas.length - this._memory.deltas.length,
        graphChain: memory.chain, executed: false, instructions: execution.instructions,
        durationMs: performance.now() - started, trace: frozenTrace(execution.trace), proposal,
      });
      this._memory = memory;
      this._lastTrace = receipt.trace;
      this._choices = Object.freeze([...this._choices, receipt]);
      return receipt;
    });
  }

  /** Validate a proposal against current source, graph, observation and availability. */
  async validateProposal(ticket: ProposalTicket): Promise<ProposalCommand> {
    return this.exclusive(() => this.checkProposal(ticket));
  }

  /** One-use handoff to the host. No game is dispatched, and evidence is not rewritten. */
  async consumeProposal(ticket: ProposalTicket): Promise<ProposalCommand> {
    return this.exclusive(async () => {
      const command = await this.checkProposal(ticket);
      this.consumedProposals.add(command.proposalId);
      return command;
    });
  }

  async setActivation(request: ActivationRequest, options: ExecutionOptions = {}): Promise<ActivationReceipt> {
    return this.exclusive(async () => {
      const started = performance.now();
      const frozenRequest = objectValue(immutableJson(request), 'activation request');
      if (Object.keys(frozenRequest).some(key => !['disabledKinds', 'disabledNodes', 'reason'].includes(key))) throw new TypeError('Unknown activation field');
      const reason = stringValue(frozenRequest.reason, 'intervention reason');
      if (!reason.trim() || Array.from(reason).length > 240) throw new TypeError('An activation intervention needs a reason of 1..240 characters');
      const selectors = (name: string): readonly string[] => {
        const values = Object.hasOwn(frozenRequest, name) ? arrayValue(frozenRequest[name], name) : [];
        if (values.length > this.limits.nodes) throw new RangeError('Activation selector budget exceeded');
        return values.map(value => stringValue(value, name));
      };
      const disabledKinds = selectors('disabledKinds'), disabledNodes = selectors('disabledNodes');
      const policyRef = await this.kernel.identity('activation', []);
      const kinds = objectValue(this.kernel.logos.kinds);
      if (disabledKinds.some(kind => kind === 'activation' || !Object.hasOwn(kinds, kind))) throw new TypeError('Unknown or protected node kind');
      if (disabledNodes.some(id => id === policyRef || !Object.hasOwn(this._memory.nodes, id))) throw new TypeError('Unknown or protected node identity');
      if (this._activationReceipts.length >= this.limits.events) throw new RangeError('Declared intervention budget exhausted');
      if (this.currentObservation !== null && this._sequence >= this.limits.events) throw new RangeError('No remaining cycle for reconsideration; policy was not changed');
      const defaultSelection = objectValue(objectValue(this.kernel.drm.availability).default);
      const configuration = immutableJson({
        disabled_kinds: [...new Set(disabledKinds)].sort(compareUnicode),
        disabled_nodes: [...new Set(disabledNodes)].sort(compareUnicode),
        actor: ownValue(defaultSelection, 'actor'), reason,
      });
      const beforeChain = this._memory.chain;
      const execution = await executeWorkflow(this.activation, 'prototype.v7_activation.configure',
        { request: { memory: this._memory, configuration } }, this.kernel.primitives, this.boundedOptions(options));
      let nextMemory = this.resultMemory(execution.bindings);
      const configuredChain = nextMemory.chain;
      const trace = frozenTrace(execution.trace);
      let reconsideration: CycleReceipt | undefined;
      let reconsideredEvent: ObservationEvent | undefined;
      if (this.currentObservation !== null) {
        reconsideredEvent = this.validateEvent({ before: null, after: this.currentObservation, action: null });
        const cycle = await this.runCycle(nextMemory, reconsideredEvent, this._sequence + 1, options);
        nextMemory = cycle.memory;
        reconsideration = cycle.receipt;
      }
      ensureNotAborted(options.signal);
      const receipt: ActivationReceipt = Object.freeze({
        sequence: this._activationReceipts.length + 1, activationRef: policyRef,
        revision: nextMemory.nodes[policyRef]!.revision, sourceDigest: this.sourceDigest,
        ...this.workflowProvenance('activation'), beforeChain, configuredChain,
        graphChain: nextMemory.chain, configuration, executed: false,
        instructions: execution.instructions, trace,
        durationMs: performance.now() - started,
        ...(reconsideration ? { reconsideration } : {}),
      });
      this._memory = nextMemory;
      this._lastTrace = trace;
      if (reconsideration && reconsideredEvent) this.publishCycle(nextMemory, reconsideredEvent, reconsideration);
      this._activationReceipts = Object.freeze([...this._activationReceipts, receipt]);
      return receipt;
    });
  }

  async availability(): Promise<JsonObject> {
    return this.exclusive(async () => {
      const inputs = await this.activationInputs(this._memory);
      const selection = objectValue(inputs.selection), dependencies = objectValue(inputs.dependency_fields);
      return immutableJson({
        graph_chain: this._memory.chain, source_digest: this.sourceDigest, configuration: selection,
        nodes: Object.keys(this._memory.nodes).sort(compareUnicode).map(id => this._memory.nodes[id]!).map(node => ({
          id: node.id, kind: node.kind, status: node.status,
          blockers: blockers(this._memory, node.id, selection, dependencies),
        })),
      });
    });
  }

  private boundedOptions(options: ExecutionOptions): ExecutionOptions {
    const maximum = options.maxInstructions ?? this.limits.src_instructions;
    if (!Number.isSafeInteger(maximum) || maximum < 1) throw new RangeError('Invalid instruction budget');
    const collection = options.maxCollectionItems ?? 1024;
    if (!Number.isSafeInteger(collection) || collection < 1) throw new RangeError('Invalid collection budget');
    return { ...options, maxInstructions: Math.min(maximum, this.limits.src_instructions), maxCollectionItems: Math.min(collection, 1024) };
  }

  private workflowProvenance(program: 'generators' | 'activation' | 'experiment'): Pick<CycleReceipt, 'workflowHash' | 'workflowHashKind'> {
    const supplied = this.workflowHashes?.[program];
    const module = this[program];
    if (!module) throw new Error(`Compiled program is not loaded: ${program}`);
    return supplied ? { workflowHash: supplied, workflowHashKind: 'python-transitive-source' }
      : { workflowHash: module.semantic_hash, workflowHashKind: 'compiler-semantic' };
  }

  private async checkProposal(input: ProposalTicket): Promise<ProposalCommand> {
    const ticket = objectValue(immutableJson(input), 'proposal ticket');
    exactKeys(ticket, ['choiceSequence', 'sourceDigest', 'graphChain', 'observationRef', 'decisionId', 'decisionRevision'], 'proposal ticket');
    const choice = this.lastChoice;
    if (choice === null || choice.decision === null || choice.proposal === null) throw new Error('There is no current SRC proposal');
    if (!equal(ticket, choice.proposal)) throw new Error('Proposal ticket does not match the current source-bound decision');
    if (this.consumedProposals.has(choice.decision.id)) throw new Error('Proposal was already consumed');
    if (ticket.sourceDigest !== this.sourceDigest || ticket.graphChain !== this._memory.chain) throw new Error('Proposal source or graph basis is stale');
    if (this.currentObservation === null || ticket.observationRef !== this.currentObservation.id
      || !equal(choice.currentObservation, this.currentObservation)) throw new Error('Proposal observation is stale');
    const decision = this._memory.nodes[choice.decision.id];
    if (!decision || !equal(decision, choice.decision) || decision.status !== 'proposed' || decision.executed !== false) {
      throw new Error('The retained proposal changed or is no longer proposed');
    }
    const availability = await this.activationInputs(this._memory);
    if (blockers(this._memory, decision.id, objectValue(availability.selection), objectValue(availability.dependency_fields)).length) {
      throw new Error('The proposal or a declared dependency is unavailable');
    }
    const actionRef = stringValue(decision.action, 'proposed action');
    if (!this.currentObservation.actions.includes(actionRef)) throw new Error('Proposed action is absent from the current public vocabulary');
    const interfaces = objectValue(objectValue(this.kernel.drm.public_interface).actions);
    const bindings = emptyArgumentBindings(this.currentObservation.actions, interfaces);
    const binding = objectValue(ownValue(bindings, actionRef));
    if (binding.grounded !== true || !equal(decision.command, binding.command)) throw new Error('Proposal grounding differs from the declared public interface');
    const command = objectValue(binding.command, 'grounded command');
    return immutableJson({
      actionRef: stringValue(command.action_ref), data: objectValue(command.data),
      proposalId: decision.id, observationRef: this.currentObservation.id,
      sourceDigest: this.sourceDigest, graphChain: stringValue(this._memory.chain),
      choiceSequence: choice.sequence, executed: false,
    });
  }

  private async activationInputs(memory: KnowledgeMemory): Promise<JsonObject> {
    const identity = await this.kernel.identity('activation', []);
    const availability = objectValue(this.kernel.drm.availability);
    const policy = memory.nodes[identity];
    return immutableJson({ selection: policy ? ownValue(policy, 'configuration') : ownValue(availability, 'default'), dependency_fields: ownValue(availability, 'dependency_fields') });
  }

  private resultMemory(bindings: JsonObject): KnowledgeMemory {
    return memoryValue(ownValue(bindings, 'memory'));
  }

  private async runCycle(memory: KnowledgeMemory, event: ObservationEvent, sequence: number, options: ExecutionOptions): Promise<{ memory: KnowledgeMemory; receipt: CycleReceipt }> {
    const started = performance.now();
    ensureNotAborted(options.signal);
    const inputDigest = await digest(event);
    const request = immutableJson({ ...event, has_transition: event.before !== null, interactions: event.after.actions, memory, availability: await this.activationInputs(memory) });
    const result = await executeWorkflow(this.generators, 'prototype.v7.cycle',
      { request, interactions: event.after.actions }, this.kernel.primitives, this.boundedOptions(options));
    ensureNotAborted(options.signal);
    const nextMemory = this.resultMemory(result.bindings);
    const receipt: CycleReceipt = Object.freeze({
      sequence, srcStatus: 'completed', sourceDigest: this.sourceDigest,
      ...this.workflowProvenance('generators'), inputDigest,
      deltaCount: nextMemory.deltas.length - memory.deltas.length,
      graphChain: nextMemory.chain, instructions: result.instructions,
      durationMs: performance.now() - started, trace: frozenTrace(result.trace),
    });
    return { memory: nextMemory, receipt };
  }

  private publishCycle(memory: KnowledgeMemory, event: ObservationEvent, receipt: CycleReceipt): void {
    this._memory = memory;
    this._sequence = receipt.sequence;
    this._lastTrace = receipt.trace;
    this._receipts = Object.freeze([...this._receipts, receipt]);
    for (const observation of [event.before, event.after]) if (observation) this.observations.set(observation.id, observation);
    this._currentObservation = event.after;
  }

  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.busy) throw new Error('Runtime busy: operations are admitted only between cycles');
    this.busy = true;
    try {
      return await operation();
    } catch (error) {
      if (error instanceof SrcExecutionError) this._lastTrace = frozenTrace(error.trace);
      throw error;
    } finally {
      this.busy = false;
    }
  }
}
