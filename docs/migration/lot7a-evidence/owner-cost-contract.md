# Lot 7A : contrat complémentaire de coût des propriétaires

## Portée et limite avant mesure

Ces nouveaux outils analysent uniquement les rapports conservés de la future
fenêtre 7A. Ils ne lancent ni moteur, ni jeu, ni mesure. Les sept outils
historiques, leurs reçus et les données brutes restent inchangés. Le refus
historique `Within-cohort work metadata changed` est une entrée obligatoire,
jamais une réussite réinterprétée.

Le contrat **v2** exige des captures fonctionnelles A/B sans chronométrage,
produites sur les sources gelées avant le contrat et la fenêtre officielle.
Leur qualification causale examine les graphes reconstruits et attribue les
nœuds supplémentaires à Workshop ou aux frontières effectivement observées.
Une fixture liée par SHA-256 conserve ensuite les formes exactes de quatre
parcours. Chaque essai de coût, chauffe comprise, doit reproduire la forme de
sa propre version. Aucune valeur n'est ajustée après observation des coûts.

Le brouillon v1 à deltas constants n'a pas été exécuté. Il est remplacé par v2 :
les événements conservés aux frontières et l'état observé de Workshop rendent
injustifiée la règle générale `+3` nœuds / `3 + cycles` révisions. Les trois
nœuds d'installation listés dans le contrat ne décrivent pas tous les nœuds
dynamiques ajoutés au cours d'une session.

L'attribution porte sur les graphes des captures fonctionnelles. La concordance
des formes mesurées ne prouve pas rétrospectivement le contenu des feuilles
privées des graphes des essais de coût, que le harnais historique ne conserve
pas. Cette limite reste distincte du contrôle strict des métadonnées et du
calcul des durées.

## CLI et fichiers

Depuis la racine du checkout, après fenêtre complète, comparaisons de paires
et conservation du refus strict réel :

```bash
node docs/migration/lot7a-evidence/consolidate-owner-costs.mjs \
  docs/migration/lot7a-evidence/performance-integrated/owner-growth-contract.json \
  docs/migration/lot7a-evidence/performance-integrated/owner-growth-comparison.json

python -B docs/migration/lot7a-evidence/review-owner-costs.py \
  docs/migration/lot7a-evidence/performance-integrated/owner-growth-contract.json \
  docs/migration/lot7a-evidence/performance-integrated/owner-growth-comparison.json \
  docs/migration/lot7a-evidence/performance-integrated/owner-growth-review.json
```

Les sorties sont exclusives. Une erreur produit un diagnostic sur stderr et
aucun reçu de réussite. Aucun de ces fichiers futurs n'est créé par cette note.
Les empreintes `fp` ci-dessous sont exactement des objets
`{ "path": "chemin/relatif", "bytes": 123, "sha256": "64 caractères hexadécimaux" }`.
Les chemins sont relatifs au checkout. Les entrées explicitement externes des
captures et de la fenêtre peuvent utiliser un chemin absolu, notamment pour le
checkout baseline gelé ; leurs octets sont également revérifiés.

## Schéma du contrat

```text
schema: logos-engine.lot7a-owner-cost-contract.v2
lot: 7A
declaredAt: ISO avec fuseau
performanceDirectory: chemin relatif du nouveau dossier de fenêtre
declaration: fp de declaration.json
tools:
  consolidator: fp de docs/migration/lot7a-evidence/consolidate-owner-costs.mjs
  reviewer: fp de docs/migration/lot7a-evidence/review-owner-costs.py
structuralExpectation:
  ownerId: public_ranked_workshop
  programId: v6.ranked_workshop.choose
  installedNodeIds:
    - family_state:public_ranked_workshop
    - family_activation:public_ranked_workshop
    - program:v6.ranked_workshop.choose
  allowedPaths:
    - observations[*].nodeCount
    - inspection[*].graphNodes
    - final.nodeCount
    - final.graphRevision
  mode: predeclared_functional_fixture
  qualification: functional_structure_frozen_before_measurement
sourceEvidence:
  - fp de src/logos-engine/v6-native-runtime.ts
  - fp de src/logos-engine/v6-ranked-workshop.ts
  - fp de src/logos-engine/v6-knowledge-store.ts
ownerInventory: fp du reçu d'inventaire source ci-dessous
structuralFixture: fp de la fixture fonctionnelle ci-dessous
strictFailureReceipt: chemin relatif du reçu d'échec strict réel
strictFailureLog: chemin relatif de son journal complet
historicalAggregateOutput: PERFORMANCE_DIRECTORY/combined-comparison.json
```

