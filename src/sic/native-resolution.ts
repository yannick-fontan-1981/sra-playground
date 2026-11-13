import { cropReturn } from '../logos-engine/v6-public-return-visuals.ts';
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
}

export interface NativeResolution {
  readonly family: string | null;
  readonly proposalKind: string | null;
  readonly question: string | null;
  readonly objective: string | null;
  readonly objectiveSource: 'native' | 'question' | 'unpublished' | null;
  readonly operation: string | null;
  readonly composition: string | null;
  readonly compositions: readonly { readonly id: string; readonly role: string | null; readonly observed: boolean | null }[];
  readonly subjects: readonly { readonly label: string; readonly box: NativeBox }[];
  readonly route: readonly NativePoint[];
  readonly proposalRef: string | null;
  readonly remainingSteps: number;
  readonly footprint: NativeBox | null;
  readonly context: NativePlanContext | null;
  readonly guard: string | null;
  readonly pending: boolean;
  readonly steps: readonly NativeStep[];
  readonly nextIndex: number | null;
  readonly outcome: { readonly family: string; readonly matched: boolean | null; readonly reason: string | null } | null;
  readonly history: readonly { readonly sequence: number; readonly level: number; readonly family: string;
    readonly matched: boolean | null; readonly reason: string | null }[];
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const label = (value: unknown) => typeof value === 'string' && value.length <= 320 ? value : null;
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
  const expected = record(value);
  if (!expected) return null;
  if (Array.isArray(expected.position) && expected.position.length === 2 && expected.position.every(Number.isSafeInteger)) {
    return `Position (${expected.position.join(', ')})`;
  }
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
  const objectiveSource = nativeObjective ? 'native' : steps.length && question ? 'question' : steps.length ? 'unpublished' : null;
  const morphology = record(proposal?.morphology_plan);
  const entry = record(morphology?.entry_model);
  const facts = record(record(proposal?.morphology)?.measured_facts);
  const orientation = facts?.orientation_relation;
  const quarterTurns = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 4 ? value : null;
  const entryActions = Array.isArray(entry?.evidence) ? entry.evidence.slice(0, 16).flatMap(ref => {
    const prefix = `${scope}${agent.level}:revision:`;
    if (typeof ref !== 'string' || !ref.startsWith(prefix) || ref === activeRef || ref === entry?.observation_ref) return [];
    const match = /^(\d+):frame:/.exec(ref.slice(prefix.length));
    const sequence = match ? Number(match[1]) - 1 : 0;
    return sequence > 0 && sequence <= agent.sequence ? [sequence] : [];
  }) : [];
  const context: NativePlanContext | null = morphology ? {
    obligation: label(morphology.obligation),
    access: label(morphology.access_phase),
    effect: label(morphology.physical_effect ?? morphology.route_key),
    orientation: orientation === 'aligned' || orientation === 'different' || orientation === 'ambiguous' ? orientation : null,
    residual: quarterTurns(entry?.residual),
    entryDelta: quarterTurns(entry?.entry_delta),
    entryStatus: label(entry?.status),
    entryActions: [...new Set(entryActions)],
  } : null;
  const pair = record(morphology?.pair);
  const subjects: NativeResolution['subjects'][number][] = [];
  const bounds = (value: unknown): NativeBox | null => Array.isArray(value) && value.length === 4
    && value.every(Number.isSafeInteger) ? [value[0], value[1], value[2], value[3]] : null;
  if (Array.isArray(pair?.sites)) for (const [index, site] of pair.sites.slice(0, 2).entries()) {
    const box = bounds(site);
    if (box) subjects.push({ label: `Pattern compared by the engine ${index + 1}`, box });
  }
  const measuredStep = Array.isArray(morphology?.steps) ? record(morphology.steps[Number(guard?.index ?? 0)]) : null;
  const point = measuredStep?.from;
  const size = morphology?.size;
  let footprint: NativeBox | null = null;
  if (Array.isArray(point) && Array.isArray(size) && point.length === 2 && size.length === 2
      && [...point, ...size].every(Number.isSafeInteger) && size.every(n => n > 0)) {
    footprint = [point[0], point[1], point[0] + size[0] - 1, point[1] + size[1] - 1];
    subjects.push({ label: 'Controlled footprint before the step', box: footprint });
  }
  const op = label(template?.operation_key);
  const route: NativePoint[] = [];
  const pointAt = (value: unknown): NativePoint | null => Array.isArray(value) && value.length === 2
    && value.every(Number.isSafeInteger) ? [value[0], value[1]] : null;
  const routeIndex = guard && Number.isSafeInteger(guard.index) ? Number(guard.index) : 0;
  if (Array.isArray(morphology?.steps)) {
    for (const [index, item] of morphology.steps.slice(routeIndex, routeIndex + 24).entries()) {
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
    composition: label(template?.composition_ref), compositions, subjects, route, proposalRef: label(proposal?.proposal_id),
    remainingSteps: Math.max(0, plan.length - routeIndex), footprint, context,
    guard: label(guard?.reason),
    nextIndex: pending && guard && Number.isSafeInteger(guard.index) ? Number(guard.index) : null, steps,
    history, outcome: outcomeFamily && (result?.matched === null || typeof result?.matched === 'boolean')
      ? { family: outcomeFamily, matched: result.matched, reason: label(result.reason) } : null };
}
export interface DecisionSprites {
  readonly family: string | null;
  readonly objective: NativeResolution['objective'];
  readonly objectiveSource: NativeResolution['objectiveSource'];
  readonly operation: string | null;
  readonly composition: string | null;
  readonly question: string | null;
  readonly proposalRef: string | null;
  readonly route: readonly NativePoint[];
  readonly steps: readonly NativeStep[];
  readonly remainingSteps: number;
  readonly stepIndex?: number | null;
  readonly context?: NativePlanContext | null;
  readonly destinationSprite?: NativeRows;
  readonly sprites: readonly { readonly label: string; readonly before: NativeRows; readonly after: NativeRows | null }[];
}

export function captureDecisionSprites(decision: NativeResolution, before: NativeRows, after: NativeRows | null): DecisionSprites {
  const sprites = decision.subjects.flatMap(({ label: name, box }) => {
    const [x, y, right, bottom] = box;
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
  return { family: decision.family, objective: decision.objective, objectiveSource: decision.objectiveSource,
    operation: decision.operation, composition: decision.composition, question: decision.question,
    proposalRef: decision.proposalRef, route: decision.route, steps: decision.steps.slice(decision.nextIndex ?? 0),
    remainingSteps: decision.remainingSteps, stepIndex: decision.nextIndex, context: decision.context, destinationSprite, sprites };
}
