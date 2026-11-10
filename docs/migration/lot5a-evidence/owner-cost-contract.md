# Lot 5A — Contrat préalable de coût du propriétaire temporel

## Statut de cette préparation

**Complément préalable désormais préparé :** les captures fonctionnelles A/B ont été conservées et la première attribution a échoué sur les métadonnées du premier créateur d'un fragment partagé. Cet échec reste inchangé. La [qualification étroite des premiers créateurs](shared-fragment-premeasurement-qualification.md) explique les quatorze identités observées, le nouveau qualificateur v2 et le supplément explicite à lier au contrat et à la readiness avant toute mesure. Les huit outils et la présente note dans leur état initial sont conservés sous `performance/initial-preparation-tools/`. Les deux analyseurs numériques, la déclaration initiale et les quatre chemins autorisés ci-dessous restent inchangés.

Les fichiers voisins sont une adaptation source du contrat **7A v2 réellement utilisé pour `performance-integrated`**, de son qualificateur de graphes et de ses analyseurs. Ils sont propres au lot 5A. Cette préparation n'est ni une exécution de ces outils ni un reçu de conformité syntaxique, structurelle ou numérique.

La référence à remesurer sera la **publication finale native 0.52.0**. Son numéro de Site, son commit et son manifeste doivent être fournis à partir de la publication effective. Aucune identité présumée, durée ancienne, capture 7A ou décision 4A ne fournit les attentes du lot 5A. Le candidat sera identifié par son propre gel et son archive après fusion. Aucun contrat final, fixture, reçu de capture ou verdict 5A n'est créé par la présente note.

La publication 4A a conservé un échec de consolidation stricte, puis une qualification distincte de l'ajout de Feedback établie après mesure. Le modèle 7A v2 améliore cette chronologie : **captures fonctionnelles, attribution et fixture sont arrêtées avant toute mesure de coût**. C'est cette chronologie préalable qui est reprise ici.

## Périmètre structurel attendu

Le seul propriétaire ajouté relativement à la référence fusionnée est `linked_temporal_preparation`. Il utilise l'entrée source `LinkedPreparation → LinkedContact`; il n'installe aucun workflow distinct. Les deux installations attendues sont :

- `family_state:linked_temporal_preparation` ;
- `family_activation:linked_temporal_preparation`.

L'inventaire des propriétaires doit montrer exactement cette addition et aucun retrait. L'inventaire des programmes installés par les familles doit rester inchangé, sans retirer les programmes de Feedback ou de Workshop déjà présents dans la référence publiée. Les programmes communs installés lors de l'initialisation restent dans les graphes capturés ; l'inventaire des fabriques annonce explicitement son périmètre plus étroit.

L'acquisition temporelle est **passive sur les deux traces de coût déclarées**. Elle conserve les véritables transitions publiques de chaque préfixe scellé, son état de phase et les fragments nécessaires. Un retour non vide peut créer un fait `linked_preparation_event:<revision BEFORE>` dont la valeur est la liste source brute. Un retour passif vide n'autorise pas de fait vide. Aucun fait synthétique `observed_*_state` ni programme supplémentaire n'est admis par le qualificateur.

Le nombre de nœuds et de révisions supplémentaires n'est pas une constante. Les rasters courants, les frontières, les états acquis et les fragments à contenu adressé déterminent la croissance réelle. Aucune formule « installations plus nombre de cycles » ne remplace la capture de ces valeurs.

Les différences de travail A/B admissibles sont limitées aux quatre chemins suivants :

| Chemin | Justification préalable |
| --- | --- |
| `observations[*].nodeCount` | Installations et connaissances du nouveau propriétaire attribuées dans les graphes. |
| `inspection[*].graphNodes` | Même graphe lors des trois inspections terminales réelles. |
| `final.nodeCount` | Comptage terminal de tous les nœuds réellement présents. |
| `final.graphRevision` | Nombre exact des deltas supplémentaires attribués. |

Chaque valeur A et B, chauffe comprise, provient d'une fixture fonctionnelle gelée avant les coûts. Les autres champs des signatures de travail restent exacts entre versions ; toutes les répétitions d'une même version doivent reproduire sa forme exacte. `final.implementation` est contrôlé contre l'identité de sa propre version, comme dans le protocole historique.