L'inventaire source porte le schéma
`logos-engine.lot7a-owner-cost-source-inventory.v1`, `recordedAt`,
`nativeDigests: {baseline, candidate}`,
`programScope: "family-installed programs"`,
`owners: {baseline: [ids], candidate: [ids]}` et
`programs: {baseline: [workflowIds], candidate: [workflowIds]}`.
Les listes proviennent des fabriques réellement gelées ; elles ne contiennent
aucun doublon. Les seules additions admises sont le propriétaire et son
workflow déclarés ; aucun retrait n'est admis. Les programmes communs hors
familles restent hors du périmètre explicitement nommé.

## Fixture fonctionnelle et preuves d'attribution

```text
schema: logos-engine.lot7a-owner-cost-structural-fixture.v1
status: qualified_functional_structure
recordedAt: ISO avec fuseau
nativeDigests: {baseline, candidate}
cases: fp
captureTool: fp
captures:
  baseline: {report: fp, receipt: fp}
  candidate: {report: fp, receipt: fp}
attribution: fp
forms:
  - {case: STCK, form: warmup, baseline: SHAPE, candidate: SHAPE}
  - {case: STCK, form: measured, baseline: SHAPE, candidate: SHAPE}
  - {case: SMLP, form: warmup, baseline: SHAPE, candidate: SHAPE}
  - {case: SMLP, form: measured, baseline: SHAPE, candidate: SHAPE}
```

L'ordre ci-dessus est exact. Les chauffes utilisent trois actions ; les formes
mesurées utilisent dix actions pour STCK et quinze pour SMLP. Les inspections
terminales sont de vraies requêtes du service : aucune pour une chauffe,
trois pour une forme mesurée. Les retours publics sont fournis seulement après
concordance de la commande native avec la commande attendue de la trace.

La forme `SHAPE` ne contient aucune durée :

```text
actions, cycles, levelsCompleted
requests: [{type, sequence, kind, actions}]
observations: [{type, sequence, family, proposalKind, poseMode,
                actions, cycles, levelsCompleted, nodeCount, acquiredTransitions}]
inspection: [{graphNodes}]
final: {actions, levelsCompleted, reason, graphRevision, nodeCount,
        acquiredTransitions, implementation}
```

Chaque champ est conservé exactement, y compris `final.implementation` pour sa
propre version. Cette identité de version est omise de la comparaison A/B comme
dans la signature historique, et contrôlée séparément contre la déclaration.
Les valeurs des quatre chemins structurels proviennent exclusivement de la
fixture ; les autres champs A/B doivent être identiques. La fixture et la
déclaration officielle peuvent utiliser deux chemins de fichier de cas
distincts, mais leurs octets, tailles et SHA-256 doivent être identiques.

Chaque petit reçu de capture utilise :

```text
schema: logos-engine.lot7a-owner-cost-functional-capture-receipt.v1
status: captured_functional_structure
role: baseline | candidate
startedAt, finishedAt, nativeDigest
report: fp
generator: fp identique à fixture.captureTool
cases: fp
nativeSourceBefore, nativeSourceAfter: fp du même manifeste source fourni
nativeInventoryBefore, nativeInventoryAfter: {digest, fileCount, files}
nativeSourceUnchanged: true
inputsBefore, inputsAfter: listes identiques de fp
inputsUnchanged: true
generatorUnchanged: true
failures: []
sessions: [{case, form, shape: SHAPE, ...}]
sessionCount: 4
actions: 31
```

