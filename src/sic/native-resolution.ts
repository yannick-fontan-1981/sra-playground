import { cropReturn } from '../logos-engine/v6-public-return-visuals.ts';
import { contactRecoveryStrategies, isContactStrategy, isRecoveryStop, rootedRecoveryStrategy,
  type ContactRecoveryNeed, type ContactStrategy } from './active-recovery.ts';
import type { AgendaEntry } from './strategy-agenda.ts';
import { frontierStrategies, isFrontierStrategy, type FrontierStrategy } from './frontier-strategy.ts';
import { isViewStrategy, viewStrategies, type ViewStrategy } from './view-strategy.ts';
import { isFrontierInputOrder, type FrontierChoiceEvidence, type FrontierInputOrder, type FrontierLocalRule } from './frontier-configuration.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export interface NativeStep {
  readonly action: string;
  readonly expected: string | null;
}

export interface NativePlanContext {
  readonly obligation: string | null;
  readonly access: string | null;
  readonly effect: string | null;
  readonly orientation: 'aligned' | 'different' | 'ambiguous' | null;
  readonly residual: number | null;
  readonly entryDelta: number | null;
  readonly entryStatus: string | null;
  readonly entryActions: readonly number[];
  readonly strategy?: NativeStrategyContext;
}

type MeterStrip = readonly [axis: 'x' | 'y', line: number, color: number, anchor: 'lo' | 'hi', edge: number];

interface NativeStrategyContext {
  readonly route: string | null;
  readonly pairRef: string | null;
  readonly color: 'equal' | 'different' | null;
  readonly colors: readonly [number, number] | null;
  readonly capacityNeeded: boolean;
  readonly directCost: number | null;
  readonly totalCost: number | null;
  readonly plannedCharges: number;
  readonly colorWitness: number | null;
  readonly patternWitness: number | null;
  readonly meter: { readonly strip: MeterStrip | null; readonly steps: number; readonly units: number;
    readonly rate: number; readonly capacity: number | null } | null;
}

export interface NativeResolution {
  readonly family: string | null;
  readonly proposalKind: string | null;
  readonly question: string | null;
  readonly objective: string | null;
  readonly objectiveSource: 'native' | 'question' | 'unpublished' | null;
  readonly operation: string | null;
  readonly searchOperation?: string;
  readonly recoveryOperations?: readonly { key: string; finding: string }[];
  readonly recoveryDecision?: { readonly strategy: string; readonly need: string; readonly objective: SicObjective | null; readonly maxDepth: number;
    readonly maxNodes: number; readonly packDigest: string | null; readonly agenda?: readonly AgendaEntry<ContactStrategy>[];
    readonly situationAction?: number; readonly agendaEvidence?: Readonly<Partial<Record<ContactStrategy, readonly number[]>>> };
  readonly recoveryAction?: number;
  readonly composition: string | null;
  readonly compositions: readonly { readonly id: string; readonly role: string | null; readonly observed: boolean | null }[];
  readonly subjects: readonly { readonly label: string; readonly box: NativeBox }[];
  readonly route: readonly NativePoint[];
  readonly proposalRef: string | null;
  readonly planRevision?: number;
  readonly releasedPlan?: { readonly family: string; readonly planned: number; readonly objective: string | null };
  readonly frontierStrategy?: { readonly title: string; readonly objective: SicObjective; readonly inputOrder: FrontierInputOrder | null;
    readonly choices?: Readonly<Record<FrontierInputOrder, string>>; readonly agenda: readonly AgendaEntry<FrontierStrategy>[];
    readonly viewContinuity?: true;
    readonly ruleEvidence?: FrontierChoiceEvidence;
    readonly localRule?: { readonly title: string; readonly matched: boolean; readonly mode: FrontierLocalRule['mode']; readonly reason: string } };
  readonly viewStrategy?: { readonly title: string; readonly objective: SicObjective; readonly agenda: readonly AgendaEntry<ViewStrategy>[];
    readonly expectedPixels: number | null; readonly agendaEvidence: Readonly<Partial<Record<ViewStrategy, readonly number[]>>> };
  readonly remainingSteps: number;
  readonly footprint: NativeBox | null;
  readonly context: NativePlanContext | null;
  readonly guard: string | null;
  readonly pending: boolean;
  readonly steps: readonly NativeStep[];
  readonly nextIndex: number | null;
  readonly outcome: { readonly family: string; readonly matched: boolean | null; readonly reason: string | null;
    readonly frontierOutcome?: { readonly objective: string; readonly status: 'observed' | 'access_interrupted' };
    readonly viewOutcome?: { readonly objective: string; readonly status: 'expanded' | 'no_new_area' | 'unregistered'; readonly newPixels: number | null };
    readonly recoveryNeed?: { readonly id: string; readonly status: ContactRecoveryNeed['status'] } } | null;
  readonly history: readonly { readonly sequence: number; readonly level: number; readonly family: string;
    readonly matched: boolean | null; readonly reason: string | null }[];
}

