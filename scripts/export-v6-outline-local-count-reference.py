#!/usr/bin/env python3
"""Export exact original local-event counting, including Python name shadowing.

The real case is reconstructed from the first six retained public returns of
v53 attempt1. Controlled cases vary returned pixels only. No native result is
used to generate an expectation; no host or native agent is executed.
"""
from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('outline_original_contracts', ROOT / 'scripts/export-v6-outline-service-reference.py')
contracts = importlib.util.module_from_spec(spec); spec.loader.exec_module(contracts)
helper = contracts.helper
sys.path.insert(0, str(helper.SOURCE / 'agents/yf_arc3_v6/laya_proto'))
from neutral_observer import measure as observe


def load(path):
    path = Path(path)
    with (gzip.open(path, 'rt') if path.suffix == '.gz' else path.open()) as stream: return json.load(stream)


def proof(path):
    path = Path(path)
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size}


def plain(value): return contracts.plain(value)


def retained_actual_case(family):
    directory = ROOT / 'docs/migration/native-campaigns-v53/attempt1'
    report_path, trace_path = directory / 'esct-campaign.json.gz', directory / 'esct-public-trace.json.gz'
    report, trace = load(report_path), load(trace_path)
    assert report['status'] == 'failed' and report['final']['actions'] == 111 and report['final']['levelsCompleted'] == 0
    assert report['source']['digest'] == '86365f2c74590a14a98adf33adab0d016784ef0ca3b09577fa735613b140e8b7'
    actual_scope = report['prefixes'][0]['sharedSeries']['epochAnchors'][0]['observation_ref'].split(':epoch:')[0]
    observations = [observe(SimpleNamespace(**row['packet']), index + 1, actual_scope)[0] for index, row in enumerate(trace['packets'][:7])]
    family.restore({'epoch': None, 'control': None, 'tracks': {}, 'methods': [], 'attempts': {}, 'last': None, 'last_event': None})
    cursor = 0
    for prefix_index, prefix in enumerate(report['prefixes']):
        packet = trace['packets'][cursor]['packet']
        selected = family.propose(observations[cursor], packet['frame_rows'], [], report['budget']['levelActionCaps'][0] - cursor) if prefix['family'] == 'public_outline_service' else None
        if prefix['family'] == 'public_outline_service': assert selected is not None
        for index in range(prefix['acquiredActions']):
            before, after = observations[cursor:cursor + 2]
            first, second = [row['packet']['frame_rows'] for row in trace['packets'][cursor:cursor + 2]]
            command = selected['actions'][index] if selected else {'action_ref': trace['packets'][cursor + 1]['command']['action_ref']}
            assert trace['packets'][cursor + 1]['command'] == {'action_ref': command['action_ref'], 'data': {}}
            seed = plain(family.state())
            result = family.record(before, after, command, first, second, selected, index)
            cursor += 1
            if cursor == 6:
                assert command == {'action_ref': 'ACTION5'} and selected['outline_plan']['operator'] is True
                assert result['local_count'] == 4 and result['remote_change_count'] == 62
                return {'id': 'actual_esct_action_6_original_remote_62', 'operation': 'record', 'seedState': seed,
                        'arguments': {'before': before, 'after': after, 'command': command, 'first': first, 'second': second,
                                      'proposal': plain(selected), 'index': index}, 'value': plain(result), 'afterState': plain(family.state()),
                        'provenance': {'campaign': proof(report_path), 'trace': proof(trace_path), 'prefixIndex': prefix_index,
                                       'actualActionIndex': 6, 'freshOriginalReplayActions': 6,
                                       'firstPublicPacketSha256': report['actions'][4]['publicPacketSha256'],
                                       'secondPublicPacketSha256': report['actions'][5]['publicPacketSha256']},
                        'qualification': 'Original state and selected proposal are recomputed from the six actual public returns. This failed campaign completed no level.'}
    raise AssertionError('Missing retained sixth actual return')


