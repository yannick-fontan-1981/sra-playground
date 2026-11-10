#!/usr/bin/env python3
"""Bind completed public CONN evidence and close its one cumulative clock."""
import gzip
import hashlib
import json
import re
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
LOCAL = timezone(timedelta(hours=-3))

def read(path):
    data = path.read_bytes()
    return json.loads(gzip.decompress(data) if path.suffix == '.gz' else data)
def fp(path):
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
def write(path, value):
    with path.open('x') as stream: stream.write(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def main():
    selection = read(BASE / 'conn-selection.json')
    manifest = read(BASE / 'final/source-manifest.json')
    digest = manifest['digest']
    parity = read(BASE / 'diagnostic/conn-public-parity.json')
    source = read(BASE / 'diagnostic/conn-public-source-parity.json.gz')
    campaign = read(BASE / 'final/conn-recurrent-series-session/conn-campaign.json.gz')
    phase = read(BASE / 'candidate-case-phase.json')
    baseline = read(BASE / 'baseline/conn-native049/conn-campaign.json.gz')
    synthetic = read(BASE / 'final/recurrent-series-common-loop.json.gz')
    assert campaign['status'] == parity['status'] == source['status'] == synthetic['status'] == 'passed'
    assert phase['exitCode'] == 0 and not phase['caseDeadlineReached']
    assert campaign['final']['actions'] == campaign['final']['prefixes'] == 21
    assert campaign['final']['levelsCompleted'] == 3 and campaign['final']['level'] == 4
    assert parity['nativeSourceDigest'] == source['nativeSourceDigest'] == digest
    assert parity['checkedCount'] == 1361 and parity['failure'] is None
    assert source['capturedSelectedRecurrentPrefixes'] == 14 and source['capturedAllRecurrentEvents'] == 34
    browser_dir = BASE / 'final/browser'; browser_dir.mkdir(exist_ok=True)
    for path in sorted(Path('/workspace/shared/lot3i-browser').iterdir()):
        target = browser_dir / path.name
        assert not target.exists(); shutil.copyfile(path, target)
    observations = read(browser_dir / 'conn-browser-observations.json')
    ax = (browser_dir / 'conn-browser-final.txt').read_text()
    assert '?game=CONN&level=4' in observations['url'] and 'Level completed.' in ax
    values = re.search(r'(\d+)\s+actions\s+(\d+)\s+levels solved\s+(\d+)\s+completed plans', observations['finalText'])
    assert values and tuple(map(int, values.groups())) == (21, 3, 21)
    expected = [('Paused.', 1, 0, 1), ('One action completed.', 2, 0, 2),
                ('Level completed.', 5, 1, 5), ('Level completed.', 9, 2, 9)]
    assert [(x['state'], x['actions'], x['levels'], x['plans']) for x in observations['steps']] == expected
    finished = datetime.now(LOCAL)
    start = datetime.fromisoformat(selection['resumedAt'])
    interval = (finished - start).total_seconds()
    prior = selection['caseClock']['previousChargedSeconds']
    cumulative = prior + interval
    assert finished < datetime.fromisoformat(selection['resumeDeadline'])
    browser = {'schema': 'logos-engine.browser-qa.v1', 'status': 'passed',
        'recordedAt': finished.isoformat(), 'displayTimeZone': 'UTC-03:00',
        'nativeVersion': '0.50.0', 'nativeSourceDigest': digest, 'game': 'CONN',
        'preview': 'Managed Sites preview at http://127.0.0.1:4173/',
        'continuousColdSession': True, 'manualGameActions': 0, 'levelJumps': 0,
        'checks': observations['steps'] + [{'state': 'Level completed.', 'actions': 21, 'levels': 3, 'plans': 21}],
        'final': {'actions': 21, 'levelsCompleted': 3, 'plans': 21, 'currentLevel': 4},
        'artifacts': [fp(path) for path in sorted(browser_dir.iterdir()) if path.is_file()],
        'qualification': 'Direct UI observations show Pause after one action, one additional isolated action, resumption and three natural level boundaries in one cold session. Final AX text and screenshot both show21actions/3levels/21plans. The earlier19-action capture is retained as intermediate, not final. No manual game action, level jump, seeded knowledge or new reasoning session was used.'}
    write(browser_dir / 'browser-qa.json', browser)
    resolution = {'schema': 'logos-engine.selected-game-case-resolution.v1', 'game': 'CONN',
        'status': 'target_reached', 'recordedAt': finished.isoformat(), 'displayTimeZone': 'UTC-03:00',
        'nativeVersion': '0.50.0', 'nativeSourceDigest': digest, 'targetLevels': 3, 'actual': campaign['final'],
        'boundedFreshBaseline': {'nativeVersion': '0.49.0', 'siteVersion': 78, 'actual': baseline['final'],
            'phaseReceipt': fp(BASE / 'baseline-case-phase.json'),
            'qualification': 'Predeclared eight-action cap reached with zero levels. The report keeps seven completed prefixes while the public journal retains the eighth acquired return. This short reference is not a complete-game failure verdict.'},
        'sourceComparison': {'receipt': fp(BASE / 'diagnostic/conn-public-parity.json'),
            'sourceReceipt': fp(BASE / 'diagnostic/conn-public-source-parity.json.gz'),
            'checkedCount': parity['checkedCount'], 'exactOriginal': parity['exactOriginal']},
        'contribution': parity['contribution'], 'browserReceipt': fp(browser_dir / 'browser-qa.json'),
        'caseClock': {'startedAt': selection['resumedAt'], 'workFinishedAt': finished.isoformat(),
            'previousCumulativeSeconds': prior, 'currentIntervalSeconds': interval, 'cumulativeSeconds': cumulative,
            'maximumCumulativeSeconds': 2400, 'remainingSeconds': 2400 - cumulative, 'clockReset': False,
            'exhausted': False, 'furtherWorkThisDelivery': False,
            'qualification': 'Conservatively charged from the initial public scan, before case selection. Entire interval includes baseline, candidate, source/native comparisons, ablations, browser QA and case review with no pause/reset. Subsequent release transport, documentation, regressions of other games, integrity and STCK/SMLP costs are release work. Future CONN diagnosis must resume this value.'},
        'inputs': [fp(BASE / name) for name in ['conn-selection.json', 'candidate-case-phase.json',
            'final/conn-recurrent-series-session/execution-conn.json',
            'final/conn-recurrent-series-session/conn-campaign.json.gz',
            'final/conn-recurrent-series-session/conn-public-trace.json.gz',
            'final/conn-recurrent-series-session/conn-actual-public-journal.jsonl.gz']],
        'qualification': 'Three natural levels reached by the common native caller. Repeated and Supported selected proposals and acquisition of all returns match unchanged source from cold own memory; component ablations retain all negative outcomes. Full inherited-caller parity and full-caller counterfactuals are not claimed. No engine, specification or solution was read.'}
    write(BASE / 'final/conn-resolution.json', resolution)
    scope = {'schema': 'logos-engine.recurrent-series-validation-scope.v1',
        'recordedAt': finished.isoformat(), 'nativeDigest': digest,
        'technicalScope': 'Own RepeatedLine/SupportedLine observations, proposals, binding, guards, passive actual acquisition and stable packet order; single shared ancestor owner, cold reconstruction and source-order registration;19published0.49checkpoints.',
        'integratedEvidence': fp(BASE / 'final/recurrent-series-common-loop.json.gz'),
        'integratedEvidenceKind': 'two_cold_controlled_repeated_line_common_caller_sessions',
        'gameContributionStatus': 'repeated_and_supported_selected_own_trajectory_and_all_returns_verified_with_component_ablations',
        'gameEvidence': fp(BASE / 'final/conn-resolution.json'),
        'gameComparison': fp(BASE / 'diagnostic/conn-public-parity.json'),
        'retainedCaseClocks': selection['clocksUnchanged'],
        'limits': ['Full inherited original-caller parity remains partial.',
            'Component ablations do not establish full-caller counterfactual success.',
            'The source geometric prefilter is not deadline-preempted.',
            'Native finite search may return blocking unknown at its work/deadline or exact-integer boundary; no incomplete action or causal refutation is acquired.',
            'Own Python Unicode rejection-key ordering and historical shared UTF-16 ordering agree for produced ASCII trial digests; opaque artificial keys retain their separately qualified behavior.',
            'Observed support, score and alternating response remain conditional hypotheses.'],
        'qualification': 'Synthetic Repeated proof and actual CONN Repeated/Supported contribution are separate. All prior case clocks remain unchanged. CONN closes within its one cumulative2400second limit. The five recorded regressions and global cost decision have their own final receipts; cost acceptance is not anticipated here.'}
    write(BASE / 'final/recurrent-series-validation-scope.json', scope)
    print(json.dumps({'status': 'passed', 'caseClock': resolution['caseClock'],
        'browserChecks': len(browser['checks']), 'resolution': fp(BASE / 'final/conn-resolution.json')}))

if __name__ == '__main__': main()
