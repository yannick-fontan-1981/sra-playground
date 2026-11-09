/** Exact consumed ReactiveContact ContactPolicy (pinned V6), executed by SRC.
 * The two V5 projection rows are a declared subset, never a replacement policy. */
import transferred from './v6/reactive-contact-policy.json' with { type: 'json' };
import { isJsonObject } from './canonical.ts';
import { NativeDrmRegistry, factConditionHolds } from './v6-drm-projector.ts';
import type { DrmCondition, NativeLoadedDrm } from './v6-drm-projector.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES, V6_NATIVE_PROGRAM_REFERENCE } from './v6-src-program.ts';
import type { NativeSrcReceipt } from './v6-src-program.ts';
import type { NativeProgramHandle, NativeProgramRegistry } from './v6-native-types.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { symbolicDigest } from './v6-hash.ts';
import { outlineTupleCompare } from './v6-outline-identity.ts';
import { framedFormatMap } from './v6-framed-transfer-policy.ts';
import type { JsonObject, Primitive } from './ir.ts';

type R = Record<string, any>;
export type ReactiveContactSourceReceipt = Pick<NativeSrcReceipt, 'workflow' | 'src_hash' | 'src_status' | 'executed_statements'>;
const LOCAL = 'agents/yf_arc3_v6/morphology_policy/reactive_contact/contact.drm';
const PREFIX = 'v6.reactive_contact.';
const WORKFLOWS = ['choose', 'bind_control', 'reconcile_contact', 'reconcile_binding', 'project_source81_entry', 'admit_ready_operator'] as const;
export const REACTIVE_CONTACT_POLICY_SUBSET = retainNativeJson(transferred);

export class ReactiveContactPolicy {
  readonly loaded: NativeLoadedDrm;
  readonly registry: NativeDrmRegistry;
  readonly config: R;
  readonly projections: Readonly<Record<string, R>>;
  private programs: Record<string, NativeProgramHandle> = {};
  private readonly callbacks: Readonly<Record<string, Primitive>>;

  private constructor(registry: NativeDrmRegistry, loaded: NativeLoadedDrm) {
    this.registry = registry; this.loaded = loaded;
    const cfg = loaded.document.declarations[0]?.configuration;
    if (!cfg) throw new TypeError('Missing reactive contact configuration');
    this.config = retainNativeJson(cfg);
    this.projections = retainNativeJson(REACTIVE_CONTACT_POLICY_SUBSET.projections);
    if (this.config.contact_projections.length !== Object.keys(this.projections).length || this.config.contact_projections.some((id: string) => !this.projections[id])) throw new TypeError('Missing exact V5 contact projections');
    this.callbacks = Object.freeze({
      'contact.select': args => this.select(args.request as unknown as R[]) as JsonObject,
      'contact.control': args => this.control(args.request as R) as JsonObject,
      'contact.project': args => this.project_contact(args.request as R) as JsonObject,
      'contact.binding': args => this.project_binding(args.request as R) as JsonObject,
      'contact.source81_entry': args => this.project_source81_entry(args.request as R) as JsonObject,
      'contact.ready': args => this.admit_ready_operator(args.facts as R) as JsonObject,
    });
  }

