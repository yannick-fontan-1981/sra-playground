#!/usr/bin/env python3
"""Read-only final 0.68 build or official-helper archive reconciliation.

Does not build, execute native code, acquire a lock or publish. Every receipt
is created exclusively, including a failed verification. The archive format
is the Sites helper's staging layout: dist files plus dist/.openai/hosting.json.
"""
from datetime import datetime, timezone
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tarfile
import time
import traceback

ROOT = Path(__file__).resolve().parents[4]
DELIVERY = ROOT / 'docs/migration/lot9a-evidence/delivery-final-068-01'


def fingerprint(path):
    data = Path(path).read_bytes()
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    output = (ROOT / args.output).resolve()
    assert output.is_relative_to(ROOT / 'docs/migration/lot9a-evidence')
    assert not output.exists()
    output.parent.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    row = {'schema': 'logos-engine.lot9a.final-build-archive-verification.v1',
           'startedAt': datetime.now(timezone.utc).isoformat(),
           'status': 'running', 'mode': 'archive' if args.archive else 'build',
           'nativeExecutionPerformed': False, 'buildRepeated': False,
           'lockAcquired': False, 'publicationPerformed': False,
           'generator': {'path': str(Path(__file__).relative_to(ROOT)), **fingerprint(__file__)}}
    with output.open('x') as stream:
        stream.write(json.dumps(row, indent=2) + '\n')
    exit_code = 1
    try:
        manifest_path = DELIVERY / 'build-manifest.json'
        manifest = json.loads(manifest_path.read_bytes())
        assert manifest['nativeVersion'] == '0.68.0'
        assert manifest['nativeDigest'] == 'e7a94fbc7cdcb19d8704b5d4120f27a858cbcd07e455084711510ee147f4e653'
        current = {p.relative_to(ROOT / 'dist').as_posix(): fingerprint(p)
                   for p in sorted((ROOT / 'dist').rglob('*')) if p.is_file()}
        assert current == manifest['files'], 'Current build differs from qualified final 0.68 manifest'
        assert len(current) == manifest['fileCount'] == 74
        assert sum(p['bytes'] for p in current.values()) == manifest['totalBytes'] == 30149887
        row.update(buildManifest={'path': str(manifest_path.relative_to(ROOT)), **fingerprint(manifest_path)},
                   buildFiles=74, buildBytes=30149887, allBuildHashesMatch=True,
                   sourceCommitAtBuild=manifest['sourceCommit'])
        if args.archive:
            archive = args.archive.resolve(strict=True)
            before = fingerprint(archive)
            expected = {'dist/' + key: value for key, value in current.items()}
            expected['dist/.openai/hosting.json'] = fingerprint(ROOT / '.openai/hosting.json')
            actual = {}
            with tarfile.open(archive, mode='r:*') as stream:
                for item in stream.getmembers():
                    if item.isdir():
                        continue
                    assert item.isfile() and item.name not in actual, 'Unsafe or duplicate archive member'
                    with stream.extractfile(item) as contents:
                        data = contents.read()
                    actual[item.name] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
            assert actual == expected, 'Archive must contain exactly the 74 qualified build files and hosting manifest'
            assert fingerprint(archive) == before, 'Archive changed during verification'
            row.update(archive={'path': str(archive), **before}, archiveFiles=len(actual),
                       allArchiveMembersMatch=True, hostingManifestPathInArchive='dist/.openai/hosting.json',
                       archiveMembers=actual)
        else:
            receipt = json.loads((DELIVERY / 'build-01/receipt.json').read_bytes())
            assert receipt['status'] == 'passed' and receipt['exitCode'] == 0 and receipt['inputsUnchanged']
            before = json.loads((DELIVERY / 'build-01/inputs-before.json').read_bytes())
            after = json.loads((DELIVERY / 'build-01/inputs-after.json').read_bytes())
            assert before == after
            for name, digest in before.items():
                assert fingerprint(Path(name))['sha256'] == digest, 'Qualified build input changed: ' + name
            native = json.loads((DELIVERY / 'candidate-native.json').read_bytes())
            for name, digest in native['files'].items():
                assert fingerprint(ROOT / name)['sha256'] == digest
            command = ['git', 'diff', '--name-only', manifest['sourceCommit'], '--', '.', ':(exclude)docs/migration']
            differences = subprocess.check_output(command, cwd=ROOT, text=True, timeout=30).splitlines()
            assert differences == [], 'Tracked input outside migration documentation changed since qualified build'
            row.update(qualifiedInputFingerprintsChecked=len(before), allQualifiedInputsMatch=True,
                       nativeFilesVerified=len(native['files']), nativeDigest=native['digest'],
                       trackedChangesOutsideMigrationDocumentation=[], trackedComparisonCommand=command,
                       hostingManifest={'path': '.openai/hosting.json', **fingerprint(ROOT / '.openai/hosting.json')},
                       buildReceipt={'path': str((DELIVERY / 'build-01/receipt.json').relative_to(ROOT)),
                                     **fingerprint(DELIVERY / 'build-01/receipt.json')})
        row['status'] = 'passed'
        exit_code = 0
    except BaseException as error:
        row.update(status='failed', error=type(error).__name__ + ': ' + str(error), traceback=traceback.format_exc())
    finally:
        row.update(finishedAt=datetime.now(timezone.utc).isoformat(), elapsedSeconds=time.monotonic() - started)
        output.write_text(json.dumps(row, indent=2) + '\n')
        print(json.dumps({key: row[key] for key in ('status', 'mode', 'elapsedSeconds')}
                         | {'output': str(output), 'error': row.get('error')}))
    raise SystemExit(exit_code)


if __name__ == '__main__':
    main()