Les inventaires réels avant/après sont comparés aux cartes des manifestes
déclarés. Les empreintes des manifestes source sont vérifiées et doivent avoir
les mêmes octets que les manifestes déclarés. Les entrées de capture incluent
au moins le fichier de cas et le manifeste source. Les quatre formes du reçu
doivent être celles de la fixture, dans le même ordre. Le rapport de graphes
porte le schéma `logos-engine.lot7a-owner-cost-functional-capture.v1` ; les
analyseurs de coûts vérifient ses octets en streaming sans relire ses graphes.

Le reçu d'attribution utilise :

```text
schema: logos-engine.lot7a-owner-cost-structural-attribution.v1
status: qualified_functional_structure
recordedAt, nativeDigests
generator: fp du qualificateur
inputs: fp des deux rapports et deux reçus de capture, du captureTool,
        du fichier cases et des trois fichiers sourceEvidence au minimum
formsSha256: SHA-256 des formes canoniques
checkedCount: nombre strictement positif
checks: [{..., passed: true}]
nodeAttributions: registre non vide des attributions causales détaillées
```

`formsSha256` est le SHA-256 UTF-8 de `fixture.forms`, sérialisé en JSON compact
avec les clés de chaque objet triées récursivement, sans échapper les caractères
Unicode et sans modifier l'ordre des tableaux. Les compteurs sont entiers. Le
reçu d'attribution est écrit avant la fixture et lie ses formes par ce hash :
aucun cycle d'empreintes n'est nécessaire. Tous les fichiers de son générateur
et de ses entrées sont revérifiés. La présence d'un reçu au statut qualifié ne
dispense pas le qualificateur d'examiner chaque nouveau nœud et son origine.

## Liens préalables sans cycle d'empreintes

La déclaration historique v2 reçoit seulement l'annonce
`ownerCostQualification: {schema: "logos-engine.lot7a-owner-cost-qualification.v1", contractPath, tools}`.
Le protocole surveillé contient ce chemin de contrat et les deux SHA-256 des
outils. Le contrat finalisé ensuite lie la déclaration par son empreinte ; il
ne faut pas ajouter réciproquement son empreinte à cette déclaration.

Le contrôle statique conserve `ownerCostContract: fp` et
`ownerCostTools: {consolidator: fp, reviewer: fp}`. Les `inputs` de la readiness
lient au moins le contrat, le contrôle statique, la déclaration et les deux
outils. Les preuves source, l'inventaire et la fixture sont liés par le contrat.
Le contrat et ses preuves sont finalisés et committés avant la mesure.

L'ordre vérifié est :

1. Captures terminées, puis attribution, puis fixture, puis contrat.
2. Inventaire source daté au plus tard au contrat.
3. Déclaration finalisée, puis contrat, puis contrôle statique.
4. Readiness finalisée après le contrôle statique et strictement avant la fenêtre.
5. Fenêtre A1, B1, B2, A2 terminée ; refus strict conservé ensuite.
6. Consolidation complémentaire, puis revue Python indépendante.

Le contrôle exact de la fixture précède toute comparaison numérique de coût.
Une divergence de forme, un champ de travail supplémentaire différent, une
preuve absente ou une empreinte modifiée bloque l'analyse. Le contrat n'est
pas élargi pour accepter un résultat observé après la mesure.

## Reçu obligatoire du refus historique

Le schéma est `logos-engine.retained-tool-failure.v1`. Le reçu contient
`startedAt`, `finishedAt`, un `exitCode` entier non nul,
`inputsUnchanged: true`, `outputExists: false`, le `log: fp` complet et les
`inputs` dans l'ordre : outil historique, politique, baseline1, after1,
comparison1, baseline2, after2, comparison2. `command` est exactement :

