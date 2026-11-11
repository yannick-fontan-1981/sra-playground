#!/usr/bin/env python3
"""Prepare 5B declarations from published receipts and restore missing input bytes only.

No test, agent, oracle, game, native module, Git command or replay is executed.
The historical 4C case pins are copied exactly; Site92 is publication provenance.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[4]
BASE = ROOT / 'docs/migration/lot5b-evidence'
COORD = BASE / 'coordination'
FINAL = BASE / 'integrated-final'
OUTPUTS = [COORD / 'integrated-test-scope-plan.json', FINAL / 'regression-cases.json',
           COORD / 'integrated-input-reconstruction.json']
ADDED = ['tests/v6-addressed-material-reference.test.ts', 'tests/v6-addressed-material.test.ts',
         'tests/v6-field-stock.test.ts', 'tests/v6-addressed-material-kernel.test.ts']
EXPECTED_GAMES = ['CATR', 'RSWP', 'FOGW', 'VOIS', 'CONN', 'MIND', 'WEAV', 'TRIA', 'CRAF', 'ISOS']


def now():
    return datetime.now(timezone.utc).isoformat()


def require(value, message):
    if not value:
        raise ValueError(message)


def local(value):
    result = (ROOT / value).resolve()
    require(result.is_relative_to(ROOT) and result != ROOT, 'Path escapes checkout')
    return result


def fp(value):
    path = local(value)
    digest = hashlib.sha256()
    size = 0
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
            size += len(block)
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': digest.hexdigest(), 'bytes': size}


inputs = {}


def keep(value):
    record = fp(value)
    require(inputs.setdefault(record['path'], record) == record, 'Input changed during preparation')
    return record


def load(value):
    keep(value)
    return json.loads(local(value).read_bytes())


def checked(record):
    actual = keep(record['path'])
    require(actual['sha256'] == record['sha256'] and
            ('bytes' not in record or actual['bytes'] == record['bytes']), 'Fingerprint differs: ' + record['path'])
    return actual


def write_new(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n')


started = now()
require(not any(path.exists() for path in OUTPUTS), 'A final preparation output already exists')
keep(__file__)
publication7_path = COORD / 'published-7b-site89.json'
publication7_bytes = Path('/workspace/shared/sra-coordination/published-7b-site89.json').read_bytes()
if publication7_path.exists():
    require(publication7_path.read_bytes() == publication7_bytes, 'Retained 7B publication differs')
else:
    with publication7_path.open('xb') as stream:
        stream.write(publication7_bytes)
publication7 = load(publication7_path)
publication4 = load(COORD / 'published-4c-site92.json')
verification4 = load(COORD / 'published-4c-source-verification.json')
verification10 = load(COORD / 'published-10a-source-verification.json')
published_commit = 'd06620d1e4ca2c9758cc693b1ced9eeeddccb7e6'
require(publication4['version']['version_number'] == 92 and
        publication4['version']['source']['commit_sha'] == verification4['publishedCommit'] == published_commit and
        publication4['deployment']['status'] == 'succeeded' and verification4['status'] == 'passed' and
        verification4['nativeVersion'] == '0.57.0' and verification4['siteVersion'] == 92,
        'Expected the actual succeeded Site92 publication and verified native0.57 source')
publication_identity = {
    'siteVersion': 92, 'nativeVersion': verification4['nativeVersion'], 'commit': published_commit,
    'nativeDigest': verification4['publishedNativeSource']['digest'],
    'publication': keep(COORD / 'published-4c-site92.json'),
    'sourceVerification': keep(COORD / 'published-4c-source-verification.json'),
}
inherited, union, origins, receipts = [], [], [], {}
for lot in ('7B', '10A', '4C'):
    path = f'docs/migration/lot{lot.lower()}-evidence/integrated-final/validation/delta-tests-run.json'
    receipt = load(path)
    require(receipt['schema'] == 'logos-engine.native-delta-verification.v1' and receipt['status'] == 'passed'
            and receipt['nativeSourceUnchanged'] is True and receipt['sourceAndTestInputsUnchanged'] is True,
            'Inherited test receipt did not pass: ' + lot)
    require(len(receipt['checks']) == 1 and receipt['checks'][0]['exitCode'] == 0
            and receipt['checks'][0]['tapSummaryComplete'] is True, 'Inherited test run incomplete: ' + lot)
    counts = receipt['checks'][0]['counts']
    require(counts['tests'] == counts['pass'] > 0 and all(counts[k] == 0 for k in ('fail', 'cancelled', 'skipped', 'todo')),
            'Inherited test count failed: ' + lot)
    expected = (publication7['nativeDigest'] if lot == '7B' else
                (verification10 if lot == '10A' else verification4)['publishedNativeSource']['digest'])
    require(receipt['nativeSource']['digest'] == receipt['nativeSourceManifestDigest'] == expected,
            'Inherited test source differs from actual publication: ' + lot)
    files = receipt['testFiles']
    require(files and len(files) == len(set(files)), 'Inherited scope has duplicates')
    appended = [path for path in files if path not in union]
    union.extend(appended)
    origins.append({'lot': lot, 'testFiles': len(files), 'newFilesInUnion': len(appended), 'appended': appended})
    inherited.append({'lot': lot, 'receipt': keep(path),
                      **({'publication': keep(publication7_path)} if lot == '7B' else {})})
    receipts[lot] = receipt
require(not set(ADDED) & set(union), 'New 5B file already belongs to inherited scope')
union.extend(ADDED)
require(len(union) == len(set(union)) == 125, 'Actual inherited union differs from expected 125 files')
require(all(local(path).is_file() for path in union), 'A declared test source is missing')

manifest_path = 'docs/migration/lot4c-evidence/recorded-regression-cases-final.json'
manifest4 = load(manifest_path)
summary_path = 'docs/migration/lot4c-evidence/integrated-final/regressions/regression-summary.json'
summary4 = load(summary_path)
publication_gate4 = load('docs/migration/lot4c-evidence/integrated-final/publication-inputs.json')
require(publication_gate4['status'] == 'passed' and publication_gate4['nativeSourceDigest'] == publication_identity['nativeDigest'],
        '4C publication inputs use another native identity')
published_inputs = {row['path']: row for row in publication_gate4['inputs']}
for path in (manifest_path, summary_path, inherited[-1]['receipt']['path']):
    checked(published_inputs[path])
checked(summary4['caseManifest'])
require(summary4['caseManifest']['path'] == manifest_path and summary4['status'] == 'passed'
        and summary4['nativeSource']['digest'] == publication_identity['nativeDigest'], 'Published 4C regression provenance differs')
require(manifest4['schema'] == 'logos-engine.recorded-public-regression-cases.v1' and
        [row['game'] for row in manifest4['cases']] == EXPECTED_GAMES and
        [row['case'] for row in summary4['results']] == [row['id'] for row in manifest4['cases']], 'Published case population differs')
comparator_path = 'scripts/compare-v54-regressions.py'
keep(comparator_path)
labels = re.findall(r"^\s*same\('([^']+)'", local(comparator_path).read_text(), re.M)
require(len(labels) == len(set(labels)) == 17, 'Strict comparator no longer has exactly 17 distinct labels')
for row, case in zip(summary4['results'], manifest4['cases']):
    require(row['status'] == 'passed' and row['comparisonChecks'] == 17 and row['failedChecks'] == []
            and row['game'] == case['game'], 'Published regression did not pass unchanged strict comparison')
    for field in ('baseline', 'trace'):
        require(set(case[field]) == {'path', 'sha256'} and all(row[field][key] == case[field][key] for key in case[field]),
                'Published case pin differs from its actual 4C execution')
    comparison = load(row['comparison']['path'])
    checked(row['comparison'])
    require([check['name'] for check in comparison['checks']] == labels and all(check['passed'] for check in comparison['checks']),
            'Published comparison labels differ')

parts_path = ROOT / 'scripts/evidence-byte-parts.py'
keep(parts_path)
keep('scripts/restore-v53-evidence.py')
spec = importlib.util.spec_from_file_location('lot5b_exact_byte_transport', parts_path)
transport = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transport)
restored = []


def ensure_input(path):
    target = local(path)
    if target.exists():
        return
    parts = target.with_name(target.name + '.parts.json')
    require(parts.is_file(), 'Missing input has no retained byte parts: ' + path)
    description = load(parts)
    require(description['original']['file'] == target.name, 'Parts identify another file')
    for part in description['parts']:
        checked({'path': (parts.parent / part['file']).relative_to(ROOT).as_posix(),
                 'bytes': part['bytes'], 'sha256': part['sha256']})
    result = transport.verify(parts, restore=True, directory=parts.parent)
    require(result['restored'] is True, 'Missing input was not restored')
    actual = checked({'path': path, 'bytes': description['original']['bytes'], 'sha256': description['original']['sha256']})
    restored.append({'input': actual, 'partsManifest': keep(parts), 'partCount': len(description['parts']),
                     'helperResult': result, 'sourceResultRegenerated': False})


regression_inputs = []
for case in manifest4['cases']:
    for field in ('baseline', 'trace'):
        ensure_input(case[field]['path'])
        regression_inputs.append({'case': case['id'], 'kind': field, **checked(case[field])})

# Inherited source/test receipts enumerate their whole fixture inventory. Only
# missing fixture files would be restored; no inherited source is overwritten.
fixture_map = {}
for receipt in receipts.values():
    fixture_map.update({path: digest for path, digest in receipt['sourceAndTestInputs'].items()
                        if path.startswith('tests/fixtures/')})
for path, digest in fixture_map.items():
    ensure_input(path)
    checked({'path': path, 'sha256': digest})
own_fixture = load('docs/migration/lot5b-evidence/diagnostic/source-oracle-export.json')['fixture']
checked(own_fixture)

# This bounded static scan reads literal URL tokens only, never executes tests
# or follows dynamic/indirect URL bases. Keep that limitation in the receipt.
literal_pattern = re.compile(r'''new\s+URL\(\s*(['"])([^'"\r\n]*)\1\s*,\s*import\.meta\.url\s*\)''')
literal_inputs = []
for name in union:
    for _, token in literal_pattern.findall(local(name).read_text()):
        if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', token):
            continue
        target = (local(name).parent / token).resolve()
        require(target.is_relative_to(ROOT), 'Static literal URL escapes checkout')
        relative = target.relative_to(ROOT).as_posix()
        if not target.exists():
            ensure_input(relative)
        literal_inputs.append({'test': name, 'literal': token, 'path': relative, 'kind': 'directory' if target.is_dir() else 'file'})

for record in inputs.values():
    require(fp(record['path']) == record, 'Prepared input changed before declaration: ' + record['path'])
declared = now()
scope = {'schema': 'logos-engine.lot5b.integrated-test-scope-plan.v1', 'declaredAt': declared,
         'status': 'declared_before_integrated_tests', 'inherited': inherited, 'addedTestFiles': ADDED,
         'testFiles': union, 'testFileCount': len(union), 'origins': origins,
         'publishedPredecessor': publication_identity,
         'qualification': 'First-seen ordered union of actual published 7B, 10A and 4C test receipts, then the four 5B contracts. '
             'No inherited passed count is a 5B result. Candidate source freeze and all formal execution remain to be performed.'}
cases = {'schema': manifest4['schema'], 'declaredAt': declared, 'cases': manifest4['cases'],
         'passiveOwnerRequirements': manifest4.get('passiveOwnerRequirements', []),
         'inheritedCaseManifest': keep(manifest_path), 'inheritedRegressionSummary': keep(summary_path),
         'publishedProvenance': publication_identity, 'strictComparator': keep(comparator_path),
         'strictComparisonCheckNames': labels, 'expectedChecksPerCase': 17, 'expectedComparisonChecks': 170,
         'qualification': 'The ten case IDs, games, historical baseline pins and public traces are copied exactly from the actual '
             'Site92 4C declaration and verified against its completed executions. Site92/native0.57 is integration/publication '
             'provenance, not a relabelling of historical baselines. No 4C final replay is substituted as a new baseline. '
             'The same 17 scoped comparisons apply; no new live success, speed result, complete original-caller parity or '
             'new-family state equality is claimed. WEAV cumulative budget is unchanged.'}
write_new(OUTPUTS[0], scope)
write_new(OUTPUTS[1], cases)
receipt = {'schema': 'logos-engine.lot5b-integrated-input-preparation.v1', 'status': 'inputs_prepared_and_verified',
           'startedAt': started, 'finishedAt': now(), 'generator': keep(__file__),
           'coordination': {'lock': '/workspace/shared/sra-coordination/performance.lock', 'mode': 'shared'},
           'publishedPredecessor': publication_identity, 'scope': fp(OUTPUTS[0]), 'caseManifest': fp(OUTPUTS[1]),
           'testFiles': len(union), 'cases': len(manifest4['cases']), 'plannedStrictChecks': 170,
           'casePinsCopiedExactly': cases['cases'] == manifest4['cases'],
           'restoredMissingInputs': restored, 'verifiedRegressionInputs': regression_inputs,
           'inheritedFixtureFilesVerified': len(fixture_map), 'ownFixture': checked(own_fixture),
           'staticLiteralUrlInputs': literal_inputs, 'missingStaticLiteralUrlInputs': [],
           'staticScanQualification': 'Literal new URL(token, import.meta.url) paths in the 125 test files only; indirect/dynamic bases are outside this bounded scan.',
           'copiedSmallPublicationReceipt': {'from': '/workspace/shared/sra-coordination/published-7b-site89.json', 'to': keep(publication7_path), 'byteIdentical': True},
           'inputs': list(inputs.values()), 'inputsUnchanged': True,
           'testsExecuted': False, 'oraclesExecuted': False, 'replaysExecuted': False, 'gamesExecuted': False,
           'nativeSourceModified': False, 'gitExecuted': False, 'futureSiteVersionAnticipated': False,
           'qualification': 'Metadata declaration and exact byte reconstruction only. Existing differing inputs are refused; no existing evidence is overwritten and no agent result is regenerated. This is not functional validation.'}
write_new(OUTPUTS[2], receipt)
print(json.dumps({'status': receipt['status'], 'testFiles': len(union), 'cases': len(cases['cases']),
                  'restored': [row['input']['path'] for row in restored], 'receipt': fp(OUTPUTS[2]),
                  'scope': fp(OUTPUTS[0]), 'caseManifest': fp(OUTPUTS[1])}))
