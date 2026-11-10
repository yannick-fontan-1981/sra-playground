#!/usr/bin/env python3
"""Render retained lot3E cost receipts as complete French comparison tables.

No runtime, timing runner, test, build or game is executed. Classification stays
the official receipt's value. Formatting alone rounds the displayed numbers.
"""
from __future__ import annotations
from datetime import datetime, timezone, timedelta
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[3]
PERF = ROOT / 'docs/migration/lot3e-evidence/performance'
CLIENT_ZONE = timezone(timedelta(hours=-3))

def load(name): return json.loads((PERF / name).read_text())
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def time_local(value): return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(CLIENT_ZONE).strftime('%H:%M:%S')
def number(value, precision=None):
    if value is None: return 'indisponible'
    precision = (6 if abs(value) < 1 else 3) if precision is None else precision
    return f'{value:.{precision}f}'.replace('.', ',').replace('-', '−')
def percent(value, signed=True):
    if value is None: return 'indisponible'
    result = f'{value * 100:+.6f}' if signed else f'{value * 100:.6f}'
    return result.replace('.', ',').replace('-', '−') + ' %'
def span(distribution): return number(distribution['minMs']) + ' à ' + number(distribution['maxMs'])
def ratio(before, after): return None if not before or after is None else after / before - 1
def table(headers, rows):
    return '\n'.join(['| ' + ' | '.join(headers) + ' |', '| ' + ' | '.join('---' for _ in headers) + ' |',
        *('| ' + ' | '.join(str(cell) for cell in row) + ' |' for row in rows)])
def phase_label(metric):
    return 'Dans le seuil' if metric['result'] == 'within_observed_budget' else '**Dépassement conservé**'
def medians(comparisons):
    return table(['Jeu', 'Mesure', 'Effectif A / B', 'Médiane A, ms', 'Médiane B, ms', 'Variation', 'Diagnostic'],
        [[row['case'], '`' + m['stage'] + '`', f"{m['before']['count']} / {m['after']['count']}", number(m['before']['medianMs']),
          number(m['after']['medianMs']), percent(m['medianRelativeIncrease']), phase_label(m)]
         for row in comparisons for m in row['metrics']])
def dispersion(comparisons):
    return table(['Jeu', 'Mesure', 'Min à max A, ms', 'Min à max B, ms', 'p95 A / B, ms', 'Variation p95', 'Étendue relative des médianes de session A / B'],
        [[row['case'], '`' + m['stage'] + '`', span(m['before']), span(m['after']),
          number(m['before']['p95Ms']) + ' / ' + number(m['after']['p95Ms']),
          percent(ratio(m['before']['p95Ms'], m['after']['p95Ms'])),
          percent(m['roundMedianNoise']['baselineRelativeRange'], False) + ' / ' + percent(m['roundMedianNoise']['afterRelativeRange'], False)]
         for row in comparisons for m in row['metrics']])

