/** Pinned RecruitmentPolicy: local DRM priority, cost, survivor count and source order. */
import { isJsonObject } from './canonical.ts';
import { NativeDrmRegistry, factConditionHolds } from './v6-drm-projector.ts';
import type { DrmCondition, NativeLoadedDrm } from './v6-drm-projector.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES } from './v6-src-program.ts';
import type { NativeSrcReceipt } from './v6-src-program.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { pythonEqual } from './v6-operations.ts';
import type { NativeProgramHandle, NativeProgramRegistry } from './v6-native-types.ts';
import type { JsonObject, Primitive } from './ir.ts';

type R = Record<string, any>;
const LOCAL = 'agents/yf_arc3_v6/morphology_policy/ordered_recruitment/recruitment.drm';
const WORKFLOW = 'v6.ordered_recruitment.choose';
export type RecruitmentReceipt = Pick<NativeSrcReceipt, 'workflow' | 'src_hash' | 'src_status' | 'executed_statements'>;

export class RecruitmentPolicy {
  readonly registry: NativeDrmRegistry;
  readonly loaded: NativeLoadedDrm;
  readonly config: R;
  private program!: NativeProgramHandle;
  private readonly callbacks: Readonly<Record<string, Primitive>>;

  private constructor(registry: NativeDrmRegistry, loaded: NativeLoadedDrm) {
    this.registry = registry; this.loaded = loaded;
    const config = loaded.document.declarations[0]?.configuration;
    if (!config) throw new TypeError('Missing ordered recruitment configuration');
    this.config = retainNativeJson(config);
    this.callbacks = Object.freeze({ 'recruitment.select': args => this.select(args.request as unknown as R[]) as JsonObject });
  }
  static async create(): Promise<RecruitmentPolicy> {
    const source = (V6_DECLARATIVE_SOURCES as R)[LOCAL];
    if (!source) throw new TypeError('Missing original ordered recruitment DRM');
    const registry = new NativeDrmRegistry(), loaded = await registry.registerSource(source.text, source.sha256);
    registry.seal();
    const policy = new RecruitmentPolicy(registry, loaded);
    policy.program = await NativeSrcProgram.create(WORKFLOW, policy.callbacks); return policy;
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> {
    this.program = await registry.registerProgram(WORKFLOW, this.callbacks);
  }
  select(request: readonly R[]): R {
    let chosen: { priority: number; cost: number; survivors: number; index: number } | null = null;
    for (const [index, offer] of request.entries()) {
      const priority = (this.config.priority as string[]).indexOf(offer.kind);
      if (priority < 0 || !(this.config.conditions as DrmCondition[]).every(condition => factConditionHolds(condition, offer.facts))) continue;
      // Python minimizes (priority, cost, -survivors, i). Enumeration retains
      // the first offer only when all three preceding components are equal.
      if (chosen === null || priority < chosen.priority || priority === chosen.priority
        && (offer.cost < chosen.cost || pythonEqual(offer.cost, chosen.cost) && offer.survivors > chosen.survivors)) {
        chosen = { priority, cost: offer.cost, survivors: offer.survivors, index };
      }
    }
    if (chosen === null) return { status: 'abstain', release_authority: false };
    const index = chosen.index, offer = request[index]!;
    return { status: 'selected', index, reason: this.config.kind_meaning[offer.kind],
      hypotheses: this.config.hypotheses, release_authority: false };
  }
  async choose(rows: readonly R[]): Promise<readonly [R, RecruitmentReceipt]> {
    const request = rows.map(row => Object.fromEntries(['kind', 'facts', 'cost', 'survivors'].map(key => [key, row[key]])));
    const { result, receipt } = await this.program.run({ request } as JsonObject);
    if (!isJsonObject(result)) throw new TypeError('Recruitment SRC returned no mapping');
    return [result, retainNativeJson({ workflow: receipt.workflow, src_hash: receipt.src_hash,
      src_status: receipt.src_status, executed_statements: receipt.executed_statements })];
  }
}
