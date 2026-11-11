#!/usr/bin/env python3
"""Read-only comparison of a fresh actual common journal and cold Python replay.

This recovery tool imports neither implementation. It preserves exclusive
outputs and its exact own source; a failed common attempt remains failed.
"""
from __future__ import annotations
import argparse
from collections import Counter
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
CALLER_STATE_RETENTION = 'core_or_methods_memory_roundtrip'
FIELDS = ('epoch', 'core', 'moves', 'tried', 'blocked', 'held', 'interaction', 'methods', 'events', 'failed',
          'goal_evidence', 'correspondence_context', 'context_refutations', 'pending_reception', 'reception_receipts', 'observed_frames')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def difference(a, b, path='$'):
    if isinstance(a, bool) or isinstance(b, bool):
        return None if type(a) is type(b) and a == b else path + ': boolean/value differs'
    if a is None or b is None:
        return None if a is b else path + ': null/value differs'
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return None if a == b else path + ': numeric value differs'
    if type(a) is not type(b):
        return path + ': type differs'
    if isinstance(a, dict):
        if set(a) != set(b):
            return path + ': keys differ (' + repr(sorted(set(a) ^ set(b)))[:180] + ')'
        for key in a:
            found = difference(a[key], b[key], path + '.' + key)
            if found:
                return found
        return None
    if isinstance(a, list):
        if len(a) != len(b):
            return path + ': length differs (' + str(len(a)) + ',' + str(len(b)) + ')'
        for index, (left, right) in enumerate(zip(a, b)):
            found = difference(left, right, path + '[' + str(index) + ']')
            if found:
                return found
        return None
    return None if a == b else path + ': value differs'


def equal(a, b, message='Values differ'):
    found = difference(a, b)
    if found:
        raise AssertionError(message + ': ' + found)


class Review:
    def __init__(self):
        self.inputs, self.checks = {}, []

    def fingerprint(self, path):
        path = Path(path)
        path = (path if path.is_absolute() else ROOT / path).resolve()
        require(path.is_relative_to(ROOT), 'Review input must belong to the checkout')
        data = path.read_bytes()
        record = {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(data), 'sha256': sha(data)}
        if record['path'] in self.inputs:
            equal(record, self.inputs[record['path']], 'Input changed during review')
        self.inputs[record['path']] = record
        return record

    def read(self, path):
        record = self.fingerprint(path)
        data = (ROOT / record['path']).read_bytes()
        require(sha(data) == record['sha256'], 'Read differs from the pinned input')
        return json.loads(gzip.decompress(data) if record['path'].endswith('.gz') else data)

    def check(self, name, call):
        try:
            call(); self.checks.append({'name': name, 'passed': True})
        except Exception as error:
            self.checks.append({'name': name, 'passed': False, 'error': {'type': type(error).__name__, 'message': str(error)}})


def state_order(actual, expected):
    for name in ('moves', 'observed_frames'):
        equal(list(actual[name]), list(expected[name]), 'Consumed mapping order: ' + name)
    if expected['correspondence_context'] is not None:
        equal(list(actual['correspondence_context']['frames']), list(expected['correspondence_context']['frames']),
              'Consumed correspondence frame order')


def consumed_orders(state):
    return {'moves': list(state['moves']), 'observed_frames': list(state['observed_frames']),
            'context_frames': list(state['correspondence_context']['frames'])
            if state['correspondence_context'] is not None else None}