def controlled_cases(family):
    acquisition = contracts.acquisition_example(family)
    seed = acquisition['acquiredState']
    first = acquisition['snapshots'][-1]['rows']
    before = acquisition['snapshots'][-1]['observation']
    proposal = acquisition['proposal']
    assert proposal['outline_plan']['measurement']['current']['bbox'] == [14, 2, 18, 6]
    variants = [
        ('unchanged', []),
        ('inside_new_pixel_below_row', [(15, 3, 0)]),
        ('inside_new_pixel_equals_row', [(15, 3, 3)]),
        ('inside_new_pixel_above_row', [(15, 3, 255)]),
        ('inside_lower_new_pixel_below_row', [(16, 5, 0)]),
        ('inside_lower_new_pixel_equals_row', [(16, 5, 5)]),
        ('bottom_rim_pixel_below_row', [(16, 6, 0)]),
        ('below_bbox_new_pixel_below_row', [(15, 8, 7)]),
        ('below_bbox_new_pixel_equals_row', [(15, 8, 8)]),
        ('below_bbox_new_pixel_above_row', [(15, 8, 255)]),
        ('above_bbox_always_remote', [(15, 0, 255)]),
        ('outside_horizontal_range_always_remote', [(1, 4, 255)]),
        ('last_row_new_pixel_equals_row', [(15, 23, 23)]),
        ('last_row_new_pixel_below_row', [(15, 23, 22)]),
        ('mixed_inside_and_outside', [(15, 3, 0), (16, 5, 5), (15, 8, 255), (1, 4, 255), (15, 0, 255)]),
    ]
    out = []
    for name, edits in variants:
        second = copy.deepcopy(first)
        for x, y, value in edits: second[y][x] = value
        after = contracts.obs(second, 4)
        family.restore(copy.deepcopy(seed))
        result = family.record(before, after, proposal['actions'][0], first, second, proposal, 0)
        out.append({'id': 'controlled:' + name, 'operation': 'record', 'seedState': plain(seed),
                    'arguments': {'before': plain(before), 'after': plain(after), 'command': plain(proposal['actions'][0]),
                                  'first': plain(first), 'second': second, 'proposal': plain(proposal), 'index': 0},
                    'value': plain(result), 'afterState': plain(family.state()), 'controlledEdits': edits,
                    'qualification': 'Controlled returned-raster contract. It is not a host return, learned game memory or game success.'})
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    output = ROOT / 'tests/fixtures/v6-outline-local-count-reference.json.gz'
    receipt_path = ROOT / 'docs/migration/native-campaigns-v53/source-reference-local-count.json'
    if not args.verify: assert not output.exists() and not receipt_path.exists(), 'Refusing to overwrite retained evidence'
    sys.setprofile(contracts.profile)
    try:
        family = helper.OutlineService()
        cases = [retained_actual_case(family), *controlled_cases(family)]
    finally: sys.setprofile(None)
    helper.AUDIT_ACTIVE = False
    assert not contracts.PENDING and helper.verify_source_manifest() == helper.VERIFIED_SOURCE
    fixture = {'schema': 'logos-engine.v53.outline-local-count-original-reference.v1', 'sourceCommit': helper.COMMIT,
               'sourceFilesVerifiedBeforeImport': 1786, 'sourceFilesVerifiedAfterExport': 1786, 'sourceUnchanged': True,
               'generator': proof(Path(__file__)), 'originalContractsGenerator': proof(ROOT / 'scripts/export-v6-outline-service-reference.py'),
               'cases': cases, 'caseCount': len(cases), 'footprint': helper.source_footprint(),
               'qualification': {'nativeExecuted': False, 'gameHostExecuted': False, 'nativeOutputsUsedAsExpected': False,
                                 'semantics': 'The unchanged Python generator expression binds b to each after-pixel before evaluating its vertical predicate. These source results are preserved literally, including remote counts that differ from an ordinary exterior-of-bbox count.'}}
    receipt = {'schema': 'logos-engine.v53.outline-local-count-original-reference-receipt.v1',
               'status': 'passed', 'sourceCommit': helper.COMMIT, 'sourceUnchanged': True, 'caseCount': len(cases),
               'actualCaseLocalCount': cases[0]['value']['local_count'], 'actualCaseRemoteChangeCount': cases[0]['value']['remote_change_count'],
               'generator': proof(Path(__file__)), 'scope': fixture['qualification']}
    if args.verify:
        assert load(output) == fixture
        receipt['fixture'] = proof(output)
        assert load(receipt_path) == receipt
    else:
        helper.write_gzip_absent(output.relative_to(ROOT).as_posix(), fixture)
        receipt['fixture'] = proof(output)
        with receipt_path.open('x') as stream: json.dump(receipt, stream, indent=2, sort_keys=True); stream.write('\n')
    print(json.dumps(receipt), flush=True)


if __name__ == '__main__': main()
