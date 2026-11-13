# Lot 7B : ordre exact des preuves de coût et de publication

Ce guide décrit la future fenêtre du candidat intégré après les publications
réelles 5A puis 4B. Il ne constitue ni une autorisation de mesure ni un résultat.
Les versions, commits, tests, empreintes et formes structurelles sont lus dans
les preuves effectivement produites. Aucun résultat 7A n'est réutilisé.

Les neuf outils de préparation/analyse ont un contrôle de syntaxe conservé dans
`diagnostic/cost-tools-syntax-01.json`. Le retrait ultérieur d'une exclusion
lexicale de dossier dans le consolidateur, le nouveau transport et le nouveau
contrôle de publication ont leur contrôle séparé. Aucun de ces contrôles de
syntaxe n'exécute le moteur ni une mesure.

## 1. Préconditions et chemins choisis

La référence A doit être le prédécesseur **effectivement publié** après 5A et
4B, dans un checkout distinct. Son reçu doit déjà porter le schéma
`logos-engine.lot7b-published-baseline.v1`, `status: verified`,
`deploymentStatus: succeeded`, le vrai projet, Site, commit, numéro natif et
digest. Les deux manifestes, l'archive candidate et ses parties doivent exister.
La candidate a ses tests formels, cinq checks, régressions, intégrité, parité
Python d'origine, navigateur et horloge CRAF réellement terminés avant readiness.

Les commandes suivantes se lancent depuis le checkout 7B. Les deux variables
de reçus fonctionnels et le checkout baseline désignent des fichiers/répertoires
déjà vérifiés ; elles ne désignent pas des résultats à inventer.

```bash
cd /workspace/sites/sra-lot7b-20261110/.sites-checkout
set -euo pipefail
set -o noclobber

LOT7B_EVIDENCE=docs/migration/lot7b-evidence
LOT7B_PERF="$LOT7B_EVIDENCE/performance-integrated"
LOT7B_FINAL="$LOT7B_EVIDENCE/integrated-final"
LOT7B_BASE_MANIFEST="$LOT7B_EVIDENCE/baseline-integrated/source-manifest.json"
LOT7B_BASELINE_PUBLICATION="$LOT7B_EVIDENCE/coordination/published-base-binding.json"
LOT7B_SCOPE="$LOT7B_EVIDENCE/coordination/integrated-test-scope-plan.json"

: "${LOT7B_BASELINE_CHECKOUT:?Renseigner le checkout du prédécesseur réellement publié}"
: "${LOT7B_PARITY_RECEIPT:?Renseigner le reçu de parité Python du gel intégré final}"
: "${LOT7B_BROWSER_RECEIPT:?Renseigner le reçu navigateur du même gel}"

LOT7B_SITE_VERSION="$(python -B - "$LOT7B_BASELINE_PUBLICATION" <<'PY'
import json, sys
from pathlib import Path
value = json.loads(Path(sys.argv[1]).read_bytes())
assert value['schema'] == 'logos-engine.lot7b-published-baseline.v1'
assert value['status'] == 'verified' and value['deploymentStatus'] == 'succeeded'
assert type(value['siteVersion']) is int and value['siteVersion'] > 0
print(value['siteVersion'])
PY
)"
LOT7B_CANDIDATE_VERSION="$(python -B - <<'PY'
from pathlib import Path
import re
text = Path('src/logos-engine/v6-native-runtime.ts').read_text()
matches = re.findall(r"NATIVE_V6_IMPLEMENTATION\s*=\s*['\"]logos-engine\.typescript\.v6\.native-migration/([^'\"]+)['\"]", text)
assert len(matches) == 1 and re.fullmatch(r'\d+\.\d+\.\d+', matches[0])
print(matches[0])
PY
)"
```

Si les gels réels utilisent d'autres noms, changer les variables avant toute
préparation et conserver ces mêmes chemins jusqu'à la publication. Les options
ci-dessous fixent explicitement le dossier candidat : le défaut historique
`final` de `prepare-cost-protocol.py` n'est pas utilisé ici. La fenêtre choisie
est `performance-integrated`. Les lecteurs acceptent un autre sous-dossier
déclaré de `lot7b-evidence` ; ils ne réutilisent ni une sortie ni une fenêtre
existante.