```text
node scripts/compare-native-cost-cohorts.mjs POLICY BASELINE1 AFTER1 COMPARISON1 BASELINE2 AFTER2 COMPARISON2 HISTORICAL_OUTPUT
```

Le journal doit conserver l'assertion réelle
`Within-cohort work metadata changed`. L'agrégat historique doit rester absent.
Les outils complémentaires ne fabriquent pas ce reçu et ne remplacent aucun
fichier historique.
Le texte `qualification` du wrapper peut expliquer le refus conservé ; il ne
remplace ni le code de sortie ni le journal.

## Résultats et contrôles

L'agrégat porte le schéma `logos-engine.lot7a-owner-cost-consolidation.v2` et
le statut `qualified_consolidation_complete`. `phaseStatus` conserve séparément
`passed` ou `budget_review_required`. Les champs numériques de comparaison
historiques sont conservés : `comparisons[].metrics`, `withinObservedBudget`,
`budgetMetricCount`, `unresolved`, `includedMeasuredSessions`. Les données
d'inspection, de pause et de mémoire restent dans les rapports bruts et les
comparaisons de paires liés, sans synthèse substituée.

`structuralDifferences` énumère chaque emplacement autorisé, même si son delta
est nul, pour les chauffes et les sessions mesurées :

```text
cohort, case, round, warmup, path
before, after, delta
expectedBefore, expectedAfter, expectedDelta
rule: predeclared_functional_fixture
fixtureForm: {case, form: warmup | measured}
```

L'ordre du registre est cohorte 1/2, STCK/SMLP, round 0 à 4, puis chemin trié.
Aucune autre différence de signature de travail n'est admise. Les signatures
complètes, compteurs compris, doivent rester identiques entre répétitions et
cohortes de chaque version ; les chauffes sont comparées entre elles.

Le reviewer porte le schéma `logos-engine.lot7a-owner-cost-review.v2` et le
statut `qualified_owner_cost_review_passed`, avec `checks[].passed` et
`checkedCount`. Il recalcule indépendamment les métriques des deux cohortes et
de leur agrégat, les deltas, les effectifs et les décisions globales, puis les
compare aux résultats JavaScript. Il n'importe pas le consolidateur et ne
lance pas d'autre script. La dérivation des calculs depuis les outils
historiques est identifiée dans les sources et liée aux octets conservés.

La décision complémentaire utilise `accepted`, `acceptedCases`, `totalCases`,
`globalCases` et `diagnosticPhaseRule`. Les médianes s'appellent
`beforeMedianMs` et `afterMedianMs`, leur variation `medianRelativeIncrease`.
`globalStatus` vaut `accepted_under_predeclared_owner_cost_rule` ou
`global_budget_review_required`. Le refus historique reste explicitement
`historicalStrictPassed: false` dans la revue et `historicalStrict.passed: false`
dans l'agrégat. Un statut de revue arithmétique réussi n'implique pas une
acceptation globale si `accepted` est faux.

Le critère global reste, pour chacun des deux jeux, la médiane des huit durées
complètes B strictement inférieure à 1,1 fois celle des huit durées A. Le calcul
JavaScript utilise une comparaison décimale rationnelle ; Python utilise
`Decimal`. Toutes les 32 sessions et 400 actions mesurées sont conservées ;
seules les 8 chauffes et leurs 24 actions sont exclues des durées mesurées.
Les phases, p95 disponibles et dépassements restent visibles. Les durées ne
sont jamais corrigées du coût du propriétaire ajouté.

Cette livraison source n'est pas une exécution sur des mesures. La vérification
autorisée se limite aux analyses syntaxiques Node/Python ; elle n'établit ni
qualification des graphes fonctionnels ni résultat de coût pour 7A.
