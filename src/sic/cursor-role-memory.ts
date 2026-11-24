import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeCommand, NativeEntity, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { unchangedOutside } from './plan-step.ts';

export const cursorRoleMemoryId = 'sic_cursor_role_memory';

type Effect = { action: string; locus?: NativePoint; delta: NativePoint; floor: string; evidence: [string, string] };
type Profile = { sprite: string; inputs: string; learned: number; observations: number; effects: Effect[] };
type Entry = { epoch: number; rejected: string[]; confirmed: boolean; active?: { sprite: string; position: NativePoint; ref: string } };
type Memory = { profiles: Profile[]; entry?: Entry };
type Match = { before: NativeEntity; after: NativeEntity; sprite: string; effect: Effect };
type Candidate = { from: NativePoint; to: NativePoint };
type RoleProposal = NativeProposal & { role: Profile; effect: Effect; candidates: Candidate[] };

const completion = 'G_official_completion';
const key = (point: NativePoint) => point.join(',');
const add = ([x, y]: NativePoint, [dx, dy]: NativePoint): NativePoint => [x + dx, y + dy];
const relative = ([x, y]: NativePoint, [u, v]: NativePoint): NativePoint => [x - u, y - v];
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const color = (observation: NativeObservation, ink: number) => observation.palette?.[ink] || String(ink);
const appearance = (observation: NativeObservation, entity: NativeEntity) => JSON.stringify([color(observation, entity.palette_value), entity.mask]);
const interfaceKey = (observation: NativeObservation) => [...observation.available_action_refs].sort().join(',');
const effectKey = (effect: Effect) => JSON.stringify([effect.action, effect.locus ?? null]);

function indexed(observation: NativeObservation, frameArea = Infinity) {
  const bySprite = new Map<string, NativeEntity[]>();
  for (const entity of observation.entities) {
    if (entity.area * 4 > frameArea) continue;
    const sprite = appearance(observation, entity);
    const family = bySprite.get(sprite);
    if (family) family.push(entity);
    else bySprite.set(sprite, [entity]);
  }
  return bySprite;
}

function entering(mask: readonly NativePoint[], from: NativePoint, to: NativePoint) {
  const occupied = new Set(mask.map(pixel => key(add(from, pixel))));
  return mask.map(pixel => add(to, pixel)).filter(pixel => !occupied.has(key(pixel)));
}

function measure(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows): Match | undefined {
  if (before.level_epoch !== after.level_epoch || before.levels_completed !== after.levels_completed
    || before.frame_hash === after.frame_hash || interfaceKey(before) !== interfaceKey(after)) return;
  const addressed = command.action_ref === 'ACTION6';
  if (addressed ? !Number.isInteger(command.data.x) || !Number.isInteger(command.data.y) || Object.keys(command.data).length !== 2
    : Object.keys(command.data).length !== 0) return;
  const frameArea = first.length * (first[0]?.length ?? 0), current = indexed(after, frameArea);
  let match: Match | undefined;
  for (const [sprite, origins] of indexed(before, frameArea)) {
    const destinations = current.get(sprite);
    if (destinations?.length !== origins.length) continue;
    const left = origins.filter(origin => !destinations.some(end => same(end.position, origin.position)));
    const arrived = destinations.filter(end => !origins.some(origin => same(end.position, origin.position)));
    if (left.length !== 1 || arrived.length !== 1) continue;
    const [origin] = left as [NativeEntity], [end] = arrived as [NativeEntity];
    if (!unchangedOutside(first, second, [origin.bbox, end.bbox])) continue;
    const floor = new Set(entering(origin.mask, origin.position, end.position).map(([x, y]) => {
      const value = first[y]?.[x];
      return value === undefined ? undefined : color(before, value);
    }));
    const [substrate] = floor;
    if (floor.size !== 1 || substrate === undefined || match) return;
    const delta = relative(end.position, origin.position);
    match = { before: origin, after: end, sprite, effect: { action: command.action_ref, delta, floor: substrate,
      ...(addressed ? { locus: relative([command.data.x!, command.data.y!], origin.position) } : {}),
      evidence: [before.observation_ref, after.observation_ref] } };
  }
  return match;
}

