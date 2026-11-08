/**
 * CellPlacementAccess's own layer from pinned V6 source 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 * The shared owner retains the original acquired-before-packet ordering. This
 * layer never receives game identities, authored boards or opponent internals.
 */
import { cellPatchCenter, cellPatchChanges, measureCellPatchFields, projectCellPatch } from './v6-cell-patch-observation.ts';
import type { CellPatchGeometry } from './v6-cell-patch-observation.ts';
import { lineWindows, searchLines, NativeLineSearchDomainError } from './v6-supported-lines.ts';
import { closedObservedPathReturn } from './v6-observed-frontier.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { compareUnicode } from './canonical.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
export interface CellPlacementState {
  cell_models: R; cell_geometries: CellPatchGeometry[]; cell_events: R[];
  cell_refused: string[]; cell_paths: R; cell_returns: R;
}
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state: string };
const copy = <T>(value: T): T => structuredClone(value);
function independent<T>(value: T): T {
  if (Array.isArray(value)) return value.map(independent) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, independent(child)])) as T;
  return value;
}
const pointOrder = (a: readonly number[], b: readonly number[]): number => a[0]! - b[0]! || a[1]! - b[1]!;

export function cellPlacementBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const plan = proposal.cell_placement_plan;
  if (!truth(plan)) throw new TypeError('Cell admission requires a cell_placement_plan');
  const admitted = index === 0 && equal([meta.epoch, meta.score, meta.observation_ref], [plan.epoch, plan.score, plan.observation_ref])
    && identity(rows) === plan.frame_digest && equal(proposal.actions, [plan.command]) && equal(proposal.bundle_template.actions, proposal.actions)
    && meta.available.includes(plan.command.action_ref) && equal(cellPatchCenter(plan.field.geometry, plan.point), [plan.command.data.x, plan.command.data.y]);
  return { admitted, reason: admitted ? 'current_cell_patch_point_bound' : 'cell_context_or_point_changed' };
}

export function cellPlacementAfter(proposal: R, _index: number, _rows: NativeRows, later: NativeRows,
  meta: AfterMeta, paths: R = {}): R {
  const plan = proposal.cell_placement_plan;
  if (!truth(plan)) throw new TypeError('Cell outcome requires a cell_placement_plan');
  if (meta.epoch !== plan.epoch || meta.score !== plan.score || ['WIN', 'GAME_OVER'].includes(meta.state)) {
    return { matched: null, seal_prefix: true, reason: 'official_boundary_or_terminal' };
  }
  const field = projectCellPatch(later, plan.field.geometry), [x, y] = plan.point, expected = plan.expected_motif;
  const matched = expected === null ? null : Boolean(field && field.grid[y][x] === expected);
  const key = `${plan.epoch}:${plan.field.ref}`;
  if (matched === false) {
    const digest = identity(later);
    if ((paths[key] ?? []).some((edge: R) => edge.before_frame === digest)) {
      return { matched: null, seal_prefix: true, reason: 'observed_whole_view_return_requires_dated_local_reconciliation' };
    }
  }
  return { matched, seal_prefix: true, reason: 'cell_and_remote_response_require_reconciliation' };
}

export class CellPlacementMemory {
  private models: R = {};
  private geometries: CellPatchGeometry[] = [];
  private events: R[] = [];
  private refused = new Set<string>();
  private paths: R = {};
  private returns: R = {};
  private version = 0;
  get nativeRevision(): number { return this.version; }

  applyEvent(event: R): void {
    if (event.kind !== 'cell_patch_placement_evidence') throw new TypeError(`Outside cell placement layer: ${String(event.kind)}`);
    if (!event.models || typeof event.models !== 'object' || !Array.isArray(event.geometries) || !Array.isArray(event.refused)) {
      throw new TypeError('Cell patch evidence lacks its complete current projection');
    }
    const owned = retainNativeJson(event);
    this.version++; this.models = owned.models; this.geometries = owned.geometries; this.refused = new Set(owned.refused);
    this.paths = owned.paths ?? {}; this.returns = owned.returns ?? {}; this.events.push(owned);
  }

