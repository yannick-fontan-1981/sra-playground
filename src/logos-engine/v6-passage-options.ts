/** Native passage_options.py: compare unvisited access on actually traversed surfaces. */
import { compareUnicode } from './canonical.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { ScoredRewriteAccess } from './v6-scored-rewrite.ts';
import { registered, Snapshot } from './v6-composition-memory.ts';
import type { AccessBeforeMetadata, AccessAfterMetadata, AccessBeforeResult, AccessAfterResult } from './v6-effect-access.ts';
import type { CompositionRecord as R, CompositionObservation, CompositionCommand, CompositionTransition } from './v6-composition-memory.ts';
import type { NativePoint, NativeRows } from './v6-native-types.ts';

const key = (value: unknown): string => JSON.stringify(value);
export type PassageSurfaces = Map<string, Map<string, NativePoint>>;

export function patch(rows: NativeRows, position: NativePoint, size: NativePoint): string | null {
  const [x, y] = position, [width, height] = size;
  if (Math.min(x, y) < 0 || y + height > rows.length || x + width > rows[0]!.length) return null;
  return identity(rows.slice(y, y + height).map(row => row.slice(x, x + width)));
}

export function calibrated(samples: readonly R[]): [Record<string, Record<string, NativePoint>>, PassageSurfaces] {
  const byInput = new Map<string, Map<string, { vector: NativePoint; positions: Set<string> }>>(), surfaces: PassageSurfaces = new Map();
  for (const sample of samples) {
    const input = key([sample.role, sample.action]), delta = key(sample.delta), deltas = byInput.get(input) ?? new Map();
    const measured = deltas.get(delta) ?? { vector: sample.delta as NativePoint, positions: new Set<string>() };
    measured.positions.add(key(sample.origin)); deltas.set(delta, measured); byInput.set(input, deltas);
    const surface = key([sample.role, sample.surface]), origins = surfaces.get(surface) ?? new Map<string, NativePoint>();
    origins.set(key(sample.origin), sample.origin); surfaces.set(surface, origins);
  }
  const roles: Record<string, Record<string, NativePoint>> = {};
  for (const [input, deltas] of byInput) if (deltas.size === 1) {
    const [role, action] = JSON.parse(input), measured = deltas.values().next().value!;
    if (measured.positions.size >= 2) (roles[role] ??= {})[action] = measured.vector;
  }
  return [Object.fromEntries(Object.entries(roles).filter(([, moves]) => Object.values(moves).some(([x, y]) => Object.values(moves).some(([i, j]) => x * j !== y * i)))), surfaces];
}

export class PassageOptions extends ScoredRewriteAccess {
  motion_samples: R[] = [];
  scores: R[] = [];
  readonly refuted_positions = new Set<string>();
  override applyEvent(event: R): void {
    if (event.kind === 'measured_lattice_steps') this.motion_samples.push(...event.samples);
    else if (event.kind === 'scored_passage_observation') this.scores.push(event);
    else if (event.kind === 'passage_option_result' && event.result === 'refuted') this.refuted_positions.add(event.trial);
    else if (event.kind !== 'passage_option_result') super.applyEvent(event);
  }
  override retainedDigest(): string { return identity([super.retainedDigest(), this.motion_samples, this.scores, [...this.refuted_positions].sort(compareUnicode)]); }

