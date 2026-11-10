# Lot 4B — runbook final pour root

**Préparation textuelle uniquement. Aucune commande ci-dessous n’a été exécutée
pour ce runbook.** Attendre le release explicite de la fenêtre 5A, puis sa
publication terminale vérifiée. Site 83/7A reste un prédécesseur historique ; il
ne constitue pas le baseline futur 5A. Ne modifier aucun outil de coût après sa
déclaration, et ne remplacer aucun reçu exclusif ni échec conservé.

## 1. Renseigner les entrées réelles, puis figer

Exécuter depuis `/workspace/sites/sra-lot4a-20261110/.sites-checkout`. Variables
de travail à renseigner avant les commandes :

| Variable | Valeur obligatoire |
| --- | --- |
| `LOT4B_BASELINE` | Checkout absolu distinct, sans symlink, au commit **5A réellement publié**, sources natives propres ; dépendances préparées hors fenêtre de coût. |
| `LOT4B_SITE`, `LOT4B_BASE_COMMIT` | Version Site et commit de ce déploiement 5A `succeeded`, liés dans un reçu de provenance root. |
| `LOT4B_BASELINE_MANIFEST` | Copie exacte, dans le dépôt 4B, du manifeste natif livré par ce commit 5A ; vérifier les octets et l’inventaire du checkout baseline. |
| `LOT4B_VERSION` | Version native finale décidée après intégration 5A ; pas la version héritée de développement. |
| `LOT4B_FREEZE` | Répertoire neuf relatif au dépôt, recommandé `docs/migration/lot4b-evidence/integrated-final`. |
| `LOT4B_PERF` | Répertoire neuf relatif au dépôt, recommandé `docs/migration/lot4b-evidence/performance-integrated`. |
| `LOT4B_BUILD_SCRIPT` | Chemin absolu du `build-site.mjs` Sites actuellement fourni ; l’ancien reçu 7A nomme `/home/agent/.codex/plugins/cache/openai-curated-remote/sites/1.1.5/scripts/build-site.mjs`, à confirmer. |
| `LOT4B_PUBLISHED_TEST_RECEIPT` | Copie exacte du reçu `delta-tests-run.json` **réellement publié par 5A**, avec appartenance au commit publié et empreinte vérifiées ; sa liste `testFiles` définit le périmètre hérité. |
| `LOT4B_ROUTING_TEST_FILES` | Tableau Bash des seuls compléments de routage explicitement justifiés par la revue de `feedback_component` et déclarés dans le plan final ; tableau vide s’il n’y en a pas. Aucun glob ni découverte automatique. |
| `LOT4B_CASES` | Nouveau manifeste exécutable des huit cas stricts, dérivé du plan avec les empreintes réelles conservées. |
| `LOT4B_PARTIAL_CONTRACT` | Nouveau contrat LKEY final, avec date/statut `declared`, manifeste final et tous les SHA réels ; aucun `null` du template. |
| `LOT4B_PARTIAL_DIR` | Nouveau sous-répertoire du gel, par exemple `$LOT4B_FREEZE/lkey-partial`. |
| `LOT4B_PARITY` | Nouvelle sortie `.json.gz` de parité TRIA, par exemple `$LOT4B_FREEZE/tria-relative-arrangement-source-parity.json.gz`. |
| `LOT4B_BROWSER` | Nouveau reçu navigateur final, recommandé `$LOT4B_FREEZE/browser/browser-qa.json`. |
| `LOT4B_BROWSER_QA_CONTINUATION` | Reçu séparé de l’intervalle QA final et de son cumul, requis si le navigateur est `passed` ; recommandé `$LOT4B_FREEZE/browser/browser-qa-continuation.json`. Laisser absent pour un blocage d’infrastructure sans continuation. |

Après fusion de 5A, résolution complète, version finale, source et harnais
stables : vérifier le commit baseline exact, la provenance de son manifeste,
l’absence d’autre owner nouveau entre A et B, puis geler. Le gel de développement
`852d5ff7…` et ses résultats restent historiques.

```bash
git -C "$LOT4B_BASELINE" rev-parse HEAD
git -C "$LOT4B_BASELINE" status --porcelain -- src/logos-engine src/runtime
python -B scripts/freeze-v53-native-source.py freeze "$LOT4B_FREEZE"
```

