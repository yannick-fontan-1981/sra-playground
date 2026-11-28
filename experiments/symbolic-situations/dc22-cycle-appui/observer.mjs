import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const arm = process.env.DC22_OPERATOR_ARM;
const receipt = process.env.DC22_OPERATOR_RECEIPT;
const privateDirectory = process.env.DC22_OPERATOR_PRIVATE;
const seal = '1e6ebd051af04372d04b9daac9d4b1b70ef621ad368bb2321b96e9b6d572f141';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const write = row => appendFileSync(receipt, JSON.stringify(row) + '\n');
const owner = pathToFileURL(resolve('src/sic/remote-support-route.ts')).href;
const runtime = pathToFileURL(resolve('src/logos-engine/v6-native-runtime.ts')).href;
const replay = pathToFileURL(resolve('scripts/check-sic-chronological.mjs')).href;
const ownerDeclaration = 'export function createSicRemoteSupportRoute(';
const refs = new Map();
const revision = ref => Number(/:revision:(\d+):frame:/.exec(ref)?.[1]);
const stableRef = ref => ref.replace(/^.*(?=:epoch:)/, '');
const scope = (observation, rev) => observation?.level_epoch === 4 && observation.revision === rev;
const read = file => readFileSync(resolve(privateDirectory, file));
let reserve;

if (process.env.SIC_REPLAY_CHILD === '1' && process.argv[2] === 'DC22') {
  assert.ok(['nominal', 'reopen', 'reserved'].includes(arm));
  assert.ok(receipt && privateDirectory);
  assert.equal(sha(read('variation-reservee.json')), seal);
  reserve = JSON.parse(read('reference-reservee.json'));
  assert.equal(reserve.scellement, seal);
  assert.equal(sha(read('reference-pre15.json')), reserve.checkpointHash);
  registerHooks({
    load(url, context, nextLoad) {
      if (url === replay && arm === 'reopen') {
        const code = readFileSync(new URL(url), 'utf8');
        const handle = 'try{return await service.handle(operation);}finally';
        const resume = '&& agent.snapshot.actionCount>priorActions && agent.snapshot.actionCount-before<actionCap);';
        assert.ok(code.includes(handle) && code.includes(resume));
        // Pause after the actual return of N4/T15, with the original level budgets.
        const source = code.replace(handle, 'try{const result=await service.handle(operation);'
          + 'if(effects.length===126 && operation.type==="advance") agent.pause(); return result;}finally')
          .replace(resume, resume.replace(');', ' && effects.length<126);'));
        return { format: 'module', source, shortCircuit: true };
      }
      if (url !== owner && url !== runtime) return nextLoad(url, context);
      let source = readFileSync(new URL(url), 'utf8');
      if (url === owner) {
        assert.ok(source.includes(ownerDeclaration));
        source = 'import { instrumentFamily } from ' + JSON.stringify(import.meta.url) + ';\n'
          + source.replace(ownerDeclaration, 'function originalOwner(')
          + '\nexport function createSicRemoteSupportRoute(family?: string) {\n'
          + ' return instrumentFamily(originalOwner(family, { phaseCycleNeeds: true }));\n}\n';
      } else {
        source = 'import { instrumentRuntime } from ' + JSON.stringify(import.meta.url)
          + ';\n' + source + '\ninstrumentRuntime(NativeV6Runtime.prototype);\n';
      }
      return { format: 'module-typescript', source, shortCircuit: true };
    },
  });
}

