/**
 * Development diagnostic, not an agent budget or a game-success test.
 *
 * node --expose-gc --heap-prof --heap-prof-dir=/tmp/sra-profile \
 *   scripts/profile-v6-native-retention.ts SYME 6 65 /tmp/sra-profile/syme
 *
 * The ordinary live-game helper keeps the production action/time budgets and
 * real clock. The callback stops between decisions before the next prefix and
 * collects garbage only outside those decisions. Python hosts the public game;
 * the agent receives no hidden state, source plan or reference memory.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { getHeapStatistics } from 'node:v8';
import { runNativeGameCampaign } from '../tests/helpers/v6-live-game-campaign.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';

type R = Record<string, any>;
const gameCode = process.argv[2] ?? 'SYME', targetLevels = Number(process.argv[3] ?? 6);
const stopAfter = Number(process.argv[4] ?? 65), output = resolve(process.argv[5] ?? `/tmp/sra-profile/${gameCode.toLowerCase()}`);
if (!Number.isSafeInteger(stopAfter) || stopAfter < 1) throw new RangeError('The diagnostic stop must name a positive action count');
await mkdir(dirname(output), { recursive: true });

// Keep the actual live store available to the profiler after the helper
// returns; neither its writes nor its returned values are altered.
let store: NativeKnowledgeStore | undefined;
const commit = NativeKnowledgeStore.prototype.commit;
NativeKnowledgeStore.prototype.commit = async function (...args: Parameters<NativeKnowledgeStore['commit']>) {
  store = this; return await commit.apply(this, args);
};
const hydrated = () => (store as unknown as { hydrated: Map<string, { value: unknown }> } | undefined)?.hydrated;
let measured = -1, latest: R = {};
const metrics: R[] = [];
function sample(label: string): void {
  global.gc?.();
  const byKind: Record<string, number> = {};
  for (const node of Object.values(store?.memory.nodes ?? {})) byKind[node.kind] = (byKind[node.kind] ?? 0) + 1;
  const metric = { label, actions: latest.actions ?? 0, cycles: latest.cycles ?? 0, level: latest.level ?? 1,
    memory: process.memoryUsage(), heap: getHeapStatistics(), nodes: Object.keys(store?.memory.nodes ?? {}).length,
    deltas: store?.memory.deltas.length ?? 0, hydrated: hydrated()?.size ?? 0, byKind };
  metrics.push(metric); console.error(JSON.stringify(metric));
}
const report = await runNativeGameCampaign({ gameCode, targetLevels, progress(event) {
  if (event.phase === 'response') {
    latest = event;
    console.error(JSON.stringify({ phase: event.phase, operation: event.operation, actions: event.actions,
      cycles: event.cycles, level: event.level, activeSeconds: event.activeSeconds, elapsedMs: event.elapsedMs, family: event.family }));
    if (Math.floor(event.actions / 10) > measured) { measured = Math.floor(event.actions / 10); sample('checkpoint'); }
  }
  if (event.phase === 'request' && event.sequence >= stopAfter && event.operation === 'resume') {
    throw new Error(`Explicit diagnostic stop before action ${event.sequence + 1}`);
  }
} });
sample('diagnostic-stop');

const graphSizes: R = { history: {}, current: {}, hydrated: {} };
const bucket = (id: string): string => ['reasoning:fact:', 'reasoning:trace:', 'state_fragment:', 'prefix_evidence:', 'reasoning:transition:']
  .find(prefix => id.startsWith(prefix))?.replace(/:$/, '') ?? id;
function add(into: R, id: string, value: unknown): void {
  const key = bucket(id), size = into[key] ?? { count: 0, jsonBytes: 0 };
  size.count++; size.jsonBytes += Buffer.byteLength(JSON.stringify(value)); into[key] = size;
}
if (store) {
  for (const delta of store.memory.deltas) add(graphSizes.history, delta.node.id, delta.node.value);
  for (const node of Object.values(store.memory.nodes)) add(graphSizes.current, node.id, node.value);
  for (const [id, decoded] of hydrated()!) add(graphSizes.hydrated, id, decoded.value);
}
global.gc?.();
await writeFile(`${output}.json`, JSON.stringify({
  qualification: 'Diagnostic stop before the next prefix, not a game-success claim. Product and production decision budgets unchanged. Explicit GC only between completed requests to measure retained memory; not a timing benchmark.',
  metrics, graphSizes, report,
}, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, failure: report.failure, final: report.final,
  sourceUnchanged: report.sourceUnchangedDuringRun, memory: metrics.at(-1) }));