Sorties : `source-manifest.json`, `source-archive.json`, archive originale et
`source-archive-parts.json` avec parties de 900 000 octets. Garder l’archive
originale disponible. Restaurer avant validation les fixtures et rapports
historiques manquants depuis leurs transports vérifiés, sans régénération :

```bash
python -B scripts/evidence-byte-parts.py restore "$LOT4B_ARCHIVED_EVIDENCE_DIR"
```

Répéter cette dernière commande seulement pour les répertoires effectivement
nécessaires aux tests et au manifeste de régression.

## 2. Périmètre formel complet déclaré et cinq gates

Construire l’union dédupliquée des `testFiles` du reçu 5A effectivement publié,
des deux nouveaux tests Relative et des seuls compléments ciblés de routage
justifiés. La référence 7A comptait 97 fichiers ; le plan initial 4B en nommait
99. Un reçu final 5A de 102 fichiers conduirait à 104 avant compléments, sous
réserve des recouvrements réels : **dériver le nombre du reçu publié, ne pas le
fixer à l’avance**. Les 198 fichiers actuellement présents dans le dépôt
comprennent d’autres moteurs et des périmètres historiques ; leur présence ne
les ajoute pas au périmètre de cette livraison.

```bash
mapfile -t LOT4B_TEST_FILES < <(
  python -B - "$LOT4B_PUBLISHED_TEST_RECEIPT" "${LOT4B_ROUTING_TEST_FILES[@]}" <<'PY'
import json
import sys
from pathlib import Path
receipt = json.loads(Path(sys.argv[1]).read_text())
assert receipt['schema'] == 'logos-engine.native-delta-verification.v1'
assert receipt['status'] == 'passed' and receipt['sourceAndTestInputsUnchanged'] is True
inherited = receipt['testFiles']
assert inherited and len(inherited) == len(set(inherited))
relative = ['tests/v6-relative-arrangements-reference.test.ts',
            'tests/v6-relative-arrangements-integration.test.ts']
selected = sorted(set(inherited + relative + sys.argv[2:]))
assert all(name.startswith('tests/') and name.endswith('.test.ts')
           and Path(name).is_file() for name in selected)
print('\n'.join(selected))
PY
)
python -B scripts/verify-native-delta.py "$LOT4B_FREEZE" --tests "${LOT4B_TEST_FILES[@]}"
python -B scripts/verify-native-delta.py "$LOT4B_FREEZE" --build-script "$LOT4B_BUILD_SCRIPT"
```

Conserver dans le plan final l’empreinte du reçu publié, la liste résultante, son
effectif et la justification de chaque complément. La première vérification
reçoit le **périmètre formel complet déclaré**, pas toute la suite historique du
dépôt. Exiger le TAP complet, aucun échec, skip, cancelled ou todo, et
`sourceAndTestInputsUnchanged=true`. Le libellé générique « delta » de l’outil
historique ne change pas cette liste effective. Aucun test optionnel ne doit
élargir automatiquement ce périmètre.
Les cinq gates ordonnés sont `typecheck`, `entry-audit`, `migration-audit`,
`diff-check`, `build`. Sorties requises sous `$LOT4B_FREEZE/validation/` :
`delta-tests-run.json`, `checks-run.json`, journaux gzip et empreinte du worker.
Conserver toute tentative échouée ; une correction native impose un nouveau gel
et de nouveaux reçus, sans écrasement.

## 3. Régressions strictes, TRIA final et LKEY partiel

Le manifeste strict reprend CATR, RSWP, FOGW, VOIS, CONN, MIND, WEAV dans l’ordre
du plan, puis TRIA de développement. Chaque cas contient `id`, `game`,
`baseline:{path,sha256}`, `trace:{path,sha256}` ; schéma
`logos-engine.recorded-public-regression-cases.v1`. Les baselines/traces restent
les octets effectivement retenus dans `planning/regression-plan.json`, sans
promotion silencieuse d’un rapport plus récent. Le cas TRIA peut garder l’id
`tria-development-4b`, donnant le chemin de rapport ci-dessous. Aucune exigence
d’acquisition passive Relative ne doit être ajoutée.

