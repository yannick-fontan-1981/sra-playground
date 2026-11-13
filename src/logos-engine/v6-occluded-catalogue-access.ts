/** CatalogueAccess + CatalogueViewMemory own layers, with common current guards. */
import { measureOccludedCatalogue, fitOccludedCatalogue, exposedCatalogueValues, catalogueStructure, catalogueFieldPixels } from './v6-occluded-catalogue-observation.ts';
import { certifyOccludedCatalogue } from './v6-occluded-catalogue-mechanics.ts';
import { ViewFrontier } from './v6-view-frontier.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { projection, rowsDigest, type ObservedInputDomain } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Clock = () => number;
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };
export interface OccludedCatalogueState {
  catalogue_events: R[];
  catalogue_backgrounds: Record<string, number[]>;
  catalogue_candidates: Record<string, number[]>;
  catalogue_answered: Record<string, number[]>;
  catalogue_blocked: string[];
  catalogue_view_events: R[];
  requested_stop_reason: string | null;
}
const numeric = (a: number, b: number): number => a - b;
const uniqueNumbers = (items: number[]): number[] => [...new Set(items)].sort(numeric);
const expectedBefore = (obs: R): R => Object.fromEntries(['level_epoch', 'frame_hash', 'levels_completed', 'state'].map(key => [key, obs[key]]));

export class OccludedCatalogueMemory {
  private events: R[] = [];
  private backgrounds: Record<string, number[]> = {};
  private candidates: Record<string, number[]> = {};
  private answered: Record<string, number[]> = {};
  private blocked: string[] = [];
  private viewEvents: R[] = [];
  private stopReason: string | null = null;
  private version = 0;
  get nativeRevision(): number { return this.version; }
  get requestedStopReason(): string | null { return this.stopReason; }
  currentState(): OccludedCatalogueState {
    return structuredClone({ catalogue_events: this.events, catalogue_backgrounds: this.backgrounds, catalogue_candidates: this.candidates,
      catalogue_answered: this.answered, catalogue_blocked: this.blocked, catalogue_view_events: this.viewEvents, requested_stop_reason: this.stopReason });
  }
  /** The actual source composes two own layers; its inherited hierarchy is external. */
  retainedCatalogueDigest(ancestor: string): string { return identity([ancestor, this.events, this.backgrounds, this.candidates, this.answered, this.blocked]); }
  retainedDigest(ancestor: string): string { return identity([this.retainedCatalogueDigest(ancestor), this.viewEvents]); }
  applyEvent(event: R): void {
    if (!['catalogue_observation', 'catalogue_response', 'catalogue_field_input_observed'].includes(event.kind)) throw new TypeError(`Outside catalogue layer: ${String(event.kind)}`);
    const owned = retainNativeJson(event); this.version++;
    if (owned.kind === 'catalogue_field_input_observed') { this.viewEvents.push(owned); return; }
    this.events.push(owned);
    if (owned.kind === 'catalogue_observation') {
      this.backgrounds[owned.field_key] = owned.backgrounds; this.candidates[owned.catalogue_key] = owned.candidate_ids; return;
    }
    if (owned.mode === 'answer') this.answered[owned.field_key] = [...(this.answered[owned.field_key] ?? []), owned.palette];
    else if (!owned.selection_matched) this.blocked.push(owned.trial_key);
  }
  keys(observation: R, scene: R): [string, string] {
    const field = identity([observation.level_epoch, scene.field]);
    return [field, identity([field, scene.palette, (scene.cards as R[]).map(card => [card.mask, card.extent])])];
  }