  private emitProjection(detail: R, models: R, geometries: CellPatchGeometry[], refused: Set<string>, paths: R, returns: R): R {
    const event = { kind: 'cell_patch_placement_evidence', models, geometries, refused: [...refused].sort(compareUnicode), paths, returns, detail };
    this.applyEvent(event); return independent(event);
  }
  emitCell(detail: R): R {
    return this.emitProjection(detail, this.models, this.geometries, this.refused, this.paths, this.returns);
  }

  /**
   * `base` is the already evaluated inherited result. The native cell-only DRM
   * entry enables no unported ancestor proposal; its original base abstains.
   */
  proposeCell(observation: R, rows: NativeRows, _inputs: readonly R[], maxPrefix: number, config: R,
    base: R = { status: 'abstained', reason: 'no_recurrent_line_question' }): R {
    if (base.status === 'proposed' && !(base.kind === 'public_occurrence_recall' && base.question?.reason === 'test_observed_enclosing_emphasis')) return base;
    const cfg = config.cell_placement_question;
    if (!truth(cfg) || maxPrefix < 1 || !observation.available_action_refs.includes('ACTION6')) return base;
    const options: R[] = [];
    let portabilityRefused = false;
    for (const field of measureCellPatchFields(rows, this.geometries)) {
      const empty = field.empty_hypothesis, key = `${observation.level_epoch}:${field.ref}`, model: R | null = this.models[key] ?? null;
      const trial = identity([observation.level_epoch, field.ref, field.grid]), [nx, ny] = field.geometry.shape;
      if (empty === null || this.refused.has(trial)) continue;
      const vacant = (field.grid as string[][]).flatMap((row, y) => row.flatMap((value, x) => value === empty ? [[x, y]] : []));
      if (!vacant.length) continue;
      const length = Math.min(nx, ny), windows = lineWindows(field.grid, length);
      let search: R | null = null, reason = 'test_pointed_cell_patch_and_dated_response', predicted: string | null = null, point: number[];
      if (truth(model) && model!.status === 'candidate' && model!.empty === empty && Object.hasOwn(field.motifs, model!.other)) {
        if (vacant.length > cfg.free_search_empty_bound) continue;
        let ranked: R[], result: R;
        try {
          [ranked, result] = searchLines(field.grid, model!.own, model!.other, empty, length, null, 0, Math.min(vacant.length, cfg.reply_plies));
        } catch (error) {
          if (!(error instanceof NativeLineSearchDomainError)) throw error;
          // This is a native portability refusal, not an acquired source
          // counterexample. Other measured fields and providers remain usable.
          portabilityRefused = true; continue;
        }
        search = result;
        const best = ranked[0]!.value, ties = ranked.filter(candidate => candidate.value === best), returns = this.returns[key] ?? {};
        for (const candidate of ties) candidate.observed_return_count = (returns[identity([field.grid, candidate.point])] ?? []).length;
        const selected = [...ties].sort((a, b) => a.observed_return_count - b.observed_return_count || ranked.indexOf(a) - ranked.indexOf(b))[0]!;
        point = selected.point;
        search.return_contrast = { selected_count: selected.observed_return_count, tie_count: ties.length, choice_changed: !equal(point, ranked[0]!.point),
          alternatives: ties.map(candidate => ({ point: candidate.point, observed_return_count: candidate.observed_return_count })),
          evidence_refs: [...new Set<string>(ties.flatMap(candidate => returns[identity([field.grid, candidate.point])] ?? []))].sort(compareUnicode) };
        predicted = model!.own;
        reason = search.return_contrast.choice_changed ? 'contrast_equivalent_line_preparations_after_observed_return' : 'prepare_visible_line_under_observed_local_and_remote_additions';
        search.scope = 'Existing finite-horizon line search with a free-cell experimental domain. Full visible span and symmetric adverse objective are hypotheses; leaf values are weighted window heuristics, not proven wins.';
      } else {
        const ranked = vacant.map(candidate => ({ point: candidate,
          count: windows.filter(window => window.some(point => pointOrder(point, candidate) === 0)).length }));
        point = ranked.reduce((best, candidate) => candidate.count > best.count
          || candidate.count === best.count && pointOrder(candidate.point, best.point) < 0 ? candidate : best).point;
      }
      options.push({ unmodeled: model === null, field, point, model, trial, predicted, reason, search, length });
    }
    if (!options.length) return portabilityRefused && base.status !== 'proposed'
      ? { status: 'abstained', reason: 'native_cell_line_search_integer_domain', native_portability_refusal: true,
        scope: 'Python integer scores exceed the native exact-integer domain; no rounded rank or source-law refutation is retained.' } : base;
    options.sort((a, b) => Number(a.unmodeled) - Number(b.unmodeled) || a.field.geometry.origin[1] - b.field.geometry.origin[1]
      || a.field.geometry.origin[0] - b.field.geometry.origin[0]);
    const { field, point, model, trial, predicted, reason, search, length } = options[0]!, pixel = cellPatchCenter(field.geometry, point);
    const action = { action_ref: 'ACTION6', data: { x: pixel[0]!, y: pixel[1]! } };
    const plan = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
      frame_digest: identity(rows), field, point, pixel, command: copy(action), trial, expected_motif: predicted, model,
      goal_length_hypothesis: length, search,
      scope: 'Current exact cell patch and point. Empty role, local placement and alternating response require observed effects; full-span goal remains a hypothesis until official progression.' };
    const ref = `C_cell_placement_${identity(plan).slice(0, 18)}`, why = cfg.question;
    const evidence = [observation.observation_ref, ...(model?.evidence ?? []), ...(search?.return_contrast?.evidence_refs ?? [])];
    const facts = { framed_repeated_cell_geometry: true, current_point_measured: true, goal_and_free_placement_are_hypotheses: true };
    return independent({ status: 'proposed', kind: 'cell_patch_placement', proposal_id: ref, cell_placement_plan: plan, actions: [action],
      steps: [{ action, expected_after: { local_patch: predicted, response: 'compatible observed motif or unknown', official_progress_required: true } }],
      facts, compositions: [{ id: ref, observed: false, open_question: why, properties: { roles: cfg.roles, goal_length_hypothesis: length },
        relations: ['contributes_to:G_official_completion'] }], question: { reason, hypothesis_refs: evidence }, route_refs: evidence,
      binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions: [action],
        purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } });
  }

  after(proposal: R, index: number, rows: NativeRows, later: NativeRows, meta: AfterMeta): R {
    return cellPlacementAfter(proposal, index, rows, later, meta, this.paths);
  }

  /** Source record suffix. All mutations become authoritative in one event. */
  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, index: number): R[] {
    const plan = proposal.cell_placement_plan;
    if (!truth(plan)) return [];
    if (!equal(command, plan.command)) throw new TypeError('Cell point differs from committed command');
    const geometry = plan.field.geometry as CellPatchGeometry;
    const geometries = this.geometries.some(current => equal(current, geometry)) ? this.geometries : [...this.geometries, copy(geometry)];
    const outcome = this.after(proposal, index, rows, later, { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    const key = `${before.level_epoch}:${plan.field.ref}`, unchanged = equal(rows, later), refused = new Set(this.refused);
    let models = this.models, paths = this.paths, returns = this.returns, returned: R | null = null;
    if (unchanged) refused.add(plan.trial);
    if (outcome.matched === false && Object.hasOwn(models, key)) models = { ...models, [key]: { ...models[key], status: 'refuted', counterexample: after.observation_ref } };
    const last = projectCellPatch(later, geometry);
    if (last && after.level_epoch === before.level_epoch && after.levels_completed === before.levels_completed) {
      const path = [...(paths[key] ?? []), { before_key: identity(plan.field.grid), after_key: identity(last.grid), before_frame: identity(rows),
        after_ref: after.observation_ref, choice_key: identity([plan.field.grid, plan.point]), command }];
      returned = closedObservedPathReturn(path); paths = { ...paths, [key]: path };
      if (returned) {
        const current = { ...(returns[key] ?? {}) };
        for (const edge of returned.path as R[]) current[edge.choice_key] = [...(current[edge.choice_key] ?? []), after.observation_ref];
        returns = { ...returns, [key]: current }; paths[key] = [];
      }
    }
    return [this.emitProjection({ before_ref: before.observation_ref, after_ref: after.observation_ref, command,
      field_ref: plan.field.ref, outcome, canonical_unchanged: unchanged, observed_return: returned }, models, geometries, refused, paths, returns)];
  }

  /** Dated stable local then remote patches; canonical endpoints alone do not suffice. */
  recordPacket(before: R, command: R, after: R, rows: NativeRows, frames: readonly NativeRows[]): R[] {
    if (command.action_ref !== 'ACTION6' || !truth(command.data) || frames.length < 2) return [];
    const events: R[] = [];
    for (const field of measureCellPatchFields(rows, this.geometries)) {
      const geometry = field.geometry as CellPatchGeometry;
      const points = (field.grid as string[][]).flatMap((row, y) => row.flatMap((_value, x) =>
        equal(cellPatchCenter(geometry, [x, y]), [command.data.x, command.data.y]) ? [[x, y]] : []));
      if (points.length !== 1 || field.empty_hypothesis === null) continue;
      const [x, y] = points[0]! as [number, number], empty = field.grid[y][x];
      if (empty !== field.empty_hypothesis) continue;
      const projections = frames.map(frame => projectCellPatch(frame, geometry));
      let own: string | null = null, ownTick: number | null = null, other: string | null = null, otherTick: number | null = null;
      for (let tick = 0; tick < projections.length - 1; tick++) {
        const a = projections[tick], b = projections[tick + 1];
        if (!a || !b || !equal(a.grid, b.grid)) continue;
        const delta = cellPatchChanges(field, a)!;
        const local = delta.filter(change => change[0] === x && change[1] === y && change[2] === empty);
        const remote = delta.filter(change => change[0] !== x || change[1] !== y);
        if (local.length === 1 && !remote.length && !a.motifs[local[0]![3] as string].uniform && own === null) {
          own = local[0]![3] as string; ownTick = tick;
        }
        if (own !== null && tick > ownTick! && local.length === 1 && local[0]![3] === own && remote.length === 1
          && remote[0]![2] === empty && remote[0]![3] !== own) { other = remote[0]![3] as string; otherTick = tick; break; }
      }
      if (own === null || other === null) continue;
      const key = `${before.level_epoch}:${field.ref}`, prior = this.models[key];
      let entry: R = { status: 'candidate', epoch: before.level_epoch, field_ref: field.ref, own, other, empty,
        evidence: [before.observation_ref, after.observation_ref], ordered_frames: [ownTick, otherTick],
        scope: 'Stable local patch precedes one remote stable patch in this returned packet. Free-placement and symmetric line-goal law remain conditional.' };
      if (truth(prior) && (prior.status === 'refuted' || !equal([prior.own, prior.other, prior.empty], [own, other, empty]))) {
        entry = { status: 'refuted', counterexamples: [prior, entry] };
      }
      events.push(this.emitProjection({ before_ref: before.observation_ref, after_ref: after.observation_ref, command,
        dated_order: [ownTick, otherTick], model_status: entry.status }, { ...this.models, [key]: entry }, this.geometries, this.refused, this.paths, this.returns));
    }
    return events;
  }

  state(): CellPlacementState {
    return independent({ cell_models: this.models, cell_geometries: this.geometries, cell_events: this.events,
      cell_refused: [...this.refused].sort(compareUnicode), cell_paths: this.paths, cell_returns: this.returns });
  }
  retainedDigest(parentDigest: string): string {
    return identity([parentDigest, this.models, this.geometries, this.events, [...this.refused].sort(compareUnicode), this.paths, this.returns]);
  }
  restore(state: CellPlacementState): void {
    if (!state || !state.cell_models || !Array.isArray(state.cell_geometries) || !Array.isArray(state.cell_events)
      || !Array.isArray(state.cell_refused) || !state.cell_paths || !state.cell_returns) throw new TypeError('Incomplete cell patch memory');
    const rebuilt = new CellPlacementMemory();
    for (const event of state.cell_events) rebuilt.applyEvent(event);
    if (identity(rebuilt.state()) !== identity(state)) throw new TypeError('Cell patch state differs from its complete event journal');
    this.models = rebuilt.models; this.geometries = rebuilt.geometries; this.events = rebuilt.events; this.refused = rebuilt.refused;
    this.paths = rebuilt.paths; this.returns = rebuilt.returns; this.version++;
  }
}
