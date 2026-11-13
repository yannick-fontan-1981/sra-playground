#!/usr/bin/env python3
"""Independent standard-library review of the Lot9A supplementary cost result.

Usage: python -B review.py CONTRACT ANALYSIS NEW_OUTPUT
No JavaScript import, native execution, benchmark, lock or evidence mutation.
"""
from __future__ import annotations
import argparse
import copy
from datetime import datetime, timezone
from decimal import Decimal
import gzip
import hashlib
import json
import math
from pathlib import Path
import statistics

ROOT = Path(__file__).resolve().parents[5]
STAGES = ['session_elapsed', 'new_decision', 'known_prefix_service', 'known_prefix_request',
          'known_prefix_guard', 'acquisition_and_persistence', 'persistence', 'restoration']
PLAN = [('A1', 'baseline', 'cohort1/baseline.json'), ('B1', 'candidate', 'cohort1/after.json'),
        ('B2', 'candidate', 'cohort2/after.json'), ('A2', 'baseline', 'cohort2/baseline.json')]


def require(ok, message):
    if not ok:
        raise ValueError(message)


def unique(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'Duplicate JSON key: ' + key)
        result[key] = value
    return result


def equal(a, b, path='value', tolerant=False):
    if type(a) in (int, float) and type(b) in (int, float):
        require(math.isfinite(a) and math.isfinite(b)
                and (a == b if not tolerant or isinstance(a, int) and isinstance(b, int)
                     else math.isclose(a, b, rel_tol=1e-12, abs_tol=1e-12)), 'Numeric mismatch: ' + path)
    elif isinstance(a, dict):
        require(isinstance(b, dict) and set(a) == set(b), 'Object fields differ: ' + path)
        for key in a:
            equal(a[key], b[key], path + '.' + key, tolerant)
    elif isinstance(a, list):
        require(isinstance(b, list) and len(a) == len(b), 'Array length differs: ' + path)
        for index, value in enumerate(a):
            equal(value, b[index], path + '[' + str(index) + ']', tolerant)
    else:
        require(type(a) is type(b) and a == b, 'Exact value differs: ' + path)


def instant(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None, 'Explicit timezone required')
    return result


def omit(value, names):
    return {k: v for k, v in value.items() if k not in names}


def distribution(values):
    require(all(type(v) in (float, int) and math.isfinite(v) and v >= 0 for v in values), 'Invalid timing')
    values = sorted(values)
    n = len(values)
    return {'count': n, 'medianMs': statistics.median(values) if n else None,
            'p95Ms': values[math.ceil(n * 0.95) - 1] if n >= 20 else None,
            'minMs': values[0] if n else None, 'maxMs': values[-1] if n else None}


def values_for(trial, stage):
    if stage == 'session_elapsed':
        return [trial['replayElapsedMs']]
    if stage in ('known_prefix_service', 'known_prefix_request'):
        return [r['nativeServiceMs' if stage == 'known_prefix_service' else 'wallMs']
                for r in trial['requests'] if r['type'] == 'advance' and r['kind'] == 'action']
    return [r['elapsedMs'] for r in trial['samples'] if r['stage'] == stage]


def metric(trials, stage):
    pooled = distribution([v for t in trials for v in values_for(t, stage)])
    medians = [distribution(values_for(t, stage))['medianMs'] for t in trials]
    noise = distribution([v for v in medians if v is not None])
    return pooled, ((noise['maxMs'] - noise['minMs']) / noise['medianMs'] if noise['medianMs'] else None)


def comparison(left, right):
    result = []
    for stage in STAGES:
        a, an = metric(left, stage)
        b, bn = metric(right, stage)
        require(a['count'] == b['count'] > 0 and a['medianMs'] > 0, 'Invalid measured stage count/median')
        increase = b['medianMs'] / a['medianMs'] - 1
        status = 'within_observed_budget' if increase <= 0.1 else (
            'over_budget_with_noise_unresolved' if max(an or 0, bn or 0) > 0.1 else 'over_budget')
        result.append({'stage': stage, 'before': a, 'after': b, 'medianRelativeIncrease': increase,
                       'roundMedianNoise': {'baselineRelativeRange': an, 'afterRelativeRange': bn},
                       'budgetApplies': True, 'result': status})
    return result