## 2. Déclaration du protocole, sans contrat encore créé

```bash
python -B "$LOT7B_EVIDENCE/prepare-cost-protocol.py" \
  --finalize --owner-cost-qualification \
  --baseline-checkout "$LOT7B_BASELINE_CHECKOUT" \
  --baseline-site-version "$LOT7B_SITE_VERSION" \
  --candidate-version "$LOT7B_CANDIDATE_VERSION" \
  --output-directory "$LOT7B_PERF" \
  --baseline-manifest "$LOT7B_BASE_MANIFEST" \
  --candidate-source-directory "$LOT7B_FINAL"
```

Cette commande vérifie les gels réels, les outils historiques et les traces.
Elle conserve `preparation.json`, `protocol.md`, `global-budget-policy.json`,
`declaration.json`, `protocol-check.json`, ainsi que les copies exactes des
`cases.json` et `comparison-policy.json` historiques. Elle annonce le chemin
du futur contrat et les empreintes des deux analyseurs 7B. **`--finalize` ne
crée ni le contrat structurel, ni `static-preflight.json`, ni `readiness.json`.**

Cette préparation peut précéder les captures : le captureur refuse une fenêtre
ou une readiness existante, mais accepte la déclaration. Cet ordre permet
d'utiliser directement ses cas copiés sans construire une autre version du cas.

## 3. Inventaire et captures fonctionnelles avant coût

Ces commandes exécutent les fabriques ou le runtime. Elles demandent donc le
créneau fonctionnel autorisé, avant toute fenêtre officielle de coût.

```bash
node "$LOT7B_EVIDENCE/record-owner-source-inventory.mjs" \
  "$LOT7B_BASELINE_CHECKOUT" "$LOT7B_PERF/owner-source-inventory.json"

node "$LOT7B_EVIDENCE/capture-cost-owner-graphs.mjs" \
  baseline "$LOT7B_BASELINE_CHECKOUT" "$LOT7B_PERF/cases.json" \
  "$LOT7B_BASE_MANIFEST" "$LOT7B_PERF/owner-graphs-baseline.json.gz"

node "$LOT7B_EVIDENCE/capture-cost-owner-graphs.mjs" \
  candidate "$PWD" "$LOT7B_PERF/cases.json" \
  "$LOT7B_FINAL/source-manifest.json" "$LOT7B_PERF/owner-graphs-candidate.json.gz"

node "$LOT7B_EVIDENCE/qualify-cost-owner-graphs.mjs" \
  "$LOT7B_PERF/owner-graphs-baseline.json.gz" \
  "$LOT7B_PERF/owner-graphs-baseline.receipt.json" \
  "$LOT7B_PERF/owner-graphs-candidate.json.gz" \
  "$LOT7B_PERF/owner-graphs-candidate.receipt.json" \
  "$LOT7B_PERF/owner-structural-attribution.json" \
  "$LOT7B_PERF/owner-structural-fixture.json"
```

Chaque capture comprend les quatre formes, dans l'ordre STCK chauffe/mesurée
puis SMLP chauffe/mesurée : 3/10/3/15 actions, soit 31 actions par version.
Les formes complètes ont trois inspections terminales réelles ; les chauffes
n'en ont aucune. Ce sont des parcours fonctionnels, pas des sessions de coût.

La qualification exige l'ajout du seul propriétaire
`public_symbol_transaction` et du seul programme
`v6.symbol_transactions.choose`, puis attribue les nouveaux nœuds réels.
Symbols reçoit uniquement ses retours actifs. Aucune égalité entre son nombre
d'appels et le nombre d'actions, aucun delta constant de graphe n'est supposé.