export function currentCursorRoles(memory: Memory, observation: NativeObservation) {
  const inputs = interfaceKey(observation);
  const available = new Set(observation.available_action_refs);
  const rejected = memory.entry?.epoch === observation.level_epoch ? memory.entry.rejected : [];
  const eligible = memory.profiles.filter(role => role.learned < observation.level_epoch && role.observations >= 2);
  const bySprite = new Map<string, Profile>();
  for (const role of eligible) {
    const previous = bySprite.get(role.sprite);
    if (previous?.inputs === inputs && role.inputs !== inputs) continue;
    bySprite.set(role.sprite, role);
  }
  if (!bySprite.size) return [];
  const entities = indexed(observation);
  return [...bySprite.values()].flatMap(role => {
    const candidates = entities.get(role.sprite);
    if (!candidates?.length) return [];
    const active = memory.entry?.active;
    const bound = active?.sprite === role.sprite && active.ref === observation.observation_ref
      ? candidates.find(entity => same(entity.position, active.position)) : undefined;
    const effects = role.effects.filter(effect => available.has(effect.action) && !rejected.includes(effectKey(effect)));
    return [{ role: { ...role, effects }, candidates: bound ? [bound] : candidates }];
  });
}

function projected(entity: NativeEntity, from: NativePoint, effect: Effect, observation: NativeObservation, rows: NativeRows) {
  const to = add(from, effect.delta);
  const target = entering(entity.mask, from, to);
  const original = new Set(entity.mask.map(pixel => key(add(entity.position, pixel))));
  return target.length && target.every(([x, y]) => {
    const value = rows[y]?.[x];
    // Pixels vacated by the original sprite did not expose their substrate when this prefix was selected.
    return value !== undefined && !original.has(key([x, y])) && color(observation, value) === effect.floor;
  }) ? { from, to } : undefined;
}

function effectCommand(effect: Effect, from: NativePoint): NativeCommand {
  if (!effect.locus) return { action_ref: effect.action, data: {} };
  const [x, y] = add(from, effect.locus);
  return { action_ref: effect.action, data: { x, y } };
}

