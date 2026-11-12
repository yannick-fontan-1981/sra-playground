/** Original ChartPolicy ranks conditional chart routes through its own DRM/SRC.
 * A selected route remains a hypothesis and never releases action authority.
 */
import { isJsonObject } from './canonical.ts';
import { NativeDrmRegistry, factConditionHolds } from './v6-drm-projector.ts';
import type { DrmCondition, NativeLoadedDrm } from './v6-drm-projector.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES } from './v6-src-program.ts';
import type { NativeSrcReceipt } from './v6-src-program.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import type { NativeProgramHandle, NativeProgramRegistry } from './v6-native-types.ts';
import type { JsonObject, Primitive } from './ir.ts';

type R = Record<string, any>;
const LOCAL = 'agents/yf_arc3_v6/morphology_policy/chart_navigation/chart.drm';
const WORKFLOW = 'v6.chart_navigation.choose';
export type ChartReceipt = Pick<NativeSrcReceipt, 'workflow' | 'src_hash' | 'src_status' | 'executed_statements'>;

/** Preserve Python tuple ordering, including command text and source index. */
function compare(left: readonly (number | string)[], right: readonly (number | string)[]): number {
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return left[index]! < right[index]! ? -1 : 1;
  }
  return 0;
}

export class ChartPolicy {
  readonly registry: NativeDrmRegistry;
  readonly loaded: NativeLoadedDrm;
  readonly config: R;
  private program!: NativeProgramHandle;
  private readonly callbacks: Readonly<Record<string, Primitive>>;

  private constructor(registry: NativeDrmRegistry, loaded: NativeLoadedDrm) {
    this.registry = registry; this.loaded = loaded;
    const config = loaded.document.declarations[0]?.configuration;
    if (!config) throw new TypeError('Missing chart navigation configuration');
    this.config = retainNativeJson(config);
    this.callbacks = Object.freeze({ 'chart.select': args => this.select(args.request as unknown as R[]) as JsonObject });
  }
  static async create(): Promise<ChartPolicy> {
    const source = (V6_DECLARATIVE_SOURCES as R)[LOCAL];
    if (!source) throw new TypeError('Missing original chart navigation DRM');
    const registry = new NativeDrmRegistry(), loaded = await registry.registerSource(source.text, source.sha256);
    registry.seal();
    const policy = new ChartPolicy(registry, loaded);
    policy.program = await NativeSrcProgram.create(WORKFLOW, policy.callbacks); return policy;
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> { this.program = await registry.registerProgram(WORKFLOW, this.callbacks); }
  select(request: readonly R[]): R {
    let chosen: readonly (number | string)[] | null = null;
    for (const [index, offer] of request.entries()) {
      const priority = (this.config.priority as string[]).indexOf(offer.kind);
      if (priority < 0 || !(this.config.conditions as DrmCondition[]).every(condition => factConditionHolds(condition, offer.facts))) continue;
      const rank = [priority, offer.distance, offer.action, index];
      if (chosen === null || compare(rank, chosen) < 0) chosen = rank;
    }
    if (chosen === null) return { status: 'abstain', release_authority: false };
    const index = chosen[3] as number, offer = request[index]!;
    return { status: 'selected', index, reason: this.config.kind_meaning[offer.kind], hypotheses: [
      'chart_is_navigation_model', 'directional_interface_prior', 'annotation_match_may_be_dependency',
      'same_marker_may_be_target', 'arrival_and_inventory_are_separate',
    ], release_authority: false };
  }
  async choose(rows: readonly R[]): Promise<readonly [R, ChartReceipt]> {
    const request = rows.map(row => Object.fromEntries(['kind', 'facts', 'distance', 'action'].map(key => [key, row[key]])));
    const { result, receipt } = await this.program.run({ request } as JsonObject);
    if (!isJsonObject(result)) throw new TypeError('Chart SRC returned no mapping');
    return [result, retainNativeJson({ workflow: receipt.workflow, src_hash: receipt.src_hash,
      src_status: receipt.src_status, executed_statements: receipt.executed_statements })];
  }
}
