#!/usr/bin/env python3
"""Render the distinct additive-owner cost decision, preserving the strict failure."""
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
from statistics import median
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
DIRECTORY = ROOT / 'docs/migration/lot4a-evidence/performance-integrated'
FORMATTER = Path(__file__).with_name('write-cost-results.py')
spec = importlib.util.spec_from_file_location('retained_cost_formatting', FORMATTER)
F = importlib.util.module_from_spec(spec)
spec.loader.exec_module(F)


def main():
    output, receipt = DIRECTORY / 'results-qualified.md', DIRECTORY / 'results-qualified-render.json'
    F.require(not output.exists() and not receipt.exists(), 'Qualified rendering is exclusive')
    names = ['declaration.json', 'global-budget-policy.json', 'readiness.json', 'window.json',
             'coordinated-window-execution.json', 'lock-acquisition.json', 'protocol-check.json',
             'owner-addition-declaration.json', 'owner-addition-qualification.json',
             'aggregation-failure-reproduced.json', 'owner-qualified-comparison.json',
             'owner-qualified-cost-review.json', 'owner-qualified-global-budget-decision.json',
             *[f'cohort{i}/{name}.json' for i in (1, 2) for name in ('baseline', 'after', 'comparison')]]
    paths = [DIRECTORY / name for name in names] + [DIRECTORY / 'protocol.md', DIRECTORY / 'owner-addition-protocol.md',
                                                  FORMATTER, Path(__file__)]
    paths += [DIRECTORY / f'cohort{i}/{side}.log' for i in (1, 2) for side in ('baseline', 'after')]
    paths += [DIRECTORY / 'aggregation-failure-reproduced.log']
    before = [F.fingerprint(path) for path in paths]
    values = {name: F.read(DIRECTORY / name) for name in names}
    aggregate, review, decision, qualification, window = [values[name] for name in
        ('owner-qualified-comparison.json', 'owner-qualified-cost-review.json',
         'owner-qualified-global-budget-decision.json', 'owner-addition-qualification.json', 'window.json')]
    extra_records = {}
    def retained_links(value):
        if isinstance(value, dict):
            if {'path', 'sha256'} <= value.keys():
                path = F.resolve_input(value['path'])
                actual = F.fingerprint(path)
                F.require(actual['sha256'] == value['sha256'] and ('bytes' not in value or actual['bytes'] == value['bytes']),
                          'Linked retained input changed: ' + value['path'])
                extra_records[str(path)] = actual
            for child in value.values():
                retained_links(child)
        elif isinstance(value, list):
            for child in value:
                retained_links(child)
    for value in (aggregate, review, decision, qualification):
        retained_links(value)
    existing_paths = {str(path.resolve()) for path in paths}
    for name, record in extra_records.items():
        if name not in existing_paths:
            paths.append(Path(name)); before.append(record); existing_paths.add(name)
    F.require(aggregate['schema'] == 'logos-engine.native-cost-owner-qualified-comparison.v1'
              and aggregate['status'] == 'qualified_diagnostic_calculation', 'Unexpected qualified aggregate')
    F.require(review['schema'] == 'logos-engine.native-cost-owner-qualified-review.v1'
              and review['status'] == 'owner_qualified_arithmetic_verified', 'Independent qualified arithmetic is missing')
    F.require(decision['schema'] == 'logos-engine.native-cost-owner-qualified-global-budget-decision.v1', 'Unexpected qualified decision')
    F.require(qualification['status'] == 'qualified_owner_addition_verified'
              and qualification['workMetadataExact'] is False and qualification['strictAggregationReclassified'] is False,
              'Owner qualification must preserve the strict failure')
    F.require(window['status'] == window['finalIntegrity'] == 'passed', 'Measurement window incomplete')
    F.require(aggregate['originalStrictAggregation']['status'] == 'failed'
              and not (DIRECTORY / 'combined-comparison.json').exists(), 'Strict gate must remain failed without replacement')
    F.require(decision['measuredSessions'] == 32 and decision['measuredActions'] == 400, 'Session population changed')
    F.require(review['sources'] == decision['sources'] == aggregate['sources'], 'Cost source identities differ')
    F.require(review['aggregate'] == F.fingerprint(DIRECTORY / 'owner-qualified-comparison.json')
              and decision['arithmeticReview'] == F.fingerprint(DIRECTORY / 'owner-qualified-cost-review.json'),
              'Review and decision must bind the receipts actually rendered')
    F.require(review['checkedCount'] > 0 and all(row['passed'] for row in review['checks']), 'Incomplete arithmetic review')
    for row in aggregate['comparisons']:
        for metric in row['metrics']:
            F.check_distribution(metric['before']); F.check_distribution(metric['after'])
    budget_accepted = decision['accepted'] is True
    F.require(type(decision['accepted']) is bool and len(decision['globalCases']) == 2
              and {row['case'] for row in decision['globalCases']} == {'STCK', 'SMLP'}
              and all(type(row['accepted']) is bool for row in decision['globalCases'])
              and budget_accepted == all(row['accepted'] for row in decision['globalCases'])
              and decision['acceptedCases'] == sum(row['accepted'] for row in decision['globalCases'])
              and decision['totalCases'] == len(decision['globalCases']), 'Global decision fields are inconsistent')
    F.require(decision['status'] == ('accepted_under_user_global_rule_with_owner_addition_qualification'
                                   if budget_accepted else 'global_budget_review_required'), 'Decision status differs from its cases')
    heading = 'conforme à la règle globale, avec qualification structurelle' if budget_accepted else 'budget global non accepté'
    cases = decision['globalCases']
    lines = [
        '# Lot 4A : coût 0.50 → 0.51, qualification du propriétaire ajouté', '',
        f'**Résultat : {heading}.** Cette décision est distincte de l’échec du consolidateur strict, qui demeure conservé. '
        'La règle numérique a été déclarée avant la mesure ; la qualification de comparabilité structurelle a été ajoutée après la fenêtre.', '',
        F.table(['Jeu', 'Sessions par version', 'Médiane A, ms', 'Médiane B, ms', 'Variation globale', 'Budget strict < +10 %'],
                [[row['case'], row['sessionsPerVersion'], F.number(row['beforeMedianMs'], 6), F.number(row['afterMedianMs'], 6),
                  F.percent(row['medianRelativeIncrease']), 'Conforme' if row['accepted'] else 'Non conforme'] for row in cases]), '',
        'A désigne **Site 79 / native 0.50.0**, commit `6d03c2adda9f60b1c97304f5491a428cfbec7a6c`, digest '
        '`e039a62b5dbb563a6c25f5469228e0025ffb66f243a4e09fdf27caeaeef2bf87`. B désigne le gel intégré **0.51.0**, '
        '`c1e3dbdba85929dee4a287bc2f5cb6a011457ba43e9a67078f2764f659b603b7`. Les anciennes durées ne fournissent aucun échantillon.', '',
        '## Fenêtre et population conservées', '',
        f'La fenêtre officielle s’étend du **{F.utc(window["startedAt"])}** au **{F.utc(window["finishedAt"])}**, '
        'dans l’ordre **A1/B1/B2/A2**. Elle conserve **32 sessions et 400 actions mesurées**, avec huit sessions par jeu et version. '
        'Seules les huit chauffes préannoncées de trois actions, soit 24 actions, sont exclues. Aucun outlier, session ou cohorte n’est retiré. '
        'Le verrou exclusif, les acquittements explicites des autres fils et l’arrêt du preview sont liés aux reçus de préparation et d’exécution.', '',
        '## Échec strict et qualification distincte', '',
        'Le [consolidateur strict inchangé a échoué](aggregation-failure-reproduced.json) sur l’égalité des métadonnées de graphe. '
        'Il n’existe aucun agrégat officiel `combined-comparison.json` de remplacement. Les deux comparaisons de cohorte conservent leurs statuts originaux.', '',
        'Les seules différences de la signature de travail hors durées sont **432 occurrences** : 344 comptes de nœuds d’observation, 48 comptes d’inspection, '
        '20 comptes finaux et 20 révisions finales. Le nombre de nœuds est toujours augmenté de **trois**. La révision finale augmente '
        'de **3 + nombre de préfixes acquis**, soit +9 pour STCK, +12 pour SMLP et +6 pour chaque chauffe. Tous les autres champs '
        'de la signature complète de travail sont exactement égaux ; à version fixe, toutes les signatures sont stables entre cohortes.', '',
        'Les [captures de graphes et leur qualification](owner-addition-qualification.json) attribuent ces ajouts à '
        '`family_state:feedback_sequences`, `family_activation:feedback_sequences` et `program:v6.feedback_sequences.choose`, '
        'avec les écritures de provenance conservées par préfixe. Chaque graphe garde sa chaîne propre. Les captures exécutées après la fenêtre '
        'corroborent l’attribution sur les mêmes gels ; elles ne prouvent pas rétroactivement les feuilles privées que les mesures ne capturaient pas. '
        'Aucune identité binaire ou égalité intégrale des graphes A/B n’est revendiquée.', '',
        'La qualification est explicitement [déclarée après mesure](owner-addition-declaration.json), avant les captures et le calcul groupé qualifié. '
        'Elle ne change ni source native, outil officiel, temps, seuil, population ou ordre de phase. **Tout le coût des trois nœuds demeure dans les durées brutes** ; '
        'aucune dépense du nouveau propriétaire n’est soustraite. Le [calcul qualifié](../aggregate-owner-qualified-cost.mjs) utilise les '
        '[fonctions arithmétiques JavaScript inchangées](../../../../scripts/compare-native-cost-cohorts.mjs) pour reproduire les deux comparaisons originales, '
        'puis une [revue Python indépendante](owner-qualified-cost-review.json) recalcule les distributions et la règle stricte.', '',
        f'La revue qualifiée vérifie **{review["checkedCount"]} contrôles**. Le diagnostic groupé de phases est '
        f'**{aggregate["withinObservedBudget"]}/16**, de statut `{aggregate["budgetStatus"]}`. Ce compteur ne remplace pas la décision globale par jeu.', '',
        '## Toutes les médianes groupées', '', F.medians(aggregate['comparisons']), '', F.adverse_text(aggregate['comparisons']), '',
        '## Dispersions et queues groupées', '',
        'Le p95 empirique utilise le rang `ceil(0,95 × n)` seulement lorsque n ≥ 20. Huit sessions par jeu/version ne fournissent aucun p95 de session. '
        'Les phases sont imbriquées et leurs médianes ne s’additionnent pas. Les échantillons d’une même session sont corrélés.', '',
        F.dispersion(aggregate['comparisons']), '', F.tails_text(aggregate['comparisons'], 0.1), '',
    ]
    for index in (1, 2):
        comparison = values[f'cohort{index}/comparison.json']
        lines += [f'## Cohorte {index}, résultat original conservé', '',
                  f'Statut `{comparison["status"]}` ; **{16-len(comparison["unresolved"])}/16** diagnostics dans le seuil historique.', '',
                  F.medians(comparison['comparisons']), '', F.adverse_text(comparison['comparisons']), '',
                  F.dispersion(comparison['comparisons']), '', F.tails_text(comparison['comparisons'], 0.1), '']
    inspection_rows, pause_rows, pause_checks, memory_rows = [], [], [], []
    for index in (1, 2):
        comparison = values[f'cohort{index}/comparison.json']
        for row in comparison['comparisons']:
            for side, label in [('before', 'A'), ('after', 'B')]:
                for kind, dist in row['inspection'][side].items():
                    inspection_rows.append([index, row['case'], label, kind, dist['count'], F.number(dist['medianMs']), F.span(dist), F.number(dist['p95Ms'])])
                for phase, kinds in row['pause'][side].items():
                    for kind, dist in kinds.items():
                        pause_rows.append([index, row['case'], label, phase, kind, dist['count'], F.number(dist['medianMs']), F.span(dist), F.number(dist['p95Ms'])])
        for side, label in [('baseline', 'A'), ('after', 'B')]:
            for case in values[f'cohort{index}/{side}.json']['cases']:
                trials = [trial for trial in case['trials'] if not trial['warmup']]
                for phase in ('initial_planning', 'engaged_action'):
                    pauses = [p for trial in trials for p in trial['pauses'] if p['phase'] == phase]
                    pause_checks.append([index, case['id'], label, phase, len(pauses), sum(p['acknowledgedPaused'] is True for p in pauses),
                                         ', '.join(map(str, sorted({p['actionsAtSafeBoundary'] for p in pauses})))])
                samples = [sample for trial in trials for sample in trial['memory']]
                for field in ('heapUsed', 'rss'):
                    numbers = [sample[field] / (1024 * 1024) for sample in samples]
                    memory_rows.append([index, case['id'], label, field, len(numbers), F.number(median(numbers)),
                                        F.number(min(numbers)) + ' à ' + F.number(max(numbers))])
    lines += ['## Inspection, Pause et mémoire', '',
              'Ces diagnostics restent séparés des seize médianes de phase. Pause est contrôlée pendant la planification initiale et la première action engagée ; '
              'cela ne valide pas chaque recherche longue ni l’interface navigateur.', '',
              F.table(['Cohorte','Jeu','Version','Inspection','n','Médiane, ms','Min à max, ms','p95, ms'],inspection_rows), '',
              F.table(['Cohorte','Jeu','Version','Contexte Pause','Mesure','n','Médiane, ms','Min à max, ms','p95, ms'],pause_rows), '',
              F.table(['Cohorte','Jeu','Version','Contexte Pause','Observations','Acquittements','Actions à la frontière sûre'],pause_checks), '',
              F.table(['Cohorte','Jeu','Version','Mesure','n','Médiane, Mio','Min à max, Mio'],memory_rows), '',
              'Les échantillons mémoire incluent le travail et l’allocation réellement exécutés. Les processus, GC et chauffes influencent ces valeurs ; '
              'une variation de RSS ne démontre pas à elle seule une fuite ou une cause liée à Feedback. Ces sessions finies ne prouvent pas une stabilité de plusieurs heures.', '',
              '## Portée de la décision', '',
              'La [décision globale qualifiée](owner-qualified-global-budget-decision.json) applique le seuil numérique préalable à chaque jeu séparément. '
              'La consolidation stricte reste en échec, la comparabilité structurelle est qualifiée après mesure et le contrôle navigateur reste bloqué par infrastructure. '
              'La fenêtre mesure la boucle commune sur retours enregistrés : rendu navigateur, moteur du jeu et réseau sont exclus. '
              'Ces coûts ne constituent ni une campagne live ni une contribution propre de Feedback aux choix de STCK/SMLP.', '']
    after = [F.fingerprint(path) for path in paths]
    F.require(before == after, 'Retained input changed during rendering')
    with output.open('x') as stream:
        stream.write('\n'.join(lines))
    result = {'schema': 'logos-engine.lot4a-owner-qualified-cost-report-render.v1', 'status': 'rendered_qualified_receipts',
              'recordedAt': datetime.now(timezone.utc).isoformat(), 'generator': F.fingerprint(Path(__file__)),
              'formattingHelper': F.fingerprint(FORMATTER), 'report': F.fingerprint(output),
              'inputsBefore': before, 'inputsAfter': after, 'inputReceiptsUnchanged': True,
              'runtimeOrGameExecuted': False, 'measurementExecuted': False, 'arithmeticReviewChecks': review['checkedCount'],
              'strictAggregationStatus': 'failed', 'workMetadataExactAcrossAllSessions': False,
              'globalBudgetAccepted': budget_accepted, 'qualificationDeclaredAfterWindow': True}
    with receipt.open('x') as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2); stream.write('\n')
    print(json.dumps({'status': result['status'], 'report': result['report'], 'globalBudgetAccepted': budget_accepted,
                      'strictAggregationStatus': 'failed'}))


if __name__ == '__main__':
    main()
