#!/usr/bin/env python3
"""Read-only final 4C source/build verification, after the five source pushes.

Invoke only after the delivery owner's GO, through the shared performance lock:
  flock -s /workspace/shared/sra-coordination/performance.lock python -B \
    /workspace/sites/lot4c-publication-20261111/verify-final-source-build.py \
    --go-after-step-five

Only a new JSON receipt in this exterior directory is written. No archive is
extracted, no ignored file restored, and no Git mutation, network operation,
build, test, timing campaign, game, source push or Site deployment is performed.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys
import tarfile

sys.dont_write_bytecode = True
OUT = Path(__file__).resolve().parent
ROOT = Path('/workspace/sites/sra-lot4a-20261110/.sites-checkout')
PUB = Path('/workspace/sites/sra-lot4c-publication-20261111')
FINAL = 'docs/migration/lot4c-evidence/integrated-final/'
TARGET = 'ffaa49af6a0cbb37c355dd63be9c2bf0a88e3b28'
FINAL_COMMIT = 'd06620d1e4ca2c9758cc693b1ced9eeeddccb7e6'
FINAL_TREE = '8c063a438a88d11e94115a87255b7c54ad8f1547'
NATIVE = 'eebd099808672be934389020c8f9061df4fdacab28cd7d60c00cd1b080464c04'
PROJECT = 'appgprj_6adbc388d79081918581b93b919d7258'
PLAN_SHA = 'dc963368f29f3868004883cf6160b3157876dc33cdf4df3775c02f0a3cb9e346'
PREP_SHA = '7b62dfa9b3209cb745996f0260afd1f0c4806605829dc63359dcc71d094de8f5'
PUBLICATION_SHA = 'e940764ac9f5b1aa2d662aae9b45ff00d61bb5e42b80b37ab4f879d7510b15b8'
EARLY_FAILURE_SHA = '113c4d9f3b606df8f21ef8d239ed0ced1ce33ea6a24cf90fc32ba191691b823a'
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
    def __init__(self, result):
        self.result = result
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

    def verify(self):
        plan = self.read(OUT / 'lot4c-source-push-plan.json', PLAN_SHA)
        prep = self.read(OUT / 'worktree-preparation.json', PREP_SHA)
        failure = self.read(OUT / 'archive-step-1-verification-attempt01.json', EARLY_FAILURE_SHA)
        require(plan['schema'] == 'logos-engine.bounded-source-push-plan.v2' and plan['status'] == 'planned_not_pushed'
                and plan['checkoutUnchanged'] is True and plan['projectId'] == PROJECT
                and plan['retainedTargetCommit'] == TARGET and plan['targetTree'] == FINAL_TREE
                and plan['finalCommit'] == FINAL_COMMIT and plan['finalTree'] == FINAL_TREE,
                'Plan identity or final source differs')
        require(prep['status'] == 'passed' and prep['nativeDigest'] == NATIVE
                and prep['rebuildExecuted'] is False and prep['expectedFrozenInputs'] == 746
                and prep['openedActualPredecessor'] == plan['publishedBaseCommit'], 'Worktree preparation differs')
        require(failure['status'] == 'failed_expected_manifest_location' and type(failure['exitCode']) is int
                and failure['exitCode'] == 1 and failure['observation'] == {
                    'missing': ['.openai/hosting.json'], 'extra': ['dist/.openai/hosting.json']},
                'Initial archive-path verification failure was not preserved')
        self.result['initialArchivePathFailurePreserved'] = True
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
        publication = self.read(confined(ROOT, publication_path), PUBLICATION_SHA)
        require(self.keep(confined(PUB, publication_path))['sha256'] == PUBLICATION_SHA,
                'Publication-input receipt differs in final worktree')
        require(publication['status'] == 'passed' and publication['nativeSourceDigest'] == NATIVE
                and publication['nativeVersion'] == '0.57.0' and publication['globalAccepted'] is True
                and publication['acceptedCases'] == publication['totalCases'] == 2, 'Release input binding is not passed')
        bound = {row['path']: row for row in publication['inputs']}
        receipts = {}
        for label, suffix in (('native', 'source-manifest.json'), ('archive', 'source-archive.json'),
                              ('tests', 'validation/delta-tests-run.json'), ('build', 'validation/checks-run.json'),
                              ('replay', 'regressions/regression-summary.json')):
            name = FINAL + suffix
            receipts[label] = self.read(confined(ROOT, name))
            record = self.keep(confined(ROOT, name))
            require({'path': name, 'bytes': record['bytes'], 'sha256': record['sha256']} == bound[name],
                    'Frozen receipt differs from passed publication binding: ' + name)
            require(self.keep(confined(PUB, name))['sha256'] == record['sha256'], 'Final worktree receipt differs: ' + name)
        native = receipts['native']
        require(native['digest'] == NATIVE and native['fileCount'] == len(native['files']) == 298,
                'Frozen native manifest changed')
        require(hashlib.sha256(json.dumps(dict(sorted(native['files'].items())), separators=(',', ':')).encode()).hexdigest()
                == NATIVE, 'Frozen native digest does not reproduce its files')
        maps = {'native': native['files'], 'archive': receipts['archive']['files'],
                'sourceAndTests': receipts['tests']['sourceAndTestInputs'], 'buildInputs': receipts['build']['buildInputs'],
                'replay': receipts['replay']['executionInputs']}
        expected = {}
        for label, inventory in maps.items():
            require(isinstance(inventory, dict) and inventory, 'Missing frozen inventory: ' + label)
            for name, digest in inventory.items():
                require(isinstance(digest, str) and len(digest) == 64, 'Invalid frozen hash: ' + name)
                require(expected.setdefault(name, digest) == digest, 'Frozen inventories conflict: ' + name)
        require(len(expected) == prep['expectedFrozenInputs'] == 746, 'Frozen union must contain exactly 746 inputs')
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
        require(len(ignored) == len(set(ignored)) == 15 and set(ignored) <= expected.keys(), 'Restored ignored set changed')
        ignored_actual = self.git(PUB, 'check-ignore', '-z', '--stdin', data=b'\0'.join(name.encode() for name in ignored) + b'\0')
        require(set(filter(None, ignored_actual.decode().split('\0'))) == set(ignored), 'Declared restored paths are not all ignored')
        self.result['frozenInputs'] = {'uniqueInputsPerCheckout': len(expected), 'checkoutsVerified': 2,
            'inventoryCounts': {key: len(value) for key, value in maps.items()}, 'allBytesMatch': True,
            'nativeSourceDigest': NATIVE, 'exactNativeTestBuildMembership': True,
            'ignoredInputsVerifiedWithoutModification': ignored}
        application = prep['validatedApplicationMembers']
        require(len(application) == prep['applicationMemberCount'] == 75
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
        self.result['application'] = {'membersPerArchive': 75, 'validatedCurrentBuildsMatch': True, 'worker': worker,
            'sourceManifestToArchiveMapping': {'.openai/hosting.json': 'dist/.openai/hosting.json'}}
        steps = plan['steps']
        require(len(steps) == 5 and [row['step'] for row in steps] == [1, 2, 3, 4, 5], 'Exactly five planned steps are required')
        previous, prior_finish = plan['publishedBaseCommit'], None
        self.result['sourcePushes'] = []
        for step in steps:
            number = step['step']
            require(step['previousCommit'] == previous and step['parents'][0] == previous, 'Broken planned source chain')
            require(self.git(PUB, 'rev-parse', step['commit'] + '^{tree}').decode().strip() == step['tree'], 'Step tree differs')
            parents = self.git(PUB, 'rev-list', '--parents', '-n', '1', step['commit']).decode().split()[1:]
            require(parents == step['parents'], 'Step parent set differs')
            receipt_path = OUT / f'source-push-step-{number}.json'
            execution = self.read(receipt_path)
            archive = OUT / f'site-step-{number}.tar.gz'
            wanted = {'project_id': PROJECT, 'checkout_path': str(PUB), 'commit_sha': step['commit'], 'archive': str(archive)}
            require(type(execution['step']) is int and execution['step'] == number
                    and type(execution['exitCode']) is int and execution['exitCode'] == 0
                    and execution['result'] == wanted, 'Source workflow did not succeed for the exact planned step')
            lines = [line.strip() for line in ''.join(execution['outputChunks']).splitlines() if line.strip()]
            require(lines and decode(lines[-1]) == wanted and str(archive) in lines, 'Workflow raw output differs from its result')
            start, finish = instant(execution['startedAt']), instant(execution['finishedAt'])
            require(start <= finish <= instant(self.result['startedAt']) and (prior_finish is None or prior_finish <= start),
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
            require(seen == set(expected_archive) and len(seen) == 75, 'Package application membership is incomplete')
            prior_archive_review = OUT / f'archive-step-{number}-verification.json'
            if prior_archive_review.exists():
                earlier = self.read(prior_archive_review)
                require(earlier['status'] == 'passed' and earlier['sourceCommit'] == step['commit']
                        and earlier['archive'] == str(archive) and earlier['gzipSha256'] == archive_record['sha256']
                        and earlier['gzipBytes'] == archive_record['bytes'] and earlier['applicationMembers'] == 75
                        and earlier['everyApplicationMemberMatchesValidatedBuild'] is True,
                        'A retained earlier archive verification changed')
            self.result['sourcePushes'].append({'step': number, 'commit': step['commit'], 'tree': step['tree'],
                'workflowReceipt': self.keep(receipt_path), 'exitCode': 0, 'startedAt': execution['startedAt'],
                'finishedAt': execution['finishedAt'], 'archive': archive_record, 'applicationMembersChecked': 75,
                'everyApplicationMemberMatchesValidatedBuild': True})
            previous, prior_finish = step['commit'], finish
        require(previous == FINAL_COMMIT, 'Fifth push did not reach final retained-history commit')
        for path, record in list(self.retained.items()):
            require(fingerprint(path) == record, 'Input changed before final receipt: ' + str(path))
        after = {'validatedCheckout': self.snapshot(ROOT), 'publicationWorktree': self.snapshot(PUB)}
        require(after == before, 'A checkout changed during final verification')
        self.result.update(worktreesAfter=after, worktreesUnchanged=True, inputsUnchanged=True,
            workflowReceiptsVerified=5, applicationMemberComparisons=375, finalCommit=FINAL_COMMIT,
            finalTree=FINAL_TREE, retainedTargetCommit=TARGET, retainedTargetIsDirectParent=True,
            sourceBuildByteIntegrityPassed=True, status='passed')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--go-after-step-five', action='store_true')
    parser.add_argument('--output', type=Path, default=OUT / 'final-source-build-verification.json')
    args = parser.parse_args()
    require(args.go_after_step_five, 'Wait for the delivery owner GO after all five source helpers have completed')
    output = args.output.absolute()
    require(output.parent == OUT and not output.exists() and not output.is_symlink(), 'Use a new exclusive receipt in OUT only')
    result = {'schema': 'logos-engine.lot4c-final-source-build-verification.v1', 'status': 'running',
        'startedAt': stamp(), 'generator': fingerprint(Path(__file__).resolve()), 'output': str(output),
        'validatedCheckout': str(ROOT), 'publicationWorktree': str(PUB),
        'qualification': 'Read-only verification of the five completed source-workflow receipts, all 75 regular application members '
                         'of each saved archive, final source ancestry/tree and current frozen inputs. Package gzip bytes may differ; '
                         'all application bytes must match the already validated build. No Site save/deployment result is inferred. '
                         'No rebuild, test, timing campaign, game, source push, ignored-file restoration or Git mutation is performed.'}
    verifier = None
    with output.open('x', encoding='utf-8') as stream:
        try:
            verifier = Verification(result)
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
        'applicationMemberComparisons': result.get('applicationMemberComparisons'), 'error': result.get('error')}))
    return 0 if result['status'] == 'passed' else 1


if __name__ == '__main__':
    sys.exit(main())
