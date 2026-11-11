#!/usr/bin/env python3
"""Original-source diagnostic of the first Window abstention in a partial checkpoint.

No game or native caller is executed. This is not a terminal campaign receipt.
"""
from __future__ import annotations
import argparse
from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone
import fcntl
import importlib.util
from itertools import product
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('window_comparison', ROOT / 'scripts/compare-window-question-public-parity.py')
parity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parity)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkpoint', required=True, type=Path)
    parser.add_argument('--level', type=int, default=4)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    checkpoint_path, output = args.checkpoint.resolve(), args.output.resolve()
    parity.require(not output.exists() and output.is_relative_to(ROOT), 'A new repository evidence output is required')
    report = {'schema': 'logos-engine.window-question-partial-abstention-diagnostic.v1',
        'recordedAt': datetime.now(timezone.utc).isoformat(), 'completeCampaign': False,
        'campaignSuccessEstablished': False, 'newGameRun': False, 'nativeCallerRun': False,
        'qualification': 'Original Python component diagnostic over an actual stable incomplete checkpoint. No terminal report, unsealed acquisition, game solution, full-caller parity or failure cause is inferred.',
        'generator': parity.fingerprint(Path(__file__).resolve()), 'inputs': {'checkpoint': parity.fingerprint(checkpoint_path)},
        'clockQualification': 'Original projection monotonic is fixed externally at zero for finite-work analysis; this does not measure or reconstruct native elapsed time.'}
    with Path('/workspace/shared/sra-coordination/performance.lock').open('a') as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_SH | fcntl.LOCK_NB)
        with tempfile.TemporaryDirectory(prefix='window-partial-diagnostic-') as cache:
            sys.pycache_prefix = cache
            report['sourceBefore'] = parity.verify_originals()
            try:
                envelope = parity.read_json(checkpoint_path)
                parity.require(envelope.get('schema') == 'logos-engine.lot10b.hpdl-campaign-checkpoint.v1'
                    and envelope.get('completeCampaign') is False, 'An actual partial checkpoint is required')
                campaign = envelope['report']
                parity.require(campaign.get('status') == 'running' and 'final' not in campaign,
                               'This diagnostic must not promote a partial checkpoint')
                report.update(checkpointSequence=envelope['sequence'], checkpointRecordedAt=envelope['recordedAt'],
                    capturedCampaignStatus=campaign['status'], capturedActions=len(campaign['actions']),
                    capturedPrefixes=len(campaign['prefixes']), nativeDigest=campaign['source']['digest'])
                sys.path[:0] = [str(parity.SOURCE), str(parity.SOURCE / 'agents/yf_arc3_v6/laya_proto')]
                from agents.yf_arc3_v6.morphology_policy.window_question.family import WindowQuestion
                from agents.yf_arc3_v6.morphology_policy.window_question import geometry
                from agents.yf_arc3_v5.capabilities import mechanical_family_contracts_d as mechanical
                calls = campaign['windowSourceCalls']
                first = next(row for row in calls if row['method'] == 'propose' and row['arguments'][0]['level_epoch'] == args.level)
                owner, own_proposals = WindowQuestion(), {}
                replay_differences = []
                with patch.object(mechanical, 'monotonic', lambda: 0):
                    for row in calls[:first['index']]:
                        values = deepcopy(row['arguments'])
                        replay_differences.extend(parity.differences(owner.state(), row['sourceBefore'], f"calls[{row['index']}].sourceBefore"))
                        if row['method'] == 'before':
                            values[0] = own_proposals[values[0]['binding']['observation_ref']]
                            values[2] = SimpleNamespace(**values[2])
                        elif row['method'] == 'recordSource' and values[5] is not None:
                            values[5] = own_proposals[values[5]['binding']['observation_ref']]
                        value = getattr(owner, 'record' if row['method'] == 'recordSource' else row['method'])(*values)
                        replay_differences.extend(parity.differences(value, row['result'], f"calls[{row['index']}].result"))
                        replay_differences.extend(parity.differences(owner.state(), row['sourceAfter'], f"calls[{row['index']}].sourceAfter"))
                        if row['method'] == 'propose' and value is not None:
                            own_proposals[values[0]['observation_ref']] = value
                        if row['method'] == 'recordSource' and parity.publishable(owner.state()):
                            owner.restore(owner.state())
                    report['coldSourcePrefix'] = {'callsReplayed': first['index'], 'nativeStateInjected': False,
                        'nativePlanInjected': False, 'differences': replay_differences,
                        'sourceAtFirstQueryMatches': not parity.differences(owner.state(), first['sourceBefore'])}
                    parity.require(not replay_differences and report['coldSourcePrefix']['sourceAtFirstQueryMatches'],
                                   'The cold original did not reach the captured owner state')
                    obs, rows, inputs, remaining = deepcopy(first['arguments'])
                    measurement = geometry.measure(rows)
                    report['firstQuery'] = {'callIndex': first['index'], 'observationRef': obs['observation_ref'],
                        'remaining': remaining, 'availableActions': obs['available_action_refs'], 'capturedResult': first['result'],
                        'capturedNativeAdaptation': first.get('nativeAdaptation'), 'measurement': parity.plain(measurement),
                        'sourceStateBefore': owner.state(), 'model': owner.policy.config['model']}
                    methods = [] if measurement is None else [entry for entry in owner.edits
                        if entry['signature'] == measurement['signature']] + [entry for item in owner.portable
                        for entry in item['methods'] if entry['signature'] == measurement['signature']]
                    plans, bound = ([], None) if measurement is None else geometry.plans(measurement, owner.policy.config['model'])
                    offers, _ = owner.offers(obs, rows, remaining)
                    result = owner.propose(obs, rows, inputs, remaining)
                    report['firstQuery'].update(matchingMethods=len(methods), matchingEvidence=[entry['evidence'] for entry in methods],
                        sourcePlanCount=len(plans), sourceBound=bound, sourceOfferCount=len(offers),
                        sourceResult=parity.plain(result), resultDifferences=parity.differences(result, first['result']))
                    if measurement is not None and bound and not bound['truncated'] and not plans:
                        domains = [list(product(box['capacity_domain'], box['filter_domain'] or [None],
                            box['second_field']['domain'] if box['second_field'] else [None])) for box in measurement['boxes']]
                        counts, best, best_count = Counter(), [], -1
                        for settings in product(*domains):
                            okay, receipts = geometry.coverage(measurement, settings, owner.policy.config['model'])
                            captured = sorted({rank for row in receipts if row['operation_hypothesis'] == 'CAPTURE' for rank in row['ranks']})
                            counts[str(len(captured))] += 1
                            if len(captured) > best_count:
                                best_count, best = len(captured), []
                            if len(captured) == best_count and len(best) < 3:
                                best.append({'settings': settings, 'sourceCoverageComplete': okay, 'capturedRanks': captured,
                                    'uncapturedRanks': [i for i in range(len(measurement['colors'])) if i not in captured], 'receipts': receipts})
                        report['completeSourceCoverageEnumeration'] = {'domain': bound['domain'], 'examined': sum(counts.values()),
                            'capturedRankCountDistribution': dict(counts), 'maximumCapturedRanks': best_count,
                            'wordRanks': len(measurement['colors']), 'bestExamples': parity.plain(best)}
                    foreign = []
                    for row in calls:
                        values = row.get('arguments', [])
                        if row['method'] != 'recordSource' or values[0]['level_epoch'] != args.level or values[5] is not None:
                            continue
                        original = WindowQuestion()  # Isolated record semantics, not a campaign owner restore.
                        value = original.record(*deepcopy(values))
                        before_m, after_m = geometry.measure(values[3]), geometry.measure(values[4])
                        foreign.append({'callIndex': row['index'], 'beforeRef': values[0]['observation_ref'],
                            'afterRef': values[1]['observation_ref'], 'command': values[2],
                            'beforeSignature': None if before_m is None else before_m['signature'],
                            'afterSignature': None if after_m is None else after_m['signature'],
                            'sourceResult': value, 'differences': parity.differences(value, row['result']),
                            'capturedEditCountBefore': len(row['sourceBefore']['edits']),
                            'capturedEditCountAfter': len(row['sourceAfter']['edits'])})
                    report['isolatedForeignRecordChecks'] = foreign
                report['diagnosticStatus'] = 'compared' if not report['firstQuery']['resultDifferences'] \
                    and all(not row['differences'] for row in foreign) else 'mismatch'
            except Exception as error:
                report['diagnosticStatus'] = 'error'
                report['error'] = parity.error_value(error)
            report['sourceAfter'] = parity.verify_originals()
            report['originalsUnchanged'] = report['sourceBefore'] == report['sourceAfter']
            report['checkpointUnchanged'] = report['inputs']['checkpoint'] == parity.fingerprint(checkpoint_path)
            report['bytecodeIsolation'] = {'dontWriteBytecode': True, 'freshPrefixEmptyAfter': not any(Path(cache).rglob('*'))}
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open('xb') as stream:
            stream.write(parity.encoded(report) + b'\n')
    query = report.get('firstQuery', {})
    print(json.dumps({'path': parity.path_label(output), 'diagnosticStatus': report['diagnosticStatus'],
        'checkpointSequence': report.get('checkpointSequence'), 'error': report.get('error'),
        'callIndex': query.get('callIndex'), 'measurementSignature': (query.get('measurement') or {}).get('signature'),
        'wordColors': (query.get('measurement') or {}).get('colors'), 'matchingMethods': query.get('matchingMethods'),
        'planCount': query.get('sourcePlanCount'), 'offerCount': query.get('sourceOfferCount'), 'bound': query.get('sourceBound'),
        'sourceResult': query.get('sourceResult'), 'foreignRecords': len(report.get('isolatedForeignRecordChecks', [])),
        'foreignEvents': [row for row in report.get('isolatedForeignRecordChecks', []) if (row['sourceResult'] or {}).get('events')],
        'coverageSummary': {key: value for key, value in report.get('completeSourceCoverageEnumeration', {}).items() if key != 'bestExamples'}}, ensure_ascii=False))
    return 0 if report['diagnosticStatus'] == 'compared' and report['originalsUnchanged'] and report['checkpointUnchanged'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