## Attribution des graphes et portée de la preuve

Le capturateur démarre quatre sessions froides par version, sans checkpoint ni état appris : STCK chauffe, STCK forme mesurée, SMLP chauffe, SMLP forme mesurée. Il demande les véritables commandes à la boucle commune et ne fournit le retour public archivé qu'après leur concordance. Les formes mesurées effectuent les mêmes trois inspections terminales que le harnais de coût. Aucun temps n'est produit et aucune de ces sessions ne devient une session de coût.

La capture conserve tous les deltas nécessaires pour reconstruire chaque graphe, l'ordre des requêtes, les tickets, les retours publics et les appels réels du propriétaire ajouté. L'instrumentation enregistre `recordSource` sans changer ses arguments ni son résultat. Elle observe aussi les valeurs immuables rendues par les appels réels de `nativeState`; elle ne déclenche pas d'appel de checkpoint supplémentaire.

Le qualificateur vérifie :

1. La chaîne complète des hashes Kernel, les révisions, causes, identités, portée et profil de stockage de chaque delta.
2. Le lien entre chaque commande native, sa projection publique et le retour de la trace fourni ensuite.
3. Un seul appel passif temporel par transition, l'ordre des événements, le témoin de score, le snapshot AFTER et la remise à zéro effective à une frontière.
4. L'identité de chaque racine d'état temporel avec un checkpoint réellement produit par son propriétaire.
5. Le lien de tout fait `linked_preparation_event` avec le retour brut non vide d'un appel réellement enregistré.
6. La provenance de tout fragment supplémentaire depuis une racine temporelle, un fait attribué ou l'index de mémoire qui les contient, y compris une racine antérieure conservée dans un delta.
7. L'absence de retrait d'un nœud préexistant et la conservation des métadonnées, de l'ordre, des causes et des identités des deltas communs, hors leur digest de source déclaré.
8. L'égalité des autres métadonnées de travail, puis l'exactitude des formes de chauffe et de session complète qui seront vérifiées lors de chaque essai chronométré.

La v2 applique un registre fermé aux quatorze fragments terminaux dont le nouveau propriétaire a effectivement créé le contenu plus tôt. Elle compare leurs valeurs complètes, adresses et tous les autres champs ; conserve les deux causes et identités de source ; exige la provenance exclusive `phase.masks` avant le rattrapage et les valeurs encodées intégrales des racines communes au point A. Le nombre de deltas supplémentaires est le cumul réel B moins les créations A appariées explicitement, sans décrémenter le cumul B. Tous les autres contrôles restent stricts. La v1 et son échec sont conservés ; la v2 écrit un reçu distinct.

Le lot 5A modifie le batching du Kernel et du magasin. Le qualificateur lie donc ces deux validateurs **à leur propre gel A ou B**, au lieu d'exiger artificiellement des fichiers identiques. Les codecs de valeurs, le format du graphe, les primitives de hash et les autres validateurs déclarés communs doivent rester identiques. Les hashes des deux sources de validation sont conservés parmi les entrées du reçu.

Cette attribution conserve les graphes complets des captures fonctionnelles. Elle ne prétend pas rendre identiques toutes les feuilles privées des graphes A et B et ne fournit pas rétrospectivement les feuilles privées des essais de coût, que le harnais historique n'enregistre pas. Les champs publics exacts, les métadonnées communes vérifiées et les contenus supplémentaires attribués constituent la portée déclarée. Toute différence supplémentaire bloque la qualification ; aucune tolérance ne peut être élargie à partir des temps observés.

## Outils 5A et entrées nécessaires

