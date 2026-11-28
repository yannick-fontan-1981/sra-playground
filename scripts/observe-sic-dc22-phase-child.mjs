// A local observer and isolated interventions for the chronological DC22 witness.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

const arm = process.env.SIC_DC22_PHASE_ARM;
const output = process.env.SIC_DC22_PHASE_TRACE;
const owner = 'src/sic/remote-support-route.ts';
const runtime = 'src/logos-engine/v6-native-runtime.ts';
const typeSources = new Set([owner, runtime, 'src/sic/native-plan-receipt.ts', 'src/logos-engine/v6-native-types.ts',
  'src/sic/phased-support-route.ts']);
const urls = new Map([...typeSources].map(file => [new URL('../' + file, import.meta.url).href, file]));
const base = 'b0574d0d45d3253c38fd6a72e52074874b6a0da6';
const write = row => appendFileSync(output, JSON.stringify(row) + '\n');

if (arm && output && process.env.SIC_REPLAY_CHILD === '1' && process.argv[2] === 'DC22') {
  registerHooks({
    load(url, context, nextLoad) {
      const path = urls.get(url);
      if (!path) return nextLoad(url, context);
      let source = arm === 'base'
        ? execFileSync('git', ['show', base + ':' + path], { encoding: 'utf8' })
        : readFileSync(new URL(url), 'utf8');
      if (path === owner && arm !== 'base' && arm !== 'off') {
        const declaration = 'export function createSicRemoteSupportRoute(';
        if (!source.includes(declaration)) throw Error('Cycle owner declaration missing');
        source = "import { observeFamily } from " + JSON.stringify(import.meta.url) + ";\n"
          + source.replace(declaration, 'function originalSupportRoute(')
          + '\nexport function createSicRemoteSupportRoute(family?: string) {\n'
          + '  return observeFamily(originalSupportRoute(family, { phaseCycleNeeds: true }));\n}\n';
      }
      if (path === runtime) {
        source = "import { observeRuntime } from " + JSON.stringify(import.meta.url) + ";\n"
          + source + '\nobserveRuntime(NativeV6Runtime.prototype);\n';
      }
      return { format: 'module-typescript', source, shortCircuit: true };
    },
  });
}

export function observeFamily(family) {
  const { propose, record } = family;
  let t13, injected = false;
  family.record = function (...args) {
    const result = record.apply(this, args);
    const [before, after, , , , proposal] = args;
    if (!proposal.phased || before.level_epoch !== 4) return result;
    if (after.revision === 125) t13 = { beforeRef: before.observation_ref, afterRef: after.observation_ref };
    if (arm === 'reopen' && after.revision === 126) {
      const state = structuredClone(this.state()), cycles = state.phaseMemory.scene.cycles;
      if (cycles.length !== 2 || !cycles.every(cycle => cycle.closed)) throw Error('Expected both cycles to have closed');
      cycles[1].closed = false;
      this.restore(state);
      write({ event: 'reopen', revision: after.revision, closed: cycles.map(cycle => cycle.closed) });
    }
    return result;
  };
  family.propose = async function (...args) {
    const proposal = await propose.apply(this, args);
    const [observation] = args;
    const cycle = proposal?.sicLocalDecision?.phaseCycle;
    if (observation.level_epoch !== 4 || observation.revision !== 126 || cycle?.kind !== 'resume'
      || (arm !== 'wrong-control' && arm !== 'stale')) return proposal;
    const [other, original] = cycle.closures;
    if (cycle.closures.length !== 2 || !t13 || original.afterRef !== observation.observation_ref) throw Error('Expected the N4/T14 closure');
    const pair = arm === 'stale' ? t13 : { opening: other.opening, beforeRef: other.beforeRef, afterRef: other.afterRef };
    if (!injected) write({ event: arm, revision: observation.revision, original, replacement: pair });
    injected = true;
    return { ...proposal, sicLocalDecision: { ...proposal.sicLocalDecision,
      phaseCycle: { ...cycle, closures: [other, { ...original, ...pair }] } } };
  };
  return family;
}

function checkpoint(backend, id) {
  if (!id) return null;
  const node = backend.inspectKnowledge().nodes[id];
  if (!node) return null;
  const value = backend.knowledge.stateValue(id);
  return { status: value.status, opening: value.phaseCycleOpening ?? null,
    closure: value.phaseCycleClosure ?? null, links: node.relations ?? [] };
}

export function observeRuntime(runtime) {
  const { authorize, advance } = runtime;
  runtime.authorize = async function (...args) {
    const observation = this.observation, prefix = this.prefix;
    const result = await authorize.apply(this, args);
    if (observation?.level_epoch !== 4 || observation.revision > 129 || !prefix?.proposal?.phased) return result;
    const plan = prefix.sicPlan, proposal = prefix.proposal.sicLocalDecision, guard = this.trace.findLast(row => row.kind === 'before_guard');
    write({ event: 'authorize', revision: observation.revision, observation: observation.observation_ref, admitted: result,
      guard: guard?.reason, command: prefix.proposal.actions[prefix.index], need: plan?.need ?? proposal.need,
      prerequisite: plan?.prerequisite?.id ?? null, phaseCycle: plan?.phaseCycle ?? null,
      checkpoint: checkpoint(this, plan?.need?.id),
      dependencies: plan?.phaseCycle?.kind === 'resume'
        ? plan.phaseCycle.closures.map(proof => checkpoint(this, proof.need.id)) : [],
    });
    return result;
  };
  runtime.advance = async function (...args) {
    const before = this.observation, plan = this.prefix?.sicPlan;
    const result = await advance.apply(this, args);
    if (before?.level_epoch !== 4 || before.revision > 129 || !plan || plan.family !== 'sic_remote_support_route') return result;
    const outcome = this.trace.findLast(row => row.kind === 'actual_outcome' && row.sic_plan === plan.id);
    write({ event: 'return', revision: before.revision, command: plan.command, need: plan.need?.id,
      checkpoint: checkpoint(this, plan.need?.id), outcome: outcome ? { matched: outcome.matched,
        after: outcome.observation_ref, reason: outcome.reason, sealed: outcome.seal_prefix } : null });
    return result;
  };
}
