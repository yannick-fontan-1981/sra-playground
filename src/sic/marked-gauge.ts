import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativeProgramHandle, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { chooseInteraction, interactionModule } from './observed-interaction-card.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';

export const markedGaugeId = 'sic_marked_gauge';
export const verifyGaugeEffectId = 'sic_verify_gauge_effect';
export const learnGaugeEffectId = 'sic_learn_gauge_effect';

type Part = ReturnType<typeof geometricComponents>[number];
type Axis = 0 | 1;
type Button = { box: NativeBox; point: NativePoint };
type Gauge = { color: number; axis: Axis; origin: NativeBox; goal: NativePoint; buttons: Button[] };
type Trial = { index: number; delta: number; evidence: string };
type Memory = { epoch: number; gauges: Gauge[]; trials: Trial[]; count: number };
type GaugeLeg = { beforeLength: number; expected: number | null };
type Proposal = NativeProposal & GaugeLeg & { memory: Memory; gauge: Gauge; index: number; button: Button; route?: GaugeLeg[]; needId: string };

const span = (box: NativeBox, axis: Axis) => box[axis + 2]! - box[axis]!;
const center = ([l, t, r, b]: NativeBox): NativePoint => [(l + r) / 2, (t + b) / 2];
const pixel = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];
const pointOn = (n: number, cross: number, axis: Axis): NativePoint => axis === 0 ? [n, cross] : [cross, n];

function isMarker(rows: NativeRows, [x, y]: NativePoint, background: number) {
  const arms = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const;
  const corners = [[x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1], [x + 1, y + 1]] as const;
  const ink = pixel(rows, arms[0]);
  return ink !== undefined && ink !== background && pixel(rows, [x, y]) === background
    && arms.every(p => pixel(rows, p) === ink) && corners.every(p => pixel(rows, p) === background);
}

function measure(rows: NativeRows): Gauge[] | null {
  const parts = geometricComponents(rows);
  const gauges: Gauge[] = [];
  for (const part of parts) {
    const axis: Axis = span(part.bbox, 0) > span(part.bbox, 1) ? 0 : 1;
    const cross = center(part.bbox)[1 - axis]!;
    const end = part.bbox[axis + 2]!;
    if (span(part.bbox, axis) < 4 || span(part.bbox, axis === 0 ? 1 : 0) !== 2
      || part.area !== 3 * (span(part.bbox, axis) + 1) - 1) continue;
    const background = pixel(rows, pointOn(end + 1, cross, axis));
    if (background === undefined || background === part.color) continue;
    const candidates: NativePoint[] = [];
    for (let pos = end + 2; pos < (axis === 0 ? rows[0]?.length ?? 0 : rows.length) - 1; pos++) {
      const target = pointOn(pos, cross, axis);
      if (isMarker(rows, target, background)) candidates.push(target);
    }
    if (candidates.length !== 1) continue;
    const controls = parts.filter(p => p.color === part.color && p.area === 7 && span(p.bbox, 0) === 2 && span(p.bbox, 1) === 2)
      .map(p => ({ box: p.bbox, point: center(p.bbox) }));
    if (controls.length !== 2 || controls[0]!.point[1 - axis] !== controls[1]!.point[1 - axis]) continue;
    controls.sort((a, b) => b.point[axis] - a.point[axis]);
    gauges.push({ color: part.color, axis, origin: part.bbox, goal: candidates[0]!, buttons: controls });
  }
  return gauges.length >= 2 && gauges.length <= 4 && new Set(gauges.map(g => g.color)).size === gauges.length ? gauges : null;
}

function lengthOf(rows: NativeRows, gauge: Gauge) {
  const { axis, origin, color, goal } = gauge;
  const cross = center(origin)[1 - axis]!;
  const stop = goal[axis];
  let end = origin[axis];
  while (end < stop && [-1, 1].every(offset => pixel(rows, pointOn(end, cross + offset, axis)) === color)) end++;
  return end - origin[axis];
}

function cap(gauge: Gauge) { return gauge.goal[gauge.axis] - gauge.origin[gauge.axis]; }