export function instrumentFamily(family) {
  const { record, propose } = family;
  family.record = function (...args) {
    const result = record.apply(this, args);
    const [before, after, command, , , proposal] = args;
    if (family.id !== 'sic_remote_support_route' || before.level_epoch !== 4 || !proposal.phased) return result;
    refs.set(before.revision, before.observation_ref);
    refs.set(after.revision, after.observation_ref);
    const beforeClosed = proposal.phased.scene.cycles.map(cycle => cycle.closed);
    const memory = this.state().phaseMemory;
    const afterClosed = memory?.scene.cycles.map(cycle => cycle.closed);
    if (after.revision <= 127) write({ event: 'phase', before: before.revision, after: after.revision,
      beforeClosed, afterClosed, command, control: proposal.step.control, probing: proposal.step.probing });
    if (arm === 'reopen' && scope(after, 126)) {
      assert.deepEqual(afterClosed, [true, true]);
      const copy = structuredClone(this.state());
      copy.phaseMemory.scene.cycles[1].closed = false;
      this.restore(copy);
    }
    return result;
  };
  family.propose = async function (...args) {
    const original = await propose.apply(this, args);
    if (family.id !== 'sic_remote_support_route' || !scope(args[0], 126)
      || original?.sicLocalDecision?.phaseCycle?.kind !== 'resume') return original;
    if (arm === 'reserved') {
      const entries = original.sicLocalDecision.phaseCycle.closures;
      assert.equal(entries.length, 2);
      const [neighbor, last] = entries;
      assert.equal(stableRef(last.beforeRef), stableRef(reserve.actual.before));
      assert.equal(stableRef(last.afterRef), stableRef(reserve.actual.after));
      const altered = changeClaim(original, [neighbor, { ...last, afterRef: borrowedReference() }]);
      write({ event: 'reserved-claim', revision: args[0].revision });
      return altered;
    }
    if (arm !== 'nominal') return original;
    const memory = structuredClone(this.state());
    const absent = structuredClone(memory);
    const closures = absent.phaseMemory.cycleStudy.closures;
    const index = Object.keys(closures).find(key => revision(closures[key].afterRef) === 126);
    assert.ok(index);
    delete closures[index];
    let without;
    try {
      this.restore(absent);
      without = await propose.apply(this, args);
    } finally {
      this.restore(memory);
    }
    write({ event: 'provider-without-closure', offered: Boolean(without), retainedClosed:
      memory.phaseMemory.scene.cycles.map(cycle => cycle.closed) });
    return original;
  };
  return family;
}

function checkpoint(backend, id) {
  return id && backend.knowledge.memory.nodes[id] ? backend.knowledge.stateValue(id) : null;
}

function changeClaim(proposal, entries) {
  return { ...proposal, sicLocalDecision: { ...proposal.sicLocalDecision,
    phaseCycle: { kind: 'resume', closures: entries } } };
}

function borrowedReference() {
  const borrowed = refs.get(revision(reserve.borrowed.after));
  assert.ok(borrowed && stableRef(borrowed) === stableRef(reserve.borrowed.after));
  return borrowed;
}

async function contrast(backend, authorize, args, name, proposal, missingId) {
  const { prefix, trace, knowledge, authority, kind, reason } = backend;
  const oldStateValue = knowledge.stateValue;
  const ownsStateValue = Object.hasOwn(knowledge, 'stateValue');
  let reachedRelease = false;
  backend.prefix = { ...prefix, proposal, nativeBindings: [...prefix.nativeBindings] };
  backend.trace = [];
  // Observe whether the native guard reaches release, without publishing an alternative ticket.
  if (authority) backend.authority = { release: async () => { reachedRelease = true; return false; },
    preservation: (...input) => authority.preservation(...input) };
  if (missingId) knowledge.stateValue = function (id, ...rest) {
    return id === missingId ? {} : oldStateValue.call(this, id, ...rest);
  };
  try {
    const admitted = await authorize.apply(backend, args);
    const guard = backend.trace.findLast(row => row.kind === 'before_guard');
    return { event: 'guard', name, admitted: admitted || reachedRelease,
      guard: guard?.reason, pointBound: guard?.point_bound };
  } finally {
    if (ownsStateValue) knowledge.stateValue = oldStateValue;
    else delete knowledge.stateValue;
    Object.assign(backend, { prefix, trace, authority, kind, reason });
  }
}

