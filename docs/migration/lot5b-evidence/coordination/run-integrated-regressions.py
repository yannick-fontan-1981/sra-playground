#!/usr/bin/env python3
"""Retain launch, raw output and exit for the unchanged final 5B replay driver."""
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[4]
FINAL = ROOT / 'docs/migration/lot5b-evidence/integrated-final'
MANIFEST = FINAL / 'regression-cases.json'
SOURCE = FINAL / 'source-manifest.json'
DRIVER = ROOT / 'scripts/run-released-public-regressions-streamlog.py'
RAW = FINAL / 'regression-driver-output.raw.txt'
PACKED = FINAL / 'regression-driver-output.log.gz'
STARTED = FINAL / 'regression-launch.json'
FINISHED = FINAL / 'regression-execution.json'
SUMMARY = FINAL / 'regressions/regression-summary.json'


def now():
    return datetime.now(timezone.utc).isoformat()


def fp(path):
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(data),
            'sha256': hashlib.sha256(data).hexdigest()}


def write(path, value):
    with path.open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(value, indent=2, ensure_ascii=False) + '\n')


if any(path.exists() for path in (RAW, PACKED, STARTED, FINISHED, SUMMARY)):
    raise FileExistsError('Final regression launch/output already exists')
source = json.loads(SOURCE.read_bytes())
cases = json.loads(MANIFEST.read_bytes())
assert source['digest'] == '099444085f0579ce60e226c9dece42110c577538f5f337579305a2e5f65483c4'
assert len(cases['cases']) == 10 and len(cases['strictComparisonCheckNames']) == 17
command = [sys.executable, '-B', str(DRIVER.relative_to(ROOT)),
           str(MANIFEST.relative_to(ROOT)), str(FINAL.relative_to(ROOT)),
           '--source-manifest', str(SOURCE.relative_to(ROOT)),
           '--node-old-space-mib', '1536', '--timeout-seconds', '2400']
launch = {'schema': 'logos-engine.lot5b-recorded-regression-launch.v1', 'status': 'started',
          'startedAt': now(), 'command': command, 'cwd': str(ROOT), 'generator': fp(Path(__file__)),
          'driver': fp(DRIVER), 'sourceManifest': fp(SOURCE), 'caseManifest': fp(MANIFEST),
          'nativeSourceDigest': source['digest'], 'plannedCases': [case['id'] for case in cases['cases']],
          'expectedComparisonChecks': 170, 'maximumConcurrentReplays': 1,
          'lock': {'path': '/workspace/shared/sra-coordination/performance.lock', 'mode': 'shared',
                   'heldByOuterFlock': True},
          'rawOutputPath': str(RAW.relative_to(ROOT)),
          'qualification': 'Concurrent functional recorded-return regressions, not official latency measurement or live games. Historical baselines, public traces and the 17 strict comparison labels remain unchanged.'}
write(STARTED, launch)
with RAW.open('xb', buffering=0) as output:
    result = subprocess.run(command, cwd=ROOT, stdout=output, stderr=subprocess.STDOUT)
finished = now()
raw = RAW.read_bytes()
packed = gzip.compress(raw, mtime=0)
with PACKED.open('xb') as output:
    output.write(packed)
assert gzip.decompress(packed) == raw
summary = json.loads(SUMMARY.read_bytes()) if SUMMARY.exists() else None
unchanged = (fp(SOURCE) == launch['sourceManifest'] and fp(MANIFEST) == launch['caseManifest']
             and fp(DRIVER) == launch['driver'])
passed = result.returncode == 0 and summary is not None and summary['status'] == 'passed' and unchanged
receipt = {'schema': 'logos-engine.lot5b-recorded-regression-execution.v1',
           'status': 'passed' if passed else 'failed', 'startedAt': launch['startedAt'], 'finishedAt': finished,
           'recordedAt': now(), 'command': command, 'exitCode': result.returncode,
           'launch': fp(STARTED), 'generator': fp(Path(__file__)), 'rawOutput': fp(RAW),
           'compressedOutput': fp(PACKED), 'outputCompressionRoundTripExact': True,
           'sourceManifest': fp(SOURCE), 'caseManifest': fp(MANIFEST), 'driver': fp(DRIVER),
           'declaredInputsUnchanged': unchanged, 'nativeSourceDigest': source['digest'],
           'summary': fp(SUMMARY) if summary is not None else None,
           'passedCases': summary['passed'] if summary is not None else None,
           'totalCases': summary['total'] if summary is not None else None,
           'comparisonChecksPassed': summary['comparisonChecksPassed'] if summary is not None else None,
           'comparisonChecksExpected': summary['comparisonChecksExpected'] if summary is not None else 170,
           'qualification': launch['qualification']}
write(FINISHED, receipt)
try:
    print(json.dumps({'status': receipt['status'], 'exitCode': result.returncode, 'receipt': fp(FINISHED),
                      'passedCases': receipt['passedCases'], 'totalCases': receipt['totalCases'],
                      'comparisonChecksPassed': receipt['comparisonChecksPassed']}), flush=True)
except BrokenPipeError:
    pass
raise SystemExit(0 if passed else result.returncode or 1)
