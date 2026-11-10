#!/usr/bin/env python3
"""Independently recalculate retained 3H costs and check their rendered tables.

Only JSON, Markdown and file bytes are read. No official calculator is imported
or invoked, and no runtime, game, build, test or timing harness is executed.
"""
from collections import Counter
from datetime import datetime, timedelta, timezone
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
from statistics import median

BASE = Path(__file__).resolve().parent.parent
ROOT = BASE.parents[2]
PERF = BASE / 'performance'
OUTPUT = BASE / 'diagnostic/cost-result-review.json'
LOCAL = timezone(timedelta(hours=-3))
STAGES = ['session_elapsed', 'new_decision', 'known_prefix_service', 'known_prefix_request',
          'known_prefix_guard', 'acquisition_and_persistence', 'persistence', 'restoration']
CASES = ['STCK', 'SMLP']
DIGESTS = {
    'baseline': 'fce8dfc3e6861742649203161b3bf55b6480462e44c77d8015453ce55b724a26',
    'after': 'd6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054',
}


def read(path):
    raw = path.read_bytes()
    return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)


def fp(path):
    raw = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(raw),
            'sha256': hashlib.sha256(raw).hexdigest()}


def equivalent(expected, actual):
    if isinstance(expected, dict):
        return isinstance(actual, dict) and all(key in actual and equivalent(value, actual[key])
                                               for key, value in expected.items())
    if isinstance(expected, list):
        return isinstance(actual, list) and len(expected) == len(actual) and all(
            equivalent(a, b) for a, b in zip(expected, actual))
    if isinstance(expected, bool) or expected is None:
        return expected is actual
    if isinstance(expected, (int, float)):
        return isinstance(actual, (int, float)) and not isinstance(actual, bool) and math.isfinite(actual) \
            and math.isclose(expected, actual, rel_tol=1e-12, abs_tol=1e-9)
    return expected == actual


def distribution(values):
    values = sorted(values)
    if not values:
        return dict(count=0, medianMs=None, p95Ms=None, minMs=None, maxMs=None)
    if not all(isinstance(x, (int, float)) and math.isfinite(x) for x in values):
        raise ValueError('A timing sample is not finite')
    n = len(values)
    return dict(count=n, medianMs=median(values),
                p95Ms=values[math.ceil(0.95 * n) - 1] if n >= 20 else None,
                minMs=values[0], maxMs=values[-1])


def samples(trial, stage):
    if stage == 'session_elapsed':
        return [trial['replayElapsedMs']]
    if stage in ('known_prefix_service', 'known_prefix_request'):
        field = 'nativeServiceMs' if stage == 'known_prefix_service' else 'wallMs'
        return [row[field] for row in trial['requests'] if row['type'] == 'advance' and row['kind'] == 'action']
    return [row['elapsedMs'] for row in trial['samples'] if row['stage'] == stage]


def metric(trials, stage):
    pooled_values = [value for trial in trials for value in samples(trial, stage)]
    medians = [median(session_values) for trial in trials if (session_values := samples(trial, stage))]
    centre = median(medians) if medians else None
    return distribution(pooled_values), (max(medians) - min(medians)) / centre if centre else None


def ratio(before, after):
    return after / before - 1 if before is not None and before > 0 and after is not None else None


def number(value, precision=None):
    if value is None:
        return 'indisponible'
    digits = precision if precision is not None else (6 if abs(value) < 1 else 3)
    return format(value, f'.{digits}f').replace('.', ',').replace('-', '−')


def percentage(value, signed=True):
    if value is None:
        return 'indisponible'
    return format(value * 100, '+.6f' if signed else '.6f').replace('.', ',').replace('-', '−') + ' %'


def pair(before, after, field):
    return number(before[field]) + ' / ' + number(after[field])


def span(value):
    return number(value['minMs']) + ' à ' + number(value['maxMs'])


def rendered_sections(document):
    sections = {}
    heading = None
    for line in document.splitlines():
        match = re.match(r'^#{1,3} (.+)$', line)
        if match:
            heading = match.group(1)
            sections[heading] = []
        elif heading:
            sections[heading].append(line)
    return sections


def table_rows(lines, first_header):
    selected, rows = False, []
    for line in lines:
        if line.startswith('| '):
            cells = [cell.strip() for cell in line.strip().strip('|').split('|')]
            if not selected:
                if cells == first_header:
                    selected = True
                continue
            if not all(re.fullmatch(r':?-+:?', cell) for cell in cells):
                rows.append(cells)
        elif selected:
            break
    return rows