export function createCursorRoleMemory(): NativeFamily<RoleProposal> {
  let memory: Memory = { profiles: [] };

  function acquire(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows) {
    const witnessed = measure(before, after, command, first, second);
    if (!witnessed) return;
    const inputs = interfaceKey(before), { sprite, effect } = witnessed;
    const profile = memory.profiles.find(role => role.sprite === sprite && role.inputs === inputs);
    const effects = (profile?.effects ?? []).filter(value => effectKey(value) !== effectKey(effect)).concat(effect).slice(-12);
    const next = { sprite, inputs, learned: profile?.learned ?? before.level_epoch, observations: (profile?.observations ?? 0) + 1, effects };
    memory.profiles = memory.profiles.filter(role => role !== profile).concat(next).slice(-12);
    const active = memory.entry?.active;
    if (active?.sprite === sprite && active.ref === before.observation_ref && same(active.position, witnessed.before.position)) {
      memory.entry!.active = { sprite, position: witnessed.after.position, ref: after.observation_ref };
    }
    return witnessed;
  }

  function receive(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows,
    proposal?: RoleProposal) {
    const witnessed = acquire(before, after, command, first, second);
    if (!proposal || before.level_epoch !== after.level_epoch) return;
    const matches = witnessed?.sprite === proposal.role.sprite && same(witnessed.effect.delta, proposal.effect.delta)
      && proposal.candidates.some(candidate => same(witnessed.before.position, candidate.from) && same(witnessed.after.position, candidate.to));
    const rejected = memory.entry?.epoch === before.level_epoch ? memory.entry.rejected : [];
    memory.entry = { epoch: before.level_epoch, rejected: matches ? rejected : [...new Set([...rejected, effectKey(proposal.effect)])], confirmed: !!matches,
      ...(witnessed?.sprite === proposal.role.sprite ? { active: { sprite: witnessed.sprite,
        position: witnessed.after.position, ref: after.observation_ref } } : {}) };
  }

  return {
    id: cursorRoleMemoryId,
    async propose(observation, rows, inputs, remaining, execution) {
      if (remaining < 1 || memory.entry?.epoch === observation.level_epoch && memory.entry.confirmed) return null;
      const known = execution?.retainedCursorRoles ?? currentCursorRoles(memory, observation);
      if (known.length !== 1) return null;
      const { role, candidates } = known[0]!;
      const unique = candidates.length === 1;
      const available = new Set(inputs.map(command => command.action_ref));
      const choice = role.effects.find(effect => (effect.locus ? unique : available.has(effect.action))
        && candidates.some(entity => projected(entity, entity.position, effect, observation, rows)));
      if (!choice) return null;
      const first = candidates.flatMap(entity => {
        const projectedMove = projected(entity, entity.position, choice, observation, rows);
        return projectedMove ? [projectedMove] : [];
      });
      const origin = first[0]!.from, command = effectCommand(choice, origin);
      const evidence: [string, ...string[]] = [observation.observation_ref, ...choice.evidence];
      const reason = unique ? 'Move the cursor using its witnessed role and compatible landing'
        : 'Use one witnessed input to distinguish which matching sprite is the active cursor';
      let steps: { action: NativeCommand; expected_after: NativePoint | null; point_binding?: unknown }[] = [
        { action: command, expected_after: unique ? first[0]!.to : null },
      ];
      if (choice.locus) {
        const point: NativePoint = [command.data.x!, command.data.y!];
        if (point[0] < 0 || point[1] < 0 || rows[point[1]]?.[point[0]] === undefined) return null;
        steps[0]!.point_binding = await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason, evidence });
      } else if (unique && remaining >= 2) {
        const second = projected(candidates[0]!, first[0]!.to, choice, observation, rows);
        if (second) steps = [...steps, { action: command, expected_after: second.to }];
      }
      const actionList = steps.map(step => step.action);
      const goal = { kind: unique ? 'reuse_observed_cursor' : 'identify_active_cursor',
        scope: observation.observation_ref.split(':revision:', 1)[0]!, subjects: [role.sprite], parentObjective: completion,
        satisfactionContract: 'observe_the_witnessed_cursor_displacement' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `cursor-role:${need.id}`;
      return { status: 'proposed', kind: cursorRoleMemoryId, actions: actionList, steps, role, effect: choice, candidates: first,
        binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch },
        question: { reason, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: reason, relations: [`contributes_to:${completion}`] }],
        sicSituationCard: { mode: unique ? 'solving' : 'exploration', strategy: goal.kind, need: reason, situation: reason, evidence },
        sicLocalDecision: { strategy: goal.kind, objective: { id, label: reason, parent: completion }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: completion, purpose: reason,
          preconditions: {}, preserve_refs: [], evidence, actions: actionList,
          outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      const expected = index === 0 ? proposal.candidates.map(candidate => candidate.from) : [proposal.steps?.[index - 1]?.expected_after];
      const current = observation.entities.filter(entity => appearance(observation, entity) === proposal.role.sprite);
      const admitted = current.some(entity => expected.some(point => Array.isArray(point) && same(entity.position, point as unknown as NativePoint))
        && projected(entity, entity.position, proposal.effect, observation, packet.frame_rows));
      return { admitted, reason: admitted ? 'cursor_role_bound' : 'cursor_role_premise_changed' };
    },
    after(proposal, index, before, after, first, second) {
      const boundary = before.level_epoch !== after.level_epoch || before.levels_completed !== after.levels_completed;
      const expected = index === 0 ? proposal.candidates
        : [{ from: proposal.steps?.[index - 1]?.expected_after as NativePoint, to: proposal.steps?.[index]?.expected_after as NativePoint }];
      const witnessed = measure(before, after, proposal.actions[index]!, first, second);
      const matched = witnessed?.sprite === proposal.role.sprite
        && expected.some(candidate => same(candidate.from, witnessed.before.position) && same(candidate.to, witnessed.after.position));
      return { matched: boundary || matched, seal_prefix: boundary || !matched,
        reason: boundary ? 'official_boundary' : matched ? 'cursor_role_reused' : 'cursor_input_return_contradicted' };
    },
    record(before, after, command, first, second, proposal, index) {
      const prior = index > 0 ? proposal.steps?.[index - 1]?.expected_after as NativePoint : null;
      receive(before, after, command, first, second, prior ? { ...proposal, candidates: [{ from: prior, to: add(prior, proposal.effect.delta) }] } : proposal);
      return { events: [] };
    },
    observePublicOutcome(before, after, command, first, second) { acquire(before, after, command, first, second); },
    state: () => memory,
    restore(value) { memory = structuredClone(value as Memory); },
  };
}
