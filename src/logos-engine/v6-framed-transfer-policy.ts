/**
 * FramedPolicy from the pinned V6 framed_transfer/policy.py. The two workflows
 * execute in the common native SRC interpreter; selection and record projection
 * consume only the explicitly extracted V5 declarations in the attached data.
 * This registry is a consumed subset, not the full original production registry.
 */
import transferred from './v6/framed-transfer-policy.json' with { type: 'json' };
import { compareUnicode, isJsonObject } from './canonical.ts';
import { NativeDrmRegistry, factConditionHolds } from './v6-drm-projector.ts';
import type { DrmCondition, NativeLoadedDrm } from './v6-drm-projector.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES, V6_NATIVE_PROGRAM_REFERENCE } from './v6-src-program.ts';
import type { NativeSrcReceipt } from './v6-src-program.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import type { NativeProgramHandle, NativeProgramRegistry } from './v6-native-types.ts';
import type { JsonObject, JsonValue, Primitive } from './ir.ts';

type R = Record<string, any>;
const LOCAL_SOURCE = 'agents/yf_arc3_v6/morphology_policy/framed_transfer/framed.drm';
const CHOOSE = 'v6.framed_transfer.choose';
const RECORD = 'v6.framed_transfer.record';
const own = (value: object, key: string): boolean => Object.hasOwn(value, key);

interface PolicySubset {
  schema: string; referenceCommit: string; scope: string; sourceHashes: Record<string, string>;
  routeFields: string[]; projectionOwner: string; recordPolicies: string[]; recordRules: string[];
  document: { text: string; sha256: string };
}
export const FRAMED_POLICY_SUBSET = retainNativeJson(transferred as PolicySubset);

class MissingProjectionField extends Error {
  constructor(field: string) {
    super(`missing_declared_projection_field:'${field}'`);
    this.name = 'MissingProjectionField';
  }
}

/**
 * These source templates use scalar named fields without format specifications.
 * Unlike the general DRM renderer, Python format_map performs one substitution
 * pass: braces inside an inserted value remain literal. Unsupported format
 * syntax is rejected instead of silently acquiring broader Python semantics.
 */
export function framedFormatMap(pattern: string, facts: R): string {
  let result = '';
  for (let i = 0; i < pattern.length;) {
    const current = pattern[i]!;
    if (current === '{' && pattern[i + 1] === '{' || current === '}' && pattern[i + 1] === '}') {
      result += current; i += 2; continue;
    }
    if (current === '}') throw new TypeError('Unsupported framed template closing brace');
    if (current !== '{') { result += current; i++; continue; }
    const end = pattern.indexOf('}', i + 1), field = pattern.slice(i + 1, end);
    if (end < 0 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)) throw new TypeError('Outside framed scalar template contract');
    if (!own(facts, field)) throw new MissingProjectionField(field);
    const value = facts[field];
    if (value === null) result += 'None';
    else if (typeof value === 'boolean') result += value ? 'True' : 'False';
    else if (typeof value === 'string') result += value;
    else if (typeof value === 'number' && Number.isSafeInteger(value)) result += String(value);
    else throw new TypeError(`Outside framed scalar template value contract: ${field}`);
    i = end + 1;
  }
  return result;
}

/** Tuple ordering in select is priority, coordinates, candidate reference, index. */
function compareTie(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (typeof left === 'string' && typeof right === 'string') return compareUnicode(left, right);
  throw new TypeError('Framed tie-break requires measured numeric coordinates or references');
}

export class FramedPolicy {
  readonly registry: NativeDrmRegistry;
  readonly loaded: NativeLoadedDrm;
  readonly config: R;
  readonly route: R;
  readonly projections: Readonly<Record<string, R>>;
  readonly policies: Readonly<Record<string, R>>;
  readonly rules: Readonly<Record<string, R>>;
  readonly mask: R;
  private src!: NativeProgramHandle;
  private recordSrc!: NativeProgramHandle;
  private readonly callbacks: Readonly<Record<string, Primitive>>;

