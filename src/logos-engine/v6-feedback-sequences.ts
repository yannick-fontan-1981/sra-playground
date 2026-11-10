/**
 * Native transfer of V6 feedback_sequences/family.py at
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. Both router entries share this owner.
 */
import { canonical } from './canonical.ts';
import { projection, rowsDigest, v6Digest, type LocusWitness, type ObservedInputDomain } from './v6-native-observer.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES } from './v6-src-program.ts';
import { chooseFeedbackTrialCooperative, type FeedbackConfiguration } from './v6-feedback-sequences-finite.ts';
import { feedbackBorder, feedbackMatches, feedbackPalette, feedbackValues, initialFeedbackLayout,
  type FeedbackHistoryRow, type FeedbackLayout, type FeedbackSlotRow } from './v6-feedback-sequences-visual.ts';
import type { JsonObject, JsonValue } from './ir.ts';
import type { NativeCommand, NativeExecution, NativeObservation, NativeProgramHandle, NativeProgramRegistry,
  NativeProposal, NativePublicObservation, NativeRecord, NativeRows } from './v6-native-types.ts';

interface FeedbackEntryEvidence extends NativeRecord {
  ref: string; before: string; value: number; action: NativeCommand; repeatable: boolean | null;
}
interface FeedbackEntryMethod extends NativeRecord {
  kind: string; source_epoch: number; size: [number, number]; pitch: number; slot_row_count: number; active_order: number;
  append_evidence: string[]; submit_evidence: string; submit_action: NativeCommand | null;
  palette_mode_at_source: boolean | null; status: string;
}
interface FeedbackStep extends NativeRecord {
  action: NativeCommand; kind: 'ADD' | 'SUBMIT' | 'CONTROL_WHEN_FULL'; value?: number;
  prefix_before: number[]; palette_before: [number, number][];
  expected_after: { prefix: number[]; palette_values: number[] } | null;
  palette_projection_bbox?: [number, number, number, number]; palette_projection_sha?: string;
  point_binding?: LocusWitness & { source_frame_hash?: string };
}
export interface FeedbackSequencePlan extends NativeRecord {
  layout: FeedbackLayout; active: FeedbackSlotRow | null; repeatable: boolean | null; palette_background: number | null;
  selection: NativeRecord; question: string; evidence: string[]; workflow?: NativeRecord;
}
export interface FeedbackSequenceProposal extends NativeProposal {
  status: 'proposed'; kind: 'public_feedback_sequence'; actions: NativeCommand[]; steps: FeedbackStep[];
  facts: Record<string, boolean>; binding: { observation_ref: string; level_epoch: number; levels_completed: number; frame_hash: string };
  feedback_plan: FeedbackSequencePlan; compositions: NativeRecord[]; question: { reason: string; hypothesis_refs: string[] }; route_refs: string[];
  bundle_template: { operation_key: string; composition_ref: string; objective_ref: string; preserve_refs: string[];
    purpose: string; preconditions: Record<string, boolean>; evidence: string[]; actions: NativeCommand[];
    outcome_guard: { path: string[]; contains: string } };
}
const equal = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
const clone = <T>(value: T): T => structuredClone(value);
const json = (value: unknown): JsonValue => value as JsonValue;
const addressed = (command: NativeCommand): boolean => Object.keys(command.data ?? {}).length > 0;
const fields = ['layout', 'active', 'repeatable', 'entry_evidence', 'history', 'submit', 'clear_evidence', 'last', 'blocked',
  'palette_background', 'entry_method', 'transfer_refuted_epoch'] as const;