def main():
    names = ['window.json', 'declaration.json', 'global-budget-policy.json', 'cases.json', 'comparison-policy.json',
             'readiness.json', 'static-preflight.json', 'combined-comparison.json', 'consolidation-review.json',
             'global-budget-decision.json', 'log-transport.json']
    names += [f'cohort{i}/{name}.json' for i in (1, 2) for name in ('baseline', 'after', 'comparison')]
    original_hashes = {name: sha(PERF / name) for name in names}
    window, declaration, policy = load('window.json'), load('declaration.json'), load('global-budget-policy.json')
    aggregate, review, decision = load('combined-comparison.json'), load('consolidation-review.json'), load('global-budget-decision.json')
    cohorts = [load(f'cohort{i}/comparison.json') for i in (1, 2)]
    transport = load('log-transport.json')
    assert window['status'] == window['finalIntegrity'] == review['status'] == 'passed'
    assert review['checkedCount'] == len(review['checks']) == 231 and all(c['passed'] for c in review['checks'])
    assert decision['accepted'] and decision['acceptedCases'] == decision['totalCases'] == 2
    assert aggregate['withinObservedBudget'] == 13 and len(aggregate['unresolved']) == 3
    assert decision['measuredSessions'] == 32 and decision['measuredActions'] == 400
    assert aggregate['method']['excludedMeasuredSessions'] == aggregate['method']['excludedOutliers'] == 0
    globals = {row['case']: row for row in decision['globalCases']}
    stck, smlp = globals['STCK'], globals['SMLP']
    cohort2_stck = next(m for row in cohorts[1]['comparisons'] if row['case'] == 'STCK' for m in row['metrics'] if m['stage'] == 'session_elapsed')
    lines = [
        '# Lot 3E : résultats de coût de native 0.46',
        f"**Le coût est accepté selon le critère global déclaré avant la fenêtre : STCK {percent(stck['medianRelativeIncrease'])}, SMLP {percent(smlp['medianRelativeIncrease'])}. Les deux jeux restent strictement sous +10 %.** La [décision globale](global-budget-decision.json) conserve le diagnostic de phases **13/16**, statut `budget_review_required`, et ses trois dépassements STCK. La [revue indépendante](consolidation-review.json) passe **231/231 contrôles**.",
        f"La marge agrégée est de **{number((0.1 - stck['medianRelativeIncrease']) * 100, 6)} points** pour STCK et **{number((0.1 - smlp['medianRelativeIncrease']) * 100, 6)} points** pour SMLP. La seconde cohorte STCK atteint toutefois **{percent(cohort2_stck['medianRelativeIncrease'])}**, soit seulement **{number((0.1 - cohort2_stck['medianRelativeIncrease']) * 100, 6)} point** sous le seuil. Cette variation est intégralement conservée. Le critère porte sur les huit sessions réunies par jeu et version ; les deux cohortes restent détaillées ci-dessous.",
        '## Sources et périmètre',
        table(['Rôle', 'Identité', 'Digest natif'], [
            ['A : référence remesurée', 'Site 73 / native 0.45.0 ; commit `' + policy['baseline']['commit'] + '`', '`' + policy['baseline']['nativeDigest'] + '`'],
            ['B : candidat gelé', 'Native 0.46.0 ; 260 fichiers natifs, archive de 271 fichiers', '`' + policy['candidate']['nativeDigest'] + '`']]),
        f"Le [protocole](protocol.md), la [déclaration](declaration.json) finalisée le **10 novembre 2026 à {time_local(declaration['finalizedAt'])} UTC−03:00**, la [politique globale](global-budget-policy.json), les [cas](cases.json) et la [politique de phases](comparison-policy.json) précèdent la fenêtre. Les cas, la politique de phases et les sept outils conservés restent byte-identiques à leur référence. Les temps historiques de 0.45 n’entrent pas dans les nouveaux échantillons.",
        'Les retours publics STCK10 et SMLP15 sont identiques entre A et B. Chaque commande est recalculée avant de recevoir le retour enregistré. Le parcours STCK conservé termine deux niveaux, celui de SMLP trois. Ce sont des mesures de la boucle native commune ; la contribution propre de ReceptionService est documentée dans ses preuves distinctes. Le moteur du jeu, le réseau de production et le rendu navigateur restent hors de cette mesure.',
        '## Exécution et intégrité',
        f"La [fenêtre officielle](window.json) s’est déroulée le **10 novembre 2026 de {time_local(window['startedAt'])} à {time_local(window['finishedAt'])} UTC−03:00**. Les quatre séries et l’intégrité finale ont le statut `passed`. Les reçus techniques conservent leurs horodatages UTC d’origine.",
        table(['Série', 'Source', 'Début UTC−03:00', 'Fin UTC−03:00', 'Résultat'],
              [[e['label'], '0.45.0' if e['label'].startswith('A') else '0.46.0', time_local(e['startedAt']), time_local(e['finishedAt']), e['status']] for e in window['executions']]),
        table(['Élément', 'Résultat conservé'], [
            ['Ordre', 'A1, B1, B2, A2'], ['Cohortes', '2'], ['Sessions mesurées', '32 ; huit par jeu et version'],
            ['Actions mesurées', '400 ; 200 pour A et 200 pour B'], ['Chauffes exclues', '8 sessions, 24 actions'],
            ['Sessions mesurées ou valeurs extrêmes exclues', '0'], ['Revue arithmétique', '231/231, passée'],
            ['Intégrité finale', 'Inventaires, traces, cas, protocole et outils surveillés inchangés']]),
        'Chaque série mesure STCK puis SMLP. Chaque cas/série utilise un worker distinct, une chauffe de trois actions puis quatre sessions à mémoire froide ; le processus et son JIT restent présents pendant ce cas/série. La fenêtre ne contient aucun incident de mesure ni série incomplète. Le [reçu de readiness](readiness.json) lie les preuves achevées et l’isolation déclarée, dont l’arrêt de la prévisualisation. Le [préflight statique](static-preflight.json) a vérifié 48/48 contrats de fichiers, archive, protocole et dépendances ; il laisse explicitement l’isolation finale au reçu de readiness.',
        'Le premier [contrôle statique](static-preflight-initial-link-assumption.json) exigeait un lien symbolique pour Pyodide. La reprise vérifie les copies de douze fichiers et 18 339 702 octets par leurs empreintes individuelles, sans changer les dépendances ni les entrées mesurées. Le premier reçu et son générateur restent conservés.',
        f"Environnement consigné : Node {aggregate['environment']['node']}, {aggregate['environment']['platform']} {aggregate['environment']['release']}, {aggregate['environment']['cpuModel']}, {aggregate['environment']['logicalCpus']} processeurs logiques exposés. Ces métadonnées et l’ordre ABBA décrivent la fenêtre ; les états GC, JIT et d’ordonnancement peuvent varier entre sessions.",
        '## Critère global par jeu',
        'La [décision globale](global-budget-decision.json) relit toutes les durées conservées après vérification de la revue de consolidation. La formule est `médiane(B) / médiane(A) − 1`. Chaque jeu doit rester **strictement sous +10 %** ; une valeur exactement égale à +10 % échoue. Aucun jeu ne compense un autre, aucun ratio de cohorte n’est moyenné, et les phases imbriquées ne sont pas additionnées.',
        table(['Jeu', 'Sessions A / B', 'Médiane A, ms', 'Médiane B, ms', 'Variation globale', 'Critère strict < +10 %'],
            [[row['case'], f"{row['sessionsPerVersion']} / {row['sessionsPerVersion']}", number(row['beforeMedianMs']), number(row['afterMedianMs']), percent(row['medianRelativeIncrease']), 'Accepté' if row['accepted'] else 'Non accepté'] for row in decision['globalCases']]),
        'Le statut est **`accepted_under_user_global_rule`**, accepté **2/2**. Les durées affichées sont arrondies à trois décimales en millisecondes, six pour les valeurs inférieures à 1 ms ; les variations sont affichées à six décimales. L’acceptation utilise les valeurs intégrales des reçus.',
        '## Les seize diagnostics agrégés',
        'Sources : [agrégat](combined-comparison.json) et [revue indépendante](consolidation-review.json). « Dans le seuil » reproduit `within_observed_budget`. Tous les dépassements de cette fenêtre portent la classification historique `over_budget_with_noise_unresolved` ; cette qualification ne relève pas le seuil. Le coût est accepté par le critère global distinct.',
        medians(aggregate['comparisons']),
        'Les trois dépassements agrégés portent sur STCK : **service de préfixe +15,072714 %**, **requête de préfixe +12,903517 %**, **garde +13,088074 %**. STCK conserve cinq diagnostics dans le seuil sur huit et SMLP huit sur huit, soit **13/16**. Le seuil de phases historique n’est pas réécrit.',
        '### Dispersion et p95 agrégés',
        'Les intervalles montrent toutes les observations retenues, du minimum au maximum. L’étendue relative des médianes de session est `(maximum − minimum) / médiane` des médianes par session. Les observations au sein d’une session sont corrélées ; ces étendues décrivent la dispersion sans constituer un intervalle de confiance. Le p95 emploie le rang empirique `ceil(0,95 × n)` et reste indisponible sous vingt observations, notamment pour les durées de session.',
        dispersion(aggregate['comparisons']),
    ]
    adverse_tails = [(row['case'], m) for row in aggregate['comparisons'] for m in row['metrics']
                     if m['before']['p95Ms'] is not None and ratio(m['before']['p95Ms'], m['after']['p95Ms']) > 0.1]
    lines += ['Les hausses de p95 supérieures à +10 % restent visibles : ' + '; '.join(
        f"**{case} `{m['stage']}` {percent(ratio(m['before']['p95Ms'], m['after']['p95Ms']))}**" for case, m in adverse_tails) + '. Leur cause ne peut pas être attribuée à partir de ces seules mesures.',
        '## Deux cohortes conservées',
        'Les [comparaisons de cohorte 1](cohort1/comparison.json) et de [cohorte 2](cohort2/comparison.json) restent toutes deux au statut `budget_review_required`. La première conserve **7/16** diagnostics dans le seuil, la seconde **14/16**. Leurs quatre variations globales restent sous +10 %, avec des variations distinctes que l’agrégation ne masque pas.',
        table(['Cohorte', 'Ordre', 'Jeu', 'Sessions A / B', 'Médiane A, ms', 'Médiane B, ms', 'Variation globale', 'Diagnostics dans le seuil'],
            [[str(index), 'A1 puis B1' if index == 1 else 'B2 puis A2', row['case'], '4 / 4',
              number(m['before']['medianMs']), number(m['after']['medianMs']), percent(m['medianRelativeIncrease']),
              str(sum(metric['result'] == 'within_observed_budget' for metric in row['metrics'])) + '/8']
             for index, cohort in enumerate(cohorts, 1) for row in cohort['comparisons']
             for m in row['metrics'] if m['stage'] == 'session_elapsed']),
        'Les trente-deux diagnostics de cohorte et leurs distributions figurent intégralement dans les deux sections suivantes. Le classement de chaque ligne reste celui de son comparateur d’origine.',
    ]
    for index, cohort in enumerate(cohorts, 1):
        lines += [f'### Cohorte {index} : seize diagnostics', medians(cohort['comparisons']),
                  f'### Cohorte {index} : dispersion et p95', dispersion(cohort['comparisons'])]
    lines += [
        'La première cohorte conserve notamment STCK `new_decision` **+28,053376 %**, `acquisition_and_persistence` **+12,526960 %**, `persistence` **+12,571235 %** et SMLP `restoration` **+28,002982 %**. La seconde conserve STCK `acquisition_and_persistence` **+19,856430 %**. Ces résultats défavorables font partie de l’agrégat ; aucune session n’a été retirée et aucun suivi favorable n’a été sélectionné.',
        '## Inspection et Pause conservées',
        'Les comparaisons de cohorte conservent aussi l’inspection et la Pause. Ces observations sont hors des seize diagnostics de coût. L’inspection inclut le service et, pour `endToEnd`, le transport worker ; elle ne mesure pas un inspecteur rendu à l’écran. Chaque cohorte comporte douze observations par jeu/version, donc aucun p95 à cette échelle.',
        table(['Cohorte', 'Jeu', 'Inspection', 'Effectif A / B', 'Médiane A / B, ms', 'Variation', 'Min à max A / B, ms'],
            [[str(index), row['case'], '`' + key + '`', f"{before['count']} / {after['count']}",
              number(before['medianMs']) + ' / ' + number(after['medianMs']), percent(ratio(before['medianMs'], after['medianMs'])),
              span(before) + ' / ' + span(after)]
             for index, cohort in enumerate(cohorts, 1) for row in cohort['comparisons'] for key in ['nativeService', 'endToEnd']
             for before, after in [(row['inspection']['before'][key], row['inspection']['after'][key])]]),
        'La Pause est observée pendant la planification initiale et à la première action engagée, avec quatre observations par contexte/jeu/version/cohorte. Toutes sont acquittées et atteignent la frontière sûre attendue : zéro action pour la première, une action pour la seconde. La latence jusqu’à cette frontière inclut le travail en cours ; elle ne démontre pas l’interruption de toute recherche arbitrairement longue. Aucun p95 n’est défini pour quatre observations.',
        table(['Cohorte', 'Jeu', 'Contexte', 'Acquittement médian A / B, ms', 'Acquittement max A / B, ms', 'Frontière sûre médiane A / B, ms', 'Variation frontière', 'Frontière sûre min à max A / B, ms'],
            [[str(index), row['case'], '`' + phase + '`', number(before['acknowledgement']['medianMs']) + ' / ' + number(after['acknowledgement']['medianMs']),
              number(before['acknowledgement']['maxMs']) + ' / ' + number(after['acknowledgement']['maxMs']),
              number(before['safeBoundary']['medianMs']) + ' / ' + number(after['safeBoundary']['medianMs']),
              percent(ratio(before['safeBoundary']['medianMs'], after['safeBoundary']['medianMs'])),
              span(before['safeBoundary']) + ' / ' + span(after['safeBoundary'])]
             for index, cohort in enumerate(cohorts, 1) for row in cohort['comparisons'] for phase in ['initial_planning', 'engaged_action']
             for before, after in [(row['pause']['before'][phase], row['pause']['after'][phase])]]),
        'Les hausses d’inspection et les délais de Pause défavorables restent conservés au même titre que les phases. Les journaux bruts gardent également les échantillons mémoire et les valeurs de chaque session ; cette fenêtre finie ne certifie pas la stabilité sur plusieurs heures.',
        '## Reproductibilité et transport des journaux',
        'La revue [consolidation-review.json](consolidation-review.json) recalcule indépendamment les distributions, ratios et classements de cohorte et agrégés depuis les quatre rapports. Ses **231 contrôles** lient aussi les empreintes et les effectifs. Le [reçu global](global-budget-decision.json) vérifie ensuite la déclaration antérieure, la revue passée et chaque durée de session.',
        table(['Pièce', 'SHA-256'], [[name, '`' + original_hashes[name] + '`'] for name in
            ['declaration.json', 'global-budget-policy.json', 'combined-comparison.json', 'consolidation-review.json', 'global-budget-decision.json']]),
        'Les quatre journaux originaux sont conservés et compressés sans perte avec `mtime=0`. Le [reçu de transport](log-transport.json) vérifie les empreintes des originaux contre la fenêtre, l’égalité exacte après décompression et l’absence de modification des originaux.',
        table(['Série', 'Rapport de sessions', 'Journal compressé', 'Octets originaux', 'Octets gzip'],
            [[item['series'], '[' + item['original']['path'].split('/performance/')[1].replace('.log', '.json') + ']('
              + item['original']['path'].split('/performance/')[1].replace('.log', '.json') + ')',
              '[' + item['transport']['path'].split('/performance/')[1] + '](' + item['transport']['path'].split('/performance/')[1] + ')',
              str(item['original']['bytes']), str(item['transport']['bytes'])] for item in transport['logs']]),
        f"Transport : **{sum(item['original']['bytes'] for item in transport['logs'])} octets originaux**, **{sum(item['transport']['bytes'] for item in transport['logs'])} octets gzip**. Aucun contenu n’est filtré ou réécrit.",
        '## Décision de coût et portée fonctionnelle',
        '**Le coût de native 0.46 est accepté sur STCK et SMLP selon la règle globale autorisée.** Les trois dépassements de phase agrégés, les onze dépassements cumulés des diagnostics de cohorte, toutes les dispersions et les hausses de p95 restent publiés. Aucun seuil n’a été relevé et aucune observation mesurée n’a été exclue.',
        'Cette acceptation s’ajoute aux preuves fonctionnelles liées par la [readiness](readiness.json). Les résultats de la [campagne FOGW](../final/fogw-resolution.json), les [contrats source et adaptations](../diagnostic/fogw-public-parity.json), la [contribution](../final/fogw-reception-session/reception-service-contribution.json.gz), les [régressions CATR/RSWP](../final/regressions/regression-summary.json) et le [navigateur](../final/browser/browser-qa.json) gardent leurs propres périmètres. La parité complète de l’appelant original et la revalidation spécifique du changement de requête restent qualifiées séparément ; le critère de coût ne tranche pas ces questions.',
    ]
    document = '\n\n'.join(lines) + '\n'
    destination = PERF / 'results.md'
    with destination.open('x') as stream: stream.write(document)
    assert all(sha(PERF / name) == digest for name, digest in original_hashes.items()), 'A source receipt changed while writing prose'
    local_links = re.findall(r'\[[^\]]+\]\(([^)]+)\)', document)
    assert all((PERF / path).resolve().exists() for path in local_links), 'A report link is unavailable'
    expected_count = sum(len(row['metrics']) for row in aggregate['comparisons'])
    expected_cohort = sum(len(row['metrics']) for cohort in cohorts for row in cohort['comparisons'])
    assert expected_count == 16 and expected_cohort == 32
    print(json.dumps({'path': destination.relative_to(ROOT).as_posix(), 'bytes': destination.stat().st_size,
                      'sha256': sha(destination), 'aggregateMetrics': expected_count, 'cohortMetrics': expected_cohort,
                      'localLinksChecked': len(local_links), 'inputReceiptsUnchanged': True}))

if __name__ == '__main__': main()
