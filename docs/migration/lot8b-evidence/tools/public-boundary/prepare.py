#!/usr/bin/env python3
"""Freeze public-boundary inputs after static review, without starting a runtime."""
import ast
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[5]
BASE = ROOT / 'docs/migration/lot8b-evidence/public-boundary-01'
TOOLS = ROOT / 'docs/migration/lot8b-evidence/tools/public-boundary'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def info(name):
    path = ROOT / name
    data = path.read_bytes()
    return {'path': name, 'bytes': len(data), 'sha256': sha(data)}


def main():
    declaration_name = str((BASE / 'declaration.json').relative_to(ROOT))
    declaration = json.loads((ROOT / declaration_name).read_text())
    assert declaration['plannedSessions'] == 3
    assert declaration['plannedPhysicalReturns'] == 18
    assert declaration['caseIds'] == ['single-positive', 'triple-prefix', 'contrary-return']
    assert declaration['publishedSourceCommit'] == '8462204043aa368faa7df280d796bb706eb53b38'
    assert declaration['publicBudgets'] == {
        'targetLevels': 3, 'levelActionCaps': [24, 24, 24], 'maxActions': 72}
    assert declaration['officialPerformanceMeasurement'] is False
    assert declaration['globalLockRequired'] is False
    native = json.loads((ROOT / declaration['candidateNativePath']).read_text())
    assert native['fileCount'] == len(native['files']) == 331
    assert native['digest'] == 'c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a'
    for name, expected in native['files'].items():
        assert info(name)['sha256'] == expected, name
    build = json.loads((ROOT / declaration['buildManifestPath']).read_text())
    assert build['nativeDigest'] == native['digest']
    assert build['fileCount'] == len(build['files']) == 74
    for row in build['files']:
        assert info(row['path']) == row, row['path']
    runtime_names = [name for name in declaration['inputs'] if name.startswith('src/runtime/')]
    source_bindings = []
    for name in runtime_names:
        published = subprocess.check_output(
            ['git', 'show', declaration['publishedSourceCommit'] + ':' + name], cwd=ROOT)
        actual = info(name)
        assert actual['sha256'] == sha(published), name
        source_bindings.append(actual)
    fixture = info('tests/fixtures/v6-branch-routing-reference.json')
    assert fixture['sha256'] == 'e6ae197b7b982bd41f561b9df8e458436d7ce0797f39bbf86d972e55472b6769'
    review_name = str((BASE / 'environment-static-review.json').relative_to(ROOT))
    review = json.loads((ROOT / review_name).read_text())
    assert review['status'] == 'passed_static_review'
    assert review['runtimeExecuted'] is False
    for expected in review['inputs']:
        assert info(expected['path']) == expected, expected['path']
    scripts = sorted(path for path in TOOLS.iterdir() if path.suffix in ('.mjs', '.py'))
    checks = []
    for path in scripts:
        name = str(path.relative_to(ROOT))
        if path.suffix == '.py':
            ast.parse(path.read_text(), filename=name)
            checks.append({'path': name, 'method': 'ast.parse_without_import', 'passed': True})
        else:
            checked = subprocess.run(['node', '--check', str(path)], cwd=ROOT,
                                     capture_output=True, text=True, timeout=20)
            checks.append({'path': name, 'method': 'node --check',
                           'exitCode': checked.returncode,
                           'stdout': checked.stdout, 'stderr': checked.stderr})
            assert checked.returncode == 0, name
    names = sorted(set(declaration['inputs']) | set(native['files'])
                   | {row['path'] for row in build['files']}
                   | {str(path.relative_to(ROOT)) for path in scripts}
                   | {declaration_name, declaration['candidateNativePath'],
                      declaration['buildManifestPath'], review_name})
    result = {
        'schema': 'logos-engine.lot8b.public-boundary-preflight.v1',
        'status': 'ready_for_bounded_functional_capture',
        'recordedAt': datetime.now(timezone.utc).isoformat(),
        'sourceHeadAtPreparation': subprocess.check_output(
            ['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'publishedSourceCommit': declaration['publishedSourceCommit'],
        'nativeFileCount': 331, 'nativeDigest': native['digest'],
        'buildFileCount': 74, 'publishedRuntimeSourceBindings': source_bindings,
        'inputs': [info(name) for name in names], 'syntaxChecks': checks,
        'runtimeExecuted': False, 'globalLockAcquired': False,
        'officialPerformanceMeasurement': False, 'publicationPerformed': False,
    }
    with (BASE / 'preflight.json').open('x') as stream:
        json.dump(result, stream, indent=2, ensure_ascii=False)
        stream.write('\n')
    print(json.dumps({'status': result['status'], 'inputs': len(result['inputs']),
                      'nativeFiles': 331, 'buildFiles': 74, 'syntaxChecks': len(checks)}))


if __name__ == '__main__':
    main()
