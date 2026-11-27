import assert from 'node:assert/strict';
import { Agenda } from '../agenda.mjs';
import { digest } from './observation.mjs';

const entries = ['test_local_input', 'reach_open_input'];
const group = 'observed_frontier';
const goal = 'observer l’effet d’une entrée inédite';
const offers = entries.map((id, i) => ({
  id, strategy: id, group, entry: id, contributes: [goal], modeFacts: {},
  guards: [{ fact: 'local', expected: i === 0 }, ...(i ? [{ fact: 'route', expected: true }] : [])],
}));

export function predict(seal) {
  const pre = JSON.parse(seal.payload);
  assert.equal(digest(pre), seal.sha256);
  assert.deepEqual(Object.keys(pre).sort(), [
    'observation', 'index', 'epoch', 'frame', 'sequence', 'graphChain', 'inputOrder',
    'local', 'domain', 'routeStatus', 'remote', 'path',
  ].sort());
  const local = pre.local !== null;
  assert.ok(pre.domain.every(d => Array.isArray(d.tried)));
  const tried = pre.domain.flatMap(d => d.tried);
  const refs = [pre.observation, pre.index, pre.graphChain];
  const facts = { local: { value: local, evidence: [...refs, ...(local ? [pre.local.ref] : tried)] } };
  if (pre.routeStatus === 'found') {
    assert.ok(!local && pre.path.length && pre.remote && pre.path[0].source === pre.index);
    assert.equal(pre.path.at(-1).target, pre.remote.context);
    assert.ok(pre.path.every((e, i) => e.witnesses.length && (!i || pre.path[i - 1].target === e.source)));
    facts.route = { value: true, evidence: [pre.remote.ref, ...pre.path.flatMap(e => [e.ref, ...e.witnesses])] };
  } else {
    assert.equal(pre.routeStatus, local ? 'unqueried' : 'exhausted');
    assert.ok(pre.remote === null && !pre.path.length);
    if (!local) facts.route = { value: false, evidence: refs };
  }
  const result = new Agenda().decide({ scope: group, goal, need: { target: goal }, offers, facts,
    groups: [{ id: group, entries }], mode: 'exploration', remaining: 0, stops: [],
    observation: { ref: pre.observation, frame: pre.frame, epoch: pre.epoch } });
  const strategy = result.decision === 'selectionner' ? result.branch : null;
  return { seal: seal.sha256, familyPrediction: 'indéterminée', decision: result.decision,
    strategy, command: strategy === entries[0] ? pre.local.action : strategy === entries[1] ? pre.path[0].action : null,
    question: (pre.local ?? pre.remote)?.ref ?? null, evidence: result.evidence,
    offers: result.tree.branches.map(b => ({ id: b.id, admission: b.admission, reason: b.reason })),
    resumeWhen: strategy ? null : 'Une entrée admise inédite ici ou un trajet observé vers une telle entrée.' };
}
