#!/usr/bin/env python3
"""Render completed lot 4A cost receipts without executing a measurement.

Usage: python -B docs/migration/lot4a-evidence/write-cost-results.py [PERFORMANCE_DIR]

Adapted from the retained lot 3H writer. Identities, counts and outcomes come
from this window's declaration, policy and actual reports. Missing or incomplete
cost evidence stops the renderer before it creates results.md or its receipt.
Official runners, comparators and review tools are neither imported nor invoked.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from decimal import Decimal
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import re
from statistics import median
import sys

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_PERFORMANCE = Path(__file__).resolve().parent / 'performance'
STAGES = ['session_elapsed', 'new_decision', 'known_prefix_service', 'known_prefix_request',
          'known_prefix_guard', 'acquisition_and_persistence', 'persistence', 'restoration']
SERIES = [('A1', 1, 'baseline'), ('B1', 1, 'after'), ('B2', 2, 'after'), ('A2', 2, 'baseline')]
DIAGNOSTIC_STATUSES = {'passed', 'budget_review_required'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read(path):
    raw = path.read_bytes()
    return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)


def resolve_input(name):
    path = Path(name)
    return (path if path.is_absolute() else ROOT / path).resolve()


def fingerprint(path):
    path = path.resolve()
    raw = path.read_bytes()
    name = path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else str(path)
    return {'path': name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


def instant(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None, 'Un horaire ne précise pas son fuseau')
    return result


def utc(value):
    return instant(value).astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')


def finite(value):
    return type(value) in (float, int) and math.isfinite(value)


def number(value, precision=None):
    if value is None:
        return 'indisponible'
    precision = (6 if abs(value) < 1 else 3) if precision is None else precision
    return f'{value:.{precision}f}'.replace('.', ',').replace('-', '−')


def percent(value, signed=True):
    if value is None:
        return 'indisponible'
    result = f'{value * 100:+.6f}' if signed else f'{value * 100:.6f}'
    return result.replace('.', ',').replace('-', '−') + ' %'


def ratio(before, after):
    return None if before is None or before <= 0 or after is None else after / before - 1


def span(distribution):
    return number(distribution['minMs']) + ' à ' + number(distribution['maxMs'])


def pair(before, after, field):
    return number(before[field]) + ' / ' + number(after[field])


def table(headers, rows):
    def cell(value):
        return str(value).replace('|', '\\|').replace('\n', ' ')
    return '\n'.join(['| ' + ' | '.join(map(cell, headers)) + ' |',
                      '| ' + ' | '.join('---' for _ in headers) + ' |',
                      *('| ' + ' | '.join(map(cell, row)) + ' |' for row in rows)])


def check_distribution(value):
    count = value['count']
    require(type(count) is int and count >= 0, 'Effectif de distribution invalide')
    for field in ('medianMs', 'minMs', 'maxMs', 'p95Ms'):
        require(value[field] is None or finite(value[field]) and value[field] >= 0,
                'Valeur de distribution invalide : ' + field)
    require((value['p95Ms'] is None) == (count < 20),
            'Le p95 doit être disponible exactement lorsque n >= 20')
    if count:
        require(all(value[key] is not None for key in ('minMs', 'medianMs', 'maxMs'))
                and value['minMs'] <= value['medianMs'] <= value['maxMs'],
                'Distribution non vide incomplète ou désordonnée')
    else:
        require(all(value[key] is None for key in ('minMs', 'medianMs', 'maxMs')),
                'Une distribution vide contient une valeur inventée')


def medians(comparisons):
    return table(['Jeu', 'Mesure', 'Effectif A / B', 'Médiane A, ms', 'Médiane B, ms',
                  'Variation', 'Diagnostic conservé'],
                 [[row['case'], '`' + metric['stage'] + '`',
                   f"{metric['before']['count']} / {metric['after']['count']}",
                   number(metric['before']['medianMs']), number(metric['after']['medianMs']),
                   percent(metric['medianRelativeIncrease']), '`' + metric['result'] + '`']
                  for row in comparisons for metric in row['metrics']])


def dispersion(comparisons):
    return table(['Jeu', 'Mesure', 'Min à max A, ms', 'Min à max B, ms', 'p95 A / B, ms',
                  'Variation p95', 'Étendue relative des médianes de session A / B'],
                 [[row['case'], '`' + metric['stage'] + '`', span(metric['before']),
                   span(metric['after']), pair(metric['before'], metric['after'], 'p95Ms'),
                   percent(ratio(metric['before']['p95Ms'], metric['after']['p95Ms'])),
                   percent(metric['roundMedianNoise']['baselineRelativeRange'], False) + ' / '
                   + percent(metric['roundMedianNoise']['afterRelativeRange'], False)]
                  for row in comparisons for metric in row['metrics']])


def adverse_text(comparisons):
    rows = [(row['case'], metric) for row in comparisons for metric in row['metrics']
            if metric['result'] != 'within_observed_budget']
    if not rows:
        return 'Aucun diagnostic de médiane hors du seuil historique dans cet ensemble.'
    return 'Tous les diagnostics défavorables de cet ensemble restent conservés : ' + '; '.join(
        f"**{case} `{metric['stage']}` {percent(metric['medianRelativeIncrease'])}** "
        f"(`{metric['result']}`)" for case, metric in rows) + '.'


def tails_text(comparisons, limit):
    rows = [(row['case'], metric, ratio(metric['before']['p95Ms'], metric['after']['p95Ms']))
            for row in comparisons for metric in row['metrics']]
    adverse = [(case, metric, change) for case, metric, change in rows if change is not None and change > limit]
    if not adverse:
        return f'Aucune hausse de p95 calculable supérieure à {percent(limit)} ; les p95 indisponibles restent signalés.'
    return f'Hausses de p95 supérieures à {percent(limit)}, sans attribution causale par cette mesure : ' + '; '.join(
        f"**{case} `{metric['stage']}` {percent(change)}**" for case, metric, change in adverse) + '.'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('performance_dir', nargs='?', type=Path, default=DEFAULT_PERFORMANCE)
    args = parser.parse_args()
    perf = args.performance_dir.resolve()
    require(perf.is_relative_to(ROOT), 'Le répertoire performance doit être dans ce checkout')
    names = ['window.json', 'declaration.json', 'global-budget-policy.json', 'cases.json',
             'comparison-policy.json', 'protocol-check.json', 'readiness.json',
             'combined-comparison.json', 'consolidation-review.json', 'global-budget-decision.json']
    names += [f'cohort{index}/{name}.json' for index in (1, 2) for name in ('baseline', 'after', 'comparison')]
    missing = [name for name in [*names, 'protocol.md'] if not (perf / name).is_file()]
    require(not missing, 'Coûts complets indisponibles : pièces réelles manquantes : '
            + ', '.join(missing) + '. Aucun results.md ni reçu de rendu ne sera écrit.')
    destination, render_path = perf / 'results.md', perf / 'results-render.json'
    require(not destination.exists() and not render_path.exists(), 'Un rendu existe déjà ; aucun écrasement autorisé')
    records = {}

    def retain(path):
        item = fingerprint(path)
        previous = records.get(item['path'])
        require(previous is None or previous == item, 'Une pièce a changé pendant sa lecture : ' + item['path'])
        records[item['path']] = item
        return item

    def verified(item):
        actual = retain(resolve_input(item['path']))
        require(actual == item, 'Empreinte de pièce différente : ' + item['path'])
        return resolve_input(item['path'])

    for name in [*names, 'protocol.md']:
        retain(perf / name)
    source = {name: read(perf / name) for name in names}
    window, declaration, policy = (source[name] for name in ('window.json', 'declaration.json', 'global-budget-policy.json'))
    aggregate, review, decision = (source[name] for name in ('combined-comparison.json', 'consolidation-review.json', 'global-budget-decision.json'))
    readiness, protocol = source['readiness.json'], source['protocol-check.json']
    cases, phase_policy = source['cases.json'], source['comparison-policy.json']
    cohorts = [source[f'cohort{index}/comparison.json'] for index in (1, 2)]
    require(declaration['schema'] == 'logos-engine.native-cost-protocol-declaration.v2'
            and declaration['status'] == 'declared_before_official_window'
            and declaration['noOfficialWindowAtDeclaration'] is True, 'Déclaration pré-fenêtre absente ou invalide')
    require(policy['schema'] == 'logos-engine.native-global-cost-policy.v1'
            and policy['globalStage'] == 'session_elapsed' and policy['relativeIncreaseLimit'] == 0.1
            and policy['comparison'] == 'strictly_less_than' and policy['allCasesMustPass'] is True
            and policy['crossCaseCompensation'] is False and policy['phaseOverrunsMayBeAccepted'] is True
            and policy['phasesAndP95RemainVisible'] is True, 'La règle globale déclarée diffère du contrat 4A')
    require(phase_policy['schema'] == 'logos-engine.native-loop-cost-comparison-policy.v1'
            and phase_policy['stages'] == STAGES, 'Les huit mesures par jeu ne correspondent pas au protocole')
    require(cases['schema'] == 'logos-engine.native-loop-cost-cases.v1'
            and [item['id'] for item in cases['cases']] == policy['caseIds'] == phase_policy['unaffectedCaseIds'],
            'Les jeux déclarés ne correspondent pas')
    for field in ('plannedOrder', 'cohorts', 'sessionsPerCaseVersionCohort', 'measuredSessions', 'measuredActions',
                  'excludedWarmupSessions', 'excludedWarmupActions', 'allCasesMustPass', 'crossCaseCompensation'):
        require(declaration[field] == policy[field], 'La déclaration et la politique divergent : ' + field)
    require(policy['plannedOrder'] == [label for label, _, _ in SERIES] and policy['cohorts'] == 2
            and cases['rounds'] == policy['sessionsPerCaseVersionCohort'], 'Ordre ou effectifs du protocole différents')
    require(declaration['relativeGlobalBudget'] == policy['relativeIncreaseLimit']
            and declaration['globalComparison'] == policy['comparison']
            and declaration['phaseOverrunsBlockAcceptance'] is False, 'Règle de décision incohérente')
    for field, name in [('protocol', 'protocol.md'), ('cases', 'cases.json'),
                        ('diagnosticComparisonPolicy', 'comparison-policy.json'), ('globalBudgetPolicy', 'global-budget-policy.json')]:
        require(verified(declaration[field]) == (perf / name).resolve(), 'La déclaration lie un autre fichier : ' + field)
    manifest_paths = {side: verified(declaration[field]) for side, field in
                      [('baseline', 'baselineManifest'), ('candidate', 'candidateManifest')]}
    manifests = {side: read(path) for side, path in manifest_paths.items()}
    archive_path = verified(declaration['candidateArchiveManifest'])
    archive = read(archive_path)
    a, b = policy['baseline'], policy['candidate']
    for side, identity in [('baseline', a), ('candidate', b)]:
        require(isinstance(identity['nativeVersion'], str) and identity['nativeVersion']
                and identity['nativeDigest'] == declaration['nativeDigests'][side] == manifests[side]['digest']
                and identity['nativeFiles'] == manifests[side]['fileCount'], 'Identité native incohérente : ' + side)
    require(archive['nativeSourceManifestDigest'] == b['nativeDigest'], 'L’archive ne lie pas le candidat déclaré')
    require(protocol['status'] == 'protocol_contract_passed' and protocol['nativeDigests'] == declaration['nativeDigests']
            and protocol['caseIds'] == policy['caseIds'] and protocol['finalizedAt'] == declaration['finalizedAt'],
            'Le contrôle du protocole ne lie pas cette déclaration')
    require(window['schema'] == 'logos-engine.native-cost-window.v1' and window['status'] == window['finalIntegrity'] == 'passed'
            and window['plannedOrder'] == policy['plannedOrder']
            and [item['label'] for item in window['executions']] == policy['plannedOrder'], 'Fenêtre incomplète ou différente')
    require(window['nativeDigests'] == {'baseline': a['nativeDigest'], 'correction': b['nativeDigest']},
            'La fenêtre a mesuré d’autres sources')
    require(readiness['schema'] == 'logos-engine.native-cost-window-readiness.v1'
            and readiness['status'] == 'ready_for_predeclared_official_window'
            and readiness['measurementAuthorized'] is True and not readiness['pendingRequirements'],
            'Le reçu préalable de disponibilité est incomplet')
    require(all(instant(value) < instant(window['startedAt']) for value in
                (declaration['finalizedAt'], policy['declaredAt'], readiness['finalizedAt'])),
            'La politique et le reçu de disponibilité doivent précéder la fenêtre')
    require(review['schema'] == 'logos-engine.native-cost-consolidation-review.v2' and review['status'] == 'passed'
            and review['checkedCount'] == len(review['checks']) > 0
            and all(item['passed'] is True for item in review['checks']), 'Revue arithmétique incomplète')
    reviewers = [item for item in declaration['officialTools']
                 if item['path'] == 'scripts/review-native-cost-consolidation.py']
    require(len(reviewers) == 1 and review['generator'] == reviewers[0],
            'La revue arithmétique ne provient pas de l’outil déclaré')
    require(decision['schema'] == 'logos-engine.predeclared-global-cost-window-decision.v1'
            and decision['nativeVersion'] == b['nativeVersion'] and decision['policy'] == policy
            and decision['generator'] == declaration['globalDecisionTool']
            and decision['calculationHelper'] == declaration['globalCalculationTool'],
            'La décision doit provenir du reviewer pré-déclaré de cette fenêtre')
    require(decision['predeclaration']['finalizedAt'] == declaration['finalizedAt']
            and decision['predeclaration']['windowStartedAt'] == window['startedAt']
            and decision['predeclaration']['watchedProtocolMatched'] is True, 'Antériorité de la décision globale non liée')
    require(decision['diagnosticArithmeticReview']['receipt'] == retain(perf / 'consolidation-review.json')
            and decision['diagnosticArithmeticReview']['checkedCount'] == review['checkedCount']
            and decision['diagnosticArithmeticReview']['status'] == review['status']
            and decision['diagnosticArithmeticReview']['generator'] == review['generator']
            and decision['diagnosticArithmeticReview']['budgetStatus'] == review['budgetStatus'],
            'La décision cite une autre revue arithmétique')
    for item in [*readiness['inputs'], *review['inputs'], *decision['inputs'], *declaration['officialTools'],
                 declaration['globalDecisionTool'], declaration['globalCalculationTool']]:
        verified(item)
    reviewed_names = ['cases.json', 'comparison-policy.json', 'protocol.md', 'window.json', 'combined-comparison.json']
    reviewed_names += [f'cohort{index}/{name}.json' for index in (1, 2)
                       for name in ('baseline', 'after', 'comparison')]
    reviewed_inputs = [retain(perf / name) for name in reviewed_names]
    require(len({item['path'] for item in review['inputs']}) == len(review['inputs'])
            and all(item in review['inputs'] for item in reviewed_inputs),
            'La revue arithmétique ne lie pas toutes les pièces effectivement rendues')
    decision_inputs = reviewed_inputs + [retain(perf / name) for name in
                                        ('declaration.json', 'global-budget-policy.json', 'consolidation-review.json')]
    require(all(item in decision['inputs'] for item in decision_inputs),
            'La décision globale ne lie pas la déclaration et les pièces effectivement rendues')

    expected_sources = {side: {'digest': identity['nativeDigest'], 'fileCount': identity['nativeFiles']}
                        for side, identity in [('baseline', a), ('after', b)]}
    require(aggregate['schema'] == 'logos-engine.native-loop-cost-cohort-comparison.v1'
            and aggregate['sources'] == decision['sources'] == review['sources'] == expected_sources,
            'Les rapports ne partagent pas les identités A/B déclarées')
    diagnostics = len(policy['caseIds']) * len(STAGES)
    require(diagnostics == declaration['diagnosticMetrics'] == aggregate['budgetMetricCount'] == 16,
            'Seize diagnostics agrégés sont requis')
    require(aggregate['method']['excludedMeasuredSessions'] == aggregate['method']['excludedOutliers']
            == policy['excludedMeasuredSessions'] == policy['excludedOutliers'] == 0, 'Une session ou valeur extrême a été exclue')
    require(review['budgetStatus'] == aggregate['status']
            and decision['diagnosticPhaseRule'] == {key: aggregate[key] for key in
                 ('status', 'budgetMetricCount', 'withinObservedBudget', 'unresolved')}, 'Un diagnostic conservé a été remplacé')
    for index, comparison in enumerate([aggregate, *cohorts]):
        if index:
            require(comparison['schema'] == 'logos-engine.native-loop-cost-comparison.v1', 'Schéma de cohorte inattendu')
        require(comparison['status'] in DIAGNOSTIC_STATUSES
                and [row['case'] for row in comparison['comparisons']] == policy['caseIds'], 'Comparaison de phases incomplète')
        require(sum(len(row['metrics']) for row in comparison['comparisons']) == diagnostics, 'Une ligne diagnostic manque')
        for row in comparison['comparisons']:
            require([metric['stage'] for metric in row['metrics']] == STAGES, 'Une phase manque ou a été réordonnée')
            for metric in row['metrics']:
                for side in ('before', 'after'):
                    check_distribution(metric[side])
            if index:
                for side in ('before', 'after'):
                    for kind in ('nativeService', 'endToEnd'):
                        check_distribution(row['inspection'][side][kind])
                    for phase in ('initial_planning', 'engaged_action'):
                        for kind in ('acknowledgement', 'safeBoundary'):
                            check_distribution(row['pause'][side][phase][kind])

    all_trials, measured, warmups = {}, [], []
    previous_finish = instant(window['startedAt'])
    log_rows = []
    for label, index, side in SERIES:
        report_name = f'cohort{index}/{side}.json'
        report = source[report_name]
        identity = a if side == 'baseline' else b
        execution = next(item for item in window['executions'] if item['label'] == label)
        require(execution['status'] == 'passed' and execution['exitCode'] == 0
                and execution['nativeDigest'] == identity['nativeDigest']
                and previous_finish <= instant(execution['startedAt']) <= instant(execution['finishedAt']) <= instant(window['finishedAt']),
                'Série échouée ou chronologie incohérente : ' + label)
        previous_finish = instant(execution['finishedAt'])
        require(execution['reportSha256'] == retain(perf / report_name)['sha256'], 'Rapport de série remplacé : ' + label)
        log_path = perf / f'cohort{index}/{side}.log'
        require(log_path.is_file(), 'Journal de mesure manquant : ' + str(log_path))
        log_record = retain(log_path)
        require(log_record['sha256'] == execution['logSha256'], 'Journal de série remplacé : ' + label)
        log_rows.append([label, report_name, f'cohort{index}/{side}.log', log_record['bytes']])
        require(report['schema'] == 'logos-engine.native-loop-costs.v1' and report['status'] == 'passed'
                and report['nativeSourceUnchanged'] is True
                and report['nativeSource'] == manifests['baseline' if side == 'baseline' else 'candidate']
                and report['manifest'] == cases, 'Rapport brut incomplet ou mauvaise source : ' + report_name)
        require([item['id'] for item in report['cases']] == policy['caseIds'], 'Un jeu manque dans ' + report_name)
        for item, declared_case in zip(report['cases'], cases['cases']):
            require(all(type(trial['warmup']) is bool for trial in item['trials']), 'Classification des sessions manquante')
            actual = [trial for trial in item['trials'] if trial['warmup'] is False]
            warm = [trial for trial in item['trials'] if trial['warmup'] is True]
            require(len(actual) == cases['rounds'] and len(warm) == 1
                    and all(trial['actions'] == declared_case['actions'] for trial in actual)
                    and warm[0]['actions'] == declared_case['warmupActions'], 'Effectifs ou actions de session différents')
            require(all(finite(trial['replayElapsedMs']) and trial['replayElapsedMs'] > 0 for trial in actual),
                    'Une durée complète de session manque')
            all_trials[index, side, item['id']] = actual
            measured.extend(actual)
            warmups.extend(warm)
    require(len(measured) == decision['measuredSessions'] == policy['measuredSessions']
            and sum(item['actions'] for item in measured) == decision['measuredActions'] == policy['measuredActions'],
            'Les effectifs mesurés ne correspondent pas à la décision')
    require(len(warmups) == policy['excludedWarmupSessions'] == decision['excludedWarmupSessions']
            and sum(item['actions'] for item in warmups) == policy['excludedWarmupActions'] == decision['excludedWarmupActions'],
            'Les seules chauffes exclues ne correspondent pas à la déclaration')
    global_rows = decision['globalCases']
    require([row['case'] for row in global_rows] == policy['caseIds'], 'Une décision globale par jeu est requise')
    for row in global_rows:
        values = {side: [trial['replayElapsedMs'] for index in (1, 2) for trial in all_trials[index, side, row['case']]]
                  for side in ('baseline', 'after')}
        require(len(values['baseline']) == len(values['after']) == row['sessionsPerVersion']
                == policy['cohorts'] * cases['rounds'], 'Effectif global différent')
        before, after = median(values['baseline']), median(values['after'])
        require(row['beforeMedianMs'] == before and row['afterMedianMs'] == after
                and math.isclose(row['medianRelativeIncrease'], (after - before) / before, rel_tol=1e-12, abs_tol=1e-12),
                'Les médianes globales ne proviennent pas de toutes les sessions réelles')
        accepted = Decimal(str(after)) < Decimal(str(before)) * (Decimal(1) + Decimal(str(policy['relativeIncreaseLimit'])))
        require(row['accepted'] is accepted, 'Le verdict global ne respecte pas le seuil strict')
    accepted = all(row['accepted'] is True for row in global_rows)
    require(decision['accepted'] is accepted and decision['acceptedCases'] == sum(row['accepted'] is True for row in global_rows)
            and decision['totalCases'] == len(global_rows)
            and decision['status'] == ('accepted_under_user_global_rule' if accepted else 'global_budget_review_required'),
            'Le résumé de décision ne correspond pas aux jeux')

    # These ancillary receipts are retained when supplied; no historical 3H
    # static report or transport receipt is fabricated for the present window.
    static = None
    if (perf / 'static-preflight.json').is_file():
        retain(perf / 'static-preflight.json')
        static = read(perf / 'static-preflight.json')
        require(static['status'] == 'static_inputs_checked'
                and static['checkedCount'] == len(static['checks'])
                and all(item['satisfied'] is True for item in static['checks']), 'Contrôle statique conservé incomplet')
    transport = None
    if (perf / 'log-transport.json').is_file():
        retain(perf / 'log-transport.json')
        transport = read(perf / 'log-transport.json')
        require(transport['status'] == 'passed' and transport['window'] == retain(perf / 'window.json')
                and [item['series'] for item in transport['logs']] == policy['plannedOrder'], 'Transport de journaux incohérent')
        for item in transport['logs']:
            original, compressed = verified(item['original']), verified(item['transport'])
            require(gzip.decompress(compressed.read_bytes()) == original.read_bytes(), 'Transport gzip avec perte')

    verdict = 'Le coût est accepté' if accepted else 'Le coût reste non accepté'
    global_summary = '; '.join(f"{row['case']} {percent(row['medianRelativeIncrease'])}" for row in global_rows)
    sessions_per_version = policy['cohorts'] * cases['rounds']
    warmup_actions = sum(item['actions'] for item in warmups)
    phase_summary = f"{aggregate['withinObservedBudget']}/{aggregate['budgetMetricCount']}"
    lines = [
        f"# Lot 4A : Feedback : résultats de coût de native {b['nativeVersion']}",
        f"**{verdict} selon le critère global déclaré : {global_summary}.** "
        f"La [décision globale](global-budget-decision.json) conserve {decision['acceptedCases']}/{decision['totalCases']} jeux conformes "
        f"avec le statut `{decision['status']}`. Les diagnostics de phases restent **{phase_summary}**, "
        f"statut `{aggregate['status']}`, avec **{len(aggregate['unresolved'])} diagnostic(s) défavorable(s) conservé(s)**. "
        f"La [revue arithmétique indépendante](consolidation-review.json) passe **{review['checkedCount']}/{len(review['checks'])}** contrôles.",
        '## Sources et périmètre',
        table(['Rôle', 'Identité déclarée', 'Digest natif'], [
            ['A : référence remesurée', f"Site {a['siteVersion']} / native {a['nativeVersion']} ; commit `{a['commit']}` ; {a['nativeFiles']} fichiers natifs", '`' + a['nativeDigest'] + '`'],
            ['B : candidat gelé', f"Native {b['nativeVersion']} ; {b['nativeFiles']} fichiers natifs ; archive de {len(archive['files'])} fichiers", '`' + b['nativeDigest'] + '`']]),
        f"La [déclaration](declaration.json), finalisée le **{utc(declaration['finalizedAt'])}**, précède la fenêtre. "
        'Le [protocole](protocol.md), la [politique globale](global-budget-policy.json), les [cas](cases.json) et la '
        '[politique de phases](comparison-policy.json) gardent leurs empreintes. Les textes historiques des cas et de la politique '
        'de phases conservent leur provenance ; les identités A/B actuelles viennent exclusivement de cette déclaration. '
        'Aucune durée historique ne fournit un échantillon à cette fenêtre.',
        'Le moteur recalcule chaque commande avant de recevoir le retour public enregistré. Aucun trajet ni état appris '
        'ne préinitialise ses décisions. Ces cas mesurent la boucle commune ; leur coût ne prouve pas une contribution '
        'propre de Feedback. Le moteur du jeu, le réseau de production et le rendu navigateur restent hors mesure.',
        table(['Jeu', 'Actions par session', 'Niveaux terminés dans le rejeu conservé'],
              [[row['case'], row['actionsPerSession'], row['levelsCompleted']] for row in cohorts[0]['comparisons']]),
        'Le paramètre de cible ne transforme pas le nombre de niveaux effectivement terminés dans ce rejeu.',
        '## Fenêtre, effectifs et intégrité',
        f"La [fenêtre officielle](window.json) s’étend du **{utc(window['startedAt'])}** au **{utc(window['finishedAt'])}**. "
        f"Son statut et son intégrité finale sont `{window['status']}` et `{window['finalIntegrity']}`. Les horaires affichés sont en UTC.",
        table(['Série', 'Version', 'Début UTC', 'Fin UTC', 'Statut'],
              [[entry['label'], a['nativeVersion'] if entry['label'].startswith('A') else b['nativeVersion'],
                utc(entry['startedAt']), utc(entry['finishedAt']), entry['status']] for entry in window['executions']]),
        table(['Engagement', 'Valeur conservée'], [
            ['Ordre', ', '.join(policy['plannedOrder'])], ['Cohortes', policy['cohorts']],
            ['Sessions mesurées', len(measured)], ['Actions mesurées', decision['measuredActions']],
            ['Chauffes exclues', f'{len(warmups)} sessions / {warmup_actions} actions'],
            ['Sessions mesurées ou valeurs extrêmes exclues', '0'], ['Choix d’une cohorte favorable', 'Aucun'],
            ['Tolérance de bruit ajoutée', 'Aucune'], ['Contrôle du protocole', protocol['status']]]),
        f"Chaque série utilise un worker distinct par jeu, une chauffe séparée et {cases['rounds']} sessions à mémoire froide. "
        'Le processus et le JIT restent présents au sein du cas et de la série. Les deux cohortes sont conservées intégralement. '
        'La [readiness](readiness.json) consigne séparément les preuves fonctionnelles et la portée de l’isolation ; '
        'le présent rapport ne transforme pas un verrou coopératif en preuve d’exclusivité interfil.',
        f"Environnement consigné : Node {aggregate['environment']['node']}, {aggregate['environment']['platform']} "
        f"{aggregate['environment']['release']}, {aggregate['environment']['cpuModel']}, "
        f"{aggregate['environment']['logicalCpus']} processeurs logiques exposés. L’ordre ABBA ne supprime pas les variations de GC, JIT ou d’ordonnancement.",
        '## Critère global par jeu',
        f"Le global est `session_elapsed`, la durée complète du rejeu par le contrôleur. Les {sessions_per_version} sessions par jeu "
        'et version sont réunies avant le calcul : `médiane(B) / médiane(A) − 1`. Chaque jeu doit rester **strictement '
        'sous +10 %** ; une égalité à +10 % échoue. Aucun jeu ne compense un autre, aucun ratio de cohorte n’est moyenné '
        'et les phases imbriquées ne sont pas additionnées. La comparaison décimale porte sur les médianes complètes ; '
        'seul l’affichage est arrondi. La tolérance arithmétique de lecture des ratios ne change pas le seuil.',
        table(['Jeu', 'Sessions A / B', 'Médiane A, ms', 'Médiane B, ms', 'Variation globale', 'Écart au seuil, points', 'Décision'],
              [[row['case'], f"{row['sessionsPerVersion']} / {row['sessionsPerVersion']}", number(row['beforeMedianMs']),
                number(row['afterMedianMs']), percent(row['medianRelativeIncrease']),
                number((policy['relativeIncreaseLimit'] - row['medianRelativeIncrease']) * 100, 6),
                'Accepté' if row['accepted'] else '**Non accepté**'] for row in global_rows]),
        'Un dépassement de phase peut être accepté lorsque ce critère global est satisfait. Le comparateur historique '
        'garde ses classifications et ses valeurs défavorables ; son diagnostic ne remplace pas la décision globale distincte.',
        '## Les seize diagnostics agrégés',
        'Source : [comparaison agrégée](combined-comparison.json). Les huit mesures par jeu comprennent le global et les '
        'sept phases de travail. Les classifications du comparateur sont reproduites intégralement ; une qualification de bruit ne relève aucun seuil.',
        medians(aggregate['comparisons']), adverse_text(aggregate['comparisons']),
        '### Dispersion et p95 agrégés',
        'Les intervalles incluent le minimum et le maximum de toutes les observations retenues. L’étendue relative '
        'des médianes de session vaut `(maximum − minimum) / médiane`. Les observations d’une session sont corrélées : '
        'ces valeurs décrivent la dispersion, sans intervalle de confiance. Le p95 utilise le rang empirique '
        '`ceil(0,95 × n)` seulement pour `n ≥ 20` ; il reste indisponible pour huit durées de session.',
        dispersion(aggregate['comparisons']), tails_text(aggregate['comparisons'], policy['relativeIncreaseLimit']),
        '## Deux cohortes intégralement conservées',
        'Les [comparaisons de cohorte 1](cohort1/comparison.json) et [de cohorte 2](cohort2/comparison.json) '
        'gardent chacune leurs seize diagnostics. Leurs résultats favorables ou défavorables ne sélectionnent pas les sessions de l’agrégat.',
        table(['Cohorte', 'Ordre', 'Jeu', 'Médiane globale A / B, ms', 'Variation globale', 'Diagnostics dans le seuil', 'Statut cohorte'],
              [[index, 'A1 puis B1' if index == 1 else 'B2 puis A2', row['case'], pair(metric['before'], metric['after'], 'medianMs'),
                percent(metric['medianRelativeIncrease']),
                f"{sum(item['result'] == 'within_observed_budget' for item in row['metrics'])}/{len(row['metrics'])}", cohort['status']]
               for index, cohort in enumerate(cohorts, 1) for row in cohort['comparisons']
               for metric in row['metrics'] if metric['stage'] == 'session_elapsed']),
    ]
    for index, cohort in enumerate(cohorts, 1):
        lines += [f'### Cohorte {index} : seize diagnostics', medians(cohort['comparisons']), adverse_text(cohort['comparisons']),
                  f'### Cohorte {index} : dispersion et p95', dispersion(cohort['comparisons']),
                  tails_text(cohort['comparisons'], policy['relativeIncreaseLimit'])]
    lines += [
        '## Inspection et Pause',
        'Ces observations restent hors des seize diagnostics de coût. L’inspection inclut le service natif et, pour '
        '`endToEnd`, le transport worker ; elle ne mesure pas un inspecteur rendu à l’écran. Toutes les variations restent affichées.',
        table(['Cohorte', 'Jeu', 'Inspection', 'Effectif A / B', 'Médiane A / B, ms', 'Variation', 'Min à max A / B, ms', 'p95 A / B, ms'],
              [[index, row['case'], '`' + kind + '`', f"{before['count']} / {after['count']}", pair(before, after, 'medianMs'),
                percent(ratio(before['medianMs'], after['medianMs'])), span(before) + ' / ' + span(after), pair(before, after, 'p95Ms')]
               for index, cohort in enumerate(cohorts, 1) for row in cohort['comparisons'] for kind in ('nativeService', 'endToEnd')
               for before, after in [(row['inspection']['before'][kind], row['inspection']['after'][kind])]]),
        'La Pause est observée pendant la planification initiale et à la première action engagée. Les journaux gardent '
        'l’acquittement et l’action atteinte à la frontière sûre. Le délai vers cette frontière inclut le travail en cours ; '
        'il ne démontre pas une interruption immédiate de toute recherche arbitrairement longue.',
        table(['Cohorte', 'Jeu', 'Contexte', 'Latence', 'Effectif A / B', 'Médiane A / B, ms', 'Variation', 'Min à max A / B, ms', 'p95 A / B, ms'],
              [[index, row['case'], '`' + phase + '`', '`' + kind + '`', f"{before['count']} / {after['count']}",
                pair(before, after, 'medianMs'), percent(ratio(before['medianMs'], after['medianMs'])),
                span(before) + ' / ' + span(after), pair(before, after, 'p95Ms')]
               for index, cohort in enumerate(cohorts, 1) for row in cohort['comparisons']
               for phase in ('initial_planning', 'engaged_action') for kind in ('acknowledgement', 'safeBoundary')
               for before, after in [(row['pause']['before'][phase][kind], row['pause']['after'][phase][kind])]]),
    ]
    pause_rows, memory_rows = [], []
    for index in (1, 2):
        for side, label in [('baseline', 'A'), ('after', 'B')]:
            for case in policy['caseIds']:
                trials = all_trials[index, side, case]
                for phase in ('initial_planning', 'engaged_action'):
                    pauses = [item for trial in trials for item in trial['pauses'] if item['phase'] == phase]
                    pause_rows.append([index, case, label, '`' + phase + '`', len(pauses),
                                       sum(item['acknowledgedPaused'] is True for item in pauses),
                                       ', '.join(str(value) for value in sorted({item['actionsAtSafeBoundary'] for item in pauses}))])
                samples = [item for trial in trials for item in trial['memory']]
                for field in ('heapUsed', 'rss'):
                    values = [item[field] / (1024 * 1024) for item in samples]
                    require(bool(values) and all(finite(value) and value >= 0 for value in values), 'Échantillons mémoire manquants ou invalides')
                    memory_rows.append([index, case, label, '`' + field + '`', len(values), number(median(values)),
                                        number(min(values)) + ' à ' + number(max(values))])
    lines += [
        table(['Cohorte', 'Jeu', 'Version', 'Contexte Pause', 'Observations', 'Acquittements', 'Actions à la frontière sûre'], pause_rows),
        '## Échantillons mémoire conservés',
        'Les rapports bruts conservent chaque valeur de mémoire. Le tableau décrit leur médiane et leur étendue en Mio ; '
        'il n’ajoute aucun critère d’acceptation, aucune causalité et ne démontre pas une stabilité pendant plusieurs heures.',
        table(['Cohorte', 'Jeu', 'Version', 'Mesure', 'Effectif', 'Médiane, Mio', 'Min à max, Mio'], memory_rows),
        '## Calculs, empreintes et journaux',
        f"La [revue de consolidation](consolidation-review.json) comporte {review['checkedCount']} contrôles effectivement présents "
        f"dans son tableau de {len(review['checks'])} contrôles. Ce nombre provient du reçu réel et n’est pas une constante historique. "
        'La revue recalcule les distributions, ratios et classements depuis les quatre rapports bruts. La '
        '[décision globale](global-budget-decision.json) lie cette revue et la déclaration antérieure à la fenêtre. '
        'La réussite de la revue arithmétique ne transforme pas un dépassement de budget en acceptation.',
        table(['Pièce', 'SHA-256'], [[name, '`' + records[(perf / name).relative_to(ROOT).as_posix()]['sha256'] + '`'] for name in
                                   ('declaration.json', 'global-budget-policy.json', 'combined-comparison.json',
                                    'consolidation-review.json', 'global-budget-decision.json')]),
        table(['Série', 'Rapport brut', 'Journal original', 'Octets du journal'],
              [[label, f'[{report}]({report})', f'[{log}]({log})', size] for label, report, log, size in log_rows]),
    ]
    if static:
        lines += [f"Le [contrôle statique conservé](static-preflight.json) comporte {static['checkedCount']}/{len(static['checks'])} "
                  'contrôles satisfaits ; il reste distinct de la disponibilité fonctionnelle et de l’isolation effective.']
    if transport:
        lines += ['Le [reçu de transport](log-transport.json) lie les journaux originaux et leurs copies gzip. '
                  'Les empreintes et l’égalité exacte après décompression sont vérifiées sans modification des journaux.',
                  table(['Série', 'Journal gzip', 'Octets originaux', 'Octets gzip'],
                        [[item['series'], '[' + os.path.relpath(resolve_input(item['transport']['path']), perf) + ']('
                          + os.path.relpath(resolve_input(item['transport']['path']), perf) + ')',
                          item['original']['bytes'], item['transport']['bytes']] for item in transport['logs']])]
    lines += [
        '## Décision et portée fonctionnelle',
        f"**{verdict} pour native {b['nativeVersion']} dans cette fenêtre**, selon le reçu `{decision['status']}`. "
        f"Les **{len(aggregate['unresolved'])} diagnostic(s) agrégé(s) défavorable(s)** et tous les diagnostics de cohorte, p95, "
        'dispersions, inspections, pauses et échantillons mémoire restent visibles. Aucun seuil, observation ou cohorte n’est modifié par ce rapport.',
        'La [readiness](readiness.json) consigne les preuves fonctionnelles et leurs limites séparément. Le coût de la boucle '
        'commune ne clôture aucune réserve de contribution propre de Feedback, de revalidation source, d’héritage ou de parité '
        'de l’appelant complet. Les résultats effectifs de campagne et leur horloge cumulée relèvent de leurs reçus propres. '
        'Aucun succès live ni aucune résolution de niveau n’est déduit du verdict de coût.',
    ]
    document = '\n\n'.join(lines) + '\n'
    links = re.findall(r'\[[^\]]+\]\(([^)]+)\)', document)
    require(all((perf / link).resolve().is_file() for link in links), 'Un lien local du rapport est manquant')
    require(all(fingerprint(resolve_input(item['path'])) == item for item in records.values()), 'Une pièce a changé pendant le rendu')
    with destination.open('x', encoding='utf-8') as stream:
        stream.write(document)
    receipt = {'schema': 'logos-engine.lot4a-cost-report-render.v1', 'recordedAt': datetime.now(timezone.utc).isoformat(),
               'status': 'rendered_retained_receipts', 'generator': fingerprint(Path(__file__)), 'report': fingerprint(destination),
               'inputs': list(records.values()), 'aggregateDiagnostics': diagnostics, 'cohortDiagnostics': diagnostics * len(cohorts),
               'arithmeticReviewChecks': review['checkedCount'], 'timezone': 'UTC', 'inputReceiptsUnchanged': True,
               'localLinksChecked': len(links), 'runtimeOrGameExecuted': False, 'measurementExecuted': False,
               'qualification': 'Formatting of completed retained evidence only. No assumed outcome, selected session, substituted source identity or new acceptance rule.'}
    with render_path.open('x', encoding='utf-8') as stream:
        json.dump(receipt, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    print(json.dumps({'report': fingerprint(destination), 'receipt': fingerprint(render_path),
                      'aggregateDiagnostics': diagnostics, 'cohortDiagnostics': diagnostics * len(cohorts),
                      'arithmeticReviewChecks': review['checkedCount'], 'measurementExecuted': False, 'inputReceiptsUnchanged': True}))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f'Rendu du coût 4A interrompu : {error}', file=sys.stderr)
        sys.exit(1)
