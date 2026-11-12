# Lot 8B : filiation de BranchRouting

## Sources et base de travail

Le transfert vise la capacité générique `parallel_branch_routing` du V6 épinglé **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`**. Le propriétaire original est `BranchRouting`, créé comme `strategy_router.branches`. Le [contrat de transfert](lot8b-branch-routing.md) décrit les décisions, les gardes, l’état et les adaptations natives de calcul borné.

La reconnaissance préalable est conservée dans [preparation-20261111](lot8b-evidence/preparation-20261111/README.md). La lecture initiale a été effectuée sur le commit de travail **`c87c132a0353a8c6138ad090495f98698ef7ca6f`**, après intégration du **Site 107 / native 0.66.0**, source publiée `4ff7bf45286a8a19d34401988adca587253ae41e`. Elle ne modifie pas les sources originales.

Le jalon de raccordement commun est qualifié sur les sources et tests figés au commit **`2583d81d856c13295040db88f5df8b3a99906bdc`**. Le [bilan commun](lot8b-evidence/common-integration-01/README.md) et la [synthèse de validation](lot8b-evidence/common-integration-01/validation-summary.json) conservent les commandes, empreintes, résultats et limites. Le candidat dispose de **69/76 entrées raccordées** et n’est pas publié. **Site 107 / native 0.66.0 reste publié à 68/76** ; aucun nouveau numéro de version n’est réservé.

Le [jalon de qualification de livraison](lot8b-evidence/delivery-qualification-01/README.md) réutilise exactement les mêmes 331 fichiers natifs. Leur digest canonique est `3ff1d9ad56e22aedc0fee3a0da6a3af50a1da0bc14a0ba01cb38272ba85234be` ; la [réconciliation](lot8b-evidence/delivery-qualification-01/source-digest-reconciliation.json) relie ce digest au `76a403016d2b28287194b7498f10e14727b7e3fb3f214d2f79cb0292390d54bf` historique, avec une table de chemins et hashes identique et un ordre de sérialisation différent. Les captures appariées ont été exécutées au commit documentaire `0830ca822e2e4330fa3ffb68d333167b3389fc26`, contre le véritable publié 0.66.

Les chemins ci-dessous sont relatifs à `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/`.

| Source | Octets | SHA-256 |
| --- | ---: | --- |
| `laya_proto/common_branch_routing.py` | 12 911 | `b3f6a743e1ebdbf040a06a9c0d42b822c08ec28dff43cd2eb013ef41d0f27567` |
| `laya_proto/common_multiscale_constraints.py` | 16 566 | `01da7c7f636ed2039a364188c7f4fedb2c4c0a0e8bb6b2ba7f22b1c259eaaf12` |
| `morphology_policy/strategy.py` | 34 610 | `425aca6c30e7abb38a537dfcef38f92c418bc4dfa35201ae52dc42ba4390fa55` |
| `morphology_policy/strategy.drm` | 46 966 | `6e8aee941d56511273be79222b03c88d092cdc3ca1c295c91509b9cc93b15f44` |
| `laya_proto/common_frontier_runtime.py` | 97 217 | `bcc9bc79d04287c830efedce48b4cc2ab89b5600b8a77fe09782c35d1c05c064` |

Les trois helpers directement importés par le composant sont `digest`, `projection` et `rows_digest`. La construction indépendante des observations du corpus emploie le détecteur générique original ; ses imports et empreintes sont déclarés dans le [reçu original courant](lot8b-evidence/component-reference-03/execution.json). Les modules de jeu et les résultats natifs ne constituent pas des dépendances de l’oracle de composant.

## Chaîne de décision originale

`morphology_policy/strategy.py` importe `BranchRouting` et crée une instance propre. Le sous-type `parallel_branch_routing` appelle cette instance avec l’observation, les lignes de pixels, les commandes et le budget restant. Dans `strategy.drm`, l’entrée se trouve dans `factored_material_return`, après `motif_conditioned_access` et avant `conserved_band_transfer`.

La proposition est reconnue par la présence de **`branch_plan`**. Le caller commun sélectionne alors `strategy_router.branches` comme propriétaire de contrainte. Il utilise ses gardes avant/après, puis sa méthode `record` pour le retour physique sélectionné. La mémoire est écrite sous **`branches:<revision>`**, avec la référence de l’observation après action et la révision suivante. Le diagnostic de fin expose **`branch_routing.scored_witnesses`** depuis `passed` et **`branch_routing.observed_effects`** depuis `events`.

Cette filiation justifie un propriétaire direct unique. La factory native qualifiée enregistre `branch_routing` entre `motif_access` et `band_transfer`, sans partage d’état avec MotifAccess ni second évaluateur de la même entrée. Le slot correspondant dans la liste des providers de matériau reste `null`, puisque l’entrée est prise en charge directement.

## Correspondance native qualifiée

| Élément source | Cible native | Qualification acquise et portée |
| --- | --- | --- |
| `BranchRouting` | Classe `BranchRouting`, `id = familyId = branch_routing` | Parité directe sur le petit domaine complet du corpus. |
| `layout`, `bbox` | Fonctions du module `v6-branch-routing-geometry.ts` | Modèle, ordre, couleur active et boîtes identiques. |
| `read_state`, `observed_state` | Lecture de pose et affectation d’identité | Coupes, unicité, minimisation et ambiguïtés identiques après exploration complète. |
| `propagated` | Propagation des fronts et sorties | Ensemble visible et journal ordonné des sorties identiques. |
| `propose`, `bind`, `before`, `after`, `record` | Module `v6-branch-routing.ts` | Propositions et transitions complètes, références et effets inclus. |
| Attributs Python de l’instance | Snapshot `native.branch_routing.v1` | Représentation froide, passage d’époque, copie détachée et restauration atomique avec conditions numériques dérivées de la surface publique. |
| `digest` | `symbolicDigest` existant | Encodage JSON Python, ordre des tableaux et préfixe `C_branches_`. |
| `projection` | Helper natif de projection existant | Bornes inclusives converties en tranches, indices négatifs et coupes partielles. |
| `rows_digest` | Fonction pure `motifRowsDigest` | Forme et octets des projections sélectionnées non vides, sans état Motif partagé. |
| Sélection commune de `branch_plan` | `branchRoutingFamily`, réutilisant `originalEventFamily`, puis `subquestionFamily` | Propriétaire unique, sous-question `material_access_subquestion`, entrées clonées et gelées avant attente, calcul borné. |
| `branches:<revision>` | Mapping commun `branch_routing: branches` | Acquisition sélectionnée des retours réussis ; refus typé et conservation intégrale des retours non acquis. |

Le raccordement de `parallel_branch_routing` est maintenant constaté par la vraie factory et l’audit des entrées : **69/76 au total et 26/33 dans `factored_material_return`**. Le programme commun `v6.composition_strategy.choose` reste le point de décision existant ; aucun nouveau programme compilé n’est introduit. Le littéral de version du candidat reste 0.66.0 pendant ce développement. Son commit, sa liste de familles, ses extensions et son digest de source le distinguent de la source effectivement publiée.

## Adaptations explicitement distinctes de la source

### Réduction des solutions en flux

La source accumule toutes les solutions puis appelle `min`. Le port conserve uniquement le meilleur triplet `(cost, starts, displacement)` en parcourant le même domaine, ce qui évite de retenir toutes les solutions. Cette adaptation conserve le résultat uniquement lorsque le domaine entier a été examiné. Elle ne permet pas de publier un minimum partiel lors d’une interruption.

### Produits cartésiens bornés et coopération

Le mode natif borné déclare au maximum 16 384 affectations d’identité et 65 536 placements, avec cession coopérative tous les 128 éléments sur le chemin asynchrone de proposition. La méthode de composant `record` reste synchrone et bornée, sans promesse de cession asynchrone pendant l’acquisition. Les bornes peuvent être réduites dans des cas de preuve séparés. La sortie signale l’incomplétude, sans conclusion d’impossibilité. Le mode exact direct reste réservé aux petites fixtures annoncées et ne constitue pas une promesse de performance générale.

Ces plafonds portent uniquement sur les deux produits cartésiens. Ils ne bornent pas le temps ou la mémoire de l’ensemble du composant : `layout` est synchrone et non coopératif, tandis que la préparation des options, les copies, les digests et l’historique conservé ont leur propre coût. Aucune garantie globale de latence, de mémoire ou de réactivité n’est déduite des seuls compteurs d’énumération.

La protection interne contre une mutation pendant une cession porte sur **l’état du propriétaire**. L’adaptateur commun complète désormais cette garde : il clone ensemble l’observation JSON, le raster et les commandes, puis les gèle récursivement avant le premier `await` du propriétaire. Les références demeurent attachées aux données de cet instantané. Un test commun qualifie l’isolation des trois entrées pendant l’attente. Cette garantie porte sur l’adaptateur, sans transformer les appels directs au composant en transactions générales sur les objets partagés.

Si la lecture d’identité de `record` ne termine pas, `BranchRoutingIncomplete` est levée avant mutation de cette acquisition. L’adaptateur commun attrape seulement cette exception typée et produit `events: []` avec un refus `unknown` lié au retour `after`, sans autorité et avec `frontier.complete: false`. La boucle conserve durablement la transition publique intégrale, comprenant observations, packets, rasters, animations, commande, index et résultat du garde après action. Le reçu porte `acquired: false`, `release_authority: false` et un lien vers la proposition conservée dans `prefix_evidence:<revision>`.

Après la première lacune, les acquisitions BranchRouting du suffixe sont suspendues : chaque retour reste conservé et non acquis, sans nouvel appel au propriétaire. Les autres acquisitions communes et passives conservent leur passage unique. Le runtime termine avec `native_acquisition_incomplete`, sous réserve de la priorité d’une fin officielle. `resume()` conserve cet arrêt terminal et ne rejoue ni l’acquisition ni l’action physique. Il n’existe pas de reprise automatique dans ce jalon. Les compteurs communs `acquiredRecords` et `caller.acquiredTransitions` incluent les retours réconciliés portant un refus ; les seuls compteurs ne prouvent donc pas une acquisition BranchRouting réussie.

### Checkpoint

L’original ne possède pas de méthode de restauration indépendante. Le snapshot natif sérialise ses attributs sans inventer de contexte d’époque à froid. La validation atomique du snapshot est une extension native. Elle conserve les transitions source valides couvertes, y compris le modèle absent, les mouvements acquis dans une ancienne époque et les événements historiques dont le nombre de contributeurs diffère du modèle courant.

La limite numérique identifiée au jalon de composant est fermée par des conditions nécessaires dérivées de `validateRows` : **surface totale au plus égale à 65 536 pixels**, et non 65 536 pixels par axe. Les quotients sont vérifiés avant les produits de géométrie. Le modèle initial respecte les surfaces des barres et sources, l’étendue `unit * limit` et ses coordonnées ; `current` requiert des rectangles mesurés complets dans une forme de raster public possible. Cette forme peut changer dans une même époque. Les états prédits de `seen` et `event.before` conservent le droit aux coupes partielles, sans exiger la présence du rectangle complet. Les événements historiques sont vérifiés séparément, sans leur imposer le modèle courant.

Les [tests de frontière publique](../../tests/v6-branch-routing-public-boundary.test.ts) couvrent sept cas ciblés, dont les rasters minces, les produits excessifs, l’atomicité du rejet, le changement de forme et les prédictions partiellement visibles. La restauration vérifie la cohérence numérique nécessaire ; elle **n’authentifie pas la provenance** d’un snapshot et n’ajoute pas de quota global à l’historique. Elle ne constitue jamais une observation autorisant une action.

## Provenance du corpus et usage commun

Le corpus initial annoncé comprend des rasters synthétiques indépendants et deux catégories clairement identifiées : des chaînes depuis froid avec retours/acquisitions originaux, et des états contrefactuels explicitement déclarés pour isoler une branche de la méthode. Un contrefactuel n’est pas décrit comme une méthode apprise.

Les fonctions et la classe Python originales produisent les valeurs de référence. La normalisation des tuples, ensembles et scalaires NumPy sert seulement à leur transport JSON. Elle doit être explicite et identique pour les comparaisons. Une partie native ne peut pas fournir une observation, un modèle, une clé apprise ou une sortie attendue à l’oracle.

Les scénarios positifs sont accompagnés de cas contraires dans le corpus déclaré : ambiguïté d’identité, changement de sélection, déplacement inattendu, absence de commande, égalité de coût, frontière d’époque et sorties hors champ. Le score positif éventuellement déclaré dans une fixture sert à tester la branche `official_boundary` du composant ; il ne prouve aucune réussite de niveau dans un jeu réel.

Les tests communs réutilisent les rasters indépendants et rattachent explicitement les références aux observations produites par le runtime. Les chaînes froides obtiennent leurs mouvements par les retours et acquisitions de la session de test. Le domaine de points reste celui du caller commun : la sélection triple utilise `(6, 13)`, alors que le corpus de composant avait placé `(7, 13)` en tête de sa liste manuelle. La garde pointée commune vérifie le témoin et la projection courante séparément du garde `before` source. Ces adaptations déclarées ne sont pas présentées comme un rejeu identique du caller Python original.

Les bornes et les refus de ressources disposent de leurs propres tests. Aucun résultat de parité complète sur un petit domaine n’est transformé en garantie de fermeture du domaine général ou de coût sous un budget global.

## Limites de preuve et suite

Le [bilan de composant](lot8b-evidence/component-stage-01/README.md) conserve les résultats acquis et leurs commandes, entrées et sorties exactes : 249 tests et sous-tests de référence, 17 tests de contrat et typage passés, sur 20 cas géométriques et 83 opérations originales. Cette parité source reste limitée au petit domaine indépendant annoncé.

Le [bilan commun](lot8b-evidence/common-integration-01/README.md) et sa [synthèse](lot8b-evidence/common-integration-01/validation-summary.json) qualifient maintenant l’enregistrement unique, les gardes courantes, l’acquisition sélectionnée, la restauration du runtime, les effets contraires, l’isolation et la conservation des acquisitions incomplètes, dans les cas déclarés. Les sept contrôles finaux sont passés :

| Contrôle | Portée acquise |
| --- | --- |
| BranchRouting | 281 tests et sous-tests sur 4 modules : 249 de référence, 17 de contrat, 7 de frontière et 8 de parcours/intégration communs. |
| Régressions runtime | 160 tests et sous-tests sur 15 modules. |
| Régressions voisins | 83 tests et sous-tests sur 4 modules. |
| Typage | Passé. |
| Audit des entrées | 69/76 dans le candidat, avec une seule nouvelle entrée directe. |
| Audit de migration `migration-audit-02` | 215 `component_verified`, 147 `partial_transfer`, 1 007 `pending`, 0 `verified` ; six portes globales fausses. |
| Build | Passé. |

Les **524 tests et sous-tests Node couvrent 23 modules déclarés**. Les huit tests de parcours/intégration communs comprennent des chaînes froides, ainsi que des cas de registre, de refus et d’isolation. À elles seules, ces preuves ciblées ne constituent pas toute la suite, une campagne générale, une parité complète du caller original ou une attribution complète des formes de travail et graphes.

Le jalon historique de raccordement ne comprenait aucun jeu ni rejeu. Le dossier complémentaire qualifie **64 contrôles de formes sur 58 points, 22 312 différences attribuées sans résidu**, et **11 régressions enregistrées / 187 projections inchangées**. Les cinq chaînes de contribution restent à terminer après le refus initial de la façade 64 × 64, avant toute création du runtime. Elles emploieront la vraie API du runtime commun avec les rasters originaux, sans revendiquer les tickets ou le transport public. Les 524 tests ne sont pas relancés ni additionnés à ces populations. Aucune nouvelle campagne de jeu, mesure de coût officiel 8B ou publication n’a lieu dans ce jalon. Une future publication nécessitera sa propre qualification et sa réservation de version. Le candidat 69/76 reste non publié, Site 107 / native 0.66.0 demeure la livraison 68/76 et aucun nouveau numéro n’est réservé.

La règle de coût conservée est une augmentation de la médiane globale des sessions complètes strictement inférieure à 10 % pour STCK et pour SMLP séparément. Un dépassement de phase peut être accepté si les deux critères globaux passent. Les réserves de coût des publications prioritaires antérieures restent distinctes.

**LKEY demeure définitivement fermé.** Cette filiation ne lit aucun jeu, payload ou oracle de ce cas, et n’autorise ni nouvelle partie ni remise à zéro.
