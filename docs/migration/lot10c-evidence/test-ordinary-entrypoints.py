#!/usr/bin/env python3
"""Short admission/structural checks for ordinary Lot10C entry points.

Only compilation, AST comparison and mocked main() admission are exercised.
No native test, game, replay, build, source freeze or coordination file is read.
"""
from __future__ import annotations

import ast
import builtins
from contextlib import ExitStack, redirect_stderr
import fcntl
import importlib.util
import io
import os
from pathlib import Path
import sys
import unittest
from unittest import mock

sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parent
ORDINARY_COORDINATION = {
    'mode': 'ordinary_unlocked',
    'globalLockAcquired': False,
    'timingClaim': False,
}
PAIRS = (
    ('run-release-checks.py', 'run-ordinary-release-checks.py'),
    ('run-regressions.py', 'run-ordinary-regressions.py'),
)


def load_module(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), BASE / name)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def blocked_path(value):
    if isinstance(value, int):
        return False
    try:
        value = os.fsdecode(os.fspath(value))
    except TypeError:
        return False
    return ('/workspace/shared/sra-coordination' in value
            or value.endswith('performance.lock')
            or value.endswith('-status.json'))


def guard_call(original):
    def guarded(path, *args, **kwargs):
        if blocked_path(path):
            raise AssertionError('Ordinary admission attempted coordination I/O: ' + str(path))
        return original(path, *args, **kwargs)
    return guarded


class CoordinationNormalization(ast.NodeTransformer):
    """Allow only the explicitly requested removal of global admission."""

    def visit_Expr(self, node):
        call = node.value
        if (isinstance(call, ast.Call) and isinstance(call.func, ast.Attribute)
                and isinstance(call.func.value, ast.Name)
                and call.func.value.id == 'batch_tools' and call.func.attr == 'require_released'):
            return None
        return self.generic_visit(node)

    def visit_Dict(self, node):
        node = self.generic_visit(node)
        for index, key in enumerate(node.keys):
            if isinstance(key, ast.Constant) and key.value == 'coordination':
                node.values[index] = ast.parse(repr(ORDINARY_COORDINATION), mode='eval').body
        return node


class OrdinaryEntryPointChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.release = load_module('run-ordinary-release-checks.py')
        cls.replays = load_module('run-ordinary-regressions.py')

    def admit(self, module, arguments, expected_error=None):
        with ExitStack() as stack:
            stack.enter_context(mock.patch.object(sys, 'argv', [module.__file__, *arguments]))
            worker = stack.enter_context(mock.patch.object(module, 'run'))
            flock = stack.enter_context(mock.patch.object(
                fcntl, 'flock', side_effect=AssertionError('Global flock is forbidden in ordinary admission')))
            for owner, name in ((builtins, 'open'), (io, 'open'), (os, 'open'),
                                (Path, 'open'), (Path, 'read_text'), (Path, 'read_bytes'),
                                (Path, 'stat'), (Path, 'exists'), (Path, 'is_file')):
                stack.enter_context(mock.patch.object(owner, name, guard_call(getattr(owner, name))))
            if expected_error is None:
                module.main()
                worker.assert_called_once()
                arguments = worker.call_args.args[0]
                self.assertFalse(hasattr(arguments, 'coordination_lock'))
                flock.assert_not_called()
                return arguments
            with redirect_stderr(io.StringIO()), self.assertRaises(expected_error):
                module.main()
            worker.assert_not_called()
            flock.assert_not_called()

    def test_sources_compile_without_coordination_dependency(self):
        for _, ordinary in PAIRS:
            with self.subTest(entrypoint=ordinary):
                source = (BASE / ordinary).read_text()
                compile(source, str(BASE / ordinary), 'exec')
                for forbidden in ('fcntl', 'flock', 'coordination_lock', 'coordination-lock',
                                  'require_released', 'quiet_requested', '/workspace/shared/sra-coordination'):
                    self.assertNotIn(forbidden, source)

    def test_unchanged_checks_replay_retention_and_supervision(self):
        for historical, ordinary in PAIRS:
            with self.subTest(entrypoint=ordinary):
                old = ast.parse((BASE / historical).read_text())
                new = ast.parse((BASE / ordinary).read_text())
                old_functions = {node.name: node for node in old.body if isinstance(node, ast.FunctionDef)}
                new_functions = {node.name: node for node in new.body if isinstance(node, ast.FunctionDef)}
                self.assertEqual(set(old_functions), set(new_functions))
                for name, original in old_functions.items():
                    if name == 'main':
                        continue
                    normalized = CoordinationNormalization().visit(original)
                    # The ordinary wrapper updates the supervisor's explanatory
                    # docstring to remove its obsolete shared-lock description.
                    # Compare executable statements; all implementation remains.
                    for function in (normalized, new_functions[name]):
                        if (function.body and isinstance(function.body[0], ast.Expr)
                                and isinstance(function.body[0].value, ast.Constant)
                                and isinstance(function.body[0].value.value, str)):
                            function.body = function.body[1:]
                    self.assertEqual(ast.dump(normalized), ast.dump(new_functions[name]), name)
                old_root = [node.value for node in old.body if isinstance(node, ast.Assign)
                            and any(isinstance(target, ast.Name) and target.id == 'ROOT' for target in node.targets)]
                new_root = [node.value for node in new.body if isinstance(node, ast.Assign)
                            and any(isinstance(target, ast.Name) and target.id == 'ROOT' for target in node.targets)]
                self.assertEqual([ast.dump(node) for node in old_root], [ast.dump(node) for node in new_root])

    def test_receipts_record_ordinary_unlocked_mode(self):
        for _, ordinary in PAIRS:
            tree = ast.parse((BASE / ordinary).read_text())
            records = []
            for node in ast.walk(tree):
                if isinstance(node, ast.Dict):
                    records.extend(ast.literal_eval(value) for key, value in zip(node.keys, node.values)
                                   if isinstance(key, ast.Constant) and key.value == 'coordination')
            self.assertEqual(records, [ORDINARY_COORDINATION])

    def test_regular_tests_admission(self):
        arguments = self.admit(self.release, ['ordinary-proof', '--tests'])
        self.assertTrue(arguments.tests)
        self.assertIsNone(arguments.batch_manifest)

    def test_extended_tests_admission(self):
        arguments = self.admit(self.release, ['ordinary-proof', '--tests', '--extra-tests', 'scope.json'])
        self.assertEqual(arguments.extra_tests, 'scope.json')

    def test_batch_admission_without_peer_state(self):
        arguments = self.admit(self.release, ['ordinary-proof', '--tests', '--batch-manifest',
            'partition.json', '--batch-index', '2', '--timeout-seconds', '300'])
        self.assertEqual(arguments.batch_index, 2)
        self.assertEqual(arguments.timeout_seconds, 300)

    def test_build_admission(self):
        arguments = self.admit(self.release, ['ordinary-proof', '--build-script', '/tmp/build-site.mjs'])
        self.assertEqual(arguments.build_script, Path('/tmp/build-site.mjs'))
        self.assertFalse(arguments.tests)

    def test_replay_admission(self):
        arguments = self.admit(self.replays, ['ordinary-proof', '--case-manifest', 'cases.json',
            '--timeout-seconds', '120', '--node-old-space-mib', '1024'])
        self.assertEqual(arguments.case_manifest, 'cases.json')
        self.assertEqual(arguments.node_old_space_mib, 1024)

    def test_removed_coordination_option_is_rejected(self):
        for module, args in ((self.release, ['ordinary-proof', '--tests']),
                             (self.replays, ['ordinary-proof'])):
            with self.subTest(entrypoint=module.__file__):
                self.admit(module, [*args, '--coordination-lock', '/tmp/unused-lock'], SystemExit)

    def test_original_invalid_mode_guards_remain(self):
        self.admit(self.release, ['ordinary-proof', '--tests', '--batch-manifest', 'partition.json',
                                 '--batch-index', '2', '--timeout-seconds', '301'], ValueError)
        self.admit(self.release, ['ordinary-proof', '--build-script', '/tmp/build-site.mjs',
                                 '--extra-tests', 'scope.json'], ValueError)
        self.admit(self.replays, ['ordinary-proof', '--timeout-seconds', '2401'], ValueError)

    def test_replay_case_contract_is_unchanged(self):
        old = ast.parse((BASE / 'run-regressions.py').read_text())
        expected = [ast.literal_eval(node.value) for node in old.body if isinstance(node, ast.Assign)
                    and any(isinstance(target, ast.Name) and target.id == 'EXPECTED_GAMES' for target in node.targets)]
        self.assertEqual(expected, [self.replays.EXPECTED_GAMES])
        self.assertEqual(len(self.replays.EXPECTED_GAMES), 10)
        self.assertEqual(self.replays.DRIVER, 'scripts/run-released-public-regressions-streamlog.py')


if __name__ == '__main__':
    unittest.main(verbosity=2)