Un refus du qualificateur reste conservé. En particulier, sa comptabilité
actuelle refuse un éventuel fragment initialement propre à B qui deviendrait
ensuite commun à A/B. Cette occurrence n'est pas démontrée pour Symbols ; les
captures du vrai prédécesseur doivent trancher **avant** contrat et mesure.
Les tolérances propres aux matrices de phases de 5A ne sont pas importées.

## 4. Création explicite du contrat à partir des fichiers réels

Aucun des neuf outils ne crée `owner-growth-contract.json`. Le bloc suivant
est la procédure de création : il lit les fichiers effectivement produits,
calcule leurs empreintes, reprend les outils annoncés dans la déclaration et
date la création réelle. Il ne construit aucune valeur de graphe ni de coût.
Il ne se lance qu'après une qualification fonctionnelle réussie.

```bash
python -B - "$LOT7B_PERF" <<'PY'
from datetime import datetime, timezone
from pathlib import Path
import hashlib, json, sys

root = Path.cwd().resolve()
perf = (root / sys.argv[1]).resolve()
base = root / 'docs/migration/lot7b-evidence'
assert perf != base and perf.is_relative_to(base)
assert not any((perf / name).exists() for name in ('window.json', 'readiness.json', 'owner-growth-contract.json'))
assert not list(perf.glob('cohort*/*.json'))

def read(path):
    return json.loads(path.read_bytes())

def fp(path):
    path = path.resolve()
    assert path.is_relative_to(root)
    data = path.read_bytes()
    return {'path': path.relative_to(root).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

def instant(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    assert result.tzinfo is not None
    return result

declaration = read(perf / 'declaration.json')
announcement = declaration['ownerCostQualification']
inventory_path = perf / 'owner-source-inventory.json'
fixture_path = perf / 'owner-structural-fixture.json'
inventory, fixture = read(inventory_path), read(fixture_path)
attribution_path = root / fixture['attribution']['path']
attribution = read(attribution_path)
output = root / announcement['contractPath']
assert output == perf / 'owner-growth-contract.json'
assert announcement['schema'] == 'logos-engine.lot7b-owner-cost-qualification.v1'
assert announcement['tools'] == {
    'consolidator': fp(base / 'consolidate-owner-costs.mjs'),
    'reviewer': fp(base / 'review-owner-costs.py')}
assert inventory['schema'] == 'logos-engine.lot7b-owner-cost-source-inventory.v1'
assert inventory['programScope'] == 'family-installed programs'
assert fixture['schema'] == 'logos-engine.lot7b-owner-cost-structural-fixture.v1'
assert attribution['schema'] == 'logos-engine.lot7b-owner-cost-structural-attribution.v1'
assert fixture['status'] == attribution['status'] == 'qualified_functional_structure'
assert fixture['nativeDigests'] == inventory['nativeDigests'] == attribution['nativeDigests'] == declaration['nativeDigests']
assert fixture['cases'] == declaration['cases'] == fp(perf / 'cases.json')
assert fixture['attribution'] == fp(attribution_path)
assert attribution['checkedCount'] == len(attribution['checks']) > 0
assert all(row['passed'] is True for row in attribution['checks'])
assert [(row['case'], row['form']) for row in fixture['forms']] == [
    ('STCK', 'warmup'), ('STCK', 'measured'), ('SMLP', 'warmup'), ('SMLP', 'measured')]
assert attribution['formsSha256'] == hashlib.sha256(json.dumps(
    fixture['forms'], sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()).hexdigest()
for key, addition in [('owners', 'public_symbol_transaction'), ('programs', 'v6.symbol_transactions.choose')]:
    a, b = inventory[key]['baseline'], inventory[key]['candidate']
    assert len(a) == len(set(a)) and len(b) == len(set(b))
    assert set(b) - set(a) == {addition} and not set(a) - set(b)
for capture in fixture['captures'].values():
    for record in capture.values():
        assert fp(root / record['path']) == record
source_paths = ['src/logos-engine/v6-native-runtime.ts', 'src/logos-engine/v6-symbol-transactions.ts',
                'src/logos-engine/v6-knowledge-store.ts']
source_evidence = [fp(root / path) for path in source_paths]
candidate = read(root / declaration['candidateManifest']['path'])
assert all(candidate['files'][record['path']] == record['sha256'] for record in source_evidence)
stamp = datetime.now(timezone.utc)
assert instant(declaration['finalizedAt']) <= stamp
assert instant(inventory['recordedAt']) <= stamp
assert instant(attribution['recordedAt']) <= instant(fixture['recordedAt']) <= stamp
contract = {
    'schema': 'logos-engine.lot7b-owner-cost-contract.v2', 'lot': '7B', 'declaredAt': stamp.isoformat(),
    'performanceDirectory': perf.relative_to(root).as_posix(), 'declaration': fp(perf / 'declaration.json'),
    'tools': announcement['tools'],
    'structuralExpectation': {
        'ownerId': 'public_symbol_transaction', 'programId': 'v6.symbol_transactions.choose',
        'installedNodeIds': ['family_state:public_symbol_transaction', 'family_activation:public_symbol_transaction',
                             'program:v6.symbol_transactions.choose'],
        'allowedPaths': ['observations[*].nodeCount', 'inspection[*].graphNodes', 'final.nodeCount', 'final.graphRevision'],
        'mode': 'predeclared_functional_fixture', 'qualification': 'functional_structure_frozen_before_measurement'},
    'sourceEvidence': source_evidence, 'ownerInventory': fp(inventory_path), 'structuralFixture': fp(fixture_path),
    'strictFailureReceipt': (perf / 'aggregation-failure.json').relative_to(root).as_posix(),
    'strictFailureLog': (perf / 'aggregation-failure.log').relative_to(root).as_posix(),
    'historicalAggregateOutput': (perf / 'combined-comparison.json').relative_to(root).as_posix(),
}
with output.open('x') as stream:
    json.dump(contract, stream, indent=2)
    stream.write('\n')
print(json.dumps({'contract': fp(output), 'measurementExecuted': False}))
PY
```

