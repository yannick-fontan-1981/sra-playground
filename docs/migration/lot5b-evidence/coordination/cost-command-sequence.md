# Lot 5B : séquence de commandes pour la fenêtre de coût intégrée

**Préparation documentaire uniquement. Aucune capture ni mesure n’a été lancée
pour écrire ce mémo.** La référence est la publication 4C réellement disponible,
à identifier après sa publication. Les commandes ci-dessous ne déclarent ni sa
disponibilité, ni la readiness, ni un résultat de coût.

Le candidat est le checkout 5B courant. Son gel est conservé dans
`docs/migration/lot5b-evidence/integrated-final`. La nouvelle fenêtre utilise
`docs/migration/lot5b-evidence/performance-integrated`.

## 1. Paramètres et prérequis effectifs

Exécuter depuis la racine du checkout 5B. Renseigner les quatre paramètres
suivants avec les identités effectivement vérifiées ; aucun numéro de Site,
commit ou version future n’est fourni par ce mémo.

| Variable | Valeur à fournir |
| --- | --- |
| `BASELINE_CHECKOUT` | Chemin **absolu** du checkout distinct de la publication 4C effective, avec ses sources natives propres et identiques au commit publié. |
| `SITE_VERSION` | Numéro entier du Site de cette publication 4C effective. |
| `BASELINE_MANIFEST` | Chemin relatif au checkout 5B du manifeste de **cette référence 4C**, conservé localement. Un ancien manifeste de 5B/10A ne doit pas être relabellisé 4C. |
| `CANDIDATE_VERSION` | Version native réellement inscrite dans le gel intégré 5B. |

```bash
cd /workspace/sites/sra-lot5b-20261110/.sites-checkout
set -euo pipefail
set -C

: "${BASELINE_CHECKOUT:?Renseigner le checkout absolu de la publication 4C effective}"
: "${SITE_VERSION:?Renseigner le numero de Site 4C effectivement publie}"
: "${BASELINE_MANIFEST:?Renseigner son manifeste conserve dans le checkout 5B}"
: "${CANDIDATE_VERSION:?Renseigner la version du gel natif integre 5B}"

SRA_EVIDENCE='docs/migration/lot5b-evidence'
SRA_FINAL="$SRA_EVIDENCE/integrated-final"
SRA_PERF="$SRA_EVIDENCE/performance-integrated"
SRA_LOCK='/workspace/shared/sra-coordination/performance.lock'
SRA_CHECKOUT="$(pwd -P)"

test -f src/logos-engine/v6-native-runtime.ts
test -f "$BASELINE_MANIFEST"
test -f "$SRA_FINAL/source-manifest.json"
test -f "$SRA_FINAL/source-archive.json"
test -f "$SRA_FINAL/source-archive-parts.json"
mkdir -p "$SRA_PERF"
```

Le gel et son archive doivent déjà correspondre aux fichiers actuels. Les
tests, checks, rejeux, preuves originales, vérification navigateur ou réserve
explicite, et intégrité de livraison sont terminés avant la readiness. Les
dépendances `node_modules` et `public/vendor/pyodide` des deux checkouts doivent
être présentes et équivalentes ; le préflight contrôle soit leur cible commune,
soit chaque nom et empreinte de fichier. Les traces publiques et les outils
historiques doivent être identiques dans les deux checkouts.

Les captures, l’inventaire de factory et la qualification exécutent du code
fonctionnel. Les lancer seulement après libération du créneau correspondant,
sous verrou partagé. La fenêtre ABBA est lancée plus tard sous verrou exclusif
et avec des acquittements de silence frais. Les sorties sont exclusives : un
essai incomplet ou défavorable reste conservé et n’est pas écrasé.

## 2. Finaliser le protocole avant les captures

`--owner-cost-qualification` est nécessaire à cette chaîne. L’option déclare
avant la mesure le contrat fermé de comparaison du propriétaire ajouté et
épingle les deux outils complémentaires.

```bash
flock -s "$SRA_LOCK" python -B "$SRA_EVIDENCE/prepare-cost-protocol.py" \
  --finalize \
  --baseline-checkout "$BASELINE_CHECKOUT" \
  --baseline-site-version "$SITE_VERSION" \
  --candidate-version "$CANDIDATE_VERSION" \
  --baseline-manifest "$BASELINE_MANIFEST" \
  --candidate-source-directory "$SRA_FINAL" \
  --output-directory "$SRA_PERF" \
  --owner-cost-qualification \
  > "$SRA_PERF/protocol-finalization.log" 2>&1
```

