#!/usr/bin/env python3
"""Short simulated admission checks; no actual case ledger or runtime is used."""
from __future__ import annotations

import ast
from contextlib import ExitStack
from decimal import Decimal
import fcntl
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest import mock

sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parent


def load(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), BASE / name)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class RemoveCoordinationMetadata(ast.NodeTransformer):
    def visit_Dict(self, node):
        node = self.generic_visit(node)
        pairs = [(key, value) for key, value in zip(node.keys, node.values)
                 if not (isinstance(key, ast.Constant)
                         and key.value in ('performanceLockMode', 'performanceLock', 'coordination'))]
        node.keys = [key for key, _ in pairs]
        node.values = [value for _, value in pairs]
        return node


class OrdinaryCaseAndReviewChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.clock = load('run-ordinary-clocked-proof.py')
        cls.reviewer = load('review-ordinary-test-batches.py')

    def test_compilation_and_global_lock_absence(self):
        for name in ('run-ordinary-clocked-proof.py', 'review-ordinary-test-batches.py'):
            source = (BASE / name).read_text()
            compile(source, str(BASE / name), 'exec')
            for forbidden in ('PERFORMANCE_LOCK', 'performance.lock', 'exclusive_resources',
                              'quiet_requested', 'require_released', '--coordination-lock'):
                self.assertNotIn(forbidden, source)

    def test_case_lock_only_is_acquired_nonblocking(self):
        case = mock.Mock()
        stream = mock.MagicMock()
        stream.__enter__.return_value = stream
        stream.fileno.return_value = 4321
        case.open.return_value = stream
        with mock.patch.object(Path, 'open', side_effect=AssertionError('Real file I/O forbidden')):
            with mock.patch.object(fcntl, 'flock') as locked:
                with ExitStack() as stack:
                    self.clock.acquire_case_clock_lock(stack, case)
                locked.assert_called_once_with(4321, fcntl.LOCK_EX | fcntl.LOCK_NB)
        case.open.assert_called_once_with('a+b')
        stream.__exit__.assert_called_once()

    def test_case_contention_is_not_bypassed(self):
        case = mock.Mock()
        stream = mock.MagicMock()
        stream.__enter__.return_value = stream
        stream.fileno.return_value = 4321
        case.open.return_value = stream
        with mock.patch.object(fcntl, 'flock', side_effect=BlockingIOError('Synthetic occupied case')):
            with self.assertRaises(BlockingIOError), ExitStack() as stack:
                self.clock.acquire_case_clock_lock(stack, case)
        stream.__exit__.assert_called_once()

    def test_budget_helpers_are_ast_identical(self):
        original = ast.parse((BASE / 'run-clocked-proof.py').read_text())
        current = ast.parse((BASE / 'run-ordinary-clocked-proof.py').read_text())
        old = {n.name: n for n in original.body if isinstance(n, ast.FunctionDef)}
        new = {n.name: n for n in current.body if isinstance(n, ast.FunctionDef)}
        self.assertEqual(set(new) - set(old), {'acquire_case_clock_lock'})
        for name in old:
            if name != 'main':
                self.assertEqual(ast.dump(old[name]), ast.dump(new[name]), name)
        old_with = next(n for n in old['main'].body if isinstance(n, ast.With))
        new_with = next(n for n in new['main'].body if isinstance(n, ast.With))
        self.assertIsInstance(old_with.body[0], ast.Assign)
        self.assertIsInstance(old_with.body[1], ast.For)
        self.assertEqual(new_with.body[0].value.func.id, 'acquire_case_clock_lock')
        old_body = RemoveCoordinationMetadata().visit(ast.Module(body=old_with.body[2:], type_ignores=[]))
        new_body = RemoveCoordinationMetadata().visit(ast.Module(body=new_with.body[1:], type_ignores=[]))
        self.assertEqual(ast.dump(old_body), ast.dump(new_body), 'Budget, capture, retention and terminal charging changed')

    def test_synthetic_clock_keeps_reset_and_unresolved_attempt_guards(self):
        fingerprint = {'path': 'synthetic/contract.json', 'sha256': '0' * 64, 'bytes': 1}
        clock = {'schema': self.clock.SCHEMA, 'game': 'TEST', 'maximumCumulativeSeconds': 2400,
                 'clockReset': False, 'initialAccounting': {'newCase': True, 'chargedSeconds': 0,
                 'caseContract': fingerprint}, 'attempts': [], 'cumulativeChargedSeconds': 0,
                 'remainingSeconds': 2400}
        with mock.patch.object(self.clock, 'GAME', 'TEST'), \
             mock.patch.object(self.clock, 'inside', return_value=Path('/synthetic/contract.json')), \
             mock.patch.object(self.clock, 'fingerprint', return_value=fingerprint), \
             mock.patch.object(self.clock, 'write_json', side_effect=AssertionError('Ledger writes forbidden')), \
             mock.patch.object(Path, 'open', side_effect=AssertionError('Real file I/O forbidden')):
            self.assertEqual(self.clock.validate_clock(clock), (Decimal(0), Decimal(2400)))
            for change in ({'clockReset': True}, {'maximumCumulativeSeconds': 2401},
                           {'attempts': [{'status': 'running'}]}, {'cumulativeChargedSeconds': 1}):
                with self.subTest(change=change), self.assertRaises(ValueError):
                    self.clock.validate_clock({**clock, **change})

    def test_new_campaign_wrapper_must_be_frozen(self):
        original = load('run-clocked-proof.py')
        self.assertEqual(self.clock.REQUIRED_ARCHIVED_FILES - original.REQUIRED_ARCHIVED_FILES,
                         {'docs/migration/lot10c-evidence/run-ordinary-clocked-proof.py'})
        self.assertTrue(original.REQUIRED_ARCHIVED_FILES <= self.clock.REQUIRED_ARCHIVED_FILES)
        self.assertEqual(self.clock.MAXIMUM_SECONDS, original.MAXIMUM_SECONDS)
        self.assertEqual(self.clock.MAXIMUM_ATTEMPT_SECONDS, original.MAXIMUM_ATTEMPT_SECONDS)
        self.assertEqual(self.clock.RETENTION_RESERVE_SECONDS, original.RETENTION_RESERVE_SECONDS)

    def test_review_admission_without_coordination_or_real_review(self):
        args = ['review', 'frozen-proof', '--batch-manifest', 'partition.json', '--output', 'summary.json']
        with mock.patch.object(sys, 'argv', args), \
             mock.patch.object(self.reviewer, 'review') as review, \
             mock.patch.object(fcntl, 'flock', side_effect=AssertionError('Global flock forbidden')), \
             mock.patch.object(Path, 'open', side_effect=AssertionError('Real file I/O forbidden')):
            self.reviewer.main()
            review.assert_called_once()
            self.assertFalse(hasattr(review.call_args.args[0], 'coordination_lock'))

    def test_review_pure_comparisons_remain_identical(self):
        old = ast.parse((BASE / 'review-test-batches.py').read_text())
        new = ast.parse((BASE / 'review-ordinary-test-batches.py').read_text())
        current = {n.name: n for n in new.body if isinstance(n, ast.FunctionDef)}
        for node in old.body:
            if isinstance(node, ast.FunctionDef) and node.name not in ('main', 'require_released'):
                self.assertEqual(ast.dump(node), ast.dump(current[node.name]), node.name)


if __name__ == '__main__':
    unittest.main(verbosity=2)
