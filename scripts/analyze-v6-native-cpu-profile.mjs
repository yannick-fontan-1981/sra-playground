/**
 * Read-only development analysis of one Node --cpu-prof file.
 *
 * node scripts/analyze-v6-native-cpu-profile.mjs input.cpuprofile [summary.json]
 *
 * No game is run and no product module is imported. timeDeltas weight sampled
 * stacks; these are sampled elapsed time, not decision-budget measurements.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';

const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/analyze-v6-native-cpu-profile.mjs input.cpuprofile [summary.json]');
const bytes = await readFile(resolve(input));
const profile = JSON.parse(bytes);
if (!Array.isArray(profile.nodes) || !Array.isArray(profile.samples) || !Array.isArray(profile.timeDeltas)
  || profile.samples.length !== profile.timeDeltas.length) throw new TypeError('Expected a Node CPU profile with matching samples and timeDeltas');

const nodes = new Map(profile.nodes.map(node => [node.id, node]));
const parents = new Map();
for (const node of profile.nodes) for (const id of node.children ?? []) {
  if (parents.has(id) && parents.get(id) !== node.id) throw new Error(`CPU profile node ${id} has multiple parents`);
  parents.set(id, node.id);
}
const normalized = value => String(value ?? '').replaceAll('\\', '/');
const frameUrl = node => normalized(node.callFrame?.url);
const frameName = node => String(node.callFrame?.functionName ?? '');
const leafSummary = node => ({
  functionName: frameName(node) || '(anonymous)', url: frameUrl(node),
  line: (node.callFrame?.lineNumber ?? -1) + 1, column: (node.callFrame?.columnNumber ?? -1) + 1,
});
const moduleName = url => url.includes('/src/') ? url.slice(url.indexOf('/src/') + 1)
  : url.includes('/tests/') ? url.slice(url.indexOf('/tests/') + 1) : url;
const isHelper = url => url.includes('/tests/helpers/v6-live-game-campaign.ts');
const isEngine = url => /(?:pyodide|python-game|game-worker|official_adapter|game_bridge|\.wasm(?:$|[?:/]))/i.test(url)
  || url.startsWith('wasm:');
const isMemory = url => /\/logos-engine\/(?:v6-(?:knowledge-store|native-state-graph|reasoning-memory|composition-memory|hash)|canonical|kernel)\./.test(url);
const isNative = url => url.includes('/logos-engine/') || /\/runtime\/v6-agent(?:-service|-client|-protocol)?\./.test(url);
const isFamily = url => /\/logos-engine\/v6-/.test(url)
  && !/\/v6-native-(?:runtime|caller|authority|types|owned)\./.test(url) && !isMemory(url);

function contexts(stack) {
  const result = new Set();
  for (const node of stack) {
    const url = frameUrl(node), name = frameName(node);
    if (isHelper(url)) result.add('campaign_helper');
    if ((isHelper(url) && name === 'read') || name === 'inspectKnowledge') result.add('explicit_knowledge_inspection');
    if (isEngine(url)) result.add('python_game_runtime');
    if ((url.includes('/v6-native-authority.') && name === 'acquire')
      || (url.includes('/v6-native-caller.') && ['beforeAssessment', 'recordAssessment', 'boundaryWitness', 'persistDeltas'].includes(name))) {
      result.add('common_acquisition_visible_stack');
    }
    if (url.includes('/v6-native-runtime.') && name === 'seal') result.add('native_seal_visible_stack');
    if (isFamily(url)) result.add('family_or_reasoning_helper');
    if (isMemory(url)) result.add('shared_memory');
    if (isNative(url)) result.add('native_agent');
    if (/internal\/modules|node:internal\/modules/.test(url)) result.add('module_loading');
  }
  return result;
}

function partition(node, flags) {
  const name = frameName(node);
  if (name === '(idle)') return 'idle';
  if (name === '(garbage collector)') return 'garbage_collection';
  if (flags.has('explicit_knowledge_inspection')) return 'explicit_helper_inspection';
  if (flags.has('python_game_runtime')) return 'python_game_runtime';
  if (flags.has('common_acquisition_visible_stack')) return 'common_acquisition_visible_stack';
  if (flags.has('family_or_reasoning_helper')) return 'family_or_reasoning_work';
  if (flags.has('shared_memory')) return 'shared_memory_without_visible_owner';
  if (flags.has('native_agent')) return 'other_native_coordination';
  if (flags.has('campaign_helper')) return 'campaign_driver_or_validation';
  if (flags.has('module_loading')) return 'module_loading';
  return 'other_or_unattributed';
}

function directCategory(node) {
  const url = frameUrl(node), name = frameName(node);
  if (name === '(idle)') return 'idle';
  if (name === '(garbage collector)') return 'garbage_collection';
  if (isEngine(url)) return 'python_game_runtime';
  if (isHelper(url)) return 'campaign_helper';
  if (isMemory(url)) return 'shared_memory';
  if (isFamily(url)) return 'family_or_reasoning_helper';
  if (isNative(url)) return 'native_coordinator_or_transport';
  if (/internal\/modules|node:internal\/modules/.test(url)) return 'module_loading';
  return 'other_or_unattributed';
}

const cache = new Map(), byContext = new Map(), byPartition = new Map(), byDirect = new Map(), byFunction = new Map(), byModule = new Map();
const functionContexts = new Map(), moduleContexts = new Map();
function add(map, key, delta) {
  const value = map.get(key) ?? { samples: 0, sampledMicroseconds: 0 };
  value.samples += 1; value.sampledMicroseconds += delta; map.set(key, value);
}
function addContext(map, key, context, delta) {
  const categories = map.get(key) ?? new Map();
  add(categories, context, delta); map.set(key, categories);
}
function classify(id) {
  if (cache.has(id)) return cache.get(id);
  const node = nodes.get(id);
  if (!node) throw new Error(`Sample references missing CPU profile node ${id}`);
  const stack = [], visited = new Set();
  let current = id;
  while (current !== undefined) {
    if (visited.has(current)) throw new Error('Cycle in CPU profile tree');
    visited.add(current);
    const frame = nodes.get(current);
    if (!frame) throw new Error(`Missing parent node ${current}`);
    stack.push(frame); current = parents.get(current);
  }
  const flags = contexts(stack), result = { node, flags, partition: partition(node, flags), direct: directCategory(node) };
  cache.set(id, result); return result;
}

let total = 0;
for (let i = 0; i < profile.samples.length; i += 1) {
  const delta = Number(profile.timeDeltas[i]);
  if (!Number.isFinite(delta) || delta < 0) throw new TypeError(`Invalid sample duration at index ${i}`);
  total += delta;
  const result = classify(profile.samples[i]);
  add(byPartition, result.partition, delta); add(byDirect, result.direct, delta);
  for (const context of result.flags) add(byContext, context, delta);
  const frame = leafSummary(result.node), key = JSON.stringify(frame);
  const module = moduleName(frame.url) || '(native or unnamed)';
  add(byFunction, key, delta); add(byModule, module, delta);
  addContext(functionContexts, key, result.partition, delta); addContext(moduleContexts, module, result.partition, delta);
}

function ranked(map, label = 'category') {
  return [...map.entries()].map(([key, value]) => ({ [label]: key, ...value,
    sampledSeconds: value.sampledMicroseconds / 1e6,
    percentOfAllSamples: total ? 100 * value.sampledMicroseconds / total : 0,
  })).sort((a, b) => b.sampledMicroseconds - a.sampledMicroseconds);
}
const summary = {
  schema: 'logos-engine.native-cpu-profile-summary.v1',
  input: resolve(input), sha256: createHash('sha256').update(bytes).digest('hex'),
  qualification: 'One sampled process profile, not a comparative benchmark or an exact attribution of async decision costs. Does not assert game success or a performance improvement.',
  sampleCount: profile.samples.length, nodeCount: profile.nodes.length,
  sampledSeconds: total / 1e6,
  profileSpanSeconds: Number.isFinite(profile.endTime - profile.startTime) ? (profile.endTime - profile.startTime) / 1e6 : null,
  limitations: [
    'timeDeltas are sampled elapsed intervals; scheduler delay, idle, startup, profiler overhead and garbage collection may be present.',
    'V8 CPU stacks do not reliably preserve async ancestry. Common-acquisition attribution is a lower bound when awaited work resumes without its caller.',
    'The disjoint context partition uses explicit inspection, game-runtime, acquisition, family, memory, native, helper, then loader precedence. A generic helper ancestor does not turn native work into validation work.',
    'Explicit inspection identifies inspectKnowledge or the campaign read closure. Other proof assertions and hydration without those visible owners may remain in shared-memory, helper, or unattributed categories.',
    'Inclusive contexts overlap and must not be added together. Self/module tables attribute only the sampled leaf and may put shared utility cost outside its logical caller.',
    'The campaign report activeSeconds and request elapsedMs remain the source for production decision budgets; wall time includes game hosting and proof checks.',
  ],
  disjointContextPartition: ranked(byPartition),
  leafCategoryPartition: ranked(byDirect),
  inclusiveVisibleContextsDoNotSum: ranked(byContext, 'context'),
  topSelfFunctions: ranked(byFunction, 'frame').slice(0, 40).map(item => ({ ...item,
    contextPartition: ranked(functionContexts.get(item.frame)), frame: JSON.parse(item.frame) })),
  topSelfModules: ranked(byModule, 'module').slice(0, 40).map(item => ({ ...item,
    contextPartition: ranked(moduleContexts.get(item.module)) })),
};
const serialized = `${JSON.stringify(summary, null, 2)}\n`;
if (process.argv[3]) {
  const output = resolve(process.argv[3]);
  if (output === resolve(input)) throw new Error('The summary must not overwrite its input profile');
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, serialized);
  console.log(JSON.stringify({ output, sampledSeconds: summary.sampledSeconds, sampleCount: summary.sampleCount,
    disjointContextPartition: summary.disjointContextPartition }));
} else process.stdout.write(serialized);
