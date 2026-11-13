#!/usr/bin/env python3
"""Bounded synthetic regression checks for 10C proof admission and accounting.

No game/native harness is imported or invoked. Each test copies the three proof
helpers into a TemporaryDirectory, imports their definitions only, and redirects
ROOT/EVIDENCE/clock/contract/coordination paths to that isolated directory. The
JavaScript admission test executes only AST-extracted pre-harness statements,
with every non-node import removed and all references to their bindings refused.
The only actual child workload is a synthetic sleep killed by the real retention
controller. This suite does not establish any case result, cost or readiness.
"""
from __future__ import annotations

import contextlib
import copy
from decimal import Decimal
import gzip
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
REPOSITORY = HERE.parents[2]
HELPERS = ('run-clocked-proof.py', 'case-activity.py', 'run-ordered-recruitment-campaign.mjs')
HELPER_BYTES = {name: (HERE / name).read_bytes() for name in HELPERS}
OBSERVATIONS = []
DIGEST = '8' * 64
SYNTHETIC_GAME = 'ZZZZ'


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def put_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, sort_keys=True) + '\n', encoding='utf8')


def put_gzip(path, value):
    with gzip.open(path, 'wt', encoding='utf8') as stream:
        json.dump(value, stream)
        stream.write('\n')


class ProofControlTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='lot10c-proof-controls-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.evidence = self.root / 'docs/migration/lot10c-evidence'
        self.evidence.mkdir(parents=True)
        for name, data in HELPER_BYTES.items():
            (self.evidence / name).write_bytes(data)
        self.activity = load_module('synthetic_case_activity_' + self.id().split('.')[-1], self.evidence / 'case-activity.py')
        self.clock = self.activity.C
        self.clock.ROOT = self.root
        self.clock.EVIDENCE = self.evidence
        self.clock.CLOCK = self.evidence / 'case-clock.json'
        self.clock.CASE_CONTRACT = self.evidence / 'case-contract.json'
        self.clock.PERFORMANCE_LOCK = self.root / 'coordination/performance.lock'
        self.clock.CASE_LOCK = self.root / 'coordination/synthetic-case.lock'
        self.clock.GAME = SYNTHETIC_GAME
        self.clock.TARGET_LEVELS = 3
        self.activity.HERE = self.evidence
        self.activity.__file__ = str(self.evidence / 'case-activity.py')
        coordination = self.root / 'coordination'
        coordination.mkdir()
        def isolated_path(value):
            if str(value) == '/workspace/shared/sra-coordination':
                return coordination
            return Path(value)
        self.activity.Path = isolated_path
        admission = self.evidence / 'synthetic-admission-review.json'
        put_json(admission, {'game': SYNTHETIC_GAME, 'syntheticOnly': True,
                            'priorMatchingCaseEvidenceFound': False, 'caseSpecificExecutionStarted': False,
                            'searches': [{'scope': 'isolated synthetic TemporaryDirectory', 'matches': []}]})
        self.contract = {'schema': 'logos-engine.lot10c.case-contract.v1', 'game': SYNTHETIC_GAME,
                         'targetLevels': 3, 'syntheticOnly': True,
                         'admissionEvidence': self.clock.fingerprint(admission)}
        put_json(self.clock.CASE_CONTRACT, self.contract)

    def activity_call(self, *args):
        capture = io.StringIO()
        with patch.object(sys, 'argv', ['synthetic-case-activity.py', *args]), contextlib.redirect_stdout(capture):
            self.activity.main()
        return capture.getvalue()

    def initialize(self):
        self.activity_call('initialize')
        return self.clock.read_json(self.clock.CLOCK)

    def capture_fixture(self):
        out = self.evidence / 'capture'
        out.mkdir()
        packets = [
            {'command': None, 'packet': {'level': 1, 'levels_completed': 0, 'state': 'NOT_FINISHED', 'step_index': 0, 'frame_hash': 'synthetic-initial'}},
            {'command': {'action_ref': 'ACTION5'}, 'packet': {'level': 3, 'levels_completed': 3, 'state': 'WIN', 'step_index': 1, 'frame_hash': 'synthetic-final'}},
        ]
        report = {'schema': 'logos-engine.v6.integrated-game-campaign.v1', 'game': SYNTHETIC_GAME,
                  'targetLevels': 3, 'status': 'passed', 'source': {'digest': DIGEST},
                  'actions': [{'action_ref': 'ACTION5'}],
                  'final': {'actions': 1, 'level': 3, 'levelsCompleted': 3, 'state': 'WIN'}}
        trace = {'schema': 'logos-engine.native-public-game-trace.v1', 'game': SYNTHETIC_GAME,
                 'sourceDigest': DIGEST, 'status': 'passed', 'packets': packets}
        journal = out / 'recruitment-actual-public-journal.jsonl'
        journal.write_text(''.join(json.dumps(row) + '\n' for row in packets))
        put_gzip(out / 'recruitment-campaign.json.gz', report)
        put_gzip(out / 'recruitment-public-trace.json.gz', trace)
        return out, report, packets

    def test_optional_action_data_and_actual_final_matching(self):
        """A real ACTION5-shaped return may omit data; three final fields must agree."""
        out, report, packets = self.capture_fixture()
        accepted = self.clock.inspect_capture(out, DIGEST)
        self.assertTrue(accepted['finalCaptureComplete'])
        self.assertTrue(accepted['finalPublicFieldsMatch'])
        self.assertEqual(accepted['publicJournal']['observedActionReturns'], 1)
        self.assertEqual(accepted['publicJournal']['malformedCompleteRecords'], [])
        for key, false_value in [('levelsCompleted', 2), ('state', 'NOT_FINISHED'), ('level', 2)]:
            with self.subTest(final_field=key):
                changed = copy.deepcopy(report)
                changed['final'][key] = false_value
                put_gzip(out / 'recruitment-campaign.json.gz', changed)
                result = self.clock.inspect_capture(out, DIGEST)
                self.assertTrue(result['reportCountsMatchJournal'])
                self.assertFalse(result['finalPublicFieldsMatch'])
                self.assertFalse(result['finalCaptureComplete'])
        malformed = copy.deepcopy(packets)
        malformed[1]['command']['data'] = None
        path = out / 'malformed-shape.jsonl'
        path.write_text(''.join(json.dumps(row) + '\n' for row in malformed))
        result = self.clock.read_public_journal(path)
        self.assertEqual(result['observedActionReturns'], 0)
        self.assertEqual(len(result['malformedCompleteRecords']), 1)

    def test_checkpoint_cannot_be_promoted_to_terminal_result(self):
        """Even a checkpoint report labelled passed is still only a checkpoint."""
        out = self.evidence / 'partial-only'
        out.mkdir()
        put_json(out / 'recruitment-checkpoint.json', {
            'schema': 'logos-engine.lot10c.recruitment-campaign-checkpoint.v1', 'game': SYNTHETIC_GAME,
            'targetLevels': 3, 'sequence': 1, 'completeCampaign': False,
            'report': {'game': SYNTHETIC_GAME, 'targetLevels': 3, 'source': {'digest': DIGEST},
                       'status': 'passed', 'actions': [], 'prefixes': []}})
        capture = self.clock.inspect_capture(out, DIGEST)
        self.assertFalse(capture['finalCaptureComplete'])
        self.assertIsNone(capture['campaignStatus'])
        self.assertIsNone(capture['actualFinal'])
        self.assertIs(capture['lastCheckpoint']['completeCampaign'], False)

    def test_hard_retention_deadline_kills_and_reaps_sleeping_worker(self):
        """The actual controller kills an actual child; it keeps raw evidence partial."""
        out = self.evidence / 'sleeping-retention'
        out.mkdir()
        raw = out / 'recruitment-actual-public-journal.jsonl'
        raw_bytes = b'{"synthetic":"raw evidence before retention"}\n'
        raw.write_bytes(raw_bytes)
        entered = out / 'worker-entered.json'
        def sleeping_worker(directory, frozen):
            put_json(entered, {'pid': os.getpid(), 'syntheticSleepSeconds': 10})
            time.sleep(10)
            raise AssertionError('Synthetic worker should have been killed before returning')
        self.clock.retain_worker = sleeping_worker
        self.clock.RETENTION_RESERVE_SECONDS = 0.1
        self.clock.PROCESS_STARTED_NS = time.monotonic_ns()
        started = time.monotonic()
        result = self.clock.retain_with_deadline(out, None, None, 10.0, lambda: None, [])
        elapsed = time.monotonic() - started
        metadata = result['retention']
        self.assertTrue(entered.is_file(), 'The actual worker must have started before its deadline')
        self.assertEqual(self.clock.read_json(entered)['pid'], metadata['pid'])
        self.assertEqual(metadata['termination'], 'retention_deadline')
        self.assertEqual(metadata['exitCode'], -9)
        self.assertEqual(metadata['allowanceSeconds'], 0.1)
        self.assertLess(elapsed, 3.0, 'Parent must enforce the small allowance even under shared test load')
        self.assertEqual(raw.read_bytes(), raw_bytes)
        self.assertFalse(result['capture']['finalCaptureComplete'])
        self.assertIsNone(result['capture']['campaignStatus'])
        self.assertFalse((out / 'retention-result.json').exists())
        self.assertTrue(any(row['type'] == 'IncompleteBoundedRetention' for row in result['errors']))
        with self.assertRaises(ChildProcessError):
            os.waitpid(metadata['pid'], os.WNOHANG)
        OBSERVATIONS.append({'test': 'actual_sleeping_retention', 'allowanceSeconds': 0.1,
                             'elapsedSeconds': elapsed, 'exitCode': metadata['exitCode'],
                             'reaped': True, 'rawBytesPreserved': True, 'partialResult': True})

    def test_ledger_rejects_running_broken_prior_undercharge_and_changed_receipt(self):
        """A terminal debit is admissible; incomplete or rewritten accounting is not."""
        ledger = self.initialize()
        receipt_path = self.evidence / 'synthetic-terminal/execution.json'
        attempt_id = 'docs/migration/lot10c-evidence/synthetic-terminal'
        put_json(receipt_path, {'attemptId': attempt_id, 'elapsedSecondsThroughCapture': 0.2,
                                'game': SYNTHETIC_GAME, 'syntheticOnly': True})
        entry = {'attemptId': attempt_id, 'status': 'terminal', 'priorCumulativeSeconds': 0,
                 'chargedSeconds': 0.25, 'executionReceipt': self.clock.fingerprint(receipt_path)}
        ledger.update(attempts=[entry], cumulativeChargedSeconds=0.25, remainingSeconds=2399.75)
        self.assertEqual(self.clock.validate_clock(ledger), (Decimal('0.25'), Decimal('2399.75')))
        for mutation in ('running', 'bad_prior', 'undercharge'):
            with self.subTest(mutation=mutation):
                changed = copy.deepcopy(ledger)
                if mutation == 'running':
                    changed['attempts'][0]['status'] = 'running'
                elif mutation == 'bad_prior':
                    changed['attempts'][0]['priorCumulativeSeconds'] = 1
                else:
                    changed['attempts'][0]['chargedSeconds'] = 0.1
                    changed.update(cumulativeChargedSeconds=0.1, remainingSeconds=2399.9)
                with self.assertRaises(ValueError):
                    self.clock.validate_clock(changed)
        receipt_path.write_bytes(receipt_path.read_bytes() + b' ')
        with self.assertRaises(ValueError):
            self.clock.validate_clock(ledger)

    def test_changed_activity_helper_is_charged_then_blocks_new_admission(self):
        """Changed execution code cannot erase its debit or authorize another interval."""
        self.initialize()
        self.activity_call('start', '--id', 'synthetic-helper-change', '--purpose', 'synthetic control only', '--ceiling-seconds', '2')
        helper = self.evidence / 'run-clocked-proof.py'
        helper.write_bytes(helper.read_bytes() + b'\n# synthetic mutation after admission\n')
        self.activity_call('finish', '--id', 'synthetic-helper-change', '--status', 'completed')
        ledger = self.clock.read_json(self.clock.CLOCK)
        entry = ledger['attempts'][-1]
        receipt = self.clock.read_json(self.root / entry['executionReceipt']['path'])
        self.assertEqual(entry['status'], 'terminal')
        self.assertFalse(receipt['executionHelpersUnchanged'])
        self.assertGreaterEqual(entry['chargedSeconds'], receipt['elapsedSecondsThroughCapture'])
        self.assertGreater(entry['chargedSeconds'], 0)
        with self.assertRaises(ValueError, msg='A retained changed-helper receipt must block the next campaign admission'):
            self.clock.validate_clock(ledger)

    def test_actual_js_admission_rejects_missing_stale_and_nonrunning_parent(self):
        """Execute only real admission statements, with no harness import or call."""
        original = self.evidence / 'run-ordered-recruitment-campaign.mjs'
        prelude = self.evidence / 'admission-only.mjs'
        extract = r"""
const fs = require('node:fs');
const ts = require(process.argv[3]);
const source = fs.readFileSync(process.argv[1], 'utf8');
const file = ts.createSourceFile(process.argv[1], source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
if (file.parseDiagnostics.length) throw new Error('Original runner has syntax diagnostics');
const cutoff = file.statements.findIndex(s => ts.isFunctionDeclaration(s) && s.name?.text === 'syncDirectory');
if (cutoff < 0) throw new Error('No explicit admission boundary');
const nodes = file.statements.slice(0, cutoff), denied = new Set(), removed = [];
for (const statement of nodes) if (ts.isImportDeclaration(statement) && !statement.moduleSpecifier.text.startsWith('node:')) {
  removed.push(statement.moduleSpecifier.text);
  const clause = statement.importClause;
  if (clause?.name) denied.add(clause.name.text);
  const bindings = clause?.namedBindings;
  if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) denied.add(item.name.text);
  else if (bindings) denied.add(bindings.name.text);
}
if (JSON.stringify(removed.sort()) !== JSON.stringify(['../../../tests/helpers/v6-live-game-campaign.ts','./stream-evidence-json.mjs'].sort())) throw new Error('Unexpected non-node dependencies');
const retained = nodes.filter(s => !(ts.isImportDeclaration(s) && !s.moduleSpecifier.text.startsWith('node:')));
for (const statement of retained) {
  function inspect(node) {
    if (ts.isIdentifier(node) && denied.has(node.text)) throw new Error('Admission references an excluded harness binding');
    ts.forEachChild(node, inspect);
  }
  inspect(statement);
}
const text = retained.map(s => source.slice(s.getFullStart(), s.end)).join('\n');
fs.writeFileSync(process.argv[2], text + "\nprocess.stdout.write('SAFE_ADMISSION_ONLY\\n');\n", {flag:'wx'});
console.log(JSON.stringify({removedImports:removed, nativeHarnessImported:false, nativeHarnessCalled:false}));
"""
        extraction = subprocess.run(['node', '--max-old-space-size=256', '-e', extract, str(original), str(prelude),
                                     str(REPOSITORY / 'node_modules/typescript')], capture_output=True, text=True, timeout=8)
        self.assertEqual(extraction.returncode, 0, extraction.stdout + extraction.stderr)
        out = self.evidence / 'synthetic-attempt'
        out.mkdir()
        manifest_path = self.evidence / 'source-manifest.json'
        put_json(manifest_path, {'digest': DIGEST, 'syntheticOnly': True})
        attempt_id = out.relative_to(self.root).as_posix()
        manifest_name = manifest_path.relative_to(self.root).as_posix()
        contract_name = self.clock.CASE_CONTRACT.relative_to(self.root).as_posix()
        contract_hash = self.clock.fingerprint(self.clock.CASE_CONTRACT)['sha256']
        admission = {'schema': 'logos-engine.lot10c.recruitment-attempt-start.v1', 'wrapperPid': os.getpid(),
                     'attemptId': attempt_id, 'game': SYNTHETIC_GAME, 'targetLevels': 3, 'sourceManifestPath': manifest_name}
        preflight = {'schema': 'logos-engine.lot10c.recruitment-source-check.v1', 'matchesDeclaredFreeze': True,
                     'stage': 'before', 'sourceManifest': {'path': manifest_name}, 'nativeSource': {'digest': DIGEST},
                     'fileFingerprints': {contract_name: {'sha256': contract_hash}}}
        ledger = {'schema': self.clock.SCHEMA, 'game': SYNTHETIC_GAME,
                  'initialAccounting': {'caseContract': {'sha256': contract_hash}},
                  'attempts': [{'attemptId': attempt_id, 'status': 'running', 'sourceManifestPath': manifest_name}]}
        def run():
            return subprocess.run(['node', '--max-old-space-size=256', str(prelude), attempt_id],
                                  cwd=self.root, capture_output=True, text=True, timeout=5)
        missing = run()
        self.assertNotEqual(missing.returncode, 0)
        self.assertIn('Missing wrapper admission', missing.stderr)
        put_json(out / 'attempt-start.json', admission)
        put_json(out / 'preflight.json', preflight)
        put_json(self.clock.CLOCK, ledger)
        valid = run()
        self.assertEqual(valid.returncode, 0, valid.stderr)
        self.assertEqual(valid.stdout, 'SAFE_ADMISSION_ONLY\n')
        for mutation in ('stale_parent', 'terminal_entry', 'wrong_contract'):
            with self.subTest(mutation=mutation):
                a, c = copy.deepcopy(admission), copy.deepcopy(ledger)
                if mutation == 'stale_parent':
                    a['wrapperPid'] = -1
                elif mutation == 'terminal_entry':
                    c['attempts'][0]['status'] = 'terminal'
                else:
                    c['initialAccounting']['caseContract']['sha256'] = '0' * 64
                put_json(out / 'attempt-start.json', a)
                put_json(self.clock.CLOCK, c)
                rejected = run()
                self.assertNotEqual(rejected.returncode, 0)
                self.assertIn('No live parent admission', rejected.stderr)
        self.assertFalse((out / 'recruitment-child-start.json').exists())
        self.assertFalse((out / 'recruitment-actual-public-journal.jsonl').exists())
        OBSERVATIONS.append({'test': 'actual_js_admission_prefix', 'validControlPassed': True,
                             'rejected': ['missing_admission', 'stale_parent', 'terminal_entry', 'wrong_contract'],
                             'excludedNonNodeImports': 2, 'nativeHarnessImported': False, 'nativeHarnessCalled': False})


if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(ProofControlTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    unchanged = all((HERE / name).read_bytes() == data for name, data in HELPER_BYTES.items())
    summary = {'schema': 'logos-engine.lot10c.synthetic-proof-controls.v1',
               'status': 'passed' if result.wasSuccessful() and unchanged else 'failed',
               'testsRun': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors),
               'sourceInputsUnchanged': unchanged,
               'sourceSha256': {name: hashlib.sha256(data).hexdigest() for name, data in HELPER_BYTES.items()},
               'observations': OBSERVATIONS, 'realGames': 0, 'actualCaseLedgerReadOrWritten': False,
               'qualification': 'Synthetic proof-control regressions only, including one supervised sleeping process and an AST-isolated admission prefix. No case, gameplay, source parity, cost or release outcome is established.'}
    print('PROOF_CONTROLS_SUMMARY ' + json.dumps(summary, sort_keys=True), flush=True)
    raise SystemExit(0 if summary['status'] == 'passed' else 1)