Sorties : `cases.json`, `comparison-policy.json`, `protocol.md`,
`global-budget-policy.json`, `declaration.json`, `protocol-check.json` et
`preparation.json`. Les cas et la politique de phases viennent des octets
historiques vérifiés de 3H ; aucune ancienne durée n’est réutilisée.

Le défaut du helper pour `--candidate-source-directory` est `final`, donc
l’argument explicite `integrated-final` ci-dessus est indispensable. Le défaut
de manifeste baseline peut désigner une référence antérieure : fournir
également `--baseline-manifest` explicitement.

## 3. Capturer puis qualifier la structure, sans mesure de coût

Les commandes sont séquentielles. Les deux captures prennent exactement les
mêmes cas, avec le manifeste propre à chaque rôle. Le rôle `candidate` doit
désigner ce checkout ; le rôle `baseline` doit désigner le checkout distinct.

```bash
flock -s "$SRA_LOCK" node "$SRA_EVIDENCE/capture-cost-owner-graphs.mjs" \
  baseline "$BASELINE_CHECKOUT" \
  "$SRA_PERF/cases.json" "$BASELINE_MANIFEST" \
  "$SRA_PERF/functional-baseline.json.gz" \
  > "$SRA_PERF/functional-baseline.capture.log" 2>&1

flock -s "$SRA_LOCK" node "$SRA_EVIDENCE/capture-cost-owner-graphs.mjs" \
  candidate "$SRA_CHECKOUT" \
  "$SRA_PERF/cases.json" "$SRA_FINAL/source-manifest.json" \
  "$SRA_PERF/functional-candidate.json.gz" \
  > "$SRA_PERF/functional-candidate.capture.log" 2>&1

flock -s "$SRA_LOCK" node "$SRA_EVIDENCE/record-owner-source-inventory.mjs" \
  "$BASELINE_CHECKOUT" "$SRA_PERF/owner-source-inventory.json" \
  > "$SRA_PERF/owner-source-inventory.log" 2>&1

flock -s "$SRA_LOCK" node "$SRA_EVIDENCE/qualify-cost-owner-graphs.mjs" \
  "$SRA_PERF/functional-baseline.json.gz" \
  "$SRA_PERF/functional-baseline.receipt.json" \
  "$SRA_PERF/functional-candidate.json.gz" \
  "$SRA_PERF/functional-candidate.receipt.json" \
  "$SRA_PERF/owner-structural-attribution.json" \
  "$SRA_PERF/owner-structural-fixture.json" \
  > "$SRA_PERF/owner-structural-qualification.log" 2>&1

flock -s "$SRA_LOCK" python -B "$SRA_EVIDENCE/finalize-owner-cost-contract.py" \
  "$SRA_PERF" \
  > "$SRA_PERF/owner-cost-contract-finalization.log" 2>&1
```

La capture crée automatiquement son reçu en remplaçant `.json.gz` par
`.receipt.json`. Il ne faut pas choisir arbitrairement un autre suffixe dans
la qualification. Les quatre formes fonctionnelles prévues sont STCK chauffe,
STCK mesuré, SMLP chauffe, SMLP mesuré. Chaque capture de rôle prévoit quatre
sessions fonctionnelles et 31 actions ; ces sessions ne font pas partie des
32 sessions de la mesure future.

L’inventaire exécute les factories et les installations de programmes dans
leurs magasins réels, sans initialiser de session. Il exige l’ajout du seul
propriétaire `public_addressed_material`, sans programme SRC ajouté, retrait
de propriétaire ni réordonnancement des propriétaires existants.

La qualification écrit toujours son attribution diagnostique. Elle écrit la
fixture seulement si la structure est qualifiée. Toute différence non
attribuée bloque la suite **avant coût**. Aucune tolérance générique de
fragment partagé, croissance constante ou nombre historique de différences
n’est prévu. Si une correction d’outil ou de source devient nécessaire, elle
doit être traitée par le responsable avant un nouveau gel ; les captures
précédentes restent conservées.