  override async record(before: CompositionObservation, command: CompositionCommand, after: CompositionObservation, rows: NativeRows,
    later: NativeRows, proposal: R, index: number): Promise<R[]> {
    const events = await super.record(before, command, after, rows, later, proposal, index), extra: R[] = [];
    const lookup = (observation: CompositionObservation) => Object.fromEntries(observation.entities.filter(entity => !entity.identity_ambiguous).map(entity => [entity.signature, entity]));
    const old = lookup(before), next = lookup(after), action = command.action_ref;
    if (after.levels_completed > before.levels_completed) {
      const [roles, surfaces] = calibrated(this.motion_samples), observed: R[] = [];
      for (const [signature, moves] of Object.entries(roles)) {
        if (!Object.hasOwn(old, signature)) continue;
        const sparse = this.motion_samples.filter(sample => sample.role === signature && sample.action === action), deltas = new Map(sparse.map(sample => [key(sample.delta), sample.delta as NativePoint]));
        if (!Object.hasOwn(moves, action) && deltas.size !== 1) continue;
        const box = old[signature]!.bbox, size: NativePoint = [box[2] - box[0] + 1, box[3] - box[1] + 1];
        const [dx, dy] = moves[action] ?? deltas.values().next().value!;
        const surface = patch(rows, [box[0] + dx, box[1] + dy], size);
        if ((surfaces.get(key([signature, surface]))?.size ?? 0) >= 2) {
          const witness: R = { role: signature, action, surface };
          if (!Object.hasOwn(moves, action)) Object.assign(witness, { status: 'sparse_scored_contact_hypothesis', movement_evidence: sparse.map(sample => sample.ref),
            uncertainty: 'The scored step has no same-epoch destination observation; its contact surface is a hypothesis, not a calibrated movement.' });
          observed.push(witness);
        }
      }
      if (observed.length) extra.push({ kind: 'scored_passage_observation', epoch: before.level_epoch, source: before.observation_ref, roles: observed });
    } else if (before.frame_hash !== after.frame_hash && before.level_epoch === after.level_epoch && registered(Snapshot.fromPublic(before, rows), Snapshot.fromPublic(after, later))) {
      const samples: R[] = [];
      for (const signature of Object.keys(old).filter(signature => Object.hasOwn(next, signature)).sort(compareUnicode)) {
        const a = old[signature]!.bbox, b = next[signature]!.bbox, width = a[2] - a[0] + 1, height = a[3] - a[1] + 1, dx = b[0] - a[0], dy = b[1] - a[1];
        if (Math.min(width, height) < 2 || ![[width, 0], [-width, 0], [0, height], [0, -height]].some(vector => equal([dx, dy], vector))) continue;
        samples.push({ role: signature, action, origin: a.slice(0, 2), dest: b.slice(0, 2), delta: [dx, dy],
          surface: patch(rows, b.slice(0, 2), [width, height]), epoch: before.level_epoch, ref: before.observation_ref });
      }
      if (samples.length) extra.push({ kind: 'measured_lattice_steps', samples });
    }
    if (Object.hasOwn(proposal, 'passage_plan')) {
      const outcome = this.after(proposal, index, rows, later, { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
      extra.push({ kind: 'passage_option_result', trial: proposal.passage_plan.trial,
        result: after.levels_completed > before.levels_completed ? 'progress' : outcome.matched ? 'matched' : 'refuted', after: after.observation_ref });
    }
    for (const event of extra) this.applyEvent(event); return [...events, ...extra];
  }

  override async propose(episode: readonly CompositionTransition[], observation: CompositionObservation, rows: NativeRows,
    inputs: readonly CompositionCommand[], maxPrefix: number, config: R): Promise<R> {
    const base = await super.propose(episode, observation, rows, inputs, maxPrefix, config);
    if (base.status === 'proposed' || !truth(config.compare_scored_passage_options) || this.scores.length < 2) return base;
    const prior = this.scores.slice(-2), first = new Set(prior[0]!.roles.map((role: R) => key([role.role, role.surface])));
    const shared = [...new Set<string>(prior[1]!.roles.map((role: R) => key([role.role, role.surface])))].filter(value => first.has(value));
    if (shared.length !== 1 || prior[0]!.epoch === prior[1]!.epoch || prior.at(-1)!.epoch >= observation.level_epoch) return base;
    const [signature, surface] = JSON.parse(shared[0]!), witnesses = prior.flatMap(sample => sample.roles).filter(witness => key([witness.role, witness.surface]) === shared[0]);
    const commands = new Set<string>(witnesses.map(witness => witness.action)), scoringCommand = commands.size === 1 ? commands.values().next().value! : null;
    const entity = observation.entities.find(entity => entity.signature === signature && !entity.identity_ambiguous); if (!entity) return base;
    const [roles, surfaces] = calibrated(this.motion_samples), available = new Set(inputs.filter(action => !truth(action.data)).map(action => action.action_ref));
    const moves = Object.fromEntries(Object.entries(roles[signature] ?? {}).filter(([action]) => available.has(action)));
    const start: NativePoint = [entity.bbox[0], entity.bbox[1]], width = entity.bbox[2] - start[0] + 1, height = entity.bbox[3] - start[1] + 1;
    const valid = new Set<string | null>();
    for (const [compound, origins] of surfaces) { const [role, appearance] = JSON.parse(compound); if (role === signature && origins.size >= 2) valid.add(appearance); }
    const observed = this.motion_samples.filter(sample => sample.epoch === observation.level_epoch && sample.role === signature);
    const visited = new Set([...observed.flatMap(sample => [sample.origin, sample.dest]).map(key), key(start)]);
    const walk = (position: NativePoint, vector: NativePoint): NativePoint => [position[0] + vector[0], position[1] + vector[1]];
    const choices: { rank: [number, number, number]; action: string; target: NativePoint; surface: string | null; trial: string }[] = [];
    for (const [action, vector] of Object.entries(moves)) {
      const target = walk(start, vector), targetSurface = patch(rows, target, [width, height]), trial = identity([observation.level_epoch, signature, start, action, targetSurface]);
      if (!valid.has(targetSurface) || this.refuted_positions.has(trial) || visited.has(key(target))) continue;
      const reach = new Set([key(start), key(target)]), queue: [NativePoint, number][] = [[target, 0]]; let exits = 0;
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const [position, depth] = queue[cursor]!; if (depth >= config.passage_lookahead) continue;
        for (const delta of Object.values(moves)) {
          const next = walk(position, delta);
          if (!reach.has(key(next)) && valid.has(patch(rows, next, [width, height]))) { reach.add(key(next)); queue.push([next, depth + 1]); if (depth === 0) exits++; }
        }
      }
      choices.push({ rank: [[...reach].filter(position => !visited.has(position)).length, exits, Number(action === scoringCommand)], action, target, surface: targetSurface, trial });
    }
    if (!choices.length) return base;
    const ranked = [...choices].sort((a, b) => b.rank[0] - a.rank[0] || b.rank[1] - a.rank[1] || b.rank[2] - a.rank[2] || compareUnicode(b.action, a.action));
    const { action, target, surface: targetSurface, trial } = ranked[0]!, command = { action_ref: action };
    const plan: R = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
      role: signature, origin: start, target, size: [width, height], role_mask: entity.mask, palette: entity.palette_value, surface: targetSurface, action, trial,
      options: choices.map(choice => [choice.action, choice.rank.slice(0, 2)]), scoring_surface_hypothesis: surface, scored_command: scoringCommand,
      scope: 'Observed moves can also remain stationary; a new site and its continuation options are experimental.' };
    if (scoringCommand === null || witnesses.some(witness => truth(witness.status))) {
      plan.scored_contact_witnesses = witnesses; plan.contact_scope = 'Recurrent role/surface hypothesis; scored command identity is contingent. Access uses only separately calibrated movements.';
    }
    const reference = `C_scored_passage_${identity(plan).slice(0, 18)}`, why = 'Test a conditional translation onto a previously traversed surface that opens the greatest number of unvisited comparable positions.';
    const facts = { conditional_lattice_attested: true, two_scored_episodes: true, current_surface_bound: true }, evidence = [observation.observation_ref, ...prior.map(sample => sample.source)];
    return { status: 'proposed', kind: 'public_passage_options', proposal_id: reference, passage_plan: plan, actions: [command], steps: [{ action: command, expected_after: { role: signature, origin: [...target] } }],
      facts, compositions: [{ id: reference, observed: false, open_question: why, role: 'conditional_exploration_access', properties: { options: plan.options }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: 'reach_an_unvisited_site_with_observed_continuation_options', hypothesis_refs: evidence }, route_refs: evidence,
      binding: { level_epoch: plan.epoch, observation_ref: plan.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: reference, objective_ref: 'G_official_completion', preserve_refs: [], actions: [command], purpose: why, preconditions: facts, evidence,
        outcome_guard: { path: ['value'], contains: reference } } };
  }
  static located(plan: R, rows: NativeRows, point: NativePoint): boolean {
    return plan.role_mask.every(([dx, dy]: NativePoint) => rows[point[1] + dy]![point[0] + dx] === plan.palette);
  }
  override before(proposal: R, index: number, rows: NativeRows, metadata: AccessBeforeMetadata): AccessBeforeResult {
    const plan = proposal.passage_plan; if (!truth(plan)) return super.before(proposal, index, rows, metadata);
    const admitted = index === 0 && metadata.epoch === plan.epoch && metadata.score === plan.score && metadata.observation_ref === plan.observation_ref
      && metadata.available.includes(plan.action) && PassageOptions.located(plan, rows, plan.origin) && patch(rows, plan.target, plan.size) === plan.surface;
    return { admitted, reason: admitted ? 'local_passage_and_origin_bound' : 'passage_or_scope_changed' };
  }
  override after(proposal: R, index: number, beforeRows: NativeRows, afterRows: NativeRows, metadata: AccessAfterMetadata): AccessAfterResult {
    const plan = proposal.passage_plan; if (!truth(plan)) return super.after(proposal, index, beforeRows, afterRows, metadata);
    if (metadata.epoch !== plan.epoch || metadata.score !== plan.score || ['WIN', 'GAME_OVER'].includes(metadata.state)) return { matched: null, seal_prefix: true, reason: 'official_boundary_or_terminal' };
    const matched = PassageOptions.located(plan, afterRows, plan.target) && !PassageOptions.located(plan, afterRows, plan.origin);
    return { matched, seal_prefix: true, reason: matched ? 'new_local_position_observed' : 'conditional_translation_refuted' };
  }
  override state(): R { return structuredClone({ ...super.state(), motion_samples: this.motion_samples, scores: this.scores, refuted_positions: [...this.refuted_positions].sort(compareUnicode) }); }
  override restore(state: R): void {
    const value = structuredClone(state); if (!Array.isArray(value.motion_samples) || !Array.isArray(value.scores) || !Array.isArray(value.refuted_positions)) throw new TypeError('Invalid passage-options state');
    super.restore(value); this.motion_samples = value.motion_samples; this.scores = value.scores; this.refuted_positions.clear(); value.refuted_positions.forEach((trial: string) => this.refuted_positions.add(trial));
  }
}
