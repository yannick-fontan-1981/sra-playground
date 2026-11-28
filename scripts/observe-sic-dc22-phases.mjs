// Observe the real phased-support owner inside a chronological DC22 replay.
// Use with node --import ./scripts/observe-sic-dc22-phases.mjs and SIC_DC22_RECEIPT.
import assert from 'node:assert/strict';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';

const output = process.env.SIC_DC22_RECEIPT;
const fixture = process.env.SIC_DC22_FIXTURE;
const write = row => appendFileSync(output, JSON.stringify(row) + '\n');
const owner = new URL('../src/sic/remote-support-route.ts', import.meta.url).href;
const declaration = 'export function createSicRemoteSupportRoute(';

if (output && fixture && process.env.SIC_REPLAY_CHILD === '1' && process.argv[2] === 'DC22') {
  registerHooks({
    load(url, context, nextLoad) {
      if (url !== owner) return nextLoad(url, context);
      const code = readFileSync(new URL(url), 'utf8');
      if (!code.includes(declaration)) throw Error('Phased-support owner declaration not found');
      const source = "import { observeOwner } from " + JSON.stringify(import.meta.url) + ";\n"
        + code.replace(declaration, 'function originalOwner(')
        + '\nexport function createSicRemoteSupportRoute(...args: Parameters<typeof originalOwner>) {\n'
        + '  return observeOwner(originalOwner(...args));\n}\n';
      return { format: 'module-typescript', source, shortCircuit: true };
    },
  });
}

function displayStep(step) {
  if ('control' in step) return { kind: step.probing ? 'measure' : 'hold', control: step.control };
  if ('direction' in step) return { kind: 'cross', direction: step.direction };
  return { kind: 'portal' };
}

function offer(proposal) {
  if (!proposal?.phased) return null;
  const { need, prerequisite } = proposal.sicLocalDecision;
  return {
    step: displayStep(proposal.step), action: proposal.actions[0],
    need: { id: need.id, kind: need.kind, parent: need.parentObjective },
    prerequisite: prerequisite?.id ?? null,
    evidence: proposal.sicSituationCard.evidence,
  };
}

export function observeOwner(family) {
  const { propose, after, record } = family;
  const reopenCycle = process.env.SIC_DC22_REOPEN_CYCLE === '1';
  let turns = 0;
  let closure;
  let measuredContrast = false;
  let outcome;
  const closed = memory => memory.scene.cycles.map(cycle => cycle.closed);

  family.after = function (...args) {
    const result = after.apply(this, args);
    const [proposal, , before, returned] = args;
    if (before.level_epoch === 4 && proposal.phased) {
      outcome = { before: before.observation_ref, after: returned.observation_ref,
        matched: result.matched, sealed: result.seal_prefix, reason: result.reason };
    }
    return result;
  };

  family.record = function (...args) {
    const result = record.apply(this, args);
    const [before, returned, , , , proposal] = args;
    if (before.level_epoch !== 4 || !proposal.phased) return result;
    turns++;
    const previous = closed(proposal.phased);
    const retained = this.state().phaseMemory;
    if (outcome?.before !== before.observation_ref || outcome.after !== returned.observation_ref) {
      throw Error('Cannot bind the phased result to the recorded return');
    }
    if (turns <= 17 || returned.levels_completed > before.levels_completed) {
      write({ kind: 'return', turn: turns, ...offer(proposal), outcome, closedBefore: previous,
        closedAfter: retained ? closed(retained) : null, position: proposal.phased.scene.position,
        phasesAfter: retained?.scene.position.phases ?? null,
        review: result.reviewEvidence ?? null, completed: returned.levels_completed });
    }
    if (!closure && retained && previous.some(value => !value) && closed(retained).every(Boolean)) {
      const control = previous.findIndex(value => !value);
      closure = { ref: returned.observation_ref, control };
      if (reopenCycle) {
        const copy = structuredClone(this.state());
        copy.phaseMemory.scene.cycles[control].closed = false;
        this.restore(copy);
        write({ kind: 'reopen', turn: turns, closure, closedAfter: closed(copy.phaseMemory) });
      }
    }
    return result;
  };

  family.propose = async function (...args) {
    const proposal = await propose.apply(this, args);
    const [observation, rows, inputs, remaining, execution] = args;
    if (measuredContrast || closure?.ref !== observation.observation_ref || !proposal?.phased) return proposal;
    measuredContrast = true;
    const state = this.state();
    if (!state.phaseMemory.refs.includes(closure.ref)) throw Error('The retained closure reference is missing');
    writeFileSync(fixture, JSON.stringify({
      family: family.id, turn: turns + 1, closure, observation, rows, inputs, remaining,
      reasoningMode: execution?.reasoningMode, original: offer(proposal), state,
    }), { flag: 'wx' });
    return proposal;
  };
  return family;
}

async function compare(input) {
  const { createSicRemoteSupportRoute } = await import(owner);
  const { family, turn, closure, observation, rows, inputs, remaining, reasoningMode, original, state } =
    JSON.parse(readFileSync(input, 'utf8'));
  assert.equal(observation.level_epoch, 4);
  assert.equal(turn, 15);
  assert.equal(closure.ref, observation.observation_ref);
  const replay = async perturb => {
    const independent = createSicRemoteSupportRoute(family);
    const copy = structuredClone(state);
    perturb?.(copy.phaseMemory);
    independent.restore(copy);
    return offer(await independent.propose(observation, rows, inputs, remaining, { reasoningMode }));
  };
  assert.deepEqual(await replay(), original);
  const missingReference = await replay(memory => {
    assert.ok(memory.refs.includes(closure.ref));
    memory.refs = memory.refs.filter(ref => ref !== closure.ref);
  });
  const openCycle = await replay(memory => {
    assert.equal(memory.scene.cycles[closure.control].closed, true);
    memory.scene.cycles[closure.control].closed = false;
  });
  assert.deepEqual(missingReference, original);
  assert.equal(original.step.kind, 'cross');
  assert.equal(original.action.action_ref, 'ACTION2');
  assert.equal(original.need.kind, 'reach_target_on_observed_support_phases');
  assert.equal(original.prerequisite, null);
  assert.ok(original.evidence.includes(closure.ref));
  assert.equal(openCycle.step.kind, 'measure');
  assert.equal(openCycle.step.control, closure.control);
  assert.equal(openCycle.action.action_ref, 'ACTION6');
  assert.equal(openCycle.need.id, original.need.id);
  const summary = ({ step, action, need, prerequisite, evidence }) => ({
    step, action, need: need.id, prerequisite, containsClosureRef: evidence.includes(closure.ref),
  });
  console.log(JSON.stringify({ turn, closureRef: closure.ref, priorTransfer: state.transfer.epoch,
    original: summary(original), missingReference: summary(missingReference), openCycle: summary(openCycle) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw Error('Expected the local pre-T15 capture');
  await compare(process.argv[2]);
}