def shape(trial):
    return {'actions': trial['actions'], 'cycles': trial['cycles'], 'levelsCompleted': trial['levelsCompleted'],
            'requests': [{key: r[key] for key in ('type', 'sequence', 'kind', 'actions')} for r in trial['requests']],
            'observations': trial['observations'], 'inspection': [{'graphNodes': r['graphNodes']} for r in trial['inspection']],
            'final': trial['final']}


def signature(trial):
    return {'case': trial['case'], 'warmup': trial['warmup'], 'actions': trial['actions'],
            'levelsCompleted': trial['levelsCompleted'], 'cycles': trial['cycles'],
            'samples': [omit(r, ['elapsedMs']) for r in trial['samples']],
            'requests': [omit(r, ['wallMs', 'nativeServiceMs', 'transportAndSchedulingMs']) for r in trial['requests']],
            'observations': trial['observations'],
            'pauses': [omit(r, ['requestedAt', 'acknowledgementMs', 'safeBoundaryMs']) for r in trial['pauses']],
            'inspection': [omit(r, ['nativeServiceMs', 'endToEndMs']) for r in trial['inspection']],
            'memorySamples': [omit(r, ['heapUsed', 'rss']) for r in trial['memory']],
            'final': omit(trial['final'], ['implementation'])}