export function instrumentRuntime(prototype) {
  const { authorize, advance } = prototype;
  let audited = false;
  prototype.authorize = async function (...args) {
    const before = this.observation, prefix = this.prefix;
    const proposal = prefix?.proposal;
    const publicNeed = proposal?.sicLocalDecision?.need;
    const cycle = proposal?.sicLocalDecision?.phaseCycle;
    if (!audited && arm === 'nominal' && scope(before, 126) && cycle?.kind === 'resume') {
      audited = true;
      assert.equal(cycle.closures.length, 2);
      const [neighbor, last] = cycle.closures;
      assert.equal(stableRef(last.beforeRef), stableRef(reserve.actual.before));
      assert.equal(stableRef(last.afterRef), stableRef(reserve.actual.after));
      assert.equal(last.afterRef, before.observation_ref);
      assert.equal(last.need.parentObjective, publicNeed.id);
      assert.equal(neighbor.need.parentObjective, publicNeed.id);
      const saved = checkpoint(this, last.need.id);
      assert.equal(saved.status, 'satisfied');
      assert.deepEqual(saved.phaseCycleClosure, last);
      const oldOpening = refs.get(112);
      assert.ok(oldOpening && revision(oldOpening) < revision(last.opening));
      const changed = replacement => changeClaim(proposal, [neighbor, { ...last, ...replacement }]);
      for (const [name, altered, missing] of [
        ['preuve-retiree', proposal, last.need.id],
        ['ouverture-ancienne', changed({ opening: oldOpening })],
        ['controle-voisin', changed({ control: neighbor.control })],
        ['variation-reservee', changed({ afterRef: borrowedReference() })],
      ]) {
        write(await contrast(this, authorize, args, name, altered, missing));
      }
      assert.deepEqual(checkpoint(this, last.need.id).phaseCycleClosure, saved.phaseCycleClosure);
    }
    const admitted = await authorize.apply(this, args);
    if (before?.level_epoch === 4 && before.revision <= 126 && cycle) {
      const plan = prefix.sicPlan;
      const opened = this.trace.findLast(row => row.kind === 'sic_phase_cycle_opened' && row.observation_ref === before.observation_ref);
      write({ event: 'authorize', revision: before.revision, kind: cycle.kind, admitted,
        command: proposal.actions[prefix.index], need: plan?.need?.id, parent: cycle.parent?.id,
        prior: arm === 'reserved' ? undefined : cycle.closures?.map(proof => ({ control: proof.control,
          opening: revision(proof.opening), before: revision(proof.beforeRef), after: revision(proof.afterRef),
          status: checkpoint(this, proof.need.id)?.status, child: proof.need.id })),
        opened: opened ? { need: opened.need, parent: opened.parent, budget: opened.action_budget,
          status: checkpoint(this, opened.need)?.status } : null,
        guard: this.trace.findLast(row => row.kind === 'before_guard')?.reason });
    }
    return admitted;
  };
  prototype.advance = async function (...args) {
    const before = this.observation, plan = this.prefix?.sicPlan;
    const result = await advance.apply(this, args);
    if (before?.level_epoch !== 4 || before.revision > 126 || !plan?.phaseCycle) return result;
    const row = this.trace.findLast(event => event.kind === 'actual_outcome' && event.sic_plan === plan.id);
    const saved = checkpoint(this, plan.need.id);
    const closure = saved?.phaseCycleClosure;
    write({ event: 'return', revision: before.revision, command: plan.command, kind: plan.phaseCycle.kind,
      need: plan.need.id, status: saved?.status, matched: row?.matched, reason: row?.reason,
      after: revision(row?.observation_ref ?? ''), closure: closure && { control: closure.control,
        opening: revision(closure.opening), before: revision(closure.beforeRef), after: revision(closure.afterRef) } });
    return result;
  };
}
