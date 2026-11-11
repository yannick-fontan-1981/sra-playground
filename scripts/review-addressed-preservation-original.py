#!/usr/bin/env python3
"""Compare a retained stock stop with immutable original provider/preservation.

Usage: review-addressed-preservation-original.py COMMON_DIR

Run only in the functional slot authorized by the coordinator. The tool writes
COMMON_DIR/original-preservation-comparison.json exclusively. It executes no
native implementation, game, host, cost capture or archive command. A failed
historical common run can produce a diagnostic confirmation, never a success.
This is a component replay, not a complete original StrategyRouter replay.
"""
from __future__ import annotations

import argparse
import copy
from datetime import datetime, timezone
import gzip
import hashlib
import importlib
import json
from pathlib import Path
import sys
import traceback

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
PROTO = SOURCE / 'agents/yf_arc3_v6/laya_proto'
MANIFEST = SOURCE.parent / 'manifest.json'
STRATEGY = SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm'
EXPECTED_SOURCE_FILES = 1786
DIGEST_ENCODING = 'python-json-sort-keys-compact-ensure-ascii'
COORDINATOR_KEYS = ('strategy_receipt', 'morphology', 'field_subquestion')
RELEASED_COORDINATOR_KEYS = (*COORDINATOR_KEYS, 'composition_target_tree')
OWN_STATE_FIELDS = ('nested_events', 'fill_events', 'fill_context', 'service_events',
                    'service_context', 'transfer_events', 'transfer_model', 'transfer_context')


def now():
    return datetime.now(timezone.utc).isoformat()


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def plain(value):
    if isinstance(value, dict):
        return {str(key): plain(child) for key, child in value.items()}
    if isinstance(value, (set, frozenset)):
        return [plain(child) for child in sorted(value)]
    if isinstance(value, (tuple, list)):
        return [plain(child) for child in value]
    return value


def digest(value):
    return sha(json.dumps(plain(value), sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode('utf-8'))


def rooted(path):
    resolved = (ROOT / path).resolve()
    if not resolved.is_relative_to(ROOT):
        raise ValueError('Evidence path must remain within this checkout: ' + str(path))
    return resolved


def fingerprint(path):
    path = rooted(path)
    raw = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(raw), 'sha256': sha(raw)}


def verify_source_inventory(manifest):
    if manifest.get('commit') != COMMIT or len(manifest.get('files', {})) != EXPECTED_SOURCE_FILES:
        raise AssertionError('Unexpected immutable original inventory')
    verified = {}
    for relative, expected in sorted(manifest['files'].items()):
        path = (SOURCE / relative).resolve()
        if not path.is_relative_to(SOURCE):
            raise AssertionError('Original manifest path escapes source: ' + relative)
        raw = path.read_bytes()
        if sha(raw) != expected['sha256'] or len(raw) != expected['bytes']:
            raise AssertionError('Immutable original differs from manifest: ' + relative)
        verified[relative] = expected['sha256']
    return verified


