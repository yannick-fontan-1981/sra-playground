import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createOracleWorld, certifyPolicy, replayCertifiedPolicy } from '../scripts/sic-p14/oracle.mjs';
import { createEnvironment } from '../scripts/sic-p14/environment.mjs';
import { FAMILIES, generateCase, shiftOrigin } from '../scripts/sic-p14/generator.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function twoDoorWorlds(actions = 2) {
  const channel = opens => ({ kind: 'clock', prefix: opens ? [0, 1, 1] : [0, 0, 0], cycle: [0], phase: 0 });
  return {
    version: 1,
    id: 'oracle-observation-trap', family: 'evaluation-test-only', origin: 0,
    budget: { actions, ticks: actions, states: 100 },
    public: {
      channels: ['left-light', 'right-light'], initial: 0, goal: 1,
      actions: [
        { id: 'look', kind: 'inspect', duration: 1 },
        { id: 'left', kind: 'move', duration: 1, from: 0, to: 1, gates: ['left-light'] },
        { id: 'right', kind: 'move', duration: 1, from: 0, to: 1, gates: ['right-light'] },
      ],
    },
    worlds: [
      { channels: { 'left-light': channel(true), 'right-light': channel(false) } },
      { channels: { 'left-light': channel(false), 'right-light': channel(true) } },
    ],
  };
}

function verifyAllCertificateBranches(spec, certificate) {
  assert.equal(certificate.solvable, true);
  const nodes = new Map(certificate.policy.nodes.map(node => [node.id, node]));
  const expected = new Set(certificate.policy.nodes.flatMap(node => (node.outcomes ?? [])
    .map(outcome => `${node.id}:${outcome.observationKey}:${outcome.node}`)));
  const reached = new Set();
  let transitions = 0;
  for (let world = 0; world < spec.worlds.length; world++) {
    const oracle = createOracleWorld(spec, world);
    const environment = createEnvironment(spec, world);
    assert.deepEqual(oracle.observation(), environment.observation());
    let cursor = certificate.policy.initial.find(branch => branch.observationKey === hash(oracle.observation()))?.node;
    assert.notEqual(cursor, undefined, 'every initial public observation is covered');
    for (let count = 0; count <= spec.budget.actions; count++) {
      const node = nodes.get(cursor);
      assert.ok(node, 'the certificate references an existing node');
      if (node.terminal) {
        assert.equal(oracle.observation().terminal, 'crossed');
        assert.equal(oracle.observation().position, spec.public.goal);
        assert.ok(oracle.observation().tick <= spec.budget.ticks);
        assert.ok(count <= spec.budget.actions);
        break;
      }
      const observation = oracle.step(node.action);
      assert.deepEqual(observation, environment.step(node.action), 'independent transition implementations agree');
      const outcome = node.outcomes.find(branch => branch.observationKey === hash(observation));
      assert.ok(outcome, 'every encountered public observation has a policy branch');
      reached.add(`${node.id}:${outcome.observationKey}:${outcome.node}`);
      cursor = outcome.node;
      transitions++;
      assert.ok(count < spec.budget.actions, 'the policy terminates within its action bound');
    }
  }
  assert.deepEqual(reached, expected, 'all retained observation branches are replayed in a declared world');
  return transitions;
}

test('80 balanced certified development cases replay every observation branch independently', () => {
  let certified = 0, transitions = 0;
  for (const family of FAMILIES) {
    let accepted = 0;
    for (let index = 0; accepted < 10 && index < 100; index++) {
      const spec = generateCase(family, index, 26112814);
      const certificate = certifyPolicy(spec);
      if (!certificate.solvable) continue; // A rejection never fills a positive quota.
      transitions += verifyAllCertificateBranches(spec, certificate);
      accepted++; certified++;
    }
    assert.equal(accepted, 10, `pilot quota for ${family}`);
  }
  assert.equal(certified, 80);
  assert.ok(transitions > 80);
});

test('an omniscient solution in every world does not certify an observation policy', () => {
  const spec = twoDoorWorlds(1);
  assert.deepEqual(createOracleWorld(spec, 0).observation(), createOracleWorld(spec, 1).observation());
  for (const world of spec.worlds) {
    const individuallyKnown = { ...spec, worlds: [world] };
    const individualCertificate = certifyPolicy(individuallyKnown);
    assert.equal(individualCertificate.solvable, true, 'each singleton hidden world has a solution');
    assert.equal(replayCertifiedPolicy(individuallyKnown, individualCertificate).crossed, true);
  }
  const jointlyUnknown = certifyPolicy(spec);
  assert.equal(jointlyUnknown.solvable, false);
  assert.equal(jointlyUnknown.reason, 'no-certified-observation-policy');
});

test('one accessible observation supports distinct later actions in all hidden branches', () => {
  const spec = twoDoorWorlds(2);
  const certificate = certifyPolicy(spec);
  verifyAllCertificateBranches(spec, certificate);
  assert.equal(certificate.policy.initial.length, 1);
  assert.equal(certificate.maxActions, 2);
  assert.equal(certificate.maxTicks, 2);
  const left = replayCertifiedPolicy(spec, certificate, 0);
  const right = replayCertifiedPolicy(spec, certificate, 1);
  assert.equal(left.actions[0], 'look');
  assert.equal(right.actions[0], 'look');
  assert.equal(left.actions[1], 'left');
  assert.equal(right.actions[1], 'right');
});

test('search exhaustion is reported separately from rejection after complete exploration', () => {
  const solvable = twoDoorWorlds(2);
  const exhausted = certifyPolicy(solvable, { maxStates: 1 });
  assert.equal(exhausted.solvable, false);
  assert.equal(exhausted.reason, 'oracle-state-budget');
  assert.equal(exhausted.states, 1);
  assert.equal(certifyPolicy(solvable, { maxStates: 100 }).solvable, true);
  const tooShort = certifyPolicy(twoDoorWorlds(1), { maxStates: 100 });
  assert.equal(tooShort.solvable, false);
  assert.equal(tooShort.reason, 'no-certified-observation-policy');
});

test('oracle has no subject dependency and hidden clock-origin translation changes no certificate', () => {
  const source = readFileSync(new URL('../scripts/sic-p14/oracle.mjs', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
  assert.deepEqual(imports, ['node:crypto']);
  const spec = generateCase(FAMILIES[6], 3, 26112814);
  const original = certifyPolicy(spec);
  const translatedSpec = shiftOrigin(spec, 987654321);
  const translated = certifyPolicy(translatedSpec);
  assert.equal(original.solvable, true);
  assert.equal(translated.solvable, true);
  assert.equal(original.policyHash, translated.policyHash);
  for (let world = 0; world < spec.worlds.length; world++) {
    assert.deepEqual(replayCertifiedPolicy(spec, original, world), replayCertifiedPolicy(translatedSpec, translated, world));
  }
});
