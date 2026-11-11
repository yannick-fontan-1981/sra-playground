/** Original AxialPolicy: the local DRM ranks offers through the common SRC runner. */
import { isJsonObject } from './canonical.ts';
import { NativeDrmRegistry, factConditionHolds } from './v6-drm-projector.ts';
import type { DrmCondition, NativeLoadedDrm } from './v6-drm-projector.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES } from './v6-src-program.ts';
import type { NativeSrcReceipt } from './v6-src-program.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import type { NativeProgramHandle, NativeProgramRegistry } from './v6-native-types.ts';
import type { JsonObject, Primitive } from './ir.ts';

type R = Record<string, any>;
const LOCAL = 'agents/yf_arc3_v6/morphology_policy/axial_question/axial.drm';
const WORKFLOW = 'v6.axial_question.choose';
export type AxialReceipt = Pick<NativeSrcReceipt, 'workflow' | 'src_hash' | 'src_status' | 'executed_statements'>;

/** Python's tuple minimum compares each member, retaining source index last. */
function compare(a: readonly (number | string)[], b: readonly (number | string)[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i]! < b[i]! ? -1 : 1;
  }
  return 0;
}

export class AxialPolicy {
  readonly registry: NativeDrmRegistry;
  readonly loaded: NativeLoadedDrm;
  readonly config: R;
  private program!: NativeProgramHandle;
  private readonly callbacks: Readonly<Record<string, Primitive>>;

  private constructor(registry: NativeDrmRegistry, loaded: NativeLoadedDrm) {
    this.registry = registry; this.loaded = loaded;
    const config = loaded.document.declarations[0]?.configuration;
    if (!config) throw new TypeError('Missing axial question configuration');
    this.config = retainNativeJson(config);
    this.callbacks = Object.freeze({ 'axial.select': args => this.select(args.request as unknown as R[]) as JsonObject });
  }
  static async create(): Promise<AxialPolicy> {
    const source = (V6_DECLARATIVE_SOURCES as R)[LOCAL];
    if (!source) throw new TypeError('Missing original axial question DRM');
    const registry = new NativeDrmRegistry(), loaded = await registry.registerSource(source.text, source.sha256);
    registry.seal();
    const policy = new AxialPolicy(registry, loaded);
    policy.program = await NativeSrcProgram.create(WORKFLOW, policy.callbacks); return policy;
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> { this.program = await registry.registerProgram(WORKFLOW, this.callbacks); }
  select(request: readonly R[]): R {
    let chosen: readonly (number | string)[] | null = null;
    for (const [index, offer] of request.entries()) {
      const priority = (this.config.priority as string[]).indexOf(offer.kind);
      if (priority < 0 || !(this.config.conditions as DrmCondition[]).every(c => factConditionHolds(c, offer.facts))) continue;
      const rank = [priority, offer.quarter_distance, offer.recalled_control_first, offer.action, index];
      if (chosen === null || compare(rank, chosen) < 0) chosen = rank;
    }
    if (chosen === null) return { status: 'abstain', release_authority: false };
    const index = chosen[4] as number, offer = request[index]!;
    return { status: 'selected', index, reason: this.config.kind_meaning[offer.kind], hypotheses: [
      'target_marker_is_final_occupancy_goal', 'cooriented_pair_may_approach_opposed_pair_may_separate',
      'rotation_command_prior_or_current_recalled_method',
    ], release_authority: false };
  }
  async choose(rows: readonly R[]): Promise<readonly [R, AxialReceipt]> {
    const request = rows.map(row => Object.fromEntries(['kind', 'facts', 'quarter_distance', 'recalled_control_first', 'action']
      .map(k => [k, row[k]])));
    const { result, receipt } = await this.program.run({ request } as JsonObject);
    if (!isJsonObject(result)) throw new TypeError('Axial SRC returned no mapping');
    return [result, retainNativeJson({ workflow: receipt.workflow, src_hash: receipt.src_hash,
      src_status: receipt.src_status, executed_statements: receipt.executed_statements })];
  }
}
