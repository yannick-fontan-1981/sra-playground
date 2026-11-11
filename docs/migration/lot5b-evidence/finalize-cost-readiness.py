#!/usr/bin/env python3
"""Bind completed, integrated 5B evidence before any official cost sample.

This is a receipt/file verifier. It executes no agent, game, test, build, Git,
oracle, benchmark or network operation. Its exclusive output is
PERFORMANCE_DIRECTORY/readiness.json. All paths are explicit CLI inputs or
come from fingerprinted receipts; no future version or result is assumed.

Small input contracts in addition to the existing verification receipts:

* --publication-chain: logos-engine.lot5b-published-predecessor-chain.v1,
  status=verified, recordedAt, projectId, candidateSourceBaseCommit,
  publishedPredecessorCommit, publishedPredecessorIsAncestorOfCandidateBase=true,
  candidateBaseAncestry:FP, and
  predecessors in order [{lot:10A|4C, publication:FP, sourceManifest:FP,
  sourceVerification:FP}]. Each actual publication contains version (or
  siteVersionReceipt) and deployment objects returned by Sites. Each source
  verification has status=passed, publishedCommit, siteVersion, nativeVersion,
  publishedNativeSource, actualGitBlobHashesMatchManifest=true and
  nativeSourceMemberSetExact=true. The 4C verification additionally binds
  previousPublishedCommit and previousPublishedCommitIsAncestor=true.
  publishedPredecessorCommit is the actual final 4C publication. In contrast,
  candidateSourceBaseCommit is the exact candidate archive.baseCommit and
  policy.candidate.sourceBaseCommit: the real HEAD captured by the freezer,
  which may contain 5B commits and an integration merge. Equality with the
  published predecessor is neither required nor synthesized.
  candidateBaseAncestry references logos-engine.lot5b-candidate-base-ancestry.v1:
  status=passed, recordedAt, checkout, candidateArchiveManifest:FP,
  candidateSourceBaseCommit, publishedPredecessorCommit,
  publishedPredecessorIsAncestorOfCandidateBase=true, commands=[...].
  Each command has command (argument array), startedAt, finishedAt, exitCode,
  stdout and stderr (complete captured strings). The three commands, in order,
  are [git,rev-parse,--verify,CANDIDATE^{commit}],
  [git,rev-parse,--verify,PREDECESSOR^{commit}], and
  [git,merge-base,--is-ancestor,PREDECESSOR,CANDIDATE]. Their exit codes must be
  zero, stderr empty, and stdout respectively CANDIDATE + newline,
  PREDECESSOR + newline, and empty. checkout is this actual checkout. The
  commands address immutable commits, so a later documentation-only HEAD
  does not replace the recorded freeze base. This finalizer checks retained
  commands/results and their fingerprints; it does not execute Git.
* --test-scope-plan: logos-engine.lot5b.integrated-test-scope-plan.v1,
  declaredAt, inherited=[{lot:7B|10A|4C,receipt:FP}], addedTestFiles (the four
  5B contracts), testFiles (first-seen ordered union), testFileCount. The 7B
  entry additionally supplies publication:FP with actual version/deployment
  responses and its verified nativeDigest; the two other identities are
  checked against --publication-chain.
* --weav-case-checkpoint: logos-engine.lot5b.weav-case-checkpoint.v1,
  recordedAt, case=WEAV, status=budget_exhausted, totalBudgetSeconds,
  cumulativeSeconds, remainingSeconds=0, clockReset=false,
  newLiveExecutions=0, historicalEvidence=[FP,...], qualification.
* --browser-receipt: an actual logos-engine.browser-qa.v1 receipt outside
  WEAV (declared targetLevels, or scope=controls_only with targetMet=false),
  with observed pause plus resume or one-action control, or an explicit
  logos-engine.lot5b.browser-qualification.v1 with
  recordedAt, status=blocked_infrastructure, nativeDigest, nativeVersion,
  targetMet=false, observedSuccess=false, newLiveExecutions=0,
  infrastructureEvidence=[FP,...], qualification. The latter records an
  observed infrastructure block, never browser success. WEAV is prohibited.
* PERFORMANCE_DIRECTORY/coordinated-isolation.json extends the existing
  logos-engine.coordinated-cost-isolation.v1 receipt with requestedAt,
  requiredQuietLanes, laneAcknowledgements, and ownAgents. Each lane has lot,
  observedAt, activeCommand=null, executionStopped=true, evidence:FP, and
  either acknowledgedAt >= requestedAt or terminalRelease=true. Each own
  agent has id, stoppedAt, activeCommand=null, executionStopped=true and
  evidence:FP. All required lanes and all tracked agents must be listed.
  The receipt and observation times must be fresh under --quiet-max-age-seconds.

FP means {path,sha256,bytes}; existing source-manifest references may omit
bytes. Copies of external cooperation evidence belong inside this checkout.
Immutable external inputs must stay inside the declared baseline checkout.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'docs/migration/lot5b-evidence'
TEST_RUNNER = ROOT / 'scripts/verify-native-delta.py'
COUNT_KEYS = ('tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo')
CHECK_NAMES = ['typecheck', 'entry-audit', 'migration-audit', 'diff-check', 'build']
STRICT_REGRESSION_CHECK_NAMES = [
    'both runs passed with the same declared game and target',
    'same production budgets, source reference and opaque game asset provenance',
    'same complete initial public packet hash and public state',
    'every archived public packet independently hashes to the v53 baseline',
    'every archived host-only command equals its prior baseline command',
    'same commands, complete returned packet hashes, animation lengths and primitive boundaries',
    'same selected family/group/kind/subquestion, acquired prefix lengths and retained solver scalars',
    'same retained coordination source/preferred entries and current guard scope',
    'same historical epoch anchors with session namespace normalized',
    'same inherited source-series event counts on every sealed prefix',
    'same common request outcomes and retained caller acquisition counters',
    'same natural level boundaries and retained-session caller counters',
    'same final public result and retained-session operation counts',
    'same retained mechanical-domain assessments',
    'both source runs remained unchanged and imported no Python agent module',
    'current replay used the declared complete frozen native source',
    'current replay identifies the exact host-only baseline and public trace',
]
ADDED_TESTS = {
    'tests/v6-addressed-material.test.ts',
    'tests/v6-addressed-material-reference.test.ts',
    'tests/v6-addressed-material-kernel.test.ts',
    'tests/v6-field-stock.test.ts',
}
OWNER = 'public_addressed_material'
SHA = re.compile(r'[0-9a-f]{64}')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def local(value):
    path = (ROOT / value).resolve()
    require(path != ROOT and path.is_relative_to(ROOT), 'Path escapes the checkout: ' + str(value))
    return path


def fingerprint(path, external=False):
    path = Path(path).resolve() if external else local(path)
    digest, size = hashlib.sha256(), 0
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
            size += len(chunk)
    return {'path': str(path) if external else path.relative_to(ROOT).as_posix(),
            'sha256': digest.hexdigest(), 'bytes': size}


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'Duplicate JSON member: ' + key)
        result[key] = value
    return result


def invalid_constant(value):
    raise ValueError('Non-finite JSON number: ' + value)


def finite_float(value):
    result = float(value)
    require(math.isfinite(result), 'Non-finite JSON number: ' + value)
    return result


def decode(raw):
    return json.loads(raw, object_pairs_hook=unique_object, parse_constant=invalid_constant, parse_float=finite_float)


def instant(value):
    require(isinstance(value, str), 'Timestamp is not a string')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None, 'Timestamp lacks a timezone: ' + value)
    return result


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def same(left, right):
    """JSON structural equality without Python's bool == integer coercion."""
    if type(left) in (int, float) and type(right) in (int, float):
        return finite(left) and finite(right) and left == right
    if type(left) is not type(right):
        return False
    if isinstance(left, dict):
        return left.keys() == right.keys() and all(same(value, right[key]) for key, value in left.items())
    if isinstance(left, list):
        return len(left) == len(right) and all(same(a, b) for a, b in zip(left, right))
    return left == right


def manifest_valid(value, label):
    files = value.get('files')
    require(isinstance(files, dict) and files and all(isinstance(key, str)
            and isinstance(digest, str) and SHA.fullmatch(digest) for key, digest in files.items()),
            'Invalid source file map: ' + label)
    calculated = hashlib.sha256(json.dumps(dict(sorted(files.items())), separators=(',', ':')).encode()).hexdigest()
    require(type(value.get('fileCount')) is int and value['fileCount'] == len(files)
            and value.get('digest') == calculated, 'Invalid source manifest identity: ' + label)


def counts_valid(counts, label):
    require(isinstance(counts, dict) and set(counts) == set(COUNT_KEYS)
            and all(type(counts[key]) is int for key in COUNT_KEYS)
            and counts['tests'] == counts['pass'] > 0
            and all(counts[key] == 0 for key in COUNT_KEYS[2:]), 'Tests not all passed: ' + label)


