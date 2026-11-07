/** Native factored_return.py: guarded recombination after a measured recurrence. */
import { symbolicDigest as identity, sha256Bytes } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { EffectAccess } from './v6-effect-access.ts';
import type { AccessBeforeMetadata, AccessAfterMetadata, AccessBeforeResult, AccessAfterResult } from './v6-effect-access.ts';
import type { CompositionRecord as R, CompositionObservation, CompositionCommand, CompositionTransition, Snapshot } from './v6-composition-memory.ts';
import type { NativeRows } from './v6-native-types.ts';

export function partition(rows: NativeRows, axis: string, indices: readonly number[]): [string, string] {
  const channels: [number[], number[]] = [[], []];
  if (axis === 'row') rows.forEach((line, y) => channels[Number(indices.includes(y))]!.push(...line));
  else for (let x = 0; x < rows[0]!.length; x++) for (const line of rows) channels[Number(indices.includes(x))]!.push(line[x]!);
  return channels.map(values => {
    if (values.some(value => !Number.isInteger(value) || value < 0 || value > 255)) throw new RangeError('Partition pixels must fit an unsigned byte');
    return sha256Bytes(Uint8Array.from(values));
  }) as [string, string];
}

export function measuredPartitions(transitions: readonly CompositionTransition[]): [string, number[], string[]][] {
  const groups = new Map<string, { shape: number[][]; events: [number, number, string, string][] }>();
  for (const [before, action, after] of transitions) {
    const cells: number[][] = [];
    for (let y = 0; y < Math.min(before.rows.length, after.rows.length); y++) for (let x = 0; x < Math.min(before.rows[y]!.length, after.rows[y]!.length); x++) {
      const old = before.rows[y]![x]!, next = after.rows[y]![x]!; if (old !== next) cells.push([x, y, old, next]);
    }
    if (!cells.length) continue;
    const ox = Math.min(...cells.map(cell => cell[0]!)), oy = Math.min(...cells.map(cell => cell[1]!));
    const shape = cells.map(([x, y, old, next]) => [x! - ox, y! - oy, old!, next!]), key = JSON.stringify(shape), group = groups.get(key) ?? { shape, events: [] };
    group.events.push([ox, oy, action, before.ref]); groups.set(key, group);
  }
  const candidates: [string, number[], string[]][] = [];
  for (const { shape, events } of groups.values()) {
    if (new Set(events.map(event => event[2])).size < 2 || new Set(events.map(event => JSON.stringify(event.slice(0, 2)))).size < 3) continue;
    for (const axis of ['row', 'column']) {
      const coordinates = new Set(events.map(event => event[axis === 'row' ? 1 : 0])); if (coordinates.size !== 1) continue;
      const start = coordinates.values().next().value!;
      candidates.push([axis, [...new Set(shape.map(cell => start + cell[axis === 'row' ? 1 : 0]!))].sort((a, b) => a - b), events.map(event => event[3])]);
    }
  }
  return candidates;
}

