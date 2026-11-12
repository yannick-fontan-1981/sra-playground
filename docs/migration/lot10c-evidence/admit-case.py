#!/usr/bin/env python3
"""Admit one new public-catalog case and charge its actual admission interval.

Reads catalog metadata, evidence filenames and small clock headers only. It
does not open an engine, a private level, a campaign payload or an agent state.
An existing matching case or ledger blocks this fresh-case path.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def now():
    return datetime.now(timezone.utc).isoformat()


def fp(path):
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}


def write(path, value):
    with path.open('x') as stream:
        json.dump(value, stream, indent=2); stream.write('\n')


def main():
    started, wall = time.monotonic_ns(), now()
    helpers = [Path(__file__), HERE / 'case-activity.py', HERE / 'run-clocked-proof.py']
    helper_inputs = [fp(path) for path in helpers]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('game')
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Z0-9]{4}', args.game):
        raise ValueError('Use the exact four-character catalog code')
    for name in ['case-contract.json', 'case-clock.json', 'case-admission-review.json']:
        if (HERE / name).exists():
            raise FileExistsError('An existing admission must never be replaced: ' + name)
    catalog_path = ROOT / 'src/games/catalog.ts'
    catalog_text = catalog_path.read_text()
    pattern = r'\{\s*"code":\s*"' + re.escape(args.game) + r'".*?\n\s*\}'
    found = re.findall(pattern, catalog_text, re.S)
    if len(found) != 1:
        raise ValueError('One exact public catalog entry is required')
    row = json.loads(found[0])
    token = re.compile(r'(^|[/_.-])' + re.escape(args.game) + r'([/_.-]|$)', re.I)
    command = ['rg', '--files', 'docs/migration', 'tests/fixtures', '/workspace/shared/sra-coordination']
    filenames = subprocess.check_output(command, cwd=ROOT, text=True, timeout=30).splitlines()
    matches = [name for name in filenames if token.search(name)]
    if matches:
        raise ValueError('Matching prior case filenames require existing-clock reconciliation: ' + repr(matches))
    clocks = [name for name in filenames if name.endswith('.json') and 'clock' in Path(name).name.lower()]
    checked, skipped = [], []
    for name in clocks:
        path = Path(name) if Path(name).is_absolute() else ROOT / name
        # Named closed cases are excluded before reading; this is not a replay
        # or a semantic review of their previous evidence.
        if any(code in path.name.lower() for code in ['hpdl', 'lkey']):
            skipped.append({'path': name, 'reason': 'different_named_closed_case'}); continue
        if path.stat().st_size > 262144:
            raise ValueError('A large ambiguous clock needs explicit reconciliation: ' + name)
        value = json.loads(path.read_text())
        game = value.get('game', value.get('case'))
        checked.append({'path': name, 'gameHeader': game})
        if game == args.game:
            raise ValueError('An existing case clock must be reconciled, never reset: ' + name)
    review = {'schema': 'logos-engine.lot10c.case-admission-review.v1', 'game': args.game,
              'startedAt': wall, 'recordedAt': now(), 'generator': fp(Path(__file__)),
              'priorMatchingCaseEvidenceFound': False, 'caseSpecificExecutionStarted': False,
              'searches': [{'command': command, 'scope': 'Current complete repository evidence filenames and shared coordination filenames',
                            'filesEnumerated': len(filenames), 'matchingPaths': matches},
                           {'scope': 'Small clock metadata headers; named unrelated closed cases excluded before reading',
                            'checked': checked, 'excluded': skipped}],
              'qualification': 'No matching earlier case evidence was found in these available project records. This is an explicit bounded admission review, not a claim about unavailable history. No engine, private level, campaign payload or acquired state was read.'}
    write(HERE / 'case-admission-review.json', review)
    contract = {'schema': 'logos-engine.lot10c.case-contract.v1', 'game': args.game, 'targetLevels': 3,
                'maximumCumulativeSeconds': 2400, 'clockReset': False, 'createdAt': now(),
                'publicSelection': {'name': row['name'], 'description': row['description'],
                                    'catalog': fp(catalog_path), 'basis': 'Public title and description only'},
                'admissionEvidence': fp(HERE / 'case-admission-review.json'),
                'qualification': 'One case clock covers admission, diagnostics, all live attempts, evidence retention and browser checks. A new source freeze, failure, interruption or final predecessor integration does not reset it.'}
    write(HERE / 'case-contract.json', contract)
    subprocess.run(['python', '-B', str(HERE / 'case-activity.py'), 'initialize'], cwd=ROOT, check=True, timeout=10)
    spec = importlib.util.spec_from_file_location('admission_clock', HERE / 'run-clocked-proof.py')
    clock = importlib.util.module_from_spec(spec); spec.loader.exec_module(clock)
    clock.GAME, clock.TARGET_LEVELS = args.game, 3
    value = clock.read_json(HERE / 'case-clock.json')
    clock.validate_clock(value)
    out = HERE / 'case-activities/admission'
    out.mkdir(parents=True, exist_ok=False)
    attempt_id = out.relative_to(ROOT).as_posix()
    entry = {'attemptId': attempt_id, 'status': 'running', 'kind': 'diagnostic_or_browser', 'purpose': 'Public catalog selection and prior-case admission review',
             'game': args.game, 'targetLevels': 3, 'startedAt': wall, 'priorCumulativeSeconds': 0,
             'activityCeilingSeconds': 60, 'chargedSeconds': None}
    value['attempts'].append(entry); value['budgetAvailability'] = 'blocked_by_running_attempt'
    clock.write_json(HERE / 'case-clock.json', value, replace=True)
    receipt = {'schema': 'logos-engine.lot10c.case-activity-execution.v1', 'attemptId': attempt_id,
               'game': args.game, 'purpose': entry['purpose'], 'startedAt': wall, 'finishedAt': now(),
               'status': 'completed', 'elapsedSecondsThroughCapture': (time.monotonic_ns()-started)/1e9,
               'executionHelpersUnchanged': [fp(path) for path in helpers] == helper_inputs,
               'executionHelpers': helper_inputs, 'generator': fp(Path(__file__)),
               'evidence': [fp(HERE / 'case-admission-review.json'), fp(HERE / 'case-contract.json')],
               'qualification': 'Actual monotonic time from admission entry through metadata review and retention; no live game was launched.'}
    clock.write_json(out / 'execution.json', receipt)
    record = fp(out / 'execution.json')
    charge = (time.monotonic_ns()-started)/1e9
    entry.update(status='terminal', finishedAt=now(), chargedSeconds=charge, outcome='completed',
                 executionReceipt=record, ceilingExceeded=charge > 60)
    value.update(cumulativeChargedSeconds=charge, remainingSeconds=max(0, 2400-charge),
                 budgetExceededSeconds=max(0, charge-2400), budgetAvailability='available' if charge < 2400 else 'exhausted',
                 lastUpdatedAt=now())
    clock.write_json(HERE / 'case-clock.json', value, replace=True)
    clock.validate_clock(value)
    print(json.dumps({'game': args.game, 'targetLevels': 3, 'chargedSeconds': charge,
                      'remainingSeconds': value['remainingSeconds'], 'liveGameStarted': False}))


if __name__ == '__main__':
    main()
