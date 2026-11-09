/** Exact V6 InventoryPolicy over its unchanged declared DRM and SRC. */
import transferred from './v6/inventory-policy.json' with { type: 'json' };
import { isJsonObject } from './canonical.ts';
import { NativeDrmRegistry, factConditionHolds } from './v6-drm-projector.ts';
import type { DrmCondition, NativeLoadedDrm } from './v6-drm-projector.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES, V6_NATIVE_PROGRAM_REFERENCE } from './v6-src-program.ts';
import type { NativeSrcReceipt } from './v6-src-program.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { pythonTruthy as truth } from './v6-operations.ts';
import type { JsonObject, Primitive } from './ir.ts';
import type { NativeProgramHandle } from './v6-native-types.ts';
type R = Record<string, any>;
const LOCAL = 'agents/yf_arc3_v6/morphology_policy/observed_inventory/inventory.drm';
export const INVENTORY_WORKFLOW = 'v6.observed_inventory.choose';
export const INVENTORY_POLICY_SOURCE = retainNativeJson(transferred);
export type InventoryReceipt = Pick<NativeSrcReceipt, 'workflow' | 'src_hash' | 'src_status' | 'executed_statements'>;
export const inventoryReceipt = (receipt: NativeSrcReceipt): InventoryReceipt => retainNativeJson({
  workflow: receipt.workflow, src_hash: receipt.src_hash, src_status: receipt.src_status, executed_statements: receipt.executed_statements,
});

export class InventoryPolicy {
  readonly registry: NativeDrmRegistry;
  readonly loaded: NativeLoadedDrm;
  readonly config: R;
  private program!: NativeProgramHandle;
  private constructor(registry: NativeDrmRegistry, loaded: NativeLoadedDrm) {
    this.registry = registry; this.loaded = loaded;
    const config = loaded.document.declarations[0]?.configuration;
    if (!config) throw new TypeError('Missing observed inventory configuration');
    this.config = retainNativeJson(config);
  }
  static async create(): Promise<InventoryPolicy> {
    if (INVENTORY_POLICY_SOURCE.schema !== 'logos-engine.v6.inventory-policy.v1'
      || INVENTORY_POLICY_SOURCE.referenceCommit !== V6_NATIVE_PROGRAM_REFERENCE) throw new TypeError('Inventory source reference mismatch');
    const source = (V6_DECLARATIVE_SOURCES as R)[LOCAL];
    if (!source || source.sha256 !== INVENTORY_POLICY_SOURCE.sourceHashes[LOCAL]) throw new TypeError('Inventory DRM source mismatch');
    const registry = new NativeDrmRegistry(), loaded = await registry.registerSource(source.text, source.sha256); registry.seal();
    const policy = new InventoryPolicy(registry, loaded);
    const callbacks: Readonly<Record<string, Primitive>> = Object.freeze({
      'inventory.measure': args => args.request!,
      'inventory.interpret': args => policy.interpret(args.measured as R) as JsonObject,
    });
    policy.program = await NativeSrcProgram.create(INVENTORY_WORKFLOW, callbacks); return policy;
  }
  interpret(measured: R): R {
    if (!truth(measured.current_scope_and_observation)) return { status: 'unbound', release_authority: false };
    const conclusions = this.config.rules.filter((rule: R) => rule.all_conditions.every(
      (condition: DrmCondition) => factConditionHolds(condition, measured as JsonObject),
    )).map((rule: R) => ({ rule_ref: rule.id, ...structuredClone(rule.conclusions) }));
    return { status: conclusions.length === 1 ? 'unique' : conclusions.length ? 'ambiguous' : 'abstain', conclusions, release_authority: false };
  }
  /** Standalone policy source surface. The family installs its own original
   * option-selection callbacks under this same workflow in the live registry. */
  async evaluate(facts: R): Promise<readonly [R, InventoryReceipt]> {
    const { result, receipt } = await this.program.run({ request: facts as JsonObject });
    if (!isJsonObject(result)) throw new TypeError('Inventory policy returned no mapping');
    return [result, inventoryReceipt(receipt)];
  }
}
