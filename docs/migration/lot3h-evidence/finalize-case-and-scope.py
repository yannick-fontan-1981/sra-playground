#!/usr/bin/env python3
"""Retain completed WEAV observations and close its existing cumulative clock."""
import gzip
import hashlib
import json
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
LOCAL = timezone(timedelta(hours=-3))
DIGEST = 'd6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054'


def read(path):
    data = path.read_bytes()
    return json.loads(gzip.decompress(data) if path.suffix == '.gz' else data)


def fp(path):
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def write(path, value):
    with path.open('x') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write('\n')


def main():
    selection = read(BASE / 'weav-resumption.json')
    parity = read(BASE / 'diagnostic/weav-public-parity.json')
    campaign = read(BASE / 'final/weav-crossed-prefix-session/weav-campaign.json.gz')
    phase = read(BASE / 'candidate-case-phase.json')
    baseline = read(BASE / 'baseline/weav-native048/weav-campaign.json.gz')
    assert campaign['status'] == parity['status'] == 'passed' and phase['exitCode'] == 0
    assert campaign['final']['actions'] == campaign['final']['prefixes'] == 81
    assert campaign['final']['levelsCompleted'] == 3 and campaign['final']['level'] == 4
    assert parity['nativeSourceDigest'] == selection['nativeDigest'] == DIGEST
    assert parity['checkedCount'] == 3596 and parity['failure'] is None
    browser_dir = BASE / 'final/browser'
    browser_dir.mkdir(exist_ok=True)
    for name in ['weav-native049-browser.png', 'weav-native049-browser-ax.json']:
        target = browser_dir / name
        assert not target.exists()
        shutil.copyfile(Path('/workspace/shared') / name, target)
    snapshots = read(browser_dir / 'weav-native049-browser-ax.json')
    stages = [
        ('paused_after_initial_action', 'Paused.', 1, 0, 1, 1),
        ('one_action_completed', 'One action completed.', 2, 0, 2, 1),
        ('first_level_completed', 'Level completed.', 27, 1, 27, 2),
        ('second_level_completed', 'Level completed.', 54, 2, 54, 3),
        ('third_level_completed', 'Level completed.', 81, 3, 81, 4),
    ]
    checks = []
    for stage, status, actions, levels, plans, level in stages:
        entry = next(item for item in snapshots if item['stage'] == stage)
        ax = entry['ax']
        assert status in ax and '?game=WEAV&level=' + str(level) in ax
        for element, value in [(229, actions), (230, levels), (231, plans)]:
            assert str(element) + ' text ' + str(value) + '\n' in ax
        checks.append({'stage': stage, 'status': status, 'actions': actions,
                       'levelsCompleted': levels, 'plans': plans, 'currentLevel': level})
    finished = datetime.now(LOCAL)
    start = datetime.fromisoformat(selection['resumedAt'])
    interval = (finished - start).total_seconds()
    prior = selection['caseClock']['previousChargedSeconds']
    cumulative = prior + interval
    assert finished < datetime.fromisoformat(selection['resumeDeadline'])
    browser = {
        'schema': 'logos-engine.browser-qa.v1', 'status': 'passed',
        'recordedAt': finished.isoformat(), 'displayTimeZone': 'UTC-03:00',
        'nativeVersion': '0.49.0', 'nativeSourceDigest': DIGEST, 'game': 'WEAV',
        'preview': 'Managed Sites preview of the frozen build at http://127.0.0.1:4173/',
        'continuousColdSession': True, 'manualGameActions': 0, 'levelJumps': 0,
        'checks': checks, 'final': checks[-1],
        'artifacts': [fp(browser_dir / name) for name in ['weav-native049-browser-ax.json', 'weav-native049-browser.png']],
        'qualification': 'AX snapshots establish Pause, single action, resumption and natural level progression in one cold session. After the final 81/3/81 snapshot, clicking the PLAYGROUND anchor to frame the screenshot returned the UI to its manual panel at the already reached level4. The saved screenshot shows that level4 board; the preceding unmodified AX snapshot is the evidence of agent counts. No manual game action, level selection, new reasoning session or replay was used to create these results. Preview was then stopped.',
    }
    write(browser_dir / 'browser-qa.json', browser)
    resolution = {
        'schema': 'logos-engine.resumed-game-case-resolution.v1', 'game': 'WEAV',
        'status': 'target_reached', 'recordedAt': finished.isoformat(),
        'displayTimeZone': 'UTC-03:00', 'nativeVersion': '0.49.0', 'nativeSourceDigest': DIGEST,
        'targetLevels': 3, 'actual': campaign['final'],
        'previousOutcome': {'levelsCompleted': 0, 'actions': 97, 'chargedSeconds': prior,
                            'source': selection['previousResolution']},
        'boundedFreshBaseline': {'nativeVersion': '0.48.0', 'actual': baseline['final'],
            'phaseReceipt': fp(BASE / 'baseline-case-phase.json'),
            'qualification': 'Predeclared eight-action cap reached with zero levels. The report retains seven planned prefixes while the actual public journal retains the eighth acquired return. This bounded reference is not a complete-game failure verdict.'},
        'sourceComparison': {'receipt': fp(BASE / 'diagnostic/weav-public-parity.json'),
            'sourceReceipt': fp(BASE / 'diagnostic/weav-public-source-parity.json.gz'),
            'checkedCount': parity['checkedCount'], 'exactOriginal': parity['exactOriginal']},
        'contribution': parity['contribution'],
        'browserReceipt': fp(browser_dir / 'browser-qa.json'),
        'caseClock': {'resumedAt': selection['resumedAt'], 'workFinishedAt': finished.isoformat(),
            'previousCumulativeSeconds': prior, 'currentIntervalSeconds': interval,
            'cumulativeSeconds': cumulative, 'maximumCumulativeSeconds': 2400,
            'remainingSeconds': max(0, 2400 - cumulative), 'clockReset': False,
            'exhausted': cumulative >= 2400, 'furtherWorkThisDelivery': False,
            'qualification': 'Full wall interval from the retained-case resumption includes reference, candidate, source and native comparison, ablations, browser verification and final case review. The earlier474.037204seconds remain charged. Subsequent transport, delivery documentation, integrity and STCK/SMLP timing are release work. Any future WEAV case diagnosis must resume this cumulative value.'},
        'inputs': [fp(BASE / name) for name in ['weav-resumption.json', 'candidate-case-phase.json',
            'final/weav-crossed-prefix-session/execution-weav.json',
            'final/weav-crossed-prefix-session/weav-campaign.json.gz',
            'final/weav-crossed-prefix-session/weav-public-trace.json.gz',
            'final/weav-crossed-prefix-session/weav-actual-public-journal.jsonl.gz']],
        'qualification': 'The common native session reaches the requested three natural levels. The selected own CrossedPrefix trajectory matches unchanged source from cold state; component ablations demonstrate effects on observed choices. No full original-caller parity or full-caller ablation is claimed. Prior WEAV failure and every negative ablation remain retained. No game engine, specification or solution was read.',
    }
    write(BASE / 'final/weav-resolution.json', resolution)
    old_scope = read(ROOT / 'docs/migration/lot3g-evidence/final/framed-window-validation-scope.json')
    scope = {
        'schema': 'logos-engine.crossed-prefix-validation-scope.v1',
        'recordedAt': finished.isoformat(), 'nativeDigest': DIGEST,
        'technicalScope': 'Own CrossedPrefix measurements, selection, binding, guards, common acquired journal, reconstruction and source-order integration; actual0.48 checkpoint compatibility, four recorded regressions, WEAV public selected trajectory and common-loop cost.',
        'integratedEvidence': fp(BASE / 'final/crossed-prefix-common-loop.json.gz'),
        'integratedEvidenceKind': 'three_cold_controlled_synthetic_common_caller_sessions',
        'gameContributionStatus': 'demonstrated_on_actual_selected_own_trajectory_with_component_ablations',
        'gameEvidence': fp(BASE / 'final/weav-resolution.json'),
        'gameComparison': fp(BASE / 'diagnostic/weav-public-parity.json'),
        'retainedCaseClocks': old_scope['retainedCaseClocks'],
        'limits': ['Full inherited original-caller parity remains partial.',
                   'Component ablations are not full-caller counterfactuals.',
                   'Structural geometry prefilter is finite in the common pixel domain but not deadline-preempted.',
                   'Historical/native ordering equivalence is verified for produced ACTIONn commands and the eleven old checkpoints, not arbitrary imaginary Unicode action names.',
                   'Experimental pairs and axis inputs retained across epochs are not universal game laws.'],
        'qualification': 'Synthetic proof and actual WEAV success are separately identified. Existing CWSE/SK48/FOGW/VOIS clocks remain unchanged; FOGW/VOIS are recorded regressions only. WEAV retains its prior474.037204seconds and is closed within its cumulative2400second limit. Cost acceptance remains a separate pending decision.',
    }
    write(BASE / 'final/crossed-prefix-validation-scope.json', scope)
    print(json.dumps({'status': 'passed', 'caseClock': resolution['caseClock'], 'browserChecks': len(checks),
                      'resolution': fp(BASE / 'final/weav-resolution.json')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
