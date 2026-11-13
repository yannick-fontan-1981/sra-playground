/** Pinned WindowPolicy: local DRM priority, cost and source enumeration order. */
import { isJsonObject } from './canonical.ts';
import { NativeDrmRegistry, factConditionHolds } from './v6-drm-projector.ts';
import type { DrmCondition, NativeLoadedDrm } from './v6-drm-projector.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES } from './v6-src-program.ts';
import type { NativeSrcReceipt } from './v6-src-program.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import type { NativeProgramHandle, NativeProgramRegistry } from './v6-native-types.ts';
import type { JsonObject, Primitive } from './ir.ts';

type R = Record<string, any>;
const LOCAL = 'agents/yf_arc3_v6/morphology_policy/window_question/window.drm';
const WORKFLOW = 'v6.window_question.choose';
export type WindowReceipt = Pick<NativeSrcReceipt, 'workflow' | 'src_hash' | 'src_status' | 'executed_statements'>;

export class WindowPolicy {
  readonly registry: NativeDrmRegistry;
  readonly loaded: NativeLoadedDrm;
  readonly config: R;
  private program!: NativeProgramHandle;
  private readonly callbacks: Readonly<Record<string, Primitive>>;

  private constructor(registry: NativeDrmRegistry, loaded: NativeLoadedDrm) {
    this.registry = registry; this.loaded = loaded;
    const config = loaded.document.declarations[0]?.configuration;
    if (!config) throw new TypeError('Missing window question configuration');
    this.config = retainNativeJson(config);
    this.callbacks = Object.freeze({ 'window.select': args => this.select(args.request as unknown as R[]) as JsonObject });
  }
  static async create(): Promise<WindowPolicy> {
    const source = (V6_DECLARATIVE_SOURCES as R)[LOCAL];
    if (!source) throw new TypeError('Missing original window question DRM');
    const registry = new NativeDrmRegistry(), loaded = await registry.registerSource(source.text, source.sha256);
    registry.seal();
    const policy = new WindowPolicy(registry, loaded);
    policy.program = await NativeSrcProgram.create(WORKFLOW, policy.callbacks); return policy;
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> {
    this.program = await registry.registerProgram(WORKFLOW, this.callbacks);
  }
  select(request: readonly R[]): R {
    let chosen: { priority: number; cost: number; index: number } | null = null;
    for (const [index, offer] of request.entries()) {
      const priority = (this.config.priority as string[]).indexOf(offer.kind);
      if (priority < 0 || !(this.config.conditions as DrmCondition[]).every(condition => factConditionHolds(condition, offer.facts))) continue;
      // The source minimum is (priority, cost, i, i). Enumeration already
      // visits i in ascending order, so an exact tie retains the first offer.
      if (chosen === null || priority < chosen.priority || priority === chosen.priority && offer.cost < chosen.cost) {
        chosen = { priority, cost: offer.cost, index };
      }
    }
    if (chosen === null) return { status: 'abstain', release_authority: false };
    const index = chosen.index, offer = request[index]!;
    return { status: 'selected', index, reason: this.config.kind_meaning[offer.kind],
      hypotheses: this.config.hypotheses, release_authority: false };
  }
  async choose(rows: readonly R[]): Promise<readonly [R, WindowReceipt]> {
    const request = rows.map(row => Object.fromEntries(['kind', 'facts', 'cost'].map(key => [key, row[key]])));
    const { result, receipt } = await this.program.run({ request } as JsonObject);
    if (!isJsonObject(result)) throw new TypeError('Window SRC returned no mapping');
    return [result, retainNativeJson({ workflow: receipt.workflow, src_hash: receipt.src_hash,
      src_status: receipt.src_status, executed_statements: receipt.executed_statements })];
  }
}
