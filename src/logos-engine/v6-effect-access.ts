/** Native effect_access.py: conditional experiments from measured episode effects. */
import { compareUnicode } from './canonical.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { Snapshot, relativeMotion, motionModels, registered, repeatedChanges, localPatch, equalityPattern,
  orientationPatterns, addPoint, checkAccessBefore, checkAccessAfter } from './v6-composition-memory.ts';
import type { CompositionRecord as R, CompositionObservation, CompositionCommand, CompositionTransition, ChangeFamilies } from './v6-composition-memory.ts';
import type { NativePoint, NativeRows } from './v6-native-types.ts';

export type AccessBeforeMetadata = { epoch: number; score: number; available: readonly string[]; observation_ref: string };
export type AccessAfterMetadata = { epoch: number; score: number; state: string };
export type AccessBeforeResult = { admitted: boolean; reason: string };
export type AccessAfterResult = { matched: boolean | null; seal_prefix: boolean; reason: string };
const key = (value: unknown): string => JSON.stringify(value);
const comparePoint = (a: NativePoint, b: NativePoint): number => a[0] - b[0] || a[1] - b[1];
function gcd(a: number, b: number): number { while (b) [a, b] = [b, a % b]; return Math.abs(a); }
function points(values: Iterable<NativePoint>): Map<string, NativePoint> { return new Map([...values].map(value => [key(value), value])); }
function partCounts(pattern: readonly number[]): number[] {
  const counts = new Map<number, number>(); for (const part of pattern) counts.set(part, (counts.get(part) ?? 0) + 1);
  return [...counts.values()].sort((a, b) => a - b);
}

export function supportBox(origin: NativePoint, size: NativePoint): NativePoint[] {
  const result: NativePoint[] = [];
  for (let x = origin[0] - 1; x < origin[0] + size[0] + 1; x++) for (let y = origin[1] - 1; y < origin[1] + size[1] + 1; y++) result.push([x, y]);
  return result;
}

export class EffectAccess {
  readonly tried = new Set<string>();
  interventions: Record<string, R> = {};
  readonly failed = new Set<string>();
  protected changes = new Map<string, ChangeFamilies>();

  applyEvent(event: R): void {
    if (event.kind === 'pre_score_effect_contact') { this.tried.add(event.trial_key); this.interventions[event.before_ref] = event; }
    else if (event.kind === 'pre_score_displacement_refuted') this.failed.add(event.premise_ref);
    else throw new Error('Unexpected pre-score evidence');
  }
  retainedDigest(): string { return identity([[...this.tried].sort(compareUnicode), this.interventions, [...this.failed].sort(compareUnicode)]); }
  protected async patterns(before: Snapshot, after: Snapshot): Promise<ChangeFamilies> {
    const cache = key([before.ref, after.ref]);
    if (!this.changes.has(cache)) this.changes.set(cache, await repeatedChanges(before, after));
    return this.changes.get(cache)!;
  }

