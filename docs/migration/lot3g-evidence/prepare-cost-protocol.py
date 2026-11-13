#!/usr/bin/env python3
"""Prepare/finalize the declared lot3G cost protocol without running a benchmark.

Default: preserve unchanged inputs and write a preparation record plus drafts.
--finalize: require immutable candidate manifests, bind their actual digests,
           then run only the retained read-only protocol contract checker.
The delivery owner separately completes readiness and starts measurements.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone, timedelta
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[3]
BASELINE = Path('/workspace/sites/sra-published-047')
EVIDENCE = ROOT / 'docs/migration/lot3g-evidence'
OUT = EVIDENCE / 'performance'
HISTORICAL = ROOT / 'docs/migration/lot3f-evidence/performance'
BASELINE_DIGEST = '54d8742300a04dcdf0cb1b038bc62b947d4a1c60f70da4ee80e6971b0f021165'
BASELINE_COMMIT = '08bc35e447d17530a774c146ce4e660b1ef29d9a'
QUOTE = "si le global reste en dessous de 10% d'augmentation alors une phase qui dépasse 10% peut être accepté."


def now(): return datetime.now(timezone(timedelta(hours=-3))).isoformat()
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path): return json.loads(path.read_text())
def relative(path): return path.relative_to(ROOT).as_posix()
def fingerprint(path): return {'path': relative(path), 'sha256': sha(path), 'bytes': path.stat().st_size}
def write(path, value, exclusive=False):
    with path.open('x' if exclusive else 'w') as stream:
        stream.write(json.dumps(value, indent=2, ensure_ascii=False) + '\n')
def require(condition, message):
    if not condition: raise ValueError(message)
def inventory(root):
    files = dict(sorted((p.relative_to(root).as_posix(), sha(p))
        for folder in ['src/logos-engine', 'src/runtime'] for p in (root / folder).rglob('*')
        if p.is_file() and p.suffix in ('.ts', '.json', '.drm')))
    return {'fileCount': len(files), 'digest': hashlib.sha256(json.dumps(files, separators=(',', ':')).encode()).hexdigest(), 'files': files}


def verify_inputs():
    baseline = read(EVIDENCE / 'baseline/source-manifest.json')
    require(baseline == inventory(BASELINE), 'Actual published baseline differs from its manifest')
    require(baseline['digest'] == BASELINE_DIGEST and baseline['fileCount'] == 263, 'Unexpected baseline identity')
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=BASELINE, text=True).strip()
    require(commit == BASELINE_COMMIT, 'Baseline is not the published Site75 commit')
    previous = read(HISTORICAL / 'declaration.json')
    retained = previous['officialTools'] + [previous['globalDecisionTool'], previous['globalCalculationTool']]
    for record in retained:
        require(fingerprint(ROOT / record['path']) == record, 'Retained tool changed: ' + record['path'])
    for name in ('cases.json', 'comparison-policy.json'):
        if (OUT / name).exists(): require((OUT / name).read_bytes() == (HISTORICAL / name).read_bytes(), 'Prepared input differs: ' + name)
        else: (OUT / name).write_bytes((HISTORICAL / name).read_bytes())
    cases = read(OUT / 'cases.json')
    require(cases['rounds'] == 4 and [c['id'] for c in cases['cases']] == ['STCK', 'SMLP'], 'Historical cases differ')
    for case in cases['cases']:
        for checkout in (BASELINE, ROOT): require(sha(checkout / case['trace']) == case['traceSha256'], 'Public trace changed: ' + case['id'])
    return baseline, retained


def policy(prepared, candidate=None):
    return {
        'schema': 'logos-engine.native-global-cost-policy.v1', 'declaredAt': prepared,
        'authorization': {'source': 'explicit user message before the lot 3G official window', 'date': '2026-11-10', 'verbatim': QUOTE},
        'globalStage': 'session_elapsed', 'statistic': 'pooled median of complete measured-session durations per tested case',
        'caseIds': ['STCK', 'SMLP'], 'relativeIncreaseLimit': 0.1, 'comparison': 'strictly_less_than',
        'allCasesMustPass': True, 'crossCaseCompensation': False, 'phaseOverrunsMayBeAccepted': True,
        'phasesAndP95RemainVisible': True, 'diagnosticPhasePolicy': relative(OUT / 'comparison-policy.json'),
        'plannedOrder': ['A1', 'B1', 'B2', 'A2'], 'cohorts': 2, 'sessionsPerCaseVersionCohort': 4,
        'measuredSessions': 32, 'measuredActions': 400, 'excludedWarmupSessions': 8, 'excludedWarmupActions': 24,
        'excludedMeasuredSessions': 0, 'excludedOutliers': 0,
        'baseline': {'nativeVersion': '0.47.0', 'siteVersion': 75, 'commit': BASELINE_COMMIT,
                     'nativeDigest': BASELINE_DIGEST, 'nativeFiles': 263},
        'candidate': {'nativeVersion': '0.48.0', 'nativeDigest': candidate['digest'] if candidate else None,
                      'nativeFiles': candidate['fileCount'] if candidate else None},
        'qualification': ('Declared before the new lot3G official window against freshly measured published0.47 from Site75. '
            + ('Native0.48 is frozen and identified by its manifest. ' if candidate else 'Preparation only: candidate freeze is pending and no measurement is permitted by this draft. ')
            + 'Global means the complete session separately for each case, not a sum of nested phases or compensation across games. '
            'Every measured session, phase result and available p95 remains visible; functional, integration and contribution evidence are separate. '
            'Historical timing data and comparators remain unchanged.')}


def protocol(prepared, retained, candidate=None, archive=None, finalized=None):
    identities = ('Native **0.48.0**, digest `' + candidate['digest'] + '` ; **' + str(candidate['fileCount'])
                  + ' fichiers natifs**, archive de **' + str(len(archive['files'])) + ' fichiers**') if candidate else 'Native **0.48.0 en préparation** ; digest et archive non encore gelés'
    status = ('Finalisé le **' + finalized + '** après le gel candidat et avant toute mesure officielle. La [déclaration](declaration.json) lie les identités et empreintes.') if finalized else 'Ce document est préparatoire. Le gel candidat, la déclaration finale et la readiness ne sont pas encore acquis ; aucune mesure ne doit être lancée sur ce brouillon.'
    tool_by_path = {r['path']: r for r in retained}
    return f'''# Lot 3G : protocole de coût 0.48 sous le critère global autorisé

Préparé le **{prepared}**. {status} Le reçu [preparation.json](preparation.json) conserve le premier état daté. La préparation et la finalisation ne lancent aucun benchmark.

## Sources et périmètre

Comparer **native 0.48.0**, qui transfère la couche générique FramedWindow et ses contrats consommés, à **Site 75 / native 0.47.0 remesurée dans cette fenêtre**. Les temps historiques de 0.47 ne fournissent aucun échantillon au nouveau bilan. Les sources V5/V6 originales et les preuves historiques sont conservées.

| Rôle | Identité | Inventaire |
| --- | --- | --- |
| A : référence publiée | Site 75 / native 0.47.0 ; commit `{BASELINE_COMMIT}` ; digest `{BASELINE_DIGEST}` | 263 fichiers natifs |
| B : candidat | {identities} | [Inventaire B](../final/source-manifest.json), [archive B](../final/source-archive.json) |

A s’exécute dans `/workspace/sites/sra-published-047`, B dans `/workspace/sites/sra-playground-step3d/.sites-checkout`. L’[inventaire A](../baseline/source-manifest.json) est vérifié sur le véritable checkout publié. Aucun digest provisoire n’est assimilé à un gel.

Les [cas](cases.json) et la [politique de phases](comparison-policy.json) sont des copies exactes de `lot3f-evidence/performance`. SHA-256 : `{sha(OUT / 'cases.json')}` et `{sha(OUT / 'comparison-policy.json')}`. Leur texte historique conserve sa provenance ; les identités A/B courantes sont celles du présent protocole et de la politique globale.

Les retours publics restent inchangés :

- STCK : dix actions par session, `docs/migration/native-campaigns-v39/stck-public-trace.json.gz`, SHA-256 `4610327ca5c6b67e3a42983cc55b40eab3d5aa858a185d8e81f753ba2bcb7e6b`.
- SMLP : quinze actions par session, `docs/migration/native-campaigns-v57/final/smlp-public-trace.json.gz`, SHA-256 `325ff611d1f80d0c07ce2c4ee8af707297a918d505db607c35cf411db9753de9`.

Le moteur recalcule chaque commande avant de recevoir son retour enregistré. Ni état appris ni trajet ne préinitialisent les décisions. Ces deux parcours mesurent la boucle commune et ne démontrent pas une contribution propre de FramedWindow.

## Effectifs, ordre et conservation

| Ordre | Série | Version | Sessions mesurées par jeu |
| --- | --- | --- | ---: |
| 1 | A1, cohorte 1 | 0.47.0 publiée | 4 |
| 2 | B1, cohorte 1 | 0.48.0 gelée | 4 |
| 3 | B2, cohorte 2 | Même 0.48.0 gelée | 4 |
| 4 | A2, cohorte 2 | Même 0.47.0 publiée | 4 |

Chaque série exécute STCK puis SMLP. Chaque cas/série commence par une chauffe distincte de trois actions et utilise un worker distinct. Les quatre sessions mesurées ont chacune un runtime neuf à mémoire froide ; le processus et le JIT restent présents au sein du cas/série. Le paramètre `targetLevels: 3` ne signifie pas que STCK résout trois niveaux en dix actions.

Total : **huit sessions par jeu/version, 32 sessions mesurées et 400 actions**. Seules **huit chauffes, soit 24 actions**, sont exclues. Aucune session mesurée, cohorte ni valeur extrême n’est supprimée. Les deux cohortes sont terminées indépendamment du premier verdict. Aucun résultat favorable n’est sélectionné après coup et aucune tolérance de bruit n’est ajoutée. Une nouvelle fenêtre ne remplace pas les résultats du même gel ; tout incident et ses sorties restent conservés. Une correction matérielle impose un nouveau gel et un protocole distinct.

## Critère global et diagnostics

L’autorisation courante est : « {QUOTE} » Elle est fixée avant mesure dans la [politique globale](global-budget-policy.json).

**Global** désigne `session_elapsed`, la durée complète du rejeu par le contrôleur. Pour chaque jeu séparément, réunir les huit durées A et les huit durées B, puis calculer `médiane(B) / médiane(A) − 1`. Le coût est accepté si **les deux augmentations sont strictement inférieures à +10 %**. Une valeur exactement égale à +10 % échoue. Aucune compensation entre jeux ; aucune somme de phases imbriquées ; aucune moyenne des ratios de cohorte.

Un dépassement de phase est acceptable sous ce critère global, tout en restant visible avec effectif, dispersion et p95 disponible. Le comparateur historique conserve son statut diagnostic, y compris `budget_review_required`, et son nombre de critères conformes sur seize. La décision globale est un reçu séparé qui ne réécrit aucune comparaison.

| Mesure | Définition | Rôle |
| --- | --- | --- |
| `session_elapsed` | Durée complète du rejeu par le contrôleur | Critère global par jeu |
| `new_decision` | Appel natif `plan` | Diagnostic |
| `known_prefix_service` | Service `advance` retournant une action du préfixe | Diagnostic |
| `known_prefix_request` | Même requête, transport worker et ordonnancement inclus | Diagnostic |
| `known_prefix_guard` | Appel `authorize` pour un index supérieur à zéro | Diagnostic |
| `acquisition_and_persistence` | Appel `seal` | Diagnostic |
| `persistence` | Appel `persistFamilies` | Diagnostic |
| `restoration` | Appel `restoreFamilies` | Diagnostic |

La médiane est la valeur centrale, ou la moyenne des deux valeurs centrales. Le p95 est le rang empirique `ceil(0.95 × n)` pour `n ≥ 20` uniquement. Les huit sessions par version ne permettent pas de p95 de session. Les observations d’une même session sont corrélées : la dispersion est descriptive, sans intervalle de confiance ni marge de bruit ajoutée.

## Outils, intégrité et isolation

Les cinq outils historiques restent byte-identiques : `run-native-cost-window.py`, `measure-native-loop-costs.mjs`, `compare-native-loop-costs.mjs`, `compare-native-cost-cohorts.mjs` et `review-native-cost-consolidation.py`. Les deux outils globaux conservés relisent les quatre rapports, les comparaisons de cohorte, l’agrégat et la revue arithmétique indépendante ; ils recalculent les médianes depuis chaque session et vérifient l’antériorité de la déclaration.

| Engagement | SHA-256 |
| --- | --- |
| Politique globale actuelle | `{sha(OUT / 'global-budget-policy.json')}` |
| `review-native-global-cost-window.py` | `{tool_by_path['scripts/review-native-global-cost-window.py']['sha256']}` |
| `review-native-global-cost-budget.py` | `{tool_by_path['scripts/review-native-global-cost-budget.py']['sha256']}` |

Les lignes du registre sont comparées dans un ordre canonique avec multiplicité préservée ; l’ordre A1/B1/B2/A2 est vérifié séparément. Le wrapper contrôle les inventaires, traces, déclarations source et outils avant chaque série et à la fin. Il recopie les cas, la politique de phases et ce protocole vers A sans altérer leurs octets. Il refuse de remplacer une sortie existante.

Avant lancement, le responsable lie au gel exact les contrats et tests, contrôles du projet, compilation, régressions CATR/RSWP, boucle intégrée, contribution, vérification d’interface et intégrité. Pour3G, la boucle complète est synthétique et explicitement qualifiée; aucun cas de jeu nouveau n’est choisi et la contribution propre en jeu reste ouverte dans le reçu de portée. Il conserve tout objectif non atteint et toute limitation de parité. Le coût STCK/SMLP ne clôture aucune réserve fonctionnelle.

**Tous les tests, builds, exports, campagnes, rejeux, profils et contrôles navigateur sont terminés avant la fenêtre ; le preview est arrêté.** Aucun calcul concurrent de ces catégories n’est exécuté durant les quatre séries. Seules des lectures légères et la documentation continuent. Aucun outil, source, test, cas ou politique ne change pendant la fenêtre. La [trame de readiness](readiness-template.json) est préparatoire ; seul un reçu final renseigné à partir d’éléments réellement achevés pourra autoriser le lancement.

CWSE, SK48, FOGW et VOIS gardent leurs limites et budgets cumulés antérieurs. Aucune tentative sur ces cas n’appartient à la préparation de cette fenêtre. Les fixtures et preuves de composant ne démontrent pas la réussite d’un jeu ni la parité de l’appelant original complet.

## Commandes prêtes

Après le gel candidat, finaliser la déclaration sans lancer de mesure :

```bash
python -B docs/migration/lot3g-evidence/prepare-cost-protocol.py --finalize
```

Après readiness et isolation réelles, le responsable peut lancer :

```bash
python -B scripts/run-native-cost-window.py /workspace/sites/sra-published-047 docs/migration/lot3g-evidence/performance docs/migration/lot3g-evidence/baseline/source-manifest.json docs/migration/lot3g-evidence/final/source-manifest.json
```

Après les quatre séries, produire les deux comparaisons de cohorte puis l’agrégat avec les outils conservés. Garder leurs statuts diagnostiques, puis exécuter :

```bash
python -B scripts/review-native-cost-consolidation.py docs/migration/lot3g-evidence/performance
python -B scripts/review-native-global-cost-window.py docs/migration/lot3g-evidence/performance/combined-comparison.json docs/migration/lot3g-evidence/performance/declaration.json docs/migration/lot3g-evidence/performance/global-budget-decision.json --lot 3G --native-version 0.48.0
```

Aucun résultat de coût n’est anticipé. Cette fenêtre exclut le moteur du jeu, le réseau de production et le rendu navigateur ; elle ne démontre ni une vitesse de jeu en direct ni une stabilité de plusieurs heures.
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--finalize', action='store_true')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    require(not (OUT / 'window.json').exists(), 'Official window already exists; no protocol edit allowed')
    require(not (OUT / 'declaration.json').exists(), 'Final declaration is already immutable')
    baseline, retained = verify_inputs()
    if not args.finalize:
        require(not (OUT / 'preparation.json').exists(), 'Preparation already exists; use --finalize after freeze')
        prepared = now()
        pending = ['Freeze and hash native0.48 candidate and its source archive.',
            'Finalize global policy, protocol and declaration after freeze and before every official measurement.',
            'Complete and bind actual functional, regression, campaign, contribution, browser and integrity evidence.',
            'Stop preview and all compute work; record final readiness and isolation.']
        preparation = {'schema': 'logos-engine.native-cost-protocol-preparation.v1', 'preparedAt': prepared,
            'status': 'awaiting_candidate_source_freeze', 'measurementExecuted': False,
            'baselineCheckout': str(BASELINE), 'candidateCheckout': str(ROOT),
            'baselineManifest': fingerprint(EVIDENCE / 'baseline/source-manifest.json'),
            'candidateManifestPath': relative(EVIDENCE / 'final/source-manifest.json'),
            'candidateArchiveManifestPath': relative(EVIDENCE / 'final/source-archive.json'),
            'cases': fingerprint(OUT / 'cases.json'), 'diagnosticComparisonPolicy': fingerprint(OUT / 'comparison-policy.json'),
            'retainedTools': retained, 'plannedOrder': ['A1', 'B1', 'B2', 'A2'],
            'measuredSessions': 32, 'measuredActions': 400, 'excludedWarmupSessions': 8, 'excludedWarmupActions': 24,
            'relativeGlobalBudget': 0.1, 'globalComparison': 'strictly_less_than', 'phaseOverrunsBlockAcceptance': False,
            'allCasesMustPass': True, 'crossCaseCompensation': False, 'pendingRequirements': pending,
            'qualification': 'Preparation only, not a final declaration, readiness approval, measurement or acceptance. '
                'Historical cases, diagnostic phase policy and all7retained tools are byte-identical. Actual published0.47 inventory verified; no candidate freeze asserted.'}
        write(OUT / 'preparation.json', preparation, True)
        write(OUT / 'global-budget-policy.json', policy(prepared))
        (OUT / 'protocol.md').write_text(protocol(prepared, retained))
        write(OUT / 'readiness-template.json', {
            'schema': 'logos-engine.native-cost-window-readiness-template.v1', 'preparedAt': prepared,
            'status': 'template_not_ready', 'measurementAuthorized': False, 'inputs': [],
            'requiredEvidence': ['final exact-source test receipt', 'final checks/build receipt', 'CATR/RSWP regression receipt',
                'source fixture and integrated contribution receipts', 'actual campaign resolution and cumulative clock',
                'browser QA including Pause/step/resume', 'candidate source/build integrity',
                'final declaration, policy, protocol and static preflight'],
            'pendingRequirements': pending, 'qualification': 'Owner must create readiness.json from completed evidence; this template authorizes no measurement.'}, True)
        print(json.dumps({'status': preparation['status'], 'measurementExecuted': False,
                          'preparedAt': prepared, 'output': relative(OUT), 'baselineDigest': baseline['digest']}))
        return
    preparation = read(OUT / 'preparation.json'); prepared = preparation['preparedAt']
    candidate_path = EVIDENCE / 'final/source-manifest.json'; archive_path = EVIDENCE / 'final/source-archive.json'
    candidate, archive = read(candidate_path), read(archive_path)
    require(candidate == inventory(ROOT), 'Frozen candidate differs from actual native source')
    require(candidate['digest'] != baseline['digest'], 'A and B must be distinct versions')
    require(archive['nativeSourceManifestDigest'] == candidate['digest'], 'Archive binds another native freeze')
    for path, digest in archive['files'].items(): require(sha(ROOT / path) == digest, 'Archive input changed: ' + path)
    finalized = now()
    write(OUT / 'global-budget-policy.json', policy(prepared, candidate))
    (OUT / 'protocol.md').write_text(protocol(prepared, retained, candidate, archive, finalized))
    declaration = {
        'schema': 'logos-engine.native-cost-protocol-declaration.v2', 'recordedAt': finalized,
        'status': 'declared_before_official_window',
        'protocol': fingerprint(OUT / 'protocol.md'), 'cases': fingerprint(OUT / 'cases.json'),
        'diagnosticComparisonPolicy': fingerprint(OUT / 'comparison-policy.json'),
        'globalBudgetPolicy': fingerprint(OUT / 'global-budget-policy.json'),
        'baselineManifest': fingerprint(EVIDENCE / 'baseline/source-manifest.json'),
        'candidateManifest': fingerprint(candidate_path), 'candidateArchiveManifest': fingerprint(archive_path),
        'nativeDigests': {'baseline': baseline['digest'], 'candidate': candidate['digest']},
        'officialTools': retained[:5], 'plannedOrder': ['A1', 'B1', 'B2', 'A2'], 'cohorts': 2,
        'sessionsPerCaseVersionCohort': 4, 'measuredSessions': 32, 'measuredActions': 400,
        'excludedWarmupSessions': 8, 'excludedWarmupActions': 24, 'globalBudgetCases': 2, 'diagnosticMetrics': 16,
        'relativeGlobalBudget': 0.1, 'globalComparison': 'strictly_less_than', 'phaseOverrunsBlockAcceptance': False,
        'allCasesMustPass': True, 'crossCaseCompensation': False, 'inputsByteIdenticalToHistorical': True,
        'officialToolsByteIdenticalToHistorical': True, 'noOfficialWindowAtDeclaration': True,
        'functionalReadinessNotAnticipated': True, 'finalizedAt': finalized,
        'globalDecisionTool': retained[5], 'globalCalculationTool': retained[6],
        'qualification': 'Policy for native0.48 declared before its official window against freshly measured published0.47 from Site75. '
            'All measured sessions, phase overruns and available p95 remain. Preparation/finalization executed no benchmark. '
            'Actual functional evidence and isolation are separate prerequisites, not asserted by this declaration.'}
    write(OUT / 'declaration.json', declaration, True)
    result = subprocess.run(['python', '-B', 'scripts/review-native-global-cost-window.py', '--check-protocol',
                             relative(OUT / 'declaration.json')], cwd=ROOT, text=True, capture_output=True)
    require(result.returncode == 0, 'Retained protocol checker failed: ' + result.stderr)
    (OUT / 'protocol-check.json').write_text(result.stdout)
    print(result.stdout.strip())


if __name__ == '__main__': main()