  /** Ancestor fallback is explicit. This routine does not invent a first view input. */
  async proposeCatalogue(observation: R, rows: NativeRows, inputs: readonly R[], maxPrefix: number, config: R,
    deadlineMs: number, now: Clock = () => performance.now(), base: R | null = { status: 'abstained', reason: 'no_recurrent_line_question' }): Promise<R | null> {
    const cfg = config.occluded_catalogue_question;
    let scene: R | null = null;
    if (truth(cfg) && maxPrefix && observation.available_action_refs.includes('ACTION6')) {
      scene = measureOccludedCatalogue(rows);
      if (scene) {
        const [field, key] = this.keys(observation, scene), bg = this.backgrounds[field] ?? [], answered = this.answered[field] ?? [];
        if (answered.includes(scene.palette)) {
          const alternatives = (scene.controls as R[]).filter(control => !answered.includes(control.palette));
          if (alternatives.length) {
            const target = alternatives[0]!, trial = identity([observation.level_epoch, rows, target.point]);
            if (!this.blocked.includes(trial)) return this.proposal(observation, rows, scene, target.point, 'select', target.palette, null, field, key, cfg);
          } else if (this.stopReason !== 'catalogue_combination_has_no_official_confirmation') {
            this.stopReason = 'catalogue_combination_has_no_official_confirmation'; this.version++;
          }
        } else if (bg.length) {
          let fits = fitOccludedCatalogue(rows, scene, bg);
          const prior = this.candidates[key] ?? null;
          if (prior !== null) fits = fits.filter(fit => prior.includes(fit.candidate));
          const ids = uniqueNumbers(fits.map(fit => fit.candidate));
          if (ids.length === 1) {
            const result = certifyOccludedCatalogue(scene, rows, observation, bg, fits, deadlineMs, now);
            if (result && result.status === 'COMPLETE' && truth(result.values.consistent_model_refs)) {
              const evidence = { receipt: result, pose_alternatives: fits, prior_candidate_ids: prior, backgrounds: bg, candidate: ids[0] };
              return this.proposal(observation, rows, scene, scene.cards[ids[0]!].point, 'answer', scene.palette, evidence, field, key, cfg);
            }
          }
        }
      }
    }
    // Source CatalogueViewMemory first lets its complete ancestor chain offer.
    if (base && Object.hasOwn(base, 'occluded_catalogue_plan')) return base;
    scene ??= measureOccludedCatalogue(rows);
    if (!scene || !maxPrefix || !truth(cfg)) return base;
    const [field, key] = this.keys(observation, scene);
    if ((this.answered[field] ?? []).includes(scene.palette)) return base;
    const bg = this.backgrounds[field] ?? [], prior = this.candidates[key] ?? null;
    const fits = bg.length ? fitOccludedCatalogue(rows, scene, bg) : [];
    const ids = uniqueNumbers(fits.filter(fit => prior === null || prior.includes(fit.candidate)).map(fit => fit.candidate));
    if (bg.length && ids.length < 2) return base;
    const events = this.viewEvents.filter(event => event.field_key === field), available = new Map<string, R>();
    for (const action of inputs) if (!truth(action.data)) {
      const command = { action_ref: action.action_ref }; available.set(identity(command), command);
    }
    const options: { attempts: number; key: string; command: R; witnesses: R[] }[] = [];
    const actionKeys = [...new Set(events.filter(event => event.field_changed && event.structure_preserved).map(event => identity(event.command)))].sort();
    for (const keyAction of actionKeys) {
      const command = available.get(keyAction); if (!command) continue;
      const current = identity([catalogueFieldPixels(rows, scene), catalogueStructure(scene)]);
      if (events.some(event => equal(event.command, command) && event.before_context === current)) continue;
      const witnesses = events.filter(event => equal(event.command, command) && event.field_changed && event.structure_preserved);
      const attempts = events.filter(event => equal(event.command, command) && event.catalogue_key === key).length;
      options.push({ attempts, key: keyAction, command, witnesses });
    }
    if (!options.length) return base;
    options.sort((a, b) => a.attempts - b.attempts || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const { command, witnesses } = options[0]!, reason = 'obtain_a_discriminating_view_for_current_ambiguous_catalogue';
    const details = { candidate_ids: ids, catalogue_key: key, field_key: field,
      evidence_refs: [...new Set<string>(witnesses.flatMap(event => event.evidence))].sort(),
      expected_effect: 'Previously field-changing input; current effect and discrimination remain hypotheses.',
      falsifier: 'No field change, changed catalogue geometry, contradiction, or no candidate reduction.', terminal_role: 'unknown' };
    const step = { action: command, expected_before: expectedBefore(observation), expected_after: null };
    const form = await new ViewFrontier().form(observation, 'catalogue_view_experiment', [command], [step], details, reason);
    delete form.view_plan; form.kind = 'catalogue_view_experiment';
    form.occluded_catalogue_plan = { mode: 'view', epoch: observation.level_epoch, score: observation.levels_completed,
      observation_ref: observation.observation_ref, frame_digest: identity(rows), command: { ...command }, scene, details };
    return structuredClone(form);
  }

  proposal(observation: R, rows: NativeRows, scene: R, point: number[], mode: string, target: number, evidence: R | null, field: string, key: string, cfg: R): R {
    const supporting = this.events.filter(event => event.field_key === field);
    evidence = { ...(evidence ?? {}), supporting_event_digests: supporting.map(event => identity(event)),
      supporting_observation_refs: [...new Set<string>(supporting.flatMap(event => event.evidence))].sort() };
    const action = { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } };
    const plan = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
      frame_digest: identity(rows), field_key: field, catalogue_key: key, trial_key: identity([observation.level_epoch, rows, point]),
      scene, point, mode, target_palette: target, evidence,
      scope: 'Reference/selection/response roles and shape invariance are hypotheses. Known reciprocal replacement supports a conditional substrate reading; all other field values remain unknown. Individual response is not correctness feedback.' };
    const ref = 'C_catalogue_' + identity(plan).slice(0, 20), why = mode === 'select' ? cfg.select_question : cfg.answer_question;
    const facts = { current_catalogue_and_control_geometry: true, current_point_bound: true, finite_comparison_or_control_experiment: true };
    return structuredClone({ status: 'proposed', kind: 'occluded_catalogue_experiment', proposal_id: ref, occluded_catalogue_plan: plan, actions: [action],
      steps: [{ action, expected_after: null }], facts, compositions: [{ id: ref, observed: false, open_question: why, properties: { roles: cfg.roles }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: mode === 'select' ? 'test_catalogue_selection' : 'test_uniquely_compatible_partial_projection', hypothesis_refs: [] }, route_refs: [observation.observation_ref],
      binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref }, bundle_template: { operation_key: 'OP18', composition_ref: ref,
        objective_ref: 'G_official_completion', preserve_refs: [], actions: [action], purpose: why, preconditions: facts, evidence: [observation.observation_ref], outcome_guard: { path: ['value'], contains: ref } } });
  }

  /** The shared owner calls ancestor acquisition first, then these two source layers. */
  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, _index: number): R[] {
    const events: R[] = [], rawPlan = proposal.occluded_catalogue_plan, plan = rawPlan?.mode === 'view' ? null : rawPlan;
    const scene = measureOccludedCatalogue(rows), current = after.level_epoch === before.level_epoch ? measureOccludedCatalogue(later) : null;
    if (scene && current && equal(scene.field, current.field)) {
      const [field, key] = this.keys(after, current); let bg = this.backgrounds[field] ?? [];
      if (scene.palette === current.palette && equal((scene.cards as R[]).map(card => [card.mask, card.extent]), (current.cards as R[]).map(card => [card.mask, card.extent]))) {
        bg = uniqueNumbers([...bg, ...exposedCatalogueValues(rows, later, scene)]);
      }
      if (bg.length) {
        const fits = fitOccludedCatalogue(later, current, bg), previous = this.candidates[key] ?? null;
        let ids = uniqueNumbers(fits.map(fit => fit.candidate)); if (previous !== null) ids = ids.filter(id => previous.includes(id));
        const event = { kind: 'catalogue_observation', field_key: field, catalogue_key: key, epoch: after.level_epoch, palette: current.palette,
          backgrounds: bg, candidate_ids: ids, current_pose_alternatives: fits.filter(fit => ids.includes(fit.candidate)), evidence: [before.observation_ref, after.observation_ref], command,
          scope: 'Conditional catalogue identity and reciprocal exposed-value substrate; other palettes remain unobserved. Empty set is contradiction, not permission to guess.' };
        this.applyEvent(event); events.push(event);
      }
    }
    if (plan) {
      const event = { kind: 'catalogue_response', field_key: plan.field_key, palette: plan.scene.palette, mode: plan.mode, trial_key: plan.trial_key,
        selection_matched: current !== null && current.palette === plan.target_palette, official_progress: after.levels_completed > before.levels_completed,
        evidence: [before.observation_ref, after.observation_ref], command, scope: 'Submission recorded, correctness remains global/unknown until official progress.' };
      this.applyEvent(event); events.push(event);
    }
    if (scene && current && equal(scene.field, current.field) && !truth(command.data)) {
      const [field, key] = this.keys(before, scene);
      const event = { kind: 'catalogue_field_input_observed', field_key: field, catalogue_key: key, epoch: before.level_epoch, command,
        before_context: identity([catalogueFieldPixels(rows, scene), catalogueStructure(scene)]),
        field_changed: !equal(catalogueFieldPixels(rows, scene), catalogueFieldPixels(later, current)),
        structure_preserved: equal(catalogueStructure(scene), catalogueStructure(current)), evidence: [before.observation_ref, after.observation_ref],
        scope: 'Observed input and field delta, not a universal movement law or a promised informative outcome.' };
      this.applyEvent(event); events.push(event);
    }
    return events;
  }
}

