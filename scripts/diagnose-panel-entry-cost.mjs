/** Read-only prototype observation around the unchanged cold public replay profiler. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const root = '/workspace/scratch/c4dd29871d33/sra-playground-lot2a/.sites-checkout';
const load = path => import(pathToFileURL(`${root}/${path}`).href);
const [{ SharedSeriesConstraint }, { PanelServiceMemory }, { CoupledPairEvidenceMemory }, { NativeV6Runtime }] = await Promise.all([
  load('src/logos-engine/v6-shared-series.ts'), load('src/logos-engine/v6-panel-service-access.ts'),
  load('src/logos-engine/v6-coupled-pair-evidence.ts'), load('src/logos-engine/v6-native-runtime.ts'),
]);
const comparison = JSON.parse(await readFile(`${root}/docs/migration/lot3a-evidence/performance/comparison.json`, 'utf8'));
const receipt = 'docs/migration/lot3a-evidence/diagnostic/panel-entry-stck-receipt.json.gz';
const output = 'docs/migration/lot3a-evidence/diagnostic/panel-entry-stck-calls.json.gz';
const originalScript = `${root}/scripts/profile-native-loop-costs.mjs`;
const samples = [], undo = [], stack = [];
let nextCall = 0, nextPlan = 0, currentPlan = null, runtime = null;
const flags = cfg => ['panel_service_question', 'coupled_pair_question', 'alternating_graph_question'].filter(key => cfg?.[key]);

function observe(prototype, method, stage, metadata = () => ({})) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
  assert.equal(typeof descriptor?.value, 'function', stage);
  const original = descriptor.value;
  Object.defineProperty(prototype, method, { ...descriptor, value: function (...args) {
    const previousPlan = currentPlan;
    if (stage === 'runtime.plan') { runtime = this; currentPlan = ++nextPlan; }
    const row = { id: ++nextCall, stage, plan: currentPlan, parent: stack.at(-1) ?? null,
      actionBefore: runtime?.actions ?? 0, ...metadata(this, args) };
    stack.push(row.id);
    const start = performance.now();
    const finish = (failed, value) => {
      row.elapsedMs = performance.now() - start; row.failed = failed;
      row.actionAfter = runtime?.actions ?? row.actionBefore;
      if (stage === 'shared.unchanged') row.matched = value === true;
      if (stage === 'pair.currentState') { row.pairPresent = value != null; row.evidenceCount = value?.evidence?.length ?? 0; }
      if (stage === 'panel.propose') row.result = value?.status ?? null;
      samples.push(row);
      assert.equal(stack.pop(), row.id, 'Diagnostic methods must preserve their synchronous/awaited nesting');
      if (stage === 'runtime.plan') currentPlan = previousPlan;
    };
    try {
      const value = original.apply(this, args);
      if (value && typeof value.then === 'function') return value.then(result => { finish(false, result); return result; },
        error => { finish(true); throw error; });
      finish(false, value); return value;
    } catch (error) { finish(true); throw error; }
  } });
  undo.push(() => Object.defineProperty(prototype, method, descriptor));
}

observe(NativeV6Runtime.prototype, 'plan', 'runtime.plan');
observe(SharedSeriesConstraint.prototype, 'observedPropose', 'shared.observedPropose', (_self, args) => ({ configuration: flags(args[4]) }));
observe(SharedSeriesConstraint.prototype, 'sourceGraphProposal', 'shared.sourceGraphProposal', (_self, args) => ({ configuration: flags(args[4]) }));
observe(PanelServiceMemory.prototype, 'propose', 'panel.propose', (self, args) => ({ configuration: flags(args[4]), panelEvents: self.eventCount }));
observe(CoupledPairEvidenceMemory.prototype, 'currentState', 'pair.currentState');
observe(SharedSeriesConstraint.prototype, 'restoreNative', 'shared.restoreNative', (self, args) => ({
  eventCount: args[0]?.events?.length ?? null, panelEvents: self.panel.eventCount,
}));
observe(SharedSeriesConstraint.prototype, 'nativeState', 'shared.nativeState');
observe(SharedSeriesConstraint.prototype, 'workingStamp', 'shared.workingStamp');
observe(SharedSeriesConstraint.prototype, 'unchanged', 'shared.unchanged');

const startedAt = new Date().toISOString();
try {
  process.argv = [process.execPath, originalScript, 'docs/migration/lot3a-evidence/performance/cases.json', 'STCK', receipt,
    comparison.after.nativeDigest];
  await import(pathToFileURL(originalScript).href);
} finally { for (const restore of undo.reverse()) restore(); }

function distribution(values) {
  const sorted = values.toSorted((a, b) => a - b), n = sorted.length;
  return { count: n, totalMs: values.reduce((sum, value) => sum + value, 0),
    medianMs: n ? n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : null,
    minMs: sorted[0] ?? null, maxMs: sorted.at(-1) ?? null };
}
const stages = Object.fromEntries([...new Set(samples.map(row => row.stage))].map(stage => [stage,
  distribution(samples.filter(row => row.stage === stage).map(row => row.elapsedMs))]));
const plans = samples.filter(row => row.stage === 'runtime.plan').map(plan => {
  const rows = samples.filter(row => row.plan === plan.plan);
  const observed = rows.filter(row => row.stage === 'shared.observedPropose');
  return { plan: plan.plan, actionBefore: plan.actionBefore, elapsedMs: plan.elapsedMs,
    observedCalls: observed.length, observedTotalMs: observed.reduce((sum, row) => sum + row.elapsedMs, 0),
    panelEnabledCalls: rows.filter(row => row.stage === 'panel.propose' && row.configuration.includes('panel_service_question')).length,
    panelEnabledTotalMs: rows.filter(row => row.stage === 'panel.propose' && row.configuration.includes('panel_service_question')).reduce((sum, row) => sum + row.elapsedMs, 0),
    pairClones: rows.filter(row => row.stage === 'pair.currentState').length,
    pairCloneTotalMs: rows.filter(row => row.stage === 'pair.currentState').reduce((sum, row) => sum + row.elapsedMs, 0),
    sharedRestoreTotalMs: rows.filter(row => row.stage === 'shared.restoreNative').reduce((sum, row) => sum + row.elapsedMs, 0) };
});
const script = await readFile(new URL(import.meta.url));
const report = { schema: 'logos-engine.panel-entry-call-profile.v1', status: 'passed', startedAt, finishedAt: new Date().toISOString(),
  nativeDigest: comparison.after.nativeDigest, receipt,
  instrumentation: { path: new URL(import.meta.url).pathname, sha256: createHash('sha256').update(script).digest('hex') },
  qualifications: ['One cold STCK ten-public-return diagnostic; no hardware-independent cost or budget claim.',
    'Prototype hooks preserve arguments, return values and acquisition order; native files remain unchanged and are checked by the original profiler.',
    'All durations are inclusive, nested and subject to observer overhead; do not sum them as independent costs.'],
  stages, plans, samples };
await writeFile(`${root}/${output}`, gzipSync(Buffer.from(JSON.stringify(report, null, 2) + '\n'), { level: 9 }), { flag: 'wx' });
console.log(JSON.stringify({ output, stages, plans }));
