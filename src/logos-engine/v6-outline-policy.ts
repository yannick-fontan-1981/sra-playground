/** Strict V6 OutlinePolicy, using the common DRM matcher and SRC interpreter.
 * Its V5 registry is the declared consumed route subset, not a full registry. */
import transferred from './v6/outline-policy.json' with { type: 'json' };
import { isJsonObject } from './canonical.ts';
import { NativeDrmRegistry, factConditionHolds } from './v6-drm-projector.ts';
import type { DrmCondition, NativeLoadedDrm } from './v6-drm-projector.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES, V6_NATIVE_PROGRAM_REFERENCE } from './v6-src-program.ts';
import type { NativeSrcReceipt } from './v6-src-program.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import type { NativeProgramHandle, NativeProgramRegistry } from './v6-native-types.ts';
import type { JsonObject, Primitive } from './ir.ts';
import { outlineTruthy } from './v6-outline-identity.ts';

type R = Record<string, any>;
const LOCAL = 'agents/yf_arc3_v6/morphology_policy/outline_service/outline.drm';
const CHOOSE = 'v6.outline_service.choose', CONTROL = 'v6.outline_service.bind_control';
export const OUTLINE_POLICY_SUBSET = retainNativeJson(transferred);

export class OutlinePolicy {
  readonly loaded: NativeLoadedDrm;
  readonly registry: NativeDrmRegistry;
  readonly config: R;
  readonly control_config: R;
  readonly route_config: R;
  private src!: NativeProgramHandle;
  private controlSrc!: NativeProgramHandle;
  private readonly callbacks: Readonly<Record<string, Primitive>>;

  private constructor(registry: NativeDrmRegistry, loaded: NativeLoadedDrm) {
    this.registry = registry; this.loaded = loaded;
    const declarations = loaded.document.declarations;
    if (!declarations[0]?.configuration || !declarations[1]?.configuration) throw new TypeError('Missing outline declaration');
    this.config = retainNativeJson(declarations[0].configuration);
    this.control_config = retainNativeJson(declarations[1].configuration);
    this.route_config = retainNativeJson(registry.resolve('policy.declared_transferred_quantized_plan')[0].configuration!);
    this.callbacks = Object.freeze({
      'outline.measure': args => args.request!,
      'outline.interpret': args => {
        if (!isJsonObject(args.measured)) throw new TypeError('Outline interpret requires measured facts');
        return this.interpret(args.measured) as JsonObject;
      },
      'outline.control': args => {
        if (!isJsonObject(args.measured)) throw new TypeError('Outline control requires measured facts');
        return this.interpretControl(args.measured) as JsonObject;
      },
    });
  }

  static async create(): Promise<OutlinePolicy> {
    if (OUTLINE_POLICY_SUBSET.schema !== 'logos-engine.v6.outline-policy-subset.v1'
      || OUTLINE_POLICY_SUBSET.referenceCommit !== V6_NATIVE_PROGRAM_REFERENCE) throw new TypeError('Outline subset reference mismatch');
    const source = (V6_DECLARATIVE_SOURCES as R)[LOCAL];
    if (!source || source.sha256 !== OUTLINE_POLICY_SUBSET.sourceHashes[LOCAL]) throw new TypeError('Outline DRM reference mismatch');
    const registry = new NativeDrmRegistry();
    const loaded = await registry.registerSource(source.text, source.sha256);
    await registry.registerSource(OUTLINE_POLICY_SUBSET.document.text, OUTLINE_POLICY_SUBSET.document.sha256);
    registry.seal();
    const policy = new OutlinePolicy(registry, loaded);
    [policy.src, policy.controlSrc] = await Promise.all([
      NativeSrcProgram.create(CHOOSE, policy.callbacks), NativeSrcProgram.create(CONTROL, policy.callbacks),
    ]);
    return policy;
  }

  async attachPrograms(registry: NativeProgramRegistry): Promise<void> {
    // These registrations use one transactional common knowledge store.
    const choose = await registry.registerProgram(CHOOSE, this.callbacks);
    const control = await registry.registerProgram(CONTROL, this.callbacks);
    this.src = choose; this.controlSrc = control;
  }

  private conclusions(configuration: R, measured: R): R {
    const conclusions = configuration.rules.filter((rule: R) => rule.all_conditions.every(
      (condition: DrmCondition) => factConditionHolds(condition, measured as JsonObject),
    )).map((rule: R) => ({ rule_ref: rule.id, ...structuredClone(rule.conclusions) }));
    return { status: conclusions.length === 1 ? 'unique' : conclusions.length ? 'ambiguous' : 'abstain', conclusions, release_authority: false };
  }

  interpretControl(measured: R): R { return this.conclusions(this.control_config, measured); }
  interpret(measured: R): R {
    if (!outlineTruthy(measured.current_scope_and_observation)) return { status: 'unbound', release_authority: false };
    return this.conclusions(this.config, measured);
  }
  async bindControl(facts: R): Promise<readonly [R, NativeSrcReceipt]> {
    const { result, receipt } = await this.controlSrc.run({ request: facts as JsonObject });
    if (!isJsonObject(result)) throw new TypeError('Outline binding did not return a mapping');
    return [result, receipt];
  }
  async evaluate(facts: R): Promise<readonly [R, NativeSrcReceipt]> {
    const { result, receipt } = await this.src.run({ request: facts as JsonObject });
    if (!isJsonObject(result)) throw new TypeError('Outline decision did not return a mapping');
    return [result, receipt];
  }
}
