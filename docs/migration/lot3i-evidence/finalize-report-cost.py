#!/usr/bin/env python3
"""Complete the delivery report from the retained cost decision, without timing."""
from pathlib import Path
import json
import re

BASE = Path(__file__).resolve().parent
PERF = BASE / 'performance'

def read(name): return json.loads((PERF / name).read_text())
def number(value, digits=3): return f'{value:,.{digits}f}'.replace(',', '\u202f').replace('.', ',')
def percent(value): return f'{100 * value:+.6f}'.replace('-', '−').replace('.', ',') + ' %'

def main():
    decision = read('global-budget-decision.json')
    aggregate = read('combined-comparison.json')
    review = read('consolidation-review.json')
    window = read('window.json')
    assert window['status'] == window['finalIntegrity'] == review['status'] == 'passed'
    assert review['checkedCount'] == 231 and decision['measuredSessions'] == 32 and decision['measuredActions'] == 400
    accepted = decision['accepted']
    verdict = 'accepté sur les deux jeux' if accepted else 'non conforme sur au moins un jeu'
    closure = 'clôturé dans son périmètre annoncé' if accepted else 'fonctionnellement validé avec réserve de coût ; il reste ouvert'
    summary = '; '.join(f"{row['case']} {percent(row['medianRelativeIncrease'])}" for row in decision['globalCases'])
    table = '\n'.join([
        '| Jeu | Référence 0.49, ms | Natif 0.50, ms | Variation globale | Budget strict < +10 % |',
        '| --- | ---: | ---: | ---: | --- |',
        *[f"| {row['case']} | {number(row['beforeMedianMs'])} | {number(row['afterMedianMs'])} | {percent(row['medianRelativeIncrease'])} | {'Accepté' if row['accepted'] else 'Non conforme'} |" for row in decision['globalCases']]])
    diagnostic = f"**{aggregate['withinObservedBudget']}/{aggregate['budgetMetricCount']} diagnostics historiques**"
    overruns = '; '.join(f"{row['case']} `{row['stage']}` **{percent(row['medianRelativeIncrease'])}**" for row in aggregate['unresolved'])
    if not overruns: overruns = 'aucun dépassement agrégé de médiane'
    tails = []
    for case in aggregate['comparisons']:
        for metric in case['metrics']:
            a, b = metric['before'].get('p95Ms'), metric['after'].get('p95Ms')
            if a is not None and b is not None and a > 0 and b / a - 1 > 0.1:
                tails.append(f"{case['case']} `{metric['stage']}` **{percent(b / a - 1)}**")
    tail_text = '; '.join(tails) if tails else 'aucune hausse calculable supérieure à +10 % dans l’agrégat'
    cohort_text = '; '.join(f"cohorte {row['cohort']} **{row['withinObservedBudget']}/16**" for row in review['cohortResults'] if row['cohort'] != 'combined')
    cohort_global_overruns = [f"cohorte {row['cohort']}, {metric['case']} **{percent(metric['medianRelativeIncrease'])}**"
        for row in review['cohortResults'] if row['cohort'] != 'combined'
        for metric in row['unresolved'] if metric['stage'] == 'session_elapsed']
    cohort_warning = ('Une cohorte prise séparément conserve un dépassement global : '
        + '; '.join(cohort_global_overruns)
        + '. La règle préannoncée porte sur les huit sessions par version et par jeu, toutes cohortes regroupées ; cette réserve de cohorte reste visible sans modifier le seuil.'
        if cohort_global_overruns else 'Aucun dépassement global isolé de cohorte ne reste dans les diagnostics.')
    cost = f'''## Coût global autorisé

**Le coût global est {verdict} : {summary}.** La [décision](lot3i-evidence/performance/global-budget-decision.json) applique la règle autorisée aux médianes groupées de session complète, séparément pour chaque jeu. Le [rapport complet](lot3i-evidence/performance/results.md) conserve les sessions, les cohortes, les seize diagnostics, la dispersion, les p95 disponibles, l’inspection et la pause.

{table}

La fenêtre respecte **A1/B1/B2/A2**, soit **32 sessions mesurées et 400 actions**, contre une référence fraîche du Site 78 / native 0.49. Seules les **huit chauffes préannoncées, 24 actions**, sont exclues. Aucune session mesurée, valeur défavorable ou valeur extrême n’est retirée. Les autres fils 4A et 7A ont explicitement réservé ce créneau à 3I ; le [reçu de disponibilité](lot3i-evidence/performance/readiness.json) précède la fenêtre et lie les validations terminées et la coordination.

Le critère est `médiane(B) / médiane(A) − 1 < 0,10` pour chaque jeu : l’égalité à +10 % échoue. Il n’y a ni compensation entre jeux, ni somme de phases imbriquées, ni moyenne de ratios de cohortes. Les dépassements de phase restent diagnostiques lorsque les deux coûts globaux passent.

Le classement historique demeure {diagnostic} ; {cohort_text}. Dépassements agrégés conservés : {overruns}. Ils ne sont ni effacés ni reclassés par la décision globale.

{cohort_warning}

Hausses de p95 conservées : {tail_text}. Un p95 est laissé indisponible sous vingt échantillons. Ces observations ne démontrent pas à elles seules une cause ou une évolution indépendante de la machine.

La [revue arithmétique indépendante](lot3i-evidence/performance/consolidation-review.json) passe **231/231 contrôles**. Les cas, les sept outils et les seuils sont ceux de la [déclaration antérieure aux mesures](lot3i-evidence/performance/declaration.json). Le précontrôle statique passe 52/52 et la revue indépendante de préparation 56/56. Le rejeu WEAV utilise son hôte de preuve distinct ; sa limite mémoire n’est transmise à aucune série officielle.

Le coût mesuré concerne la boucle commune sur retours publics enregistrés. Le moteur de jeu, le réseau de production et le rendu du navigateur sont hors de cette mesure. La contribution propre de RecurrentSeries est établie séparément par CONN.

'''
    path = BASE.parent / 'lot3i-recurrent-series.md'
    text = path.read_text()
    start, end = text.index('## Coût global autorisé'), text.index('## Suite de la feuille de route')
    text = text[:start] + cost + text[end:]
    text = text.replace('**Le lot 3I reste ouvert pour livraison.**', f'**Le lot 3I est {closure}.**')
    text = text.replace('**le coût global et la publication restent ATTENTE**', f'**le coût global est {verdict}**')
    text = text.replace('| Coût global STCK/SMLP | **ATTENTE** | Fenêtre officielle complète et décision séparée |',
        f'| Coût global STCK/SMLP | **{decision["acceptedCases"]}/{decision["totalCases"]} jeux conformes** | [Décision globale](lot3i-evidence/performance/global-budget-decision.json), {summary} |')
    text = text.replace('| Publication effective | **ATTENTE** | Index documentaire final et identité de publication à consigner |',
        '| Dossier de publication privée | **Lié au gel vérifié** | [Précontrôle](lot3i-evidence/publication-preflight.json) et [index des empreintes](lot3i-evidence/evidence-index.json) ; identité de version et commit enregistrée par Sites |')
    text = re.sub(r'\*\*Statut de clôture 3I : ATTENTE\.\*\*[^\n]*',
        f'**Statut de 3I : {closure}.** La validation formelle, les cinq rejeux, CONN, sa contribution, le navigateur, l’intégrité et la décision officielle de coût sont conservés. Le dossier de publication lie ce gel, les rapports et la feuille de route au commit livré. Les refus, échecs, interruptions et limites restent explicites.', text)
    assert 'ATTENTE' not in text
    path.write_text(text)

    path = BASE / 'README.md'; text = path.read_text()
    text = re.sub(r'\*\*La livraison 3I reste ouverte :[^\n]*?ATTENTE\.\*\*',
        f'**Le lot 3I est {closure} ; son coût global est {verdict}.**', text, count=1)
    text = text.replace('La livraison 3I reste ouverte : coût officiel et publication ATTENTE.',
        f'Le lot 3I est {closure} ; son coût global est {verdict}.')
    block = f'''<!-- COST_RESULT_START -->
**Coût officiel {verdict} : {summary}.** La [décision globale](performance/global-budget-decision.json), le [rapport complet](performance/results.md) et la [revue indépendante](performance/consolidation-review.json) conservent les 32 sessions / 400 actions et les **231/231 contrôles**. Le [reçu de disponibilité](performance/readiness.json) précède la [fenêtre complète](performance/window.json).

{table}

Le classement historique reste {diagnostic} ; {cohort_text}. Dépassements agrégés : {overruns}. Hausses de p95 calculables supérieures à +10 % : {tail_text}. Les journaux complets sont conservés par le [reçu de transport](performance/log-transport.json).

{cohort_warning}
<!-- COST_RESULT_END -->'''
    text = re.sub(r'<!-- COST_RESULT_START -->.*?<!-- COST_RESULT_END -->', lambda _: block, text, flags=re.S)
    block = '''<!-- PUBLICATION_RESULT_START -->
Le [précontrôle final](publication-preflight.json) lie les résultats réels au gel et aux documents finalisés. L’[index des empreintes](evidence-index.json) recense les pièces retenues, les nouvelles sources, les tests et les outils de preuve, avec toutes les tentatives WEAV. La publication privée Sites associe l’archive de l’application au commit intégral synchronisé ; son identifiant effectif de version et son commit sont portés par les métadonnées Sites, séparément des empreintes natives de ce dossier.
<!-- PUBLICATION_RESULT_END -->'''
    text = re.sub(r'<!-- PUBLICATION_RESULT_START -->.*?<!-- PUBLICATION_RESULT_END -->', lambda _: block, text, flags=re.S)
    assert 'ATTENTE' not in text
    path.write_text(text)
    print(json.dumps({'status': 'completed_from_actual_cost_receipts', 'globalCostAccepted': accepted,
                      'globalSummary': summary, 'historicalDiagnostics': aggregate['withinObservedBudget']}))

if __name__ == '__main__': main()