class Evidence:
    def __init__(self):
        self.inputs, self.external = {}, {}
        self.baseline = None
        self.timestamps = []

    def keep(self, value):
        actual = fingerprint(value)
        require(self.inputs.setdefault(actual['path'], actual) == actual,
                'Input changed while checking: ' + actual['path'])
        return actual

    def checked(self, record, allow_external=False):
        require(isinstance(record, dict) and isinstance(record.get('path'), str)
                and isinstance(record.get('sha256'), str) and SHA.fullmatch(record['sha256']),
                'Missing valid input fingerprint')
        path = (ROOT / record['path']).resolve()
        if path.is_relative_to(ROOT):
            actual = self.keep(path)
        else:
            require(allow_external and self.baseline is not None and path.is_relative_to(self.baseline),
                    'External input is outside the declared baseline: ' + str(path))
            actual = fingerprint(path, external=True)
            require(self.external.setdefault(actual['path'], actual) == actual, 'External input changed')
        require(actual['sha256'] == record['sha256']
                and ('bytes' not in record or type(record['bytes']) is int and actual['bytes'] == record['bytes']),
                'File fingerprint differs: ' + str(path))
        return path

    def load(self, value):
        path = local(value)
        self.keep(path)
        raw = path.read_bytes()
        return decode(gzip.decompress(raw) if path.suffix == '.gz' else raw)

    def text(self, value):
        path = local(value)
        self.keep(path)
        raw = path.read_bytes()
        return (gzip.decompress(raw) if path.suffix == '.gz' else raw).decode()

    def referenced(self, record, allow_external=False):
        path = self.checked(record, allow_external)
        raw = path.read_bytes()
        return decode(gzip.decompress(raw) if path.suffix == '.gz' else raw)

    def file_map(self, files, label):
        require(isinstance(files, dict) and files, 'Empty file map: ' + label)
        for name, digest in files.items():
            self.checked({'path': name, 'sha256': digest})

    def at(self, value, label):
        result = instant(value)
        self.timestamps.append((result, label))
        return result

    def recheck(self):
        for record in self.inputs.values():
            require(fingerprint(record['path']) == record, 'Input changed before readiness: ' + record['path'])
        for record in self.external.values():
            require(fingerprint(record['path'], external=True) == record,
                    'External input changed before readiness: ' + record['path'])


def no_window(perf, baseline=None):
    names = ['readiness.json', 'window.json', 'superseded-before-measurement.json',
             'combined-comparison.json', 'consolidation-review.json', 'global-budget-decision.json',
             'owner-growth-comparison.json', 'owner-growth-review.json']
    names += [f'cohort{cohort}/{side}.{suffix}' for cohort in (1, 2)
              for side in ('baseline', 'after') for suffix in ('json', 'log', 'log.gz')]
    names += [f'cohort{cohort}/comparison.json' for cohort in (1, 2)]
    directories = [perf]
    if baseline is not None:
        directories.append(baseline / perf.relative_to(ROOT))
    existing = [str(path) for directory in directories for name in names
                if (path := directory / name).exists() or path.is_symlink()]
    require(not existing, 'Readiness/measurement outputs already exist: ' + ', '.join(existing))


def publication_chain(e, path, baseline, policy, archive, archive_record):
    chain = e.load(path)
    require(chain.get('schema') == 'logos-engine.lot5b-published-predecessor-chain.v1'
            and chain.get('status') == 'verified', 'Actual predecessor chain is not verified')
    recorded = e.at(chain['recordedAt'], 'publication chain')
    entries = chain.get('predecessors')
    require(isinstance(entries, list) and [row.get('lot') for row in entries] == ['10A', '4C'],
            'Actual published 10A then 4C predecessors are required')
    identities, previous = [], None
    for row in entries:
        publication = e.referenced(row['publication'])
        manifest = e.referenced(row['sourceManifest'])
        source = e.referenced(row['sourceVerification'])
        manifest_valid(manifest, 'published ' + row['lot'])
        version = publication.get('siteVersionReceipt', publication.get('version'))
        deployment = publication.get('deployment')
        require(isinstance(version, dict) and isinstance(deployment, dict),
                'Raw Sites version and deployment responses are required: ' + row['lot'])
        commit = version.get('source', {}).get('commit_sha')
        number = version.get('version_number')
        require(type(number) is int and number > 0 and isinstance(commit, str)
                and re.fullmatch(r'[0-9a-f]{40}', commit)
                and version.get('project_id') == deployment.get('project_id') == chain.get('projectId')
                and version.get('deployment_id') == deployment.get('id')
                and version.get('id') == deployment.get('version_id')
                and deployment.get('status') == 'succeeded' and deployment.get('type') == 'publish',
                'Publication is not an actual successful deployment: ' + row['lot'])
        require(source.get('status') == 'passed' and source.get('publishedCommit') == commit
                and source.get('siteVersion') == number and source.get('publishedNativeSource') == manifest
                and source.get('actualGitBlobHashesMatchManifest') is True
                and source.get('nativeSourceMemberSetExact') is True
                and re.fullmatch(r'\d+\.\d+\.\d+', source.get('nativeVersion', '')),
                'Published source verification differs from the actual publication: ' + row['lot'])
        published_at = e.at(deployment['updated_at'], row['lot'] + ' actual deployment')
        verified_at = e.at(source['recordedAt'], row['lot'] + ' source verification')
        require(published_at <= verified_at <= recorded, 'Publication/source verification chronology differs')
        identity = {'lot': row['lot'], 'projectId': chain['projectId'], 'siteVersion': number,
                    'commit': commit, 'nativeVersion': source['nativeVersion'],
                    'nativeDigest': manifest['digest'], 'nativeFiles': manifest['fileCount']}
        if previous:
            require(number > previous['siteVersion']
                    and source.get('previousPublishedCommit') == previous['commit']
                    and source.get('previousPublishedCommitIsAncestor') is True,
                    '4C does not verify the actual published 10A ancestor')
        previous = identity
        identities.append(identity)
    require(all(previous[key] == policy['baseline'][key]
                for key in ('siteVersion', 'commit', 'nativeVersion', 'nativeDigest', 'nativeFiles'))
            and previous['nativeDigest'] == baseline['digest']
            and chain.get('publishedPredecessorCommit') == previous['commit'],
            'Final baseline is not the actual published 4C predecessor')
    candidate_base = chain.get('candidateSourceBaseCommit')
    require(isinstance(candidate_base, str) and re.fullmatch(r'[0-9a-f]{40}', candidate_base)
            and candidate_base == archive.get('baseCommit') == policy['candidate']['sourceBaseCommit'],
            'Candidate base differs from the true frozen archive/protocol Git base')
    ancestry_record = chain.get('candidateBaseAncestry')
    ancestry = e.referenced(ancestry_record)
    require(ancestry.get('schema') == 'logos-engine.lot5b-candidate-base-ancestry.v1'
            and ancestry.get('status') == 'passed' and ancestry.get('checkout') == str(ROOT)
            and ancestry.get('candidateArchiveManifest') == archive_record
            and ancestry.get('candidateSourceBaseCommit') == candidate_base
            and ancestry.get('publishedPredecessorCommit') == previous['commit']
            and ancestry.get('publishedPredecessorIsAncestorOfCandidateBase') is True
            and chain.get('publishedPredecessorIsAncestorOfCandidateBase') is True,
            'Candidate base ancestry is not bound to the actual archive and published predecessor')
    e.checked(ancestry['candidateArchiveManifest'])
    expected_commands = [
        (['git', 'rev-parse', '--verify', candidate_base + '^{commit}'], candidate_base + '\n'),
        (['git', 'rev-parse', '--verify', previous['commit'] + '^{commit}'], previous['commit'] + '\n'),
        (['git', 'merge-base', '--is-ancestor', previous['commit'], candidate_base], ''),
    ]
    commands = ancestry.get('commands')
    require(isinstance(commands, list) and len(commands) == len(expected_commands),
            'Candidate ancestry proof omits an actual Git identity or ancestry command')
    prior_finish = None
    for row, (command, stdout) in zip(commands, expected_commands):
        require(row.get('command') == command and type(row.get('exitCode')) is int and row['exitCode'] == 0
                and row.get('stdout') == stdout and row.get('stderr') == '',
                'Retained Git command/result does not verify the declared candidate ancestry')
        started = e.at(row['startedAt'], 'candidate base Git command start')
        finished = e.at(row['finishedAt'], 'candidate base Git command finish')
        require((prior_finish is None or prior_finish <= started) and started <= finished,
                'Candidate ancestry command chronology differs')
        prior_finish = finished
    require(prior_finish <= e.at(ancestry['recordedAt'], 'candidate base ancestry proof') <= recorded,
            'Candidate ancestry proof must precede the completed publication chain')
    versions = [tuple(map(int, row['nativeVersion'].split('.'))) for row in identities]
    versions.append(tuple(map(int, policy['candidate']['nativeVersion'].split('.'))))
    require(versions[0] < versions[1] < versions[2], 'Native versions do not follow the publication order')
    return {'receipt': e.keep(path), 'predecessors': identities, 'candidateSourceBaseCommit': candidate_base,
            'publishedPredecessorCommit': previous['commit'], 'publishedPredecessorIsAncestorOfCandidateBase': True,
            'candidateBaseAncestry': ancestry_record}


