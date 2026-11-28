import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { sourceBackend } from './sic-study-source-games.mjs';

const [checkout, output, mode] = process.argv.slice(2);
assert.ok(checkout && output && (mode === undefined || mode === '--both-pairs'),
  'Pass CHECKOUT NEW-RECEIPT.json [--both-pairs]');
const git = (...args) => execFileSync('git', args, { cwd: checkout, encoding: 'utf8' }).trim();
const revision = git('rev-parse', 'HEAD');
git('diff', '--exit-code', revision, '--', 'src', 'public', 'reference');
const at = path => pathToFileURL(resolve(checkout, path));
const load = path => import(at('src/' + path));
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
const { toV6PublicObservation } = await load('runtime/v6-agent-protocol.ts');
const { createNativeV6Runtime } = await load('logos-engine/v6-native-runtime.ts');
const { ObservedInventory } = await load('logos-engine/v6-observed-inventory.ts');
const declarationsRoot = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const read = path => JSON.parse(git('show', revision + ':' + declarationsRoot + path));
const declarations = { common: read('laya_proto/common_frontier_policy.drm.json'), strategy: read('morphology_policy/strategy.drm') };
const backend = await sourceBackend(checkout);
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
const digest = packet => createHash('sha256').update(JSON.stringify(packet)).digest('hex');
const observedRevision = ref => Number(/:revision:(\d+):/.exec(ref)?.[1]);
let variant, projectionReads, accesses, previousRefs;

const recordSource = ObservedInventory.prototype.recordSource;
ObservedInventory.prototype.recordSource = function (...args) {
  const result = recordSource.apply(this, args);
  if (args[5]?.inventory_plan) {
    accesses.push({ before: args[0].observation_ref, after: args[1].observation_ref, status: result?.status,
      access: result?.dependency_return });
  }
  return result;
};

const summarizeAccess = v => ({ status: v.status, active: v.active, evidence: v.evidence });
const project = ObservedInventory.prototype.project;
ObservedInventory.prototype.project = function (request) {
  if (observedRevision(request.observation_ref) !== 9) return project.call(this, request);
  const existing = this.access_returns;
  const active = existing.findLast(item => item.active && item.evidence?.at(-1) === request.observation_ref);
  if (variant !== 'nominal') assert.ok(active, 'Expected the access acquired at T8');
  if (variant === 'without-access') this.access_returns = existing.filter(item => item !== active);
  if (variant === 'foreign-proof' || variant === 'prior-pair') {
    const evidence = variant === 'foreign-proof' ? [active.evidence[0], previousRefs.get(6)]
      : [previousRefs.get(7), previousRefs.get(8)];
    this.access_returns = existing.map(item => item === active
      ? { ...item, evidence } : item);
  }
  try {
    projectionReads.push({ reference: request.observation_ref, before: existing.map(summarizeAccess),
      used: this.access_returns.map(summarizeAccess) });
    return project.call(this, request);
  } finally {
    this.access_returns = existing;
  }
};

async function capture(name) {
  variant = name;
  projectionReads = [];
  previousRefs = new Map();
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let observation = toV6PublicObservation(backend.dispatch({ type: 'load', code: 'KEYD', level: 1 }), 0);
  let reply = await service.handle({ type: 'init', sessionId, sequence: 0, observation,
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 16 } });
  const steps = [];
  const end = name === 'nominal' ? 16 : 10;
  for (let turn = 1; turn <= end; turn++) {
    if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence: turn - 1 });
    assert.equal(reply.kind, 'action');
    const { snapshot, ticket, command } = reply;
    previousRefs.set(turn, ticket.observationRef);
    const proposal = snapshot.proposal, offer = proposal.inventory_plan?.offer;
    const guard = snapshot.trace.findLast(e => e.kind === 'before_guard');
    const pre = { owner: snapshot.lastDecision, ref: ticket.observationRef, packet: digest(observation), command,
      offer: offer?.kind ?? proposal.kind, guard: guard?.reason, refs: proposal.route_refs,
      targetKind: offer?.target?.kind, source: offer?.target?.source_bbox,
      sourceRefs: offer?.target?.access_return?.evidence ?? offer?.target?.dependency_return?.evidence };
    accesses = [];
    const actionId = Number(command.actionRef.slice(6));
    observation = toV6PublicObservation(backend.dispatch({ type: 'action', actionId,
      ...(actionId === 6 ? { data: command.data } : {}) }), turn);
    reply = await service.handle({ type: 'advance', sessionId, sequence: turn, ticketId: ticket.id, executionMs: 0, observation });
    const actual = reply.snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    steps.push({ turn, pre, after: { packet: digest(observation), matched: actual?.matched, reason: actual?.reason,
      access: accesses, levels: observation.levelsCompleted } });
  }
  return { steps, projectionReads };
}

const nominal = await capture('nominal');
const removed = await capture('without-access');
const foreign = await capture('foreign-proof');
const priorPair = mode === '--both-pairs' ? await capture('prior-pair') : undefined;
for (const scenario of [removed, foreign, priorPair].filter(Boolean)) {
  assert.deepEqual(scenario.steps.slice(0, 8), nominal.steps.slice(0, 8));
  assert.equal(scenario.steps[8].pre.packet, nominal.steps[8].pre.packet);
}
assert.equal(git('rev-parse', 'HEAD'), revision);
writeFileSync(output, JSON.stringify({ revision, level: 1, cap: 16, nominal, removed, foreign, priorPair }) + '\n', { flag: 'wx' });
