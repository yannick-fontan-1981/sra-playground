#!/usr/bin/env python3
"""Bind completed 5B evidence and unchanged compiled inputs for publication.

This only reads retained files and writes an exclusive publication-inputs.json
in --candidate-source-directory. It executes no test, game, build, oracle,
benchmark, Git or network operation, and does not publish the candidate.
Versions, counts, predecessors and functional qualifications come from the
completed readiness and actual cost receipts. A verified but rejected global
cost verdict remains rejected; this integrity receipt does not close the lot.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import gzip
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
HELPER = Path(__file__).resolve().with_name('finalize-cost-readiness.py')
spec = importlib.util.spec_from_file_location('lot5b_readiness_file_helpers', HELPER)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
ROOT, BASE = helper.ROOT, helper.BASE
Evidence, require, local = helper.Evidence, helper.require, helper.local
instant, fingerprint, counts_valid, manifest_valid = helper.instant, helper.fingerprint, helper.counts_valid, helper.manifest_valid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--performance-directory', type=Path, required=True)
    parser.add_argument('--candidate-source-directory', type=Path, required=True)
    parser.add_argument('--validation-directory', type=Path, default=Path('validation'))
    args = parser.parse_args()
    perf, final = local(args.performance_directory), local(args.candidate_source_directory)
    require(perf.is_relative_to(BASE) and final.is_relative_to(BASE), 'Expected integrated 5B evidence directories')
    validation = (final / args.validation_directory).resolve()
    require(validation.is_relative_to(final), 'Validation directory escapes the candidate evidence')
    output = final / 'publication-inputs.json'
    require(not output.exists() and not output.is_symlink(), 'Publication input receipt already exists')
    e = Evidence()
    e.keep(__file__)
    e.keep(HELPER)
    declaration = e.load(perf / 'declaration.json')
    policy = e.load(perf / 'global-budget-policy.json')
    preparation = e.load(perf / 'preparation.json')
    readiness = e.load(perf / 'readiness.json')
    static = e.load(perf / 'static-preflight.json')
    window = e.load(perf / 'window.json')
    aggregate = e.load(perf / 'owner-growth-comparison.json')
    review = e.load(perf / 'owner-growth-review.json')
    render = e.load(perf / 'results-render.json')
    transport = e.load(perf / 'log-transport.json')
    native = e.load(final / 'source-manifest.json')
    baseline = e.referenced(declaration['baselineManifest'])
    archive = e.load(final / 'source-archive.json')
    tests = e.load(validation / 'delta-tests-run.json')
    checks = e.load(validation / 'checks-run.json')
    integrity = e.load(final / 'delivery-integrity.json')
    e.baseline = Path(preparation['baselineCheckout']).resolve()
    require(e.baseline != ROOT and preparation['candidateCheckout'] == str(ROOT)
            and Path(window['baselineCheckout']).resolve() == e.baseline, 'Cost window changed its checkout pair')
    digest = native['digest']
    for role, manifest in (('baseline', baseline), ('candidate', native)):
        manifest_valid(manifest, role)
        require(declaration[role] == policy[role] == preparation[role]
                and declaration['nativeDigests'][role] == policy[role]['nativeDigest'] == manifest['digest']
                and policy[role]['nativeFiles'] == manifest['fileCount'], 'Cost/final source identities differ')
    require(declaration['candidateManifest'] == e.keep(final / 'source-manifest.json')
            and declaration['candidateArchiveManifest'] == e.keep(final / 'source-archive.json'),
            'Publication directory differs from the declared candidate')
    require(readiness.get('schema') == 'logos-engine.native-cost-window-readiness.v1'
            and readiness.get('status') == 'ready' and readiness.get('measurementAuthorized') is True
            and readiness.get('pendingRequirements') == [] and readiness.get('nativeSourceDigest') == digest
            and readiness.get('baseline') == policy['baseline'] and readiness.get('candidate') == policy['candidate']
            and readiness.get('generator') == e.keep(HELPER), 'Readiness does not bind the exact completed candidate')
    for record in readiness['inputs']:
        e.checked(record)
    for record in readiness.get('watchedExternalInputs', []):
        e.checked(record, allow_external=True)
    require(archive['nativeSourceManifestDigest'] == digest
            and archive['baseCommit'] == policy['candidate']['sourceBaseCommit'], 'Frozen source archive changed identity')
    e.checked(archive['archive'])
    e.keep(final / 'source-archive-parts.json')
    inventories = {}
    for label, files in (('native', native['files']), ('archiveMembers', archive['files']),
                         ('sourceAndTests', tests['sourceAndTestInputs']), ('buildInputs', checks['buildInputs'])):
        e.file_map(files, label)
        inventories[label] = len(files)
    actual_native = {path.relative_to(ROOT).as_posix() for folder in ('src/logos-engine', 'src/runtime')
                     for path in (ROOT / folder).rglob('*') if path.is_file() and path.suffix in ('.ts', '.json', '.drm')}
    require(actual_native == set(native['files']), 'The native member set changed after its frozen validation')
    require(tests.get('status') == checks.get('status') == 'passed'
            and tests.get('nativeSource') == checks.get('nativeSource') == native
            and tests.get('nativeSourceUnchanged') is checks.get('nativeSourceUnchanged') is True
            and tests.get('sourceAndTestInputsUnchanged') is True
            and tests['testFiles'] and len(tests['testFiles']) == len(set(tests['testFiles']))
            and [row['name'] for row in checks['checks']] == helper.CHECK_NAMES,
            'Final functional test/build verification is incomplete')
    counts = tests['checks'][0]['counts']
    counts_valid(counts, 'publication')
    require(readiness['formalTests'] == integrity['tests'] == counts
            and readiness['formalTestFiles'] == len(tests['testFiles'])
            and integrity.get('status') == 'passed' and integrity.get('nativeSourceDigest') == digest
            and integrity.get('nativeAgentWorker') == checks['nativeAgentWorker']
            and integrity['sourceArchiveVerification'].get('byteIdentical') is True, 'Tests, integrity and readiness disagree')
    e.checked(checks['nativeAgentWorker'])
    for record in [integrity['generator'], *integrity['verificationHelpers'], *integrity['receipts']]:
        e.checked(record)
    scope = e.referenced(readiness['testScope']['receipt'])
    require(scope['testFiles'] == tests['testFiles'] and scope['testFileCount'] == len(tests['testFiles']), 'Test union changed')
    e.checked(readiness['publishedPredecessors']['receipt'])
    require(readiness['newGameSuccessClaimed'] is False and readiness['weav']['clockReset'] is False
            and readiness['weav']['newLiveExecutions'] == 0 and readiness['weav']['remainingSeconds'] == 0,
            'Publication broadened the functional or exhausted WEAV qualification')

    require(window.get('status') == window.get('finalIntegrity') == 'passed'
            and [row['label'] for row in window['executions']] == declaration['plannedOrder'] == policy['plannedOrder']
            and window['nativeDigests'] == {'baseline': baseline['digest'], 'correction': digest}
            and instant(readiness['finalizedAt']) < instant(window['startedAt']) <= instant(window['finishedAt']),
            'Actual cost window is incomplete or differs from the predeclared source pair/order')
    qualification = declaration['ownerCostQualification']
    contract = e.load(qualification['contractPath'])
    contract_record = e.keep(qualification['contractPath'])
    require(qualification.get('schema') == 'logos-engine.lot5b-owner-cost-qualification.v1'
            and contract.get('schema') == 'logos-engine.lot5b-owner-cost-contract.v2' and contract.get('lot') == '5B'
            and contract.get('declaration') == e.keep(perf / 'declaration.json')
            and contract.get('tools') == qualification['tools'] == static['ownerCostTools']
            and readiness['ownerCostContract'] == static['ownerCostContract'] == contract_record,
            'Added-owner cost rule differs from the predeclared contract')
    require(instant(declaration['finalizedAt']) <= instant(contract['declaredAt']) <= instant(static['recordedAt'])
            <= instant(readiness['finalizedAt']) < instant(window['startedAt']), 'Cost evidence chronology changed')
    for record in contract['tools'].values():
        e.checked(record)
    require(aggregate.get('schema') == 'logos-engine.lot5b-owner-cost-consolidation.v2'
            and aggregate.get('status') == 'qualified_consolidation_complete'
            and review.get('schema') == 'logos-engine.lot5b-owner-cost-review.v2'
            and review.get('status') == 'qualified_owner_cost_review_passed'
            and aggregate.get('generator') == contract['tools']['consolidator']
            and review.get('generator') == contract['tools']['reviewer']
            and aggregate.get('contract') == review.get('contract') == contract_record
            and aggregate.get('declaration') == review.get('declaration') == contract['declaration']
            and review.get('aggregate') == e.keep(perf / 'owner-growth-comparison.json')
            and all(not any(key in receipt for key in ('postMeasurementIoCorrection', 'ioCorrection', 'declaredGenerator'))
                    for receipt in (aggregate, review)), 'Cost results substituted an undeclared generator or correction')
    require(review.get('checkedCount') == len(review['checks']) > 0 and review.get('inputsUnchanged') is True
            and all(row.get('passed') is True for row in review['checks'])
            and aggregate['sources'] == review['sources'] == {
                'baseline': {'digest': baseline['digest'], 'fileCount': baseline['fileCount']},
                'after': {'digest': digest, 'fileCount': native['fileCount']}}, 'Independent cost review is incomplete')
    require(policy.get('globalStage') == 'session_elapsed' and policy.get('relativeIncreaseLimit') == 0.1
            and policy.get('comparison') == 'strictly_less_than' and policy.get('allCasesMustPass') is True
            and policy.get('crossCaseCompensation') is False and policy.get('phaseOverrunsMayBeAccepted') is True
            and policy.get('phasesAndP95RemainVisible') is True, 'The user-authorized global cost rule changed')
    cases = review['globalCases']
    require([row['case'] for row in cases] == policy['caseIds'] and cases == aggregate['globalCases']
            and all(type(row['accepted']) is bool for row in cases)
            and review['acceptedCases'] == sum(row['accepted'] for row in cases)
            and review['totalCases'] == len(cases) and type(review['accepted']) is bool
            and review['accepted'] is review['globalAccepted'] is aggregate['globalAccepted'] is all(row['accepted'] for row in cases)
            and review['globalStatus'] == aggregate['globalStatus'], 'Global verdict differs from the actual per-case decision')
    require(aggregate['historicalStrict']['passed'] is review['historicalStrictPassed'] is False
            and aggregate['historicalStrict']['status'] == 'failed_work_metadata'
            and review['diagnosticPhaseRule']['status'] == aggregate['phaseStatus']
            and not local(contract['historicalAggregateOutput']).exists(), 'Historical strict refusal or phase diagnostics were relabeled')
    e.checked(aggregate['historicalStrict']['failureReceipt'])
    e.checked(aggregate['historicalStrict']['failureLog'])

    measured, warmups, measured_actions, warmup_actions = 0, 0, 0, 0
    physical_sessions = set()
    for execution in window['executions']:
        require(execution.get('status') == 'passed' and execution.get('exitCode') == 0, 'A measured cost series is incomplete')
        log = e.keep(execution['log'])
        require(log['sha256'] == execution['logSha256'], 'Actual cost log changed')
        output_path = execution.get('copiedOutput', execution['output'])
        raw_record = {'path': output_path, 'sha256': execution['reportSha256']}
        raw = e.referenced(raw_record, allow_external=True)
        require(raw.get('status') == 'passed' and raw.get('nativeSourceUnchanged') is True
                and raw['nativeSource']['digest'] == (baseline['digest'] if execution['label'].startswith('A') else digest),
                'Actual cost report has another native identity')
        for case in raw['cases']:
            for trial in case['trials']:
                physical = (trial['startedAt'], trial['finishedAt'])
                require(physical not in physical_sessions and type(trial['warmup']) is bool
                        and type(trial['actions']) is int and trial['actions'] >= 0,
                        'A physical cost session is repeated or has an invalid population')
                physical_sessions.add(physical)
                if trial['warmup']:
                    warmups += 1
                    warmup_actions += trial['actions']
                else:
                    measured += 1
                    measured_actions += trial['actions']
    population = {'measuredSessions': measured, 'measuredActions': measured_actions,
                  'excludedWarmupSessions': warmups, 'excludedWarmupActions': warmup_actions}
    require(all(declaration[key] == policy[key] == aggregate[key] == review[key] == count for key, count in population.items()),
            'Actual complete session population differs from the declared/reviewed counts')
    require(render.get('schema') == 'logos-engine.lot5b-cost-report-render.v1'
            and render.get('status') == 'rendered_retained_receipts'
            and render.get('generator') == e.keep(BASE / 'write-cost-results.py')
            and render.get('report') == e.keep(perf / 'results.md') and render.get('inputReceiptsUnchanged') is True
            and render.get('displayedMeasuredSessions') == measured, 'Rendered cost report is not bound to all measured sessions')
    for receipt in (review, render):
        for record in receipt['inputs']:
            e.checked(record)
        for record in receipt.get('watchedExternalInputs', []):
            e.checked(record, allow_external=True)
    require(transport.get('schema') == 'logos-engine.lossless-log-transport.v1' and transport.get('status') == 'passed'
            and transport.get('window') == e.keep(perf / 'window.json')
            and transport.get('generator') == e.keep(BASE / 'record-cost-log-transport.py')
            and [row['series'] for row in transport['logs']] == declaration['plannedOrder'], 'Cost log transport is incomplete')
    for row in transport['logs']:
        original = e.checked(row['original'])
        packed = e.checked(row['transport'])
        require(row.get('byteIdentical') is True and gzip.decompress(packed.read_bytes()) == original.read_bytes(),
                'Cost log transport does not reconstruct the retained original bytes')
    e.recheck()
    recorded = datetime.now(timezone.utc)
    require(instant(window['finishedAt']) <= instant(aggregate['recordedAt']) <= instant(review['recordedAt'])
            <= instant(render['recordedAt']) <= recorded,
            'Completed review/render chronology is invalid')
    require(instant(window['finishedAt']) <= instant(transport['recordedAt']) <= recorded,
            'Log transport chronology is invalid')
    result = {'schema': 'logos-engine.lot5b-publication-inputs.v1', 'status': 'passed', 'recordedAt': recorded.isoformat(),
              'generator': e.keep(__file__), 'verificationHelper': e.keep(HELPER),
              'nativeVersion': policy['candidate']['nativeVersion'], 'nativeSourceDigest': digest,
              'baseline': policy['baseline'], 'publishedPredecessors': readiness['publishedPredecessors'],
              'formalTests': counts, 'formalTestFiles': len(tests['testFiles']), 'testScope': readiness['testScope'],
              'officialCheckNames': helper.CHECK_NAMES, 'fileInventories': inventories,
              'nativeAgentWorker': checks['nativeAgentWorker'], 'costGlobalStatus': review['globalStatus'],
              'costAccepted': review['accepted'], 'costGenerators': contract['tools'], 'historicalStrictPassed': False,
              'costPopulation': population, 'componentOracle': readiness['componentOracle'], 'commonProofs': readiness['commonProofs'],
              'browser': readiness['browser'], 'weav': readiness['weav'], 'newGameSuccessClaimed': False,
              'inputsUnchanged': True, 'receipts': list(e.inputs.values()), 'watchedExternalInputs': list(e.external.values()),
              'publicationExecuted': False,
              'qualification': 'Completed evidence and file integrity only. All declared physical sessions and warmups are retained. '
                  'The actual global cost verdict, phase diagnostics and failed historical strict identity gate remain distinct. '
                  'The current source, compiled worker, formal test union, original component oracle, bounded common proofs '
                  'and browser qualification remain those bound by readiness. The exhausted WEAV clock is preserved. '
                  'This receipt does not publish the candidate, close a lot, claim a new game success or turn a rejected global '
                  'cost verdict into acceptance. No test, agent, game, build, measurement, Git or network operation is run.'}
    with output.open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    print(json.dumps({'status': 'passed', 'receipt': fingerprint(output), 'costAccepted': review['accepted'],
                      'formalTestFiles': len(tests['testFiles']), 'publicationExecuted': False}))


if __name__ == '__main__':
    main()
