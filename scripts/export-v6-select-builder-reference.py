#!/usr/bin/env python3
"""Bounded independent original SELECT builder payloads and admission refusals.

Only synthetic clauses are used. The original operator builder and contracts
remain unchanged; durable request lineage is valid but omitted from payloads.
"""
from __future__ import annotations
import copy
import gzip
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('verified_original', ROOT / 'scripts/probe-v6-outline-service-original.py')
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)

from agents.yf_arc3_v5.logos.operational_reasoning import create_reasoning_context, bind_reasoning_operation
from agents.yf_arc3_v5.scheduler.operator_builders import _select

builder_path = 'agents/yf_arc3_v5/scheduler/operator_builders.py'
context = create_reasoning_context(run_ref='test.run', timeline_ref='test.timeline', owner_workflow_ref='test.owner',
    source_workflow_ref='test.source', source_hash=source.VERIFIED_SOURCE[builder_path], origin_frame_ref=None)
operation = bind_reasoning_operation(context, operation_ref='SELECT', statement_ref='test.select.start.s0000', frame_ref=None)
base_context = dict(operational_consciousness=operation, request_id='test.request', run_id='test.run',
    timeline_id='test.timeline', frame_id=None, expected_state_revision=0, source_unit='test.source',
    source_hash=source.VERIFIED_SOURCE[builder_path], workflow_definition_id='test.select',
    workflow_instance_id='test.select.instance', workflow_step_id='test.select.start')
base = {'FOR': 'question.current', 'FROM': ['a'], 'UNDER': 'test.policy', 'REQUIRE': ['requirement.current'],
        'PRESERVE': ['a'], 'DOMINANCE': [], 'FACTS': {}, 'CONTEXT': {}}
payload_fields = ['goal_ref', 'alternative_refs', 'selection_policy_ref', 'requirement_refs', 'preserve_refs',
                  'dominance_witnesses', 'alternative_facts', 'context_facts']
cases = []

def capture(name, changes=None, remove=()):
    clauses = {**copy.deepcopy(base), **copy.deepcopy(changes or {})}
    for key in remove:
        del clauses[key]
    row = {'name': name, 'clauses': clauses}
    try:
        built = _select(SimpleNamespace(**base_context, clauses=clauses))
        row['request'] = {key: source.plain(getattr(built, key)) for key in payload_fields}
        row['request']['schema_version'] = 'yf_arc3_v5.authority_input.selection.v1'
    except (ValueError, TypeError) as error:
        row['error'] = {'type': type(error).__name__, 'message': str(error)}
    cases.append(row)

capture('explicit_empty_optionals')
capture('omitted_optionals', remove=('DOMINANCE', 'FACTS', 'CONTEXT'))
capture('single_string_refs', {'FROM': 'a', 'REQUIRE': 'requirement.current', 'PRESERVE': 'a'})
capture('scalar_reference_spellings', {'FOR': None, 'UNDER': True, 'FROM': [True, False, None, 17],
                                    'REQUIRE': [False], 'PRESERVE': [None]})
capture('trimmed_refs', {'FOR': ' question.current ', 'UNDER': ' test.policy ', 'FROM': [' a '],
                        'REQUIRE': [' requirement.current '], 'PRESERVE': [' a ']})
for name in ('DOMINANCE', 'FACTS', 'CONTEXT'):
    capture('null_' + name, {name: None})
for name in ('FROM', 'REQUIRE', 'PRESERVE'):
    capture('empty_' + name, {name: []})
    capture('null_' + name, {name: None})
    capture('duplicate_' + name, {name: ['a', ' a ']})
capture('mapping_FROM', {'FROM': {'a': True}})
capture('mapping_DOMINANCE', {'DOMINANCE': {}})
capture('sequence_FACTS', {'FACTS': []})
capture('sequence_CONTEXT', {'CONTEXT': []})
capture('undeclared_fact', {'FACTS': {'other': {}}})
capture('scalar_alternative_fact', {'FACTS': {'a': 1}})
witness = {'left_ref': 'a', 'right_ref': 'b', 'criterion_ref': 'criterion.distance',
           'preferred_order': 'minimize', 'observed_order': 'less_than', 'evidence_refs': ['observation.current']}
capture('undeclared_witness', {'DOMINANCE': [witness]})
capture('valid_witness', {'FROM': ['a', 'b'], 'PRESERVE': ['a', 'b'], 'DOMINANCE': [witness]})

paths = [builder_path, 'agents/yf_arc3_v5/operators/contracts.py', 'agents/yf_arc3_v5/logos/types.py']
output = {'schema': 'logos-engine.v6.select-builder-reference.v1', 'referenceCommit': source.COMMIT,
    'sourceHashes': {path: source.VERIFIED_SOURCE[path] for path in paths},
    'scope': 'Unchanged original SELECT builder and payload contracts, synthetic clauses; exact scalar JSON domain. Durable operator lineage is not transferred.',
    'cases': cases}
target = ROOT / 'tests/fixtures/v6-select-builder-reference.json.gz'
target.write_bytes(gzip.compress(json.dumps(output, ensure_ascii=True, separators=(',', ':')).encode(), mtime=0))
print(json.dumps({'cases': len(cases), 'bytes': target.stat().st_size, 'path': str(target.relative_to(ROOT))}))