```bash
python -B scripts/run-released-public-regressions-streamlog.py \
  "$LOT4B_CASES" "$LOT4B_FREEZE" \
  --source-manifest "$LOT4B_FREEZE/source-manifest.json" \
  --node-old-space-mib 1536 --timeout-seconds 2400

python -B scripts/compare-relative-arrangement-public-parity.py \
  "$LOT4B_FREEZE/regressions/tria-development-4b-replay.json.gz" \
  --output "$LOT4B_PARITY"

node --expose-gc --max-old-space-size=1536 \
  scripts/replay-native-partial-public-regression.mjs \
  docs/migration/lot7a-evidence/integrated-final/lkey-campaign.json.gz \
  docs/migration/lot7a-evidence/integrated-final/lkey-public-trace.json.gz \
  "$LOT4B_FREEZE/source-manifest.json" "$LOT4B_PARTIAL_DIR" \
  --contract "$LOT4B_PARTIAL_CONTRACT"
```

Le driver strict produit `regressions/regression-summary.json` et les reçus de
chaque ligne. Si les huit cas passent, le compte est 8 cas/136 contrôles ; ne
l’annoncer qu’après leur reçu. La parité finale doit porter sur ce **nouveau
rejeu TRIA gelé** et conserver les 1 786 originaux, les gardes, les acquisitions
sélectionnées, tous les préfixes et toutes les ablations. Ses nombres de calls
et records sont dérivés, pas fixés à 68/17.

LKEY reste séparé : contrat 25 commandes, 26 paquets, 25 préfixes, frontières aux
actions 16 et 24, deux niveaux terminés et `frontier_unknown`. Exiger
`qualification.json.status=partial_trajectory_preserved` **et** les campagnes
brutes `failed`, sans cible atteinte. Les empreintes du contrat couvrent runner,
helper fusionné capturant Workshop, service, protocole et deux déclarations
originales. Les gardes de heap ci-dessus concernent les replays seulement ; ne
les transférer ni à `NODE_OPTIONS` ni au coût officiel.

## 4. Navigateur et intégrité fonctionnelle avant readiness

Le reçu navigateur doit être nouvellement observé sur le build final. Champs
communs : schéma `logos-engine.relative-arrangement-browser-qa.v1` ou
`logos-engine.browser-qa.v1`, `nativeVersion`, `nativeSourceDigest`.

- Si `passed` : jeu TRIA froid, startLevel 1, aucun état injecté, cible 3,
  `targetMet` cohérent, Pause et une action réellement observées, artefacts
  empreintés et `startedAt`/`finishedAt` réels ; `cumulativeGameCaseSeconds`
  doit être le cumul après la continuation QA séparée décrite ci-dessous.
- Si `blocked_infrastructure` : `browserGameActions:0`,
  `verifiedFunctionalChecks:[]`, `attempts` non vide, `qualification` explicite,
  empreintes exactes `sourceManifest` et `buildReceipt`. Aucun succès fonctionnel
  navigateur ne peut être déduit de ce statut.

La readiness attend `docs/migration/lot4b-evidence/tria-case-resolution.json`
inchangé, avec `clockReset:false`, ses 374.14091 secondes cumulées et son résultat
live initial 17 actions/3 niveaux. Le rejeu final n’est pas une nouvelle réussite
live. Pour la QA navigateur finale, démarrer un intervalle réel avant la première
tentative ; cet intervalle couvre toutes ses tentatives et reprises sans reset.
Ne pas y inclure l’attente entre la résolution initiale et ce début de QA.

Le reçu séparé de continuation porte le schéma
`logos-engine.relative-arrangement-browser-qa-continuation.v1`, `status:completed`,
`game:TRIA`, `scope:continuous_final_browser_qa_interval`,
`initialCaseStatus:target_three_levels_achieved`, `clockReset:false`,
`maximumCumulativeSeconds:2400`. Il épingle `initialResolution`, `sourceManifest`
et `browserReceipt`, avec `browserStatus` égal au statut réel. Ses `startedAt`
et `finishedAt` désignent exactement l’intervalle du reçu navigateur, après
`resolvedAt` initial. `cumulativeBeforeSeconds` égale exactement le cumul initial ;
`elapsedSeconds` égale l’écart entre ces deux horodatages ;
`cumulativeAfterSeconds = cumulativeBeforeSeconds + elapsedSeconds <= 2400`.
La comparaison utilise Decimal sans marge ajoutée. Le reçu navigateur porte ce
même total après QA. Le détail et le template non exécutable sont dans
`planning/browser-qa-continuation-correction.md`.