def verify_scope(e, path, tests, native_digest, published):
    scope = e.load(path)
    require(scope.get('schema') == 'logos-engine.lot5b.integrated-test-scope-plan.v1', 'Wrong test union schema')
    declared = e.at(scope['declaredAt'], 'test union declaration')
    inherited = scope.get('inherited')
    require(isinstance(inherited, list) and [row.get('lot') for row in inherited] == ['7B', '10A', '4C'],
            'Test union must bind the actual 7B, 10A and 4C receipts in order')
    union, origins = [], []
    for row in inherited:
        receipt = e.referenced(row['receipt'])
        require(receipt.get('schema') == 'logos-engine.native-delta-verification.v1'
                and receipt.get('status') == 'passed' and receipt.get('nativeSourceUnchanged') is True
                and receipt.get('sourceAndTestInputsUnchanged') is True
                and len(receipt.get('checks', [])) == 1, 'Inherited test scope is not a completed passed receipt')
        manifest_valid(receipt['nativeSource'], row['lot'] + ' inherited test source')
        if row['lot'] == '7B':
            publication = e.referenced(row['publication'])
            version = publication.get('siteVersionReceipt', publication.get('version'))
            deployment = publication.get('deployment')
            require(isinstance(version, dict) and isinstance(deployment, dict)
                    and version.get('project_id') == deployment.get('project_id') == published['predecessors'][0]['projectId']
                    and version.get('deployment_id') == deployment.get('id')
                    and version.get('id') == deployment.get('version_id')
                    and deployment.get('status') == 'succeeded' and deployment.get('type') == 'publish'
                    and type(version.get('version_number')) is int
                    and version['version_number'] < published['predecessors'][0]['siteVersion']
                    and publication.get('nativeDigest', publication.get('nativeSourceDigest')) == receipt['nativeSource']['digest'],
                    '7B inherited tests are not bound to their actual publication')
        else:
            predecessor = next(item for item in published['predecessors'] if item['lot'] == row['lot'])
            require(receipt['nativeSource']['digest'] == predecessor['nativeDigest'],
                    'Inherited tests do not use the actually published ' + row['lot'] + ' native source')
        require(receipt['nativeSourceManifestDigest'] == receipt['nativeSource']['digest'],
                'Inherited test manifest identity differs')
        files = receipt.get('testFiles')
        require(isinstance(files, list) and files and len(files) == len(set(files)), 'Inherited test file list is incomplete')
        check = receipt['checks'][0]
        require(check.get('exitCode') == 0 and check.get('tapSummaryComplete') is True,
                'Inherited tests did not complete')
        counts_valid(check.get('counts'), row['lot'])
        require(e.at(check['finishedAt'], row['lot'] + ' inherited tests') <= declared,
                'Test union predates an inherited result')
        added = [name for name in files if name not in union]
        union.extend(added)
        origins.append({'lot': row['lot'], 'receipt': row['receipt'], 'testFiles': len(files), 'newFilesInUnion': len(added)})
    added = scope.get('addedTestFiles')
    require(isinstance(added, list) and len(added) == len(set(added)) and set(added) == ADDED_TESTS,
            'The four declared 5B contracts are not exactly present')
    require(not set(added) & set(union), 'A claimed new 5B contract already occurs in the inherited scope')
    union.extend(added)
    require(scope.get('testFiles') == tests.get('testFiles') == union
            and type(scope.get('testFileCount')) is int and scope['testFileCount'] == len(union),
            'Formal test scope differs from the computed ordered union')
    check = tests['checks'][0]
    require(declared <= e.at(check['startedAt'], 'formal tests started'), 'Formal tests precede their declared scope')
    require(tests['nativeSourceManifestDigest'] == native_digest, 'Test union uses another native freeze')
    for name in union:
        require(isinstance(name, str) and name.startswith('tests/') and name.endswith('.test.ts'), 'Unexpected test path')
        e.keep(name)
    return {'receipt': e.keep(path), 'inherited': origins, 'addedTestFiles': added, 'testFileCount': len(union)}


def verify_oracle(e, path, expected_mode, original_count):
    receipt = e.load(path)
    require(receipt.get('schema') == 'logos-engine.independent-python-oracle-export.v1'
            and receipt.get('status') == 'passed' and receipt.get('mode') == expected_mode
            and receipt.get('sourceInventoryUnchanged') is True
            and receipt.get('sourceInventorySha256Before') == receipt.get('sourceInventorySha256After')
            and receipt.get('sourceFilesVerifiedBefore') == receipt.get('sourceFilesVerifiedAfter') == original_count,
            'Independent original export is incomplete or names another source inventory')
    e.at(receipt['recordedAt'], 'original export')
    e.checked(receipt['exporter'])
    pinned = e.referenced(receipt['sourceManifest'])
    modules = receipt.get('importedOriginalModules')
    require(isinstance(modules, dict) and modules, 'Original exporter has no imported source inventory')
    for name, record in modules.items():
        source = e.checked(record)
        marker = '/source/'
        require(marker in record['path'] and '/source/agents/' in record['path'], 'Unexpected original source path')
        member = record['path'].split(marker, 1)[1]
        require(pinned['files'][member]['sha256'] == record['sha256'], 'Original module differs from its pinned manifest: ' + name)
    require(set(receipt.get('directModules', [])) <= modules.keys(), 'A direct source module was not verified')
    for name, row in receipt.get('directSourceBeforeAfter', {}).items():
        require(name in modules and row['path'] == modules[name]['path']
                and row['sha256Before'] == row['sha256After'] == modules[name]['sha256'], 'Original direct source changed')
    fixture = e.referenced(receipt['fixture'])
    raw = local(receipt['fixture']['path']).read_bytes()
    require(receipt['fixture'].get('uncompressedBytes') == len(gzip.decompress(raw)), 'Original fixture size differs')
    require(fixture.get('schema') == 'logos-engine.v6.addressed-material-reference.v1'
            and fixture.get('mode') == expected_mode and fixture.get('referenceCommit') == receipt.get('referenceCommit'),
            'Wrong independent original fixture')
    counts = {'helpers': len(fixture['helpers']), 'coldChains': len(fixture['chains']),
              'chainOperations': sum(len(row['operations']) for row in fixture['chains']),
              'sourceExceptions': len(fixture['exceptions'])}
    require(receipt.get('counts') == counts and counts['coldChains'] > 0 and counts['chainOperations'] > 0,
            'Original export counts differ from its fixture')
    exceptions = [row for chain in fixture['chains'] for row in chain['operations'] if 'exception' in row]
    exceptions += [row for row in fixture['helpers'] if 'exception' in row]
    require(len(exceptions) == counts['sourceExceptions'], 'Original exception population differs')
    for record in receipt.get('inputJournals', []):
        e.checked(record)
    return receipt, fixture, counts