export async function commonOccludedCatalogueProposal(memory: OccludedCatalogueMemory, observation: R, rows: NativeRows, inputs: readonly R[], remaining: number,
  config: R, deadlineMs: number | null, now: Clock = () => performance.now(), base?: R | null): Promise<R | null> {
  if (remaining < 1 || !observation.available_action_refs.includes('ACTION6') || !measureOccludedCatalogue(rows)) return null;
  if (deadlineMs === null || deadlineMs === undefined) throw new TypeError('Catalogue projection requires current level deadline');
  const proposal = await memory.proposeCatalogue(observation, rows, inputs, Math.min(16, remaining), { ...config, remaining_level_actions: remaining }, deadlineMs, now, base);
  if (!proposal || !Object.hasOwn(proposal, 'occluded_catalogue_plan') || proposal.occluded_catalogue_plan.mode === 'view') return null;
  const plan = proposal.occluded_catalogue_plan, scene = plan.scene, step = proposal.steps[0], [x, y] = plan.point;
  step.expected_before = expectedBefore(observation);
  const box = plan.mode === 'answer' ? scene.cards[plan.evidence.candidate].bbox
    : (scene.controls as R[]).find(control => control.palette === plan.target_palette && equal(control.point, plan.point))!.bbox;
  step.point_support = { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref, frame_hash: observation.frame_hash,
    point: [x, y], palette_value: rows[y]![x], projection_bbox: box, projected_rows_digest: await rowsDigest(projection(rows, box)),
    entity_ref: 'measured-catalogue-control:' + identity([plan.mode, box, plan.target_palette]), signature: identity([scene.geometry_ref, plan.mode, plan.target_palette]),
    scope: 'Current measured catalogue member or same-palette selector; response correctness remains unknown until official global progress.' };
  return proposal;
}