export interface SicObjective {
  readonly id: string;
  readonly label: string;
  readonly parent: string;
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const label = (value: unknown) => typeof value === 'string' && value.length <= 320 ? value : null;
const natural = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

function readAgenda<Id extends string>(value: unknown, accepts: (id: unknown) => id is Id): AgendaEntry<Id>[] {
  return Array.isArray(value) ? value.slice(0, 16).flatMap(item => {
    const entry = record(item), reason = label(entry?.reason), applicability = entry?.applicability, result = entry?.result;
    if (!accepts(entry?.id) || !reason
      || (applicability !== 'applicable' && applicability !== 'inapplicable' && applicability !== 'undetermined')
      || (result !== 'selected' && result !== 'no_plan' && result !== 'lower_priority' && result !== 'skipped' && result !== 'shadow')) return [];
    const evidence = Array.isArray(entry.evidence) ? entry.evidence.slice(0, 16).filter((ref): ref is string => typeof ref === 'string') : [];
    return [{ id: entry.id, applicability, result, reason, evidence }];
  }) : [];
}

export function readRecoveryRefusal(agent: { sessionId: string | null; sequence: number; level: number; trace: readonly unknown[] }) {
  if (!agent.sessionId) return null;
  const scope = `${agent.sessionId}:epoch:${agent.level}:revision:${agent.sequence + 1}:frame:`;
  const refusal = agent.trace.slice(-128).reverse().map(record).find(event =>
    event?.kind === 'sic_recovery_refusal' && typeof event.observation_ref === 'string' && event.observation_ref.startsWith(scope));
  if (!isRecoveryStop(refusal?.reason)) return null;
  const agenda = readAgenda(record(refusal?.decision)?.agenda, isContactStrategy);
  return agenda.length ? { reason: refusal.reason, agenda } : null;
}

export function readFrontierRefusal(agent: Parameters<typeof readRecoveryRefusal>[0]) {
  if (!agent.sessionId) return [];
  const scope = `${agent.sessionId}:epoch:${agent.level}:revision:${agent.sequence + 1}:frame:`;
  const refusal = agent.trace.slice(-128).reverse().map(record).find(event =>
    event?.kind === 'sic_frontier_refusal' && typeof event.observation_ref === 'string' && event.observation_ref.startsWith(scope));
  return readAgenda(record(refusal?.decision)?.agenda, isFrontierStrategy);
}

const actions: Record<string, string> = { ACTION1: 'Up', ACTION2: 'Down', ACTION3: 'Left', ACTION4: 'Right',
  ACTION5: 'Space', ACTION6: 'Click', ACTION7: 'Action 7' };

function actionName(value: unknown): string | null {
  const action = record(value);
  const name = actions[label(action?.action_ref) ?? ''];
  if (!name) return null;
  const point = record(action?.data);
  return name === 'Click' && Number.isSafeInteger(point?.x) && Number.isSafeInteger(point?.y)
    ? `Click (${point!.x}, ${point!.y})` : name;
}

function expectedText(value: unknown): string | null {
  if (typeof value === 'string' && value.length) return 'Compare the returned board with the forecast';
  const expected = record(value);
  if (!expected) return null;
  const position = expected.position ?? expected.body_position;
  if (Array.isArray(position) && position.length === 2 && position.every(Number.isSafeInteger)) {
    return `Position (${position.join(', ')})`;
  }
  if (Object.values(expected).includes('unknown')) return null;
  return 'Check predicted effect';
}

/** Read the public snapshot only. Never propose, admit or execute an action. */
export function readNativeResolution(agent: {
  readonly sessionId: string | null; readonly sequence: number; readonly level: number;
  readonly trace: readonly unknown[]; readonly lastDecision: string | null; readonly proposal: unknown;
  readonly phase: string | null;
}): NativeResolution | null {
  if (!agent.sessionId) return null;
  const entries = agent.trace.slice(-128).map(record);
  const reverse = [...entries].reverse();
  const currentRef = `${agent.sessionId}:epoch:${agent.level}:revision:${agent.sequence + 1}:frame:`;
  const result = reverse.find(event => event?.kind === 'actual_outcome'
    && typeof event.observation_ref === 'string' && event.observation_ref.startsWith(currentRef));
  const scope = `${agent.sessionId}:epoch:`;
  const history: NativeResolution['history'] = entries.flatMap(event => {
    const ref = event?.observation_ref;
    const family = label(event?.family);
    if (event?.kind !== 'actual_outcome' || !family || typeof ref !== 'string' || !ref.startsWith(scope)
        || (event.matched !== null && typeof event.matched !== 'boolean')) return [];
    const match = /^(\d+):revision:(\d+):frame:/.exec(ref.slice(scope.length));
    if (!match) return [];
    const sequence = Number(match[2]) - 1, level = Number(match[1]);
    return sequence > 0 && sequence <= agent.sequence ? [{ sequence, level, family, matched: event.matched, reason: label(event.reason) }] : [];
  }).slice(-12);
  const family = label(agent.lastDecision);
  const pending = agent.phase === 'authorised_not_executed';
  const active = record(agent.proposal);
  const binding = record(active?.binding);
  const activeRef = binding?.observation_ref;
  const scoped = typeof activeRef !== 'string' || activeRef.startsWith(scope + agent.level + ':');
  const proposal = active && scoped ? active : null;
  const proposalAt = entries.map(event => event?.kind === 'proposal' && event.family === family).lastIndexOf(true);
  const guard = proposal && proposalAt >= 0 ? entries.slice(proposalAt + 1).reverse().find(event =>
    event?.kind === 'before_guard' && event.family === family && event.admitted === true) : null;
  const release = pending && guard ? entries.slice(proposalAt + 1).reverse().find(event =>
    event?.kind === 'why_act_release' && event.admitted === true) : null;
  const planReceipt = pending && proposalAt >= 0 && proposal ? entries.slice(proposalAt + 1).find(event =>
    event?.kind === 'sic_native_plan' && event.family === family
    && typeof event.observationRef === 'string' && event.observationRef.startsWith(`${scope}${agent.level}:`))
    : result?.sic_plan ? entries.find(event => event?.kind === 'sic_native_plan' && event.id === result.sic_plan) : null;
  const receiptFamily = label(planReceipt?.family), receiptSize = natural(planReceipt?.planned);
  const releasedPlan = receiptFamily && receiptSize ? { family: receiptFamily, planned: receiptSize, objective: label(planReceipt?.objective) } : undefined;
  const traced = proposalAt >= 0 && result && proposalAt < entries.indexOf(result) && result.family === family
    ? entries[proposalAt] : null;
  const stepList = Array.isArray(proposal?.steps) ? proposal.steps : [];
  const plan = Array.isArray(proposal?.actions) ? proposal.actions
    : Array.isArray(traced?.actions) ? traced.actions : [];
  const steps = plan.slice(0, 24).flatMap((action, index) => {
    const name = actionName(action);
    return name ? [{ action: name, expected: expectedText(record(stepList[index])?.expected_after) }] : [];
  });
  const outcomeFamily = label(result?.family);
  if (!family && !outcomeFamily) return null;
  const template = record(proposal?.bundle_template);
  const question = label(record(proposal?.question ?? traced?.question)?.reason) ?? label(template?.purpose);
  const nativeObjective = label(template?.objective_ref);
  const frontier = record(proposal?.sic_frontier_decision), frontierTarget = record(frontier?.objective);
  const frontierId = frontier?.strategy, frontierObjectiveId = label(frontierTarget?.id), frontierObjectiveLabel = label(frontierTarget?.label);
  const frontierChoices = record(frontier?.choices);
  const leastTried = actionName(frontierChoices?.least_tried), commandOrder = actionName(frontierChoices?.command_order);
  const frontierEvidence = record(frontier?.ruleEvidence), candidateRefs = record(frontierEvidence?.candidateRefs);
  const leastRef = label(candidateRefs?.least_tried), stableRef = label(candidateRefs?.command_order);
  const usageGap = natural(frontierEvidence?.usageGap);
  const rule = record(frontier?.localRule), ruleName = label(rule?.title), ruleReason = label(rule?.reason), ruleMode = rule?.mode;
  const baseOrder = frontier?.inputRanked === true && isFrontierInputOrder(frontier.inputOrder) ? frontier.inputOrder : null;
  const frontierStrategy: NativeResolution['frontierStrategy'] = nativeObjective && frontierObjectiveId && frontierObjectiveLabel && frontierTarget?.parent === nativeObjective
    && isFrontierStrategy(frontierId)
    ? { title: frontierStrategies[frontierId], objective: { id: frontierObjectiveId, label: frontierObjectiveLabel, parent: nativeObjective },
      inputOrder: baseOrder && isFrontierInputOrder(frontier?.effectiveOrder) ? frontier.effectiveOrder : baseOrder,
      agenda: readAgenda(frontier?.agenda, isFrontierStrategy),
      ...(frontier?.purpose === 'view_continuity' ? { viewContinuity: true as const } : {}),
      ...(leastRef && stableRef && usageGap !== null ? { ruleEvidence: { candidateRefs: { least_tried: leastRef, command_order: stableRef }, usageGap } } : {}),
      ...(ruleName && ruleReason && typeof rule?.matched === 'boolean' && (ruleMode === 'active' || ruleMode === 'shadow')
        ? { localRule: { title: ruleName, reason: ruleReason, mode: ruleMode, matched: rule.matched } } : {}),
      ...(leastTried && commandOrder ? { choices: { least_tried: leastTried, command_order: commandOrder } } : {}) }
    : undefined;
  const objectiveSource = nativeObjective ? 'native' : steps.length && question ? 'question' : steps.length ? 'unpublished' : null;
  const viewDecision = record(proposal?.sic_view_decision), viewTarget = record(viewDecision?.objective);
  const viewObjective = label(viewTarget?.id), viewKind = viewDecision?.strategy;
  const morphology = record(proposal?.morphology_plan);
  const entry = record(morphology?.entry_model);
  const facts = record(record(proposal?.morphology)?.measured_facts);
  const orientation = facts?.orientation_relation;
  const quarterTurns = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 4 ? value : null;
  const priorAction = (ref: unknown): number | null => {
    const prefix = `${scope}${agent.level}:revision:`;
    if (typeof ref !== 'string' || !ref.startsWith(prefix)) return null;
    const match = /^(\d+):frame:/.exec(ref.slice(prefix.length));
    const sequence = match ? Number(match[1]) - 1 : 0;
    return sequence > 0 && sequence <= agent.sequence ? sequence : null;
  };
  const entryActions = Array.isArray(entry?.evidence) ? entry.evidence.slice(0, 16).flatMap(ref => {
    const action = ref === activeRef || ref === entry?.observation_ref ? null : priorAction(ref);
    return action === null ? [] : [action];
  }) : [];
  const forecast = record(facts?.meter_forecast);
  const strip = forecast?.measured_strip;
  const meterStrip: MeterStrip | null = Array.isArray(strip) && strip.length === 5
    && (strip[0] === 'x' || strip[0] === 'y') && natural(strip[1]) !== null && natural(strip[2]) !== null
    && (strip[3] === 'lo' || strip[3] === 'hi') && natural(strip[4]) !== null
    ? [strip[0], strip[1], strip[2], strip[3], strip[4]] : null;
  const meterSteps = natural(forecast?.steps_before_empty), meterUnits = natural(forecast?.current_units), meterRate = natural(forecast?.loss_per_step);
  const color = facts?.color_relation;
  const colors = record(facts?.feature_residuals)?.observed_colors;
  const context: NativePlanContext | null = morphology ? {
    obligation: label(morphology.obligation),
    access: label(morphology.access_phase),
    effect: label(morphology.physical_effect ?? morphology.route_key),
    orientation: orientation === 'aligned' || orientation === 'different' || orientation === 'ambiguous' ? orientation : null,
    residual: quarterTurns(entry?.residual),
    entryDelta: quarterTurns(entry?.entry_delta),
    entryStatus: label(entry?.status),
    entryActions: [...new Set(entryActions)],
    strategy: {
      route: label(morphology.route_key),
      pairRef: label(facts?.pair_ref),
      color: color === 'equal' || color === 'different' ? color : null,
      colors: Array.isArray(colors) && colors.length === 2 && colors.every(value => natural(value) !== null)
        ? [colors[0], colors[1]] : null,
      capacityNeeded: facts?.capacity_needed === true,
      directCost: natural(facts?.direct_goal_cost_lower_bound),
      totalCost: natural(morphology.total_cost),
      plannedCharges: Array.isArray(morphology.charge_order) ? morphology.charge_order.length : 0,
      colorWitness: priorAction(record(facts?.feature_reaccess)?.effect_after),
      patternWitness: priorAction(facts?.single_pattern_change_observation_ref),
      meter: meterSteps !== null && meterUnits !== null && meterRate
        ? { strip: meterStrip, steps: meterSteps, units: meterUnits, rate: meterRate, capacity: natural(forecast?.capacity_steps) } : null,
    },
  } : null;
  const pair = record(morphology?.pair);
  const subjects: NativeResolution['subjects'][number][] = [];
  const bounds = (value: unknown): NativeBox | null => Array.isArray(value) && value.length === 4
    && value.every(Number.isSafeInteger) ? [value[0], value[1], value[2], value[3]] : null;
  if (Array.isArray(pair?.sites)) for (const [index, site] of pair.sites.slice(0, 2).entries()) {
    const box = bounds(site);
    if (box) subjects.push({ label: `Pattern compared by the engine ${index + 1}`, box });
  }
  const routeIndex = guard && Number.isSafeInteger(guard.index) ? Number(guard.index) : 0;
  const support = record(proposal?.support_plan);
  const bodyType = Array.isArray(support?.body_type) && support.body_type.length === 3 ? support.body_type : null;
  const positionSteps = Array.isArray(morphology?.steps) ? morphology.steps
    : stepList.map(item => {
      const step = record(item), earlier = record(step?.expected_before), later = record(step?.expected_after);
      return { from: step?.from ?? earlier?.body_position, to: step?.to ?? later?.body_position };
    });
  const measuredStep = record(positionSteps[routeIndex]);
  const point = measuredStep?.from;
  const size = morphology?.size ?? (bodyType ? [bodyType[2], bodyType[1]] : null);
  let footprint: NativeBox | null = null;
  if (Array.isArray(point) && Array.isArray(size) && point.length === 2 && size.length === 2
      && [...point, ...size].every(Number.isSafeInteger) && size.every(n => n > 0)) {
    footprint = [point[0], point[1], point[0] + size[0] - 1, point[1] + size[1] - 1];
    subjects.push({ label: 'Controlled footprint before the step', box: footprint });
  }
  const op = label(template?.operation_key);
  const rooted = record(proposal?.rooted_line_plan);
  const rootedScene = record(rooted?.scene);
  const searchOperation = label(record(rooted?.search)?.operation);
  const search = record(rooted?.search);
  const recoveryOperations = Array.isArray(search?.recovery_operations) ? search.recovery_operations.slice(0, 4).flatMap(value => {
    const element = record(value), key = label(element?.key), finding = label(element?.finding);
    return key && finding && ['OP03', 'OP12', 'OP08', 'OP26'].includes(key) ? [{ key, finding }] : [];
  }) : [];
  const recoveryAction = Array.isArray(search?.recovery_evidence) ? priorAction(search.recovery_evidence[1]) : null;
  const sic = record(search?.sic_decision), recoveryPack = record(sic?.configuration);
  const maxDepth = natural(recoveryPack?.maxDepth), maxNodes = natural(recoveryPack?.maxNodes);
  const target = record(sic?.objective), targetLabel = label(target?.label);
  const recoveryObjective = target?.id === rootedRecoveryStrategy.objective.id && targetLabel &&
    target.parent === nativeObjective && nativeObjective
    ? { id: rootedRecoveryStrategy.objective.id, label: targetLabel, parent: nativeObjective } : null;
  const agenda = readAgenda(sic?.agenda, isContactStrategy);
  const situation = record(sic?.situation);
  const situationAction = priorAction(situation?.revision) ?? undefined;
  const agendaEvidence = Object.fromEntries(agenda.map(entry => [entry.id,
    [...new Set((entry.evidence ?? []).flatMap(ref => priorAction(ref) ?? []))].sort((a, b) => a - b),
  ]));
  const viewAgenda = readAgenda(viewDecision?.agenda, isViewStrategy);
  const viewStrategy: NativeResolution['viewStrategy'] = viewDecision?.mode === 'active' && nativeObjective && viewObjective
    && viewTarget?.parent === nativeObjective && isViewStrategy(viewKind) ? {
      title: viewStrategies[viewKind], objective: { id: viewObjective, label: viewStrategies[viewKind], parent: nativeObjective },
      agenda: viewAgenda, expectedPixels: natural(record(record(proposal?.view_plan)?.details)?.conditional_new_viewport_pixels),
      agendaEvidence: Object.fromEntries(viewAgenda.map(entry => [entry.id,
        [...new Set((entry.evidence ?? []).flatMap(ref => priorAction(ref) ?? []))].sort((a, b) => a - b),
      ])),
    } : undefined;
  const recoveryDecision = isContactStrategy(sic?.strategy) && recoveryPack?.mode === 'active'
    && maxDepth !== null && maxNodes !== null
    ? { strategy: contactRecoveryStrategies[sic.strategy], need: rootedRecoveryStrategy.need, objective: recoveryObjective, agenda, situationAction, agendaEvidence,
      maxDepth, maxNodes, packDigest: typeof sic.packDigest === 'string' && /^[a-f0-9]{64}$/.test(sic.packDigest) ? sic.packDigest : null }
    : undefined;
  const returnedNeed = record(result?.sic_need);
  const viewReturn = reverse.find(event => event?.kind === 'sic_view_return' && typeof event.evidence === 'string' && event.evidence.startsWith(currentRef));
  const viewStatus = viewReturn?.status, viewReturnObjective = label(viewReturn?.objective);
  const viewOutcome = viewReturnObjective && (viewStatus === 'expanded' || viewStatus === 'no_new_area' || viewStatus === 'unregistered')
    ? { objective: viewReturnObjective, status: viewStatus, newPixels: natural(viewReturn?.newPixels) } as const : undefined;
  const frontierResult = record(result?.sic_frontier_outcome);
  const frontierOutcome: NonNullable<NativeResolution['outcome']>['frontierOutcome'] =
    typeof frontierResult?.objective === 'string' && /^Q_[a-f0-9]{20}$/.test(frontierResult.objective)
    && (frontierResult.status === 'observed' || frontierResult.status === 'access_interrupted')
    ? { objective: frontierResult.objective, status: frontierResult.status } : undefined;
  const needStatus = returnedNeed?.status;
  const recoveryNeed: NonNullable<NativeResolution['outcome']>['recoveryNeed'] =
    typeof returnedNeed?.id === 'string' && /^sic-need:[a-f0-9]{64}$/.test(returnedNeed.id)
    && (needStatus === 'assigned' || needStatus === 'satisfied' || needStatus === 'refuted' || needStatus === 'expired')
    ? { id: returnedNeed.id, status: needStatus } : undefined;
  const previousProjection = routeIndex > 0 && Array.isArray(rooted?.predictions) ? record(rooted.predictions[routeIndex - 1]) : null;
  const rootBox = bounds(previousProjection?.root ?? rootedScene?.root);
  if (rootBox) subjects.push({ label: 'Controlled root', box: rootBox });
  const previousPieces = new Map(Array.isArray(previousProjection?.pieces) ? previousProjection.pieces
    .filter(piece => Array.isArray(piece) && piece.length === 2).map(piece => [piece[0], piece[1]]) : []);
  if (Array.isArray(rootedScene?.pieces)) for (const piece of rootedScene.pieces.slice(0, 8)) {
    const material = record(piece), box = bounds(previousPieces.get(material?.id) ?? material?.bbox);
    if (box) subjects.push({ label: `Material ${label(material?.type) ?? ''}`.trim(), box });
  }
  const route: NativePoint[] = [];
  if (viewStrategy && routeIndex === 0 && Array.isArray(viewDecision?.subjects)) {
    for (const subject of viewDecision.subjects.slice(0, 8)) {
      const measured = record(subject), name = label(measured?.label), box = bounds(measured?.box);
      if (name && box) subjects.push({ label: name, box });
    }
  }
  const pointAt = (value: unknown): NativePoint | null => Array.isArray(value) && value.length === 2
    && value.every(Number.isSafeInteger) ? [value[0], value[1]] : null;
  const command = record(plan[routeIndex]), click = record(command?.data);
  if (command?.action_ref === 'ACTION6' && natural(click?.x) !== null && natural(click?.y) !== null) {
    const x = Number(click!.x), y = Number(click!.y);
    subjects.push({ label: 'Clicked area', box: [Math.max(0, x - 3), Math.max(0, y - 3), x + 3, y + 3] });
  }
  if (positionSteps.length) {
    for (const [index, item] of positionSteps.slice(routeIndex, routeIndex + 24).entries()) {
      const step = record(item), from = pointAt(step?.from), to = pointAt(step?.to);
      if (!from || !to || (index && (from[0] !== route.at(-1)?.[0] || from[1] !== route.at(-1)?.[1]))) break;
      if (!index) route.push(from);
      route.push(to);
    }
  }
  const compositions = Array.isArray(proposal?.compositions) ? proposal.compositions.slice(0, 6).flatMap(item => {
    const value = record(item);
    const id = label(value?.id);
    return id ? [{ id, role: label(value?.role), observed: typeof value?.observed === 'boolean' ? value.observed : null }] : [];
  }) : [];
  return { family, pending: pending && !!proposal,
    proposalKind: label(proposal?.kind), question,
    objective: nativeObjective ?? (objectiveSource === 'question' ? question : null), objectiveSource,
    operation: op && /^OP(?:0[1-9]|[12]\d|3[01])$/.test(op) ? op : null,
    searchOperation: searchOperation === 'OP26' ? searchOperation : undefined,
    recoveryOperations: recoveryOperations.length ? recoveryOperations : undefined,
    recoveryDecision,
    recoveryAction: recoveryAction ?? undefined,
    composition: label(template?.composition_ref), compositions, subjects, route, proposalRef: label(proposal?.proposal_id),
    planRevision: natural(release?.decision_revision) ?? undefined,
    releasedPlan,
    frontierStrategy,
    viewStrategy,
    remainingSteps: Math.max(0, plan.length - routeIndex), footprint, context,
    guard: label(guard?.reason),
    nextIndex: pending && guard && Number.isSafeInteger(guard.index) ? Number(guard.index) : null, steps,
    history, outcome: outcomeFamily && (result?.matched === null || typeof result?.matched === 'boolean')
      ? { family: outcomeFamily, matched: result.matched, reason: label(result.reason),
        ...(recoveryNeed ? { recoveryNeed } : {}), ...(frontierOutcome ? { frontierOutcome } : {}), ...(viewOutcome ? { viewOutcome } : {}) } : null };
}
export interface DecisionSprites {
  readonly family: string | null;
  readonly objective: NativeResolution['objective'];
  readonly objectiveSource: NativeResolution['objectiveSource'];
  readonly operation: string | null;
  readonly searchOperation?: string;
  readonly recoveryOperations?: readonly { key: string; finding: string }[];
  readonly recoveryDecision?: NativeResolution['recoveryDecision'];
  readonly frontierStrategy?: NativeResolution['frontierStrategy'];
  readonly viewStrategy?: NativeResolution['viewStrategy'];
  readonly recoveryAction?: number;
  readonly composition: string | null;
  readonly question: string | null;
  readonly proposalRef: string | null;
  readonly planRevision?: number;
  readonly route: readonly NativePoint[];
  readonly steps: readonly NativeStep[];
  readonly remainingSteps: number;
  readonly stepIndex?: number | null;
  readonly context?: NativePlanContext | null;
  readonly destinationSprite?: NativeRows;
  readonly strategyTarget?: { readonly before: NativeRows; readonly after: NativeRows | null };
  readonly strategyMeter?: { readonly before: NativeRows; readonly after: NativeRows | null;
    readonly unitsBefore: number; readonly unitsAfter: number | null };
  readonly sprites: readonly { readonly label: string; readonly before: NativeRows; readonly after: NativeRows | null }[];
}

function captureMeter(meter: NonNullable<NativeStrategyContext['meter']>, before: NativeRows, after: NativeRows | null,
  firstStep: boolean): DecisionSprites['strategyMeter'] {
  if (!meter.strip) return undefined;
  const [axis, line, color, anchor, edge] = meter.strip;
  const getLine = (rows: NativeRows) => axis === 'x' ? rows[line] : rows[0]?.[line] === undefined ? undefined : rows.map(row => row[line]!);
  const length = (rows: NativeRows): number | null => {
    const values = getLine(rows);
    if (!values || edge > values.length) return null;
    let start = anchor === 'lo' ? edge : edge - 1;
    const direction = anchor === 'lo' ? 1 : -1;
    let count = 0;
    while (values[start] === color) { count++; start += direction; }
    // A shifted anchor or another run is not the same strip measured by 0.68.
    if (values[anchor === 'lo' ? edge - 1 : edge] === color || values.filter(value => value === color).length !== count) return null;
    return count;
  };
  const unitsBefore = length(before);
  if (unitsBefore === null || (firstStep && unitsBefore !== meter.units)) return undefined;
  const unitsAfter = after ? length(after) : null;
  const extent = getLine(before)!.length;
  const width = Math.max(unitsBefore, unitsAfter ?? 0, (meter.capacity ?? 0) * meter.rate);
  const lo = anchor === 'lo' ? edge : Math.max(0, edge - width);
  const hi = anchor === 'lo' ? Math.min(extent, edge + width) : edge;
  if (hi <= lo) return undefined;
  // Keep both bar ends and the full strip so before/after can be compared.
  const other = Math.min(line + 1, (axis === 'x' ? before.length : before[0]!.length) - 1);
  const box: NativeBox = axis === 'x' ? [lo, line, hi - 1, other] : [line, lo, other, hi - 1];
  return { before: cropReturn(before, box, 1), after: after && unitsAfter !== null ? cropReturn(after, box, 1) : null, unitsBefore, unitsAfter };
}

export function captureDecisionSprites(decision: NativeResolution, before: NativeRows, after: NativeRows | null): DecisionSprites {
  const sprites = decision.subjects.flatMap(({ label: name, box: original }) => {
    const [x, y, r, b] = original;
    const right = name === 'Clicked area' ? Math.min(r, (before[0]?.length ?? 0) - 1) : r;
    const bottom = name === 'Clicked area' ? Math.min(b, before.length - 1) : b;
    const box: NativeBox = [x, y, right, bottom];
    if (x < 0 || y < 0 || x > right || y > bottom || right >= (before[0]?.length ?? 0) || bottom >= before.length) return [];
    const stride = Math.max(1, Math.ceil(Math.max(right - x + 1, bottom - y + 1) / 20));
    return [{ label: name, before: cropReturn(before, box, stride),
      after: after && right < (after[0]?.length ?? 0) && bottom < after.length ? cropReturn(after, box, stride) : null }];
  });
  const next = decision.route[1];
  const box = decision.footprint;
  const right = next && box ? next[0] + box[2] - box[0] : -1;
  const bottom = next && box ? next[1] + box[3] - box[1] : -1;
  const destinationSprite = after && next && box && next[0] >= 0 && next[1] >= 0
    && right < (after[0]?.length ?? 0) && bottom < after.length
    ? cropReturn(after, [next[0], next[1], right, bottom], Math.max(1, Math.ceil(Math.max(right - next[0] + 1, bottom - next[1] + 1) / 20)))
    : undefined;
  if (next && box && next[0] >= 0 && next[1] >= 0 && right < (before[0]?.length ?? 0) && bottom < before.length) {
    const stride = Math.max(1, Math.ceil(Math.max(right - next[0] + 1, bottom - next[1] + 1) / 20));
    sprites.push({ label: 'Predicted destination', before: cropReturn(before, [next[0], next[1], right, bottom], stride),
      after: destinationSprite ?? null });
  }
  const target = decision.route.at(-1), context = decision.context;
  const strategy = context?.strategy;
  const strategyMeter = strategy?.meter ? captureMeter(strategy.meter, before, after, decision.nextIndex === 0) : undefined;
  const targetRight = target && box ? target[0] + box[2] - box[0] : -1;
  const targetBottom = target && box ? target[1] + box[3] - box[1] : -1;
  let strategyTarget: DecisionSprites['strategyTarget'];
  if (strategy && target && target[0] >= 0 && target[1] >= 0 && targetRight >= target[0] && targetBottom >= target[1]
      && targetRight < (before[0]?.length ?? 0) && targetBottom < before.length) {
    const region: NativeBox = [target[0], target[1], targetRight, targetBottom];
    const stride = Math.max(1, Math.ceil(Math.max(targetRight - target[0] + 1, targetBottom - target[1] + 1) / 20));
    strategyTarget = { before: cropReturn(before, region, stride),
      after: after && targetRight < (after[0]?.length ?? 0) && targetBottom < after.length ? cropReturn(after, region, stride) : null };
  }
  return { family: decision.family, objective: decision.objective, objectiveSource: decision.objectiveSource,
    operation: decision.operation, searchOperation: decision.searchOperation, recoveryOperations: decision.recoveryOperations,
    recoveryDecision: decision.recoveryDecision,
    frontierStrategy: decision.frontierStrategy,
    viewStrategy: decision.viewStrategy,
    recoveryAction: decision.recoveryAction, composition: decision.composition, question: decision.question,
    proposalRef: decision.proposalRef, planRevision: decision.planRevision, route: decision.route, steps: decision.steps.slice(decision.nextIndex ?? 0),
    remainingSteps: decision.remainingSteps, stepIndex: decision.nextIndex, context, destinationSprite, strategyTarget, strategyMeter, sprites };
}
