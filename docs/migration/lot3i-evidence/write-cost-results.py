#!/usr/bin/env python3
"""Render only completed lot 3I cost receipts, without measuring anything.

All outcomes and figures come from the future retained 3I reports. This renderer
does not assume acceptance or copy any historical result. User-facing timestamps use UTC−03; input receipts are not rewritten.
"""
from __future__ import annotations
from datetime import datetime, timezone, timedelta
import gzip
import hashlib
import json
from pathlib import Path
import re
from statistics import median

ROOT = Path(__file__).resolve().parents[3]
PERF = ROOT / 'docs/migration/lot3i-evidence/performance'
NATIVE_DIGEST = 'e039a62b5dbb563a6c25f5469228e0025ffb66f243a4e09fdf27caeaeef2bf87'
USER_TIMEZONE = timezone(timedelta(hours=-3))
STAGES = ['session_elapsed', 'new_decision', 'known_prefix_service', 'known_prefix_request',
          'known_prefix_guard', 'acquisition_and_persistence', 'persistence', 'restoration']


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read(path):
    raw = path.read_bytes()
    return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fp(path):
    path = path.resolve()
    raw = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(raw),
            'sha256': hashlib.sha256(raw).hexdigest()}


def local_time(value):
    instant = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(instant.tzinfo is not None, 'A timestamp lacks its timezone')
    return instant.astimezone(USER_TIMEZONE).strftime('%Y-%m-%d %H:%M:%S UTC−03')


def number(value, precision=None):
    if value is None:
        return 'indisponible'
    precision = (6 if abs(value) < 1 else 3) if precision is None else precision
    return f'{value:.{precision}f}'.replace('.', ',').replace('-', '−')


def percent(value, signed=True):
    if value is None:
        return 'indisponible'
    value = f'{value * 100:+.6f}' if signed else f'{value * 100:.6f}'
    return value.replace('.', ',').replace('-', '−') + ' %'


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
        return 'Aucun dépassement de médiane selon le comparateur de phases dans cet ensemble.'
    return 'Tous les dépassements de médiane de cet ensemble restent conservés : ' + '; '.join(
        f"**{case} `{metric['stage']}` {percent(metric['medianRelativeIncrease'])}** "
        f"(`{metric['result']}`)" for case, metric in rows) + '.'


def tails_text(comparisons, limit):
    rows = [(row['case'], metric, ratio(metric['before']['p95Ms'], metric['after']['p95Ms']))
            for row in comparisons for metric in row['metrics']]
    adverse = [(case, metric, change) for case, metric, change in rows if change is not None and change > limit]
    if not adverse:
        return 'Aucune hausse de p95 calculable supérieure à +10 % dans cet ensemble ; les p95 indisponibles restent signalés.'
    return 'Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : ' + '; '.join(
        f"**{case} `{metric['stage']}` {percent(change)}**" for case, metric, change in adverse) + '.'


