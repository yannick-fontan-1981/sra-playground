/** Native scored_local_rewrite.py: revalidate learned local supports after scoring. */
import { compareUnicode } from './canonical.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { FactoredEffectAccess } from './v6-factored-return.ts';
import type { AccessBeforeMetadata, AccessAfterMetadata, AccessBeforeResult, AccessAfterResult } from './v6-effect-access.ts';
import type { CompositionRecord as R, CompositionObservation, CompositionCommand, CompositionTransition } from './v6-composition-memory.ts';
import type { NativeRows } from './v6-native-types.ts';

export function localRewrites(before: CompositionObservation, after: CompositionObservation): R[] {
  const lookup = new Map(after.entities.map(entity => [JSON.stringify([entity.bbox, identity(entity.mask)]), entity])), result: R[] = [];
  for (const entity of before.entities) {
    const box = entity.bbox, mask = identity(entity.mask), next = lookup.get(JSON.stringify([box, mask]));
    if (!next || next.palette_value === entity.palette_value) continue;
    result.push({ shape: mask, source: entity.palette_value, target: next.palette_value, size: [box[2] - box[0] + 1, box[3] - box[1] + 1] });
  }
  return result;
}

export function scoredModel(series: readonly R[], before: CompositionObservation, command: string): R | null {
  const byFamily = new Map<string, Map<string, Set<string>>>();
  for (const event of series) for (const row of event.rewrites) {
    const family = JSON.stringify([row.source, row.target, ...row.size]), shapes = byFamily.get(family) ?? new Map<string, Set<string>>();
    const actions = shapes.get(row.shape) ?? new Set<string>(); actions.add(event.action); shapes.set(row.shape, actions); byFamily.set(family, shapes);
  }
  const candidates: { rank: [number, number]; model: R }[] = [];
  for (const [family, observed] of byFamily) {
    const [source, target, width, height] = JSON.parse(family);
    if (observed.size < 2 || [...observed.values()].some(actions => actions.size !== 1)) continue;
    const labels = Object.fromEntries([...observed].map(([mask, actions]) => [mask, actions.values().next().value!]));
    if (new Set(Object.values(labels)).size !== Object.keys(labels).length || Object.values(labels).includes(command)) continue;
    const atBoundary = before.entities.filter(entity => entity.palette_value === source && entity.bbox[2] - entity.bbox[0] + 1 === width
      && entity.bbox[3] - entity.bbox[1] + 1 === height && !Object.hasOwn(labels, identity(entity.mask))).map(entity => identity(entity.mask));
    if (atBoundary.length !== 1) continue;
    candidates.push({ rank: [Object.keys(labels).length, width * height], model: { source, target, size: [width, height], labels,
      scoring_shape: atBoundary[0], boundary_action: command, epoch: before.level_epoch, boundary_ref: before.observation_ref, witnesses: series.map(sample => sample.before) } });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.rank[0] - a.rank[0] || b.rank[1] - a.rank[1]);
  const best = candidates.filter(candidate => equal(candidate.rank, candidates[0]!.rank)); return best.length === 1 ? best[0]!.model : null;
}

