/** Public-return test driver. Expected commands are checked after native choice. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createNativeV6Runtime } from '../../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativePublicObservation, NativeRuntimeYield } from '../../src/logos-engine/v6-native-types.ts';

export type R = Record<string, any>;
export const copy = <T>(value: T): T => structuredClone(value);
const root = new URL('../../', import.meta.url);
const source = new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', root);
export const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
export const materialPolicy = declarations.strategy.declarations[0]!.configuration.window_constraints;
export const materialComponent = JSON.parse(gunzipSync(await readFile(new URL('tests/fixtures/v6-typed-material-original-public.json.gz', root))).toString()) as R;
export const materialPublicTrace = JSON.parse(gunzipSync(await readFile(new URL('docs/migration/native-campaigns-v50/life-public-trace-final.json.gz', root))).toString()) as R;
export const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
export const MATERIAL_OWNER = 'family_state:public_occurrence_recall';
export const MATERIAL_EVENT_KINDS = new Set(['typed_carrier_response', 'typed_material_flow', 'typed_pose_scope', 'typed_pose_model', 'typed_pose_response']);

type Runtime = Awaited<ReturnType<typeof createNativeV6Runtime>>;
type Factory = typeof createNativeV6Runtime;

/** Every setup return is a retained public packet, not imported learned state. */
export class CommonMaterialReplay {
  readonly runtime: Runtime;
  result!: NativeRuntimeYield;
  packetIndex = 0;
  readonly timeline: R[] = [];
  private constructor(runtime: Runtime) { this.runtime = runtime; }

  static async cold(name: string, factory: Factory = createNativeV6Runtime): Promise<CommonMaterialReplay> {
    const runtime = await factory(declarations, { now: () => 0 });
    const driver = new CommonMaterialReplay(runtime);
    driver.result = await runtime.initialize({ sessionId: name, observation: copy(materialPublicTrace.packets[0].packet),
      budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600], maxActions: 1800 } }, execution);
    return driver;
  }

  /** Read the real retained graph, never a second model of its contents. */
  retained(id: string): R {
    const store = (this.runtime as unknown as { knowledge: { stateValue(id: string): R } }).knowledge;
    return copy(store.stateValue(id));
  }
  attention(): R | null { return this.retained('caller:attention').composition; }
  async ready(): Promise<NativeRuntimeYield> {
    if (this.result.kind === 'boundary') this.result = await this.runtime.resume(execution);
    return this.result;
  }
  async recorded(): Promise<NativeRuntimeYield> {
    await this.ready();
    assert.equal(this.result.kind, 'action', this.result.reason ?? 'A recorded public return requires an actual released action');
    const next = materialPublicTrace.packets[this.packetIndex + 1];
    assert.ok(next, 'Recorded public sequence exhausted');
    assert.deepEqual(this.result.command, next.command, 'Check expected command only after common WHY/ACT chose it');
    return this.returned(copy(next.packet));
  }
  async returned(packet: NativePublicObservation): Promise<NativeRuntimeYield> {
    assert.equal(this.result.kind, 'action');
    assert.ok(this.result.command && this.result.authorization, 'The public experiment requires normal shared authority');
    const before = this.result, proposal = copy(before.snapshot.proposal as R);
    this.result = await this.runtime.advance({ command: before.command!, executionMs: 0, observation: packet }, execution);
    this.packetIndex++;
    if (this.result.kind !== 'action') this.timeline.push({
      actions: this.result.snapshot.actions, levelsCompleted: this.result.snapshot.levelsCompleted,
      proposalKind: proposal.kind, poseMode: proposal.material_pose_plan?.mode ?? null,
      flowMode: proposal.material_flow_plan?.mode ?? null, dependency: proposal.native_composition_dependency ?? null,
      target: proposal.composition_target_tree, attention: this.attention(),
      callerAcquisitions: (this.result.snapshot.caller as R).acquiredTransitions,
      materialEventCount: this.retained(MATERIAL_OWNER).events.filter((event: R) => MATERIAL_EVENT_KINDS.has(event.kind)).length,
    });
    return this.result;
  }
  async until(predicate: (proposal: R) => boolean): Promise<NativeRuntimeYield> {
    for (let count = 0; count <= materialPublicTrace.packets.length; count++) {
      await this.ready();
      assert.equal(this.result.kind, 'action', this.result.reason ?? 'Expected a current common proposal');
      if (predicate(this.result.snapshot.proposal as R)) return this.result;
      await this.recorded();
    }
    throw new Error('The measured public sequence did not contain the requested semantic branch');
  }
}
