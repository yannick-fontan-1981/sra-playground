#!/usr/bin/env python3
"""Check native coordination witnesses against original component/DRM evidence.

The caller preference is an explicit native extension. This script verifies
its current source component, source-declared five-fragment subset and lack
of an earlier acquired trial at the exact public context. It does not claim
to reproduce the original V6 caller's priority or the entire V5 caller.
"""
from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('outline_continuation_original', ROOT / 'scripts/export-v6-outline-continuation-reference.py')
source = importlib.util.module_from_spec(spec); spec.loader.exec_module(source)
helper = source.helper
from common_frontier import _action, _action_key, _protocol, _index

RULE = 'v5_current_required_service_before_independent_contact_question'
SOURCE_RECEIPT_FIELDS = {'workflow', 'src_hash', 'src_status', 'executed_statements'}
NATIVE_RECEIPT_FIELDS = {'all_executed_statements', 'instruction_quantum', 'instructions', 'trace', 'execution_engine',
                       'reference_commit', 'reference_semantic_hash', 'native_execution_hash', 'source_definition_hash', 'edited'}
ANNOTATIONS = []


def load(path): return source.load(path)
def plain(value): return source.plain(value)
def packed(value): return source.packed(value)
def digest(value): return source.digest(value)


def proof(path):
    path = Path(path); value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''): value.update(chunk)
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': value.hexdigest(), 'bytes': path.stat().st_size}


def check(actual, expected, path):
    if packed(actual) == packed(expected): return
    if isinstance(actual, dict) and isinstance(expected, dict) and set(actual) == set(expected):
        for key in actual: check(actual[key], expected[key], path + '.' + key)
    elif isinstance(actual, list) and isinstance(expected, list) and len(actual) == len(expected):
        for index, (a, b) in enumerate(zip(actual, expected)): check(a, b, path + f'.{index}')
    raise AssertionError({'path': path, 'actual': actual, 'expected': expected})


