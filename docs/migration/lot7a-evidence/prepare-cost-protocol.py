#!/usr/bin/env python3
"""Bind the lot7A cost protocol to completed source freezes; run no measurement.

One-shot use after baseline and final candidate manifests exist:
  python -B docs/migration/lot7a-evidence/prepare-cost-protocol.py --finalize \
    --baseline-checkout /absolute/published/checkout --baseline-site-version N \
    --candidate-version X.Y.Z

For a separate integrated freeze, also pass --output-directory and
--candidate-source-directory. The latter contains source-manifest.json and
source-archive.json; --baseline-manifest can select a newly retained baseline.

The delivery owner supplies the published Site number and separately establishes
readiness and machine isolation. This helper verifies local source identities,
copies historical input bytes, writes an immutable declaration, and invokes only
the unchanged read-only protocol checker. It never starts the cost runner.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone, timedelta
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'docs/migration/lot7a-evidence'
OUT = EVIDENCE / 'performance'
HISTORICAL = ROOT / 'docs/migration/lot3h-evidence/performance'
QUOTE = "si le global reste en dessous de 10% d'augmentation alors une phase qui dépasse 10% peut être accepté."
USER_TIMEZONE = timezone(timedelta(hours=-3))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def now(): return datetime.now(USER_TIMEZONE).isoformat()
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path): return json.loads(path.read_bytes())
def relative(path): return path.resolve().relative_to(ROOT).as_posix()
def fingerprint(path): return {'path': relative(path), 'sha256': sha(path), 'bytes': path.stat().st_size}


def write(path, value):
    with path.open('x') as stream:
        stream.write(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n')


def inventory(root):
    files = dict(sorted((p.relative_to(root).as_posix(), sha(p))
        for folder in ['src/logos-engine', 'src/runtime'] for p in (root / folder).rglob('*')
        if p.is_file() and p.suffix in ('.ts', '.json', '.drm')))
    return {'fileCount': len(files),
            'digest': hashlib.sha256(json.dumps(files, separators=(',', ':')).encode()).hexdigest(), 'files': files}


def git(root, *args):
    return subprocess.check_output(['git', *args], cwd=root, text=True).strip()


def native_version(root):
    text = (root / 'src/logos-engine/v6-native-runtime.ts').read_text()
    matches = re.findall(r"NATIVE_V6_IMPLEMENTATION\s*=\s*['\"]logos-engine\.typescript\.v6\.native-migration/([^'\"]+)['\"]", text)
    require(len(matches) == 1 and re.fullmatch(r'\d+\.\d+\.\d+', matches[0]), 'Cannot identify the native runtime version: ' + str(root))
    return matches[0]


def protocol(stamp, baseline_checkout, baseline_identity, candidate_identity, archive, tools,
             baseline_path, candidate_path, archive_path):
    a, b = baseline_identity, candidate_identity
    by_path = {item['path']: item for item in tools}
    case_rows = '\n'.join(f"| {case['id']} | {case['actions']} | {case['warmupActions']} | `{case['trace']}` | `{case['traceSha256']}` |"
                           for case in read(OUT / 'cases.json')['cases'])
    links = [Path(os.path.relpath(path, OUT)).as_posix() for path in (baseline_path, candidate_path, archive_path)]
    window_command = shlex.join(['python', '-B', 'scripts/run-native-cost-window.py', str(baseline_checkout),
                                 relative(OUT), relative(baseline_path), relative(candidate_path)])
    consolidation_command = shlex.join(['python', '-B', 'scripts/review-native-cost-consolidation.py', relative(OUT)])
    global_command = shlex.join(['python', '-B', 'scripts/review-native-global-cost-window.py',
        relative(OUT / 'combined-comparison.json'), relative(OUT / 'declaration.json'),
        relative(OUT / 'global-budget-decision.json'), '--lot', '7A', '--native-version', b['nativeVersion']])
    return f'''# Lot 7A : protocole de coût de native {b['nativeVersion']}

Déclaration finalisée le **{stamp}**, après vérification des gels et avant toute fenêtre officielle de ce lot. La préparation n'exécute aucune mesure. Le [reçu de préparation](preparation.json) et la [déclaration](declaration.json) lient les identités réellement vérifiées. La readiness et l'isolation de la machine sont établies séparément par le responsable de livraison.

## Sources comparées

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence publiée à remesurer | Site **{a['siteVersion']}**, native **{a['nativeVersion']}**, commit `{a['commit']}`, {a['nativeFiles']} fichiers | `{a['nativeDigest']}` |
| B : candidat gelé | Native **{b['nativeVersion']}**, {b['nativeFiles']} fichiers, archive de {len(archive['files'])} fichiers | `{b['nativeDigest']}` |

A utilise `{baseline_checkout}` ; B utilise `{ROOT}`. L'[inventaire A]({links[0]}), l'[inventaire B]({links[1]}) et l'[archive B]({links[2]}) sont vérifiés sur leurs octets. Le commit d'ascendance de l'archive B est `{b['sourceBaseCommit']}` ; le HEAD local relevé est `{b['checkoutHead']}`. Lorsque des sources natives ne sont pas encore commitées, le digest et l'archive identifient le candidat : ce HEAD ne devient pas artificiellement le commit de ces modifications. Le numéro de Site A est fourni par le responsable ; ce helper ne consulte pas l'hébergement.

Les [cas](cases.json) et la [politique diagnostique de phases](comparison-policy.json) sont copiés **octet pour octet** depuis `lot3h-evidence/performance`. Empreintes : `{sha(OUT / 'cases.json')}` et `{sha(OUT / 'comparison-policy.json')}`. Leur texte historique conserve sa provenance ; les identités de cette fenêtre sont celles de la présente déclaration. Les anciens temps ne sont pas réutilisés.

| Jeu | Actions par session mesurée | Actions de chauffe | Trace publique | SHA-256 |
| --- | ---: | ---: | --- | --- |
{case_rows}

Le moteur recalcule chaque commande avant de recevoir son retour enregistré. Aucun état appris ni trajet ne préinitialise la décision. Ces parcours mesurent le chemin commun ; ils n'établissent pas la contribution propre de l'atelier et ne fournissent pas une mesure du moteur de jeu, du réseau de production ou du rendu navigateur.

## Effectifs et ordre fixés

| Ordre | Série | Version | Sessions mesurées par jeu |
| --- | --- | --- | ---: |
| 1 | A1, cohorte 1 | Référence {a['nativeVersion']} | 4 |
| 2 | B1, cohorte 1 | Candidat {b['nativeVersion']} | 4 |
| 3 | B2, cohorte 2 | Même candidat gelé | 4 |
| 4 | A2, cohorte 2 | Même référence publiée | 4 |

Chaque série exécute STCK puis SMLP avec un worker distinct par jeu. La chauffe séparée comprend trois actions ; chaque session mesurée commence avec un runtime neuf et une mémoire froide. Le processus et le JIT sont conservés au sein du cas/série. La cible déclarée de trois niveaux ne transforme pas les dix actions STCK en trois niveaux effectivement terminés.

La fenêtre conserve **32 sessions mesurées et 400 actions**, soit huit sessions par jeu/version. Seules **8 chauffes et leurs 24 actions** sont exclues. Aucune session mesurée, valeur extrême ou cohorte n'est supprimée. Les quatre séries sont conservées indépendamment du verdict intermédiaire. Aucun choix de cohorte favorable, aucune marge de bruit et aucune réécriture d'une fenêtre défavorable ne sont permis. Un incident conserve ses sorties ; une correction de source exige un nouveau gel et une déclaration distincte.

## Critère global et phases

L'autorisation utilisateur retenue est : « {QUOTE} » La [politique globale](global-budget-policy.json) fixe son interprétation avant la mesure.

Pour **chaque jeu séparément**, réunir les huit durées complètes A et les huit durées B de `session_elapsed`, puis calculer `médiane(B) / médiane(A) − 1`. L'acceptation exige une hausse **strictement inférieure à +10 % pour les deux jeux**. Une égalité à +10 % échoue. Un jeu ne compense pas un autre, les ratios de cohorte ne sont pas moyennés et les phases imbriquées ne sont jamais additionnées.

Un dépassement de phase peut être accepté lorsque ce critère global est satisfait. Il reste visible, avec tous les diagnostics de cohorte, effectifs, dispersions et p95 disponibles. Le comparateur historique de phases conserve ses statuts, y compris `budget_review_required`, et ses seize diagnostics. La décision globale est un reçu distinct ; elle ne modifie aucun résultat de phase.

| Mesure | Portée | Rôle |
| --- | --- | --- |
| `session_elapsed` | Session complète de rejeu par le contrôleur | Critère global par jeu |
| `new_decision` | Appel `plan` | Diagnostic |
| `known_prefix_service` | Service `advance` retournant une action du préfixe | Diagnostic |
| `known_prefix_request` | Même requête, transport worker et ordonnancement inclus | Diagnostic |
| `known_prefix_guard` | Appel `authorize` à un index supérieur à zéro | Diagnostic |
| `acquisition_and_persistence` | Appel `seal` | Diagnostic |
| `persistence` | Appel `persistFamilies` | Diagnostic |
| `restoration` | Appel `restoreFamilies` | Diagnostic |

La médiane est centrale, ou la moyenne des deux valeurs centrales. Le p95 utilise le rang empirique `ceil(0.95 × n)` lorsque `n ≥ 20`. Aucun p95 n'est annoncé pour huit durées de session. Les observations d'une même session sont corrélées ; leur dispersion est descriptive et n'ajoute ni intervalle de confiance ni tolérance d'acceptation. L'inspection, la Pause et la mémoire restent consignées séparément.

## Intégrité, outils et conditions de lancement

Les cinq outils historiques de fenêtre, mesure, comparaison et consolidation, ainsi que les deux outils globaux, sont inchangés. Leurs empreintes sont comparées à la déclaration conservée de 3H. Le protocole engage explicitement les empreintes suivantes :

| Entrée | SHA-256 |
| --- | --- |
| Politique globale | `{sha(OUT / 'global-budget-policy.json')}` |
| `review-native-global-cost-window.py` | `{by_path['scripts/review-native-global-cost-window.py']['sha256']}` |
| `review-native-global-cost-budget.py` | `{by_path['scripts/review-native-global-cost-budget.py']['sha256']}` |

Le runner vérifie les inventaires, les traces, les déclarations source et les outils avant chaque série et à la fin. Le registre de sessions est comparé avec multiplicité préservée ; l'ordre A1/B1/B2/A2 est contrôlé séparément. Les sorties existantes ne sont pas écrasées.

**Conditions à établir par le responsable avant lancement :** finir les tests, exports, builds, campagnes, rejeux, profils, archives et contrôles navigateur ; arrêter le preview ; vérifier l'absence de campagne concurrente des autres fils ; lier les preuves et les réserves réelles au gel final dans `readiness.json`. Ces conditions ne sont pas déclarées satisfaites par le présent helper. Durant les quatre séries, seules les lectures légères et la documentation sont compatibles avec la fenêtre isolée ; les sources, tests, outils, cas et politiques restent immuables.

Les preuves de composant, de boucle commune, de contribution effective, de restauration et d'intégrité restent distinctes du verdict de coût. Un blocage de jeu ou une réserve de parité doit demeurer explicite dans la readiness. Aucun succès, délai de Pause, état de publication ou résultat de campagne n'est anticipé ici.

## Commandes à exécuter par le responsable

Après readiness et isolation constatées, lancer le runner conservé :

```bash
{window_command}
```

Après les quatre séries, exécuter les comparateurs historiques sur les deux cohortes puis sur leur agrégat. Conserver leurs statuts diagnostiques, puis produire les revues :

```bash
{consolidation_command}
{global_command}
```

Après conservation des reçus de readiness, contrôle statique et transport des journaux, `write-cost-results.py` rend les résultats sans lancer de mesure ni choisir d'échantillon.
'''


def main():
    global OUT
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline-checkout', type=Path, required=True)
    parser.add_argument('--baseline-site-version', type=int, required=True)
    parser.add_argument('--candidate-version', required=True)
    parser.add_argument('--output-directory', type=Path, default=OUT,
                        help='New protocol directory inside lot7a-evidence; relative paths start at the checkout root.')
    parser.add_argument('--candidate-source-directory', type=Path, default=EVIDENCE / 'final',
                        help='Frozen candidate directory containing source-manifest.json and source-archive.json.')
    parser.add_argument('--baseline-manifest', type=Path, default=EVIDENCE / 'baseline/source-manifest.json',
                        help='Retained baseline manifest inside this checkout.')
    parser.add_argument('--finalize', action='store_true', help='Finalize only after the retained source manifests and archive exist.')
    args = parser.parse_args()
    require(args.finalize, 'This is a one-shot finalizer; pass --finalize after freezing both source identities')
    require(args.baseline_site_version > 0, 'A positive published Site version is required')
    OUT = (ROOT / args.output_directory).resolve()
    require(OUT.is_relative_to(EVIDENCE.resolve()), 'Protocol outputs must stay inside lot7a-evidence')
    baseline_checkout = args.baseline_checkout.resolve()
    require(baseline_checkout != ROOT, 'Baseline and candidate must use different checkouts')
    baseline_path = (ROOT / args.baseline_manifest).resolve()
    candidate_directory = (ROOT / args.candidate_source_directory).resolve()
    candidate_path, archive_path = candidate_directory / 'source-manifest.json', candidate_directory / 'source-archive.json'
    require(all(path.is_relative_to(ROOT) for path in (baseline_path, candidate_path, archive_path)),
            'Retained source manifests must be inside this checkout')
    require(all(path.is_file() for path in [baseline_path, candidate_path, archive_path]), 'Complete baseline and final candidate manifests/archive are required')
    require(not (OUT / 'window.json').exists(), 'A window already exists; no protocol edit is permitted')
    outputs = ['protocol.md', 'global-budget-policy.json', 'declaration.json', 'protocol-check.json', 'preparation.json']
    require(all(not (OUT / name).exists() for name in outputs), 'Final protocol outputs already exist; refusing overwrite')
    require(not any(OUT.glob('cohort*/*.json')) and not any(OUT.glob('cohort*/*.log*')), 'Measured outputs already exist')
    baseline, candidate, archive = read(baseline_path), read(candidate_path), read(archive_path)
    require(baseline == inventory(baseline_checkout), 'Baseline checkout differs from its retained manifest')
    require(candidate == inventory(ROOT), 'Candidate checkout differs from its final source freeze')
    require(baseline['digest'] != candidate['digest'], 'Baseline and candidate must identify different source bytes')
    baseline_commit, candidate_head = git(baseline_checkout, 'rev-parse', 'HEAD'), git(ROOT, 'rev-parse', 'HEAD')
    baseline_status = git(baseline_checkout, 'status', '--porcelain=v1', '--untracked-files=all', '--', 'src/logos-engine', 'src/runtime')
    require(not baseline_status, 'The published baseline native source must match its Git commit')
    baseline_version, candidate_version = native_version(baseline_checkout), native_version(ROOT)
    require(candidate_version == args.candidate_version, 'Candidate runtime version differs from --candidate-version')
    require(archive['nativeSourceManifestDigest'] == candidate['digest'], 'Candidate archive binds a different native freeze')
    require(re.fullmatch(r'[0-9a-f]{40}', archive['baseCommit']), 'Archive must retain its exact Git base commit')
    for path, digest in archive['files'].items():
        native_path = (ROOT / path).resolve(); native_path.relative_to(ROOT)
        require(sha(native_path) == digest, 'Candidate archive input changed: ' + path)
    previous = read(HISTORICAL / 'declaration.json')
    retained = previous['officialTools'] + [previous['globalDecisionTool'], previous['globalCalculationTool']]
    require(len(previous['officialTools']) == 5 and len({item['path'] for item in retained}) == 7, 'Unexpected retained tool inventory')
    for item in retained:
        require(fingerprint(ROOT / item['path']) == item, 'Retained tool changed: ' + item['path'])
    for item in previous['officialTools']:
        require(sha(baseline_checkout / item['path']) == item['sha256'], 'Published baseline tool differs: ' + item['path'])
    for name in ('cases.json', 'comparison-policy.json'):
        require(fingerprint(HISTORICAL / name) == previous['cases' if name == 'cases.json' else 'diagnosticComparisonPolicy'], 'Historical input fingerprint changed')
        if (OUT / name).exists(): require((OUT / name).read_bytes() == (HISTORICAL / name).read_bytes(), 'Prepared input differs: ' + name)
    cases = read(HISTORICAL / 'cases.json')
    require(cases['rounds'] == 4 and [case['id'] for case in cases['cases']] == ['STCK', 'SMLP']
            and [case['actions'] for case in cases['cases']] == [10, 15]
            and all(case['warmupActions'] == 3 for case in cases['cases']), 'Historical case protocol changed')
    for case in cases['cases']:
        for checkout in (baseline_checkout, ROOT): require(sha(checkout / case['trace']) == case['traceSha256'], 'Public trace changed: ' + case['id'])
    candidate_status = git(ROOT, 'status', '--porcelain=v1', '--untracked-files=all', '--', 'src/logos-engine', 'src/runtime')
    a = {'nativeVersion': baseline_version, 'siteVersion': args.baseline_site_version, 'commit': baseline_commit,
         'nativeDigest': baseline['digest'], 'nativeFiles': baseline['fileCount']}
    b = {'nativeVersion': candidate_version, 'nativeDigest': candidate['digest'], 'nativeFiles': candidate['fileCount'],
         'sourceBaseCommit': archive['baseCommit'], 'checkoutHead': candidate_head,
         'nativeSourceCommit': None if candidate_status else candidate_head,
         'nativeWorktreeChanges': candidate_status.splitlines(), 'siteVersion': None,
         'qualification': 'The frozen digest and archive identify candidate bytes. A null source commit means the checkout HEAD is ancestry only. No candidate publication is asserted.'}
    stamp = now()
    OUT.mkdir(parents=True, exist_ok=True)
    for name in ('cases.json', 'comparison-policy.json'):
        if not (OUT / name).exists():
            with (OUT / name).open('xb') as stream: stream.write((HISTORICAL / name).read_bytes())
    write(OUT / 'preparation.json', {'schema': 'logos-engine.native-cost-protocol-preparation.v1', 'preparedAt': stamp,
        'status': 'source_freezes_verified_not_functional_readiness', 'measurementExecuted': False,
        'baselineCheckout': str(baseline_checkout), 'candidateCheckout': str(ROOT), 'baseline': a, 'candidate': b,
        'outputDirectory': relative(OUT), 'candidateSourceDirectory': relative(candidate_directory),
        'baselineManifest': fingerprint(baseline_path), 'candidateManifest': fingerprint(candidate_path),
        'candidateArchiveManifest': fingerprint(archive_path), 'retainedTools': retained,
        'qualification': 'Local source identities verified. No tests, builds, game, browser, benchmark, readiness or isolation claims are produced.'})
    write(OUT / 'global-budget-policy.json', {'schema': 'logos-engine.native-global-cost-policy.v1', 'declaredAt': stamp,
        'authorization': {'source': 'explicit lot7A user instructions before the official window', 'date': '2026-11-10', 'verbatim': QUOTE},
        'globalStage': 'session_elapsed', 'statistic': 'pooled median of complete measured-session durations per tested case',
        'caseIds': ['STCK', 'SMLP'], 'relativeIncreaseLimit': 0.1, 'comparison': 'strictly_less_than',
        'allCasesMustPass': True, 'crossCaseCompensation': False, 'phaseOverrunsMayBeAccepted': True,
        'phasesAndP95RemainVisible': True, 'diagnosticPhasePolicy': relative(OUT / 'comparison-policy.json'),
        'plannedOrder': ['A1', 'B1', 'B2', 'A2'], 'cohorts': 2, 'sessionsPerCaseVersionCohort': 4,
        'measuredSessions': 32, 'measuredActions': 400, 'excludedWarmupSessions': 8, 'excludedWarmupActions': 24,
        'excludedMeasuredSessions': 0, 'excludedOutliers': 0, 'baseline': a, 'candidate': b,
        'qualification': 'Declared before a new lot7A official window on exact retained source freezes. Each game must independently remain strictly below +10% complete-session median increase. All measured samples, phase results and available p95 remain. Readiness, isolation and functional evidence are separate.'})
    with (OUT / 'protocol.md').open('x') as stream:
        stream.write(protocol(stamp, baseline_checkout, a, b, archive, retained, baseline_path, candidate_path, archive_path))
    declaration = {'schema': 'logos-engine.native-cost-protocol-declaration.v2', 'recordedAt': stamp,
        'status': 'declared_before_official_window', 'protocol': fingerprint(OUT / 'protocol.md'),
        'cases': fingerprint(OUT / 'cases.json'), 'diagnosticComparisonPolicy': fingerprint(OUT / 'comparison-policy.json'),
        'globalBudgetPolicy': fingerprint(OUT / 'global-budget-policy.json'), 'baselineManifest': fingerprint(baseline_path),
        'candidateManifest': fingerprint(candidate_path), 'candidateArchiveManifest': fingerprint(archive_path),
        'nativeDigests': {'baseline': baseline['digest'], 'candidate': candidate['digest']},
        'officialTools': previous['officialTools'], 'globalDecisionTool': previous['globalDecisionTool'],
        'globalCalculationTool': previous['globalCalculationTool'], 'plannedOrder': ['A1', 'B1', 'B2', 'A2'], 'cohorts': 2,
        'sessionsPerCaseVersionCohort': 4, 'measuredSessions': 32, 'measuredActions': 400,
        'excludedWarmupSessions': 8, 'excludedWarmupActions': 24, 'globalBudgetCases': 2, 'diagnosticMetrics': 16,
        'relativeGlobalBudget': 0.1, 'globalComparison': 'strictly_less_than', 'phaseOverrunsBlockAcceptance': False,
        'allCasesMustPass': True, 'crossCaseCompensation': False, 'inputsByteIdenticalToHistorical': True,
        'officialToolsByteIdenticalToHistorical': True, 'noOfficialWindowAtDeclaration': True,
        'functionalReadinessNotAnticipated': True, 'finalizedAt': stamp, 'baseline': a, 'candidate': b,
        'qualification': 'This declaration binds actual baseline and candidate source identities before any official measurement. It asserts no test outcome, game success, machine isolation, publication or functional readiness.'}
    write(OUT / 'declaration.json', declaration)
    result = subprocess.run([sys.executable, '-B', 'scripts/review-native-global-cost-window.py', '--check-protocol',
                             relative(OUT / 'declaration.json')], cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        write(OUT / 'protocol-check.json', {'status': 'protocol_contract_failed', 'exitCode': result.returncode,
            'stdout': result.stdout, 'stderr': result.stderr, 'measurementExecuted': False})
        raise ValueError('The retained protocol checker failed; its output is preserved in protocol-check.json')
    checker = json.loads(result.stdout)
    require(checker['status'] == 'protocol_contract_passed' and checker['measurementExecuted'] is False, 'Unexpected retained checker result')
    with (OUT / 'protocol-check.json').open('x') as stream: stream.write(result.stdout)
    print(result.stdout.strip())


if __name__ == '__main__': main()