Le finaliseur produit `owner-growth-contract.json`. Il consomme exactement
`owner-source-inventory.json` et `owner-structural-fixture.json` dans le
répertoire de performance. L’attribution est trouvée par l’empreinte contenue
dans la fixture. Il refuse notamment une readiness, un préflight ou une
fenêtre déjà présents : il doit donc précéder les étapes suivantes.

## 4. Préflight, preuves finales et readiness

```bash
flock -s "$SRA_LOCK" python -B "$SRA_EVIDENCE/check-cost-static-inputs.py" \
  --performance-directory "$SRA_PERF" \
  > "$SRA_PERF/static-preflight.log" 2>&1
```

Cette commande écrit `static-preflight.json`. Elle relit le contrat, les
captures et la fixture, les dépendances, les outils et l’archive réelle ; elle
réexécute uniquement le checker de protocole. Elle ne crée pas la readiness.

Renseigner les chemins de preuves réelles ci-dessous. Les trois répertoires
communs doivent provenir du gel `integrated-final` ; leur nom de sous-répertoire
est celui effectivement utilisé par le responsable, sans inventer de reçu.

| Variable | Fichier ou répertoire attendu |
| --- | --- |
| `TEST_SCOPE_PLAN` | Plan `logos-engine.lot5b.integrated-test-scope-plan.v1` réellement exécuté. |
| `PUBLICATION_CHAIN` | Chaîne de publications 10A puis 4C ; elle distingue le commit publié 4C de l’ascendance réelle de l’archive candidate. |
| `ORACLE_EXPORT_RECEIPT` | Reçu réussi de l’export original de composant lié aux tests finaux. |
| `COMMON_POSITIVE_DIR` | Répertoire de la preuve commune positive finale. |
| `COMMON_NEGATIVE_DIR` | Répertoire de la preuve commune négative finale. |
| `COMMON_STOCK_DIR` | Répertoire de la preuve finale `stock-preservation-refusal`. |
| `BROWSER_RECEIPT` | Résultat navigateur observé ou réserve explicite admise par la readiness. |
| `WEAV_CASE_CHECKPOINT` | Checkpoint conservant le temps cumulé de WEAV, sans remise à zéro ni nouvelle campagne dans ce lot. |

Dans chacun des trois répertoires communs, la readiness exige notamment
`common-loop.json.gz`, `actual-operations.json`, `original-export.json`,
`original-replay.json.gz`, `original-comparison.json` et
`execution-started.json`. La preuve stock exige aussi
`original-preservation-comparison.json` passé et lié aux mêmes entrées ; elle
conserve `publicPath.complete: false`. Les trois anciens essais stock en
échec restent des diagnostics épinglés au plan, sans devenir passés.

Le responsable doit ensuite conserver des acquittements frais dans
`$SRA_PERF/coordinated-isolation.json`, avec les preuves réellement observées
des autres fils et de ses propres agents, le preview arrêté et aucun override
`NODE_OPTIONS` ajouté pour cette mesure. Ce fichier ne doit pas être rempli par des valeurs supposées.
La fraîcheur par défaut de la readiness est de 900 secondes ; sa limite ne
doit pas être augmentée pour faire passer des acquittements périmés.

```bash
: "${TEST_SCOPE_PLAN:?Chemin du plan de tests integre reel}"
: "${PUBLICATION_CHAIN:?Chemin de la chaine de publications verifiee}"
: "${ORACLE_EXPORT_RECEIPT:?Chemin du recu original de composant}"
: "${COMMON_POSITIVE_DIR:?Repertoire de la preuve positive finale}"
: "${COMMON_NEGATIVE_DIR:?Repertoire de la preuve negative finale}"
: "${COMMON_STOCK_DIR:?Repertoire de la preuve stock bornee finale}"
: "${BROWSER_RECEIPT:?Chemin du resultat navigateur ou de sa reserve explicite}"
: "${WEAV_CASE_CHECKPOINT:?Chemin du checkpoint cumule WEAV conserve}"

flock -s "$SRA_LOCK" python -B "$SRA_EVIDENCE/finalize-cost-readiness.py" \
  --performance-directory "$SRA_PERF" \
  --candidate-source-directory "$SRA_FINAL" \
  --validation-directory validation \
  --test-scope-plan "$TEST_SCOPE_PLAN" \
  --publication-chain "$PUBLICATION_CHAIN" \
  --oracle-export-receipt "$ORACLE_EXPORT_RECEIPT" \
  --common-positive-directory "$COMMON_POSITIVE_DIR" \
  --common-negative-directory "$COMMON_NEGATIVE_DIR" \
  --common-stock-directory "$COMMON_STOCK_DIR" \
  --browser-receipt "$BROWSER_RECEIPT" \
  --weav-case-checkpoint "$WEAV_CASE_CHECKPOINT" \
  > "$SRA_PERF/readiness-finalization.log" 2>&1
```

