/** Exact V6 MorphologyPolicy measurement/binding boundary over native DRM/SRC. */
import { immutableJson, isJsonObject } from './canonical.ts';
import { NativeDrmRegistry, projectDeclaredAlternatives } from './v6-drm-projector.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES } from './v6-src-program.ts';
import type { JsonObject, JsonValue, Primitive } from './ir.ts';
import type { NativeProgramHandle, NativeProgramRegistry } from './v6-native-types.ts';

const POLICY = 'agents/yf_arc3_v6/morphology_policy/morphology_policy.drm';
const PRINCIPLES = 'agents/yf_arc3_v5/drm/morphology.drm';
const FLAGS = ['framed_pair', 'homologous', 'asymmetric', 'control_attested', 'single_pattern_contact_change', 'alignment_refuted'] as const;
const OUTPUT = ['role', 'composition', 'operation', 'route_key', 'status', 'reason', 'alternatives', 'falsifiers', 'principle_refs', 'projection_refs', 'release_authority'] as const;
const ROUTES = ['modifier', 'peer', 'peer_access_probe', 'feature_probe', 'capacity_probe', 'capacity_access_probe', 'managed_access', 'entry_rebind', 'entry_probe'];
const own = (object: object, key: string) => Object.hasOwn(object, key);
function get(facts: JsonObject, field: string, otherwise: JsonValue = null): JsonValue { return own(facts, field) ? facts[field]! : otherwise; }
function truthy(value: JsonValue): boolean {
  if (value === null || value === false || value === 0 || value === '') return false;
  return typeof value === 'object' ? Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0 : true;
}
function xy(value: JsonValue): readonly [number, number] | null {
  return Array.isArray(value) && value.length === 2 && value.every(v => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 64)
    ? value as unknown as readonly [number, number] : null;
}
function samePoint(left: readonly number[] | null, right: readonly number[] | null): boolean {
  return left !== null && right !== null && left[0] === right[0] && left[1] === right[1];
}
export function morphologyRouteBinding(facts: JsonObject, route: JsonValue, expected: string): string {
  if (!isJsonObject(route)) return 'missing';
  if (['observation_ref', 'level_epoch'].some(key => get(route, key) !== facts[key])) return 'stale_scope';
  const start = xy(get(facts, 'controlled_xy')), end = xy(get(facts, `${expected}_xy`));
  if (!start || !end || !samePoint(xy(get(route, 'start_xy')), start) || !samePoint(xy(get(route, 'end_xy')), end)) return 'unbound_endpoint';
  const actions = get(route, 'actions');
  if (!Array.isArray(actions) || actions.length < 1 || actions.length > 16) return 'missing_bounded_set';
  return 'bound';
}
function declaredSource(path: string): { text: string; sha256: string } {
  const source = (V6_DECLARATIVE_SOURCES as JsonObject)[path];
  if (!isJsonObject(source) || typeof source.text !== 'string' || typeof source.sha256 !== 'string') throw new Error(`Missing transferred DRM source: ${path}`);
  return { text: source.text, sha256: source.sha256 };
}

