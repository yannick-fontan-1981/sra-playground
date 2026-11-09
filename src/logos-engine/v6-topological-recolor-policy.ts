/** Original RecolorPolicy uses only its local DRM and the common SRC runner. */
import { isJsonObject } from './canonical.ts';
import { NativeDrmRegistry, factConditionHolds } from './v6-drm-projector.ts';
import type { DrmCondition, NativeLoadedDrm } from './v6-drm-projector.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES } from './v6-src-program.ts';
import type { NativeSrcReceipt } from './v6-src-program.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import type { NativeProgramHandle, NativeProgramRegistry } from './v6-native-types.ts';
import type { JsonObject, Primitive } from './ir.ts';

type R = Record<string, any>;
const LOCAL = 'agents/yf_arc3_v6/morphology_policy/topological_recolor/recolor.drm';
const WORKFLOW = 'v6.topological_recolor.choose';
export type RecolorReceipt = Pick<NativeSrcReceipt, 'workflow' | 'src_hash' | 'src_status' | 'executed_statements'>;

export class RecolorPolicy {
  readonly registry: NativeDrmRegistry;
  readonly loaded: NativeLoadedDrm;
  readonly config: R;
  private program!: NativeProgramHandle;
  private readonly callbacks: Readonly<Record<string, Primitive>>;
  private constructor(registry: NativeDrmRegistry, loaded: NativeLoadedDrm) {
    this.registry = registry; this.loaded = loaded;
    const config = loaded.document.declarations[0]?.configuration;
    if (!config) throw new TypeError('Missing topological recolor configuration');
    this.config = retainNativeJson(config);
    this.callbacks = Object.freeze({ 'recolor.select': args => this.select(args.request as unknown as R[]) as JsonObject });
  }
  static async create(): Promise<RecolorPolicy> {
    const source = (V6_DECLARATIVE_SOURCES as R)[LOCAL];
    if (!source) throw new TypeError('Missing original topological recolor DRM');
    const registry = new NativeDrmRegistry(), loaded = await registry.registerSource(source.text, source.sha256); registry.seal();
    const policy = new RecolorPolicy(registry, loaded); policy.program = await NativeSrcProgram.create(WORKFLOW, policy.callbacks); return policy;
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> { this.program = await registry.registerProgram(WORKFLOW, this.callbacks); }
  select(request: readonly R[]): R {
    for (const mode of this.config.priority as string[]) for (const [index, row] of request.entries()) {
      const relation = row.facts.relation_kind, correspondence = Object.hasOwn(this.config.correspondences, relation)
        ? this.config.correspondences[relation] : null;
      if (!correspondence || !correspondence.conditions.every((c: DrmCondition) => factConditionHolds(c, row.facts))
        || row.mode !== mode || !this.config.conditions[mode].every((c: DrmCondition) => factConditionHolds(c, row.facts))) continue;
      return { status: 'selected', index, reason: this.config.meaning[mode],
        hypotheses: [...this.config.hypotheses, correspondence.hypothesis], falsifiers: this.config.falsifiers, release_authority: false };
    }
    return { status: 'abstain', release_authority: false };
  }
  async choose(rows: readonly R[]): Promise<readonly [R, RecolorReceipt]> {
    const { result, receipt } = await this.program.run({ request: rows.map(r => ({ mode: r.mode, facts: r.facts })) } as JsonObject);
    if (!isJsonObject(result)) throw new TypeError('Recolor SRC returned no mapping');
    return [result, retainNativeJson({ workflow: receipt.workflow, src_hash: receipt.src_hash,
      src_status: receipt.src_status, executed_statements: receipt.executed_statements })];
  }
}