| Fichier | Entrées principales | Sortie exclusive, à produire ultérieurement |
| --- | --- | --- |
| `record-owner-source-inventory.mjs` | Checkout publié A ; fabrique du candidat B | Inventaire réel des propriétaires et programmes des deux gels. |
| `capture-cost-owner-graphs.mjs` | Rôle A/B, checkout, cas et manifeste de ce rôle | Capture compressée et reçu de capture ; quatre sessions et 31 actions par rôle. |
| `qualify-cost-owner-graphs.mjs` | Deux captures et leurs reçus | Attribution causale et fixture des quatre formes. |
| `prepare-cost-protocol.py` | Identité publiée A, gel/archive B et outils conservés | Protocole, politique globale, déclaration et contrôle de protocole. |
| `finalize-owner-cost-contract.py` | Déclaration, inventaire, fixture et attribution déjà finalisés | `owner-growth-contract.json` lié à leurs empreintes. |
| `check-cost-static-inputs.py` | Tous les fichiers précédents, gels et archive | `static-preflight.json`, distinct de la readiness fonctionnelle. |
| `consolidate-owner-costs.mjs` | Contrat, fenêtre complète, comparaisons de paires et refus strict réel | Agrégat qualifié de schéma 5A, avec résultats de phase et règle globale. |
| `review-owner-costs.py` | Même contrat, agrégat et données brutes | Revue Python indépendante des preuves, formes et calculs. |

Les entrées à renseigner et à conserver sont :

- Le checkout de la **native 0.52.0 effectivement publiée**, son Site, son commit, son manifeste source et la preuve que ses sources correspondent au commit.
- Le manifeste source du candidat fusionné, son archive, son identité d'implémentation réelle et les résultats fonctionnels associés.
- Les cas STCK10/SMLP15, les deux traces publiques, la politique historique des phases et les sept outils historiques inchangés, avec leurs empreintes conservées.
- Les deux rapports de capture, leurs reçus, l'inventaire des propriétaires et programmes, le reçu d'attribution et la fixture des quatre formes.
- Les sept preuves source de l'ajout : runtime, préparation, contact, phase, aides temporelles, magasin et Kernel. Le manifeste complet continue de lier tous les autres fichiers du gel.
- La déclaration, le protocole, le contrat, le contrôle statique et la readiness réelle incluant l'acquittement de la fenêtre exclusive.

La readiness ne peut pas être déduite d'un contrôle de fichiers : elle conserve séparément tests, compilation, rejeux requis, limitations fonctionnelles, fermeture du preview et accord des autres fils.

Les chemins absolus des entrées du checkout baseline restent conservés comme tels dans les captures et leur attribution. Les deux analyseurs 5A appliquent le vérificateur d'entrées externes aux deux listes, avec contrôle de taille, SHA-256 et stabilité finale. Cette correction d'entrée/sortie est intégrée avant le gel 5A ; elle ne modifie aucune métrique ni différence structurelle admissible. Le préflight confine ces entrées aux deux checkouts déclarés.

## Contrat final attendu

Le finaliseur est volontairement bloquant tant que les entrées réelles n'existent pas. Il ne crée ni valeurs attendues ni captures. Le schéma final est :

```text
schema: logos-engine.lot5a-owner-cost-contract.v2
lot: 5A
declaredAt: horodatage avec fuseau
performanceDirectory: nouveau dossier de fenêtre dans lot5a-evidence
declaration: {path, bytes, sha256}
tools:
  consolidator: {path, bytes, sha256}
  reviewer: {path, bytes, sha256}
structuralExpectation:
  ownerId: linked_temporal_preparation
  programId: null
  installedNodeIds:
    - family_state:linked_temporal_preparation
    - family_activation:linked_temporal_preparation
  allowedPaths:
    - observations[*].nodeCount
    - inspection[*].graphNodes
    - final.nodeCount
    - final.graphRevision
  mode: predeclared_functional_fixture
  qualification: functional_structure_frozen_before_measurement
sourceEvidence: empreintes des sept fichiers déclarés
ownerInventory: {path, bytes, sha256}
structuralFixture: {path, bytes, sha256}
premeasurementAttributionSupplement: {path, bytes, sha256}
initialQualificationFailure: {path, bytes, sha256}
strictFailureReceipt: chemin du futur refus historique réel
strictFailureLog: chemin de son journal intégral
historicalAggregateOutput: chemin de combined-comparison.json, absent si refus strict
```

La déclaration annonce le chemin du contrat et les empreintes des deux analyseurs. Le contrat lie ensuite la déclaration par son empreinte. Il ne faut pas créer un cycle d'empreintes en ajoutant le hash du contrat à la déclaration déjà finalisée. Le préflight et la readiness lient le contrat complet.

