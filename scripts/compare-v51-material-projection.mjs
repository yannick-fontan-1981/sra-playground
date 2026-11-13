/** Independent native-to-native material projection proof; no solver is imported. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const sha = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const FLAGS = ['typed_carrier_plan', 'material_flow_plan', 'material_pose_plan'];
const WRAPPER_KEYS = new Set(['composition_target_tree', 'field_subquestion', 'morphology', 'strategy_receipt']);
const PREFIXES = ['C_typed_carrier_', 'C_material_flow_', 'C_typed_pose_'];
const ascii = value => JSON.stringify(value).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
function canonical(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return ascii(value);
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), 'Material proof admits finite native numbers');
    return Object.is(value, -0) ? '-0.0' : String(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  assert.equal(typeof value, 'object');
  return '{' + Object.keys(value).sort().map(key => ascii(key) + ':' + canonical(value[key])).join(',') + '}';
}
const digest = value => sha(canonical(value));
const equal = (a, b) => canonical(a) === canonical(b);
function restoreNegativeZero(value, paths) {
  const restored = clone(value), seen = new Set();
  for (const path of paths) {
    assert.ok(Array.isArray(path) && path.length); const key = JSON.stringify(path);
    assert.ok(!seen.has(key), 'Negative-zero sidecar paths are unique'); seen.add(key);
    let node = restored;
    for (const part of path.slice(0, -1)) { assert.ok(Object.hasOwn(node, part)); node = node[part]; }
    const last = path.at(-1); assert.equal(typeof node[last], 'number'); assert.equal(node[last], 0); node[last] = -0;
  }
  return restored;
}
function aliases(hash) {
  return [[hash, ''], ...PREFIXES.map(prefix => [prefix + hash.slice(0, 20), prefix]), ['measured-material-support:' + hash, 'measured-material-support:']];
}
function rename(value, names, sortedSourceSets = false) {
  if (typeof value === 'string') return names.get(value) ?? value;
  if (Array.isArray(value)) {
    const result = value.map(item => rename(item, names, sortedSourceSets));
    if (sortedSourceSets && result.length === 2 && result[0] === 'ambiguous_source_core_extents') result[1] = result[1].toSorted();
    return result;
  }
  if (value && typeof value === 'object') {
    const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [names.get(key) ?? key, rename(item, names, sortedSourceSets)]));
    if (sortedSourceSets && Object.hasOwn(result, 'compatible_source_occurrences')) result.compatible_source_occurrences = result.compatible_source_occurrences.toSorted();
    return result;
  }
  return value;
}
function observationScope(campaign) {
  for (const prefix of campaign.prefixes) {
    const proposal = prefix.typedMaterial?.proposal;
    if (!proposal) continue;
    const plan = proposal[FLAGS.find(flag => Object.hasOwn(proposal, flag))];
    const match = /^(sra-v6-[^:]+):epoch:/.exec(plan.observation_ref);
    assert.ok(match, 'Recorded material observation has an explicit session scope'); return match[1];
  }
  throw new Error('Material comparison requires an observed material proposal');
}

/** The three own reducers, expressed independently of the production module. */
function emptyState() {
  return { carrier_events: [], carrier_context: null, carrier_calibration: [], flow_epoch: null, flow_children: [], flow_context: null,
    flow_models: {}, flow_filled: [], flow_events: [], pose_epoch: null, pose_initial_parts: [], pose_controls: [], pose_models: {},
    pose_context: null, pose_rule: null, pose_events: [], requested_stop_reason: null };
}
function acquire(state, event) {
  const e = clone(event);
  if (e.kind === 'typed_carrier_response') {
    state.carrier_events.push(e); state.carrier_context = e.contact_context ?? null;
    const c = e.selected, [x, y, r, b] = c.bbox, size = [r - x + 1, b - y + 1];
    if (c.marks.length && (c.support_source ?? 'component') === 'component' && !state.carrier_calibration.some(v => equal(v.size, size))) {
      state.carrier_calibration.push({ size, evidence: e.evidence, status: 'observed_body_extent' });
    }
    if (state.carrier_context === null) state.requested_stop_reason = 'typed_carrier_effect_requires_reconciliation';
  } else if (e.kind === 'typed_material_flow') {
    state.flow_events.push(e);
    if (e.boundary || state.flow_epoch !== e.epoch) { state.flow_children = []; state.flow_filled = []; state.flow_context = null; }
    state.flow_epoch = e.epoch;
    state.flow_children = state.flow_children.filter(child => !(e.removed_children ?? []).includes(child.id));
    state.flow_children.push(...(e.added_children ?? [])); state.flow_context = e.context ?? null; state.flow_filled.push(...(e.filled ?? []));
    if (e.model) state.flow_models[e.model.core_signature] = e.model;
    state.carrier_context = null; state.requested_stop_reason = e.stop_reason ?? null;
  } else if (e.kind === 'typed_pose_scope') {
    state.pose_epoch = e.epoch; state.pose_initial_parts = e.initial_parts; state.pose_controls = e.controls;
    state.pose_context = null; state.pose_rule = null; state.pose_events.push(e);
  } else if (e.kind === 'typed_pose_model') {
    state.pose_models[e.core_signature] = e; state.pose_events.push(e);
  } else if (e.kind === 'typed_pose_response') {
    state.pose_events.push(e); if (Object.hasOwn(e, 'rule')) state.pose_rule = e.rule;
    state.requested_stop_reason = e.stop_reason ?? null;
    if (e.child) {
      state.flow_children = state.flow_children.map(child => child.id === e.child.id ? e.child : child);
      const context = { child: e.child, evidence: e.evidence };
      if (e.ready_for_request) { state.flow_context = context; state.pose_context = null; }
      else { state.pose_context = context; state.flow_context = null; }
    }
    if (e.control) state.pose_controls = state.pose_controls.map(control => equal(control.bbox, e.control.bbox) ? e.control : control);
  } else throw new Error('Unrecognized recorded own material event: ' + e.kind);
}
function projectCampaign(campaign) {
  const state = emptyState(), events = [], projection = [];
  let signedZeros = 0, proposals = 0;
  for (const prefix of campaign.prefixes) {
    const series = prefix.sharedSeries, paths = series.typedMaterialAcquiredNegativeZeroPaths ?? [];
    const acquired = restoreNegativeZero(series.typedMaterialAcquiredEvents ?? [], paths); signedZeros += paths.length;
    for (const event of acquired) { acquire(state, event); events.push(event); }
    assert.equal(series.typedMaterialEventCount, events.length, 'Recorded material count equals the full acquired journal');
    assert.deepEqual(series.typedMaterialLatestEvent, JSON.parse(JSON.stringify(events.at(-1) ?? null)), 'Latest material receipt equals the final acquired event');
    let material = null;
    if (prefix.typedMaterial) {
      const own = prefix.typedMaterial, full = restoreNegativeZero(own.proposal, own.negativeZeroPaths); signedZeros += own.negativeZeroPaths.length; proposals++;
      const flags = FLAGS.filter(flag => Object.hasOwn(full, flag)); assert.equal(flags.length, 1);
      const idPrefix = { typed_carrier_plan: 'C_typed_carrier_', material_flow_plan: 'C_material_flow_', material_pose_plan: 'C_typed_pose_' }[flags[0]];
      assert.equal(full.proposal_id, idPrefix + digest(full[flags[0]]).slice(0, 20), 'Complete retained plan reproduces its native proposal ID');
      material = { proposal: Object.fromEntries(Object.entries(full).filter(([key]) => !WRAPPER_KEYS.has(key))),
        negativeZeroPaths: own.negativeZeroPaths, stateNode: own.stateNode, numericScope: own.numericScope };
    }
    projection.push({ acquired, acquiredNegativeZeroPaths: paths, count: events.length, latest: events.at(-1) ?? null,
      material, ownState: clone(state) });
  }
  return { projection, events: events.length, proposals, signedZeros };
}