`--validation-directory validation` est relatif à `integrated-final`, non à la
racine du checkout. `--audit-receipt PATH` est disponible si le responsable
utilise un reçu d’audit distinct ; sinon l’audit est lu depuis le troisième
check final. Aucune sortie de readiness ne doit être annoncée avant son succès
réel et la vérification de ses entrées.

## 5. Lancer la seule fenêtre de mesure

Cette commande démarre les mesures. Elle est réservée au responsable après
readiness réussie, confirmation de l’isolation et libération des autres fils.
Le verrou exclusif couvre la commande entière, donc les quatre séries.

```bash
flock -x "$SRA_LOCK" python -B scripts/run-native-cost-window.py \
  "$BASELINE_CHECKOUT" "$SRA_PERF" \
  "$BASELINE_MANIFEST" "$SRA_FINAL/source-manifest.json" \
  > "$SRA_PERF/window-driver.log" 2>&1
```

Le runner seul impose `A1 / B1 / B2 / A2`. Il écrit `window.json`, les quatre
rapports `cohort1/baseline.json`, `cohort1/after.json`,
`cohort2/after.json`, `cohort2/baseline.json` et leurs `.log`. Les rapports A
sont produits dans le checkout de référence puis copiés à l’identique dans
la fenêtre du candidat. Il ne lance aucun comparateur.

Les effectifs déclarés sont 32 sessions mesurées, 400 actions, huit chauffes
et 24 actions de chauffe exclues. Ce sont des engagements de protocole, pas
des effectifs déjà obtenus. Une fenêtre interrompue reste interrompue ; aucun
rapport partiel ne devient une cohorte complète.

## 6. Comparer les deux cohortes

Attendre la fin des quatre séries et le contrôle d’intégrité final du runner.
Ces commandes lisent les durées conservées ; elles n’exécutent pas de runtime.

```bash
node scripts/compare-native-loop-costs.mjs \
  "$SRA_PERF/comparison-policy.json" \
  "$SRA_PERF/cohort1/baseline.json" "$SRA_PERF/cohort1/after.json" \
  "$SRA_PERF/cohort1/comparison.json" \
  > "$SRA_PERF/cohort1/comparison.log" 2>&1

node scripts/compare-native-loop-costs.mjs \
  "$SRA_PERF/comparison-policy.json" \
  "$SRA_PERF/cohort2/baseline.json" "$SRA_PERF/cohort2/after.json" \
  "$SRA_PERF/cohort2/comparison.json" \
  > "$SRA_PERF/cohort2/comparison.log" 2>&1
```

Un statut de phase `budget_review_required` est conservé tel quel. Il ne
supprime ni cohorte ni session et ne décide pas à lui seul de l’acceptation
globale autorisée par l’utilisateur.

## 7. Exécuter et conserver la tentative historique stricte

CLI exacte du comparateur historique :

```text
node scripts/compare-native-cost-cohorts.mjs POLICY BASELINE1 AFTER1 COMPARISON1 BASELINE2 AFTER2 COMPARISON2 OUTPUT
```

Le consolidateur complémentaire exige les fichiers
`aggregation-failure.json` et `aggregation-failure.log`. Le comparateur
historique ne produit pas ce reçu lui-même. Le bloc suivant capture donc son
**exécution réelle**, ses entrées, ses dates, son code retour et son journal.
Il n’est pas à exécuter en plus d’un appel manuel au comparateur : il constitue
cet appel unique.