export class NativeMorphologyPolicy {
  readonly registry: NativeDrmRegistry;
  readonly drmHash: string;
  readonly principlesHash: string;
  private program!: NativeProgramHandle;
  private readonly callbacks: Readonly<Record<string, Primitive>>;
  private constructor(registry: NativeDrmRegistry, drmHash: string, principlesHash: string) {
    this.registry = registry; this.drmHash = drmHash; this.principlesHash = principlesHash;
    this.callbacks = Object.freeze({ 'morph.project': (args: JsonObject) => {
      if (typeof args.policy !== 'string' || !isJsonObject(args.facts)) throw new TypeError('Morphology projection requires policy and facts');
      return this.project(args.policy, args.facts);
    } });
  }
  static async create(): Promise<NativeMorphologyPolicy> {
    const registry = new NativeDrmRegistry(), policy = declaredSource(POLICY), principles = declaredSource(PRINCIPLES);
    await registry.registerSource(policy.text, policy.sha256);
    await registry.registerSource(principles.text, principles.sha256);
    registry.seal();
    const result = new NativeMorphologyPolicy(registry, policy.sha256, principles.sha256);
    result.program = await NativeSrcProgram.create('v6.morphology.evaluate', result.callbacks);
    return result;
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> {
    this.program = await registry.registerProgram('v6.morphology.evaluate', this.callbacks);
  }
  project(policy: string, facts: JsonObject): JsonObject {
    const projection = projectDeclaredAlternatives({ drm: this.registry, selection_policy_ref: policy,
      alternative_refs: [], descriptive_facts: facts });
    if (projection.alternative_refs.length !== 1) throw new Error('Morphology projection requires exactly one declared alternative');
    const result = projection.alternative_facts[projection.alternative_refs[0]!]!;
    if (!isJsonObject(result)) throw new TypeError('Morphology projection is not a fact mapping');
    const prior = get(facts, 'projection_refs', []);
    if (!Array.isArray(prior)) throw new TypeError('projection_refs must be a sequence');
    return { ...result, projection_refs: [...prior, ...projection.projection_refs] };
  }
  async evaluate(facts: JsonObject): Promise<JsonObject> {
    const context: Record<string, JsonValue> = { observation_ref: get(facts, 'observation_ref'), level_epoch: get(facts, 'level_epoch') };
    if (Object.values(context).some(value => !(typeof value === 'string' || typeof value === 'number' && Number.isSafeInteger(value)) || value === '')) {
      throw new Error('Current observation and epoch required');
    }
    for (const key of FLAGS) {
      const value = get(facts, key, false);
      if (typeof value !== 'boolean') throw new Error(`Boolean measurement required: ${key}`);
      context[key] = value;
    }
    const orientation = get(facts, 'orientation_relation', 'ambiguous');
    if (typeof orientation !== 'string' || !['different', 'aligned', 'ambiguous'].includes(orientation)) throw new Error('Invalid measured orientation relation');
    context.orientation_relation = orientation;
    const color = get(facts, 'color_relation', 'unmeasured');
    if (typeof color !== 'string' || !['equal', 'different', 'unmeasured'].includes(color)) throw new Error('Invalid public palette comparison');
    context.color_relation = color;
    const discrimination = get(facts, 'peer_discrimination_bound', false);
    if (typeof discrimination !== 'boolean') throw new Error('Boolean peer discrimination measurement required');
    context.peer_discrimination_bound = discrimination;
    for (const key of ['extension_route', 'extension_kind']) context[key] = get(facts, key);
    for (const key of ['managed_capacity_bound', 'entry_rebind_bound', 'entry_probe_bound', 'feature_reaccess_bound', 'capacity_needed']) context[key] = get(facts, key, false);
    const measurements: Record<string, JsonValue> = {};
    const routes = get(facts, 'routes', {});
    if (!isJsonObject(routes)) throw new TypeError('Routes must be a current measured mapping');
    for (const name of ROUTES) {
      const route = get(routes, name);
      const bound = morphologyRouteBinding({ ...context, controlled_xy: get(facts, 'controlled_xy'), [`${name}_xy`]: get(facts, `${name}_xy`) }, route, name);
      measurements[name] = bound; context[`${name}_route_bound`] = bound === 'bound';
      const forecast = get(facts, 'meter_forecast');
      if (truthy(route) && !isJsonObject(route)) throw new TypeError('A route must be a measured mapping');
      const actions = isJsonObject(route) ? get(route, 'actions', []) : [];
      if (truthy(route) && !Array.isArray(actions)) throw new TypeError('Route actions must be a sequence');
      const length = truthy(route) && isJsonObject(route) ? get(route, 'full_access_length', (actions as readonly JsonValue[]).length) : 0;
      if (truthy(forecast) && (!isJsonObject(forecast) || typeof forecast.steps_before_empty !== 'number' || typeof length !== 'number')) throw new TypeError('Invalid measured reserve forecast');
      context[`${name}_fits_forecast`] = !truthy(forecast) || (length as number) <= ((forecast as JsonObject).steps_before_empty as number);
      context[`${name}_approach_only`] = truthy(route) && isJsonObject(route) && route.contact_in_prefix === false;
    }
    const { result, receipt } = await this.program.run({ facts: context });
    if (!isJsonObject(result)) throw new TypeError('Morphology SRC returned no decision mapping');
    const decision: Record<string, JsonValue> = {};
    for (const field of OUTPUT) {
      if (!own(result, field)) throw new Error(`Morphology output field is absent: ${field}`);
      decision[field] = result[field]!;
    }
    for (const field of ['feature_hypotheses', 'feature_falsifiers', 'preserve_features']) if (own(result, field)) decision[field] = result[field]!;
    const principles = decision.principle_refs;
    if (!Array.isArray(principles)) throw new TypeError('Principle references must be a sequence');
    const principleEvidence = principles.map(ref => {
      if (typeof ref !== 'string') throw new TypeError('Principle reference must be a string');
      const [declaration, source] = this.registry.resolve(ref);
      if (source.source_hash !== this.principlesHash) throw new Error('Morphology principle belongs to a different source');
      return { id: declaration.id, falsifiers: [...(declaration.falsifiers ?? [])] };
    });
    return immutableJson({ ...decision, ...receipt, drm_hash: this.drmHash, principles_hash: this.principlesHash,
      principle_evidence: principleEvidence, route_bindings: measurements, level_epoch: context.level_epoch!, observation_ref: context.observation_ref! }) as JsonObject;
  }
}