Une QA finale `passed` sans continuation est refusée. Un blocage d’infrastructure
avec zéro action peut rester sans continuation et conserve alors le total
initial ; si une continuation est fournie, elle subit les mêmes contrôles.

```bash
python -B scripts/evidence-byte-parts.py pack "$LOT4B_FREEZE"
python -B scripts/verify-native-delivery.py "$LOT4B_FREEZE" \
  --validation-directory validation --require-regressions \
  --receipt "$LOT4B_PARITY" --receipt "$LOT4B_BROWSER" \
  --receipt "$LOT4B_PARTIAL_DIR/qualification.json"
```

Sortie exclusive : `$LOT4B_FREEZE/delivery-integrity.json`. Ses reçus additionnels
sont empreintés par l’outil officiel, pas requalifiés ; readiness vérifie ensuite
leurs contrats. Conserver les gzip originaux après découpage.

## 5. Protocole, captures et contrat structurel avant coût

Le reçu `planning/cost-tool-review.json` reste historique et doit être conservé
avec `planning/cost-tool-review-text-addendum.json` pour la correction textuelle unique du protocole. Ne changer
aucun calcul, règle ou outil après la déclaration suivante.

```bash
python -B docs/migration/lot4b-evidence/prepare-cost-protocol.py \
  --finalize --owner-cost-qualification --baseline-checkout "$LOT4B_BASELINE" \
  --baseline-site-version "$LOT4B_SITE" --candidate-version "$LOT4B_VERSION" \
  --output-directory "$LOT4B_PERF" --candidate-source-directory "$LOT4B_FREEZE" \
  --baseline-manifest "$LOT4B_BASELINE_MANIFEST"
node docs/migration/lot4b-evidence/record-cost-owner-source-inventory.mjs \
  "$LOT4B_BASELINE" "$LOT4B_PERF/owner-source-inventory.json"
node docs/migration/lot4b-evidence/capture-cost-owner-graphs.mjs \
  baseline "$LOT4B_BASELINE" "$LOT4B_PERF/cases.json" \
  "$LOT4B_BASELINE_MANIFEST" "$LOT4B_PERF/owner-graphs-baseline.json.gz"
node docs/migration/lot4b-evidence/capture-cost-owner-graphs.mjs \
  candidate "$PWD" "$LOT4B_PERF/cases.json" \
  "$LOT4B_FREEZE/source-manifest.json" "$LOT4B_PERF/owner-graphs-candidate.json.gz"
node docs/migration/lot4b-evidence/qualify-cost-owner-graphs.mjs \
  "$LOT4B_PERF/owner-graphs-baseline.json.gz" "$LOT4B_PERF/owner-graphs-baseline.receipt.json" \
  "$LOT4B_PERF/owner-graphs-candidate.json.gz" "$LOT4B_PERF/owner-graphs-candidate.receipt.json" \
  "$LOT4B_PERF/owner-structural-attribution.json" "$LOT4B_PERF/owner-structural-fixture.json"
python -B docs/migration/lot4b-evidence/prepare-owner-cost-contract.py \
  --finalize --performance-directory "$LOT4B_PERF" \
  --owner-inventory "$LOT4B_PERF/owner-source-inventory.json" \
  --structural-fixture "$LOT4B_PERF/owner-structural-fixture.json"
python -B docs/migration/lot4b-evidence/check-cost-static-inputs.py \
  --performance-directory "$LOT4B_PERF"
```

Les captures sont fonctionnelles et antérieures à la mesure : 4 sessions/31
actions par côté. Elles attribuent les deltas réellement observés ; aucune
formule `+3` ou `3+cycles` n’est présumée. Un écart non attribué arrête la chaîne.

## 6. Readiness : arguments et reçus obligatoires

Après accord réel des autres lanes, terminer les calculs suivis et arrêter la
preview. Écrire `$LOT4B_PERF/coordinated-isolation.json` à partir de cet accord :
`status:"acknowledged_quiet_before_window"`, `otherLaneAcknowledged:true`,
`ownTrackedComputeEnded:true`, `previewStopped:true`,
`costNodeOptionsOverride:null`, avec les empreintes des preuves d’accord dans
`evidence`. La seule visibilité des processus ne prouve pas l’exclusivité.