```bash
python -B - "$SRA_PERF" <<'PY'
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import sys

root = Path.cwd().resolve()
perf = (root / sys.argv[1]).resolve()
assert perf.is_relative_to(root)
contract = json.loads((perf / 'owner-growth-contract.json').read_bytes())
window = json.loads((perf / 'window.json').read_bytes())
assert window['status'] == window['finalIntegrity'] == 'passed'

def rel(path):
    return path.resolve().relative_to(root).as_posix()

def fp(path):
    raw = path.read_bytes()
    return {'path': rel(path), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}

def now():
    return datetime.now(timezone.utc).isoformat()

tool = root / 'scripts/compare-native-cost-cohorts.mjs'
inputs = [tool, perf / 'comparison-policy.json']
for cohort in (1, 2):
    inputs += [perf / f'cohort{cohort}' / f'{name}.json'
               for name in ('baseline', 'after', 'comparison')]
aggregate = root / contract['historicalAggregateOutput']
failure_path = root / contract['strictFailureReceipt']
log_path = root / contract['strictFailureLog']
unexpected_path = perf / 'aggregation-unexpected-success.json'
assert all(not path.exists() for path in
           (aggregate, failure_path, log_path, unexpected_path))
before = [fp(path) for path in inputs]
command = ['node', rel(tool), *[rel(path) for path in inputs[1:]], rel(aggregate)]
started = now()
with log_path.open('xb') as log:
    completed = subprocess.run(command, cwd=root, stdout=log, stderr=subprocess.STDOUT)
finished = now()
unchanged = before == [fp(path) for path in inputs]
receipt = {
    'schema': ('logos-engine.retained-tool-failure.v1' if completed.returncode != 0
               else 'logos-engine.retained-tool-execution.v1'),
    'command': command, 'startedAt': started, 'finishedAt': finished,
    'exitCode': completed.returncode, 'inputs': before,
    'inputsUnchanged': unchanged, 'outputExists': aggregate.exists(), 'log': fp(log_path),
}
destination = failure_path if completed.returncode != 0 else unexpected_path
with destination.open('x') as stream:
    json.dump(receipt, stream, indent=2)
    stream.write('\n')
expected_structural_refusal = (completed.returncode != 0 and unchanged
    and not aggregate.exists()
    and 'Within-cohort work metadata changed' in log_path.read_text())
print(json.dumps({'receipt': rel(destination), 'exitCode': completed.returncode,
                  'inputsUnchanged': unchanged, 'outputExists': aggregate.exists(),
                  'matchesPredeclaredStructuralRefusal': expected_structural_refusal}))
if not expected_structural_refusal:
    raise SystemExit('Retained strict result is outside the predeclared owner-cost branch; stop and review it.')
PY
```

Le reçu attendu par les outils complémentaires doit refléter un code non nul,
des entrées inchangées, l’absence d’agrégat historique et le motif réellement
présent `Within-cohort work metadata changed`. Tout autre résultat est conservé
et arrête cette séquence. Le bloc ne fabrique jamais un refus pour débloquer
la consolidation. Un agrégat historique effectivement créé demeure conservé.

## 8. Consolidation complémentaire et revue indépendante

Après une qualification structurelle préalable valide et un refus historique
réel conforme au contrat fermé :

```bash
node "$SRA_EVIDENCE/consolidate-owner-costs.mjs" \
  "$SRA_PERF/owner-growth-contract.json" \
  "$SRA_PERF/owner-growth-comparison.json" \
  > "$SRA_PERF/owner-growth-consolidation.log" 2>&1

python -B "$SRA_EVIDENCE/review-owner-costs.py" \
  "$SRA_PERF/owner-growth-contract.json" \
  "$SRA_PERF/owner-growth-comparison.json" \
  "$SRA_PERF/owner-growth-review.json" \
  > "$SRA_PERF/owner-growth-review.log" 2>&1
```

Le JavaScript et le Python recalculent indépendamment les métriques et les
effectifs complets. Le reçu `owner-growth-review.json` porte aussi le verdict
global de cette branche. Une revue arithmétique réussie peut conclure à un
budget global refusé ; lire `globalAccepted` / `accepted` et `globalStatus`,
sans assimiler le statut de revue à une acceptation.

Le critère reste la médiane regroupée de `session_elapsed`, **strictement
inférieure à +10 % pour chaque jeu séparément**. Les phases et p95 disponibles
restent visibles. Aucun total de phases imbriquées, compensation entre jeux,
choix de cohorte, retrait de valeur extrême ou marge supplémentaire n’est admis.