La fixture porte `logos-engine.lot5a-owner-cost-structural-fixture.v1`. Ses `forms`, sans durée, sont ordonnées STCK chauffe, STCK mesuré, SMLP chauffe, SMLP mesuré. Elles contiennent actions, cycles, niveaux, requêtes, observations, inspections et état terminal exactement comme les signatures historiques. `formsSha256` est calculé sur le JSON compact à clés d'objets triées, Unicode non échappé et ordre des tableaux conservé. L'attribution est écrite avant la fixture et lie ce hash, sans dépendance circulaire.

## Chronologie après fusion et levée du silence

1. Fixer les identités A/B réelles et terminer les validations fonctionnelles nécessaires.
2. Geler sources, archive et outils ; préparer un nouveau dossier de coût et sa déclaration avec `--owner-cost-qualification`. Le helper copie les cas historiques exacts dans ce dossier.
3. Produire l'inventaire et les captures fonctionnelles A/B, puis l'attribution et la fixture. Aucun temps officiel ne doit exister.
4. Finaliser le contrat ; produire le préflight et la readiness après l'attribution complète. L'inventaire et les captures peuvent également précéder la déclaration si les cas exacts ont été préparés séparément ; ils doivent toujours précéder le contrat et la fenêtre.
5. Obtenir l'isolation réelle de la machine, puis exécuter les quatre séries A1/B1/B2/A2 avec le runner historique inchangé.
6. Conserver les deux comparaisons de paires et exécuter l'agrégateur strict inchangé. Conserver son refus réel s'il constate les différences de graphe attendues.
7. Exécuter la consolidation 5A et sa revue Python indépendante. Leur réussite arithmétique ne suffit pas à annoncer une acceptation numérique.

Exemples de commandes à renseigner **après cette préparation** :

```bash
python -B docs/migration/lot5a-evidence/prepare-cost-protocol.py --finalize --owner-cost-qualification --baseline-checkout BASELINE_CHECKOUT --baseline-site-version PUBLISHED_SITE --candidate-version CANDIDATE_VERSION --output-directory PERFORMANCE --baseline-manifest BASELINE_MANIFEST --candidate-source-directory CANDIDATE_FREEZE_DIRECTORY

node docs/migration/lot5a-evidence/record-owner-source-inventory.mjs BASELINE_CHECKOUT PERFORMANCE/owner-source-inventory.json

node docs/migration/lot5a-evidence/capture-cost-owner-graphs.mjs baseline BASELINE_CHECKOUT PERFORMANCE/cases.json BASELINE_MANIFEST PERFORMANCE/baseline-structure.json.gz
node docs/migration/lot5a-evidence/capture-cost-owner-graphs.mjs candidate CANDIDATE_CHECKOUT PERFORMANCE/cases.json CANDIDATE_MANIFEST PERFORMANCE/candidate-structure.json.gz

node docs/migration/lot5a-evidence/qualify-cost-owner-graphs.mjs PERFORMANCE/baseline-structure.json.gz PERFORMANCE/baseline-structure.receipt.json PERFORMANCE/candidate-structure.json.gz PERFORMANCE/candidate-structure.receipt.json PERFORMANCE/owner-structural-attribution.json PERFORMANCE/owner-structural-fixture.json

python -B docs/migration/lot5a-evidence/finalize-owner-cost-contract.py PERFORMANCE
python -B docs/migration/lot5a-evidence/check-cost-static-inputs.py --performance-directory PERFORMANCE
```

La première capture exige déjà un fichier de cas conforme et la copie des traces dans chaque checkout. Le finaliseur de protocole vérifie les octets historiques des cas ; il ne les redéfinit pas à partir des captures.

Pour les captures 5A déjà conservées, le complément préalable utilise les commandes distinctes suivantes, avant contrat/préflight/readiness :

```bash
python -B docs/migration/lot5a-evidence/declare-shared-fragment-supplement.py PERFORMANCE
node docs/migration/lot5a-evidence/qualify-cost-owner-graphs-v2.mjs PERFORMANCE/baseline-structure.json.gz PERFORMANCE/baseline-structure.receipt.json PERFORMANCE/candidate-structure.json.gz PERFORMANCE/candidate-structure.receipt.json PERFORMANCE/shared-fragment-premeasurement-supplement.json PERFORMANCE/owner-structural-attribution-v2.json PERFORMANCE/owner-structural-fixture.json
```