export async function compareMaterialProjection(before, after) {
  const recipePath = 'docs/migration/native-campaigns-v50/life-material-identity-recipes.json.gz';
  const bytes = await readFile(new URL('../' + recipePath, import.meta.url)), bundle = JSON.parse(gunzipSync(bytes));
  assert.equal(bundle.schema, 'logos-engine.v50.material-derived-identities.v1');
  assert.equal(bundle.sourceCommit, before.referenceCommit); assert.equal(bundle.sourceCommit, after.referenceCommit);
  assert.equal(bundle.recipeCount, bundle.recipes.length);
  const sourceNames = new Map(), recipes = new Map(), lookup = new Map();
  for (const recipe of bundle.recipes) for (const [name, prefix] of aliases(recipe.sourceHash)) {
    sourceNames.set(name, prefix.startsWith('C_') ? prefix + recipe.nativeHash.slice(0, 20) : prefix + recipe.nativeHash);
  }
  for (const recipe of bundle.recipes) {
    assert.equal(sha(recipe.sourceCanonical), recipe.sourceHash, 'Retained Python recipe hash');
    assert.equal(canonical(rename(recipe.nativeValueTemplate, sourceNames, true)), recipe.nativeCanonical, 'Independent finite numeric projection of source recipe');
    assert.equal(sha(recipe.nativeCanonical), recipe.nativeHash, 'Retained native recipe hash');
    if (recipes.has(recipe.nativeHash)) assert.equal(recipes.get(recipe.nativeHash).nativeCanonical, recipe.nativeCanonical);
    recipes.set(recipe.nativeHash, recipe);
    for (const [name, prefix] of aliases(recipe.nativeHash)) lookup.set(name, { hash: recipe.nativeHash, prefix });
  }
  const beforeScope = observationScope(before), afterScope = observationScope(after), resolved = new Map(), active = new Set();
  function resolveHash(hash) {
    if (resolved.has(hash)) return resolved.get(hash);
    assert.ok(!active.has(hash), 'Recorded identity recipes are acyclic'); active.add(hash);
    const recipe = recipes.get(hash), payload = rebase(JSON.parse(recipe.nativeCanonical));
    const next = digest(payload); active.delete(hash); resolved.set(hash, next); return next;
  }
  function rebase(value) {
    if (typeof value === 'string') {
      if (value.startsWith(beforeScope + ':epoch:')) return afterScope + value.slice(beforeScope.length);
      const recipe = lookup.get(value);
      if (recipe) { const hash = resolveHash(recipe.hash); return recipe.prefix.startsWith('C_') ? recipe.prefix + hash.slice(0, 20) : recipe.prefix + hash; }
      return value;
    }
    if (Array.isArray(value)) return value.map(rebase);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [rebase(key), rebase(item)]));
    return value;
  }
  const left = projectCampaign(before), right = projectCampaign(after), leftNames = new Map(), rightNames = new Map(), referenceChecks = [];
  for (const [index, [hash, recipe]] of [...recipes].entries()) {
    const next = resolveHash(hash);
    for (const [name, prefix] of aliases(hash)) {
      const newName = prefix.startsWith('C_') ? prefix + next.slice(0, 20) : prefix + next;
      const label = `scoped-material:${index}:${prefix}`;
      leftNames.set(name, label); rightNames.set(newName, label);
    }
    referenceChecks.push({ kind: 'typed_material_recipe', recipeIndex: index, baseline: hash, current: next,
      independentlyRecomputed: true, sourceCallers: recipe.callers });
  }
  function normalize(value, names, scope) {
    if (typeof value === 'string') return names.get(value) ?? (value.startsWith(scope + ':epoch:') ? 'campaign-scope' + value.slice(scope.length) : value);
    if (Array.isArray(value)) return value.map(item => normalize(item, names, scope));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [names.get(key) ?? key, normalize(item, names, scope)]));
    return value;
  }
  return { beforeProjection: normalize(left.projection, leftNames, beforeScope), afterProjection: normalize(right.projection, rightNames, afterScope),
    referenceChecks, proof: { recipes: { path: recipePath, sha256: sha(bytes), verified: bundle.recipes.length, uniqueNativeInputs: recipes.size },
      before: { proposals: left.proposals, events: left.events, explicitNegativeZeroPaths: left.signedZeros },
      after: { proposals: right.proposals, events: right.events, explicitNegativeZeroPaths: right.signedZeros },
      qualification: 'All three own material layers are reconstructed independently from the complete recorded event journal at every acquired prefix. Complete provider envelopes, point bindings, unknown-effect declarations, every acquired event, latest receipt, counts and all retained own state fields are compared, including restored negative zero. Session-dependent IDs are related only through the retained independently checked source/native recipes; both native recipe hashes and proposal IDs are recomputed. The four common-caller wrapper fields composition_target_tree, field_subquestion, morphology and strategy_receipt are outside this own-layer projection. Existing caller selection/coordination checks remain separate; no full inherited state or graph-chain equality is asserted.' } };
}