Le contrat et ses preuves doivent être relus puis committés avant la fenêtre.
Ne pas ajouter son empreinte à `declaration.json` : celle-ci annonce son chemin
et les deux outils, tandis que le contrat lie la déclaration par empreinte.
Cela évite une dépendance circulaire. Toute correction avant mesure conserve
les tentatives précédentes et exige des reçus cohérents ; aucune règle ne sera
élargie à partir des durées futures.

## 5. Préflight, isolation réelle, puis readiness

```bash
python -B "$LOT7B_EVIDENCE/check-cost-static-inputs.py" \
  --performance-directory "$LOT7B_PERF"
```

Avant la commande suivante, le responsable crée
`$LOT7B_PERF/coordinated-isolation.json` à partir des acquittements réels :
`status: acknowledged_quiet_before_window`, `otherLaneAcknowledged: true`,
`ownTrackedComputeEnded: true`, `previewStopped: true`,
`costNodeOptionsOverride: null`, et `evidence` contenant les empreintes des
preuves de coordination. Le guide ne produit pas ces affirmations à sa place.

```bash
python -B "$LOT7B_EVIDENCE/finalize-cost-readiness.py" \
  --performance-directory "$LOT7B_PERF" \
  --candidate-source-directory "$LOT7B_FINAL" \
  --validation-directory validation \
  --test-scope-plan "$LOT7B_SCOPE" \
  --baseline-publication-receipt "$LOT7B_BASELINE_PUBLICATION" \
  --parity-receipt "$LOT7B_PARITY_RECEIPT" \
  --browser-receipt "$LOT7B_BROWSER_RECEIPT" \
  --case-checkpoint "$LOT7B_EVIDENCE/craf-case-checkpoint.json"
```

Les reçus formels attendus sont `validation/delta-tests-run.json` et
`validation/checks-run.json`, produits par `scripts/verify-native-delta.py`.
Le scope `testFiles/testFileCount` et les comptes TAP sont dynamiques. Les cinq
checks sont `typecheck`, `entry-audit`, `migration-audit`, `diff-check`, `build`.
Une résolution d'audit distincte, si réellement nécessaire et conservée, peut
être liée par `--audit-receipt`. Une réserve CRAF explicitement qualifiée ne
devient pas une cible accomplie.