def normalized(trial):
    value = copy.deepcopy(signature(trial))
    for row in value['observations']:
        row['nodeCount'] = 0
    for row in value['inspection']:
        row['graphNodes'] = 0
    value['final']['nodeCount'] = value['final']['graphRevision'] = 0
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['contract', 'analysis', 'output']:
        parser.add_argument(name, type=Path)
    args = parser.parse_args()
    baseline = None
    watched = {}

    def fp(name):
        path = (ROOT / name).absolute()
        require(path.resolve(strict=True) == path and path.is_file(), 'Canonical input required')
        require(path.is_relative_to(ROOT) or baseline and path.is_relative_to(baseline), 'Input outside selected roots')
        label = path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else str(path)
        digest = hashlib.sha256()
        with path.open('rb') as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(block)
        record = {'path': label, 'bytes': path.stat().st_size, 'sha256': digest.hexdigest()}
        require(label not in watched or watched[label] == record, 'Input changed during review: ' + label)
        watched[label] = record
        return record

    def verify(record):
        require(fp(record['path']) == record, 'Pinned input changed: ' + record['path'])

    def read(name):
        record = fp(name)
        data = (ROOT / name).read_bytes()
        require(hashlib.sha256(data).hexdigest() == record['sha256'], 'Input changed during read')
        if str(name).endswith('.gz'):
            data = gzip.decompress(data)
        return json.loads(data, object_pairs_hook=unique,
                          parse_constant=lambda v: (_ for _ in ()).throw(ValueError('Non-finite JSON: ' + v))), record

    output = (ROOT / args.output).absolute()
    require(output.is_relative_to(ROOT / 'docs/migration/lot9a-evidence') and not output.exists(), 'New evidence output required')
    contract, contract_fp = read(args.contract)
    baseline = Path(contract['baseline']['checkout']).resolve(strict=True)
    require(contract['schema'] == 'logos-engine.lot9a-final-cost-contract.v1'
            and contract['status'] == 'declared_before_official_window', 'Invalid prospective contract')
    require(Path(contract['candidate']['checkout']).resolve() == ROOT, 'Candidate checkout differs')
    require(contract['supplementaryTools']['reviewer'] == fp(Path(__file__)), 'Reviewer was not prospectively pinned')
    for record in contract['inputFingerprints']:
        verify(record)
    analysis, analysis_fp = read(args.analysis)
    require(analysis['schema'] == 'logos-engine.lot9a-final-cost-analysis.v1' and analysis['status'] == 'analysis_passed', 'Invalid analysis')
    require(analysis['contract'] == contract_fp and analysis['nativeDigests'] == contract['nativeDigests'], 'Analysis contract/source mismatch')
    require(analysis['generator'] == contract['supplementaryTools']['analyzer'], 'Analyzer was not prospectively pinned')
    for record in analysis['inputFingerprints']:
        verify(record)
    equal(contract['measurement']['order'], ['A1', 'B1', 'B2', 'A2'])
    for key, value in {'rounds': 4, 'measuredSessions': 32, 'measuredActions': 400, 'warmupSessions': 8,
                       'warmupActions': 24, 'sessionsPerCaseVersion': 8, 'excludedMeasuredSessions': 0, 'excludedOutliers': 0}.items():
        equal(contract['measurement'][key], value)
    for key, value in {'comparison': 'strictly_less_than', 'relativeIncreaseLimit': 0.1, 'allCasesMustPass': True,
                       'crossCaseCompensation': False, 'phaseOverrunsMayBeAccepted': True}.items():
        equal(contract['globalRule'][key], value)
    equal(contract['structuralRule']['allowedPaths'],
          ['observations[*].nodeCount', 'inspection[*].graphNodes', 'final.nodeCount', 'final.graphRevision'])
    perf = contract['performanceDirectory']
    cases, _ = read(contract['cases']['path'])
    policy, _ = read(contract['comparisonPolicy']['path'])
    equal(policy['stages'], STAGES)
    equal(policy['relativeBudget'], 0.1)
    equal(policy['unaffectedCaseIds'], ['STCK', 'SMLP'])
    forms, _ = read(contract['expectedForms']['path'])
    equal(forms['nativeDigests'], contract['nativeDigests'])
    forms = forms['forms']
    manifests = {}
    for role, root in [('baseline', baseline), ('candidate', ROOT)]:
        manifests[role], _ = read(contract[role]['manifest']['path'])
        paths = sorted(p.relative_to(root).as_posix() for folder in ['src/logos-engine', 'src/runtime']
                       for p in (root / folder).rglob('*') if p.is_file() and p.suffix in ('.ts', '.json', '.drm'))
        require(paths == sorted(manifests[role]['files']), 'Native source population changed')
        for path in paths:
            require(fp(root / path)['sha256'] == manifests[role]['files'][path], 'Native source byte changed')
    window, window_fp = read(Path(perf) / 'window.json')
    equal(analysis['window'], window_fp)
    require(window['status'] == 'passed' and window['finalIntegrity'] == 'passed', 'Incomplete window')
    equal(window['plannedOrder'], ['A1', 'B1', 'B2', 'A2'])
    equal([r['label'] for r in window['executions']], ['A1', 'B1', 'B2', 'A2'])
    require(instant(contract['recordedAt']) < instant(window['startedAt']), 'Contract is not prospective')
    runner = next(r for r in contract['historicalTools'] if r['path'] == 'scripts/measure-native-loop-costs.mjs')
    reports, ledger, signatures, common = {}, [], {}, {}
    previous_finish = instant(window['startedAt'])
    for index, (label, role, filename) in enumerate(PLAN):
        report, record = read(Path(perf) / filename)
        reports[label] = (report, record)
        execution = window['executions'][index]
        require(execution['status'] == 'passed' and execution['exitCode'] == 0
                and execution['reportSha256'] == record['sha256'], 'Execution/report mismatch')
        require(instant(execution['startedAt']) >= previous_finish, 'Window order overlaps')
        previous_finish = instant(execution['finishedAt'])
        require(previous_finish >= instant(execution['startedAt']), 'Negative execution interval')
        require(report['schema'] == 'logos-engine.native-loop-costs.v1' and report['status'] == 'passed'
                and report['nativeSourceUnchanged'] is True, 'Invalid measurement report')
        equal(report['nativeSource'], manifests[role])
        equal(report['generator'], runner)
        equal(report['manifest'], cases)
        equal(report['checkout'], contract[role]['checkout'])
        equal(report['environment'], reports['A1'][0]['environment'])
        equal(report['inputs'], reports['A1'][0]['inputs'])
        equal([r['id'] for r in report['cases']], ['STCK', 'SMLP'])
        for item in report['cases']:
            equal([[t['round'], t['warmup']] for t in item['trials']], [[0, True], [1, False], [2, False], [3, False], [4, False]])
            equal(omit(item['sessionElapsed'], ['tailQualification']), distribution([t['replayElapsedMs'] for t in item['trials'] if not t['warmup']]))
            for trial in item['trials']:
                require(type(trial['replayElapsedMs']) in (int, float) and math.isfinite(trial['replayElapsedMs']) and trial['replayElapsedMs'] > 0, 'Invalid session duration')
                form_name = 'warmup' if trial['warmup'] else 'measured'
                form = next(f for f in forms if (f['case'], f['form']) == (item['id'], form_name))
                equal(shape(trial), form[role])
                equal(trial['final']['implementation'], 'logos-engine.typescript.v6.native-migration/' + contract[role]['nativeVersion'])
                key, common_key = (role, item['id'], form_name), (item['id'], form_name)
                sig, norm = signature(trial), normalized(trial)
                if key in signatures:
                    equal(sig, signatures[key])
                else:
                    signatures[key] = sig
                if common_key in common:
                    equal(norm, common[common_key])
                else:
                    common[common_key] = norm
                require(instant(execution['startedAt']) <= instant(trial['startedAt']) <= instant(trial['finishedAt']) <= instant(execution['finishedAt']), 'Trial interval outside series')
                ledger.append({'label': label, 'role': role, 'cohort': 'cohort1' if label.endswith('1') else 'cohort2',
                    'case': item['id'], 'round': trial['round'], 'warmup': trial['warmup'], 'startedAt': trial['startedAt'],
                    'finishedAt': trial['finishedAt'], 'actions': trial['actions'], 'elapsedMs': trial['replayElapsedMs'], 'report': record})
    require(previous_finish <= instant(window['finishedAt']), 'Window finishes before last series')
    equal(ledger, analysis['includedTrials'])
    require(len(ledger) == len({(r['label'], r['case'], r['round']) for r in ledger}) == 40, 'Incomplete/duplicated trial ledger')
    require(len({(r['startedAt'], r['finishedAt']) for r in ledger}) == 40, 'A physical trial timestamp pair was reused')
    measured = [r for r in ledger if not r['warmup']]
    warmups = [r for r in ledger if r['warmup']]
    require(len(measured) == 32 and sum(r['actions'] for r in measured) == 400
            and len(warmups) == 8 and sum(r['actions'] for r in warmups) == 24, 'Trial/action totals differ')
    def trials(label, case):
        return [t for item in reports[label][0]['cases'] if item['id'] == case for t in item['trials'] if not t['warmup']]
    for n, a, b in [(1, 'A1', 'B1'), (2, 'A2', 'B2')]:
        pair, record = read(Path(perf) / f'cohort{n}/comparison.json')
        equal(record, analysis['pairs'][n - 1])
        require(pair['status'] in ('passed', 'budget_review_required'), 'Missing original pair diagnostics')
        for case in ['STCK', 'SMLP']:
            equal(next(c['metrics'] for c in pair['comparisons'] if c['case'] == case), comparison(trials(a, case), trials(b, case)), tolerant=True)
    strict, strict_fp = read(analysis['strictAttempt']['path'])
    equal(strict_fp, analysis['strictAttempt'])
    require(strict['schema'] == 'logos-engine.retained-tool-failure.v1' and strict['exitCode'] == 1
            and strict['inputsUnchanged'] is True and strict['outputExists'] is False, 'Strict attempt was not an actual retained refusal')
    for record in strict['inputs'] + [strict['log']]:
        verify(record)
    log = (ROOT / strict['log']['path']).read_bytes()
    if strict['log']['path'].endswith('.gz'):
        log = gzip.decompress(log)
    require(b'Within-cohort work metadata changed' in log and b'AssertionError' in log, 'Unexpected strict failure reason')
    require(not (ROOT / perf / 'combined-comparison.json').exists(), 'Strict output unexpectedly exists')
    comparisons, globals_, structural = [], [], []
    for case in ['STCK', 'SMLP']:
        a = trials('A1', case) + trials('A2', case)
        b = trials('B1', case) + trials('B2', case)
        require(len(a) == len(b) == 8, 'Pooled session count differs')
        metrics = comparison(a, b)
        comparisons.append({'case': case, 'measuredSessionsPerVersion': 8, 'metrics': metrics})
        av, bv = [t['replayElapsedMs'] for t in a], [t['replayElapsedMs'] for t in b]
        am, bm = statistics.median(av), statistics.median(bv)
        globals_.append({'case': case, 'sessionsPerVersion': 8, 'beforeMedianMs': am, 'afterMedianMs': bm,
            'medianRelativeIncrease': bm / am - 1, 'accepted': Decimal(str(bm)) < Decimal(str(am)) * Decimal('1.1'),
            'baselineRawMs': av, 'candidateRawMs': bv})
        for cohort in ['cohort1', 'cohort2']:
            for round_ in range(5):
                form = next(f for f in forms if f['case'] == case and f['form'] == ('warmup' if round_ == 0 else 'measured'))
                context = {'case': case, 'cohort': cohort, 'round': round_, 'warmup': round_ == 0}
                paths = [(f'observations[{i}].nodeCount', row['nodeCount'], form['candidate']['observations'][i]['nodeCount'])
                         for i, row in enumerate(form['baseline']['observations'])]
                paths += [(f'inspection[{i}].graphNodes', row['graphNodes'], form['candidate']['inspection'][i]['graphNodes'])
                          for i, row in enumerate(form['baseline']['inspection'])]
                paths += [('final.' + key, form['baseline']['final'][key], form['candidate']['final'][key]) for key in ['nodeCount', 'graphRevision']]
                for path, before, after in paths:
                    require(type(before) is int and type(after) is int and before >= 0 and after >= 0, 'Invalid structural count')
                    structural.append({**context, 'path': path, 'before': before, 'after': after, 'delta': after - before})
    equal(comparisons, analysis['comparisons'], tolerant=True)
    equal(globals_, analysis['globals'], tolerant=True)
    equal(structural, analysis['structuralDifferences'])
    phase_overruns = [{'case': row['case'], **m} for row in comparisons for m in row['metrics']
                      if m['stage'] != 'session_elapsed' and m['result'] != 'within_observed_budget']
    equal(phase_overruns, analysis['phaseOverruns'], tolerant=True)
    accepted = all(row['accepted'] for row in globals_)
    equal(accepted, analysis['globalBudgetAccepted'])
    for key, value in {'measuredSessions': 32, 'measuredActions': 400, 'warmupSessions': 8, 'warmupActions': 24,
                       'excludedMeasuredSessions': 0, 'excludedOutliers': 0, 'exactFinalFormsChecked': 40,
                       'fullWorkSignaturesChecked': 40, 'historicalStrictComparisonPassed': False,
                       'isolationEstablishedByThisReader': False, 'officialQualificationEstablishedByThisReader': False,
                       'publicationAuthorizedByThisReader': False}.items():
        equal(analysis[key], value)
    for record in list(watched.values()):
        verify(record)
    result = {'schema': 'logos-engine.lot9a-final-cost-independent-review.v1', 'status': 'review_passed',
        'recordedAt': datetime.now(timezone.utc).isoformat(), 'generator': fp(Path(__file__)),
        'contract': contract_fp, 'analysis': analysis_fp, 'nativeDigests': contract['nativeDigests'],
        'checked': {'trials': 40, 'measuredSessions': 32, 'measuredActions': 400, 'warmups': 8, 'warmupActions': 24,
                    'pooledMetrics': 16, 'originalPairMetrics': 32, 'exactFinalShapes': 40, 'fullWorkSignatures': 40,
                    'structuralComparisons': len(structural)},
        'globalBudgetAccepted': accepted, 'globals': globals_, 'phaseOverruns': phase_overruns,
        'historicalStrictComparisonPassed': False, 'officialQualificationEstablishedByThisReader': False,
        'publicationAuthorizedByThisReader': False, 'inputFingerprints': list(watched.values()),
        'qualification': 'Independent Python arithmetic and metadata review from all original trials, with Decimal strict threshold. No excluded measured session or outlier. No measured/native command executed. Historical strict refusal remains failed. Successful arithmetic plus accepted globals does not establish isolation, fulloriginalcaller parity, livegame speed or publication readiness.'}
    with output.open('x') as stream:
        json.dump(result, stream, indent=2, ensure_ascii=False, allow_nan=False)
        stream.write('\n')
    print(json.dumps({'status': result['status'], 'output': str(output.relative_to(ROOT)), 'globalBudgetAccepted': accepted}))


if __name__ == '__main__':
    main()
