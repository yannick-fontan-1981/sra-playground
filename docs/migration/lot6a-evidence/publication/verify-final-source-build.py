#!/usr/bin/env python3
"""Read-only final 6A source/build verification after all declared source pushes.

All checkout locations and future transport identities are supplied by CLI and
fingerprinted real receipts. The number of source pushes comes from the pinned
plan; native/archive/application populations come from their retained manifests.
Invoke through the shared performance lock only after every planned helper has
completed, with --go-after-source-pushes. See verify-final-source-build-usage.md.

Only a new JSON receipt in the exterior artifact directory is written. No
archive is extracted, ignored input restored, Git mutation, network operation,
build, test, timing campaign, game, source push or Site deployment is performed.
A passed integrity receipt does not turn a rejected cost verdict into acceptance.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys
import tarfile

sys.dont_write_bytecode = True
DEFAULT_FINAL = 'docs/migration/lot6a-evidence/integrated-final-02'
DEFAULT_PERFORMANCE = 'docs/migration/lot6a-evidence/performance-integrated'
EVIDENCE = 'docs/migration/lot6a-evidence/'
BUILD_EXTRAS = ('package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'index.html',
    '.openai/hosting.json', 'scripts/prepare-python.mjs', 'scripts/python-runtime-assets.json',
    'scripts/generate-content-pages.mjs', 'scripts/generate-game-gallery.mjs')


def stamp():
    return datetime.now(timezone.utc).isoformat()


def require(value, message):
    if not value:
        raise ValueError(message)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'Duplicate JSON key: ' + key)
        result[key] = value
    return result


def invalid_constant(value):
    raise ValueError('Non-finite JSON constant: ' + value)


def decode(raw):
    return json.loads(raw, object_pairs_hook=unique_object, parse_constant=invalid_constant)


def instant(value):
    require(isinstance(value, str), 'Missing timestamp')
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(parsed.tzinfo is not None, 'Naive timestamp')
    return parsed


def fingerprint(path):
    require(path.is_file() and not path.is_symlink(), 'Missing regular input: ' + str(path))
    digest, size = hashlib.sha256(), 0
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
            size += len(block)
    return {'path': str(path), 'bytes': size, 'sha256': digest.hexdigest()}


def gzip_original(path, expected_bytes):
    require(type(expected_bytes) is int and expected_bytes >= 0, 'Invalid expected raw log size')
    require(path.is_file() and not path.is_symlink() and path.name.endswith('.gz'),
            'Expected a regular gzip proof transport: ' + str(path))
    digest, size = hashlib.sha256(), 0
    with gzip.open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            size += len(block)
            require(size <= expected_bytes, 'Gzip proof exceeds its bound original size')
            digest.update(block)
    return {'bytes': size, 'sha256': digest.hexdigest()}


def confined(base, name):
    require(isinstance(name, str) and name and '\\' not in name and all(ord(c) >= 32 for c in name),
            'Invalid input pathname')
    relative = PurePosixPath(name)
    require(not relative.is_absolute() and '..' not in relative.parts and str(relative) == name,
            'Noncanonical relative input path: ' + name)
    current = base
    require(not current.is_symlink(), 'Symlink checkout root')
    for part in relative.parts:
        current /= part
        require(not current.is_symlink(), 'Symlink input: ' + str(current))
    return current


def members(base, folders):
    found = set()
    for name in folders:
        directory = confined(base, name)
        require(directory.is_dir(), 'Missing input directory: ' + str(directory))
        for folder, dirs, files in os.walk(directory, followlinks=False):
            for child in dirs + files:
                path = Path(folder) / child
                require(not path.is_symlink(), 'Symlink in frozen inventory: ' + str(path))
            for child in files:
                path = Path(folder) / child
                require(path.is_file(), 'Non-regular frozen input: ' + str(path))
                found.add(path.relative_to(base).as_posix())
    return found


class Verification:
    def __init__(self, result, args):
        self.result = result
        self.args = args
        self.retained = {}
        self.git_environment = os.environ.copy()
        self.git_environment.update(GIT_OPTIONAL_LOCKS='0', GIT_TERMINAL_PROMPT='0',
            GIT_NO_LAZY_FETCH='1', GIT_NO_REPLACE_OBJECTS='1')
        require(not any(os.environ.get(key) for key in ('GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE',
            'GIT_COMMON_DIR', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_SHALLOW_FILE')),
            'Git location overrides are not accepted')

    def keep(self, path):
        path = Path(path)
        record = fingerprint(path)
        require(self.retained.setdefault(path, record) == record, 'Input changed during verification: ' + str(path))
        return record

    def read(self, path, expected_sha=None):
        record = self.keep(path)
        require(expected_sha is None or record['sha256'] == expected_sha, 'Pinned receipt changed: ' + str(path))
        return decode(Path(path).read_bytes())

    def git(self, checkout, *args, data=None):
        command = ['git', '-c', 'core.fsmonitor=false', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false', *args]
        completed = subprocess.run(command, cwd=checkout, env=self.git_environment, input=data,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
        require(completed.returncode == 0, 'Read-only Git query failed: ' + ' '.join(args) + ': '
                + completed.stderr.decode('utf-8', 'replace')[:2000])
        return completed.stdout

    def snapshot(self, checkout):
        text = lambda *args: self.git(checkout, *args).decode().strip()
        status = self.git(checkout, 'status', '--porcelain=v1', '-z', '--untracked-files=all')
        return {'head': text('rev-parse', '--verify', 'HEAD'), 'tree': text('rev-parse', 'HEAD^{tree}'),
            'parents': text('rev-list', '--parents', '-n', '1', 'HEAD').split()[1:],
            'statusBytes': len(status), 'statusSha256': hashlib.sha256(status).hexdigest()}

    def proof_logs(self, bound, preparation):
        """Recheck each raw/gzip pair without restoring any destination byte."""
        args = self.args
        root, pub, out = args.validated_checkout, args.publication_worktree, args.artifact_directory
        expected = sorted(name for name in bound if name.endswith('.log'))
        records = preparation.get('ignoredProofLogTransports')
        require(isinstance(records, list) and all(isinstance(row, dict) and isinstance(row.get('original'), dict) for row in records)
                and [row['original'].get('path') for row in records] == expected
                and type(preparation.get('expectedIgnoredProofLogs')) is int
                and preparation['expectedIgnoredProofLogs'] == len(expected)
                and preparation.get('allIgnoredProofLogsByteIdentical') is True,
                'Preparation must retain every exact required raw proof log and its proven gzip')
        window_transport = self.read(confined(root, args.performance_directory + '/log-transport.json'))
        require(window_transport.get('schema') == 'logos-engine.lossless-log-transport.v1'
                and window_transport.get('mode') == 'cost-window' and window_transport.get('status') == 'passed'
                and window_transport.get('window') == bound.get(args.performance_directory + '/window.json')
                and isinstance(window_transport.get('logs'), list)
                and [row.get('series') for row in window_transport['logs']] == ['A1', 'B1', 'B2', 'A2'],
                'Completed window log transport changed')
        window_logs = {}
        for row in window_transport['logs']:
            original, compressed = row.get('original'), row.get('transport')
            require(isinstance(original, dict) and isinstance(compressed, dict)
                    and original.get('path') in expected and row.get('byteIdentical') is True
                    and original == bound[original['path']] and compressed.get('path') in bound
                    and compressed == bound[compressed['path']] and original['path'] not in window_logs,
                    'Window transport is not bound to its original raw/gzip fingerprints')
            window_logs[original['path']] = compressed
        restored = preparation.get('restoredIgnoredProofLogs')
        planned = preparation.get('plannedIgnoredProofLogRestorations')
        require(isinstance(restored, list) and isinstance(planned, list) and restored == planned
                and len(restored) == len(set(restored)) and set(restored) <= set(expected)
                and type(preparation.get('ignoredProofLogsRestored')) is int
                and preparation['ignoredProofLogsRestored'] == len(restored),
                'Actual raw proof restorations differ from the checked missing-only plan')
        for row in records:
            original = row['original']; name = original['path']
            require(name.startswith(EVIDENCE) and original == bound[name]
                    and set(original) == {'path', 'bytes', 'sha256'} and type(original['bytes']) is int
                    and original['bytes'] >= 0 and row.get('byteIdentical') is True
                    and type(row.get('destinationExisted')) is bool and type(row.get('restorationRequired')) is bool
                    and row['restorationRequired'] is (not row['destinationExisted'])
                    and (name in restored) == row['restorationRequired'],
                    'Raw proof restoration identity or absence claim changed')
            transport = row.get('transport')
            require(isinstance(transport, dict) and set(transport) == {'path', 'bytes', 'sha256'}
                    and isinstance(transport['path'], str), 'Missing exact gzip transport fingerprint')
            compressed = Path(transport['path'])
            require(compressed.is_absolute() and compressed == compressed.resolve()
                    and (compressed.is_relative_to(root) or compressed.is_relative_to(out)),
                    'Gzip transport must retain its actual canonical validated/artifact path')
            if compressed.is_relative_to(root):
                confined(root, compressed.relative_to(root).as_posix())
            else:
                confined(out, compressed.relative_to(out).as_posix())
            require(self.keep(compressed) == transport, 'Retained gzip bytes changed')
            if name in window_logs:
                source = window_logs[name]
                require(row.get('transportOrigin') == 'cost_window_log_transport'
                        and compressed == confined(root, source['path'])
                        and all(transport[key] == source[key] for key in ('bytes', 'sha256')),
                        'Window raw log uses another gzip transport')
            else:
                require(row.get('transportOrigin') == 'explicit_pinned_gzip',
                        'Additional raw proof log lacks its explicit pinned transport')
            decoded = gzip_original(compressed, original['bytes'])
            require(decoded == row.get('decoded') == {key: original[key] for key in ('bytes', 'sha256')},
                    'Gzip transport no longer reconstructs its exact original raw proof')
            for checkout in (root, pub):
                actual = self.keep(confined(checkout, name))
                require(all(actual[key] == original[key] for key in ('bytes', 'sha256')),
                        'Raw proof log differs between the validated and publication checkouts')
        if expected:
            ignored = self.git(pub, 'check-ignore', '-z', '--stdin',
                               data=b'\0'.join(name.encode() for name in expected) + b'\0')
            require(set(filter(None, ignored.decode().split('\0'))) == set(expected),
                    'Required raw proof logs are no longer ignored in the publication checkout')
        self.result['ignoredProofLogs'] = {'count': len(expected), 'restoredCount': len(restored),
            'checkoutsVerified': 2, 'rawAndGzipBytesVerified': True, 'restoredPaths': restored,
            'transports': records, 'restorationExecutedByVerifier': False}

    def verify(self):
        args = self.args
        ROOT, PUB, OUT = args.validated_checkout, args.publication_worktree, args.artifact_directory
        FINAL = args.candidate_source_directory + '/'
        PERFORMANCE = args.performance_directory + '/'
        plan = self.read(args.plan, args.plan_sha256)
        prep = self.read(args.preparation, args.preparation_sha256)
        require(plan['schema'] == 'logos-engine.bounded-source-push-plan.v2'
                and plan['status'] == 'planned_not_pushed' and plan['checkoutUnchanged'] is True,
                'Expected the actual unchanged-checkout bounded source push plan')
        TARGET, FINAL_COMMIT, FINAL_TREE = plan['retainedTargetCommit'], plan['finalCommit'], plan['finalTree']
        PROJECT = plan['projectId']
        require(all(isinstance(value, str) and len(value) == 40
                    and all(c in '0123456789abcdef' for c in value)
                    for value in (TARGET, FINAL_COMMIT, FINAL_TREE, plan['publishedBaseCommit']))
                and isinstance(PROJECT, str) and PROJECT, 'Invalid planned source identity')
        require(plan['targetTree'] == FINAL_TREE and plan['finalTreeExactlyEqualToRetainedTarget'] is True
                and plan['originalHeadIsFinalDirectParent'] is True
                and plan['nativeTestBuildInputsEqualToTargetFromFirstStep'] is True,
                'Plan does not preserve the retained target tree and compiled input scope')
        require(prep['schema'] == 'logos-engine.lot6a-publication-worktree-preparation.v1'
                and prep['status'] == 'passed' and prep['rebuildExecuted'] is False
                and prep['openedActualPredecessor'] == plan['publishedBaseCommit'],
                'Actual publication worktree preparation differs')
        steps = plan['steps']
        require(isinstance(steps, list) and steps
                and all(type(row['step']) is int for row in steps)
                and [row['step'] for row in steps] == list(range(1, len(steps) + 1)),
                'All planned source steps must be unique, consecutive and nonempty')
        require(prep['sourceCommit'] == steps[0]['commit']
                and instant(plan['finishedAt']) <= instant(prep['recordedAt']),
                'Preparation is not bound to the first planned source step')
        self.result['plan'] = self.keep(args.plan)
        self.result['preparation'] = self.keep(args.preparation)
        self.result['retainedTransportFailures'] = []
        for path, digest in args.retained_failure:
            failure = self.read(path, digest)
            require(isinstance(failure.get('status'), str) and failure['status'].startswith('failed')
                    and type(failure.get('exitCode')) is int and failure['exitCode'] != 0,
                    'A declared failed transport receipt must remain failed')
            self.result['retainedTransportFailures'].append({'receipt': self.keep(path),
                'status': failure['status'], 'exitCode': failure['exitCode'], 'promoted': False})
        before = {'validatedCheckout': self.snapshot(ROOT), 'publicationWorktree': self.snapshot(PUB)}
        self.result['worktreesBefore'] = before
        require(before['validatedCheckout']['head'] == TARGET and before['validatedCheckout']['tree'] == FINAL_TREE,
                'Validated checkout no longer names the retained target')
        actual = before['publicationWorktree']
        require(actual['head'] == FINAL_COMMIT and actual['tree'] == FINAL_TREE
                and actual['parents'] == plan['finalParents'] and TARGET in actual['parents']
                and actual['statusBytes'] == 0, 'Final publication HEAD/tree/parents or clean state differ')
        require(self.git(PUB, 'rev-parse', TARGET + '^{tree}').decode().strip() == FINAL_TREE,
                'Retained target tree differs from final publication tree')
        self.git(PUB, 'merge-base', '--is-ancestor', plan['publishedBaseCommit'], FINAL_COMMIT)
        publication_path = FINAL + 'publication-inputs.json'
        publication = self.read(confined(ROOT, publication_path), args.publication_inputs_sha256)
        require(self.keep(confined(PUB, publication_path))['sha256'] == args.publication_inputs_sha256,
                'Publication-input receipt differs in final worktree')
        require(publication['schema'] == 'logos-engine.lot6a-publication-inputs.v1'
                and publication['status'] == 'passed' and publication['inputsUnchanged'] is True
                and publication['publicationExecuted'] is False and type(publication['costAccepted']) is bool,
                'Expected the actual 6A completed-evidence input binding')
        bound = {row['path']: row for row in publication['receipts']}
        require(len(bound) == len(publication['receipts']), 'Duplicate publication receipt path')

        def bound_keep(name):
            record = self.keep(confined(ROOT, name))
            require({'path': name, 'bytes': record['bytes'], 'sha256': record['sha256']} == bound[name],
                    'Frozen receipt differs from passed publication binding: ' + name)
            other = self.keep(confined(PUB, name))
            require(other['sha256'] == record['sha256'] and other['bytes'] == record['bytes'],
                    'Final worktree receipt differs: ' + name)
            return bound[name]

        def bound_read(name):
            bound_keep(name)
            return self.read(confined(ROOT, name))

        # 6A binds the full fresh evidence chain, including the explicitly
        # composed replay invocations. Hash bytes only; do not replay a provider.
        for name in sorted(bound):
            bound_keep(name)
        self.result['publicationReceiptBindingsVerified'] = len(bound)
        additional = prep.get('restoredIgnoredPublicationProofs')
        require(prep.get('publicationProofBindingsVerified') is True
                and type(prep.get('expectedPublicationReceiptBindings')) is int
                and prep['expectedPublicationReceiptBindings'] == len(bound)
                and isinstance(additional, list) and len(additional) == len(set(additional))
                and additional == prep.get('plannedIgnoredPublicationProofRestorations')
                and set(additional) <= bound.keys()
                and all(name.startswith(EVIDENCE) for name in additional)
                and type(prep.get('ignoredPublicationProofsRestored')) is int
                and prep['ignoredPublicationProofsRestored'] == len(additional),
                'Additional proof restorations differ from their exact missing-only preparation')
        deferred = prep.get('deferredPublicationProofs')
        require(isinstance(deferred, list) and len(deferred) == len(set(deferred))
                and set(deferred) <= set(plan['deferredProofPaths']) and set(deferred) <= bound.keys(),
                'Preparation names proof files outside the actual deferred plan')
        if additional:
            ignored_extra = self.git(PUB, 'check-ignore', '-z', '--stdin',
                                    data=b'\0'.join(name.encode() for name in additional) + b'\0')
            require(set(filter(None, ignored_extra.decode().split('\0'))) == set(additional),
                    'Additional restored proof files are not all ignored')
        self.result['additionalPublicationProofs'] = {
            'restoredIgnoredPaths': additional, 'initiallyDeferredPathsNowVerified': deferred,
            'allBoundBytesMatchBothCheckouts': True, 'restorationExecutedByVerifier': False}

        receipts = {}
        for label, suffix in (('native', 'source-manifest.json'), ('archive', 'source-archive.json'),
                              ('tests', 'validation-final/validation/delta-tests-run.json'), ('build', 'validation-final/validation/checks-run.json'),
                              ('replay', 'regressions-final/regression-summary.json'), ('integrity', 'delivery-integrity.json')):
            receipts[label] = bound_read(FINAL + suffix)
        readiness = bound_read(PERFORMANCE + 'readiness.json')
        review = bound_read(PERFORMANCE + 'owner-growth-review.json')
        aggregate = bound_read(PERFORMANCE + 'owner-growth-comparison.json')
        require(publication.get('regressionSummary') == readiness.get('regressionSummary')
                == receipts['integrity'].get('regressionSummary') == bound[FINAL + 'regressions-final/regression-summary.json'],
                'Publication/readiness/integrity must bind the exact final composed replay summary')
        require(publication.get('regressionRecovery') == readiness.get('regressionRecovery')
                and publication.get('ownerPresence') == readiness.get('ownerPresence')
                and publication.get('regressionScope') == readiness.get('regressionScope'),
                'Fresh replay provenance or owner-presence scope changed')
        composition = receipts['replay'].get('composition')
        if composition is not None:
            require(isinstance(composition, dict) and isinstance(composition.get('inputs'), list)
                    and composition['inputs'], 'Composed replay provenance inputs are missing')
            for record in composition['inputs']:
                require(isinstance(record, dict) and record.get('path') in bound
                        and bound_keep(record['path']) == record,
                        'A constituent replay input is not preserved by the publication binding')
        self.proof_logs(bound, prep)
        native, integrity = receipts['native'], receipts['integrity']
        NATIVE = native['digest']
        require(NATIVE == publication['nativeSourceDigest'] == prep['nativeDigest']
                == readiness['nativeSourceDigest'] == integrity['nativeSourceDigest']
                and publication['nativeVersion'] == readiness['nativeVersion'] == review['nativeVersion'],
                'Native source or implementation version differs across actual receipts')
        require(native['fileCount'] == len(native['files']) > 0,
                'Frozen native manifest has an invalid population')
        require(hashlib.sha256(json.dumps(dict(sorted(native['files'].items())), separators=(',', ':')).encode()).hexdigest()
                == NATIVE, 'Frozen native digest does not reproduce its files')
        require(receipts['tests']['status'] == receipts['build']['status'] == integrity['status'] == 'passed'
                and receipts['tests']['nativeSource'] == receipts['build']['nativeSource'] == native
                and receipts['tests']['nativeSourceUnchanged'] is receipts['build']['nativeSourceUnchanged'] is True
                and receipts['tests']['sourceAndTestInputsUnchanged'] is True
                and publication['formalTests'] == receipts['tests']['checks'][0]['counts'] == integrity['tests']
                and publication['formalTestFiles'] == len(receipts['tests']['testFiles'])
                and receipts['archive']['nativeSourceManifestDigest'] == NATIVE,
                'Actual final tests/build/archive bindings differ')
        require(review['schema'] == 'logos-engine.lot6a-owner-cost-review.v2'
                and review['status'] == 'qualified_owner_cost_review_passed'
                and aggregate['schema'] == 'logos-engine.lot6a-owner-cost-consolidation.v2'
                and aggregate['status'] == 'qualified_consolidation_complete'
                and publication['costAccepted'] is review['accepted'] is review['globalAccepted'] is aggregate['globalAccepted']
                and publication['costGlobalStatus'] == review['globalStatus'] == aggregate['globalStatus']
                and review['aggregate'] == bound[PERFORMANCE + 'owner-growth-comparison.json']
                and publication['historicalStrictPassed'] is review['historicalStrictPassed'] is aggregate['historicalStrict']['passed'] is False,
                'Actual global cost verdict or historical strict refusal changed')
        strict = aggregate['historicalStrict']
        strict_failure = bound_read(strict['failureReceipt']['path'])
        strict_log = bound_keep(strict['failureLog']['path'])
        require(strict['failureReceipt'] == bound[strict['failureReceipt']['path']]
                and strict['failureLog'] == strict_log == strict_failure['log']
                and strict_failure['schema'] == 'logos-engine.retained-tool-failure.v1'
                and type(strict_failure['exitCode']) is int and strict_failure['exitCode'] == 1
                and strict_failure['inputsUnchanged'] is True and strict_failure['outputExists'] is False,
                'The retained strict aggregation refusal or its exact log changed')
        require(not confined(ROOT, strict_failure['command'][-1]).exists()
                and not confined(PUB, strict_failure['command'][-1]).exists(),
                'A successful strict aggregate was substituted for the retained refusal')
        self.result['costVerdict'] = {'accepted': publication['costAccepted'],
            'globalStatus': publication['costGlobalStatus'], 'historicalStrictPassed': False,
            'historicalStrictFailure': strict['failureReceipt'], 'historicalStrictFailureLog': strict_log,
            'historicalStrictFailureExitCode': strict_failure['exitCode'], 'historicalStrictOutputAbsent': True,
            'review': self.keep(confined(ROOT, PERFORMANCE + 'owner-growth-review.json')),
            'aggregate': self.keep(confined(ROOT, PERFORMANCE + 'owner-growth-comparison.json')),
            'qualification': 'Retained actual budget verdict. Source/build integrity does not grant publication or budget acceptance.'}
        self.result['nativeVersion'] = publication['nativeVersion']
        self.result['nativeSourceDigest'] = NATIVE
        maps = {'native': native['files'], 'archive': receipts['archive']['files'],
                'sourceAndTests': receipts['tests']['sourceAndTestInputs'], 'buildInputs': receipts['build']['buildInputs'],
                'replay': receipts['replay']['executionInputs']}
        expected = {}
        for label, inventory in maps.items():
            require(isinstance(inventory, dict) and inventory, 'Missing frozen inventory: ' + label)
            for name, digest in inventory.items():
                require(isinstance(digest, str) and len(digest) == 64, 'Invalid frozen hash: ' + name)
                require(expected.setdefault(name, digest) == digest, 'Frozen inventories conflict: ' + name)
        actual_inventories = {'native': len(maps['native']), 'archiveMembers': len(maps['archive']),
            'sourceAndTests': len(maps['sourceAndTests']), 'buildInputs': len(maps['buildInputs'])}
        require(publication['fileInventories'] == actual_inventories
                and integrity['matchedFileInventories'] == {'native': len(maps['native']), 'archive': len(maps['archive']),
                    'sourceAndTests': len(maps['sourceAndTests']), 'buildInputs': len(maps['buildInputs']),
                    'regressionExecutionInputs': len(maps['replay'])},
                'Derived frozen population differs from the actual release receipts')
        require(type(prep['expectedFrozenInputs']) is int and len(expected) == prep['expectedFrozenInputs'],
                'Derived frozen union differs from the actual preparation receipt')
        for checkout in (ROOT, PUB):
            for name, digest in sorted(expected.items()):
                require(self.keep(confined(checkout, name))['sha256'] == digest, 'Frozen file differs: ' + str(checkout / name))
            require(members(checkout, ('src', 'tests')) == set(maps['sourceAndTests']), 'Source/test membership changed')
            build_members = members(checkout, ('src', 'public', 'content'))
            build_members.update(name for name in BUILD_EXTRAS if confined(checkout, name).exists())
            require(build_members == set(maps['buildInputs']), 'Build input membership changed')
            native_members = {name for name in members(checkout, ('src/logos-engine', 'src/runtime'))
                              if PurePosixPath(name).suffix in {'.ts', '.json', '.drm'}}
            require(native_members == set(native['files']), 'Native source membership changed')
        ignored = prep['restoredIgnoredInputs']
        require(isinstance(ignored, list) and len(ignored) == len(set(ignored))
                and set(ignored) <= expected.keys(), 'Restored ignored set changed')
        if ignored:
            ignored_actual = self.git(PUB, 'check-ignore', '-z', '--stdin', data=b'\0'.join(name.encode() for name in ignored) + b'\0')
            require(set(filter(None, ignored_actual.decode().split('\0'))) == set(ignored), 'Declared restored paths are not all ignored')
        self.result['frozenInputs'] = {'uniqueInputsPerCheckout': len(expected), 'checkoutsVerified': 2,
            'inventoryCounts': {key: len(value) for key, value in maps.items()}, 'allBytesMatch': True,
            'nativeSourceDigest': NATIVE, 'exactNativeTestBuildMembership': True,
            'ignoredInputsVerifiedWithoutModification': ignored}
        application = prep['validatedApplicationMembers']
        require(type(prep['applicationMemberCount']) is int and len(application) == prep['applicationMemberCount'] > 0
                and '.openai/hosting.json' in application and 'dist/.openai/hosting.json' not in application,
                'Validated application member inventory differs')
        expected_archive = {}
        for name, digest in application.items():
            require(name == '.openai/hosting.json' or name.startswith('dist/'), 'Unexpected application member')
            baseline = self.keep(confined(ROOT, name))
            require(baseline['sha256'] == digest and self.keep(confined(PUB, name))['sha256'] == digest,
                    'Validated application bytes changed: ' + name)
            archive_name = 'dist/.openai/hosting.json' if name == '.openai/hosting.json' else name
            require(archive_name not in expected_archive, 'Duplicate application mapping')
            expected_archive[archive_name] = {'sha256': digest, 'bytes': baseline['bytes']}
        for checkout in (ROOT, PUB):
            require(members(checkout, ('dist',)) == set(application) - {'.openai/hosting.json'}, 'Compiled dist membership changed')
        require(receipts['build']['nativeAgentWorker'] == prep['worker'] == publication['nativeAgentWorker'],
                'Validated worker bindings disagree')
        worker = prep['worker']
        require(application[worker['path']] == worker['sha256']
                and self.keep(confined(PUB, worker['path']))['bytes'] == worker['bytes'], 'Compiled worker differs')
        require(self.read(confined(PUB, '.openai/hosting.json'))['project_id'] == PROJECT, 'Publication project changed')
        self.result['application'] = {'membersPerArchive': len(application), 'validatedCurrentBuildsMatch': True, 'worker': worker,
            'sourceManifestToArchiveMapping': {'.openai/hosting.json': 'dist/.openai/hosting.json'}}
        previous, prior_finish = plan['publishedBaseCommit'], None
        self.result['sourcePushes'] = []
        for step in steps:
            number = step['step']
            require(step['previousCommit'] == previous and step['parents'][0] == previous, 'Broken planned source chain')
            require(self.git(PUB, 'rev-parse', step['commit'] + '^{tree}').decode().strip() == step['tree'], 'Step tree differs')
            parents = self.git(PUB, 'rev-list', '--parents', '-n', '1', step['commit']).decode().split()[1:]
            require(parents == step['parents'], 'Step parent set differs')
            receipt_path = confined(OUT, args.workflow_receipt_pattern.format(step=number))
            execution = self.read(receipt_path)
            archive = confined(OUT, args.archive_pattern.format(step=number))
            wanted = {'project_id': PROJECT, 'checkout_path': str(PUB), 'commit_sha': step['commit'], 'archive': str(archive)}
            require(type(execution['step']) is int and execution['step'] == number
                    and type(execution['exitCode']) is int and execution['exitCode'] == 0
                    and execution['result'] == wanted, 'Source workflow did not succeed for the exact planned step')
            lines = [line.strip() for line in ''.join(execution['outputChunks']).splitlines() if line.strip()]
            require(lines and decode(lines[-1]) == wanted and str(archive) in lines, 'Workflow raw output differs from its result')
            start, finish = instant(execution['startedAt']), instant(execution['finishedAt'])
            require(instant(prep['recordedAt']) <= start <= finish <= instant(self.result['startedAt'])
                    and (prior_finish is None or prior_finish <= start),
                    'Source workflow chronology is incomplete or overlapping')
            archive_record = self.keep(archive)
            seen = set()
            with tarfile.open(archive, mode='r|gz') as stream:
                for member in stream:
                    name = member.name
                    path = PurePosixPath(name)
                    require(not path.is_absolute() and '..' not in path.parts and path.parts and path.parts[0] == 'dist',
                            'Unsafe or unexpected package member: ' + name)
                    if member.isdir():
                        continue
                    require(member.isfile() and name in expected_archive and name not in seen,
                            'Unexpected, non-regular or duplicate package member: ' + name)
                    incoming = stream.extractfile(member)
                    require(incoming is not None, 'Cannot read package member: ' + name)
                    digest, size = hashlib.sha256(), 0
                    with incoming:
                        for block in iter(lambda: incoming.read(1024 * 1024), b''):
                            digest.update(block)
                            size += len(block)
                    require(size == member.size and {'sha256': digest.hexdigest(), 'bytes': size} == expected_archive[name],
                            'Packaged bytes differ from validated build: ' + name)
                    seen.add(name)
            require(seen == set(expected_archive) and len(seen) == len(application), 'Package application membership is incomplete')
            prior_archive_review = OUT / f'archive-step-{number}-verification.json'
            if prior_archive_review.exists():
                earlier = self.read(prior_archive_review)
                require(earlier['status'] == 'passed' and earlier['sourceCommit'] == step['commit']
                        and earlier['archive'] == str(archive) and earlier['gzipSha256'] == archive_record['sha256']
                        and earlier['gzipBytes'] == archive_record['bytes'] and earlier['applicationMembers'] == len(application)
                        and earlier['everyApplicationMemberMatchesValidatedBuild'] is True,
                        'A retained earlier archive verification changed')
            self.result['sourcePushes'].append({'step': number, 'commit': step['commit'], 'tree': step['tree'],
                'workflowReceipt': self.keep(receipt_path), 'exitCode': 0, 'startedAt': execution['startedAt'],
                'finishedAt': execution['finishedAt'], 'archive': archive_record, 'applicationMembersChecked': len(application),
                'everyApplicationMemberMatchesValidatedBuild': True})
            previous, prior_finish = step['commit'], finish
        require(previous == FINAL_COMMIT, 'Last planned push did not reach the final retained-history commit')
        for path, record in list(self.retained.items()):
            require(fingerprint(path) == record, 'Input changed before final receipt: ' + str(path))
        after = {'validatedCheckout': self.snapshot(ROOT), 'publicationWorktree': self.snapshot(PUB)}
        require(after == before, 'A checkout changed during final verification')
        self.result.update(worktreesAfter=after, worktreesUnchanged=True, inputsUnchanged=True,
            workflowReceiptsVerified=len(steps), applicationMemberComparisons=len(steps) * len(application), finalCommit=FINAL_COMMIT,
            finalTree=FINAL_TREE, retainedTargetCommit=TARGET, retainedTargetIsDirectParent=True,
            sourceBuildByteIntegrityPassed=True, status='passed')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--validated-checkout', type=Path, required=True)
    parser.add_argument('--publication-worktree', type=Path, required=True)
    parser.add_argument('--artifact-directory', type=Path, required=True)
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--plan-sha256', required=True)
    parser.add_argument('--preparation', type=Path, required=True)
    parser.add_argument('--preparation-sha256', required=True)
    parser.add_argument('--publication-inputs-sha256', required=True)
    parser.add_argument('--candidate-source-directory', default=DEFAULT_FINAL)
    parser.add_argument('--performance-directory', default=DEFAULT_PERFORMANCE)
    parser.add_argument('--workflow-receipt-pattern', default='source-push-step-{step}.json')
    parser.add_argument('--archive-pattern', default='site-step-{step}.tar.gz')
    parser.add_argument('--retained-failure', nargs=2, action='append', default=[], metavar=('PATH', 'SHA256'))
    parser.add_argument('--go-after-source-pushes', action='store_true')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    require(args.go_after_source_pushes, 'Wait for the delivery owner GO after every planned source helper has completed')
    for name in ('validated_checkout', 'publication_worktree', 'artifact_directory', 'plan', 'preparation'):
        path = getattr(args, name).absolute()
        require(not path.is_symlink() and path == path.resolve(),
                'CLI paths must be canonical and contain no symlink: ' + str(path))
        setattr(args, name, path)
    require(args.validated_checkout.is_dir() and args.publication_worktree.is_dir()
            and args.artifact_directory.is_dir() and args.validated_checkout != args.publication_worktree,
            'Expected two distinct existing checkouts and an existing exterior artifact directory')
    require(not args.artifact_directory.is_relative_to(args.validated_checkout)
            and not args.artifact_directory.is_relative_to(args.publication_worktree),
            'Artifacts and the only new receipt must remain outside both checkouts')
    require(args.plan.parent == args.artifact_directory and args.preparation.parent == args.artifact_directory,
            'Plan and preparation must be retained in the exterior artifact directory')
    for name in (args.candidate_source_directory, args.performance_directory):
        confined(args.validated_checkout, name)
    for pattern in (args.workflow_receipt_pattern, args.archive_pattern):
        require(pattern.count('{step}') == 1 and '{' not in pattern.replace('{step}', '')
                and '}' not in pattern.replace('{step}', ''), 'Only one step placeholder is supported')
        confined(args.artifact_directory, pattern.format(step=1))
    args.retained_failure = [(Path(path).absolute(), digest) for path, digest in args.retained_failure]
    for path, _ in args.retained_failure:
        require(path.parent == args.artifact_directory and path == path.resolve(),
                'Retained transport failures must remain in the canonical artifact directory')
    for value in (args.plan_sha256, args.preparation_sha256, args.publication_inputs_sha256,
                  *(digest for _, digest in args.retained_failure)):
        require(len(value) == 64 and all(c in '0123456789abcdef' for c in value), 'Expected a complete retained SHA-256')
    output = (args.output or args.artifact_directory / 'final-source-build-verification.json').absolute()
    require(output.parent == args.artifact_directory and output == output.resolve()
            and not output.exists() and not output.is_symlink(),
            'Use a new exclusive receipt in the exterior artifact directory only')
    result = {'schema': 'logos-engine.lot6a-final-source-build-verification.v1', 'status': 'running',
        'startedAt': stamp(), 'generator': fingerprint(Path(__file__).resolve()), 'output': str(output),
        'validatedCheckout': str(args.validated_checkout), 'publicationWorktree': str(args.publication_worktree),
        'qualification': 'Read-only verification of all completed source-workflow receipts in the pinned actual plan, '
                         'every regular application member of each saved archive, final source ancestry/tree and current frozen inputs. '
                         'Counts, version and commits are derived from actual receipts, not future constants. '
                         'Package gzip bytes may differ; all application bytes must match the already validated build. '
                         'The actual global cost verdict and historical strict refusal remain explicit and distinct from byte integrity. '
                         'A passed result is not a deployment result or publication authorization. No Site result is inferred. '
                         'No rebuild, test, timing campaign, game, source push, ignored-file restoration or Git mutation is performed.'}
    verifier = None
    with output.open('x', encoding='utf-8') as stream:
        try:
            verifier = Verification(result, args)
            verifier.keep(Path(__file__).resolve())
            verifier.verify()
        except Exception as error:
            result.update(status='failed', error=f'{type(error).__name__}: {error}', sourceBuildByteIntegrityPassed=False)
        finally:
            result['finishedAt'] = stamp()
            result['inputs'] = list(verifier.retained.values()) if verifier is not None else []
            result['inputCount'] = len(result['inputs'])
            json.dump(result, stream, indent=2, allow_nan=False)
            stream.write('\n')
    print(json.dumps({'status': result['status'], 'output': fingerprint(output),
        'workflowReceiptsVerified': result.get('workflowReceiptsVerified'),
        'applicationMemberComparisons': result.get('applicationMemberComparisons'),
        'costVerdict': result.get('costVerdict'), 'error': result.get('error')}))
    return 0 if result['status'] == 'passed' else 1


if __name__ == '__main__':
    sys.exit(main())