## 6. Fenêtre officielle autorisée et exclusive

Cette commande est la seule du guide qui lance les mesures de coût. Le
responsable doit avoir vérifié la readiness, les acquittements frais et le
verrou de performance avant de la lancer. Le runner historique vérifie les
sources et entrées ; il ne remplace pas l'autorisation de la readiness.

```bash
python -B scripts/run-native-cost-window.py \
  "$LOT7B_BASELINE_CHECKOUT" "$LOT7B_PERF" \
  "$LOT7B_BASE_MANIFEST" "$LOT7B_FINAL/source-manifest.json"
```

Ordre conservé : A1, B1, B2, A2. Sorties : `window.json`, quatre rapports
`cohort{1,2}/{baseline,after}.json` et quatre journaux `.log`. Les rapports A
sont copiés à octets exacts depuis le checkout baseline. La fenêtre doit finir
avec `status: passed` et `finalIntegrity: passed`. Aucun outil du guide ne
supprime une session défavorable, ne sélectionne une cohorte ni ne réessaie une
fenêtre en écrasant ses sorties.

## 7. Deux comparaisons de paires et refus strict réel

```bash
node scripts/compare-native-loop-costs.mjs \
  "$LOT7B_PERF/comparison-policy.json" "$LOT7B_PERF/cohort1/baseline.json" \
  "$LOT7B_PERF/cohort1/after.json" "$LOT7B_PERF/cohort1/comparison.json"

node scripts/compare-native-loop-costs.mjs \
  "$LOT7B_PERF/comparison-policy.json" "$LOT7B_PERF/cohort2/baseline.json" \
  "$LOT7B_PERF/cohort2/after.json" "$LOT7B_PERF/cohort2/comparison.json"
```

`budget_review_required` est un diagnostic conservé des phases ; aucune paire
n'est choisie à la place de l'agrégat. Le bloc suivant exécute ensuite le vrai
comparateur strict inchangé et conserve son code de sortie, stdout/stderr
complets et les empreintes réelles. Il écrit aussi le reçu si la sortie est
inattendue, puis bloque la suite. Il ne fabrique pas un refus attendu.

```bash
python -B - "$LOT7B_PERF" <<'PY'
from datetime import datetime, timezone
from pathlib import Path
import hashlib, json, subprocess, sys

root = Path.cwd().resolve()
perf = (root / sys.argv[1]).resolve()
contract = json.loads((perf / 'owner-growth-contract.json').read_bytes())
window = json.loads((perf / 'window.json').read_bytes())
assert window['status'] == window['finalIntegrity'] == 'passed'
receipt_path, log_path, output = [root / contract[key] for key in (
    'strictFailureReceipt', 'strictFailureLog', 'historicalAggregateOutput')]
assert all(path.parent == perf and not path.exists() for path in (receipt_path, log_path, output))

def fp(path):
    path = path.resolve()
    assert path.is_relative_to(root)
    raw = path.read_bytes()
    return {'path': path.relative_to(root).as_posix(), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}

tool = root / 'scripts/compare-native-cost-cohorts.mjs'
arguments = [perf / 'comparison-policy.json']
arguments += [perf / f'cohort{index}/{name}.json' for index in (1, 2)
              for name in ('baseline', 'after', 'comparison')]
inputs = [fp(path) for path in [tool, *arguments]]
command = ['node', tool.relative_to(root).as_posix(),
           *[path.relative_to(root).as_posix() for path in arguments], contract['historicalAggregateOutput']]
started = datetime.now(timezone.utc).isoformat()
assert datetime.fromisoformat(window['finishedAt'].replace('Z', '+00:00')) <= datetime.fromisoformat(started)
with log_path.open('xb') as stream:
    result = subprocess.run(command, cwd=root, stdout=stream, stderr=subprocess.STDOUT)
finished = datetime.now(timezone.utc).isoformat()
unchanged = inputs == [fp(path) for path in [tool, *arguments]]
receipt = {'schema': 'logos-engine.retained-tool-failure.v1', 'startedAt': started, 'finishedAt': finished,
           'command': command, 'exitCode': result.returncode, 'inputs': inputs, 'inputsUnchanged': unchanged,
           'outputExists': output.exists(), 'log': fp(log_path),
           'qualification': 'Actual unchanged historical comparator invocation; complete stdout/stderr retained. No measured input rewritten.'}
with receipt_path.open('x') as stream:
    json.dump(receipt, stream, indent=2)
    stream.write('\n')
print(json.dumps({'receipt': fp(receipt_path), 'exitCode': result.returncode, 'outputExists': output.exists()}))
assert result.returncode != 0 and unchanged and not output.exists()
assert 'Within-cohort work metadata changed' in log_path.read_text()
PY
```