def main():
    destination = PERF / 'results.md'
    render_path = PERF / 'results-render.json'
    require(not destination.exists() and not render_path.exists(), 'A rendered report already exists; refusing overwrite')
    names = ['window.json', 'declaration.json', 'global-budget-policy.json', 'cases.json',
             'comparison-policy.json', 'readiness.json', 'static-preflight.json',
             'combined-comparison.json', 'consolidation-review.json', 'global-budget-decision.json',
             'log-transport.json']
    names += [f'cohort{index}/{name}.json' for index in (1, 2) for name in ('baseline', 'after', 'comparison')]
    required = [PERF / name for name in names]
    required += [PERF.parent / 'final/source-archive.json', PERF.parent / 'final/source-manifest.json']
    require(all(path.is_file() for path in required), 'Completed 3I receipts are required before rendering')
    records = [fp(path) for path in required]
    source = {name: read(PERF / name) for name in names}
    window, declaration, policy = (source[name] for name in ('window.json', 'declaration.json', 'global-budget-policy.json'))
    aggregate, review, decision = (source[name] for name in ('combined-comparison.json', 'consolidation-review.json', 'global-budget-decision.json'))
    cohorts = [source[f'cohort{index}/comparison.json'] for index in (1, 2)]
    transport, static = source['log-transport.json'], source['static-preflight.json']
    readiness = source['readiness.json']
    archive = read(PERF.parent / 'final/source-archive.json')
    require(policy['baseline']['nativeVersion'] == '0.49.0'
            and policy['baseline']['siteVersion'] == 78
            and policy['baseline']['commit'] == '8fa6b261b8b23ac8d232e60c9c179e2f3407d82f'
            and policy['baseline']['nativeDigest'] == 'd6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054'
            and policy['baseline']['nativeFiles'] == 268, 'Unexpected baseline identity')
    require(policy['candidate']['nativeVersion'] == '0.50.0'
            and policy['candidate']['nativeDigest'] == NATIVE_DIGEST
            and policy['candidate']['nativeFiles'] == 270
            and archive['nativeSourceManifestDigest'] == NATIVE_DIGEST
            and len(archive['files']) == 281, 'Unexpected candidate identity')
    require(window['status'] == window['finalIntegrity'] == review['status'] == 'passed',
            'Window and arithmetic review must be complete before rendering')
    require(review['checkedCount'] == len(review['checks']) == 231 and all(item['passed'] is True for item in review['checks']),
            'Arithmetic review is incomplete')
    require(readiness['measurementAuthorized'] is True and not readiness['pendingRequirements'],
            'Actual completed readiness is required before rendering')
    require(static['status'] == 'static_inputs_checked' and all(item['satisfied'] for item in static['checks']),
            'Static input review is missing or failed')
    require(policy['globalStage'] == 'session_elapsed' and policy['relativeIncreaseLimit'] == 0.1
            and policy['comparison'] == 'strictly_less_than' and policy['allCasesMustPass'] is True
            and policy['crossCaseCompensation'] is False
            and policy['phaseOverrunsMayBeAccepted'] is True and policy['phasesAndP95RemainVisible'] is True,
            'Global policy differs from the declared rule')
    require(aggregate['budgetMetricCount'] == declaration['diagnosticMetrics'] == 16, 'Expected sixteen aggregate diagnostics')
    require(sum(len(row['metrics']) for row in aggregate['comparisons']) == 16
            and sum(len(row['metrics']) for cohort in cohorts for row in cohort['comparisons']) == 32,
            'Aggregate or cohort diagnostic rows are missing')
    for comparison in [aggregate, *cohorts]:
        require([row['case'] for row in comparison['comparisons']] == policy['caseIds'], 'A declared case is missing')
        require(all([metric['stage'] for metric in row['metrics']] == STAGES for row in comparison['comparisons']),
                'A declared phase is missing or reordered')
    require(decision['acceptedCases'] == sum(row['accepted'] is True for row in decision['globalCases'])
            and decision['totalCases'] == len(decision['globalCases']) == len(policy['caseIds'])
            and decision['accepted'] is all(row['accepted'] is True for row in decision['globalCases']),
            'Global decision summary differs from its cases')
    expected_status = 'accepted_under_user_global_rule' if decision['accepted'] else 'global_budget_review_required'
    require(decision['status'] == expected_status, 'Global decision status is inconsistent')
    require(decision['sources'] == aggregate['sources'] and decision['diagnosticPhaseRule']['status'] == aggregate['status']
            and decision['diagnosticPhaseRule']['budgetMetricCount'] == aggregate['budgetMetricCount']
            and decision['diagnosticPhaseRule']['withinObservedBudget'] == aggregate['withinObservedBudget']
            and decision['diagnosticPhaseRule']['unresolved'] == aggregate['unresolved'], 'Copied diagnostics differ')
    require(decision['measuredSessions'] == policy['measuredSessions'] == 32
            and decision['measuredActions'] == policy['measuredActions'] == 400
            and aggregate['method']['excludedMeasuredSessions'] == aggregate['method']['excludedOutliers'] == 0,
            'Measured-session totals or exclusions differ')
    warmups = [trial for index in (1, 2) for side in ('baseline', 'after')
               for case in source[f'cohort{index}/{side}.json']['cases']
               for trial in case['trials'] if trial['warmup'] is True]
    warmup_sessions, warmup_actions = len(warmups), sum(trial['actions'] for trial in warmups)
    require(warmup_sessions == policy['excludedWarmupSessions'] == declaration['excludedWarmupSessions'] == 8
            and warmup_actions == policy['excludedWarmupActions'] == declaration['excludedWarmupActions'] == 24
            and aggregate['method']['excludedWarmupsPerCaseAndVersion'] == 2,
            'Retained warmups differ from the declaration or aggregation method')
    window_start = datetime.fromisoformat(window['startedAt'].replace('Z', '+00:00'))
    require(all(datetime.fromisoformat(value.replace('Z', '+00:00')) < window_start
                for value in (declaration['finalizedAt'], readiness['finalizedAt'], policy['declaredAt'])),
            'The declared policy and readiness must precede this window')
    for item in [*readiness['inputs'], *review['inputs'], *decision['inputs']]:
        require(fp(ROOT / item['path']) == item, 'A reviewed receipt changed: ' + item['path'])
    require(transport['status'] == 'passed' and transport['window'] == fp(PERF / 'window.json'),
            'Log transport does not bind this completed window')
    require([item['series'] for item in transport['logs']] == policy['plannedOrder'], 'Log series order differs')
    for item in transport['logs']:
        original, compressed = ROOT / item['original']['path'], ROOT / item['transport']['path']
        require(fp(original) == item['original'] and fp(compressed) == item['transport']
                and gzip.decompress(compressed.read_bytes()) == original.read_bytes(), 'A log transport changed')
        records.extend([fp(original), fp(compressed)])

    a, b = policy['baseline'], policy['candidate']
    global_rows = decision['globalCases']
    accepted = decision['accepted']
    verdict = 'Le coût est accepté' if accepted else 'Le coût reste non accepté'
    global_summary = '; '.join(f"{row['case']} {percent(row['medianRelativeIncrease'])}" for row in global_rows)
    phase_summary = f"{aggregate['withinObservedBudget']}/{aggregate['budgetMetricCount']}"
    lines = [
        f"# Lot 3I — RecurrentSeries : résultats de coût de native {b['nativeVersion']}",
        f"**{verdict} selon le critère global déclaré : {global_summary}.** "
        f"La [décision globale](global-budget-decision.json) conserve {decision['acceptedCases']}/{decision['totalCases']} jeux conformes, "
        f"avec le statut `{decision['status']}`. Les diagnostics de phases restent **{phase_summary}**, "
        f"statut `{aggregate['status']}`, avec **{len(aggregate['unresolved'])} dépassement(s) conservé(s)**. "
        f"La [revue arithmétique indépendante](consolidation-review.json) passe {review['checkedCount']}/{len(review['checks'])} contrôles.",
        '## Sources et périmètre',
        table(['Rôle', 'Identité', 'Digest natif'], [
            ['A : référence remesurée', f"Site {a['siteVersion']} / native {a['nativeVersion']} ; commit `{a['commit']}` ; {a['nativeFiles']} fichiers natifs", '`' + a['nativeDigest'] + '`'],
            ['B : candidat gelé', f"Native {b['nativeVersion']} ; {b['nativeFiles']} fichiers natifs ; archive de {len(archive['files'])} fichiers", '`' + b['nativeDigest'] + '`']]),
        f"La [déclaration](declaration.json) finalisée le **{local_time(declaration['finalizedAt'])}** précède la fenêtre. "
        'Le [protocole](protocol.md), la [politique globale](global-budget-policy.json), les [cas](cases.json) et la '
        '[politique de phases](comparison-policy.json) restent liés par leurs empreintes. Les textes historiques des cas '
        'et de la politique de phases gardent leur provenance ; les identités A/B courantes sont celles de cette déclaration. '
        'Aucune durée historique ne fournit un échantillon à la fenêtre actuelle.',
        'Le moteur recalcule chaque commande avant de recevoir le retour public enregistré. Aucun état appris ni trajet '
        'ne préinitialise ses décisions. STCK et SMLP mesurent la boucle commune ; leur coût ne prouve pas une contribution '
        'propre de RecurrentSeries. Le moteur du jeu, le réseau de production et le rendu navigateur restent hors mesure.',
        table(['Jeu', 'Actions par session', 'Niveaux terminés dans le rejeu conservé'],
              [[row['case'], row['actionsPerSession'], row['levelsCompleted']] for row in cohorts[0]['comparisons']]),
        'Le paramètre de cible ne transforme pas le nombre de niveaux effectivement terminés dans ce rejeu.',
        '## Fenêtre, effectifs et intégrité',
        f"La [fenêtre officielle](window.json) s’étend du **{local_time(window['startedAt'])}** au **{local_time(window['finishedAt'])}**. "
        f"Son statut et son intégrité finale sont `{window['status']}` et `{window['finalIntegrity']}`. Tous les horaires ci-dessous sont en UTC−03.",
        table(['Série', 'Version', 'Début UTC−03', 'Fin UTC−03', 'Statut'],
              [[entry['label'], a['nativeVersion'] if entry['label'].startswith('A') else b['nativeVersion'],
                local_time(entry['startedAt']), local_time(entry['finishedAt']), entry['status']] for entry in window['executions']]),
        table(['Engagement', 'Valeur conservée'], [
            ['Ordre', ', '.join(policy['plannedOrder'])], ['Cohortes', policy['cohorts']],
            ['Sessions mesurées', decision['measuredSessions']], ['Actions mesurées', decision['measuredActions']],
            ['Chauffes exclues', f"{warmup_sessions} sessions / {warmup_actions} actions"],
            ['Sessions mesurées ou valeurs extrêmes exclues', '0'], ['Choix d’une cohorte favorable', 'Aucun'],
            ['Tolérance de bruit ajoutée', 'Aucune'], ['Revue statique', f"{static['checkedCount']}/{len(static['checks'])}"]]),
        'Chaque série utilise un worker distinct par jeu, une chauffe séparée et quatre sessions à mémoire froide ; '
        'le processus et le JIT restent présents au sein du cas/série. Les deux cohortes sont conservées intégralement. '
        'Le [reçu de readiness](readiness.json) lie les preuves fonctionnelles et l’isolation déclarée ; '
        'le [contrôle statique](static-preflight.json) couvre les fichiers et ne remplace pas ce reçu.',
        f"Environnement consigné : Node {aggregate['environment']['node']}, {aggregate['environment']['platform']} "
        f"{aggregate['environment']['release']}, {aggregate['environment']['cpuModel']}, "
        f"{aggregate['environment']['logicalCpus']} processeurs logiques exposés. L’ordre ABBA ne supprime pas les variations de GC, JIT ou d’ordonnancement.",
        '## Critère global par jeu',
        'Le global est `session_elapsed`, la durée complète du rejeu par le contrôleur. Les huit sessions par jeu et '
        'version sont réunies avant le calcul : `médiane(B) / médiane(A) − 1`. Chaque jeu doit rester **strictement '
        'sous +10 %** ; une égalité à +10 % échoue. Aucun jeu ne compense un autre, aucun ratio de cohorte n’est moyenné '
        'et les phases imbriquées ne sont pas additionnées. Les valeurs intégrales du reçu déterminent la décision ; '
        'seul l’affichage est arrondi.',
        table(['Jeu', 'Sessions A / B', 'Médiane A, ms', 'Médiane B, ms', 'Variation globale',
               'Écart au seuil, points', 'Décision'],
              [[row['case'], f"{row['sessionsPerVersion']} / {row['sessionsPerVersion']}", number(row['beforeMedianMs']),
                number(row['afterMedianMs']), percent(row['medianRelativeIncrease']),
                number((policy['relativeIncreaseLimit'] - row['medianRelativeIncrease']) * 100, 6),
                'Accepté' if row['accepted'] else '**Non accepté**'] for row in global_rows]),
        'Un dépassement de phase peut être accepté lorsque ce critère global est satisfait. Le comparateur de phases '
        'garde son seuil historique, ses classifications et ses valeurs défavorables ; son diagnostic ne remplace pas la décision globale distincte.',
        '## Les seize diagnostics agrégés',
        'Source : [comparaison agrégée](combined-comparison.json). Les résultats reproduisent les classifications du '
        'comparateur conservé. Une qualification de bruit ne relève aucun seuil.',
        medians(aggregate['comparisons']), adverse_text(aggregate['comparisons']),
        '### Dispersion et p95 agrégés',
        'Les intervalles incluent le minimum et le maximum de toutes les observations retenues. L’étendue relative '
        'des médianes de session vaut `(maximum − minimum) / médiane`. Les observations d’une session sont corrélées : '
        'ces valeurs décrivent la dispersion, sans intervalle de confiance. Le p95 utilise le rang empirique '
        '`ceil(0,95 × n)` seulement pour `n ≥ 20` ; il reste indisponible pour les huit durées de session.',
        dispersion(aggregate['comparisons']), tails_text(aggregate['comparisons'], policy['relativeIncreaseLimit']),
        '## Deux cohortes intégralement conservées',
        'Les [comparaisons de cohorte 1](cohort1/comparison.json) et [de cohorte 2](cohort2/comparison.json) '
        'gardent chacune leurs seize diagnostics. Leurs résultats favorables ou défavorables ne sélectionnent pas les sessions de l’agrégat.',
        table(['Cohorte', 'Ordre', 'Jeu', 'Médiane globale A / B, ms', 'Variation globale', 'Diagnostics dans le seuil', 'Statut cohorte'],
              [[index, 'A1 puis B1' if index == 1 else 'B2 puis A2', row['case'],
                pair(metric['before'], metric['after'], 'medianMs'), percent(metric['medianRelativeIncrease']),
                f"{sum(item['result'] == 'within_observed_budget' for item in row['metrics'])}/{len(row['metrics'])}", cohort['status']]
               for index, cohort in enumerate(cohorts, 1) for row in cohort['comparisons']
               for metric in row['metrics'] if metric['stage'] == 'session_elapsed']),
    ]
    for index, cohort in enumerate(cohorts, 1):
        lines += [f'### Cohorte {index} : seize diagnostics', medians(cohort['comparisons']),
                  adverse_text(cohort['comparisons']), f'### Cohorte {index} : dispersion et p95',
                  dispersion(cohort['comparisons']), tails_text(cohort['comparisons'], policy['relativeIncreaseLimit'])]
    lines += [
        '## Inspection et Pause',
        'Ces observations restent hors des seize diagnostics de coût. L’inspection inclut le service natif et, pour '
        '`endToEnd`, le transport worker ; elle ne mesure pas un inspecteur rendu à l’écran. Toutes les variations restent affichées.',
        table(['Cohorte', 'Jeu', 'Inspection', 'Effectif A / B', 'Médiane A / B, ms', 'Variation',
               'Min à max A / B, ms', 'p95 A / B, ms'],
              [[index, row['case'], '`' + kind + '`', f"{before['count']} / {after['count']}", pair(before, after, 'medianMs'),
                percent(ratio(before['medianMs'], after['medianMs'])), span(before) + ' / ' + span(after), pair(before, after, 'p95Ms')]
               for index, cohort in enumerate(cohorts, 1) for row in cohort['comparisons'] for kind in ['nativeService', 'endToEnd']
               for before, after in [(row['inspection']['before'][kind], row['inspection']['after'][kind])]]),
        'La Pause est observée pendant la planification initiale et à la première action engagée. Les journaux gardent '
        'l’acquittement et l’action atteinte à la frontière sûre. Le délai vers cette frontière inclut le travail en cours ; '
        'il ne démontre pas une interruption immédiate de toute recherche arbitrairement longue.',
        table(['Cohorte', 'Jeu', 'Contexte', 'Latence', 'Effectif A / B', 'Médiane A / B, ms', 'Variation',
               'Min à max A / B, ms', 'p95 A / B, ms'],
              [[index, row['case'], '`' + phase + '`', '`' + kind + '`',
                f"{before['count']} / {after['count']}", pair(before, after, 'medianMs'),
                percent(ratio(before['medianMs'], after['medianMs'])), span(before) + ' / ' + span(after), pair(before, after, 'p95Ms')]
               for index, cohort in enumerate(cohorts, 1) for row in cohort['comparisons']
               for phase in ['initial_planning', 'engaged_action'] for kind in ['acknowledgement', 'safeBoundary']
               for before, after in [(row['pause']['before'][phase][kind], row['pause']['after'][phase][kind])]]),
    ]
    pause_rows, memory_rows = [], []
    for index in (1, 2):
        for side, label in [('baseline', 'A'), ('after', 'B')]:
            report = source[f'cohort{index}/{side}.json']
            for case in report['cases']:
                trials = [trial for trial in case['trials'] if trial['warmup'] is False]
                for phase in ['initial_planning', 'engaged_action']:
                    pauses = [item for trial in trials for item in trial['pauses'] if item['phase'] == phase]
                    pause_rows.append([index, case['id'], label, '`' + phase + '`', len(pauses),
                                       sum(item['acknowledgedPaused'] is True for item in pauses),
                                       ', '.join(str(value) for value in sorted({item['actionsAtSafeBoundary'] for item in pauses}))])
                samples = [item for trial in trials for item in trial['memory']]
                for field in ['heapUsed', 'rss']:
                    values = [item[field] / (1024 * 1024) for item in samples]
                    require(bool(values), 'Missing retained memory samples')
                    memory_rows.append([index, case['id'], label, '`' + field + '`', len(values),
                                        number(median(values)), number(min(values)) + ' à ' + number(max(values))])
    lines += [
        table(['Cohorte', 'Jeu', 'Version', 'Contexte Pause', 'Observations', 'Acquittements', 'Actions à la frontière sûre'], pause_rows),
        '## Échantillons mémoire conservés',
        'Les rapports bruts conservent chaque valeur de mémoire. Le tableau décrit leur médiane et leur étendue en Mio ; '
        'il n’ajoute aucun critère d’acceptation et ne démontre pas une stabilité pendant plusieurs heures.',
        table(['Cohorte', 'Jeu', 'Version', 'Mesure', 'Effectif', 'Médiane, Mio', 'Min à max, Mio'], memory_rows),
        '## Calculs, empreintes et transport',
        'La [revue de consolidation](consolidation-review.json) recalcule les distributions, ratios et classements depuis '
        'les quatre rapports bruts. La [revue globale](global-budget-decision.json) recalcule les durées complètes, '
        'avec multiplicité de chaque session préservée. La déclaration et la readiness établissent séparément '
        'l’antériorité de la politique pour cette fenêtre. La qualification historique du générateur global reste '
        'conservée dans son reçu ; elle ne remplace pas cette chronologie. Aucun ratio de phase ou de cohorte n’est substitué au global.',
        table(['Pièce', 'SHA-256'], [[name, '`' + sha(PERF / name) + '`'] for name in [
            'declaration.json', 'global-budget-policy.json', 'combined-comparison.json',
            'consolidation-review.json', 'global-budget-decision.json']]),
        'Le [reçu de transport](log-transport.json) lie les originaux et leurs copies gzip sans perte. Le générateur '
        'du présent rapport vérifie à nouveau les empreintes et l’égalité exacte après décompression, sans modifier les journaux.',
        table(['Série', 'Rapport', 'Journal compressé', 'Octets originaux', 'Octets gzip'],
              [[item['series'], '[' + item['original']['path'].split('/performance/')[1].replace('.log', '.json') + ']('
                + item['original']['path'].split('/performance/')[1].replace('.log', '.json') + ')',
                '[' + item['transport']['path'].split('/performance/')[1] + ']('
                + item['transport']['path'].split('/performance/')[1] + ')',
                item['original']['bytes'], item['transport']['bytes']] for item in transport['logs']]),
    ]
    incident = PERF.parent / 'diagnostic/static-preflight-generation-incident.json'
    if incident.exists():
        records.append(fp(incident))
        lines += ['Un [incident de préparation conservé](../diagnostic/static-preflight-generation-incident.json) '
                  'reste distinct des mesures officielles. Son reçu décrit les faits observés ; aucun incident historique '
                  'd’un autre lot n’est attribué à cette fenêtre.']
    render_incident = PERF.parent / 'diagnostic/cost-report-render-incident.json'
    if render_incident.exists():
        records.append(fp(render_incident))
        lines += ['Le [premier échec de rendu](../diagnostic/cost-report-render-incident.json) est conservé avec '
                  'son traceback et le générateur antérieur. Il provenait du nom d’un champ du reçu global, '
                  'après la mesure et avant l’écriture du rapport. La correction lit le schéma effectif et les '
                  'chauffes enregistrées ; aucun reçu de mesure ni résultat n’a été modifié.']
    lines += [
        '## Décision et portée fonctionnelle',
        f"**{verdict} pour native {b['nativeVersion']} dans cette fenêtre**, selon le reçu `{decision['status']}`. "
        f"Les **{len(aggregate['unresolved'])} dépassement(s) agrégé(s)** et tous les diagnostics de cohorte, p95, "
        'dispersions, inspections, pauses et échantillons mémoire restent visibles. Aucun seuil, observation ou cohorte n’est modifié par ce rapport.',
        'La [readiness](readiness.json) rassemble les preuves fonctionnelles, de contribution, de régression, de navigateur '
        'et d’intégrité séparées. Le coût STCK/SMLP ne clôture aucune réserve fonctionnelle de RecurrentSeries, de '
        'revalidation source, d’héritage ou de parité de l’appelant complet. La preuve intégrée synthétique et '
        'le résultat effectif de CONN, avec son horloge cumulée, sont consignés dans leurs reçus propres liés par la readiness. '
        'Le statut réel de contribution relève de ces preuves, séparément de la décision de coût. '
        'La règle globale ne transforme pas ce raccordement en migration globale complète.',
    ]
    document = '\n\n'.join(lines) + '\n'
    links = re.findall(r'\[[^\]]+\]\(([^)]+)\)', document)
    require(all((PERF / link).resolve().is_file() for link in links), 'A report link is missing')
    require(all(fp(ROOT / item['path']) == item for item in records), 'An input changed while rendering')
    with destination.open('x') as stream:
        stream.write(document)
    receipt = {'schema': 'logos-engine.lot3i-cost-report-render.v1',
               'recordedAt': datetime.now(USER_TIMEZONE).isoformat(), 'status': 'rendered_retained_receipts',
               'generator': fp(Path(__file__)), 'report': fp(destination), 'inputs': records,
               'aggregateDiagnostics': 16, 'cohortDiagnostics': 32, 'timezone': 'UTC−03',
               'inputReceiptsUnchanged': True, 'localLinksChecked': len(links),
               'runtimeOrGameExecuted': False, 'measurementExecuted': False,
               'qualification': 'Formatting of completed retained evidence only. No assumed outcome, selected session or new acceptance rule.'}
    with render_path.open('x') as stream:
        json.dump(receipt, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    print(json.dumps({'report': fp(destination), 'receipt': fp(render_path),
                      'aggregateDiagnostics': 16, 'cohortDiagnostics': 32,
                      'measurementExecuted': False, 'inputReceiptsUnchanged': True}))


if __name__ == '__main__':
    main()