export function factoredProposal(episode: readonly CompositionTransition[], observation: CompositionObservation,
  inputs: readonly CompositionCommand[], limit: number): R | null {
  if (episode.length < 4 || observation.frame_hash !== episode[0]![0].frame_hash || episode.at(-1)![0].frame_hash === observation.frame_hash) return null;
  if (episode.some(([before, , after]) => before.epoch !== observation.level_epoch || before.score !== observation.levels_completed || after.epoch !== before.epoch || after.score !== before.score)) return null;
  const start = Math.max(...episode.map(([before], index) => before.frame_hash === observation.frame_hash ? index : -1)), excursion = episode.slice(start);
  const candidates = measuredPartitions(excursion.slice(0, -1)); if (candidates.length !== 1) return null;
  const [axis, indices, evidence] = candidates[0]!, cache = new Map<string, [string, string]>();
  const key = (snapshot: Snapshot): [string, string] => {
    if (!cache.has(snapshot.frame_hash)) cache.set(snapshot.frame_hash, partition(snapshot.rows, axis, indices)); return cache.get(snapshot.frame_hash)!;
  };
  const available = new Set(inputs.filter(action => !truth(action.data)).map(action => action.action_ref));
  const bandEdges = new Map<string, Set<string>>(), trials = new Map<string, Set<string>>(), forward: [string, string, string, string][] = [];
  for (const [before, action, after] of excursion.slice(0, -1)) {
    const [b0, b1] = key(before), [a0, a1] = key(after); if (a1 === b1) return null;
    const edges = bandEdges.get(b1) ?? new Set<string>(); edges.add(a1); bandEdges.set(b1, edges);
    const attempted = trials.get(b0) ?? new Set<string>(); attempted.add(action); trials.set(b0, attempted);
    if (b0 !== a0) forward.push([b0, action, a0, before.ref]);
  }
  if (forward.length < 2 || forward.length + 1 > limit) return null;
  if (new Set([...forward.map(item => item[0]), forward.at(-1)![2]]).size !== forward.length + 1) return null;
  if (forward.slice(1).some((right, index) => forward[index]![2] !== right[0])) return null;
  const [anchor, initialBand] = key(excursion[0]![0]), lastBody = key(excursion.at(-1)![0])[0]; let band = initialBand;
  if (forward[0]![0] !== anchor || forward.at(-1)![2] !== lastBody) return null;
  const attempted = trials.get(lastBody) ?? new Set<string>(); attempted.add(excursion.at(-1)![1]); trials.set(lastBody, attempted);
  const unused = [...available].filter(action => !attempted.has(action)); if (!unused.length) return null;
  const paths = new Set(forward.map(item => item[1])), novel = unused.filter(action => !paths.has(action));
  if (novel.length !== 1 || paths.size !== forward.length) return null;
  const steps: R[] = [];
  for (const [body, action, destination, reference] of forward) {
    const edges = bandEdges.get(band); if (!available.has(action) || edges?.size !== 1) return null;
    const nextBand = edges.values().next().value!;
    steps.push({ action_ref: action, before: [body, band], expected_after: [destination, nextBand], source: reference }); band = nextBand;
  }
  steps.push({ action_ref: novel[0], before: [lastBody, band], expected_after: null, source: excursion.at(-1)![0].ref });
  const plan = { axis, indices, steps, level_epoch: observation.level_epoch, score: observation.levels_completed,
    observation_ref: observation.observation_ref, channel_witnesses: evidence, return_ref: excursion.at(-1)![2].ref,
    scope: 'Only the combination of two independently observed display projections is forecast; both must match at each step.' };
  const reference = `C_factored_return_${identity(plan).slice(0, 18)}`, actions = steps.map(step => ({ action_ref: step.action_ref }));
  const why = 'Reproduce the measured sequence of material changes while testing each independent display projection, then sample the one unused input at the open state.';
  const refs = [observation.observation_ref, ...evidence, ...steps.map(step => step.source)], facts = { exact_return: true, distinct_translated_channel: true, observed_material_chain: true };
  return { status: 'proposed', kind: 'public_factored_return', proposal_id: reference, factor_plan: plan, actions,
    steps: actions.map((action, index) => ({ action, expected_after: steps[index]!.expected_after })), facts,
    compositions: [{ id: reference, observed: false, role: 'factored_access_question', open_question: why, properties: { falsifier: plan.scope }, relations: ['contributes_to:G_official_completion'] }],
    question: { reason: 'material_chain_and_independent_drift', hypothesis_refs: refs }, route_refs: refs,
    binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
    bundle_template: { operation_key: 'OP18', composition_ref: reference, objective_ref: 'G_official_completion', preserve_refs: [], actions, evidence: refs, preconditions: facts, purpose: why,
      outcome_guard: { path: ['value'], contains: reference } } };
}

export class FactoredEffectAccess extends EffectAccess {
  override async propose(episode: readonly CompositionTransition[], observation: CompositionObservation, rows: NativeRows,
    inputs: readonly CompositionCommand[], maxPrefix: number, config: R): Promise<R> {
    const base = await super.propose(episode, observation, rows, inputs, maxPrefix, config);
    if (base.status === 'proposed' || !truth(config.test_factored_return)) return base;
    return factoredProposal(episode, observation, inputs, maxPrefix) ?? base;
  }
  override before(proposal: R, index: number, rows: NativeRows, metadata: AccessBeforeMetadata): AccessBeforeResult {
    const plan = proposal.factor_plan; if (!truth(plan)) return super.before(proposal, index, rows, metadata);
    const step = plan.steps.at(index), actual = partition(rows, plan.axis, plan.indices);
    if (!step) throw new RangeError('Factored step outside the committed plan');
    const admitted = metadata.epoch === plan.level_epoch && metadata.score === plan.score && metadata.available.includes(step.action_ref)
      && (index > 0 || metadata.observation_ref === plan.observation_ref) && equal(actual, step.before);
    return { admitted, reason: admitted ? 'complete_partition_bound' : 'partition_or_scope_changed' };
  }
  override after(proposal: R, index: number, beforeRows: NativeRows, afterRows: NativeRows, metadata: AccessAfterMetadata): AccessAfterResult {
    const plan = proposal.factor_plan; if (!truth(plan)) return super.after(proposal, index, beforeRows, afterRows, metadata);
    if (metadata.epoch !== plan.level_epoch || metadata.score !== plan.score || ['WIN', 'GAME_OVER'].includes(metadata.state)) return { matched: null, seal_prefix: true, reason: 'official_boundary_or_terminal' };
    const step = plan.steps.at(index); if (!step) throw new RangeError('Factored step outside the committed plan');
    const predicted = step.expected_after;
    if (predicted === null) return { matched: null, seal_prefix: true, reason: 'unknown_alternative_observed' };
    const matched = equal(partition(afterRows, plan.axis, plan.indices), predicted);
    return { matched, seal_prefix: !matched || index + 1 === plan.steps.length, reason: matched ? 'both_current_channels_matched' : 'partition_forecast_diverged' };
  }
}

export { measuredPartitions as measured_partitions, factoredProposal as factored_proposal };
