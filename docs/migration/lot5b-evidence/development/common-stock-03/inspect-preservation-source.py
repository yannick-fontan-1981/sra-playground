#!/usr/bin/env python3
"""Diagnose a retained failed common run using only immutable original agents.

The exact public observations, rows, proposals and obligations remain in the
hashed common-loop report. This component diagnostic does not replay the whole
router and cannot promote that failed run to passed.
"""
from __future__ import annotations

import copy
from datetime import datetime, timezone
import gzip
import hashlib
import importlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[5]
HERE = Path(__file__).resolve().parent
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
PROTO = SOURCE / 'agents/yf_arc3_v6/laya_proto'
REPORT = HERE / 'common-loop.json.gz'
JOURNAL = HERE / 'actual-operations.json'
OUTPUT = HERE / 'original-preservation-diagnostic.json'


def sha(value):
    return hashlib.sha256(value).hexdigest()


def plain(value):
    if isinstance(value, dict):
        return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (set, frozenset)):
        return [plain(v) for v in sorted(value)]
    if isinstance(value, (list, tuple)):
        return [plain(v) for v in value]
    return value


def digest(value):
    return sha(json.dumps(plain(value), sort_keys=True, separators=(',', ':')).encode())


def file_input(path):
    raw = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(raw), 'sha256': sha(raw)}


manifest_path = SOURCE.parent / 'manifest.json'
manifest = json.loads(manifest_path.read_bytes())['files']
strategy_path = SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm'
strategy = json.loads(strategy_path.read_bytes())
config = strategy['declarations'][0]['configuration']['window_constraints']['field_service_composition']
report = json.loads(gzip.decompress(REPORT.read_bytes()))
journal = json.loads(JOURNAL.read_bytes())
assert report['status'] == 'failed'
assert report['next']['reason'] == 'frontier_preservation_conflict'
record_calls = [(i, op['input']) for i, op in enumerate(journal['operations']) if op['method'] == 'record']
assert len(record_calls) == len(report['history']) == 16

sys.path[:0] = [str(SOURCE), str(PROTO)]
field_module = importlib.import_module('common_field_service')
preservation = importlib.import_module('common_preservation')
geometry = importlib.import_module('geometric_observer')
field = field_module.FieldServiceConstraint()

# The component's source memory receives the actual public transitions and the
# actual released proposal envelopes, in order. These envelopes are inputs to
# this diagnostic, never copied into an expected proposal.
replayed = []
for (ordinal, args), row in zip(record_calls, report['history']):
    proposal = copy.deepcopy(row['released']['snapshot']['proposal'])
    assert row['released']['command'] == args['command']
    emitted = field.memory.record(copy.deepcopy(args['before']), copy.deepcopy(args['command']),
        copy.deepcopy(args['after']), copy.deepcopy(args['first']), copy.deepcopy(args['second']),
        proposal, row['released']['snapshot']['prefix']['nextIndex'])
    replayed.append({'operation': ordinal, 'returned': row['returned'], 'kind': proposal.get('kind'),
                     'inputSha256': digest(args), 'proposalSha256': digest(proposal),
                     'sourceEventKinds': [e['kind'] for e in emitted], 'sourceEventsSha256': digest(emitted)})

calls = []
for ordinal in range(len(report['protectionCalls']) - 2, len(report['protectionCalls'])):
    captured = report['protectionCalls'][ordinal]
    args = copy.deepcopy(captured['input'])
    proposal, obligations, obs, rows = (args[k] for k in ('proposal', 'obligations', 'observation', 'rows'))
    original_result = plain(preservation.bind(proposal, obligations, obs, rows))
    assert original_result == captured['result']
    assert original_result[0] == proposal and original_result[1] == proposal['actions']
    measures = [preservation.condition_measure(o, rows, obs) for o in obligations]
    assert all(m['matched'] for m in measures)
    assert not any(preservation.authorized_revision(proposal, o, obs) for o in obligations)
    calls.append({'protectionCallIndex': ordinal, 'exactInputPointer': f'/protectionCalls/{ordinal}/input',
                  'exactInputSha256': digest(args), 'nativeResultSha256': digest(captured['result']),
                  'originalResultSha256': digest(original_result), 'originalEqualsNative': True,
                  'kind': proposal['kind'], 'fieldSubquestion': proposal['field_subquestion'],
                  'strategySelected': proposal['strategy_receipt']['selected'], 'actions': proposal['actions'],
                  'obligations': obligations, 'conditionMeasures': measures,
                  'preservationChangesPresent': 'preservation_changes' in proposal,
                  'rejected': original_result[1]})