  static async create(): Promise<ReactiveContactPolicy> {
    if (REACTIVE_CONTACT_POLICY_SUBSET.schema !== 'logos-engine.v6.reactive-contact-policy.v1' || REACTIVE_CONTACT_POLICY_SUBSET.referenceCommit !== V6_NATIVE_PROGRAM_REFERENCE) throw new TypeError('Reactive policy reference mismatch');
    const source = (V6_DECLARATIVE_SOURCES as R)[LOCAL];
    if (!source || source.sha256 !== REACTIVE_CONTACT_POLICY_SUBSET.sourceHashes[LOCAL]) throw new TypeError('Reactive policy source mismatch');
    const registry = new NativeDrmRegistry(), loaded = await registry.registerSource(source.text, source.sha256); registry.seal();
    const policy = new ReactiveContactPolicy(registry, loaded);
    for (const name of WORKFLOWS) policy.programs[name] = await NativeSrcProgram.create(PREFIX + name, policy.callbacks);
    return policy;
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> {
    for (const name of WORKFLOWS) this.programs[name] = await registry.registerProgram(PREFIX + name, this.callbacks);
  }
  holds(conditions: readonly DrmCondition[], facts: R): boolean { return conditions.every(c => factConditionHolds(c, facts as JsonObject)); }
  control(request: R): R { return { status: this.holds(this.config.control_conditions, request) ? 'conditional_control_bound' : 'abstain', authority: 'current_input_compatible_shape_under_revisable_interface_prior', release_authority: false }; }
  select(request: readonly R[]): R {
    const rows = request.flatMap((o, i) => this.config.priority.includes(o.kind) && this.holds(this.config.conditions, o.facts) && (o.kind !== 'parent_escape_configuration_access' || this.holds(this.config.parent_conditions, o.facts)) ? [[this.config.priority.indexOf(o.kind), o.cost, o.peer_distance, i]] : []);
    if (!rows.length) return { status: 'abstain', release_authority: false };
    rows.sort(outlineTupleCompare); const index = rows[0]![3]!;
    return { status: 'selected', index, reason: request[index]!.kind + ': resolve whether a current stationary subject can change escape options; retain existing-dead-end alternative', hypotheses: structuredClone(this.config.hypotheses), release_authority: false };
  }
  project_contact(request: R): R {
    const facts = structuredClone(request), used: string[] = [];
    for (const ref of this.config.contact_projections as string[]) {
      const projection = this.projections[ref]!;
      if (!this.holds(projection.all_conditions, facts) || projection.any_conditions?.length && !projection.any_conditions.some((c: DrmCondition) => this.holds([c], facts))) return { status: 'abstain', missing_projection: ref, release_authority: false };
      Object.assign(facts, structuredClone(projection.static_facts ?? {}));
      for (const [field, input] of Object.entries(projection.bound_facts ?? {}) as [string, string][]) {
        if (!Object.hasOwn(facts, input)) return { status: 'abstain', missing_bound_fact: input, release_authority: false };
        facts[field] = structuredClone(facts[input]);
      }
      try {
        for (const [field, pattern] of Object.entries(projection.templated_facts ?? {}) as [string, any][]) facts[field] = typeof pattern === 'string' ? framedFormatMap(pattern, facts) : pattern.map((s: string) => framedFormatMap(s, facts));
      } catch (error) {
        if (error instanceof Error && error.name === 'MissingProjectionField') return { status: 'abstain', missing_template: error.message.slice('missing_declared_projection_field:'.length), release_authority: false };
        throw error;
      }
      used.push(ref);
    }
    return { status: 'contact_question_projected', projections: used, facts, release_authority: false };
  }
  claim_digest(value: unknown): string { return symbolicDigest(value); }
  project_binding(request: R): R {
    const rule = this.config.common_translation_claim, receipt = request.receipt;
    if (!this.holds(rule.conditions, request.facts) || rule.required_receipt_fields.some((key: string) => !Object.hasOwn(receipt, key))) return { status: 'abstain', release_authority: false };
    const claim: R = { projection_ref: rule.id, status: rule.status, scope: rule.scope, receipt: structuredClone(receipt), falsifiers: structuredClone(rule.falsifiers), release_authority: false };
    claim.ref = rule.id + ':' + this.claim_digest(claim);
    return { status: 'observed_method_claim', claim, release_authority: false };
  }
  project_source81_entry(request: R): R {
    const rule = this.config.source81_entry;
    if (!this.holds(rule.conditions, request.facts)) return { status: 'abstain', release_authority: false };
    const claim: R = { projection_ref: rule.id, scope: rule.claim_scope, receipt: structuredClone(request.receipt), release_authority: false };
    claim.ref = rule.id + ':' + this.claim_digest(claim);
    const action = this.config.operator_prior;
    const candidates = request.available_action_refs.includes(action) ? [{ action_ref: action, hypothesis_ref: rule.operator_candidate_ref + ':' + this.claim_digest([claim.ref, action]), meaning: rule.unknown_operator_meaning, binding_claim_refs: [claim.ref], observed: false }] : [];
    return { status: 'current_prospective_entry', claim, explicit_operator_candidates: candidates, release_authority: false };
  }
  admit_ready_operator(facts: R): R { return { status: this.holds(this.config.source81_ready_operator_conditions, facts) ? 'admitted_experiment' : 'abstain', declaration: structuredClone(this.config.source81_ready_operator_meaning), release_authority: false }; }
  private async run(name: string, request: any): Promise<readonly [R, ReactiveContactSourceReceipt]> {
    const { result, receipt } = await this.programs[name]!.run({ request } as JsonObject);
    if (!isJsonObject(result)) throw new TypeError('Reactive policy did not return a mapping');
    // These receipts enter original source state and nested claim hashes.
    // Native execution metadata belongs to NativeProgramHandle, not that state.
    return [result, retainNativeJson({ workflow: receipt.workflow, src_hash: receipt.src_hash,
      src_status: receipt.src_status, executed_statements: receipt.executed_statements })];
  }
  choose(offers: readonly R[]): Promise<readonly [R, ReactiveContactSourceReceipt]> { return this.run('choose', offers); }
  bindControl(facts: R): Promise<readonly [R, ReactiveContactSourceReceipt]> { return this.run('bind_control', facts); }
  contact(facts: R): Promise<readonly [R, ReactiveContactSourceReceipt]> { return this.run('reconcile_contact', facts); }
  reconcileBinding(facts: R, receipt: R): Promise<readonly [R, ReactiveContactSourceReceipt]> { return this.run('reconcile_binding', { facts, receipt }); }
  source81Entry(request: R): Promise<readonly [R, ReactiveContactSourceReceipt]> { return this.run('project_source81_entry', request); }
  readyOperator(facts: R): Promise<readonly [R, ReactiveContactSourceReceipt]> { return this.run('admit_ready_operator', facts); }
  bind_control(facts: R) { return this.bindControl(facts); }
  reconcile_binding(facts: R, receipt: R) { return this.reconcileBinding(facts, receipt); }
  source81_entry(request: R) { return this.source81Entry(request); }
  ready_operator(facts: R) { return this.readyOperator(facts); }
}
export { ReactiveContactPolicy as ContactPolicy };