```bash
LOT4B_BROWSER_QA_ARGS=()
if [[ -n "${LOT4B_BROWSER_QA_CONTINUATION:-}" ]]; then
  LOT4B_BROWSER_QA_ARGS=(--browser-qa-continuation "$LOT4B_BROWSER_QA_CONTINUATION")
fi
python -B docs/migration/lot4b-evidence/finalize-cost-readiness.py \
  --performance-directory "$LOT4B_PERF" \
  --candidate-source-directory "$LOT4B_FREEZE" \
  --validation-directory validation \
  --parity-receipt "$LOT4B_PARITY" --browser-receipt "$LOT4B_BROWSER" \
  "${LOT4B_BROWSER_QA_ARGS[@]}" \
  --game TRIA \
  --case-resolution docs/migration/lot4b-evidence/tria-case-resolution.json \
  --partial-regression-receipt "$LOT4B_PARTIAL_DIR/qualification.json"
```

`--audit-receipt PATH` est facultatif et réservé à une résolution réelle du
migration-audit : `status:passed`, `exitCode:0`, `nativeSourceDigest` final,
`output` empreinté, `audit` égal à la sortie et `audit.failures:[]`. Sans cette
option, le JSON du check migration-audit est lu directement. `--case-checkpoint`
est un alias de `--case-resolution`. Le chemin `--validation-directory` est
relatif au gel et doit y rester. Omettre LKEY seulement s’il n’appartient pas au
périmètre final, jamais pour écarter un résultat défavorable.

| Prérequis attesté | Fichiers consommés par readiness |
| --- | --- |
| Identités A/B et protocole antérieurs à la fenêtre | Sous perf : `declaration.json`, `global-budget-policy.json`, `preparation.json`, `protocol-check.json`, et tous les fichiers/outils qu’ils épinglent. |
| Gel/archive/source courants | Sous gel : `source-manifest.json`, `source-archive.json`, `source-archive-parts.json`, archive et fichiers natifs actuels. |
| Tests et cinq gates | Sous gel/validation : `delta-tests-run.json`, `checks-run.json`, sorties de chaque check et worker. Tests Relative référence/intégration obligatoirement présents. |
| Régressions strictes | `regressions/regression-summary.json`, manifeste de cas et chaque baseline/trace/report/comparison/execution/output/passive-owner-presence lié. |
| Intégrité déjà acquise | `delivery-integrity.json`, générateur, helpers et reçus liés inchangés. |
| TRIA/parité/horloge | `--parity-receipt`, campagne finale qu’il épingle, comparateur original inchangé, manifeste des 1 786 sources, `--case-resolution` initiale inchangée. |
| Navigateur | `--browser-receipt`, build et manifeste exacts, artefacts/qualification selon statut réel ; `--browser-qa-continuation` obligatoire pour une QA finale passing, avec intervalle exact et total initial + durée QA. |
| LKEY séparé | `--partial-regression-receipt`, contrat pré-déclaré, inputs avant/après, campagne et trace failed, journaux et contrôles exacts. Hors totaux stricts. |
| Structure pré-déclarée | Sous perf : `owner-growth-contract.json`, inventaire owner/programme, fixture, attribution, captures et reçus ; SHA/outils exacts et chronologie avant contrat. |
| Vérification statique et isolation | Sous perf : `static-preflight.json` sans exigence insatisfaite, `coordinated-isolation.json` fondé sur un accord effectif. |

Sortie : `$LOT4B_PERF/readiness.json`, `status:ready`,
`measurementAuthorized:true`, `pendingRequirements:[]`. Un reçu existant, une
fenêtre déjà commencée ou un protocole superseded est refusé.

## 7. Fenêtre ABBA, puis comparateurs historiques

Uniquement après autorisation du créneau exclusif, avec environnement déclaré
sans override `NODE_OPTIONS`, sans preview ni autre charge :

```bash
python -B scripts/run-native-cost-window.py "$LOT4B_BASELINE" "$LOT4B_PERF" \
  "$LOT4B_BASELINE_MANIFEST" "$LOT4B_FREEZE/source-manifest.json"
node scripts/compare-native-loop-costs.mjs "$LOT4B_PERF/comparison-policy.json" \
  "$LOT4B_PERF/cohort1/baseline.json" "$LOT4B_PERF/cohort1/after.json" "$LOT4B_PERF/cohort1/comparison.json"
node scripts/compare-native-loop-costs.mjs "$LOT4B_PERF/comparison-policy.json" \
  "$LOT4B_PERF/cohort2/baseline.json" "$LOT4B_PERF/cohort2/after.json" "$LOT4B_PERF/cohort2/comparison.json"
node scripts/compare-native-cost-cohorts.mjs "$LOT4B_PERF/comparison-policy.json" \
  "$LOT4B_PERF/cohort1/baseline.json" "$LOT4B_PERF/cohort1/after.json" "$LOT4B_PERF/cohort1/comparison.json" \
  "$LOT4B_PERF/cohort2/baseline.json" "$LOT4B_PERF/cohort2/after.json" "$LOT4B_PERF/cohort2/comparison.json" \
  "$LOT4B_PERF/combined-comparison.json"
```