## 8. Consolidation qualifiée, revue indépendante, transport et rendu

```bash
node "$LOT7B_EVIDENCE/consolidate-owner-costs.mjs" \
  "$LOT7B_PERF/owner-growth-contract.json" \
  "$LOT7B_PERF/owner-growth-comparison.json" \
  > "$LOT7B_PERF/owner-growth-comparison.log" 2>&1

python -B "$LOT7B_EVIDENCE/review-owner-costs.py" \
  "$LOT7B_PERF/owner-growth-contract.json" \
  "$LOT7B_PERF/owner-growth-comparison.json" \
  "$LOT7B_PERF/owner-growth-review.json" \
  > "$LOT7B_PERF/owner-growth-review.log" 2>&1

python -B "$LOT7B_EVIDENCE/record-cost-log-transport.py" "$LOT7B_PERF"

python -B "$LOT7B_EVIDENCE/write-cost-results.py" \
  --output-directory "$LOT7B_PERF" \
  --candidate-source-directory "$LOT7B_FINAL" \
  --baseline-manifest "$LOT7B_BASE_MANIFEST"
```

Les deux analyseurs sont exactement ceux annoncés avant la mesure. Il n'existe
pas d'argument `IO_CORRECTION` pour 7B. Leurs entrées externes d'attribution
doivent être les empreintes exactes du reçu baseline pré-déclaré et se résoudre
dans son checkout gelé. Les données sont revérifiées à la fin de l'analyse.

Le refus historique reste en échec. La revue arithmétique réussie ne suffit
pas à accepter le coût : `globalAccepted` doit être vrai pour les deux jeux,
sur les huit sessions complètes par jeu/version réunies, strictement sous
+10 %. Les 32 sessions/400 actions et les huit chauffes/24 actions exclues sont
conservées. Phases, p95, dispersions et cohortes restent visibles, y compris
leurs dépassements. Le transport conserve les originaux et leurs gzip exacts ;
le rendu produit `results.md` et `results-render.json` sans nouvelle mesure.

## 9. Intégrité des entrées avant publication

```bash
python -B "$LOT7B_EVIDENCE/record-publication-inputs.py" \
  --performance-directory "$LOT7B_PERF" \
  --candidate-source-directory "$LOT7B_FINAL" \
  --validation-directory validation \
  --test-scope-plan "$LOT7B_SCOPE" \
  --baseline-publication-receipt "$LOT7B_BASELINE_PUBLICATION"
```

La sortie exclusive est `$LOT7B_FINAL/publication-inputs.json`, schéma
`logos-engine.lot7b-publication-inputs.v1`. Elle lie le prédécesseur réellement
publié, les comptes de tests dynamiques, le worker compilé et les inventaires
source/tests/build. Elle exige le coût global accepté et ses générateurs
exacts, puis revérifie les fichiers locaux et externes en fin de lecture.
Elle conserve les réserves fonctionnelles de la readiness. **Elle ne publie
rien** : la publication et son reçu de déploiement réel restent l'étape du
responsable de livraison.