export class ScoredRewriteAccess extends FactoredEffectAccess {
  series: Record<string, R[]> = {};
  model: R | null = null;
  readonly refuted = new Map<string, [number, string]>();
  override applyEvent(event: R): void {
    if (event.kind === 'factored_rewrite_sample') (this.series[event.proposal] ??= []).push(event);
    else if (event.kind === 'factored_rewrite_scored') { this.model = event.model; this.series = {}; }
    else if (event.kind === 'scored_rewrite_test') { if (event.outcome === 'refuted') this.refuted.set(JSON.stringify([event.epoch, event.action]), [event.epoch, event.action]); }
    else super.applyEvent(event);
  }
  override retainedDigest(): string {
    return identity([super.retainedDigest(), this.series, this.model, [...this.refuted.values()].sort((a, b) => a[0] - b[0] || compareUnicode(a[1], b[1]))]);
  }
  override async record(before: CompositionObservation, command: CompositionCommand, after: CompositionObservation, rows: NativeRows,
    later: NativeRows, proposal: R, index: number): Promise<R[]> {
    const events = await super.record(before, command, after, rows, later, proposal, index); let event: R | null = null; const action = command.action_ref;
    if (truth(proposal.factor_plan)) {
      const key = proposal.proposal_id;
      if (before.level_epoch === after.level_epoch && proposal.factor_plan.steps.at(index).expected_after !== null) {
        if (this.after(proposal, index, rows, later, { epoch: after.level_epoch, score: after.levels_completed, state: after.state }).matched === true) {
          event = { kind: 'factored_rewrite_sample', proposal: key, before: before.observation_ref, action, rewrites: localRewrites(before, after) };
        }
      } else if (after.levels_completed > before.levels_completed) {
        const model = scoredModel(this.series[key] ?? [], before, action); if (model) event = { kind: 'factored_rewrite_scored', model, after: after.observation_ref };
      }
    } else if (truth(proposal.rewrite_plan)) {
      const result = this.after(proposal, index, rows, later, { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
      event = { kind: 'scored_rewrite_test', epoch: before.level_epoch, action,
        outcome: after.levels_completed > before.levels_completed ? 'official_progress' : result.matched ? 'matched' : 'refuted',
        before: before.observation_ref, after: after.observation_ref, predicted_sites: proposal.rewrite_plan.sites.length };
    }
    if (event !== null) { this.applyEvent(event); events.push(event); } return events;
  }
  override async propose(episode: readonly CompositionTransition[], observation: CompositionObservation, rows: NativeRows,
    inputs: readonly CompositionCommand[], maxPrefix: number, config: R): Promise<R> {
    const model = this.model;
    if (!truth(model) || !truth(config.rebind_scored_local_rewrites) || observation.level_epoch <= model!.epoch) return super.propose(episode, observation, rows, inputs, maxPrefix, config);
    const choices = new Map<string, R[]>(), labels = { ...model!.labels, [model!.scoring_shape]: model!.boundary_action };
    const available = new Set(inputs.filter(action => !truth(action.data)).map(action => action.action_ref));
    for (const entity of observation.entities) {
      const box = entity.bbox;
      if (entity.palette_value !== model!.source || !equal([box[2] - box[0] + 1, box[3] - box[1] + 1], model!.size)) continue;
      const signature = identity(entity.mask), action = labels[signature];
      if (available.has(action) && !this.refuted.has(JSON.stringify([observation.level_epoch, action]))) {
        const sites = choices.get(action) ?? []; sites.push({ origin: box.slice(0, 2), mask: entity.mask, shape: signature }); choices.set(action, sites);
      }
    }
    if (!choices.size) return super.propose(episode, observation, rows, inputs, maxPrefix, config);
    const [action, sites] = [...choices].sort(([a, left], [b, right]) => right.length - left.length || compareUnicode(a, b))[0]!;
    const plan = { sites, action, source: model!.source, target: model!.target, source_model: identity(model), epoch: observation.level_epoch,
      score: observation.levels_completed, observation_ref: observation.observation_ref,
      qualification: 'Prospective test of matching local supports at new positions; scoring witness alone did not show its post-rewrite.' };
    const reference = `C_test_scored_rewrite_${identity(plan).slice(0, 18)}`, command = { action_ref: action }, facts = { local_supports_measured: true, earlier_scoring_approach: true };
    const why = 'Test whether the input paired with this shape in a scored approach rewrites all its currently matching local occurrences.';
    const evidence = [observation.observation_ref, model!.boundary_ref, ...model!.witnesses];
    return { status: 'proposed', kind: 'public_scored_rewrite', proposal_id: reference, rewrite_plan: plan, actions: [command], steps: [{ action: command, expected_after: { sites, target: model!.target } }],
      facts, compositions: [{ id: reference, observed: false, role: 'local_rewrite_question', open_question: why, properties: { matches: sites.length, source_epoch: model!.epoch }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: 'revalidate_scored_local_shape_rewrite', hypothesis_refs: evidence }, route_refs: evidence,
      binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: reference, objective_ref: 'G_official_completion', preserve_refs: [], actions: [command], purpose: why, preconditions: facts, evidence,
        outcome_guard: { path: ['value'], contains: reference } } };
  }
  static holds(plan: R, rows: NativeRows, palette: number): boolean {
    return plan.sites.every((site: R) => site.mask.every(([dx, dy]: [number, number]) => rows[site.origin[1] + dy]![site.origin[0] + dx] === palette));
  }
  override before(proposal: R, index: number, rows: NativeRows, metadata: AccessBeforeMetadata): AccessBeforeResult {
    const plan = proposal.rewrite_plan; if (!truth(plan)) return super.before(proposal, index, rows, metadata);
    const admitted = index === 0 && metadata.epoch === plan.epoch && metadata.score === plan.score && metadata.observation_ref === plan.observation_ref
      && metadata.available.includes(plan.action) && ScoredRewriteAccess.holds(plan, rows, plan.source);
    return { admitted, reason: admitted ? 'current_local_masks_bound' : 'current_local_masks_or_scope_changed' };
  }
  override after(proposal: R, index: number, beforeRows: NativeRows, afterRows: NativeRows, metadata: AccessAfterMetadata): AccessAfterResult {
    const plan = proposal.rewrite_plan; if (!truth(plan)) return super.after(proposal, index, beforeRows, afterRows, metadata);
    if (metadata.epoch !== plan.epoch || metadata.score !== plan.score || ['WIN', 'GAME_OVER'].includes(metadata.state)) return { matched: null, seal_prefix: true, reason: 'official_boundary_or_terminal' };
    const matched = ScoredRewriteAccess.holds(plan, afterRows, plan.target);
    return { matched, seal_prefix: true, reason: matched ? 'all_relocated_local_masks_rewritten' : 'predicted_mask_rewrite_refuted' };
  }
  override state(): R { return structuredClone({ ...super.state(), series: this.series, model: this.model, refuted: [...this.refuted.values()].sort((a, b) => a[0] - b[0] || compareUnicode(a[1], b[1])) }); }
  override restore(state: R): void {
    const value = structuredClone(state); if (!Array.isArray(value.refuted) || value.series === null || typeof value.series !== 'object') throw new TypeError('Invalid scored-rewrite state');
    const refuted = new Map<string, [number, string]>(value.refuted.map((pair: [number, string]) => [JSON.stringify(pair), pair]));
    super.restore(value); this.series = value.series; this.model = value.model; this.refuted.clear(); for (const [key, pair] of refuted) this.refuted.set(key, pair);
  }
}

export { localRewrites as local_rewrites, scoredModel as scored_model };