  private constructor(registry: NativeDrmRegistry, loaded: NativeLoadedDrm) {
    this.registry = registry; this.loaded = loaded;
    const local = loaded.document.declarations[0]?.configuration;
    if (!local) throw new TypeError('Framed declaration has no configuration');
    this.config = retainNativeJson(local) as R;
    this.route = registry.resolve('policy.declared_transferred_quantized_plan')[0].configuration as R;
    const declared = registry.resolve(FRAMED_POLICY_SUBSET.projectionOwner)[0].fact_projections ?? [];
    const projections: Record<string, R> = {};
    for (const projection of declared) if (this.config.priority.includes(projection.id)) projections[projection.id] = projection;
    Object.assign(projections, this.config.local_projections ?? {});
    if (Object.keys(projections).length !== new Set(this.config.priority).size
      || this.config.priority.some((key: string) => !own(projections, key))) throw new TypeError('unbound V5 projection');
    this.projections = retainNativeJson(projections);
    const policies: Record<string, R> = {}, rules: Record<string, R> = {};
    for (const key of this.config.record_policies as string[]) {
      const declaration = registry.resolve(key)[0]; policies[key] = declaration;
      for (const rule of Object.values(declaration.meaning_template_ref_by_alternative as Record<string, string>)) {
        rules[rule] = registry.resolve(rule)[0];
      }
    }
    this.policies = retainNativeJson(policies); this.rules = retainNativeJson(rules);
    this.mask = (registry.resolve('policy.record_framed_mask_correspondence')[0].configuration as R).measurement_contract;
    this.callbacks = Object.freeze({
      'framed.measure': args => args.request!,
      'framed.select': args => {
        if (!Array.isArray(args.measured)) throw new TypeError('Framed choose requires measured rows');
        return this.select(args.measured as R[]) as JsonObject;
      },
      'framed.record': args => {
        if (!isJsonObject(args.request)) throw new TypeError('Framed record requires a request');
        return this.projectRecord(args.request) as JsonObject;
      },
    });
  }

  static async create(): Promise<FramedPolicy> {
    if (FRAMED_POLICY_SUBSET.schema !== 'logos-engine.v6.framed-transfer-policy-subset.v1'
      || FRAMED_POLICY_SUBSET.referenceCommit !== V6_NATIVE_PROGRAM_REFERENCE) throw new TypeError('Framed declaration reference mismatch');
    const source = (V6_DECLARATIVE_SOURCES as R)[LOCAL_SOURCE];
    if (!source || source.sha256 !== FRAMED_POLICY_SUBSET.sourceHashes[LOCAL_SOURCE]) throw new TypeError('Framed local DRM source mismatch');
    const registry = new NativeDrmRegistry();
    const loaded = await registry.registerSource(source.text, source.sha256);
    await registry.registerSource(FRAMED_POLICY_SUBSET.document.text, FRAMED_POLICY_SUBSET.document.sha256);
    registry.seal();
    const policy = new FramedPolicy(registry, loaded);
    [policy.src, policy.recordSrc] = await Promise.all([
      NativeSrcProgram.create(CHOOSE, policy.callbacks), NativeSrcProgram.create(RECORD, policy.callbacks),
    ]);
    return policy;
  }

  /** The owning runtime installs handles backed by its one common program store. */
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> {
    // Both registrations write the same transactional knowledge store. Keep
    // those writes sequential; standalone creation above has no shared store.
    const choose = await registry.registerProgram(CHOOSE, this.callbacks);
    const record = await registry.registerProgram(RECORD, this.callbacks);
    this.src = choose; this.recordSrc = record;
  }

  holds(conditions: readonly DrmCondition[], facts: R): boolean {
    return conditions.every(condition => factConditionHolds(condition, facts as JsonObject));
  }

  projected(projection: R, facts: R): R {
    const result: R = { ...facts, ...structuredClone(projection.static_facts ?? {}) };
    for (const [field, source] of Object.entries(projection.bound_facts ?? {}) as [string, string][]) {
      result[field] = own(facts, source) ? facts[source] : null;
    }
    for (const [field, value] of Object.entries(projection.templated_facts ?? {})) {
      if (typeof value === 'string') result[field] = framedFormatMap(value, facts);
      else if (Array.isArray(value) && value.every(item => typeof item === 'string')) result[field] = value.map(item => framedFormatMap(item, facts));
      else throw new TypeError('Outside framed source template contract');
    }
    return result;
  }

