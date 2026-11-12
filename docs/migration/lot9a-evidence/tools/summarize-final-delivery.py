#!/usr/bin/env python3
"""Reconcile retained final9A evidence without another runtime, reader or game."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
STAGE = ROOT / 'docs/migration/lot9a-evidence/delivery-final-068-01'


def read(name):
    return json.loads((STAGE / name).read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pin(path):
    return {'path': str(path.relative_to(ROOT)), 'bytes': path.stat().st_size, 'sha256': sha(path)}


def save(name, value):
    with (STAGE / name).open('x') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False)
        stream.write('\n')


def main():
    manifest = read('candidate-native.json')
    paths = sorted(path for folder in ['src/logos-engine', 'src/runtime']
                   for path in (ROOT / folder).rglob('*')
                   if path.is_file() and path.suffix in {'.ts', '.json', '.drm'})
    actual = dict(sorted((str(path.relative_to(ROOT)), sha(path)) for path in paths))
    assert actual == manifest['files'] and len(actual) == 334
    digest = hashlib.sha256(json.dumps(actual, separators=(',', ':')).encode()).hexdigest()
    assert digest == manifest['digest'] == 'e7a94fbc7cdcb19d8704b5d4120f27a858cbcd07e455084711510ee147f4e653'
    build = read('build-manifest.json')
    actual_build = {str(path.relative_to(ROOT / 'dist')): {'bytes': path.stat().st_size, 'sha256': sha(path)}
                    for path in sorted((ROOT / 'dist').rglob('*')) if path.is_file()}
    assert actual_build == build['files'] and len(actual_build) == 74
    entries = json.loads((ROOT / 'docs/migration/v6-entry-point-progress.json').read_text())
    assert entries['implementation'] == 'logos-engine.typescript.v6.native-migration/0.68.0'
    assert (entries['connected'], entries['declared'], entries['partiallyConnected']) == (70, 76, 0)
    coverage = json.loads((ROOT / 'docs/migration/v6-coverage.json').read_text())
    assert not coverage['failures'] and not any(coverage['completionGates'].values())
    commands = []
    names = ['build-01', 'work-inventory-01', 'work-baseline-01', 'work-candidate-01',
             'work-qualify-01', 'common-capture-01', 'common-qualify-01', 'work-qualify-02', 'final-entry-audit-01']
    for name in names:
        receipt = read(name + '/receipt.json')
        assert receipt['status'] == ('failed' if name == 'work-qualify-01' else 'passed')
        assert receipt['inputsUnchanged'] and receipt['headUnchanged'] and receipt['childProcessReaped']
        assert not receipt['globalLockAcquired'] and not receipt['officialPerformanceMeasurement']
        for item in receipt['outputs']:
            path = Path(item['path'])
            assert path.stat().st_size == item['bytes'] and sha(path) == item['sha256'], item['path']
        log = receipt['log']; assert sha(Path(log['path'])) == log['sha256']
        commands.append({'attempt': name, 'status': receipt['status'], 'budgetKey': receipt['budgetKey'],
                         'elapsedSeconds': receipt['elapsedSeconds'], 'cumulativeSeconds': receipt['cumulativeSeconds'],
                         'inputsUnchanged': True, 'headUnchanged': True, 'childProcessReaped': True,
                         'receipt': pin(STAGE / name / 'receipt.json')})
    a = read('work-baseline-01/baseline.receipt.json')
    b = read('work-candidate-01/candidate.receipt.json')
    common = read('common-capture-01/capture/receipt.json')
    for capture, counts in [(a, (4, 31)), (b, (4, 31)), (common, (5, 9))]:
        assert (capture['initializedSessions'], capture['physicalReturns']) == counts
        assert capture['inputsUnchanged'] and capture['nativeSourceUnchanged'] and not capture['failures']
    assert all(session['runtimeClosed'] for session in common['sessions'])
    first = read('work-qualify-01/graph-review.json')
    work = read('work-qualify-02/graph-review.json')
    assert first['status'] == 'functional_structure_qualification_failed'
    assert first['unattributedDifferenceCount'] == 58
    assert work['status'] == 'qualified_functional_work_forms_and_individual_graphs'
    assert work['unattributedDifferenceCount'] == 0 and not work['failures']
    assert work['differenceCount'] == first['differenceCount'] == 28279
    assert work['checkedCount'] == 64 and len(work['points']) == 58 and len(work['fullSnapshotCoverage']) == 58
    assert work['privateComparison'] == 'all_observed_common_differences_attributed_functional_only_requires_final_review'
    assert work['strictCommonGraphParity'] is False and work['officialPerformanceEligible'] is False
    assert len(read('work-qualify-02/work-forms.json')['forms']) == 4
    qualification = read('common-qualify-01/review/qualification.json')
    assert qualification['status'] == 'qualified_synthetic_common_work_forms_and_complete_graphs'
    assert not qualification['failures'] and qualification['completeGraphBlobs'] == 21
    assert common['capturePoints'] == 52 and common['rawCapture']['records'] == 80
    acquisitions = {key: sum(session[key] for session in common['sessions'])
                    for key in ['activeChartAcquisitions', 'passiveChartAcquisitions', 'suppressedChartAcquisitions', 'controlledColdResets']}
    assert list(acquisitions.values()) == [6, 2, 1, 2]
    sessions = a['initializedSessions'] + b['initializedSessions'] + common['initializedSessions']
    returns = a['physicalReturns'] + b['physicalReturns'] + common['physicalReturns']
    assert (sessions, returns) == (13, 71)
    review = read('independent-delivery-review.json')
    assert 'favorable' in review['status'] or 'passed' in review['status'], review['status']
    assert not review.get('failures') and not review.get('blockers')
    now = datetime.now(timezone.utc).isoformat()
    summary = {
        'schema': 'logos-engine.lot9a.final-delivery-summary.v1', 'recordedAt': now,
        'status': 'qualified_final_identity_functional_delivery_scope',
        'candidate': {'nativeVersion': '0.68.0', 'nativeFiles': 334, 'nativeDigest': digest,
                      'connected': 70, 'declared': 76, 'materialConnected': 27, 'materialDeclared': 33,
                      'sourceIdentityCheckpoint': 'dcd6b5b7027615ae37eb5afd02d704987f12702f'},
        'published': {'siteVersion': 108, 'nativeVersion': '0.67.0', 'connected': 69, 'declared': 76,
                      'sourceCommit': '8462204043aa368faa7df280d796bb706eb53b38', 'ownerPrivate': True},
        'retainedFunctionalTests': {'passed': 175, 'modules': 8, 'newTestExecutionsClaimed': 0,
                                   'qualification': 'Historical algorithm evidence; literal-only reconciliation, not new0.68 test executions.'},
        'build': {'passed': True, 'includesTypeScript': True, 'files': 74, 'bytes': build['totalBytes'],
                  'allCurrentHashesMatch': True, 'worker': build['worker']},
        'entryAudit': {'freshFinalIdentityAuditPassed': True, 'uninitializedFactories': 1,
                       'initializedSessions': 0, 'physicalReturns': 0},
        'migrationAudit': {'reexecuted': False, 'retainedReportFailures': 0,
                           'summary': coverage['summary'], 'completionGates': coverage['completionGates']},
        'factoryInventory': {'owners': {'baseline': 62, 'candidate': 63},
                             'familyPrograms': {'baseline': 28, 'candidate': 29},
                             'onlyAddedOwner': 'public_chart_navigation', 'onlyAddedProgram': 'v6.chart_navigation.choose'},
        'workForms': {'forms': 4, 'initializedSessions': 8, 'physicalReturns': 62,
                      'pairedChecks': 64, 'pairedPoints': 58, 'differences': 28279,
                      'unattributedDifferences': 0, 'strictGraphIdentityClaimed': False,
                      'firstReaderFailureRetained': True, 'readerAttempts': 2,
                      'readerCumulativeSeconds': read('work-qualify-02/receipt.json')['cumulativeSeconds'],
                      'recapturePerformed': False, 'onlyNewAttributionPath': '/whyAct/decision/total_ms',
                      'durationQualification': 'Bounded creation interval, complete persisted decision equality, exact report retention. Internal bridge timestamp subtraction is not reconstructed.'},
        'chartCommon': {'initializedSessions': 5, 'physicalReturns': 9, 'points': 52,
                        'fullUniqueGraphs': 21, 'records': 80, **acquisitions,
                        'sourceFactRestorations': 9, 'nativeRestorations': 19,
                        'allInstancesClosed': True, 'rawBytes': common['rawCapture']['totalRawBytes'],
                        'ablationOfferChanges': True, 'ablationPhysicalCommandChanges': False,
                        'ablationNextCommand': 'ACTION4', 'publicPositiveChartTransportQualified': False},
        'accounting': {'new': {'initializedSessions': sessions, 'physicalReturns': returns},
                       'priorCommon': {'initializedSessions': 10, 'physicalReturns': 14},
                       'includingPriorCommon': {'initializedSessions': 23, 'physicalReturns': 85},
                       'maximumIncludingPriorCommon': {'initializedSessions': 36, 'physicalReturns': 156},
                       'uninitializedFactoriesThisStage': 3, 'priorUninitializedFactories': 2,
                       'scope': 'Declared9A delivery and retained common attempts only, not every historical project campaign.'},
        'commands': commands,
        'documentationReconciliation': {'initialFailureRetained': True, 'nativeSourceChanged': False,
            'scope': 'Canonical string-key order corrected only in the summary generator; no new runtime, work reader, session or return.',
            'evidence': pin(STAGE / 'documentation-reconciliation-correction.json')},
        'officialCost': {'measured': False, 'accepted': False, 'eachGlobalIncreaseStrictlyBelowPercent': 10,
                         'games': ['STCK', 'SMLP'], 'phaseOverrunsAllowedIfEveryGlobalPasses': True,
                         'sampleExclusionAllowed': False, 'crossGameCompensationAllowed': False},
        'publicationPerformed': False, 'globalLockAcquired': False, 'peerAvailabilityWait': False,
        'originalOracleExecutionsThisStage': 0, 'liveGameExecutionsThisStage': 0, 'LKEY': 'permanently_closed',
        'reservations': [
            'Original two oracle-wrapper failures and recovered corpus remain retained; no third oracle.',
            'Historical common maximumSessions8 was not scoped per attempt/cumulative; prior10sessions14returns remain recorded without retrospective repair.',
            'Frozen work provenance historicalCaseRowsExact was too broad: only six execution fields are exactly unchanged; descriptive purpose strings differ. Explicit qualification retained.',
            'First work reader failed on58total_ms leaves; it remains failed, with the narrow prospective correction and all raw differences retained.',
            'Positive Chart public service/worker/ticket transport is outside these common graph proofs; no new official game success.',
            'Checkpoint validation remains structural and does not guarantee authenticity or upper bounds against an artificially incompatible future raster.',
            'Global migration gates, official0.68 cost and0.68 publication remain open.'
        ],
        'independentReview': pin(STAGE / 'independent-delivery-review.json'),
        'nextStep': 'Prepare and run official STCK/SMLP comparison against the freshly verified published predecessor under short exclusivity, then publish final0.68 privately if both global medians remain strictly below+10%. Keep positive Chart public transport as a distinct qualification. Continue9B region_intervention and9C joint_channels afterward.'
    }
    save('validation-summary.json', summary)
    save('final-reconciliation.json', {'schema': 'logos-engine.lot9a.final-delivery-reconciliation.v1',
         'verifiedAt': now, 'status': 'passed', 'nativeFiles': 334, 'nativeDigest': digest,
         'allNativeHashesMatchFrozenManifest': True, 'buildFiles': 74, 'allBuildHashesMatch': True,
         'entryRegistryImplementation': entries['implementation'], 'commandReceiptsVerified': len(commands),
         'passingCommands': 8, 'retainedFailedCommands': 1, 'allRecordedOutputsAndLogsVerified': True,
         'officialPerformanceAccepted': False, 'publicationPerformed': False, 'failures': []})
    print(json.dumps({'status': summary['status'], 'nativeDigest': digest, 'commands': len(commands),
                      'pairedChecks': 64, 'unattributedDifferences': 0, 'newSessions': sessions, 'newReturns': returns}))


if __name__ == '__main__':
    main()