export function createSicVerifyGaugeEffect(family = verifyGaugeEffectId): NativeFamily<Proposal> {
  const learns = family === learnGaugeEffectId;
  let state: Memory | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseInteraction, {}, await interactionModule());
    },
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')
        || observation.available_action_refs.some(action => /^ACTION[1-5]$/.test(action))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const observed = learns && !prior ? await execution?.readPriorClickScene?.((first, _before, command) => {
        const gauges = measure(first);
        if (!gauges) return null;
        const changed = gauges.flatMap((gauge, i) => {
          const delta = lengthOf(rows, gauge) - lengthOf(first, gauge);
          return delta ? [{ gauge, i, delta }] : [];
        });
        if (changed.length !== 1) return null;
        const { gauge, i, delta } = changed[0]!, { x, y } = command.data;
        const button = gauge.buttons.findIndex(({ box: [l, t, r, b] }) => x! >= l && x! <= r && y! >= t && y! <= b);
        return button < 0 ? null : { gauges, index: i * 2 + button, delta };
      }) : null;
      if (learns && !prior && (!observed || observed.afterRef !== observation.observation_ref || observed.levelEpoch !== observation.level_epoch)) return null;
      const gauges = prior?.gauges ?? observed?.scene.gauges ?? measure(rows);
      if (!gauges || (prior?.count ?? 0) >= 40) return null;
      const memory: Memory = prior ?? { epoch: observation.level_epoch, gauges, count: Number(!!observed),
        trials: observed ? [{ index: observed.scene.index, delta: observed.scene.delta, evidence: observed.afterRef }] : [] };
      const gauge = gauges.find(g => lengthOf(rows, g) < cap(g));
      if (!gauge) return null;
      const beforeLength = lengthOf(rows, gauge);
      const indexOf = (b: Button) => gauges.indexOf(gauge) * 2 + gauge.buttons.indexOf(b);
      const previous = (b: Button) => memory.trials.find(t => t.index === indexOf(b));
      const button = gauge.buttons.find(b => (previous(b)?.delta ?? 0) > 0) ?? gauge.buttons.find(b => !previous(b));
      if (!button) return null;
      const old = previous(button), index = indexOf(button), ref = observation.observation_ref;
      const evidence: [string, ...string[]] = old && old.evidence !== ref ? [ref, old.evidence] : [ref];
      const mode = execution?.reasoningMode ?? 'exploration';
      const facts = { repeatSupportedInteraction: !!old, probeNeededInteraction: !old, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = old ? 'P02' : 'P05';
      if (decision?.result !== strategy) return null;
      const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, button.point, { reason: 'Button sharing the gauge marker color', evidence });
      if (!witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'set_visible_gauge_to_marked_target', scope: ref.split(':revision:', 1)[0]!,
        subjects: [gauge.goal.join(',')], parentObjective: parent, satisfactionContract: 'gauge_reaches_visible_mark' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = family + ':' + need.id;
      const action = { action_ref: 'ACTION6', data: { x: button.point[0], y: button.point[1] } };
      const [x, y] = gauge.goal;
      const expected = old ? Math.min(cap(gauge), beforeLength + old.delta) : null;
      const route: GaugeLeg[] = [{ beforeLength, expected }];
      if (old && old.delta > 0 && expected !== null) {
        let length = expected;
        const limit = Math.min(remaining, maximumCommittedActions, 40 - memory.count);
        while (length < cap(gauge) && route.length < limit) {
          const next = Math.min(cap(gauge), length + old.delta);
          route.push({ beforeLength: length, expected: next });
          length = next;
        }
      }
      const actions = route.map(() => action);
      const situation = old ? 'Repeat the measured increase up to the target tick' : 'Compare the gauge length before and after pressing the matching button';
      const [left, top, right, bottom] = gauge.origin;
      const measured: NativeBox = gauge.axis === 0 ? [left, top, left + beforeLength - 1, bottom]
        : [left, top, right, top + beforeLength - 1];
      return {
        status: 'proposed', kind: family, memory, gauge, index, button, beforeLength, expected, needId: need.id,
        ...(route.length > 1 ? { route } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions,
        steps: route.map(step => ({ action, point_binding: witness, expected_after: step.expected })),
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Bring each gauge to its marked value', situation, evidence, agenda: [], mode,
          triggerCard: chooseInteraction, focus: button.box, gauge: measured, target: [x - 1, y - 1, x + 1, y + 1] },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, packet, observation) {
      const leg = proposal.route?.[index];
      const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : !!leg && proposal.memory.epoch === observation.level_epoch && lengthOf(packet.frame_rows, proposal.gauge) === leg.beforeLength;
      return { admitted, reason: admitted ? 'gauge_button_bound' : 'gauge_context_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { gauge, needId, memory } = proposal, { beforeLength, expected } = proposal.route?.[index] ?? proposal;
      const value = lengthOf(second, gauge);
      const alone = memory.gauges.every(other => other.color === gauge.color
        || lengthOf(second, other) === lengthOf(first, other));
      const matched = alone && (expected === null ? value > beforeLength : value === expected);
      return { matched, seal_prefix: !matched || index + 1 >= proposal.actions.length,
        reason: matched ? 'gauge_increase_confirmed' : 'predicted_gauge_increase_not_observed',
        ...(matched && value === cap(gauge) ? { sic_need: { id: needId, status: 'satisfied' as const } } : {}) };
    },
    record(before, after, _action, first, second, proposal, step) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const memory = (step > 0 && state?.epoch === before.level_epoch ? state : null) ?? proposal.memory;
      const { gauge, index } = proposal, { beforeLength } = proposal.route?.[step] ?? proposal;
      const alone = memory.gauges.every(other => other.color === gauge.color || lengthOf(second, other) === lengthOf(first, other));
      const delta = alone ? lengthOf(second, gauge) - beforeLength : 0;
      state = { ...memory, count: memory.count + 1,
        trials: [...memory.trials.filter(t => t.index !== index), { index, delta, evidence: after.observation_ref }] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as Memory | null); },
  };
}