Dans cette branche `ownerCostQualification`, ne lancer ni
`review-native-cost-consolidation.py` sur un `combined-comparison.json` absent,
ni `review-native-global-cost-window.py` sur une revue historique inexistante.
Le rendu utilise les reçus complémentaires ci-dessus. Les outils historiques
ne sont pas modifiés et leur tentative stricte conserve son résultat réel.

## 9. Conserver les journaux puis rendre les résultats

```bash
python -B "$SRA_EVIDENCE/record-cost-log-transport.py" "$SRA_PERF" \
  > "$SRA_PERF/log-transport-generation.log" 2>&1

python -B "$SRA_EVIDENCE/write-cost-results.py" \
  --output-directory "$SRA_PERF" \
  --candidate-source-directory "$SRA_FINAL" \
  --baseline-manifest "$BASELINE_MANIFEST" \
  > "$SRA_PERF/results-render.log" 2>&1
```

Le transport produit quatre `.log.gz` vérifiés octet pour octet et
`log-transport.json`, en conservant les journaux bruts. Le renderer crée
`results.md` et `results-render.json`, exclusivement depuis les reçus présents.
Il exige notamment les deux comparaisons de cohorte, les quatre rapports bruts,
`owner-growth-comparison.json`, `owner-growth-review.json`, la readiness, le
préflight et le transport des journaux. Aucun verdict ni résultat n’est annoncé
par ce mémo. La publication reste une étape distincte portée par le responsable.

## 10. Correspondance des fichiers et points de vigilance relevés

| Producteur | Sortie de cette séquence | Consommateur suivant |
| --- | --- | --- |
| `prepare-cost-protocol.py` | `cases.json`, `declaration.json`, politiques, protocole et reçus de préparation | Captures, contrat, préflight, readiness, runner, consolidations |
| Capture baseline | `functional-baseline.json.gz` et `functional-baseline.receipt.json` | Qualification structurelle |
| Capture candidate | `functional-candidate.json.gz` et `functional-candidate.receipt.json` | Qualification structurelle |
| Inventaire factory | `owner-source-inventory.json` | Finaliseur du contrat |
| Qualification | `owner-structural-attribution.json`, puis fixture seulement si qualifiée | `finalize-owner-cost-contract.py` via `owner-structural-fixture.json` |
| Finaliseur du contrat | `owner-growth-contract.json` | Préflight, readiness, consolidateur et reviewer complémentaires |
| Préflight puis readiness | `static-preflight.json`, `readiness.json` | Contrôle de lancement et consolidations |
| Runner ABBA | `window.json`, quatre rapports bruts et quatre journaux | Deux comparateurs de paire et transport |
| Deux comparateurs de paire | `cohort1/comparison.json`, `cohort2/comparison.json` | Tentative stricte et consolidation complémentaire |
| Bloc de capture de la tentative stricte | `aggregation-failure.log` ; reçu `aggregation-failure.json` si code non nul, sinon `aggregation-unexpected-success.json` | Consolidateur et reviewer complémentaires, uniquement si le refus réel satisfait leur contrat |
| Consolidateur complémentaire | `owner-growth-comparison.json` | Reviewer indépendant |
| Reviewer indépendant | `owner-growth-review.json`, avec le verdict global réel | Renderer |
| Transport puis renderer | `log-transport.json`, `results.md`, `results-render.json` | Livraison et publication distinctes |

Deux jonctions ont été signalées au responsable pendant la lecture statique :

1. Aucun outil 5B existant ne crée `aggregation-failure.json` à partir de
   l’exécution du comparateur historique. Le bloc explicite de l’étape 7
   remplit ce rôle sans supposer le résultat et sans modifier d’outil gelé.
2. La section générique des commandes du protocole généré mentionne encore
   les revues historiques sur `combined-comparison.json`. La branche ajout de
   propriétaire exige les fichiers `owner-growth-*`, que le renderer sélectionne
   déjà quand `ownerCostQualification` est présent. Les étapes 7 à 9 décrivent
   cette branche et ne remplacent pas un refus historique par un succès.

Les quatre outils de capture/inventaire/qualification/contrat et les sources
natives n’ont pas été modifiés pour ce mémo. Les interfaces ont été relevées
textuellement dans les scripts, sans lancer leurs CLI, captures, factories,
qualifications ou mesures.