export class FeedbackSequences {
  readonly id = 'feedback_sequences';
  readonly configuration: FeedbackConfiguration;
  private src: Promise<NativeProgramHandle>;
  private layout: FeedbackLayout | null = null;
  private active: FeedbackSlotRow | null = null;
  private repeatable: boolean | null = null;
  private entry_evidence: FeedbackEntryEvidence[] = [];
  private history: FeedbackHistoryRow[] = [];
  private submit: { action: NativeCommand; ref: string } | null = null;
  private clear_evidence: NativeRecord[] = [];
  private last: { epoch: number; trial: number[]; selection: NativeRecord } | null = null;
  private blocked: NativeRecord | null = null;
  private palette_background: number | null = null;
  private entry_method: FeedbackEntryMethod | null = null;
  private transfer_refuted_epoch: number | null = null;
  private offered = new Map<string, FeedbackSequenceProposal | null>();
  private providers: Record<string, () => Promise<FeedbackSequenceProposal | null>> = {};
  private refusal: NativeRecord | null = null;
  last_diagnostic: NativeRecord | null = null;

  constructor() {
    const source = (V6_DECLARATIVE_SOURCES as unknown as Record<string, { text: string }>)['agents/yf_arc3_v6/morphology_policy/feedback_sequences/feedback_sequences.drm']!;
    this.configuration = JSON.parse(source.text).declarations[0].configuration as FeedbackConfiguration;
    this.src = NativeSrcProgram.create('v6.feedback_sequences.choose', this.callbacks());
  }
  private callbacks() {
    return {
      'sequences.begin': () => json({ pending: true, done: false, index: 0, progress: 0, visited: [] }),
      'sequences.offer': async (args: JsonObject) => {
        const session = args.session as unknown as { index: number }, name = this.configuration.stages[session.index]!;
        const proposal = await this.providers[name]!(); this.offered.set(name, proposal);
        return json({ selected: proposal !== null, family: name });
      },
      'sequences.advance': (args: JsonObject) => {
        const session = args.session as unknown as { index: number; visited: string[] }, index = session.index + 1;
        return json({ ...session, index, progress: index, pending: index < this.configuration.stages.length,
          done: index === this.configuration.stages.length, visited: [...session.visited, this.configuration.stages[session.index]!] });
      },
      'sequences.finish': (args: JsonObject) => {
        const session = args.session as unknown as { progress: number; visited: string[] }, trial = args.trial as unknown as { family: string };
        return json({ ...session, pending: false, done: true, progress: session.progress + 1,
          selected: trial.family, visited: [...session.visited, trial.family] });
      },
    };
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> {
    this.src = registry.registerProgram('v6.feedback_sequences.choose', this.callbacks()); await this.src;
  }
  resetScope(obs: NativeObservation): void {
    if (this.layout && this.layout.epoch !== obs.level_epoch) {
      if (this.active && this.submit && new Set(this.entry_evidence.map(event => event.value)).size >= 2) {
        const ordered = [...this.layout.slot_rows].sort((a, b) => a.y - b.y);
        this.entry_method = { kind: 'append_to_next_unfilled_rank', source_epoch: this.layout.epoch,
          size: [...this.layout.size], pitch: this.layout.pitch, slot_row_count: ordered.length,
          active_order: ordered.findIndex(row => row.y === this.active!.y), append_evidence: this.entry_evidence.map(event => event.ref),
          submit_evidence: this.submit.ref, submit_action: addressed(this.submit.action) ? null : clone(this.submit.action),
          palette_mode_at_source: this.repeatable, status: 'hypothesis_to_revalidate_at_next_epoch' };
      }
      this.layout = null; this.active = null; this.repeatable = null; this.entry_evidence = []; this.history = []; this.submit = null;
      this.clear_evidence = []; this.last = null; this.blocked = null; this.palette_background = null;
    }
  }
  methodMatches(obs: NativeObservation): boolean {
    const method = this.entry_method, layout = this.layout;
    return Boolean(method && layout && method.kind === 'append_to_next_unfilled_rank'
      && method.source_epoch !== obs.level_epoch && this.transfer_refuted_epoch !== obs.level_epoch
      && new Set(method.append_evidence ?? []).size >= 2 && method.submit_evidence
      && equal(method.size, layout.size) && method.pitch === layout.pitch && method.slot_row_count === layout.slot_rows.length
      && method.active_order >= 0 && method.active_order < layout.slot_rows.length);
  }
  view(obs: NativeObservation, rows: NativeRows): { prefix: number[]; palette: [number, number][] } | null {
    this.resetScope(obs);
    this.layout ??= initialFeedbackLayout(obs);
    if (!this.layout) return null;
    const palette = feedbackPalette(obs, this.layout);
    if (palette === null) return null;
    let prefix: number[] = [];
    if (this.active) {
      const row = feedbackValues(rows, this.layout, this.active.y, this.layout.count);
      if (row === null) return null;
      const empty = this.active.empty, filled = row.filter(value => value !== empty);
      if (!equal(row, [...filled, ...Array<number>(row.length - filled.length).fill(empty)])
        || filled.some(value => !this.layout!.alphabet.includes(value))) return null;
      prefix = filled;
    }
    return { prefix, palette };
  }
  async compile(trial: readonly number[], obs: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number,
    question: string, selection: NativeRecord): Promise<FeedbackSequenceProposal | null> {
    const view = this.view(obs, rows);
    if (!view) return null;
    const layout = this.layout!, [w, h] = layout.size, steps: FeedbackStep[] = [], arr = rows.map(row => [...row]);
    let prefix = [...view.prefix], palette = view.palette.map(part => [...part] as [number, number]);
    const attested = new Set(this.entry_evidence.map(event => event.value)).size >= 2 && this.repeatable !== null;
    const box: [number, number, number, number] = [layout.xs[0]!, layout.palette_y, layout.xs.at(-1)! + w - 1, layout.palette_y + h - 1];
    const background = this.palette_background;
    if (attested && this.repeatable === false && background === null || !equal(trial.slice(0, prefix.length), prefix)) return null;
    for (const value of trial.slice(prefix.length)) {
      const matching = palette.flatMap(([x, current], i) => current === value ? [[i, x] as const] : []);
      if (matching.length !== 1) return null;
      const [i, x] = matching[0]!, locus = { x: x + Math.floor(w / 2), y: layout.palette_y + Math.floor(h / 2) };
      const bound = inputs.filter(command => equal(command.data, locus));
      if (bound.length !== 1) return null;
      const command = bound[0]!, nextPrefix = [...prefix, value], nextValues = palette.map(([, current]) => current);
      if (this.repeatable === false) nextValues.splice(i, 1);
      steps.push({ action: command, kind: 'ADD', value, prefix_before: prefix, palette_before: palette.map(part => [...part] as [number, number]),
        expected_after: attested ? { prefix: nextPrefix, palette_values: nextValues } : null,
        palette_projection_bbox: [...box], palette_projection_sha: await rowsDigest(projection(arr, box)) });
      prefix = nextPrefix; palette = nextValues.map((current, rank) => [layout.xs[rank]!, current]);
      if (attested) for (let rank = 0; rank < layout.xs.length; rank++) {
        const xx = layout.xs[rank]!, fill = rank < nextValues.length ? nextValues[rank]! : background!;
        for (let yy = box[1]; yy <= box[3]; yy++) for (let column = xx; column < xx + w; column++) arr[yy]![column] = fill;
      }
      if (!attested || steps.length >= Math.min(remaining, this.configuration.maximum_bundle)) break;
    }
    return steps.length ? this.proposal(obs, steps, question, selection) : null;
  }
  async proposal(obs: NativeObservation, steps: FeedbackStep[], question: string, selection: NativeRecord): Promise<FeedbackSequenceProposal> {
    const actions = steps.map(step => step.action), focus = `composition:ordered_trial:${(await v6Digest([obs.observation_ref, actions])).slice(0, 20)}`;
    const evidence = [obs.observation_ref, this.layout!.ref, ...this.entry_evidence.map(event => event.ref), ...this.history.map(row => row.ref)];
    const facts: Record<string, boolean> = { ordered_slots_current: true }, recalled = selection.recalled_entry as FeedbackEntryMethod | null | undefined;
    if (recalled) { facts.entry_method_rebound = this.methodMatches(obs); evidence.push(...recalled.append_evidence, recalled.submit_evidence); }
    return { status: 'proposed', kind: 'public_feedback_sequence', actions, steps, facts,
      binding: { observation_ref: obs.observation_ref, level_epoch: obs.level_epoch, levels_completed: obs.levels_completed, frame_hash: obs.frame_hash },
      feedback_plan: { layout: clone(this.layout!), active: clone(this.active), repeatable: this.repeatable, palette_background: this.palette_background,
        selection: clone(selection), question, evidence },
      compositions: [{ id: focus, role: 'information_question', observed: false,
        properties: { ordered_proposal: selection.trial ?? null, preserve: 'currently filled prefix and all sealed response rows' },
        relations: ['contributes_to:G_official_completion'], open_question: question }],
      question: { reason: question, hypothesis_refs: evidence }, route_refs: evidence,
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', preserve_refs: [],
        purpose: question, preconditions: facts, evidence, actions, outcome_guard: { path: ['value'], contains: focus } } };
  }
  async propose(obs: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number,
    execution?: NativeExecution): Promise<FeedbackSequenceProposal | null> {
    this.offered.clear(); this.refusal = null;
    const view = this.view(obs, rows);
    if (!view || remaining < 1 || this.blocked) return null;
    const layout = this.layout!, n = layout.count, prefix = view.prefix;
    const continueTrial = async (): Promise<FeedbackSequenceProposal | null> => {
      if (!this.last || this.last.epoch !== obs.level_epoch || !equal(this.last.trial.slice(0, prefix.length), prefix) || prefix.length >= n) return null;
      return this.compile(this.last.trial, obs, rows, inputs, remaining, 'Continue the currently bound ordered information probe.', this.last.selection);
    };
    const submit = async (): Promise<FeedbackSequenceProposal | null> => {
      if (!this.active || prefix.length !== n) return null;
      const recalled = this.methodMatches(obs) ? this.entry_method?.submit_action : null;
      const commands = this.submit ? [this.submit.action] : recalled && inputs.some(command => equal(command, recalled))
        ? [recalled] : inputs.filter(command => !addressed(command));
      if (commands.length !== 1 || !inputs.some(command => equal(command, commands[0]))) return null;
      return this.proposal(obs, [{ action: commands[0]!, kind: this.submit ? 'SUBMIT' : 'CONTROL_WHEN_FULL',
        prefix_before: prefix, palette_before: view.palette.map(part => [...part] as [number, number]), expected_after: null }],
      'Test the control with a complete proposal and measure any positional return; stop at that response.',
      { trial: prefix, control_evidence: clone(this.submit), information_cost: 1 });
    };
    const discriminate = async (): Promise<FeedbackSequenceProposal | null> => {
      if (!this.active || prefix.length >= n) return null;
      const other = layout.slot_rows.filter(row => row.y !== this.active!.y);
      if (other.length !== 1) return null;
      const raw = feedbackValues(rows, layout, other[0]!.y, n);
      if (raw === null) return null;
      const revealed = raw.map(value => value === other[0]!.empty ? null : value);
      if (revealed.some(value => value !== null && !layout.alphabet.includes(value))) return null;
      const result = await chooseFeedbackTrialCooperative([layout.alphabet, n, prefix, this.history, revealed, this.repeatable,
        obs, remaining, this.configuration], execution);
      this.last_diagnostic = result;
      if (result.status !== 'proposed') {
        this.refusal = { ...clone(result), observation_ref: obs.observation_ref, level_epoch: obs.level_epoch, frame_hash: obs.frame_hash,
          release_authority: false, source_owner: this.id, status_is_not_an_acquired_refutation: true };
        return null;
      }
      this.last = { epoch: obs.level_epoch, trial: result.trial as number[], selection: result };
      return this.compile(result.trial as number[], obs, rows, inputs, remaining, this.configuration.question, result);
    };
    const acquire = async (): Promise<FeedbackSequenceProposal | null> => {
      if (this.active || !view.palette.length) return null;
      const [w, h] = layout.size, styles = view.palette.map(([x]) => feedbackBorder(rows, x, layout.palette_y, w, h));
      const distinctive = styles.flatMap((style, i) => styles.filter(candidate => equal(candidate, style)).length === 1 ? [i] : []);
      const recalled = this.methodMatches(obs);
      if (distinctive.length !== 1 && !recalled) return null;
      const choice = distinctive.length === 1 ? distinctive[0]! : 0, value = view.palette[choice]![1];
      return this.compile([value], obs, rows, inputs, remaining, 'Test whether a distinguished selectable value is appended to an ordered row.',
        { trial: [value], role_status: 'unconfirmed', information_cost: 1, recalled_entry: recalled ? clone(this.entry_method) : null,
          current_role_revalidation_pending: recalled });
    };
    this.providers = { continue_bound_trial: continueTrial, test_complete_proposal: submit, discriminate_codes: discriminate, acquire_append: acquire };
    const { result, receipt } = await (await this.src).run({ request: { observation_ref: obs.observation_ref } });
    const proposal = this.offered.get((result as unknown as { selected?: string }).selected ?? '') ?? null;
    if (proposal) proposal.feedback_plan.workflow = { workflow: receipt.workflow, src_hash: receipt.src_hash,
      src_status: receipt.src_status, executed_statements: receipt.executed_statements };
    return proposal;
  }
  currentProposalRefusal(obs: NativeObservation): NativeRecord | null {
    return this.refusal?.observation_ref === obs.observation_ref && this.refusal.level_epoch === obs.level_epoch
      && this.refusal.frame_hash === obs.frame_hash ? clone(this.refusal) : null;
  }
  bind(proposal: FeedbackSequenceProposal, domain: ObservedInputDomain): void {
    const bound = proposal.binding, bindings = domain.bindings.get(`${bound.level_epoch}:${bound.frame_hash}`);
    for (const step of proposal.steps) {
      if (!addressed(step.action)) continue;
      const point = step.action.data, original = bindings?.get(`${point.x},${point.y}`);
      if (!original) throw new TypeError('Feedback input has no current sampled witness');
      step.point_binding = step.kind !== 'ADD' ? clone(original) : { ...clone(original), palette_value: step.value!, source_frame_hash: bound.frame_hash,
        projected_rows_digest: step.palette_projection_sha!, projection_bbox: step.palette_projection_bbox!,
        scope: 'conditional occurrence from observed palette-compaction law and exact current palette raster' };
    }
  }
  before(proposal: FeedbackSequenceProposal, index: number, publicPacket: NativePublicObservation, obs: NativeObservation) {
    const plan = proposal.feedback_plan, step = proposal.steps[index], bound = proposal.binding, layout = plan.layout;
    if (!step) return { admitted: false, reason: 'sequence_binding_changed' };
    let ok = publicPacket.level === bound.level_epoch && publicPacket.levels_completed === bound.levels_completed
      && publicPacket.available_action_refs.includes(step.action.action_ref) && equal(proposal.actions[index], step.action)
      && (index > 0 || obs.observation_ref === bound.observation_ref);
    if (plan.active) {
      const expected = [...step.prefix_before, ...Array<number>(Math.max(0, layout.count - step.prefix_before.length)).fill(plan.active.empty)];
      ok = ok && equal(feedbackValues(publicPacket.frame_rows, layout, plan.active.y, layout.count), expected);
    } else ok = ok && layout.slot_rows.every(row => equal(feedbackValues(publicPacket.frame_rows, layout, row.y, layout.count), Array<number>(layout.count).fill(row.empty)));
    const expected = step.palette_before, [w, h] = layout.size;
    ok = ok && expected.every(([x, value]) => equal(feedbackValues(publicPacket.frame_rows, { ...layout, xs: [x] }, layout.palette_y, 1), [value]));
    ok = ok && layout.xs.slice(expected.length).every(x => !layout.alphabet.some(value => equal(feedbackValues(publicPacket.frame_rows,
      { ...layout, xs: [x] }, layout.palette_y, 1), [value])));
    if (step.kind === 'ADD') {
      const matching = expected.filter(([, value]) => value === step.value).map(([x]) => x);
      ok = ok && matching.length === 1 && equal(step.action.data, { x: matching[0]! + Math.floor(w / 2), y: layout.palette_y + Math.floor(h / 2) });
    }
    return { admitted: ok, reason: ok ? 'ordered_prefix_and_loci_bound' : 'sequence_binding_changed' };
  }
  after(proposal: FeedbackSequenceProposal, index: number, before: NativeObservation, after: NativeObservation, _first: NativeRows, second: NativeRows) {
    if (after.level_epoch !== before.level_epoch || after.levels_completed !== before.levels_completed) return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const step = proposal.steps[index]!, expected = step.expected_after, plan = proposal.feedback_plan;
    if (expected === null) return { matched: null, seal_prefix: true, reason: 'unknown_entry_or_feedback' };
    const active = plan.active!, layout = plan.layout, current = feedbackValues(second, layout, active.y, layout.count);
    const filled = [...expected.prefix, ...Array<number>(Math.max(0, layout.count - expected.prefix.length)).fill(active.empty)];
    const palette = feedbackValues(second, layout, layout.palette_y), predicted = expected.palette_values;
    const expectedPalette = [...predicted, ...Array<number | null>(Math.max(0, layout.xs.length - predicted.length)).fill(plan.palette_background)];
    const matched = equal(current, filled) && palette !== null && equal(palette, expectedPalette);
    return { matched, seal_prefix: !matched || index + 1 === proposal.steps.length, reason: 'measured_entry_transition' };
  }
  async record(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows,
    proposal?: FeedbackSequenceProposal, _index = 0): Promise<NativeRecord> {
    this.refusal = null;
    const view = this.view(before, first);
    if (!view) return { status: 'unbound_interface' };
    if (after.level_epoch !== before.level_epoch || after.levels_completed !== before.levels_completed) {
      this.resetScope(after); return { status: 'official_boundary', evidence: after.observation_ref };
    }
    const layout = this.layout!, [w, h] = layout.size, ref = after.observation_ref, data = command.data ?? {};
    const clicked = view.palette.filter(([x]) => x <= (data.x ?? -1) && (data.x ?? -1) < x + w
      && layout.palette_y <= (data.y ?? -1) && (data.y ?? -1) < layout.palette_y + h).map(([, value]) => value);
    const additions: FeedbackSlotRow[] = [];
    if (clicked.length === 1) {
      const value = clicked[0]!;
      for (const row of layout.slot_rows) {
        const prior = feedbackValues(first, layout, row.y, layout.count), current = feedbackValues(second, layout, row.y, layout.count);
        if (prior === null || current === null) continue;
        const prefix = prior.filter(entry => entry !== row.empty);
        if (equal(prior, [...prefix, ...Array<number>(layout.count - prefix.length).fill(row.empty)]) && prefix.length < layout.count
          && equal(current, [...prefix, value, ...Array<number>(layout.count - prefix.length - 1).fill(row.empty)])) additions.push(row);
      }
      if (additions.length === 1) {
        this.active = additions[0]!;
        const palette = feedbackPalette(after, layout), old = view.palette.map(([, entry]) => entry), current = palette?.map(([, entry]) => entry) ?? null;
        const mode = equal(current, old) ? true : equal(current, old.filter(entry => entry !== value)) ? false : null;
        if (this.entry_evidence.length && this.repeatable !== null && mode !== this.repeatable) {
          this.blocked = { status: 'entry_protocol_refuted', evidence: ref }; return clone(this.blocked);
        }
        this.repeatable = mode;
        const event: FeedbackEntryEvidence = { ref, before: before.observation_ref, value, action: clone(command), repeatable: mode };
        if (this.methodMatches(before)) {
          const ordered = [...layout.slot_rows].sort((a, b) => a.y - b.y), expected = ordered[this.entry_method!.active_order]!.y;
          event.method_revalidation = this.active.y === expected ? 'active_rank_row_confirmed' : 'active_rank_row_changed';
          event.source_method_evidence = [...this.entry_method!.append_evidence];
          if (this.active.y !== expected) this.transfer_refuted_epoch = before.level_epoch;
        }
        if (mode === false) {
          const vacated = feedbackValues(second, { ...layout, xs: [layout.xs[current!.length]!] }, layout.palette_y, 1);
          if (vacated?.length && !layout.alphabet.includes(vacated[0]!)) this.palette_background = vacated[0]!;
        }
        this.entry_evidence.push(event); return { status: 'observed_append', event: clone(event), active_row: clone(this.active) };
      }
    }
    if (this.active) {
      const row = feedbackValues(second, layout, this.active.y, layout.count), prefix = view.prefix;
      if (prefix.length === layout.count && equal(row, Array<number>(layout.count).fill(this.active.empty))) {
        const matches = await feedbackMatches(second, after, layout, prefix);
        if (matches.length === 1) {
          const result: FeedbackHistoryRow = { ...matches[0]!, ref, before: before.observation_ref };
          if (!this.history.some(event => event.ref === ref)) this.history.push(result);
          this.submit = { action: clone(command), ref }; this.last = null;
          return { status: 'observed_submission_feedback', event: clone(result) };
        }
        return { status: 'feedback_ambiguous', matches: matches.length, evidence: ref };
      }
      if (data.x !== undefined && this.active.y <= (data.y ?? -1) && (data.y ?? -1) < this.active.y + h) {
        const ranks = layout.xs.slice(0, layout.count).flatMap((x, i) => x <= data.x! && data.x! < x + w ? [i] : []);
        if (ranks.length === 1 && ranks[0]! < prefix.length && equal(row,
          [...prefix.slice(0, ranks[0]!), ...Array<number>(layout.count - ranks[0]!).fill(this.active.empty)])) {
          const event = { ref, rank: ranks[0]!, prefix_preserved: prefix.slice(0, ranks[0]!) };
          this.clear_evidence.push(event); this.last = null; return { status: 'observed_suffix_clear', event: clone(event) };
        }
      }
    }
    if (proposal?.feedback_plan.selection.recalled_entry) {
      this.transfer_refuted_epoch = before.level_epoch;
      return { status: 'recalled_append_refuted_here', evidence: ref, method_source: this.entry_method!.source_epoch };
    }
    return { status: 'no_bound_sequence_effect', evidence: ref };
  }
  state(): NativeRecord {
    return clone({ layout: this.layout, active: this.active, repeatable: this.repeatable, entry_evidence: this.entry_evidence,
      history: this.history, submit: this.submit, clear_evidence: this.clear_evidence, last: this.last, blocked: this.blocked,
      palette_background: this.palette_background, entry_method: this.entry_method, transfer_refuted_epoch: this.transfer_refuted_epoch });
  }
  restore(state: NativeRecord): void {
    if (Object.keys(state).some(key => !fields.includes(key as typeof fields[number]))) throw new TypeError('Unknown memory field');
    Object.assign(this, clone(state));
    this.refusal = null; this.last_diagnostic = null; this.offered.clear(); this.providers = {};
  }
}