last = report['protectionCalls'][-1]['input']
obs, rows = copy.deepcopy(last['observation']), copy.deepcopy(last['rows'])
# After filtering every obligation revision input, the real alternative list
# has no ACTION6; the observation's public availability remains unchanged.
# This call tests that empty-input case directly on the unmodified provider.
source_proposal = field.service_propose(obs, rows, [], 16, copy.deepcopy(config))
assert source_proposal is not None
native_projection = {k: v for k, v in last['proposal'].items()
                     if k not in ('strategy_receipt', 'morphology', 'field_subquestion')}
assert plain(source_proposal) == native_projection
source_protected, source_rejected = preservation.bind(source_proposal, last['obligations'], obs, rows)
assert source_rejected == last['proposal']['actions']
patterns = geometry.framed_patterns(rows, geometry.components(rows))
source_inputs = []
for module in list(sys.modules.values()):
    name = getattr(module, '__file__', None)
    if not name:
        continue
    path = Path(name).resolve()
    if path.is_relative_to(SOURCE):
        relative = path.relative_to(SOURCE).as_posix()
        assert relative.startswith('agents/') and path.suffix == '.py'
        assert sha(path.read_bytes()) == manifest[relative]['sha256'], relative
        source_inputs.append(file_input(path))
source_inputs = sorted({item['path']: item for item in source_inputs}.values(), key=lambda v: v['path'])
assert sha(strategy_path.read_bytes()) == manifest[str(strategy_path.relative_to(SOURCE))]['sha256']
receipt = {
    'schema': 'logos-engine.addressed-preservation-source-diagnostic.v1',
    'status': 'confirmed_source_provider_and_source_refusal',
    'createdAt': datetime.now(timezone.utc).isoformat(),
    'failedCommonRunStatusUnchanged': report['status'],
    'failedCommonRunReasonUnchanged': report['next']['reason'],
    'inputs': [file_input(REPORT), file_input(JOURNAL), file_input(manifest_path), file_input(strategy_path), file_input(Path(__file__))],
    'originalAgentInputs': source_inputs,
    'providerReplay': {
        'class': 'common_field_service.FieldServiceConstraint',
        'memoryClass': type(field.memory).__name__,
        'recordSource': 'Actual public transitions with their actual released proposal as input; no native implementation is executed.',
        'records': replayed,
        'sourceRetainedDigest': field.memory.retained_digest(),
        'nestedEvents': len(field.memory.nested_events),
        'fillContext': plain(field.memory.fill_context),
        'serviceContext': plain(field.memory.service_context),
        'transferModel': plain(field.memory.transfer_model),
        'transferContext': plain(field.memory.transfer_context),
        'currentNestedRefusal': plain(field.memory.nested_refusal(obs, rows)),
    },
    'providerQuestion': {
        'observationPointer': '/protectionCalls/16/input/observation',
        'rowsPointer': '/protectionCalls/16/input/rows',
        'configPointer': '/declarations/0/configuration/window_constraints/field_service_composition',
        'observationSha256': digest(obs), 'rowsSha256': digest(rows), 'configSha256': digest(config),
        'inputs': [], 'remaining': 16, 'availableActionRefs': obs['available_action_refs'],
        'originalResult': plain(source_proposal),
        'nativeProjectionOmittedKeys': ['strategy_receipt', 'morphology', 'field_subquestion'],
        'nativeProviderProjectionSha256': digest(native_projection),
        'originalResultSha256': digest(source_proposal), 'originalEqualsNativeProvider': True,
        'originalRejected': source_rejected,
    },
    'sourceMeasuredPatterns': plain(patterns),
    'protectionCalls': calls,
    'conclusion': {
        'reason': 'The earlier field-service provider selects the only remaining compact two-value square enclosure. It offers ACTION6 even with no candidate inputs because public action availability still contains ACTION6. No preservation_changes declares a revision of the acquired minimum palette-4 count, so original common_preservation.bind rejects both captured proposals.',
        'stockProposeAtFailedRevision': False,
        'productionSourceChanged': False,
        'obligationsOrPublicReturnsChanged': False,
        'claimScope': 'Original field-service component replay and exact-input original preservation comparison. This is not a full original StrategyRouter replay and does not promote the retained failed common run to passed.',
        'routingRule': 'common_frontier_runtime.choose_common filters candidate inputs only, selects again in source order, then sets preservation_conflict when the second proposal is also rejected.',
    },
}
with OUTPUT.open('x') as stream:
    json.dump(receipt, stream, indent=2, ensure_ascii=False)
    stream.write('\n')
print(json.dumps({'status': receipt['status'], 'output': str(OUTPUT.relative_to(ROOT)),
                  'protectionCallsCompared': len(calls), 'originalProviderEqualsNative': True,
                  'sourceEvents': len(field.memory.nested_events), 'sourceInputs': len(source_inputs)}))