Le driver produit A1/B1/B2/A2 : 32 sessions/400 actions mesurées, 8 chauffes/24
actions exclues. Conserver les quatre journaux bruts et tous les rapports. Les
comparateurs de cohortes peuvent produire `budget_review_required` : conserver
ces diagnostics et leur code réel. Ne pas utiliser `&&` pour masquer les étapes
suivantes après un simple dépassement de phase.

**Envelopper la dernière commande avec un journal durable et un reçu de son
exécution réelle**, sans pipe qui perde le code de sortie. Pour la branche
complémentaire, le consommateur exige `$LOT4B_PERF/aggregation-failure.log` et
`aggregation-failure.json`, schéma `logos-engine.retained-tool-failure.v1` :
`command` égale exactement l’argv ci-dessus, `startedAt`, `finishedAt`, code
`exitCode` non nul réellement observé, `inputsUnchanged:true`,
`outputExists:false`, `log:{path,bytes,sha256}`, et `inputs` ordonnés : outil
strict, politique, A1, B1, comparaison1, A2, B2, comparaison2. Capturer leurs
empreintes avant/après ; le journal doit contenir le refus réel
`Within-cohort work metadata changed`. Ne jamais créer ce reçu à partir d’une
attente. Un autre résultat impose une revue et reste conservé ; aucune sortie
stricte ne doit être effacée ou reclassée.

## 8. Analyse complémentaire, rendu et clôture d’intégrité

```bash
node docs/migration/lot4b-evidence/consolidate-owner-costs.mjs \
  "$LOT4B_PERF/owner-growth-contract.json" "$LOT4B_PERF/owner-growth-comparison.json"
python -B docs/migration/lot4b-evidence/review-owner-costs.py \
  "$LOT4B_PERF/owner-growth-contract.json" "$LOT4B_PERF/owner-growth-comparison.json" \
  "$LOT4B_PERF/owner-growth-review.json"
python -B docs/migration/lot4b-evidence/record-cost-log-transport.py "$LOT4B_PERF"
python -B docs/migration/lot4b-evidence/write-cost-results.py --performance-directory "$LOT4B_PERF"
python -B scripts/evidence-byte-parts.py pack "$LOT4B_PERF"
```

La revue indépendante doit passer **et** accepter les deux médianes globales
strictement sous +10 %. Son statut arithmétique passé seul n’autorise pas la
publication. Les seize diagnostics agrégés, les trente-deux diagnostics de
cohortes, chaque échantillon et la qualification structurelle restent visibles.

Le nouveau wrapper ci-dessous est préparé séparément des onze outils coût. Sa
lecture source indépendante n’a relevé aucun blocage statique ; son contrôle de
syntaxe reste à faire **après release**, avant son premier usage. Aucun main ni
syntax-check n’a été lancé pendant quiet.

```bash
python -B docs/migration/lot4b-evidence/verify-publication-inputs.py \
  --directory "$LOT4B_FREEZE" --performance "$LOT4B_PERF"
```

Il réemploie les fonctions inchangées de `scripts/verify-native-delivery.py` et
écrit uniquement `$LOT4B_FREEZE/publication-inputs.json`. Il vérifie à nouveau
inventaires natifs/source/tests/build/régressions, archive, 1 786 originaux,
transports du gel et du coût, générateurs et entrées avant/après, puis lie la
chaîne de coût acceptée. **Ne pas relancer le main officiel sur le même gel pour
écraser `delivery-integrity.json`.** Qualification du nouveau reçu :
`same executed inputs, no new functional execution`. Le refus strict et les
limites LKEY/navigateur restent conservés. Ce reçu n’affirme pas une publication :
root conserve ensuite la provenance commit/archive et le déploiement terminal
réel via Sites, sans publication intermédiaire ni changement du build vérifié.