def src_projection(value, path):
    if isinstance(value, list): return [src_projection(child, path + f'.{index}') for index, child in enumerate(value)]
    if not isinstance(value, dict): return value
    if SOURCE_RECEIPT_FIELDS <= value.keys():
        extras = set(value) - SOURCE_RECEIPT_FIELDS
        assert extras <= NATIVE_RECEIPT_FIELDS and path.endswith(('.workflow', '.control_workflow'))
        if extras:
            assert value['execution_engine'] == 'logos-engine.typescript' and value['reference_commit'] == helper.COMMIT
            ANNOTATIONS.append({'path': path, 'fields': sorted(extras), 'sha256': digest({key: value[key] for key in sorted(extras)})})
        return {key: plain(value[key]) for key in SOURCE_RECEIPT_FIELDS}
    return {key: src_projection(child, path + '.' + key) for key, child in value.items()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory')
    parser.add_argument('game')
    parser.add_argument('--allow-failed-campaign', action='store_true')
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    out = ROOT / args.directory; stem = args.game.lower()
    paths = {'campaign': out / (stem + '-campaign.json.gz'), 'trace': out / (stem + '-public-trace.json.gz'),
             'sourceComparison': out / 'outline-service-original-comparison.json.gz',
             'sourceFixture': ROOT / 'tests/fixtures/v6-outline-continuation-reference.json.gz',
             'sourceOutlineFixture': ROOT / 'tests/fixtures/v6-outline-service-reference.json.gz'}
    output = out / 'outline-continuation-source-witness-comparison.json.gz'
    if not args.verify: assert not output.exists(), 'Refusing to replace retained comparison evidence'
    campaign, trace, original, fixture = [load(paths[key]) for key in ['campaign', 'trace', 'sourceComparison', 'sourceFixture']]
    assert original['status'] == 'passed' and original['differenceCount'] == 0
    assert campaign['game'] == trace['game'] == original['game'] == args.game
    assert campaign['status'] == original['nativeCampaignStatus'] and campaign['status'] == trace['status']
    assert campaign['status'] == 'passed' or (args.allow_failed_campaign and campaign['status'] == 'failed')
    for key in ['campaign', 'trace']: check(proof(paths[key]), original['inputs'][key], 'input.' + key)
    assert original['nativeSourceDigest'] == campaign['source']['digest']
    assert original['counts']['sourceAcquisitionCalls'] == len(campaign['actions'])
    assert original['publicPacketsCompared'] == len(trace['packets']) and original['completePublicJournalMatched'] is True
    check(proof(Path(__file__).with_name('export-v6-outline-continuation-reference.py')), fixture['generator'], 'source.fixture.generator')
    interaction_action = load(paths['sourceOutlineFixture'])['configuration']['policy']['interface_prior']['interaction']
    observations = [source.observe(SimpleNamespace(**row['packet']), index + 1, original['observationScope'])[0]
                    for index, row in enumerate(trace['packets'])]
    registry, policy, tier, extracted = source.extraction()
    check(extracted, fixture['subset'], 'source.subset.independent.extraction')
    proposals = {row['prefixIndex']: row for row in original['proposals']}
    cursor, methods, trials, verified, other = 0, [], {}, [], []
    helper.AUDIT_ACTIVE = True
    sys.setprofile(source.contracts.profile)
    try:
        for prefix_index, prefix in enumerate(campaign['prefixes']):
            obs = observations[cursor]; rows = trace['packets'][cursor]['packet']['frame_rows']
            for receipt_index, receipt in enumerate(prefix.get('nativeCoordination', [])):
                if receipt.get('rule') != RULE:
                    other.append({'prefixIndex': prefix_index, 'receiptIndex': receipt_index, 'rule': receipt.get('rule'), 'sha256': digest(receipt)})
                    continue
                assert prefix_index in proposals and prefix['family'] == 'public_outline_service'
                original_proposal = proposals[prefix_index]
                assert original_proposal['allProviderFieldsCompared'] is True and original_proposal['sourceAndNativeProjectionSha256']
                proposal = original_proposal['proposal']; plan = proposal['outline_plan']; measurement = plan['measurement']
                assert len(proposal['actions']) == len(proposal['steps']) == prefix['acquiredActions'] == 1
                assert plan['meaning']['kind'] == 'announced_correspondence_hypothesis' and plan['operator'] is False
                command = proposal['actions'][0]
                witness = receipt['current_required_service']; trial = witness['current_trial']
                where = f'prefix.{prefix_index}.coordination.{receipt_index}'
                assert receipt['observation_ref'] == obs['observation_ref'] and receipt['preferred_family'] == prefix['family']
                assert receipt['selected_group'] == prefix['selectionGroup'] and receipt['selected_subquestion'] == prefix['materialSubquestion']
                assert receipt['source_trigger_index'] < receipt['selected_group_index']
                assert receipt['physical_action_authorized'] is False and receipt['primitive_bound'] == 1 and receipt['replan_after_each_primitive'] is True
                assert receipt['source_state_ref'] == 'family_state:public_outline_service' and type(receipt['source_state_revision']) is int
                independent = receipt['independent_unknown_effect_question']
                assert independent['status'] == 'unknown_effect_inquiry_with_measured_access' and independent['effect_status'] == 'unobserved'
                assert independent['observation_ref'] == obs['observation_ref'] and independent['level_epoch'] == obs['level_epoch']
                assert independent['contact_evidence'] == []
                assert witness['schema'] == 'logos-engine.native.outline-required-service.v1'
                assert witness['rule'] == 'native.current_announced_outline_service_before_independent_contact'
                assert witness['status'] == 'current_required_service'
                for key in ['observation_ref', 'level_epoch', 'frame_hash']: check(witness[key], obs[key], where + '.binding.' + key)
                check(witness['action_ref'], command['action_ref'], where + '.action')
                check(witness['current_rows_sha256'], helper.digest(rows), where + '.rows.digest')
                check(witness['proposal_ref'], 'outline_service:' + helper.digest(proposal), where + '.source.proposal.identity')
                assert witness['proposal_identity_profile'] == 'source_outline_proposal_with_four_original_src_receipt_fields.v1'
                check(src_projection(witness['current_measurement'], where + '.measurement'), measurement, where + '.source.measurement')
                check(src_projection(witness['current_control'], where + '.control'), plan['control'], where + '.source.control')
                local = [event for event in methods if event['status'] == 'observed_local_change' and event['scope'] == obs['level_epoch']
                         and event['local_count'] > 0 and event['action']['action_ref'] == interaction_action]
                assert local
                check(witness['local_operator_evidence'], local, where + '.actual.local.evidence')
                guard = original['acquisitionChecks'][cursor]['sourceGuard']
                assert guard['admitted'] is True
                check(witness['source_guard'], guard, where + '.actual.source.guard')
                check(receipt['guard_reason'], guard['reason'], where + '.guard.reason')
                context, action_key = _index(obs), _action_key(command)
                prior = trials.get((context, action_key), [])
                assert not prior, ('Actual prior trial at claimed untried public context', where, prior)
                trial_expected = {'status': 'untried_exact_public_context', 'observation_ref': obs['observation_ref'],
                    'level_epoch': obs['level_epoch'], 'frame_hash': obs['frame_hash'], 'action_ref': command['action_ref'],
                    'trial_key': context + ':' + action_key, 'action_key': action_key, 'context_index': context,
                    'protocol': _protocol(obs), 'command': _action(command), 'domain_complete': True,
                    'attempted_without_effect_in_current_context': False, 'evidence_refs': [obs['observation_ref']],
                    'prior_trial_count': 0, 'prior_transition_refs': [], 'source_state_ref': 'caller:frontier',
                    'context_projection': 'v6.frontierProtocol', 'v5_caller_context_parity': False}
                check({key: trial[key] for key in trial_expected}, trial_expected, where + '.public.trial')
                assert re.fullmatch('[a-f0-9]{64}', trial['source_frontier_chain'])
                assert type(trial['source_frontier_sequence']) is int and trial['source_frontier_sequence'] > 0
                assert type(trial['source_state_revision']) is int and trial['source_state_revision'] > 0
                assert witness['trial_key'] == trial_expected['trial_key']
                facts = {**measurement['relation'], 'candidate_ref': witness['proposal_ref'], 'action_ref': command['action_ref'],
                         'interaction_measurement_kind': 'discrete',
                         'candidate_matches_compact_body_hollow_perimeter_marker_direction': command['action_ref'] in measurement['accompaniment'],
                         'attempted_without_effect_in_current_context': False}
                expected = source.evaluate(registry, policy, tier, facts)
                assert expected['matched'] is True
                check(witness['source_condition_receipt'], expected, where + '.original.subset.result')
                info = witness['source_subset']
                assert info['reference_commit'] == helper.COMMIT and info['source_path'] == 'agents/yf_arc3_v5/drm/interaction.drm'
                assert info['source_sha256'] == extracted['source']['sha256'] and info['subset_sha256'] == extracted['document']['sha256']
                assert info['original_policy_ref'] == extracted['sourcePolicyRef']
                check(info['declaration_refs'], [row['id'] for row in extracted['sourceDeclarations']], where + '.source.fragment.identities')
                evidence = list(dict.fromkeys([obs['observation_ref'], *plan['control']['evidence'],
                                              *(ref for event in local for ref in event['evidence']), *trial['evidence_refs']]))
                check(witness['evidence_refs'], evidence, where + '.source.evidence')
                assert witness['primitive_bound'] == 1 and witness['replan_after_each_primitive'] is True
                assert witness['release_authority'] is False and witness['action_effect_known'] is False and witness['terminal_rule_known'] is False
                verified.append({'prefixIndex': prefix_index, 'receiptIndex': receipt_index, 'actualActionIndex': cursor + 1,
                                 'observation_ref': obs['observation_ref'], 'command': command, 'sourceProposalSha256': helper.digest(proposal),
                                 'sourceConditionResultSha256': digest(expected), 'actualEarlierTrialCountAtContext': len(prior),
                                 'sourceGuardCompared': True, 'sourceMeasurementCompared': True, 'currentControlCompared': True,
                                 'sameEpochOriginalLocalEventCount': len(local), 'receiptSha256': digest(receipt),
                                 'nativeOnlyAnnotations': {'deferredWitness': digest(independent),
                                     'preferredProposalTransportDigest': receipt['preferred_proposal_digest'],
                                     'preferredProposalTransportProfile': receipt['preferred_proposal_digest_profile'],
                                     'frontierChain': trial['source_frontier_chain'], 'frontierSequence': trial['source_frontier_sequence'],
                                     'frontierRevision': trial['source_state_revision'], 'wrapperQualification': info.get('wrapper_qualification')}})
            for _ in range(prefix['acquiredActions']):
                acquired = original['acquisitionChecks'][cursor]
                command = acquired['actualComponentCommand']
                trials.setdefault((_index(observations[cursor]), _action_key(command)), []).append(cursor + 1)
                event = acquired['sourceAcquisition']
                if acquired['owned'] and event and event.get('status') in ['observed_local_change', 'no_visible_local_change']:
                    methods.append(copy.deepcopy(event)); methods = methods[-32:]
                cursor += 1
        assert cursor == len(campaign['actions']) and verified, 'No retained use of the current-service coordination to verify'
    finally: sys.setprofile(None)
    helper.AUDIT_ACTIVE = False
    assert helper.verify_source_manifest() == helper.VERIFIED_SOURCE
    result = {'schema': 'logos-engine.v53.outline-native-continuation-source-witness-comparison.v1', 'status': 'passed',
              'nativeCampaignStatus': campaign['status'], 'nativeLevelsCompleted': campaign['final']['levelsCompleted'],
              'nativeSourceDigest': campaign['source']['digest'], 'sourceCommit': helper.COMMIT,
              'sourceFilesVerifiedBeforeImport': 1786, 'sourceFilesVerifiedAfterComparison': 1786, 'sourceUnchanged': True,
              'generator': proof(Path(__file__)), 'inputs': {key: proof(path) for key, path in paths.items()},
              'actualCommandsScannedForPriorTrials': cursor, 'coordinationWitnessesCompared': len(verified),
              'witnesses': verified, 'otherNativeCoordinationInventoried': other, 'nativeSrcAnnotations': ANNOTATIONS,
              'footprint': helper.source_footprint(),
              'qualification': {'hostExecuted': False, 'nativeAgentExecuted': False, 'originalCallerPriorityParity': False,
                  'fullV5CallerContextParity': False, 'deferredProviderReconstructed': False, 'frontierChainReconstructed': False,
                  'preferredTransportDigestReconstructed': False,
                  'scope': 'The complete actual public trajectory and independently recomputed original Outline proposals/acquisitions establish the source measurement, local evidence, source guard and absence of any prior acquired command at the exact V6 public protocol. The unchanged original V5 evaluator recomputes every retained condition/projection/tier result. Caller arbitration remains an explicit native extension; its deferred-provider witness, frontier persistence chain and transport digest are retained as native-only annotations, not asserted to be independently reconstructed original-caller outputs.'}}
    if args.verify: check(load(output), result, 'retained.coordination.comparison')
    else: helper.write_gzip_absent(output.relative_to(ROOT).as_posix(), result)
    print(json.dumps({'status': 'passed', 'mode': 'verify' if args.verify else 'create', 'nativeCampaignStatus': campaign['status'],
                      'nativeLevelsCompleted': campaign['final']['levelsCompleted'], 'commandsScanned': cursor,
                      'coordinationWitnessesCompared': len(verified), 'output': output.relative_to(ROOT).as_posix()}), flush=True)


if __name__ == '__main__': main()