def provider_projection(proposal, *, released=False):
    """Remove only named caller decorations, never a provider property."""
    removed = RELEASED_COORDINATOR_KEYS if released else COORDINATOR_KEYS
    result = copy.deepcopy({key: value for key, value in proposal.items() if key not in removed})
    if released:
        for step in result['steps']:
            if 'point_binding' in step:
                if step['point_binding'] != step['point_support']:
                    raise AssertionError('Released service point binding differs from its current source support')
                del step['point_binding']
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('common_dir')
    args = parser.parse_args()
    directory = rooted(args.common_dir)
    output = directory / 'original-preservation-comparison.json'
    inputs, checks, failures = {}, [], []
    manifest = inventory_before = common = None
    result = {
        'schema': 'logos-engine.addressed-preservation-original-comparison.v1',
        'status': 'running', 'startedAt': now(), 'sourceCommit': COMMIT,
        'digestEncoding': DIGEST_ENCODING,
        'fullOriginalCallerClaimed': False, 'fullStockTraversalClaimed': False,
        'failedCommonRunPromoted': False, 'nativeResultsUsedAsOracleInputs': False,
        'sourceInventoryUnchanged': False, 'inputsUnchanged': False,
        'providerComparison': None, 'preservationComparisons': [],
    }

    def check(condition, name):
        row = {'name': name, 'passed': bool(condition)}
        checks.append(row)
        if not condition:
            raise AssertionError(name)

    def pin(path):
        value = fingerprint(path)
        previous = inputs.get(value['path'])
        if previous is not None and previous != value:
            raise AssertionError('Input changed during review: ' + value['path'])
        inputs[value['path']] = value
        return value

    def read(path):
        path = rooted(path)
        captured = pin(path)
        raw = path.read_bytes()
        check(sha(raw) == captured['sha256'], 'stable_read:' + captured['path'])
        return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)

    def imported_modules():
        values = {}
        for name, module in list(sys.modules.items()):
            filename = getattr(module, '__file__', None)
            if not filename:
                continue
            path = Path(filename).resolve()
            if not path.is_relative_to(SOURCE):
                continue
            relative = path.relative_to(SOURCE).as_posix()
            if not relative.startswith('agents/') or path.suffix != '.py':
                raise AssertionError('Imported original is not an agent Python source: ' + relative)
            value = pin(path)
            if manifest['files'].get(relative, {}).get('sha256') != value['sha256']:
                raise AssertionError('Imported original differs from inventory: ' + relative)
            values[name] = value
        return dict(sorted(values.items()))

    # Reserving the destination first ensures that no previous receipt can be
    # replaced, even if a later assertion fails. Failed reviews keep evidence.
    with output.open('x') as stream:
        try:
            pin(Path(__file__))
            report_path, journal_path = directory / 'common-loop.json.gz', directory / 'actual-operations.json'
            common, journal = read(report_path), read(journal_path)
            check(common.get('schema') == 'logos-engine.addressed-material-common-loop.v1', 'common_schema')
            check(journal.get('schema') == 'logos-engine.addressed-material-public-operations.v1', 'journal_schema')
            check(common.get('status') in ('failed', 'passed'), 'retained_common_status')
            check(common.get('next', {}).get('reason') == 'frontier_preservation_conflict', 'actual_preservation_stop')
            check(common.get('sourceUnchangedDuringRun') is True
                  and common.get('executionInputsUnchangedDuringRun') is True
                  and common.get('sourceDeclarationsModified') is False, 'common_input_integrity')
            check(journal.get('chainId') == common.get('chainId') and journal.get('mode') == common.get('mode'),
                  'journal_and_common_identity')
            result['nativeSourceDigest'] = common['nativeSource']['digest']
            result['common'] = {**pin(report_path), 'status': common['status'], 'mode': common['mode'],
                                'chainId': common['chainId'], 'reason': common['next']['reason'],
                                'publicPath': common.get('publicPath')}
            result['journal'] = pin(journal_path)
            driver = common['executedDriver']
            check(pin(driver['path']) == driver, 'actual_executed_driver_pin')
            result['executedDriver'] = driver
            result['proofContract'] = common.get('proofContract')
            if common['status'] == 'passed':
                check(common['mode'] == 'stock-preservation-refusal', 'passed_common_requires_declared_bounded_mode')
                contract = common['proofContract']
                check(contract['id'] == 'stock-preservation-refusal', 'bounded_contract_identity')
                plan = read(contract['plan']['path'])
                check(pin(contract['plan']['path']) == contract['plan'], 'bounded_contract_plan_pin')
                check(contract['plan'] in common['executionInputs'], 'plan_pinned_before_common_execution')
                check(plan.get('schema') == 'logos-engine.lot5b-common-proof-plan.v1', 'bounded_plan_schema')
                declared = [row for row in plan['finalContracts'] if row['id'] == contract['id']
                            and row['chainId'] == common['chainId']]
                check(len(declared) == 1 and declared[0].get('fullStockTraversalClaimed') is False,
                      'declared_contract_disclaims_full_stock_traversal')
                check(datetime.fromisoformat(plan['declaredAt']) <= datetime.fromisoformat(result['startedAt']),
                      'plan_precedes_original_review')
                path = common['publicPath']
                check(path['complete'] is False and path['preservationRefusal'] is True
                      and path['completedStages'] == common['sourceStages']
                      and path['declaredStages'] == len(common['publicTable'])
                      and path['completedStages'] < path['declaredStages'], 'bounded_public_path_exactly_recorded')
            else:
                result['diagnosticOnly'] = True

            manifest = read(MANIFEST)
            inventory_before = verify_source_inventory(manifest)
            result['sourceFilesVerifiedBefore'] = len(inventory_before)
            result['sourceInventorySha256Before'] = digest(inventory_before)
            check(len(inventory_before) == EXPECTED_SOURCE_FILES, 'complete_original_inventory_before_import')
            strategy = read(STRATEGY)
            strategy_input = pin(STRATEGY)
            check(strategy_input in common['executionInputs'], 'exact_original_configuration_bound_to_common')
            config = strategy['declarations'][0]['configuration']['window_constraints']['field_service_composition']
            result['configuration'] = {**strategy_input,
                'pointer': '/declarations/0/configuration/window_constraints/field_service_composition',
                'valueSha256': digest(config)}

            sys.path[:0] = [str(SOURCE), str(PROTO)]
            field_module = importlib.import_module('common_field_service')
            preservation = importlib.import_module('common_preservation')
            geometry = importlib.import_module('geometric_observer')
            domain_module = importlib.import_module('observed_input_domain')
            field, domain = field_module.FieldServiceConstraint(), domain_module.ObservedInputDomain(4096)
            initial = plain({key: getattr(field.memory, key) for key in OWN_STATE_FIELDS})
            check(all(value == [] or value is None for value in initial.values()), 'cold_original_service_memory')
            result['initialSourceState'] = initial

            records = [(index, copy.deepcopy(op['input'])) for index, op in enumerate(journal['operations'])
                       if op['method'] == 'record']
            history = common['history']
            check(len(records) == len(history) == common['returned'] and len(records) > 0,
                  'actual_return_population')
            check(len({row['before']['observation_ref'] for _, row in records}) == len(records), 'unique_actual_returns')
            replay, selected_service = [], 0
            for (ordinal, actual), released in zip(records, history):
                observed_proposal = released['released']['snapshot']['proposal']
                check(actual['command'] == released['released']['command'], f'record:{ordinal}:actual_command')
                index = released['released']['snapshot']['prefix']['nextIndex']
                own = observed_proposal.get('field_subquestion') == 'field_service_composition'
                # Only this provider's own proposal is reconstructed here.
                # Foreign released envelopes are actual record arguments of
                # the common caller, not expected values or initial memory.
                if own:
                    source_proposal = field.service_propose(copy.deepcopy(actual['before']), copy.deepcopy(actual['first']),
                        domain.candidates(copy.deepcopy(actual['before'])), 16, copy.deepcopy(config))
                    check(source_proposal is not None, f'record:{ordinal}:source_service_proposed')
                    projected = provider_projection(observed_proposal, released=True)
                    check(plain(source_proposal) == projected, f'record:{ordinal}:source_service_proposal_exact')
                    source_input_proposal = source_proposal
                    selected_service += 1
                else:
                    source_input_proposal = copy.deepcopy(observed_proposal)
                before_record_digest = digest(source_input_proposal)
                events = field.memory.record(copy.deepcopy(actual['before']), copy.deepcopy(actual['command']),
                    copy.deepcopy(actual['after']), copy.deepcopy(actual['first']), copy.deepcopy(actual['second']),
                    source_input_proposal, index)
                replay.append({'journalOperation': ordinal, 'returned': released['returned'],
                    'publicInputSha256': digest(actual), 'sourceSelectedService': own,
                    'proposalInputOrigin': 'original_recomputed' if own else 'actual_foreign_caller_argument',
                    'proposalInputSha256': before_record_digest, 'sourceEventKinds': [event['kind'] for event in events],
                    'sourceEventsSha256': digest(events)})
            result['sourceReplay'] = {'records': replay, 'originalOwnProposalRecomputed': True,
                'sourceRetainedDigest': field.memory.retained_digest(),
                'finalOwnState': plain({key: getattr(field.memory, key) for key in OWN_STATE_FIELDS}),
                'releasedProjectionOmittedTopLevelKeys': list(RELEASED_COORDINATOR_KEYS),
                'releasedProjectionOmittedStepKeys': ['point_binding'],
                'stepBindingCheckedEqualToPointSupport': True}

            protection_calls = common['protectionCalls']
            check(len(protection_calls) >= 2, 'two_actual_protection_calls_retained')
            tail_indices = list(range(len(protection_calls) - 2, len(protection_calls)))
            last_op = journal['operations'][-1]
            check(last_op['method'] == 'preservation_obligations', 'no_later_stock_offer_after_last_obligation')
            failed_ref = last_op['input']['observation']['observation_ref']
            check(not any(op['method'] == 'propose' and op['input'].get('observation', {}).get('observation_ref') == failed_ref
                          for op in journal['operations']), 'stock_not_queried_at_failed_revision')
            first_tail = protection_calls[tail_indices[0]]['input']
            for ordinal in tail_indices:
                actual = copy.deepcopy(protection_calls[ordinal]['input'])
                proposal, obligations, obs, rows = (actual[key] for key in ('proposal', 'obligations', 'observation', 'rows'))
                check(obs == first_tail['observation'] and rows == first_tail['rows']
                      and obligations == first_tail['obligations'], f'protect:{ordinal}:same_current_conditions')
                check(obs == last_op['input']['observation'] and rows == last_op['input']['rows'],
                      f'protect:{ordinal}:same_obligation_call_inputs')
                check(proposal.get('kind') == 'nested_control_experiment'
                      and proposal.get('field_subquestion') == 'field_service_composition'
                      and proposal['strategy_receipt']['selected'] == 'window_constraints'
                      and 'field_plan' not in proposal, f'protect:{ordinal}:earlier_source_provider')
                check('preservation_changes' not in proposal and bool(obligations), f'protect:{ordinal}:no_declared_revision')
                source_result = plain(preservation.bind(proposal, obligations, obs, rows))
                native_result = protection_calls[ordinal]['result']
                check(source_result == native_result, f'protect:{ordinal}:exact_original_result')
                check(source_result[0] == proposal and source_result[1] == proposal['actions']
                      and bool(source_result[1]), f'protect:{ordinal}:all_candidate_actions_rejected')
                measures = [preservation.condition_measure(obligation, rows, obs) for obligation in obligations]
                check(all(measure['matched'] for measure in measures), f'protect:{ordinal}:current_condition_still_matches')
                check(not any(preservation.authorized_revision(proposal, obligation, obs) for obligation in obligations),
                      f'protect:{ordinal}:no_source_authorized_revision')
                result['preservationComparisons'].append({'protectionCallIndex': ordinal,
                    'exactInputPointer': f'/protectionCalls/{ordinal}/input', 'exactInputSha256': digest(actual),
                    'digestEncoding': DIGEST_ENCODING, 'originalEqualsNative': True,
                    'originalResultSha256': digest(source_result), 'nativeResultSha256': digest(native_result),
                    'actions': proposal['actions'], 'obligations': obligations, 'conditionMeasures': measures,
                    'authorizedRevision': False, 'rejected': source_result[1]})

            last = protection_calls[-1]['input']
            obs, rows = copy.deepcopy(last['observation']), copy.deepcopy(last['rows'])
            inputs_before_filter = domain.candidates(copy.deepcopy(obs))
            revision_inputs = {action for obligation in last['obligations'] for action in obligation.get('revision_inputs', [])}
            alternatives = [command for command in inputs_before_filter if command['action_ref'] not in revision_inputs]
            # The actual original provider, with its replayed memory, computes
            # this candidate. No captured expected proposal or state supplies it.
            source_proposal = field.service_propose(obs, rows, alternatives, 16, copy.deepcopy(config))
            check(source_proposal is not None, 'original_provider_still_proposes_after_revision_input_filter')
            projected = provider_projection(last['proposal'])
            check(plain(source_proposal) == projected, 'original_provider_equals_actual_native_candidate')
            _, rejected = preservation.bind(source_proposal, last['obligations'], obs, rows)
            check(rejected == last['proposal']['actions'], 'independently_generated_original_candidate_is_rejected')
            result['providerComparison'] = {
                'observationPointer': f'/protectionCalls/{tail_indices[-1]}/input/observation',
                'rowsPointer': f'/protectionCalls/{tail_indices[-1]}/input/rows',
                'observationSha256': digest(obs), 'rowsSha256': digest(rows),
                'originalInputCandidatesSha256': digest(inputs_before_filter), 'filteredInputs': plain(alternatives),
                'revisionInputs': sorted(revision_inputs), 'remaining': 16,
                'availableActionRefs': obs['available_action_refs'],
                'nativeProjectionOmittedKeys': list(COORDINATOR_KEYS),
                'originalResult': plain(source_proposal), 'originalResultSha256': digest(source_proposal),
                'nativeProviderProjectionSha256': digest(projected), 'originalEqualsNativeProvider': True,
                'originalRejected': rejected, 'currentNestedRefusal': plain(field.memory.nested_refusal(obs, rows)),
            }
            result['sourceMeasuredPatterns'] = plain(geometry.framed_patterns(rows, geometry.components(rows)))
            stock_returns = sum(row['released']['snapshot']['proposal'].get('kind') == 'typed_field_stock' for row in history)
            check(stock_returns == common['stockReturns'] == sum(bool(row['stock']) for row in history),
                  'actual_stock_population_matches_released_history')
            result['populations'] = {
                'actualReturns': len(records), 'actualOwnerOperations': len(journal['operations']),
                'selectedServiceReturns': selected_service, 'passiveServiceReturns': len(records) - selected_service,
                'protectionCallsCompared': len(tail_indices), 'actualStockReturns': stock_returns,
                'originalNestedEvents': len(field.memory.nested_events),
            }
            check(common['stockReturns'] >= 2, 'selected_stock_prefix_precedes_refusal')
            result['reason'] = ('The earlier field-service provider independently offers the same current enclosure point. '
                'Its public action remains available after the candidate-input filter. No preservation revision is declared; '
                'the original binder rejects both exact captured candidates while the acquired count still matches.')
        except Exception as error:
            failures.append({'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc()})
        finally:
            if manifest is not None and inventory_before is not None:
                try:
                    inventory_after = verify_source_inventory(manifest)
                    result['sourceFilesVerifiedAfter'] = len(inventory_after)
                    result['sourceInventorySha256After'] = digest(inventory_after)
                    result['sourceInventoryUnchanged'] = inventory_after == inventory_before
                    check(result['sourceInventoryUnchanged'], 'complete_original_inventory_unchanged_after_replay')
                    result['importedOriginalModules'] = imported_modules()
                except Exception as error:
                    failures.append({'type': type(error).__name__, 'message': str(error), 'phase': 'original_integrity_after'})
            try:
                for expected in list(inputs.values()):
                    check(fingerprint(expected['path']) == expected, 'input_unchanged:' + expected['path'])
                result['inputsUnchanged'] = True
            except Exception as error:
                failures.append({'type': type(error).__name__, 'message': str(error), 'phase': 'input_integrity_after'})
            result['inputs'] = list(inputs.values())
            result['finishedAt'] = result['recordedAt'] = now()
            result['checks'] = {'total': len(checks), 'passed': sum(row['passed'] for row in checks),
                                'failed': sum(not row['passed'] for row in checks), 'items': checks}
            result['failures'] = failures
            result['status'] = ('failed' if failures else 'passed' if common and common['status'] == 'passed'
                                else 'diagnostic_confirmed')
            result['qualification'] = (
                'Original field-service memory starts cold and consumes actual public returns in recorded order. Its own '
                'historical questions and its final alternative candidate are independently recomputed. Foreign proposals '
                'are actual caller record arguments, not native expected results or injected state. Exact original '
                'preservation results are compared separately with two captured protect calls. This does not establish '
                'whole-original-caller selection parity, complete stock traversal, game success or latency performance. '
                'A retained failed common attempt remains failed regardless of this component diagnostic.')
            json.dump(result, stream, indent=2, ensure_ascii=False)
            stream.write('\n')
    print(json.dumps({'status': result['status'], 'output': str(output.relative_to(ROOT)),
                      'checks': result['checks']['total'], 'failures': len(failures),
                      'populations': result.get('populations')}))
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