export async function commonCatalogueViewProposal(memory: OccludedCatalogueMemory, observation: R, rows: NativeRows, inputs: readonly R[], remaining: number,
  config: R, deadlineMs: number | null, now: Clock = () => performance.now(), base?: R | null): Promise<R | null> {
  if (remaining < 1 || deadlineMs === null || deadlineMs === undefined) return null;
  const proposal = await memory.proposeCatalogue(observation, rows, inputs, Math.min(16, remaining), { ...config, remaining_level_actions: remaining }, deadlineMs, now, base);
  return proposal?.occluded_catalogue_plan?.mode === 'view' ? proposal : null;
}

export function bindOccludedCatalogue(proposal: R, domain: ObservedInputDomain): void {
  if (proposal.occluded_catalogue_plan?.mode === 'view') {
    if ((proposal.actions as R[]).some(action => truth(action.data))) throw new TypeError('Catalogue view experiment acquired point data');
    return;
  }
  const first = proposal.steps[0].expected_before;
  if (!domain.bindings.has(`${first.level_epoch}:${first.frame_hash}`)) throw new TypeError('Catalogue point needs the current observed input domain');
  for (const [index, action] of (proposal.actions as R[]).entries()) {
    const step = proposal.steps[index], support = step.point_support;
    if (!equal(support.point, [action.data.x, action.data.y])) throw new TypeError('Catalogue point payload changed');
    step.point_binding = { ...support };
  }
}

export function occludedCatalogueBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const plan = proposal.occluded_catalogue_plan;
  if (!truth(plan)) throw new TypeError('Catalogue guard requires occluded_catalogue_plan');
  const view = plan.mode === 'view', command = view ? plan.command : { action_ref: 'ACTION6', data: { x: plan.point[0], y: plan.point[1] } };
  const admitted = index === 0 && meta.epoch === plan.epoch && meta.score === plan.score && meta.observation_ref === plan.observation_ref
    && identity(rows) === plan.frame_digest && meta.available.includes(command.action_ref)
    && equal(proposal.actions, [command]) && equal(proposal.bundle_template.actions, [command]);
  return { admitted, reason: view ? admitted ? 'current_catalogue_view_experiment' : 'catalogue_view_binding_changed'
    : admitted ? 'current_catalogue_point_bound' : 'catalogue_context_or_payload_changed' };
}

export function occludedCatalogueAfter(proposal: R, _index: number, rows: NativeRows, later: NativeRows, meta: AfterMeta): R {
  const plan = proposal.occluded_catalogue_plan;
  if (!truth(plan)) throw new TypeError('Catalogue outcome requires occluded_catalogue_plan');
  if (plan.mode === 'view') {
    const scene = meta.epoch === plan.epoch ? measureOccludedCatalogue(later) : null;
    const changed = scene !== null && !equal(catalogueFieldPixels(rows, plan.scene), catalogueFieldPixels(later, scene));
    return { matched: null, seal_prefix: true, reason: changed ? 'field_changed_requires_catalogue_recomparison' : 'field_change_unconfirmed', official_progress: meta.score > plan.score };
  }
  const progressed = meta.score > plan.score, scene = progressed ? null : measureOccludedCatalogue(later);
  const matched = plan.mode === 'select' ? scene !== null && scene.palette === plan.target_palette : null;
  return { matched, seal_prefix: true, reason: plan.mode === 'select' ? 'catalogue_selector_response' : 'catalogue_submission_without_local_correctness_claim', official_progress: progressed };
}