def compare(review, directory, fixture_path, export_path):
    journal_path, common_path = directory / 'actual-operations.json', directory / 'common-loop.json.gz'
    journal, common, fixture, exported = (review.read(path) for path in (journal_path, common_path, fixture_path, export_path))
    equal(journal['schema'], 'logos-engine.v6.observed-binding-public-operations.v1')
    equal(common['schema'], 'logos-engine.lot5c-common-loop.v1')
    equal(fixture['schema'], 'logos-engine.v6.observed-binding-reference.v1')
    equal(fixture['mode'], 'captured-public-journals')
    equal(exported['schema'], 'logos-engine.independent-python-oracle-export.v1')
    equal(exported['status'], 'passed'); equal(exported['referenceCommit'], COMMIT); equal(fixture['referenceCommit'], COMMIT)
    equal(exported['mode'], fixture['mode'])
    require(exported['sourceInventoryUnchanged'] is True, 'Original inventory changed')
    equal(exported['sourceInventorySha256Before'], exported['sourceInventorySha256After'])
    equal(review.fingerprint(fixture_path), {key: exported['fixture'][key] for key in ('path', 'bytes', 'sha256')})
    equal(review.fingerprint(exported['exporter']['path']), exported['exporter'])
    manifest = review.read(exported['sourceManifest']['path'])
    equal(review.fingerprint(exported['sourceManifest']['path']), exported['sourceManifest'])
    equal(exported['sourceFilesVerifiedBefore'], len(manifest['files']))
    equal(exported['sourceFilesVerifiedAfter'], len(manifest['files']))
    for record in exported['importedOriginalModules'].values():
        name = record['path'].split('/source/', 1)[1]
        require(name.startswith('agents/'), 'A game or another tree entered the original replay')
        equal(review.fingerprint(record['path']), record)
        equal(manifest['files'][name]['sha256'], record['sha256'])
    bound = review.fingerprint(journal_path)
    chains = [chain for chain in fixture['chains'] if chain.get('inputJournal', {}).get('path') == bound['path']]
    require(len(chains) == 1, 'Exactly one original cold chain must bind this journal')
    chain = chains[0]
    equal({key: chain['inputJournal'][key] for key in ('path', 'bytes', 'sha256')}, bound)
    require(chain['inputJournal']['nativeResultsConsulted'] is False, 'Native output was an oracle input')
    equal(chain['id'], journal['id']); equal(chain['episode'], journal['episode'])
    equal(journal['sourceStateRetention'], CALLER_STATE_RETENTION)
    equal(chain['sourceStateRetention'], CALLER_STATE_RETENTION)
    equal(common['sourceStateRetention'], CALLER_STATE_RETENTION)
    equal(set(chain['initialState']), set(FIELDS)); equal(chain['initialState']['core'], None); equal(chain['initialState']['epoch'], None)
    for name in ('methods', 'events', 'failed', 'goal_evidence', 'context_refutations', 'reception_receipts'):
        equal(chain['initialState'][name], [])
    equal(chain['initialAttention'], {'item': None, 'composition': None}); equal(chain['initialMemoryPuts'], [])
    equal(chain['initialAttentionBoundShared'], False)
    require(not any(name in journal for name in ('setup', 'initialState', 'expected', 'restore', 'sourceState')), 'Injected source journal state')
    equal(len(journal['operations']), len(chain['operations']))
    require(bool(chain['operations']), 'Empty original replay')
    mode = common['mode']
    require(mode in ('positive', 'refutation', 'ambiguity', 'boundary'), 'Only the four source common modes are admitted here')
    equal(journal['mode'], mode)
    review.check('common_declared_contract_passed', lambda: equal(common['status'], 'passed'))
    review.check('common_has_no_failures', lambda: equal(common['checks']['failures'], []))
    review.check('common_declarations_unchanged', lambda: equal(common['sourceDeclarationsModified'], False))
    review.check('complete_declared_public_table', lambda: equal(common['sourceStages'], common['declaredStages']))
    review.check('synthetic_scope_declared', lambda: equal(common['synthetic'], True))
    review.check('source_has_no_exception', lambda: equal(exported['counts']['sourceExceptions'], 0))
    review.check('initial_native_source_projection', lambda: equal(common['initialState'], chain['initialState']))
    plan = review.read(common['proofPlan'])
    equal(plan['schema'], 'logos-engine.lot5c-common-proof-plan.v1')
    equal(plan['sourceStateRetention'], CALLER_STATE_RETENTION)
    require(datetime.fromisoformat(plan['declaredAt'].replace('Z', '+00:00')) <= datetime.fromisoformat(common['startedAt'].replace('Z', '+00:00')),
            'Common plan must be declared before execution')
    required = {common['proofPlan'], 'scripts/native-object-binding-common-loop.ts', 'tests/v6-object-binding-common.test.ts',
                'scripts/review-observed-binding-common-replay.py'}
    require(required <= {record['path'] for record in common['executionInputs']}, 'Missing common execution input pin')
    for record in common['executionInputs']:
        review.check('executed_input:' + record['path'], lambda record=record: equal(review.fingerprint(record['path']), record))
    review.check('execution_inputs_pinned_before_and_after', lambda: equal(common['executionInputsBefore'], common['executionInputsAfter']))
    review.check('execution_inputs_bind_used_version', lambda: equal(common['executionInputs'], common['executionInputsBefore']))
    review.check('execution_inputs_unchanged', lambda: equal(common['executionInputsUnchangedDuringRun'], True))

    prior_puts, actual_puts = [], []
    for index, (actual, expected) in enumerate(zip(journal['operations'], chain['operations'])):
        prefix = 'operation:' + str(index) + ':' + actual['method']
        def inputs(actual=actual, expected=expected, index=index):
            equal(expected['journalOperation'], index); equal(expected['capturedMethod'], actual['method'])
            equal(expected['useLatestSourceProposal'], actual.get('useLatestSourceProposal', False))
            equal({key: value for key, value in expected['input'].items() if key != 'proposal'}, actual['input'])
            require('proposal' not in actual['input'] and 'state' not in actual['input'], 'Native proposal/state injected')
            if actual.get('useLatestSourceProposal'):
                require(expected['input'].get('proposal') is not None, 'No source proposal for selected call')
        review.check(prefix + ':exact_public_inputs', inputs)
        review.check(prefix + ':exception', lambda actual=actual, expected=expected: equal(actual['native'].get('exception'), expected.get('exception')))
        if 'exception' not in expected:
            review.check(prefix + ':result', lambda actual=actual, expected=expected: equal(actual['native']['result'], expected['result']))
        review.check(prefix + ':complete_tracker', lambda actual=actual, expected=expected: equal(actual['native']['state'], expected['state']))
        review.check(prefix + ':consumed_mapping_order', lambda actual=actual, expected=expected: state_order(actual['native']['state'], expected['state']))
        review.check(prefix + ':common_attention', lambda actual=actual, expected=expected: equal(actual['native']['attention'], expected['attention']))
        current_puts = expected['memoryPuts']
        review.check(prefix + ':cumulative_memory_prefix', lambda current_puts=current_puts, prior_puts=prior_puts: equal(current_puts[:len(prior_puts)], prior_puts))
        delta = current_puts[len(prior_puts):]
        review.check(prefix + ':exact_memory_delta', lambda actual=actual, delta=delta: equal(actual['native']['memoryPuts'], delta))
        prior_puts = current_puts; actual_puts.extend(actual['native']['memoryPuts'])
        if actual['method'] in ('proposeSource', 'recordSource'):
            review.check(prefix + ':current_shared_attention', lambda actual=actual: equal(actual['native']['sharedAttentionBound'], True))
        if actual['method'] == 'bind' and 'exception' not in expected:
            def binding(expected=expected):
                proposal = expected['proposalAfterBind']; equal(proposal, expected['input']['proposal'])
                equal(proposal['actions'], [step['action'] for step in proposal['steps']])
                require(all('expected_after' in step for step in proposal['steps']), 'Unbound original step')
            review.check(prefix + ':source_binding', binding)
        if actual['method'] == 'recordSource' and actual.get('useLatestSourceProposal'):
            review.check(prefix + ':selected_command_from_original_offer', lambda actual=actual, expected=expected:
                         equal(actual['input']['command'], expected['input']['proposal']['actions'][actual['input'].get('index', 0)]))
    records = [op for op in journal['operations'] if op['method'] == 'recordSource']
    selected = [op for op in records if op.get('useLatestSourceProposal')]
    retentions = chain['sourceStateRetentions']
    record_counts = [index + 1 for index, op in enumerate(chain['operations']) if op['method'] == 'record']
    review.check('source_retention_branch_after_every_record', lambda: equal(
        [row['afterOperationCount'] for row in retentions], record_counts))
    review.check('source_retention_export_count', lambda: equal(exported['counts']['sourceStateRetentionChecks'], len(retentions)))
    review.check('source_retention_taken_count', lambda: equal(exported['counts']['sourceStateRetentions'], sum(row['retained'] for row in retentions)))
    for row in retentions:
        count = row['afterOperationCount']
        def source_retention(row=row, count=count):
            require(type(count) is int and 0 < count <= len(chain['operations']), 'Invalid source retention chronology')
            operation = chain['operations'][count - 1]
            equal(operation['method'], 'record')
            equal(row['beforeState'], operation['state']); state_order(row['beforeState'], operation['state'])
            require(type(row['retained']) is bool, 'Retention condition must be a boolean')
            equal(row['retained'], bool(row['beforeState']['core'] or row['beforeState']['methods']))
            if row['retained']:
                # Independent receipt check of Memory.pack(sort_keys=True).
                # The exporter itself executes original Memory.put/get/restore.
                expected_value = json.loads(canonical(row['beforeState']))
                equal(row['storedFact'], {'value': expected_value, 'evidence': operation['input']['after']['observation_ref'],
                                          'revision': operation['input']['after']['revision']})
                equal(row['afterState'], expected_value); state_order(row['afterState'], expected_value)
            else:
                equal(row['storedFact'], None); equal(row['afterState'], row['beforeState'])
                state_order(row['afterState'], row['beforeState'])
        review.check('source_retention:' + str(count) + ':exact_original_memory_boundary', source_retention)
    retention_by_count = {row['afterOperationCount']: row for row in retentions}
    review.check('all_actual_returns_acquired', lambda: equal(len(records), common['returned']))
    review.check('selected_return_population', lambda: equal(len(selected), common['ownReturns']))
    review.check('unique_return_acquisitions', lambda: equal(len({op['input']['before']['observation_ref'] for op in records}), len(records)))
    review.check('selected_and_passive_exercised', lambda: require(0 < len(selected) < len(records), 'Both actual acquisition paths are required'))
    review.check('selected_null_exercised', lambda: require(any(op['native']['result'] is None for op in selected), 'Selected null was not exercised'))
    review.check('passive_null_exercised', lambda: require(any(not op.get('useLatestSourceProposal') and op['native']['result'] is None for op in records), 'Passive null was not exercised'))
    review.check('memory_journal_complete', lambda: equal(actual_puts, prior_puts))
    review.check('no_unreplayed_native_attention_extension', lambda: equal(common['nativeAttentionExtensions'], []))
    review.check('exact_tracker_field_population', lambda: require(all(set(op['native']['state']) == set(FIELDS) for op in journal['operations']), 'Unexpected source tracker annex'))
    review.check('actual_native_restoration_observed', lambda: require(bool(common['restores']) and bool(common['checkpoints']), 'Missing real restoration'))
    restore_orders = []
    for index, restore in enumerate(common['restores']):
        review.check('restore:' + str(index) + ':exact_checkpoint', lambda restore=restore: equal(restore['input'], restore['output']))
        review.check('restore:' + str(index) + ':attention_separate', lambda restore=restore: require('attention' not in restore['input'], 'Attention duplicated in owner checkpoint'))
        def source_after_restore(restore=restore):
            count = restore['operationCount']
            require(type(count) is int and 0 <= count <= len(chain['operations']), 'Native restore has an invalid public-call position')
            expected = chain['initialState'] if count == 0 else chain['operations'][count - 1]['state']
            if count in retention_by_count:
                expected = retention_by_count[count]['afterState']
            # Native restore is an additional checkpoint step. Its input may
            # precede its key-order normalization; its values cannot change.
            # The restored consumed order and every later source call remain
            # strict against independently calculated Python caller state.
            equal(restore['beforeSource'], expected, 'Native pre-restore values differ')
            equal(restore['afterSource'], expected, 'Restored source projection differs')
            state_order(restore['afterSource'], expected)
            for checkpoint in (restore['input'], restore['output']):
                equal(checkpoint['source'], expected); state_order(checkpoint['source'], expected)
            restore_orders.append({'operationCount': count, 'before': consumed_orders(restore['beforeSource']),
                                   'after': consumed_orders(restore['afterSource']), 'originalAfterCallerRetention': consumed_orders(expected)})
        review.check('restore:' + str(index) + ':source_values_and_consumed_order', source_after_restore)
    review.check('actual_common_attention_replacement', lambda: require(any(row['identityChanged'] for row in common['attentionRestores']), 'No actual attention replacement'))
    review.check('final_tracker', lambda: equal(common['finalState'], chain['finalState']))
    review.check('final_attention', lambda: equal(common['finalAttention'], chain['finalAttention']))
    proposals = [op for op in chain['operations'] if op['method'] == 'propose' and 'result' in op]
    last = proposals[-1]['result'] if proposals else None
    state, attention = chain['finalState'], chain['finalAttention']['composition']
    if mode in ('positive', 'refutation'):
        require(last is not None, 'Source did not issue the final contrast offer')
        next_proposal = common['next']['snapshot']['proposal']
        review.check('next_common_actions_from_original', lambda: equal(next_proposal['actions'], last['actions']))
        review.check('next_common_binding_plan_from_original', lambda: equal(next_proposal['binding_plan'], last['binding_plan']))
        review.check('next_common_command_from_original', lambda: equal(common['next']['command'], last['actions'][0]))
        if mode == 'positive':
            review.check('observed_positive_separation', lambda: require(attention['status'] == 'achieved' and state['held'] is None and state['pending_reception'] is None
                         and any(e['status'] == 'reception_confirmed_by_separation' for e in state['events']), 'Missing original separation confirmation'))
            review.check('next_target_changed', lambda: require(last['binding_plan']['offer']['target']['frame']['ref'] != attention['target_ref'], 'Original kept completed target'))
        else:
            review.check('observed_negative_separation', lambda: require(attention['status'] == 'pending' and state['pending_reception'] is None and state['held']['status'] == 'joint_transport_observed'
                         and any(e['status'] == 'reception_refuted_object_moves_with_body' for e in state['events']), 'Missing original separation refutation'))
            review.check('original_pending_parent_retained', lambda: equal(last['binding_plan']['offer']['target']['frame']['ref'], attention['target_ref']))
    else:
        review.check('original_owner_abstains', lambda: equal(last, None))
    scope = lambda obs: {key: obs[key] for key in ('level_epoch', 'levels_completed', 'available_action_refs')}
    prefix = [{'command': op['input']['command'], 'first': op['input']['first'], 'second': op['input']['second'],
               'before': scope(op['input']['before']), 'after': scope(op['input']['after'])} for op in records[:-1]]
    return {'chainId': journal['id'], 'mode': mode, 'referenceCommit': COMMIT,
            'operations': len(journal['operations']), 'operationPopulation': dict(Counter(op['method'] for op in journal['operations'])),
            'actualReturns': len(records), 'selectedReturns': len(selected), 'passiveReturns': len(records) - len(selected),
            'sourceMemoryPuts': len(prior_puts), 'nativeMemoryPuts': len(actual_puts),
            'sourceStateRetention': CALLER_STATE_RETENTION, 'sourceStateRetentionChecks': len(retentions),
            'sourceStateRetentions': sum(row['retained'] for row in retentions), 'nativeRestoreOrders': restore_orders,
            'commonPrefixPublicReturns': len(prefix), 'commonPrefixPublicSha256': sha(canonical(prefix)),
            'nextOriginalAction': last['actions'][0] if last else None,
            'nextOriginalFrame': last['binding_plan']['offer']['target']['frame']['ref'] if last else None,
            'nextActualCommand': common['next']['command'], 'coldOriginal': True, 'nativeResultsUsedAsOracleInputs': False,
            'qualification': 'New recovery comparison of actual synthetic common public calls to an independently recomputed cold original family and AttentionMemory. Source proposals and the original conditional state/Memory.put/get/restore branch are computed locally without native state injection. Attention memory prefixes and deltas, complete tracker state and consumed mapping order are compared. Native checkpoint restoration is an additional extension: before/after values and final consumed order are checked, and intermediate input order is retained explicitly. No entire original StrategyRouter, live-game, cost, final freeze or publication result is implied.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('common_directory', type=Path)
    parser.add_argument('--fixture', type=Path)
    parser.add_argument('--export-receipt', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    directory = args.common_directory.resolve()
    require(directory.is_relative_to(ROOT / 'docs/migration/lot5c-evidence/recovery'), 'Use new recovery evidence only')
    fixture = (args.fixture or directory / 'original-replay.json.gz').resolve()
    exported = (args.export_receipt or directory / 'original-export.json').resolve()
    output = (args.output or directory / 'original-comparison.json').resolve()
    require(output.is_relative_to(ROOT) and not output.exists(), 'Choose a new exclusive comparison output')
    source_copy = output.with_name(output.stem + '-reviewer-source.py')
    require(not source_copy.exists(), 'Keep the previous reviewer source copy and choose a new output')
    output.parent.mkdir(parents=True, exist_ok=True)
    source_bytes = Path(__file__).read_bytes()
    with source_copy.open('xb') as stream:
        stream.write(source_bytes)
    review = Review(); original_source = review.fingerprint(Path(__file__)); preserved_source = review.fingerprint(source_copy)
    equal(original_source['sha256'], preserved_source['sha256'])
    details = {}
    try:
        details = compare(review, directory, fixture, exported)
    except Exception as error:
        review.checks.append({'name': 'comparison_prerequisites', 'passed': False,
                              'error': {'type': type(error).__name__, 'message': str(error)}})
    for record in list(review.inputs.values()):
        review.check('input_unchanged:' + record['path'], lambda record=record: equal(review.fingerprint(record['path']), record))
    failures = [row for row in review.checks if not row['passed']]
    result = {'schema': 'logos-engine.lot5c-common-original-comparison.v1', 'status': 'failed' if failures else 'passed',
              'recordedAt': datetime.now(timezone.utc).isoformat(), **details,
              'reviewer': original_source, 'preservedReviewerSource': preserved_source,
              'inputs': list(review.inputs.values()),
              'inputsUnchanged': not any(not row['passed'] and row['name'].startswith('input_unchanged:') for row in review.checks),
              'checks': {'total': len(review.checks), 'passed': len(review.checks) - len(failures), 'failed': len(failures), 'items': review.checks}}
    with output.open('x') as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2); stream.write('\n')
    print(json.dumps({'status': result['status'], 'checks': result['checks']['total'], 'failed': len(failures),
                      'operations': details.get('operations'), 'actualReturns': details.get('actualReturns'),
                      'output': output.relative_to(ROOT).as_posix(), 'failures': failures[:12]}, ensure_ascii=False))
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