Le supplément et l'attribution v2 sont liés par empreintes. Le contrat référence le supplément et l'échec initial ; la readiness doit également contenir directement l'empreinte du supplément. Les analyseurs vérifient celui-ci parmi les entrées de l'attribution, y compris les chemins absolus des sources A.

## Fenêtre et règle globale conservées

Les sept outils historiques restent inchangés : `run-native-cost-window.py`, `measure-native-loop-costs.mjs`, `compare-native-loop-costs.mjs`, `compare-native-cost-cohorts.mjs`, `review-native-cost-consolidation.py`, `review-native-global-cost-window.py` et `review-native-global-cost-budget.py`. Le runner ne devient pas un outil propre au lot 5A.

La fenêtre conserve **32 sessions mesurées et 400 actions**, avec quatre sessions par jeu et série, huit par jeu/version, dans l'ordre A1/B1/B2/A2. Seules les **huit chauffes et leurs 24 actions** sont exclues. Toutes les valeurs extrêmes, cohortes défavorables et sorties d'incident restent conservées.

Pour chaque jeu séparément, la médiane des huit durées complètes B doit être **strictement inférieure à 1,1 fois** la médiane des huit durées A. Une égalité à +10 % échoue. Les ratios de cohorte ne sont pas moyennés, aucun jeu n'en compense un autre et les phases imbriquées ne sont pas additionnées. Les coûts du propriétaire ajouté restent entièrement inclus.

Les huit mesures historiques, dont `session_elapsed`, gardent leurs distributions et leurs seize diagnostics. Un dépassement de phase est acceptable seulement si la règle globale passe pour les deux jeux. Les p95 ne sont produits qu'à partir de vingt échantillons ; il n'y a pas de p95 annoncé pour huit durées de session. Inspection, Pause et mémoire restent dans leurs rapports distincts.

## Refus historique et résultats qualifiés séparés

L'agrégateur historique compare les compteurs de graphe A/B exactement et peut refuser avec `Within-cohort work metadata changed`. Le contrat 5A exige alors le véritable code de sortie non nul, le journal complet et les empreintes des entrées dans le schéma `logos-engine.retained-tool-failure.v1`. Les outils 5A ne fabriquent pas ce reçu. Le `combined-comparison.json` historique reste absent et le refus reste échoué.

La commande du refus conservé est exactement :

```text
node scripts/compare-native-cost-cohorts.mjs POLICY BASELINE1 AFTER1 COMPARISON1 BASELINE2 AFTER2 COMPARISON2 HISTORICAL_OUTPUT
```

Après conservation de ce refus et de toute la fenêtre :

```bash
node docs/migration/lot5a-evidence/consolidate-owner-costs.mjs PERFORMANCE/owner-growth-contract.json PERFORMANCE/owner-growth-comparison.json
python -B docs/migration/lot5a-evidence/review-owner-costs.py PERFORMANCE/owner-growth-contract.json PERFORMANCE/owner-growth-comparison.json PERFORMANCE/owner-growth-review.json
```

La consolidation qualifiée et la revue Python recalculent indépendamment les mêmes distributions, diagnostics, effectifs, deltas structurels et décisions globales. JavaScript utilise une comparaison décimale rationnelle du seuil et Python utilise `Decimal`. La revue ne lance aucun autre script et n'importe pas le consolidateur JavaScript.

Leur statut est propre à l'ajout qualifié du propriétaire ; `historicalStrictPassed` reste faux. Un résultat structurel différent de la fixture, un autre champ de travail différent, une empreinte changée ou une preuve manquante bloque l'analyse. Une revue arithmétique réussie conserve `accepted: false` si la règle globale échoue.

Cette mesure de rejeu de la boucle commune exclut le moteur de jeu, le réseau de production et le rendu navigateur. La résolution de WEAV au niveau 6, la performance sur des sessions plus longues et la portée effective des chemins continus exigent leurs propres preuves.
