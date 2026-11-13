import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

function donor(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

test('V5 public adapter exposes only a source-authorized pending action', () => {
  const source = donor('reference/sra/212d8d426f07/agents/yf_arc3_v5/agent.py');
  assert.match(source, /V5 has no source-authorized action to choose/);
  assert.match(source, /authority": "source_action_release_permit"/);
  assert.match(source, /"action_intent_id": pending\["action_intent_id"\]/);
  assert.match(source, /"source_hash": pending\["source_hash"\]/);
  assert.match(source, /pending\.get\("action_ref"\) != action\.name/);
});

test('V5 execution rechecks exact runtime context before dispatch', () => {
  const source = donor('reference/sra/212d8d426f07/agents/yf_arc3_v5/agent.py');
  assert.match(source, /execute_pending_action/);
  for (const field of ['run_id', 'timeline_id', 'frame_id', 'state_revision']) {
    assert.equal(source.includes(`"${field}"`), true, `missing expected context field ${field}`);
  }
});

test('released action cycle keeps grounding, wisdom, release and ACT as distinct stages', () => {
  const source = donor('reference/sra/212d8d426f07/agents/yf_arc3_v5/src/core/released_action_cycle.src');
  const grounding = source.indexOf('validate_action_grounding');
  const wisdom = source.indexOf('operational_wisdom');
  const release = source.indexOf('release_action');
  const act = source.indexOf('ACT action_event');
  assert.ok(grounding >= 0 && grounding < wisdom);
  assert.ok(wisdom < release);
  assert.ok(release < act);
  assert.match(source, /FROM intent/);
  assert.match(source, /RELEASE release/);
  assert.match(source, /EXPECT intent\.expectation_refs/);
});

test('retained-grid action workflows prepare an intent but do not execute the environment action', () => {
  const source = donor('reference/sra/212d8d426f07/agents/yf_arc3_v5/src/arc3/conditional_reasoning_tree.src');
  const start = source.indexOf('WORKFLOW choose_retained_grid_motion_action');
  assert.ok(start >= 0);
  const snippet = source.slice(start, start + 7000);
  assert.match(snippet, /prepare_interaction_probe/);
  assert.match(snippet, /validate_action_grounding/);
  assert.match(snippet, /operational_wisdom/);
  assert.match(snippet, /release_action/);
  assert.doesNotMatch(snippet, /ACT action_event/);
});

test('architecture ledger requires the exact intent permit dispatch acquisition chain', () => {
  const source = donor('reference/sra/212d8d426f07/docs/architecture/resolving_architecture_overview.md');
  assert.match(source, /exact suspended execution,\s*intent\/permit\/dispatch\/acquisition chain/i);
  assert.match(source, /reject duplicate reconciliation/i);
  assert.match(source, /checks canonical intent, permit,\s*dispatch, acquisition and observation order/i);
});

test('pinned private donor map records the recovered historical release-permit schema', () => {
  const source = donor('docs/recovery/lot10d-temporal-action-release-donor-map.md');
  assert.match(source, /212d8d426f07eea2b6797c2bb647545767488a96/);
  for (const blob of [
    '6384f5f790beda7525e3554c3ec38c08d92bbbca',
    '2c713bb31dc4d8ec8f1774be87018832c3a91eb6',
    '17a46b4ea93fd635cd6f075a837c44cf9d24fbbe',
    '258324dcb643bc1d76d4d02766e9ff6b50fbc879',
    '03b49289a5611b81b74024d179ecfd727e0301f4',
    '8d4200b32217aea168433cc3c49aa895f8340394',
  ]) {
    assert.match(source, new RegExp(blob));
  }
  for (const field of [
    'action_intent_id',
    'viability_assessment_id',
    'commitment_decision_id',
    'available_action_ref',
    'pre_action_snapshot_digest',
    'valid_through_state_revision',
    'concentration_lease',
  ]) {
    assert.match(source, new RegExp(field));
  }
});

test('donor map preserves permit, ACT and environment dispatch as separate boundaries', () => {
  const source = donor('docs/recovery/lot10d-temporal-action-release-donor-map.md');
  const binding = source.indexOf('le binding prépare une action candidate');
  const permit = source.indexOf('le permis lie l\'intent');
  const act = source.indexOf('ACT revalide les preuves');
  const boundary = source.indexOf('`ActionBoundary` revérifie');
  assert.ok(binding >= 0 && binding < permit);
  assert.ok(permit < act);
  assert.ok(act < boundary);
  assert.match(source, /actionPayloadPresent: false/);
  assert.match(source, /actionReleased: false/);
  assert.match(source, /environmentDispatchAuthorized: false/);
});

test('donor map attributes exactly-once delivery to ActionBoundary rather than to permit creation', () => {
  const source = donor('docs/recovery/lot10d-temporal-action-release-donor-map.md');
  assert.match(source, /persiste une tentative avant l'appel externe/);
  assert.match(source, /redélivrance est interdite/);
  assert.match(source, /dispatch déjà enregistré est réutilisé sans nouvel envoi/);
  assert.match(source, /consommation exactement une fois appartient donc à une étape séparée/);
});

test('donor map records the minimal historical ActOutput pending the environment boundary', () => {
  const source = donor('docs/recovery/lot10d-temporal-action-release-donor-map.md');
  for (const field of [
    'action_ref',
    'action_intent_id',
    'action_release_permit_id',
    'pending_environment_boundary',
  ]) {
    assert.match(source, new RegExp(field));
  }
  assert.match(source, /Le transport environnemental reste dans `ActionBoundary`/);
});

test('donor map preserves current-context revalidation and the validated-to-released transition', () => {
  const source = donor('docs/recovery/lot10d-temporal-action-release-donor-map.md');
  assert.match(source, /VALIDATED -> RELEASED/);
  assert.match(source, /absence de supports retirés/);
  assert.match(source, /responsabilité courante/);
  assert.match(source, /preuves courantes de consommation du but/);
  assert.match(source, /continuation parent/);
  assert.match(source, /contexte canonique d'exécution/);
});

test('donor map keeps terminal ACT consumption separate from exactly-once environment delivery', () => {
  const source = donor('docs/recovery/lot10d-temporal-action-release-donor-map.md');
  assert.match(source, /actionReleased: true.*future frontière environnementale/s);
  assert.match(source, /environmentDispatchAuthorized: false/);
  assert.match(source, /aucun `AgentAction` ni cible exécutable/);
  assert.match(source, /ne remplace pas l'envoi exactement une fois de l'environnement/);
  assert.match(source, /responsabilité future d'`ActionBoundary`/);
});
