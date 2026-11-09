/** Pinned V6 ReactionPolicy, including its three consumed V5 projections. */
import transferred from './v6/ordered-reaction-policy.json' with { type: 'json' };
import { isJsonObject } from './canonical.ts';
import { NativeDrmRegistry, factConditionHolds } from './v6-drm-projector.ts';
import type { DrmCondition, NativeLoadedDrm } from './v6-drm-projector.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES, V6_NATIVE_PROGRAM_REFERENCE } from './v6-src-program.ts';
import type { NativeSrcReceipt } from './v6-src-program.ts';
import type { NativeProgramHandle, NativeProgramRegistry } from './v6-native-types.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { framedFormatMap } from './v6-framed-transfer-policy.ts';
import type { JsonObject, Primitive } from './ir.ts';
type R = Record<string, any>;
const LOCAL = 'agents/yf_arc3_v6/morphology_policy/ordered_reaction/reaction.drm';
const WORKFLOW = 'v6.ordered_reaction.choose';
export type ReactionReceipt = Pick<NativeSrcReceipt, 'workflow' | 'src_hash' | 'src_status' | 'executed_statements'>;
export const ORDERED_REACTION_POLICY_SUBSET = retainNativeJson(transferred);

export class ReactionPolicy {
  readonly registry: NativeDrmRegistry;
  readonly loaded: NativeLoadedDrm;
  readonly config: R;
  readonly projections: Readonly<Record<string, R>>;
  private program!: NativeProgramHandle;
  private readonly callbacks: Readonly<Record<string, Primitive>>;
  private constructor(registry: NativeDrmRegistry, loaded: NativeLoadedDrm) {
    this.registry = registry; this.loaded = loaded;
    const config = loaded.document.declarations[0]?.configuration;
    if (!config) throw new TypeError('Missing ordered reaction configuration');
    this.config = retainNativeJson(config); this.projections = retainNativeJson(ORDERED_REACTION_POLICY_SUBSET.projections);
    if (this.config.projections.length !== Object.keys(this.projections).length || this.config.projections.some((ref: string) => !this.projections[ref])) throw new TypeError('Missing exact V5 reaction projections');
    this.callbacks = Object.freeze({ 'reaction.select': args => this.select(args.request as unknown as R[]) as JsonObject });
  }
  static async create(): Promise<ReactionPolicy> {
    if (ORDERED_REACTION_POLICY_SUBSET.schema !== 'logos-engine.v6.ordered-reaction-policy.v1' || ORDERED_REACTION_POLICY_SUBSET.referenceCommit !== V6_NATIVE_PROGRAM_REFERENCE) throw new TypeError('Reaction policy reference mismatch');
    const source = (V6_DECLARATIVE_SOURCES as R)[LOCAL];
    if (!source || source.sha256 !== ORDERED_REACTION_POLICY_SUBSET.sourceHashes[LOCAL]) throw new TypeError('Reaction policy source mismatch');
    const registry = new NativeDrmRegistry(), loaded = await registry.registerSource(source.text, source.sha256); registry.seal();
    const policy = new ReactionPolicy(registry, loaded); policy.program = await NativeSrcProgram.create(WORKFLOW, policy.callbacks); return policy;
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> { this.program = await registry.registerProgram(WORKFLOW, this.callbacks); }
  holds(conditions: readonly DrmCondition[], facts: R): boolean { return conditions.every(c => factConditionHolds(c, facts as JsonObject)); }
  project(projection: R, facts: R): R {
    const out = { ...facts, ...structuredClone(projection.static_facts ?? {}) };
    for (const [field, pattern] of Object.entries(projection.templated_facts ?? {}) as [string, any][]) out[field] = typeof pattern === 'string' ? framedFormatMap(pattern, facts) : pattern.map((p: string) => framedFormatMap(p, facts));
    return out;
  }
  select(request: readonly R[]): R {
    const options: [number, number, R, string, string | null][] = [];
    for (const [index, offer] of request.entries()) {
      const kind = offer.kind, facts = offer.facts, rule = Object.hasOwn(this.config.rules, kind) ? this.config.rules[kind] : null;
      if (!rule || !this.holds(rule.conditions, facts)) continue;
      const ref = rule.projection ?? null, projection = ref === null ? null : this.projections[ref];
      if (projection && (!this.holds(projection.all_conditions, facts) || projection.any_conditions?.length && !projection.any_conditions.some((c: DrmCondition) => this.holds([c], facts)))) continue;
      let why: R;
      try { why = projection ? this.project(projection, facts) : { ...facts }; }
      catch (error) { if (error instanceof Error && error.name === 'MissingProjectionField') continue; throw error; }
      const priority = this.config.priority.indexOf(kind);
      if (priority < 0) throw new TypeError('Reaction kind missing from declared priority');
      options.push([priority, index, why, rule.meaning, ref]);
    }
    if (!options.length) return { status: 'abstain', release_authority: false };
    options.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const [, index, projected, reason, projection_ref] = options[0]!;
    return { status: 'selected', index, projected, reason, projection_ref, release_authority: false };
  }
  async choose(offers: readonly R[]): Promise<readonly [R, ReactionReceipt]> {
    const { result, receipt } = await this.program.run({ request: offers } as unknown as JsonObject);
    if (!isJsonObject(result)) throw new TypeError('Reaction SRC returned no mapping');
    return [result, retainNativeJson({ workflow: receipt.workflow, src_hash: receipt.src_hash, src_status: receipt.src_status, executed_statements: receipt.executed_statements })];
  }
}