  async propose(episode: readonly CompositionTransition[], observation: CompositionObservation, rows: NativeRows,
    inputs: readonly CompositionCommand[], maxPrefix: number, config: R): Promise<R> {
    if (episode.length < 3) return { status: 'abstained', reason: 'no_measured_contact_effect' };
    const current = Snapshot.fromPublic(observation, rows), available = new Set(inputs.filter(action => !truth(action.data)).map(action => action.action_ref)), offers: R[] = [];
    for (const [signature, measured] of motionModels(episode, current)) {
      const moves: Record<string, NativePoint> = Object.fromEntries(Object.entries(measured).filter(([action]) => available.has(action)));
      if (new Set(Object.values(moves).map(key)).size < 2) continue;
      const box = current.roles[signature]!, size: NativePoint = [box[2] - box[0] + 1, box[3] - box[1] + 1], start: NativePoint = [box[0], box[1]];
      const dx = Object.values(moves).reduce((a, v) => gcd(a, Math.abs(v[0])), 0), dy = Object.values(moves).reduce((a, v) => gcd(a, Math.abs(v[1])), 0);
      if (!dx || !dy) continue;
      const missing = [...available].filter(action => !Object.hasOwn(moves, action));
      const reverse = points(Object.values(moves).map(([x, y]) => [x === 0 ? 0 : -x, y === 0 ? 0 : -y]));
      for (const vector of Object.values(moves)) reverse.delete(key(vector));
      let hypothesis: string | null = null;
      if (missing.length === 1 && reverse.size === 1) { hypothesis = missing[0]!; moves[hypothesis] = reverse.values().next().value!; }
      const visible = observation.entities.filter(entity => entity.signature === signature && !truth(entity.identity_ambiguous));
      if (visible.length !== 1) continue;
      const cells = new Map<string, { point: NativePoint; patch: number[] }>();
      for (let x = ((start[0] % dx) + dx) % dx; x < rows[0]!.length; x += dx) for (let y = ((start[1] % dy) + dy) % dy; y < rows.length; y += dy) {
        const point: NativePoint = [x, y], patch = localPatch(current, point, size); if (patch !== null) cells.set(key(point), { point, patch });
      }
      const passageSources = new Map<string, Set<string>>(), contradicted = new Set<string>(), contacts: R[] = [];
      const edges = new Map<string, Map<string, NativePoint>>(), remoteChanges = new Map<string, R>();
      for (const [before, action, after] of episode) {
        if (before.epoch !== current.epoch || after.epoch !== current.epoch || !Object.hasOwn(before.roles, signature) || !Object.hasOwn(after.roles, signature) || !registered(before, current) || !registered(after, current)) continue;
        const saved = this.interventions[before.ref]; let vector = measured[action];
        if (vector === undefined && saved && saved.role === signature) vector = saved.provisional_vector;
        if (vector === undefined) continue;
        const origin: NativePoint = [before.roles[signature]![0], before.roles[signature]![1]], destination = addPoint(origin, vector);
        const landing: NativePoint = [after.roles[signature]![0], after.roles[signature]![1]], surface = localPatch(before, destination, size);
        if (surface === null) continue;
        const surfaceKey = key(surface);
        if (equal(landing, destination)) {
          if (Object.hasOwn(measured, action)) { const sources = passageSources.get(surfaceKey) ?? new Set<string>(); sources.add(key(origin)); passageSources.set(surfaceKey, sources); }
          continue;
        }
        contradicted.add(surfaceKey);
        if (equal(landing, origin)) continue;
        const edgeKey = key([origin, action, destination, surface]), destinations = edges.get(edgeKey) ?? new Map<string, NativePoint>();
        destinations.set(key(landing), landing); edges.set(edgeKey, destinations);
        const ignored = points([...supportBox(origin, size), ...supportBox(destination, size), ...supportBox(landing, size)]);
        const groups = Object.fromEntries(Object.entries(await this.patterns(before, after)).filter(([, regions]) => regions.every(region => region.every(point => !ignored.has(key(point))))));
        if (!Object.keys(groups).length) continue;
        contacts.push({ site: destination, surface, families: Object.keys(groups).sort(compareUnicode), source: before.ref, response: after.ref, action });
        const familyPoints = points(Object.values(groups).flat(2)), unexplained = new Set<string>();
        for (let y = 0; y < Math.min(before.rows.length, after.rows.length); y++) for (let x = 0; x < Math.min(before.rows[y]!.length, after.rows[y]!.length); x++) {
          const p = key([x, y]); if (before.rows[y]![x] !== after.rows[y]![x] && !ignored.has(p) && !familyPoints.has(p)) unexplained.add(p);
        }
        for (const [cellKey, { point }] of cells) {
          const pixels = supportBox(point, size).map(key), changedCount = pixels.filter(p => unexplained.has(p)).length;
          if (!changedCount || pixels.some(p => ignored.has(p) || familyPoints.has(p))) continue;
          const old = localPatch(before, point, size), next = localPatch(after, point, size);
          if (old !== null && next !== null && !equal(old, next)) remoteChanges.set(cellKey, { from_pattern: old, to_pattern: next, source: before.ref, response: after.ref, changed_pixel_count: changedCount });
        }
      }
      const initial = contacts.length === 0;
      if (initial && !truth(config.initial_contact_question?.enabled)) continue;
      const seenSites = points(contacts.map(contact => contact.site)), observed = new Map<string, number[]>(contacts.map(contact => [key(contact.surface), contact.surface]));
      const shapes = new Set([...observed.values()].flatMap(pattern => orientationPatterns(pattern, size)).map(key));
      const passages = new Set([...passageSources].filter(([surface, sources]) => sources.size >= config.minimum_passage_positions && !contradicted.has(surface)).map(([surface]) => surface));
      const changed = new Map([...remoteChanges].filter(([position, change]) => equal(cells.get(position)?.patch, change.to_pattern)));
      const context = identity([current.epoch, signature, [...changed].map(([position, change]) => [cells.get(position)!.point, change.to_pattern]).sort((a, b) => comparePoint(a[0] as NativePoint, b[0] as NativePoint)), [...seenSites.values()].sort(comparePoint)]);
      const targets = new Map<string, string>([...changed.keys()].map(position => [position, 'test_remote_appearance_change']));
      let exploratory = new Map<string, string>();
      for (const [position, cell] of cells) if ((observed.has(key(cell.patch)) || shapes.has(key(equalityPattern(cell.patch)))) && !seenSites.has(position)) exploratory.set(position, 'test_related_contact_occurrence');
      if (config.test_alternative_part_arrangements) {
        const multiplicities = new Set([...observed.values()].filter(pattern => new Set(pattern).size > 1).map(pattern => key(partCounts(pattern))));
        for (const [position, cell] of cells) if (!seenSites.has(position) && !exploratory.has(position) && !passages.has(key(cell.patch)) && multiplicities.has(key(partCounts(cell.patch)))) exploratory.set(position, 'discriminate_contact_part_arrangement');
      }
      if (initial) exploratory = new Map([...cells].filter(([position, cell]) => position !== key(start) && !passages.has(key(cell.patch)) && new Set(cell.patch).size > 1)
        .map(([position]) => [position, 'acquire_visible_contact_response']));
      for (const targetsNow of targets.size ? [targets, exploratory] : [exploratory]) {
        if (!targetsNow.size) continue;
        type Parent = { origin: NativePoint; action: string; effect: string; contact: NativePoint | null; premise: string } | null;
        const parent = new Map<string, Parent>([[key(start), null]]), queue: NativePoint[] = [start];
        const experiments: { origin: NativePoint; action: string; destination: NativePoint; premise: string; trial: string }[] = [];
        for (let cursor = 0; cursor < queue.length; cursor++) {
          const position = queue[cursor]!;
          for (const [action, vector] of Object.entries(moves).sort(([a], [b]) => compareUnicode(a, b))) {
            const destination = addPoint(position, vector), cell = cells.get(key(destination)); if (!cell) continue;
            const premise = identity([current.epoch, signature, position, action, destination, cell.patch, context]);
            const trial = identity([current.epoch, signature, destination, cell.patch, context]);
            if (this.failed.has(premise)) continue;
            const possible = edges.get(key([position, action, destination, cell.patch]));
            if (possible?.size) {
              if (possible.size === 1) {
                const landing = possible.values().next().value!;
                if (cells.has(key(landing)) && !parent.has(key(landing))) { parent.set(key(landing), { origin: position, action, effect: 'conditional_observed_access', contact: destination, premise }); queue.push(landing); }
              }
              continue;
            }
            if (targetsNow.has(key(destination))) { if (!this.tried.has(trial)) experiments.push({ origin: position, action, destination, premise, trial }); continue; }
            if (!parent.has(key(destination)) && passages.has(key(cell.patch))) {
              parent.set(key(destination), { origin: position, action, effect: action === hypothesis ? 'test_unpaired_inverse' : 'conditional_translation', contact: null, premise }); queue.push(destination);
            }
          }
        }
        if (!experiments.length) continue;
        const chosen = experiments[0]!, { destination, trial } = chosen; let position = chosen.origin;
        const path: R[] = [{ action_ref: chosen.action, from: [...position], to: [...destination], effect: 'unknown_then_observe', premise_ref: chosen.premise, input_status: chosen.action === hypothesis ? 'inverse_hypothesis' : 'measured' }];
        while (parent.get(key(position)) !== null) {
          const previous = parent.get(key(position))!;
          path.push({ action_ref: previous.action, from: [...previous.origin], to: [...position], effect: previous.effect,
            contact: previous.contact === null ? null : [...previous.contact], premise_ref: previous.premise, input_status: previous.action === hypothesis ? 'inverse_hypothesis' : 'measured' }); position = previous.origin;
        }
        path.reverse(); let prefix = path.slice(0, maxPrefix);
        for (const [index, step] of prefix.entries()) if (['conditional_observed_access', 'test_unpaired_inverse'].includes(step.effect)) { prefix = prefix.slice(0, index + 1); break; }
        for (const step of prefix) step.surface_before = [...cells.get(key(truth(step.contact) ? step.contact : step.to))!.patch];
        const controlEvidence: string[] = [];
        for (const [before, command, after] of episode) if (before.epoch === after.epoch && after.epoch === current.epoch && Object.hasOwn(before.roles, signature) && Object.hasOwn(after.roles, signature)
          && registered(before, current) && registered(after, current) && Object.hasOwn(measured, command) && equal(relativeMotion(before, after, signature), measured[command])) {
          for (const reference of [before.ref, after.ref]) if (!controlEvidence.includes(reference)) controlEvidence.push(reference);
        }
        offers.push({ status: 'proposed', kind: targetsNow.get(key(destination)), epoch: current.epoch, score: current.score, observation_ref: current.ref,
          role: signature, role_size: [...size], role_mask: visible[0]!.mask, role_value: visible[0]!.palette_value, site: [...destination],
          condition_digest: context, trial_key: trial, prefix, planned_steps: path.length, known_controls: measured,
          inverse_candidate: hypothesis === null ? null : { action_ref: hypothesis, vector: [...moves[hypothesis]!], status: 'unconfirmed input association; experimental step only' },
          initial_contact_acquisition: initial, observed_nonlocal_contact_count: contacts.length, contact_evidence: contacts.map(contact => contact.source),
          remote_effect_families: [...new Set<string>(contacts.flatMap(contact => contact.families))].sort(compareUnicode), remote_change_evidence: changed.get(key(destination)) ?? null,
          control_surface_evidence: controlEvidence, reachable_contact_alternatives: initial ? experiments.map(experiment => ({ site: [...experiment.destination], action_ref: experiment.action })) : [],
          reachable_positions: parent.size, candidate_sites: targetsNow.size,
          scope: initial ? 'current measured motion and visible contact question; outcome and terminal role unknown' : 'current-episode measured joint change; role, utility and terminal action remain hypotheses' });
        break;
      }
    }
    if (!offers.length) return { status: 'abstained', reason: 'no_reachable_bound_effect_question' };
    if (new Set(offers.map(plan => identity([plan.role, plan.site, plan.prefix]))).size !== 1) return { status: 'abstained', reason: 'competing_effect_role_models' };
    const route = offers[0]!, commands = route.prefix.map((step: R) => ({ action_ref: step.action_ref }));
    if (!route.prefix.length) throw new RangeError('Effect access prefix is empty');
    const operation = ['unknown_then_observe', 'test_unpaired_inverse'].includes(route.prefix.at(-1).effect) ? 'OP18' : 'OP28', reference = `C_public_effect_${identity(route).slice(0, 20)}`;
    let why = route.kind === 'test_remote_appearance_change' ? 'Approach a separately changed public site and observe the outcome.' : 'Test a fresh occurrence related to a contact that produced a nonlocal displacement and a repeated remote change.';
    const initial = route.initial_contact_acquisition ?? false; if (initial) why = config.initial_contact_question.purpose;
    const facts = { role_and_local_surface_bound: true, ...(initial ? { distinct_current_material_contact_question: true } : { effect_observed_this_epoch: true }) };
    const composition: R = { id: reference, observed: false, role: 'material_effect_experiment', properties: { role_signature: route.role, site: route.site, remote_effect_families: route.remote_effect_families, terminal_role: 'unknown' }, relations: ['contributes_to:G_official_completion'] };
    if (operation === 'OP18') composition.open_question = why;
    const evidence = [route.observation_ref, ...route.control_surface_evidence, ...route.contact_evidence, `effect_plan:${identity(route)}`];
    return { status: 'proposed', kind: 'observed_effect_access', proposal_id: `effect:${identity(route)}`, effect_plan: route, actions: commands,
      steps: commands.map((command: R, index: number) => { const step = route.prefix[index]; return { action: command, expected_after: step.effect === 'unknown_then_observe' ? null : { kind: 'conditional_local_geometry', from: step.from, to: step.to, effect: step.effect } }; }),
      question: { reason: route.kind, hypothesis_refs: route.contact_evidence }, facts, compositions: [composition], route_refs: evidence,
      binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: operation, composition_ref: reference, objective_ref: 'G_official_completion', preserve_refs: [], actions: commands, purpose: why, preconditions: facts, evidence,
        outcome_guard: { path: ['value'], contains: operation === 'OP18' ? reference : 'B0' } } };
  }

  before(proposal: R, index: number, rows: NativeRows, metadata: AccessBeforeMetadata): AccessBeforeResult {
    return checkAccessBefore(proposal.effect_plan, index, rows, metadata);
  }
  after(proposal: R, index: number, beforeRows: NativeRows, afterRows: NativeRows, metadata: AccessAfterMetadata): AccessAfterResult {
    const observed = checkAccessAfter(proposal.effect_plan, index, beforeRows, afterRows, metadata);
    return proposal.effect_plan.prefix[index].effect === 'test_unpaired_inverse' ? { ...observed, seal_prefix: true } : observed;
  }
  async record(before: CompositionObservation, action: CompositionCommand, after: CompositionObservation,
    first: NativeRows, last: NativeRows, proposal: R, index: number): Promise<R[]> {
    if (!Object.hasOwn(proposal, 'effect_plan')) return [];
    const plan = proposal.effect_plan, step = plan.prefix[index], events: R[] = [];
    if (step.effect === 'unknown_then_observe') {
      const groups = before.level_epoch === after.level_epoch ? await this.patterns(Snapshot.fromPublic(before, first), Snapshot.fromPublic(after, last)) : {};
      const event = { kind: 'pre_score_effect_contact', trial_key: plan.trial_key, before_ref: before.observation_ref, after_ref: after.observation_ref,
        role: plan.role, action: action.action_ref, provisional_vector: step.to.map((v: number, i: number) => v - step.from[i]), input_status: step.input_status,
        expected_families: plan.remote_effect_families, matched_families: Object.keys(groups).filter(family => plan.remote_effect_families.includes(family)).sort(compareUnicode),
        score_delta: after.levels_completed - before.levels_completed };
      this.applyEvent(event); events.push(event);
    } else if (before.level_epoch === after.level_epoch && !this.after(proposal, index, first, last, { epoch: after.level_epoch, score: after.levels_completed, state: after.state }).matched) {
      const event = { kind: 'pre_score_displacement_refuted', premise_ref: step.premise_ref, before_ref: before.observation_ref, after_ref: after.observation_ref }; this.applyEvent(event); events.push(event);
    }
    return events;
  }
  state(): R {
    return structuredClone({ tried: [...this.tried].sort(compareUnicode), interventions: this.interventions, failed: [...this.failed].sort(compareUnicode),
      _changes: [...this.changes].map(([pair, groups]) => [JSON.parse(pair), groups]) });
  }
  restore(state: R): void {
    const value = structuredClone(state);
    if (!Array.isArray(value.tried) || !Array.isArray(value.failed) || !Array.isArray(value._changes) || value.interventions === null || typeof value.interventions !== 'object') throw new TypeError('Invalid effect-access state');
    const changes = new Map<string, ChangeFamilies>(value._changes.map(([pair, groups]: [string[], ChangeFamilies]) => [key(pair), groups]));
    this.tried.clear(); value.tried.forEach((trial: string) => this.tried.add(trial)); this.failed.clear(); value.failed.forEach((premise: string) => this.failed.add(premise));
    this.interventions = value.interventions; this.changes = changes;
  }
}

export { supportBox as support_box };