def verify_common(e, directory, role, native, original_count):
    directory = local(directory)
    proof = e.load(directory / 'common-loop.json.gz')
    journal = e.load(directory / 'actual-operations.json')
    comparison = e.load(directory / 'original-comparison.json')
    exported, fixture, counts = verify_oracle(e, directory / 'original-export.json', 'captured-public-journals', original_count)
    require(proof.get('schema') == 'logos-engine.addressed-material-common-loop.v1'
            and proof.get('status') == 'passed' and proof.get('synthetic') is True
            and proof.get('nativeSource') == native and proof.get('sourceUnchangedDuringRun') is True
            and proof.get('executionInputsUnchangedDuringRun') is True and proof.get('sourceDeclarationsModified') is False,
            'Common proof is incomplete or uses a development source: ' + role)
    require(proof['checks']['failures'] == [] and proof['checks']['passed'] == len(proof['checks']['names']) > 0,
            'Common proof retains failures: ' + role)
    mode = {'positive': 'positive', 'negative': 'navigation-no-effect', 'stock': 'stock-preservation-refusal'}[role]
    require(proof.get('mode') == mode and proof.get('proofContract', {}).get('id') == mode,
            'Common proof uses another predeclared contract: ' + role)
    plan_record = proof['proofContract']['plan']
    plan = e.referenced(plan_record)
    require(plan.get('schema') == 'logos-engine.lot5b-common-proof-plan.v1'
            and plan.get('productionChangesForStockStop') is False and plan.get('ownerPriorityChanges') is False
            and plan.get('publicResponsesChangedToAvoidRefusal') is False
            and plan_record in proof['executionInputs'], 'Common proof changed priority/public responses or omitted its frozen plan')
    planned = [row for row in plan['finalContracts'] if row['id'] == mode and row['chainId'] == proof['chainId']]
    started = e.load(directory / 'execution-started.json')
    require(started.get('schema') == 'logos-engine.addressed-material-common-execution-start.v1'
            and started.get('nativeDigest') == native['digest'] and started.get('mode') == mode
            and started.get('chainId') == proof['chainId'] and started.get('startedAt') == proof['startedAt']
            and started.get('proofPlan') == plan_record and started.get('executedDriver') == proof['executedDriver'],
            'Durable common execution-start receipt differs from its final report')
    require(len(planned) == 1 and e.at(plan['declaredAt'], 'common proof contract')
            <= e.at(proof['startedAt'], role + ' common execution start')
            <= e.at(proof['finishedAt'], role + ' common execution finish') <= instant(exported['recordedAt']),
            'The final common contract was not predeclared')
    public_path = proof.get('publicPath')
    require(isinstance(public_path, dict) and public_path.get('declaredStages') == len(proof['publicTable']) > 0
            and type(public_path.get('completedStages')) is int
            and public_path['completedStages'] == proof['sourceStages']
            and 0 <= public_path['completedStages'] <= public_path['declaredStages']
            and public_path.get('complete') is (public_path['completedStages'] == public_path['declaredStages'])
            and comparison.get('publicPath') == public_path, 'Declared/completed common path populations differ')
    for record in proof['executionInputs']:
        e.checked(record)
    e.checked(proof['executedDriver'])
    require(journal.get('schema') == 'logos-engine.addressed-material-public-operations.v1'
            and journal.get('chainId') == proof.get('chainId') and journal.get('mode') == proof.get('mode'),
            'Actual common journal identity differs: ' + role)
    require(comparison.get('schema') == 'logos-engine.addressed-material-common-original-comparison.v1'
            and comparison.get('status') == 'passed' and comparison.get('nativeSourceDigest') == native['digest']
            and comparison.get('inputsUnchanged') is True and comparison.get('coldOriginal') is True
            and comparison.get('nativeResultsUsedAsOracleInputs') is False,
            'Independent comparison is incomplete: ' + role)
    require(instant(exported['recordedAt']) <= e.at(comparison['recordedAt'], role + ' common original comparison'),
            'Original comparison precedes its replay')
    required_paths = {e.keep(directory / name)['path'] for name in ('common-loop.json.gz', 'actual-operations.json',
                      'original-export.json', 'original-replay.json.gz')}
    require(required_paths <= {row['path'] for row in comparison['inputs']}, 'Comparison omits actual proof or original journal')
    for record in comparison['inputs']:
        e.checked(record)
    checks = comparison['checks']
    require(checks['total'] == checks['passed'] == len(checks['items']) > 0 and checks['failed'] == 0
            and all(row.get('passed') is True for row in checks['items']), 'Comparison retains failed checks')
    require(local(exported['fixture']['path']) == directory / 'original-replay.json.gz', 'Replay filename is not the compared original')
    journal_record = e.keep(directory / 'actual-operations.json')
    chains = [chain for chain in fixture['chains'] if chain.get('inputJournal', {}).get('path') == journal_record['path']]
    require(len(chains) == 1, 'Original replay must bind one actual operation journal')
    chain = chains[0]
    require(chain['inputJournal']['sha256'] == journal_record['sha256']
            and chain['inputJournal'].get('nativeResultsConsulted') is False,
            'Original replay consulted native results or another journal')
    initial = chain['initialState']
    require(all(initial.get(key) is None for key in ('model', 'stock', 'prior'))
            and initial.get('samples') == [] and initial.get('passed') == [], 'Original owner did not begin cold')
    operations = journal['operations']
    require(len(operations) == len(chain['operations']) == comparison['operations'] > 0, 'Operation population differs')
    for index, (actual, expected) in enumerate(zip(operations, chain['operations'])):
        label = role + ' operation ' + str(index)
        original_input = {key: value for key, value in expected['input'].items() if key != 'proposal'}
        require(expected.get('journalOperation') == index and expected.get('capturedMethod') == actual['method']
                and same(original_input, actual['input'])
                and expected.get('useLatestSourceProposal') is actual.get('useLatestSourceProposal', False),
                'Actual public arguments differ: ' + label)
        require(same(actual['native'].get('exception'), expected.get('exception'))
                and same(actual['native']['state'], expected['state']), 'Source exception/state differs: ' + label)
        if 'exception' not in expected:
            require(same(actual['native']['result'], expected['result']), 'Original result differs: ' + label)
            if actual['method'] == 'bind':
                def points(value):
                    return [{key: step[key] for key in ('action', 'locus_witness', 'point_binding') if key in step}
                            for step in value['steps']]
                require(same(points(actual['native']['proposalAfterBind']), points(expected['proposalAfterBind'])),
                        'Exact source point binding differs: ' + label)
    records = [row for row in operations if row['method'] == 'record']
    selected = [row for row in records if row.get('useLatestSourceProposal') is True]
    require(len(records) == proof['returned'] == comparison['actualReturns'] > 0
            and len(selected) == proof['ownReturns'] == comparison['selectedReturns'] > 0
            and len(records) - len(selected) == comparison['passiveReturns'] > 0
            and len({row['input']['before']['observation_ref'] for row in records}) == len(records),
            'Selected/passive acquisitions are duplicated or incomplete')
    require(proof['checkpoints'] and proof['restores']
            and all(row['state'].get('schema') == 'logos-engine.addressed-material.v1' for row in proof['checkpoints'])
            and all(same(row['input'], row['output']) for row in proof['restores']),
            'Native checkpoints/restorations are incomplete')
    history = proof['history']
    require(len(history) == len(records) and sum(row['own'] is True for row in history) == len(selected)
            and sum(row['stock'] is True for row in history) == proof['stockReturns'] == comparison['stockReturns']
            and sum(row['ownPath'] is True for row in history) == proof['ownPathReturns'] == comparison['navigationReturns'],
            'Selected navigation/stock counters differ from the acquired common history')
    preservation_result = None
    if role == 'negative':
        proposals = [row for row in operations if row['method'] == 'propose']
        require(proof['mode'] == 'navigation-no-effect' and proof['finalOwner'].get('model') is None
                and records[-1]['native']['result'].get('status') == 'field_refuted'
                and proposals and proposals[-1]['native']['result'] is None,
                'Negative actual return did not change the following owner decision')
    elif role == 'positive':
        require(public_path['complete'] is True and public_path['preservationRefusal'] is False
                and proof['ownPathReturns'] == comparison['navigationReturns'] > 0
                and any(row['planned'] >= 2 and row['nextIndex'] == row['fromIndex'] + 1
                        for row in proof['continuations']), 'Same-prefix click-path continuation is unproven')
    else:
        require(planned[0].get('fullStockTraversalClaimed') is False
                and public_path['complete'] is False and public_path['preservationRefusal'] is True
                and proof['stockReturns'] >= 2 and proof['next'].get('kind') == 'stopped'
                and proof['next'].get('reason') == 'frontier_preservation_conflict',
                'Bounded stock proof does not retain the actual source preservation stop')
        event_kinds = {event.get('kind') for row in selected for event in row['native']['result'].get('events', [])}
        require({'observed_joint_material_rewrite', 'typed_material_relocated_to_address'} <= event_kinds,
                'Stock did not actually acquire both a material rewrite and an addressed relocation')
        obligation = operations[-1]
        calls = proof.get('protectionCalls', [])
        require(obligation['method'] == 'preservation_obligations' and obligation['native']['result']
                and len(calls) >= 2, 'Current stock obligations and the two actual refusals are missing')
        for call in calls[-2:]:
            proposal = call['input']['proposal']
            require(same(call['input']['obligations'], obligation['native']['result'])
                    and proposal.get('actions') and 'field_plan' not in proposal and 'preservation_changes' not in proposal
                    and same(call['result'][1], proposal['actions']), 'Actual earlier-provider refusal differs from its obligation')
        require(same(calls[-2]['input']['proposal']['actions'], calls[-1]['input']['proposal']['actions']),
                'The two retained refusals concern different actual commands')
        failed = plan.get('retainedFailedStockAttempts', [])
        require(failed and len({row['path'] for row in failed}) == len(failed), 'Prior failed stock attempts are not retained')
        for record in failed:
            diagnostic = e.referenced(record)
            require(diagnostic.get('schema') == 'logos-engine.addressed-material-common-loop.v1'
                    and diagnostic.get('status') == 'failed' and diagnostic.get('checks', {}).get('failures'),
                    'A historical full-stock failure was relabeled or omitted')
        original_diagnostic = e.referenced(plan['originalPreservationDiagnostic'])
        require(original_diagnostic.get('schema') == 'logos-engine.addressed-preservation-source-diagnostic.v1'
                and original_diagnostic.get('status') == 'confirmed_source_provider_and_source_refusal'
                and original_diagnostic.get('failedCommonRunStatusUnchanged') == 'failed',
                'Historical original-provider diagnostic no longer retains its failed common run')
        for record in [*original_diagnostic['inputs'], *original_diagnostic['originalAgentInputs']]:
            e.checked(record)
        preservation_path = directory / 'original-preservation-comparison.json'
        preservation = e.load(preservation_path)
        require(preservation.get('schema') == 'logos-engine.addressed-preservation-original-comparison.v1'
                and preservation.get('status') == 'passed' and preservation.get('nativeSourceDigest') == native['digest']
                and preservation.get('sourceCommit') == exported['referenceCommit']
                and preservation.get('inputsUnchanged') is True and preservation.get('sourceInventoryUnchanged') is True
                and preservation.get('sourceFilesVerifiedBefore') == preservation.get('sourceFilesVerifiedAfter') == original_count
                and preservation.get('sourceInventorySha256Before') == preservation.get('sourceInventorySha256After')
                and preservation.get('proofContract') == proof['proofContract']
                and preservation.get('fullOriginalCallerClaimed') is False
                and preservation.get('fullStockTraversalClaimed') is False
                and preservation.get('failedCommonRunPromoted') is False
                and preservation.get('nativeResultsUsedAsOracleInputs') is False,
                'Independent original preservation comparison is incomplete or broadens its contract')
        common_record = preservation['common']
        require(common_record.get('status') == 'passed' and common_record.get('mode') == mode
                and common_record.get('chainId') == proof['chainId']
                and common_record.get('reason') == proof['next']['reason'] and common_record.get('publicPath') == public_path,
                'Original preservation comparison names another common outcome')
        require(e.checked(common_record) == directory / 'common-loop.json.gz'
                and e.checked(preservation['journal']) == directory / 'actual-operations.json'
                and preservation['executedDriver'] == proof['executedDriver'], 'Original preservation comparison names another actual run')
        for record in preservation['inputs']:
            e.checked(record)
        require({journal_record['path'], e.keep(directory / 'common-loop.json.gz')['path'], plan_record['path']}
                <= {row['path'] for row in preservation['inputs']}, 'Preservation comparison omits the actual journal/plan')
        for record in preservation['importedOriginalModules'].values():
            e.checked(record)
        pc = preservation['checks']
        require(pc['total'] == pc['passed'] == len(pc['items']) > 0 and pc['failed'] == 0
                and all(row.get('passed') is True for row in pc['items']), 'Original preservation retains failed comparisons')
        populations = preservation['populations']
        require(populations['actualReturns'] == len(records) and populations['actualOwnerOperations'] == len(operations)
                and populations['actualStockReturns'] == proof['stockReturns']
                and populations['selectedServiceReturns'] + populations['passiveServiceReturns'] == len(records),
                'Original provider replay omitted actual acquired returns')
        provider = preservation['providerComparison']
        omitted = ['strategy_receipt', 'morphology', 'field_subquestion']
        projected = {key: value for key, value in calls[-1]['input']['proposal'].items() if key not in omitted}
        projected_hash = hashlib.sha256(json.dumps(projected, sort_keys=True, separators=(',', ':'),
                                                  ensure_ascii=True, allow_nan=False).encode()).hexdigest()
        require(provider.get('originalEqualsNativeProvider') is True
                and provider.get('nativeProjectionOmittedKeys') == omitted
                and same(provider.get('originalResult'), projected)
                and provider['originalResultSha256'] == provider['nativeProviderProjectionSha256']
                == projected_hash, 'Original provider did not reconstruct the refused native proposal')
        compared = preservation['preservationComparisons']
        require(populations['protectionCallsCompared'] == len(compared) == 2
                and preservation.get('digestEncoding') == 'python-json-sort-keys-compact-ensure-ascii',
                'Original preservation does not compare the two actual final refusals')
        expected_pointers = [f'/protectionCalls/{index}/input' for index in range(len(calls) - len(compared), len(calls))]
        require([row['exactInputPointer'] for row in compared] == expected_pointers, 'Refusal input pointers differ from the actual final calls')
        for row, call in zip(compared, calls[-len(compared):]):
            canonical = json.dumps(call['input'], sort_keys=True, separators=(',', ':'), ensure_ascii=True, allow_nan=False).encode()
            returned_hash = hashlib.sha256(json.dumps(call['result'], sort_keys=True, separators=(',', ':'),
                                                     ensure_ascii=True, allow_nan=False).encode()).hexdigest()
            require(row.get('originalEqualsNative') is True
                    and row.get('digestEncoding') == preservation['digestEncoding']
                    and row.get('exactInputSha256') == hashlib.sha256(canonical).hexdigest()
                    and row.get('originalResultSha256') == row.get('nativeResultSha256') == returned_hash
                    and row.get('authorizedRevision') is False
                    and same(row.get('rejected'), call['input']['proposal']['actions']),
                    'Original preservation comparison changed or omitted an exact actual input')
        require(e.at(preservation['startedAt'], 'original preservation replay start')
                <= e.at(preservation['finishedAt'], 'original preservation replay finish')
                <= e.at(preservation['recordedAt'], 'original preservation comparison'), 'Preservation comparison chronology differs')
        preservation_result = {'receipt': e.keep(preservation_path), 'checks': pc['total'],
                               'fullStockTraversalClaimed': False, 'retainedFailedAttempts': len(failed)}
    return {'role': role, 'proof': e.keep(directory / 'common-loop.json.gz'),
            'comparison': e.keep(directory / 'original-comparison.json'), 'operations': len(operations),
            'actualReturns': len(records), 'selectedReturns': len(selected), 'passiveReturns': len(records) - len(selected),
            'originalChecks': checks['total'], 'checkpointPrefixes': len(proof['checkpoints']),
            'restorations': len(proof['restores']), 'proofContract': proof['proofContract'], 'publicPath': public_path,
            'originalPreservation': preservation_result, 'synthetic': True, 'newGameSuccessClaimed': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--performance-directory', type=Path, required=True)
    parser.add_argument('--candidate-source-directory', type=Path, required=True)
    parser.add_argument('--validation-directory', type=Path, default=Path('validation'))
    parser.add_argument('--test-scope-plan', type=Path, required=True)
    parser.add_argument('--publication-chain', type=Path, required=True)
    parser.add_argument('--oracle-export-receipt', type=Path, required=True)
    parser.add_argument('--common-positive-directory', type=Path, required=True)
    parser.add_argument('--common-negative-directory', type=Path, required=True)
    parser.add_argument('--common-stock-directory', type=Path, required=True)
    parser.add_argument('--browser-receipt', type=Path, required=True)
    parser.add_argument('--weav-case-checkpoint', type=Path, required=True)
    parser.add_argument('--audit-receipt', type=Path)
    parser.add_argument('--quiet-max-age-seconds', type=float, default=900,
                        help='Maximum age of fresh quiet observations; recorded in readiness (default: 900).')
    args = parser.parse_args()
    perf, candidate_dir = local(args.performance_directory), local(args.candidate_source_directory)
    require(perf.is_relative_to(BASE) and candidate_dir.is_relative_to(BASE), 'Expected final 5B evidence directories')
    require(finite(args.quiet_max_age_seconds) and 0 < args.quiet_max_age_seconds <= 3600, 'Invalid quiet freshness interval')
    validation = (candidate_dir / args.validation_directory).resolve()
    require(validation.is_relative_to(candidate_dir), 'Validation directory escapes final evidence')
    no_window(perf)
    e = Evidence()
    e.keep(__file__)
    declaration = e.load(perf / 'declaration.json')
    policy = e.load(perf / 'global-budget-policy.json')
    preparation = e.load(perf / 'preparation.json')
    protocol = e.load(perf / 'protocol-check.json')
    require(declaration.get('schema') == 'logos-engine.native-cost-protocol-declaration.v2'
            and declaration.get('status') == 'declared_before_official_window'
            and declaration.get('noOfficialWindowAtDeclaration') is True
            and declaration.get('functionalReadinessNotAnticipated') is True
            and preparation.get('status') == 'source_freezes_verified_not_functional_readiness'
            and preparation.get('measurementExecuted') is False, 'Protocol was not finalized before measurement')
    e.baseline = Path(preparation['baselineCheckout']).resolve()
    require(e.baseline != ROOT and preparation['candidateCheckout'] == str(ROOT), 'Wrong declared checkout pair')
    no_window(perf, e.baseline)
    for key in ('protocol', 'cases', 'diagnosticComparisonPolicy', 'globalBudgetPolicy', 'baselineManifest',
                'candidateManifest', 'candidateArchiveManifest', 'globalDecisionTool', 'globalCalculationTool'):
        e.checked(declaration[key])
    for record in declaration['officialTools']:
        e.checked(record)
    require(local(declaration['candidateManifest']['path']) == candidate_dir / 'source-manifest.json'
            and local(declaration['candidateArchiveManifest']['path']) == candidate_dir / 'source-archive.json',
            'Final evidence directory differs from the protocol')
    native = e.referenced(declaration['candidateManifest'])
    baseline = e.referenced(declaration['baselineManifest'])
    digest = native['digest']
    for role, manifest in (('baseline', baseline), ('candidate', native)):
        manifest_valid(manifest, role)
        require(declaration[role] == policy[role] == preparation[role]
                and declaration['nativeDigests'][role] == policy[role]['nativeDigest'] == manifest['digest']
                and policy[role]['nativeFiles'] == manifest['fileCount']
                and re.fullmatch(r'\d+\.\d+\.\d+', policy[role]['nativeVersion']), 'Declared source identities differ')
    require(digest != baseline['digest'], 'Candidate and baseline have identical native source')
    actual = {path.relative_to(ROOT).as_posix(): e.keep(path)['sha256']
              for folder in ('src/logos-engine', 'src/runtime') for path in (ROOT / folder).rglob('*')
              if path.is_file() and path.suffix in ('.ts', '.json', '.drm')}
    require(actual == native['files'], 'Current native source differs from its final freeze')
    baseline_actual = {}
    for folder in ('src/logos-engine', 'src/runtime'):
        for path in (e.baseline / folder).rglob('*'):
            if path.is_file() and path.suffix in ('.ts', '.json', '.drm'):
                record = fingerprint(path, external=True)
                e.checked(record, allow_external=True)
                baseline_actual[path.relative_to(e.baseline).as_posix()] = record['sha256']
    require(baseline_actual == baseline['files'], 'Actual baseline checkout differs from its published freeze')
    versions = re.findall(r"NATIVE_V6_IMPLEMENTATION\s*=\s*['\"]logos-engine\.typescript\.v6\.native-migration/([^'\"]+)['\"]",
                          e.text('src/logos-engine/v6-native-runtime.ts'))
    require(versions == [policy['candidate']['nativeVersion']], 'Actual native version differs from the declaration')
    archive = e.referenced(declaration['candidateArchiveManifest'])
    published = publication_chain(e, args.publication_chain, baseline, policy, archive, declaration['candidateArchiveManifest'])
    parts = e.load(candidate_dir / 'source-archive-parts.json')
    require(archive.get('nativeSourceManifestDigest') == digest
            and archive.get('baseCommit') == policy['candidate']['sourceBaseCommit']
            and all(archive['files'].get(name) == sha for name, sha in native['files'].items()),
            'Frozen archive does not contain the integrated native source')
    e.checked(archive['archive'])
    e.file_map(archive['files'], 'frozen source archive')
    require(parts.get('original') == archive['archive'] and parts.get('parts'), 'Frozen archive parts have another identity')
    packed_hash, packed_bytes = hashlib.sha256(), 0
    for record in parts['parts']:
        path = e.checked(record)
        with path.open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                packed_hash.update(chunk)
                packed_bytes += len(chunk)
    require(packed_hash.hexdigest() == archive['archive']['sha256'] and packed_bytes == archive['archive']['bytes'],
            'Frozen archive parts do not reconstruct the same bytes')
    require(protocol.get('status') == 'protocol_contract_passed' and protocol['nativeDigests'] == declaration['nativeDigests'],
            'Protocol check names another source pair')
    require(policy.get('globalStage') == 'session_elapsed' and policy.get('relativeIncreaseLimit') == 0.1
            and policy.get('comparison') == 'strictly_less_than' and policy.get('allCasesMustPass') is True
            and policy.get('crossCaseCompensation') is False and policy.get('phaseOverrunsMayBeAccepted') is True
            and policy.get('phasesAndP95RemainVisible') is True and declaration.get('phaseOverrunsBlockAcceptance') is False,
            'The retained global cost rule or visibility of phase overruns changed')
    require(e.at(preparation['preparedAt'], 'source preparation') == e.at(policy['declaredAt'], 'global policy')
            <= e.at(declaration['recordedAt'], 'protocol recording') <= instant(declaration['finalizedAt']),
            'Source preparation/protocol chronology differs')

    tests, checks = [e.load(validation / name) for name in ('delta-tests-run.json', 'checks-run.json')]
    for receipt in (tests, checks):
        require(receipt.get('schema') == 'logos-engine.native-delta-verification.v1' and receipt.get('status') == 'passed'
                and receipt.get('generator') == e.keep(TEST_RUNNER) and receipt.get('nativeSource') == native
                and receipt.get('nativeSourceManifestDigest') == digest and receipt.get('nativeSourceUnchanged') is True,
                'Formal verification is incomplete or names another final freeze')
        for row in receipt['checks']:
            require(type(row.get('exitCode')) is int and row['exitCode'] == 0, 'A formal check failed')
            require(e.at(row['startedAt'], row['name'] + ' start') <= e.at(row['finishedAt'], row['name'] + ' finish'),
                    'Formal check chronology is invalid')
            e.checked(row['output'])
    require(len(tests['checks']) == 1 and tests['checks'][0]['name'] == 'delta-tests'
            and tests.get('sourceAndTestInputsUnchanged') is True and tests['checks'][0].get('tapSummaryComplete') is True,
            'Formal test receipt is incomplete')
    e.file_map(tests['sourceAndTestInputs'], 'formal source and test inputs')
    scope = verify_scope(e, args.test_scope_plan, tests, digest, published)
    counts = tests['checks'][0]['counts']
    counts_valid(counts, 'integrated 5B')
    tap = e.text(tests['checks'][0]['output']['path'])
    require(all(re.findall(r'^# ' + key + r' (\d+)\s*$', tap, re.M) == [str(counts[key])] for key in COUNT_KEYS),
            'Formal counts differ from actual retained TAP')
    require(tests['checks'][0]['command'] == ['node', '--test', '--test-concurrency=1', '--test-reporter=tap', *tests['testFiles']],
            'Formal command differs from the declared union')
    require([row['name'] for row in checks['checks']] == CHECK_NAMES, 'Exactly the five retained release checks are required')
    e.checked(checks['nativeAgentWorker'])
    e.file_map(checks['buildInputs'], 'build inputs')
    if args.audit_receipt:
        audit_receipt = e.load(args.audit_receipt)
        require(audit_receipt.get('status') == 'passed' and audit_receipt.get('exitCode') == 0
                and audit_receipt.get('nativeSourceDigest') == digest, 'Audit resolution is not passed for the final source')
        audit = e.referenced(audit_receipt['output'])
        require(audit == audit_receipt['audit'], 'Audit resolution differs from its actual log')
    else:
        audit = e.referenced(checks['checks'][2]['output'])
    require(audit.get('failures') == [], 'Migration audit retains unresolved failures')

    regression_path = candidate_dir / 'regressions/regression-summary.json'
    regression = e.load(regression_path)
    require(regression.get('schema') == 'logos-engine.recorded-public-regressions.v1'
            and regression.get('status') == 'passed' and regression.get('nativeSource') == native
            and regression.get('nativeSourceAfter') == native and regression.get('executionInputsUnchanged') is True
            and regression.get('executionInputs') == regression.get('executionInputsAfter')
            and regression.get('passed') == regression.get('total') == len(regression['results']) > 0,
            'Retained strict regressions are incomplete or failed; no silent qualification is allowed')
    case_manifest = e.referenced(regression['caseManifest'])
    declared_cases = case_manifest.get('cases', [])
    require(case_manifest.get('schema') == 'logos-engine.recorded-public-regression-cases.v1'
            and declared_cases and len({row['id'] for row in declared_cases}) == len(declared_cases)
            and [row['case'] for row in regression['results']] == [row['id'] for row in declared_cases]
            and regression.get('passiveOwnerRequirements') == case_manifest.get('passiveOwnerRequirements', []),
            'Strict regression population/order differs from the retained case manifest')
    e.file_map(regression['executionInputs'], 'regression execution inputs')
    comparison_count = 0
    for declared_case, row in zip(declared_cases, regression['results']):
        require(row.get('status') == 'passed' and row.get('passed') is True and row.get('exitCode') == 0
                and row.get('timedOut') is False and row.get('comparisonPassed') is True and row.get('failedChecks') == []
                and row.get('nativeSourceBeforeDigest') == row.get('nativeSourceAfterDigest') == digest
                and row.get('nativeSourceUnchanged') is True and row.get('immutableInputsUnchanged') is True,
                'A strict regression failed or its inputs changed')
        require(row.get('game') == declared_case['game'] and row.get('mode') == 'recorded-public-replay'
                and all(row[key]['path'] == declared_case[key]['path']
                        and row[key]['sha256'] == declared_case[key]['sha256'] for key in ('baseline', 'trace')),
                'A strict replay used another game, baseline or archived public trace')
        require(e.at(row['startedAt'], row['case'] + ' replay started')
                <= e.at(row['finishedAt'], row['case'] + ' replay finished')
                <= e.at(row['postprocessingFinishedAt'], row['case'] + ' comparison finished'),
                'Regression execution/comparison chronology differs')
        for key in ('baseline', 'trace', 'output', 'report', 'comparison', 'execution', 'passiveOwnerPresence'):
            e.checked(row[key])
        comparison = e.referenced(row['comparison'])
        require(comparison.get('schema') == 'logos-engine.scoped-public-regression-comparison.v1'
                and comparison.get('game') == declared_case['game'] and comparison.get('passed') is True
                and [item['name'] for item in comparison['checks']] == STRICT_REGRESSION_CHECK_NAMES
                and len(comparison['checks']) == row['comparisonChecks']
                and all(item.get('passed') is True for item in comparison['checks']), 'A strict comparison is incomplete')
        for comparison_key, row_key in (('before', 'baseline'), ('after', 'report'), ('trace', 'trace')):
            e.checked(comparison[comparison_key])
            require(all(comparison[comparison_key][key] == row[row_key][key] for key in ('path', 'sha256')),
                    'Strict comparison fingerprint differs from its actual replay')
        metadata = comparison['legacyComparatorMetadata']
        e.checked(metadata['implementation'])
        require(metadata.get('checkLabelsPreserved') is True and comparison['after'].get('sourceDigest') == digest,
                'Retained strict comparator labels or final source identity changed')
        presence = e.referenced(row['passiveOwnerPresence'])
        require(presence.get('passed') is True and presence.get('report') == row['report']
                and presence.get('caseManifest') == regression['caseManifest'], 'Passive owner evidence does not bind its replay')
        comparison_count += row['comparisonChecks']
    require(comparison_count == regression['comparisonChecksPassed'] == regression['comparisonChecksExpected'],
            'Strict regression check counts differ')
    integrity = e.load(candidate_dir / 'delivery-integrity.json')
    require(integrity.get('schema') == 'logos-engine.native-delivery-integrity.v1' and integrity.get('status') == 'passed'
            and integrity.get('nativeSourceDigest') == digest and integrity.get('tests') == counts
            and type(integrity.get('originalSourceFilesUnchanged')) is int and integrity['originalSourceFilesUnchanged'] > 0
            and integrity['sourceArchiveVerification'].get('byteIdentical') is True
            and integrity.get('nativeAgentWorker') == checks['nativeAgentWorker'], 'Final delivery integrity is incomplete')
    e.at(integrity['recordedAt'], 'delivery integrity')
    required = {e.keep(path)['path'] for path in [candidate_dir / 'source-manifest.json', candidate_dir / 'source-archive.json',
                candidate_dir / 'source-archive-parts.json', regression_path, validation / 'delta-tests-run.json', validation / 'checks-run.json']}
    require(required <= {row['path'] for row in integrity['receipts']}, 'Delivery integrity omits required inputs')
    for record in [integrity['generator'], *integrity['verificationHelpers'], *integrity['receipts']]:
        e.checked(record)
    original_count = integrity['originalSourceFilesUnchanged']
    exported, fixture, oracle_counts = verify_oracle(e, args.oracle_export_receipt, 'declared-synthetic-public-returns', original_count)
    require(exported['inputJournals'] == [] and oracle_counts['helpers'] > 0, 'Cold component oracle is not independently declared')
    oracle_names = ['addressed material original helper: ' + row['id'] for row in fixture['helpers']]
    oracle_names += ['addressed material original cold chain and native restoration: ' + row['id'] for row in fixture['chains']]
    for name in oracle_names:
        require(len(re.findall(r'^ok \d+ - ' + re.escape(name) + r'\s*$', tap, re.M)) == 1,
                'Formal TAP omits or duplicates original parity case: ' + name)
    common_paths = [args.common_positive_directory, args.common_negative_directory, args.common_stock_directory]
    require(len({local(path) for path in common_paths}) == len(common_paths), 'Common proof roles reuse the same directory')
    common = [verify_common(e, path, role, native, original_count)
              for role, path in zip(('positive', 'negative', 'stock'), common_paths)]

    weav = e.load(args.weav_case_checkpoint)
    require(weav.get('schema') == 'logos-engine.lot5b.weav-case-checkpoint.v1' and weav.get('case') == 'WEAV'
            and weav.get('status') == 'budget_exhausted' and weav.get('clockReset') is False
            and type(weav.get('newLiveExecutions')) is int and weav['newLiveExecutions'] == 0
            and finite(weav.get('totalBudgetSeconds')) and weav['totalBudgetSeconds'] > 0
            and finite(weav.get('cumulativeSeconds')) and weav['cumulativeSeconds'] >= weav['totalBudgetSeconds']
            and finite(weav.get('remainingSeconds')) and weav['remainingSeconds'] == 0
            and weav.get('historicalEvidence') and weav.get('qualification'), 'WEAV exhausted cumulative clock is not preserved')
    e.at(weav['recordedAt'], 'WEAV cumulative checkpoint')
    for record in weav['historicalEvidence']:
        e.checked(record)
    browser = e.load(args.browser_receipt)
    require(browser.get('nativeDigest') == digest and browser.get('nativeVersion') == policy['candidate']['nativeVersion']
            and isinstance(browser.get('qualification'), str) and browser['qualification'].strip(),
            'Browser qualification does not bind the final candidate')
    e.at(browser['recordedAt'], 'browser status')
    if browser.get('schema') == 'logos-engine.lot5b.browser-qualification.v1':
        require(browser.get('status') == 'blocked_infrastructure' and browser.get('game') != 'WEAV'
                and browser.get('targetMet') is False and browser.get('observedSuccess') is False
                and type(browser.get('newLiveExecutions')) is int and browser['newLiveExecutions'] == 0
                and browser.get('infrastructureEvidence'), 'Unexecuted browser reserve lacks an actual infrastructure block')
        for record in browser['infrastructureEvidence']:
            e.checked(record)
        browser_status = {'status': browser['status'], 'observed': False, 'targetMet': False, 'qualification': browser['qualification']}
    else:
        require(browser.get('schema') == 'logos-engine.browser-qa.v1'
                and isinstance(browser.get('game'), str) and browser['game'] and browser['game'] != 'WEAV'
                and browser.get('learnedStateInjected') is False and browser.get('startLevel') == 1
                and browser.get('artifacts') and browser.get('pause', {}).get('observed')
                and (browser.get('oneAction', {}).get('observed') or browser.get('resume', {}).get('observed')),
                'Actual browser evidence is missing or attempts exhausted WEAV')
        for record in browser['artifacts']:
            e.checked(record)
        require(type(browser.get('final', {}).get('levels')) is int and browser['final']['levels'] >= 0
                and type(browser['final'].get('actions')) is int and browser['final']['actions'] >= 0,
                'Actual browser final population is missing')
        if browser.get('scope') == 'controls_only':
            require(browser.get('targetMet') is False and browser.get('targetLevels') is None,
                    'Controls-only browser evidence claims a game target')
        else:
            require(type(browser.get('targetLevels')) is int and browser['targetLevels'] > 0
                    and browser.get('targetMet') is (browser['final']['levels'] >= browser['targetLevels']),
                    'Browser target claim differs from its observed result')
        browser_status = {'status': 'observed', 'observed': True, 'game': browser['game'], 'final': browser['final'],
                          'scope': browser.get('scope', 'declared_game_target'),
                          'targetMet': browser['targetMet'], 'qualification': browser['qualification']}

    static = e.load(perf / 'static-preflight.json')
    require(static.get('status') == 'static_inputs_checked' and static.get('measurementExecuted') is False
            and static.get('checkedCount') == len(static['checks']) > 0 and static.get('unsatisfied') == []
            and all(row.get('satisfied') is True for row in static['checks'])
            and static.get('declaration') == e.keep(perf / 'declaration.json')
            and static.get('candidateFreeze') == declaration['candidateManifest']
            and static.get('protocolCheck') == e.keep(perf / 'protocol-check.json'), 'Static preflight is incomplete')
    for key in ('generator', 'adaptedFrom', 'preparationTool'):
        e.checked(static[key])
    qualification = declaration.get('ownerCostQualification')
    require(isinstance(qualification, dict) and qualification.get('schema') == 'logos-engine.lot5b-owner-cost-qualification.v1',
            'Predeclared added-owner cost contract is missing')
    contract_path = local(qualification['contractPath'])
    contract = e.load(contract_path)
    require(contract_path.parent == perf and contract.get('schema') == 'logos-engine.lot5b-owner-cost-contract.v2'
            and contract.get('lot') == '5B' and contract.get('declaration') == e.keep(perf / 'declaration.json')
            and contract.get('tools') == qualification['tools'] == static.get('ownerCostTools')
            and static.get('ownerCostContract') == e.keep(contract_path)
            and contract['structuralExpectation'].get('ownerId') == OWNER,
            'Owner cost contract differs from its predeclared identity')
    e.keep(BASE / 'finalize-owner-cost-contract.py')
    for record in [*contract['tools'].values(), contract['ownerInventory'], *contract['sourceEvidence'], contract['structuralFixture']]:
        e.checked(record)
    structural = e.referenced(contract['structuralFixture'])
    attribution = e.referenced(structural['attribution'])
    inventory = e.referenced(contract['ownerInventory'])
    require(inventory.get('schema') == 'logos-engine.lot5b-owner-cost-source-inventory.v1'
            and inventory.get('programScope') == 'family-installed programs'
            and inventory.get('nativeDigests') == declaration['nativeDigests']
            and inventory.get('changes') == {'ownersAdded': [OWNER], 'ownersRemoved': [], 'programsAdded': [], 'programsRemoved': []}
            and [owner for owner in inventory['owners']['candidate'] if owner != OWNER] == inventory['owners']['baseline']
            and inventory['owners']['candidate'].count(OWNER) == 1
            and inventory['programs']['candidate'] == inventory['programs']['baseline'],
            'Source inventory does not preserve the existing common owner/program order')
    e.checked(inventory['generator'])
    e.checked(inventory['derivedFrom'])
    for role, manifest in (('baseline', baseline), ('candidate', native)):
        source = inventory['sourceInventory'][role]
        require(source['native'] == manifest and source.get('runtimeUninitializedBeforeAndAfter') is True,
                'Owner inventory is not tied to a cold, final source factory')
        for record in source['sourceInputs']:
            e.checked({**record, 'path': str((Path(source['checkout']) / record['path']).resolve())}, allow_external=True)
    require(static.get('ownerStructuralFixture') == contract['structuralFixture']
            and structural.get('schema') == 'logos-engine.lot5b-owner-cost-structural-fixture.v1'
            and attribution.get('schema') == 'logos-engine.lot5b-owner-cost-structural-attribution.v1'
            and structural.get('status') == attribution.get('status') == 'qualified_functional_structure'
            and structural.get('nativeDigests') == attribution.get('nativeDigests') == declaration['nativeDigests']
            and structural.get('cases') == declaration['cases'], 'Owner structural qualification differs from the frozen source pair')
    require(attribution.get('checkedCount') == len(attribution['checks']) > 0
            and all(row.get('passed') is True for row in attribution['checks']) and attribution.get('nodeAttributions')
            and attribution.get('formsSha256') == hashlib.sha256(json.dumps(structural['forms'], sort_keys=True,
                separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()).hexdigest(),
            'Owner structural forms or attribution checks differ')
    for record in [structural['cases'], structural['captureTool'], attribution['generator'], *attribution['inputs'],
                   *[item for role in ('baseline', 'candidate') for item in structural['captures'][role].values()]]:
        e.checked(record, allow_external=True)
    e.checked(attribution['derivedFrom'])
    for role, manifest in (('baseline', baseline), ('candidate', native)):
        capture = structural['captures'][role]
        receipt = e.referenced(capture['receipt'], allow_external=True)
        require(receipt.get('schema') == 'logos-engine.lot5b-owner-cost-functional-capture-receipt.v1'
                and receipt.get('status') == 'captured_functional_structure' and receipt.get('role') == role
                and receipt.get('ownerId') == OWNER and receipt.get('nativeDigest') == manifest['digest']
                and receipt.get('acquisitionMode') == 'one_passive_source_envelope_per_actual_return'
                and receipt.get('report') == capture['report'] and receipt.get('generator') == structural['captureTool']
                and receipt.get('generator') == receipt.get('generatorAfter')
                and receipt.get('inputsBefore') == receipt.get('inputsAfter')
                and receipt.get('nativeInventoryBefore') == receipt.get('nativeInventoryAfter') == manifest
                and all(receipt.get(key) is True for key in ('nativeSourceUnchanged', 'inputsUnchanged', 'generatorUnchanged'))
                and receipt.get('failures') == [], 'Functional capture changed or omitted source acquisitions')
        require(e.at(receipt['startedAt'], role + ' structure capture start')
                <= e.at(receipt['finishedAt'], role + ' structure capture finish') <= instant(attribution['recordedAt']),
                'Structural attribution precedes a functional capture')
        for record in receipt['inputsBefore']:
            e.checked(record, allow_external=True)
    coverage = attribution['sourceFactCoverage']
    require([(row['case'], row['form'], row['pointIndex']) for row in coverage]
            == [(row['case'], row['form'], row['pointIndex']) for row in attribution['points']],
            'Structural source-fact coverage omits a captured graph')
    for form in structural['forms']:
        rows = [row for row in coverage if (row['case'], row['form']) == (form['case'], form['form'])]
        require(rows and len(rows) == len(form['candidate']['requests']) + len(form['candidate']['inspection'])
                and [row['pointIndex'] for row in rows] == list(range(len(rows)))
                and rows[-1]['acquiredReturns'] == form['candidate']['actions'], 'Structural capture omits an acquired prefix')
        for row in rows:
            require(type(row['acquiredReturns']) is int and row['acquiredReturns'] >= 0
                    and row['persistedSourceFacts'] == row['acquiredReturns']
                    and row['sourceCallIndices'] == list(range(row['acquiredReturns'])),
                    'An actual source acquisition lacks its complete retained envelope')
    require(e.at(declaration['finalizedAt'], 'declaration') <= e.at(contract['declaredAt'], 'owner cost contract')
            <= e.at(static['recordedAt'], 'static preflight'), 'Cost contract/preflight chronology differs')
    require(e.at(attribution['recordedAt'], 'structure attribution') <= e.at(structural['recordedAt'], 'structure fixture')
            <= instant(contract['declaredAt']), 'Functional structure was not fixed before the cost contract')
    require(e.at(inventory['recordedAt'], 'owner source inventory') <= instant(contract['declaredAt']),
            'Owner inventory was not fixed before the cost contract')

    isolation = e.load(perf / 'coordinated-isolation.json')
    require(isolation.get('schema') == 'logos-engine.coordinated-cost-isolation.v1'
            and isolation.get('status') == 'acknowledged_quiet_before_window'
            and isolation.get('otherLaneAcknowledged') is True and isolation.get('ownTrackedComputeEnded') is True
            and isolation.get('previewStopped') is True and isolation.get('costNodeOptionsOverride') is None,
            'Cooperative quiet interval is not acknowledged')
    requested = e.at(isolation['requestedAt'], 'quiet request')
    recorded = e.at(isolation['recordedAt'], 'quiet receipt')
    require(requested <= recorded and isolation.get('evidence'), 'Quiet request/evidence is missing')
    for record in isolation['evidence']:
        e.checked(record)
    lanes = isolation.get('laneAcknowledgements', [])
    required_lanes = isolation.get('requiredQuietLanes', [])
    require(required_lanes and len(required_lanes) == len(set(required_lanes))
            and len(lanes) == len(required_lanes) and {row['lot'] for row in lanes} == set(required_lanes)
            and {'10A', '4C'} <= set(required_lanes), 'Known concurrent lanes are not completely accounted for')
    observed = []
    for row in lanes:
        require(row.get('activeCommand') is None and row.get('executionStopped') is True,
                'Another lane retains active execution: ' + row['lot'])
        e.checked(row['evidence'])
        timestamp = e.at(row['observedAt'], row['lot'] + ' quiet observation')
        require(requested <= timestamp <= recorded, 'Lane evidence was not freshly observed after the quiet request')
        if row.get('terminalRelease') is not True:
            require(requested <= e.at(row['acknowledgedAt'], row['lot'] + ' quiet acknowledgement') <= timestamp,
                    'Active lane acknowledgement predates this quiet request')
        else:
            require(isinstance(row.get('releaseStatement'), str) and row['releaseStatement'].strip(),
                    'Terminal lane release lacks its actual statement')
        observed.append(timestamp)
    agents = isolation.get('ownAgents', [])
    tracked = isolation.get('trackedAgentIds', [])
    require(agents and tracked and len(tracked) == len(set(tracked)) and len(agents) == len(tracked)
            and {row['id'] for row in agents} == set(tracked), 'Own tracked execution agents are not completely accounted for')
    for row in agents:
        require(row.get('activeCommand') is None and row.get('executionStopped') is True, 'An own agent retains active execution')
        e.checked(row['evidence'])
        require(e.at(row['stoppedAt'], row['id'] + ' compute ended') <= recorded, 'Own compute ended after the quiet receipt')
    e.recheck()
    finalized = datetime.now(timezone.utc)
    require(all(timestamp <= finalized for timestamp, label in e.timestamps), 'Some retained evidence is dated after readiness')
    require(all(0 <= (finalized - timestamp).total_seconds() <= args.quiet_max_age_seconds
                for timestamp in [recorded, *observed]), 'Quiet evidence has become stale; reread and retain fresh cooperation evidence')
    no_window(perf, e.baseline)
    output = perf / 'readiness.json'
    value = {'schema': 'logos-engine.native-cost-window-readiness.v1', 'status': 'ready',
             'finalizedAt': finalized.isoformat(), 'measurementAuthorized': True, 'pendingRequirements': [],
             'generator': e.keep(__file__), 'nativeVersion': policy['candidate']['nativeVersion'],
             'nativeSourceDigest': digest, 'baseline': policy['baseline'], 'candidate': policy['candidate'],
             'publishedPredecessors': published, 'formalTests': counts, 'formalTestFiles': len(tests['testFiles']),
             'testScope': scope, 'regressionChecks': comparison_count,
             'componentOracle': {'receipt': e.keep(args.oracle_export_receipt), **oracle_counts,
                                 'formalNamedParityCases': len(oracle_names), 'nativeRestorationIsExtension': True},
             'commonProofs': common, 'newGameSuccessClaimed': False,
             'browser': {'receipt': e.keep(args.browser_receipt), **browser_status},
             'weav': {'checkpoint': e.keep(args.weav_case_checkpoint), 'cumulativeSeconds': weav['cumulativeSeconds'],
                      'remainingSeconds': weav['remainingSeconds'], 'clockReset': False, 'newLiveExecutions': 0,
                      'qualification': weav['qualification']},
             'ownerCostContract': e.keep(contract_path), 'historicalStrictIdentityNotAnticipated': True,
             'inputs': list(e.inputs.values()), 'watchedExternalInputs': list(e.external.values()),
             'isolation': isolation, 'quietMaximumAgeSeconds': args.quiet_max_age_seconds,
             'qualification': 'Actual published 10A then 4C precede the integrated 5B freeze. The derived test union, '
                 'five checks, strict recorded regressions, immutable archive and delivery integrity, cold original '
                 'component oracle, and three actual common operation journals with independent original replay '
                 'are bound before this window. Native checkpoint/restoration remains an extension. Synthetic '
                 'proofs establish no new game success or live latency result. Browser results or an explicit '
                 'unexecuted reserve are retained as observed; the exhausted cumulative WEAV clock is not reset. '
                 'Fresh cooperative acknowledgements and ended tracked execution establish the declared quiet '
                 'interval. No measurement or future publication is represented as completed by this receipt.'}
    with output.open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    print(json.dumps({'status': 'ready', 'receipt': fingerprint(output), 'formalTestFiles': len(tests['testFiles']),
                      'componentOracle': oracle_counts, 'newGameSuccessClaimed': False}))


if __name__ == '__main__':
    main()
