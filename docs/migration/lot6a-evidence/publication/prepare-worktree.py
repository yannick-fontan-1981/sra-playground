#!/usr/bin/env python3
"""Prepare the already-opened first planned 6A publication step, without a rebuild.

Run only after the delivery owner switches the publication checkout to the first
commit of the actual pinned plan. Invoke under the shared performance lock. This
script never switches Git revisions, pushes, builds, tests or deploys. It restores
only missing ignored frozen inputs and copies the validated generated dist tree.
Bound raw proof logs additionally need an exact, fingerprinted gzip transport.
The official four-series log transport supplies its own entries. Supply the
strict aggregation refusal separately with --ignored-log-transport LOG GZIP SHA.
Existing frozen source bytes are never overwritten. All checks precede copying;
the only report written is exterior worktree-preparation.json, including failures.

Example (supply actual canonical locations and complete retained digests):
  python3 -B prepare-worktree.py \
    --validated-checkout /absolute/validated/checkout \
    --publication-worktree /absolute/opened/publication/checkout \
    --artifact-directory /absolute/exterior/artifacts \
    --plan /absolute/exterior/artifacts/source-push-plan.json --plan-sha256 SHA256 \
    --publication-inputs-sha256 SHA256 \
    --ignored-log-transport docs/migration/lot6a-evidence/performance-integrated/aggregation-failure.log \
      /absolute/exterior/artifacts/aggregation-failure.log.gz SHA256
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

sys.dont_write_bytecode = True
FINAL = 'docs/migration/lot6a-evidence/integrated-final-02'
PERFORMANCE = 'docs/migration/lot6a-evidence/performance-integrated'
OPENED = 'docs/migration/lot6a-evidence/publication/opened-source.json'
EVIDENCE = 'docs/migration/lot6a-evidence/'
BUILD_EXTRAS = ('package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'index.html',
    '.openai/hosting.json', 'scripts/prepare-python.mjs', 'scripts/python-runtime-assets.json',
    'scripts/generate-content-pages.mjs', 'scripts/generate-game-gallery.mjs')


def stamp():
    return datetime.now(timezone.utc).isoformat()


def require(condition, message):
    if not condition:
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


def hex_digest(value, length):
    return isinstance(value, str) and len(value) == length and all(c in '0123456789abcdef' for c in value)


def fingerprint(path):
    require(path.is_file() and not path.is_symlink(), 'Expected a regular file: ' + str(path))
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
            'Invalid relative input pathname')
    relative = PurePosixPath(name)
    require(not relative.is_absolute() and '..' not in relative.parts and str(relative) == name,
            'Noncanonical relative input path: ' + name)
    current = base
    require(not current.is_symlink(), 'Symlink checkout root')
    for part in relative.parts:
        current /= part
        require(not current.is_symlink(), 'Symlink input: ' + str(current))
    return current


def members(base, folders, missing_ok=False):
    result = set()
    for name in folders:
        directory = confined(base, name)
        if missing_ok and not directory.exists():
            continue
        require(directory.is_dir(), 'Missing inventory directory: ' + str(directory))
        for folder, dirs, files in os.walk(directory, followlinks=False):
            for child in dirs + files:
                require(not (Path(folder) / child).is_symlink(), 'Symlink in inventory: ' + str(Path(folder) / child))
            for child in files:
                path = Path(folder) / child
                require(path.is_file(), 'Non-regular inventory entry: ' + str(path))
                result.add(path.relative_to(base).as_posix())
    return result


class Preparation:
    def __init__(self, args, result):
        self.args, self.result, self.retained = args, result, {}
        self.env = os.environ.copy()
        self.env.update(GIT_OPTIONAL_LOCKS='0', GIT_TERMINAL_PROMPT='0',
            GIT_NO_LAZY_FETCH='1', GIT_NO_REPLACE_OBJECTS='1')
        require(not any(os.environ.get(k) for k in ('GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE',
            'GIT_COMMON_DIR', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_SHALLOW_FILE')),
            'Git location overrides are not accepted')

    def keep(self, path):
        record = fingerprint(path)
        require(self.retained.setdefault(path, record) == record, 'Read input changed: ' + str(path))
        return record

    def read(self, path, expected=None):
        record = self.keep(path)
        require(expected is None or record['sha256'] == expected, 'Pinned input digest differs: ' + str(path))
        return decode(path.read_bytes())

    def git(self, checkout, *arguments, data=None, allowed=(0,)):
        command = ['git', '-c', 'core.fsmonitor=false', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false', *arguments]
        process = subprocess.run(command, cwd=checkout, env=self.env, input=data,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
        require(process.returncode in allowed,
                'Read-only Git query failed: ' + ' '.join(arguments) + ': ' + process.stderr.decode('utf-8', 'replace')[:2000])
        return process.stdout

    def snapshot(self, checkout):
        text = lambda *args: self.git(checkout, *args).decode().strip()
        status = self.git(checkout, 'status', '--porcelain=v1', '-z', '--untracked-files=all')
        return {'head': text('rev-parse', '--verify', 'HEAD'), 'tree': text('rev-parse', 'HEAD^{tree}'),
            'parents': text('rev-list', '--parents', '-n', '1', 'HEAD').split()[1:],
            'statusBytes': len(status), 'statusSha256': hashlib.sha256(status).hexdigest()}

    def require_ignored(self, paths):
        paths = sorted(set(paths))
        if not paths:
            return
        raw = self.git(self.args.publication_worktree, 'check-ignore', '-z', '--stdin',
            data=b'\0'.join(name.encode() for name in paths) + b'\0', allowed=(0, 1))
        require(set(filter(None, raw.decode().split('\0'))) == set(paths),
                'A proposed restoration or dist write is not ignored by the actual publication checkout')

    def membership(self, checkout, maps):
        require(members(checkout, ('src', 'tests')) == set(maps['sourceAndTests']),
                'Source/test inventory differs: ' + str(checkout))
        build = members(checkout, ('src', 'public', 'content'))
        build.update(name for name in BUILD_EXTRAS if confined(checkout, name).exists())
        require(build == set(maps['buildInputs']), 'Build-input inventory differs: ' + str(checkout))
        native = {name for name in members(checkout, ('src/logos-engine', 'src/runtime'))
                  if PurePosixPath(name).suffix in {'.ts', '.json', '.drm'}}
        require(native == set(maps['native']), 'Native-source inventory differs: ' + str(checkout))

    def copy(self, name, replace_dist=False):
        source = confined(self.args.validated_checkout, name)
        target = confined(self.args.publication_worktree, name)
        require(source.is_file() and not source.is_symlink(), 'Missing regular copy source: ' + str(source))
        require(replace_dist and name.startswith('dist/') or not target.exists(),
                'Refusing to overwrite an existing frozen source: ' + str(target))
        target.parent.mkdir(parents=True, exist_ok=True)
        confined(self.args.publication_worktree, name)
        with source.open('rb') as incoming, target.open('wb' if replace_dist else 'xb') as outgoing:
            for block in iter(lambda: incoming.read(1024 * 1024), b''):
                outgoing.write(block)

    def proof_logs(self, release, bound):
        """Validate all bound raw logs and transports before any destination write."""
        args = self.args
        root, pub, out = args.validated_checkout, args.publication_worktree, args.artifact_directory
        names = sorted(name for name in bound if name.endswith('.log'))
        require(all(name.startswith(EVIDENCE) for name in names),
                'Bound raw proof log is outside the declared 6A evidence scope')

        def bound_read(name):
            require(name in bound, 'Missing publication binding: ' + name)
            path = confined(root, name)
            actual = self.keep(path)
            require(bound[name] == {'path': name, 'bytes': actual['bytes'], 'sha256': actual['sha256']},
                    'Raw-log dependency differs from the publication binding: ' + name)
            return self.read(path)

        perf = args.performance_directory + '/'
        transport = bound_read(perf + 'log-transport.json')
        require(transport.get('schema') == 'logos-engine.lossless-log-transport.v1'
                and transport.get('mode') == 'cost-window' and transport.get('status') == 'passed'
                and transport.get('window') == bound.get(perf + 'window.json')
                and isinstance(transport.get('logs'), list)
                and [row.get('series') for row in transport['logs']] == ['A1', 'B1', 'B2', 'A2'],
                'Expected the actual completed four-series lossless log transport')
        available = {}
        for row in transport['logs']:
            original, compressed = row.get('original'), row.get('transport')
            require(isinstance(original, dict) and isinstance(compressed, dict)
                    and original.get('path') in names and row.get('byteIdentical') is True
                    and original == bound[original['path']]
                    and compressed.get('path') in bound and compressed == bound[compressed['path']]
                    and original['path'] not in available,
                    'Window log transport does not bind an exact unique raw/gzip pair')
            available[original['path']] = (confined(root, compressed['path']), compressed['sha256'],
                                           'cost_window_log_transport')
        for name, compressed_path, compressed_sha in args.ignored_log_transport:
            require(name in names and name not in available,
                    'Explicit gzip must name one otherwise unbound required raw log')
            confined(root, name)
            require(compressed_path.is_relative_to(root) or compressed_path.is_relative_to(out),
                    'Explicit gzip must remain in the validated checkout or exterior artifacts')
            if compressed_path.is_relative_to(root):
                confined(root, compressed_path.relative_to(root).as_posix())
            else:
                confined(out, compressed_path.relative_to(out).as_posix())
            available[name] = (compressed_path, compressed_sha, 'explicit_pinned_gzip')
        require(set(available) == set(names),
                'Every required raw proof log needs a proven gzip; include the strict refusal separately')

        aggregate = bound_read(perf + 'owner-growth-comparison.json')
        strict = aggregate.get('historicalStrict', {})
        failure_record, strict_log = strict.get('failureReceipt'), strict.get('failureLog')
        require(strict.get('passed') is False and isinstance(failure_record, dict)
                and isinstance(strict_log, dict) and failure_record.get('path') in bound
                and strict_log.get('path') in names and failure_record == bound[failure_record['path']]
                and strict_log == bound[strict_log['path']],
                'Strict-refusal log is not the actual bound historical failure')
        failure = bound_read(failure_record['path'])
        require(failure.get('schema') == 'logos-engine.retained-tool-failure.v1'
                and type(failure.get('exitCode')) is int and failure['exitCode'] == 1
                and failure.get('inputsUnchanged') is True and failure.get('outputExists') is False
                and failure.get('log') == strict_log,
                'The strict refusal must keep its actual failed status and exact raw log')

        result = []
        self.require_ignored(names)
        for name in names:
            original = bound[name]
            require(set(original) == {'path', 'bytes', 'sha256'} and type(original['bytes']) is int
                    and original['bytes'] >= 0 and hex_digest(original['sha256'], 64),
                    'Invalid bound raw log fingerprint')
            actual = self.keep(confined(root, name))
            require(actual['sha256'] == original['sha256'] and actual['bytes'] == original['bytes'],
                    'Validated raw proof log changed: ' + name)
            compressed_path, compressed_sha, origin = available[name]
            compressed = self.keep(compressed_path)
            require(compressed['sha256'] == compressed_sha, 'Pinned gzip transport bytes changed')
            decoded = gzip_original(compressed_path, original['bytes'])
            require(decoded == {key: original[key] for key in ('bytes', 'sha256')},
                    'Gzip proof does not reconstruct the exact bound raw log')
            target = confined(pub, name)
            if target.exists():
                existing = fingerprint(target)
                require(existing['sha256'] == original['sha256'] and existing['bytes'] == original['bytes'],
                        'Existing ignored proof log differs; refusing overwrite: ' + name)
            result.append({'original': original, 'transport': compressed, 'transportOrigin': origin,
                           'decoded': decoded, 'byteIdentical': True,
                           'destinationExisted': target.exists(), 'restorationRequired': not target.exists()})
        return result

    def publication_proofs(self, bound, frozen_names, plan):
        """Keep the five frozen inventories intact; bind extra proof bytes separately."""
        root, pub = self.args.validated_checkout, self.args.publication_worktree
        missing, present = [], []
        for name, expected in sorted(bound.items()):
            actual = self.keep(confined(root, name))
            require(expected == {'path': name, 'bytes': actual['bytes'], 'sha256': actual['sha256']},
                    'Bound publication proof changed: ' + name)
            target = confined(pub, name)
            if target.exists():
                other = fingerprint(target)
                require(other['bytes'] == expected['bytes'] and other['sha256'] == expected['sha256'],
                        'Existing publication proof differs; refusing overwrite: ' + name)
                present.append(name)
            elif name not in frozen_names:
                missing.append(name)
        ignored = set()
        if missing:
            observed = self.git(pub, 'check-ignore', '-z', '--stdin',
                                data=b'\0'.join(name.encode() for name in missing) + b'\0', allowed=(0, 1))
            ignored = set(filter(None, observed.decode().split('\0')))
        require(ignored <= set(missing), 'Unexpected ignored proof pathname returned by Git')
        deferred = sorted(set(missing) - ignored)
        require(set(deferred) <= set(plan['deferredProofPaths']),
                'Missing nonignored publication proof is not an actual planned deferred path')
        require(all(name.startswith(EVIDENCE) for name in ignored),
                'Additional ignored proof restoration would escape the 6A evidence scope')
        return {'present': present, 'restore': sorted(ignored), 'deferred': deferred}

    def run(self):
        args, result = self.args, self.result
        root, pub = args.validated_checkout, args.publication_worktree
        plan = self.read(args.plan, args.plan_sha256)
        require(plan['schema'] == 'logos-engine.bounded-source-push-plan.v2'
                and plan['status'] == 'planned_not_pushed' and plan['checkoutUnchanged'] is True,
                'Expected the actual bounded source-push plan')
        require(all(hex_digest(plan[k], 40) for k in
                    ('retainedTargetCommit', 'targetTree', 'finalCommit', 'finalTree', 'publishedBaseCommit')),
                'Invalid source identities in plan')
        require(plan['finalTree'] == plan['targetTree'] and plan['finalTreeExactlyEqualToRetainedTarget'] is True
                and plan['originalHeadIsFinalDirectParent'] is True
                and plan['nativeTestBuildInputsEqualToTargetFromFirstStep'] is True,
                'Plan does not preserve the validated target and compiled source scope')
        require(isinstance(plan['projectId'], str) and plan['projectId'], 'Missing project identity')
        steps = plan['steps']
        require(isinstance(steps, list) and steps
                and [s['step'] for s in steps] == list(range(1, len(steps) + 1)), 'Invalid source-step order')
        previous = plan['publishedBaseCommit']
        for step in steps:
            require(type(step['step']) is int and hex_digest(step['commit'], 40) and hex_digest(step['tree'], 40)
                    and step['previousCommit'] == previous and step['parents'][0] == previous,
                    'Broken planned source chain')
            previous = step['commit']
        require(previous == plan['finalCommit'] and steps[-1]['tree'] == plan['finalTree'],
                'Final planned source identity differs')
        first = steps[0]
        opened_path = confined(root, args.opened_source)
        opened = self.read(opened_path)
        actual = opened['result']
        require(actual == {'project_id': plan['projectId'], 'checkout_path': str(pub),
                           'commit_sha': plan['publishedBaseCommit']}, 'Actual opening receipt differs from the plan')
        lines = [line.strip() for line in opened['rawOutput'].splitlines() if line.strip()]
        require(lines and decode(lines[-1]) == actual, 'Opening raw output differs from its result')
        require(instant(opened['recordedAt']) <= instant(plan['finishedAt']), 'Plan precedes the actual predecessor opening')
        before = {'validatedCheckout': self.snapshot(root), 'publicationWorktree': self.snapshot(pub)}
        require(before['validatedCheckout']['head'] == plan['retainedTargetCommit']
                and before['validatedCheckout']['tree'] == plan['targetTree'], 'Validated checkout differs from retained target')
        require(before['publicationWorktree']['head'] == first['commit']
                and before['publicationWorktree']['tree'] == first['tree']
                and before['publicationWorktree']['parents'] == first['parents']
                and before['publicationWorktree']['statusBytes'] == 0,
                'Publication checkout is not clean at the first planned step; the owner must switch it first')
        self.git(pub, 'merge-base', '--is-ancestor', plan['publishedBaseCommit'], first['commit'])
        result.update(plan=self.keep(args.plan), openedSource=self.keep(opened_path),
            openedActualPredecessor=actual['commit_sha'], sourceCommit=before['publicationWorktree']['head'],
            sourceTree=before['publicationWorktree']['tree'], retainedTargetCommit=plan['retainedTargetCommit'],
            worktreesBefore=before, projectId=plan['projectId'])

        release_path = confined(root, args.candidate_source_directory + '/publication-inputs.json')
        release = self.read(release_path, args.publication_inputs_sha256)
        require(release['schema'] == 'logos-engine.lot6a-publication-inputs.v1' and release['status'] == 'passed'
                and release['inputsUnchanged'] is True and release['publicationExecuted'] is False,
                'Expected the completed retained publication-input binding')
        bound = {row['path']: row for row in release['receipts']}
        require(len(bound) == len(release['receipts']), 'Duplicate bound receipt path')

        def bound_read(suffix):
            name = args.candidate_source_directory + '/' + suffix
            path = confined(root, name)
            record = self.keep(path)
            require({'path': name, 'bytes': record['bytes'], 'sha256': record['sha256']} == bound[name],
                    'Passed publication binding differs: ' + name)
            return self.read(path)

        native = bound_read('source-manifest.json')
        archive = bound_read('source-archive.json')
        tests = bound_read('validation-final/validation/delta-tests-run.json')
        build = bound_read('validation-final/validation/checks-run.json')
        replay = bound_read('regressions-final/regression-summary.json')
        require(release.get('regressionSummary') == bound.get(args.candidate_source_directory + '/regressions-final/regression-summary.json'),
                'Preparation must consume the exact final composed replay summary bound for publication')
        require(tests['status'] == build['status'] == replay['status'] == 'passed'
                and tests['nativeSourceUnchanged'] is build['nativeSourceUnchanged'] is True
                and tests['sourceAndTestInputsUnchanged'] is replay['executionInputsUnchanged'] is True,
                'Expected the passed final frozen functional receipts')
        require(tests['nativeSource'] == build['nativeSource'] == replay['nativeSource'] == native
                and archive['nativeSourceManifestDigest'] == release['nativeSourceDigest'] == native['digest'],
                'Frozen source identities differ')
        require(native['fileCount'] == len(native['files']) > 0
                and hashlib.sha256(json.dumps(dict(sorted(native['files'].items())), separators=(',', ':')).encode()).hexdigest()
                == native['digest'], 'Native manifest digest or population does not reproduce')
        maps = {'native': native['files'], 'archive': archive['files'], 'sourceAndTests': tests['sourceAndTestInputs'],
                'buildInputs': build['buildInputs'], 'replay': replay['executionInputs']}
        expected = {}
        for label, inventory in maps.items():
            require(isinstance(inventory, dict) and inventory, 'Missing frozen inventory: ' + label)
            for name, digest in inventory.items():
                confined(root, name)
                require(hex_digest(digest, 64) and expected.setdefault(name, digest) == digest,
                        'Conflicting or invalid frozen file digest: ' + name)
        require(release['fileInventories'] == {'native': len(maps['native']), 'archiveMembers': len(maps['archive']),
                'sourceAndTests': len(maps['sourceAndTests']), 'buildInputs': len(maps['buildInputs'])},
                'Frozen populations differ from the publication-input binding')
        self.membership(root, maps)
        missing = []
        for name, digest in sorted(expected.items()):
            require(self.keep(confined(root, name))['sha256'] == digest, 'Validated frozen bytes differ: ' + name)
            target = confined(pub, name)
            if target.exists():
                require(fingerprint(target)['sha256'] == digest,
                        'Existing frozen source differs; no source overwrite is permitted: ' + name)
            else:
                missing.append(name)
        self.require_ignored(missing)
        publication_proofs = self.publication_proofs(bound, set(expected), plan)
        proof_logs = self.proof_logs(release, bound)
        missing_proof_logs = [row['original']['path'] for row in proof_logs if row['restorationRequired']]

        compiled_names = members(root, ('dist',))
        require(compiled_names and 'dist/.openai/hosting.json' not in compiled_names,
                'Validated dist must be nonempty and keep hosting metadata outside dist')
        application = {name: self.keep(confined(root, name))['sha256']
                       for name in sorted(compiled_names | {'.openai/hosting.json'})}
        hosting = confined(pub, '.openai/hosting.json')
        require(fingerprint(hosting)['sha256'] == application['.openai/hosting.json'], 'Existing hosting source differs')
        require(self.read(confined(root, '.openai/hosting.json'))['project_id'] == plan['projectId'],
                'Validated hosting project differs')
        worker = build['nativeAgentWorker']
        require(worker == release['nativeAgentWorker'] and worker['path'] in compiled_names
                and self.keep(confined(root, worker['path'])) == {'path': str(root / worker['path']),
                    'bytes': worker['bytes'], 'sha256': worker['sha256']}, 'Validated worker binding differs')
        existing_dist = members(pub, ('dist',), missing_ok=True)
        require(not any(name.startswith('dist/') for name in expected),
                'A frozen source inventory unexpectedly overlaps generated dist')
        self.require_ignored(existing_dist | compiled_names)
        extra_dist = sorted(existing_dist - compiled_names)
        replace_dist = []
        missing_dist = []
        for name in sorted(compiled_names):
            target = confined(pub, name)
            if not target.exists():
                missing_dist.append(name)
            elif fingerprint(target)['sha256'] != application[name]:
                replace_dist.append(name)
        # Finish all preflight validation before touching any destination byte.
        for path, record in self.retained.items():
            require(fingerprint(path) == record, 'Input changed during preflight: ' + str(path))
        require(self.snapshot(root) == before['validatedCheckout'] and self.snapshot(pub) == before['publicationWorktree'],
                'A checkout changed during preflight')
        result.update(nativeDigest=native['digest'], nativeVersion=release['nativeVersion'],
            publicationInputs=self.keep(release_path), expectedFrozenInputs=len(expected),
            inventoryCounts={label: len(inventory) for label, inventory in maps.items()},
            applicationMemberCount=len(application), validatedApplicationMembers=application, worker=worker,
            plannedIgnoredRestorations=missing, plannedDistCopies=missing_dist,
            plannedDistReplacements=replace_dist, plannedDistRemovals=extra_dist,
            restoredIgnoredInputs=[], copiedDistMembers=[], replacedDistMembers=[], removedDistMembers=[],
            ignoredProofLogTransports=proof_logs, expectedIgnoredProofLogs=len(proof_logs),
            plannedIgnoredProofLogRestorations=missing_proof_logs, restoredIgnoredProofLogs=[],
            expectedPublicationReceiptBindings=len(bound),
            initiallyPresentPublicationProofs=publication_proofs['present'],
            deferredPublicationProofs=publication_proofs['deferred'],
            plannedIgnoredPublicationProofRestorations=publication_proofs['restore'],
            restoredIgnoredPublicationProofs=[])
        result['copyStartedAt'] = stamp()
        for name in missing:
            self.copy(name)
            result['restoredIgnoredInputs'].append(name)
        for name in publication_proofs['restore']:
            self.copy(name)
            result['restoredIgnoredPublicationProofs'].append(name)
        for name in missing_proof_logs:
            if name not in missing and name not in publication_proofs['restore']:
                self.copy(name)
            result['restoredIgnoredProofLogs'].append(name)
        for name in extra_dist:
            confined(pub, name).unlink()
            result['removedDistMembers'].append(name)
        for name in missing_dist:
            self.copy(name)
            result['copiedDistMembers'].append(name)
        for name in replace_dist:
            self.copy(name, replace_dist=True)
            result['replacedDistMembers'].append(name)
        result['copyFinishedAt'] = stamp()
        # No path outside generated dist or the absent ignored frozen set is written.
        for checkout in (root, pub):
            self.membership(checkout, maps)
            for name, digest in sorted(expected.items()):
                require(fingerprint(confined(checkout, name))['sha256'] == digest,
                        'Prepared frozen bytes differ: ' + str(checkout / name))
            require(members(checkout, ('dist',)) == compiled_names, 'Prepared dist membership differs: ' + str(checkout))
            for name, digest in application.items():
                require(fingerprint(confined(checkout, name))['sha256'] == digest,
                        'Prepared application bytes differ: ' + str(checkout / name))
            for row in proof_logs:
                actual = fingerprint(confined(checkout, row['original']['path']))
                require(all(actual[key] == row['original'][key] for key in ('bytes', 'sha256')),
                        'Prepared raw proof log differs: ' + row['original']['path'])
            for name in publication_proofs['present'] + publication_proofs['restore']:
                actual = fingerprint(confined(checkout, name))
                require(all(actual[key] == bound[name][key] for key in ('bytes', 'sha256')),
                        'Prepared publication proof differs: ' + name)
        self.require_ignored(result['restoredIgnoredInputs'] + result['restoredIgnoredProofLogs']
                             + result['restoredIgnoredPublicationProofs'])
        for path, record in self.retained.items():
            require(fingerprint(path) == record, 'Validated input changed during copying: ' + str(path))
        after = {'validatedCheckout': self.snapshot(root), 'publicationWorktree': self.snapshot(pub)}
        require(after == before and after['publicationWorktree']['statusBytes'] == 0,
                'Git identities or clean worktree state changed during preparation')
        result.update(status='passed', recordedAt=stamp(), worktreesAfter=after,
            validatedCheckoutUnchanged=True, gitWorktreesUnchanged=True, worktreeClean=True,
            allFrozenBytesMatch=True, allApplicationBytesMatch=True, exactNativeTestBuildMembership=True,
            exactDistFileMembership=True, sourceFilesOverwritten=False,
            ignoredInputsRestored=len(result['restoredIgnoredInputs']),
            allIgnoredProofLogsByteIdentical=True, ignoredProofLogsRestored=len(result['restoredIgnoredProofLogs']),
            publicationProofBindingsVerified=True,
            ignoredPublicationProofsRestored=len(result['restoredIgnoredPublicationProofs']))
        require(instant(plan['finishedAt']) <= instant(result['recordedAt']), 'Preparation predates its plan')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--plan-sha256', required=True)
    parser.add_argument('--validated-checkout', type=Path, required=True)
    parser.add_argument('--publication-worktree', type=Path, required=True)
    parser.add_argument('--artifact-directory', type=Path, required=True)
    parser.add_argument('--candidate-source-directory', default=FINAL)
    parser.add_argument('--performance-directory', default=PERFORMANCE)
    parser.add_argument('--opened-source', default=OPENED)
    parser.add_argument('--publication-inputs-sha256', required=True)
    parser.add_argument('--ignored-log-transport', nargs=3, action='append', default=[],
                        metavar=('RELATIVE_LOG', 'GZIP_PATH', 'GZIP_SHA256'),
                        help='Additional pinned gzip for a required raw log, notably aggregation-failure.log')
    args = parser.parse_args()
    for name in ('plan', 'validated_checkout', 'publication_worktree', 'artifact_directory'):
        path = getattr(args, name).absolute()
        require(path == path.resolve() and not path.is_symlink(), 'Use a canonical path without symlinks: ' + str(path))
        setattr(args, name, path)
    require(args.validated_checkout.is_dir() and args.publication_worktree.is_dir()
            and args.artifact_directory.is_dir() and args.validated_checkout != args.publication_worktree,
            'Expected distinct existing checkouts and an existing artifact directory')
    require(not args.artifact_directory.is_relative_to(args.validated_checkout)
            and not args.artifact_directory.is_relative_to(args.publication_worktree),
            'Preparation receipt must remain outside both checkouts')
    require(args.plan.parent == args.artifact_directory, 'The actual plan must be in the exterior artifact directory')
    require(hex_digest(args.plan_sha256, 64), 'Supply the actual complete plan SHA-256')
    require(hex_digest(args.publication_inputs_sha256, 64),
            'Expected a complete publication-input SHA-256')
    confined(args.validated_checkout, args.candidate_source_directory)
    confined(args.validated_checkout, args.performance_directory)
    confined(args.validated_checkout, args.opened_source)
    transports = []
    for name, path, digest in args.ignored_log_transport:
        compressed = Path(path).absolute()
        require(compressed == compressed.resolve() and not compressed.is_symlink() and hex_digest(digest, 64),
                'Use an actual canonical gzip path and its complete retained SHA-256')
        transports.append((name, compressed, digest))
    args.ignored_log_transport = transports
    output = args.artifact_directory / 'worktree-preparation.json'
    require(not output.exists() and not output.is_symlink(), 'Refusing to replace an existing preparation receipt')
    result = {'schema': 'logos-engine.lot6a-publication-worktree-preparation.v1', 'status': 'running',
        'startedAt': stamp(), 'generator': fingerprint(Path(__file__).resolve()), 'output': str(output),
        'validatedCheckout': str(args.validated_checkout), 'publicationWorktree': str(args.publication_worktree),
        'rebuildExecuted': False, 'gitMutationExecuted': False, 'sourcePushExecuted': False, 'deploymentExecuted': False,
        'qualification': 'Copy and byte verification only, after the owner selects the first actual planned source commit. '
                         'Only absent ignored frozen inputs are restored; existing frozen sources are never overwritten. '
                         'Bound raw proof logs additionally require an exact pinned gzip whose decoded bytes equal the bound original; only missing ignored destinations are copied. '
                         'Additional publication-bound proof files are copied only when absent and ignored; nonignored proof files absent from the first step must be exact deferred paths in the plan. These counts remain separate from the five frozen inventories. '
                         'Generated dist is made exactly equal to the validated application file inventory. '
                         'No source switch, rebuild, test, game, cost measurement, source push, or deployment is executed. '
                         'A passed preparation receipt does not assert completed source transport or Site publication.'}
    preparation = None
    with output.open('x', encoding='utf-8') as stream:
        try:
            preparation = Preparation(args, result)
            preparation.keep(Path(__file__).resolve())
            preparation.run()
        except Exception as error:
            result.update(status='failed', error=f'{type(error).__name__}: {error}')
        finally:
            result['finishedAt'] = stamp()
            result.setdefault('recordedAt', result['finishedAt'])
            result['retainedInputs'] = list(preparation.retained.values()) if preparation is not None else []
            result['retainedInputCount'] = len(result['retainedInputs'])
            json.dump(result, stream, indent=2, allow_nan=False)
            stream.write('\n')
    print(json.dumps({'status': result['status'], 'receipt': fingerprint(output),
        'sourceCommit': result.get('sourceCommit'), 'expectedFrozenInputs': result.get('expectedFrozenInputs'),
        'applicationMemberCount': result.get('applicationMemberCount'), 'error': result.get('error')}))
    return 0 if result['status'] == 'passed' else 1


if __name__ == '__main__':
    sys.exit(main())