  select(measured: readonly R[]): R {
    const eligible: { rank: number; order: unknown[]; index: number; key: string }[] = [];
    measured.forEach((row, index) => {
      (this.config.priority as string[]).forEach((key, rank) => {
        const projection = this.projections[key]!;
        if (this.holds(projection.all_conditions, row.facts) && this.holds(this.config.local_conditions, row.facts)
          && this.holds(this.config.projection_scope_conditions?.[key] ?? [], row.facts)) {
          eligible.push({ rank, order: this.config.tie_break.map((field: string) => row[field]), index, key });
        }
      });
    });
    if (!eligible.length) return { status: 'abstain', release_authority: false };
    eligible.sort((left, right) => {
      if (left.rank !== right.rank) return left.rank - right.rank;
      for (let i = 0; i < left.order.length; i++) {
        const order = compareTie(left.order[i], right.order[i]); if (order) return order;
      }
      return left.index - right.index || compareUnicode(left.key, right.key);
    });
    const selected = eligible[0]!;
    try {
      return { status: 'selected', index: selected.index, projection_ref: selected.key,
        projected: this.projected(this.projections[selected.key]!, measured[selected.index]!.facts),
        release_authority: false, competing_current_offers: eligible.length };
    } catch (error) {
      if (!(error instanceof MissingProjectionField)) throw error;
      return { status: 'unbound_declared_why', reason: error.message, release_authority: false };
    }
  }

  async choose(rows: readonly R[]): Promise<readonly [R, NativeSrcReceipt]> {
    const { result, receipt } = await this.src.run({ request: rows as JsonValue });
    if (!isJsonObject(result)) throw new TypeError('Framed choose did not return a mapping');
    return [result, receipt];
  }

  projectRecord(request: R): R {
    const policy = this.policies[request.policy];
    if (!policy) throw new TypeError('Undeclared framed recording policy');
    let facts = request.facts as R;
    if (!this.holds(policy.selection_eligibility_conditions, facts)) return { status: 'rejected' };
    for (const projection of policy.fact_projections ?? []) if (this.holds(projection.all_conditions ?? [], facts)) {
      try { facts = this.projected(projection, facts); }
      catch (error) {
        if (!(error instanceof MissingProjectionField)) throw error;
        return { status: 'incomplete', reason: error.message };
      }
    }
    const names = Object.values(policy.meaning_template_ref_by_alternative) as string[];
    if (names.length !== 1) return { status: 'ambiguous' };
    const rule = this.rules[names[0]!]!, template = rule.term_templates[0];
    if (template.required_fields.some((key: string) => !own(facts, key))) return { status: 'incomplete' };
    const bound = (bindings: Record<string, string>): R => Object.fromEntries(Object.entries(bindings)
      .map(([key, field]) => [key, own(facts, field) ? facts[field] : null]));
    const record: R = { ...(template.static_attributes ?? {}), ...bound(template.attribute_bindings) };
    const claims: R[] = [];
    for (const claim of rule.claim_templates) {
      if ((claim.required_fields ?? []).some((key: string) => !own(facts, key))) return { status: 'incomplete_claim' };
      claims.push({ id: framedFormatMap(claim.id_pattern, facts), predicate: claim.predicate, family: claim.family,
        epistemic_status: claim.epistemic_status, arguments: claim.argument_patterns.map((value: string) => framedFormatMap(value, facts)),
        attributes: { ...(claim.static_attributes ?? {}), ...bound(claim.attribute_bindings ?? {}) } });
    }
    if (!claims.some(claim => claim.id === (record.source_claim_ref ?? null))) return { status: 'unbound_source_claim' };
    record.claims = claims;
    return { status: 'derived', record, rule_ref: names[0], policy_ref: policy.id,
      event_ref: framedFormatMap(template.id_pattern, facts), release_authority: false };
  }

  async record(policy: string, facts: R): Promise<readonly [R, NativeSrcReceipt]> {
    const { result, receipt } = await this.recordSrc.run({ request: { policy, facts: facts as JsonObject } });
    if (!isJsonObject(result)) throw new TypeError('Framed record did not return a mapping');
    return [result, receipt];
  }
}