def multiset(rows):
    return Counter(json.dumps(row, sort_keys=True, separators=(',', ':')) for row in rows)


def main():
    if OUTPUT.exists():
        raise FileExistsError(OUTPUT)
    started = datetime.now(LOCAL).isoformat()
    names = ['global-budget-policy.json', 'comparison-policy.json', 'cases.json', 'declaration.json',
             'readiness.json', 'window.json', 'combined-comparison.json', 'global-budget-decision.json',
             'consolidation-review.json', 'log-transport.json', 'static-preflight.json', 'results-render.json']
    names += [f'cohort{i}/{kind}.json' for i in (1, 2) for kind in ('baseline', 'after', 'comparison')]
    data = {name: read(PERF / name) for name in names}
    render = data['results-render.json']
    input_paths = {PERF / name for name in names}
    input_paths.add(PERF / 'results.md')
    input_paths.add(BASE / 'write-cost-results.py')
    input_paths.update(ROOT / item['path'] for item in render['inputs'])
    inputs = [fp(path) for path in sorted(input_paths)]
    checks = []

    def check(name, condition, **details):
        checks.append({'name': name, 'passed': bool(condition), **details})

    policy, phase = data['global-budget-policy.json'], data['comparison-policy.json']
    declaration, readiness, window = (data[name] for name in ('declaration.json', 'readiness.json', 'window.json'))
    combined, decision, consolidation = (data[name] for name in
        ('combined-comparison.json', 'global-budget-decision.json', 'consolidation-review.json'))
    cases = data['cases.json']
    text = (PERF / 'results.md').read_text()
    sections = rendered_sections(text)
    check('declared_cases_and_rounds', cases['rounds'] == 4 and [r['id'] for r in cases['cases']] == CASES
          and [r['actions'] for r in cases['cases']] == [10, 15]
          and all(r['warmupActions'] == 3 for r in cases['cases']))
    check('strict_global_policy', policy['caseIds'] == CASES and policy['globalStage'] == 'session_elapsed'
          and policy['relativeIncreaseLimit'] == 0.1 and policy['comparison'] == 'strictly_less_than'
          and policy['allCasesMustPass'] is True and policy['crossCaseCompensation'] is False
          and policy['phaseOverrunsMayBeAccepted'] is True and policy['phasesAndP95RemainVisible'] is True)
    check('unchanged_phase_definitions', phase['stages'] == STAGES and phase['relativeBudget'] == 0.1
          and phase['unaffectedCaseIds'] == CASES)
    check('native_identities', policy['baseline']['nativeVersion'] == '0.48.0'
          and policy['baseline']['siteVersion'] == 76
          and policy['baseline']['commit'] == 'fbbc3fb6b796c0ba359654da7234008767090e1f'
          and policy['baseline']['nativeDigest'] == DIGESTS['baseline']
          and policy['candidate']['nativeVersion'] == '0.49.0'
          and policy['candidate']['nativeDigest'] == DIGESTS['after'])
    instant = lambda value: datetime.fromisoformat(value.replace('Z', '+00:00'))
    check('declaration_and_readiness_precede_window', readiness['measurementAuthorized'] is True
          and readiness['pendingRequirements'] == []
          and all(instant(value) < instant(window['startedAt']) for value in
                  (declaration['finalizedAt'], readiness['finalizedAt'], policy['declaredAt'])))
    check('complete_abba_window', window['status'] == window['finalIntegrity'] == 'passed'
          and policy['plannedOrder'] == window['plannedOrder'] == ['A1', 'B1', 'B2', 'A2']
          and [r['label'] for r in window['executions']] == policy['plannedOrder']
          and all(r['status'] == 'passed' and r['exitCode'] == 0 for r in window['executions']))
    check('consolidation_231_checks', consolidation['status'] == 'passed'
          and consolidation['checkedCount'] == len(consolidation['checks']) == 231
          and all(r['passed'] is True for r in consolidation['checks']))
    tools = [*declaration['officialTools'], declaration['globalDecisionTool'], declaration['globalCalculationTool']]
    check('seven_official_tools_unchanged', len(tools) == 7 and all(fp(ROOT / r['path']) == r for r in tools))
    measured, warmups, all_trials = [], [], {}
    aggregate_ledger, decision_ledger = [], []
    for cohort in (1, 2):
        for side in ('baseline', 'after'):
            report = data[f'cohort{cohort}/{side}.json']
            check(f'raw_{cohort}_{side}_identity', report['status'] == 'passed'
                  and report['nativeSourceUnchanged'] is True and report['nativeSource']['digest'] == DIGESTS[side])
            for case in report['cases']:
                group = [trial for trial in case['trials'] if trial['warmup'] is False]
                warm = [trial for trial in case['trials'] if trial['warmup'] is True]
                all_trials[cohort, side, case['id']] = group
                actions = next(row['actions'] for row in cases['cases'] if row['id'] == case['id'])
                check(f'raw_{cohort}_{side}_{case["id"]}_complete_sessions', len(group) == 4 and len(warm) == 1
                      and len(group) + len(warm) == len(case['trials'])
                      and [r['round'] for r in group] == [1, 2, 3, 4]
                      and all(r['actions'] == actions and r['final']['actions'] == actions
                              and r['final']['acquiredTransitions'] == actions for r in group)
                      and warm[0]['actions'] == 3)
                for trial in case['trials']:
                    row = {'cohort': f'cohort_{cohort}', 'side': side, 'case': case['id'], 'round': trial['round'],
                           'startedAt': trial['startedAt'], 'actions': trial['actions'], 'elapsedMs': trial['replayElapsedMs']}
                    (warmups if trial['warmup'] else measured).append(row)
                    if not trial['warmup']:
                        decision_ledger.append(row)
                        aggregate_ledger.append({key: row[key] for key in ('cohort', 'side', 'case', 'round', 'startedAt', 'actions')} |
                            {'finishedAt': trial['finishedAt'], 'levelsCompleted': trial['levelsCompleted'],
                             'sampleCount': len(trial['samples']), 'requestCount': len(trial['requests'])})
    check('32_sessions_400_actions', len(measured) == decision['measuredSessions'] == policy['measuredSessions'] == 32
          and sum(r['actions'] for r in measured) == decision['measuredActions'] == policy['measuredActions'] == 400)
    check('only_8_warmups_24_actions_excluded', len(warmups) == policy['excludedWarmupSessions'] == 8
          and sum(r['actions'] for r in warmups) == policy['excludedWarmupActions'] == 24
          and combined['method']['excludedWarmupsPerCaseAndVersion'] == 2)
    check('all_measured_ledger_multiplicities_retained', multiset(aggregate_ledger) == multiset(combined['includedMeasuredSessions'])
          and multiset(decision_ledger) == multiset(decision['sessionLedger']))
    check('no_measured_session_outlier_or_cohort_exclusion', combined['method']['excludedMeasuredSessions'] == 0
          and combined['method']['excludedOutliers'] == 0 and combined['method']['selectedCohort'] is None
          and combined['method']['noiseAllowanceAdded'] is False
          and decision['policy']['excludedMeasuredSessions'] == decision['policy']['excludedOutliers'] == 0)
    median_headers = ['Jeu', 'Mesure', 'Effectif A / B', 'Médiane A, ms', 'Médiane B, ms', 'Variation', 'Diagnostic conservé']
    tail_headers = ['Jeu', 'Mesure', 'Min à max A, ms', 'Min à max B, ms', 'p95 A / B, ms',
                    'Variation p95', 'Étendue relative des médianes de session A / B']
    reviews, group_summaries, aggregate_tails, globals_calculated = [], [], [], []
    for group, cohort_ids, recorded, median_heading, tail_heading in [
        ('aggregate', (1, 2), combined, 'Les seize diagnostics agrégés', 'Dispersion et p95 agrégés'),
        ('cohort1', (1,), data['cohort1/comparison.json'], 'Cohorte 1 : seize diagnostics', 'Cohorte 1 : dispersion et p95'),
        ('cohort2', (2,), data['cohort2/comparison.json'], 'Cohorte 2 : seize diagnostics', 'Cohorte 2 : dispersion et p95'),
    ]:
        expected_medians, expected_tails, unresolved, passed = [], [], [], 0
        for case_id in CASES:
            a = [trial for c in cohort_ids for trial in all_trials[c, 'baseline', case_id]]
            b = [trial for c in cohort_ids for trial in all_trials[c, 'after', case_id]]
            entry = next(row for row in recorded['comparisons'] if row['case'] == case_id)
            check(f'{group}_{case_id}_ordered_stages', [row['stage'] for row in entry['metrics']] == STAGES)
            for stage in STAGES:
                before, an = metric(a, stage)
                after, bn = metric(b, stage)
                increase = ratio(before['medianMs'], after['medianMs'])
                classification = ('within_observed_budget' if increase <= 0.1 else
                    'over_budget_with_noise_unresolved' if max(an or 0, bn or 0) > 0.1 else 'over_budget')
                calculated = dict(stage=stage, before=before, after=after, medianRelativeIncrease=increase,
                                  roundMedianNoise=dict(baselineRelativeRange=an, afterRelativeRange=bn),
                                  budgetApplies=True, result=classification)
                actual = next(row for row in entry['metrics'] if row['stage'] == stage)
                check(f'{group}_{case_id}_{stage}_raw_distribution_ratio_noise_classification', equivalent(calculated, actual))
                reviews.append({'group': group, 'case': case_id, **calculated})
                if classification == 'within_observed_budget':
                    passed += 1
                else:
                    unresolved.append(dict(case=case_id, stage=stage, result=classification, medianRelativeIncrease=increase))
                    check(f'{group}_{case_id}_{stage}_overrun_text_visible',
                          f"**{case_id} `{stage}` {percentage(increase)}**" in '\n'.join(sections[median_heading]))
                p95_change = ratio(before['p95Ms'], after['p95Ms'])
                if p95_change is not None and p95_change > 0.1:
                    check(f'{group}_{case_id}_{stage}_p95_overrun_text_visible',
                          f"**{case_id} `{stage}` {percentage(p95_change)}**" in '\n'.join(sections[tail_heading]))
                    if group == 'aggregate':
                        aggregate_tails.append({'case': case_id, 'stage': stage, 'relativeIncrease': p95_change})
                expected_medians.append([case_id, f'`{stage}`', f"{before['count']} / {after['count']}",
                    number(before['medianMs']), number(after['medianMs']), percentage(increase), f'`{classification}`'])
                expected_tails.append([case_id, f'`{stage}`', span(before), span(after), pair(before, after, 'p95Ms'),
                    percentage(p95_change), percentage(an, False) + ' / ' + percentage(bn, False)])
                if group == 'aggregate' and stage == 'session_elapsed':
                    global_row = next(row for row in decision['globalCases'] if row['case'] == case_id)
                    expected = dict(case=case_id, sessionsPerVersion=8, beforeMedianMs=before['medianMs'],
                                    afterMedianMs=after['medianMs'], medianRelativeIncrease=increase,
                                    accepted=increase < 0.1,
                                    result='within_user_global_budget' if increase < 0.1 else 'global_budget_exceeded')
                    check(f'{case_id}_global_pooled_session_median_and_strict_decision', equivalent(expected, global_row))
                    globals_calculated.append(expected)
        check(f'{group}_all_16_median_table_rows', table_rows(sections[median_heading], median_headers) == expected_medians)
        check(f'{group}_all_16_dispersion_p95_table_rows', table_rows(sections[tail_heading], tail_headers) == expected_tails)
        check(f'{group}_all_unresolved_retained', equivalent(unresolved, recorded['unresolved'])
              and recorded['status'] == ('budget_review_required' if unresolved else 'within_observed_budget'))
        if group == 'aggregate':
            check('aggregate_15_of_16_and_historical_phase_copy', passed == combined['withinObservedBudget'] == 15
                  and combined['budgetMetricCount'] == 16 and decision['historicalPhaseRule'] == {
                      key: combined[key] for key in ('status', 'budgetMetricCount', 'withinObservedBudget', 'unresolved')})
        group_summaries.append({'group': group, 'withinObservedBudget': passed, 'diagnostics': 16, 'unresolved': unresolved})
    check('cohort_outcomes_14_of_16_and_12_of_16', [r['withinObservedBudget'] for r in group_summaries[1:]] == [14, 12])
    check('all_48_diagnostics_recomputed', len(reviews) == 48 and sum(r['group'] == 'aggregate' for r in reviews) == 16)
    check('global_2_of_2_accepted', decision['acceptedCases'] == decision['totalCases'] == 2
          and decision['accepted'] is True and all(row['accepted'] for row in globals_calculated)
          and decision['status'] == 'accepted_under_user_global_rule')
    global_headers = ['Jeu', 'Sessions A / B', 'Médiane A, ms', 'Médiane B, ms', 'Variation globale', 'Écart au seuil, points', 'Décision']
    global_rows = [[row['case'], '8 / 8', number(row['beforeMedianMs']), number(row['afterMedianMs']),
                    percentage(row['medianRelativeIncrease']), number((0.1-row['medianRelativeIncrease'])*100, 6),
                    'Accepté' if row['accepted'] else '**Non accepté**'] for row in globals_calculated]
    check('global_rendered_rows', table_rows(sections['Critère global par jeu'], global_headers) == global_rows)
    check('three_aggregate_p95_overruns_retained', {(r['case'], r['stage']) for r in aggregate_tails} == {
        ('STCK', 'persistence'), ('SMLP', 'new_decision'), ('SMLP', 'restoration')})
    check('p95_withheld_below_20_samples', all(
        (r[side]['p95Ms'] is None) == (r[side]['count'] < 20) for r in reviews for side in ('before', 'after')))
    check('render_summary_and_exclusions_visible', '**15/16**' in text and '231/231 contrôles' in text
          and '| Chauffes exclues | 8 sessions / 24 actions |' in text
          and '| Sessions mesurées ou valeurs extrêmes exclues | 0 |' in text
          and 'strictement sous +10 %' in text)
    inspection_rows, pause_rows, pause_ack_rows, memory_rows = [], [], [], []
    for cohort in (1, 2):
        comparison = data[f'cohort{cohort}/comparison.json']
        for case_id in CASES:
            row = next(r for r in comparison['comparisons'] if r['case'] == case_id)
            for label, field in [('nativeService', 'nativeServiceMs'), ('endToEnd', 'endToEndMs')]:
                a, b = [distribution([r[field] for trial in all_trials[cohort, side, case_id] for r in trial['inspection']])
                        for side in ('baseline', 'after')]
                check(f'cohort{cohort}_{case_id}_{label}_inspection_distribution',
                      equivalent(a, row['inspection']['before'][label]) and equivalent(b, row['inspection']['after'][label]))
                inspection_rows.append([str(cohort), case_id, f'`{label}`', f"{a['count']} / {b['count']}",
                    pair(a, b, 'medianMs'), percentage(ratio(a['medianMs'], b['medianMs'])),
                    span(a) + ' / ' + span(b), pair(a, b, 'p95Ms')])
            for phase_id in ('initial_planning', 'engaged_action'):
                for label, field in [('acknowledgement', 'acknowledgementMs'), ('safeBoundary', 'safeBoundaryMs')]:
                    a, b = [distribution([r[field] for trial in all_trials[cohort, side, case_id]
                                          for r in trial['pauses'] if r['phase'] == phase_id]) for side in ('baseline', 'after')]
                    check(f'cohort{cohort}_{case_id}_{phase_id}_{label}_pause_distribution',
                          equivalent(a, row['pause']['before'][phase_id][label]) and equivalent(b, row['pause']['after'][phase_id][label]))
                    pause_rows.append([str(cohort), case_id, f'`{phase_id}`', f'`{label}`', f"{a['count']} / {b['count']}",
                        pair(a, b, 'medianMs'), percentage(ratio(a['medianMs'], b['medianMs'])),
                        span(a) + ' / ' + span(b), pair(a, b, 'p95Ms')])
        for side, label in [('baseline', 'A'), ('after', 'B')]:
            for case_id in CASES:
                trials = all_trials[cohort, side, case_id]
                for phase_id in ('initial_planning', 'engaged_action'):
                    pauses = [r for trial in trials for r in trial['pauses'] if r['phase'] == phase_id]
                    pause_ack_rows.append([str(cohort), case_id, label, f'`{phase_id}`', str(len(pauses)),
                        str(sum(r['acknowledgedPaused'] is True for r in pauses)),
                        ', '.join(str(v) for v in sorted({r['actionsAtSafeBoundary'] for r in pauses}))])
                for field in ('heapUsed', 'rss'):
                    values = [r[field] / (1024*1024) for trial in trials for r in trial['memory']]
                    memory_rows.append([str(cohort), case_id, label, f'`{field}`', str(len(values)),
                                        number(median(values)), number(min(values)) + ' à ' + number(max(values))])
    auxiliary = sections['Inspection et Pause']
    check('inspection_table_recalculated', table_rows(auxiliary, ['Cohorte', 'Jeu', 'Inspection', 'Effectif A / B',
        'Médiane A / B, ms', 'Variation', 'Min à max A / B, ms', 'p95 A / B, ms']) == inspection_rows)
    check('pause_table_recalculated', table_rows(auxiliary, ['Cohorte', 'Jeu', 'Contexte', 'Latence', 'Effectif A / B',
        'Médiane A / B, ms', 'Variation', 'Min à max A / B, ms', 'p95 A / B, ms']) == pause_rows)
    check('pause_acknowledgements_table_recalculated', table_rows(auxiliary,
        ['Cohorte', 'Jeu', 'Version', 'Contexte Pause', 'Observations', 'Acquittements', 'Actions à la frontière sûre']) == pause_ack_rows)
    check('memory_table_recalculated', table_rows(sections['Échantillons mémoire conservés'],
        ['Cohorte', 'Jeu', 'Version', 'Mesure', 'Effectif', 'Médiane, Mio', 'Min à max, Mio']) == memory_rows)
    incident = read(BASE / 'diagnostic/cost-report-render-incident.json')
    check('render_failure_and_original_measurement_inputs_retained', incident['errorType'] == 'KeyError'
          and incident['missingKey'] == 'diagnosticPhaseRule' and incident['reportWritten'] is False
          and all(fp(ROOT / row['path']) == row for row in incident['inputReceipts'])
          and fp(ROOT / incident['failureLog']['path']) == incident['failureLog']
          and hashlib.sha256(gzip.decompress((ROOT / incident['rendererBeforeCorrectionTransport']['path']).read_bytes())).hexdigest()
              == incident['rendererBeforeCorrection']['sha256'])
    check('renderer_receipt_binds_results_and_inputs', render['report'] == fp(PERF / 'results.md')
          and render['generator'] == fp(BASE / 'write-cost-results.py') and render['inputReceiptsUnchanged'] is True
          and render['measurementExecuted'] is False and render['runtimeOrGameExecuted'] is False
          and all(fp(ROOT / r['path']) == r for r in render['inputs']))
    check('retained_receipt_fingerprints', all(fp(ROOT / r['path']) == r
          for source in (readiness, consolidation, decision) for r in source['inputs']))
    links = re.findall(r'\[[^\]]+\]\(([^)]+)\)', text)
    check('all_rendered_links_exist', len(links) == render['localLinksChecked'] and all((PERF / link).resolve().is_file() for link in links))
    unchanged = all(fp(ROOT / row['path']) == row for row in inputs)
    check('input_receipts_unchanged_during_review', unchanged)
    unsatisfied = [row['name'] for row in checks if row['passed'] is not True]
    value = {'schema': 'logos-engine.lot3h.cost-result-independent-review.v1',
             'recordedAt': datetime.now(LOCAL).isoformat(), 'startedAt': started, 'timezone': 'UTC−03',
             'status': 'passed' if not unsatisfied else 'failed', 'generator': fp(Path(__file__)),
             'method': 'Independent Python standard-library recalculation from all four raw reports. No official calculation or rendering helper is imported or invoked. Numeric comparisons allow only floating arithmetic tolerance (relative 1e-12, absolute 1e-9), never a budget allowance. Markdown tables are compared to independently calculated displayed values.',
             'counts': {'measuredSessions': len(measured), 'measuredActions': sum(r['actions'] for r in measured),
                        'excludedWarmupSessions': len(warmups), 'excludedWarmupActions': sum(r['actions'] for r in warmups),
                        'aggregateDiagnostics': 16, 'cohortDiagnostics': 32},
             'globalCases': globals_calculated, 'diagnosticGroups': group_summaries,
             'aggregateP95Overruns': aggregate_tails, 'metricReview': reviews,
             'measuredSessionLedger': measured, 'excludedWarmupLedger': warmups,
             'checks': checks, 'checkedCount': len(checks), 'unsatisfied': unsatisfied,
             'inputs': inputs, 'officialTools': tools, 'inputReceiptsUnchanged': unchanged,
             'benchmarkExecuted': False, 'testExecuted': False, 'buildExecuted': False, 'runtimeOrGameExecuted': False,
             'qualification': 'Arithmetic and reporting review of one completed retained window. The per-game global criterion is strictly below +10%; nested phase medians are not summed and games do not compensate each other. All adverse phases, cohorts and p95 remain retained. No live-game latency, causal attribution or complete inherited-caller parity is inferred.'}
    OUTPUT.open('x').write(json.dumps(value, indent=2) + '\n')
    print(json.dumps({'status': value['status'], 'checkedCount': len(checks), 'unsatisfied': unsatisfied,
                      'globalCases': globals_calculated, 'diagnosticGroups': group_summaries,
                      'aggregateP95Overruns': aggregate_tails, 'receipt': fp(OUTPUT)}))
    if unsatisfied:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
